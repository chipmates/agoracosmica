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

  const failed = results.filter((r) => r.error);
  for (const r of failed) console.error(`FAIL ${r.name}: ${r.error}`);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

void main();
