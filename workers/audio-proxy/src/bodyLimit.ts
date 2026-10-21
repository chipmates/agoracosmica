import { corsHeaders } from './cors';
import type { Env } from './types';

/** Upper bound for a transcription upload, checked before any counter moves. */
export const STT_MAX_BODY_BYTES = 15 * 1024 * 1024;

/**
 * The body's bytes, or null when it is larger than `maxBytes`. A declared
 * Content-Length over the limit is refused unread; the read itself is bounded
 * as well, since the header can be missing (a chunked upload) or wrong. Throws
 * when the upload breaks off mid-read.
 */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<ArrayBuffer | null> {
  if (declaresMoreThan(request, maxBytes)) return null;
  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      void reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes.buffer;
}

/**
 * Read the body to its end and drop each chunk as it arrives, so memory stays
 * flat; past `maxBytes` the rest is cancelled. Answering before an upload is
 * consumed can cost a reused HTTP/1.1 connection its next request. Never
 * throws: a broken upload has no one left to answer.
 */
export async function drainBodyCapped(request: Request, maxBytes: number): Promise<void> {
  if (!request.body) return;
  const reader = request.body.getReader();
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      total += value.byteLength;
      if (total > maxBytes) {
        void reader.cancel().catch(() => {});
        return;
      }
    }
  } catch {
    // The upload broke off.
  }
}

/** Upper bound for the session-end beacon, which carries one session id. */
export const SESSION_END_MAX_BODY_BYTES = 16 * 1024;

/**
 * Read and parse a JSON body of at most `maxBytes`; `{ ok: false }` when it is
 * larger. Like request.json(), it throws on a body that is not JSON or an
 * upload that breaks off, so the route keeps its own answer to a bad body.
 */
export async function readJsonCapped(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  const bytes = await readBodyCapped(request, maxBytes);
  if (!bytes) return { ok: false };
  return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
}

/** True when the request's Content-Length already says the body is over `maxBytes`. */
export function declaresMoreThan(request: Request, maxBytes: number): boolean {
  const declared = declaredLength(request);
  return declared !== null && declared > maxBytes;
}

export function bodyTooLarge(request: Request, env: Env): Response {
  return new Response(JSON.stringify({ error: 'Request body too large' }), {
    status: 413,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
  });
}

/** The answer to an upload that broke off mid-read: a bad request, not a worker fault. */
export function bodyUnreadable(request: Request, env: Env): Response {
  return new Response(JSON.stringify({ error: 'Request body could not be read' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
  });
}

function declaredLength(request: Request): number | null {
  const raw = request.headers.get('Content-Length');
  if (raw === null || !/^\s*\d+\s*$/.test(raw)) return null;
  return Number(raw);
}
