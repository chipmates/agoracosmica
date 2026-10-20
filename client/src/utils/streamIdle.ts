// A reply body can stop sending without closing. The request's timeout ends
// once the headers arrive, so without a limit here a read waits forever.
// Measured gaps inside a body stay far below this; a reasoning model that
// streams nothing while it thinks has been seen silent for about 25 s.
export const STREAM_IDLE_MS = 60_000;

/**
 * Reads the next chunk. When nothing arrives for `idleMs`, the connection is
 * dropped and the stream reads as ended, so the caller keeps what arrived.
 */
export async function readWithIdleLimit(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleMs: number = STREAM_IDLE_MS,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = reader.read();
  const idle = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), idleMs);
  });
  try {
    const result = await Promise.race([read, idle]);
    if (result) return result;
    console.warn(`[Stream] Nothing received for ${idleMs / 1000}s, ending the reply with what arrived`);
    read.catch(() => {});
    void reader.cancel().catch(() => {});
    return { done: true, value: undefined };
  } finally {
    clearTimeout(timer);
  }
}
