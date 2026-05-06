import React, { forwardRef, ElementType, ReactNode, ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLElement> {
  children: ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold' | 'coral' | 'light';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  disabled?: boolean;
  as?: ElementType;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
}

/**
 * Base Button Component - Foundation for all buttons in Agora Cosmica
 * 
 * This is the atomic building block that all other buttons extend from.
 * Provides basic styling, accessibility, and interaction patterns.
 * 
 * @component
 * @example
 * <Button variant="primary" size="medium">Click me</Button>
 */
const Button = forwardRef<HTMLElement, ButtonProps>(({ 
  children,
  className = '',
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
  as: Component = 'button',
  type = 'button',
  onClick,
  ...props 
}, ref) => {
  const classes = [
    styles.button,
    styles[`variant${variant.charAt(0).toUpperCase() + variant.slice(1)}`],
    styles[`size${size.charAt(0).toUpperCase() + size.slice(1)}`],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    className
  ].filter(Boolean).join(' ');

  return (
    <Component
      ref={ref as any}
      type={Component === 'button' ? type : undefined}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </Component>
  );
});

Button.displayName = 'Button';

export default Button;