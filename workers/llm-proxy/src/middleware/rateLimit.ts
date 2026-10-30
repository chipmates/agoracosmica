// KV-based rate limiting (daily per identity, per address, global daily)
//
// The quota a visitor feels is keyed by JWT subject (UUID v4 from session.ts),
// NOT by IP. This isolates each user/device into their own bucket regardless of
// how many users share a public IP via CGNAT. The legacy IP-keyed counters
// (`rate:ip:...`) are no longer written or read.
//
// A far wider per-address ceiling sits beside it. Rotating the UUID resets the
// per-identity bucket, so without this second bucket one machine could mint
// identities all day. Addresses are hashed, never stored (see utils/ipHash.ts).
//
// Every key that holds an identity or an address hash names its UTC day or
// clock hour and expires with it (utils/counterWindow.ts).

import { RATE_LIMITS, getEffectiveLimit } from '../config';
import { hashIp, ipHashSalt, readClientIp } from '../utils/ipHash';
import { putForWindow, utcDay, utcHour, type CounterWindow } from '../utils/counterWindow';
import type { Env, JWTPayload, RateLimitResult, EndpointRateLimitResult } from '../utils/types';

/** KV key for one address bucket, or null when the edge supplied no address. */
async function ipCounterKey(request: Request, env: Env, prefix: string, window: string): Promise<string | null> {
  const ip = readClientIp(request);
  if (!ip) return null;
  return `${prefix}:${await hashIp(ip, ipHashSalt(env), 'ratelimit')}:${window}`;
}

function resetTime(window: CounterWindow): string {
  return new Date(window.endMs).toISOString();
}

function secondsUntil(isoTimestamp: string): number {
  return Math.max(1, Math.ceil((new Date(isoTimestamp).getTime() - Date.now()) / 1000));
}

/**
 * Write a brake counter without failing the request. KV refuses a second
 * write to one key within a second (a 429 that throws). A global key takes
 * every visitor's write and an address key every request from one address
 * (a school, an office, a carrier's NAT, one page's beacons); a missed
 * increment only undercounts the brake.
 */
async function putBrakeCounter(kind: 'Global' | 'Address', write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch {
    console.warn(`[RateLimit] ${kind} counter write failed, request served`);
  }
}

/** An address brake's count, in its window's key and ending with it. */
export function putAddressCounter(env: Env, key: string, value: number, window: CounterWindow): Promise<void> {
  return putBrakeCounter('Address', () => putForWindow(env.RATE_LIMITS, key, String(value), window));
}

/** A global key holds no identifier, so it keeps its renewed 24-hour TTL. */
function putGlobalCounter(env: Env, key: string, value: number): Promise<void> {
  return putBrakeCounter('Global', () => env.RATE_LIMITS.put(key, value.toString(), { expirationTtl: 86400 }));
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
 * The proper fix is Durable Objects (one DO per subject+endpoint+day → serialized
 * execution, true atomicity), not built yet.
 */
export async function checkAndIncrementRateLimit(
  request: Request,
  env: Env,
  payload: JWTPayload,
): Promise<RateLimitResult> {
  const subject = payload.sub;
  const day = utcDay();

  const dailyKey = `rate:sub:${subject}:${day.label}`;
  const globalKey = `global:${day.label}`;
  const ipKey = await ipCounterKey(request, env, 'ipcap:chat', day.label);

  const [dailyStr, globalStr, ipStr] = await Promise.all([
    env.RATE_LIMITS.get(dailyKey),
    env.RATE_LIMITS.get(globalKey),
    ipKey ? env.RATE_LIMITS.get(ipKey) : Promise.resolve(null),
  ]);

  const dailyUsed = dailyStr ? parseInt(dailyStr, 10) || 0 : 0;
  const globalUsed = globalStr ? parseInt(globalStr, 10) || 0 : 0;
  const ipUsed = ipStr ? parseInt(ipStr, 10) || 0 : 0;
  const dailyLimit = getEffectiveLimit(env, 'chat');
  const resetsAt = resetTime(day);
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
    putForWindow(env.RATE_LIMITS, dailyKey, dailyCount.toString(), day),
    putGlobalCounter(env, globalKey, globalCount),
    ipKey ? putAddressCounter(env, ipKey, ipUsed + 1, day) : Promise.resolve(),
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
  const hour = utcHour();
  const limit = RATE_LIMITS.SESSION_HOURLY_PER_IP;
  const resetsAt = resetTime(hour);
  const retryAfterSeconds = secondsUntil(resetsAt);

  const key = await ipCounterKey(request, env, 'ipcap:session', hour.label);
  if (!key) return { allowed: true, used: 0, limit, resetsAt, retryAfterSeconds };

  const raw = await env.RATE_LIMITS.get(key);
  const used = raw ? parseInt(raw, 10) || 0 : 0;
  if (used >= limit) {
    return { allowed: false, used, limit, resetsAt, retryAfterSeconds };
  }

  const count = used + 1;
  await putAddressCounter(env, key, count, hour);
  return { allowed: true, used: count, limit, resetsAt, retryAfterSeconds };
}

export async function checkAndIncrementCouncilRateLimit(
  _request: Request,
  env: Env,
  payload: JWTPayload,
): Promise<EndpointRateLimitResult> {
  const subject = payload.sub;
  const day = utcDay();
  const councilKey = `council:sub:${subject}:${day.label}`;
  const globalKey = `global:council:${day.label}`;
  const limit = getEffectiveLimit(env, 'council');
  const resetsAt = resetTime(day);
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
    putForWindow(env.RATE_LIMITS, councilKey, count.toString(), day),
    putGlobalCounter(env, globalKey, globalUsed + 1),
  ]);

  return { allowed: true, used: count, limit, resetsAt, retryAfterSeconds };
}

/**
 * Summaries one identity may get back a day. Every reservation reaches the
 * model, so this bounds one identity at the daily limit plus this many model
 * calls, however often it leaves before the first byte.
 */
export const SUMMARY_GIVEBACKS_DAILY = 2;

/**
 * The identity's summary keys for one day. The counter only ever rises (each
 * reservation) and the give-back key only ever rises (each summary given
 * back), so neither writer can overwrite the other's count.
 */
function summaryKeys(subject: string, day: CounterWindow): { key: string; backKey: string; day: CounterWindow } {
  return {
    key: `summary:sub:${subject}:${day.label}`,
    backKey: `summary:back:sub:${subject}:${day.label}`,
    day,
  };
}

const readCount = (raw: string | null): number => (raw ? parseInt(raw, 10) || 0 : 0);

/** A summary check's result, with the visitor's keys and their day for giving the summary back. */
export interface SummaryRateLimitResult extends EndpointRateLimitResult {
  key: string;
  backKey: string;
  day: CounterWindow;
}

export async function checkAndIncrementSummaryRateLimit(
  _request: Request,
  env: Env,
  payload: JWTPayload,
): Promise<SummaryRateLimitResult> {
  const day = utcDay();
  const keys = summaryKeys(payload.sub, day);
  const globalKey = `global:summary:${day.label}`;
  const limit = getEffectiveLimit(env, 'summary');
  const resetsAt = resetTime(day);
  const retryAfterSeconds = secondsUntil(resetsAt);

  const [countStr, backStr, globalStr] = await Promise.all([
    env.RATE_LIMITS.get(keys.key),
    env.RATE_LIMITS.get(keys.backKey),
    env.RATE_LIMITS.get(globalKey),
  ]);
  const reserved = readCount(countStr);
  const used = Math.max(0, reserved - readCount(backStr));
  const globalUsed = readCount(globalStr);

  // Same identity-rotation backstop as council (see comment there).
  if (used >= limit || globalUsed >= RATE_LIMITS.GLOBAL_SUMMARY_DAILY) {
    return { allowed: false, used, limit, resetsAt, retryAfterSeconds, ...keys };
  }

  await Promise.all([
    putForWindow(env.RATE_LIMITS, keys.key, String(reserved + 1), day),
    putGlobalCounter(env, globalKey, globalUsed + 1),
  ]);

  return { allowed: true, used: used + 1, limit, resetsAt, retryAfterSeconds, ...keys };
}

/**
 * Give back one summary that was counted but never delivered, while the
 * identity has give-backs left today; past them the summary stays spent. A
 * refused write is logged by its kind and that summary stays spent. The
 * global brake keeps its count: the model may have read the history before
 * the visitor left. Once the reservation's day is over nothing reads its keys
 * again, so nothing is written.
 */
export async function giveBackSummary(
  env: Env,
  counted: Pick<SummaryRateLimitResult, 'key' | 'backKey' | 'day'>,
): Promise<void> {
  if (Date.now() >= counted.day.endMs) return;
  try {
    const [countStr, backStr] = await Promise.all([
      env.RATE_LIMITS.get(counted.key),
      env.RATE_LIMITS.get(counted.backKey),
    ]);
    const back = readCount(backStr);
    if (readCount(countStr) <= back) return;
    if (back >= SUMMARY_GIVEBACKS_DAILY) {
      console.log('[RateLimit] Summary give-backs spent for today, the summary stays spent');
      return;
    }
    await putForWindow(env.RATE_LIMITS, counted.backKey, String(back + 1), counted.day);
  } catch (err) {
    const kind = err instanceof Error ? err.name : typeof err;
    console.warn(`[RateLimit] Summary give-back failed (${kind}), the summary stays spent`);
  }
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
  const day = utcDay();
  const resetsAt = resetTime(day);
  const summary = summaryKeys(subject, day);

  const [dailyStr, councilStr, summaryStr, summaryBackStr] = await Promise.all([
    env.RATE_LIMITS.get(`rate:sub:${subject}:${day.label}`),
    env.RATE_LIMITS.get(`council:sub:${subject}:${day.label}`),
    env.RATE_LIMITS.get(summary.key),
    env.RATE_LIMITS.get(summary.backKey),
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
      used: Math.max(0, readCount(summaryStr) - readCount(summaryBackStr)),
      limit: getEffectiveLimit(env, 'summary'),
    },
  };
}
