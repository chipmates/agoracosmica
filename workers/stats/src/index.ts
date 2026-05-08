// Agora Cosmica — Internal Analytics Dashboard (V2)
// Serves a self-contained HTML dashboard that queries CF Analytics Engine SQL API.
// Protected by Cloudflare Access (configured in CF dashboard, not in code).

import type { Env, BatchQueryRequest, ServerStatsCache } from './types';
import { DASHBOARD_HTML } from './dashboard';

const VERSION = '2.0';
const SERVER_CACHE_TTL = 5000;

let serverCache: ServerStatsCache = { data: null, at: 0 };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({ status: 'ok', version: VERSION });
    }

    // SECURITY NOTE: /api/query and /api/query-batch run arbitrary SELECT SQL
    // against Cloudflare Analytics Engine using env.CF_API_TOKEN. They have NO
    // in-code authentication — access control is enforced by the Cloudflare
    // Access policy attached to this Worker's route. If the Access policy is
    // disabled or misconfigured, these endpoints become open to the public.
    // Verify the policy is attached on every deploy.

    // Single query (backwards-compat)
    if (url.pathname === '/api/query' && request.method === 'POST') {
      return handleQuery(request, env);
    }

    // Batch query (new: reduces round-trips)
    if (url.pathname === '/api/query-batch' && request.method === 'POST') {
      return handleBatchQuery(request, env);
    }

    // Live server stats (proxied from GEX130 servers)
    if (url.pathname === '/api/server-stats' && request.method === 'GET') {
      return handleServerStats(env);
    }

    // Serve dashboard HTML — inject LAUNCH_EPOCH_SECONDS at render time so the
    // client renders the "Stats since" label without a separate fetch.
    // String() of parseInt guarantees a valid integer literal (defends against
    // typos in wrangler.toml that would otherwise produce broken inline JS).
    const launchEpoch = String(parseInt(env.LAUNCH_EPOCH_SECONDS || '0', 10) || 0);
    const html = DASHBOARD_HTML.replace(/__LAUNCH_EPOCH_SECONDS__/g, launchEpoch);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Dashboard-Version': VERSION,
      },
    });
  },
};

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

async function handleQuery(request: Request, env: Env): Promise<Response> {
  try {
    const { query } = (await request.json()) as { query: string; dataset?: string };
    if (!query || !query.trim().toUpperCase().startsWith('SELECT')) {
      return Response.json({ error: 'Only SELECT queries allowed' }, { status: 400 });
    }

    const response = await queryAnalyticsEngine(applyLaunchFloor(query, env), env);
    if (!response.ok) {
      const text = await response.text();
      console.error(`[AE] ${response.status}: ${text.slice(0, 500)}`);
      return Response.json({ error: 'Query failed', status: response.status }, { status: 502 });
    }

    return Response.json(await response.json());
  } catch (err) {
    console.error('[query]', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

// --- Batch query ---

async function handleBatchQuery(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as BatchQueryRequest;
    const queries = body?.queries;

    if (!Array.isArray(queries) || queries.length === 0 || queries.length > 64) {
      return Response.json({ error: 'queries must be an array (1-64)' }, { status: 400 });
    }

    for (const q of queries) {
      if (typeof q.sql !== 'string' || !q.sql.trim().toUpperCase().startsWith('SELECT')) {
        return Response.json({ error: 'Only SELECT queries allowed' }, { status: 400 });
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
    console.error('[batch]', err);
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
      return { server: id, error: err instanceof Error ? err.message : 'failed' };
    }
  }

  const [fsn1, nbg1] = await Promise.all([
    fetchServer(env.SERVER_FSN1_URL, 'fsn1'),
    fetchServer(env.SERVER_NBG1_URL, 'nbg1'),
  ]);

  const data = { fsn1, nbg1 };
  serverCache = { data, at: now };

  return Response.json(data, {
    headers: { 'Cache-Control': 'no-cache', 'X-Cache': 'miss' },
  });
}
