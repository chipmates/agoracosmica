// Agora Cosmica — Internal Analytics Dashboard (V2)
// Serves a self-contained HTML dashboard that queries CF Analytics Engine SQL API.
// Every request must carry a valid Cloudflare Access JWT (access.ts) before any
// route runs; the Access policy in the dashboard is the first gate, this the second.

import type { Env, BatchQueryRequest, ServerStatsCache } from './types';
import { DASHBOARD_HTML } from './dashboard';
import { handleMuseum } from './museum';
import { handleMuseumCount, countDatasetOf } from './museum-count';
import { readJsonCapped } from './bodyLimit';
import { accessRefusal, accessDenied } from './access';

const VERSION = '2.0';
const SERVER_CACHE_TTL = 5000;
// The dashboard's largest batch holds about 10 KB of SQL, and a batch takes at
// most 64 queries; 1 MiB leaves room for longer questions from scripts.
const MAX_QUERY_BODY_BYTES = 1024 * 1024;

let serverCache: ServerStatsCache = { data: null, at: 0 };

export interface Route {
  method: 'GET' | 'POST';
  path: string;
  handle(request: Request, env: Env): Promise<Response>;
}

// Every pair the worker answers; anything else is a 404, and only behind the
// Access check. test/routeAccess.ts lists each one.
export const ROUTES: readonly Route[] = [
  { method: 'GET', path: '/', handle: serveDashboard },
  { method: 'GET', path: '/health', handle: handleHealth },
  { method: 'POST', path: '/api/query', handle: handleQuery },
  { method: 'POST', path: '/api/query-batch', handle: handleBatchQuery },
  { method: 'GET', path: '/api/server-stats', handle: (_request, env) => handleServerStats(env) },
  { method: 'GET', path: '/api/museum', handle: handleMuseum },
  { method: 'GET', path: '/api/museum/hours', handle: handleMuseum },
  { method: 'GET', path: '/api/museum/trends', handle: handleMuseum },
  { method: 'GET', path: '/api/museum/count', handle: (_request, env) => handleMuseumCount(env) },
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const refused = await accessRefusal(request, env);
    if (refused) {
      console.error('[access] refused: ' + refused);
      return accessDenied();
    }
    const path = new URL(request.url).pathname;
    const route = ROUTES.find((r) => r.path === path && r.method === request.method);
    if (!route) return Response.json({ error: 'Not found' }, { status: 404 });
    return route.handle(request, env);
  },
};

async function handleHealth(): Promise<Response> {
  return Response.json({ status: 'ok', version: VERSION });
}

// The dashboard. LAUNCH_EPOCH_SECONDS is filled in at render time; String() of
// parseInt keeps it a valid integer literal inside the inline script.
async function serveDashboard(_request: Request, env: Env): Promise<Response> {
  const launchEpoch = String(parseInt(env.LAUNCH_EPOCH_SECONDS || '0', 10) || 0);
  const html = DASHBOARD_HTML.replace(/__LAUNCH_EPOCH_SECONDS__/g, launchEpoch);
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Dashboard-Version': VERSION,
    },
  });
}

// --- Single query ---

async function queryAnalyticsEngine(sql: string, env: Env): Promise<Response> {
  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'text/plain',
      },
      body: sql,
    }
  );
}

// Floor every dashboard SQL query at the launch epoch so pre-launch test data
// is excluded. The dashboard's queries are all flat (single top-level WHERE,
// no subqueries), so injecting after the first WHERE keyword is safe.
function applyLaunchFloor(sql: string, env: Env): string {
  const epoch = parseInt(env.LAUNCH_EPOCH_SECONDS || '0', 10);
  if (!epoch) return sql;
  return sql.replace(/\bWHERE\s+/i, `WHERE timestamp > toDateTime(${epoch}) AND `);
}

// The museum's count is read only through its own guarded route, so no page
// can ask it a question that groups finer or reads single rows.
function namesCount(sql: string, env: Env): boolean {
  return new RegExp('\\b' + countDatasetOf(env) + '\\b', 'i').test(sql);
}

// A JSON parse error quotes the start of the body, so it is logged by its kind
// only; any other error keeps its message.
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return typeof err;
  if (err.name === 'SyntaxError') return err.name;
  return `${err.name}: ${err.message.slice(0, 200)}`;
}

// A fixed reason per status: the engine's error text can quote the query.
function engineReason(status: number): string {
  if (status === 400 || status === 422) return 'query rejected';
  if (status === 401 || status === 403) return 'token rejected';
  if (status === 429) return 'rate limited';
  if (status >= 500) return 'engine error';
  return 'unexpected status';
}

function bodyTooLarge(): Response {
  return Response.json({ error: 'Request body too large' }, { status: 413 });
}

async function handleQuery(request: Request, env: Env): Promise<Response> {
  try {
    const read = await readJsonCapped(request, MAX_QUERY_BODY_BYTES);
    if (!read.ok) return bodyTooLarge();
    const { query } = read.body as { query: string; dataset?: string };
    if (!query || !query.trim().toUpperCase().startsWith('SELECT')) {
      return Response.json({ error: 'Only SELECT queries allowed' }, { status: 400 });
    }
    if (namesCount(query, env)) {
      return Response.json({ error: 'Not through this route' }, { status: 400 });
    }

    const response = await queryAnalyticsEngine(applyLaunchFloor(query, env), env);
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      console.error(`[AE] ${response.status}: ${engineReason(response.status)}`);
      return Response.json({ error: 'Query failed', status: response.status }, { status: 502 });
    }

    return Response.json(await response.json());
  } catch (err) {
    console.error('[query]', describeError(err));
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

// --- Batch query ---

async function handleBatchQuery(request: Request, env: Env): Promise<Response> {
  try {
    const read = await readJsonCapped(request, MAX_QUERY_BODY_BYTES);
    if (!read.ok) return bodyTooLarge();
    const body = read.body as BatchQueryRequest;
    const queries = body?.queries;

    if (!Array.isArray(queries) || queries.length === 0 || queries.length > 64) {
      return Response.json({ error: 'queries must be an array (1-64)' }, { status: 400 });
    }

    for (const q of queries) {
      if (typeof q.sql !== 'string' || !q.sql.trim().toUpperCase().startsWith('SELECT')) {
        return Response.json({ error: 'Only SELECT queries allowed' }, { status: 400 });
      }
      if (namesCount(q.sql, env) || namesCount(String(q.dataset || ''), env)) {
        return Response.json({ error: 'Not through this route' }, { status: 400 });
      }
    }

    const results = await Promise.allSettled(
      queries.map(async (q) => {
        const res = await queryAnalyticsEngine(applyLaunchFloor(q.sql, env), env);
        if (!res.ok) return { data: [], error: res.status };
        return res.json();
      })
    );

    return Response.json({
      results: results.map((r) =>
        r.status === 'fulfilled' ? r.value : { data: [], error: 'failed' }
      ),
    });
  } catch (err) {
    console.error('[batch]', describeError(err));
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

// --- Server stats (with 5s cache) ---

async function handleServerStats(env: Env): Promise<Response> {
  const now = Date.now();
  if (serverCache.data && now - serverCache.at < SERVER_CACHE_TTL) {
    return Response.json(serverCache.data, {
      headers: { 'Cache-Control': 'no-cache', 'X-Cache': 'hit' },
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.AUDIO_API_KEY}`,
  };
  if (env.ORIGIN_VERIFY_KEY) {
    headers['X-Origin-Verify'] = env.ORIGIN_VERIFY_KEY;
  }
  const timeout = 5000;

  async function fetchServer(url: string, id: string) {
    try {
      const res = await fetch(`${url}/v1/server/stats`, {
        headers,
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) return { server: id, error: `HTTP ${res.status}` };
      return await res.json();
    } catch (err) {
      // Log the detail server-side; return a generic label so upstream error
      // text (timeouts, DNS, the origin URL) never reaches the client, even
      // though this endpoint is already behind Cloudflare Access.
      console.error(`[stats] server ${id} unreachable:`, err instanceof Error ? err.message : err);
      return { server: id, error: 'unreachable' };
    }
  }

  // An empty URL marks a retired server: it is left out, not reported as down.
  const configured = (
    [['fsn1', env.SERVER_FSN1_URL], ['nbg1', env.SERVER_NBG1_URL]] as const
  ).filter(([, url]) => Boolean(url));
  const results = await Promise.all(configured.map(([id, url]) => fetchServer(url, id)));
  const data = Object.fromEntries(configured.map(([id], i) => [id, results[i]]));
  serverCache = { data, at: now };

  return Response.json(data, {
    headers: { 'Cache-Control': 'no-cache', 'X-Cache': 'miss' },
  });
}
