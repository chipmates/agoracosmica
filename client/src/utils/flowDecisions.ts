// Pure flow decisions, extracted from ModeSelectorMini and HomePage (Effect #14)
// so the welcome ceremony, mode-node states, and mode restoration are
// table-testable without React, storage, or timers. Callers do the storage
// reads and pass plain values in; these functions only decide.

import { getStorageKeyForMode } from './storageKeysV2';

/**
 * The per-seed key prefixes that count as "has engaged with this figure".
 * A trailing underscore keeps figure ids from matching their own prefixes
 * (story_jung_ never matches story_jung2_...).
 */
export const engagementPrefixesFor = (figureId: string): string[] => [
  `visitedModes_${figureId}_`,
  `starseed_${figureId}_`,
  `challenge_${figureId}_`,
  `story_${figureId}_`,
  `prism_${figureId}_`,
];

/**
 * First contact is per FIGURE, not per seed: the doors are a one-time welcome
 * ceremony. Free-talk history or any per-seed engagement key means the visitor
 * has already met the figure and goes straight to the eclipse.
 */
export function isFirstContactForFigure(
  figureId: string,
  allStorageKeys: readonly string[],
  hasFreeTalkHistory: boolean
): boolean {
  if (hasFreeTalkHistory) return false;
  const prefixes = engagementPrefixesFor(figureId);
  return !allStorageKeys.some(k => prefixes.some(prefix => k.startsWith(prefix)));
}

export type NodeState = 'dormant' | 'visited' | 'completed' | 'active';

export interface NodeStateSnapshot {
  /** The mode currently active in the conversation, if any. */
  selectedMode: string | null;
  /** Both a figure and a seed are selected. */
  hasSelection: boolean;
  storyCompleted: boolean;
  prismCompleted: boolean;
  /** A starseed (wisdom) history entry exists for this figure+seed. */
  wisdomEngaged: boolean;
  /** A challenge history entry exists for this figure+seed. */
  challengeEngaged: boolean;
  visitedModes: readonly string[];
}

/** Eclipse node display state. Order of precedence: active > completed > visited > dormant. */
export function resolveNodeState(modeId: string, snap: NodeStateSnapshot): NodeState {
  if (snap.selectedMode === modeId) return 'active';
  if (!snap.hasSelection) return 'dormant';

  switch (modeId) {
    case 'introduction':
      if (snap.storyCompleted) return 'completed';
      break;
    case 'prism':
      if (snap.prismCompleted) return 'completed';
      break;
    case 'seed_conversation':
      if (snap.wisdomEngaged) return 'completed';
      break;
    case 'challenge':
      if (snap.challengeEngaged) return 'completed';
      break;
  }

  if (snap.visitedModes.includes(modeId)) return 'visited';
  return 'dormant';
}

export type RestoreAction =
  | { kind: 'selectStoredMode'; mode: string }
  | { kind: 'openModeSelector' }
  | { kind: 'markConversationStarted' }
  | { kind: 'presetKeyAndSelect'; mode: string; historyKey: string | null };

/**
 * The decision core of HomePage Effect #14: given the stored mode for the
 * selected figure+seed and the mode currently in the store, decide how to
 * restore. The effect's timing guards (figure-select in flight, recent seed
 * select, onboarding overlays, incomplete selection) stay at the call site;
 * this function assumes they have passed.
 */
export function resolveRestoreAction(
  storedMode: string | null,
  currentMode: string | null,
  figureId: string,
  seedId: string | number
): RestoreAction {
  if (storedMode && storedMode !== currentMode) {
    return { kind: 'selectStoredMode', mode: storedMode };
  }
  if (!storedMode) {
    return { kind: 'openModeSelector' };
  }
  // Mode already correct — covers page refresh where the store has the right mode.
  if (storedMode === 'prism') {
    // Prism uses its own player — just mark started so bookmarks + UI work.
    return { kind: 'markConversationStarted' };
  }
  return {
    kind: 'presetKeyAndSelect',
    mode: storedMode,
    historyKey: getStorageKeyForMode(
      storedMode,
      figureId,
      storedMode === 'free_conversation' ? undefined : String(seedId)
    ),
  };
}

/** Conversation Deepened counts user messages, never greetings or replies. */
export const CONVERSATION_DEEPENED_TURNS = 3;

/**
 * Has this conversation reached its third user message? Counted over the
 * active conversation's own message list, so switching figure, seed or mode
 * (which replaces that list) starts the count over instead of carrying a
 * session-wide tally.
 */
export function reachedDeepenedTurns(
  messages: readonly { role?: string }[]
): boolean {
  let turns = 0;
  for (const message of messages) {
    if (message.role !== 'user') continue;
    turns += 1;
    if (turns >= CONVERSATION_DEEPENED_TURNS) return true;
  }
  return false;
}
