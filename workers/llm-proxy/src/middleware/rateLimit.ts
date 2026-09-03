// KV-based rate limiting (daily per identity, per address, global daily)
//
// The quota a visitor feels is keyed by JWT subject (UUID v4 from session.ts),
// NOT by IP. This isolates each user/device into their own bucket regardless of
// how many users share a public IP via CGNAT. The legacy IP-keyed counters
// (`rate:ip:...`) are no longer written; existing keys TTL-expire in 24h.
//
// A far wider per-address ceiling sits beside it. Rotating the UUID resets the
// per-identity bucket, so without this second bucket one machine could mint
// identities all day. Addresses are hashed, never stored (see utils/ipHash.ts).

import { RATE_LIMITS, getEffectiveLimit } from '../config';
import { hashIp, ipHashSalt, readClientIp } from '../utils/ipHash';
import type { Env, JWTPayload, RateLimitResult, EndpointRateLimitResult } from '../utils/types';

function getDateKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Fixed clock-hour window, UTC. Matches the daily key's granularity one level down. */
function getHourKey(): string {
  return new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

function getHourlyResetTime(): string {
  const next = new Date();
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next.toISOString();
}

/** KV key for one address bucket, or null when the edge supplied no address. */
async function ipCounterKey(request: Request, env: Env, prefix: string, window: string): Promise<string | null> {
  const ip = readClientIp(request);
  if (!ip) return null;
  return `${prefix}:${await hashIp(ip, ipHashSalt(env), 'ratelimit')}:${window}`;
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
  request: Request,
  env: Env,
  payload: JWTPayload,
): Promise<RateLimitResult> {
  const subject = payload.sub;
  const dateKey = getDateKey();

  const dailyKey = `rate:sub:${subject}:${dateKey}`;
  const globalKey = `global:${dateKey}`;
  const ipKey = await ipCounterKey(request, env, 'ipcap:chat', dateKey);

  const [dailyStr, globalStr, ipStr] = await Promise.all([
    env.RATE_LIMITS.get(dailyKey),
    env.RATE_LIMITS.get(globalKey),
    ipKey ? env.RATE_LIMITS.get(ipKey) : Promise.resolve(null),
  ]);

  const dailyUsed = dailyStr ? parseInt(dailyStr, 10) || 0 : 0;
  const globalUsed = globalStr ? parseInt(globalStr, 10) || 0 : 0;
  const ipUsed = ipStr ? parseInt(ipStr, 10) || 0 : 0;
  const dailyLimit = getEffectiveLimit(env, 'chat');
  const resetsAt = getDailyResetTime();
  const retryAfterSeconds = secondsUntil(resetsAt);

  const overPerIdentity = dailyUsed >= dailyLimit;
  const overGlobal = globalUsed >= RATE_LIMITS.GLOBAL_DAILY;
  const overIp = ipKey !== null && ipUsed >= RATE_LIMITS.CHAT_DAILY_PER_IP;
  if (overPerIdentity || overGlobal || overIp) {
    return {
      allowed: false,
      // The visitor's own numbers either way: the address ceiling is a brake on
      // rotation, not a quota anyone is meant to read off their screen.
      daily: { used: dailyUsed, limit: dailyLimit },
      resetsAt,
      retryAfterSeconds,
      // If several are tripped, per-identity wins — the user's personal cap is
      // the more actionable explanation (BYOK fixes it; global cap doesn't).
      reason: overPerIdentity ? 'per_ip' : overGlobal ? 'global' : 'ip_ceiling',
    };
  }

  const dailyCount = dailyUsed + 1;
  const globalCount = globalUsed + 1;

  await Promise.all([
    env.RATE_LIMITS.put(dailyKey, dailyCount.toString(), { expirationTtl: 86400 }),
    env.RATE_LIMITS.put(globalKey, globalCount.toString(), { expirationTtl: 86400 }),
    ipKey
      ? env.RATE_LIMITS.put(ipKey, (ipUsed + 1).toString(), { expirationTtl: 86400 })
      : Promise.resolve(),
  ]);

  return {
    allowed: true,
    daily: { used: dailyCount, limit: dailyLimit },
    resetsAt,
    retryAfterSeconds,
  };
}

/**
 * Per-address ceiling on session minting. Counted per clock hour, before the
 * Turnstile call, so a flood is refused without paying for a verification.
 * Returns allowed=true unmodified when the edge supplied no address.
 */
export async function checkAndIncrementSessionRateLimit(
  request: Request,
  env: Env,
): Promise<EndpointRateLimitResult> {
  const hourKey = getHourKey();
  const limit = RATE_LIMITS.SESSION_HOURLY_PER_IP;
  const resetsAt = getHourlyResetTime();
  const retryAfterSeconds = secondsUntil(resetsAt);

  const key = await ipCounterKey(request, env, 'ipcap:session', hourKey);
  if (!key) return { allowed: true, used: 0, limit, resetsAt, retryAfterSeconds };

  const raw = await env.RATE_LIMITS.get(key);
  const used = raw ? parseInt(raw, 10) || 0 : 0;
  if (used >= limit) {
    return { allowed: false, used, limit, resetsAt, retryAfterSeconds };
  }

  const count = used + 1;
  await env.RATE_LIMITS.put(key, count.toString(), { expirationTtl: 3600 });
  return { allowed: true, used: count, limit, resetsAt, retryAfterSeconds };
}

export async function checkAndIncrementCouncilRateLimit(
  _request: Request,
  env: Env,
  payload: JWTPayload,
): Promise<EndpointRateLimitResult> {
  const subject = payload.sub;
  const dateKey = getDateKey();
  const councilKey = `council:sub:${subject}:${dateKey}`;
  const globalKey = `global:council:${dateKey}`;
  const limit = getEffectiveLimit(env, 'council');
  const resetsAt = getDailyResetTime();
  const retryAfterSeconds = secondsUntil(resetsAt);

  const [countStr, globalStr] = await Promise.all([
    env.RATE_LIMITS.get(councilKey),
    env.RATE_LIMITS.get(globalKey),
  ]);
  const used = countStr ? parseInt(countStr, 10) || 0 : 0;
  const globalUsed = globalStr ? parseInt(globalStr, 10) || 0 : 0;

  // Per-identity caps alone don't bound spend here: /v1/session mints a JWT
  // for any Turnstile solve with a client-supplied UUID, so identity rotation
  // resets them. The global brake is the backstop (see config.ts for sizing).
  if (used >= limit || globalUsed >= RATE_LIMITS.GLOBAL_COUNCIL_DAILY) {
    return { allowed: false, used, limit, resetsAt, retryAfterSeconds };
  }

  const count = used + 1;
  await Promise.all([
    env.RATE_LIMITS.put(councilKey, count.toString(), { expirationTtl: 86400 }),
    env.RATE_LIMITS.put(globalKey, (globalUsed + 1).toString(), { expirationTtl: 86400 }),
  ]);

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
  const globalKey = `global:summary:${dateKey}`;
  const limit = getEffectiveLimit(env, 'summary');
  const resetsAt = getDailyResetTime();
  const retryAfterSeconds = secondsUntil(resetsAt);

  const [countStr, globalStr] = await Promise.all([
    env.RATE_LIMITS.get(summaryKey),
    env.RATE_LIMITS.get(globalKey),
  ]);
  const used = countStr ? parseInt(countStr, 10) || 0 : 0;
  const globalUsed = globalStr ? parseInt(globalStr, 10) || 0 : 0;

  // Same identity-rotation backstop as council (see comment there).
  if (used >= limit || globalUsed >= RATE_LIMITS.GLOBAL_SUMMARY_DAILY) {
    return { allowed: false, used, limit, resetsAt, retryAfterSeconds };
  }

  const count = used + 1;
  await Promise.all([
    env.RATE_LIMITS.put(summaryKey, count.toString(), { expirationTtl: 86400 }),
    env.RATE_LIMITS.put(globalKey, (globalUsed + 1).toString(), { expirationTtl: 86400 }),
  ]);

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
