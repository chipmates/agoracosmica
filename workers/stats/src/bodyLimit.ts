// Bounded body read, run before the body is parsed.

/**
 * Read and parse a JSON body of at most `maxBytes`; `{ ok: false }` when it is
 * larger. A declared Content-Length over the limit is refused unread; the read
 * itself is bounded as well, since the header can be missing (a chunked upload)
 * or wrong. Like request.json(), it throws on a body that is not JSON or an
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

/** The body's bytes, or null when it is larger than `maxBytes`. */
async function readBodyCapped(request: Request, maxBytes: number): Promise<Uint8Array | null> {
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
