import React, { FC, ReactNode, useState, useRef, useEffect } from 'react';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import styles from './CollapsibleSection.module.css';

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  description?: string;
  showBadge?: boolean;
  badgeText?: string;
  className?: string;
}

/**
 * CollapsibleSection - A beautiful accordion-style collapsible section
 * with smooth animations and modern design
 * 
 * @param {Object} props
 * @param {string} props.title - Section title
 * @param {ReactNode} props.icon - Icon component for the section
 * @param {ReactNode} props.children - Content to show when expanded
 * @param {boolean} props.defaultExpanded - Whether section starts expanded
 * @param {string} props.description - Optional description text
 * @param {boolean} props.showBadge - Show a badge for active settings
 * @param {string} props.badgeText - Text to show in badge
 */
const CollapsibleSection: FC<CollapsibleSectionProps> = ({
  title,
  icon,
  children,
  defaultExpanded = false,
  description,
  showBadge = false,
  badgeText = '',
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Measure content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        setContentHeight(contentRef.current?.scrollHeight || 0);
      });
      
      resizeObserver.observe(contentRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [children]);
  
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };
  
  return (
    <div className={`${styles.section} ${className}`}>
      <button
        className={`${styles.header} ${isExpanded ? styles.expanded : ''}`}
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-controls={`section-${title}`}
      >
        <div className={styles.headerLeft}>
          <div className={styles.iconWrapper}>
            {icon}
          </div>
          <div className={styles.titleWrapper}>
            <h3 className={styles.title}>{title}</h3>
            {description && !isExpanded && (
              <p className={styles.description}>{description}</p>
            )}
          </div>
        </div>
        
        <div className={styles.headerRight}>
          {showBadge && badgeText && (
            <span className={styles.badge}>{badgeText}</span>
          )}
          <div className={`${styles.chevron} ${isExpanded ? styles.rotated : ''}`}>
            {isExpanded ? <CaretDown size={20} /> : <CaretRight size={20} />}
          </div>
        </div>
      </button>
      
      <div
        id={`section-${title}`}
        className={styles.contentWrapper}
        style={{
          height: isExpanded ? contentHeight : 0,
          opacity: isExpanded ? 1 : 0
        }}
        aria-hidden={!isExpanded}
      >
        <div ref={contentRef} className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;