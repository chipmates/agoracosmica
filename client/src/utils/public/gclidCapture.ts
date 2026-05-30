// Google Ads conversion tracking. Captures the gclid from the landing URL and,
// ONLY after the visitor gives ad-measurement consent, relays a conversion
// event to our CF Worker, which forwards it to the Google Ads Conversion API.
// No tracking cookies, no pixel. The gclid lives in sessionStorage (tab-scoped)
// so it survives reloads within the same tab; the consent decision lives in
// localStorage so a returning ad visitor keeps their choice. Nothing reaches
// Google until consent is granted, and revoking consent clears the gclid.

import { isSelfHost } from '../../config/deployment';

const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

// sessionStorage key: persist gclid across reloads of the same tab. Without
// this, a user who clicks an ad → lands at /?gclid=… → reloads (URL no longer
// carries the param) → would lose the click ID and miss a later conversion
// inside that same tab. Tab-scoped on purpose — a new tab without the URL
// param has no attribution.
const SS_GCLID_KEY = 'agc_gclid';

// localStorage key: the ad-measurement consent decision. Kept separate from the
// gclid so a returning ad visitor keeps their choice across tabs and sessions.
// This is a consent record (technically necessary, § 25 Abs. 2 Nr. 2 TDDDG).
const LS_AD_CONSENT_KEY = 'agc_ad_consent';
const AD_CONSENT_VERSION = '1.0.0';

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
 * Get the captured gclid (or null if none). A non-null value means this visitor
 * arrived from a Google ad, so the consent control should be offered to them.
 */
export function getGclid(): string | null {
  return capturedGclid;
}

/**
 * Has the visitor granted ad-measurement consent? Conversions are only sent to
 * Google when this is true. Default is false (no consent until explicitly given).
 */
export function adConsentGranted(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(LS_AD_CONSENT_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as { granted?: boolean }).granted === true;
  } catch {
    return false;
  }
}

/**
 * Record ad-measurement consent and keep the gclid available for the later
 * conversion events (mode_selected, council_engaged) that fire outside the modal.
 */
export function grantAdConsent(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        LS_AD_CONSENT_KEY,
        JSON.stringify({ granted: true, version: AD_CONSENT_VERSION, timestamp: Date.now() })
      );
    }
  } catch {
    // localStorage blocked — consent simply will not persist across reloads
  }
  persistGclid();
}

/**
 * Withdraw ad-measurement consent. Records the decline and drops the captured
 * gclid plus any per-event dedup flags so nothing further is sent to Google.
 */
export function revokeAdConsent(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        LS_AD_CONSENT_KEY,
        JSON.stringify({ granted: false, version: AD_CONSENT_VERSION, timestamp: Date.now() })
      );
    }
  } catch {
    // no-op
  }
  capturedGclid = null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SS_GCLID_KEY);
      for (const event of ['profile_created', 'mode_selected', 'council_engaged']) {
        sessionStorage.removeItem(`agc_conv_fired_${event}`);
      }
    }
  } catch {
    // no-op
  }
}

export type ConversionEvent = 'profile_created' | 'mode_selected' | 'council_engaged';

// Council Engaged fires once a visitor has heard this many seconds of council
// audio (curated or custom), measured as audio actually played. One number,
// shared by both council players.
export const COUNCIL_ENGAGED_THRESHOLD_S = 60;

/**
 * Send a conversion event to the CF Worker endpoint. Only fires if a gclid was
 * captured (user came from a Google Ad) AND the visitor granted ad-measurement
 * consent. Fire-and-forget — never blocks the UI.
 *
 * Per-event sessionStorage dedup ensures each event fires at most once per tab.
 * Google Ads also dedupes server-side via order_id (gclid + event), but the
 * client check avoids the wasted round trip.
 *
 * `keepalive: true` lets the request survive page unload.
 */
export async function sendConversion(
  event: ConversionEvent,
  metadata?: Record<string, string>
): Promise<void> {
  if (isSelfHost) return; // no ad-conversion reporting on a self-host instance
  if (!capturedGclid) return;
  if (!adConsentGranted()) return; // no send until the visitor opts in

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
