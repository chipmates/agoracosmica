/**
 * Focus System Utility - 2025 State-of-the-Art Accessibility
 * 
 * Provides consistent focus styles across the entire application
 * following WCAG 2.2 AAA standards and modern CSS practices.
 * 
 * @author Claude Code Companion
 * @version 1.0.0
 * @created July 17, 2025
 */

import { CSSProperties } from 'react';

/**
 * Focus token structure
 */
export interface FocusTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    contrast: string;
    transparent: string;
  };
  dimensions: {
    outlineWidth: string;
    outlineOffset: string;
    borderRadius: string;
  };
  animation: {
    duration: string;
    easing: string;
  };
}

/**
 * Focus style variant names
 */
export type FocusVariant = 'default' | 'primary' | 'secondary' | 'contrast' | 'inset';

/**
 * Focus styles map type
 */
export type FocusStylesMap = {
  [K in FocusVariant]: CSSProperties;
};

// Design tokens for focus system
export const focusTokens: FocusTokens = {
  // Colors aligned with Agora Cosmica theme
  colors: {
    primary: 'var(--gold-base)',
    secondary: 'var(--gold-light)',
    accent: 'var(--gold-luminous)',
    contrast: 'var(--primary-deep)',
    transparent: 'color-mix(in srgb, var(--gold-base) 30%, transparent)',
  },
  
  // Spacing and dimensions
  dimensions: {
    outlineWidth: '2px',
    outlineOffset: '2px',
    borderRadius: '4px',
  },
  
  // Animation and timing
  animation: {
    duration: '0.2s',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// Focus style variants for different component types
export const focusStyles: FocusStylesMap = {
  // Default focus style for most components
  default: {
    outline: `${focusTokens.dimensions.outlineWidth} solid ${focusTokens.colors.primary}`,
    outlineOffset: focusTokens.dimensions.outlineOffset,
    borderRadius: focusTokens.dimensions.borderRadius,
    transition: `outline-color ${focusTokens.animation.duration} ${focusTokens.animation.easing}`,
  },
  
  // Enhanced focus for primary actions
  primary: {
    outline: `${focusTokens.dimensions.outlineWidth} solid ${focusTokens.colors.accent}`,
    outlineOffset: focusTokens.dimensions.outlineOffset,
    borderRadius: focusTokens.dimensions.borderRadius,
    boxShadow: `0 0 0 4px ${focusTokens.colors.transparent}`,
    transition: `all ${focusTokens.animation.duration} ${focusTokens.animation.easing}`,
  },
  
  // Subtle focus for secondary elements
  secondary: {
    outline: `${focusTokens.dimensions.outlineWidth} solid ${focusTokens.colors.secondary}`,
    outlineOffset: focusTokens.dimensions.outlineOffset,
    borderRadius: focusTokens.dimensions.borderRadius,
    opacity: 0.8,
    transition: `all ${focusTokens.animation.duration} ${focusTokens.animation.easing}`,
  },
  
  // High contrast focus for accessibility
  contrast: {
    outline: `3px solid ${focusTokens.colors.primary}`,
    outlineOffset: '3px',
    borderRadius: focusTokens.dimensions.borderRadius,
    backgroundColor: focusTokens.colors.contrast,
    color: focusTokens.colors.primary,
    transition: `all ${focusTokens.animation.duration} ${focusTokens.animation.easing}`,
  },
  
  // Inset focus for contained elements
  inset: {
    outline: 'none',
    boxShadow: `inset 0 0 0 ${focusTokens.dimensions.outlineWidth} ${focusTokens.colors.primary}`,
    borderRadius: focusTokens.dimensions.borderRadius,
    transition: `box-shadow ${focusTokens.animation.duration} ${focusTokens.animation.easing}`,
  },
};

/**
 * Generate focus styles for a specific variant
 * @param variant - The focus style variant to use
 * @returns CSS-in-JS style object
 */
export const getFocusStyles = (variant: FocusVariant = 'default'): CSSProperties => {
  return focusStyles[variant] || focusStyles.default;
};

/**
 * Create focus class name for CSS modules
 * @param variant - The focus style variant to use
 * @returns CSS class definition object
 */
export const createFocusClass = (variant: FocusVariant = 'default'): Record<string, CSSProperties> => {
  return {
    '&:focus-visible': getFocusStyles(variant),
  };
};

/**
 * CSS custom properties type
 */
export interface FocusCustomProperties {
  '--focus-color-primary': string;
  '--focus-color-secondary': string;
  '--focus-color-accent': string;
  '--focus-color-contrast': string;
  '--focus-color-transparent': string;
  '--focus-outline-width': string;
  '--focus-outline-offset': string;
  '--focus-border-radius': string;
  '--focus-duration': string;
  '--focus-easing': string;
}

/**
 * Generate CSS custom properties for focus system
 * @returns CSS custom properties object
 */
export const focusCustomProperties: FocusCustomProperties = {
  '--focus-color-primary': focusTokens.colors.primary,
  '--focus-color-secondary': focusTokens.colors.secondary,
  '--focus-color-accent': focusTokens.colors.accent,
  '--focus-color-contrast': focusTokens.colors.contrast,
  '--focus-color-transparent': focusTokens.colors.transparent,
  '--focus-outline-width': focusTokens.dimensions.outlineWidth,
  '--focus-outline-offset': focusTokens.dimensions.outlineOffset,
  '--focus-border-radius': focusTokens.dimensions.borderRadius,
  '--focus-duration': focusTokens.animation.duration,
  '--focus-easing': focusTokens.animation.easing,
};

/**
 * Check if user prefers reduced motion
 * @returns indicating reduced motion preference
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Check if user prefers high contrast
 * @returns indicating high contrast preference
 */
export const prefersHighContrast = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: high)').matches;
};

/**
 * Get adaptive focus styles based on user preferences
 * @param variant - Base focus variant
 * @returns Adapted focus styles
 */
export const getAdaptiveFocusStyles = (variant: FocusVariant = 'default'): CSSProperties => {
  let styles: CSSProperties = getFocusStyles(variant);
  
  // Adapt for reduced motion
  if (prefersReducedMotion()) {
    styles = {
      ...styles,
      transition: 'none',
    };
  }
  
  // Adapt for high contrast
  if (prefersHighContrast()) {
    styles = {
      ...styles,
      outline: `3px solid ButtonText`,
      outlineOffset: '3px',
      backgroundColor: 'ButtonFace',
      color: 'ButtonText',
    };
  }
  
  return styles;
};

/**
 * Focus management utilities interface
 */
export interface FocusManagement {
  focusFirst: (container: HTMLElement) => void;
  focusLast: (container: HTMLElement) => void;
  trapFocus: (container: HTMLElement, event: KeyboardEvent) => void;
}

/**
 * Focus management utilities
 */
export const focusManagement: FocusManagement = {
  /**
   * Focus the first focusable element in a container
   * @param container - The container element
   */
  focusFirst: (container: HTMLElement): void => {
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    if (firstElement) {
      firstElement.focus();
    }
  },
  
  /**
   * Focus the last focusable element in a container
   * @param container - The container element
   */
  focusLast: (container: HTMLElement): void => {
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const lastElement = focusableElements[focusableElements.length - 1];
    if (lastElement) {
      lastElement.focus();
    }
  },
  
  /**
   * Trap focus within a container (for modals, dropdowns)
   * @param container - The container element
   * @param event - The keyboard event
   */
  trapFocus: (container: HTMLElement, event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;
    
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  },
};

/**
 * Utility class styles type
 */
export interface FocusUtilityClasses {
  srOnly: CSSProperties;
  focusVisible: Record<string, CSSProperties>;
  skipLink: CSSProperties & Record<string, CSSProperties>;
}

/**
 * CSS utility classes for focus system
 */
export const focusUtilityClasses: FocusUtilityClasses = {
  // Screen reader only content
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0',
  },
  
  // Focus-visible only (show when focused via keyboard)
  focusVisible: {
    '&:not(:focus-visible)': {
      outline: 'none',
    },
  },
  
  // Skip to content styling
  skipLink: {
    position: 'absolute',
    top: '-40px',
    left: '6px',
    zIndex: 1000,
    padding: '8px 12px',
    backgroundColor: focusTokens.colors.primary,
    color: focusTokens.colors.contrast,
    textDecoration: 'none',
    borderRadius: focusTokens.dimensions.borderRadius,
    fontSize: '14px',
    fontWeight: '500',
    transition: `top ${focusTokens.animation.duration} ${focusTokens.animation.easing}`,
    
    '&:focus': {
      top: '6px',
    },
  } as CSSProperties & Record<string, CSSProperties>,
};

// Export everything for easy import
export default {
  focusTokens,
  focusStyles,
  getFocusStyles,
  createFocusClass,
  focusCustomProperties,
  getAdaptiveFocusStyles,
  focusManagement,
  focusUtilityClasses,
  prefersReducedMotion,
  prefersHighContrast,
};