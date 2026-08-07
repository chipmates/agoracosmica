// Anonymous funnel-step beacon (Waves 1-2)
// One-shot steps fire once per tab: cinematic_start / cinematic_end
// (LoginPage), welcome_shown (WelcomeDisclosureModal), first_turn and
// first_turn_prefilled (HomePage, one or the other per send),
// first_reply (useConversationEffects chunk handler, error variant from the
// HomePage dispatch error path), first_reply_failed (HomePage, alongside the
// error variant and on an abandoned stream). Volume steps fire on every
// occurrence, no dedup: figure_selected (HomePage.handleSelectFigure),
// mode_selected (HomePage.handleModeSelect, the mode chokepoint), nav_open
// (the ways out of a conversation),
// chat_depth (flushed here on chat switch
// and unload) and the turnstile_* family (services/proxy/turnstile.ts).
// The marketing pages' cta_click fires from agc-public.js with the same
// payload shape.
//
// Privacy: keyless aggregate counter only. No clientId, no gclid, no IP, no
// raw milliseconds — timing leaves the browser only as a coarse bucket index.
// There is no join key between funnel steps; the funnel is read at the
// population level (compare totals), never per person. The one-shot dedup
// flag lives in tab-scoped sessionStorage and is never transmitted (mirrors
// the agc_conv_fired_* pattern in gclidCapture.ts). Never localStorage: that
// would be cross-session memory of an individual.
// Disclosed in docs/MEASUREMENT.md alongside the other event counters.

import { isSelfHost } from '../config/deployment';
import { probeField } from './probeSession';

const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

export type FunnelStep =
  | 'cta_click'
  | 'cinematic_start'
  | 'cinematic_end'
  | 'welcome_shown'
  | 'first_turn'
  // The same activation moment for a send the visitor did not type: they
  // clicked the question on a public page and it arrived in the composer.
  // Its own one-shot, so a later typed send still fires first_turn.
  | 'first_turn_prefilled'
  | 'figure_selected'
  | 'mode_selected'
  | 'first_reply'
  // Why a first reply never arrived. One-shot per tab, fired next to (never
  // instead of) first_reply, so the existing counter keeps its exact shape.
  | 'first_reply_failed'
  // How deep a chat went, emitted once when the chat is left behind. Carries a
  // bucket index only, never the turn count and never a chat key.
  | 'chat_depth'
  // Wave 3: listen-to-talk handoff (per-occurrence volume counters, like
  // figure_selected). shown = the card appeared at content completion,
  // taken = the visitor tapped through into the talk chapter.
  | 'handoff_shown'
  | 'handoff_taken'
  // Council revision: catalog opens (per-occurrence volume counter). With
  // playback 'started' this separates "never opens" from "opens and flees".
  | 'council_open'
  // A way out of the conversation was taken (per-occurrence volume counter).
  // The mode slot names which one: provenance_chip, chapter_door, and the
  // rest of the corridor affordances as they land.
  | 'nav_open'
  // Free-tier bot check (per-occurrence volume counters, like figure_selected):
  // how often the check runs at all, how often it asks for a tap, how often
  // that tap lands, and how often the check kills the message instead.
  // turnstile_started is the denominator the escalation rate needs.
  | 'turnstile_started'
  | 'turnstile_interactive'
  | 'turnstile_solved'
  | 'turnstile_failed'
  // The page went away with a check still running.
  | 'turnstile_abandoned'
  // A token aged out AFTER the check had already succeeded. Deliberately its
  // own step: it is housekeeping, not a lost message, and folding it into
  // turnstile_failed drowned the real failures at roughly 14 to 1.
  | 'turnstile_token_aged';

export type CinematicOutcome = 'watched' | 'skipped';

/** Why a bot check ended without a token, on turnstile_failed. */
export type TurnstileOutcome = 'error' | 'timeout' | 'expired';

/** What an abandoned bot check was waiting on: a tap, or nothing visible yet. */
export type TurnstileAbandonOutcome = 'interactive' | 'pending';

/** Why a first reply never arrived, on first_reply_failed. */
export type FirstReplyFailReason = 'turnstile' | 'quota' | 'upstream' | 'abort';

// blob5 outcome slot: cinematic_end sends watched/skipped, first_reply sends
// 200/error, turnstile_failed sends error/timeout/expired, turnstile_abandoned
// sends interactive/pending, first_reply_failed sends the reason bucket. Steps
// that send nothing default to '200' server-side.
export type FunnelOutcome =
  | CinematicOutcome
  | '200'
  | TurnstileOutcome
  | TurnstileAbandonOutcome
  | FirstReplyFailReason;

/**
 * Cinematic dwell bucket boundaries, in seconds. Four buckets:
 * index 0 = 0-5s, 1 = 5-15s, 2 = 15-30s, 3 = 30s+.
 * Adjust the boundaries here (one line); the bucket count follows.
 */
export const CINEMATIC_DWELL_BUCKETS_S: readonly number[] = [5, 15, 30];

/** Map an elapsed duration to its coarse dwell bucket index (0-based). */
export function cinematicDwellBucket(elapsedMs: number): number {
  const seconds = elapsedMs / 1000;
  for (let i = 0; i < CINEMATIC_DWELL_BUCKETS_S.length; i++) {
    if (seconds < CINEMATIC_DWELL_BUCKETS_S[i]) return i;
  }
  return CINEMATIC_DWELL_BUCKETS_S.length;
}

/**
 * Reply-time bucket boundaries, in seconds, for first_reply. Five buckets:
 * index 0 = under 2s, 1 = 2-5s, 2 = 5-10s, 3 = 10-30s, 4 = 30s+.
 * Adjust the boundaries here (one line); the bucket count follows.
 */
export const REPLY_TIME_BUCKETS_S: readonly number[] = [2, 5, 10, 30];

/** Map an elapsed duration to its coarse reply-time bucket index (0-based). */
export function replyTimeBucket(elapsedMs: number): number {
  const seconds = elapsedMs / 1000;
  for (let i = 0; i < REPLY_TIME_BUCKETS_S.length; i++) {
    if (seconds < REPLY_TIME_BUCKETS_S[i]) return i;
  }
  return REPLY_TIME_BUCKETS_S.length;
}

// Dispatch-start stamp for the first_reply time bucket. Module-scoped:
// HomePage writes it at submit (alongside setPendingRequestId), the
// assistant-chunk handler in useConversationEffects and the dispatch error
// path read it back as a bucket index. The raw timestamp never leaves this
// module and raw milliseconds never leave the browser; only the coarse
// bucket index is transmitted.
let replyDispatchStartMs: number | null = null;

/** Stamp the moment a chat dispatch starts (called next to setPendingRequestId). */
export function markReplyDispatchStart(): void {
  try {
    replyDispatchStartMs = performance.now();
  } catch {
    replyDispatchStartMs = null;
  }
}

/**
 * Coarse reply-time bucket for the elapsed time since the last dispatch
 * start, or undefined when no dispatch was stamped (the beacon then sends
 * no bucket and the server stores index 0).
 */
export function replyTimeBucketSinceDispatch(): number | undefined {
  if (replyDispatchStartMs === null) return undefined;
  try {
    return replyTimeBucket(performance.now() - replyDispatchStartMs);
  } catch {
    return undefined;
  }
}

/**
 * Sort a conversation failure into one of four reason buckets for
 * first_reply_failed. Pure and total: anything unrecognized is 'upstream', so
 * the four buckets always sum to the failure count.
 *
 * Order matters. A blocked bot check surfaces as a plain timeout Error with no
 * status, so it has to be tested before the status branches, and an abort has
 * to be tested before everything (an aborted request can carry any shape).
 */
export function firstReplyFailReason(error: unknown): FirstReplyFailReason {
  const name = (error as { name?: unknown } | null | undefined)?.name;
  if (name === 'AbortError') return 'abort';

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('turnstile')) return 'turnstile';

  const status = (error as { status?: unknown } | null | undefined)?.status;
  if (status === 429) return 'quota';

  return 'upstream';
}

/**
 * Per-chat depth bucket boundaries, in user-typed turns. Four buckets:
 * index 0 = 1 turn, 1 = 2-3, 2 = 4-9, 3 = 10+.
 * Adjust the boundaries here (one line); the bucket count follows.
 */
export const CHAT_DEPTH_BUCKETS: readonly number[] = [2, 4, 10];

/** Map a user-turn count to its coarse depth bucket index (0-based). */
export function chatDepthBucket(turns: number): number {
  for (let i = 0; i < CHAT_DEPTH_BUCKETS.length; i++) {
    if (turns < CHAT_DEPTH_BUCKETS[i]) return i;
  }
  return CHAT_DEPTH_BUCKETS.length;
}

// Live depth of the chat currently open, in memory only. Never written to any
// storage, never transmitted: the count leaves the browser once, as a bucket
// index, when the chat is left behind. The chat key is used only to notice
// that a different chat is now open and stays inside this module.
let openChatKey: string | null = null;
let openChatTurns = 0;
let openChatMode = '';

/**
 * Count one user-typed turn in the chat identified by `chatKey`. Switching to
 * a different chat flushes the previous one first, so each chat contributes
 * exactly one depth row.
 */
export function noteChatTurn(chatKey: string | null, mode?: string): void {
  const key = chatKey || 'unkeyed';
  if (key !== openChatKey) {
    flushChatDepth();
    openChatKey = key;
    openChatTurns = 0;
  }
  openChatTurns += 1;
  if (mode) openChatMode = mode;
}

/** Emit the open chat's depth bucket, if it had any user turn at all. */
export function flushChatDepth(): void {
  if (openChatTurns > 0) {
    sendFunnelBeacon('chat_depth', {
      bucket: chatDepthBucket(openChatTurns),
      mode: openChatMode || undefined,
    });
  }
  openChatKey = null;
  openChatTurns = 0;
  openChatMode = '';
}

// A closing tab is the most common way a chat ends, so the flush has to
// survive unload. pagehide fires on iOS Safari where unload does not, and
// sendBeacon is the transport that outlives the page.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => flushChatDepth());
}

function detectLanguage(): 'en' | 'de' {
  try {
    const docLang = typeof document !== 'undefined' ? document.documentElement.lang : '';
    if (docLang && docLang.toLowerCase().startsWith('de')) return 'de';
    const stored = typeof localStorage !== 'undefined'
      ? localStorage.getItem('selectedLanguage') || localStorage.getItem('language')
      : null;
    if (stored && stored.toLowerCase().startsWith('de')) return 'de';
    if (typeof navigator !== 'undefined' && navigator.language && navigator.language.toLowerCase().startsWith('de')) return 'de';
  } catch {
    // Ignore — fall through to 'en'
  }
  return 'en';
}

// Tab-scoped one-shot. The flag itself never leaves the browser.
function alreadyFired(step: FunnelStep): boolean {
  try {
    return sessionStorage.getItem(`agc_funnel_fired_${step}`) === '1';
  } catch {
    return false;
  }
}

function markFired(step: FunnelStep): void {
  try {
    sessionStorage.setItem(`agc_funnel_fired_${step}`, '1');
  } catch {
    // Storage blocked (private mode, quota) — the beacon still fires once
    // per page lifetime via the call sites' own guards.
  }
}

/**
 * Has a given funnel step already fired this tab? Lets a later step gate itself
 * on an earlier one. first_reply uses this to stay a true reply: the figure's
 * auto-greeting dispatches the same assistant-chunk event before the visitor
 * has typed, so first_reply must wait until first_turn has fired or it would
 * outrun first_turn (more replies than messages, which is impossible).
 */
export function hasFiredFunnelStep(step: FunnelStep): boolean {
  return alreadyFired(step);
}

/**
 * Has this tab had its first user turn at all, typed or carried? The reply
 * counters gate on this rather than on first_turn alone: a carried question is
 * a real turn that simply was not typed, and gating on first_turn would drop
 * every carried conversation out of first_reply.
 */
export function hasFiredFirstTurn(): boolean {
  return alreadyFired('first_turn') || alreadyFired('first_turn_prefilled');
}

interface FunnelFields {
  figureId?: string;
  mode?: string;
  outcome?: FunnelOutcome;
  bucket?: number;
}

// Shared transport for both senders. Payload: step, optional figureId/mode
// (content labels, validated server-side), optional outcome, optional coarse
// bucket index, language (en/de), and the in-house probe constant when this
// browser is marked. Country is derived server-side at the CF edge. No user
// dimension of any kind.
function postFunnel(step: FunnelStep, fields: FunnelFields): void {
  const body = JSON.stringify({
    step,
    figureId: fields.figureId || undefined,
    mode: fields.mode || undefined,
    outcome: fields.outcome,
    bucket: fields.bucket,
    language: detectLanguage(),
    probe: probeField(),
  });
  const url = `${API_BASE}/v1/funnel`;

  // sendBeacon survives navigation/unload (cinematic_end can race the
  // handoff). text/plain keeps it a simple CORS request, so there is no
  // preflight to lose mid-transition; the worker parses the JSON body
  // regardless of content type.
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    if (navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return;
  }
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    keepalive: true,
  }).catch(() => {
    // Silent fail — beacons must never surface to the user.
  });
}

/**
 * Send a funnel-step beacon, at most once per tab per step. Fire-and-forget:
 * never throws, never blocks the caller, never surfaces a network failure.
 */
export function sendFunnelBeaconOnce(step: FunnelStep, fields: FunnelFields = {}): void {
  if (isSelfHost) return; // self-host instances are analytics-silent
  try {
    if (alreadyFired(step)) return;
    markFired(step);
    postFunnel(step, fields);
  } catch {
    // Silent fail
  }
}

/**
 * Send a funnel-step beacon on EVERY occurrence, no one-shot dedup. For the
 * volume counters (figure_selected, mode_selected) that measure how often a
 * step happens, not whether it happened this tab. Same anonymous row shape
 * and fire-and-forget posture as sendFunnelBeaconOnce.
 */
export function sendFunnelBeacon(step: FunnelStep, fields: FunnelFields = {}): void {
  if (isSelfHost) return; // self-host instances are analytics-silent
  try {
    postFunnel(step, fields);
  } catch {
    // Silent fail
  }
}
