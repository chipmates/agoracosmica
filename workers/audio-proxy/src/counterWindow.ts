// Fixed UTC windows for the KV counters that hold an address hash. A counter's
// key names its window and expires at the window's end, so renewing the count
// never stretches the key's life past the window.

/**
 * KV refuses an absolute expiration less than 60 seconds ahead of its own
 * clock. The worker's clock stands still between I/O and the write takes time
 * to land, so 10 more seconds are kept in hand.
 */
export const EXPIRATION_FLOOR_SECONDS = 70;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export interface CounterWindow {
  /** The window as the key names it: YYYY-MM-DD for a UTC day, the minute's number since the epoch for a minute. */
  label: string;
  /** The window's end, in ms since the epoch. */
  endMs: number;
}

export function utcDay(now: number = Date.now()): CounterWindow {
  const start = Math.floor(now / DAY_MS) * DAY_MS;
  return { label: new Date(start).toISOString().slice(0, 10), endMs: start + DAY_MS };
}

export function utcMinute(now: number = Date.now()): CounterWindow {
  const minute = Math.floor(now / MINUTE_MS);
  return { label: String(minute), endMs: (minute + 1) * MINUTE_MS };
}

/**
 * Put options that end a counter with its window. In the window's last 70
 * seconds KV's floor wins and the key ends 70 seconds after the write: at most
 * that long past a window no later request reads. A minute key always ends
 * this way.
 */
export function endsWithWindow(window: CounterWindow, now: number = Date.now()): { expiration: number } {
  return { expiration: Math.max(window.endMs / 1000, Math.ceil(now / 1000) + EXPIRATION_FLOOR_SECONDS) };
}
