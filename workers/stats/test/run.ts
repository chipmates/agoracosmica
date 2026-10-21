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

  const failed = results.filter((r) => r.error);
  for (const r of failed) console.error(`FAIL ${r.name}: ${r.error}`);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

void main();
