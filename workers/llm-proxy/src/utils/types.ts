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
  // Dev-only: when set in .dev.vars, overrides every per-IP daily cap (chat/council/summary)
  // to this integer. Never defined in production wrangler.toml. See config.ts:getEffectiveLimit.
  DEV_RATE_LIMIT?: string;
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
  reason?: 'per_ip' | 'global'; // set when allowed=false
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
