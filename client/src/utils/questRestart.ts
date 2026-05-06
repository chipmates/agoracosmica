// questRestart.ts — Atomic Quest history reset for retry flow.
//
// Used by the "Erneut versuchen" CTA on the not-earned verdict card AND by any
// future in-Quest restart button. Wipes the conversation thread (IDB + LS),
// clears the pending verdict marker, and resets domain store state if the
// affected seed is currently active. Bloom levels and other modes are NOT
// touched — only the Quest thread for this single (figureId, seedId) pair.
//
// Idempotent: repeated calls on a clean state are no-ops, never throw.

import { useDomainStore } from '../stores';
import { LocalStorageAdapter } from '../storage/localAdapter';
import { runWithWal } from '../storage';
import { STORAGE_KEYS } from './storageKeysV2';
import { clearPendingQuestVerdict } from './questVerdict';

export async function restartQuest(figureId: string, seedId: string | number): Promise<void> {
  const threadKey = STORAGE_KEYS.getChallengeHistory(figureId, seedId);

  // 1. IndexedDB history (where messages actually live in the modern path)
  try {
    await runWithWal(
      [{ type: 'delete', store: 'history', key: threadKey }],
      async () => undefined,
    );
  } catch (error) {
    console.warn('[restartQuest] IDB delete failed', error);
  }

  // 2. localStorage fallback (legacy audioService.ts wrote here for SEED_CONVERSATION;
  //    Quest wasn't on that path, but defensive cleanup so stale data can't resurrect)
  LocalStorageAdapter.remove(threadKey);

  // 3. Pending verdict marker (the user is consciously moving past this attempt)
  clearPendingQuestVerdict();

  // 4. If this seed is the live conversation, reset the in-memory thread so the
  //    user sees a fresh chat immediately. If it's not active, the next time
  //    they enter Quest for this seed, hydration from IDB will return an empty
  //    array and the figure's initial greeting will fire.
  const store = useDomainStore.getState();
  const liveSelection =
    store.figures.selectedId === figureId &&
    String(store.seeds.selectedId) === String(seedId);
  if (liveSelection) {
    store.setConversationMessages([]);
    store.setConversationStarted(false);
  }

  // 5. Notify any UI surface that depends on Quest history state
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('questRestarted', { detail: { figureId, seedId: String(seedId) } }),
    );
  }
}
