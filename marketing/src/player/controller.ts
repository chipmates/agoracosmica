// The story player's one audio element and its state, shared by the dock
// island, the reading view and the page's own controls. Module memory
// survives the client router's page swaps, so the story keeps playing while
// the visitor moves between player pages.
//
// iOS plays sound only from a tap: every start goes through a function here
// called synchronously from a click handler, and play() runs in that same
// call. Later starts (the next story, the lock screen) reuse the element the
// tap unlocked.

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
import type { PlayerState, ResumePoint, SavedSentence, SheetKind, SleepChoice, StoryQueue } from './types';

// The worker's mode allow-list (llm-proxy routes/playback.ts) has no
// 'story_page' yet and would blank it, so page plays count under 'story', and
// the introduction under 'foreword' as chapter 0, as the app's foreword does.
export const PLAYBACK_MODE = 'story';

const DONE_KEY = 'agc_story_done';
const RATE_KEY = 'agc_story_rate';
const AFTER_KEY = 'agc_story_after';
const SAVED_KEY = 'agc_story_saved';
const PROGRESS_SAVE_MS = 5000;
/** The app offers a kept place only past ten seconds. */
const PROGRESS_MIN_S = 10;
const SKIP_S = 15;
export const RATE_MIN = 0.5;
export const RATE_MAX = 2;
export const RATE_STEP = 0.05;
const END_CARD_S = 5;
const FIGURE_ID_RE = /^[a-z0-9-]{1,40}$/;

function readNumber(key: string): number | null {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function clampRate(rate: number): number {
  return Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round(rate * 100) / 100));
}

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
  readerN: null,
  readerQueue: null,
  dismissed: false,
  done: [],
  endCard: null,
  sheet: null,
  sheetN: null,
  away: false,
  awayDir: 'up',
  saved: [],
  sleep: 'off',
  sleepLeft: 0,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<PlayerState>): void {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
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
let lastProgressSave = 0;
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
  return n === 0
    ? { type: 'foreword' as const, figureId: queue.figureId, mode: 'foreword', chapter: 0 }
    : { type: 'story' as const, figureId: queue.figureId, mode: PLAYBACK_MODE, chapter: n };
}

/** The tracker's key: the webm address names the track whatever format plays. */
function currentKey(): string | null {
  if (!state.queue || state.current === null) return null;
  return listenTrackKey(listenContext(state.queue, state.current), webmUrl(state.queue, state.current));
}

/** The last item of the queue. */
function lastN(queue: StoryQueue): number {
  return queue.entries[queue.entries.length - 1]?.n ?? 0;
}

function hasItem(queue: StoryQueue, n: number): boolean {
  return queue.entries.some(e => e.n === n);
}

function ensureAudio(): HTMLAudioElement {
  if (audio) return audio;
  const el = new Audio();
  el.preload = 'none';

  el.addEventListener('play', () => {
    const key = currentKey();
    const { queue, current } = state;
    if (!key || !queue || current === null) return;
    const ctx = listenContext(queue, current);
    if (!startedKeys.has(key)) {
      startedKeys.add(key);
      sendPlaybackBeacon({ ...ctx, event: 'started', language: queue.lang });
    }
    noteListenPlay(key, ctx);
    updatePositionState();
  });
  el.addEventListener('playing', () => {
    sleepMark = el.currentTime;
    setState({ status: 'playing' });
  });
  el.addEventListener('waiting', () => {
    if (!el.paused) setState({ status: 'loading' });
  });
  // timeupdate fires only when a seek completes: the clock shows its target from the start.
  el.addEventListener('seeking', () => {
    sleepMark = null;
    setState({ time: el.currentTime });
  });
  el.addEventListener('pause', () => {
    sleepMark = null;
    const key = currentKey();
    if (key) noteListenPause(key);
    if (!el.ended) setState({ status: 'paused' });
    saveProgress(true);
    updatePositionState();
  });
  // The kept place is set once the source knows its length, never before it loads.
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
    const sleep = countSleep(el);
    setState(moving ? { time: el.currentTime, status: 'playing', ...sleep } : { time: el.currentTime, ...sleep });
    if (sleep.sleep === 'off') el.pause();
    saveProgress(false);
    updatePositionState();
  });
  el.addEventListener('ratechange', () => {
    if (el.playbackRate > 0 && el.playbackRate !== state.rate) setState({ rate: clampRate(el.playbackRate) });
  });
  el.addEventListener('ended', onEnded);
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

function onEnded(): void {
  const el = audio;
  const key = currentKey();
  if (key && el) noteListenEnded(key, el.currentTime, el.duration);
  const { queue, current } = state;
  if (!queue || current === null) return;
  markDone(queue.figureId, current);
  clearProgress(queue, current);
  const next = current < lastN(queue) && hasItem(queue, current + 1) ? current + 1 : null;
  if (state.sleep === 'end') {
    setState({ status: 'paused', time: el?.duration ?? state.time, sleep: 'off', sleepLeft: 0 });
    updatePositionState();
    return;
  }
  if (next === null || !state.autoNext) {
    setState({ status: 'paused', time: el?.duration ?? state.time });
    updatePositionState();
    return;
  }
  // The plate promised "then story 1", and a locked phone shows no card.
  if (current === 0 || document.visibilityState === 'hidden') {
    startStory(queue, next, 0);
    return;
  }
  setState({ status: 'paused', time: el?.duration ?? state.time, endCard: { n: current, next, left: END_CARD_S } });
  updatePositionState();
  endTimer = window.setInterval(() => {
    const card = state.endCard;
    if (!card) return stopEndTimer();
    if (card.left <= 1 || document.visibilityState === 'hidden') {
      stopEndTimer();
      if (state.queue) startStory(state.queue, card.next, 0);
      return;
    }
    setState({ endCard: { ...card, left: card.left - 1 } });
  }, 1000);
}

// ---- the sleep timer: minutes of playing (paused time does not count, a seek is no time), or the story's end ----
let sleepMark: number | null = null;

export function setSleep(choice: SleepChoice): void {
  sleepMark = audio && !audio.paused ? audio.currentTime : null;
  setState({ sleep: choice, sleepLeft: typeof choice === 'number' ? choice * 60 : 0 });
}

/** The timer's step at a timeupdate: the voice's advance at its rate is the playing time (true on a locked phone,
 * where timers are slowed and timeupdate is not). At zero the timer turns off and the voice pauses. */
function countSleep(el: HTMLAudioElement): Partial<PlayerState> {
  if (typeof state.sleep !== 'number' || el.paused || el.seeking) return {};
  const was = sleepMark;
  sleepMark = el.currentTime;
  if (was === null) return {};
  const step = (el.currentTime - was) / (el.playbackRate || 1);
  if (!(step > 0 && step < 5)) return {};
  const left = state.sleepLeft - step;
  return left > 0 ? { sleepLeft: left } : { sleep: 'off', sleepLeft: 0 };
}

let endTimer: number | null = null;
function stopEndTimer(): void {
  if (endTimer !== null) window.clearInterval(endTimer);
  endTimer = null;
}

/** The end card's "Stay here": the next story waits for a tap. */
export function stayHere(): void {
  stopEndTimer();
  setState({ endCard: null });
}

/** The end card's "Listen now". */
export function listenNow(): void {
  const card = state.endCard;
  stopEndTimer();
  if (card && state.queue) startStory(state.queue, card.next, 0);
}

function startStory(queue: StoryQueue, n: number, startAt: number): void {
  const el = ensureAudio();
  const oldKey = currentKey();
  if (oldKey && !el.paused) noteListenPause(oldKey);
  saveProgress(true);
  stopEndTimer();
  pendingSeek = startAt > 0 ? startAt : null;
  const entry = queue.entries.find(e => e.n === n);
  setState({
    queue,
    current: n,
    status: 'loading',
    time: startAt,
    duration: entry?.seconds ?? 0,
    dismissed: false,
    resume: null,
    endCard: null,
    away: false,
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
}

export function sameQueue(a: StoryQueue | null, b: StoryQueue | null): boolean {
  return !!a && !!b && a.figureId === b.figureId && a.lang === b.lang;
}

// ---- the controls (call these from a click handler) ---------------------

/** Play item n of this figure from its kept place or startAt. The current item toggles instead. */
export function playStory(queue: StoryQueue, n: number, startAt?: number): void {
  if (sameQueue(state.queue, queue) && state.current === n && audio?.src && state.status !== 'error' && startAt === undefined) {
    if (state.dismissed) setState({ dismissed: false });
    togglePlay();
    return;
  }
  startStory(queue, n, startAt ?? keptPlace(queue, n));
}

/** Play from a given second of item n, for "listen from here". */
export function playFrom(queue: StoryQueue, n: number, seconds: number): void {
  if (sameQueue(state.queue, queue) && state.current === n && audio?.src && state.status !== 'error') {
    seekTo(seconds);
    if (audio.paused) play();
    return;
  }
  startStory(queue, n, seconds);
}

export function play(): void {
  const el = audio;
  if (!el || state.current === null) return;
  if (state.status === 'error' && state.queue) {
    startStory(state.queue, state.current, state.time);
    return;
  }
  if (state.endCard) stayHere();
  if (el.ended) el.currentTime = 0;
  if (state.dismissed) setState({ dismissed: false });
  void el.play().catch(() => setState({ status: 'error' }));
}

export function pause(): void {
  audio?.pause();
}

export function togglePlay(): void {
  const el = audio;
  if (!el || state.current === null) return;
  if (el.paused) play();
  else pause();
}

export function skipBack(): void {
  if (!audio || state.current === null) return;
  audio.currentTime = Math.max(0, audio.currentTime - SKIP_S);
}

export function skipForward(): void {
  if (!audio || state.current === null) return;
  const end = Number.isFinite(audio.duration) ? audio.duration - 0.25 : Infinity;
  audio.currentTime = Math.max(0, Math.min(end, audio.currentTime + SKIP_S));
}

/** The voice's position now, between two timeupdate events: the reader's marks are paced by frame from it. */
export function audioTime(): number {
  return audio && !audio.seeking && state.current !== null ? audio.currentTime : state.time;
}

/** Where the voice is or is about to be: a seek's target at once, so steps pressed in a row add up. */
export function voicePosition(): number {
  return audio && state.current !== null ? audio.currentTime : state.time;
}

export function seekTo(seconds: number): void {
  if (!audio || state.current === null || !Number.isFinite(seconds)) return;
  if (audio.readyState === 0) {
    pendingSeek = Math.max(0, seconds);
    setState({ time: pendingSeek });
    return;
  }
  audio.currentTime = Math.max(0, seconds);
}

export function hasNext(): boolean {
  return !!state.queue && state.current !== null && state.current < lastN(state.queue);
}

export function hasPrevious(): boolean {
  return !!state.queue && state.current !== null && state.current > (state.queue.entries[0]?.n ?? 0);
}

export function nextStory(): void {
  if (!state.queue || state.current === null || !hasNext()) return;
  startStory(state.queue, state.current + 1, 0);
}

/** Within the first seconds the story before; later, the start of this one. */
export function previousStory(): void {
  if (!state.queue || state.current === null) return;
  if (state.time > 5 || !hasPrevious()) {
    seekTo(0);
    return;
  }
  startStory(state.queue, state.current - 1, 0);
}

export function setRate(rate: number): void {
  const next = clampRate(rate);
  setState({ rate: next });
  try {
    localStorage.setItem(RATE_KEY, String(next));
  } catch {
    // storage blocked: the rate lasts as long as the page
  }
  if (audio) {
    audio.defaultPlaybackRate = next;
    audio.playbackRate = next;
  }
  updatePositionState(true);
}

/** One step of 0.05 up or down, as the app's players step. */
export function stepRate(direction: 1 | -1): void {
  setRate(state.rate + direction * RATE_STEP);
}

export function setAutoNext(on: boolean): void {
  setState({ autoNext: on });
  try {
    localStorage.setItem(AFTER_KEY, on ? 'next' : 'stop');
  } catch {
    // storage blocked
  }
}

function showReader(n: number, queue: StoryQueue): void {
  setState({ readerOpen: true, readerN: n, readerQueue: queue, sheet: state.sheet === 'facts' ? state.sheet : null, away: false });
}

function hideReader(): void {
  if (!state.readerOpen) return;
  setState({ readerOpen: false, readerN: null, readerQueue: null, away: false, sheet: state.sheet === 'player' ? state.sheet : null });
}

/** Open item n of the given figure, by default the page's (else the playing one's). The view gets its own step in
 *  history, so the browser's Back closes it. */
export function openReader(n: number, queue?: StoryQueue | null): void {
  const shown = queue ?? readPageQueue() ?? state.queue;
  if (!shown) return;
  showReader(n, shown);
  writeStep(n, shown);
}

/** The view's own close (its back control, Escape): the view's step leaves history with it. */
export function closeReader(): void {
  const wasOpen = state.readerOpen;
  hideReader();
  if (wasOpen) dropStep();
}

/** The view closes for a way out of it (a link, a page change): its step stays, so Back opens it again at its place. */
export function leaveReader(): void {
  if (!state.readerOpen) return;
  const st = entryState();
  const step = stepOf(st);
  if (step && step.doc === docMark) {
    const box = document.querySelector('.story-reader__scroll');
    history.replaceState({ ...st, [STEP_KEY]: { ...step, top: box ? Math.round(box.scrollTop) : 0 } }, '');
  }
  hideReader();
}

/** Where the view reopened from history stood: taken once, by the view, when its text is in. */
export function takeReaderTop(): number | null {
  const top = pendingTop;
  pendingTop = null;
  return top;
}

/** Kept for the islands that call it: open shows the playing item. */
export function setReaderOpen(open: boolean): void {
  if (open && state.current !== null) openReader(state.current, state.queue);
  else if (!open) closeReader();
}

/** The Aa sheet's "Save this sentence" where the reader's bar has no room for it (a phone): the reader keeps it. */
export const KEEP_EVENT = 'agc:keep-sentence';

export function setAway(away: boolean, dir?: 'up' | 'down'): void {
  const awayDir = dir ?? state.awayDir;
  if (state.away !== away || state.awayDir !== awayDir) setState({ away, awayDir });
}

export function openSheet(sheet: SheetKind, n?: number): void {
  setState({ sheet, sheetN: n ?? null });
}

export function closeSheet(): void {
  setState({ sheet: null, sheetN: null });
}

/** Stop playback: the story stops, its kept place stays. */
export function dismiss(): void {
  const wasOpen = state.readerOpen;
  audio?.pause();
  saveProgress(true);
  stopEndTimer();
  setState({ dismissed: true, readerOpen: false, readerN: null, readerQueue: null, resume: null, sheet: null, endCard: null, sleep: 'off', sleepLeft: 0 });
  if (wasOpen) dropStep();
  offerResumeForPage();
  updatePositionState();
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

// ---- kept places: per story, under the app's own keys -------------------

let resumeDeclined = false;

function progressKey(queue: { figureId: string; lang: string }, n: number): string {
  return `storyProgress_${queue.figureId}_${n}_${queue.lang}`;
}

interface Progress {
  t: number;
  at: number;
}

export function readProgress(queue: { figureId: string; lang: string }, n: number): Progress | null {
  try {
    const raw = localStorage.getItem(progressKey(queue, n));
    if (!raw) return null;
    const v = JSON.parse(raw) as { lastTimeSeconds?: unknown; updatedAt?: unknown };
    const t = typeof v.lastTimeSeconds === 'number' && Number.isFinite(v.lastTimeSeconds) ? v.lastTimeSeconds : 0;
    if (t <= PROGRESS_MIN_S) return null;
    const at = typeof v.updatedAt === 'string' ? Date.parse(v.updatedAt) : 0;
    return { t: Math.floor(t), at: Number.isFinite(at) ? at : 0 };
  } catch {
    return null;
  }
}

/** Where a tap on item n starts: its kept place, unless it was heard to the end. */
function keptPlace(queue: StoryQueue, n: number): number {
  return readProgress(queue, n)?.t ?? 0;
}

function clearProgress(queue: StoryQueue, n: number): void {
  try {
    localStorage.removeItem(progressKey(queue, n));
  } catch {
    // storage blocked
  }
}

function saveProgress(force: boolean): void {
  const { queue, current } = state;
  if (!queue || current === null || current === 0 || !audio || audio.ended) return;
  const now = Date.now();
  if (!force && now - lastProgressSave < PROGRESS_SAVE_MS) return;
  lastProgressSave = now;
  const t = audio.currentTime;
  if (!(t > 5)) return;
  try {
    localStorage.setItem(progressKey(queue, current), JSON.stringify({ lastTimeSeconds: t, updatedAt: new Date(now).toISOString() }));
  } catch {
    // storage full or blocked: the place is not kept
  }
}

/** The plate's offer on return: the story last listened to and not finished. */
function readResume(queue: StoryQueue): ResumePoint | null {
  let best: ResumePoint | null = null;
  let bestAt = -1;
  const done = readDone(queue.figureId);
  for (const entry of queue.entries) {
    if (entry.n === 0 || done.includes(entry.n)) continue;
    const p = readProgress(queue, entry.n);
    if (p && p.at >= bestAt) {
      best = { figureId: queue.figureId, lang: queue.lang, n: entry.n, t: p.t };
      bestAt = p.at;
    }
  }
  return best;
}

// ---- finished items, in this browser --------------------------------------

function readDone(figureId: string): number[] {
  try {
    const all = JSON.parse(localStorage.getItem(DONE_KEY) ?? '{}') as Record<string, unknown>;
    const list = all[figureId];
    return Array.isArray(list) ? list.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 100) : [];
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

/** A story read to its end counts as finished, as one heard to the end does. */
export function markRead(n: number): void {
  const queue = readPageQueue() ?? state.queue;
  if (!queue || state.done.includes(n)) return;
  markDone(queue.figureId, n);
}

// ---- saved sentences, on this device only ---------------------------------

function savedKey(queue: { figureId: string; lang: string }): string {
  return `${queue.figureId}_${queue.lang}`;
}

function readSaved(queue: { figureId: string; lang: string }): SavedSentence[] {
  try {
    const all = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '{}') as Record<string, unknown>;
    const list = all[savedKey(queue)];
    if (!Array.isArray(list)) return [];
    return list.filter((s): s is SavedSentence => {
      const v = s as SavedSentence;
      return !!v && Number.isInteger(v.n) && Number.isInteger(v.si) && typeof v.text === 'string';
    });
  } catch {
    return [];
  }
}

function writeSaved(queue: { figureId: string; lang: string }, list: SavedSentence[]): void {
  try {
    const all = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '{}') as Record<string, unknown>;
    all[savedKey(queue)] = list;
    localStorage.setItem(SAVED_KEY, JSON.stringify(all));
  } catch {
    // storage blocked: kept for this page only
  }
  setState({ saved: list });
}

export function saveSentence(n: number, si: number, text: string): boolean {
  const queue = readPageQueue() ?? state.queue;
  if (!queue) return false;
  const list = readSaved(queue);
  if (list.some(s => s.n === n && s.si === si)) return false;
  writeSaved(queue, [...list, { n, si, text, at: Date.now() }]);
  return true;
}

export function removeSaved(n: number, si: number): void {
  const queue = readPageQueue() ?? state.queue;
  if (!queue) return;
  writeSaved(queue, readSaved(queue).filter(s => !(s.n === n && s.si === si)));
}

// ---- the page's queue ----------------------------------------------------

// One object per page text: views key their effects on the queue's identity.
let pageQueueMemo: { text: string; queue: StoryQueue | null } | null = null;

export function readPageQueue(): StoryQueue | null {
  const node = document.querySelector('script[data-story-queue]') ?? document.querySelector('script[data-story-door-queue]');
  const text = node?.textContent ?? '';
  if (!text) return null;
  if (pageQueueMemo?.text === text) return pageQueueMemo.queue;
  let queue: StoryQueue | null = null;
  try {
    const q = JSON.parse(text) as StoryQueue;
    if (FIGURE_ID_RE.test(q.figureId) && (q.lang === 'en' || q.lang === 'de') && Array.isArray(q.entries)) queue = q;
  } catch {
    queue = null;
  }
  pageQueueMemo = { text, queue };
  return queue;
}

/** The queue whose item the visitor acts on: the page's, else the playing one's. */
export function activeQueue(): StoryQueue | null {
  return readPageQueue() ?? state.queue;
}

export function offerResumeForPage(): void {
  if (state.current !== null && !state.dismissed) return;
  const queue = readPageQueue();
  const point = queue && !resumeDeclined ? readResume(queue) : null;
  setState({ resume: point });
}

function loadForPage(): void {
  const queue = readPageQueue() ?? state.queue;
  setState({ done: queue ? readDone(queue.figureId) : [], saved: queue ? readSaved(queue) : [] });
}

/** A page that swaps its queue in place (the landing's stage): the marks and the kept place follow the new figure. */
export function refreshPageQueue(): void {
  loadForPage();
  offerResumeForPage();
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
    // Play and pause as named: after an interruption the page and the system
    // can disagree for a moment, and a toggle would invert the listener's intent.
    setHandler('play', () => play());
    setHandler('pause', () => pause());
    setHandler('seekbackward', () => skipBack());
    setHandler('seekforward', () => skipForward());
    setHandler('seekto', details => {
      if (typeof details.seekTime === 'number') seekTo(details.seekTime);
    });
  }
  setHandler('previoustrack', hasPrevious() ? () => previousStory() : null);
  setHandler('nexttrack', hasNext() ? () => nextStory() : null);
  const entry = queue.entries.find(e => e.n === current);
  const s = playerStrings(queue.lang);
  navigator.mediaSession.metadata = new MediaMetadata({
    title: current === 0 ? s.introTitle : entry?.title ?? s.storyN(current),
    artist: queue.name,
    album: 'Agora Cosmica',
    artwork: [{ src: queue.artwork, sizes: '640x640', type: 'image/webp' }],
  });
}

let lastPosition = 0;
function updatePositionState(force = false): void {
  if (!('mediaSession' in navigator) || !audio) return;
  navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
  const now = Date.now();
  if (!force && now - lastPosition < 1000) return;
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

// ---- the reading view's step in history ---------------------------------------
// Opening the view adds one entry on the same address over the entry it opened on (its base). Back from the step
// closes the view; Back to the step from where its links led opens it again. A traverse between a step and its base
// is the same page: it is answered in place, with no fetch, no swap and no scroll.

interface ReaderStep {
  n: number;
  figureId: string;
  lang: PlayerLang;
  /** The document that wrote the step: a soft page change brings a new one. */
  doc: string;
  /** The text's scroll when a way out left it. */
  top?: number | undefined;
}

const STEP_KEY = 'storyReader';
const BASE_KEY = 'storyReaderBase';

let docMark = '';
let popping = false;
let pendingTop: number | null = null;

function newDocMark(): void {
  docMark = Math.random().toString(36).slice(2, 10);
}

function entryState(): Record<string, unknown> {
  const st: unknown = history.state;
  return st && typeof st === 'object' ? (st as Record<string, unknown>) : {};
}

function stepOf(st: unknown): ReaderStep | null {
  const v = st && typeof st === 'object' ? (st as Record<string, unknown>)[STEP_KEY] : null;
  if (!v || typeof v !== 'object') return null;
  const s = v as ReaderStep;
  return Number.isInteger(s.n) && typeof s.figureId === 'string' && FIGURE_ID_RE.test(s.figureId)
    && (s.lang === 'en' || s.lang === 'de') && typeof s.doc === 'string' ? s : null;
}

/** The view's entry: a new one over the page's, or the open view's own rewritten for another item. */
function writeStep(n: number, queue: StoryQueue): void {
  const st = entryState();
  const step: ReaderStep = { n, figureId: queue.figureId, lang: queue.lang, doc: docMark };
  if (stepOf(st)) {
    history.replaceState({ ...st, [STEP_KEY]: step }, '');
    return;
  }
  const at = { scrollX: window.scrollX, scrollY: window.scrollY };
  history.replaceState({ ...st, ...at, [BASE_KEY]: docMark }, '');
  // The step keeps the base's fields (the router's index, the stage's figure): the router's next own entry counts on
  // from both, and its direction stays right.
  const rest = { ...st };
  delete rest[BASE_KEY];
  history.pushState({ ...rest, ...at, [STEP_KEY]: step }, '');
}

function dropStep(): void {
  if (popping || stepOf(history.state)?.doc !== docMark) return;
  popping = true;
  // a traverse the browser never ran must not hold the next close
  window.setTimeout(() => { popping = false; }, 2000);
  history.back();
}

function restoreStep(step: ReaderStep): void {
  if (state.readerOpen && state.readerN === step.n && state.readerQueue?.figureId === step.figureId) return;
  const queue = [readPageQueue(), state.queue].find(q => q && q.figureId === step.figureId && q.lang === step.lang) ?? null;
  if (!queue) return;
  pendingTop = typeof step.top === 'number' && step.top > 0 ? step.top : null;
  showReader(step.n, queue);
}

/** A step this document now shows takes its mark, and the view opens. */
function adoptStep(st: Record<string, unknown>, step: ReaderStep): void {
  if (step.doc !== docMark) history.replaceState({ ...st, [STEP_KEY]: { ...step, doc: docMark } }, '');
  restoreStep(step);
}

/** A page that arrives on a step (a soft change back to it, a load from the page cache or the network) opens the view. */
function restoreFromEntry(): void {
  const st = entryState();
  const step = stepOf(st);
  if (step && !state.readerOpen) adoptStep(st, step);
}

const routed = (): boolean => !!document.querySelector('[name="astro-view-transitions-enabled"]');

function onPopState(): void {
  const st = entryState();
  const step = stepOf(st);
  // Back onto the step's base: the router scrolls to the entry's own numbers, so they become the page's place now
  // (the same object the router holds for this traverse).
  if (st[BASE_KEY] === docMark && (state.readerOpen || popping)) {
    st.scrollX = window.scrollX;
    st.scrollY = window.scrollY;
  }
  if (popping) {
    popping = false;
    // the view was opened again before its old step had left: it gets a new one
    if (!step && state.readerOpen && state.readerN !== null && state.readerQueue) writeStep(state.readerN, state.readerQueue);
    return;
  }
  if (step) {
    // under the router a step of another document waits for the router: its swap, or its traverse in place below
    if (step.doc === docMark) restoreStep(step);
    else if (!routed()) adoptStep(st, step);
    return;
  }
  hideReader();
}

type TraverseEvent = Event & { navigationType?: string; from?: URL; to?: URL; loader?: () => Promise<void>; signal?: AbortSignal };

/** The router's traverse between a step and its base: answered in place. The router's loader is held until its next
 *  navigation aborts it, so nothing is fetched, swapped, scrolled or announced. Window capture runs before the
 *  stage's and the router glue's listeners (this module is evaluated before theirs install). */
function onBeforePreparation(e: Event): void {
  const ev = e as TraverseEvent;
  if (ev.navigationType !== 'traverse') return;
  const st = entryState();
  const step = stepOf(st);
  const base = st[BASE_KEY];
  if (!step && typeof base !== 'string') return;
  const own = step ? step.doc === docMark : base === docMark;
  const samePage = !!ev.from && !!ev.to && ev.from.pathname === ev.to.pathname && ev.from.search === ev.to.search;
  if (!own && !samePage) return;
  // on the front, an entry of another portrait is the stage's to answer
  const mark = st.landingStage;
  if (typeof mark === 'string' && mark !== document.querySelector<HTMLElement>('[data-landing-stage]')?.dataset.figure) return;
  e.stopImmediatePropagation();
  // a step a reload left behind is this page's now
  if (step && !own) adoptStep(st, step);
  const signal = ev.signal;
  ev.loader = () => new Promise<void>(done => {
    signal?.addEventListener('abort', () => {
      ev.preventDefault();
      done();
    }, { once: true });
  });
}

function installHistory(): void {
  newDocMark();
  window.addEventListener('popstate', onPopState);
  window.addEventListener('astro:before-preparation', onBeforePreparation, true);
  document.addEventListener('astro:after-swap', newDocMark);
  window.addEventListener('pageshow', e => {
    if (e.persisted) restoreFromEntry();
  });
}

if (typeof window !== 'undefined' && typeof history !== 'undefined') installHistory();

// ---- start --------------------------------------------------------------

let installed = false;

/** Wire the page once per document. The dock island calls this on mount. */
export function installPlayer(): void {
  if (installed) return;
  installed = true;
  const rate = readNumber(RATE_KEY);
  let after: string | null = null;
  try {
    after = localStorage.getItem(AFTER_KEY);
  } catch {
    // storage blocked
  }
  setState({ rate: rate ? clampRate(rate) : 1, autoNext: after !== 'stop' });
  document.addEventListener('astro:page-load', () => {
    loadForPage();
    offerResumeForPage();
    restoreFromEntry();
  });
  // The reading view belongs to the page it opened over: any page change closes it, and its step stays for Back.
  document.addEventListener('astro:before-swap', () => {
    if (state.readerOpen) leaveReader();
  });
  document.addEventListener('astro:after-swap', applyStoredTheme);
  applyStoredTheme();
  loadForPage();
  window.addEventListener('pagehide', () => saveProgress(true));
  installRouterGlue(() => state.current !== null && !state.dismissed);
  offerResumeForPage();
  restoreFromEntry();
}
