// Fixed UTC windows for the KV counters that hold an identifier. A counter's
// key names its window and expires at the window's end, so renewing the count
// never stretches the key's life past the window.

/**
 * KV refuses an absolute expiration less than 60 seconds ahead of its own
 * clock. The worker's clock stands still between I/O and the write takes time
 * to land, so 10 more seconds are kept in hand.
 */
export const EXPIRATION_FLOOR_SECONDS = 70;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export interface CounterWindow {
  /** The window as the key names it, UTC: YYYY-MM-DD for a day, YYYY-MM-DDTHH for a clock hour. */
  label: string;
  /** The window's end, in ms since the epoch. */
  endMs: number;
}

export function utcDay(now: number = Date.now()): CounterWindow {
  const start = Math.floor(now / DAY_MS) * DAY_MS;
  return { label: new Date(start).toISOString().slice(0, 10), endMs: start + DAY_MS };
}

export function utcHour(now: number = Date.now()): CounterWindow {
  const start = Math.floor(now / HOUR_MS) * HOUR_MS;
  return { label: new Date(start).toISOString().slice(0, 13), endMs: start + HOUR_MS };
}

/**
 * Put options that end a counter with its window. In the window's last 70
 * seconds KV's floor wins and the key ends 70 seconds after the write's whole
 * second: for a write inside the window, at most 70 seconds past its end.
 */
export function endsWithWindow(window: CounterWindow, now: number = Date.now()): { expiration: number } {
  return { expiration: Math.max(window.endMs / 1000, Math.ceil(now / 1000) + EXPIRATION_FLOOR_SECONDS) };
}

/**
 * Write a counter with its window's expiry, or nothing once the window is over:
 * the clock moves on across a request's reads, and a count that reaches its
 * write after the end would land in a key no later request reads. A refused
 * write throws, as KV's put does.
 */
export async function putForWindow(kv: KVNamespace, key: string, value: string, window: CounterWindow): Promise<void> {
  const now = Date.now();
  if (now >= window.endMs) return;
  await kv.put(key, value, endsWithWindow(window, now));
}
