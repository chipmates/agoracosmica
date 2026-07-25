/**
 * cosmos/tiers — device quality ladder for the WebGL moments.
 *
 * Mirrors the ladder shipped with the marketing /experience page
 * (marketing/src/experience/main.js pickTier). Every in-app WebGL surface
 * (entry cinematic, wisdom sky) picks its budget from here so phones get a
 * lighter scene and low-end phones get the CSS fallback instead.
 *
 * TODO (design-lift unit 35): merge with utils/performanceDetector.ts into
 * one tiering system. The detector currently scores every desktop "high"
 * without consulting the GPU; this ladder is the more conservative source
 * of truth for WebGL work until then.
 */

export type CosmosTier = 'desktop' | 'mobile' | 'mobile-low' | 'still';

export interface TierBudget {
  /** Device pixel ratio cap for the renderer. */
  dprCap: number;
  /** Background starfield point count. */
  stars: number;
  /** Ignition particle count for a single portrait/plate. */
  ignitionParticles: number;
  /** Ambient gold motes; 0 disables the layer entirely. */
  motes: number;
  /** Preferred media image width for sampled sources. */
  imageSize: 600 | 900;
}

export const TIER_BUDGETS: Record<Exclude<CosmosTier, 'still'>, TierBudget> = {
  desktop: { dprCap: 2, stars: 2800, ignitionParticles: 12500, motes: 640, imageSize: 900 },
  mobile: { dprCap: 2, stars: 1500, ignitionParticles: 5200, motes: 260, imageSize: 600 },
  'mobile-low': { dprCap: 1.5, stars: 900, ignitionParticles: 3200, motes: 0, imageSize: 600 },
};

export function webgl2Available(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Pick the tier for this device. 'still' means: do not start WebGL at all,
 * render the CSS fallback instead.
 */
export function pickCosmosTier(): CosmosTier {
  if (prefersReducedMotion() || !webgl2Available()) return 'still';

  const small = window.matchMedia('(max-width: 720px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (!small && !coarse) return 'desktop';

  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const lowCores =
    typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  return lowMemory || lowCores ? 'mobile-low' : 'mobile';
}

/**
 * Tier for the Celestial Atlas (Wisdom Map). Same ladder, minus the WebGL2
 * requirement: the atlas is Canvas 2D + SVG and runs anywhere. Reduced
 * motion and low-end phones still get the flat map fallback.
 */
export function pickAtlasTier(): CosmosTier {
  if (prefersReducedMotion()) return 'still';

  const small = window.matchMedia('(max-width: 720px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (!small && !coarse) return 'desktop';

  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const lowCores =
    typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  return lowMemory || lowCores ? 'mobile-low' : 'mobile';
}
