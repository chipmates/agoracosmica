// Worker unit tests. Run: pnpm test
//
// No framework: each case throws on failure and the runner reports the tally,
// so the suite runs anywhere tsx does. Same shape as the llm-proxy suite.

import { hashIP } from '../src/rateLimit';
import { EXPIRATION_FLOOR_SECONDS, endsWithWindow, utcDay, utcMinute } from '../src/counterWindow';
import { handleStoryArchive } from '../src/storyArchive';
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
  // Counter windows: each address key names its UTC day or minute and expires
  // with it, however often it is counted
  // -------------------------------------------------------------------------

  /** Run with Date.now held at one instant, so a counter's window is known. */
  const atInstant = async <T>(ms: number, fn: () => Promise<T>): Promise<T> => {
    const realNow = Date.now;
    Date.now = () => ms;
    try {
      return await fn();
    } finally {
      Date.now = realNow;
    }
  };
  type KvWrite = { key: string; options?: KVNamespacePutOptions };
  const recordingKv = (): { kv: KVNamespace; writes: KvWrite[] } => {
    const store = new Map<string, string>();
    const writes: KvWrite[] = [];
    const kv = {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string, options?: KVNamespacePutOptions) => {
        writes.push({ key, options });
        store.set(key, value);
      },
    } as unknown as KVNamespace;
    return { kv, writes };
  };
  const DAY_END_S = Date.UTC(2026, 9, 31) / 1000;
  /** A minute key's write: on its own minute, at least KV's floor ahead, at most the floor past its minute. */
  const assertMinuteWrite = (write: KvWrite, prefix: string, now: number): void => {
    const minute = Math.floor(now / 60_000);
    assertEqual(write.key, `${prefix}:${minute}`, 'the minute key names its minute');
    const expiration = write.options?.expiration ?? 0;
    assert(expiration * 1000 - now >= 60_000, `${write.key}: ${expiration} is under KV's floor`);
    assert(expiration <= (minute + 1) * 60 + EXPIRATION_FLOOR_SECONDS, `${write.key}: ${expiration} runs past the floor`);
    assertEqual(write.options?.expirationTtl, undefined, `${write.key} has no TTL that a write renews`);
  };

  await test('the windows are UTC days and minutes, and an expiry never sits under KV\'s floor', () => {
    const day = utcDay(Date.UTC(2026, 9, 30, 23, 59, 59, 999));
    assertEqual(day.label, '2026-10-30', 'the last instant of a day');
    assertEqual(day.endMs, Date.UTC(2026, 9, 31), 'the day ends at the next UTC midnight');
    assertEqual(utcDay(Date.UTC(2026, 9, 31)).label, '2026-10-31', 'midnight opens the next day');
    const at = Date.UTC(2026, 9, 30, 10, 15, 42);
    const minute = utcMinute(at);
    assertEqual(minute.label, String(Math.floor(at / 60_000)), 'the minute keeps its label');
    assertEqual(minute.endMs, Date.UTC(2026, 9, 30, 10, 16), 'the minute ends at the next full minute');
    assertEqual(endsWithWindow(day, Date.UTC(2026, 9, 30, 12)).expiration, DAY_END_S, 'mid-day: the day\'s end');
    const checks: [typeof day, number][] = [[day, day.endMs - 120_000], [minute, minute.endMs - 60_000]];
    for (const [window, from] of checks) {
      for (let now = from; now < window.endMs; now += 250) {
        const { expiration } = endsWithWindow(window, now);
        assert(expiration * 1000 - now >= 60_000, `${window.label} at ${now}: ${expiration} is under KV's floor`);
        assert(expiration <= window.endMs / 1000 + EXPIRATION_FLOOR_SECONDS, `${window.label} at ${now}: past the floor`);
      }
    }
  });

  await test('the expiry floor keeps 70 seconds in hand, ten more than KV\'s 60', () => {
    const day = utcDay(Date.UTC(2026, 9, 30, 12));
    assertEqual(endsWithWindow(day, day.endMs - 30_000).expiration, DAY_END_S + 40, '30 s before the end: 70 s after the write');
    assertEqual(endsWithWindow(day, day.endMs - 65_000).expiration, DAY_END_S + 5, '65 s before the end: 70 s after the write');
    assertEqual(endsWithWindow(day, day.endMs - 70_000).expiration, DAY_END_S, '70 s before the end: the day\'s own end');
    const at = Date.UTC(2026, 9, 30, 10, 15);
    assertEqual(endsWithWindow(utcMinute(at), at).expiration, at / 1000 + 70, 'a minute key: 70 s after its write');
  });

  // The boundary inside one request: the runtime's clock moves on across I/O,
  // so a count read just before a window's end can reach its write after it.

  /** Run `fn` against a KV whose every read moves the clock from `from` to `to`. */
  const acrossBoundary = async (
    from: number,
    to: number,
    fn: (kv: KVNamespace) => Promise<unknown>,
  ): Promise<{ reads: string[]; writes: KvWrite[] }> => {
    const store = new Map<string, string>();
    const reads: string[] = [];
    const writes: KvWrite[] = [];
    let clock = from;
    const kv = {
      get: async (key: string) => {
        reads.push(key);
        clock = to;
        return store.get(key) ?? null;
      },
      put: async (key: string, value: string, options?: KVNamespacePutOptions) => {
        writes.push({ key, options });
        store.set(key, value);
      },
    } as unknown as KVNamespace;
    const realNow = Date.now;
    Date.now = () => clock;
    try {
      await fn(kv);
    } finally {
      Date.now = realNow;
    }
    return { reads, writes };
  };

  const CROSS_IP = '203.0.113.47';
  const crossEnv = (kv: KVNamespace) => ({
    ...fakeEnv(),
    RATE_LIMITS: kv,
    IP_HASH_SALT: 'test-salt',
    STORY_BUCKET: { list: async () => ({ objects: [], truncated: false }) },
  }) as unknown as Env;
  const BEFORE_MIDNIGHT = Date.UTC(2026, 9, 30, 23, 59, 59, 900);
  const AFTER_MIDNIGHT = Date.UTC(2026, 9, 31, 0, 0, 0, 100);

  await test('an archive count read before midnight and reaching the write after it writes nothing', async () => {
    const download = new Request('https://audio.agoracosmica.org/v1/audio/story-archive/socrates/en', {
      headers: { 'CF-Connecting-IP': CROSS_IP, Origin: 'https://agoracosmica.org' },
    });
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;
    let status = 0;
    const { reads, writes } = await acrossBoundary(BEFORE_MIDNIGHT, AFTER_MIDNIGHT, async kv => {
      status = (await handleStoryArchive(download, crossEnv(kv), ctx, 'socrates/en', 'DE')).status;
    });
    assertEqual(status, 404, 'counted, then nothing published to send');
    const keyed = await hmac('test-salt', `archive-ratelimit:${CROSS_IP}`);
    assert(reads.includes(`archive:day:${keyed}:2026-10-30`), `the day it began in: ${reads.join(', ')}`);
    assertEqual(writes.map(w => w.key).join(', '), '', 'archive counter writes');
  });

  // A minute that ends in the middle of a day: only the minute's window is over.
  const BEFORE_MINUTE_END = Date.UTC(2026, 9, 30, 10, 41, 59, 900);
  const AFTER_MINUTE_END = Date.UTC(2026, 9, 30, 10, 42, 0, 100);
  const OLD_MINUTE = Math.floor(BEFORE_MINUTE_END / 60_000);

  await test('an archive count read before a minute\'s end and written after it skips the minute and writes the day', async () => {
    const download = new Request('https://audio.agoracosmica.org/v1/audio/story-archive/socrates/en', {
      headers: { 'CF-Connecting-IP': CROSS_IP, Origin: 'https://agoracosmica.org' },
    });
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;
    let status = 0;
    const { reads, writes } = await acrossBoundary(BEFORE_MINUTE_END, AFTER_MINUTE_END, async kv => {
      status = (await handleStoryArchive(download, crossEnv(kv), ctx, 'socrates/en', 'DE')).status;
    });
    assertEqual(status, 404, 'counted, then nothing published to send');
    const keyed = await hmac('test-salt', `archive-ratelimit:${CROSS_IP}`);
    assert(reads.includes(`archive:min:${keyed}:${OLD_MINUTE}`), `the minute it began in: ${reads.join(', ')}`);
    assertEqual(writes.map(w => w.key).join(', '), `archive:day:${keyed}:2026-10-30`, 'archive counter writes');
    assertEqual(writes[0]?.options?.expiration, DAY_END_S, 'the day key still ends with its day');
  });

  await test('the archive quota keys name their window and expire at its end', async () => {
    const { kv, writes } = recordingKv();
    const env = {
      ...fakeEnv(),
      RATE_LIMITS: kv,
      IP_HASH_SALT: 'test-salt',
      STORY_BUCKET: { list: async () => ({ objects: [], truncated: false }) },
      ANALYTICS: { writeDataPoint: () => {} },
    } as unknown as Env;
    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;
    const download = () => new Request('https://audio.agoracosmica.org/v1/audio/story-archive/socrates/en', {
      headers: { 'CF-Connecting-IP': '203.0.113.45', Origin: 'https://agoracosmica.org' },
    });
    const times = [Date.UTC(2026, 9, 30, 8, 0, 10), Date.UTC(2026, 9, 30, 19, 30)];
    for (const now of times) {
      const res = await atInstant(now, () => handleStoryArchive(download(), env, ctx, 'socrates/en', 'DE'));
      assertEqual(res.status, 404, 'counted, then nothing published to send');
    }
    const keyed = await hmac('test-salt', 'archive-ratelimit:203.0.113.45');
    const days = writes.filter(w => w.key.startsWith('archive:day:'));
    assertEqual(days.length, 2, `day writes: ${writes.map(w => w.key).join(', ')}`);
    for (const write of days) {
      assertEqual(write.key, `archive:day:${keyed}:2026-10-30`, 'the day key names its day');
      assertEqual(write.options?.expiration, DAY_END_S, 'and expires at the day\'s end');
      assertEqual(write.options?.expirationTtl, undefined, 'no TTL that a write renews');
    }
    assertEqual(await kv.get(`archive:day:${keyed}:2026-10-30`), '2', 'both downloads counted under one key');
    const minutes = writes.filter(w => w.key.startsWith('archive:min:'));
    assertEqual(minutes.length, 2, 'one minute write per download');
    minutes.forEach((write, i) => assertMinuteWrite(write, `archive:min:${keyed}`, times[i]));
  });

  // -------------------------------------------------------------------------
  // A refused counter write: KV takes one write per key per second, so a
  // second download from one address within a second has its counts refused
  // -------------------------------------------------------------------------

  const REFUSED_IP = '203.0.113.48';

  /** Run `fn` and return every console.warn line it caused. */
  const warnLines = async (fn: () => Promise<void>): Promise<string[]> => {
    const lines: string[] = [];
    const realWarn = console.warn;
    console.warn = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
    try {
      await fn();
    } finally {
      console.warn = realWarn;
    }
    return lines;
  };

  /** A KV that takes one write per key per second, by the worker's clock, and throws KV's 429 on a second. */
  const oneWritePerSecondKv = (): { kv: KVNamespace; refused: string[] } => {
    const store = new Map<string, string>();
    const lastWrite = new Map<string, number>();
    const refused: string[] = [];
    const kv = {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        const last = lastWrite.get(key);
        if (last !== undefined && Date.now() - last < 1000) {
          refused.push(key);
          throw new Error('KV PUT failed: 429 Too Many Requests');
        }
        lastWrite.set(key, Date.now());
        store.set(key, value);
      },
    } as unknown as KVNamespace;
    return { kv, refused };
  };

  await test('a second archive download from one address within a second is refused like one over the quota', async () => {
    const { kv, refused } = oneWritePerSecondKv();
    const rows: unknown[][] = [];
    const uploaded = new Date(Date.UTC(2026, 0, 1));
    const objects = Array.from({ length: 13 }, (_, seed) => ({ key: `stories/socrates/en/socrates_${seed}_en.mp3`, size: 1, uploaded }));
    const env = {
      ...fakeEnv(),
      RATE_LIMITS: kv,
      IP_HASH_SALT: 'test-salt',
      STORY_BUCKET: {
        list: async () => ({ objects, truncated: false }),
        get: async () => ({ body: new Blob([new Uint8Array(1)]).stream() }),
      },
      ANALYTICS: { writeDataPoint: (row: { blobs: unknown[] }) => { rows.push(row.blobs); } },
    } as unknown as Env;
    // The runtime's FixedLengthStream, which Node lacks; the length is the route's own business.
    const host = globalThis as unknown as { FixedLengthStream?: unknown };
    const realStream = host.FixedLengthStream;
    host.FixedLengthStream = class extends TransformStream<Uint8Array, Uint8Array> {
      constructor(_length: number) { super(); }
    };
    try {
      const statuses: number[] = [];
      let refusal: { error?: string; cors: string | null } = { cors: null };
      const warned = await warnLines(() => atInstant(Date.UTC(2026, 9, 30, 10, 15), async () => {
        for (let i = 0; i < 2; i++) {
          const pending: Promise<unknown>[] = [];
          const ctx = {
            waitUntil: (work: Promise<unknown>) => { pending.push(work); },
            passThroughOnException: () => {},
          } as unknown as ExecutionContext;
          const res = await worker.fetch(new Request('https://audio.agoracosmica.org/v1/audio/story-archive/socrates/en', {
            headers: { 'CF-Connecting-IP': REFUSED_IP, Origin: 'https://agoracosmica.org' },
          }), env, ctx);
          statuses.push(res.status);
          if (res.status === 429) {
            refusal = { ...(await res.json() as { error?: string }), cors: res.headers.get('Access-Control-Allow-Origin') };
          } else {
            await res.body?.cancel();
          }
          await Promise.all(pending);
        }
      }));
      assertEqual(statuses.join(','), '200,429', 'statuses');
      assertEqual(refusal.error, 'Too many archive downloads. Please try again later.', 'the quota\'s own answer');
      assertEqual(refusal.cors, 'https://agoracosmica.org', 'with CORS');
      assertEqual(refused.length, 2, `the second download's day and minute writes were refused: ${refused.join(', ')}`);
      assertEqual(rows.filter(blobs => blobs[4] === 'story-archive').length, 1, 'archive rows written');
      const hash = await hashIP(REFUSED_IP, 'test-salt', 'archive-ratelimit');
      assertEqual(await kv.get(`archive:day:${hash}:2026-10-30`), '1', 'one download served, one counted');
      const lines = warned.filter(w => w.includes('[archive]'));
      assertEqual(lines.length, 2, `one line per refused write: ${warned.join(' | ')}`);
      for (const line of lines) {
        for (const secret of [REFUSED_IP, hash, 'archive:', 'KV PUT failed']) {
          assert(!line.includes(secret), `the line carries ${secret}: ${line}`);
        }
      }
    } finally {
      if (realStream === undefined) delete host.FixedLengthStream;
      else host.FixedLengthStream = realStream;
    }
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
