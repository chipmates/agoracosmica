// NAMING CONSTRAINT: this file name becomes a public chunk URL that nearly
// every island imports. It must never contain ad-tech-looking words
// (conversion, track, ad, gclid): content blockers match those in URLs and a
// blocked chunk takes every importing island down with it, unhydrated.
//
// Listened conversion for the marketing pages: 30 seconds of audio actually
// played, summed across every play surface (figure trailers, the homepage
// voice hero, the observatory voice chip, the council preview, the sample
// players) and across page loads inside the same tab. One accumulator, one
// fire.
//
// Same consent posture as every other conversion: a gclid must be present,
// the visitor must not be on the paid ?p=1 split, and ad-measurement consent
// must be granted. Nothing here decides any of that, it only asks. The gate
// sits on the accumulator, not just on the send, so a visitor this could
// never be sent for gets no seconds counted and nothing written.
//
// The deferred ask (ASK_ON_INTERACTION in ArrivalChoice) adds one state to
// that: while the prompt is armed and still unanswered, seconds accrue but
// nothing may be sent, so a crossing is held with the moment it happened. An
// accept flushes it, a decline or a dismiss drops it. Only the prompt arms
// this, so with that flag off the gate below is the granted-only one.
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
} from '@client/utils/public/gclidCapture';

const CONVERSIONS_URL = 'https://llm.agoracosmica.org/api/conversions';

// sessionStorage on purpose: the marketing site is a multi-page app, so the
// seconds have to survive a navigation to keep counting across a visit. Tab
// scoped, never localStorage, and it holds a number of seconds and nothing else.
const SS_HEARD = 'agc_listened_seconds';

// The agc_conv_fired_* namespace is what revokeAdConsent() clears, so the key
// has to stay in it.
const SS_FIRED = 'agc_conv_fired_listened';

// sessionStorage key: at most one crossing that happened while the consent
// prompt was up and unanswered. It holds the event, the moment it happened and
// the figure, never the click ID (a flush reads that through getGclid() at send
// time). Deliberately outside the agc_conv_fired_* namespace: this is a
// not-sent marker, and the prompt's answer handlers own its lifecycle.
const SS_PENDING = 'agc_listened_pending';

interface PendingListened {
  event: 'listened';
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

// Seconds heard so far in this tab, seeded from the earlier pages of the
// visit. Kept in memory as well as in storage so the count still adds up on a
// browser that blocks sessionStorage (it just stops carrying across pages).
let heardSeconds = readStoredSeconds();
let fired = readFiredFlag();

// Pre-decision state. Both stay at their initial value unless the consent
// prompt arms them, which only the deferred ask does, so nothing below this
// line moves while ASK_ON_INTERACTION is off.
let preDecisionArmed = false;
let pending: PendingListened | null = null;
let onFirstPlayback: (() => void) | null = null;

// The seconds are only ever counted for a visitor this conversion could
// actually be sent for. Everyone else gets no accumulator and no storage
// write at all: seconds we could never use would be storage without a purpose
// (§ 25 Abs. 1 TDDDG), which is the same reason a dismissed prompt drops the
// click ID. Armed is the one case where seconds may be counted before the
// answer, because the answer is still coming and an accept may still use them.
function canCount(): boolean {
  if (isPaidVisitor() || getGclid() === null) return false;
  return adConsentGranted() || preDecisionArmed;
}

function fireListened(figureId?: string, timestamp: number = Date.now()): void {
  if (fired) return;
  if (isPaidVisitor()) return; // paid arrivals run on clicks only
  const gclid = getGclid();
  if (!gclid) return;
  if (!adConsentGranted()) return; // no opt-in, no send
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

function readPending(): PendingListened | null {
  try {
    const raw = sessionStorage.getItem(SS_PENDING);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<PendingListened>;
    if (entry.event !== 'listened' || typeof entry.timestamp !== 'number') return null;
    if (!Number.isFinite(entry.timestamp)) return null;
    return {
      event: 'listened',
      timestamp: entry.timestamp,
      // Same length cap the intent keys in agc-public.js hold ids to.
      ...(typeof entry.figureId === 'string' && entry.figureId.length < 64
        ? { figureId: entry.figureId }
        : {}),
    };
  } catch {
    return null;
  }
}

function clearPending(): void {
  pending = null;
  try {
    sessionStorage.removeItem(SS_PENDING);
  } catch {
    // no-op
  }
}

// Hold the crossing instead of sending it, with the moment it happened, so an
// accept can report when the visitor actually listened rather than when they
// answered. One entry, never a click ID.
function bufferListened(figureId?: string): void {
  const entry: PendingListened = {
    event: 'listened',
    timestamp: Date.now(),
    ...(figureId ? { figureId } : {}),
  };
  pending = entry;
  try {
    sessionStorage.setItem(SS_PENDING, JSON.stringify(entry));
  } catch {
    // storage blocked: the crossing still flushes if the answer comes on this
    // page, it just does not carry across a navigation
  }
}

/**
 * Add a slice of playback to the shared total and fire once it crosses the
 * threshold. Slices outside (0, MAX_TICK_S] are dropped, which is what keeps
 * a seek or a paused tab from buying seconds nobody heard.
 */
export function addHeardSeconds(seconds: number, figureId?: string): void {
  if (fired || pending) return;
  if (!(seconds > 0) || seconds > MAX_TICK_S) return;
  if (!canCount()) return;
  if (onFirstPlayback) {
    // The marketing players use detached Audio elements, whose play events
    // never reach the document, so this is the only place that sees playback
    // on every surface. Once, then never again.
    const notify = onFirstPlayback;
    onFirstPlayback = null;
    notify();
  }
  heardSeconds += seconds;
  try {
    sessionStorage.setItem(SS_HEARD, heardSeconds.toFixed(2));
  } catch {
    // storage blocked: the seconds still add up on this page, they just do
    // not carry across a navigation
  }
  if (heardSeconds < LISTENED_THRESHOLD_S) return;
  // Armed and unanswered: the crossing is held, not sent. Everything else is
  // a granted visitor, so it sends now.
  if (preDecisionArmed && !adConsentGranted()) bufferListened(figureId);
  else fireListened(figureId);
}

/**
 * Arm the pre-decision buffer: a consent surface is live this session and
 * unanswered, so seconds may accrue and nothing may be sent. `onPlayback` runs
 * once, on the first slice counted while armed. Only the consent prompt calls
 * this, and only behind ASK_ON_INTERACTION.
 */
export function armPreDecisionListening(onPlayback?: () => void): void {
  preDecisionArmed = true;
  pending = readPending();
  onFirstPlayback = onPlayback ?? null;
}

/**
 * Consent granted: send a crossing that happened before the answer, dated when
 * it happened. The click ID is read here, at send time, through the same getter
 * every other send uses, and the agc_conv_fired_listened flag still applies.
 */
export function flushPreDecisionListening(): void {
  preDecisionArmed = false;
  onFirstPlayback = null;
  const entry = pending ?? readPending();
  clearPending();
  if (!entry) return; // answered before the threshold: normal accrual continues
  fireListened(entry.figureId, entry.timestamp);
}

/**
 * Declined or dismissed: nothing may ever be sent for this visit, so the held
 * crossing and the seconds behind it go the way of the click ID.
 */
export function dropPreDecisionListening(): void {
  preDecisionArmed = false;
  onFirstPlayback = null;
  heardSeconds = 0;
  clearPending();
  try {
    sessionStorage.removeItem(SS_HEARD);
  } catch {
    // no-op
  }
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
