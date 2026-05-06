import React, { forwardRef, ReactNode } from 'react';
import RippleButton from '../RippleButton/RippleButton';
import styles from './ActionButton.module.css';

interface ActionButtonProps {
  children: ReactNode;
  className?: string;
  variant?: 'gold' | 'coral';
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  glow?: boolean;
  elevated?: boolean;
  onClick?: (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

/**
 * ActionButton Component - STANDARD ACTION BUTTON
 * 
 * DESIGN STANDARD: Minimal elegance over flashy effects
 * - Single colors, clean transitions, perfect typography  
 * - NO cosmic themes, NO multicolor gradients, NO rainbow effects
 * 
 * @component
 * @example
 * <ActionButton
 *   variant="gold"          // or "coral"
 *   enhanced={false}        // ALWAYS false - no cosmic effects
 *   glowEffect={false}      // ALWAYS false - clean single-color glow only
 *   icon={<BookOpen />}
 *   onClick={handleClick}
 * >
 *   Learn More
 * </ActionButton>
 */
const ActionButton = forwardRef<HTMLElement, ActionButtonProps>(({
  children,
  className = '',
  variant = 'gold',
  icon,
  iconPosition = 'left',
  size = 'medium',
  fullWidth = false,
  glow = true,
  elevated = true,
  ...props
}, ref) => {
  // Combine classes
  const classes = [
    styles.actionButton,
    styles[`variant-${variant}`],
    styles[`size-${size}`],
    fullWidth && styles.fullWidth,
    glow && styles.glow,
    elevated && styles.elevated,
    className
  ].filter(Boolean).join(' ');
  
  return (
    <RippleButton
      ref={ref}
      className={classes}
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      icon={icon}
      iconPosition={iconPosition}
      enhanced={false}
      glowEffect={false}
      elevated={elevated}
      {...props}
    >
      <span className={styles.content}>
        {children}
      </span>
    </RippleButton>
  );
});

ActionButton.displayName = 'ActionButton';

export default ActionButton;