// Marketing tracking: gclid (Google Ads conversion) + utm_source (channel attribution)
// Captures from URL params, stores in memory only (no cookies, no localStorage)
// Remove this file when stripping marketing pages from a fork

// Same pattern as freeTierAdapter: empty in dev (Vite proxy), full URL in prod
const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

let capturedGclid: string | null = null;
let capturedMarketingSource: MarketingSource = 'direct';

// Closed allowlist for marketing source labels written to analytics blobs.
// Server side validates against the same allowlist; unknown values become 'unknown'.
export type MarketingSource = 'spotify' | 'grants' | 'paid' | 'organic' | 'direct' | 'unknown';

const ALLOWED_SOURCES: ReadonlySet<MarketingSource> = new Set([
  'spotify', 'grants', 'paid', 'organic', 'direct', 'unknown',
]);

/**
 * Normalize raw utm_source + utm_medium into the closed allowlist bucket.
 * Distinguishes Grants from Paid Google by utm_medium.
 */
function normalizeMarketingSource(utmSource: string | null, utmMedium: string | null): MarketingSource {
  if (!utmSource) return 'direct';
  const source = utmSource.toLowerCase();
  const medium = (utmMedium || '').toLowerCase();

  if (source === 'spotify') return 'spotify';

  if (source === 'google' || source === 'googleads') {
    if (medium === 'grants' || medium === 'adgrants') return 'grants';
    if (medium === 'cpc' || medium === 'ppc' || medium === 'paid') return 'paid';
    return 'paid';
  }

  if (['organic', 'referral', 'email', 'social'].includes(source)) return 'organic';

  return 'unknown';
}

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
    // Capture utm alongside gclid in the same call site (PublicLayout useEffect).
    captureMarketingSource(params);
  } catch {
    // Silently fail in SSR or restricted environments
  }
}

/**
 * Capture utm_source/utm_medium from URL params and normalize to closed allowlist.
 * If no utm_source present, leaves the default 'direct'. If gclid present without utm,
 * defaults to 'paid' (gclid implies a Google Ads click).
 */
function captureMarketingSource(params: URLSearchParams): void {
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');

  // Hard length cap to prevent header injection if a malicious URL is ever crafted.
  const safeSource = utmSource && utmSource.length <= 50 ? utmSource : null;
  const safeMedium = utmMedium && utmMedium.length <= 50 ? utmMedium : null;

  if (safeSource) {
    capturedMarketingSource = normalizeMarketingSource(safeSource, safeMedium);
  } else if (capturedGclid) {
    // gclid present without utm_source — Google Ads click without UTM tag
    capturedMarketingSource = 'paid';
  }
}

/**
 * Get the captured gclid (or null if none).
 */
export function getGclid(): string | null {
  return capturedGclid;
}

/**
 * Get the captured marketing source bucket.
 * Defaults to 'direct' if no utm_source or gclid was captured.
 * Always returns one of the closed allowlist values, safe for header forwarding.
 */
export function getMarketingSource(): MarketingSource {
  return ALLOWED_SOURCES.has(capturedMarketingSource) ? capturedMarketingSource : 'unknown';
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
