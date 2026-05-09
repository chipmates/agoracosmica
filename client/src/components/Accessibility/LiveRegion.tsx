// src/components/Accessibility/LiveRegion.tsx
import { FC } from 'react';
import useLiveRegion from '../../hooks/accessibility/useLiveRegion';
import './LiveRegion.css';

type AriaLive = 'polite' | 'assertive' | 'off';

interface LiveRegionProps {
  priority?: AriaLive;
  atomic?: boolean;
  className?: string;
  id?: string;
}

/**
 * LiveRegion Component - 2025 State-of-the-Art Accessibility
 * 
 * Provides ARIA live region for screen reader announcements.
 * Completely invisible to sighted users but announces dynamic changes.
 * 
 * @param props - Component props
 * @param props.priority - 'polite' or 'assertive'
 * @param props.atomic - Whether to announce entire region
 * @param props.className - Additional CSS classes
 * @param props.id - Element ID
 * @returns JSX.Element Live region component
 */
const LiveRegion: FC<LiveRegionProps> = ({ 
  priority = 'polite',
  atomic = true,
  className = '',
  id = 'live-region'
}) => {
  const { currentAnnouncement, priority: currentPriority } = useLiveRegion();

  return (
    <div
      id={id}
      aria-live={currentPriority || priority}
      aria-atomic={atomic}
      aria-relevant="additions text"
      role="status"
      className={`live-region ${className}`}
    >
      {currentAnnouncement}
    </div>
  );
};

export default LiveRegion;