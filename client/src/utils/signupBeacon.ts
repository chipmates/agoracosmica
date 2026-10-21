// Anonymous signup beacon
// Fires from WelcomeDisclosureModal.handleComplete on every accepted welcome:
// on a first visit, and again when a browser accepts a new terms version.
// Distinct from profile_created (gclid-gated, ad-attributed only). Lets the
// dashboard show total signups including organic.
//
// Privacy: aggregate counter only. No user dimension. No IP retention.
// Same posture as the entry and page-load beacons.

import { isSelfHost } from '../config/deployment';
import { mayPostTo } from './productionHost';
import { probeField } from './probeSession';
import { shownLanguage } from './shownLanguage';

const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

/**
 * Send a signup beacon. Fire-and-forget — never throws, never blocks the
 * caller, never breaks the signup flow on network failure. Captures only:
 *   - path (no query string, validated server-side against a regex)
 *   - language (en/de)
 *   - country (CF-edge two-letter code, server-side)
 *   - the in-house probe constant, only from a browser marked as one
 *
 * No user dimension, no email, no name. Aggregate counter only.
 *
 * No "is new user" gate: telling new from returning would take a read of the
 * browser's history for counting. A new terms version that makes browsers
 * accept again shows up as extra signups that week.
 */
export function sendSignupBeacon(): void {
  if (isSelfHost) return; // self-host instances are analytics-silent
  if (!mayPostTo(API_BASE)) return; // a local or preview copy counts nothing
  try {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const body = JSON.stringify({
      path,
      language: shownLanguage(),
      probe: probeField(),
    });

    fetch(`${API_BASE}/v1/signup`, {
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
