// Anonymous funnel-step beacon
// Fires from the marketing pages (cta_click via agc-public.js) and from the
// client app (cinematic_start / cinematic_end / welcome_shown / first_turn /
// figure_selected / mode_selected / first_reply via utils/funnelBeacon.ts).
// Lights up the dark zone between the page-load beacon and the entry/signup
// beacons: does the intro play, is it watched or skipped, does the consent
// screen open, does a first conversation start, does the first reply arrive.
//
// Privacy: keyless aggregate counter only. No user dimension, no IP retention,
// no join key between funnel steps (the funnel is population-level: compare
// totals per window, never follow an individual). Timing arrives only as a
// coarse bucket index, never raw milliseconds. Disclosed in
// docs/MEASUREMENT.md alongside the other event counters.

import { trackFunnel, readCountry } from '../utils/analytics';
import type { Env } from '../utils/types';

interface FunnelPayload {
  step?: string;
  figureId?: string;
  path?: string;
  mode?: string;
  language?: string;
  outcome?: string;
  bucket?: number;
}

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
  'figure_selected',
  'mode_selected',
  'first_reply',
]);

// Outcome slot (blob5): same role as status/type elsewhere. Steps without a
// meaningful outcome default to '200', matching the entry/signup convention.
const VALID_OUTCOMES = new Set(['200', 'watched', 'skipped', 'error']);

// blob2 holds a figureId OR a sanitized path, never free text. Paths are
// validated like routes/page.ts; figure ids against a tight slug shape.
const PATH_RE = /^\/[A-Za-z0-9/_-]{0,60}$/;
const FIGURE_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MODE_RE = /^[a-z_]{1,40}$/;
const VALID_LANGS = new Set(['en', 'de']);

// Coarse bucket index ceiling (cinematic dwell uses 0-3, the first_reply
// reply-time set uses 0-4; the ceiling keeps one slot of headroom). Anything
// else collapses to 0.
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
  let ref = '';
  if (typeof payload.figureId === 'string' && FIGURE_RE.test(payload.figureId)) {
    ref = payload.figureId;
  } else if (typeof payload.path === 'string' && PATH_RE.test(payload.path)) {
    ref = payload.path;
  }

  const mode = (typeof payload.mode === 'string' && MODE_RE.test(payload.mode))
    ? payload.mode
    : '';
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

  trackFunnel(env, {
    step,
    ref,
    mode,
    language: lang,
    outcome,
    bucket,
    country: readCountry(request),
  });

  return new Response(null, { status: 204 });
}
