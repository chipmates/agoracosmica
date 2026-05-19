// Google Ads Conversion API forwarding
// Receives a gclid-keyed conversion event from /api/conversions, uploads it to
// both Google Ads customer accounts (Grants + Paid) in parallel. The unmatched
// account fails the row silently via partial_failure — the account that
// actually issued the gclid records the conversion.
//
// All CAPI calls are fire-and-forget from the route handler's perspective:
// errors are logged here but never propagated. If GOOGLE_ADS_DEVELOPER_TOKEN
// is not set, the entire module no-ops — events still get captured to KV
// and Analytics Engine upstream.
//
// API version pinned to v24 (current stable as of 2026-05; v19 was sunsetted
// 2026-02-11 and older versions are no longer accepted). Bump intentionally
// when Google deprecates, following the API release notes.

import type { Env } from '../utils/types';

type ConversionEvent = 'profile_created' | 'start_exploring' | 'mode_selected';
type AccountKey = 'grants' | 'paid';

interface AccountConfig {
  customerId: string;
  currency: 'USD' | 'EUR';
  actions: Record<ConversionEvent, string>; // numeric conversion action IDs
}

interface ConversionInput {
  gclid: string;
  event: ConversionEvent;
  timestamp: number; // ms since epoch
}

// Two-account architecture: each Google Ads account has its own conversion
// actions. customerId is the 10-digit account ID, digits only, no dashes.
// The actions map holds the numeric conversionAction IDs. Neither value is a
// secret. They identify accounts, not credentials. The developer token and
// OAuth credentials are the secrets and come from env.
//
// Currencies are per-account: the Ad Grants account is USD-denominated, the
// paid account is billed in EUR.
const ACCOUNTS: Record<AccountKey, AccountConfig> = {
  grants: {
    customerId: '7266866262',
    currency: 'USD',
    actions: {
      profile_created: '7608272394', // gtag label 2t5rCIqM9KscELfN0stD
      start_exploring: '7609132235', // gtag label n70GCMvJqKwcELfN0stD
      mode_selected: '7609132238',   // gtag label 4AWSCM7JqKwcELfN0stD
    },
  },
  paid: {
    customerId: '3791478447',
    currency: 'EUR',
    actions: {
      profile_created: '7609550802', // gtag label zBsvCNKPwqwcEMOryN9C
      start_exploring: '7609550805', // gtag label PFnxCNWPwqwcEMOryN9C
      mode_selected: '7609550808',   // gtag label dlmRCNiPwqwcEMOryN9C
    },
  },
};

// Conversion values per partner-side recommendation. Asymmetric so the
// algorithm chases real signups over shallow engagement once Max Conv Value
// bidding is enabled (initial phase is Max Conversions; values still recorded
// for later reporting + the bidding switch).
const VALUES: Record<ConversionEvent, number> = {
  profile_created: 15,
  start_exploring: 1,
  mode_selected: 4,
};

const API_VERSION = 'v24';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_CACHE_KEY = 'google_ads_access_token';
const UPLOAD_TIMEOUT_MS = 10_000;

// Set to `true` for the first day after enabling, to verify schema + auth
// without recording. Flip to `false` for production.
const VALIDATE_ONLY = false;

/**
 * Public entrypoint. Called from /api/conversions route handler. Returns a
 * promise the caller can ignore — internal errors are logged, never thrown.
 *
 * No-ops if GOOGLE_ADS_DEVELOPER_TOKEN is not configured (feature flag).
 */
export async function forwardConversionToGoogleAds(
  env: Env,
  input: ConversionInput,
): Promise<void> {
  if (!env.GOOGLE_ADS_DEVELOPER_TOKEN) return;

  let accessToken: string;
  try {
    accessToken = await getAccessToken(env);
  } catch (err) {
    console.error('[capi] failed to acquire access token', err);
    return;
  }

  // Dual upload: send to both customer accounts in parallel. The account that
  // didn't issue this gclid will reject the row inside partial_failure — that
  // is the expected, silent failure path.
  await Promise.all([
    uploadToAccount(env, accessToken, 'grants', input).catch((err) =>
      console.error('[capi] grants upload threw', err),
    ),
    uploadToAccount(env, accessToken, 'paid', input).catch((err) =>
      console.error('[capi] paid upload threw', err),
    ),
  ]);
}

/**
 * Acquire a valid Google OAuth2 access token, refreshing if cache is empty
 * or stale. Cached in RATE_LIMITS KV (re-using the namespace; access tokens
 * are short-lived and namespace-scoped key avoids collisions).
 *
 * Google access tokens last 3600s. We cache slightly under that to leave
 * a buffer for clock skew + network latency.
 */
async function getAccessToken(env: Env): Promise<string> {
  const cached = await env.RATE_LIMITS.get(OAUTH_CACHE_KEY);
  if (cached) return cached;

  if (
    !env.GOOGLE_ADS_OAUTH_CLIENT_ID ||
    !env.GOOGLE_ADS_OAUTH_CLIENT_SECRET ||
    !env.GOOGLE_ADS_OAUTH_REFRESH_TOKEN
  ) {
    throw new Error('OAuth client credentials not configured');
  }

  const body = new URLSearchParams({
    client_id: env.GOOGLE_ADS_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_ADS_OAUTH_CLIENT_SECRET,
    refresh_token: env.GOOGLE_ADS_OAUTH_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OAuth refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  if (!data.access_token) {
    throw new Error('OAuth refresh response missing access_token');
  }

  // Refresh 60s before Google's expiry to absorb skew. Floor 60s to prevent
  // pathological tight loops if Google ever returns a tiny expires_in.
  const ttl = Math.max(60, (data.expires_in || 3600) - 60);
  await env.RATE_LIMITS.put(OAUTH_CACHE_KEY, data.access_token, {
    expirationTtl: ttl,
  });

  return data.access_token;
}

/**
 * Upload a single conversion to one Google Ads account. partial_failure is
 * always true so an unmatched-gclid row doesn't fail the whole request — the
 * unmatched-account is the expected outcome for one of the two dual-uploads.
 */
async function uploadToAccount(
  env: Env,
  accessToken: string,
  accountKey: AccountKey,
  input: ConversionInput,
): Promise<void> {
  const account = ACCOUNTS[accountKey];
  const actionId = account.actions[input.event];
  const customerId = account.customerId;

  const conversion = {
    gclid: input.gclid,
    conversion_action: `customers/${customerId}/conversionActions/${actionId}`,
    conversion_date_time: formatGoogleAdsTimestamp(input.timestamp),
    conversion_value: VALUES[input.event],
    currency_code: account.currency,
    order_id: `${input.gclid}:${input.event}`, // Server-side dedup key
  };

  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}:uploadClickConversions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN as string,
      'login-customer-id': env.GOOGLE_ADS_LOGIN_CUSTOMER_ID as string,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversions: [conversion],
      partial_failure: true,
      validate_only: VALIDATE_ONLY,
    }),
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });

  // Top-level errors (auth, malformed request) come back as non-200.
  // Per-row errors (gclid not in this account) come back as 200 with
  // partial_failure_error populated — those are the EXPECTED silent
  // failures for the dual-upload approach.
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(
      `[capi] ${accountKey} upload http ${res.status}:`,
      text.slice(0, 400),
    );
    return;
  }

  // Optional: inspect partial_failure_error to distinguish "wrong account"
  // (expected, silent) from "actually broken" (worth surfacing). For v1 we
  // just log all partial failures at debug level; tighten later if needed.
  const json = (await res.json().catch(() => null)) as
    | { partial_failure_error?: { code?: number; message?: string } }
    | null;
  if (json?.partial_failure_error?.message) {
    // Don't elevate to error — the gclid-not-in-account row is the normal
    // case for one of the two dual-uploads on every conversion.
    console.log(
      `[capi] ${accountKey} partial-failure (expected for non-matching account):`,
      json.partial_failure_error.message.slice(0, 200),
    );
  } else {
    console.log(`[capi] ${accountKey} upload ok (http ${res.status})`);
  }
}

/**
 * Format a JS timestamp as Google Ads conversion_date_time.
 * Required shape: "yyyy-MM-dd HH:mm:ss+|-HH:mm" (space, not T). We always
 * emit UTC so the offset is "+00:00".
 */
function formatGoogleAdsTimestamp(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const MM = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const HH = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}+00:00`;
}
