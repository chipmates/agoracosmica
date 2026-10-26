// NAMING CONSTRAINT: this file name becomes a public chunk URL that nearly
// every island imports. It must never contain ad-tech-looking words
// (conversion, track, ad, gclid): content blockers match those in URLs and a
// blocked chunk takes every importing island down with it, unhydrated.
//
// Listened conversion for the marketing pages: 30 seconds of audio actually
// played, summed across every play surface (the story player, figure
// trailers, the homepage voice hero, the observatory voice chip, the council
// preview, the sample players). One accumulator, one fire.
//
// Same consent posture as every other conversion: a click ID must be present,
// the page must not be on the paid ?p=1 split, ad-measurement consent must be
// granted, and the browser must not be one of our own marked test browsers.
// Nothing here decides any of that, it only asks.
//
// Before the answer everything lives in page memory: the click ID the card
// holds, the seconds heard and at most one crossing with the moment it
// happened. Nothing is read from or written to the browser's storage until a
// yes; a full page load starts from nothing. A yes sends the held crossing
// with its own time, a no or a close drops all of it.
//
// The worker URL is absolute on purpose: agoracosmica.org has no /api/* route,
// so a relative path falls through the SPA fallback (/* -> index.html 200),
// the fetch resolves, .catch() never fires, and the conversion silently never
// arrives. (Same posture as ArrivalChoice's fireStartExploring.)

import { useEffect } from 'react';
import {
  adConsentGranted,
  getGclid,
  isPaidVisitor,
  LISTENED_THRESHOLD_S,
  revokeAdConsent as revokeStoredConsent,
} from '@client/utils/public/gclidCapture';
import { isProbeSessionNow } from '@client/utils/probeSession';

// For the footer switch. Every island that reaches gclidCapture must also reach
// this module, so the two share one chunk named after this file: a chunk named
// after gclidCapture would be blocked (client/scripts/check-asset-names.mjs).
export { adConsentGranted } from '@client/utils/public/gclidCapture';

const CONVERSIONS_URL = 'https://llm.agoracosmica.org/api/conversions';

// The worker URLs are production's, so the islands post only from a page served
// on the production site: a local or preview build sends nothing. Same hosts as
// PRODUCTION_HOSTS in public/agc-public.js. Lives here so it rides this chunk.
export const PRODUCTION_HOSTS: readonly string[] = ['agoracosmica.org', 'www.agoracosmica.org'];

export function onProductionHost(): boolean {
  try {
    return typeof window !== 'undefined' && PRODUCTION_HOSTS.includes(window.location.hostname);
  } catch {
    return false;
  }
}

// The same key gclidCapture stores the click ID under after a yes.
const SS_CLICK = 'agc_gclid';

// sessionStorage, written only after a yes: the seconds carry across the pages
// of a consenting visit. Tab scoped, never localStorage, a number and nothing
// else.
const SS_HEARD = 'agc_listened_seconds';

// The agc_conv_fired_* namespace is what revokeAdConsent() clears, so the key
// has to stay in it.
const SS_FIRED = 'agc_conv_fired_listened';

interface PendingListened {
  timestamp: number;
  figureId?: string;
}

// Longest gap between two samples that still counts as audio someone heard.
// A bigger one is a seek, a stall, or a tab that came back, never playback,
// so it is dropped instead of added (same rule as the council accumulator).
const MAX_TICK_S = 10;

// How often the wall-clock surfaces sample. Small enough that stopping mid
// second loses nothing worth counting.
const TICK_MS = 1000;

// Ceiling for a single wall-clock activation, a little above the 50s clips
// those surfaces play. Their hooks report playing from the play event and do
// not watch for a pause the audio-focus coordinator triggers, so without this
// a silently paused clip could keep buying seconds. One activation can now
// never count more than one clip's worth.
const MAX_ACTIVATION_S = 60;

// ---- the click ID until the answer --------------------------------------

// The card's copy of the landing's click ID. gclidCapture keeps its own, but
// the player's router drops that one on a page change it handles in place,
// while the visit, and with it the question, goes on.
let heldClick: string | null = null;

export function holdClick(id: string | null): void {
  heldClick = id;
}

/** The click ID this page may still use: the stored or captured one, else the held one. */
export function clickId(): string | null {
  return getGclid() ?? heldClick;
}

/**
 * After grantAdConsent(): if gclidCapture no longer has the click ID (a page
 * change in place dropped it), store the held one under its key, as the
 * reviewed text promises for a yes.
 */
export function keepClickAfterYes(): void {
  if (getGclid() !== null || heldClick === null || isPaidVisitor() || !adConsentGranted()) return;
  try {
    sessionStorage.setItem(SS_CLICK, heldClick);
  } catch {
    // storage blocked: the steps on this page still find it in memory
  }
}

// ---- the seconds ----------------------------------------------------------

let heardSeconds = 0;
let fired = false;
let restored = false;
// Armed while the card waits for its answer: seconds may accrue, in memory.
let preDecisionArmed = false;
let pending: PendingListened | null = null;

function readStoredSeconds(): number {
  try {
    const stored = parseFloat(sessionStorage.getItem(SS_HEARD) ?? '');
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  } catch {
    return 0;
  }
}

function readFiredFlag(): boolean {
  try {
    return sessionStorage.getItem(SS_FIRED) === '1';
  } catch {
    // storage blocked: the worker still dedups via order_id (gclid:event)
    return false;
  }
}

// Only ever called with a yes on record: the seconds of earlier pages of a
// consenting visit join the ones heard here.
function restoreOnce(): void {
  if (restored) return;
  restored = true;
  heardSeconds = Math.max(heardSeconds, readStoredSeconds());
  fired = fired || readFiredFlag();
}

// The seconds are only ever counted for a visitor this conversion could
// actually be sent for: seconds we could never use would be data without a
// purpose (§ 25 Abs. 1 TDDDG). Armed is the one case where seconds count
// before the answer, in memory, because an accept may still use them.
function canCount(): boolean {
  if (isPaidVisitor() || clickId() === null || isProbeSessionNow()) return false;
  return adConsentGranted() || preDecisionArmed;
}

function fireListened(figureId?: string, timestamp: number = Date.now()): void {
  if (!onProductionHost()) return;
  if (isPaidVisitor()) return; // paid arrivals run on clicks only
  const gclid = clickId();
  if (!gclid) return;
  if (isProbeSessionNow()) return; // our own test browsers send Google nothing
  if (!adConsentGranted()) return; // no opt-in, no send, nothing read
  restoreOnce();
  if (fired) return;
  fired = true;
  try {
    if (sessionStorage.getItem(SS_FIRED)) return;
    sessionStorage.setItem(SS_FIRED, '1');
  } catch {
    // worker dedups via order_id (gclid:event), so a blocked store is fine
  }
  try {
    fetch(CONVERSIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gclid,
        event: 'listened',
        timestamp,
        ...(figureId ? { figureId } : {}),
      }),
      keepalive: true,
    }).catch(() => {
      /* never surface */
    });
  } catch {
    /* same posture */
  }
}

/**
 * Add a slice of playback to the shared total and fire once it crosses the
 * threshold. Slices outside (0, MAX_TICK_S] are dropped, which is what keeps
 * a seek or a paused tab from buying seconds nobody heard.
 */
export function addHeardSeconds(seconds: number, figureId?: string): void {
  if (!(seconds > 0) || seconds > MAX_TICK_S) return;
  if (!canCount()) return;
  const granted = adConsentGranted();
  if (granted) restoreOnce();
  if (fired || pending) return;
  heardSeconds += seconds;
  if (granted) {
    try {
      sessionStorage.setItem(SS_HEARD, heardSeconds.toFixed(2));
    } catch {
      // storage blocked: the seconds still add up on this page
    }
  }
  if (heardSeconds < LISTENED_THRESHOLD_S) return;
  if (granted) {
    fireListened(figureId);
    return;
  }
  // Unanswered: the crossing is held in memory with the moment it happened,
  // so a yes reports when the visitor listened, not when they answered.
  pending = { timestamp: Date.now(), ...(figureId ? { figureId } : {}) };
}

/** The card is waiting for its answer: seconds may accrue, in memory only. */
export function armPreDecisionListening(): void {
  preDecisionArmed = true;
}

/** A yes: send a crossing held before it, dated when it happened. */
export function flushPreDecisionListening(): void {
  preDecisionArmed = false;
  const entry = pending;
  pending = null;
  if (!entry) return; // answered before the threshold: counting goes on
  fireListened(entry.figureId, entry.timestamp);
}

/** A no or a close: the held crossing and the seconds behind it go. */
export function dropPreDecisionListening(): void {
  preDecisionArmed = false;
  heardSeconds = 0;
  pending = null;
}

/**
 * The footer's withdrawal and the card's no: the stored answer, click ID and
 * flags (gclidCapture), and everything this page holds in memory.
 */
export function revokeAdConsent(): void {
  revokeStoredConsent();
  heldClick = null;
  dropPreDecisionListening();
  fired = false;
  restored = false;
}

/**
 * Count playback on an audio element by the distance the playhead actually
 * travelled. Returns the detach function. Backwards jumps (a new src, a
 * restart) and forward seeks fall outside the slice window and are dropped.
 */
export function trackHeardSeconds(
  audio: HTMLAudioElement,
  getFigureId?: () => string | undefined
): () => void {
  let last = audio.currentTime;
  const onTimeUpdate = (): void => {
    const now = audio.currentTime;
    const delta = now - last;
    last = now;
    addHeardSeconds(delta, getFigureId?.());
  };
  audio.addEventListener('timeupdate', onTimeUpdate);
  return () => audio.removeEventListener('timeupdate', onTimeUpdate);
}

/**
 * Count playback for surfaces that expose a playing flag but not the audio
 * element (the hooks shared with the app). Wall clock while `playing` is
 * true, sampled every second, so a stall can never add more than one slice.
 */
export function useHeardSeconds(playing: boolean, figureId?: string): void {
  useEffect(() => {
    if (!playing) return;
    let last = Date.now();
    let counted = 0;
    const tick = (): void => {
      const now = Date.now();
      const slice = Math.min((now - last) / 1000, MAX_ACTIVATION_S - counted);
      last = now;
      if (slice <= 0) return;
      counted += slice;
      addHeardSeconds(slice, figureId);
    };
    const timer = window.setInterval(tick, TICK_MS);
    return () => {
      window.clearInterval(timer);
      tick(); // the part-second the interval never reached
    };
  }, [playing, figureId]);
}
