// Map structured/unstructured errors from the LLM stack to a user-facing
// localized toast string. Single source of truth for "what does this failure
// mean to the user". Branches by FreeTierError (worker), LLMApiError (BYOK),
// or plain Error message-match for client-side timeouts/network issues.

import { FreeTierError } from '../proxy/freeTierAdapter';
import { LLMApiError } from './llmService';

type TStringFn = (key: string, fallback?: string) => string;

const KEY = 'errors.conversation';

/**
 * Convert any error thrown from the conversation streaming pipeline into a
 * localized, user-friendly message. Keep this pure — UI-side decisions
 * (whether to show a modal, route to BYOK, etc.) live at the call site.
 */
export function mapErrorToUserMessage(error: unknown, tString: TStringFn): string {
  // ── Structured worker errors (free-tier path) ───────────────────────────
  if (error instanceof FreeTierError) {
    if (error.status === 400) {
      const msg = error.message.toLowerCase();
      if (msg.includes('character limit') || msg.includes('too long')) {
        return tString(`${KEY}.messageTooLong`);
      }
      if (msg.includes('maximum') && msg.includes('message')) {
        return tString(`${KEY}.tooManyMessages`);
      }
      // Other 400s (bad figureId, bad mode, malformed seedData) — generic.
      return tString(`${KEY}.generic`);
    }

    if (error.status === 422) {
      // reason format: 'content_safety:crisis' | 'content_safety:policy'
      if (error.reason === 'content_safety:crisis') {
        return tString(`${KEY}.contentSafetyCrisis`);
      }
      if (error.reason?.startsWith('content_safety')) {
        return tString(`${KEY}.contentSafety`);
      }
      return tString(`${KEY}.generic`);
    }

    if (error.status === 429) {
      if (error.reason === 'global') {
        return tString(`${KEY}.freeTierAtCapacity`);
      }
      // Per-identity daily limit also opens a modal — the toast is a backup.
      return tString(`${KEY}.dailyLimit`);
    }

    if (error.status === 502 || error.status === 503) {
      return tString(`${KEY}.llmDown`);
    }

    // Other worker statuses (500, etc.) fall through.
    return tString(`${KEY}.generic`);
  }

  // ── BYOK errors (OpenRouter via llmService) ─────────────────────────────
  if (error instanceof LLMApiError) {
    if (error.status === 401) return tString(`${KEY}.byokInvalidKey`);
    if (error.status === 402) return tString(`${KEY}.byokInsufficientCredits`);
    // 404 = the requested model id is gone (e.g. OpenRouter retired the pinned
    // default). Generic "try again" would loop forever; point at model choice.
    if (error.status === 404) return tString(`${KEY}.byokModelNotFound`);
    if (error.status === 429) return tString(`${KEY}.llmRateLimited`);
    if (error.status === 503) return tString(`${KEY}.llmDown`);
    return tString(`${KEY}.generic`);
  }

  // ── Plain Error (timeouts, network) ─────────────────────────────────────
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Turnstile script blocked (uBlock/Brave-strict block challenges.cloudflare.com).
    // Must come before the generic timeout branch: a blocked script also times
    // out, and the generic message sends users into a hopeless retry loop.
    if (msg.includes('turnstile') && (msg.includes('script') || msg.includes('load'))) {
      return tString(`${KEY}.securityCheckBlocked`);
    }
    if (msg.includes('timed out') || msg.includes('timeout')) {
      return tString(`${KEY}.timeout`);
    }
    if (msg.includes('failed to fetch') || msg.includes('network')) {
      return tString(`${KEY}.network`);
    }
  }

  return tString(`${KEY}.generic`);
}
