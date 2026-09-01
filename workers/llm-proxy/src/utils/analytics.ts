// Anonymous usage analytics via Cloudflare Analytics Engine
// Zero PII: no IP, no user ID, no message content. Only structural labels.
// "No User Tracking" compliant — aggregate event counters only, no per-user
// dimension. See README "What we measure (and why)" for the full list.

import type { Env } from './types';

/**
 * Read the country code from request.cf (Cloudflare-derived, coarser than IP).
 * Returns 'XX' if unknown. Two-letter ISO 3166-1 alpha-2 code on success.
 */
export function readCountry(request: Request): string {
  const country = (request as Request & { cf?: { country?: string } }).cf?.country;
  if (typeof country === 'string' && country.length === 2) return country;
  return 'XX';
}

/**
 * Derive a coarse device class (mobile | desktop | tablet) from the request
 * User-Agent, mirroring readCountry: taken server-side from a header already on
 * every request. Only the three-value class is ever returned or written, never
 * the User-Agent string, so it is far too coarse to identify a device (it is
 * not a fingerprint). Prefers the low-entropy Sec-CH-UA-Mobile client hint when
 * the browser sends it, otherwise a coarse User-Agent test. Returns 'unknown'
 * when no User-Agent is present (a header-less beacon).
 */
export function readDevice(request: Request): string {
  const ua = request.headers.get('User-Agent') || '';
  // Tablets before phones: iPad, an explicit "Tablet", or Android without the
  // "Mobile" token are tablets; Android *with* "Mobile" is a phone.
  if (/\biPad\b/i.test(ua) || /\bTablet\b/i.test(ua) || (/\bAndroid\b/i.test(ua) && !/\bMobile\b/i.test(ua))) {
    return 'tablet';
  }
  if (request.headers.get('Sec-CH-UA-Mobile') === '?1' ||
      /Mobi|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return 'mobile';
  }
  return ua ? 'desktop' : 'unknown';
}

/**
 * blob9 across every event type: a marked browser stamps its own rows so
 * in-house probing can be subtracted at query time. It is a constant, the
 * same string for every marked row, never an identifier and never varying
 * per visitor, so it adds no user dimension. Self-declared by the client on
 * purpose: the only thing a false claim buys is self-exclusion.
 */
export const PROBE_LABEL = 'probe';

/** Read the probe marker off a beacon payload field. Anything else is ''. */
export function readProbe(value: unknown): string {
  return (value === 1 || value === true || value === '1') ? PROBE_LABEL : '';
}

/**
 * blob8 on page rows: this pageview opened the visit. Like PROBE_LABEL it is a
 * constant, the same string on every marked row, so it adds no user dimension.
 * The client decides it from the referrer of the document it is running in,
 * which is a property of the pageview and needs nothing stored.
 */
export const LANDING_LABEL = 'landing';

/** Read the landing marker off a beacon payload field. Anything else is ''. */
export function readLanding(value: unknown): string {
  return (value === 1 || value === true || value === '1') ? LANDING_LABEL : '';
}

/**
 * Track an LLM proxy event (chat/council/summary).
 * dataset: agora_llm
 * blobs: [endpoint, figureId, mode, language, status, device, country, kind, probe]
 * doubles: [durationMs]
 * indexes: [endpoint]
 *
 * blob6 carries the coarse device class (mobile/desktop/tablet) from
 * readDevice, which keeps country pinned at blob7 across every event type.
 * Legacy rows hold a channel label or an empty string in this slot (pre-device).
 *
 * blob8 rides alongside on chat rows only: greeting / turn / prefilled, so the
 * auto-greeting can be told apart from a human turn. The row count itself is
 * untouched, so the Conversations total stays comparable across the change.
 */
export function trackLlmEvent(
  env: Env,
  data: {
    endpoint: 'chat' | 'council' | 'summary';
    figureId: string;
    mode: string;
    language: string;
    status: number;
    durationMs: number;
    country: string;
    device: string;
    kind: string;
    probe: string;
  }
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: [
        data.endpoint,
        data.figureId,
        data.mode,
        data.language.startsWith('de') ? 'de' : 'en',
        String(data.status),
        data.device,
        data.country,
        data.kind,
        data.probe,
      ],
      doubles: [data.durationMs],
      indexes: [data.endpoint],
    });
  } catch {
    // Analytics must never break the request path
  }
}

/**
 * Track a session creation (DAU proxy).
 * dataset: agora_llm
 * blobs: ['session', '', '', '', status, device, country]
 * indexes: ['session']
 */
export function trackSession(
  env: Env,
  status: number,
  country: string,
  device: string,
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['session', '', '', '', String(status), device, country],
      doubles: [0],
      indexes: ['session'],
    });
  } catch {
    // Analytics must never break the request path
  }
}

/**
 * Track an anonymous content-playback event (story / teaching / prism /
 * council / foreword). Fires from the client either when content STARTS
 * (audio first-play) or when it COMPLETES (gamification star award). The
 * event field distinguishes the two so the dashboard can compute completion
 * rate and funnel over time.
 *
 * dataset: agora_llm
 * blobs: ['playback', figureId, mode, language, type, device, country, event, probe]
 * doubles: [bucket]  — a coarse bucket INDEX of the seconds actually listened
 *                      (0 = 0-14s, 1 = 15-59s, 2 = 60-179s, 3 = 180-599s,
 *                      4 = 600-1799s, 5 = 1800s+), written on the terminal
 *                      events only and 0 on every other event. Never raw
 *                      seconds and never a playhead position.
 * indexes: ['playback']
 *
 * Backward compat: rows written before 2026-05-08 evening have empty blob8.
 * Treat empty blob8 as 'completed' in queries (the only event type that
 * existed before the started/completed split).
 */
export function trackPlayback(
  env: Env,
  data: {
    type: string;
    figureId: string;
    mode: string;
    language: string;
    country: string;
    device: string;
    event: string;
    bucket: number;
    probe: string;
  }
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: [
        'playback',
        data.figureId,
        data.mode,
        data.language,
        data.type,
        data.device,
        data.country,
        data.event,
        data.probe,
      ],
      doubles: [data.bucket],
      indexes: ['playback'],
    });
  } catch {
    // Analytics must never break the request path
  }
}

/**
 * Track a page-load beacon. Fires once on App mount in the client, before any
 * user interaction. Lets the dashboard show arrivals over time.
 * dataset: agora_llm
 * blobs: ['page', path, '', language, '200', device, country, landing, probe]
 * indexes: ['page']
 *
 * blob8 is 'landing' when this pageview opened the visit (no referrer, or a
 * referrer from another host) and '' otherwise, so an arrival can be told
 * apart from a click deeper into the same site. It is a property of the
 * pageview, not of the visitor, and nothing is stored to derive it. Rows
 * written before the flag existed have '' here, which reads as "not known to
 * be a landing" rather than as "not a landing".
 */
export function trackPageView(
  env: Env,
  data: {
    path: string;
    language: string;
    country: string;
    device: string;
    landing: string;
    probe: string;
  }
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['page', data.path, '', data.language, '200', data.device, data.country, data.landing, data.probe],
      doubles: [0],
      indexes: ['page'],
    });
  } catch {
    // Analytics must never break the request path
  }
}

/**
 * Track an entry beacon. Fires from the client's WelcomeDisclosureModal when
 * the user consents and the profile is created (the post-cinematic welcome
 * step; since the 2026-05-29 refactor). Sits between the page-load beacon
 * (every arrival) and the session row (Turnstile-gated).
 * dataset: agora_llm
 * blobs: ['entry', path, '', language, '200', device, country, '', probe]
 * indexes: ['entry']
 */
export function trackEntry(
  env: Env,
  data: {
    path: string;
    language: string;
    country: string;
    device: string;
    probe: string;
  }
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['entry', data.path, '', data.language, '200', data.device, data.country, '', data.probe],
      doubles: [0],
      indexes: ['entry'],
    });
  } catch {
    // Analytics must never break the request path
  }
}

/**
 * Track a new-account signup. Fires from the client's WelcomeDisclosureModal
 * when the user consents AND is new (no prior profile in IndexedDB). Distinct
 * from entry (which fires for everyone who completes the welcome step) and from
 * profile_created (which is gclid-gated, ad-attributed only). Lets the
 * dashboard show total signups including organic.
 *
 * dataset: agora_llm
 * blobs: ['signup', path, '', language, '200', device, country, '', probe]
 * indexes: ['signup']
 */
export function trackSignup(
  env: Env,
  data: {
    path: string;
    language: string;
    country: string;
    device: string;
    probe: string;
  }
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['signup', data.path, '', data.language, '200', data.device, data.country, '', data.probe],
      doubles: [0],
      indexes: ['signup'],
    });
  } catch {
    // Analytics must never break the request path
  }
}

/**
 * Track an anonymous funnel-step beacon (Wave 1: cta_click, cinematic_start,
 * cinematic_end, welcome_shown, first_turn; Wave 2: figure_selected,
 * mode_selected, first_reply). Keyless aggregate counts only: no clientId,
 * no gclid, no IP, no value that lets two rows be tied to the same person.
 * There is no join key between funnel steps, so the funnel is read at the
 * population level (compare totals), never per visitor. Wave-1 steps and
 * first_reply are one-shot per tab on the client; figure_selected and
 * mode_selected count every occurrence (volume counters, same row shape).
 *
 * dataset: agora_llm
 * blobs: [step, figureId|path|'', mode|arm|'', language, outcome, device, country, '', probe]
 * doubles: [bucket]  — a coarse bucket INDEX (cinematic dwell 0-3,
 *                      first_reply reply-time 0-4, chat_depth 0-3), never raw
 *                      milliseconds and never a per-chat message count
 * indexes: [step]
 *
 * blob3 holds the arm on 'engaged' (typed / listened / both) instead of a
 * conversation mode: the same slot, a different closed vocabulary.
 *
 * blob6 carries the coarse device class (keeps country at blob7 across all
 * event types); blob8 stays empty (it belongs to playback rows).
 */
export function trackFunnel(
  env: Env,
  data: {
    step: string;
    ref: string; // figureId or sanitized path, already validated by the route
    mode: string;
    language: string;
    outcome: string;
    bucket: number;
    country: string;
    device: string;
    probe: string;
  }
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: [
        data.step,
        data.ref,
        data.mode,
        data.language,
        data.outcome,
        data.device,
        data.country,
        '',
        data.probe,
      ],
      doubles: [data.bucket],
      indexes: [data.step],
    });
  } catch {
    // Analytics must never break the request path
  }
}

/**
 * Track a rate limit hit (429).
 * dataset: agora_llm
 * blobs: ['ratelimit', endpoint, reason, '', '429', device, country]
 * indexes: ['ratelimit']
 */
export function trackRateLimit(
  env: Env,
  endpoint: string,
  reason: 'daily' | 'global' | 'council' | 'summary' | 'conversions',
  country: string,
  device: string,
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['ratelimit', endpoint, reason, '', '429', device, country],
      doubles: [0],
      indexes: ['ratelimit'],
    });
  } catch {
    // Analytics must never break the request path
  }
}
