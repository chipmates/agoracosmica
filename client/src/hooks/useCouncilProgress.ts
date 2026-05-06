import { useMemo } from 'react';
import { isCouncilCompleted } from '../utils/storageKeysV2';

type CouncilProgressState =
  | { status: 'not-started' }
  | { status: 'in-progress'; percentage: number }
  | { status: 'completed' };

/**
 * Reads council listening progress from localStorage.
 * Returns not-started / in-progress (with %) / completed.
 * Reads once on mount — no polling needed since catalog opens fresh each time.
 *
 * Level parameter defaults to 1 for backward compatibility.
 * If no data exists at the level-aware key, falls back to the old key format
 * (without level) and treats it as L1 data.
 */
export function useCouncilProgress(councilId: string, language: string, level: 1 | 2 = 1): CouncilProgressState {
  return useMemo(() => {
    if (isCouncilCompleted(councilId)) {
      return { status: 'completed' as const };
    }

    try {
      // Try level-aware key first
      const levelKey = `councilProgress_${councilId}_L${level}_${language}`;
      let raw = localStorage.getItem(levelKey);

      // Backward compatibility: if no data at level-aware key and level is 1,
      // check the old key format (without level) and treat as L1
      if (!raw && level === 1) {
        const legacyKey = `councilProgress_${councilId}_${language}`;
        raw = localStorage.getItem(legacyKey);
      }

      if (!raw) return { status: 'not-started' as const };

      const data = JSON.parse(raw) as {
        lastSegmentIndex?: number;
        totalSegments?: number;
      };

      if (
        data.lastSegmentIndex != null &&
        data.totalSegments != null &&
        data.totalSegments > 0
      ) {
        const pct = Math.min(
          Math.round(((data.lastSegmentIndex + 1) / data.totalSegments) * 100),
          99 // cap at 99 — 100% only via completion flag
        );
        return { status: 'in-progress' as const, percentage: pct };
      }

      // Old progress data without totalSegments — show indeterminate bar
      if (data.lastSegmentIndex != null && data.lastSegmentIndex > 0) {
        return { status: 'in-progress' as const, percentage: 15 };
      }

      return { status: 'not-started' as const };
    } catch {
      return { status: 'not-started' as const };
    }
  }, [councilId, language, level]);
}
