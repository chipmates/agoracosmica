// seedLevelComputation.ts - Extracted from WisdomMapModal/index.tsx
// Computes per-seed mode completion status and bloom levels (0-4).
// Reusable by pendingBlooms.ts and other consumers without React dependency.

import { isStoryCompleted, isPrismCompleted, isWisdomCompleted, STORAGE_KEYS } from './storageKeysV2';

export interface SeedSliceStatus {
  seedId: string | number;
  storyDone: boolean;
  wisdomDone: boolean;
  prismDone: boolean;
  questDone: boolean;
}

/**
 * Compute per-seed mode completion for a given figure.
 * Each seed gets a boolean for each of the 4 modes.
 */
export function computeSeedSlices(
  figureId: string,
  seeds: Array<{ id: string | number }>
): SeedSliceStatus[] {
  if (!seeds.length || !figureId) return [];

  return seeds.map((seed) => {
    const sId = seed.id;

    // Wisdom: requires 30+ messages (15 exchanges = meaningful philosophical dialogue).
    // Source of truth is the marker key set by markWisdomCompleted (called from the
    // conversation persistence path). Fallback to legacy localStorage history length
    // for users whose seed_conversation was persisted before the marker existed.
    let wisdomDone = isWisdomCompleted(figureId, sId);
    if (!wisdomDone) {
      const wisdomHistory = localStorage.getItem(STORAGE_KEYS.getStarSeedHistory(figureId, sId));
      if (wisdomHistory) {
        try {
          const arr = JSON.parse(wisdomHistory);
          wisdomDone = Array.isArray(arr) && arr.length >= 30;
        } catch { /* invalid JSON = not done */ }
      }
    }

    // Quest: requires seed actually gathered via award_seed tool call (passed: true)
    const questDone = localStorage.getItem(`completion_${figureId}_${sId}`) === 'true';

    return {
      seedId: sId,
      storyDone: isStoryCompleted(figureId, sId),
      wisdomDone,
      prismDone: isPrismCompleted(figureId, sId),
      questDone,
    };
  });
}

/**
 * Derive bloom level (0-4) per seed from slice status.
 * Level = count of completed modes.
 */
export function computeSeedLevels(slices: SeedSliceStatus[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const slice of slices) {
    map[String(slice.seedId)] = [
      slice.storyDone,
      slice.wisdomDone,
      slice.prismDone,
      slice.questDone,
    ].filter(Boolean).length;
  }
  return map;
}

/**
 * Convenience: compute seed levels for a figure in one call.
 */
export function computeSeedLevelsForFigure(
  figureId: string,
  seeds: Array<{ id: string | number }>
): Record<string, number> {
  return computeSeedLevels(computeSeedSlices(figureId, seeds));
}
