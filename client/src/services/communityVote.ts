// communityVote.ts — Best-effort heartbeat to the community-tally backend.
// Privacy: a random per-device UUID, created only when the visitor adds
// themselves to the tally, then sent as is; the server stores only a keyed hash
// of it. Until then only the public totals are read. No PII, no analytics.
// Failure mode: silent. The modal must work offline.

// Made by "Count me in". The earlier key was created just by opening the
// page, without that act, so it is removed unread and never sent.
const STORAGE_KEY = 'community_tally_id';
const PRE_ACT_KEY = 'community_device_uuid';
const REQUEST_TIMEOUT_MS = 5000;

const COMMUNITY_API_URL =
  (import.meta.env?.VITE_COMMUNITY_API_URL as string | undefined)?.trim() ||
  'https://community.agoracosmica.org';

export interface CommunitySnapshot {
  joinedCount: number;
  totalPower: number;
  updatedAt?: number;
  // Co-sign threshold for surfacing suggestions to ChipMates moderation.
  // Server-controlled, scales with community size.
  // See cloudflare-worker-community/README.md "Threshold scaling" section.
  coSignThreshold?: number;
  // Human-readable phase label, e.g. "Launch phase" or "Established community".
  thresholdPhase?: string;
}

interface RegisterPayload {
  power: number;
  completedFigures: number;
}

export function dropPreActId(): void {
  try {
    localStorage.removeItem(PRE_ACT_KEY);
  } catch {
    // storage blocked
  }
}

/** Removes this browser's tally ID, after a press the server never answered. */
export function forgetTallyId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked
  }
}

/** True once this browser has added itself to the tally (its ID exists). */
export function hasJoinedTally(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    // crypto.randomUUID is supported in all modern browsers and the dev target.
    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // localStorage may be blocked (private mode in some browsers). Use a per-tab id.
    return `tab-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }
}

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Register the user's current voting power with the community tally, creating
 * this browser's ID on the first call. Only after the visitor's own "Count me
 * in", or once that ID exists. Returns the latest community-wide aggregate
 * snapshot, or null on failure. Never throws.
 */
export async function registerVotingPower(
  payload: RegisterPayload
): Promise<CommunitySnapshot | null> {
  try {
    const deviceId = getOrCreateDeviceId();
    const body = JSON.stringify({
      deviceId,
      // Cap mirrors cloudflare-worker-community/src/index.ts validation.
      // Max = 1 first-mastery + 30 figures = 31. No free baseline.
      power: Math.max(0, Math.min(31, Math.floor(payload.power))),
      completedFigures: Math.max(
        0,
        Math.min(30, Math.floor(payload.completedFigures))
      ),
    });

    const response = await fetchWithTimeout(
      `${COMMUNITY_API_URL}/v1/community/power`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }
    );

    if (!response.ok) return null;
    const data = (await response.json()) as Partial<CommunitySnapshot>;
    if (
      typeof data.joinedCount !== 'number' ||
      typeof data.totalPower !== 'number'
    ) {
      return null;
    }
    return {
      joinedCount: data.joinedCount,
      totalPower: data.totalPower,
      updatedAt: data.updatedAt,
      coSignThreshold: data.coSignThreshold,
      thresholdPhase: data.thresholdPhase,
    };
  } catch {
    return null;
  }
}

/**
 * Read-only snapshot fetch: the public totals, for a browser that has not added
 * itself. Stores and sends nothing about the visitor. Best-effort, never throws.
 */
export async function fetchCommunitySnapshot(): Promise<CommunitySnapshot | null> {
  try {
    const response = await fetchWithTimeout(
      `${COMMUNITY_API_URL}/v1/community/snapshot`,
      { method: 'GET' }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<CommunitySnapshot>;
    if (
      typeof data.joinedCount !== 'number' ||
      typeof data.totalPower !== 'number'
    ) {
      return null;
    }
    return {
      joinedCount: data.joinedCount,
      totalPower: data.totalPower,
      updatedAt: data.updatedAt,
      coSignThreshold: data.coSignThreshold,
      thresholdPhase: data.thresholdPhase,
    };
  } catch {
    return null;
  }
}
