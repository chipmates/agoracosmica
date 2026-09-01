// Anonymous content-playback beacon
// Fires through a track's listening lifecycle: it started, it passed each
// quarter of its length, and it either ran to the end or stopped short. The
// completion beacon also fires when a content item is marked completed in
// localStorage, the same trigger as the gamification star award.
//
// Privacy: aggregate counter only. No user dimension. No IP retention. The
// listening clock lives in this module's memory for the lifetime of the tab
// and never reaches any storage. Time listened leaves the browser only as a
// coarse bucket index, never as seconds and never as a playhead position.
// See docs/MEASUREMENT.md for the full disclosure.

import { isSelfHost } from '../config/deployment';
import { probeField } from './probeSession';
import { noteEngagedListenMilestone, noteEngagedListenSeconds } from './funnelBeacon';

const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

export type PlaybackContentType = 'story' | 'teaching' | 'prism' | 'council' | 'foreword';
export type PlaybackEvent =
  | 'started'
  | 'progress_25'
  | 'progress_50'
  | 'progress_75'
  | 'completed'
  | 'ended';

interface PlaybackPayload {
  type: PlaybackContentType;
  event?: PlaybackEvent;
  figureId?: string;
  mode?: string;
  language?: string;
  /** Coarse listened-time bucket index. Only read on the terminal events. */
  bucket?: number;
}

/**
 * Transport for one beacon. 'fetch' is the normal path. 'beacon' is for the
 * moments the page is going away (pagehide, a tab going hidden), where a
 * fetch can be cancelled mid-flight and sendBeacon cannot.
 */
type PlaybackTransport = 'fetch' | 'beacon';

/**
 * Send a content-playback beacon. Fire-and-forget — never throws, never
 * blocks the caller, never breaks the gamification flow on network failure.
 *
 * Event semantics:
 *   - 'started' fires once on first audio play after URL change (audio content)
 *   - 'progress_25' / 'progress_50' / 'progress_75' fire once per track per tab
 *     as the playhead passes each quarter of the track
 *   - 'completed' fires when a track is heard to its end, and when content is
 *     marked completed in localStorage (the gamification star award)
 *   - 'ended' fires when a track stopped short of its end
 *
 * Defaults to 'completed' for backward compat with the existing mark*Completed
 * call sites in storageKeysV2.ts, which were the original consumers before
 * the started/completed split.
 */
export function sendPlaybackBeacon(
  payload: PlaybackPayload,
  transport: PlaybackTransport = 'fetch'
): void {
  if (isSelfHost) return; // self-host instances are analytics-silent
  try {
    const body = JSON.stringify({
      type: payload.type,
      event: payload.event || 'completed',
      figureId: payload.figureId,
      mode: payload.mode,
      language: payload.language,
      bucket: payload.bucket,
      probe: probeField(),
    });

    // text/plain keeps sendBeacon a simple CORS request, so there is no
    // preflight to lose while the page is unloading; the worker parses the
    // JSON body regardless of content type.
    if (transport === 'beacon'
      && typeof navigator !== 'undefined'
      && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(`${API_BASE}/v1/playback`, new Blob([body], { type: 'text/plain' }))) {
        return;
      }
    }

    fetch(`${API_BASE}/v1/playback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      keepalive: true,
    }).catch(() => {
      // Silent fail — beacons must never surface to the user.
    });
  } catch {
    // Silent fail
  }
}

/**
 * Read the current UI language from the document or localStorage. Falls back
 * to 'en'. Used so the beacon can label content engagement by language without
 * each caller needing to plumb it through.
 */
export function detectCurrentLanguage(): 'en' | 'de' {
  try {
    const docLang = typeof document !== 'undefined' ? document.documentElement.lang : '';
    if (docLang && docLang.toLowerCase().startsWith('de')) return 'de';
    const stored = typeof localStorage !== 'undefined'
      ? localStorage.getItem('selectedLanguage') || localStorage.getItem('language')
      : null;
    if (stored && stored.toLowerCase().startsWith('de')) return 'de';
  } catch {
    // Ignore
  }
  return 'en';
}

// ============================================
// Listen tracker
// ============================================

/**
 * Listened-time bucket boundaries, in seconds. Six buckets:
 * index 0 = 0-14s, 1 = 15-59s, 2 = 60-179s, 3 = 180-599s, 4 = 600-1799s,
 * 5 = 1800s+. FROZEN: the boundaries are the meaning of every terminal row
 * already written, so moving one silently rewrites past weeks.
 */
export const LISTEN_BUCKETS_S: readonly number[] = [15, 60, 180, 600, 1800];

/** Map accumulated listened seconds to their coarse bucket index (0-based). */
export function listenBucket(seconds: number): number {
  for (let i = 0; i < LISTEN_BUCKETS_S.length; i++) {
    if (seconds < LISTEN_BUCKETS_S[i]) return i;
  }
  return LISTEN_BUCKETS_S.length;
}

/**
 * A track is 'completed' when the playhead reached the end AND enough of it
 * was actually heard, so seeking to the last second is not a completion.
 * Below that, a track that stopped short is 'ended' once it was heard for
 * long enough to be worth a row at all (which is also the first bucket
 * boundary). FROZEN for the same reason as the buckets.
 */
const COMPLETE_POSITION_RATIO = 0.95;
const COMPLETE_LISTENED_RATIO = 0.6;
const TERMINAL_MIN_SECONDS = 15;

// Quarter marks, in order. The event names are positional: index 0 is the
// first quarter.
const MILESTONE_EVENTS: readonly PlaybackEvent[] = ['progress_25', 'progress_50', 'progress_75'];

// Longest gap between two samples that still counts as audio someone heard. A
// bigger one is a stall or a tab that came back, never playback, so it is
// dropped instead of added. Background playback (lock screen, hidden tab)
// throttles timeupdate, so the cap leaves room for sparse samples while a
// track is genuinely playing.
const MAX_TICK_S = 30;

// Which content types count toward the engaged 'listened' arm. The other
// types still get the full lifecycle, they just do not qualify a visit as
// engaged on their own.
const ENGAGED_LISTEN_TYPES = new Set<PlaybackContentType>(['story', 'teaching']);

interface ListenContext {
  type: PlaybackContentType;
  figureId?: string;
  mode?: string;
}

interface TrackListen {
  ctx: ListenContext;
  /** Seconds accumulated while the audio was playing. Never leaves as seconds. */
  played: number;
  /** Wall clock at the last accrual, or null while accrual is suspended. */
  tickMs: number | null;
  playing: boolean;
  position: number;
  duration: number;
  /** How many quarter marks have been sent (0-3). */
  milestones: number;
  terminal: boolean;
}

// Tab memory only: a plain Map that dies with the document. No localStorage,
// no sessionStorage, no cookie, and the keys never leave this module.
const tracks = new Map<string, TrackListen>();

/**
 * Key one track inside this tab. Built from the content labels plus the audio
 * URL, which is what distinguishes one chapter from the next. It stays in
 * memory and is never transmitted, so the URL in it reaches nothing.
 */
export function listenTrackKey(ctx: ListenContext, audioUrl: string): string {
  return `${ctx.type}|${ctx.figureId ?? ''}|${audioUrl}`;
}

function accrue(state: TrackListen): void {
  if (state.tickMs === null) return;
  const now = Date.now();
  const slice = (now - state.tickMs) / 1000;
  state.tickMs = now;
  if (!(slice > 0) || slice > MAX_TICK_S) return;
  state.played += slice;
  if (ENGAGED_LISTEN_TYPES.has(state.ctx.type)) noteEngagedListenSeconds(state.played);
}

/**
 * Start accruing again, but only while the track is playing. Visibility does
 * not gate the clock: audio behind a lock screen or a hidden tab is still
 * listening, and the playing state plus the tick cap bound any inflation.
 */
function arm(state: TrackListen): void {
  state.tickMs = state.playing ? Date.now() : null;
}

function emit(state: TrackListen, event: PlaybackEvent, transport: PlaybackTransport): void {
  sendPlaybackBeacon(
    {
      type: state.ctx.type,
      event,
      figureId: state.ctx.figureId,
      mode: state.ctx.mode,
      language: detectCurrentLanguage(),
      // Only the terminal events carry a bucket; the worker pins the rest to 0.
      bucket: event === 'completed' || event === 'ended' ? listenBucket(state.played) : undefined,
    },
    transport
  );
}

/**
 * Send every quarter mark the playhead has reached and not yet sent. A seek
 * past a mark still sends it, so the three counts stay a funnel that can only
 * shrink from one step to the next.
 */
function sendMilestones(state: TrackListen): void {
  if (!(state.duration > 0)) return;
  const reached = Math.min(
    MILESTONE_EVENTS.length,
    Math.floor((state.position / state.duration) / 0.25)
  );
  while (state.milestones < reached) {
    const event = MILESTONE_EVENTS[state.milestones];
    state.milestones += 1;
    emit(state, event, 'fetch');
    if (event === 'progress_25' && ENGAGED_LISTEN_TYPES.has(state.ctx.type)) {
      noteEngagedListenMilestone();
    }
  }
}

/**
 * Close out one track, at most once per tab. A track heard to its end is
 * 'completed', anything else that ran long enough to matter is 'ended', and a
 * track nobody really heard writes nothing at all.
 */
function terminate(state: TrackListen, transport: PlaybackTransport): void {
  if (state.terminal) return;
  const complete = state.duration > 0
    && state.position >= state.duration * COMPLETE_POSITION_RATIO
    && state.played >= state.duration * COMPLETE_LISTENED_RATIO;
  if (!complete && state.played < TERMINAL_MIN_SECONDS) return;
  state.terminal = true;
  emit(state, complete ? 'completed' : 'ended', transport);
}

/** The track began playing (first play, or resume after a pause). */
export function noteListenPlay(trackKey: string, ctx: ListenContext): void {
  let state = tracks.get(trackKey);
  if (!state) {
    state = {
      ctx,
      played: 0,
      tickMs: null,
      playing: false,
      position: 0,
      duration: 0,
      milestones: 0,
      terminal: false,
    };
    tracks.set(trackKey, state);
  }
  state.playing = true;
  arm(state);
}

/** The track paused. Accrual stops here and resumes on the next play. */
export function noteListenPause(trackKey: string): void {
  const state = tracks.get(trackKey);
  if (!state) return;
  accrue(state);
  state.playing = false;
  state.tickMs = null;
}

/**
 * The playhead moved. Accrues the wall clock since the last sample and sends
 * any quarter mark the track has reached.
 */
export function noteListenProgress(trackKey: string, position: number, duration: number): void {
  const state = tracks.get(trackKey);
  if (!state) return;
  if (state.tickMs === null) arm(state); // first sample after a resume
  else accrue(state);
  if (Number.isFinite(position)) state.position = position;
  if (Number.isFinite(duration) && duration > 0) state.duration = duration;
  sendMilestones(state);
}

/** The track reached its end (or the player stopped it). */
export function noteListenEnded(trackKey: string, position: number, duration: number): void {
  const state = tracks.get(trackKey);
  if (!state) return;
  accrue(state);
  state.playing = false;
  state.tickMs = null;
  if (Number.isFinite(duration) && duration > 0) state.duration = duration;
  // A track that ran out reports its own length as the position: the 'ended'
  // media event fires at the end even when currentTime has already reset.
  state.position = Number.isFinite(position) && position > 0 ? position : state.duration;
  sendMilestones(state);
  terminate(state, 'fetch');
}

// The page going away is the last chance to say how much of each open track
// was heard, so every track that has not closed out yet does so now. pagehide
// fires on iOS Safari where unload does not.
function suspendAll(): void {
  tracks.forEach((state) => {
    accrue(state);
    state.tickMs = null;
    terminate(state, 'beacon');
  });
}

// A hidden tab can still be playing audio (lock screen, background tab), and
// that listening counts. Going hidden closes out only the tracks that are NOT
// playing, because for those it is the last reliable signal a mobile browser
// gives before the page is gone.
function flushIdle(): void {
  tracks.forEach((state) => {
    if (state.playing) return;
    accrue(state);
    state.tickMs = null;
    terminate(state, 'beacon');
  });
}

// Re-arm only the suspended clocks: a track that kept playing while hidden
// kept its clock, and resetting it here would drop the last slice.
function resumeIdle(): void {
  tracks.forEach((state) => {
    if (state.tickMs === null) arm(state);
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushIdle();
    else resumeIdle();
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => suspendAll());
}
