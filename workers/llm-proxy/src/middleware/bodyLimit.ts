// Request size gate, run before the body is parsed and before any counter
// moves.

/**
 * Upper bound for a chat, council or summary body. Real bodies stay far below
 * it: the validator allows 100 messages, and the client cuts assistant turns
 * to 7,500 characters.
 */
export const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;

/**
 * Upper bound for a beacon (funnel, playback, page, entry, signup,
 * conversions). Real beacons carry a few short fields, well under 1 KB.
 */
export const BEACON_MAX_BODY_BYTES = 16 * 1024;

/**
 * Upper bound for a session request: a Turnstile token (documented at up to
 * 2,048 characters), the client id and one flag.
 */
export const SESSION_MAX_BODY_BYTES = 64 * 1024;

export type JsonBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; response: Response };

export type JsonRead = { ok: true; body: unknown } | { ok: false };

/**
 * Read and parse a JSON body of at most `maxBytes`; `{ ok: false }` when it is
 * larger. Like request.json(), it throws on a body that is not JSON or an
 * upload that breaks off, so each route keeps its own answer to a bad body.
 */
export async function readJsonCapped(request: Request, maxBytes: number): Promise<JsonRead> {
  const bytes = await readBodyCapped(request, maxBytes);
  if (!bytes) return { ok: false };
  return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
}

/**
 * Read and parse a JSON body of at most `maxBytes`, answering a bad body with
 * the 400 and an oversized one with the 413. A declared Content-Length over
 * the limit is refused unread; the read itself is bounded as well, since the
 * header can be missing (a chunked upload) or wrong.
 */
export async function readJsonBody(request: Request, maxBytes = MAX_JSON_BODY_BYTES): Promise<JsonBodyResult> {
  let read: JsonRead;
  try {
    read = await readJsonCapped(request, maxBytes);
  } catch {
    // Not JSON, or an upload that broke off mid-read: a bad request, not a worker fault.
    return { ok: false, response: invalidJson() };
  }
  if (!read.ok) return { ok: false, response: bodyTooLarge() };
  return { ok: true, body: read.body };
}

/** The body's bytes, or null when it is larger than `maxBytes`. */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  const declared = declaredLength(request);
  if (declared !== null && declared > maxBytes) return null;
  if (!request.body) return new Uint8Array(0);

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
  return bytes;
}

function declaredLength(request: Request): number | null {
  const raw = request.headers.get('Content-Length');
  if (raw === null || !/^\s*\d+\s*$/.test(raw)) return null;
  return Number(raw);
}

function invalidJson(): Response {
  return new Response(
    JSON.stringify({ error: 'Invalid JSON body' }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}

/** The 413 in this worker's error shape. */
export function bodyTooLarge(): Response {
  return new Response(
    JSON.stringify({ error: 'Request body too large' }),
    { status: 413, headers: { 'Content-Type': 'application/json' } }
  );
}
