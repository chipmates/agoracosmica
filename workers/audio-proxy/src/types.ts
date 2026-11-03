export interface Env {
  RATE_LIMITS: KVNamespace;
  ANALYTICS: AnalyticsEngineDataset;
  /** Media bucket holding the prerecorded story audio and transcripts. */
  STORY_BUCKET: R2Bucket;
  ALLOWED_ORIGINS: string;
  /** Key for the archive quota's address hash. Unset falls back to an unkeyed hash. */
  IP_HASH_SALT?: string;
}
