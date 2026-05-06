// Voting power, tier, and suggestion-slot computation for Community Governance.
// Pure functions, all reads via existing seedLevelComputation utilities.
//
// Voting power formula (every point must be earned — no free baseline):
//   + 1 if the user has mastered at least one seed (Level 4 — all 4 modes done)
//   + 1 per fully completed figure (all 12 seeds at Level 4)
//
// Why no base point: a free baseline of 1 means a fresh visit (or a fresh
// VPN-rotated visit) inflates community stats without engagement. Earning
// the first voice through ~60 min of real seed mastery makes manipulation
// cost time, not just IP rotations. Egalitarian *and* anti-Sybil.
//
// Tier system (gender-neutral in both EN and DE):
//   - Listener (T1): no mastered seeds. No vote weight yet. "Master a seed to find your voice."
//   - Voice (T2): ≥1 mastered seed OR ≥1 completed figure.
//   - Council (T3): ≥3 fully completed figures. Adds suggestion privileges.
//
// Suggestion slot formula: floor(completed_figures / 3). First slot earned at
// the Council threshold (3 figures), then +1 per 3 figures after.

import { historicalFiguresBase } from '../../api/figures';
import { computeSeedLevelsForFigure } from '../../utils/seedLevelComputation';

const STANDARD_SEEDS: Array<{ id: number }> = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));
const TOTAL_FIGURES = historicalFiguresBase.length; // 30
const FIGURES_PER_SLOT = 3;
const COUNCIL_TIER_THRESHOLD = 3;
// Power max = first-mastery bonus + total figures = 1 + 30 = 31.
// Server-side cap in cloudflare-worker-community/src/index.ts must match.
export const MAX_VOTING_POWER = 1 + TOTAL_FIGURES;

export type CommunityTier = 'listener' | 'voice' | 'council';

export interface VotingPowerSnapshot {
  /** Always 0 — no free baseline. Kept in the snapshot for backwards compat
   *  with consumers that read `base` from the previous formula. */
  base: 0;
  /** Sum of all earned points: first-mastery bonus + completed figures. */
  earned: number;
  total: number;
  completedFigureIds: string[];
  totalFigures: number;
  tier: CommunityTier;
  /** True if the user has mastered at least one seed across any figure. */
  hasFirstMastery: boolean;
}

export interface SuggestionSlots {
  total: number;
  unlocked: boolean;
  nextSlotAt: number | null;
  completedFigures: number;
}

function isFigureFullyCompleted(figureId: string): boolean {
  const levels = computeSeedLevelsForFigure(figureId, STANDARD_SEEDS);
  const seedKeys = Object.keys(levels);
  if (seedKeys.length < STANDARD_SEEDS.length) return false;
  return seedKeys.every((id) => levels[id] === 4);
}

function hasAnyMasteredSeed(): boolean {
  for (const figure of historicalFiguresBase) {
    const levels = computeSeedLevelsForFigure(figure.id, STANDARD_SEEDS);
    for (const id of Object.keys(levels)) {
      if (levels[id] === 4) return true;
    }
  }
  return false;
}

/**
 * Tier mapping. `completedFigures` is the count of fully-completed figures.
 * `firstMastery` is true once any seed has reached Level 4 across any figure.
 *
 * Listener: no mastery yet.
 * Voice:    first mastery OR first figure complete.
 * Council:  3+ fully completed figures.
 */
export function computeTier(
  completedFigures: number,
  firstMastery: boolean
): CommunityTier {
  if (completedFigures >= COUNCIL_TIER_THRESHOLD) return 'council';
  if (firstMastery || completedFigures >= 1) return 'voice';
  return 'listener';
}

export function computeVotingPower(): VotingPowerSnapshot {
  const completedFigureIds: string[] = [];
  for (const figure of historicalFiguresBase) {
    if (isFigureFullyCompleted(figure.id)) {
      completedFigureIds.push(figure.id);
    }
  }
  const completedFigures = completedFigureIds.length;
  // If any figure is fully completed, by definition it has 12 mastered seeds —
  // so first-mastery is always true. We still check explicitly to capture the
  // common case of users with mastered seeds but no fully-completed figure.
  const firstMastery =
    completedFigures > 0 ? true : hasAnyMasteredSeed();
  const firstMasteryBonus = firstMastery ? 1 : 0;
  const earned = firstMasteryBonus + completedFigures;
  return {
    base: 0,
    earned,
    total: earned,
    completedFigureIds,
    totalFigures: TOTAL_FIGURES,
    tier: computeTier(completedFigures, firstMastery),
    hasFirstMastery: firstMastery,
  };
}

export function computeSuggestionSlots(completedFigures: number): SuggestionSlots {
  // Slots are Council-tier privilege. First slot at exactly COUNCIL_TIER_THRESHOLD.
  const total = Math.floor(completedFigures / FIGURES_PER_SLOT);
  const unlocked = completedFigures >= COUNCIL_TIER_THRESHOLD;
  const nextSlotThreshold = (total + 1) * FIGURES_PER_SLOT;
  return {
    total,
    unlocked,
    nextSlotAt: nextSlotThreshold <= TOTAL_FIGURES ? nextSlotThreshold : null,
    completedFigures,
  };
}

export function getEncourageKey(power: number): 'encourageZero' | 'encourageMid' | 'encourageStrong' {
  if (power <= 1) return 'encourageZero';
  if (power < 5) return 'encourageMid';
  return 'encourageStrong';
}

/**
 * How many more *fully completed figures* the user needs to reach Council tier.
 * Returns 0 if already Council. Note: "earned" here is the figure count, not
 * total earned points — Council is figure-gated, not power-gated.
 */
export function nextTierRemaining(completedFigures: number): number {
  if (completedFigures >= COUNCIL_TIER_THRESHOLD) return 0;
  return COUNCIL_TIER_THRESHOLD - completedFigures;
}
