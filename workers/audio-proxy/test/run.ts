// Worker unit tests. Run: pnpm test
//
// No framework: each case throws on failure and the runner reports the tally,
// so the suite runs anywhere tsx does. Same shape as the llm-proxy suite.

import { hashIP } from '../src/rateLimit';
import { corsHeaders, handlePreflight } from '../src/cors';
import worker from '../src/index';
import type { Env } from '../src/types';

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

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

const ORIGIN = 'https://agoracosmica.org';

function fakeEnv(): Env {
  return { ALLOWED_ORIGINS: ORIGIN } as unknown as Env;
}

/**
 * The worker with every outside call recorded: fetch, both KV stores, R2 and
 * the analytics points. Any fetch throws as well, so a call cannot pass as an
 * answer. The env still carries the old server settings, so a worker that
 * would call a server finds an address to call.
 */
const harness = (servers: { fsn1: string; nbg1: string } = { fsn1: 'https://fsn1.example', nbg1: '' }) => {
  const fetched: string[] = [];
  const kvTouched: string[] = [];
  const points: AnalyticsEngineDataPoint[] = [];
  const kv = (name: string) => ({
    get: async (key: string) => { kvTouched.push(`${name} get ${key}`); return null; },
    put: async (key: string) => { kvTouched.push(`${name} put ${key}`); },
  }) as unknown as KVNamespace;
  const env = {
    ...fakeEnv(),
    SERVER_FSN1_URL: servers.fsn1,
    SERVER_NBG1_URL: servers.nbg1,
    AUDIO_API_KEY: 'test-key',
    ORIGIN_VERIFY_KEY: 'test-origin-key',
    IP_HASH_SALT: 'test-salt',
    HEALTH_CACHE: kv('health'),
    RATE_LIMITS: kv('limits'),
    STORY_BUCKET: { list: async () => ({ objects: [], truncated: false }) },
    ANALYTICS: { writeDataPoint: (point: AnalyticsEngineDataPoint) => { points.push(point); } },
  } as unknown as Env;
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (work: Promise<unknown>) => { pending.push(work); },
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetched.push(String(input instanceof Request ? input.url : input));
    throw new Error('no outbound call is allowed');
  }) as typeof fetch;
  const settle = () => Promise.allSettled(pending);
  const restore = () => { globalThis.fetch = original; };
  return { env, ctx, fetched, kvTouched, points, settle, restore };
};

/** A 2 MiB body that hands out a chunk only when the worker reads one. */
const countedBody = () => {
  let pulled = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled >= 2) { controller.close(); return; }
      pulled++;
      controller.enqueue(new Uint8Array(1024 * 1024));
    },
  }, { highWaterMark: 0 });
  return { stream, pulled: () => pulled };
};

const post = (path: string, body: BodyInit | null, origin = ORIGIN): Request => new Request(`https://audio.agoracosmica.org${path}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json', Origin: origin,
    'CF-Connecting-IP': '203.0.113.9', 'X-Session-Id': '0f8e2b7a-3c1d-4e5f-9a6b-7c8d9e0f1a2b',
  },
  body,
  // Node needs this for a streamed body; the Workers runtime ignores it.
  ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
} as RequestInit);

const get = (path: string, method = 'GET'): Request => new Request(`https://audio.agoracosmica.org${path}`, {
  method, headers: { Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.9' },
});

/** The retired voice routes and the name each is counted under. */
const GONE: { path: string; counted: string }[] = [
  { path: '/v1/audio/speech', counted: 'speech' },
  { path: '/v1/audio/transcriptions', counted: 'transcriptions' },
  { path: '/v1/audio/session/end', counted: 'session-end' },
];

async function main(): Promise<number> {
  // -------------------------------------------------------------------------
  // The retired voice routes: 410 at once, with CORS, and nothing called
  // -------------------------------------------------------------------------

  for (const route of GONE) {
    await test(`POST ${route.path} answers 410 at once, with CORS, and calls nothing`, async () => {
      const h = harness();
      try {
        const body = countedBody();
        const request = post(route.path, body.stream);
        const res = await worker.fetch(request, h.env, h.ctx);
        await h.settle();
        assertEqual(res.status, 410, 'status');
        assertEqual(await res.text(), '{"error":"gone"}', 'body');
        assertEqual(res.headers.get('Content-Type'), 'application/json', 'content type');
        for (const [name, value] of Object.entries(corsHeaders(request, h.env))) {
          assertEqual(res.headers.get(name), value, `CORS header ${name}`);
        }
        assertEqual(res.headers.get('Access-Control-Allow-Origin'), ORIGIN, 'CORS on the 410');
        assertEqual(h.fetched.length, 0, `upstream calls: ${h.fetched.join(', ')}`);
        assertEqual(h.kvTouched.length, 0, `KV reads and writes: ${h.kvTouched.join(', ')}`);
        assertEqual(body.pulled(), 0, 'body chunks read');
      } finally {
        h.restore();
      }
    });

    await test(`POST ${route.path}: each 410 is counted once in the audio dataset`, async () => {
      const h = harness();
      try {
        await worker.fetch(post(route.path, '{"input":"hello"}'), h.env, h.ctx);
        await h.settle();
        assertEqual(h.points.length, 1, 'data points');
        const blobs = h.points[0].blobs ?? [];
        assertEqual(blobs[3], '410', 'status blob');
        assertEqual(blobs[4], route.counted, 'route blob');
        assertEqual(h.fetched.length, 0, 'upstream calls');
      } finally {
        h.restore();
      }
    });
  }

  await test('a voice route asked from another site gets the 410 without CORS', async () => {
    const h = harness();
    try {
      const res = await worker.fetch(post('/v1/audio/speech', '{}', 'https://evil.example'), h.env, h.ctx);
      await h.settle();
      assertEqual(res.status, 410, 'status');
      assertEqual(res.headers.get('Access-Control-Allow-Origin'), null, 'no ACAO');
      assertEqual(h.fetched.length, 0, 'upstream calls');
    } finally {
      h.restore();
    }
  });

  await test('a voice route asked with another method keeps its 404', async () => {
    const h = harness();
    try {
      for (const route of GONE) {
        const res = await worker.fetch(get(route.path), h.env, h.ctx);
        assertEqual(res.status, 404, `GET ${route.path}`);
      }
      await h.settle();
      assertEqual(h.fetched.length, 0, 'upstream calls');
    } finally {
      h.restore();
    }
  });

  // -------------------------------------------------------------------------
  // Health: no server is probed, on any route
  // -------------------------------------------------------------------------

  await test('/v1/audio/health answers without probing any server', async () => {
    const h = harness();
    try {
      const res = await worker.fetch(get('/v1/audio/health'), h.env, h.ctx);
      await h.settle();
      assertEqual(res.status, 200, 'status');
      assertEqual(await res.text(), '{"status":"retired","servers":{}}', 'body');
      assertEqual(res.headers.get('Access-Control-Allow-Origin'), ORIGIN, 'CORS');
      assertEqual(h.fetched.length, 0, `probes: ${h.fetched.join(', ')}`);
      assertEqual(h.kvTouched.length, 0, `KV reads and writes: ${h.kvTouched.join(', ')}`);
    } finally {
      h.restore();
    }
  });

  await test('/health keeps the worker\'s own static answer', async () => {
    const h = harness();
    try {
      const res = await worker.fetch(get('/health'), h.env, h.ctx);
      await h.settle();
      assertEqual(res.status, 200, 'status');
      assertEqual(await res.text(), '{"status":"ok","worker":"agora-cosmica-audio"}', 'body');
      assertEqual(h.fetched.length, 0, 'probes');
    } finally {
      h.restore();
    }
  });

  await test('an archive request starts no server probe', async () => {
    const h = harness();
    try {
      const res = await worker.fetch(get('/v1/audio/story-archive/vinci/en', 'HEAD'), h.env, h.ctx);
      await h.settle();
      assertEqual(res.status, 404, 'an unpublished archive, as before');
      assertEqual(h.fetched.length, 0, `probes: ${h.fetched.join(', ')}`);
      assertEqual(h.kvTouched.filter((k) => k.startsWith('health')).length, 0, 'health cache reads and writes');
    } finally {
      h.restore();
    }
  });

  await test('with both server URLs empty, as deployed, no route makes a call', async () => {
    const h = harness({ fsn1: '', nbg1: '' });
    try {
      const requests = [
        ...GONE.map((route) => post(route.path, '{"session_id":"0f8e2b7a-3c1d-4e5f-9a6b-7c8d9e0f1a2b"}')),
        get('/v1/audio/health'), get('/health'), get('/v1/audio/story-archive/vinci/en', 'HEAD'), get('/nowhere'),
      ];
      for (const request of requests) await worker.fetch(request, h.env, h.ctx);
      await h.settle();
      assertEqual(h.fetched.length, 0, `calls: ${h.fetched.join(', ')}`);
    } finally {
      h.restore();
    }
  });

  // -------------------------------------------------------------------------
  // The archive quota's address hash: keyed with the worker secret
  // -------------------------------------------------------------------------

  const hex16 = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer).slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const unkeyed = async (text: string) =>
    hex16(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const hmac = async (secret: string, text: string) => {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    return hex16(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
  };

  await test('with the secret the address hash is an HMAC, per scope', async () => {
    const got = await hashIP('203.0.113.9', 'test-salt');
    assertEqual(got, await hmac('test-salt', 'audio-ratelimit:203.0.113.9'), 'HMAC-SHA-256 under the secret');
    assert(got !== await unkeyed('audio-ratelimit:203.0.113.9'), 'differs from the unkeyed hash');
    assert(got !== await hashIP('203.0.113.9', 'other-salt'), 'another secret, another hash');
    assert(got !== await hashIP('203.0.113.9', 'test-salt', 'archive-ratelimit'), 'the scopes stay apart');
    assertEqual(got.length, 16, 'same key width as before');
  });

  await test('without the secret the old hash is kept and one warning is logged', async () => {
    const warnings: string[] = [];
    const realWarn = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
    try {
      const a = await hashIP('203.0.113.9', undefined);
      const b = await hashIP('198.51.100.4', undefined, 'archive-ratelimit');
      assertEqual(a, await unkeyed('audio-ratelimit:203.0.113.9'), 'today\'s audio key');
      assertEqual(b, await unkeyed('archive-ratelimit:198.51.100.4'), 'today\'s archive key');
    } finally {
      console.warn = realWarn;
    }
    assertEqual(warnings.length, 1, 'one warning per isolate');
    assert(!warnings[0].includes('203.0.113.9'), 'the address is not logged');
  });

  // -------------------------------------------------------------------------
  // A fault inside the worker: a 500 with CORS and one line naming its kind
  // -------------------------------------------------------------------------

  const FAULT_IP = '203.0.113.47';
  const FAULT_SENTINEL = 'sentinel_fault_6d1';

  /** Run `fn` and return every console.error line it caused. */
  const errorLines = async (fn: () => Promise<void>): Promise<string[]> => {
    const lines: string[] = [];
    const realError = console.error;
    console.error = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
    try {
      await fn();
    } finally {
      console.error = realError;
    }
    return lines;
  };

  /** The worker with a quota store whose reads throw `thrown`. */
  const faultHarness = (thrown: unknown) => {
    const h = harness();
    const kv = {
      get: async () => { throw thrown; },
      put: async () => {},
    } as unknown as KVNamespace;
    return { ...h, env: { ...h.env, RATE_LIMITS: kv } as Env };
  };

  const archiveDownload = () => new Request('https://audio.agoracosmica.org/v1/audio/story-archive/vinci/en', {
    headers: { Origin: ORIGIN, 'CF-Connecting-IP': FAULT_IP },
  });

  await test('a fault on the archive route gets a 500 with CORS, logged by its kind and route only', async () => {
    const h = faultHarness(new Error(`KV GET failed: ${FAULT_SENTINEL} ${FAULT_IP}`));
    try {
      let res: Response | null = null;
      const logged = await errorLines(async () => {
        res = await worker.fetch(archiveDownload(), h.env, h.ctx).catch(() => null);
        await h.settle();
      });
      assert(res !== null, 'the fault was thrown out of fetch');
      const answer = res as unknown as Response;
      assertEqual(answer.status, 500, 'status');
      assertEqual(answer.headers.get('Access-Control-Allow-Origin'), ORIGIN, 'CORS on the answer');
      assertEqual(typeof (await answer.json() as { error?: string }).error, 'string', 'the usual error shape');
      assertEqual(logged.length, 1, `error lines: ${logged.join(' | ')}`);
      assert(logged[0].includes('Error'), `the kind is named: ${logged[0]}`);
      assert(logged[0].includes('/v1/audio/story-archive/'), `the route is named: ${logged[0]}`);
      const hash = await hashIP(FAULT_IP, 'test-salt', 'archive-ratelimit');
      for (const secret of [FAULT_SENTINEL, FAULT_IP, hash, 'KV GET failed', 'vinci']) {
        assert(!logged[0].includes(secret), `the line carries ${secret}: ${logged[0]}`);
      }
      assertEqual(h.fetched.length, 0, 'upstream calls');
    } finally {
      h.restore();
    }
  });

  await test('a thrown value that is not an Error is named by its type', async () => {
    const h = faultHarness(`${FAULT_SENTINEL} as a bare string`);
    try {
      let res: Response | null = null;
      const logged = await errorLines(async () => {
        res = await worker.fetch(archiveDownload(), h.env, h.ctx).catch(() => null);
        await h.settle();
      });
      assert(res !== null, 'the fault was thrown out of fetch');
      assertEqual((res as unknown as Response).status, 500, 'status');
      assertEqual(logged.length, 1, `error lines: ${logged.join(' | ')}`);
      assert(logged[0].includes('string'), `the type is named: ${logged[0]}`);
      assert(!logged[0].includes(FAULT_SENTINEL), `the value stays out of the log: ${logged[0]}`);
    } finally {
      h.restore();
    }
  });

  // -------------------------------------------------------------------------
  // CORS: only our own origins and our own Pages previews
  // -------------------------------------------------------------------------

  function originRequest(origin: string, method = 'GET'): Request {
    return new Request('https://audio.agoracosmica.org/v1/audio/speech', { method, headers: { Origin: origin } });
  }

  await test('the production origin is allowed', async () => {
    const env = fakeEnv();
    assertEqual(corsHeaders(originRequest('https://agoracosmica.org'), env)['Access-Control-Allow-Origin'], 'https://agoracosmica.org', 'ACAO');
    assertEqual(handlePreflight(originRequest('https://agoracosmica.org', 'OPTIONS'), env).status, 204, 'preflight');
  });

  await test('our own Pages previews are allowed', async () => {
    const env = fakeEnv();
    const preview = 'https://pr-1.agora-cosmica.pages.dev';
    assertEqual(corsHeaders(originRequest(preview), env)['Access-Control-Allow-Origin'], preview, 'ACAO');
    assertEqual(handlePreflight(originRequest(preview, 'OPTIONS'), env).status, 204, 'preflight');
  });

  await test('other pages.dev projects get no CORS', async () => {
    const env = fakeEnv();
    for (const evil of [
      'https://evil.pages.dev',
      'https://evil-agora-cosmica.pages.dev',
      'https://pr-1.agoracosmica.pages.dev',
      'http://pr-1.agora-cosmica.pages.dev',
    ]) {
      assertEqual(corsHeaders(originRequest(evil), env)['Access-Control-Allow-Origin'], undefined, `no ACAO for ${evil}`);
      assertEqual(handlePreflight(originRequest(evil, 'OPTIONS'), env).status, 403, `preflight refused for ${evil}`);
    }
  });

  // -------------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------------

  const failed = results.filter((r) => r.error);
  for (const r of results) {
    console.log(r.error ? `FAIL  ${r.name}\n      ${r.error}` : `ok    ${r.name}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  return failed.length;
}

// The runner is a plain script, so the failure count becomes the exit code.
const host = globalThis as { process?: { exitCode?: number } };
main().then(
  failures => { if (host.process && failures > 0) host.process.exitCode = 1; },
  err => {
    console.log(`FAIL  suite crashed: ${(err as Error).message}`);
    if (host.process) host.process.exitCode = 1;
  },
);
