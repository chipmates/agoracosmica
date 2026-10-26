// The reading view: the playing story's text, fetched from R2 only when the
// visitor opens it (never in the page's HTML), with the paragraph that is
// playing marked from the story's per-paragraph timestamps.

import { useEffect, useRef, useState } from 'react';
import { getPublicAudioUrl } from '@client/utils/public/publicMediaUrl';
import { RATES, seekTo, setRate } from './controller';
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

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  state: PlayerState;
  s: PlayerStrings;
  label: { brief: string; expanded: string };
  note: string;
  onClose: () => void;
}

export default function StoryReader({ state, s, label, note, onClose }: Props) {
  const { queue, current } = state;
  const [text, setText] = useState<StoryText | null>(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState(1);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
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

  const activeParagraphIndex = activeParagraph(text?.timestamps, state.time);

  useEffect(() => {
    if (activeParagraphIndex === null || !bodyRef.current) return;
    if (Date.now() - userScrollAt.current < FOLLOW_PAUSE_MS) return;
    const el = bodyRef.current.querySelector<HTMLElement>(`[data-p="${activeParagraphIndex}"]`);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [activeParagraphIndex]);

  if (!queue || current === null) return null;
  const entry = queue.entries.find(e => e.n === current);
  const markUserScroll = () => {
    userScrollAt.current = Date.now();
  };

  return (
    <section
      className="story-reader"
      role="dialog"
      aria-modal="false"
      aria-label={s.readerAria}
      data-size={TEXT_SIZES[size]}
    >
      <header className="story-reader__head">
        <div className="story-reader__titles">
          <p className="story-reader__kicker">{`${queue.name} · ${s.storyN(current)}`}</p>
          <h2 className="story-reader__title">{entry?.title ?? s.storyN(current)}</h2>
        </div>
        <button ref={closeRef} type="button" className="story-btn story-reader__close" onClick={onClose} aria-label={s.readerClose}>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
      </header>

      <div className="story-reader__tools">
        <div className="story-reader__group" role="group" aria-label={s.textSize}>
          <button type="button" className="story-btn story-btn--text" onClick={() => setSize(v => Math.max(0, v - 1))}
            disabled={size === 0} aria-label={s.textSmaller}>A−</button>
          <button type="button" className="story-btn story-btn--text" onClick={() => setSize(v => Math.min(TEXT_SIZES.length - 1, v + 1))}
            disabled={size === TEXT_SIZES.length - 1} aria-label={s.textLarger}>A+</button>
        </div>
        <div className="story-reader__group" role="group" aria-label={s.speed}>
          <span className="story-reader__toolname" aria-hidden="true">{s.speed}</span>
          {RATES.map(rate => (
            <button key={rate} type="button" className="story-btn story-btn--text" aria-pressed={state.rate === rate}
              onClick={() => setRate(rate)}>{`${rate}×`}</button>
          ))}
        </div>
        <label className="story-reader__seek">
          <span className="story-reader__time">{fmt(state.time)}</span>
          <input
            type="range"
            min={0}
            max={state.duration > 0 ? Math.floor(state.duration) : 0}
            step={1}
            value={Math.floor(state.time)}
            aria-label={s.seekAria}
            aria-valuetext={`${fmt(state.time)} / ${fmt(state.duration)}`}
            onChange={e => seekTo(Number(e.currentTarget.value))}
          />
          <span className="story-reader__time">{fmt(state.duration)}</span>
        </label>
      </div>

      <div
        ref={bodyRef}
        className="story-reader__body"
        data-nosnippet=""
        onWheel={markUserScroll}
        onTouchMove={markUserScroll}
        onKeyDown={markUserScroll}
        tabIndex={0}
      >
        <p className="story-reader__note">{note}</p>
        <details className="story-label story-label--reader">
          <summary>{label.brief}</summary>
          <p>{label.expanded}</p>
        </details>
        {failed && <p className="story-reader__status">{s.textError}</p>}
        {!failed && !text && <p className="story-reader__status" aria-live="polite">{s.textLoading}</p>}
        {text?.paragraphs.map((p, i) => (
          <p key={i} data-p={i} className={i === activeParagraphIndex ? 'story-reader__p is-active' : 'story-reader__p'}
            aria-current={i === activeParagraphIndex ? 'true' : undefined}>
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}
