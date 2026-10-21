import { corsHeaders } from './cors';
import type { Env } from './types';

/** Upper bound for a transcription upload, checked before any counter moves. */
export const STT_MAX_BODY_BYTES = 15 * 1024 * 1024;

/**
 * The body's bytes, or null when it is larger than `maxBytes`. A declared
 * Content-Length over the limit is refused unread; the read itself is bounded
 * as well, since the header can be missing (a chunked upload) or wrong.
 */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<ArrayBuffer | null> {
  const declared = declaredLength(request);
  if (declared !== null && declared > maxBytes) return null;
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

export function bodyTooLarge(request: Request, env: Env): Response {
  return new Response(JSON.stringify({ error: 'Request body too large' }), {
    status: 413,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
  });
}

function declaredLength(request: Request): number | null {
  const raw = request.headers.get('Content-Length');
  if (raw === null || !/^\s*\d+\s*$/.test(raw)) return null;
  return Number(raw);
}
