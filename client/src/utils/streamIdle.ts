// A reply body can stop sending without closing. The request's timeout ends
// once the headers arrive, so without a limit here a read waits forever.
// Measured gaps inside a body stay far below this; a reasoning model that
// streams nothing while it thinks has been seen silent for about 25 s.
export const STREAM_IDLE_MS = 60_000;

export interface ReadLimits {
  /** The caller's signal. fetchWithTimeout stops listening to it once the headers are in, so the read watches it. */
  signal?: AbortSignal;
  idleMs?: number;
}

const abortError = () => new DOMException('The reply was stopped', 'AbortError');

/**
 * Reads the next chunk. When nothing arrives for `idleMs`, the connection is
 * dropped and the stream reads as ended, so the caller keeps what arrived.
 * When the caller aborts, before or during the read, the connection is
 * dropped and the read throws an AbortError.
 */
export async function readWithIdleLimit(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  { signal, idleMs = STREAM_IDLE_MS }: ReadLimits = {},
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (signal?.aborted) {
    void reader.cancel().catch(() => {});
    throw abortError();
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const read = reader.read();
  const idle = new Promise<'idle'>((resolve) => {
    timer = setTimeout(() => resolve('idle'), idleMs);
  });
  const aborted = new Promise<'abort'>((resolve) => {
    if (!signal) return;
    onAbort = () => resolve('abort');
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    const result = await Promise.race([read, idle, aborted]);
    if (typeof result === 'object') return result;
    read.catch(() => {});
    void reader.cancel().catch(() => {});
    if (result === 'abort') throw abortError();
    console.warn(`[Stream] Nothing received for ${idleMs / 1000}s, ending the reply with what arrived`);
    return { done: true, value: undefined };
  } finally {
    clearTimeout(timer);
    if (onAbort) signal?.removeEventListener('abort', onAbort);
  }
}
