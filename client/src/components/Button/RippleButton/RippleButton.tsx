import React, { useRef, useEffect, useCallback, forwardRef, ReactNode, CSSProperties, MouseEvent, KeyboardEvent } from 'react';
import Button from '../Button';
import styles from './RippleButton.module.css';

interface RippleButtonProps {
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  className?: string;
  style?: CSSProperties;
  rippleColor?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold' | 'coral' | 'light';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  elevated?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  enhanced?: boolean;
  glowEffect?: boolean | null;
  loading?: boolean;
  theme?: 'nature' | 'cosmic';
  pulse?: boolean;
  type?: 'button' | 'submit' | 'reset';
  role?: string;
  id?: string;
  tabIndex?: number;
  'aria-disabled'?: boolean;
  'aria-busy'?: boolean;
  'aria-selected'?: boolean;
  'aria-controls'?: string;
  'aria-label'?: string;
  'data-theme'?: string;
}

/**
 * RippleButton Component v3.0.0 - State-of-the-Art 2025 Edition
 * 
 * Enhanced button with advanced ripple effect, progressive enhancement,
 * and integration with the cosmic design system.
 * 
 * @component
 * @example
 * // Basic usage
 * <RippleButton variant="gold">Click me</RippleButton>
 * 
 * // Enhanced with all effects
 * <RippleButton variant="gold" enhanced={true} theme="cosmic">
 *   Enhanced Button
 * </RippleButton>
 */
const RippleButton = forwardRef<HTMLElement, RippleButtonProps>(({
  children,
  onClick,
  onKeyDown: externalOnKeyDown,
  className = '',
  style = {},
  rippleColor,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  elevated = false,
  disabled = false,
  icon = null,
  iconPosition = 'left',
  enhanced = false,
  glowEffect = null, // null means auto-detect based on enhanced
  loading = false,
  theme = 'nature',
  pulse = false,
  ...props
}, ref) => {
  const buttonRef = useRef<HTMLElement | null>(null);
  const combinedRef = useCallback((node: HTMLElement | null) => {
    buttonRef.current = node;
    if (ref) {
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    }
  }, [ref]);
  
  // Auto-enable glow effect when enhanced is true (unless explicitly disabled)
  const shouldGlow = glowEffect !== null ? glowEffect : enhanced;
  
  // Determine ripple color based on variant if not explicitly provided
  const getRippleColor = (): string => {
    if (rippleColor) return rippleColor;
    
    // Return CSS variable names to be used in the ripple element
    switch(variant) {
      case 'gold':
        return 'var(--ripple-gold)'; // Dark ripple on light background
      case 'coral':
        return 'var(--ripple-coral)'; // Dark ripple on coral background
      case 'light':
        return 'var(--ripple-light)'; // Dark ripple on white background
      case 'ghost':
        return 'var(--ripple-ghost)'; // Gold ripple on transparent
      default:
        return 'var(--ripple-default)'; // Light ripple on dark background
    }
  };
  
  // Optimized ripple creation function with useCallback
  const createRipple = useCallback((event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    if (disabled || loading) return;
    
    const button = buttonRef.current;
    if (!button) return;
    
    // Determine if it's a keyboard event
    const isKeyboardEvent = 'detail' in event && event.detail === 0;
    
    // Remove any existing ripples
    const ripples = button.getElementsByClassName(styles.ripple);
    while (ripples.length > 0) {
      ripples[0].remove();
    }
    
    // Create a new ripple
    const ripple = document.createElement('span');
    ripple.classList.add(styles.ripple);
    ripple.style.backgroundColor = getRippleColor();
    button.appendChild(ripple);
    
    // Get the button's position
    const rect = button.getBoundingClientRect();
    
    // Calculate ripple size based on button dimensions
    const size = Math.max(rect.width, rect.height) * 2;
    
    // Position the ripple
    if (isKeyboardEvent) {
      // Center ripple for keyboard events
      ripple.style.left = `${rect.width / 2 - size / 2}px`;
      ripple.style.top = `${rect.height / 2 - size / 2}px`;
    } else if ('clientX' in event) {
      // Position ripple based on click/touch position
      const x = event.clientX - rect.left - size / 2;
      const y = event.clientY - rect.top - size / 2;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
    }
    
    // Set the ripple size
    ripple.style.width = ripple.style.height = `${size}px`;
    
    // The animation starts automatically when the ripple is added to DOM
    
    // Call the provided onClick handler if provided
    if (onClick && !disabled && !loading) {
      onClick(event);
    }
  }, [onClick, disabled, loading, variant, rippleColor]);
  
  // Handle keyboard interactions
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    // Call external handler first if provided
    if (externalOnKeyDown) {
      externalOnKeyDown(event);
    }
    // Then handle internal ripple logic
    if ((event.key === 'Enter' || event.key === ' ') && !disabled && !loading) {
      event.preventDefault();
      createRipple(event);
    }
  }, [createRipple, disabled, loading, externalOnKeyDown]);
  
  // Clean up ripples when unmounting
  useEffect(() => {
    return () => {
      if (buttonRef.current) {
        const ripples = buttonRef.current.getElementsByClassName(styles.ripple);
        while (ripples.length > 0) {
          ripples[0].remove();
        }
      }
    };
  }, []);
  
  // Combine all classes based on props
  const buttonClasses = [
    styles.rippleButton,
    elevated && styles.elevated,
    enhanced && styles.enhanced,
    shouldGlow && styles.glow,
    loading && styles.loading,
    pulse && styles.pulse,
    enhanced && styles[theme], // Apply theme class only when enhanced
    className
  ].filter(Boolean).join(' ');
  
  return (
    <Button
      ref={combinedRef}
      className={buttonClasses}
      style={style}
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      onClick={createRipple}
      onKeyDown={handleKeyDown}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      data-theme={enhanced ? theme : undefined}
      {...props}
    >
      {!loading && icon && iconPosition === 'left' && (
        <span className={styles.icon}>{icon}</span>
      )}
      {!loading && <span className={styles.content}>{children}</span>}
      {!loading && icon && iconPosition === 'right' && (
        <span className={styles.icon}>{icon}</span>
      )}
      {loading && (
        <span className={styles.loadingSpinner} aria-hidden="true" />
      )}
    </Button>
  );
});

RippleButton.displayName = 'RippleButton';

export default RippleButton;