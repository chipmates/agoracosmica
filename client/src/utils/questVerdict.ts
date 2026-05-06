// questVerdict.ts — Pending Quest verdict marker for the not-earned card.
// Mirrors pendingBlooms.ts shape. Stored in localStorage so it survives a
// session close and surfaces on the next homepage visit.
//
// Single-pending model: only one verdict awaiting acknowledgment at a time.
// Newer pending overwrites older. (If a user fails Quest on figure A, then
// fails Quest on figure B before acknowledging A, only B's card surfaces.
// A's history remains in IDB and can still be restarted by re-entering Quest
// on figure A — just not via the card.)
//
// "Earned" outcomes do NOT use this — they go through markSeedAsGathered →
// PostDialogueBloomInvite. This marker is exclusively for passed:false.

import { LocalStorageAdapter } from '../storage/localAdapter';

const PENDING_KEY = 'quest_pending_verdict';

export interface PendingQuestVerdict {
  figureId: string;
  seedId: string;
  timestamp: number;
}

export function setPendingQuestVerdict(verdict: Omit<PendingQuestVerdict, 'timestamp'>): void {
  try {
    LocalStorageAdapter.setString(
      PENDING_KEY,
      JSON.stringify({ ...verdict, timestamp: Date.now() }),
    );
  } catch { /* localStorage full or unavailable */ }
}

export function getPendingQuestVerdict(): PendingQuestVerdict | null {
  try {
    const raw = LocalStorageAdapter.getString(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.figureId || !parsed?.seedId) return null;
    return parsed as PendingQuestVerdict;
  } catch {
    return null;
  }
}

export function clearPendingQuestVerdict(): void {
  try {
    LocalStorageAdapter.remove(PENDING_KEY);
  } catch { /* ignore */ }
}
