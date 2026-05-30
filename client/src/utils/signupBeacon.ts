// Anonymous signup beacon
// Fires from WelcomeDisclosureModal.handleComplete IF the user is new (no
// prior profile/history/onboarding). Distinct from entry (fires for everyone
// who completes the welcome step) and from profile_created (gclid-gated,
// ad-attributed only). Lets the dashboard show total signups including organic.
//
// Privacy: aggregate counter only. No user dimension. No IP retention.
// Same posture as the entry and page-load beacons.

import { isSelfHost } from '../config/deployment';

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
 * Send a signup beacon. Fire-and-forget — never throws, never blocks the
 * caller, never breaks the signup flow on network failure. Captures only:
 *   - path (no query string, validated server-side against a regex)
 *   - language (en/de)
 *   - country (CF-edge two-letter code, server-side)
 *
 * No user dimension, no email, no name. Aggregate counter only.
 *
 * Caller is responsible for the "is new user" gate: only fire on first
 * signup, never on returning sign-in. See WelcomeDisclosureModal.handleComplete
 * for the isFirstLogin check.
 */
export function sendSignupBeacon(): void {
  if (isSelfHost) return; // self-host instances are analytics-silent
  try {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const body = JSON.stringify({
      path,
      language: detectLanguage(),
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
