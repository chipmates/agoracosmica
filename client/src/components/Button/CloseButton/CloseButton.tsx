import React, { useState, useEffect, forwardRef, MouseEvent, CSSProperties } from 'react';
import { X } from '@phosphor-icons/react';

interface CloseButtonProps {
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  style?: CSSProperties;
  [key: string]: any; // For additional HTML button attributes
}

/**
 * CloseButton Component - Universal Size with Desktop-Only Golden Ring
 *
 * Universal design with single consistent size:
 * - 44px button size (meets WCAG touch target requirements)
 * - 22px icon size (perfect visual balance)
 * - Ring effect only on screens > 1024px (battery efficiency)
 * - Mobile/tablet get rotation only (battery-friendly)
 * - Smooth animations with proper layering
 * - Preserves positioning transforms
 */
const CloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(({
  onClick,
  className = '',
  ariaLabel = 'Close',
  disabled = false,
  style = {},
  ...props
}, ref) => {
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);
  
  // Check if we're on desktop (> 1024px) — uses matchMedia change event (no resize listener)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1025px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  
  // Universal size: 44px button, 22px icon - perfect for all contexts
  const BUTTON_SIZE = 44;
  const ICON_SIZE = 22;
  
  // Check if we have positioning classes
  const hasPositioningClass = className.includes('header') || className.includes('modal') || className.includes('close');
  
  // For modal headers, we need to preserve the translateY(-50%) transform
  const needsCenteringTransform = className.includes('header');
  
  // Build transform based on context
  const getTransform = (): string => {
    if (!isHovered || disabled) {
      return needsCenteringTransform ? 'translateY(-50%)' : 'none';
    }
    
    // On hover, add rotation
    if (needsCenteringTransform) {
      return 'translateY(-50%) rotate(90deg)';
    }
    return 'rotate(90deg)';
  };
  
  const buttonStyle: CSSProperties = {
    // Base styles always applied
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: isHovered && !disabled ? 'var(--gold-hover)' : 'var(--gold-primary)',
    opacity: disabled ? 0.4 : 1,
    transition: 'color 0.2s ease, transform 0.3s ease',
    WebkitTapHighlightColor: 'transparent',
    WebkitUserSelect: 'none',
    userSelect: 'none',
    touchAction: 'manipulation',
    width: `${BUTTON_SIZE}px`,
    height: `${BUTTON_SIZE}px`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    
    // Apply transform
    transform: getTransform(),
    
    // Only add position if no positioning class
    ...(hasPositioningClass ? {} : { position: 'relative' as const }),
    
    // Merge any custom styles
    ...style
  };
  
  // Ring styles - only for desktop
  const ringStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    border: '2px solid transparent',
    borderRadius: '50%',
    opacity: isHovered && !disabled ? 1 : 0,
    transform: isHovered && !disabled ? 'scale(1)' : 'scale(0.8)',
    borderColor: isHovered && !disabled ? 'var(--gold-primary)' : 'transparent',
    boxShadow: isHovered && !disabled
      ? '0 0 0 4px color-mix(in srgb, var(--gold-primary) 25%, transparent), 0 0 20px color-mix(in srgb, var(--gold-hover) 40%, transparent)'
      : 'none',
    transition: 'all 0.25s ease',
    pointerEvents: 'none',
    zIndex: 0
  };
  
  const handleClick = (e: MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick && !disabled) {
      onClick(e);
    }
  };

  return (
    <button
      ref={ref}
      onClick={handleClick}
      className={className}
      style={buttonStyle}
      aria-label={ariaLabel}
      type="button"
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(false)}
      {...props}
    >
      {/* Ring effect - desktop only for battery efficiency */}
      {isDesktop && (
        <span
          aria-hidden="true"
          style={ringStyle}
        />
      )}
      <X size={ICON_SIZE} />
    </button>
  );
});

CloseButton.displayName = 'CloseButton';

export default CloseButton;