// IMPLEMENTATION_STARTED: 2025-03-28

type HapticIntensity = 'light' | 'medium' | 'strong' | 'error' | 'bloom' | 'mastery';

interface HapticFeedback {
  triggerHaptic: (intensity?: HapticIntensity) => void;
}

/**
 * Custom hook for providing haptic feedback on supported devices
 * 
 * @returns Object with triggerHaptic function
 */
export const useHapticFeedback = (): HapticFeedback => {
  /**
   * Trigger haptic feedback with specified intensity
   * @param intensity - Intensity level: 'light', 'medium', 'strong', or 'error'
   */
  const triggerHaptic = (intensity: HapticIntensity = 'medium'): void => {
    if (!window.navigator || !window.navigator.vibrate) return;
    
    switch (intensity) {
      case 'light':
        window.navigator.vibrate(10);
        break;
      case 'medium':
        window.navigator.vibrate(15);
        break;
      case 'strong':
        window.navigator.vibrate([10, 30, 10]);
        break;
      case 'error':
        window.navigator.vibrate([10, 30, 10, 30, 10]);
        break;
      case 'bloom':
        window.navigator.vibrate([8, 40, 12]);
        break;
      case 'mastery':
        window.navigator.vibrate([15, 50, 15, 80, 20]);
        break;
      default:
        window.navigator.vibrate(15);
    }
  };
  
  return { triggerHaptic };
};

// IMPLEMENTATION_COMPLETE: 2025-03-28