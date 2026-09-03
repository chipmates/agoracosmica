// Worker unit tests. Run: pnpm test
//
// No framework: each case throws on failure and the runner reports the tally,
// so the suite runs anywhere tsx does. Same shape as the llm-proxy suite.

import { buildKokoroFallbackBody, QWEN_EN_TO_KOKORO } from '../src/ttsEngine';
import { proxyWithFailoverFromBuffer } from '../src/proxy';
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
