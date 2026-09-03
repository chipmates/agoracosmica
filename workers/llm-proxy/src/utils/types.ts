// TypeScript interfaces for the free-tier LLM proxy

export interface Env {
  RATE_LIMITS: KVNamespace;
  COMPLIANCE_LOG: KVNamespace;
  SESSION_LAST_SEEN: KVNamespace;
  ANALYTICS: AnalyticsEngineDataset;
  NEBIUS_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  JWT_SIGNING_KEY: string;
  ALLOWED_ORIGINS: string;
  NEBIUS_MODEL: string;
  NEBIUS_BASE_URL: string;
  // Which model the free tier asks first. "deepseek" arms the switch; unset or
  // anything else serves NEBIUS_MODEL, which is also the fallback either way.
  // See services/modelRouting.ts.
  FREE_TIER_MODEL?: string;
  // Optional id override for the armed model, so a dated snapshot can be pinned
  // without a rebuild. Unset uses the id in config.ts:SERVING_MODELS.
  NEBIUS_MODEL_PRO?: string;
  // Daily spend ceiling and soft-alert threshold for the metered model, in USD.
  // Deployment values (wrangler.toml [vars], or secrets later) so the figures
  // live in one place. Unset falls back to the floor in config.ts.
  GOVERNOR_HARD_USD?: string;
  GOVERNOR_SOFT_USD?: string;
  // Dedicated salt for one-way IP identifiers. Falls back to JWT_SIGNING_KEY
  // when unset. See utils/ipHash.ts.
  IP_HASH_SALT?: string;
  // Operator alerts on the free-tier switch. The token is a secret, the chat id
  // a var. Without both, services/telegram.ts sends nothing and says nothing.
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  // Dev-only: when set in .dev.vars, overrides every per-IP daily cap (chat/council/summary)
  // to this integer. Never defined in production wrangler.toml. See config.ts:getEffectiveLimit.
  DEV_RATE_LIMIT?: string;
  // Google Ads Conversion API auth chain. All optional — when GOOGLE_ADS_DEVELOPER_TOKEN
  // is absent, the worker no-ops on CAPI forwarding (events still get captured to KV +
  // Analytics Engine, just not pushed to Google). See services/googleAdsCapi.ts.
  GOOGLE_ADS_DEVELOPER_TOKEN?: string;
  GOOGLE_ADS_OAUTH_CLIENT_ID?: string;
  GOOGLE_ADS_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_ADS_OAUTH_REFRESH_TOKEN?: string;
  GOOGLE_ADS_LOGIN_CUSTOMER_ID?: string; // MCC customer ID for the login-customer-id header, digits only, no dashes

  // Per-event conversion values. Stored as wrangler secrets, never in the
  // public repo. When unset, the worker forwards conversion_value: 0 which
  // Google Ads accepts but won't use for value-based bidding.
  VALUE_PROFILE_CREATED?: string;
  VALUE_START_EXPLORING?: string;
  VALUE_MODE_SELECTED?: string;
  VALUE_COUNCIL_ENGAGED?: string;
  VALUE_LISTENED?: string;
  VALUE_DIALOGUE_STARTED?: string;
  VALUE_CONVERSATION_DEEPENED?: string;
}

export interface ChatRequest {
  figureId: string;
  mode: 'free_conversation' | 'seed_conversation' | 'seed_challenge';
  language: string;
  messages: ChatMessage[];
  seedId?: string;
  seedData?: Record<string, unknown>;
  tools?: ToolDefinition[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface CouncilRequest {
  systemPrompt: string;
  language: string;
  messages: ChatMessage[];
}

export interface SessionRequest {
  turnstileToken: string;
  clientId?: string; // Optional UUID v4; if absent or invalid, server mints a fresh one
}

export interface SessionResponse {
  token: string;
  expiresAt: string;
  clientId: string; // Client persists this in localStorage and sends back on next /v1/session
}

export interface JWTPayload {
  // Per-identity UUID v4 (new). Legacy tokens carry a 32-char hashed IP — both forms accepted.
  sub: string;
  iat: number;
  exp: number;
}

export interface RateLimitResult {
  allowed: boolean;
  daily: { used: number; limit: number };
  resetsAt: string; // ISO timestamp of daily reset
  retryAfterSeconds: number; // seconds until resetsAt (for Retry-After header)
  // Set when allowed=false. 'per_ip' is the per-identity bucket (legacy name,
  // kept because the client branches on it); 'ip_ceiling' is the per-IP bucket.
  reason?: 'per_ip' | 'global' | 'ip_ceiling';
}

export interface EndpointRateLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
  resetsAt: string;
  retryAfterSeconds: number;
}

export interface QuotaResponse {
  daily: { used: number; limit: number; resetsAt: string };
}
