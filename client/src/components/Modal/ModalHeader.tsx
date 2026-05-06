/**
 * ModalHeader Component - 2025 CSS Modules Implementation
 * 
 * A flexible, reusable header component for all modals in Agora Cosmica.
 * Uses CSS Modules for perfect style isolation and zero conflicts.
 * 
 * @component
 * @example
 * // Three-column layout
 * <ModalHeader
 *   layout="three-column"
 *   title="Seeds of Wisdom"
 *   onClose={handleClose}
 *   cosmicStars={true}
 * />
 */

import React, { FC, ReactNode } from 'react';
import { CloseButton } from '../Button';
import styles from './ModalHeader.module.css';

type Layout = 'three-column' | 'simple' | 'immersive' | 'custom';
type Theme = 'default' | 'gold' | 'story' | 'wisdom' | 'quest' | 'freetalk';

interface ModalHeaderProps {
  // Layout & Theme
  layout?: Layout;
  theme?: Theme;
  cosmicStars?: boolean;
  className?: string;
  
  // Content
  title?: ReactNode;
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  centerContent?: ReactNode;
  
  // Behavior
  onClose?: (() => void) | null;
  showCloseButton?: boolean;
  
  // Accessibility
  ariaLabel?: string;
  closeAriaLabel?: string;
  
  // Children for custom layout
  children?: ReactNode;
}

const ModalHeader: FC<ModalHeaderProps> = ({
  // Layout & Theme
  layout = 'three-column',
  theme = 'default',
  cosmicStars = false,
  className = '',
  
  // Content
  title = '',
  titleLevel = 2,
  leftContent = null,
  rightContent = null,
  centerContent = null,
  
  // Behavior
  onClose = null,
  showCloseButton = true,
  
  // Accessibility
  ariaLabel = 'Modal header',
  closeAriaLabel = 'Close modal',
  
  // Children for custom layout
  children = null
}) => {
  // Determine which style to use based on layout
  const getHeaderStyle = (): string => {
    switch (layout) {
      case 'simple':
        return styles.simple;
      case 'immersive':
        return styles.immersive;
      case 'custom':
        return styles.custom;
      case 'three-column':
      default:
        return styles.threeColumn;
    }
  };

  // Get theme style
  const getThemeStyle = (): string => {
    switch (theme) {
      case 'gold':
        return styles.gold;
      case 'story':
        return styles.story;
      case 'wisdom':
        return styles.wisdom;
      case 'quest':
        return styles.quest;
      case 'freetalk':
        return styles.freetalk;
      default:
        return '';
    }
  };

  // Combine classes
  const headerClasses = [
    getHeaderStyle(),
    getThemeStyle(),
    cosmicStars && styles.cosmicActive,
    className
  ].filter(Boolean).join(' ');

  // Render custom layout
  if (layout === 'custom' || children) {
    return (
      <div className={headerClasses} role="group" aria-label={ariaLabel}>
        {children}
        {cosmicStars && (
          <>
            <span className={styles.star1} aria-hidden="true" />
            <span className={styles.star2} aria-hidden="true" />
            <span className={styles.star3} aria-hidden="true" />
          </>
        )}
      </div>
    );
  }

  // Render simple layout
  if (layout === 'simple') {
    return (
      <div className={headerClasses} role="group" aria-label={ariaLabel}>
        {centerContent || (
          title && (
            <h2 className={styles.title}>
              {title}
            </h2>
          )
        )}
        {showCloseButton && onClose && (
          <CloseButton
            onClick={onClose}
            ariaLabel={closeAriaLabel}
            className={styles.simpleClose}
          />
        )}
        {cosmicStars && (
          <>
            <span className={styles.star1} aria-hidden="true" />
            <span className={styles.star2} aria-hidden="true" />
            <span className={styles.star3} aria-hidden="true" />
          </>
        )}
      </div>
    );
  }

  // Render immersive layout
  if (layout === 'immersive') {
    return (
      <div className={headerClasses} role="group" aria-label={ariaLabel}>
        {showCloseButton && onClose && (
          <CloseButton
            onClick={onClose}
            ariaLabel={closeAriaLabel}
            className={styles.immersiveClose}
          />
        )}
        {cosmicStars && (
          <>
            <span className={styles.star1} aria-hidden="true" />
            <span className={styles.star2} aria-hidden="true" />
            <span className={styles.star3} aria-hidden="true" />
          </>
        )}
      </div>
    );
  }

  // Default: Three-column layout
  return (
    <div className={headerClasses} role="group" aria-label={ariaLabel}>
      <div className={styles.left}>
        {leftContent}
      </div>
      
      <div className={styles.center}>
        {centerContent || (
          title && (
            <h2 className={styles.title}>
              {title}
            </h2>
          )
        )}
      </div>
      
      <div className={styles.right}>
        {rightContent || (
          showCloseButton && onClose && (
            <CloseButton
              onClick={onClose}
              ariaLabel={closeAriaLabel}
            />
          )
        )}
      </div>
      
      {cosmicStars && (
        <>
          <span className={styles.star1} aria-hidden="true" />
          <span className={styles.star2} aria-hidden="true" />
          <span className={styles.star3} aria-hidden="true" />
        </>
      )}
    </div>
  );
};

export default ModalHeader;