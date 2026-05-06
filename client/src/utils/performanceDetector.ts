/**
 * Performance Detection Utility
 * Intelligently determines device performance tier for adaptive UI features
 * Part of the Unified Popup System - ULTRATHINK 2025
 */

/**
 * Performance tier levels
 */
export type PerformanceTier = 'low' | 'medium' | 'high';

/**
 * Connection types for network API
 */
type EffectiveConnectionType = 'slow-2g' | '2g' | '3g' | '4g';

/**
 * Extended Navigator interface with experimental APIs
 */
interface ExtendedNavigator extends Navigator {
  deviceMemory?: number;
  connection?: {
    effectiveType?: EffectiveConnectionType;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
}

/**
 * Blur amount map by performance tier
 */
const BLUR_MAP: Record<PerformanceTier, string> = {
  high: '8px',
  medium: '6px',
  low: '0px'
};

/**
 * Detects device performance tier based on hardware capabilities
 * @returns Performance tier
 */
export const getDevicePerformanceTier = (): PerformanceTier => {
  const nav = navigator as ExtendedNavigator;
  
  // Check multiple factors
  const factors = {
    memory: nav.deviceMemory || 4, // GB
    cores: nav.hardwareConcurrency || 4,
    connection: nav.connection?.effectiveType || '4g',
    screenSize: window.screen.width * window.screen.height,
    pixelRatio: window.devicePixelRatio || 1
  };
  
  // Score calculation
  let score: number = 0;
  
  // Memory scoring (0-3 points)
  if (factors.memory >= 8) score += 3;
  else if (factors.memory >= 4) score += 2;
  else score += 1;
  
  // CPU scoring (0-3 points)
  if (factors.cores >= 8) score += 3;
  else if (factors.cores >= 4) score += 2;
  else score += 1;
  
  // Connection scoring (0-2 points)
  if (factors.connection === '4g') score += 2;
  else if (factors.connection === '3g') score += 1;
  
  // High-res display penalty (more pixels to blur)
  if (factors.pixelRatio > 2) score -= 1;
  
  // Determine tier (max score: 8)
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
};

/**
 * Checks if liquid glass effects should be enabled
 * @returns Whether to enable liquid glass
 */
export const shouldEnableLiquidGlass = (): boolean => {
  // Check user preference first
  const userPreference: string | null = localStorage.getItem('enable-liquid-glass');
  if (userPreference === 'false') return false;
  
  // Check accessibility preference
  const prefersReducedTransparency: boolean = window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
  if (prefersReducedTransparency) return false;
  
  // Check performance tier
  const tier: PerformanceTier = getDevicePerformanceTier();
  return tier !== 'low';
};

/**
 * Gets recommended blur amount based on performance
 * @returns CSS blur value
 */
export const getRecommendedBlur = (): string => {
  if (!shouldEnableLiquidGlass()) return '0px';
  
  const tier: PerformanceTier = getDevicePerformanceTier();
  return BLUR_MAP[tier];
};

// Cache for performance tier to avoid repeated calculations
let cachedTier: PerformanceTier | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION: number = 60000; // 1 minute

/**
 * Gets cached performance tier for consistent readings
 * @returns Cached or fresh performance tier
 */
export const getCachedPerformanceTier = (): PerformanceTier => {
  const now: number = Date.now();
  
  if (!cachedTier || (now - cacheTimestamp) > CACHE_DURATION) {
    cachedTier = getDevicePerformanceTier();
    cacheTimestamp = now;
  }
  
  return cachedTier;
};