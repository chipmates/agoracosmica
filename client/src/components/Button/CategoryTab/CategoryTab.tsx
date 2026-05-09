import { useCallback, forwardRef, ReactNode, KeyboardEvent, MouseEvent } from 'react';
import styles from './CategoryTab.module.css';

interface CategoryTabProps {
  children: ReactNode;
  isActive?: boolean;
  category: string;
  onSelect?: (category: string) => void;
  onKeyNavigate?: (key: string, category: string) => void;
  className?: string;
  [key: string]: any;
}

/**
 * CategoryTab — pill-shaped tablist button.
 *
 * Plain <button>, no RippleButton wrapper. Drops backdrop-filter and
 * filter: drop-shadow (both glitched on iOS WebKit when the chip is
 * re-composited after tap). Hover is gated to (hover: hover) so iOS
 * sticky :hover doesn't leave a tinted/lifted state behind.
 */
const CategoryTab = forwardRef<HTMLButtonElement, CategoryTabProps>(({
  children,
  isActive = false,
  category,
  onSelect,
  onKeyNavigate,
  className = '',
  ...props
}, ref) => {

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>) => {
    const navigationKeys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (navigationKeys.includes(e.key)) {
      e.preventDefault();
      onKeyNavigate?.(e.key, category);
    }
  }, [category, onKeyNavigate]);

  const handleClick = useCallback((_e: MouseEvent<HTMLButtonElement>) => {
    onSelect?.(category);
  }, [category, onSelect]);

  const classes = [
    styles.categoryTab,
    isActive && styles.active,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${category}`}
      aria-label={typeof children === 'string' ? children : undefined}
      id={`tab-${category}`}
      tabIndex={isActive ? 0 : -1}
      className={classes}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </button>
  );
});

CategoryTab.displayName = 'CategoryTab';

export default CategoryTab;
