import { getServers, TIMEOUTS, HEALTH_TTL_SECONDS, KV_KEY } from './config';
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
  const servers = getServers(env);

  const fsn1: ServerInfo = { ...servers.fsn1, health: cached.fsn1 };
  const nbg1: ServerInfo = { ...servers.nbg1, health: cached.nbg1 };

  if (sessionId) {
    const primary = hashToOrigin(sessionId) === 0 ? fsn1 : nbg1;
    const fallback = primary.id === 'fsn1' ? nbg1 : fsn1;
    return [primary, fallback];
  }

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

/** Refresh health for both servers and write to KV. Runs in waitUntil(). */
export async function refreshHealth(env: Env): Promise<void> {
  // Skip if recently refreshed
  const cached = await getCachedHealth(env);
  const age = (Date.now() - cached.updatedAt) / 1000;
  if (age < HEALTH_TTL_SECONDS) return;

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
    expirationTtl: 120, // KV auto-expires after 2 min if worker stops refreshing
  });
}

/** Build aggregated health response for GET /v1/audio/health */
export async function getAggregatedHealth(env: Env): Promise<Response> {
  const cached = await getCachedHealth(env);
  return new Response(
    JSON.stringify({
      servers: {
        fsn1: cached.fsn1 ? { status: 'healthy', gpu_slots: cached.fsn1.gpu_slots } : { status: 'unknown' },
        nbg1: cached.nbg1 ? { status: 'healthy', gpu_slots: cached.nbg1.gpu_slots } : { status: 'unknown' },
      },
      updatedAt: cached.updatedAt ? new Date(cached.updatedAt).toISOString() : null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
