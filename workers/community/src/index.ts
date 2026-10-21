/**
 * Community Tally Worker — Anonymous voting-power heartbeat.
 *
 * Endpoints:
 *   POST /v1/community/power    — register voting power for a device
 *   GET  /v1/community/snapshot — read aggregate counts + current threshold
 *
 * Privacy:
 *   - Per-device anonymous UUID (hashed before persistence). A device record
 *     expires 12 months after it was last written.
 *   - IP is hashed with rotating IP_SALT; only used for write rate-limit.
 *   - No PII, no analytics, no cookies.
 *
 * Threshold scaling (5 phases) — see README "Threshold scaling" section.
 *   <250 active   → 3 co-signs (Launch phase)
 *   <2,500        → 7  (Growing community)
 *   <25,000       → 15 (Established community)
 *   <250,000      → 30 (Large community)
 *   ≥250,000      → 60 (Global community)
 */

import { readJsonCapped } from './bodyLimit';

export interface Env {
  COMMUNITY_KV: KVNamespace;
  ALLOWED_ORIGINS: string;
  IP_SALT: string; // wrangler secret put IP_SALT
}

interface PowerPayload {
  deviceId: string;
  power: number;
  completedFigures: number;
}

interface DeviceRecord {
  power: number;
  completedFigures: number;
  lastSeen: number;
}

interface SnapshotResponse {
  joinedCount: number;
  totalPower: number;
  updatedAt: number;
  coSignThreshold: number;
  thresholdPhase: string;
}

const SNAPSHOT_KEY = 'aggregate:snapshot';
const DEVICE_PREFIX = 'device:';
const RATE_LIMIT_PREFIX = 'rl:';
const RATE_LIMIT_WINDOW_S = 60 * 60 * 6; // 6h per-IP write rate-limit
// The aggregate is never decremented, so a device that returns after its
// record expired counts as newly joined.
const DEVICE_TTL_S = 60 * 60 * 24 * 365;
// A heartbeat carries a device id of at most 128 characters and two numbers.
const MAX_POWER_BODY_BYTES = 16 * 1024;

interface ThresholdTier {
  upTo: number; // active-user ceiling, exclusive
  threshold: number;
  phase: string; // human-readable phase label
}

const THRESHOLD_LADDER: ThresholdTier[] = [
  { upTo: 250, threshold: 3, phase: 'Launch phase' },
  { upTo: 2500, threshold: 7, phase: 'Growing community' },
  { upTo: 25000, threshold: 15, phase: 'Established community' },
  { upTo: 250000, threshold: 30, phase: 'Large community' },
  { upTo: Infinity, threshold: 60, phase: 'Global community' },
];

function thresholdFor(activeUsers: number): { threshold: number; phase: string } {
  for (const tier of THRESHOLD_LADDER) {
    if (activeUsers < tier.upTo) {
      return { threshold: tier.threshold, phase: tier.phase };
    }
  }
  const last = THRESHOLD_LADDER[THRESHOLD_LADDER.length - 1];
  return { threshold: last.threshold, phase: last.phase };
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function corsHeaders(origin: string | null, allowedOrigins: string): HeadersInit {
  const allowed = allowedOrigins.split(',').map((s) => s.trim()).filter(Boolean);
  // If origin is not on the allowlist, fall back to the first known origin.
  // Empty allowlist → no Access-Control-Allow-Origin header → browser rejects
  // the response. Fail closed; never reflect a wildcard.
  const matched = origin && allowed.includes(origin) ? origin : allowed[0];
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (matched) {
    headers['Access-Control-Allow-Origin'] = matched;
  }
  return headers;
}

function jsonResponse(
  body: unknown,
  status: number,
  cors: HeadersInit
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function readSnapshot(env: Env): Promise<SnapshotResponse> {
  const raw = await env.COMMUNITY_KV.get(SNAPSHOT_KEY, 'json');
  const stored =
    raw && typeof (raw as SnapshotResponse).joinedCount === 'number'
      ? (raw as SnapshotResponse)
      : { joinedCount: 0, totalPower: 0, updatedAt: 0 };
  const { threshold, phase } = thresholdFor(stored.joinedCount);
  return {
    ...stored,
    coSignThreshold: threshold,
    thresholdPhase: phase,
  };
}

const errorKind = (err: unknown): string => (err instanceof Error ? err.name : typeof err);

/**
 * Write one of a beacon's keys without failing the beacon. KV refuses a second
 * write to one key within a second, and every beacon writes the shared
 * aggregate. The line names the write and the error's kind only: a message can
 * quote a key. Returns whether the write landed.
 */
async function putOrLog(
  env: Env,
  key: string,
  value: string,
  what: 'Rate window' | 'Device' | 'Snapshot',
  options?: KVNamespacePutOptions,
): Promise<boolean> {
  try {
    await env.COMMUNITY_KV.put(key, value, options);
    return true;
  } catch (err) {
    console.warn(`[community] ${what} write failed (${errorKind(err)}), beacon served`);
    return false;
  }
}

async function writeSnapshot(env: Env, snap: SnapshotResponse): Promise<void> {
  // Don't persist threshold/phase — derived at read time.
  const persisted = {
    joinedCount: snap.joinedCount,
    totalPower: snap.totalPower,
    updatedAt: snap.updatedAt,
  };
  // A refused write leaves this beacon out of the totals, never counted twice.
  await putOrLog(env, SNAPSHOT_KEY, JSON.stringify(persisted), 'Snapshot');
}

async function handlePower(
  request: Request,
  env: Env,
  cors: HeadersInit
): Promise<Response> {
  let payload: PowerPayload;
  try {
    const read = await readJsonCapped(request, MAX_POWER_BODY_BYTES);
    if (!read.ok) return jsonResponse({ error: 'body_too_large' }, 413, cors);
    payload = read.body as PowerPayload;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, cors);
  }

  if (
    typeof payload.deviceId !== 'string' ||
    payload.deviceId.length < 8 ||
    payload.deviceId.length > 128 ||
    typeof payload.power !== 'number' ||
    !Number.isFinite(payload.power) ||
    payload.power < 0 ||
    payload.power > 31 ||
    typeof payload.completedFigures !== 'number' ||
    !Number.isFinite(payload.completedFigures) ||
    payload.completedFigures < 0 ||
    payload.completedFigures > 30
  ) {
    return jsonResponse({ error: 'invalid_payload' }, 400, cors);
  }

  const deviceHash = await sha256(`${env.IP_SALT}:${payload.deviceId}`);
  const deviceKey = `${DEVICE_PREFIX}${deviceHash}`;
  const previous = (await env.COMMUNITY_KV.get(deviceKey, 'json')) as DeviceRecord | null;

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const ipHash = await sha256(`${env.IP_SALT}:${ip}`);
  const rlKey = `${RATE_LIMIT_PREFIX}${ipHash}`;
  const recent = await env.COMMUNITY_KV.get(rlKey);
  if (recent) {
    // A device this worker has not seen is not counted inside the window: it
    // gets an error, so the client keeps nothing and does not claim a count.
    // A known device only skips its update and still sees the totals.
    if (!previous) return jsonResponse({ error: 'rate_limited' }, 429, cors);
    const snap = await readSnapshot(env);
    return jsonResponse(snap, 200, cors);
  }
  await putOrLog(env, rlKey, '1', 'Rate window', { expirationTtl: RATE_LIMIT_WINDOW_S });

  const next: DeviceRecord = {
    power: Math.floor(payload.power),
    completedFigures: Math.floor(payload.completedFigures),
    lastSeen: Date.now(),
  };
  const recorded = await putOrLog(env, deviceKey, JSON.stringify(next), 'Device', { expirationTtl: DEVICE_TTL_S });

  const snap = await readSnapshot(env);
  // The totals move only with the device's record, so a device whose record
  // was refused is counted on a later beacon, once.
  if (!recorded) return jsonResponse(snap, 200, cors);
  if (!previous) {
    snap.joinedCount = (snap.joinedCount ?? 0) + 1;
    snap.totalPower = (snap.totalPower ?? 0) + next.power;
  } else {
    snap.totalPower = (snap.totalPower ?? 0) + (next.power - previous.power);
  }
  snap.updatedAt = next.lastSeen;
  await writeSnapshot(env, snap);

  // Re-derive threshold + phase against the updated joinedCount.
  const { threshold, phase } = thresholdFor(snap.joinedCount);
  snap.coSignThreshold = threshold;
  snap.thresholdPhase = phase;

  return jsonResponse(snap, 200, cors);
}

async function handleSnapshot(
  env: Env,
  cors: HeadersInit
): Promise<Response> {
  const snap = await readSnapshot(env);
  return jsonResponse(snap, 200, cors);
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  const cors = corsHeaders(origin, env.ALLOWED_ORIGINS);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (url.pathname === '/v1/community/power' && request.method === 'POST') {
    return handlePower(request, env, cors);
  }

  if (url.pathname === '/v1/community/snapshot' && request.method === 'GET') {
    return handleSnapshot(env, cors);
  }

  return jsonResponse({ error: 'not_found' }, 404, cors);
}

const LOGGED_ROUTES = ['/v1/community/power', '/v1/community/snapshot'];

function routeLabel(request: Request): string {
  const path = new URL(request.url).pathname;
  return LOGGED_ROUTES.includes(path) ? path : 'other';
}

/**
 * The answer to a fault inside the worker. Without it the runtime answers
 * without CORS, so the app sees a network error instead of a 500. The log
 * names the error's kind and a fixed route only.
 */
function unhandled(request: Request, env: Env, err: unknown): Response {
  console.error(`[community] Unhandled ${errorKind(err)} on ${routeLabel(request)}`);
  let cors: HeadersInit = {};
  try {
    cors = corsHeaders(request.headers.get('origin'), env.ALLOWED_ORIGINS);
  } catch {
    // A broken origin list must not turn the 500 into a throw.
  }
  return jsonResponse({ error: 'internal_error' }, 500, cors);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (err) {
      return unhandled(request, env, err);
    }
  },
};
