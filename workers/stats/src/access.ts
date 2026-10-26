// The worker's own check of Cloudflare Access: every request must carry the
// Access JWT (Cf-Access-Jwt-Assertion), signed RS256 by one of the team's
// published keys, for this application's audience, from the team's issuer and
// inside its lifetime. A policy change in the dashboard alone cannot open the
// routes. ACCESS_TEAM_DOMAIN and ACCESS_AUD are secrets; while either is
// missing, nothing passes.

import type { Env } from './types';

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export const ACCESS_HEADER = 'Cf-Access-Jwt-Assertion';
// Leeway for the clocks of Access and this worker.
const SKEW_S = 60;
const KEYS_TTL_MS = 3600 * 1000;
// An unknown key id asks for the key set again at most this often.
const REFETCH_GAP_MS = 30 * 1000;
// Access tokens run to about 1 KB; anything far larger is not one.
const MAX_TOKEN_CHARS = 8192;

const TEAM = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/;

/** The issuer, https://<team>.cloudflareaccess.com, or null when the value has another shape. */
export function teamIssuer(raw: string | undefined): string | null {
  const host = (raw || '').trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/+$/, '');
  return TEAM.test(host) ? 'https://' + host : null;
}

// fetchedAt: the last answer with keys, for their lifetime; triedAt: the last ask, for the gap.
interface KeySet { keys: Map<string, CryptoKey>; fetchedAt: number; triedAt: number }

const sets = new Map<string, KeySet>();
const pending = new Map<string, Promise<KeySet>>();

/** For tests: forget every fetched key. */
export function forgetAccessKeys(): void {
  sets.clear();
  pending.clear();
}

async function fetchKeys(issuer: string, fetcher: Fetcher): Promise<Map<string, CryptoKey> | null> {
  try {
    const res = await fetcher(issuer + '/cdn-cgi/access/certs', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      void res.body?.cancel().catch(() => {});
      console.error('[access] key set answered ' + res.status);
      return null;
    }
    const body = (await res.json()) as { keys?: unknown };
    const keys = new Map<string, CryptoKey>();
    for (const k of Array.isArray(body.keys) ? body.keys : []) {
      const jwk = k as JsonWebKey & { kid?: unknown };
      if (!jwk || jwk.kty !== 'RSA' || typeof jwk.kid !== 'string' || typeof jwk.n !== 'string' || typeof jwk.e !== 'string') continue;
      if (jwk.alg !== undefined && jwk.alg !== 'RS256') continue;
      if (jwk.use !== undefined && jwk.use !== 'sig') continue;
      try {
        keys.set(jwk.kid, await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
      } catch { /* a key that does not import is left out */ }
    }
    return keys;
  } catch (err) {
    console.error('[access] key set unreachable:', err instanceof Error ? err.name : 'error');
    return null;
  }
}

/** One fetch in flight per issuer; a failed fetch keeps the keys already held. */
function refresh(issuer: string, fetcher: Fetcher): Promise<KeySet> {
  let job = pending.get(issuer);
  if (!job) {
    job = fetchKeys(issuer, fetcher).then((keys) => {
      pending.delete(issuer);
      const now = Date.now();
      const set = keys ? { keys, fetchedAt: now, triedAt: now } : sets.get(issuer) || { keys: new Map(), fetchedAt: 0, triedAt: now };
      set.triedAt = now;
      sets.set(issuer, set);
      return set;
    });
    pending.set(issuer, job);
  }
  return job;
}

async function keyFor(issuer: string, kid: string, fetcher: Fetcher): Promise<CryptoKey | null> {
  const now = Date.now();
  let set = sets.get(issuer);
  // an old set or an unknown key id (a rotation) asks again, never more often than the gap
  const stale = !set || now - set.fetchedAt > KEYS_TTL_MS || !set.keys.has(kid);
  if (stale && (!set || now - set.triedAt >= REFETCH_GAP_MS)) set = await refresh(issuer, fetcher);
  return (set && set.keys.get(kid)) || null;
}

function base64url(part: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(part) || part.length % 4 === 1) return null;
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (part.length % 4)) % 4);
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function jsonPart(part: string): Record<string, unknown> | null {
  const bytes = base64url(part);
  if (!bytes) return null;
  try {
    const v = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Null when the request carries a valid Access JWT for this application, else the reason (for the log only). */
export async function accessRefusal(request: Request, env: Env, fetcher: Fetcher = (u, i) => fetch(u, i)): Promise<string | null> {
  const issuer = teamIssuer(env.ACCESS_TEAM_DOMAIN);
  const audience = (env.ACCESS_AUD || '').trim();
  if (!issuer || !audience) return 'not configured';
  const token = request.headers.get(ACCESS_HEADER) || '';
  if (!token) return 'no token';
  if (token.length > MAX_TOKEN_CHARS) return 'malformed';
  const parts = token.split('.');
  if (parts.length !== 3) return 'malformed';
  const header = jsonPart(parts[0]);
  const claims = jsonPart(parts[1]);
  const signature = base64url(parts[2]);
  if (!header || !claims || !signature) return 'malformed';
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) return 'algorithm';

  // claims first: they cost nothing, and a stale or foreign token never triggers a key fetch
  if (claims.iss !== issuer) return 'issuer';
  const aud = claims.aud;
  const auds = typeof aud === 'string' ? [aud] : Array.isArray(aud) ? aud : [];
  if (!auds.some((a) => a === audience)) return 'audience';
  const now = Math.floor(Date.now() / 1000);
  if (!isTime(claims.exp) || now > claims.exp + SKEW_S) return 'expired';
  if (claims.nbf !== undefined && (!isTime(claims.nbf) || now < claims.nbf - SKEW_S)) return 'not yet valid';

  const key = await keyFor(issuer, header.kid, fetcher);
  if (!key) return 'unknown key';
  const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed);
  return ok ? null : 'signature';
}

/** The refusal: the same empty 403 whatever the reason. */
export function accessDenied(): Response {
  return new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
}
