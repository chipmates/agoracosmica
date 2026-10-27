// The sheets over the page: the full player (from the dock's handle), the
// facts of one story (fetched on open), the reader's display settings ("Aa")
// and the saved sentences. On a phone each rises from the bottom; on a
// desktop the facts, the display and the saved sentences stand beside the
// text as a side panel, so the text stays readable while they are open.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import {
  closeReader,
  closeSheet,
  dismiss,
  hasNext,
  hasPrevious,
  nextStory,
  openReader,
  openSheet,
  playFrom,
  previousStory,
  readPageQueue,
  removeSaved,
  seekTo,
  setAutoNext,
  skipBack,
  skipForward,
  stepRate,
  togglePlay,
  RATE_MAX,
  RATE_MIN,
} from './controller';
import { cleanFact, loadFacts, loadText, loadTiming } from './content';
import type { FactEntry } from './content';
import { buildModel, sentenceStart } from './readalong';
import { focusSentence } from './StoryReader';
import { getDisplay, setDisplay, subscribeDisplay, SERVER_DISPLAY, SIZE_MAX, SIZE_MIN } from './theme';
import type { DisplaySettings } from './theme';
import { Icon } from './icons';
import { hideToast } from './toast';
import { clockLabel, playerStrings, rateLabel } from './strings';
import type { PlayerLang, PlayerStrings } from './strings';
import type { FactWords } from './factWords';
import type { PlayerState, StoryQueue } from './types';

interface Props {
  state: PlayerState;
  facts: Record<PlayerLang, FactWords>;
  wide: boolean;
}

export default function Sheets({ state, facts, wide }: Props) {
  const queue = state.sheet === 'player' ? state.queue : readPageQueue() ?? state.queue;
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const opener = useRef<Element | null>(null);
  const kind = state.sheet;

  useEffect(() => {
    opener.current = document.activeElement;
    titleRef.current?.focus({ preventScroll: true });
    if (kind) hideToast();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeSheet();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const back = opener.current;
      if (back instanceof HTMLElement && back.isConnected) back.focus({ preventScroll: true });
    };
  }, [kind]);

  if (!kind || !queue) return null;
  const s = playerStrings(queue.lang);
  // Beside the text on a desktop: no scrim, the page stays live.
  const side = wide && kind !== 'player';
  // The display sheet previews its choices live: no dimming on a phone either.
  const scrim = !side && kind !== 'display';
  const cls = `sp-sheet sp-sheet--${kind}${side ? ' sp-sheet--side' : ''}`;

  return (
    <>
      {scrim && <div className="sp-scrim" onClick={closeSheet} aria-hidden="true" />}
      <section className={cls} role="dialog" aria-modal={scrim ? 'true' : 'false'} aria-labelledby="sp-sheet-title"
        data-nosnippet="">
        {kind === 'player' && state.queue && (
          <PlayerSheet state={state} queue={state.queue} s={s} w={facts[state.queue.lang]} titleRef={titleRef} />
        )}
        {kind === 'facts' && (
          <FactsSheet queue={queue} n={state.sheetN ?? state.readerN ?? state.current ?? 1} s={s} w={facts[queue.lang]} titleRef={titleRef} />
        )}
        {kind === 'display' && <DisplaySheet s={s} titleRef={titleRef} />}
        {kind === 'saved' && <SavedSheet state={state} queue={queue} s={s} titleRef={titleRef} />}
      </section>
    </>
  );
}

function Head({ title, kicker, s, titleRef }: { title: string; kicker?: string; s: PlayerStrings; titleRef: RefObject<HTMLHeadingElement> }) {
  return (
    <div className="sp-sheet__head">
      <h2 className="sp-sheet__title" id="sp-sheet-title" tabIndex={-1} ref={titleRef}>
        {kicker && <span className="sp-sheet__kicker">{kicker}</span>}
        {title}
      </h2>
      <button type="button" className="story-btn sp-sheet__x" onClick={closeSheet} aria-label={s.close}>{Icon.close}</button>
    </div>
  );
}

// ---- the full player ---------------------------------------------------------

// No label line here: the dock says it at each story's start and the lock screen carries it.
function PlayerSheet({ state, queue, s, w, titleRef }: { state: PlayerState; queue: StoryQueue; s: PlayerStrings; w: FactWords; titleRef: RefObject<HTMLHeadingElement> }) {
  const current = state.current ?? 0;
  const entry = queue.entries.find(e => e.n === current);
  const title = current === 0 ? s.introTitle : entry?.title ?? s.storyN(current);
  const kicker = current === 0 ? queue.name : [s.storyN(current), entry?.year ? s.approxYear(entry.year) : ''].filter(Boolean).join(' · ');
  const playing = state.status === 'playing' || state.status === 'loading';
  const seekRef = useRef<HTMLInputElement | null>(null);
  const pct = state.duration > 0 ? Math.min(100, (state.time / state.duration) * 100) : 0;
  useEffect(() => {
    seekRef.current?.style.setProperty('--story-seek', `${pct}%`);
  }, [pct]);
  const rate = rateLabel(state.rate, queue.lang);
  return (
    <>
      <Head title={title} kicker={kicker} s={s} titleRef={titleRef} />
      <div className="sp-sheet__body">
        <div className="sp-fp__seek">
          <input ref={seekRef} type="range" min={0} max={state.duration > 0 ? Math.floor(state.duration) : 0} step={1}
            value={Math.floor(state.time)} aria-label={s.seekAria}
            aria-valuetext={`${clockLabel(state.time)} / ${clockLabel(state.duration)}`}
            onChange={e => seekTo(Number(e.currentTarget.value))} />
          <div className="sp-fp__times"><span>{clockLabel(state.time)}</span><span>{clockLabel(state.duration)}</span></div>
        </div>
        <div className="sp-fp__transport">
          <button type="button" className="story-btn" onClick={previousStory} disabled={!hasPrevious() && state.time < 1} aria-label={s.prevAria}>{Icon.prev}</button>
          <button type="button" className="story-btn" onClick={skipBack} aria-label={s.back15Aria}>{Icon.back15}</button>
          <button type="button" className="story-btn sp-fp__play" onClick={togglePlay} aria-label={playing ? s.pauseAria : s.playAria}>
            {playing ? Icon.pause : Icon.play}
          </button>
          <button type="button" className="story-btn" onClick={skipForward} aria-label={s.fwd15Aria}>{Icon.fwd15}</button>
          <button type="button" className="story-btn" onClick={nextStory} disabled={!hasNext()} aria-label={s.nextAria}>{Icon.next}</button>
        </div>
        <div className="sp-field sp-fp__speed">
          <span className="sp-field__label" id="sp-speed-l">{s.speed}</span>
          <div className="sp-stepper" role="group" aria-labelledby="sp-speed-l">
            <button type="button" className="story-btn" onClick={() => stepRate(-1)} disabled={state.rate <= RATE_MIN} aria-label={s.slower}>{Icon.minus}</button>
            <span className="sp-stepper__val" aria-live="polite">{rate}</span>
            <button type="button" className="story-btn" onClick={() => stepRate(1)} disabled={state.rate >= RATE_MAX} aria-label={s.faster}>{Icon.plus}</button>
          </div>
        </div>
        <div className="sp-field">
          <span className="sp-field__label" id="sp-after-l">{s.after}</span>
          <div className="sp-seg" role="radiogroup" aria-labelledby="sp-after-l">
            <button type="button" role="radio" aria-checked={state.autoNext} onClick={() => setAutoNext(true)}>{s.afterNext}</button>
            <button type="button" role="radio" aria-checked={!state.autoNext} onClick={() => setAutoNext(false)}>{s.afterStop}</button>
          </div>
        </div>
        <div className="sp-fp__links">
          <button type="button" className="sp-linkbtn" onClick={() => { closeSheet(); openReader(current); }}>{Icon.book}<span>{s.read}</span></button>
          <button type="button" className="sp-linkbtn" onClick={() => openSheet('facts', current)}>{Icon.checkCircle}<span>{w.facts}</span></button>
          <button type="button" className="sp-linkbtn sp-linkbtn--quiet" onClick={dismiss}>{s.stopAll}</button>
        </div>
      </div>
    </>
  );
}

// ---- facts ------------------------------------------------------------------------

function FactsSheet({ queue, n, s, w, titleRef }: { queue: StoryQueue; n: number; s: PlayerStrings; w: FactWords; titleRef: RefObject<HTMLHeadingElement> }) {
  const [entry, setEntry] = useState<FactEntry | null | 'error'>(null);
  useEffect(() => {
    let live = true;
    setEntry(null);
    loadFacts(queue)
      .then(sheet => live && setEntry(sheet.stories.get(n) ?? 'error'))
      .catch(() => live && setEntry('error'));
    return () => {
      live = false;
    };
  }, [queue, n]);
  const item = queue.entries.find(e => e.n === n);
  const title = n === 0 ? s.introTitle : item?.title ?? s.storyN(n);
  const kicker = `${w.facts} · ${n === 0 ? queue.name : w.storyNumber.replace('{number}', String(n))}`;
  const toSources = () => {
    closeSheet();
    closeReader();
    window.setTimeout(() => {
      const target = document.querySelector('.fig-sources');
      if (target) target.scrollIntoView({ block: 'start' });
      else window.location.href = `${queue.lang === 'de' ? '/de' : ''}/figures/${queue.slug}/`;
    }, 0);
  };
  return (
    <>
      <Head title={title} kicker={kicker} s={s} titleRef={titleRef} />
      <div className="sp-sheet__body sp-facts">
        {entry === null && <p className="sp-facts__status" aria-live="polite">{s.factsLoading}</p>}
        {entry === 'error' && <p className="sp-facts__status">{s.factsError}</p>}
        {entry && entry !== 'error' && (
          <>
            {(entry.year || entry.age || entry.setting) && (
              <dl className="sp-facts__meta">
                {entry.year && <div><dt>{Icon.calendar}<span>{w.year}</span></dt><dd>{s.approxYear(cleanFact(entry.year))}</dd></div>}
                {entry.age && <div><dt>{Icon.user}<span>{w.age}</span></dt><dd>{cleanFact(entry.age)}</dd></div>}
                {entry.setting && <div><dt>{Icon.pin}<span>{w.setting}</span></dt><dd>{cleanFact(entry.setting)}</dd></div>}
              </dl>
            )}
            {entry.documented.length > 0 && (
              <section className="sp-facts__list sp-facts__list--doc">
                <h3>{Icon.checkCircle}<span>{w.documented}</span></h3>
                <ul>{entry.documented.map((x, i) => <li key={i}>{cleanFact(x)}</li>)}</ul>
              </section>
            )}
            {entry.recreated.length > 0 && (
              <section className="sp-facts__list sp-facts__list--rec">
                <h3>{Icon.pencil}<span>{w.recreated}</span></h3>
                <ul>{entry.recreated.map((x, i) => <li key={i}>{cleanFact(x)}</li>)}</ul>
              </section>
            )}
            {entry.note && (
              <p className="sp-facts__note">{Icon.info}<span><span className="sp-sr">{w.note}: </span>{cleanFact(entry.note)}</span></p>
            )}
            {entry.notes.length > 0 && (
              <section className="sp-facts__list sp-facts__list--notes">
                <h3>{Icon.info}<span>{w.notes}</span></h3>
                <ul>{entry.notes.map((x, i) => <li key={i}>{cleanFact(x)}</li>)}</ul>
              </section>
            )}
          </>
        )}
        <p className="sp-facts__more">
          <button type="button" className="sp-linkbtn" onClick={toSources}>{Icon.book}<span>{w.figureOverview}</span></button>
        </p>
      </div>
    </>
  );
}

// ---- display ("Aa") ------------------------------------------------------------------

function DisplaySheet({ s, titleRef }: { s: PlayerStrings; titleRef: RefObject<HTMLHeadingElement> }) {
  const d = useSyncExternalStore(subscribeDisplay, getDisplay, () => SERVER_DISPLAY);
  const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
  const size = d.size ?? (wide ? 21 : 19);
  const sizeRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    sizeRef.current?.style.setProperty('--story-seek', `${((size - SIZE_MIN) / (SIZE_MAX - SIZE_MIN)) * 100}%`);
  }, [size]);
  const seg = <K extends 'face' | 'spacing' | 'highlight'>(key: K, values: DisplaySettings[K][], words: string[], labelId: string) => (
    <div className="sp-seg" role="radiogroup" aria-labelledby={labelId}>
      {values.map((v, i) => (
        <button key={String(v)} type="button" role="radio" aria-checked={d[key] === v}
          onClick={() => setDisplay({ [key]: v } as Partial<DisplaySettings>)}>{words[i]}</button>
      ))}
    </div>
  );
  return (
    <>
      <Head title={s.display} s={s} titleRef={titleRef} />
      <div className="sp-sheet__body sp-aa">
        <div className="sp-field sp-field--stack">
          <span className="sp-field__label" id="sp-light-l">{s.light}</span>
          <div className="sp-swatches" role="radiogroup" aria-labelledby="sp-light-l">
            {(['auto', 'day', 'vellum', 'night'] as const).map((v, i) => (
              <button key={v} type="button" role="radio" aria-checked={d.light === v} className="sp-swatch" onClick={() => setDisplay({ light: v })}>
                <span className={`sp-swatch__card sp-swatch__card--${v}`} aria-hidden="true">Aa</span>
                <span>{s.lights[i]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="sp-field sp-field--stack">
          <span className="sp-field__label" id="sp-size-l">{s.textSize}</span>
          <div className="sp-sizer">
            <button type="button" className="story-btn sp-sizer__a" onClick={() => setDisplay({ size: Math.max(SIZE_MIN, size - 1) })}
              disabled={size <= SIZE_MIN} aria-label={s.smaller}>A</button>
            <input ref={sizeRef} type="range" min={SIZE_MIN} max={SIZE_MAX} step={1} value={size} aria-labelledby="sp-size-l"
              aria-valuetext={s.sizeValue(size)} onChange={e => setDisplay({ size: Number(e.currentTarget.value) })} />
            <button type="button" className="story-btn sp-sizer__a sp-sizer__a--big" onClick={() => setDisplay({ size: Math.min(SIZE_MAX, size + 1) })}
              disabled={size >= SIZE_MAX} aria-label={s.larger}>A</button>
            <output className="sp-sizer__val">{s.sizeValue(size)}</output>
          </div>
        </div>
        <div className="sp-grid">
          <span className="sp-field__label" id="sp-face-l">{s.face}</span>
          {seg('face', ['book', 'clear'], s.faces, 'sp-face-l')}
          <span className="sp-field__label" id="sp-spacing-l">{s.spacing}</span>
          {seg('spacing', ['tight', 'normal', 'airy'], s.spacings, 'sp-spacing-l')}
          <span className="sp-field__label" id="sp-hl-l">{s.highlight}</span>
          {seg('highlight', ['word', 'sentence', 'off'], s.highlights, 'sp-hl-l')}
        </div>
        <button type="button" className="sp-switch" role="switch" aria-checked={d.follow} onClick={() => setDisplay({ follow: !d.follow })}>
          <span className="sp-switch__text">
            <span className="sp-switch__t">{s.followVoice}</span>
            <span className="sp-switch__h">{s.followHelp}</span>
          </span>
          <span className="sp-switch__knob" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

// ---- saved sentences ---------------------------------------------------------------------

function SavedSheet({ state, queue, s, titleRef }: { state: PlayerState; queue: StoryQueue; s: PlayerStrings; titleRef: RefObject<HTMLHeadingElement> }) {
  const list = [...state.saved].sort((a, b) => a.n - b.n || a.si - b.si);
  const from = async (n: number, si: number) => {
    const [blocks, timing] = await Promise.all([loadText(queue, n), loadTiming(queue, n)]);
    const model = buildModel(blocks, timing, n === 0);
    playFrom(queue, n, sentenceStart(model, si));
  };
  return (
    <>
      <Head title={s.savedTitle} s={s} titleRef={titleRef} />
      <div className="sp-sheet__body">
        <p className="sp-saved__note">{s.savedNote(!!queue.she)}</p>
        <ul className="sp-saved">
          {list.map(item => {
            const entry = queue.entries.find(e => e.n === item.n);
            return (
              <li key={`${item.n}-${item.si}`}>
                <p className="sp-saved__text">{item.text}</p>
                <p className="sp-saved__src">{[item.n === 0 ? s.introTitle : s.storyN(item.n), item.n === 0 ? '' : entry?.title].filter(Boolean).join(' · ')}</p>
                <div className="sp-saved__acts">
                  <button type="button" className="sp-linkbtn" onClick={() => { closeSheet(); void from(item.n, item.si); }}>
                    {Icon.play}<span>{s.fromHere}</span>
                  </button>
                  <button type="button" className="sp-linkbtn" onClick={() => { closeSheet(); focusSentence(item.n, item.si); openReader(item.n); }}>
                    {Icon.book}<span>{s.showInText}</span>
                  </button>
                  <button type="button" className="story-btn sp-saved__rm" onClick={() => removeSaved(item.n, item.si)} aria-label={s.remove}>
                    {Icon.trash}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
