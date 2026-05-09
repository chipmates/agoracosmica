// Marketing tracking: gclid (Google Ads conversion) + utm_source (channel attribution)
// Captures from URL params, stores in memory only (no cookies, no localStorage)
// Remove this file when stripping marketing pages from a fork

// Same pattern as freeTierAdapter: empty in dev (Vite proxy), full URL in prod
const API_BASE = import.meta.env.VITE_FREE_TIER_API_URL || '';

// sessionStorage keys: persist source + gclid across reloads of the same tab.
// Without this, a user who clicks an ad → lands at /?utm_source=spotify_a →
// reloads (URL no longer carries the param) → would re-resolve to 'direct'
// and every subsequent event would be mis-attributed. Tab-scoped on purpose:
// a new tab without the URL params should default to 'direct', not inherit
// some stale source from a previous tab.
const SS_SOURCE_KEY = 'agc_marketing_source';
const SS_GCLID_KEY = 'agc_gclid';

let capturedGclid: string | null = null;
let capturedMarketingSource: MarketingSource = 'direct';

// Closed allowlist for marketing source labels written to analytics blobs.
// Server side validates against the same allowlist; unknown values become 'unknown'.
// spotify_a / spotify_b are A/B variants of the Spotify campaign — short URLs in
// `client/public/_redirects` (e.g. /sp/de1, /sp/de2) split the channel so the
// dashboard renders them as separate rows for variant comparison.
export type MarketingSource =
  | 'spotify' | 'spotify_a' | 'spotify_b'
  | 'grants' | 'paid' | 'organic' | 'direct' | 'unknown';

const ALLOWED_SOURCES: ReadonlySet<MarketingSource> = new Set([
  'spotify', 'spotify_a', 'spotify_b',
  'grants', 'paid', 'organic', 'direct', 'unknown',
]);

// Hydrate from sessionStorage on module load (cheap, runs once). If the URL
// later carries fresh params, captureGclid() overwrites these. Hydration
// happens AFTER ALLOWED_SOURCES is declared so the validation works.
try {
  if (typeof sessionStorage !== 'undefined') {
    const storedSource = sessionStorage.getItem(SS_SOURCE_KEY);
    const storedGclid = sessionStorage.getItem(SS_GCLID_KEY);
    if (storedSource && (ALLOWED_SOURCES as ReadonlySet<string>).has(storedSource)) {
      capturedMarketingSource = storedSource as MarketingSource;
    }
    if (storedGclid && storedGclid.length > 10 && storedGclid.length < 200) {
      capturedGclid = storedGclid;
    }
  }
} catch {
  // sessionStorage unavailable (Safari private mode, SSR) — no-op
}

function persistSource(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(SS_SOURCE_KEY, capturedMarketingSource);
    if (capturedGclid) sessionStorage.setItem(SS_GCLID_KEY, capturedGclid);
  } catch {
    // sessionStorage write blocked (quota, private mode) — no-op
  }
}

/**
 * Normalize raw utm_source + utm_medium into the closed allowlist bucket.
 * Distinguishes Grants from Paid Google by utm_medium.
 */
function normalizeMarketingSource(utmSource: string | null, utmMedium: string | null): MarketingSource {
  if (!utmSource) return 'direct';
  const source = utmSource.toLowerCase();
  const medium = (utmMedium || '').toLowerCase();

  if (source === 'spotify') return 'spotify';
  if (source === 'spotify_a') return 'spotify_a';
  if (source === 'spotify_b') return 'spotify_b';

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
    // Capture utm alongside gclid in the same call site.
    captureMarketingSource(params);
    // Persist whatever was just captured so a reload (where the URL no longer
    // carries the params) keeps the same attribution within this tab.
    persistSource();
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
