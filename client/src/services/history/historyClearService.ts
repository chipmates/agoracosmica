// src/services/history/historyClearService.ts

import { LocalStorageAdapter } from '../../storage/localAdapter';
import { runWithWal, type WalOperation } from '../../storage';
import { STORAGE_KEYS } from '../../utils/storageKeysV2';
interface Figure {
  id: string;
  name?: string;
  [key: string]: any;
}

interface ClearResult {
  cleared: string[];
}

interface ClearAllResult {
  clearedModeKeys: string[];
  clearedCompletionKeys: string[];
}

/**
 * Service for clearing conversation history
 */

export const clearSeedHistory = async (selectedFigure: Figure, seedId: string): Promise<ClearResult> => {
  const figureId = selectedFigure.id;
  
  // Special handling for FreeTalk mode
  if (seedId === 'freetalk') {
    const freeTalkKey = `freetalk_${figureId}`;
    LocalStorageAdapter.remove(freeTalkKey);

    const operations: WalOperation[] = [
      { type: 'delete', store: 'history', key: STORAGE_KEYS.getFreeTalkHistory(figureId) },
    ];
    await runWithWal(operations, async () => undefined);

    // Also clear the mode state for freetalk
    const modeStateKey = `modeState_${figureId}_freetalk`;
    LocalStorageAdapter.remove(modeStateKey);

    // Set a flag in localStorage to indicate history was cleared
    LocalStorageAdapter.setString('histories_cleared', 'true');

    return { cleared: ['freetalk'] };
  }
  
  // New format keys only (for non-FreeTalk modes)
  // Must match STORAGE_KEYS in storageKeysV2.ts: starseed_{figureId}_{seedId}, NOT starseed_history_
  const storyKey = `story_content_${figureId}_${seedId}`;
  const starseedKey = STORAGE_KEYS.getStarSeedHistory(figureId, seedId);
  const challengeKey = STORAGE_KEYS.getChallengeHistory(figureId, seedId);
  const summaryKey = `summary_${figureId}_${seedId}`;
  const modeStateKey = `modeState_${figureId}_${seedId}`;
  const prismContentKey = `prism_content_${figureId}_${seedId}`;
  const prismCompletedKey = `prism_${figureId}_${seedId}_completed`;

  const keysToRemove = [storyKey, starseedKey, challengeKey, summaryKey, modeStateKey, prismContentKey, prismCompletedKey];
  
  // Remove all mode-specific keys
  keysToRemove.forEach(key => {
    LocalStorageAdapter.remove(key);
  });

  const completionKeys: string[] = [];

  // Look for completion keys related to this seed using figure.id
  const normalizedSeedSuffix = seedId.includes('-') ? seedId.split('-')[1] : seedId;
  LocalStorageAdapter.keys().forEach((key) => {
    if (!key.startsWith(`completion_${figureId}_`)) {
      return;
    }
    if (key.endsWith(`_${seedId}`) || key.endsWith(`_${normalizedSeedSuffix}`)) {
      completionKeys.push(key);
    }
  });
  
  // Remove completion records for this seed
  completionKeys.forEach(key => {
    LocalStorageAdapter.remove(key);
  });

  const operations: WalOperation[] = [];
  operations.push({ type: 'delete', store: 'history', key: STORAGE_KEYS.getStarSeedHistory(figureId, seedId) });
  operations.push({ type: 'delete', store: 'history', key: STORAGE_KEYS.getChallengeHistory(figureId, seedId) });

  await runWithWal(operations, async () => undefined);

  // Set a flag in localStorage to indicate history was cleared
  LocalStorageAdapter.setString('histories_cleared', 'true');
  
  return { cleared: keysToRemove.concat(completionKeys) };
};

export const clearAllHistory = async (): Promise<ClearAllResult> => {
  const allKeys = LocalStorageAdapter.keys();
  
  // New format keys only
  const modeKeys = allKeys.filter(k => 
    k.startsWith('story_') ||
    k.startsWith('starseed_') || 
    k.startsWith('challenge_') || 
    k.startsWith('freetalk_') ||
    k.startsWith('summary_') ||
    k.startsWith('modeState_')
  );
  const completionKeys = allKeys.filter(k => k.startsWith('completion_'));
  
  // Create backup of all completions
  const allCompletions: Record<string, string | null> = {};
  completionKeys.forEach(key => {
    allCompletions[key] = LocalStorageAdapter.getString(key);
  });

  // Store the backup with a timestamp
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  LocalStorageAdapter.setJSON(`backup_all_completions_${timestamp}`, allCompletions);

  // Remove all mode-related keys
  modeKeys.forEach(key => {
    LocalStorageAdapter.remove(key);
  });

  // Remove all completion keys
  completionKeys.forEach(key => {
    LocalStorageAdapter.remove(key);
  });

  await runWithWal([{ type: 'clear', store: 'history' }], async () => undefined);

  // Trigger a state reset event instead of page refresh
  window.dispatchEvent(new CustomEvent('app:reset-state'));

  // Ensure UI listeners know histories were cleared this session
  LocalStorageAdapter.setString('histories_cleared', 'true');
  
  return { clearedModeKeys: modeKeys, clearedCompletionKeys: completionKeys };
};
