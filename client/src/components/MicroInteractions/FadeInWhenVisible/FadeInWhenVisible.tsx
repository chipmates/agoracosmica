import React, { FC, useState, useEffect, useRef, ReactNode, CSSProperties } from 'react';
import styles from './FadeInWhenVisible.module.css';

interface FadeInWhenVisibleProps {
  children: ReactNode;
  className?: string;
  threshold?: number;
  delay?: number;
  rootMargin?: string;
  style?: CSSProperties;
}

/**
 * FadeInWhenVisible - Reveals content when it enters the viewport
 * 
 * Features:
 * - IntersectionObserver for performance
 * - Configurable threshold and delay
 * - Respects prefers-reduced-motion
 * - One-time animation (doesn't repeat)
 * - Optimized with will-change
 * 
 * @component
 * @example
 * <FadeInWhenVisible>
 *   <Card>Content appears smoothly</Card>
 * </FadeInWhenVisible>
 * 
 * <FadeInWhenVisible delay={200} threshold={0.5}>
 *   <div>Appears when 50% visible with 200ms delay</div>
 * </FadeInWhenVisible>
 */
const FadeInWhenVisible: FC<FadeInWhenVisibleProps> = ({ 
  children, 
  className = '', 
  threshold = 0.1, 
  delay = 0,
  rootMargin = '0px',
  style,
  ...props 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Already revealed — no observer needed
    if (isVisible) return;

    // Check if IntersectionObserver is supported
    if (!('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Add delay if specified
          if (delay > 0) {
            timeoutRef.current = setTimeout(() => {
              setIsVisible(true);
            }, delay);
          } else {
            setIsVisible(true);
          }

          // Disconnect after animation triggers (one-time effect)
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin
      }
    );

    const element = elementRef.current;
    if (element) {
      observer.observe(element);
    }

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      observer.disconnect();
    };
  }, [threshold, rootMargin, delay, isVisible]);
  
  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  
  const classNames = [
    styles.fadeInElement,
    isVisible && styles.isVisible,
    prefersReducedMotion && styles.reducedMotion,
    className
  ].filter(Boolean).join(' ');
  
  return (
    <div 
      ref={elementRef}
      className={classNames}
      style={{ 
        '--fade-delay': `${delay}ms`,
        ...style 
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </div>
  );
};

export default FadeInWhenVisible;