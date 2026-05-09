// Anonymous usage analytics via Cloudflare Analytics Engine
// Zero PII: no IP, no user ID, no message content. Only structural labels.
// "No User Tracking" compliant — aggregate event counters only, no per-user
// dimension. See README "What we measure (and why)" for the full list.

import type { Env } from './types';

// Closed allowlist for marketing source labels. Validated server-side to
// guarantee the dashboard never sees free-text values, even if the client
// header is malformed or hostile. spotify_a / spotify_b are A/B variants
// of the Spotify campaign — see client/public/_redirects for the shortcut
// rules and gclidCapture.ts for the matching client-side allowlist.
const ALLOWED_MARKETING_SOURCES = new Set([
  'spotify', 'spotify_a', 'spotify_b',
  'grants', 'paid', 'organic', 'direct', 'unknown',
]);

/**
 * Read X-Marketing-Source header from a request and validate against the closed
 * allowlist. Returns 'direct' on missing, 'unknown' on invalid.
 * Brand-line guarantee: never combine with any per-user dimension.
 */
export function readMarketingSource(request: Request): string {
  const raw = request.headers.get('X-Marketing-Source');
  if (!raw) return 'direct';
  const lower = raw.toLowerCase();
  return ALLOWED_MARKETING_SOURCES.has(lower) ? lower : 'unknown';
}

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
 * blobs: [endpoint, figureId, mode, language, status, marketing_source, country]
 * doubles: [durationMs]
 * indexes: [endpoint]
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
    marketingSource: string;
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
        data.marketingSource,
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
 * blobs: ['session', '', '', '', status, marketing_source, country]
 * indexes: ['session']
 */
export function trackSession(
  env: Env,
  status: number,
  marketingSource: string,
  country: string,
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['session', '', '', '', String(status), marketingSource, country],
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
 * blobs: ['playback', figureId, mode, language, type, marketing_source, country, event]
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
    marketingSource: string;
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
        data.marketingSource,
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
 * user interaction. Lets the dashboard show arrivals per channel, not just
 * post-engagement events.
 * dataset: agora_llm
 * blobs: ['page', path, '', language, '200', marketing_source, country]
 * indexes: ['page']
 */
export function trackPageView(
  env: Env,
  data: {
    path: string;
    language: string;
    marketingSource: string;
    country: string;
  }
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['page', data.path, '', data.language, '200', data.marketingSource, data.country],
      doubles: [0],
      indexes: ['page'],
    });
  } catch {
    // Analytics must never break the request path
  }
}

/**
 * Track a rate limit hit (429).
 * dataset: agora_llm
 * blobs: ['ratelimit', endpoint, reason, '', '429', marketing_source, country]
 * indexes: ['ratelimit']
 */
export function trackRateLimit(
  env: Env,
  endpoint: string,
  reason: 'daily' | 'global' | 'council' | 'summary',
  marketingSource: string,
  country: string,
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['ratelimit', endpoint, reason, '', '429', marketingSource, country],
      doubles: [0],
      indexes: ['ratelimit'],
    });
  } catch {
    // Analytics must never break the request path
  }
}
