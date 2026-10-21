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
