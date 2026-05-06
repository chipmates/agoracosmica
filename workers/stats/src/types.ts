// Types for agora-cosmica-stats worker

export interface Env {
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  AUDIO_API_KEY: string;
  SERVER_FSN1_URL: string;
  SERVER_NBG1_URL: string;
  /**
   * Origin verification token. Same value as the audio worker's ORIGIN_VERIFY_KEY.
   * Injected as `X-Origin-Verify` on every upstream stats fetch so nginx accepts it.
   * Optional during shadow rollout; required once nginx enforces.
   */
  ORIGIN_VERIFY_KEY?: string;
  /**
   * Unix epoch (seconds) of public launch. When set to a non-zero value, all
   * Analytics Engine queries are floored at this timestamp and the dashboard
   * renders a "Stats since: <date>" label under the sidebar brand. Defaults
   * to "0" (no floor, no label) — matches behavior before the launch-floor
   * feature was added.
   */
  LAUNCH_EPOCH_SECONDS?: string;
}

export interface BatchQueryRequest {
  queries: Array<{ sql: string; dataset: string }>;
}

export interface ServerStatsCache {
  data: { fsn1: unknown; nbg1: unknown } | null;
  at: number;
}
