// Community worker tests. Run from workers/community with tsx, for example
// ../llm-proxy/node_modules/.bin/tsx test/run.ts
//
// No framework: each case throws on failure and the runner reports the tally.
// Same shape as the llm-proxy and audio-proxy suites.

import worker, { type Env } from '../src/index';

const results: { name: string; error?: string }[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name });
  } catch (err) {
    results.push({ name, error: (err as Error).message });
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`);
}

// In-memory KV with a log of every write.
function fakeKv() {
  const store = new Map<string, string>();
  const writes: { key: string; ttl?: number }[] = [];
  const kv = {
    async get(key: string, type?: 'json') {
      const raw = store.get(key);
      if (raw === undefined) return null;
      return type === 'json' ? JSON.parse(raw) : raw;
    },
    async put(key: string, value: string, opts?: { expirationTtl?: number }) {
      store.set(key, value);
      writes.push({ key, ttl: opts?.expirationTtl });
    },
  };
  return { kv, store, writes };
}

const SALT = 'test-salt';
const IP = '203.0.113.7';
const ORIGIN = 'https://agoracosmica.org';

async function sha256(input: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function envWith(kv: ReturnType<typeof fakeKv>['kv']): Env {
  return { COMMUNITY_KV: kv, ALLOWED_ORIGINS: ORIGIN, IP_SALT: SALT } as unknown as Env;
}

function powerRequest(deviceId: string, power = 2): Request {
  return new Request('https://community.example/v1/community/power', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'cf-connecting-ip': IP },
    body: JSON.stringify({ deviceId, power, completedFigures: 1 }),
  });
}

async function seed(store: Map<string, string>, opts: { rateLimited?: boolean; knownDevice?: string }) {
  store.set('aggregate:snapshot', JSON.stringify({ joinedCount: 12, totalPower: 30, updatedAt: 1 }));
  if (opts.rateLimited) store.set(`rl:${await sha256(`${SALT}:${IP}`)}`, '1');
  if (opts.knownDevice) {
    const key = `device:${await sha256(`${SALT}:${opts.knownDevice}`)}`;
    store.set(key, JSON.stringify({ power: 1, completedFigures: 0, lastSeen: Date.now() - 1000 }));
  }
}

async function main(): Promise<void> {
  await test('a new device inside the address window gets 429 and nothing is written', async () => {
    const { kv, store, writes } = fakeKv();
    await seed(store, { rateLimited: true });
    const before = new Map(store);
    const res = await worker.fetch(powerRequest('new-device-0001'), envWith(kv));
    assertEqual(res.status, 429, 'status');
    assertEqual(((await res.json()) as { error?: string }).error, 'rate_limited', 'error body');
    assertEqual(writes.length, 0, 'KV writes');
    assertEqual(store.size, before.size, 'no new key');
    assertEqual(store.get('aggregate:snapshot'), before.get('aggregate:snapshot'), 'totals unchanged');
    assertEqual(res.headers.get('Access-Control-Allow-Origin'), ORIGIN, 'CORS header on the error');
  });

  await test('a known device inside the address window keeps 200 with the totals and no write', async () => {
    const { kv, store, writes } = fakeKv();
    await seed(store, { rateLimited: true, knownDevice: 'known-device-01' });
    const res = await worker.fetch(powerRequest('known-device-01', 5), envWith(kv));
    assertEqual(res.status, 200, 'status');
    const body = (await res.json()) as { joinedCount: number; totalPower: number };
    assertEqual(body.joinedCount, 12, 'joinedCount');
    assertEqual(body.totalPower, 30, 'totalPower');
    assertEqual(writes.length, 0, 'KV writes');
  });

  await test('outside the window a new device is written with its expiry and counted once', async () => {
    const { kv, store, writes } = fakeKv();
    await seed(store, {});
    const res = await worker.fetch(powerRequest('new-device-0002', 2), envWith(kv));
    assertEqual(res.status, 200, 'status');
    const body = (await res.json()) as { joinedCount: number; totalPower: number };
    assertEqual(body.joinedCount, 13, 'joinedCount');
    assertEqual(body.totalPower, 32, 'totalPower');
    const device = writes.find((w) => w.key.startsWith('device:'));
    assertEqual(device?.ttl, 60 * 60 * 24 * 365, 'device record expiry');
    const rl = writes.find((w) => w.key.startsWith('rl:'));
    assertEqual(rl?.ttl, 60 * 60 * 6, 'address window');
  });

  // The cap's contract, written out so the suite also runs against a tree that predates it.
  const POWER_LIMIT = 16 * 1024;

  /** A valid heartbeat padded with an ignored field to exactly `bytes` bytes. */
  function paddedPower(bytes: number): Uint8Array {
    const base = { deviceId: 'padded-device-01', power: 2, completedFigures: 1 };
    const bare = JSON.stringify({ ...base, pad: '' });
    const encoded = new TextEncoder().encode(JSON.stringify({ ...base, pad: 'x'.repeat(bytes - bare.length) }));
    assertEqual(encoded.length, bytes, 'padded body size');
    return encoded;
  }

  function rawPowerRequest(body: string | Uint8Array | ReadableStream<Uint8Array>, headers: Record<string, string> = {}): Request {
    return new Request('https://community.example/v1/community/power', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'cf-connecting-ip': IP, ...headers },
      body,
      ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
    } as RequestInit);
  }

  /** The fake KV with every read counted as well. */
  function countedKv() {
    const fake = fakeKv();
    let reads = 0;
    const kv = { ...fake.kv, async get(key: string, type?: 'json') { reads++; return fake.kv.get(key, type); } };
    return { ...fake, kv, reads: () => reads };
  }

  await test('a heartbeat one byte over its cap gets a 413 before any KV access', async () => {
    const fake = countedKv();
    await seed(fake.store, {});
    const body = paddedPower(POWER_LIMIT + 1);
    const res = await worker.fetch(rawPowerRequest(body, { 'Content-Length': String(body.length) }), envWith(fake.kv));
    assertEqual(res.status, 413, 'status');
    assertEqual(((await res.json()) as { error?: string }).error, 'body_too_large', 'error body');
    assertEqual(res.headers.get('Access-Control-Allow-Origin'), ORIGIN, 'CORS header on the error');
    assertEqual(fake.reads(), 0, 'KV reads');
    assertEqual(fake.writes.length, 0, 'KV writes');
  });

  await test('a chunked heartbeat over its cap is stopped by the bounded read', async () => {
    const fake = countedKv();
    await seed(fake.store, {});
    const bytes = paddedPower(POWER_LIMIT + 1);
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close(); } });
    const res = await worker.fetch(rawPowerRequest(stream), envWith(fake.kv));
    assertEqual(res.status, 413, 'status');
    assertEqual(fake.writes.length, 0, 'KV writes');
  });

  await test('a heartbeat at its cap is still counted', async () => {
    const { kv, store } = fakeKv();
    await seed(store, {});
    const body = paddedPower(POWER_LIMIT);
    const res = await worker.fetch(rawPowerRequest(body, { 'Content-Length': String(body.length) }), envWith(kv));
    assertEqual(res.status, 200, 'status');
    assertEqual(((await res.json()) as { joinedCount: number }).joinedCount, 13, 'joinedCount');
  });

  await test('a heartbeat that is not JSON keeps its 400', async () => {
    const { kv } = fakeKv();
    const res = await worker.fetch(rawPowerRequest('{"deviceId":'), envWith(kv));
    assertEqual(res.status, 400, 'status');
    assertEqual(((await res.json()) as { error?: string }).error, 'invalid_json', 'error body');
  });

  // Body reads in 64 KiB steps, however small the chunks a body arrives in.

  /**
   * A body that behaves like workerd's own request streams, as measured in
   * local workerd: the default reader hands out one HTTP chunk per read, and
   * the BYOB reader's readAtLeast fills at least its minimum unless the body
   * ends first, then answers an empty read with done.
   */
  function nativeBody(source: Uint8Array, chunk = 1) {
    let sent = 0;
    const stats = { defaultReads: 0, stepReads: 0, cancelled: false };
    const take = (n: number): Uint8Array => {
      const out = source.slice(sent, sent + n);
      sent += out.byteLength;
      return out;
    };
    const body = {
      getReader(options?: { mode?: string }) {
        if (options?.mode === 'byob') {
          return {
            async readAtLeast(_min: number, view: Uint8Array) {
              stats.stepReads++;
              const bytes = take(view.byteLength);
              const out = new Uint8Array(view.buffer, view.byteOffset, bytes.byteLength);
              out.set(bytes);
              return { value: out, done: out.byteLength === 0 };
            },
            async cancel() { stats.cancelled = true; },
            releaseLock() {},
          };
        }
        return {
          async read() {
            stats.defaultReads++;
            if (sent >= source.byteLength) return { value: undefined, done: true };
            return { value: take(chunk), done: false };
          },
          async cancel() { stats.cancelled = true; },
          releaseLock() {},
        };
      },
    };
    return { body: body as unknown as ReadableStream<Uint8Array>, stats };
  }

  function withBody(body: ReadableStream<Uint8Array>): Request {
    const request = new Request('https://community.example/v1/community/power', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'cf-connecting-ip': IP },
    });
    return Object.defineProperty(request, 'body', { value: body });
  }

  /** A stream that hands out `bytes` one byte at a time, all through one reused buffer when `reuse` is set. */
  function byteByByte(bytes: Uint8Array, reuse = false) {
    const shared = new Uint8Array(1);
    let sent = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sent === bytes.byteLength) { c.close(); return; }
        if (reuse) {
          shared[0] = bytes[sent++];
          c.enqueue(shared);
        } else {
          c.enqueue(bytes.slice(sent, ++sent));
        }
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    return { stream, cancelled: () => cancelled };
  }

  await test('a heartbeat the runtime hands out in 1-byte chunks costs one read per 64 KiB', async () => {
    const { kv, store } = fakeKv();
    await seed(store, {});
    const source = nativeBody(paddedPower(POWER_LIMIT));
    const res = await worker.fetch(withBody(source.body), envWith(kv));
    assertEqual(res.status, 200, 'status');
    assertEqual(((await res.json()) as { joinedCount: number }).joinedCount, 13, 'joinedCount');
    assertEqual(source.stats.defaultReads, 0, 'one-chunk reads');
    assertEqual(source.stats.stepReads, 2, 'step reads');
  });

  await test('a heartbeat from the runtime one byte over its cap gets a 413 after one read', async () => {
    const fake = countedKv();
    await seed(fake.store, {});
    const source = nativeBody(paddedPower(POWER_LIMIT + 1), 4096);
    const res = await worker.fetch(withBody(source.body), envWith(fake.kv));
    assertEqual(res.status, 413, 'status');
    assertEqual(source.stats.cancelled, true, 'the rest was cancelled');
    assertEqual(source.stats.defaultReads, 0, 'one-chunk reads');
    assertEqual(source.stats.stepReads, 1, 'step reads');
    assertEqual(fake.reads(), 0, 'KV reads');
  });

  await test('a heartbeat whose stream reuses one chunk buffer is copied as it is read', async () => {
    const { kv, store } = fakeKv();
    await seed(store, {});
    const body = new TextEncoder().encode(JSON.stringify({ deviceId: 'reused-buffer-01', power: 2, completedFigures: 1 }));
    const res = await worker.fetch(rawPowerRequest(byteByByte(body, true).stream), envWith(kv));
    assertEqual(res.status, 200, 'status');
  });

  await test('a heartbeat that takes more than 1,024 reads is refused like an oversized body', async () => {
    const fake = countedKv();
    await seed(fake.store, {});
    const upload = byteByByte(paddedPower(2000));
    const res = await worker.fetch(rawPowerRequest(upload.stream), envWith(fake.kv));
    assertEqual(res.status, 413, 'status');
    assertEqual(upload.cancelled(), true, 'the rest was cancelled');
    assertEqual(fake.reads(), 0, 'KV reads');
  });

  // A fault inside the worker, and a KV write the store refuses.

  /** Run with console.warn and console.error captured. */
  async function captureLogs(fn: () => Promise<void>): Promise<string[]> {
    const lines: string[] = [];
    const realWarn = console.warn;
    const realError = console.error;
    console.warn = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
    console.error = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
    try {
      await fn();
    } finally {
      console.warn = realWarn;
      console.error = realError;
    }
    return lines;
  }

  /** The fake KV, refusing every write to keys with one prefix as KV does past one write a second. */
  function refusingKv(prefix: string) {
    const fake = fakeKv();
    const kv = {
      ...fake.kv,
      async put(key: string, value: string, opts?: { expirationTtl?: number }) {
        if (key.startsWith(prefix)) throw new Error(`KV PUT failed: 429 Too Many Requests ${key}`);
        return fake.kv.put(key, value, opts);
      },
    };
    return { ...fake, kv };
  }

  const snapshotRequest = () => new Request('https://community.example/v1/community/snapshot', {
    method: 'GET',
    headers: { Origin: ORIGIN },
  });

  for (const [label, request] of [
    ['/v1/community/power', () => powerRequest('fault-device-01')],
    ['/v1/community/snapshot', snapshotRequest],
  ] as const) {
    await test(`a fault on ${label} answers 500 with CORS and one line by kind`, async () => {
      const failing = {
        async get(key: string) { throw new TypeError(`KV GET failed for ${key}`); },
        async put() { throw new TypeError('KV PUT failed'); },
      };
      let res: Response | undefined;
      const lines = await captureLogs(async () => { res = await worker.fetch(request(), envWith(failing as never)); });
      assertEqual(res?.status, 500, 'status');
      assertEqual(res?.headers.get('Access-Control-Allow-Origin'), ORIGIN, 'CORS header on the 500');
      assertEqual(((await res!.json()) as { error?: string }).error, 'internal_error', 'error body');
      assertEqual(lines.join(' | '), `[community] Unhandled TypeError on ${label}`, 'log lines');
    });
  }

  await test('a fault on an unknown path is logged under a fixed label', async () => {
    let res: Response | undefined;
    const lines = await captureLogs(async () => {
      res = await worker.fetch(new Request('https://community.example/v1/community/power/secret-device-id', {
        method: 'POST',
        headers: { Origin: ORIGIN },
      }), { COMMUNITY_KV: fakeKv().kv, IP_SALT: SALT } as unknown as Env);
    });
    assertEqual(res?.status, 500, 'status');
    assertEqual(lines.join(' | '), '[community] Unhandled TypeError on other', 'log lines');
  });

  for (const [what, prefix] of [['Rate window', 'rl:'], ['Snapshot', 'aggregate:']] as const) {
    await test(`a refused ${what.toLowerCase()} write still counts the beacon, one line by kind`, async () => {
      const fake = refusingKv(prefix);
      await seed(fake.store, {});
      const before = fake.store.get('aggregate:snapshot');
      let res: Response | undefined;
      const lines = await captureLogs(async () => { res = await worker.fetch(powerRequest('refused-write-01', 2), envWith(fake.kv)); });
      assertEqual(res?.status, 200, 'status');
      assertEqual(res?.headers.get('Access-Control-Allow-Origin'), ORIGIN, 'CORS header');
      const body = (await res!.json()) as { joinedCount: number; totalPower: number };
      assertEqual(body.joinedCount, 13, 'joinedCount');
      assertEqual(body.totalPower, 32, 'totalPower');
      assertEqual(fake.writes.some((w) => w.key.startsWith('device:')), true, 'the device record is written');
      if (prefix === 'aggregate:') assertEqual(fake.store.get('aggregate:snapshot'), before, 'stored totals unchanged');
      assertEqual(lines.join(' | '), `[community] ${what} write failed (Error), beacon served`, 'log lines');
    });
  }

  await test('a refused device write serves the totals and counts the device once, later', async () => {
    const fake = refusingKv('device:');
    await seed(fake.store, {});
    let res: Response | undefined;
    const lines = await captureLogs(async () => { res = await worker.fetch(powerRequest('refused-device-1', 2), envWith(fake.kv)); });
    assertEqual(res?.status, 200, 'status');
    const body = (await res!.json()) as { joinedCount: number; totalPower: number };
    assertEqual(body.joinedCount, 12, 'not counted without its record');
    assertEqual(body.totalPower, 30, 'totalPower');
    assertEqual(fake.writes.some((w) => w.key === 'aggregate:snapshot'), false, 'totals not written');
    assertEqual(lines.join(' | '), '[community] Device write failed (Error), beacon served', 'log lines');
    // After the address window the store takes the write again: counted once.
    const later = fakeKv();
    for (const [key, value] of fake.store) if (!key.startsWith('rl:')) later.store.set(key, value);
    const again = await worker.fetch(powerRequest('refused-device-1', 2), envWith(later.kv));
    assertEqual(((await again.json()) as { joinedCount: number }).joinedCount, 13, 'counted on the next beacon');
  });

  const failed = results.filter((r) => r.error);
  for (const r of failed) console.error(`FAIL ${r.name}: ${r.error}`);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

void main();
