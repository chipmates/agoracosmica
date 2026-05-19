// Google Ads conversion tracking — captures gclid from the landing URL and
// relays a conversion event to our CF Worker, which forwards to the Google
// Ads Conversion API. No cookies, no localStorage. The gclid lives only in
// sessionStorage so it survives reloads within the same tab and is gone
// when the tab closes.

import { isSelfHost } from '../../config/deployment';

const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

// sessionStorage key: persist gclid across reloads of the same tab. Without
// this, a user who clicks an ad → lands at /?gclid=… → reloads (URL no longer
// carries the param) → would lose the click ID and miss a later conversion
// inside that same tab. Tab-scoped on purpose — a new tab without the URL
// param has no attribution.
const SS_GCLID_KEY = 'agc_gclid';

let capturedGclid: string | null = null;

// Hydrate from sessionStorage on module load (cheap, runs once). If the URL
// later carries a fresh gclid, captureGclid() overwrites this.
try {
  if (typeof sessionStorage !== 'undefined') {
    const storedGclid = sessionStorage.getItem(SS_GCLID_KEY);
    if (storedGclid && storedGclid.length > 10 && storedGclid.length < 200) {
      capturedGclid = storedGclid;
    }
  }
} catch {
  // sessionStorage unavailable (Safari private mode, SSR) — no-op
}

function persistGclid(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (capturedGclid) sessionStorage.setItem(SS_GCLID_KEY, capturedGclid);
  } catch {
    // sessionStorage write blocked (quota, private mode) — no-op
  }
}

/**
 * Capture gclid from the URL on page load. Call once when the app initializes.
 */
export function captureGclid(): void {
  if (isSelfHost) return; // no ad attribution on a self-host instance
  try {
    const params = new URLSearchParams(window.location.search);
    const gclid = params.get('gclid');
    if (gclid && gclid.length > 10 && gclid.length < 200) {
      capturedGclid = gclid;
      persistGclid();
    }
  } catch {
    // Silently fail in SSR or restricted environments
  }
}

/**
 * Get the captured gclid (or null if none).
 */
export function getGclid(): string | null {
  return capturedGclid;
}

export type ConversionEvent = 'profile_created' | 'start_exploring' | 'mode_selected' | 'council_engaged';

// Council Engaged fires once a visitor has heard this many seconds of council
// audio (curated or custom), measured as audio actually played. One number,
// shared by both council players.
export const COUNCIL_ENGAGED_THRESHOLD_S = 60;

/**
 * Send a conversion event to the CF Worker endpoint. Only fires if a gclid was
 * captured (user came from a Google Ad). Fire-and-forget — never blocks the UI.
 *
 * Per-event sessionStorage dedup ensures each event fires at most once per tab.
 * Google Ads also dedupes server-side via order_id (gclid + event), but the
 * client check avoids the wasted round trip.
 *
 * `keepalive: true` lets the request survive page unload — important for
 * `start_exploring`, which fires inside the onClick of a landing-page CTA
 * that navigates immediately afterwards.
 */
export async function sendConversion(
  event: ConversionEvent,
  metadata?: Record<string, string>
): Promise<void> {
  if (isSelfHost) return; // no ad-conversion reporting on a self-host instance
  if (!capturedGclid) return;

  try {
    if (typeof sessionStorage !== 'undefined') {
      const firedKey = `agc_conv_fired_${event}`;
      if (sessionStorage.getItem(firedKey)) return;
      sessionStorage.setItem(firedKey, '1');
    }
  } catch {
    // sessionStorage blocked — proceed without client dedup; server dedups via order_id
  }

  try {
    const payload = {
      gclid: capturedGclid,
      event,
      timestamp: Date.now(),
      ...metadata,
    };

    fetch(`${API_BASE}/api/conversions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Silently fail - conversion tracking should never break the app
    });
  } catch {
    // Silently fail
  }
}
