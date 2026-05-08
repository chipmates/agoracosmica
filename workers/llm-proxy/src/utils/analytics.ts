// Anonymous usage analytics via Cloudflare Analytics Engine
// Zero PII: no IP, no user ID, no message content. Only structural labels.
// "No User Tracking" compliant — aggregate event counters only, no per-user
// dimension. See README "What we measure (and why)" for the full list.

import type { Env } from './types';

// Closed allowlist for marketing source labels. Validated server-side to
// guarantee the dashboard never sees free-text values, even if the client
// header is malformed or hostile.
const ALLOWED_MARKETING_SOURCES = new Set([
  'spotify', 'grants', 'paid', 'organic', 'direct', 'unknown',
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
 * Track an anonymous content-completion playback event (story / teaching /
 * prism / council / foreword). Fires from the client when a content item is
 * marked completed (same trigger as the gamification star award), so each
 * row represents a real consumption, not a click-and-bail.
 *
 * dataset: agora_llm
 * blobs: ['playback', figureId, mode, language, type, marketing_source, country]
 * indexes: ['playback']
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
      ],
      doubles: [0],
      indexes: ['playback'],
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
