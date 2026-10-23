// Which routes answer without a credential. Run: pnpm exec tsx test/routeAccess.ts
//
// Every method and path the router answers is on one of two lists: public on
// purpose, with the reason, or behind a session token from /v1/session. A route
// on neither list fails here, so a new route is classified before it ships.
// Calls go through the worker's default export with an in-memory KV, and any
// outbound fetch is refused.

import worker from '../src/index';
import { ROUTES, dispatch, type Route } from '../src/router';
import { signJWT } from '../src/utils/jwt';
import type { Env } from '../src/utils/types';

/** Answer without any credential, by design. One line each on why that is safe. */
const PUBLIC: Record<string, string> = {
  'OPTIONS *': 'the CORS preflight, answered before any route: no handler runs, no body',
  'GET /health': 'the uptime check: a fixed status and the time, nothing stored',
  'POST /v1/session': 'the session start that issues the credential, behind Turnstile and a per-address ceiling',
  'POST /v1/page': 'the page-load beacon: writes one keyless count, answers 204',
  'POST /v1/entry': 'the welcome-step beacon: writes one keyless count, answers 204',
  'POST /v1/signup': 'the signup beacon: writes one keyless count, answers 204',
  'POST /v1/funnel': 'the funnel-step beacon of the pages, the app and the museum: one keyless count, answers 204',
  'POST /v1/playback': 'the listening beacon: one keyless count, answers 204',
  'POST /api/conversions': 'the ad conversion beacon, sent from pages before any session exists: answers ok and returns nothing stored',
};

/** Refuse a call without a valid session token. */
const SESSION = new Set<string>([
  'POST /v1/chat',
  'POST /v1/council',
  'POST /v1/summary',
  'GET /v1/quota',
]);

// ---------------------------------------------------------------------------
// The route table
// ---------------------------------------------------------------------------

// The worker's types know no node modules; the files are loaded at run time.
interface Fs { readFileSync(path: URL, encoding: 'utf8'): string }
const FS_MODULE: string = 'node:fs';

// A comparison against the path or the method: the shape any route condition takes.
const CONDITION = /\bpath\b\s*(?:[!=]==?|\.(?:startsWith|endsWith|includes|match|test)\b)|request\.method\s*[!=]==?\s*'(?!OPTIONS')/;
const LOOKUP = 'const route = routes.find(r => r.path === path && r.method === request.method);';

/** The pairs in ROUTES. A route condition anywhere else in the router fails, so the table is all of it. */
async function routeTable(): Promise<string[]> {
  const fs = (await import(FS_MODULE)) as Fs;
  const here = (import.meta as unknown as { url: string }).url;
  for (const file of ['../src/index.ts', '../src/router.ts']) {
    for (const line of fs.readFileSync(new URL(file, here), 'utf8').split('\n')) {
      if (CONDITION.test(line) && line.trim() !== LOOKUP) {
        throw new Error(`a route condition outside the table, in ${file.slice(3)}: ${line.trim()}`);
      }
    }
  }
  return ROUTES.map(r => `${r.method} ${r.path}`);
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const results: { name: string; error?: string }[] = [];

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name });
  } catch (err) {
    results.push({ name, error: (err as Error).message });
  }
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`);
}

const outbound: string[] = [];
globalThis.fetch = (async (url: string | URL | Request) => {
  outbound.push(String(url instanceof Request ? url.url : url));
  throw new Error('no outbound call from this suite');
}) as unknown as typeof fetch;

interface Probe {
  env: Env;
  ctx: ExecutionContext;
  kvAccess: string[];
  rows: unknown[];
  pending: Promise<unknown>[];
}

const SIGNING_KEY = 'route-access-signing-key';

function probe(): Probe {
  const store = new Map<string, string>();
  const kvAccess: string[] = [];
  const rows: unknown[] = [];
  const pending: Promise<unknown>[] = [];
  const kv = {
    get: async (key: string) => { kvAccess.push(`get ${key}`); return store.get(key) ?? null; },
    put: async (key: string, value: string) => { kvAccess.push(`put ${key}`); store.set(key, value); },
    delete: async (key: string) => { kvAccess.push(`delete ${key}`); store.delete(key); },
    list: async () => { kvAccess.push('list'); return { keys: [], list_complete: true, cacheStatus: null }; },
  } as unknown as KVNamespace;
  const env = {
    RATE_LIMITS: kv,
    COMPLIANCE_LOG: kv,
    ANALYTICS: { writeDataPoint: (row: unknown) => { rows.push(row); } },
    NEBIUS_API_KEY: 'test-key',
    NEBIUS_MODEL: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    JWT_SIGNING_KEY: SIGNING_KEY,
    TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
    ALLOWED_ORIGINS: 'https://agoracosmica.org',
  } as unknown as Env;
  const ctx = {
    waitUntil: (work: Promise<unknown>) => { pending.push(work); },
    passThroughOnException: () => { /* no-op */ },
  } as unknown as ExecutionContext;
  return { env, ctx, kvAccess, rows, pending };
}

async function call(
  method: string,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ response: Response; text: string; probe: Probe }> {
  const p = probe();
  const hasBody = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  const request = new Request(`https://llm.example.invalid${path}`, {
    method,
    headers: { 'CF-Connecting-IP': '10.0.0.77', Origin: 'https://agoracosmica.org', 'Content-Type': 'application/json', ...headers },
    ...(hasBody ? { body: '{}' } : {}),
  });
  const before = outbound.length;
  const response = await worker.fetch(request, p.env, p.ctx);
  await Promise.allSettled(p.pending);
  const text = await response.text();
  assertEqual(outbound.length, before, `${method} ${path}: outbound calls`);
  return { response, text, probe: p };
}

const bearer = async (key: string, sub = '77777777-7777-4777-8777-777777777777'): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  return signJWT({ sub, iat: now, exp: now + 600 }, key);
};

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  let table: string[] = [];
  await test('the router\'s route table can be read', async () => {
    table = await routeTable();
    assert(table.length > 0, 'no routes found');
    assertEqual(new Set(table).size, table.length, `a pair routed twice: ${table.join(', ')}`);
  });

  for (const pair of table) {
    await test(`${pair} is on exactly one list`, () => {
      const onPublic = pair in PUBLIC;
      const onSession = SESSION.has(pair);
      assert(onPublic || onSession, `${pair} is on neither list: name it public with a reason, or put it behind a session`);
      assert(!(onPublic && onSession), `${pair} is on both lists`);
    });
  }

  await test('every listed route is still in the table', () => {
    const routed = new Set(table);
    const stale = [...Object.keys(PUBLIC).filter(pair => pair !== 'OPTIONS *'), ...SESSION].filter(pair => !routed.has(pair));
    assertEqual(stale.length, 0, `listed but not routed: ${stale.join(', ')}`);
  });

  await test('every public route has its reason', () => {
    for (const [pair, why] of Object.entries(PUBLIC)) assert(why.trim().length > 20, `${pair}: the reason is missing`);
  });

  await test('the table marks public exactly the routes on the public list', () => {
    for (const route of ROUTES) {
      const pair = `${route.method} ${route.path}`;
      assertEqual(route.public === true, pair in PUBLIC, `${pair}: marked public in the table`);
    }
  });

  await test('a route not marked public never runs without a valid token, even when its handler checks nothing', async () => {
    let ran = 0;
    const careless: Route = { method: 'GET', path: '/v1/stored', handle: () => { ran++; return Response.json({ stored: 42 }); } };
    const p = probe();
    const at = (headers: Record<string, string>) => new Request('https://llm.example.invalid/v1/stored', { headers });
    for (const headers of [
      {},
      { Authorization: 'Bearer not-a-token' },
      { Authorization: `Bearer ${await bearer('not-the-signing-key')}` },
    ] as Record<string, string>[]) {
      assertEqual((await dispatch(at(headers), p.env, p.ctx, [careless])).status, 401, 'status');
    }
    assertEqual(ran, 0, 'handler runs without a valid token');
    const served = await dispatch(at({ Authorization: `Bearer ${await bearer(SIGNING_KEY)}` }), p.env, p.ctx, [careless]);
    assertEqual(served.status, 200, 'status with a valid token');
    assertEqual(ran, 1, 'handler runs with a valid token');
    const marked = await dispatch(at({}), p.env, p.ctx, [{ ...careless, public: true }]);
    assertEqual(marked.status, 200, 'status of the same route marked public');
  });

  for (const pair of table.filter(p => SESSION.has(p))) {
    const [method, path] = pair.split(' ');
    await test(`${pair} refuses a call without a session token, before any read, write or count`, async () => {
      for (const [label, headers] of [
        ['no token', {}],
        ['a token signed with another key', { Authorization: `Bearer ${await bearer('not-the-signing-key')}` }],
        ['a token that is not a JWT', { Authorization: 'Bearer not-a-token' }],
      ] as [string, Record<string, string>][]) {
        const { response, probe: p } = await call(method, path, headers);
        assertEqual(response.status, 401, `${label}: status`);
        assertEqual(p.kvAccess.length, 0, `${label}: KV access ${p.kvAccess.join(', ')}`);
        assertEqual(p.rows.length, 0, `${label}: analytics rows`);
      }
    });
  }

  for (const pair of table.filter(p => p in PUBLIC)) {
    const [method, path] = pair.split(' ');
    await test(`${pair} answers without a credential (public: ${PUBLIC[pair]})`, async () => {
      const { response } = await call(method, path);
      assert(![401, 403, 404, 405].includes(response.status), `status ${response.status}`);
    });
  }

  await test('a valid session token passes the gate of every session route', async () => {
    for (const pair of table.filter(p => SESSION.has(p))) {
      const [method, path] = pair.split(' ');
      const { response } = await call(method, path, { Authorization: `Bearer ${await bearer(SIGNING_KEY)}` });
      assert(response.status !== 401, `${pair}: a valid token was refused`);
    }
  });

  await test('OPTIONS * answers the preflight on any path, with no body and no KV access', async () => {
    for (const path of [...new Set(table.map(p => p.split(' ')[1])), '/no-such-route']) {
      const { response, text, probe: p } = await call('OPTIONS', path);
      assertEqual(response.status, 204, `${path}: status`);
      assertEqual(text, '', `${path}: body`);
      assertEqual(p.kvAccess.length, 0, `${path}: KV access`);
    }
  });

  await test('a pair outside the table gets the 404 and nothing else', async () => {
    const routed = new Set(table);
    const paths = [...new Set(table.map(p => p.split(' ')[1]))];
    const others: [string, string][] = [];
    for (const path of paths) {
      for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']) {
        if (!routed.has(`${method} ${path}`)) others.push([method, path]);
      }
    }
    others.push(['GET', '/'], ['POST', '/v1'], ['GET', '/v1/chat/'], ['GET', '/HEALTH'], ['GET', '/api/conversions/stats']);
    for (const [method, path] of others) {
      const { response, text, probe: p } = await call(method, path);
      assertEqual(response.status, 404, `${method} ${path}: status`);
      if (method !== 'HEAD') assertEqual(text, JSON.stringify({ error: 'Not found' }), `${method} ${path}: body`);
      assertEqual(p.kvAccess.length, 0, `${method} ${path}: KV access`);
    }
  });

  const failed = results.filter(r => r.error);
  for (const r of results) {
    console.log(r.error ? `FAIL  ${r.name}\n      ${r.error}` : `ok    ${r.name}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} route access cases passed`);
  return failed.length;
}

const host = globalThis as { process?: { exitCode?: number } };
main().then(
  failures => { if (host.process && failures > 0) host.process.exitCode = 1; },
  err => {
    console.log(`FAIL  suite crashed: ${(err as Error).message}`);
    if (host.process) host.process.exitCode = 1;
  },
);
