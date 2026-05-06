// gclid capture for Google Ads conversion tracking
// Captures gclid from URL params, stores in memory only (no cookies, no localStorage)
// Remove this file when stripping marketing pages from a fork

// Same pattern as freeTierAdapter: empty in dev (Vite proxy), full URL in prod
const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

let capturedGclid: string | null = null;

/**
 * Capture gclid from URL on page load.
 * Call this once when the app initializes.
 */
export function captureGclid(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const gclid = params.get('gclid');
    if (gclid && gclid.length > 10 && gclid.length < 200) {
      capturedGclid = gclid;
    }
  } catch {
    // Silently fail in SSR or restricted environments
  }
}

/**
 * Get the captured gclid (or null if none).
 */
export function getGclid(): string | null {
  return capturedGclid;
}

/**
 * Send a conversion event to the CF Worker endpoint.
 * Only fires if a gclid was captured (user came from a Google Ad).
 */
export async function sendConversion(
  event: 'profile_created' | 'audio_played_30s',
  metadata?: Record<string, string>
): Promise<void> {
  if (!capturedGclid) return;

  try {
    const payload = {
      gclid: capturedGclid,
      event,
      timestamp: Date.now(),
      ...metadata,
    };

    // Fire and forget - don't block UX for conversion tracking
    fetch(`${API_BASE}/api/conversions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently fail - conversion tracking should never break the app
    });
  } catch {
    // Silently fail
  }
}
