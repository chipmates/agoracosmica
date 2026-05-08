// Cloudflare Turnstile — bot protection for free-tier sessions
// Renders a managed challenge, returns a token for session creation

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_TIMEOUT_MS = 15_000;

let scriptLoaded = false;
let scriptLoading = false;
let widgetId: string | null = null;

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
    let container = document.getElementById('turnstile-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'turnstile-container';
      container.style.position = 'fixed';
      container.style.bottom = '0';
      container.style.right = '0';
      container.style.zIndex = '1';
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
