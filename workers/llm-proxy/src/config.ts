// Rate limits, model IDs, constants

import type { Env } from './utils/types';

export const RATE_LIMITS = {
  DAILY_PER_IP: 30,
  GLOBAL_DAILY: 15_000,
  COUNCIL_DAILY_PER_IP: 1,
  SUMMARY_DAILY_PER_IP: 2,
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
  // Persona-collapse mitigation for figure impersonation (deep-research-persona-collapse).
  // Applied to /v1/chat only — council/summary keep model defaults.
  DEFAULT_PRESENCE_PENALTY: 1.5,
  MAX_CLIENT_MESSAGES: 100,
  MAX_MESSAGE_CHARS: 4000,
} as const;

// Scope: custom councils only (/v1/council). Curated councils use pre-generated audio.
// System prompt sized to fit moderator + 3 participants × ~11KB formatted voice profiles
// + ~6KB instruction template ≈ 50KB worst case, plus headroom.
export const COUNCIL_LLM_CONFIG = {
  MAX_OUTPUT_TOKENS: 4000,
  DEFAULT_TEMPERATURE: 0.8,
  MAX_SYSTEM_PROMPT_CHARS: 60_000,
  MAX_USER_MESSAGE_CHARS: 2000,
} as const;

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
