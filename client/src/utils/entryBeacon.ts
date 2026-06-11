// Anonymous entry beacon
// Fires from WelcomeDisclosureModal.handleComplete — the post-cinematic
// welcome step where consent is given and the profile is created (since the
// 2026-05-29 entry-cinematic refactor; was App.handleEntryComplete before).
// This is the deliberate "entered the app" moment. Sits between the page-load
// beacon (every arrival) and the session row (Turnstile-gated).
//
// Privacy: aggregate counter only. No user dimension. No IP retention.
// Disclosed in docs/MEASUREMENT.md alongside the other event counters.

import { isSelfHost } from '../config/deployment';

const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

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
 * Send an entry beacon. Fire-and-forget — never throws, never blocks the
 * caller, never breaks the login flow on network failure. Captures only:
 *   - path (no query string, validated server-side against a regex)
 *   - language (en/de)
 *   - country (CF-edge two-letter code, server-side)
 *
 * No user dimension, no message content, no fingerprint. Same posture as
 * the page-load and playback beacons.
 */
export function sendEntryBeacon(): void {
  if (isSelfHost) return; // self-host instances are analytics-silent
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
