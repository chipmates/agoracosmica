// Anonymous funnel-step beacon
// Fires from the marketing pages (cta_click and paid_arrival via
// agc-public.js, the ad_consent_* counters via the AdConsentPrompt island) and
// from the client app (cinematic_start / cinematic_end / welcome_shown /
// first_turn / figure_selected / mode_selected / first_reply / engaged via
// utils/funnelBeacon.ts).
// Lights up the dark zone between the page-load beacon and the entry/signup
// beacons: does the intro play, is it watched or skipped, does the consent
// screen open, does a first conversation start, does the first reply arrive.
//
// Privacy: keyless aggregate counter only. No user dimension, no IP retention,
// no join key between funnel steps (the funnel is population-level: compare
// totals per window, never follow an individual). Timing arrives only as a
// coarse bucket index, never raw milliseconds. Disclosed in
// docs/MEASUREMENT.md alongside the other event counters.

import { trackFunnel, readCountry, readDevice, readProbe } from '../utils/analytics';
import type { Env } from '../utils/types';

interface FunnelPayload {
  step?: string;
  figureId?: string;
  path?: string;
  mode?: string;
  language?: string;
  outcome?: string;
  bucket?: number;
  probe?: unknown;
}

// Ad-measurement consent prompt: how many ad arrivals see the question and
// what they answer. One-shot per tab on the client, counter-only here.
// The three answers carry a coarse time-to-answer bucket (0 = under 1s,
// 1 = 1 to 3s, 2 = 3 to 10s, 3 = over 10s, measured from the moment the card
// came into view). The shown step has nothing to time and keeps bucket 0.
const CONSENT_ANSWER_STEPS = [
  'ad_consent_accepted',
  'ad_consent_declined',
  'ad_consent_dismissed',
] as const;
const CONSENT_STEPS = ['ad_consent_shown', ...CONSENT_ANSWER_STEPS] as const;

// Strict server-side step allowlist (Waves 1-2). Anything not on this list is
// silently dropped — no row is written and the client learns nothing (same
// fire-and-forget posture as the other beacons).
// Wave-1 steps are one-shot per tab on the client. The Wave-2 figure_selected
// and mode_selected are per-occurrence volume counters (same anonymous row
// shape, no dedup); first_reply is one-shot like Wave 1.
const VALID_STEPS = new Set([
  'cta_click',
  'cinematic_start',
  'cinematic_end',
  'welcome_shown',
  'first_turn',
  // The activation moment for a send the visitor did not type: the question
  // came from a public page and arrived in the composer. One-shot per tab like
  // first_turn, and never instead of it — the two split the same total, so
  // first_turn keeps its typed-only meaning.
  'first_turn_prefilled',
  'figure_selected',
  'mode_selected',
  'first_reply',
  // Why a first reply never arrived, in the outcome slot: turnstile / quota /
  // upstream / abort. One-shot per tab like first_reply, and it never replaces
  // first_reply — that counter keeps its exact prior shape.
  'first_reply_failed',
  // Per-chat depth, emitted once when a chat is left behind. The row carries
  // only a bucket index (0 = 1 turn, 1 = 2-3, 2 = 4-9, 3 = 10+), never the
  // turn count and never a chat key.
  'chat_depth',
  // Wave 3: listen-to-talk handoff, per-occurrence volume counters
  'handoff_shown',
  'handoff_taken',
  // Council revision: catalog opens, per-occurrence volume counter. Closes
  // the "never opens vs opens and flees" gap between sidebar tap and the
  // playback started beacon.
  'council_open',
  // A way out of a conversation was taken, per-occurrence volume counter. The
  // mode slot names which one: the provenance chip and the chapter door emit
  // it now, the rest of the corridor affordances follow.
  'nav_open',
  // Free-tier bot check, per-occurrence volume counters. turnstile_failed
  // carries why it ended without a token. turnstile_started is the denominator
  // (one per widget render), turnstile_abandoned counts a check still pending
  // when the page goes away, and turnstile_token_aged sits deliberately
  // OUTSIDE the failure family: it is a token expiring after a successful
  // check, which is housekeeping, not a lost message.
  'turnstile_started',
  'turnstile_interactive',
  'turnstile_solved',
  'turnstile_failed',
  'turnstile_abandoned',
  'turnstile_token_aged',
  // The homepage recognized a returning browser (consent record present) and
  // forwarded it straight into the app. One-shot per tab on the client; the
  // row carries language only.
  'return_visit',
  // The visit did something rather than only arriving: a first typed turn, or
  // enough listening to count as listening. The arm rides in the mode slot.
  // At most two per tab (the first arm, then 'both' if the other one follows).
  'engaged',
  // Ask while listening, per-occurrence volume counters. shown = the bar
  // arrived under a paused chapter (once per chapter play, deduped on the
  // client so a pause for a sip cannot bury the take rate), sent = a question
  // went out, resumed = the chapter was picked up again after an answer. The
  // row carries the figure id and 'story' in the mode slot.
  'ask_listen_shown',
  'ask_listen_sent',
  'ask_listen_resumed',
  // A paid-ad arrival: the landing URL carried the paid parameter. One per
  // pageview, standard dimensions only, so it describes the parameter and not
  // the person who clicked.
  'paid_arrival',
  ...CONSENT_STEPS,
]);

// Which half of the product the visit engaged with, in the mode slot on
// 'engaged'. A closed vocabulary: an engaged row without one of these three
// cannot be read and would inflate the total, so it is dropped instead.
const ENGAGED_ARMS = new Set(['typed', 'listened', 'both']);

// Steps whose row is the step name and the standard edge dimensions, nothing
// else: no path, no figure, no mode. Deliberately not COUNTER_ONLY_STEPS,
// which keeps the sanitized path.
const DIMENSIONLESS_STEPS = new Set(['paid_arrival']);

// Counter-only steps: the row is the step name, the sanitized page path the
// question appeared on, the interface language, the country and device class
// the edge derives, and on the three answers the coarse time-to-answer
// bucket. Nothing else. The mode slot is blanked, the outcome is forced to
// '200' server-side, and the path slot only ever takes a path — a figure id
// sent on one of these steps is dropped rather than stored, so no content
// dimension can ride along with a consent answer. The route reads no gclid
// field on any step, so none can be stored either. Derived from CONSENT_STEPS
// rather than re-listed, so the lists cannot drift apart.
// docs/MEASUREMENT.md states this shape.
const COUNTER_ONLY_STEPS = new Set<string>(CONSENT_STEPS);

// Counter-only steps that may still carry a bucket. Everything else on the
// counter-only list is pinned to 0. The consent set has exactly four buckets,
// so a higher index is not ours and collapses to 0 rather than writing a value
// docs/MEASUREMENT.md does not describe.
const TIMED_COUNTER_STEPS = new Set<string>(CONSENT_ANSWER_STEPS);
const CONSENT_MAX_BUCKET = 3;

// Outcome slot (blob5): same role as status/type elsewhere. Steps without a
// meaningful outcome default to '200', matching the entry/signup convention.
// 'interactive' and 'pending' say whether an abandoned bot check was waiting on
// a tap or still invisible, which separates challenge failure from widget-load
// failure. The last four are the first_reply_failed reason buckets.
const VALID_OUTCOMES = new Set([
  '200', 'watched', 'skipped', 'error', 'timeout', 'expired',
  'interactive', 'pending',
  'turnstile', 'quota', 'upstream', 'abort',
]);

// blob2 holds a figureId OR a sanitized path, never free text. Paths are
// validated like routes/page.ts; figure ids against a tight slug shape.
const PATH_RE = /^\/[A-Za-z0-9/_-]{0,60}$/;
const FIGURE_RE = /^[A-Za-z0-9_-]{1,64}$/;
// blob3 holds a conversation mode on most steps, the arrival class on
// welcome_shown (generic / figure / ask / council / chapter), the affordance
// name on nav_open and the arm on engaged. All of them are short lowercase
// labels.
const MODE_RE = /^[a-z_]{1,40}$/;
const VALID_LANGS = new Set(['en', 'de']);

// Coarse bucket index ceiling (cinematic dwell and the consent time-to-answer
// set use 0-3, the first_reply reply-time set uses 0-4; the ceiling keeps one
// slot of headroom). Anything else collapses to 0.
const MAX_BUCKET = 5;

// Rate limit: 200 funnel beacons per IP per hour. A single session emits
// several funnel events (one per step), so the cap sits higher than entry's
// 50. The plain IP appears only inside this short-lived KV key (1-hour TTL,
// auto-deleted) and never in any stored analytics row.
const RATE_LIMIT_WINDOW = 3600;
const RATE_LIMIT_MAX = 200;

export async function handleFunnel(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: FunnelPayload;
  try {
    payload = await request.json();
  } catch {
    // Be quiet on malformed beacons — the client doesn't get to know.
    return new Response(null, { status: 204 });
  }

  // Step allowlist first: an unknown step never costs a KV write or a row.
  const step = typeof payload.step === 'string' ? payload.step : '';
  if (!VALID_STEPS.has(step)) {
    return new Response(null, { status: 204 });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `funnel_rl:${ip}`;
  const currentCount = parseInt(await env.RATE_LIMITS.get(rateLimitKey) || '0', 10);
  if (currentCount >= RATE_LIMIT_MAX) {
    return new Response(null, { status: 204 });
  }
  await env.RATE_LIMITS.put(rateLimitKey, String(currentCount + 1), { expirationTtl: RATE_LIMIT_WINDOW });

  // blob2: figureId wins over path; anything that fails validation becomes ''
  // so the row is still recorded with a clean content slot.
  const path = (typeof payload.path === 'string' && PATH_RE.test(payload.path))
    ? payload.path
    : '';
  let ref = path;
  if (typeof payload.figureId === 'string' && FIGURE_RE.test(payload.figureId)) {
    ref = payload.figureId;
  }

  const mode = (typeof payload.mode === 'string' && MODE_RE.test(payload.mode))
    ? payload.mode
    : '';
  // The arm is the whole content of an engaged row, so an unreadable one is
  // dropped rather than stored blank.
  if (step === 'engaged' && !ENGAGED_ARMS.has(mode)) {
    return new Response(null, { status: 204 });
  }
  const lang = (typeof payload.language === 'string') && VALID_LANGS.has(payload.language.slice(0, 2).toLowerCase())
    ? payload.language.slice(0, 2).toLowerCase()
    : '';
  const outcome = (typeof payload.outcome === 'string' && VALID_OUTCOMES.has(payload.outcome))
    ? payload.outcome
    : '200';
  // double1 only ever holds a small bucket index, never raw milliseconds.
  const bucket = (typeof payload.bucket === 'number'
    && Number.isInteger(payload.bucket)
    && payload.bucket >= 0
    && payload.bucket <= MAX_BUCKET)
    ? payload.bucket
    : 0;

  const counterOnly = COUNTER_ONLY_STEPS.has(step);
  const timedCounter = TIMED_COUNTER_STEPS.has(step);
  const dimensionless = DIMENSIONLESS_STEPS.has(step);
  let outBucket = !counterOnly || timedCounter ? bucket : 0;
  if (timedCounter && outBucket > CONSENT_MAX_BUCKET) outBucket = 0;
  if (dimensionless) outBucket = 0;

  trackFunnel(env, {
    step,
    // Path only on the counter-only steps, so a figure id can never ride
    // along with a consent answer, and nothing at all on the dimensionless
    // ones (a forged payload cannot attach a path to them either).
    ref: dimensionless ? '' : (counterOnly ? path : ref),
    mode: counterOnly || dimensionless ? '' : mode,
    language: lang,
    // '200', never '', so a counter row stays recognizable as a funnel row
    // (the dashboard tells conversion rows apart by an empty outcome slot).
    outcome: counterOnly || dimensionless ? '200' : outcome,
    bucket: outBucket,
    country: readCountry(request),
    device: readDevice(request),
    probe: readProbe(payload.probe),
  });

  return new Response(null, { status: 204 });
}
