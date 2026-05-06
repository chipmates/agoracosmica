// src/utils/deviceDetection.ts

/**
 * Utility functions for device detection and mobile audio handling
 */

// Extend Window interface for custom properties
declare global {
  interface Window {
    AppAudioContext?: AudioContext;
    hasShownMobileTTSNotice?: boolean;
    audioUnlocked?: boolean;
    webkitAudioContext?: typeof AudioContext;
  }
}

/**
 * Detects if the current device is iOS
 * @returns {boolean}
 */
export const isIOS = (): boolean => {
  // iPadOS 13+ reports as Mac in UA — detect via touch + Mac platform
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Detects if the current device is Android
 * @returns {boolean}
 */
export const isAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

/**
 * Detects if the current browser is Safari
 * Note: This excludes Chrome/Chromium-based browsers that use WebKit
 * @returns {boolean}
 */
export const isSafari = (): boolean => {
  const ua = navigator.userAgent;
  // Safari has "Safari" in UA but NOT "Chrome" or "CriOS" (Chrome on iOS)
  return /Safari/i.test(ua) && !/Chrome/i.test(ua) && !/CriOS/i.test(ua);
};

/**
 * Detects if the current device is iOS running Safari specifically
 * This is useful for Safari-specific bugs (e.g., microphone permission timeout)
 * iOS Chrome does NOT have the same issues as iOS Safari
 * @returns {boolean}
 */
export const isIOSSafari = (): boolean => {
  return isIOS() && isSafari();
};

/**
 * Checks if the current device is a mobile or tablet device
 * @returns {boolean}
 */
export const isMobileOrTablet = (): boolean => {
  // For testing purposes - uncomment to force mobile view
  // return true;
  
  return isIOS() || isAndroid() || 
    /webOS|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768);
};

/**
 * Monitors battery level and adds low-battery class to body
 * This enables CSS-based animation optimizations
 */
export const initBatteryMonitoring = (): void => {
  if ('getBattery' in navigator) {
    (navigator as any).getBattery().then((battery: any) => {
      const updateBatteryClass = (): void => {
        if (battery.level < 0.2) { // Below 20%
          document.body.classList.add('low-battery');
        } else {
          document.body.classList.remove('low-battery');
        }
      };
      
      // Initial check
      updateBatteryClass();
      
      // Monitor battery level changes
      battery.addEventListener('levelchange', updateBatteryClass);
      
      // Also check when charging state changes
      battery.addEventListener('chargingchange', () => {
        if (battery.charging) {
          // Remove low battery mode when charging
          document.body.classList.remove('low-battery');
        } else {
          updateBatteryClass();
        }
      });
    });
  }
};


