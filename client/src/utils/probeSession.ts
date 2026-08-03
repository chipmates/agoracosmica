// In-house probe marker
// A browser can mark itself so its own rows can be subtracted from the weekly
// numbers. Small-n weeks are otherwise easy to misread: a handful of internal
// test sessions is a large share of a metric like first_turn.
//
// Privacy: this is a CONSTANT, not an identifier. Every marked row carries the
// same string, it never varies per visitor, and nothing is generated, stored
// or transmitted beyond that one flag. An unmarked browser sends nothing at
// all, so the default row shape is unchanged.
//
// Mark a browser (once, from the devtools console on the site):
//   localStorage.setItem('agc_probe', '1')
// Unmark:
//   localStorage.removeItem('agc_probe')

const PROBE_KEY = 'agc_probe';

// Read once per page: the flag is set by hand and never flips mid-session, and
// a cached read keeps the beacon path free of storage access.
let cached: boolean | null = null;

/** Is this browser marked as an in-house probe? */
export function isProbeSession(): boolean {
  if (cached !== null) return cached;
  try {
    cached = typeof localStorage !== 'undefined' && localStorage.getItem(PROBE_KEY) === '1';
  } catch {
    cached = false;
  }
  return cached;
}

/**
 * The probe field for a beacon body, or undefined so an unmarked browser
 * sends no extra field at all.
 */
export function probeField(): 1 | undefined {
  return isProbeSession() ? 1 : undefined;
}
