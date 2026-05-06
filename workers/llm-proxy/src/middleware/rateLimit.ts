// KV-based rate limiting (daily per identity, global daily)
//
// Counters are keyed by JWT subject (UUID v4 from session.ts), NOT by IP.
// This isolates each user/device into their own bucket regardless of how
// many users share a public IP via CGNAT. The legacy IP-keyed counters
// (`rate:ip:...`) are no longer written; existing keys TTL-expire in 24h.

import { RATE_LIMITS, getEffectiveLimit } from '../config';
import type { Env, JWTPayload, RateLimitResult, EndpointRateLimitResult } from '../utils/types';

function getDateKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getDailyResetTime(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

function secondsUntil(isoTimestamp: string): number {
  return Math.max(1, Math.ceil((new Date(isoTimestamp).getTime() - Date.now()) / 1000));
}

/**
 * Check-and-increment against KV. NOT atomic: KV is eventually consistent and
 * has no compare-and-swap, so two concurrent requests from the same identity
 * can both read the same pre-increment value, both pass the check, and both
 * write (value+1). Last-write-wins → the counter undercounts by one and the
 * user gets a free extra hit.
 *
 * Impact per endpoint:
 *   - chat (30/day): ±1-2 over quota under heavy concurrency. Cosmetic.
 *   - council (1/day): up to 2 sessions instead of 1. Noticeable but not exploitable for flooding.
 *   - summary (2/day): similar to council.
 *
 * Proper fix is Durable Objects (one DO per subject+endpoint+day → serialized execution,
 * true atomicity). Deferred post-launch — see PRODUCTION-ROADMAP.md.
 */
export async function checkAndIncrementRateLimit(
  _request: Request,
  env: Env,
  payload: JWTPayload,
): Promise<RateLimitResult> {
  const subject = payload.sub;
  const dateKey = getDateKey();

  const dailyKey = `rate:sub:${subject}:${dateKey}`;
  const globalKey = `global:${dateKey}`;

  const [dailyStr, globalStr] = await Promise.all([
    env.RATE_LIMITS.get(dailyKey),
    env.RATE_LIMITS.get(globalKey),
  ]);

  const dailyUsed = dailyStr ? parseInt(dailyStr, 10) || 0 : 0;
  const globalUsed = globalStr ? parseInt(globalStr, 10) || 0 : 0;
  const dailyLimit = getEffectiveLimit(env, 'chat');
  const resetsAt = getDailyResetTime();
  const retryAfterSeconds = secondsUntil(resetsAt);

  const overPerIdentity = dailyUsed >= dailyLimit;
  const overGlobal = globalUsed >= RATE_LIMITS.GLOBAL_DAILY;
  if (overPerIdentity || overGlobal) {
    return {
      allowed: false,
      daily: { used: dailyUsed, limit: dailyLimit },
      resetsAt,
      retryAfterSeconds,
      // If both are tripped, per-identity wins — the user's personal cap is
      // the more actionable explanation (BYOK fixes it; global cap doesn't).
      reason: overPerIdentity ? 'per_ip' : 'global',
    };
  }

  const dailyCount = dailyUsed + 1;
  const globalCount = globalUsed + 1;

  await Promise.all([
    env.RATE_LIMITS.put(dailyKey, dailyCount.toString(), { expirationTtl: 86400 }),
    env.RATE_LIMITS.put(globalKey, globalCount.toString(), { expirationTtl: 86400 }),
  ]);

  return {
    allowed: true,
    daily: { used: dailyCount, limit: dailyLimit },
    resetsAt,
    retryAfterSeconds,
  };
}

export async function checkAndIncrementCouncilRateLimit(
  _request: Request,
  env: Env,
  payload: JWTPayload,
): Promise<EndpointRateLimitResult> {
  const subject = payload.sub;
  const dateKey = getDateKey();
  const councilKey = `council:sub:${subject}:${dateKey}`;
  const limit = getEffectiveLimit(env, 'council');
  const resetsAt = getDailyResetTime();
  const retryAfterSeconds = secondsUntil(resetsAt);

  const countStr = await env.RATE_LIMITS.get(councilKey);
  const used = countStr ? parseInt(countStr, 10) || 0 : 0;

  if (used >= limit) {
    return { allowed: false, used, limit, resetsAt, retryAfterSeconds };
  }

  const count = used + 1;
  await env.RATE_LIMITS.put(councilKey, count.toString(), { expirationTtl: 86400 });

  return { allowed: true, used: count, limit, resetsAt, retryAfterSeconds };
}

export async function checkAndIncrementSummaryRateLimit(
  _request: Request,
  env: Env,
  payload: JWTPayload,
): Promise<EndpointRateLimitResult> {
  const subject = payload.sub;
  const dateKey = getDateKey();
  const summaryKey = `summary:sub:${subject}:${dateKey}`;
  const limit = getEffectiveLimit(env, 'summary');
  const resetsAt = getDailyResetTime();
  const retryAfterSeconds = secondsUntil(resetsAt);

  const countStr = await env.RATE_LIMITS.get(summaryKey);
  const used = countStr ? parseInt(countStr, 10) || 0 : 0;

  if (used >= limit) {
    return { allowed: false, used, limit, resetsAt, retryAfterSeconds };
  }

  const count = used + 1;
  await env.RATE_LIMITS.put(summaryKey, count.toString(), { expirationTtl: 86400 });

  return { allowed: true, used: count, limit, resetsAt, retryAfterSeconds };
}

/**
 * Read-only quota snapshot for all three endpoints. Used by /v1/quota on app load
 * so the client can correctly gate council/summary buttons before the user tries them.
 */
export async function getQuota(
  _request: Request,
  env: Env,
  payload: JWTPayload,
): Promise<{
  daily: { used: number; limit: number; resetsAt: string };
  council: { used: number; limit: number };
  summary: { used: number; limit: number };
}> {
  const subject = payload.sub;
  const dateKey = getDateKey();
  const resetsAt = getDailyResetTime();

  const [dailyStr, councilStr, summaryStr] = await Promise.all([
    env.RATE_LIMITS.get(`rate:sub:${subject}:${dateKey}`),
    env.RATE_LIMITS.get(`council:sub:${subject}:${dateKey}`),
    env.RATE_LIMITS.get(`summary:sub:${subject}:${dateKey}`),
  ]);

  return {
    daily: {
      used: dailyStr ? parseInt(dailyStr, 10) || 0 : 0,
      limit: getEffectiveLimit(env, 'chat'),
      resetsAt,
    },
    council: {
      used: councilStr ? parseInt(councilStr, 10) || 0 : 0,
      limit: getEffectiveLimit(env, 'council'),
    },
    summary: {
      used: summaryStr ? parseInt(summaryStr, 10) || 0 : 0,
      limit: getEffectiveLimit(env, 'summary'),
    },
  };
}
