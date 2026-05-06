import type { Env } from './types';

export function getServers(env: Env) {
  return {
    fsn1: { id: 'fsn1', url: env.SERVER_FSN1_URL },
    nbg1: { id: 'nbg1', url: env.SERVER_NBG1_URL },
  };
}

export const TIMEOUTS = {
  TTS: 30_000,
  STT: 15_000,
  HEALTH_FETCH: 3_000,
} as const;

/** Minimum seconds between KV health refreshes */
export const HEALTH_TTL_SECONDS = 15;

export const KV_KEY = 'server-health';

/** Headers to pass through from upstream response */
export const PASSTHROUGH_HEADERS = [
  'x-model',
  'x-inference-ms',
  'x-total-ms',
  'x-tts-backend',
  'x-tts-session-expires-in',
  'content-type',
  'content-length',
] as const;

/** Anti-abuse rate limiting configuration */
export const RATE_LIMIT_CONFIG = {
  // A council burst = 7 TTS + conversation = 5 TTS = ~12/min peak.
  // 60/min gives 5x headroom. Only bots hit this.
  BURST_PER_MINUTE: 60,
  DAILY_PER_IP: 500,           // per-IP hard cap
  // No global daily cap: servers are dedicated hardware (fixed cost 24/7).
  // GPU capacity handled server-side by BBA scheduler + failover.
} as const;
