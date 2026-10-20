// JWT session lifecycle for free-tier users
// Creates session via Turnstile → Worker, stores JWT in memory, lazily refreshes
// on the next getSessionToken() call when the cached token is within a minute of
// expiry, or a little earlier through prepareSession() when a send is coming.
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
// Turnstile + JWT issuance on a timer. Sessions analytics only fire on real
// engagement, not background timers.

import { getTurnstileToken, markTurnstileAwaited } from './turnstile';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

const FREE_TIER_API_URL = import.meta.env.VITE_FREE_TIER_API_URL || '';

const CLIENT_ID_STORAGE_KEY = 'agora_client_id';
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Re-mint when less than this is left: room for a request to reach the worker
// before the JWT lapses there. The worker checks exp with no leeway.
const REFRESH_MARGIN_MS = 60_000;
// prepareSession() looks this far ahead: about the time it takes to type and
// send a message, so the check runs while the visitor types.
const PREPARE_LOOKAHEAD_MS = 2 * 60_000;
// After this long waiting on a session, the visitor is told a check is running.
export const SESSION_WAIT_NOTICE_MS = 2_500;
/** A send has waited SESSION_WAIT_NOTICE_MS on the bot check and still waits. */
export const SESSION_WAIT_START_EVENT = 'agc:session-wait-start';
/** That wait is over, however it ended. */
export const SESSION_WAIT_END_EVENT = 'agc:session-wait-end';

// In-memory storage (never persisted — session = per-tab)
let currentToken: string | null = null;
// Local clock, from the JWT's own lifetime and the moment it arrived, so a
// device clock that runs fast or slow cannot shorten or stretch it.
let tokenExpiresAt: number = 0; // Unix ms
let pendingSession: Promise<string> | null = null; // Deduplication mutex
// Which half of a pending session is running: the bot check, or the worker call.
let sessionPhase: 'idle' | 'check' | 'session' = 'idle';
let foregroundWaiters = 0;
let waitNoticeTimer: ReturnType<typeof setTimeout> | null = null;
let waitNoticeVisible = false;
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

function hasTokenFor(ms: number): boolean {
  return currentToken !== null && tokenExpiresAt - Date.now() > ms;
}

/** Start a session unless one is already on its way (deduplication mutex). */
function ensurePendingSession(): Promise<string> {
  if (!pendingSession) {
    pendingSession = createSession().finally(() => {
      pendingSession = null;
    });
  }
  return pendingSession;
}

/**
 * Get a valid JWT token, creating a session if needed.
 * Refreshes when less than REFRESH_MARGIN_MS of the token is left.
 * Deduplicates concurrent calls to prevent multiple session creation.
 * `background`: nobody is waiting on the answer (the quota fetch at app
 * start), so no waiting notice is shown for it.
 */
export async function getSessionToken(options: { background?: boolean } = {}): Promise<string> {
  if (hasTokenFor(REFRESH_MARGIN_MS)) {
    return currentToken as string;
  }
  const pending = ensurePendingSession();
  return options.background ? pending : waitInForeground(pending);
}

/**
 * Run the check now if the next send would otherwise have to wait for one:
 * the same check, moved from the send to the moment the visitor shows intent
 * (picks a figure, starts typing). Does nothing while a token covers the next
 * couple of minutes or a check is already running. Never throws.
 */
export function prepareSession(): void {
  if (pendingSession || hasTokenFor(PREPARE_LOOKAHEAD_MS)) return;
  ensurePendingSession().catch(() => {
    // The send that follows asks again and reports its own failure.
  });
}

/** Whether a send has been waiting on the bot check long enough to say so. */
export function isSessionWaitVisible(): boolean {
  return waitNoticeVisible;
}

function setWaitNotice(visible: boolean): void {
  if (waitNoticeVisible === visible) return;
  waitNoticeVisible = visible;
  try {
    window.dispatchEvent(new CustomEvent(visible ? SESSION_WAIT_START_EVENT : SESSION_WAIT_END_EVENT));
  } catch { /* ignore */ }
}

/** A send waits on this session: after a short grace the wait is shown. */
function waitInForeground(pending: Promise<string>): Promise<string> {
  if (sessionPhase === 'check') markTurnstileAwaited();
  foregroundWaiters += 1;
  if (waitNoticeTimer === null && !waitNoticeVisible) {
    waitNoticeTimer = setTimeout(() => {
      waitNoticeTimer = null;
      if (foregroundWaiters > 0) setWaitNotice(true);
    }, SESSION_WAIT_NOTICE_MS);
  }
  const done = (): void => {
    foregroundWaiters = Math.max(0, foregroundWaiters - 1);
    if (foregroundWaiters > 0) return;
    if (waitNoticeTimer !== null) {
      clearTimeout(waitNoticeTimer);
      waitNoticeTimer = null;
    }
    setWaitNotice(false);
  };
  pending.then(done, done);
  return pending;
}

/** Read exp - iat from the JWT payload; null when it cannot be read. */
function jwtLifetimeMs(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { iat?: unknown; exp?: unknown };
    if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') return null;
    const lifetime = (payload.exp - payload.iat) * 1000;
    return lifetime > 0 && lifetime <= 24 * 60 * 60 * 1000 ? lifetime : null;
  } catch {
    return null;
  }
}

/**
 * Create a new session: Turnstile challenge → Worker → JWT
 */
async function createSession(): Promise<string> {
  sessionPhase = 'check';
  try {
    return await mintSession();
  } finally {
    sessionPhase = 'idle';
  }
}

async function mintSession(): Promise<string> {
  const turnstileToken = await getTurnstileToken();
  sessionPhase = 'session';
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
  const lifetimeMs = jwtLifetimeMs(data.token);
  tokenExpiresAt = lifetimeMs !== null ? Date.now() + lifetimeMs : new Date(data.expiresAt).getTime();
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
