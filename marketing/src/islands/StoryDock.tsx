// React island: the story bar, its full player, the sheets (facts, display,
// saved) and the reading view. Mounted once per document inside an element
// the client router persists, so it keeps playing while the visitor moves
// between player pages. The page's own controls are plain HTML (page.ts).
//
// The bar is one row on every screen: the coin; a line that names who is
// playing and the story's number from the first frame, with the clock; the
// pages of the story under it (at a visit's first story, the voice note holds
// their place for its seconds); back one sentence; Read, the way back into the
// text while it is closed; the caret to the open player, which holds
// everything else.

import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  acceptResume,
  declineResume,
  getState,
  installPlayer,
  listenNow,
  openReader,
  openSheet,
  readPageQueue,
  sameQueue,
  seekTo,
  setAway,
  voicePosition,
  stayHere,
  subscribe,
  togglePlay,
} from '../player/controller';
import { installPage } from '../player/page';
// The reader, the sheets and the map load after the first screen: on first use, warmed on intent.
const loadReader = () => import('../player/StoryReader');
const loadSheets = () => import('../player/sheets');
const loadMap = () => import('../player/textmap');
const StoryReader = lazy(loadReader);
const Sheets = lazy(loadSheets);
const BarMap = lazy(() => loadMap().then(m => ({ default: m.BarMap })));
const BarBack = lazy(() => loadMap().then(m => ({ default: m.BarBack })));
let warmed = false;
function warm(): void {
  if (warmed) return;
  warmed = true;
  void loadReader().catch(() => undefined);
  void loadSheets().catch(() => undefined);
  void loadMap().catch(() => undefined);
}
import { Icon } from '../player/icons';
import { LIST_SEP, VOICE_DESC_ID, clockLabel, labelHalves, playerStrings } from '../player/strings';
import { LabelItems } from '../player/LabelItems';
import type { FactWords } from '../player/factWords';
import type { PlayerLang } from '../player/strings';
import type { PlayerState } from '../player/types';

interface Label {
  title: string;
  brief: string;
  expanded: string;
}

// How long the bar shows the voice note at a visit's first story, from its first sound.
const VOICE_MS = 6000;
// The note shows once per browser session; where storage is refused it shows at every story.
const NOTE_KEY = 'agc_voice_note';
function noteShown(): boolean {
  try {
    return window.sessionStorage.getItem(NOTE_KEY) === '1';
  } catch {
    return false;
  }
}
function markNoteShown(): void {
  try {
    window.sessionStorage.setItem(NOTE_KEY, '1');
  } catch {
    // refused: the next story shows it again
  }
}

interface Props {
  /** The page's language, for the resume offer before any story plays. */
  lang: PlayerLang;
  labels: Record<PlayerLang, Label>;
  facts: Record<PlayerLang, FactWords>;
  /** Short names for a bar too narrow for the full one: "id=English|German;...", only where they differ. */
  shortNames: string;
}

const SERVER_STATE: PlayerState = getState();

/** The figure page a queue belongs to, as a path. */
function figurePath(lang: PlayerLang, slug: string): string {
  return `${lang === 'de' ? '/de' : ''}/figures/${slug}/`;
}

/** The front's list of the thirty (lib/urls' figureListUrl, kept out of this bundle). */
function listPath(lang: PlayerLang): string {
  return lang === 'de' ? '/de/#alle' : '/#all';
}

/** The bar's caret: the full player, never the text (the bar's Read opens that). */
function expandDock(): void {
  if (getState().current === null) return;
  openSheet('player');
}

/** The bar's Read: the playing story's text. */
function readPlaying(): void {
  const now = getState();
  if (now.current !== null && now.queue) openReader(now.current, now.queue);
}

/** The end card's "Listen now" plays a story: its reading view opens with it, as from the page (not by the poem door). */
function listenAndRead(): void {
  listenNow();
  const now = getState();
  if (now.current !== null && now.queue && !document.querySelector('.sp-door')) openReader(now.current, now.queue);
}

function currentPath(): string {
  return typeof window === 'undefined' ? '' : window.location.pathname;
}

function readShort(list: string, id: string, lang: PlayerLang): string {
  const hit = list.split(';').find(x => x.startsWith(`${id}=`));
  const [en, de] = (hit?.slice(id.length + 1) ?? '').split('|');
  return (lang === 'de' ? de : en) ?? '';
}

// Before paint in the browser; the server render has no layout to measure.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

let measureCtx: CanvasRenderingContext2D | null = null;
/** A text's width in an element's face, without laying it out. */
function textWidth(text: string, el: Element): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return 0;
  const cs = getComputedStyle(el);
  measureCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return measureCtx.measureText(text).width;
}

/** A tap on the bar's empty part, or a short swipe up, opens the player (the caret stays the keyboard's way). The tap
 * is a click, which every engine sends for a touch; the swipe is read from pointer events. */
function useOpenGesture(open: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const free = (t: EventTarget | null) => t instanceof Element && !t.closest('button, a, input, .sp-tmap');
  const onClick = (e: ReactMouseEvent<HTMLElement>) => {
    if (free(e.target)) open();
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    start.current = free(e.target) ? { x: e.clientX, y: e.clientY } : null;
    // a swipe up ends over the page: the bar keeps the pointer so its release still comes here
    if (start.current) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // a pointer the browser no longer tracks
      }
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const s0 = start.current;
    start.current = null;
    if (!s0) return;
    const dx = e.clientX - s0.x;
    const dy = e.clientY - s0.y;
    if (dy < -28 && Math.abs(dy) > Math.abs(dx)) open();
  };
  return { onClick, onPointerDown, onPointerUp, onPointerCancel: () => { start.current = null; } };
}

export default function StoryDock({ lang, labels, facts, shortNames }: Props) {
  const state = useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
  const [path, setPath] = useState(currentPath);
  const [wide, setWide] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => {
    installPlayer();
    installPage();
  }, [labels]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // The bar lives across pages: it learns where it is after each swap.
  useEffect(() => {
    const update = () => setPath(currentPath());
    document.addEventListener('astro:page-load', update);
    return () => document.removeEventListener('astro:page-load', update);
  }, []);

  // A press or a focus on a story control, or a story playing, fetches the reader's parts ahead of their first use.
  useEffect(() => {
    const intent = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('[data-story-play], [data-story-read], [data-story-saved-open], .sp-act, .story-dock')) warm();
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

  // The page and the reader keep room for the bar's real height.
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

  // Each story's start (a new item, or the same one again after the bar was closed) names the voice once to a screen
  // reader through the polite live region. The bar shows the note only at a visit's first story: from the load until
  // VOICE_MS after the first sound, in the pages' place (the label above Beginnen and the "i" carry it after that).
  const storyKey = loaded && state.queue && state.current !== null ? `${state.queue.slug}/${state.queue.lang}/${state.current}` : null;
  const [noteKey, setNoteKey] = useState<string | null>(null);
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
      // the same story again after the bar closed is not a first story
      setNoteKey(k => (k === null ? null : ''));
      return;
    }
    // the first story's note holds from the load; the session remembers it at once
    if (noteKey === null && !noteShown()) {
      markNoteShown();
      setNoteKey(storyKey);
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
  }, [storyKey, state.status, quietKey, noteKey, voiceWord]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Storage refused: every story is a first story.
  useEffect(() => {
    if (storyKey !== null && noteKey !== null && noteKey !== storyKey && !noteShown()) setNoteKey(storyKey);
  }, [storyKey, noteKey]);
  // Read in the render as well, so a first story's first painted frame already holds the note: the effects above
  // land after a paint in Chromium, which showed the pages for a frame first.
  const noteDue = storyKey !== null && noteKey !== storyKey && !noteShown();
  const voiceOn = storyKey !== null && quietKey !== storyKey && (noteKey === storyKey || noteDue);
  // The note closes on a second tap, Escape, a tap anywhere else, a scroll of the page or the text, and a page change.
  // The text's own scrolls that follow the voice are not the visitor's: there the gesture closes it.
  useEffect(() => {
    if (!noteOpen) return;
    const close = () => setNoteOpen(false);
    const inside = (t: EventTarget | null) => t instanceof Element && !!t.closest('#story-dock-note, .story-dock__who');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onDown = (e: PointerEvent) => { if (!inside(e.target)) close(); };
    const onGesture = (e: Event) => { if (!inside(e.target)) close(); };
    const onScroll = (e: Event) => {
      const t = e.target;
      if (t instanceof Element && t.classList.contains('story-reader__scroll') && !getState().away) return;
      if (!inside(t)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('wheel', onGesture, { capture: true, passive: true });
    document.addEventListener('touchmove', onGesture, { capture: true, passive: true });
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('astro:before-swap', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('wheel', onGesture, true);
      document.removeEventListener('touchmove', onGesture, true);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('astro:before-swap', close);
    };
  }, [noteOpen]);

  // The line names the figure by its short name, the story's number after it (the introduction has none). Where the
  // name, the number and the "i" do not fit beside the whole clock (a long name past minute ten at 360 px), the clock
  // keeps only the time heard (the open player has both).
  const fullName = state.queue?.name ?? '';
  const shownName = (state.queue && readShort(shortNames, state.queue.figureId, storyLang)) || fullName;
  const wholeClock = `${clockLabel(state.time)} / ${clockLabel(state.duration)}`;
  const leadEl = useRef<HTMLDivElement | null>(null);
  const whoRef = useRef<HTMLButtonElement | null>(null);
  const nameRef = useRef<HTMLSpanElement | null>(null);
  const clockRef = useRef<HTMLSpanElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const [bare, setBare] = useState(false);
  const fit = useCallback(() => {
    const lead = leadEl.current;
    const who = whoRef.current;
    const name = nameRef.current;
    const clockEl = clockRef.current;
    const probe = probeRef.current;
    if (!lead || !who || !name || !clockEl || !probe || !shownName) return;
    const extra = who.getBoundingClientRect().width - name.getBoundingClientRect().width;
    // The room as if the whole clock stood there (a hidden copy, in the clock's tabular digits), whichever clock stands
    // now, so the choice never flips back and forth.
    const room = lead.clientWidth - 1 - (probe.getBoundingClientRect().width - clockEl.getBoundingClientRect().width);
    setBare(textWidth(shownName, name) + extra > room);
  }, [shownName]);
  const leadObserver = useRef<ResizeObserver | null>(null);
  const leadRef = useCallback((el: HTMLDivElement | null) => {
    leadObserver.current?.disconnect();
    leadObserver.current = null;
    leadEl.current = el;
    if (!el || typeof ResizeObserver === 'undefined') return;
    leadObserver.current = new ResizeObserver(fit);
    leadObserver.current.observe(el);
  }, [fit]);
  useBeforePaint(fit, [fit, wholeClock.length, state.current]);
  useEffect(() => {
    void document.fonts?.ready.then(fit);
  }, [fit]);

  const gesture = useOpenGesture(expandDock);

  // The live region speaks at a start; the hidden word is the description every start control points at, so the label
  // is heard with the button, before any sound.
  const liveRegion = (
    <>
      <span className="sp-sr" aria-live="polite" aria-atomic="true" data-story-voice-live>{live}</span>
      <span id={VOICE_DESC_ID} hidden>{voiceWord}</span>
    </>
  );
  // One offer at a time: where the page's plate offers the kept point, the bar stays down.
  const plateOffers = typeof document !== 'undefined' && document.querySelector('[data-story-hero-plate]') !== null;
  const offer = !loaded && state.resume !== null && !plateOffers;
  const readerQueue = state.readerOpen ? state.readerQueue : null;

  // A bar outside the router (the poem door) lives and dies with its page: a link away would stop the story.
  const routed = typeof document !== 'undefined' && document.querySelector('[data-astro-transition-persist="story-dock"]') !== null;
  const home = state.queue ? figurePath(state.queue.lang, state.queue.slug) : '';
  const away = routed && path !== '' && !!home && path !== home;

  const overlays = (
    <>
      {state.readerOpen && readerQueue && state.readerN !== null && (
        <Suspense fallback={null}>
          <StoryReader state={state} queue={readerQueue} n={state.readerN} label={labels[readerQueue.lang]}
            factsWord={facts[readerQueue.lang].facts} documentedWord={facts[readerQueue.lang].documented}
            recreatedWord={facts[readerQueue.lang].recreated}
            home={figurePath(readerQueue.lang, readerQueue.slug)} selection={listPath(readerQueue.lang)} />
        </Suspense>
      )}
      {state.sheet && (
        <Suspense fallback={null}>
          <Sheets state={state} facts={facts} wide={wide} home={away ? home : null} />
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
  const inReader = state.readerOpen && state.readerN === current && sameQueue(state.readerQueue, queue);
  const card = state.endCard;
  const nextEntry = card ? queue.entries.find(e => e.n === card.next) : undefined;
  const clock = bare ? clockLabel(state.time) : wholeClock;

  // While the sleep timer runs, a small moon by the clock; its words go with the caret's name.
  const sleepOn = typeof state.sleep === 'number' ? s.sleepLeft(clockLabel(Math.ceil(state.sleepLeft))) : state.sleep === 'end' ? s.sleepToEnd : '';
  const moon = sleepOn ? <span className="story-dock__moon" aria-hidden="true">{Icon.moon}</span> : null;
  // Until the pages are in: the whole story as one page, drawn by CSS alone, the same height.
  const plainPages = (
    <div className="sp-tmap sp-tmap--bar" aria-hidden="true">
      <div className="sp-tmap__box"><span className="sp-pages sp-pages--plain sp-tmap__draw" /></div>
    </div>
  );
  const plainBack = (
    <button type="button" className="story-btn story-dock__back" onClick={() => seekTo(Math.max(0, voicePosition() - 5))}
      aria-label={s.sentenceBack}>{Icon.again}</button>
  );

  // The line: who is playing and the story's number (one button with the "i"), the story's title where it fits whole;
  // the clock from the first frame. In the reading view, scrolled away from the voice, the way back takes the line.
  const line = inReader && state.away ? (
    <button type="button" className="story-dock__follow" onClick={() => setAway(false)} data-dir={state.awayDir}>
      {state.awayDir === 'down' ? Icon.toDown : Icon.toUp}
      <span>{s.follow}</span>
    </button>
  ) : state.status === 'error' ? (
    <span className="story-dock__error" role="status">{s.error}</span>
  ) : (
    <>
      <div className="story-dock__left">
        <div ref={leadRef} className="story-dock__lead">
          <button ref={whoRef} type="button" className="story-dock__who" aria-expanded={noteOpen} aria-controls="story-dock-note"
            aria-label={[fullName, current > 0 ? s.storyN(current) : '', label.title].filter(Boolean).join(', ')}
            onClick={() => setNoteOpen(v => !v)}>
            <span className="story-dock__id">
              <span ref={nameRef} className="story-dock__name">{shownName}</span>
              {current > 0 && <span className="story-dock__n">{`${LIST_SEP}${current}`}</span>}
            </span>
            <span className="sp-label__i" aria-hidden="true">i</span>
          </button>
          <span className="story-dock__title">{title}</span>
        </div>
      </div>
      {/* The loading word takes the clock's place only on a slow load (CSS delay), never beside a stale time. */}
      <span className="story-dock__time">
        {moon}
        <span ref={clockRef} className="story-dock__clock">{clock}</span>
        <span ref={probeRef} className="story-dock__probe" aria-hidden="true">{wholeClock}</span>
        <span className="story-dock__wait">{s.loading}</span>
      </span>
    </>
  );

  return (
    <div className="story-dock-slot">
      {liveRegion}
      {overlays}
      <div ref={measureRef} className={card && nextEntry ? 'story-dock story-dock--end' : 'story-dock'} role="region"
        aria-label={`${s.dockLabel}, ${voiceWord}`} data-status={state.status} data-voice={voiceOn ? 'on' : 'off'}
        data-reading={inReader ? '' : undefined}>
        {card && nextEntry && (
          <div className="story-dock__end" role="status">
            <span className="story-dock__count" aria-hidden="true">{card.left}</span>
            <div className="story-dock__endtext">
              <p className="story-dock__endk">{card.n === 0 ? s.endedIntro : s.ended(card.n)}</p>
              <p className="story-dock__endt">{s.soon(card.next, nextEntry.title)}</p>
            </div>
            <div className="story-dock__endacts">
              <button type="button" className="story-dock__stay" onClick={stayHere}>{s.stay}</button>
              <button type="button" className="story-dock__now" onClick={listenAndRead} aria-describedby={VOICE_DESC_ID}>{s.listenNow}</button>
            </div>
          </div>
        )}
        <div className="story-dock__inner" {...gesture}>
          <button type="button" className="story-btn story-dock__play" onClick={togglePlay}
            aria-label={playing ? s.pauseAria : s.playAria} aria-describedby={VOICE_DESC_ID}>
            {Icon.dots}
            {playing ? Icon.pause : Icon.play}
          </button>
          <div className="story-dock__mid">
            <div className="story-dock__line">{line}</div>
            {/* a visit's first story: the voice note stands in the pages' place for its seconds */}
            <span className="story-dock__voice" aria-hidden="true">{voiceWord}</span>
            <Suspense fallback={plainPages}>
              <BarMap state={state} queue={queue} seekTo={seekTo} />
            </Suspense>
          </div>
          <Suspense fallback={plainBack}>
            <BarBack state={state} queue={queue} s={s} />
          </Suspense>
          {!inReader && (
            <button type="button" className="story-btn story-dock__read" onClick={readPlaying} aria-label={`${s.read}: ${title}`}>
              {Icon.book}
              <span>{s.read}</span>
            </button>
          )}
          <button type="button" className="story-btn story-dock__open" onClick={expandDock}
            aria-label={`${s.openPlayer}: ${title}${sleepOn ? `${LIST_SEP}${s.sleepAria(sleepOn)}` : ''}`}>
            {Icon.up}
          </button>
        </div>
        <div className="story-dock__note" id="story-dock-note" hidden={!noteOpen}>
          <p className="story-dock__notek"><LabelItems brief={label.brief} /></p>
          <p>{label.expanded}</p>
        </div>
      </div>
    </div>
  );
}
