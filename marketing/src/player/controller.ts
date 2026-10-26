// The story player's one audio element and its state, shared by the dock
// island and the page's own buttons. Module memory survives the client
// router's page swaps, so the story keeps playing while the visitor moves
// between player pages.
//
// iOS plays sound only from a tap: every start goes through playStory() or
// togglePlay(), called synchronously from a click handler, and play() runs in
// that same call. Later starts (the next story, the lock screen) reuse the
// element the tap unlocked.

import { getPublicAudioUrl } from '@client/utils/public/publicMediaUrl';
import {
  listenTrackKey,
  noteListenEnded,
  noteListenPause,
  noteListenPlay,
  noteListenProgress,
  sendPlaybackBeacon,
} from '@client/utils/playbackBeacon';
import { trackHeardSeconds } from '../utils/heardSeconds';
import { installRouterGlue } from './routerGlue';
import { playerStrings } from './strings';
import { applyStoredTheme } from './theme';
import type { PlayerLang } from './strings';
import type { PlayerState, ResumePoint, StoryQueue } from './types';

// The worker's mode allow-list (llm-proxy routes/playback.ts) has no
// 'story_page' yet and would blank it, so page plays count under 'story'.
export const PLAYBACK_MODE = 'story';

const RESUME_KEY = 'agc_story_resume';
const DONE_KEY = 'agc_story_done';
const RESUME_SAVE_MS = 5000;
const SKIP_S = 15;
export const RATES: readonly number[] = [0.8, 1, 1.25, 1.5];
const FIGURE_ID_RE = /^[a-z0-9-]{1,40}$/;

let state: PlayerState = {
  queue: null,
  current: null,
  status: 'idle',
  time: 0,
  duration: 0,
  rate: 1,
  autoNext: true,
  resume: null,
  readerOpen: false,
  dismissed: false,
  done: [],
};

const listeners = new Set<() => void>();

function setState(patch: Partial<PlayerState>): void {
  const before = state;
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
  if (
    before.status !== state.status || before.current !== state.current || before.queue !== state.queue
    || before.autoNext !== state.autoNext || before.dismissed !== state.dismissed
    || before.resume !== state.resume || before.done !== state.done
  ) {
    syncPageButtons();
  } else if (before.time !== state.time || before.duration !== state.duration) {
    syncProgress();
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): PlayerState {
  return state;
}

// ---- the audio element --------------------------------------------------

let audio: HTMLAudioElement | null = null;
let format: 'webm' | 'mp3' | null = null;
let fellBack = false;
let pendingSeek: number | null = null;
let lastResumeSave = 0;
const startedKeys = new Set<string>();

function pickFormat(): 'webm' | 'mp3' {
  if (format) return format;
  const probe = document.createElement('audio');
  const webm = probe.canPlayType('audio/webm; codecs="opus"') || probe.canPlayType('audio/webm');
  format = webm ? 'webm' : 'mp3';
  return format;
}

function webmUrl(queue: StoryQueue, n: number): string {
  return getPublicAudioUrl(queue.figureId, queue.lang, n);
}

function sourceFor(queue: StoryQueue, n: number): string {
  const webm = webmUrl(queue, n);
  return pickFormat() === 'webm' ? webm : webm.replace(/\.webm$/, '.mp3');
}

function listenContext(queue: StoryQueue, n: number) {
  return { type: 'story' as const, figureId: queue.figureId, mode: PLAYBACK_MODE, chapter: n };
}

/** The tracker's key: the webm address names the track whatever format plays. */
function currentKey(): string | null {
  if (!state.queue || state.current === null) return null;
  return listenTrackKey(listenContext(state.queue, state.current), webmUrl(state.queue, state.current));
}

function ensureAudio(): HTMLAudioElement {
  if (audio) return audio;
  const el = new Audio();
  el.preload = 'none';

  el.addEventListener('play', () => {
    const key = currentKey();
    const { queue, current } = state;
    if (!key || !queue || current === null) return;
    if (!startedKeys.has(key)) {
      startedKeys.add(key);
      sendPlaybackBeacon({
        type: 'story',
        event: 'started',
        figureId: queue.figureId,
        mode: PLAYBACK_MODE,
        chapter: current,
        language: queue.lang,
      });
    }
    noteListenPlay(key, listenContext(queue, current));
  });
  el.addEventListener('playing', () => setState({ status: 'playing' }));
  el.addEventListener('waiting', () => {
    if (!el.paused) setState({ status: 'loading' });
  });
  // timeupdate fires only when a seek completes: the clock shows its target from the start.
  el.addEventListener('seeking', () => setState({ time: el.currentTime }));
  el.addEventListener('pause', () => {
    const key = currentKey();
    if (key) noteListenPause(key);
    if (!el.ended) setState({ status: 'paused' });
    saveResume(true);
  });
  el.addEventListener('loadedmetadata', () => {
    if (pendingSeek !== null && pendingSeek < el.duration) el.currentTime = pendingSeek;
    pendingSeek = null;
    setState({ duration: el.duration });
  });
  el.addEventListener('durationchange', () => {
    if (Number.isFinite(el.duration)) setState({ duration: el.duration });
  });
  el.addEventListener('timeupdate', () => {
    const key = currentKey();
    if (key) noteListenProgress(key, el.currentTime, el.duration);
    // A stall can end without a 'playing' event: moving time with data in hand is playing.
    const moving = state.status === 'loading' && !el.paused && !el.seeking && el.readyState >= 3;
    setState(moving ? { time: el.currentTime, status: 'playing' } : { time: el.currentTime });
    saveResume(false);
    updatePositionState();
  });
  el.addEventListener('ratechange', () => setState({ rate: el.playbackRate }));
  el.addEventListener('ended', () => {
    const key = currentKey();
    if (key) noteListenEnded(key, el.currentTime, el.duration);
    const { queue, current } = state;
    if (!queue || current === null) return;
    markDone(queue.figureId, current);
    const next = current < queue.entries.length ? current + 1 : null;
    writeResume(next === null ? null : { figureId: queue.figureId, lang: queue.lang, n: next, t: 0 });
    if (next !== null && state.autoNext) {
      startStory(queue, next, 0);
    } else {
      setState({ status: 'paused', time: el.duration });
    }
  });
  el.addEventListener('error', () => {
    // Opus first where the browser claims it, the mp3 once if that fails.
    if (format === 'webm' && !fellBack && state.queue && state.current !== null) {
      fellBack = true;
      format = 'mp3';
      const at = el.currentTime;
      el.src = sourceFor(state.queue, state.current);
      pendingSeek = at > 0 ? at : pendingSeek;
      void el.play().catch(() => setState({ status: 'error' }));
      return;
    }
    setState({ status: 'error' });
  });

  // Counts toward the shared Listened threshold (D-131), like every surface.
  trackHeardSeconds(el, () => state.queue?.figureId);
  audio = el;
  return el;
}

function startStory(queue: StoryQueue, n: number, startAt: number): void {
  const el = ensureAudio();
  const oldKey = currentKey();
  if (oldKey && !el.paused) noteListenPause(oldKey);
  pendingSeek = startAt > 0 ? startAt : null;
  setState({
    queue,
    current: n,
    status: 'loading',
    time: startAt,
    duration: 0,
    dismissed: false,
    resume: null,
  });
  el.src = sourceFor(queue, n);
  el.defaultPlaybackRate = state.rate;
  el.playbackRate = state.rate;
  const started = el.play();
  started.catch((err: unknown) => {
    // A newer tap replaced this source: not an error of the story.
    if (err instanceof DOMException && err.name === 'AbortError') return;
    if (audio?.paused) setState({ status: 'error' });
  });
  updateMetadata();
  writeResume({ figureId: queue.figureId, lang: queue.lang, n, t: Math.floor(startAt) });
}

function sameQueue(a: StoryQueue | null, b: StoryQueue | null): boolean {
  return !!a && !!b && a.figureId === b.figureId && a.lang === b.lang;
}

// ---- the controls (call these from a click handler) ---------------------

/** Play story n of this figure. The current story toggles instead. */
export function playStory(queue: StoryQueue, n: number, startAt = 0): void {
  if (sameQueue(state.queue, queue) && state.current === n && audio?.src && state.status !== 'error') {
    if (state.dismissed) setState({ dismissed: false });
    togglePlay();
    return;
  }
  startStory(queue, n, startAt);
}

export function togglePlay(): void {
  const el = audio;
  if (!el || state.current === null) return;
  if (el.paused) {
    if (state.status === 'error' && state.queue) {
      startStory(state.queue, state.current, state.time);
      return;
    }
    if (el.ended) el.currentTime = 0;
    void el.play().catch(() => setState({ status: 'error' }));
  } else {
    el.pause();
  }
}

export function skipBack(): void {
  if (!audio || state.current === null) return;
  audio.currentTime = Math.max(0, audio.currentTime - SKIP_S);
}

function skipForward(): void {
  if (!audio || state.current === null) return;
  const end = Number.isFinite(audio.duration) ? audio.duration : Infinity;
  audio.currentTime = Math.min(end, audio.currentTime + SKIP_S);
}

export function seekTo(seconds: number): void {
  if (!audio || state.current === null || !Number.isFinite(seconds)) return;
  audio.currentTime = Math.max(0, seconds);
}

export function hasNext(): boolean {
  return !!state.queue && state.current !== null && state.current < state.queue.entries.length;
}

export function nextStory(): void {
  if (!state.queue || state.current === null || !hasNext()) return;
  startStory(state.queue, state.current + 1, 0);
}

function previousStory(): void {
  if (!state.queue || state.current === null) return;
  if (state.time > 5 || state.current === 1) {
    seekTo(0);
    return;
  }
  startStory(state.queue, state.current - 1, 0);
}

export function setRate(rate: number): void {
  if (!RATES.includes(rate)) return;
  setState({ rate });
  if (audio) {
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
  }
}

export function setAutoNext(on: boolean): void {
  setState({ autoNext: on });
}

export function setReaderOpen(open: boolean): void {
  setState({ readerOpen: open && state.current !== null });
}

/** Close the dock: the story stops, the resume point stays. */
export function dismiss(): void {
  audio?.pause();
  saveResume(true);
  setState({ dismissed: true, readerOpen: false, resume: null });
}

/** Take up the offered resume point. Called from the offer's tap. */
export function acceptResume(): void {
  const point = state.resume;
  const queue = readPageQueue();
  if (!point || !queue || queue.figureId !== point.figureId || queue.lang !== point.lang) return;
  startStory(queue, point.n, point.t);
}

export function declineResume(): void {
  resumeDeclined = true;
  setState({ resume: null });
}

// ---- resume: the story and the second, in this browser ------------------

let resumeDeclined = false;

function writeResume(point: ResumePoint | null): void {
  try {
    if (point) {
      localStorage.setItem(RESUME_KEY, JSON.stringify({ f: point.figureId, l: point.lang, n: point.n, t: point.t }));
    } else {
      localStorage.removeItem(RESUME_KEY);
    }
  } catch {
    // storage blocked: the player works, it just cannot offer a resume
  }
}

function saveResume(force: boolean): void {
  const { queue, current } = state;
  if (!queue || current === null || !audio) return;
  const now = Date.now();
  if (!force && now - lastResumeSave < RESUME_SAVE_MS) return;
  lastResumeSave = now;
  if (audio.ended) return; // the ended handler already moved the point on
  writeResume({ figureId: queue.figureId, lang: queue.lang, n: current, t: Math.floor(audio.currentTime) });
}

function readResume(): ResumePoint | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { f?: unknown; l?: unknown; n?: unknown; t?: unknown };
    if (typeof v.f !== 'string' || !FIGURE_ID_RE.test(v.f)) return null;
    if (v.l !== 'en' && v.l !== 'de') return null;
    if (typeof v.n !== 'number' || !Number.isInteger(v.n) || v.n < 1 || v.n > 99) return null;
    if (typeof v.t !== 'number' || !Number.isFinite(v.t) || v.t < 0) return null;
    return { figureId: v.f, lang: v.l, n: v.n, t: Math.floor(v.t) };
  } catch {
    return null;
  }
}

// ---- finished stories, in this browser ----------------------------------

function readDone(figureId: string): number[] {
  try {
    const all = JSON.parse(localStorage.getItem(DONE_KEY) ?? '{}') as Record<string, unknown>;
    const list = all[figureId];
    return Array.isArray(list) ? list.filter((n): n is number => Number.isInteger(n) && n > 0 && n < 100) : [];
  } catch {
    return [];
  }
}

function markDone(figureId: string, n: number): void {
  const list = readDone(figureId);
  if (!list.includes(n)) list.push(n);
  try {
    const all = JSON.parse(localStorage.getItem(DONE_KEY) ?? '{}') as Record<string, unknown>;
    all[figureId] = list.sort((a, b) => a - b);
    localStorage.setItem(DONE_KEY, JSON.stringify(all));
  } catch {
    // storage blocked: the marks last as long as the page
  }
  setState({ done: list });
}

// ---- the page: its queue and its buttons --------------------------------

export function readPageQueue(): StoryQueue | null {
  const node = document.querySelector('script[data-story-queue]');
  if (!node?.textContent) return null;
  try {
    const q = JSON.parse(node.textContent) as StoryQueue;
    if (!FIGURE_ID_RE.test(q.figureId) || (q.lang !== 'en' && q.lang !== 'de') || !Array.isArray(q.entries)) return null;
    return q;
  } catch {
    return null;
  }
}

function pageLang(): PlayerLang {
  return document.documentElement.lang.toLowerCase().startsWith('de') ? 'de' : 'en';
}

function fmtTime(seconds: number): string {
  const v = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

/** Whole minutes left in the current story, at least one, rounded as the contents round a story's length. */
function minutesLeft(): number {
  const left = state.duration > 0 ? state.duration - state.time : 0;
  return Math.max(1, Math.round(left / 60));
}

/** Mirror the player's state onto the page's own play buttons. */
function syncPageButtons(): void {
  if (typeof document === 'undefined') return;
  const pageQueue = readPageQueue();
  const s = playerStrings(pageLang());
  const onThisPage = sameQueue(pageQueue, state.queue);
  const done = state.done;
  document.querySelectorAll<HTMLElement>('[data-story-play]').forEach(btn => {
    const n = Number(btn.dataset.storyN);
    const text = btn.querySelector<HTMLElement>('[data-story-play-text]');
    if (text && btn.dataset.idleLabel === undefined) btn.dataset.idleLabel = text.textContent ?? '';
    const isCurrent = onThisPage && state.current === n && !state.dismissed;
    const mode = !isCurrent ? 'idle' : state.status === 'playing' ? 'playing' : state.status === 'loading' ? 'loading' : 'paused';
    btn.dataset.state = mode;
    btn.setAttribute('aria-pressed', String(mode === 'playing' || mode === 'loading'));
    const row = btn.closest('.sp-row');
    if (row) {
      const isDone = done.includes(n) && !isCurrent;
      row.classList.toggle('is-current', isCurrent);
      row.classList.toggle('is-done', isDone);
      const base = btn.dataset.ariaBase ?? btn.getAttribute('aria-label') ?? '';
      btn.dataset.ariaBase = base;
      const word = mode === 'playing' || mode === 'loading' ? s.playingWord : mode === 'paused' ? s.pausedWord : isDone ? s.finishedWord : '';
      btn.setAttribute('aria-label', word ? `${base}, ${word}` : base);
    }
    if (text) {
      text.textContent =
        mode === 'playing' ? s.pause : mode === 'loading' ? s.loading : mode === 'paused' ? s.resume : btn.dataset.idleLabel ?? '';
    }
    if (!isCurrent) {
      // A story that stopped being current gets its minutes and an empty ring back.
      const m = Number(btn.dataset.storyMinutes);
      if (m > 0) btn.querySelectorAll<HTMLElement>('[data-story-min]').forEach(min => { min.textContent = s.minutes(m); });
      btn.querySelectorAll<SVGCircleElement>('[data-story-ring]').forEach(ring => ring.style.removeProperty('stroke-dashoffset'));
    }
  });
  document.querySelectorAll<HTMLElement>('[data-story-autonext]').forEach(btn => {
    btn.setAttribute('aria-pressed', String(state.autoNext));
  });
  syncHero(pageQueue, onThisPage);
  syncProgress();
}

/** The hero plate: story 1 in place, or the kept point offered on return. */
function syncHero(pageQueue: StoryQueue | null, onThisPage: boolean): void {
  const plate = document.querySelector<HTMLElement>('[data-story-hero-plate]');
  if (!plate || !pageQueue) return;
  const s = playerStrings(pageQueue.lang);
  const doEl = plate.querySelector<HTMLElement>('[data-story-hero-do]');
  const whatEl = plate.querySelector<HTMLElement>('[data-story-hero-what]');
  const startOver = document.querySelector<HTMLElement>('[data-story-startover]');
  const first = pageQueue.entries[0];
  const point = state.resume;
  const offer = !!point && state.current === null && point.figureId === pageQueue.figureId && point.lang === pageQueue.lang;
  plate.toggleAttribute('data-resume', offer);
  if (startOver) startOver.hidden = !offer;
  let doText = s.playFirst;
  let whatText = [first?.title, first?.minutes ? s.minutes(first.minutes) : ''].filter(Boolean).join(' · ');
  if (offer && point) {
    const entry = pageQueue.entries.find(e => e.n === point.n);
    doText = s.continueStory(point.n);
    whatText = [entry?.title, point.t > 0 ? s.fromTime(fmtTime(point.t)) : ''].filter(Boolean).join(' · ');
  } else if (onThisPage && state.current === 1 && !state.dismissed) {
    // While loading the plate names its action; its own "loading" word fades in only on a slow load (CSS).
    doText = state.status === 'playing' || state.status === 'loading' ? s.pause : s.resume;
    whatText = [first?.title, state.duration > 0 ? s.minutesLeft(minutesLeft()) : first?.minutes ? s.minutes(first.minutes) : '']
      .filter(Boolean).join(' · ');
  }
  if (doEl && doEl.textContent !== doText) doEl.textContent = doText;
  if (whatEl && whatEl.textContent !== whatText) whatEl.textContent = whatText;
}

/** The current story's ring and minutes left, on every button that plays it. */
function syncProgress(): void {
  if (typeof document === 'undefined') return;
  const pageQueue = readPageQueue();
  if (!sameQueue(pageQueue, state.queue) || state.current === null) return;
  const pct = state.duration > 0 ? Math.min(100, (state.time / state.duration) * 100) : 0;
  const s = playerStrings(pageQueue!.lang);
  document.querySelectorAll<HTMLElement>(`[data-story-play][data-story-n="${state.current}"]`).forEach(btn => {
    btn.querySelectorAll<SVGCircleElement>('[data-story-ring]').forEach(ring => {
      // CSSOM: the stylesheet's offset outranks an SVG attribute.
      ring.style.setProperty('stroke-dashoffset', (100 - pct).toFixed(2));
    });
    if (state.duration > 0) {
      const text = s.minutesLeft(minutesLeft());
      btn.querySelectorAll<HTMLElement>('[data-story-min]').forEach(min => {
        if (min.textContent !== text) min.textContent = text;
      });
    }
  });
  const whatEl = document.querySelector<HTMLElement>('[data-story-hero-plate] [data-story-hero-what]');
  if (whatEl && state.current === 1 && state.duration > 0 && !state.dismissed) {
    const first = pageQueue!.entries[0];
    const text = [first?.title, s.minutesLeft(minutesLeft())].filter(Boolean).join(' · ');
    if (whatEl.textContent !== text) whatEl.textContent = text;
  }
}

function offerResumeForPage(): void {
  if (state.current !== null || resumeDeclined) return;
  const point = readResume();
  const queue = readPageQueue();
  const fits = !!point && !!queue && point.figureId === queue.figureId && point.lang === queue.lang
    && queue.entries.some(e => e.n === point.n);
  // A point at the very start of story 1 is nothing to resume.
  const worth = fits && !(point.n === 1 && point.t < 5);
  setState({ resume: worth ? point : null });
}

function onPageClick(e: MouseEvent): void {
  const target = e.target instanceof Element ? e.target : null;
  if (!target) return;
  const play = target.closest<HTMLElement>('[data-story-play]');
  if (play) {
    const queue = readPageQueue();
    const n = Number(play.dataset.storyN);
    if (!queue || !queue.entries.some(entry => entry.n === n)) return;
    e.preventDefault();
    const dockWasUp = state.current !== null && !state.dismissed;
    if (play.hasAttribute('data-resume') && state.resume) acceptResume();
    else playStory(queue, n);
    if (!dockWasUp) keepPressedInView(play);
    return;
  }
  const auto = target.closest<HTMLElement>('[data-story-autonext]');
  if (auto) {
    e.preventDefault();
    setAutoNext(!state.autoNext);
  }
}

/** The dock rises under the thumb: the control just pressed moves up out of its way. */
function keepPressedInView(el: HTMLElement): void {
  let frames = 0;
  const check = () => {
    const dock = document.querySelector<HTMLElement>('.story-dock');
    if (!dock) {
      if (++frames < 30) requestAnimationFrame(check);
      return;
    }
    const over = el.getBoundingClientRect().bottom + 12 - dock.getBoundingClientRect().top;
    if (over > 0) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollBy({ top: over, behavior: reduce ? 'auto' : 'smooth' });
    }
  };
  requestAnimationFrame(check);
}

// ---- the lock screen ----------------------------------------------------

let sessionReady = false;

function setHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null): void {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // not every browser knows every action
  }
}

function updateMetadata(): void {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  const { queue, current } = state;
  if (!queue || current === null) return;
  if (!sessionReady) {
    sessionReady = true;
    setHandler('play', () => togglePlay());
    setHandler('pause', () => togglePlay());
    setHandler('seekbackward', () => skipBack());
    setHandler('seekforward', () => skipForward());
    setHandler('seekto', details => {
      if (typeof details.seekTime === 'number') seekTo(details.seekTime);
    });
    setHandler('previoustrack', () => previousStory());
    setHandler('nexttrack', () => nextStory());
  }
  const entry = queue.entries.find(e => e.n === current);
  const s = playerStrings(queue.lang);
  navigator.mediaSession.metadata = new MediaMetadata({
    title: entry ? `${s.storyN(current)}: ${entry.title}` : s.storyN(current),
    // The lock screen travels without the page, so the label rides along.
    artist: `${queue.name} · ${lockScreenLabel[queue.lang]}`,
    album: 'Agora Cosmica',
    artwork: [{ src: queue.artwork, sizes: '640x640', type: 'image/webp' }],
  });
}

let lastPosition = 0;
function updatePositionState(): void {
  if (!('mediaSession' in navigator) || !audio) return;
  navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
  const now = Date.now();
  if (now - lastPosition < 1000) return;
  lastPosition = now;
  const duration = audio.duration;
  if (!(duration > 0) || !Number.isFinite(duration) || !('setPositionState' in navigator.mediaSession)) return;
  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: audio.playbackRate > 0 ? audio.playbackRate : 1,
      position: Math.min(Math.max(0, audio.currentTime), duration),
    });
  } catch {
    // a position past the duration during a source change
  }
}

let lockScreenLabel: Record<PlayerLang, string> = { en: '', de: '' };

// ---- start --------------------------------------------------------------

let installed = false;

function loadDoneForPage(): void {
  const queue = readPageQueue() ?? state.queue;
  setState({ done: queue ? readDone(queue.figureId) : [] });
}

/** Wire the page once per document. The dock island calls this on mount. */
export function installPlayer(label: Record<PlayerLang, string>): void {
  if (installed) return;
  installed = true;
  lockScreenLabel = label;
  document.addEventListener('click', onPageClick);
  document.addEventListener('astro:page-load', () => {
    loadDoneForPage();
    offerResumeForPage();
    syncPageButtons();
  });
  document.addEventListener('astro:after-swap', applyStoredTheme);
  applyStoredTheme();
  loadDoneForPage();
  window.addEventListener('pagehide', () => saveResume(true));
  installRouterGlue(() => state.current !== null && !state.dismissed);
  offerResumeForPage();
  syncPageButtons();
}
