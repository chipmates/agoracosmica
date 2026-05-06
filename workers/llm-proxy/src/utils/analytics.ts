// Anonymous usage analytics via Cloudflare Analytics Engine
// Zero PII: no IP, no user ID, no message content. Only structural labels.
// "Ohne Tracking" compliant — aggregate event counters only.

import type { Env } from './types';

/**
 * Track an LLM proxy event (chat/council/summary).
 * dataset: agora_llm
 * blobs: [endpoint, figureId, mode, language, status]
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
 * blobs: ['session', '', '', '', status]
 * indexes: ['session']
 */
export function trackSession(env: Env, status: number): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['session', '', '', '', String(status)],
      doubles: [0],
      indexes: ['session'],
    });
  } catch {
    // Analytics must never break the request path
  }
}

/**
 * Track a rate limit hit (429).
 * dataset: agora_llm
 * blobs: ['ratelimit', endpoint, reason, '', '429']
 * indexes: ['ratelimit']
 */
export function trackRateLimit(
  env: Env,
  endpoint: string,
  reason: 'daily' | 'global' | 'council' | 'summary'
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: ['ratelimit', endpoint, reason, '', '429'],
      doubles: [0],
      indexes: ['ratelimit'],
    });
  } catch {
    // Analytics must never break the request path
  }
}
