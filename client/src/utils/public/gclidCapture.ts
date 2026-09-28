// Google Ads conversion measurement, only with the visitor's yes. The click ID
// (gclid) from the landing URL stays in page memory while the landing page asks
// its question; only a yes stores it (sessionStorage, this tab), so later pages
// and the app can report steps. The answer lives in localStorage. A paid
// arrival (?p=1) never keeps a click ID. No tracking cookies, no pixel, and
// nothing reaches Google until consent is granted.

import { isSelfHost } from '../../config/deployment';

const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

// sessionStorage key, written only after a yes: the click ID for the rest of
// this tab, so a step on a later page or in the app can still be reported.
const SS_GCLID_KEY = 'agc_gclid';

// localStorage key: the ad-measurement answer. A consent record (yes or no,
// version, time), kept so the choice is respected across visits.
const LS_AD_CONSENT_KEY = 'agc_ad_consent';
const AD_CONSENT_VERSION = '1.1.0';
// An answer is remembered for 12 months; an older one is removed and counts as
// no answer, so the question may be asked again.
const AD_CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
// Clock skew allowance for a record that looks slightly newer than now.
const AD_CONSENT_SKEW_MS = 24 * 60 * 60 * 1000;

let capturedGclid: string | null = null;
// This page's address carried ?p=1. Page memory only: later pages of a paid
// visit carry no click ID, since the landing kept none.
let isPaid = false;

function isValidGclid(value: string | null): value is string {
  return !!value && value.length > 10 && value.length < 200;
}

function urlHasPaidParam(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('p') === '1';
  } catch {
    return false;
  }
}

function dropStoredGclid(): void {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(SS_GCLID_KEY);
  } catch {
    // sessionStorage unavailable — nothing stored to drop
  }
}

// Module load, before any importer can ask: a paid landing drops every click ID,
// even one stored after an earlier yes. Otherwise a click ID stored after a yes
// earlier in this tab is picked up; without a yes on record it is removed
// unread.
try {
  if (typeof window !== 'undefined') {
    isPaid = urlHasPaidParam();
    if (isPaid || !adConsentGranted()) {
      dropStoredGclid();
    } else if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem(SS_GCLID_KEY);
      if (isValidGclid(stored)) capturedGclid = stored;
    }
  }
} catch {
  // sessionStorage unavailable (Safari private mode, SSR) — no-op
}

function persistGclid(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (capturedGclid && !isPaid) sessionStorage.setItem(SS_GCLID_KEY, capturedGclid);
  } catch {
    // sessionStorage write blocked (quota, private mode) — no-op
  }
}

/**
 * Read the click ID from the landing URL. Call once per page, before anything
 * decides on it. With a yes already on record, the click ID is stored for the
 * tab. Without one, `holdUntilAnswer` (the landing page's question) keeps it in
 * page memory until the answer; everywhere else it is dropped.
 */
export function captureGclid(options: { holdUntilAnswer?: boolean } = {}): void {
  if (isSelfHost) return; // no ad attribution on a self-host instance
  try {
    const params = new URLSearchParams(window.location.search);
    // Paid-campaign arrivals carry ?p=1. They run on clicks only: no click ID
    // is kept, the question never shows, nothing is ever sent for them.
    if (params.get('p') === '1') {
      isPaid = true;
      capturedGclid = null;
      dropStoredGclid();
      return;
    }
    if (isPaid) return;
    const gclid = params.get('gclid');
    if (!isValidGclid(gclid)) return;
    if (adConsentGranted()) {
      capturedGclid = gclid;
      persistGclid();
    } else if (options.holdUntilAnswer && !adConsentDecided()) {
      capturedGclid = gclid;
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
 * True if this page's address carries the paid-campaign parameter (?p=1). Paid
 * arrivals are never shown the consent step and never have a conversion sent
 * (we run paid on clicks only), so the consent UI checks this before rendering.
 */
export function isPaidVisitor(): boolean {
  return isPaid;
}

/**
 * The stored answer, if it still counts: written under the current consent
 * version (an older version no longer covers the current scope) and less than
 * 12 months old. Anything else counts as no answer and is removed, so no
 * answer is kept longer than the 12 months the policy states.
 */
function currentAdConsent(): { granted: boolean } | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LS_AD_CONSENT_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as { granted?: unknown; version?: unknown; timestamp?: unknown };
    const age = Date.now() - Number(record.timestamp);
    if (record.version !== AD_CONSENT_VERSION || !Number.isFinite(age) ||
        age >= AD_CONSENT_MAX_AGE_MS || age < -AD_CONSENT_SKEW_MS) {
      localStorage.removeItem(LS_AD_CONSENT_KEY);
      return null;
    }
    return { granted: record.granted === true };
  } catch {
    return null;
  }
}

/**
 * True once the visitor has made an explicit ad-measurement choice (granted or
 * declined) that still counts. Used to avoid re-asking.
 */
export function adConsentDecided(): boolean {
  return currentAdConsent() !== null;
}

/**
 * Drop the captured gclid from memory and sessionStorage without recording a
 * consent decision.
 */
export function clearGclid(): void {
  capturedGclid = null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SS_GCLID_KEY);
    }
  } catch {
    // no-op
  }
}

/**
 * Has the visitor granted ad-measurement consent? Conversions are only sent to
 * Google when this is true. Default is false (no consent until explicitly given).
 */
export function adConsentGranted(): boolean {
  return currentAdConsent()?.granted === true;
}

/**
 * Record ad-measurement consent and store the click ID held in page memory, so
 * the later steps (listened, profile_created, dialogue_started,
 * conversation_deepened, council_engaged) can be reported from other pages.
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
 * gclid, the per-event dedup flags and the listening seconds counted toward
 * the 30-second step, so nothing further is sent to Google.
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
      // Every event in ConversionEvent, including the ones fired from the
      // marketing islands. A flag left behind would not leak anything, but it
      // would block a re-granted visitor's event from ever firing again.
      for (const event of [
        'start_exploring',
        'profile_created',
        'council_engaged',
        'listened',
        'dialogue_started',
        'conversation_deepened',
      ]) {
        sessionStorage.removeItem(`agc_conv_fired_${event}`);
      }
      // The public pages' listening total and its held crossing (heardSeconds.ts).
      sessionStorage.removeItem('agc_listened_seconds');
      sessionStorage.removeItem('agc_listened_pending');
    }
  } catch {
    // no-op
  }
}

export type ConversionEvent =
  | 'start_exploring'
  | 'profile_created'
  | 'council_engaged'
  | 'listened'
  | 'dialogue_started'
  | 'conversation_deepened';

// Council Engaged fires once a visitor has heard this many seconds of council
// audio (curated or custom), measured as audio actually played. One number,
// shared by both council players.
export const COUNCIL_ENGAGED_THRESHOLD_S = 60;

// Listened fires once a visitor has heard this many seconds of audio on the
// marketing pages, measured as audio actually played and summed across every
// play surface and page of the tab. One number, shared by all of them.
export const LISTENED_THRESHOLD_S = 30;

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
  if (isPaid) return; // paid arrivals run on clicks only, never forward a gclid
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
