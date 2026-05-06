/**
 * Battery Awareness Hook
 * Monitors battery status to intelligently reduce visual effects
 * Part of the Unified Popup System - ULTRATHINK 2025
 */

import { useState, useEffect } from 'react';
import { PerformanceTier } from '../utils/performanceDetector';

// Battery API types (not standard, so we need to define them)
interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener(type: 'chargingchange' | 'chargingtimechange' | 'dischargingtimechange' | 'levelchange', listener: EventListener): void;
  removeEventListener(type: 'chargingchange' | 'chargingtimechange' | 'dischargingtimechange' | 'levelchange', listener: EventListener): void;
}

// Extend Navigator for Battery API
interface NavigatorWithBattery extends Navigator {
  getBattery(): Promise<BatteryManager>;
}

type BatteryStatus = 'unknown' | 'charging' | 'good' | 'moderate' | 'low' | 'critical';

interface BatteryAwareResult {
  // Battery data
  batteryLevel: number;
  batteryPercentage: number;
  isCharging: boolean;
  isSupported: boolean;
  
  // Recommendations
  shouldReduceEffects: boolean;
  shouldDisableAnimations: boolean;
  batteryStatus: BatteryStatus;
  
  // Utility functions
  canUseLiquidGlass: () => boolean;
  canUseAnimations: () => boolean;
  getRecommendedBlur: () => string;
}

/**
 * Hook to monitor battery status and recommend effect reduction
 * @returns Battery status and recommendations
 */
export const useBatteryAwareGlass = (): BatteryAwareResult => {
  const [batteryLevel, setBatteryLevel] = useState<number>(1); // Default to 100%
  const [isCharging, setIsCharging] = useState<boolean>(true); // Assume charging by default
  const [isSupported, setIsSupported] = useState<boolean>(false);
  
  useEffect(() => {
    // Check if Battery API is supported
    if (!('getBattery' in navigator)) {
      // Battery API not supported - assume good battery
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    let batteryRef: BatteryManager | null = null;
    let updateBattery: (() => void) | null = null;

    // Get battery status
    (navigator as NavigatorWithBattery).getBattery().then((battery: BatteryManager) => {
      batteryRef = battery;
      // Set initial values
      setBatteryLevel(battery.level);
      setIsCharging(battery.charging);

      // Update function
      updateBattery = (): void => {
        setBatteryLevel(battery.level);
        setIsCharging(battery.charging);
      };

      // Add event listeners
      battery.addEventListener('levelchange', updateBattery);
      battery.addEventListener('chargingchange', updateBattery);
    }).catch((error: Error) => {
      console.warn('Battery API error:', error);
      setIsSupported(false);
    });

    return () => {
      if (batteryRef && updateBattery) {
        batteryRef.removeEventListener('levelchange', updateBattery);
        batteryRef.removeEventListener('chargingchange', updateBattery);
      }
    };
  }, []);
  
  // Calculate recommendations
  const shouldReduceEffects = batteryLevel < 0.2 && !isCharging; // Below 20% and not charging
  const shouldDisableAnimations = batteryLevel < 0.1 && !isCharging; // Below 10% critical
  
  // Get battery status description
  const getBatteryStatus = (): BatteryStatus => {
    if (!isSupported) return 'unknown';
    if (isCharging) return 'charging';
    if (batteryLevel > 0.5) return 'good';
    if (batteryLevel > 0.2) return 'moderate';
    if (batteryLevel > 0.1) return 'low';
    return 'critical';
  };
  
  return {
    // Battery data
    batteryLevel,
    batteryPercentage: Math.round(batteryLevel * 100),
    isCharging,
    isSupported,
    
    // Recommendations
    shouldReduceEffects,
    shouldDisableAnimations,
    batteryStatus: getBatteryStatus(),
    
    // Utility functions
    canUseLiquidGlass: () => !shouldReduceEffects,
    canUseAnimations: () => !shouldDisableAnimations,
    getRecommendedBlur: () => {
      if (shouldReduceEffects) return '0px';
      if (batteryLevel < 0.5 && !isCharging) return '4px'; // Reduce blur at 50%
      return '8px'; // Full blur
    }
  };
};

interface AdaptiveEffectsResult extends BatteryAwareResult {
  performanceTier: PerformanceTier;
  shouldEnableEffects: boolean;
  adaptiveBlur: string;
  particleCount: number;
}

/**
 * Hook to combine performance and battery awareness
 * @returns Combined recommendations
 */
export const useAdaptiveEffects = (): AdaptiveEffectsResult => {
  const battery = useBatteryAwareGlass();
  const [performanceTier, setPerformanceTier] = useState<PerformanceTier>('medium');
  
  useEffect(() => {
    // Lazy load performance detector to avoid circular dependencies
    import('../utils/performanceDetector').then(module => {
      setPerformanceTier(module.getCachedPerformanceTier());
    });
  }, []);
  
  // Combine battery and performance recommendations
  const shouldEnableEffects = (): boolean => {
    if (battery.shouldReduceEffects) return false;
    if (performanceTier === 'low') return false;
    return true;
  };
  
  const getAdaptiveBlur = (): string => {
    if (!shouldEnableEffects()) return '0px';
    
    // Battery-aware blur reduction
    const batteryBlur = battery.getRecommendedBlur();
    const performanceBlur = performanceTier === 'high' ? '8px' : '6px';
    
    // Use the lower of the two values
    const batteryValue = parseInt(batteryBlur);
    const performanceValue = parseInt(performanceBlur);
    
    return `${Math.min(batteryValue, performanceValue)}px`;
  };
  
  return {
    ...battery,
    performanceTier,
    shouldEnableEffects: shouldEnableEffects(),
    adaptiveBlur: getAdaptiveBlur(),
    particleCount: battery.shouldReduceEffects ? 4 : performanceTier === 'high' ? 16 : 8
  };
};