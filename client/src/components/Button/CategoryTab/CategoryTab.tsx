import React, { useCallback, forwardRef, ReactNode, KeyboardEvent, MouseEvent } from 'react';
import RippleButton from '../RippleButton/RippleButton';
import styles from './CategoryTab.module.css';

interface CategoryTabProps {
  children: ReactNode;
  isActive?: boolean;
  category: string;
  onSelect?: (category: string) => void;
  onKeyNavigate?: (key: string, category: string) => void;
  className?: string;
  [key: string]: any; // For additional props passed to RippleButton
}

/**
 * CategoryTab Component - STANDARD CATEGORY BUTTON
 * 
 * Simplified category navigation button with unified design language.
 * Features golden border recognition and matching glow effects.
 * 
 * DESIGN STANDARD: Minimal elegance, unified with ActionButton
 * - Golden fine border for category recognition
 * - Single-color glow effects (no gradients/multicolor)
 * - Consistent with ActionButton interaction patterns
 * 
 * @component
 * @example
 * <CategoryTab
 *   category="sages"
 *   isActive={true}
 *   onSelect={handleSelect}
 * >
 *   Sages
 * </CategoryTab>
 */
const CategoryTab = forwardRef<HTMLElement, CategoryTabProps>(({
  children,
  isActive = false,
  category,
  onSelect,
  onKeyNavigate,
  className = '',
  ...props
}, ref) => {
  
  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    const navigationKeys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (navigationKeys.includes(e.key)) {
      e.preventDefault();
      onKeyNavigate?.(e.key, category);
    }
  }, [category, onKeyNavigate]);
  
  // Handle selection
  const handleClick = useCallback((e: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    onSelect?.(category);
  }, [category, onSelect]);
  
  // Combine classes
  const classes = [
    styles.categoryTab,
    isActive && styles.active,
    className
  ].filter(Boolean).join(' ');
  
  return (
    <RippleButton
      ref={ref}
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${category}`}
      aria-label={children as string}
      id={`tab-${category}`}
      tabIndex={isActive ? 0 : -1}
      className={classes}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      variant="ghost"
      enhanced={false}
      {...props}
    >
      {children}
    </RippleButton>
  );
});

CategoryTab.displayName = 'CategoryTab';

export default CategoryTab;