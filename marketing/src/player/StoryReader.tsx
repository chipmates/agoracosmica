// The reading view: the playing story's text, fetched from R2 only when the
// visitor opens it (never in the page's HTML), set like a page of a book, with
// the paragraph that is playing marked from the story's per-paragraph
// timestamps and kept in view.

import { useEffect, useRef, useState } from 'react';
import { getPublicAudioUrl } from '@client/utils/public/publicMediaUrl';
import { RATES, setRate } from './controller';
import { rateLabel } from './strings';
import { currentTheme, setTheme } from './theme';
import type { PlayerStrings } from './strings';
import type { PlayerState, StoryQueue } from './types';

// The shape of a story's .timestamps.json, as the app's StoryService reads it.
interface StoryTimestamps {
  paragraphs: { index: number; start: number; end: number }[];
}

interface StoryText {
  paragraphs: string[];
  timestamps: StoryTimestamps | undefined;
}

const cache = new Map<string, StoryText>();

const TEXT_SIZES: readonly string[] = ['s', 'm', 'l', 'xl'];

// After the visitor scrolls the text, the view stops following the voice for
// a moment, so it never pulls the page out from under a reader.
const FOLLOW_PAUSE_MS = 4000;

async function loadStoryText(queue: StoryQueue, n: number, signal: AbortSignal): Promise<StoryText> {
  const key = `${queue.figureId}/${queue.lang}/${n}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const base = getPublicAudioUrl(queue.figureId, queue.lang, n).replace(/\.webm$/, '');
  const [textRes, stampsRes] = await Promise.all([
    fetch(`${base}.txt`, { signal }),
    fetch(`${base}.timestamps.json`, { signal }).catch(() => null),
  ]);
  if (!textRes.ok) throw new Error(`text ${textRes.status}`);
  const raw = (await textRes.text()).replace(/\r\n?/g, '\n');
  const paragraphs = raw.split('\n\n').map(p => p.trim()).filter(Boolean);
  let timestamps: StoryTimestamps | undefined;
  const type = stampsRes?.headers.get('content-type') ?? '';
  if (stampsRes?.ok && type.includes('json')) {
    try {
      const data = (await stampsRes.json()) as StoryTimestamps;
      if (Array.isArray(data?.paragraphs)) timestamps = data;
    } catch {
      // no highlight without timestamps; the text still reads
    }
  }
  const result = { paragraphs, timestamps };
  cache.set(key, result);
  return result;
}

/** The paragraph the voice is in: the last one that started at or before t. */
function activeParagraph(stamps: StoryTimestamps | undefined, t: number): number | null {
  const list = stamps?.paragraphs ?? [];
  const first = list[0];
  if (!first || t < first.start) return null;
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if ((list[mid]?.start ?? Infinity) <= t) lo = mid;
    else hi = mid - 1;
  }
  return list[lo]?.index ?? null;
}

const CloseIcon = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);
const SunIcon = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const MoonIcon = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M19.4 14.7A7.8 7.8 0 0 1 9.3 4.6a7.8 7.8 0 1 0 10.1 10.1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
);
const DownIcon = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M12 4.5v13M6.5 12l5.5 5.5 5.5-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const ChevronIcon = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M6 9.5l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
// A hedera, the leaf Roman stonecutters set between words.
const Hedera = (
  <svg viewBox="0 0 132 18" aria-hidden="true" focusable="false">
    <path d="M2 9h44M88 9h42" stroke="currentColor" strokeWidth="1" fill="none" />
    <path d="M80 9C75 5.4 71.6 2.6 67.4 2.9 63.9 3.2 62.3 5.7 63.6 9 62.3 12.3 63.9 14.8 67.4 15.1 71.6 15.4 75 12.6 80 9Z" fill="currentColor" />
    <path d="M63.6 9C59.4 9 56.2 10.6 53.6 13.4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </svg>
);

interface Props {
  state: PlayerState;
  s: PlayerStrings;
  label: { brief: string; expanded: string };
  onClose: () => void;
}

export default function StoryReader({ state, s, label, onClose }: Props) {
  const { queue, current } = state;
  const [text, setText] = useState<StoryText | null>(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState(1);
  const [day, setDay] = useState(() => currentTheme() === 'day');
  const [away, setAway] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const userScrollAt = useRef(0);

  useEffect(() => {
    if (!queue || current === null) return;
    const controller = new AbortController();
    setText(null);
    setFailed(false);
    loadStoryText(queue, current, controller.signal)
      .then(result => setText(result))
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setFailed(true);
      });
    return () => controller.abort();
  }, [queue, current]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activeIndex = activeParagraph(text?.timestamps, state.time);
  const playing = state.status === 'playing' || state.status === 'loading';

  // The spoken paragraph stays in view: while its start and most of it show,
  // nothing moves; otherwise it comes to about a third down the view.
  const bringIntoView = (index: number | null, always: boolean) => {
    const box = scrollRef.current;
    if (index === null || !box) return;
    const el = box.querySelector<HTMLElement>(`[data-p="${index}"]`);
    if (!el) return;
    const top = el.offsetTop - box.scrollTop;
    const view = box.clientHeight;
    if (!always && top >= 8 && top + Math.min(el.offsetHeight, view * 0.6) <= view - 8) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ top: Math.max(0, el.offsetTop - view * 0.28), behavior: reduce ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    if (activeIndex === null) return;
    if (Date.now() - userScrollAt.current < FOLLOW_PAUSE_MS) return;
    setAway(false);
    bringIntoView(activeIndex, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follows the voice's paragraph only
  }, [activeIndex, text]);

  if (!queue || current === null) return null;
  const entry = queue.entries.find(e => e.n === current);
  const title = entry?.title ?? s.storyN(current);
  const kicker = [queue.name, entry?.place, entry?.year].filter(Boolean).join(' · ');
  const markUserScroll = () => {
    userScrollAt.current = Date.now();
    if (playing && activeIndex !== null) setAway(true);
  };
  const followVoice = () => {
    userScrollAt.current = 0;
    setAway(false);
    bringIntoView(activeIndex, true);
  };
  const nextRate = RATES[(RATES.indexOf(state.rate) + 1) % RATES.length] ?? 1;
  const toggleTheme = () => {
    const next = currentTheme() === 'day' ? 'night' : 'day';
    setTheme(next);
    setDay(next === 'day');
  };

  return (
    <section
      className="story-reader"
      role="dialog"
      aria-modal="false"
      aria-label={s.readerAria}
      data-size={TEXT_SIZES[size]}
    >
      <div className="story-reader__bar">
        <div className="story-reader__bar-in">
          <button ref={closeRef} type="button" className="story-btn story-reader__close" onClick={onClose} aria-label={s.readerClose}>
            {CloseIcon}
          </button>
          <span className="story-reader__bartitle">{title}</span>
          <div className="story-reader__tools" role="group" aria-label={s.toolsAria}>
            <button type="button" className="story-btn story-reader__smaller" onClick={() => setSize(v => Math.max(0, v - 1))}
              disabled={size === 0} aria-label={s.textSmaller}>A</button>
            <button type="button" className="story-btn story-reader__larger" onClick={() => setSize(v => Math.min(TEXT_SIZES.length - 1, v + 1))}
              disabled={size === TEXT_SIZES.length - 1} aria-label={s.textLarger}>A</button>
            <button type="button" className="story-btn story-reader__speed" onClick={() => setRate(nextRate)}
              aria-label={s.speedAria(rateLabel(state.rate, queue.lang))}>{rateLabel(state.rate, queue.lang)}</button>
            <button type="button" className="story-btn story-reader__theme" onClick={toggleTheme}
              aria-label={day ? s.nightView : s.dayView}>{day ? MoonIcon : SunIcon}</button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="story-reader__scroll"
        onWheel={markUserScroll}
        onTouchMove={markUserScroll}
        onKeyDown={markUserScroll}
        tabIndex={0}
      >
        <article className="story-reader__page">
          <header className="story-reader__head">
            {kicker && <p className="story-reader__kicker">{kicker}</p>}
            <h2 className="story-reader__title">{title}</h2>
            <p className="story-reader__note">{s.retellingNote}</p>
            <details className="story-label sp-label">
              <summary>
                <span className="sp-label__i" aria-hidden="true">i</span>
                <span className="sp-label__brief">
                  {label.brief.split(' · ').map((half, i, all) => (
                    <span key={i}>{i > 0 ? ' ' : ''}<span className="sp-label__half">{i < all.length - 1 ? `${half} ·` : half}</span></span>
                  ))}
                </span>
              </summary>
              <p>{label.expanded}</p>
            </details>
            {(entry?.documented || entry?.recreated) && (
              <details className="sp-ledger sp-ledger--one">
                <summary><span>{s.ledgerTitle}</span>{ChevronIcon}</summary>
                <div className="sp-ledger__body">
                  {entry.documented && <p><span className="sp-ledger__key">{s.documented}:</span> {entry.documented}</p>}
                  {entry.recreated && <p><span className="sp-ledger__key">{s.recreated}:</span> {entry.recreated}</p>}
                </div>
              </details>
            )}
          </header>
          <div className="story-reader__orn">{Hedera}</div>
          <div className="story-reader__body" data-nosnippet="" lang={queue.lang}>
            {failed && <p className="story-reader__status">{s.textError}</p>}
            {!failed && !text && <p className="story-reader__status" aria-live="polite">{s.textLoading}</p>}
            {text?.paragraphs.map((p, i) => (
              <p key={i} data-p={i} className={i === activeIndex ? 'story-reader__p is-active' : 'story-reader__p'}
                aria-current={i === activeIndex ? 'true' : undefined}>
                {p}
              </p>
            ))}
          </div>
        </article>
      </div>

      {away && (
        <div className="story-reader__follow">
          <button type="button" className="story-reader__follow-btn" onClick={followVoice}>
            {DownIcon}
            <span>{s.follow}</span>
          </button>
        </div>
      )}
    </section>
  );
}
