// React island: the story dock, its full player, the sheets (facts, display,
// saved) and the reading view. Mounted once per document inside an element
// the client router persists, so it keeps playing while the visitor moves
// between player pages. The page's own controls are plain HTML (page.ts).

import { Suspense, lazy, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  acceptResume,
  declineResume,
  getState,
  hasNext,
  hasPrevious,
  installPlayer,
  listenNow,
  nextStory,
  openReader,
  openSheet,
  previousStory,
  readPageQueue,
  seekTo,
  setAway,
  skipBack,
  skipForward,
  stayHere,
  stepRate,
  subscribe,
  togglePlay,
  closeReader,
  RATE_MAX,
  RATE_MIN,
} from '../player/controller';
import { installPage } from '../player/page';
// The reader, the sheets and the map load after the first screen: on first use, warmed on intent.
const loadReader = () => import('../player/StoryReader');
const loadSheets = () => import('../player/sheets');
const loadMap = () => import('../player/textmap');
const StoryReader = lazy(loadReader);
const Sheets = lazy(loadSheets);
const DockMap = lazy(() => loadMap().then(m => ({ default: m.DockMap })));
let warmed = false;
function warm(): void {
  if (warmed) return;
  warmed = true;
  void loadReader().catch(() => undefined);
  void loadSheets().catch(() => undefined);
  void loadMap().catch(() => undefined);
}
import { Icon } from '../player/icons';
import { VOICE_DESC_ID, clockLabel, labelHalves, playerStrings, rateLabel } from '../player/strings';
import type { FactWords } from '../player/factWords';
import type { PlayerLang } from '../player/strings';
import type { PlayerState } from '../player/types';

interface Label {
  title: string;
  brief: string;
  expanded: string;
}

// How long the dock names the synthetic voice at each story's start, from its first sound; then the figure's name.
const VOICE_MS = 6000;

interface Props {
  /** The page's language, for the resume offer before any story plays. */
  lang: PlayerLang;
  labels: Record<PlayerLang, Label>;
  facts: Record<PlayerLang, FactWords>;
}

const SERVER_STATE: PlayerState = getState();

/** The figure page a queue belongs to, as a path. */
function figurePath(lang: PlayerLang, slug: string): string {
  return `${lang === 'de' ? '/de' : ''}/figures/${slug}/`;
}

function currentPath(): string {
  return typeof window === 'undefined' ? '' : window.location.pathname;
}

export default function StoryDock({ lang, labels, facts }: Props) {
  const state = useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const seekRef = useRef<HTMLInputElement | null>(null);
  const [path, setPath] = useState(currentPath);
  const [wide, setWide] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => {
    installPlayer({ en: labels.en.brief, de: labels.de.brief });
    installPage();
  }, [labels]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // The dock lives across pages: it learns where it is after each swap.
  useEffect(() => {
    const update = () => setPath(currentPath());
    document.addEventListener('astro:page-load', update);
    return () => document.removeEventListener('astro:page-load', update);
  }, []);

  // A press or a focus on a story control, or a story playing, fetches the reader's parts ahead of their first use.
  useEffect(() => {
    const intent = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('[data-story-read], [data-story-saved-open], [data-story-hero-plate], .sp-act, .story-dock')) warm();
    };
    document.addEventListener('pointerdown', intent, true);
    document.addEventListener('focusin', intent, true);
    return () => {
      document.removeEventListener('pointerdown', intent, true);
      document.removeEventListener('focusin', intent, true);
    };
  }, []);
  const storyOn = state.current !== null;
  useEffect(() => {
    if (storyOn) warm();
  }, [storyOn]);

  // CSSOM, not a style attribute: the strict style-src blocks attributes.
  const pct = state.duration > 0 ? Math.min(100, (state.time / state.duration) * 100) : 0;
  useEffect(() => {
    if (fillRef.current) fillRef.current.style.width = `${pct}%`;
    if (seekRef.current) seekRef.current.style.setProperty('--story-seek', `${pct}%`);
  });

  // The page and the reader keep room for the dock's real height: the title may wrap.
  const observer = useRef<ResizeObserver | null>(null);
  const dockEl = useRef<HTMLDivElement | null>(null);
  const publish = useCallback(() => {
    const el = dockEl.current;
    const root = document.documentElement.style;
    if (!el) {
      root.setProperty('--sp-dock-h', '0px');
      root.removeProperty('--story-dock-space');
      return;
    }
    const h = `${Math.ceil(el.getBoundingClientRect().height)}px`;
    root.setProperty('--story-dock-space', h);
    root.setProperty('--sp-dock-h', h);
  }, []);
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    dockEl.current = el;
    publish();
    if (!el || typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(publish);
    observer.current.observe(el);
  }, [publish]);
  // The router swaps the root's attributes on a page change and drops the property.
  useEffect(() => {
    document.addEventListener('astro:after-swap', publish);
    return () => document.removeEventListener('astro:after-swap', publish);
  }, [publish]);

  const storyLang: PlayerLang = state.queue?.lang ?? lang;
  const s = playerStrings(storyLang);
  const label = labels[storyLang];
  const loaded = state.current !== null && !state.dismissed;
  // The label's last half, "Synthetic voice" / "Synthetische Stimme", read from the label itself.
  const halves = labelHalves(label.brief);
  const voiceWord = halves[halves.length - 1] ?? label.brief;

  // Each story's start (a new item, or the same one again after the dock was closed) names the voice: in the bar from
  // the load until VOICE_MS after the first sound, and once to a screen reader through the polite live region.
  const storyKey = loaded && state.queue && state.current !== null ? `${state.queue.slug}/${state.queue.lang}/${state.current}` : null;
  const [quietKey, setQuietKey] = useState<string | null>(null);
  const [live, setLive] = useState('');
  const timerKey = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (storyKey === null) {
      window.clearTimeout(timer.current);
      timerKey.current = null;
      setQuietKey(null);
      setLive('');
      return;
    }
    if (state.status !== 'playing' || timerKey.current === storyKey || quietKey === storyKey) return;
    timerKey.current = storyKey;
    window.clearTimeout(timer.current);
    // emptied first, so a start right after another is announced again
    setLive('');
    window.setTimeout(() => setLive(voiceWord), 60);
    timer.current = window.setTimeout(() => {
      setQuietKey(storyKey);
      setLive('');
    }, VOICE_MS);
  }, [storyKey, state.status, quietKey, voiceWord]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const voiceOn = storyKey !== null && quietKey !== storyKey;
  useEffect(() => {
    if (!noteOpen) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setNoteOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [noteOpen]);
  // The live region speaks at a start; the hidden word is the description every start control points at, so the label
  // is heard with the button, before any sound.
  const liveRegion = (
    <>
      <span className="sp-sr" aria-live="polite" aria-atomic="true" data-story-voice-live>{live}</span>
      <span id={VOICE_DESC_ID} hidden>{voiceWord}</span>
    </>
  );
  // One offer at a time: where the page's plate offers the kept point, the dock stays down.
  const plateOffers = typeof document !== 'undefined' && document.querySelector('[data-story-hero-plate]') !== null;
  const offer = !loaded && state.resume !== null && !plateOffers;
  const readerQueue = state.readerOpen ? readPageQueue() ?? state.queue : null;

  const overlays = (
    <>
      {state.readerOpen && readerQueue && state.readerN !== null && (
        <Suspense fallback={null}>
          <StoryReader state={state} queue={readerQueue} n={state.readerN} label={labels[readerQueue.lang]}
            factsWord={facts[readerQueue.lang].facts} documentedWord={facts[readerQueue.lang].documented}
            recreatedWord={facts[readerQueue.lang].recreated} />
        </Suspense>
      )}
      {state.sheet && (
        <Suspense fallback={null}>
          <Sheets state={state} facts={facts} wide={wide} />
        </Suspense>
      )}
    </>
  );

  if (!loaded && !offer) {
    return <div className="story-dock-slot">{liveRegion}{overlays}</div>;
  }

  if (offer && state.resume) {
    const point = state.resume;
    const title = readPageQueue()?.entries.find(e => e.n === point.n)?.title ?? s.storyN(point.n);
    const text = point.t > 0 ? s.continueAt(title, clockLabel(point.t)) : s.continueNext(title);
    return (
      <div className="story-dock-slot">
        {liveRegion}
        {overlays}
        <div ref={measureRef} className="story-dock story-dock--offer" role="region" aria-label={s.dockLabel}>
          <div className="story-dock__offer">
            <button type="button" className="story-dock__go" onClick={acceptResume} aria-describedby={VOICE_DESC_ID}>
              <span className="story-dock__go-disc" aria-hidden="true">{Icon.play}</span>
              <span className="story-dock__go-text">{text}</span>
            </button>
            <button type="button" className="story-dock__no" onClick={declineResume}>{s.notNow}</button>
          </div>
        </div>
      </div>
    );
  }

  const queue = state.queue;
  const current = state.current;
  if (!queue || current === null) return <div className="story-dock-slot">{liveRegion}{overlays}</div>;
  const entry = queue.entries.find(e => e.n === current);
  const title = current === 0 ? s.introTitle : entry?.title ?? s.storyN(current);
  const playing = state.status === 'playing' || state.status === 'loading';
  const home = figurePath(queue.lang, queue.slug);
  // A dock outside the router (the poem door) lives and dies with its page: a link away would stop the story.
  const routed = typeof document !== 'undefined' && document.querySelector('[data-astro-transition-persist="story-dock"]') !== null;
  const away = routed && path !== '' && path !== home;
  const inReader = state.readerOpen && state.readerN === current;
  const card = state.endCard;
  const nextEntry = card ? queue.entries.find(e => e.n === card.next) : undefined;
  const clock = `${clockLabel(state.time)} / ${clockLabel(state.duration)}`;
  const rate = rateLabel(state.rate, storyLang);

  const plainProgress = (
    <div className="story-dock__progress" aria-hidden="true">
      <div ref={fillRef} className="story-dock__fill" />
    </div>
  );
  const plainSeek = (
    <input
      ref={seekRef}
      type="range"
      min={0}
      max={state.duration > 0 ? Math.floor(state.duration) : 0}
      step={1}
      value={Math.floor(state.time)}
      aria-label={s.seekAria}
      aria-valuetext={clock}
      onChange={e => seekTo(Number(e.currentTarget.value))}
    />
  );

  const readSlot = inReader && state.away ? (
    <button type="button" className="story-dock__read story-dock__read--voice" onClick={() => setAway(false)} data-dir={state.awayDir}>
      {state.awayDir === 'down' ? Icon.down : Icon.up}
      <span>{s.follow}</span>
    </button>
  ) : (
    <button type="button" className="story-dock__read" aria-pressed={inReader}
      onClick={() => (inReader ? closeReader() : openReader(current))}>
      {Icon.book}
      <span>{s.readAlong}</span>
    </button>
  );

  return (
    <div className="story-dock-slot">
      {liveRegion}
      {overlays}
      <div ref={measureRef} className={card && nextEntry ? 'story-dock story-dock--end' : 'story-dock'} role="region"
        aria-label={`${s.dockLabel}, ${voiceWord}`} data-status={state.status} data-voice={voiceOn ? 'on' : 'off'}>
        {card && nextEntry && (
          <div className="story-dock__end" role="status">
            <span className="story-dock__count" aria-hidden="true">{card.left}</span>
            <div className="story-dock__endtext">
              <p className="story-dock__endk">{card.n === 0 ? s.endedIntro : s.ended(card.n)}</p>
              <p className="story-dock__endt">{s.soon(card.next, nextEntry.title)}</p>
            </div>
            <div className="story-dock__endacts">
              <button type="button" className="story-dock__stay" onClick={stayHere}>{s.stay}</button>
              <button type="button" className="story-dock__now" onClick={listenNow} aria-describedby={VOICE_DESC_ID}>{s.listenNow}</button>
            </div>
          </div>
        )}
        {wide ? plainProgress : (
          <Suspense fallback={plainProgress}>
            <DockMap state={state} queue={queue} kind="phone" seekTo={seekTo} plain={plainProgress} />
          </Suspense>
        )}
        <div className="story-dock__inner">
          {away && (
            <a className="story-dock__home" href={home} aria-label={s.backToAria(queue.name)}>
              {Icon.back}
              <span>{queue.name}</span>
            </a>
          )}
          <div className="story-dock__head">
            <button type="button" className="story-dock__open" onClick={() => openSheet('player')}
              aria-label={`${s.openPlayer}: ${title}`}>
              <span className="story-dock__title">{title}</span>
              {/* The loading word takes the clock's place only on a slow load (CSS delay), never beside a stale time. */}
              <span className="story-dock__time">
                <span className="story-dock__clock">{clock}</span>
                <span className="story-dock__wait">{s.loading}</span>
                {Icon.up}
              </span>
              {/* Both words share one cell, so the swap never moves the bar. */}
              <span className="story-dock__sub">
                {state.status === 'error' ? s.error : (
                  <>
                    <span className="story-dock__voice" aria-hidden={!voiceOn}>{voiceWord}</span>
                    <span className="story-dock__who" aria-hidden={voiceOn}>{queue.name}</span>
                  </>
                )}
              </span>
            </button>
            <button type="button" className="story-btn story-dock__about" aria-expanded={noteOpen} aria-controls="story-dock-note"
              aria-label={label.title} onClick={() => setNoteOpen(v => !v)}>
              <span className="sp-label__i" aria-hidden="true">i</span>
            </button>
          </div>
          <div className="story-dock__ctrls">
            {wide && (
              <button type="button" className="story-btn story-dock__prev" onClick={previousStory} disabled={!hasPrevious() && state.time < 1}
                aria-label={s.prevAria} aria-describedby={VOICE_DESC_ID}>{Icon.prev}</button>
            )}
            <button type="button" className="story-btn story-dock__back" onClick={skipBack} aria-label={s.back15Aria}>
              {Icon.back15}
            </button>
            <button type="button" className="story-btn story-dock__play" onClick={togglePlay}
              aria-label={playing ? s.pauseAria : s.playAria} aria-describedby={VOICE_DESC_ID}>
              {playing ? Icon.pause : Icon.play}
            </button>
            {wide && (
              <button type="button" className="story-btn story-dock__fwd" onClick={skipForward} aria-label={s.fwd15Aria}>
                {Icon.fwd15}
              </button>
            )}
            <button type="button" className="story-btn story-dock__next" onClick={nextStory} disabled={!hasNext()}
              aria-label={s.nextAria} aria-describedby={VOICE_DESC_ID}>
              {Icon.next}
            </button>
            {!wide && (
              <button type="button" className="story-btn story-dock__speed" onClick={() => openSheet('player')}
                aria-label={s.speedAria(rate)}>
                {rate}
              </button>
            )}
            {!wide && readSlot}
          </div>
          {wide && (
            <>
              <div className="story-dock__seek">
                <span className="story-dock__t0">{clockLabel(state.time)}</span>
                <Suspense fallback={plainSeek}>
                  <DockMap state={state} queue={queue} kind="desk" seekTo={seekTo} plain={plainSeek} />
                </Suspense>
                <span className="story-dock__t1">{clockLabel(state.duration)}</span>
              </div>
              <div className="story-dock__rate" role="group" aria-label={s.speed}>
                <button type="button" className="story-btn" onClick={() => stepRate(-1)} disabled={state.rate <= RATE_MIN}
                  aria-label={s.slower}>{Icon.minus}</button>
                <span className="story-dock__rateval" aria-live="polite">{rate}</span>
                <button type="button" className="story-btn" onClick={() => stepRate(1)} disabled={state.rate >= RATE_MAX}
                  aria-label={s.faster}>{Icon.plus}</button>
              </div>
              {readSlot}
              <button type="button" className="story-btn story-dock__handle" onClick={() => openSheet('player')}
                aria-label={s.openPlayer}>{Icon.up}</button>
            </>
          )}
        </div>
        <div className="story-dock__note" id="story-dock-note" hidden={!noteOpen}>
          <p className="story-dock__notek">{halves.map((half, i) => (
            <span key={i}>{i > 0 ? ' ' : ''}<span className="sp-label__half">{half}</span></span>
          ))}</p>
          <p>{label.expanded}</p>
        </div>
      </div>
    </div>
  );
}
