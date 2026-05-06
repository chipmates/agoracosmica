// pendingBlooms.ts - Bloom state management for the Prismatic Bloom gamification system.
// Tracks which level-ups the user has witnessed, gates popup frequency,
// and manages the post-dialogue invite card state.
// All state is localStorage-backed. No React or Zustand dependency.

import { LocalStorageAdapter } from '../storage/localAdapter';
import { computeSeedLevelsForFigure } from './seedLevelComputation';
import { historicalFiguresBase } from '../api/figures';

// --- Types ---

export interface PendingBloom {
  figureId: string;
  seedId: string;
  seedTitle: string;
  figureName: string;
  fromLevel: number;
  toLevel: number;
  tier: 1 | 2; // Tier 1 = L0-L3 level-up, Tier 2 = L3→L4 mastery
}

export interface BloomInvite {
  count: number;
  figureId: string;
  timestamp: number;
}

// --- Storage key helpers ---

const lastSeenKey = (figureId: string) => `bloom_lastSeenLevels_${figureId}`;
const firstBloomKey = (figureId: string) => `bloom_firstBloomShown_${figureId}`;
const figureCompletionKey = (figureId: string) => `bloom_figureCompletionShown_${figureId}`;
const INVITE_KEY = 'bloom_pendingInvite';

// --- Last seen levels ---

export function getLastSeenLevels(figureId: string): Record<string, number> {
  try {
    const raw = LocalStorageAdapter.getString(lastSeenKey(figureId));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function setLastSeenLevels(figureId: string, levels: Record<string, number>): void {
  try {
    LocalStorageAdapter.setString(lastSeenKey(figureId), JSON.stringify(levels));
  } catch { /* localStorage full or unavailable */ }
}

// --- First bloom per figure gating ---

function getFirstBloomMap(figureId: string): Record<string, boolean> {
  try {
    const raw = LocalStorageAdapter.getString(firstBloomKey(figureId));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function setFirstBloomMap(figureId: string, map: Record<string, boolean>): void {
  try {
    LocalStorageAdapter.setString(firstBloomKey(figureId), JSON.stringify(map));
  } catch { /* ignore */ }
}

export function isFirstBloomForFigure(figureId: string): boolean {
  const map = getFirstBloomMap(figureId);
  return Object.keys(map).length === 0;
}

export function hasFirstBloomBeenShown(figureId: string): boolean {
  const map = getFirstBloomMap(figureId);
  return Object.values(map).some(Boolean);
}

export function markFirstBloomShown(figureId: string, seedId: string): void {
  const map = getFirstBloomMap(figureId);
  map[String(seedId)] = true;
  setFirstBloomMap(figureId, map);
}

// --- First-ever mastery detection (cross-figure) ---

/**
 * True if any seed (in any figure) has previously been witnessed at Level 4.
 *
 * Used to detect "first ever mastery" moments in BloomTransformationCard:
 * if this returns false at celebration time, the bloom about to fire is the
 * user's first taste of mastery — the moment they earn their first voice.
 *
 * Reads only `lastSeenLevels` (which is updated via markBloomWitnessed),
 * so concurrent multi-mastery scenarios are handled cleanly: bloom #1 gets
 * the "first" treatment, and by the time bloom #2 renders the lastSeen has
 * already been updated to include #1.
 */
export function hasAnyWitnessedMastery(): boolean {
  for (const figure of historicalFiguresBase) {
    const lastSeen = getLastSeenLevels(figure.id);
    for (const seedId in lastSeen) {
      if (lastSeen[seedId] === 4) return true;
    }
  }
  return false;
}

// --- Figure completion ---

export function isFigureCompletionShown(figureId: string): boolean {
  return LocalStorageAdapter.getString(figureCompletionKey(figureId)) === 'true';
}

export function markFigureCompletionShown(figureId: string): void {
  try {
    LocalStorageAdapter.setString(figureCompletionKey(figureId), 'true');
  } catch { /* ignore */ }
}

export function shouldShowFigureCompletion(
  figureId: string,
  currentLevels: Record<string, number>,
  totalSeeds: number
): boolean {
  if (isFigureCompletionShown(figureId)) return false;
  if (totalSeeds === 0) return false;

  const seedIds = Object.keys(currentLevels);
  if (seedIds.length < totalSeeds) return false;

  return seedIds.every(id => currentLevels[id] === 4);
}

// --- Core: compute pending blooms ---

export function computePendingBlooms(
  figureId: string,
  currentLevels: Record<string, number>,
  seeds: Array<{ id: string | number; title?: string }>,
  figureName: string
): PendingBloom[] {
  const lastSeen = getLastSeenLevels(figureId);
  const firstBloomAlreadyShown = hasFirstBloomBeenShown(figureId);
  const blooms: PendingBloom[] = [];
  let tier1Added = false; // Only one Tier 1 bloom per figure, ever

  for (const seed of seeds) {
    const seedId = String(seed.id);
    const currentLevel = currentLevels[seedId] ?? 0;
    const lastLevel = lastSeen[seedId] ?? 0;

    if (currentLevel <= lastLevel) continue;

    const toLevel = currentLevel;
    const isMastery = toLevel === 4;

    // Tier 2 (mastery) always plays
    if (isMastery) {
      blooms.push({
        figureId,
        seedId,
        seedTitle: seed.title || `Seed ${seedId}`,
        figureName,
        fromLevel: lastLevel,
        toLevel,
        tier: 2,
      });
      continue;
    }

    // Tier 1: only ONE per figure, only if never shown before
    if (!firstBloomAlreadyShown && !tier1Added) {
      blooms.push({
        figureId,
        seedId,
        seedTitle: seed.title || `Seed ${seedId}`,
        figureName,
        fromLevel: lastLevel,
        toLevel,
        tier: 1,
      });
      tier1Added = true;
    }
  }

  // Sort: Tier 1 first (lower levels), then Tier 2 (mastery)
  blooms.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.toLevel - b.toLevel;
  });

  return blooms;
}

// --- Mark a bloom as witnessed (updates lastSeenLevels) ---

export function markBloomWitnessed(figureId: string, seedId: string, toLevel: number): void {
  const levels = getLastSeenLevels(figureId);
  levels[String(seedId)] = toLevel;
  setLastSeenLevels(figureId, levels);
}

// --- Update all last seen levels to current (for silent level-ups) ---

export function syncAllLastSeenLevels(figureId: string, currentLevels: Record<string, number>): void {
  setLastSeenLevels(figureId, { ...currentLevels });
}

// --- Post-dialogue invite card ---

export function setPendingInvite(invite: BloomInvite): void {
  try {
    LocalStorageAdapter.setString(INVITE_KEY, JSON.stringify(invite));
  } catch { /* ignore */ }
}

export function getPendingInvite(): BloomInvite | null {
  try {
    const raw = LocalStorageAdapter.getString(INVITE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    LocalStorageAdapter.remove(INVITE_KEY);
  } catch { /* ignore */ }
}

// Standard 12 seed IDs used by all figures
const STANDARD_SEEDS: Array<{ id: number }> = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));

/**
 * Check if a mode completion caused a level-up and set the invite if so.
 * Call this after markStoryCompleted, markPrismCompleted, or markAsGathered.
 * Uses the standard 12 seed IDs (1-12) that all figures share.
 */
export function checkAndSetBloomInvite(figureId: string): void {
  const currentLevels = computeSeedLevelsForFigure(figureId, STANDARD_SEEDS);
  const lastSeen = getLastSeenLevels(figureId);

  let newBlooms = 0;
  for (const seed of STANDARD_SEEDS) {
    const seedId = String(seed.id);
    const current = currentLevels[seedId] ?? 0;
    const last = lastSeen[seedId] ?? 0;
    if (current > last) newBlooms++;
  }

  if (newBlooms > 0) {
    const existing = getPendingInvite();
    const totalCount = (existing?.figureId === figureId ? existing.count : 0) + newBlooms;
    setPendingInvite({ count: totalCount, figureId, timestamp: Date.now() });
  }
}
