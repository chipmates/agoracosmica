export interface Env {
  HEALTH_CACHE: KVNamespace;
  RATE_LIMITS: KVNamespace;
  ANALYTICS: AnalyticsEngineDataset;
  AUDIO_API_KEY: string;
  ALLOWED_ORIGINS: string;
  SERVER_FSN1_URL: string;
  SERVER_NBG1_URL: string;
  /** Optional — if set, requests carrying `X-Load-Test-Auth: <key>` skip rate limits. */
  LOAD_TEST_BYPASS_KEY?: string;
  /**
   * Origin verification token. When set, the Worker injects `X-Origin-Verify: <key>`
   * on every upstream call so nginx can reject any request that didn't transit the
   * Worker (defense against direct-to-origin abuse with a leaked AUDIO_API_KEY).
   * Optional during shadow rollout; once nginx enforces, treat as required.
   */
  ORIGIN_VERIFY_KEY?: string;
}

export interface GpuSlots {
  available: number;
  max: number;
}

export interface HealthData {
  gpu_slots: GpuSlots;
  timestamp: number;
}

export interface ServerInfo {
  id: string;
  url: string;
  health: HealthData | null;
}

export interface CachedHealth {
  fsn1: HealthData | null;
  nbg1: HealthData | null;
  updatedAt: number;
}

export type GpuLoadTier = 'green';

export type RateLimitHint = 'disable_tts' | 'rate_limited';

export interface AudioRateLimitResult {
  allowed: boolean;
  code?: string;
  hint?: RateLimitHint;
  message?: string;
  daily: { used: number; limit: number };
  gpuLoad: GpuLoadTier;
  resetsAt: string;
}
