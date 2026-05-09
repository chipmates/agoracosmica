// Anonymous entry beacon
// Fires when the user transitions from the LoginPage into the app
// (handleEntryComplete in App.tsx). Sits between the page-load beacon
// (every arrival) and the session row (Turnstile-gated). Closes the most
// informative bounce stage: arrivals → entries → engagement.
//
// Privacy: aggregate counter only. No user dimension. No IP retention.
// Disclosed in docs/MEASUREMENT.md alongside the other event counters.

import { getMarketingSource } from './public/gclidCapture';

const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

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
 * Send an entry beacon. Fire-and-forget — never throws, never blocks the
 * caller, never breaks the login flow on network failure. Captures only:
 *   - path (no query string, validated server-side against a regex)
 *   - language (en/de)
 *   - marketing source (X-Marketing-Source header, closed allowlist)
 *   - country (CF-edge two-letter code, server-side)
 *
 * No user dimension, no message content, no fingerprint. Same posture as
 * the page-load and playback beacons.
 */
export function sendEntryBeacon(): void {
  try {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const body = JSON.stringify({
      path,
      language: detectLanguage(),
    });

    fetch(`${API_BASE}/v1/entry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Marketing-Source': getMarketingSource(),
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
