import {
  getServers,
  TIMEOUTS,
  HEALTH_TTL_SECONDS,
  HEALTH_STALE_SECONDS,
  HEALTH_KV_TTL_SECONDS,
  KV_KEY,
} from './config';
import type { Env, HealthData, ServerInfo, CachedHealth } from './types';

/** Read cached health from KV. Returns null fields if no cache exists. */
export async function getCachedHealth(env: Env): Promise<CachedHealth> {
  const raw = await env.HEALTH_CACHE.get(KV_KEY);
  if (!raw) return { fsn1: null, nbg1: null, updatedAt: 0 };
  try {
    return JSON.parse(raw) as CachedHealth;
  } catch {
    return { fsn1: null, nbg1: null, updatedAt: 0 };
  }
}

/** Age of a snapshot in seconds. Infinity when it was never written. */
function snapshotAge(cached: CachedHealth): number {
  if (!cached.updatedAt) return Infinity;
  return (Date.now() - cached.updatedAt) / 1000;
}

/** Fetch health from a single server. Returns null on failure. */
async function fetchServerHealth(baseUrl: string): Promise<HealthData | null> {
  try {
    const res = await fetch(`${baseUrl}/v1/audio/health`, {
      signal: AbortSignal.timeout(TIMEOUTS.HEALTH_FETCH),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const slots = data.gpu_slots as { available?: number; max?: number } | undefined;
    if (!slots || typeof slots.available !== 'number' || typeof slots.max !== 'number') return null;
    return { gpu_slots: { available: slots.available, max: slots.max }, timestamp: Date.now() };
  } catch {
    return null;
  }
}

/**
 * Pick primary + fallback server.
 *
 * When X-Session-Id is present (normal TTS/STT path from the client), pin
 * the session to one gateway by UUID hash. Each gateway holds a per-process
 * in-memory session cache for Qwen admission, so the same session must land
 * on the same gateway every time — otherwise admission decisions diverge and
 * mid-conversation voice flips occur. UUID v4 low bits distribute uniformly,
 * so this also produces a ~50/50 fleet split.
 *
 * When no session id is provided (rare / pre-flight), fall back to
 * GPU-slot-based selection: prefer the server with more available slots,
 * break ties with FSN1.
 *
 * 5xx/timeout failover to the other origin is handled in proxy.ts. A brief
 * voice flip on origin failure is acceptable (availability > stickiness).
 */
export async function selectServers(
  env: Env,
  sessionId: string | null
): Promise<[ServerInfo, ServerInfo]> {
  const cached = await getCachedHealth(env);
  const fresh = snapshotAge(cached) < HEALTH_STALE_SECONDS;
  const servers = getServers(env);

  const fsn1: ServerInfo = { ...servers.fsn1, health: fresh ? cached.fsn1 : null };
  const nbg1: ServerInfo = { ...servers.nbg1, health: fresh ? cached.nbg1 : null };

  if (sessionId) {
    const primary = hashToOrigin(sessionId) === 0 ? fsn1 : nbg1;
    const fallback = primary.id === 'fsn1' ? nbg1 : fsn1;
    return [primary, fallback];
  }

  // Stale snapshot carries no load signal, so keep the deterministic default
  // instead of comparing two zeroes. proxy.ts still fails over on a dead origin.
  if (!fresh) return [fsn1, nbg1];

  const fsn1Slots = cached.fsn1?.gpu_slots.available ?? 0;
  const nbg1Slots = cached.nbg1?.gpu_slots.available ?? 0;

  if (nbg1Slots > fsn1Slots) return [nbg1, fsn1];
  return [fsn1, nbg1];
}

/**
 * Deterministic 0|1 from a session id. Standard string hash (same constant
 * as the diagnostic client-side fallback in load-test-german.mjs).
 *
 * When a 3rd gateway lands, swap this for rendezvous hashing (HRW) so
 * membership changes only reshuffle ~1/N of sessions instead of half.
 */
function hashToOrigin(sessionId: string): 0 | 1 {
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) {
    h = ((h << 5) - h + sessionId.charCodeAt(i)) | 0;
  }
  return (h & 1) as 0 | 1;
}

/**
 * Refresh health for both servers and write to KV. Returns the snapshot that is
 * current afterwards, so a caller needing the values can use them directly: KV
 * is eventually consistent, a read right after the put can still miss.
 */
export async function refreshHealth(env: Env): Promise<CachedHealth> {
  // Skip if recently refreshed
  const cached = await getCachedHealth(env);
  if (snapshotAge(cached) < HEALTH_TTL_SECONDS) return cached;

  const servers = getServers(env);
  const [fsn1Health, nbg1Health] = await Promise.all([
    fetchServerHealth(servers.fsn1.url),
    fetchServerHealth(servers.nbg1.url),
  ]);

  const updated: CachedHealth = {
    fsn1: fsn1Health,
    nbg1: nbg1Health,
    updatedAt: Date.now(),
  };

  await env.HEALTH_CACHE.put(KV_KEY, JSON.stringify(updated), {
    expirationTtl: HEALTH_KV_TTL_SECONDS,
  });

  return updated;
}

/**
 * Build aggregated health response for GET /v1/audio/health.
 *
 * Probes the origins inline when the snapshot is stale. This route is a spot
 * check, usually on an idle worker whose KV entry has expired, so reading the
 * cache alone would report "unknown" for two servers that are up.
 */
export async function getAggregatedHealth(env: Env): Promise<Response> {
  const cached = await refreshHealth(env);
  const age = snapshotAge(cached);
  return new Response(
    JSON.stringify({
      servers: {
        fsn1: cached.fsn1 ? { status: 'healthy', gpu_slots: cached.fsn1.gpu_slots } : { status: 'unknown' },
        nbg1: cached.nbg1 ? { status: 'healthy', gpu_slots: cached.nbg1.gpu_slots } : { status: 'unknown' },
      },
      updatedAt: cached.updatedAt ? new Date(cached.updatedAt).toISOString() : null,
      ageSeconds: Number.isFinite(age) ? Math.round(age) : null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
