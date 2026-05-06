import React, { FC } from 'react';
import { ToggleLeft, ToggleRight } from '@phosphor-icons/react';

interface ToggleSwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

/**
 * A toggleable switch component with on/off states
 * 
 * @param {Object} props Component props
 * @param {boolean} props.checked Whether the toggle is checked/on
 * @param {Function} props.onChange Handler when toggle state changes
 * @param {boolean} props.disabled Whether the toggle is disabled
 * @param {string} props.id Optional ID for the toggle
 * @param {string} props.className Optional additional CSS classes
 * @param {string} props.size Size of toggle - small, medium (default), or large
 */
const ToggleSwitch: FC<ToggleSwitchProps> = ({ 
  checked = false, 
  onChange, 
  disabled = false, 
  id, 
  className = '',
  size = 'medium'
}) => {
  // Size mapping for the icons
  const sizeMap: Record<string, number> = {
    small: 16,
    medium: 22,
    large: 28
  };
  
  // Determine icon size
  const iconSize = sizeMap[size] || sizeMap.medium;
  
  // Generate classes
  const classes = [
    'toggle-switch',
    disabled ? 'disabled' : '',
    `size-${size}`,
    className
  ].filter(Boolean).join(' ');
  
  // Handle toggle
  const handleToggle = (): void => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };
  
  return (
    <button
      id={id}
      type="button"
      className={classes}
      onClick={handleToggle}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
        // ✅ Accessibility: 44px minimum touch target
        minWidth: '44px',
        minHeight: '44px',
        position: 'relative',
      }}
    >
      {checked ? (
        <ToggleRight 
          size={iconSize} 
          color="var(--gold-subtle)" 
          fill="var(--gold-subtle)" 
          strokeWidth={1.5}
        />
      ) : (
        <ToggleLeft 
          size={iconSize} 
          color="currentColor" 
          strokeWidth={1.5}
        />
      )}
    </button>
  );
};

export default ToggleSwitch;