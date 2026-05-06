// useResponsive.ts - Hook for detecting responsive breakpoints
import { useState, useEffect, useRef } from 'react';

interface WindowSize {
  width: number;
  height: number;
}

interface ResponsiveFlags {
  // Mobile/Tablet breakpoint (matches CSS @media(max-width:1023px))
  isMobile: boolean;
  // Small mobile (matches CSS @media(max-width:480px))
  isSmallMobile: boolean;
  // Tablet portrait (matches CSS @media(min-width:768px))
  isTablet: boolean;
  // Desktop (matches CSS @media(min-width:1024px))
  isDesktop: boolean;
  // Height-based breakpoints for constrained viewports
  isConstrainedHeight: boolean;
  isExtremeConstrainedHeight: boolean;
  // Raw dimensions if needed
  width: number;
  height: number;
}

/**
 * Custom hook for responsive breakpoint detection
 * Matches our CSS breakpoints for consistency
 * @returns Object with boolean flags for different breakpoints
 */
export function useResponsive(): ResponsiveFlags {
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleResize(): void {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 150);
    }

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    // Mobile/Tablet breakpoint (matches CSS @media(max-width:1023px))
    isMobile: windowSize.width <= 1023,
    // Small mobile (matches CSS @media(max-width:480px))
    isSmallMobile: windowSize.width <= 480,
    // Tablet portrait (matches CSS @media(min-width:768px))
    isTablet: windowSize.width >= 768 && windowSize.width <= 1023,
    // Desktop (matches CSS @media(min-width:1024px))
    isDesktop: windowSize.width >= 1024,
    // Height-based breakpoints for constrained viewports
    isConstrainedHeight: windowSize.height <= 700,
    isExtremeConstrainedHeight: windowSize.height <= 600,
    // Raw dimensions if needed
    width: windowSize.width,
    height: windowSize.height,
  };
}

export default useResponsive;