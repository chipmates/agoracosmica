// Anonymous content-completion beacon
// Fires when a content item (story / teaching / prism / council) is marked
// completed in localStorage — the same trigger as the gamification star award,
// so each beacon represents a real consumption, not a click-and-bail.
//
// Privacy: aggregate counter only. No user dimension. No IP retention.
// See docs/MEASUREMENT.md for the full disclosure.

import { getMarketingSource } from './public/gclidCapture';

const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

export type PlaybackContentType = 'story' | 'teaching' | 'prism' | 'council' | 'foreword';

interface PlaybackPayload {
  type: PlaybackContentType;
  figureId?: string;
  mode?: string;
  language?: string;
}

/**
 * Send a content-completion beacon. Fire-and-forget — never throws, never
 * blocks the caller, never breaks the gamification flow on network failure.
 */
export function sendPlaybackBeacon(payload: PlaybackPayload): void {
  try {
    const body = JSON.stringify({
      type: payload.type,
      figureId: payload.figureId,
      mode: payload.mode,
      language: payload.language,
    });

    fetch(`${API_BASE}/v1/playback`, {
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

/**
 * Read the current UI language from the document or localStorage. Falls back
 * to 'en'. Used so the beacon can label content engagement by language without
 * each caller needing to plumb it through.
 */
export function detectCurrentLanguage(): 'en' | 'de' {
  try {
    const docLang = typeof document !== 'undefined' ? document.documentElement.lang : '';
    if (docLang && docLang.toLowerCase().startsWith('de')) return 'de';
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('language') : null;
    if (stored && stored.toLowerCase().startsWith('de')) return 'de';
  } catch {
    // Ignore
  }
  return 'en';
}
