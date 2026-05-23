// Google Ads Conversion API forwarding
// Receives a gclid-keyed conversion event from /api/conversions and uploads
// it to the Google Ads customer accounts that subscribe to that event. Most
// events go to both accounts in parallel; the unmatched account fails the row
// silently via partial_failure — the account that actually issued the gclid
// records the conversion. Per-event scope overrides live in SCOPED_EVENTS.
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
import {
  appendConversionLog,
  type ConversionImportRow,
  type ConversionLogRow,
} from './googleSheetsLog';

type ConversionEvent = 'profile_created' | 'start_exploring' | 'mode_selected' | 'council_engaged';
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
  figureId?: string;
  country?: string;
}

// Outcome of a single per-account upload attempt. Captured so the orchestrator
// can mirror what Google said into the diagnostic sheet. Status enum stays
// tight on purpose — filtering the sheet by status should land on a known
// label without surprises.
interface UploadResult {
  status:
    | 'ok_200'
    | 'partial_failure'
    | 'skipped:scoped'
    | 'skipped:todo_pending'
    | 'skipped:not_applicable'
    | 'error:exception'
    | `http_${number}`;
  pfMessage: string | null;
  actionId: string;
}

// Two-account architecture: each Google Ads account has its own conversion
// actions. customerId is the 10-digit account ID, digits only, no dashes.
// The actions map holds the numeric conversionAction IDs. Neither value is a
// secret. They identify accounts, not credentials. The developer token and
// OAuth credentials are the secrets and come from env.
//
// Currencies are per-account: the Ad Grants account is USD-denominated, the
// paid account is billed in EUR.
//
// Conversion actions must be created with the "Import from clicks" source.
// Google Ads silently drops offline uploads to Website-source actions (those
// expect a gtag fire that we never make), so any numeric ID here has to point
// at an action set up for offline conversion import specifically.
const ACCOUNTS: Record<AccountKey, AccountConfig> = {
  grants: {
    customerId: '7266866262',
    currency: 'USD',
    actions: {
      profile_created: '7620352761',
      start_exploring: '7620352758',
      mode_selected: '7620352752',
      council_engaged: '7620352755',
    },
  },
  paid: {
    customerId: '3791478447',
    currency: 'EUR',
    actions: {
      // Paid actions still on the old Website-source IDs. Replace with the
      // offline-import equivalents once they are configured on the paid
      // account; uploads to the current IDs are silently dropped by Google.
      profile_created: 'TODO_PENDING',
      start_exploring: 'TODO_PENDING',
      mode_selected: 'TODO_PENDING',
      // council_engaged is Grants-only — see SCOPED_EVENTS below.
      council_engaged: 'NOT_APPLICABLE',
    },
  },
};

// Account scope per event. Default (event absent from this map) = both
// accounts. Listed here = exactly the accounts that receive forwarding for
// that event.
//
// council_engaged: Grants only. The theme→council funnel that triggers this
// event lives on theme pages, which are the long-tail Grants surface. Paid
// campaigns are figure-focused (figure pages don't route to councils) and
// keep Profile Creation as their sole Primary action by deliberate design —
// shallow engagement events stay off the Paid bidding signal.
const SCOPED_EVENTS: Partial<Record<ConversionEvent, AccountKey[]>> = {
  council_engaged: ['grants'],
};

// Human-readable conversion action names as they appear in the Google Ads
// UI. Used only for the "import" sheet tab; the API upload path addresses
// actions by numeric ID, not name.
//
// Two layers:
//   1. Env override (ADS_CONVERSION_ACTION_NAMES) — JSON of the same shape
//      as FALLBACK_ACTION_NAMES. The canonical source of truth in
//      production, since real Ads accounts are usually in a non-English
//      locale and the names differ. Set as a wrangler secret.
//   2. Hardcoded fallback below — best-guess English placeholders. Used
//      only when the env override is unset or malformed.
//
// Google Ads matches by EXACT name (case + spacing sensitive) on CSV
// upload, so any mismatch makes the import tab unusable for that row.
// The log tab is unaffected.
const FALLBACK_ACTION_NAMES: Record<AccountKey, Record<ConversionEvent, string>> = {
  grants: {
    profile_created: 'Profile Creation',
    start_exploring: 'Start Exploring',
    mode_selected: 'Mode Selected',
    council_engaged: 'Council Engaged',
  },
  // Paid placeholders — fill in once the offline-import actions exist on the
  // paid account. Until then paid uploads are skipped anyway (TODO_PENDING)
  // and no paid rows reach the import tab.
  paid: {
    profile_created: '',
    start_exploring: '',
    mode_selected: '',
    council_engaged: '',
  },
};

function resolveActionName(
  env: Env,
  accountKey: AccountKey,
  event: ConversionEvent,
): string {
  if (env.ADS_CONVERSION_ACTION_NAMES) {
    try {
      const parsed = JSON.parse(env.ADS_CONVERSION_ACTION_NAMES) as Partial<
        Record<AccountKey, Partial<Record<ConversionEvent, string>>>
      >;
      const name = parsed[accountKey]?.[event];
      if (typeof name === 'string' && name.length > 0) return name;
    } catch {
      console.error('[capi] ADS_CONVERSION_ACTION_NAMES failed to parse, using fallback');
    }
  }
  return FALLBACK_ACTION_NAMES[accountKey][event] || '';
}

// Conversion values are read at runtime from wrangler secrets (env.VALUE_*),
// not hardcoded — the worker is in a public AGPL repo and the per-event
// dollar weights are business signal. Values are asymmetric on purpose so
// Max Conv Value bidding chases real signups over shallow engagement; the
// exact numbers live in secrets, not here.
//
// When a secret is unset, the worker forwards conversion_value: 0. Google Ads
// accepts a zero value but won't use it for value-based bidding, so an unset
// secret degrades gracefully into Max Conversions instead of breaking.
function conversionValue(env: Env, event: ConversionEvent): number {
  const key = `VALUE_${event.toUpperCase()}` as keyof Env;
  const raw = env[key];
  if (typeof raw !== 'string') return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

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
    // Still record an event row so the sheet shows we received the conversion
    // but couldn't reach Google. Both accounts get an exception status.
    await mirrorToSheet(env, input, {
      grants: tokenFailureResult(ACCOUNTS.grants.actions[input.event]),
      paid: tokenFailureResult(ACCOUNTS.paid.actions[input.event]),
    });
    return;
  }

  // Dual upload: send to both customer accounts in parallel. The account that
  // didn't issue this gclid will reject the row inside partial_failure — that
  // is the expected, silent failure path. Each branch returns an UploadResult
  // even when the API call is skipped or throws, so the sheet mirror sees a
  // complete row.
  const [grantsResult, paidResult] = await Promise.all([
    uploadToAccount(env, accessToken, 'grants', input).catch((err): UploadResult => {
      console.error('[capi] grants upload threw', err);
      return {
        status: 'error:exception',
        pfMessage: String(err).slice(0, 200),
        actionId: ACCOUNTS.grants.actions[input.event],
      };
    }),
    uploadToAccount(env, accessToken, 'paid', input).catch((err): UploadResult => {
      console.error('[capi] paid upload threw', err);
      return {
        status: 'error:exception',
        pfMessage: String(err).slice(0, 200),
        actionId: ACCOUNTS.paid.actions[input.event],
      };
    }),
  ]);

  await mirrorToSheet(env, input, { grants: grantsResult, paid: paidResult });
}

function tokenFailureResult(actionId: string): UploadResult {
  return {
    status: 'error:exception',
    pfMessage: 'oauth_token_acquire_failed',
    actionId,
  };
}

/**
 * Append rows to the diagnostic Google Sheet:
 *   - LOG tab: one row per event with both accounts' results side-by-side
 *   - IMPORT tab: one row per real grants upload attempt, in Google's
 *     exact offline-conversion-upload CSV schema (so the tab is directly
 *     downloadable + manually uploadable via Conversions → Uploads if
 *     CAPI attribution ever needs a recovery path)
 *
 * Skipped-status rows (scope/TODO/NA) do NOT go to the import tab — there
 * was no upload to recover. Failed grants attempts DO go to import: order_id
 * gives Google deduplication if the CAPI path eventually catches up.
 *
 * Failures are swallowed: a Sheets outage cannot affect the CAPI path.
 */
async function mirrorToSheet(
  env: Env,
  input: ConversionInput,
  results: { grants: UploadResult; paid: UploadResult },
): Promise<void> {
  const orderId = `${input.gclid}:${input.event}`;
  const value = conversionValue(env, input.event);

  const diagnostic: ConversionLogRow = {
    eventTimestampMs: input.timestamp,
    event: input.event,
    gclid: input.gclid,
    figureId: input.figureId || '',
    country: input.country || '',
    value,
    orderId,
    grantsActionId: results.grants.actionId,
    grantsStatus: results.grants.status,
    grantsPfMessage: results.grants.pfMessage,
    paidActionId: results.paid.actionId,
    paidStatus: results.paid.status,
    paidPfMessage: results.paid.pfMessage,
  };

  // Build one import-ready row per account that actually attempted an
  // upload. Skipped-by-scope events were never going to that account.
  // Skipped-by-TODO_PENDING / NOT_APPLICABLE rows shouldn't be retried
  // either — those action IDs are placeholders, not real targets. Mixed
  // currencies (USD grants + EUR paid) coexist fine in the import tab
  // since Google's CSV format has a per-row currency column.
  const importRows: ConversionImportRow[] = [];
  for (const accountKey of ['grants', 'paid'] as const) {
    const result = results[accountKey];
    if (result.status.startsWith('skipped:')) continue;
    importRows.push({
      gclid: input.gclid,
      conversionName: resolveActionName(env, accountKey, input.event),
      conversionTime: formatGoogleAdsTimestamp(input.timestamp),
      conversionValue: value,
      currencyCode: ACCOUNTS[accountKey].currency,
      orderId,
    });
  }

  try {
    await appendConversionLog(env, diagnostic, importRows);
  } catch (err) {
    console.error('[sheets] mirror call threw (unexpected, module swallows)', err);
  }
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
): Promise<UploadResult> {
  const account = ACCOUNTS[accountKey];
  const actionId = account.actions[input.event];

  // Event-level account scoping. Events listed in SCOPED_EVENTS only forward
  // to the accounts in the list — silent skip for the others, no log noise.
  const scopedAccounts = SCOPED_EVENTS[input.event];
  if (scopedAccounts && !scopedAccounts.includes(accountKey)) {
    return { status: 'skipped:scoped', pfMessage: null, actionId };
  }

  // A conversion action still on a placeholder ID (not yet set up in Google
  // Ads) is skipped, rather than sent with an invalid resource name.
  if (actionId === 'TODO_PENDING') {
    console.log(`[capi] ${accountKey} ${input.event} skipped: action id pending`);
    return { status: 'skipped:todo_pending', pfMessage: null, actionId };
  }

  // Defensive: if SCOPED_EVENTS is ever broken and a NOT_APPLICABLE id slips
  // through, surface it as a distinct skip rather than firing at Google.
  if (actionId === 'NOT_APPLICABLE') {
    return { status: 'skipped:not_applicable', pfMessage: null, actionId };
  }

  const customerId = account.customerId;
  const conversion = {
    gclid: input.gclid,
    conversion_action: `customers/${customerId}/conversionActions/${actionId}`,
    conversion_date_time: formatGoogleAdsTimestamp(input.timestamp),
    conversion_value: conversionValue(env, input.event),
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
    return {
      status: `http_${res.status}` as UploadResult['status'],
      pfMessage: text.slice(0, 200) || null,
      actionId,
    };
  }

  // Inspect partial_failure_error to distinguish "wrong account"
  // (expected, silent) from "actually broken" (worth surfacing). The
  // sheet mirror records the exact message so we can filter the
  // expected unmatched-account rows from any real intake errors.
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
    return {
      status: 'partial_failure',
      pfMessage: json.partial_failure_error.message,
      actionId,
    };
  }

  console.log(`[capi] ${accountKey} upload ok (http ${res.status})`);
  return { status: 'ok_200', pfMessage: null, actionId };
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
