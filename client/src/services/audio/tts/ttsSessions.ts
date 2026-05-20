// src/services/audio/tts/ttsSessions.ts
// Session-id policy for TTS routing stickiness.
//
// Server-side gateway (api.agoracosmica.org) routes TTS requests with an
// X-Session-Id header stickily: the first request mints a backend choice
// (Qwen3-TTS primary, F5-TTS overflow), and subsequent requests with the
// same session-id pin to that choice for session-cache TTL seconds. This
// keeps a figure's voice timbre consistent across turns.
//
// Contract (from server-side design memo):
//   "A UUID represents a voice-consistency contract. Two TTS requests share
//    a UUID if and only if the user expects them to sound like the same voice."
//
// Scopes:
//   - Conversation modes (seed/free/challenge): one id per conversation-entity,
//     reset on historyKey change (figure/seed/mode transition).
//   - Custom council: one id per figure within a council. Different figures
//     route independently; same figure turn-to-turn stays consistent.
//   - Previews: fresh id per click. No stickiness.
//
// Storage: in-memory only. Per product decision, no localStorage /
// sessionStorage / cookies. Page reload → fresh ids (worst case: one-time
// voice shift if gateway load has changed since last session).

import { useDomainStore } from '../../../stores/domainStore';
import { audioApiUrl } from '../../../config/runtime';

const DEFAULT_TTL_SECONDS = 3600; // Server default per stickiness memo
const ROLL_BEFORE_EXPIRY_SECONDS = 60; // Proactively re-mint this long before server evicts

interface SessionRecord {
  id: string;
  mintedAt: number;  // epoch ms
  ttlSeconds: number;
}

function newUuid(): string {
  // crypto.randomUUID requires secure context — prod (https) + localhost are fine.
  // Fallback for the theoretical case where it's unavailable.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isStale(record: SessionRecord): boolean {
  const elapsed = (Date.now() - record.mintedAt) / 1000;
  return elapsed > record.ttlSeconds - ROLL_BEFORE_EXPIRY_SECONDS;
}

// ============================================
// Conversation scope (seed / free / challenge / initial message)
// ============================================

// Tracks both the id and the historyKey it was minted for. When the user
// switches figure/seed/mode, historyKey changes → next call mints a fresh id.
interface ConversationSessionRecord extends SessionRecord {
  forHistoryKey: string | null;
}

let conversationSession: ConversationSessionRecord | null = null;

/**
 * Get the current conversation session id, minting a fresh one if the
 * historyKey has changed (new conversation) or the session is near expiry.
 * Safe to call from any caller that wants to share the conversation's
 * voice-consistency contract (live TTS + initial-message custom voice).
 */
export function getOrRollConversationSessionId(): string {
  const currentHistoryKey = useDomainStore.getState().conversation.historyKey;

  if (
    conversationSession === null ||
    conversationSession.forHistoryKey !== currentHistoryKey ||
    isStale(conversationSession)
  ) {
    conversationSession = {
      id: newUuid(),
      mintedAt: Date.now(),
      ttlSeconds: DEFAULT_TTL_SECONDS,
      forHistoryKey: currentHistoryKey,
    };
  }

  return conversationSession.id;
}

/**
 * Update the conversation session's TTL based on a server response header.
 * Called by TTS callers after each request that returned a non-undefined
 * sessionTtlSeconds. Resets mintedAt so the TTL window slides forward.
 */
export function touchConversationSession(ttlSeconds: number): void {
  if (conversationSession === null) return;
  conversationSession.mintedAt = Date.now();
  conversationSession.ttlSeconds = ttlSeconds;
}

// ============================================
// Custom council scope (per-figure)
// ============================================

const councilFigureSessions = new Map<string, SessionRecord>();

/**
 * Get-or-roll a session id for one figure within a custom council.
 * Each figure gets its own routing decision — the council doesn't share one
 * backend across all participants, so Figure A on Qwen and Figure B on F5
 * within the same council is expected and correct.
 */
export function getOrRollCouncilFigureSessionId(figureId: string): string {
  const existing = councilFigureSessions.get(figureId);
  if (existing && !isStale(existing)) {
    return existing.id;
  }
  const fresh: SessionRecord = {
    id: newUuid(),
    mintedAt: Date.now(),
    ttlSeconds: DEFAULT_TTL_SECONDS,
  };
  councilFigureSessions.set(figureId, fresh);
  return fresh.id;
}

export function touchCouncilFigureSession(figureId: string, ttlSeconds: number): void {
  const existing = councilFigureSessions.get(figureId);
  if (!existing) return;
  existing.mintedAt = Date.now();
  existing.ttlSeconds = ttlSeconds;
}

/**
 * Clear all per-figure session ids. Called by CustomCouncilService.cleanup()
 * when a council ends, ensuring a subsequent council starts with fresh
 * routing decisions rather than inheriting stale ids.
 */
export function clearCouncilSessions(): void {
  councilFigureSessions.clear();
}

// ============================================
// Preview scope (voice-panel, test pages)
// ============================================

/**
 * Mint a fresh session id for a one-off preview request. Each click gets
 * its own routing decision — previews are not a conversation, they are
 * independent probes.
 */
export function newPreviewSessionId(): string {
  return newUuid();
}

// ============================================
// Session-end beacon (LT-11)
// ============================================

/**
 * Fire-and-forget beacon telling the gateway to evict a session id from its
 * cache, freeing the corresponding Qwen admission slot immediately instead
 * of waiting for the 3600s TTL to expire naturally.
 *
 * Called when the user explicitly opts out of audio for the current turn
 * (ProcessingLoader / CosmicCouncilLoader "read instead" button), since at
 * that point we know they're not coming back to use the session.
 *
 * Uses `navigator.sendBeacon` when available — designed for this exact pattern
 * (short, non-blocking, survives page unload). Falls back to a keepalive fetch
 * on older browsers. Silently swallows all errors: if the beacon fails the
 * session simply expires on TTL like before, no user-visible impact.
 *
 * Server-side contract (agreed with Server-Claude):
 *   POST /v1/audio/session/end
 *   Body: { session_id: string }
 *   Response: 204 No Content (ignored — fire-and-forget)
 *
 * Auth: unauthenticated. Worst-case misuse is an attacker sending random UUIDs,
 * which is a no-op (only matching cache entries get evicted). Not a security
 * surface.
 */
export function sendSessionEndBeacon(sessionId: string | null | undefined): void {
  if (!sessionId) return;

  const url = `${audioApiUrl}/v1/audio/session/end`;
  const payload = JSON.stringify({ session_id: sessionId });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return;
    }
    // Fallback: keepalive fetch (survives page navigation on most browsers)
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      /* beacon failures are silent — the session expires on TTL anyway */
    });
  } catch {
    /* never throw from a beacon */
  }
}
