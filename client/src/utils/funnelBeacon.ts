// Anonymous funnel-step beacon (Wave 1)
// Fires once per tab per step: cinematic_start / cinematic_end (LoginPage),
// welcome_shown (WelcomeDisclosureModal), first_turn (HomePage). The marketing
// pages' cta_click fires from agc-public.js with the same payload shape.
//
// Privacy: keyless aggregate counter only. No clientId, no gclid, no IP, no
// raw milliseconds — timing leaves the browser only as a coarse bucket index.
// There is no join key between funnel steps; the funnel is read at the
// population level (compare totals), never per person. The one-shot dedup
// flag lives in tab-scoped sessionStorage and is never transmitted (mirrors
// the agc_conv_fired_* pattern in gclidCapture.ts). Never localStorage: that
// would be cross-session memory of an individual.
// Disclosed in docs/MEASUREMENT.md alongside the other event counters.

import { isSelfHost } from '../config/deployment';

const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

export type FunnelStep =
  | 'cta_click'
  | 'cinematic_start'
  | 'cinematic_end'
  | 'welcome_shown'
  | 'first_turn';

export type CinematicOutcome = 'watched' | 'skipped';

/**
 * Cinematic dwell bucket boundaries, in seconds. Four buckets:
 * index 0 = 0-5s, 1 = 5-15s, 2 = 15-30s, 3 = 30s+.
 * Adjust the boundaries here (one line); the bucket count follows.
 */
export const CINEMATIC_DWELL_BUCKETS_S: readonly number[] = [5, 15, 30];

/** Map an elapsed duration to its coarse dwell bucket index (0-based). */
export function cinematicDwellBucket(elapsedMs: number): number {
  const seconds = elapsedMs / 1000;
  for (let i = 0; i < CINEMATIC_DWELL_BUCKETS_S.length; i++) {
    if (seconds < CINEMATIC_DWELL_BUCKETS_S[i]) return i;
  }
  return CINEMATIC_DWELL_BUCKETS_S.length;
}

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

// Tab-scoped one-shot. The flag itself never leaves the browser.
function alreadyFired(step: FunnelStep): boolean {
  try {
    return sessionStorage.getItem(`agc_funnel_fired_${step}`) === '1';
  } catch {
    return false;
  }
}

function markFired(step: FunnelStep): void {
  try {
    sessionStorage.setItem(`agc_funnel_fired_${step}`, '1');
  } catch {
    // Storage blocked (private mode, quota) — the beacon still fires once
    // per page lifetime via the call sites' own guards.
  }
}

interface FunnelFields {
  figureId?: string;
  mode?: string;
  outcome?: CinematicOutcome;
  bucket?: number;
}

/**
 * Send a funnel-step beacon, at most once per tab per step. Fire-and-forget:
 * never throws, never blocks the caller, never surfaces a network failure.
 *
 * Payload: step, optional figureId/mode (content labels, validated
 * server-side), optional outcome (watched/skipped), optional coarse bucket
 * index, and language (en/de). Country is derived server-side at the CF edge.
 * No user dimension of any kind.
 */
export function sendFunnelBeaconOnce(step: FunnelStep, fields: FunnelFields = {}): void {
  if (isSelfHost) return; // self-host instances are analytics-silent
  try {
    if (alreadyFired(step)) return;
    markFired(step);

    const body = JSON.stringify({
      step,
      figureId: fields.figureId || undefined,
      mode: fields.mode || undefined,
      outcome: fields.outcome,
      bucket: fields.bucket,
      language: detectLanguage(),
    });
    const url = `${API_BASE}/v1/funnel`;

    // sendBeacon survives navigation/unload (cinematic_end can race the
    // handoff). text/plain keeps it a simple CORS request, so there is no
    // preflight to lose mid-transition; the worker parses the JSON body
    // regardless of content type.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return;
    }
    fetch(url, {
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
