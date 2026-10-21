// Worker unit tests. Run: pnpm test
//
// No framework: each case throws on failure and the runner reports the tally,
// so the suite runs anywhere tsx does. Same shape as the llm-proxy suite.

import { buildKokoroFallbackBody, QWEN_EN_TO_KOKORO } from '../src/ttsEngine';
import { proxyWithFailoverFromBuffer } from '../src/proxy';
import { getServers } from '../src/config';
import { getAggregatedHealth } from '../src/health';
import { checkAudioRateLimit, hashIP } from '../src/rateLimit';
import { corsHeaders, handlePreflight } from '../src/cors';
import worker from '../src/index';
import type { Env, ServerInfo } from '../src/types';

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

function fakeEnv(): Env {
  return {
    AUDIO_API_KEY: 'test-key',
    ALLOWED_ORIGINS: 'https://agoracosmica.org',
    SERVER_FSN1_URL: 'https://fsn1.example',
    SERVER_NBG1_URL: 'https://nbg1.example',
  } as unknown as Env;
}

const FSN1: ServerInfo = { id: 'fsn1', url: 'https://fsn1.example', health: null };
const NBG1: ServerInfo = { id: 'nbg1', url: 'https://nbg1.example', health: null };

function speechRequest(): Request {
  return new Request('https://audio.agoracosmica.org/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://agoracosmica.org' },
  });
}

function encode(body: unknown): ArrayBuffer {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function decodeVoice(init: RequestInit | undefined): string {
  const raw = new TextDecoder().decode(init?.body as ArrayBuffer);
  return (JSON.parse(raw) as { voice?: string }).voice ?? '';
}

interface UpstreamCall {
  url: string;
  voice: string;
}

/**
 * Stubs global fetch. `handler` answers per attempt; anything it throws becomes
 * a network failure, which is what a dead origin looks like from the worker.
 */
function stubFetch(
  handler: (call: UpstreamCall) => Response,
): { calls: UpstreamCall[]; restore: () => void } {
  const calls: UpstreamCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), voice: decodeVoice(init) };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const OK = () => new Response('audio', { status: 200, headers: { 'content-type': 'audio/webm' } });
const DOWN = () => new Response('qwen unavailable', { status: 503 });

// ---------------------------------------------------------------------------
// Fallback body construction
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  await test('English Qwen voice maps to its Kokoro counterpart', () => {
    const body = buildKokoroFallbackBody({ input: 'hello', voice: 'en_lyra', language: 'English' });
    assert(body !== null, 'expected a fallback body');
    const parsed = JSON.parse(new TextDecoder().decode(body!)) as Record<string, unknown>;
    assertEqual(parsed.voice, QWEN_EN_TO_KOKORO.en_lyra, 'voice rewritten');
    assertEqual(parsed.input, 'hello', 'text preserved');
    assertEqual(parsed.language, 'English', 'language preserved');
  });

  await test('two origins stay two', () => {
    const s = getServers(fakeEnv());
    assertEqual(s.fsn1.url, 'https://fsn1.example', 'fsn1 kept');
    assertEqual(s.nbg1.url, 'https://nbg1.example', 'nbg1 kept');
  });

  await test('an empty origin hands both slots to the one left', () => {
    const noNbg1 = getServers({ ...fakeEnv(), SERVER_NBG1_URL: '' } as Env);
    assertEqual(noNbg1.nbg1.url, 'https://fsn1.example', 'nbg1 slot goes to fsn1');
    assertEqual(noNbg1.nbg1.id, 'fsn1', 'labelled by the server that answers');
    const noFsn1 = getServers({ ...fakeEnv(), SERVER_FSN1_URL: '' } as Env);
    assertEqual(noFsn1.fsn1.url, 'https://nbg1.example', 'fsn1 slot goes to nbg1');
    assertEqual(noFsn1.fsn1.id, 'nbg1', 'labelled by the server that answers');
  });

  await test('one origin in both slots is asked once, not twice', async () => {
    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response('down', { status: 503 });
    }) as typeof fetch;
    try {
      const res = await proxyWithFailoverFromBuffer(encode({ input: 'hi' }), speechRequest(), FSN1, FSN1, fakeEnv(), 1000);
      assertEqual(res.status, 502, 'both-down answer');
      assertEqual(calls.length, 1, 'a single upstream call');
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  await test('one origin left reports one server, not a healthy second box', async () => {
    const kv = new Map<string, string>();
    const env = {
      ...fakeEnv(),
      SERVER_NBG1_URL: '',
      HEALTH_CACHE: { get: async (k: string) => kv.get(k) ?? null, put: async (k: string, v: string) => { kv.set(k, v); } },
    } as unknown as Env;
    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ gpu_slots: { available: 2, max: 4 } }), { status: 200 });
    }) as typeof fetch;
    try {
      const body = (await (await getAggregatedHealth(env)).json()) as { servers: Record<string, { status: string }> };
      assertEqual(Object.keys(body.servers).join(','), 'fsn1', 'only the server that answers');
      assertEqual(body.servers.fsn1.status, 'healthy', 'fsn1 healthy');
      assertEqual(calls.length, 1, 'probed once');
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  await test('every mapped Qwen voice has a non-empty Kokoro id', () => {
    for (const [qwen, kokoro] of Object.entries(QWEN_EN_TO_KOKORO)) {
      assert(kokoro.length > 0, `${qwen} has no counterpart`);
      assert(!kokoro.startsWith('en_'), `${qwen} maps to another Qwen id`);
    }
  });

  await test('the whole council-capable cast is mapped', () => {
    const cast = [
      'en_lyra', 'en_andromeda', 'en_astra', 'en_vega', 'en_ceres',
      'en_solaris', 'en_phoenix', 'en_hyperion', 'en_umbra', 'en_corvus',
    ];
    for (const id of cast) {
      assert(QWEN_EN_TO_KOKORO[id], `${id} has no fallback, a council would lose it`);
    }
    assertEqual(Object.keys(QWEN_EN_TO_KOKORO).length, cast.length, 'no stray entries');
  });

  await test('distinct Qwen voices degrade to distinct Kokoro voices', () => {
    // A council seats up to 4 figures. If two of them collapsed onto one Kokoro
    // voice during an outage the transcript would stop being followable.
    const targets = Object.values(QWEN_EN_TO_KOKORO);
    assertEqual(new Set(targets).size, targets.length, 'two Qwen voices share a Kokoro voice');
  });

  await test('German never degrades', () => {
    const body = buildKokoroFallbackBody({ input: 'hallo', voice: 'en_lyra', language: 'German' });
    assertEqual(body, null, 'German must not fall back');
  });

  await test('a Kokoro request has nothing to degrade to', () => {
    assertEqual(buildKokoroFallbackBody({ voice: 'af_heart', language: 'English' }), null, 'no fallback');
  });

  await test('an unknown Qwen voice has no fallback', () => {
    assertEqual(buildKokoroFallbackBody({ voice: 'en_unmapped', language: 'English' }), null, 'no fallback');
  });

  await test('an unparsed body has no fallback', () => {
    assertEqual(buildKokoroFallbackBody(null), null, 'no fallback');
  });

  // -------------------------------------------------------------------------
  // Failover + degrade path
  // -------------------------------------------------------------------------

  await test('a healthy Qwen request never reaches the fallback', async () => {
    const stub = stubFetch(OK);
    try {
      const body = encode({ input: 'hi', voice: 'en_lyra', language: 'English' });
      const res = await proxyWithFailoverFromBuffer(
        body, speechRequest(), FSN1, NBG1, fakeEnv(), 5000,
        buildKokoroFallbackBody({ input: 'hi', voice: 'en_lyra', language: 'English' }),
      );
      assertEqual(res.status, 200, 'primary answered');
      assertEqual(stub.calls.length, 1, 'one upstream call');
      assertEqual(stub.calls[0].voice, 'en_lyra', 'original voice kept');
      assertEqual(res.headers.get('X-TTS-Engine-Fallback'), null, 'no fallback marker');
    } finally {
      stub.restore();
    }
  });

  await test('the second origin is tried before the engine falls back', async () => {
    const stub = stubFetch((call) => (call.url.startsWith('https://fsn1') ? DOWN() : OK()));
    try {
      const body = encode({ input: 'hi', voice: 'en_solaris', language: 'English' });
      const res = await proxyWithFailoverFromBuffer(
        body, speechRequest(), FSN1, NBG1, fakeEnv(), 5000,
        buildKokoroFallbackBody({ input: 'hi', voice: 'en_solaris', language: 'English' }),
      );
      assertEqual(res.status, 200, 'nbg1 answered');
      assertEqual(res.headers.get('X-Audio-Server'), 'nbg1', 'served by the second origin');
      assertEqual(stub.calls.length, 2, 'two upstream calls');
      assert(stub.calls.every((c) => c.voice === 'en_solaris'), 'Qwen voice kept on both attempts');
    } finally {
      stub.restore();
    }
  });

  await test('Qwen down on both origins retries as Kokoro', async () => {
    const stub = stubFetch((call) => (call.voice.startsWith('en_') ? DOWN() : OK()));
    try {
      const body = encode({ input: 'hi', voice: 'en_lyra', language: 'English' });
      const res = await proxyWithFailoverFromBuffer(
        body, speechRequest(), FSN1, NBG1, fakeEnv(), 5000,
        buildKokoroFallbackBody({ input: 'hi', voice: 'en_lyra', language: 'English' }),
      );
      assertEqual(res.status, 200, 'the visitor still gets audio');
      assertEqual(res.headers.get('X-TTS-Engine-Fallback'), 'kokoro', 'fallback marked');
      assertEqual(stub.calls.length, 3, 'two Qwen attempts then one Kokoro');
      assertEqual(stub.calls[2].voice, QWEN_EN_TO_KOKORO.en_lyra, 'retried with the Kokoro voice');
    } finally {
      stub.restore();
    }
  });

  await test('the Kokoro retry itself fails over to the second origin', async () => {
    const stub = stubFetch((call) => {
      if (call.voice.startsWith('en_')) return DOWN();
      return call.url.startsWith('https://fsn1') ? DOWN() : OK();
    });
    try {
      const body = encode({ input: 'hi', voice: 'en_lyra', language: 'English' });
      const res = await proxyWithFailoverFromBuffer(
        body, speechRequest(), FSN1, NBG1, fakeEnv(), 5000,
        buildKokoroFallbackBody({ input: 'hi', voice: 'en_lyra', language: 'English' }),
      );
      assertEqual(res.status, 200, 'nbg1 served the Kokoro retry');
      assertEqual(res.headers.get('X-Audio-Server'), 'nbg1', 'second origin');
      assertEqual(stub.calls.length, 4, 'two Qwen attempts then two Kokoro attempts');
    } finally {
      stub.restore();
    }
  });

  await test('a whole fleet outage still answers 502', async () => {
    const stub = stubFetch(DOWN);
    try {
      const body = encode({ input: 'hi', voice: 'en_lyra', language: 'English' });
      const res = await proxyWithFailoverFromBuffer(
        body, speechRequest(), FSN1, NBG1, fakeEnv(), 5000,
        buildKokoroFallbackBody({ input: 'hi', voice: 'en_lyra', language: 'English' }),
      );
      assertEqual(res.status, 502, 'both stacks gone');
      assertEqual(stub.calls.length, 4, 'four attempts before giving up');
    } finally {
      stub.restore();
    }
  });

  await test('without a degraded body the failover behaves exactly as before', async () => {
    const stub = stubFetch(DOWN);
    try {
      const body = encode({ input: 'hi', voice: 'af_heart', language: 'English' });
      const res = await proxyWithFailoverFromBuffer(
        body, speechRequest(), FSN1, NBG1, fakeEnv(), 5000, null,
      );
      assertEqual(res.status, 502, 'both origins failed');
      assertEqual(stub.calls.length, 2, 'no extra attempts');
    } finally {
      stub.restore();
    }
  });

  await test('a network failure counts as a dead origin', async () => {
    const original = globalThis.fetch;
    const seen: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const voice = decodeVoice(init);
      seen.push(voice);
      if (voice.startsWith('en_')) throw new Error('connection reset');
      return OK();
    }) as typeof fetch;
    try {
      const body = encode({ input: 'hi', voice: 'en_solaris', language: 'English' });
      const res = await proxyWithFailoverFromBuffer(
        body, speechRequest(), FSN1, NBG1, fakeEnv(), 5000,
        buildKokoroFallbackBody({ input: 'hi', voice: 'en_solaris', language: 'English' }),
      );
      assertEqual(res.status, 200, 'Kokoro answered after two dropped connections');
      assertEqual(seen.length, 3, 'two Qwen attempts then one Kokoro');
    } finally {
      globalThis.fetch = original;
    }
  });

  // -------------------------------------------------------------------------
  // The rate limiter's address hash: keyed with the worker secret
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

  await test('the limiter\'s counter keys carry the keyed hash', async () => {
    const puts: string[] = [];
    const kv = {
      get: async () => null,
      put: async (key: string) => { puts.push(key); },
    } as unknown as KVNamespace;
    const env = { ...fakeEnv(), RATE_LIMITS: kv, IP_HASH_SALT: 'test-salt' } as Env;
    const req = new Request('https://audio.agoracosmica.org/v1/audio/speech', {
      method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.9' },
    });
    const result = await checkAudioRateLimit(req, env, 'en', 'tts');
    assertEqual(result.allowed, true, 'allowed');
    const keyed = await hmac('test-salt', 'audio-ratelimit:203.0.113.9');
    assertEqual(puts.length, 2, 'daily and burst counters');
    assert(puts.every(key => key.includes(keyed)), 'both keys use the keyed hash');
    assert(puts.every(key => !key.includes('203.0.113.9')), 'no plain address in a key');
  });

  // -------------------------------------------------------------------------
  // STT size gate: before any counter moves, and a bounded read behind it
  // -------------------------------------------------------------------------

  // The gate's contract, written out so the suite also runs against a tree
  // that predates the gate.
  const STT_LIMIT = 15 * 1024 * 1024;

  /** The worker with recorded counter writes and upstream calls. */
  const sttHarness = () => {
    const puts: string[] = [];
    const rateLimits = {
      get: async () => null,
      put: async (key: string) => { puts.push(key); },
    } as unknown as KVNamespace;
    // A fresh snapshot, so the health refresh never probes the origins.
    const healthCache = {
      get: async () => JSON.stringify({ fsn1: null, nbg1: null, updatedAt: Date.now() }),
      put: async () => {},
    } as unknown as KVNamespace;
    const env = {
      ...fakeEnv(),
      RATE_LIMITS: rateLimits,
      HEALTH_CACHE: healthCache,
      ANALYTICS: { writeDataPoint: () => {} },
    } as unknown as Env;
    const pending: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (work: Promise<unknown>) => { pending.push(work); },
      passThroughOnException: () => {},
    } as unknown as ExecutionContext;
    const upstream: { url: string; bytes: number }[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      upstream.push({ url: String(input), bytes: (init?.body as ArrayBuffer | undefined)?.byteLength ?? 0 });
      return new Response(JSON.stringify({ text: 'hello' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const restore = () => { globalThis.fetch = original; };
    return { env, ctx, pending, puts, upstream, restore };
  };

  const upload = (
    body: Uint8Array | ReadableStream<Uint8Array>,
    headers: Record<string, string> = {},
  ): Request => new Request('https://audio.agoracosmica.org/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'audio/webm', Origin: 'https://agoracosmica.org', 'CF-Connecting-IP': '203.0.113.9', ...headers },
    body,
    // Node needs this for a streamed body; the Workers runtime ignores it.
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  } as RequestInit);

  const chunkedUpload = (bytes: number): ReadableStream<Uint8Array> => new ReadableStream<Uint8Array>({
    start(controller) {
      for (let sent = 0; sent < bytes; sent += 1024 * 1024) {
        controller.enqueue(new Uint8Array(Math.min(1024 * 1024, bytes - sent)));
      }
      controller.close();
    },
  });

  await test('an upload one byte over the limit gets a 413 before any counter moves', async () => {
    const h = sttHarness();
    try {
      const res = await worker.fetch(upload(new Uint8Array(STT_LIMIT + 1), { 'Content-Length': String(STT_LIMIT + 1) }), h.env, h.ctx);
      assertEqual(res.status, 413, 'status');
      assertEqual(res.headers.get('Access-Control-Allow-Origin'), 'https://agoracosmica.org', 'CORS on the refusal');
      assertEqual(typeof (await res.json() as { error?: string }).error, 'string', 'the usual error shape');
      assertEqual(h.puts.length, 0, 'counter writes');
      assertEqual(h.upstream.length, 0, 'upstream calls');
      await Promise.all(h.pending);
    } finally {
      h.restore();
    }
  });

  await test('an upload at the limit is forwarded whole', async () => {
    const h = sttHarness();
    try {
      const res = await worker.fetch(upload(new Uint8Array(STT_LIMIT), { 'Content-Length': String(STT_LIMIT) }), h.env, h.ctx);
      assertEqual(res.status, 200, 'status');
      assertEqual(h.puts.length, 2, 'daily and burst counters');
      assertEqual(h.upstream.length, 1, 'one upstream call');
      assertEqual(h.upstream[0].bytes, STT_LIMIT, 'bytes forwarded');
      await Promise.all(h.pending);
    } finally {
      h.restore();
    }
  });

  await test('a chunked upload over the limit is stopped by the bounded read', async () => {
    const h = sttHarness();
    try {
      const res = await worker.fetch(upload(chunkedUpload(STT_LIMIT + 1)), h.env, h.ctx);
      assertEqual(res.status, 413, 'status');
      assertEqual(h.puts.length, 0, 'counter writes');
      assertEqual(h.upstream.length, 0, 'upstream calls');
      await Promise.all(h.pending);
    } finally {
      h.restore();
    }
  });

  await test('a chunked upload under the limit is forwarded whole', async () => {
    const h = sttHarness();
    try {
      const res = await worker.fetch(upload(chunkedUpload(3 * 1024 * 1024 + 5)), h.env, h.ctx);
      assertEqual(res.status, 200, 'status');
      assertEqual(h.upstream[0].bytes, 3 * 1024 * 1024 + 5, 'bytes forwarded');
      await Promise.all(h.pending);
    } finally {
      h.restore();
    }
  });

  await test('an upload larger than its declared length is still stopped at the limit', async () => {
    const h = sttHarness();
    try {
      const res = await worker.fetch(upload(new Uint8Array(STT_LIMIT + 1), { 'Content-Length': '1000' }), h.env, h.ctx);
      assertEqual(res.status, 413, 'status');
      assertEqual(h.puts.length, 0, 'counter writes');
      assertEqual(h.upstream.length, 0, 'upstream calls');
      await Promise.all(h.pending);
    } finally {
      h.restore();
    }
  });

  // -------------------------------------------------------------------------
  // STT order: a visitor at a limit is refused before the upload is read
  // -------------------------------------------------------------------------

  /** The STT harness with one counter already at its limit, and every KV read recorded. */
  const limitedHarness = (counter: 'daily' | 'burst' | 'none') => {
    const h = sttHarness();
    const reads: string[] = [];
    const putsAtPull: number[] = [];
    let pulledNow = () => 0;
    const kv = {
      get: async (key: string) => {
        reads.push(key);
        if (counter === 'daily' && key.startsWith('audio:ip:')) return '500';
        if (counter === 'burst' && key.startsWith('audio:burst:')) return '60';
        return null;
      },
      put: async (key: string) => { h.puts.push(key); putsAtPull.push(pulledNow()); },
    } as unknown as KVNamespace;
    const env = { ...h.env, RATE_LIMITS: kv } as Env;
    return { ...h, env, reads, putsAtPull, watch: (pulled: () => number) => { pulledNow = pulled; } };
  };

  /** An upload of `chunks` MiB that hands out a chunk only when the worker reads one. */
  const countedUpload = (chunks: number): { stream: ReadableStream<Uint8Array>; pulled: () => number } => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled >= chunks) { controller.close(); return; }
        pulled++;
        controller.enqueue(new Uint8Array(1024 * 1024));
      },
    }, { highWaterMark: 0 });
    return { stream, pulled: () => pulled };
  };

  for (const counter of ['daily', 'burst'] as const) {
    await test(`a visitor at the ${counter} limit gets the 429 before the upload is read`, async () => {
      const h = limitedHarness(counter);
      try {
        const body = countedUpload(4);
        const res = await worker.fetch(upload(body.stream), h.env, h.ctx);
        assertEqual(res.status, 429, 'status');
        assertEqual((await res.json() as { code?: string }).code, `${counter}_limit`, 'refusal code');
        assertEqual(body.pulled(), 0, 'upload chunks read');
        assertEqual(h.puts.length, 0, 'counter writes');
        assertEqual(h.upstream.length, 0, 'upstream calls');
        await Promise.all(h.pending);
      } finally {
        h.restore();
      }
    });
  }

  await test('a declared oversized upload from a visitor at a limit still gets the 413, before any counter is read', async () => {
    const h = limitedHarness('daily');
    try {
      const res = await worker.fetch(upload(new Uint8Array(16), { 'Content-Length': String(STT_LIMIT + 1) }), h.env, h.ctx);
      assertEqual(res.status, 413, 'status');
      assertEqual(h.reads.length, 0, 'counter reads');
      assertEqual(h.puts.length, 0, 'counter writes');
      await Promise.all(h.pending);
    } finally {
      h.restore();
    }
  });

  await test('an allowed upload is counted once, after the whole upload was read', async () => {
    const h = limitedHarness('none');
    try {
      const body = countedUpload(3);
      h.watch(body.pulled);
      const res = await worker.fetch(upload(body.stream), h.env, h.ctx);
      assertEqual(res.status, 200, 'status');
      assertEqual(h.puts.length, 2, 'daily and burst counters');
      assert(h.putsAtPull.every(at => at === 3), `chunks read when the counters moved: ${h.putsAtPull.join(', ')}`);
      assertEqual(h.upstream[0].bytes, 3 * 1024 * 1024, 'bytes forwarded');
      await Promise.all(h.pending);
    } finally {
      h.restore();
    }
  });

  await test('an upload that breaks off moves no counter', async () => {
    const h = limitedHarness('none');
    try {
      let reads = 0;
      const broken = new ReadableStream<Uint8Array>({
        pull(c) {
          if (reads++ === 0) c.enqueue(new Uint8Array(1024));
          else c.error(new Error('the upload broke off'));
        },
      });
      await worker.fetch(upload(broken), h.env, h.ctx).then(() => undefined, () => undefined);
      assertEqual(h.puts.length, 0, 'counter writes');
      assertEqual(h.upstream.length, 0, 'upstream calls');
      await Promise.all(h.pending);
    } finally {
      h.restore();
    }
  });

  // -------------------------------------------------------------------------
  // Session-end beacon: a bounded read, the route's own answer otherwise
  // -------------------------------------------------------------------------

  // The cap's contract, written out so the suite also runs against a tree that predates it.
  const SESSION_END_LIMIT = 16 * 1024;
  const SESSION_ID = '0f8e2b7a-3c1d-4e5f-9a6b-7c8d9e0f1a2b';

  /** A session-end body padded with an ignored field to exactly `bytes` bytes. */
  const sessionEndBody = (bytes: number): Uint8Array => {
    const bare = JSON.stringify({ session_id: SESSION_ID, pad: '' });
    const encoded = new TextEncoder().encode(JSON.stringify({ session_id: SESSION_ID, pad: 'x'.repeat(bytes - bare.length) }));
    assertEqual(encoded.length, bytes, 'padded body size');
    return encoded;
  };

  const sessionEnd = (
    body: string | Uint8Array | ReadableStream<Uint8Array>,
    headers: Record<string, string> = {},
  ): Request => new Request('https://audio.agoracosmica.org/v1/audio/session/end', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://agoracosmica.org', ...headers },
    body,
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  } as RequestInit);

  const evictions = (h: ReturnType<typeof sttHarness>) => h.upstream.filter(call => call.url.endsWith('/v1/audio/session/end'));

  await test('a session-end beacon one byte over its cap gets a 413, and nothing is sent on', async () => {
    const h = sttHarness();
    try {
      const body = sessionEndBody(SESSION_END_LIMIT + 1);
      const res = await worker.fetch(sessionEnd(body, { 'Content-Length': String(body.length) }), h.env, h.ctx);
      assertEqual(res.status, 413, 'status');
      assertEqual(res.headers.get('Access-Control-Allow-Origin'), 'https://agoracosmica.org', 'CORS on the refusal');
      assertEqual((await res.json() as { error?: string }).error, 'Request body too large', 'the usual error shape');
      await Promise.all(h.pending);
      assertEqual(evictions(h).length, 0, 'eviction calls');
    } finally {
      h.restore();
    }
  });

  await test('a chunked session-end beacon over its cap is stopped by the bounded read', async () => {
    const h = sttHarness();
    try {
      const bytes = sessionEndBody(SESSION_END_LIMIT + 1);
      const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close(); } });
      const res = await worker.fetch(sessionEnd(stream), h.env, h.ctx);
      assertEqual(res.status, 413, 'status');
      await Promise.all(h.pending);
      assertEqual(evictions(h).length, 0, 'eviction calls');
    } finally {
      h.restore();
    }
  });

  await test('a session-end beacon at its cap still evicts its session', async () => {
    const h = sttHarness();
    try {
      const body = sessionEndBody(SESSION_END_LIMIT);
      const res = await worker.fetch(sessionEnd(body, { 'Content-Length': String(body.length) }), h.env, h.ctx);
      assertEqual(res.status, 204, 'status');
      await Promise.all(h.pending);
      assertEqual(evictions(h).length, 1, 'eviction calls');
    } finally {
      h.restore();
    }
  });

  await test('a bad or broken session-end beacon still gets its quiet 204', async () => {
    const broken = (): ReadableStream<Uint8Array> => {
      let reads = 0;
      return new ReadableStream<Uint8Array>({
        pull(c) {
          if (reads++ === 0) c.enqueue(new TextEncoder().encode('{"session_id":"0f8e'));
          else c.error(new Error('the upload broke off'));
        },
      });
    };
    for (const body of ['{"session_id":', 'null', broken()]) {
      const h = sttHarness();
      try {
        const res = await worker.fetch(sessionEnd(body), h.env, h.ctx);
        assertEqual(res.status, 204, 'status');
        await Promise.all(h.pending);
        assertEqual(evictions(h).length, 0, 'eviction calls');
      } finally {
        h.restore();
      }
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
