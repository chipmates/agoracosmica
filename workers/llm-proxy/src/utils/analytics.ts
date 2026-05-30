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
 * Track an LLM proxy event (chat/council/summary).
 * dataset: agora_llm
 * blobs: [endpoint, figureId, mode, language, status, '', country]
 * doubles: [durationMs]
 * indexes: [endpoint]
 *
 * blob6 is reserved as an empty slot to preserve schema position for blob7
 * (country). Legacy rows have channel labels here; new rows write empty.
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
        '',
        data.country,
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
 * blobs: ['session', '', '', '', status, '', country]
 * indexes: ['session']
 */
export function trackSession(
  env: Env,
  status: number,
  country: string,
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['session', '', '', '', String(status), '', country],
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
 * blobs: ['playback', figureId, mode, language, type, '', country, event]
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
    event: string;
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
        '',
        data.country,
        data.event,
      ],
      doubles: [0],
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
 * blobs: ['page', path, '', language, '200', '', country]
 * indexes: ['page']
 */
export function trackPageView(
  env: Env,
  data: {
    path: string;
    language: string;
    country: string;
  }
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['page', data.path, '', data.language, '200', '', data.country],
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
 * blobs: ['entry', path, '', language, '200', '', country]
 * indexes: ['entry']
 */
export function trackEntry(
  env: Env,
  data: {
    path: string;
    language: string;
    country: string;
  }
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['entry', data.path, '', data.language, '200', '', data.country],
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
 * blobs: ['signup', path, '', language, '200', '', country]
 * indexes: ['signup']
 */
export function trackSignup(
  env: Env,
  data: {
    path: string;
    language: string;
    country: string;
  }
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['signup', data.path, '', data.language, '200', '', data.country],
      doubles: [0],
      indexes: ['signup'],
    });
  } catch {
    // Analytics must never break the request path
  }
}

/**
 * Track a rate limit hit (429).
 * dataset: agora_llm
 * blobs: ['ratelimit', endpoint, reason, '', '429', '', country]
 * indexes: ['ratelimit']
 */
export function trackRateLimit(
  env: Env,
  endpoint: string,
  reason: 'daily' | 'global' | 'council' | 'summary' | 'conversions',
  country: string,
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['ratelimit', endpoint, reason, '', '429', '', country],
      doubles: [0],
      indexes: ['ratelimit'],
    });
  } catch {
    // Analytics must never break the request path
  }
}
