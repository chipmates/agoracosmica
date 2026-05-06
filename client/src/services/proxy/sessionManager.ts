// JWT session lifecycle for free-tier users
// Creates session via Turnstile → Worker, stores JWT in memory, auto-refreshes.
//
// Identity: a UUID v4 ("clientId") is persisted in localStorage and sent with
// every /v1/session call so the server's daily quota stays bound to this device
// across tabs, page reloads, and JWT refreshes — independent of the public IP.
// Cleared localStorage → fresh quota; that's a known and accepted trade-off.

import { getTurnstileToken } from './turnstile';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

const FREE_TIER_API_URL = import.meta.env.VITE_FREE_TIER_API_URL || '';

const CLIENT_ID_STORAGE_KEY = 'agora_client_id';
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// In-memory storage (never persisted — session = per-tab)
let currentToken: string | null = null;
let tokenExpiresAt: number = 0; // Unix ms
let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSession: Promise<string> | null = null; // Deduplication mutex

/** Read the persisted clientId. Returns null if missing, malformed, or storage is unavailable. */
function readStoredClientId(): string | null {
  try {
    const stored = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    return stored && UUID_V4_RE.test(stored) ? stored : null;
  } catch {
    // localStorage may be unavailable (Safari private mode in some configs).
    // Falling back to per-session UUIDs is acceptable — server still rate-limits.
    return null;
  }
}

/** Persist the clientId returned by the server so subsequent sessions reuse it. */
function writeStoredClientId(clientId: string): void {
  try {
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  } catch {
    // Storage write failed — silent. Server will mint a fresh UUID next session.
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

  const response = await fetchWithTimeout(`${FREE_TIER_API_URL}/v1/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clientId ? { turnstileToken, clientId } : { turnstileToken }),
    timeoutMs: 10_000,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Session creation failed' }));
    throw new Error((error as any).error || `Session failed: ${response.status}`);
  }

  const data: { token: string; expiresAt: string; clientId?: string } = await response.json();

  currentToken = data.token;
  tokenExpiresAt = new Date(data.expiresAt).getTime();

  // Persist the server-assigned clientId. On a fresh device this is the first
  // time we see it; on subsequent sessions the server echoes back what we sent.
  if (data.clientId && UUID_V4_RE.test(data.clientId)) {
    writeStoredClientId(data.clientId);
  }

  // Schedule refresh 5 minutes before expiry
  scheduleRefresh();

  return currentToken;
}

function scheduleRefresh(): void {
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
  }

  const refreshIn = tokenExpiresAt - Date.now() - 5 * 60 * 1000;
  if (refreshIn > 0) {
    refreshTimeout = setTimeout(() => {
      createSession().catch(err => {
        console.warn('[SessionManager] Auto-refresh failed:', err instanceof Error ? err.message : 'unknown error');
        // Will retry on next getSessionToken() call
      });
    }, refreshIn);
  }
}

/**
 * Invalidate the current token (e.g., after a 401 response).
 * Next getSessionToken() call will create a fresh session.
 */
export function invalidateToken(): void {
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }
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
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }
}
