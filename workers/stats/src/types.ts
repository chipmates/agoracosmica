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
  /**
   * Museum of Ages panel. A read-only token for the museum's zone (Zone,
   * Analytics, Read, that one zone) and the zone's tag, both secrets. With
   * either one missing the panel says it is not set up and asks nothing.
   */
  MUSEUM_CF_API_TOKEN?: string;
  MUSEUM_ZONE_TAG?: string;
  /** The museum's host name. Defaults to museumofages.org. */
  MUSEUM_HOST?: string;
  /** The day the museum opened (YYYY-MM-DD, UTC). Totals start there. */
  MUSEUM_OPEN_DATE?: string;
  /** Language codes, comma separated, the root language first. */
  MUSEUM_LANGS?: string;
  /** The walk's stops in their order, comma separated, as the film's files name them. */
  MUSEUM_WALK_STOPS?: string;
}

export interface BatchQueryRequest {
  queries: Array<{ sql: string; dataset: string }>;
}

export interface ServerStatsCache {
  data: { fsn1: unknown; nbg1: unknown } | null;
  at: number;
}
