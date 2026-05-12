// Cloudflare Turnstile — bot protection for free-tier sessions
// Renders a managed challenge, returns a token for session creation

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
// 30s, not 15s: mobile Safari resuming from bfcache or a long backgrounded tab
// often needs more than 15s for the cross-origin iframe to wake up enough to
// post its callback back. The user-facing toast on hit is the generic
// "request took too long" — better to wait a bit longer than to surface that
// to a user who is already actively trying to send a message.
const TURNSTILE_TIMEOUT_MS = 30_000;
// After this much hidden time, the cross-origin Turnstile iframe is likely
// frozen/stale on iOS Safari; reset module state on return so the next call
// reloads the script and container fresh. 5 min mirrors the JWT refresh
// threshold — if the tab was hidden longer, getSessionToken would re-issue
// anyway, and a fresh re-issue is what we're protecting.
const STALE_HIDDEN_THRESHOLD_MS = 5 * 60 * 1000;

let scriptLoaded = false;
let scriptLoading = false;
let widgetId: string | null = null;

/**
 * Drop all cached Turnstile state so the next getTurnstileToken() rebuilds
 * everything from scratch: re-injects the script, re-creates the container,
 * re-mounts the widget. Used on bfcache restore and on long-hide return,
 * where the cross-origin iframe may have been suspended by the browser.
 */
function resetTurnstileState(): void {
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

/**
 * Get a Turnstile token for session creation.
 * Uses 'normal' size + 'always' appearance for maximum cross-browser compatibility.
 * The widget renders at the bottom-right but is tiny and unobtrusive.
 * Includes a timeout so the app never hangs if the challenge fails silently.
 */
export async function getTurnstileToken(): Promise<string> {
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
    // Container must be visible and rendered for cross-browser iframe communication.
    // Position fixed bottom-right, small footprint.
    // z-index must sit above the entire app z-scale (top token is --z-loader: 99999)
    // so the challenge is reachable while modals, loaders, and the chat input bar are present.
    let container = document.getElementById('turnstile-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'turnstile-container';
      container.style.position = 'fixed';
      container.style.bottom = '0';
      container.style.right = '0';
      container.style.zIndex = '100000';
      document.body.appendChild(container);
    }
    // Reset visibility — a prior successful challenge sets display:none on
    // the container, which would silently break re-renders for subsequent
    // session refreshes (Turnstile's iframe can't communicate from a hidden
    // parent and times out at TURNSTILE_TIMEOUT_MS).
    container.style.display = '';

    // Timeout: if Turnstile fails silently (Safari edge cases), don't hang forever
    const timeout = setTimeout(() => {
      if (widgetId !== null) {
        try { turnstile.remove(widgetId); } catch { /* ignore */ }
        widgetId = null;
      }
      reject(new Error('Turnstile challenge timed out. Please try again.'));
    }, TURNSTILE_TIMEOUT_MS);

    widgetId = turnstile.render(container, {
      sitekey: siteKey,
      size: 'normal',
      appearance: 'always',
      retry: 'auto',
      'retry-interval': 3000,
      callback: (token: string) => {
        clearTimeout(timeout);
        // Hide widget after successful challenge
        if (container) container.style.display = 'none';
        resolve(token);
      },
      'error-callback': () => {
        clearTimeout(timeout);
        reject(new Error('Turnstile challenge failed'));
      },
      'expired-callback': () => {
        clearTimeout(timeout);
        reject(new Error('Turnstile token expired'));
      },
    });
  });
}
