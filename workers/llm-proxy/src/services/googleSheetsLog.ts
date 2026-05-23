// Diagnostic mirror to a Google Sheet for every Google Ads CAPI conversion.
//
// One row per /api/conversions event, capturing what we sent + Google's
// response per account. Lets us reconcile our own ground truth against the
// "Alle Conv." column in the Google Ads UI: if rows here exceed UI counts,
// Google is dropping uploads (or merely lagging on offline-import
// attribution). If we ever need to bulk-import historical conversions via
// the Google Ads Data Manager, the column shape already matches the
// importer's expected schema.
//
// Auth: OAuth user-credential refresh flow, same pattern as
// googleAdsCapi.ts. The worker acts as the human owner of the sheet,
// using a Sheets-scoped refresh token. Access token cached in RATE_LIMITS
// KV under a distinct key; token TTL 59 min. No service account keys
// involved — the chipmates.ai org enforces
// iam.disableServiceAccountKeyCreation by default and this path stays
// inside that posture.
//
// Fully optional. When the three GOOGLE_SHEETS_OAUTH_* secrets or
// SHEETS_LOG_SHEET_ID are not set, this module no-ops. Errors are logged
// but never thrown — a Sheets outage cannot affect the CAPI upload path.

import type { Env } from '../utils/types';

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const CACHE_KEY = 'google_sheets_access_token';
const TIMEOUT_MS = 5_000;
const PF_MESSAGE_MAX = 200;

// Two tabs, two purposes:
//
//   - LOG_TAB: full diagnostic schema (our column names, both accounts side
//     by side, Google's response per account). For debugging + Data Manager
//     column-mapped pulls. Always populated.
//
//   - IMPORT_TAB: Google's exact "offline conversion import" CSV schema.
//     Single row per grants upload attempt, ready to be downloaded as CSV
//     and uploaded directly via Google Ads → Conversions → Uploads. Schema
//     contract is rigid: rows 1-2 are reserved for the Parameters line and
//     Google's required column headers (set during setup, never written by
//     the worker). Worker appends from row 3 onward.
//
// If a tab is missing in the sheet, the API call to that tab fails with
// a 400 and is logged but never thrown — log tab can be enabled without
// import tab and vice versa.
const LOG_TAB = 'log';
const IMPORT_TAB = 'import';

export interface ConversionLogRow {
  eventTimestampMs: number;
  event: string;
  gclid: string;
  figureId: string;
  country: string;
  value: number;
  orderId: string;
  grantsActionId: string;
  grantsStatus: string;
  grantsPfMessage: string | null;
  paidActionId: string;
  paidStatus: string;
  paidPfMessage: string | null;
}

// One row in the Google-Ads-import-ready tab. Conversion Name must match the
// exact display name of the conversion action in Google Ads UI — see the
// GRANTS_ACTION_NAMES map in googleAdsCapi.ts. Conversion Time format mirrors
// what googleAdsCapi.ts sends to the API, yyyy-MM-dd HH:mm:ss+00:00.
export interface ConversionImportRow {
  gclid: string;
  conversionName: string;
  conversionTime: string;
  conversionValue: number;
  currencyCode: string;
  orderId: string;
}


/**
 * Append a diagnostic row to the LOG tab and zero or more import-ready
 * rows to the IMPORT tab. Single auth round-trip, both tab writes fire in
 * parallel. Multiple import rows (e.g. one grants + one paid) batch into
 * a single Sheets API append. Fire-and-forget shape: failures are logged
 * here, never propagated.
 *
 * Caller controls which import rows are emitted — typically the account
 * row for every account that actually attempted an upload (skipped scope
 * or placeholder rows excluded).
 */
export async function appendConversionLog(
  env: Env,
  diagnostic: ConversionLogRow,
  importRows: ConversionImportRow[],
): Promise<void> {
  if (
    !env.GOOGLE_SHEETS_OAUTH_CLIENT_ID ||
    !env.GOOGLE_SHEETS_OAUTH_CLIENT_SECRET ||
    !env.GOOGLE_SHEETS_OAUTH_REFRESH_TOKEN ||
    !env.SHEETS_LOG_SHEET_ID
  ) {
    return;
  }

  let token: string;
  try {
    token = await getSheetsAccessToken(env);
  } catch (err) {
    console.error('[sheets] failed to acquire access token', err);
    return;
  }

  await Promise.all([
    appendRowsToTab(
      env,
      token,
      LOG_TAB,
      [diagnosticValues(diagnostic)],
      'log',
    ),
    importRows.length > 0
      ? appendRowsToTab(
          env,
          token,
          IMPORT_TAB,
          importRows.map(importValues),
          'import',
        )
      : Promise.resolve(),
  ]);
}

function diagnosticValues(row: ConversionLogRow): Array<string | number> {
  return [
    new Date().toISOString(),
    new Date(row.eventTimestampMs).toISOString(),
    row.event,
    row.gclid,
    row.figureId,
    row.country,
    row.value,
    row.orderId,
    row.grantsActionId,
    row.grantsStatus,
    truncate(row.grantsPfMessage, PF_MESSAGE_MAX),
    row.paidActionId,
    row.paidStatus,
    truncate(row.paidPfMessage, PF_MESSAGE_MAX),
  ];
}

function importValues(row: ConversionImportRow): Array<string | number> {
  return [
    row.gclid,
    row.conversionName,
    row.conversionTime,
    row.conversionValue,
    row.currencyCode,
    row.orderId,
  ];
}

async function appendRowsToTab(
  env: Env,
  token: string,
  tabName: string,
  rows: Array<Array<string | number>>,
  logTag: string,
): Promise<void> {
  if (rows.length === 0) return;

  const range = encodeURIComponent(`${tabName}!A:Z`);
  const url =
    `${SHEETS_API_BASE}/${env.SHEETS_LOG_SHEET_ID}/values/${range}:append` +
    '?valueInputOption=RAW&insertDataOption=INSERT_ROWS';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[sheets] ${logTag} append http ${res.status}:`, text.slice(0, 300));
      return;
    }

    console.log(`[sheets] ${logTag} appended ${rows.length} row(s) ok`);
  } catch (err) {
    console.error(`[sheets] ${logTag} append threw`, err);
  }
}

function truncate(s: string | null, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '...' : s;
}

/**
 * Mint or reuse a Sheets-scoped access token by refreshing a user-OAuth
 * refresh token. Cached for 59 minutes (Google issues 60-min tokens; we
 * shave 60s for clock skew + network latency). Same shape as the access
 * token flow in googleAdsCapi.ts — the worker acts as the user who
 * authorized the OAuth grant.
 */
async function getSheetsAccessToken(env: Env): Promise<string> {
  const cached = await env.RATE_LIMITS.get(CACHE_KEY);
  if (cached) return cached;

  const body = new URLSearchParams({
    client_id: env.GOOGLE_SHEETS_OAUTH_CLIENT_ID as string,
    client_secret: env.GOOGLE_SHEETS_OAUTH_CLIENT_SECRET as string,
    refresh_token: env.GOOGLE_SHEETS_OAUTH_REFRESH_TOKEN as string,
    grant_type: 'refresh_token',
  });

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sheets OAuth refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error('Sheets OAuth response missing access_token');
  }

  const ttl = Math.max(60, (data.expires_in || 3600) - 60);
  await env.RATE_LIMITS.put(CACHE_KEY, data.access_token, { expirationTtl: ttl });

  return data.access_token;
}
