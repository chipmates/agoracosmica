// Which routes answer, and only with a valid Cloudflare Access JWT. Run from
// workers/stats: ../llm-proxy/node_modules/.bin/tsx test/routeAccess.ts
//
// Every method and path the worker answers is on the list below, with what it
// serves. There is no public route: a pair in the table that is not listed
// fails here, so a new route is named before it ships. Each listed pair is
// refused without a valid token (no token, another audience, another issuer,
// expired, not yet valid, a bad signature, a foreign key, another algorithm)
// and passes with a person's token and with a service token's. The key set's
// address is answered locally; every other outbound call is recorded.

import worker, { ROUTES } from '../src/index';
import { forgetAccessKeys } from '../src/access';
import type { Env } from '../src/types';
import { AUD, CERTS_URL, ISSUER, TEAM_DOMAIN, makeSigner, serviceClaims, signToken, type Signer } from './accessToken';

/** Behind the Access JWT, every one. */
const BEHIND_ACCESS: Record<string, string> = {
  'GET /': 'the dashboard page',
  'GET /health': 'the version check',
  'POST /api/query': 'one SELECT against Analytics Engine',
  'POST /api/query-batch': 'up to 64 SELECTs against Analytics Engine',
  'GET /api/server-stats': 'the speech server panel',
  'GET /api/museum': "Cloudflare's totals for the museum's zone",
  'GET /api/museum/hours': 'one day of those totals by hour',
  'GET /api/museum/trends': 'those totals day by day',
  'GET /api/museum/count': "the museum's own count, fixed questions",
};

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

// The key set the stub publishes, or a status it fails with.
let published: Signer[] = [];
let certsStatus = 200;
const certsAsked: number[] = [];
const outbound: string[] = [];
globalThis.fetch = (async (url: string | URL | Request) => {
  const href = String(url instanceof Request ? url.url : url);
  if (href === CERTS_URL) {
    certsAsked.push(Date.now());
    if (certsStatus !== 200) return new Response('no', { status: certsStatus });
    return Response.json({ keys: published.map((s) => s.jwk) });
  }
  outbound.push(href);
  return Response.json({ data: [] });
}) as unknown as typeof fetch;
console.error = () => {};

const baseEnv = { CF_API_TOKEN: 'test-token', CF_ACCOUNT_ID: 'test-account', ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, ACCESS_AUD: AUD };

async function call(method: string, path: string, token: string | null, env: Record<string, unknown> = baseEnv, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (token !== null) headers['Cf-Access-Jwt-Assertion'] = token;
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const request = new Request(`https://stats.example.invalid${path}`, { method, headers, ...(hasBody ? { body: '{}' } : {}) });
  const before = outbound.length;
  const response = await worker.fetch(request, env as unknown as Env);
  const text = method === 'HEAD' ? '' : await response.text();
  return { status: response.status, text, calls: outbound.slice(before) };
}

const b64 = (v: unknown) => btoa(JSON.stringify(v)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const signer = await makeSigner();
  const stranger = await makeSigner();            // same key id, another key: a forged signature
  const rotated = await makeSigner('test-kid-2'); // a key Access published later
  published = [signer];
  const now = Math.floor(Date.now() / 1000);

  const person = await signToken(signer);
  const service = await signToken(signer, serviceClaims());
  const [head, body] = person.split('.');
  const refusals: Array<[string, string, Record<string, string>?]> = [
    ['no token', ''],
    ['another audience', await signToken(signer, { aud: ['another-application-aud'] })],
    ['another issuer', await signToken(signer, { iss: 'https://other-team.cloudflareaccess.com' })],
    ['the issuer without its scheme', await signToken(signer, { iss: TEAM_DOMAIN })],
    ['expired two minutes ago', await signToken(signer, { exp: now - 120, iat: now - 720, nbf: now - 720 })],
    ['no expiry', await signToken(signer, { exp: undefined })],
    ['not valid for ten minutes', await signToken(signer, { nbf: now + 600 })],
    ['signed by another key under the same key id', await signToken(stranger)],
    ['a payload changed after signing', head + '.' + b64({ ...JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))), aud: [AUD], email: 'someone@example.invalid' }) + '.' + person.split('.')[2]],
    ['a key id Access never published', await signToken(rotated)],
    ['the algorithm none', b64({ alg: 'none', kid: signer.kid }) + '.' + body + '.'],
    ['the algorithm HS256', await signToken(signer, {}, { alg: 'HS256' })],
    ['not a JWT', 'not-a-token'],
    ['the token in the cookie only', '', { Cookie: 'CF_Authorization=' + person }],
  ];

  const table = ROUTES.map((r) => `${r.method} ${r.path}`);

  await test('the route table can be read and routes no pair twice', () => {
    assert(table.length > 0, 'no routes found');
    assertEqual(new Set(table).size, table.length, `a pair routed twice: ${table.join(', ')}`);
  });

  for (const pair of table) {
    await test(`${pair} is on the list`, () => {
      assert(pair in BEHIND_ACCESS, `${pair} is not listed: name it in BEHIND_ACCESS before it ships`);
    });
  }

  await test('every listed route is still in the table', () => {
    const stale = Object.keys(BEHIND_ACCESS).filter((pair) => table.indexOf(pair) < 0);
    assertEqual(stale.length, 0, `listed but not routed: ${stale.join(', ')}`);
  });

  await test('index.ts reads the path and the method only in the table and its lookup', async () => {
    const fs = (await import('node:fs')) as { readFileSync(path: URL, encoding: 'utf8'): string };
    const allowed = [
      'path: string;',
      'const path = new URL(request.url).pathname;',
      'const route = ROUTES.find((r) => r.path === path && r.method === request.method);',
    ];
    for (const raw of fs.readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8').split('\n')) {
      const line = raw.trim();
      if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;
      if (!/pathname|request\.url|request\.method|\burl\.|\bpath\b|\bswitch\s*\(/.test(line)) continue;
      if (allowed.indexOf(line) >= 0 || /^\{ method: '(GET|POST)', path: '[^']+', handle: /.test(line)) continue;
      throw new Error(`a read of the path or method outside the table: ${line}`);
    }
  });

  for (const pair of table) {
    const [method, path] = pair.split(' ');
    await test(`${pair} refuses every token that is not valid, with an empty 403 and no call made`, async () => {
      for (const [label, token, extra] of refusals) {
        const got = await call(method, path, token || null, baseEnv, extra || {});
        assertEqual(got.status, 403, `${label}: status`);
        assertEqual(got.text, '', `${label}: body`);
        assertEqual(got.calls.length, 0, `${label}: calls ${got.calls.join(', ')}`);
      }
    });
  }

  for (const pair of table) {
    const [method, path] = pair.split(' ');
    await test(`${pair} passes with a person's token and with a service token's`, async () => {
      for (const [label, token] of [['person', person], ['service token', service]]) {
        const got = await call(method, path, token);
        assert(got.status !== 403 && got.status !== 404, `${label}: status ${got.status}`);
      }
    });
  }

  await test('a pair outside the table: 403 without a token, 404 with one', async () => {
    const others: Array<[string, string]> = [['GET', '/index.html'], ['HEAD', '/'], ['POST', '/'], ['GET', '/api/query'],
      ['PUT', '/api/query'], ['GET', '/API/QUERY'], ['GET', '/api/museum/'], ['GET', '/api/conversions/stats'], ['DELETE', '/health']];
    for (const [method, path] of others) {
      assertEqual((await call(method, path, null)).status, 403, `${method} ${path} without a token`);
      const got = await call(method, path, person);
      assertEqual(got.status, 404, `${method} ${path} with a token`);
      assertEqual(got.calls.length, 0, `${method} ${path}: calls`);
    }
  });

  await test('the worker fails closed while either Access secret is missing or misshaped', async () => {
    const asked = certsAsked.length;
    for (const [label, env] of [
      ['no team domain', { ...baseEnv, ACCESS_TEAM_DOMAIN: undefined }],
      ['no audience', { ...baseEnv, ACCESS_AUD: undefined }],
      ['both empty', { ...baseEnv, ACCESS_TEAM_DOMAIN: '', ACCESS_AUD: ' ' }],
      ['a team domain that is not Access', { ...baseEnv, ACCESS_TEAM_DOMAIN: 'keys.example.invalid' }],
    ] as Array<[string, Record<string, unknown>]>) {
      for (const path of ['/', '/health', '/api/museum/count']) {
        assertEqual((await call('GET', path, person, env)).status, 403, `${label}: GET ${path}`);
      }
    }
    assertEqual(certsAsked.length, asked, 'the key set is never asked for');
  });

  await test('the team domain may be given with https:// and a trailing slash', async () => {
    assertEqual((await call('GET', '/health', person, { ...baseEnv, ACCESS_TEAM_DOMAIN: ISSUER + '/' })).status, 200, 'status');
  });

  await test('the audience may stand as a string or among others', async () => {
    assertEqual((await call('GET', '/health', await signToken(signer, { aud: AUD }))).status, 200, 'a string');
    assertEqual((await call('GET', '/health', await signToken(signer, { aud: ['another', AUD] }))).status, 200, 'second of two');
  });

  await test('a token expired thirty seconds ago still passes inside the leeway', async () => {
    assertEqual((await call('GET', '/health', await signToken(signer, { exp: now - 30 }))).status, 200, 'status');
  });

  await test('the key set is fetched once and held', async () => {
    forgetAccessKeys();
    const asked = certsAsked.length;
    for (let i = 0; i < 3; i++) assertEqual((await call('GET', '/health', person)).status, 200, `call ${i + 1}`);
    assertEqual(certsAsked.length - asked, 1, 'key set fetches');
  });

  await test('a rotated key is fetched again, never more often than every 30 seconds', async () => {
    forgetAccessKeys();
    const realNow = Date.now;
    let clock = realNow();
    Date.now = () => clock;
    try {
      const fresh = await signToken(rotated);
      const asked = certsAsked.length;
      assertEqual((await call('GET', '/health', person)).status, 200, 'the old key');
      published = [signer, rotated];
      clock += 5000;
      assertEqual((await call('GET', '/health', fresh)).status, 403, 'the new key inside the gap');
      assertEqual(certsAsked.length - asked, 1, 'asked once so far');
      clock += 31000;
      assertEqual((await call('GET', '/health', fresh)).status, 200, 'the new key after the gap');
      assertEqual(certsAsked.length - asked, 2, 'asked again once');
      assertEqual((await call('GET', '/health', await signToken(stranger, {}, { kid: 'test-kid-9' }))).status, 403, 'an unknown key id');
      assertEqual(certsAsked.length - asked, 2, 'an unknown key id inside the gap asks nothing');
    } finally {
      Date.now = realNow;
      published = [signer];
    }
  });

  await test('a key set that does not answer refuses, and is asked again only after the gap', async () => {
    forgetAccessKeys();
    certsStatus = 503;
    try {
      const asked = certsAsked.length;
      for (let i = 0; i < 3; i++) assertEqual((await call('GET', '/health', person)).status, 403, `call ${i + 1}`);
      assertEqual(certsAsked.length - asked, 1, 'key set fetches');
    } finally {
      certsStatus = 200;
      forgetAccessKeys();
    }
  });

  const failed = results.filter((r) => r.error);
  for (const r of results) console.log(r.error ? `FAIL  ${r.name}\n      ${r.error}` : `ok    ${r.name}`);
  console.log(`\n${results.length - failed.length}/${results.length} route access cases passed`);
  return failed.length;
}

main().then(
  (failures) => { if (failures > 0) process.exitCode = 1; },
  (err) => {
    console.log(`FAIL  suite crashed: ${(err as Error).message}`);
    process.exitCode = 1;
  },
);
