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

  const parts: Uint8Array[] = [];
  if (!(await readInSteps(request.body, maxBytes, (piece) => { parts.push(piece); }))) return null;

  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
}

/** Reads take at least this many bytes, however small the chunks a body arrives in. */
const READ_STEP = 64 * 1024;

/** A body that takes more reads than its cap allows. */
class TooManyPieces extends Error {}

interface Steps {
  /** The next piece of at most READ_STEP bytes, null at the end. Throws when the upload breaks off. */
  next(): Promise<Uint8Array | null>;
  cancel(): void;
}

/**
 * Hand the body to `keep` in pieces of READ_STEP bytes, the last one shorter.
 * Returns false, with the rest cancelled, once the body passes `maxBytes` or
 * takes more than one read per KiB of it (at least 1,024). Throws when the
 * upload breaks off.
 *
 * One read per HTTP chunk cost a second of CPU per 16,000 one-byte chunks in
 * workerd, and each kept chunk pinned about 4.6 KB. workerd's own body
 * streams offer readAtLeast, which waits for a whole step; any other stream
 * is read chunk by chunk and copied into step-sized pieces.
 */
async function readInSteps(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
  keep: (piece: Uint8Array) => void,
): Promise<boolean> {
  const steps = stepsOf(body, Math.max(1024, Math.ceil(maxBytes / 1024)));
  let total = 0;
  for (;;) {
    let piece: Uint8Array | null;
    try {
      piece = await steps.next();
    } catch (err) {
      if (!(err instanceof TooManyPieces)) throw err;
      steps.cancel();
      return false;
    }
    if (!piece) return true;
    total += piece.byteLength;
    if (total > maxBytes) {
      steps.cancel();
      return false;
    }
    keep(piece);
  }
}

function stepsOf(body: ReadableStream<Uint8Array>, maxReads: number): Steps {
  let reads = 0;
  let ended = false;
  const count = () => {
    if (++reads > maxReads) throw new TooManyPieces();
  };

  const native = nativeReader(body);
  if (native) {
    return {
      async next() {
        while (!ended) {
          count();
          const { value, done } = await native.readAtLeast(READ_STEP, new Uint8Array(READ_STEP));
          if (done) ended = true;
          if (value && value.byteLength > 0) return value;
        }
        return null;
      },
      cancel: () => { void native.cancel().catch(() => {}); },
    };
  }

  const reader = body.getReader();
  let rest: Uint8Array = new Uint8Array(0);
  return {
    async next() {
      const piece = new Uint8Array(READ_STEP);
      let filled = 0;
      while (filled < READ_STEP) {
        if (rest.byteLength === 0) {
          if (ended) break;
          count();
          const { value, done } = await reader.read();
          if (done) {
            ended = true;
            break;
          }
          rest = value;
        }
        const n = Math.min(rest.byteLength, READ_STEP - filled);
        piece.set(rest.subarray(0, n), filled);
        filled += n;
        rest = rest.subarray(n);
      }
      return filled > 0 ? piece.subarray(0, filled) : null;
    },
    cancel: () => { void reader.cancel().catch(() => {}); },
  };
}

/** workerd's BYOB reader. readAtLeast is workerd's own, so not every type library declares it. */
interface NativeReader {
  readAtLeast(min: number, view: Uint8Array): Promise<ReadableStreamReadResult<Uint8Array>>;
  cancel(): Promise<void>;
}

/** A BYOB reader on one of workerd's own byte streams, or null for any other stream. */
function nativeReader(body: ReadableStream<Uint8Array>): NativeReader | null {
  let reader: ReadableStreamBYOBReader;
  try {
    reader = body.getReader({ mode: 'byob' });
  } catch {
    return null;
  }
  const native = reader as unknown as Partial<NativeReader>;
  if (typeof native.readAtLeast === 'function') return native as NativeReader;
  reader.releaseLock();
  return null;
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
