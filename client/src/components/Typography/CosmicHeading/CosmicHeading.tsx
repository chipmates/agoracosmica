import React, { FC, ReactNode } from 'react';
import styles from './CosmicHeading.module.css';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type GradientType = 'gold' | 'goldSubtle' | 'coral' | 'cosmic' | 'nebula' | 'void';

interface CosmicHeadingProps {
  children: ReactNode;
  className?: string;
  level?: HeadingLevel;
  gradient?: GradientType | null;
  cosmic?: boolean;
  modalHeader?: boolean;
  id?: string;
  [key: string]: any;
}

/**
 * CosmicHeading - Semantic heading component with cosmic theme
 * 
 * Features:
 * - Semantic HTML (h1-h6)
 * - Gradient text effects
 * - Design system integration
 * - Accessibility-first
 * - Performance optimized
 * 
 * @component
 * @example
 * <CosmicHeading level={1}>Main Title</CosmicHeading>
 * <CosmicHeading level={2} gradient="gold">Section Title</CosmicHeading>
 * <CosmicHeading cosmic>Special Cosmic Title</CosmicHeading>
 */
const CosmicHeading: FC<CosmicHeadingProps> = ({
  children,
  className = '',
  level = 1,
  gradient = null,
  cosmic = false,
  modalHeader = false,
  id,
  ...props
}) => {
  // Ensure valid heading level
  const validLevel = Math.min(Math.max(1, level), 6) as HeadingLevel;
  const Tag = `h${validLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

  // Build className
  const classNames = [
    styles.heading,
    styles[`level${validLevel}`],
    cosmic && styles.cosmic,
    modalHeader && styles.modalHeader,
    gradient && styles[`gradient${gradient.charAt(0).toUpperCase() + gradient.slice(1)}`],
    className
  ].filter(Boolean).join(' ');

  return React.createElement(
    Tag,
    {
      id,
      className: classNames,
      ...props
    },
    children
  );
};

export default CosmicHeading;