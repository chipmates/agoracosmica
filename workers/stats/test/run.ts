// Stats worker tests. Run from workers/stats with tsx, for example
// ../llm-proxy/node_modules/.bin/tsx test/run.ts
//
// No framework: each case throws on failure and the runner reports the tally.
// Same shape as the community suite. Every outbound fetch is answered by a
// local stub, so nothing reaches Cloudflare.

import worker from '../src/index';
import type { Env } from '../src/types';

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

const env = { CF_API_TOKEN: 'test-token', CF_ACCOUNT_ID: 'test-account' } as unknown as Env;

/** Run one call with fetch answered locally and recorded. */
async function withStubbedFetch(fn: () => Promise<Response>): Promise<{ response: Response; fetched: string[] }> {
  const fetched: string[] = [];
  const previous = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    fetched.push(String(url));
    return Response.json({ data: [] });
  }) as unknown as typeof fetch;
  const realError = console.error;
  console.error = () => {};
  try {
    return { response: await fn(), fetched };
  } finally {
    globalThis.fetch = previous;
    console.error = realError;
  }
}

function post(path: string, body: string | Uint8Array | ReadableStream<Uint8Array>, headers: Record<string, string> = {}): Request {
  return new Request(`https://stats.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  } as RequestInit);
}

/** A valid body padded with an ignored field to exactly `bytes` bytes. */
function padded(base: Record<string, unknown>, bytes: number): Uint8Array {
  const bare = JSON.stringify({ ...base, pad: '' });
  const encoded = new TextEncoder().encode(JSON.stringify({ ...base, pad: 'x'.repeat(bytes - bare.length) }));
  assertEqual(encoded.length, bytes, 'padded body size');
  return encoded;
}

async function main(): Promise<void> {
  // The cap's contract, written out so the suite also runs against a tree that predates it.
  const QUERY_LIMIT = 1024 * 1024;
  const routes = [
    { path: '/api/query', base: { query: 'SELECT 1 as c' } as Record<string, unknown> },
    { path: '/api/query-batch', base: { queries: [{ sql: 'SELECT 1 as c', dataset: 'agora_llm' }] } as Record<string, unknown> },
  ];

  for (const route of routes) {
    await test(`${route.path}: a body one byte over the cap gets a 413 and asks nothing`, async () => {
      const body = padded(route.base, QUERY_LIMIT + 1);
      const { response, fetched } = await withStubbedFetch(() =>
        worker.fetch(post(route.path, body, { 'Content-Length': String(body.length) }), env));
      assertEqual(response.status, 413, 'status');
      assertEqual(((await response.json()) as { error?: string }).error, 'Request body too large', 'error body');
      assertEqual(fetched.length, 0, 'queries sent');
    });

    await test(`${route.path}: a chunked body over the cap is stopped by the bounded read`, async () => {
      const bytes = padded(route.base, QUERY_LIMIT + 1);
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          for (let at = 0; at < bytes.length; at += 64 * 1024) c.enqueue(bytes.slice(at, at + 64 * 1024));
          c.close();
        },
      });
      const { response, fetched } = await withStubbedFetch(() => worker.fetch(post(route.path, stream), env));
      assertEqual(response.status, 413, 'status');
      assertEqual(fetched.length, 0, 'queries sent');
    });

    await test(`${route.path}: a body at the cap is still asked`, async () => {
      const body = padded(route.base, QUERY_LIMIT);
      const { response, fetched } = await withStubbedFetch(() =>
        worker.fetch(post(route.path, body, { 'Content-Length': String(body.length) }), env));
      assertEqual(response.status, 200, 'status');
      assertEqual(fetched.length, 1, 'queries sent');
    });

    await test(`${route.path}: a body that is not JSON keeps its 500`, async () => {
      const { response, fetched } = await withStubbedFetch(() => worker.fetch(post(route.path, '{"query":'), env));
      assertEqual(response.status, 500, 'status');
      assertEqual(((await response.json()) as { error?: string }).error, 'Internal error', 'error body');
      assertEqual(fetched.length, 0, 'queries sent');
    });

    await test(`${route.path}: a parse error is logged by its kind, without the body`, async () => {
      const sentinel = 'sentinel_body_9f2c';
      const lines: string[] = [];
      const realError = console.error;
      console.error = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
      let status = 0;
      try {
        status = (await worker.fetch(post(route.path, sentinel), env)).status;
      } finally {
        console.error = realError;
      }
      assertEqual(status, 500, 'status');
      assertEqual(lines.length, 1, 'error lines');
      assertEqual(lines[0].includes('SyntaxError'), true, `the kind is named: ${lines[0]}`);
      assertEqual(lines[0].includes(sentinel), false, `the body stays out of the log: ${lines[0]}`);
    });
  }

  // What the query routes log: never a body or the query, the message of any
  // error that cannot quote them.

  /** Run one call with fetch answered by `answer` and every console.error line recorded. */
  async function logged(answer: () => Response | Promise<Response>, call: () => Promise<Response>): Promise<{ response: Response; lines: string[] }> {
    const lines: string[] = [];
    const previous = globalThis.fetch;
    const realError = console.error;
    globalThis.fetch = (async () => answer()) as unknown as typeof fetch;
    console.error = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
    try {
      return { response: await call(), lines };
    } finally {
      globalThis.fetch = previous;
      console.error = realError;
    }
  }

  await test('/api/query: an Analytics Engine refusal is logged by its status, never its text', async () => {
    const sentinel = 'sentinel_sql_4e7';
    const { response, lines } = await logged(
      () => new Response(`error in query: SELECT ${sentinel} FROM agora_llm`, { status: 400 }),
      () => worker.fetch(post('/api/query', JSON.stringify({ query: `SELECT ${sentinel} FROM agora_llm` })), env),
    );
    assertEqual(response.status, 502, 'status');
    assertEqual(((await response.json()) as { status?: number }).status, 400, 'the upstream status for the page');
    assertEqual(lines.length, 1, `error lines: ${lines.join(' | ')}`);
    assertEqual(lines[0].includes('[AE] 400'), true, `the status is named: ${lines[0]}`);
    assertEqual(lines[0].includes(sentinel), false, `the query stays out of the log: ${lines[0]}`);
    assertEqual(lines[0].includes('error in query'), false, `the engine's text stays out of the log: ${lines[0]}`);
  });

  await test('/api/query: a failure that is not a parse error keeps its message in the log', async () => {
    const { response, lines } = await logged(
      () => { throw new TypeError('fetch failed'); },
      () => worker.fetch(post('/api/query', JSON.stringify({ query: 'SELECT 1 as c' })), env),
    );
    assertEqual(response.status, 500, 'status');
    assertEqual(lines.length, 1, `error lines: ${lines.join(' | ')}`);
    assertEqual(lines[0].includes('TypeError'), true, `the kind is named: ${lines[0]}`);
    assertEqual(lines[0].includes('fetch failed'), true, `the message is kept: ${lines[0]}`);
  });

  await test('/api/query-batch: a failure that is not a parse error keeps its message in the log', async () => {
    const { response, lines } = await logged(
      () => Response.json({ data: [] }),
      () => worker.fetch(post('/api/query-batch', JSON.stringify({ queries: [null] })), env),
    );
    assertEqual(response.status, 500, 'status');
    assertEqual(lines.length, 1, `error lines: ${lines.join(' | ')}`);
    assertEqual(lines[0].includes('TypeError'), true, `the kind is named: ${lines[0]}`);
    assertEqual(lines[0].includes("reading 'sql'"), true, `the message is kept: ${lines[0]}`);
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

  function withBody(path: string, body: ReadableStream<Uint8Array>): Request {
    const request = new Request(`https://stats.example${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
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

  for (const route of routes) {
    await test(`${route.path}: a body the runtime hands out in 1-byte chunks costs one read per 64 KiB`, async () => {
      const source = nativeBody(padded(route.base, 100 * 1024));
      const { response, fetched } = await withStubbedFetch(() => worker.fetch(withBody(route.path, source.body), env));
      assertEqual(response.status, 200, 'status');
      assertEqual(fetched.length, 1, 'queries sent');
      assertEqual(source.stats.defaultReads, 0, 'one-chunk reads');
      assertEqual(source.stats.stepReads, 3, 'step reads');
    });

    await test(`${route.path}: a body whose stream reuses one chunk buffer is copied as it is read`, async () => {
      const body = new TextEncoder().encode(JSON.stringify(route.base));
      const { response, fetched } = await withStubbedFetch(() => worker.fetch(post(route.path, byteByByte(body, true).stream), env));
      assertEqual(response.status, 200, 'status');
      assertEqual(fetched.length, 1, 'queries sent');
    });

    await test(`${route.path}: a body that takes more than one read per KiB of the cap is refused like an oversized one`, async () => {
      const upload = byteByByte(padded(route.base, 1025));
      const { response, fetched } = await withStubbedFetch(() => worker.fetch(post(route.path, upload.stream), env));
      assertEqual(response.status, 413, 'status');
      assertEqual(upload.cancelled(), true, 'the rest was cancelled');
      assertEqual(fetched.length, 0, 'queries sent');
    });
  }

  const failed = results.filter((r) => r.error);
  for (const r of failed) console.error(`FAIL ${r.name}: ${r.error}`);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

void main();
