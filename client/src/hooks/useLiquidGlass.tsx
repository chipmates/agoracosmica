/**
 * Smart Liquid Glass Hook
 * Provides intelligent glass morphism classes based on performance and battery
 * Ensures consistent performance optimization across entire app
 * ULTRATHINK 2025 - Holistic Approach
 */

import { useState, useEffect, useMemo } from 'react';
import { shouldEnableLiquidGlass, PerformanceTier } from '../utils/performanceDetector';
import { useAdaptiveEffects } from './useBatteryAwareGlass';

type GlassVariant = 'default' | 'sidebar' | 'audio' | 'popup' | 'cosmic' | 'compact';

interface LiquidGlassOptions {
  forceEnable?: boolean;
  className?: string;
}

interface LiquidGlassDebug {
  variant: GlassVariant;
  batteryLevel: number | null;
  isCharging: boolean;
  tier: PerformanceTier;
  effectsEnabled: boolean;
}

interface LiquidGlassResult {
  glassClasses: string;
  isEnabled: boolean;
  performanceTier: PerformanceTier;
  batteryStatus: 'unknown' | 'charging' | 'good' | 'moderate' | 'low' | 'critical';
  shouldReduceEffects: boolean;
  debug: LiquidGlassDebug;
}

/**
 * Hook to get smart liquid glass classes
 * @param variant - The glass variant ('sidebar', 'audio', 'popup', 'cosmic', 'compact')
 * @param options - Additional options
 * @returns Glass classes and performance info
 */
export const useLiquidGlass = (
  variant: GlassVariant = 'default',
  options: LiquidGlassOptions = {}
): LiquidGlassResult => {
  const {
    forceEnable = false, // Override performance detection (e.g., for first impression)
    className = '', // Additional classes
  } = options;

  // Get performance and battery status
  const adaptive = useAdaptiveEffects();
  const [isEnabled, setIsEnabled] = useState<boolean>(true);

  useEffect(() => {
    // Check if liquid glass should be enabled
    const enabled = forceEnable || shouldEnableLiquidGlass();
    setIsEnabled(enabled);
  }, [forceEnable]);

  // Build the class string
  const glassClasses = useMemo(() => {
    const classes: string[] = ['liquid-glass'];

    // Add variant class
    if (variant && variant !== 'default') {
      classes.push(`liquid-glass--${variant}`);
    }

    // Apply performance-based modifiers
    if (!forceEnable) {
      // Battery saver mode
      if (adaptive.shouldReduceEffects) {
        classes.push('liquid-glass--battery-saver');
      }
      // Performance-based reduction
      else if (adaptive.performanceTier === 'medium') {
        classes.push('liquid-glass--reduced');
      }
      // Completely disable for low-end devices
      else if (adaptive.performanceTier === 'low' || !isEnabled) {
        classes.push('liquid-glass--disabled');
      }
    }

    // Add any additional classes
    if (className) {
      classes.push(className);
    }

    return classes.join(' ');
  }, [variant, className, isEnabled, forceEnable, adaptive.shouldReduceEffects, adaptive.performanceTier]);

  return {
    glassClasses,
    isEnabled: isEnabled && !adaptive.shouldReduceEffects,
    performanceTier: adaptive.performanceTier,
    batteryStatus: adaptive.batteryStatus,
    shouldReduceEffects: adaptive.shouldReduceEffects,
    // Utility for debugging
    debug: {
      variant,
      batteryLevel: adaptive.batteryPercentage,
      isCharging: adaptive.isCharging,
      tier: adaptive.performanceTier,
      effectsEnabled: isEnabled && !adaptive.shouldReduceEffects
    }
  };
};

/**
 * HOC to wrap any component with smart liquid glass
 * @param Component - Component to wrap
 * @param variant - Glass variant
 */