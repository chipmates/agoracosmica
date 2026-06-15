// Anonymous funnel-step beacon (Waves 1-2)
// One-shot steps fire once per tab: cinematic_start / cinematic_end
// (LoginPage), welcome_shown (WelcomeDisclosureModal), first_turn (HomePage),
// first_reply (useConversationEffects chunk handler, error variant from the
// HomePage dispatch error path). Volume steps fire on every occurrence, no
// dedup: figure_selected (HomePage.handleSelectFigure) and mode_selected
// (ModeSelectorMini). The marketing pages' cta_click fires from agc-public.js
// with the same payload shape.
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

const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

export type FunnelStep =
  | 'cta_click'
  | 'cinematic_start'
  | 'cinematic_end'
  | 'welcome_shown'
  | 'first_turn'
  | 'figure_selected'
  | 'mode_selected'
  | 'first_reply';

export type CinematicOutcome = 'watched' | 'skipped';

// blob5 outcome slot: cinematic_end sends watched/skipped, first_reply sends
// 200/error. Steps that send nothing default to '200' server-side.
export type FunnelOutcome = CinematicOutcome | '200' | 'error';

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

interface FunnelFields {
  figureId?: string;
  mode?: string;
  outcome?: FunnelOutcome;
  bucket?: number;
}

// Shared transport for both senders. Payload: step, optional figureId/mode
// (content labels, validated server-side), optional outcome, optional coarse
// bucket index, and language (en/de). Country is derived server-side at the
// CF edge. No user dimension of any kind.
function postFunnel(step: FunnelStep, fields: FunnelFields): void {
  const body = JSON.stringify({
    step,
    figureId: fields.figureId || undefined,
    mode: fields.mode || undefined,
    outcome: fields.outcome,
    bucket: fields.bucket,
    language: detectLanguage(),
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
