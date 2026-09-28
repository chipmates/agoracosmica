// JWT session lifecycle for free-tier users
// Creates session via Turnstile → Worker, stores JWT in memory, lazily refreshes
// on the next getSessionToken() call when the cached token is within 5min of expiry.
//
// Identity: a UUID v4 ("clientId") is persisted in localStorage with the UTC
// day it was issued and sent with every /v1/session call, so the server's daily
// quota stays bound to this device across tabs, page reloads and JWT refreshes,
// independent of the public IP. The quota keys are per UTC day, so the ID is
// dropped when the day changes and the server issues a new one: no ID outlives
// the one day it counts. Cleared localStorage gives a fresh quota, a known and
// accepted trade-off (the per-address ceiling still holds).
//
// Refresh policy is LAZY (no setTimeout). An open-but-idle tab does not burn
// Turnstile + JWT issuance every 5min. Sessions analytics only fire on real
// engagement, not background timers.

import { getTurnstileToken } from './turnstile';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

const FREE_TIER_API_URL = import.meta.env.VITE_FREE_TIER_API_URL || '';

const CLIENT_ID_STORAGE_KEY = 'agora_client_id';
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// In-memory storage (never persisted — session = per-tab)
let currentToken: string | null = null;
let tokenExpiresAt: number = 0; // Unix ms
let pendingSession: Promise<string> | null = null; // Deduplication mutex
// Page memory only: the worker counts a session on the first token request of
// a page load, so nothing is stored or looked up for the count.
let sessionCounted = false;

/** The current UTC day, the same day key the worker's quota uses. */
function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Read today's clientId. Returns null if missing, malformed, from an earlier
 * UTC day (then it is removed), or storage is unavailable. A bare UUID from an
 * older build counts as today's, so an update does not reset today's quota.
 */
function readStoredClientId(): string | null {
  try {
    const stored = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (!stored) return null;
    if (UUID_V4_RE.test(stored)) {
      writeStoredClientId(stored);
      return stored;
    }
    const parsed: unknown = JSON.parse(stored);
    const record = parsed as { id?: unknown; day?: unknown } | null;
    if (
      record && typeof record.id === 'string' && UUID_V4_RE.test(record.id) &&
      record.day === utcDay()
    ) {
      return record.id;
    }
    localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
    return null;
  } catch {
    // localStorage may be unavailable (Safari private mode in some configs), or
    // the value unreadable. Per-session UUIDs are acceptable, the server still
    // rate-limits.
    return null;
  }
}

// An ID from an earlier UTC day goes when the app loads, also for a visitor who
// now uses their own key and never asks for a session.
if (typeof window !== 'undefined') readStoredClientId();

/** Persist the clientId returned by the server, stamped with today's UTC day. */
function writeStoredClientId(clientId: string): void {
  try {
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, JSON.stringify({ id: clientId, day: utcDay() }));
  } catch {
    // Storage write failed, silent. The server mints a fresh UUID next session.
  }
}

/**
 * Get a valid JWT token, creating a session if needed.
 * Auto-refreshes 5 minutes before expiry.
 * Deduplicates concurrent calls to prevent multiple session creation.
 */
export async function getSessionToken(): Promise<string> {
  // Return cached token if still valid (with 5-min buffer)
  const now = Date.now();
  if (currentToken && tokenExpiresAt > now + 5 * 60 * 1000) {
    return currentToken;
  }

  // Deduplicate concurrent session creation
  if (pendingSession) {
    return pendingSession;
  }

  pendingSession = createSession().finally(() => {
    pendingSession = null;
  });
  return pendingSession;
}

/**
 * Create a new session: Turnstile challenge → Worker → JWT
 */
async function createSession(): Promise<string> {
  const turnstileToken = await getTurnstileToken();
  const clientId = readStoredClientId();
  const first = !sessionCounted;

  const response = await fetchWithTimeout(`${FREE_TIER_API_URL}/v1/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clientId ? { turnstileToken, clientId, first } : { turnstileToken, first }),
    timeoutMs: 10_000,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Session creation failed' }));
    throw new Error((error as any).error || `Session failed: ${response.status}`);
  }

  const data: { token: string; expiresAt: string; clientId?: string } = await response.json();

  currentToken = data.token;
  tokenExpiresAt = new Date(data.expiresAt).getTime();
  sessionCounted = true;

  // Persist the server-assigned clientId. On a fresh device this is the first
  // time we see it; on subsequent sessions the server echoes back what we sent.
  if (data.clientId && UUID_V4_RE.test(data.clientId)) {
    writeStoredClientId(data.clientId);
  }

  return currentToken;
}

/**
 * Invalidate the current token (e.g., after a 401 response).
 * Next getSessionToken() call will create a fresh session.
 */
export function invalidateToken(): void {
  currentToken = null;
  tokenExpiresAt = 0;
}

/**
 * Check if we have an active free-tier session
 */
export function hasActiveSession(): boolean {
  return currentToken !== null && tokenExpiresAt > Date.now();
}

/**
 * Clear the current session (e.g., when user adds an API key)
 */
export function clearSession(): void {
  currentToken = null;
  tokenExpiresAt = 0;
}
