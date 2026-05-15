// Anonymous page-load beacon
// Fires once at App module load (from index.tsx) so we count arrivals,
// not just post-engagement events. Same fire-and-forget posture as the
// playback beacon — see utils/playbackBeacon.ts.
//
// Privacy: aggregate counter only. No user dimension. No IP retention.
// Disclosed in docs/MEASUREMENT.md alongside the other event counters.

const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

/**
 * Detect the current UI language from the document or localStorage. Mirrors
 * the playbackBeacon helper so language labels stay consistent across event
 * types. Falls back to 'en' if nothing is set.
 */
function detectLanguage(): 'en' | 'de' {
  try {
    const docLang = typeof document !== 'undefined' ? document.documentElement.lang : '';
    if (docLang && docLang.toLowerCase().startsWith('de')) return 'de';
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('language') : null;
    if (stored && stored.toLowerCase().startsWith('de')) return 'de';
    if (typeof navigator !== 'undefined' && navigator.language && navigator.language.toLowerCase().startsWith('de')) return 'de';
  } catch {
    // Ignore — fall through to 'en'
  }
  return 'en';
}

/**
 * Send a page-load beacon. Fire-and-forget — never throws, never blocks the
 * caller, never breaks app boot on network failure. Captures only:
 *   - path (no query string, validated server-side against a regex)
 *   - language (en/de)
 *   - country (CF-edge two-letter code, server-side)
 *
 * No user dimension, no message content, no fingerprint.
 */
export function sendPageBeacon(): void {
  try {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const body = JSON.stringify({
      path,
      language: detectLanguage(),
    });

    fetch(`${API_BASE}/v1/page`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      keepalive: true,
    }).catch(() => {
      // Silent fail — beacons must never surface to the user.
    });
  } catch {
    // Silent fail
  }
}
