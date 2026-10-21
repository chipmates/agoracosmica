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
// Mark a browser (once, from the devtools console on the site, or by opening
// any page with ?probe=1):
//   localStorage.setItem('agc_probe', '1')
// Marked by hand on an open page, conversions stop at once and the counts
// carry the mark from the next page load.
// Unmark:
//   localStorage.removeItem('agc_probe')
// Unmark in a fresh tab, or remove agc_ad_consent as well: a yes given while
// marked keeps the test click ID in that tab (sessionStorage), and the tab's
// next conversion step after unmarking would send it to Google.

const PROBE_KEY = 'agc_probe';

// Read once per page for the beacons: a cached read keeps their path free of
// storage access, so a flag set by hand on an open page marks the beacons from
// the next page load. The conversion senders read it fresh (isProbeSessionNow).
let cached: boolean | null = null;

// A page opened with ?probe=1 is marked by its own address, so the answer
// does not depend on whichever script stores the flag having run first.
function urlMarksProbe(): boolean {
  try {
    return typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('probe') === '1';
  } catch {
    return false;
  }
}

/** Is this browser marked as an in-house probe? */
export function isProbeSession(): boolean {
  if (cached !== null) return cached;
  if (urlMarksProbe()) {
    cached = true;
    return cached;
  }
  try {
    cached = typeof localStorage !== 'undefined' && localStorage.getItem(PROBE_KEY) === '1';
  } catch {
    cached = false;
  }
  return cached;
}

/**
 * The same question, read fresh on every call, for the conversion senders: a
 * browser marked by hand on an open page must send Google nothing from that
 * moment on, and the app is one page load for a whole session. The beacons keep
 * the cached read above.
 */
export function isProbeSessionNow(): boolean {
  if (urlMarksProbe()) return true;
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(PROBE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The probe field for a beacon body, or undefined so an unmarked browser
 * sends no extra field at all.
 */
export function probeField(): 1 | undefined {
  return isProbeSession() ? 1 : undefined;
}
