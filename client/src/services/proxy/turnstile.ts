// Cloudflare Turnstile — bot protection for free-tier sessions
// Renders a managed challenge, returns a token for session creation

import { isSelfHost } from '../../config/deployment';
import { sendFunnelBeacon, turnstileTimeBucket } from '../../utils/funnelBeacon';
import { shownLanguage } from '../../utils/shownLanguage';

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
// 30s, not 15s: mobile Safari resuming from bfcache or a long backgrounded tab
// often needs more than 15s for the cross-origin iframe to wake up enough to
// post its callback back. The user-facing toast on hit is the generic
// "request took too long" — better to wait a bit longer than to surface that
// to a user who is already actively trying to send a message.
const TURNSTILE_TIMEOUT_MS = 30_000;
// Once the challenge turns interactive the clock is on a human, not on an
// iframe: the box has to be noticed, read and ticked. Total budget from render.
const TURNSTILE_INTERACTIVE_TIMEOUT_MS = 120_000;
// After this much hidden time, the cross-origin Turnstile iframe is likely
// frozen/stale on iOS Safari; reset module state on return so the next call
// reloads the script and container fresh. 5 min mirrors the JWT refresh
// threshold — if the tab was hidden longer, getSessionToken would re-issue
// anyway, and a fresh re-issue is what we're protecting.
const STALE_HIDDEN_THRESHOLD_MS = 5 * 60 * 1000;

/** Turnstile escalated to a checkbox the visitor has to tick. */
export const TURNSTILE_INTERACTIVE_START_EVENT = 'agc:turnstile-interactive-start';
/** That challenge settled, however it settled. */
export const TURNSTILE_INTERACTIVE_END_EVENT = 'agc:turnstile-interactive-end';

let scriptLoaded = false;
let scriptLoading = false;
let widgetId: string | null = null;

/**
 * What the bot check is doing right now. 'invisible' = running with nothing on
 * screen, 'interactive' = a checkbox is waiting on the visitor.
 *
 * Every cross-module signal this file emits is paired with a readable snapshot,
 * because an event can fire before a late-mounting listener subscribes: a
 * consumer seeds itself from the snapshot and uses the events only for changes.
 */
export type TurnstileChallengeState = 'idle' | 'invisible' | 'interactive';
let challengeState: TurnstileChallengeState = 'idle';

/** Readable snapshot of the state the interactive events describe. */
export function getTurnstileChallengeState(): TurnstileChallengeState {
  return challengeState;
}

/**
 * Whether a checkbox is waiting on the visitor right now. The escalation can
 * fire before a late-mounting listener subscribes to the events, so consumers
 * must seed their state from this and use the events only for changes.
 */
export function isTurnstileInteractive(): boolean {
  return challengeState === 'interactive';
}

function emit(eventName: string): void {
  challengeState = eventName === TURNSTILE_INTERACTIVE_START_EVENT ? 'interactive' : 'idle';
  try {
    window.dispatchEvent(new CustomEvent(eventName));
  } catch { /* ignore */ }
}

// The gate's mobile breakpoint. Below it the browser's own bottom bar and the
// thumb zone sit at the bottom edge, so the box never goes lower than this.
const NARROW_VIEWPORT_PX = 768;
// The chat composer is cleared as one block, even under an overlay: it holds
// the stop-voice icon and is where the visitor's eyes return.
const BOTTOM_CONTROL_SELECTOR = '.unified-input-container';
// Everything else a visitor can tap. Measured on every screen the box can
// reach (consent card, figure pick, composer), never listed per screen.
const TAPPABLE_SELECTOR = [
  'button', 'a[href]', 'input:not([type="hidden"])', 'textarea', 'select',
  '[role="button"]', '[role="link"]', '[contenteditable="true"]',
].join(', ');
// Text a visitor must be able to read while deciding (a disclosure). Kept
// clear when the screen has room; a control always outranks it.
const KEEP_CLEAR_SELECTOR = '[data-keep-clear]';
// The 'normal' widget, plus the air kept between it and whatever it clears.
const CHALLENGE_BOX_PX = 72;
const CHALLENGE_BOX_WIDTH_PX = 300;
const CLEARANCE_GAP_PX = 12;

interface Band { top: number; bottom: number; soft: boolean }
type Rect = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right' | 'width' | 'height'>;

function isOnScreen(rect: Rect): boolean {
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
}

/**
 * Whether a tap at the control's visible centre would reach it. A control
 * under a modal's backdrop cannot be tapped, so the box may sit over it.
 */
function isReachable(el: HTMLElement, rect: Rect): boolean {
  if (typeof document.elementFromPoint !== 'function') return true;
  const x = Math.min(Math.max(rect.left + rect.width / 2, 0), window.innerWidth - 1);
  const top = Math.max(rect.top, 0);
  const bottom = Math.min(rect.bottom, window.innerHeight);
  const y = Math.min(Math.max((top + bottom) / 2, 0), window.innerHeight - 1);
  const hit = document.elementFromPoint(x, y);
  return hit === null || el.contains(hit);
}

/**
 * The part of an element its scrolling ancestors leave visible: a disclosure
 * scrolled mostly out of its panel only blocks the sliver still showing.
 */
function visiblePart(el: HTMLElement): Rect | null {
  const r = el.getBoundingClientRect();
  let { top, bottom, left, right } = r;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const style = window.getComputedStyle(p);
    if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
    const q = p.getBoundingClientRect();
    top = Math.max(top, q.top);
    bottom = Math.min(bottom, q.bottom);
    left = Math.max(left, q.left);
    right = Math.min(right, q.right);
  }
  if (bottom <= top || right <= left) return null;
  return { top, bottom, left, right, width: right - left, height: bottom - top };
}

/**
 * The vertical spans the centred box must stay off: every reachable control in
 * its column. A link is kept with its sentence, so the consent line stays
 * readable along with the Terms link inside it.
 */
function obstacleBands(boxWidth: number, ignore: HTMLElement | null): Band[] {
  const left = (window.innerWidth - boxWidth) / 2;
  const right = left + boxWidth;
  const bands: Band[] = [];
  const add = (rect: Rect, soft = false): void => {
    if (!isOnScreen(rect) || rect.right <= left || rect.left >= right) return;
    bands.push({ top: rect.top, bottom: rect.bottom, soft });
  };

  document.querySelectorAll<HTMLElement>(BOTTOM_CONTROL_SELECTOR).forEach((el) => {
    add(el.getBoundingClientRect());
  });

  // The hit test must see what lies under the box, not the box itself.
  const restore = ignore ? ignore.style.pointerEvents : '';
  if (ignore) ignore.style.pointerEvents = 'none';
  try {
    document.querySelectorAll<HTMLElement>(TAPPABLE_SELECTOR).forEach((el) => {
      if (ignore && ignore.contains(el)) return;
      const rect = el.getBoundingClientRect();
      if (!isOnScreen(rect) || !isReachable(el, rect)) return;
      add(rect);
      if (el.tagName === 'A') {
        const sentence = el.parentElement?.closest<HTMLElement>('p, li, label');
        if (sentence && (!ignore || !ignore.contains(sentence))) add(sentence.getBoundingClientRect());
      }
    });
    document.querySelectorAll<HTMLElement>(KEEP_CLEAR_SELECTOR).forEach((el) => {
      if (ignore && ignore.contains(el)) return;
      const rect = visiblePart(el);
      if (rect && isOnScreen(rect) && isReachable(el, rect)) add(rect, true);
    });
  } finally {
    if (ignore) ignore.style.pointerEvents = restore;
  }
  return bands;
}

function overlaps(bands: Band[], lift: number, boxHeight: number): Band[] {
  const boxBottom = window.innerHeight - lift + CLEARANCE_GAP_PX;
  const boxTop = window.innerHeight - lift - boxHeight - CLEARANCE_GAP_PX;
  return bands.filter((b) => b.top < boxBottom && b.bottom > boxTop);
}

/** The lowest lift clear of every band; on a screen with none, the one covering the fewest. */
function lowestClearLift(
  bands: Band[], floor: number, ceiling: number, boxHeight: number,
): { lift: number; clear: boolean } {
  // Each blocking band is climbed at most once, so this ends.
  let lift = floor;
  for (let i = 0; i <= bands.length && lift <= ceiling; i++) {
    const blocking = overlaps(bands, lift, boxHeight);
    if (blocking.length === 0) return { lift, clear: true };
    lift = window.innerHeight - Math.min(...blocking.map((b) => b.top)) + CLEARANCE_GAP_PX;
  }

  const candidates = [floor, ceiling, ...bands.map((b) => window.innerHeight - b.top + CLEARANCE_GAP_PX)]
    .map((c) => Math.min(Math.max(c, floor), ceiling));
  let best = ceiling;
  let bestCount = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const count = overlaps(bands, c, boxHeight).length;
    if (count < bestCount || (count === bestCount && c > best)) {
      best = c;
      bestCount = count;
    }
  }
  return { lift: best, clear: false };
}

/**
 * How far above the bottom edge a centred box of this size has to sit: the
 * lowest spot clear of every control in its column, never past the top of the
 * viewport. `keep` is the box's current lift. It is held while still clear and
 * within about one box of the lowest spot, so the box does not hop about as
 * the page scrolls, yet drops back down once a new screen opens room below.
 */
export function clearLiftPx(
  boxWidth: number = CHALLENGE_BOX_WIDTH_PX,
  boxHeight: number = CHALLENGE_BOX_PX,
  ignore: HTMLElement | null = null,
  keep: number | null = null,
): number {
  const floor = window.innerWidth <= NARROW_VIEWPORT_PX ? 96 : 16;
  const ceiling = Math.max(floor, window.innerHeight - boxHeight - CLEARANCE_GAP_PX);
  const all = obstacleBands(boxWidth, ignore);
  let bands = all;
  let found = lowestClearLift(all, floor, ceiling, boxHeight);
  if (!found.clear && all.some((b) => b.soft)) {
    bands = all.filter((b) => !b.soft);
    found = lowestClearLift(bands, floor, ceiling, boxHeight);
  }
  // Ceil: a fractional rect must never leave the box a sliver short of clear.
  const lowest = Math.ceil(found.lift);

  const holdSlack = boxHeight + 2 * CLEARANCE_GAP_PX;
  if (
    keep !== null && keep >= floor && keep <= ceiling
    && keep - lowest <= holdSlack
    && overlaps(bands, keep, boxHeight).length === 0
  ) {
    return keep;
  }
  return lowest;
}

// The lift the asking box sits at now; null while it waits in the corner.
let centeredLiftPx: number | null = null;

/**
 * Nothing is being asked of the visitor here, so the box must not take taps:
 * it sits over the consent button and the composer on narrow screens.
 */
function placeInCorner(el: HTMLElement): void {
  centeredLiftPx = null;
  el.style.position = 'fixed';
  el.style.bottom = '0';
  el.style.left = '';
  el.style.right = '0';
  el.style.transform = '';
  el.style.zIndex = '100000';
  el.style.pointerEvents = 'none';
}

/**
 * Interactive: a box nobody finds is a dead request, so it moves into view and
 * takes taps again, clear of every control on screen at every width.
 */
function placeInCenter(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  centeredLiftPx = clearLiftPx(
    Math.max(rect.width, CHALLENGE_BOX_WIDTH_PX),
    Math.max(rect.height, CHALLENGE_BOX_PX),
    el,
    centeredLiftPx,
  );
  el.style.position = 'fixed';
  el.style.bottom = `${centeredLiftPx}px`;
  el.style.left = '50%';
  el.style.right = '';
  el.style.transform = 'translateX(-50%)';
  el.style.zIndex = '100000';
  el.style.pointerEvents = 'auto';
}

// Screens change under an asking box (the consent card closes, the composer
// mounts and grows with typing), so the lift is re-measured while it asks.
const PLACEMENT_RECHECK_MS = 400;
let placementTimer: ReturnType<typeof setInterval> | null = null;

function trackPlacement(el: HTMLElement): void {
  stopTrackingPlacement();
  placementTimer = setInterval(() => placeInCenter(el), PLACEMENT_RECHECK_MS);
}

function stopTrackingPlacement(): void {
  if (placementTimer === null) return;
  clearInterval(placementTimer);
  placementTimer = null;
}

/**
 * Drop all cached Turnstile state so the next getTurnstileToken() rebuilds
 * everything from scratch: re-injects the script, re-creates the container,
 * re-mounts the widget. Used on bfcache restore and on long-hide return,
 * where the cross-origin iframe may have been suspended by the browser.
 */
function resetTurnstileState(): void {
  // The widget this challenge belonged to is being torn down.
  stopTrackingPlacement();
  centeredLiftPx = null;
  if (challengeState === 'interactive') emit(TURNSTILE_INTERACTIVE_END_EVENT);
  challengeState = 'idle';
  if (widgetId !== null) {
    try { (window as any).turnstile?.remove(widgetId); } catch { /* ignore */ }
    widgetId = null;
  }
  scriptLoaded = false;
  scriptLoading = false;

  // Drop the existing script tag — re-injection on next call gives us a fresh
  // window.turnstile bound to a fresh execution context.
  const scriptOrigin = TURNSTILE_SCRIPT_URL.split('?')[0];
  document.querySelectorAll(`script[src^="${scriptOrigin}"]`).forEach((s) => s.remove());
  try { delete (window as any).turnstile; } catch { /* ignore */ }

  // Drop the container — a stale display:none container with a dead iframe
  // can't be reused. createContainer() in getTurnstileToken() will re-create.
  document.getElementById('turnstile-container')?.remove();
}

// Page lifecycle wiring — runs once on module import.
// Two reset triggers:
//   1. pageshow with event.persisted === true (bfcache restore on iOS Safari)
//   2. visibilitychange returning visible after STALE_HIDDEN_THRESHOLD_MS hidden
if (typeof window !== 'undefined') {
  let hiddenSinceMs = 0;

  // A check still running when the page goes away is a message that never got
  // sent. pagehide fires on iOS Safari where unload does not, and the beacon
  // transport outlives the page. The outcome says whether the visitor was
  // being asked for a tap or the check was still invisible, which separates
  // "people give up on the checkbox" from "the widget never loaded".
  window.addEventListener('pagehide', () => {
    if (challengeState === 'idle') return;
    sendFunnelBeacon('turnstile_abandoned', {
      outcome: challengeState === 'interactive' ? 'interactive' : 'pending',
    });
    challengeState = 'idle';
  });

  window.addEventListener('pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) {
      resetTurnstileState();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenSinceMs = Date.now();
    } else if (document.visibilityState === 'visible' && hiddenSinceMs > 0) {
      const hiddenMs = Date.now() - hiddenSinceMs;
      hiddenSinceMs = 0;
      if (hiddenMs > STALE_HIDDEN_THRESHOLD_MS) {
        resetTurnstileState();
      }
    }
  });
}

/**
 * Ensure the Turnstile script is loaded (lazy, one-time)
 */
function loadTurnstileScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoading) {
    return new Promise((resolve, reject) => {
      let elapsed = 0;
      const check = setInterval(() => {
        if (scriptLoaded) {
          clearInterval(check);
          resolve();
        } else if (!scriptLoading) {
          clearInterval(check);
          reject(new Error('Turnstile script load failed'));
        } else if ((elapsed += 100) > 15000) {
          clearInterval(check);
          reject(new Error('Turnstile script load timed out'));
        }
      }, 100);
    });
  }

  scriptLoading = true;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
    };
    script.onerror = () => {
      scriptLoading = false;
      reject(new Error('Failed to load Turnstile script'));
    };
    document.head.appendChild(script);
  });
}

// Whether a visitor's send is waiting on the check now running (or about to
// run), as opposed to a check started ahead of need. Cleared when it settles.
let visitorWaiting = false;

/** A send is now waiting on the current check. Labels its timing row only. */
export function markTurnstileAwaited(): void {
  visitorWaiting = true;
}

/**
 * Get a Turnstile token for session creation.
 * Uses 'normal' size + 'interaction-only' appearance: the managed check runs
 * with nothing on screen, and only an escalated challenge shows a box. That box
 * moves clear of the controls on screen and the UI is told, so the visitor
 * knows what to tap.
 * Includes a timeout so the app never hangs if the challenge fails silently.
 */
export async function getTurnstileToken(): Promise<string> {
  const askedAtMs = Date.now();
  try {
    return await runCheck(askedAtMs);
  } finally {
    visitorWaiting = false;
  }
}

async function runCheck(askedAtMs: number): Promise<string> {
  if (isSelfHost) {
    throw new Error('Turnstile is not used in self-host builds');
  }

  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (!siteKey) {
    if (import.meta.env.DEV) {
      console.warn('[Turnstile] No site key configured — using test token for dev');
      return 'dev-test-token';
    }
    throw new Error('VITE_TURNSTILE_SITE_KEY not configured');
  }

  await loadTurnstileScript();

  const turnstile = (window as any).turnstile;
  if (!turnstile) {
    throw new Error('Turnstile not available');
  }

  // Cleanup previous widget
  if (widgetId !== null) {
    try { turnstile.remove(widgetId); } catch { /* ignore */ }
    widgetId = null;
  }

  return new Promise<string>((resolve, reject) => {
    // The container must stay rendered for the cross-origin iframe to talk, so
    // what the visitor sees is Turnstile's own appearance setting, not display.
    // z-index must sit above the entire app z-scale (top token is --z-loader: 99999)
    // so an escalated challenge is reachable over modals, loaders and the input bar.
    let container = document.getElementById('turnstile-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'turnstile-container';
      document.body.appendChild(container);
    }
    // Reset visibility — a prior successful challenge sets display:none on
    // the container, which would silently break re-renders for subsequent
    // session refreshes (Turnstile's iframe can't communicate from a hidden
    // parent and times out at TURNSTILE_TIMEOUT_MS).
    container.style.display = '';
    // Re-applied every call: a previous interactive challenge left it centered
    // and may still be re-measuring its lift.
    stopTrackingPlacement();
    placeInCorner(container);

    const startedAtMs = Date.now();
    let interactive = false;
    // Whether this widget ever handed out a token. Scoped to the closure, which
    // is the widget's lifetime: the previous widget is removed above, so a late
    // callback from it can never read this one.
    let tokenIssued = false;
    // Whether this call's promise has settled. Whatever the widget does after
    // that (a token refresh, a late escalation) asks nothing and counts nothing.
    let settled = false;

    // Back to the corner and tell the UI, so a later invisible re-issue stays
    // quiet and no instruction is left on screen.
    const endInteractive = (): void => {
      if (!interactive) return;
      interactive = false;
      stopTrackingPlacement();
      if (container) placeInCorner(container);
      emit(TURNSTILE_INTERACTIVE_END_EVENT);
    };

    // The check is over, however it ended: nothing is pending any more.
    const settle = (): void => {
      settled = true;
      endInteractive();
      challengeState = 'idle';
    };

    // A failed widget is torn down: left mounted, its "verification failed" box
    // sits in the corner over the composer's controls.
    const removeWidget = (): void => {
      if (widgetId !== null) {
        try { turnstile.remove(widgetId); } catch { /* ignore */ }
        widgetId = null;
      }
      if (container) container.style.display = 'none';
    };

    const onTimeout = (): void => {
      if (settled) return;
      removeWidget();
      settle();
      sendFunnelBeacon('turnstile_failed', { outcome: 'timeout' });
      reject(new Error('Turnstile challenge timed out. Please try again.'));
    };

    // Timeout: if Turnstile fails silently (Safari edge cases), don't hang forever
    let timeout = setTimeout(onTimeout, TURNSTILE_TIMEOUT_MS);

    // One counter per widget render. Without it there is no denominator: an
    // escalation count on its own cannot say whether escalation is rare or
    // routine, and the escalation rate is what decides whether the check is
    // tuned wrong or just occasionally noticed.
    challengeState = 'invisible';
    sendFunnelBeacon('turnstile_started');

    widgetId = turnstile.render(container, {
      sitekey: siteKey,
      size: 'normal',
      // Invisible unless a tap is genuinely required (managed-mode default).
      appearance: 'interaction-only',
      // The app's language, not the browser's; 'en' and 'de' are both codes
      // Cloudflare lists.
      language: shownLanguage(),
      // A failed check ends here; the next one starts when a send needs it.
      // Cloudflare's own retry would ask again with no message waiting.
      retry: 'never',
      'before-interactive-callback': () => {
        if (settled || interactive) return;
        interactive = true;
        clearTimeout(timeout);
        timeout = setTimeout(
          onTimeout,
          Math.max(0, TURNSTILE_INTERACTIVE_TIMEOUT_MS - (Date.now() - startedAtMs)),
        );
        if (container) {
          placeInCenter(container);
          trackPlacement(container);
        }
        emit(TURNSTILE_INTERACTIVE_START_EVENT);
        sendFunnelBeacon('turnstile_interactive');
      },
      callback: (token: string) => {
        // Cloudflare re-issues the token about five minutes on; this call has
        // already handed its token out, so the refresh is ignored.
        if (settled) return;
        clearTimeout(timeout);
        const wasInteractive = interactive;
        tokenIssued = true;
        settle();
        if (wasInteractive) sendFunnelBeacon('turnstile_solved');
        // A new row beside the old ones: how long the token took from the
        // moment it was asked for (script load included), and whether a send
        // was waiting on it or it ran ahead of need.
        sendFunnelBeacon('turnstile_token', {
          bucket: turnstileTimeBucket(Date.now() - askedAtMs),
          mode: visitorWaiting ? 'waited' : 'ahead',
        });
        // Hide widget after successful challenge
        if (container) container.style.display = 'none';
        resolve(token);
      },
      // True tells Cloudflare the error is handled. Anything else makes it log
      // the code and re-run a crash-class failure even with retry 'never',
      // against a widget this callback has already removed.
      'error-callback': () => {
        if (settled) return true;
        clearTimeout(timeout);
        removeWidget();
        settle();
        sendFunnelBeacon('turnstile_failed', { outcome: 'error' });
        reject(new Error('Turnstile challenge failed'));
        return true;
      },
      'expired-callback': () => {
        // Turnstile tokens age out a few minutes after a successful check, and
        // the widget stays mounted, so this fires on the happy path far more
        // often than on a real failure. Counted apart, never as a failure: the
        // promise is long settled and no message was lost.
        if (tokenIssued) {
          challengeState = 'idle';
          sendFunnelBeacon('turnstile_token_aged');
          return;
        }
        if (settled) return;
        clearTimeout(timeout);
        settle();
        sendFunnelBeacon('turnstile_failed', { outcome: 'expired' });
        reject(new Error('Turnstile token expired'));
      },
    });
  });
}
