// Rate limits, model IDs, constants

import type { Env } from './utils/types';

export const RATE_LIMITS = {
  DAILY_PER_IP: 30,
  GLOBAL_DAILY: 15_000,
  COUNCIL_DAILY_PER_IP: 1,
  SUMMARY_DAILY_PER_IP: 2,
  // Second bucket beside the per-identity one, keyed by hashed IP. Sized ten
  // identities wide so shared-exit users never meet it while identity rotation
  // from one address stops at the eleventh fresh UUID.
  CHAT_DAILY_PER_IP: 300,
  // Session mints per IP per clock hour. A mint is a Turnstile solve plus a
  // JWT, so this bounds how fast one address can manufacture identities.
  SESSION_HOURLY_PER_IP: 120,
  // Emergency brakes, not throttles: sized ~1000x current organic volume so no
  // real user can ever hit them (council is 1/day per identity, so tripping
  // the brake organically needs 1000 distinct users in one day). They exist
  // only to bound the spend of identity-rotation abuse on the two most
  // expensive endpoints. Separate counters so an attack on one endpoint can
  // never block legitimate users of another.
  GLOBAL_COUNCIL_DAILY: 1_000,
  GLOBAL_SUMMARY_DAILY: 2_000,
} as const;

export type RateLimitEndpoint = 'chat' | 'council' | 'summary';

// Returns the effective per-IP daily cap for an endpoint.
// When `DEV_RATE_LIMIT` is set in .dev.vars, ALL endpoints use that value — lets us
// burn through the cap in one message to test BYOK locally. Production wrangler.toml
// never defines this var, so production always uses the RATE_LIMITS constants.
export function getEffectiveLimit(env: Env, endpoint: RateLimitEndpoint): number {
  if (env.DEV_RATE_LIMIT !== undefined) {
    const n = parseInt(env.DEV_RATE_LIMIT, 10);
    if (!isNaN(n) && n >= 0) return n;
  }
  switch (endpoint) {
    case 'chat': return RATE_LIMITS.DAILY_PER_IP;
    case 'council': return RATE_LIMITS.COUNCIL_DAILY_PER_IP;
    case 'summary': return RATE_LIMITS.SUMMARY_DAILY_PER_IP;
  }
}

export const LLM_CONFIG = {
  MAX_OUTPUT_TOKENS: 1500,
  DEFAULT_TEMPERATURE: 1,
  MAX_CLIENT_MESSAGES: 100,
  MAX_MESSAGE_CHARS: 4000,
} as const;

// Scope: custom councils only (/v1/council). Curated councils use pre-generated audio.
// The cap counts the CLIENT-supplied systemPrompt alone (UTF-16 code units), not
// the safety preamble the worker prepends. German voice profiles run ~3KB longer
// per roster than English and the widest measured German council reaches ~59.5KB,
// so 60,000 left under 1% headroom; 90,000 keeps a wordier roster inside the cap
// and still bounds a single council's input cost to fractions of a cent.
export const COUNCIL_LLM_CONFIG = {
  MAX_OUTPUT_TOKENS: 4000,
  DEFAULT_TEMPERATURE: 0.8,
  MAX_SYSTEM_PROMPT_CHARS: 90_000,
  MAX_USER_MESSAGE_CHARS: 2000,
} as const;

// Free-tier serving models. Which one answers is a deployment variable
// (FREE_TIER_MODEL), never a code edit, so the switch arms and reverts without
// a rebuild. BYOK requests never reach this worker.
export type ServingModelKey = 'qwen3-235b' | 'dsv4-pro';

/** Provider region a model is served from. The client turns it into a place name. */
export type ServingRegion = 'eu-north1' | 'uk-south1';

export interface ServingModel {
  key: ServingModelKey;
  /** Nebius model id. */
  id: string;
  /** Machine-readable model label for the EU AI Act Art. 50(2) header. */
  disclosureLabel: string;
  /** Stable identifier the client translates into a display name. */
  label: string;
  /** Human name for operator messages, which are never translated. */
  displayName: string;
  /** Where the provider serves this model. Shown to the user, so it must be exact. */
  region: ServingRegion;
  /** presence_penalty on /v1/chat. Persona-collapse mitigation, tuned per model. */
  chatPresencePenalty: number;
  /** Extra top-level request fields, e.g. the reasoning switch. */
  extras: Record<string, unknown>;
  /** Nebius list price in USD per 1M tokens. Feeds the spend governor. */
  pricePer1M: { input: number; output: number };
  /** Whether this model's token spend counts against the governor. */
  metered: boolean;
}

export const SERVING_MODELS: Record<ServingModelKey, ServingModel> = {
  'qwen3-235b': {
    key: 'qwen3-235b',
    id: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    disclosureLabel: 'Qwen3-235B-A22B-Instruct',
    label: 'qwen3-235b',
    displayName: 'Qwen3 235B',
    region: 'eu-north1',
    chatPresencePenalty: 1.5,
    extras: {},
    pricePer1M: { input: 0.087, output: 0.35 },
    metered: false,
  },
  'dsv4-pro': {
    key: 'dsv4-pro',
    // Nebius publishes no dated snapshot for V4 Pro, so this alias is what the
    // evaluation ran against. NEBIUS_MODEL_PRO pins a dated id the day one exists.
    id: 'deepseek-ai/DeepSeek-V4-Pro',
    disclosureLabel: 'DeepSeek-V4-Pro',
    label: 'deepseek-v4-pro',
    displayName: 'DeepSeek V4 Pro',
    region: 'uk-south1',
    // The 1.5 penalty is Qwen-tuned and degrades this model.
    chatPresencePenalty: 0,
    // Reasoning is on by default here; without the switch, thinking tags leak
    // into councils. thinking:{type:"disabled"} does not work on this endpoint.
    extras: { chat_template_kwargs: { thinking: false } },
    pricePer1M: { input: 1.75, output: 3.5 },
    metered: true,
  },
};

// Daily spend ceiling for the metered model, counted from real token usage at
// Nebius list price. Hard cap serves the unmetered fallback for the rest of the
// day (yesterday's quality, not an outage); the soft alert only reports.
//
// The two figures are deployment values (GOVERNOR_HARD_USD, GOVERNOR_SOFT_USD),
// so they live in one place and can move from wrangler.toml to a secret without
// a code change. The constants below are only the floor for a deployment that
// defines neither: deliberately low, so a missing var costs a day of model
// quality rather than budget.
export const SPEND_GOVERNOR = {
  FLOOR_HARD_CAP_USD: 1,
  FLOOR_SOFT_ALERT_USD: 0.5,
  /** Counter day boundary. Matches the operating timezone, not UTC. */
  TIMEZONE: 'Europe/Berlin',
  /** Two days, so a counter key outlives the day it belongs to. */
  COUNTER_TTL_SECONDS: 172_800,
} as const;

// Operator alerts for the free-tier switch, pushed to Telegram beside the
// stats rows. The two daily events are already written once a day, so only the
// availability events need collapsing: one message per event type per window,
// which keeps a provider wobble from filling the chat.
export const TELEGRAM_ALERTS = {
  FALLBACK_WINDOW_SECONDS: 600,
} as const;

/** Positive finite USD amount from a var, or the floor when it is absent or junk. */
function usdVar(raw: string | undefined, floor: number): number {
  if (raw === undefined) return floor;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : floor;
}

export function governorHardCapUsd(env: Env): number {
  return usdVar(env.GOVERNOR_HARD_USD, SPEND_GOVERNOR.FLOOR_HARD_CAP_USD);
}

export function governorSoftAlertUsd(env: Env): number {
  return usdVar(env.GOVERNOR_SOFT_USD, SPEND_GOVERNOR.FLOOR_SOFT_ALERT_USD);
}

// First-token deadline before a request is re-issued on the fallback model.
// Measured first-chunk latency is ~1.2s, so 5s is a stall rather than a slow turn.
export const TTFT_FALLBACK_MS = 5_000;

export const JWT_CONFIG = {
  EXPIRY_SECONDS: 600, // 10 minutes — client auto-refreshes 5min before expiry (sessionManager.ts)
} as const;

export const VALID_MODES = [
  'free_conversation',
  'seed_conversation',
  'seed_challenge',
] as const;

export const VALID_FIGURES = [
  'angelou', 'aurelius', 'austen', 'beauvoir', 'bingen',
  'blake', 'campbell', 'dickinson', 'eckhart', 'einstein',
  'galilei', 'gandhi', 'gautama', 'goethe', 'jung',
  'kahlo', 'king', 'laozi', 'lovelace', 'mandela',
  'mozart', 'nietzsche', 'plato', 'rumi', 'schopenhauer',
  'shakespeare', 'tubman', 'vinci', 'woolf', 'zenji',
] as const;

// Only award_seed is allowed through the proxy
export const ALLOWED_TOOLS = ['award_seed'] as const;

// Server-side tool definition (replaces client-supplied schemas)
export const AWARD_SEED_TOOL = {
  type: 'function' as const,
  function: {
    name: 'award_seed',
    description:
      'Award or deny a seed to the seeker based on their demonstrated understanding during the quest examination. Call this after delivering your spoken verdict.',
    parameters: {
      type: 'object',
      properties: {
        passed: {
          type: 'boolean',
          description:
            'true if the seeker demonstrated genuine understanding, false otherwise',
        },
        seedTitle: {
          type: 'string',
          description: 'The exact title of the seed being examined',
        },
      },
      required: ['passed', 'seedTitle'],
    },
  },
};
