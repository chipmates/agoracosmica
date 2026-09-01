// Anonymous page-load beacon
// Fires once at App module load (from index.tsx) so we count arrivals,
// not just post-engagement events. Same fire-and-forget posture as the
// playback beacon — see utils/playbackBeacon.ts.
//
// Privacy: aggregate counter only. No user dimension. No IP retention.
// Disclosed in docs/MEASUREMENT.md alongside the other event counters.

import { isSelfHost } from '../config/deployment';
import { probeField } from './probeSession';
import { sendFunnelBeacon } from './funnelBeacon';

const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

// Landing rule, identical in the app and on the marketing pages: a pageview
// opened the visit when it has no referrer at all or one from another host.
// It is a property of the document this code is running in, so it needs
// nothing stored and says nothing about the visitor. The app is usually
// navigated to from a marketing page, so its beacons are landings only when
// the app document itself is the first one opened.
let firstBeaconSent = false;

function isLandingPageview(): boolean {
  if (firstBeaconSent) return false;
  try {
    const referrer = typeof document !== 'undefined' ? document.referrer : '';
    if (!referrer) return true;
    return new URL(referrer).host !== window.location.host;
  } catch {
    return false;
  }
}

// The paid-ads parameter Google appends to paid Final URLs. The app is not a
// paid landing surface, so this is a defensive twin of the marketing check:
// if a paid URL ever reaches the app directly, the arrival is still counted.
function hasPaidParam(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('p') === '1';
  } catch {
    return false;
  }
}

/**
 * Detect the current UI language from the document or localStorage. Mirrors
 * the playbackBeacon helper so language labels stay consistent across event
 * types. Falls back to 'en' if nothing is set.
 */
function detectLanguage(): 'en' | 'de' {
  try {
    const docLang = typeof document !== 'undefined' ? document.documentElement.lang : '';
    if (docLang && docLang.toLowerCase().startsWith('de')) return 'de';
    const stored = typeof localStorage !== 'undefined'
      ? localStorage.getItem('selectedLanguage') || localStorage.getItem('language')
      : null;
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
 *   - whether this pageview opened the visit (referrer rule above)
 *   - the in-house probe constant, only from a browser marked as one
 *
 * A paid-ad arrival also emits its own counter, so paid landings can be told
 * apart from the rest without any of them carrying a click ID.
 *
 * No user dimension, no message content, no fingerprint.
 */
export function sendPageBeacon(): void {
  if (isSelfHost) return; // self-host instances are analytics-silent
  try {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const landing = isLandingPageview();
    firstBeaconSent = true;
    const body = JSON.stringify({
      path,
      language: detectLanguage(),
      landing: landing ? 1 : undefined,
      probe: probeField(),
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

    if (hasPaidParam()) sendFunnelBeacon('paid_arrival');
  } catch {
    // Silent fail
  }
}
