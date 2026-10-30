// One-way IP identifiers for counters and compliance logs.
//
// A raw address is never stored: everything that needs to recognise "the same
// caller again" stores a truncated SHA-256 instead (DSGVO Datenminimierung).

import type { CounterWindow } from './counterWindow';
import type { Env } from './types';

/**
 * The salt these hashes are built with. IP_HASH_SALT is the dedicated secret;
 * the JWT key is the fallback so nothing breaks before the secret is set.
 */
export function ipHashSalt(env: Env): string {
  return env.IP_HASH_SALT || env.JWT_SIGNING_KEY;
}

/**
 * Truncated SHA-256 of an address. `scope` keeps unrelated uses from producing
 * the same digest, so a counter key can never be matched against a log entry.
 */
export async function hashIp(ip: string, salt: string, scope: string): Promise<string> {
  const data = new TextEncoder().encode(`${scope}:${ip}:${salt}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .slice(0, 16)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** The caller's address, or null when the edge did not supply one. */
export function readClientIp(request: Request): string | null {
  return request.headers.get('CF-Connecting-IP');
}

/**
 * KV key for a beacon route's per-address flood brake in one counting window.
 * The scope carries the prefix, so one caller's keys on two routes never share
 * a digest. Requests without an edge address share one bucket per route.
 */
export async function beaconLimitKey(
  request: Request,
  env: Env,
  prefix: string,
  window: CounterWindow,
): Promise<string> {
  const ip = readClientIp(request) || 'unknown';
  return `${prefix}:${await hashIp(ip, ipHashSalt(env), `ratelimit:${prefix}`)}:${window.label}`;
}
