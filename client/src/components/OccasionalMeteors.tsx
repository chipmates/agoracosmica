import React, { FC, useEffect, useState, memo, CSSProperties } from 'react';
import './OccasionalMeteors.css';

interface MeteorOriginStyle extends CSSProperties {
  top?: string;
  left?: string;
}

interface MeteorConfig {
  id: string;
  origin: MeteorOriginStyle;
  delay: number;
  duration: number;
  angle: string;
  desktopOnly?: boolean;
}

interface OccasionalMeteorsProps {
  className?: string;
}

// Calm trajectories: Only top and left entry (never right/bottom for peace)
// Gentle angles: 35-45deg only (natural meteor fall)
// Contemplative durations: 12-15s (slow, meditative journey)
const METEORS: MeteorConfig[] = [
  // Top entry (falling down-right)
  { id: 't1', origin: { top: '-10%', left: '15%' }, delay: 5,  duration: 12, angle: '45deg' },
  { id: 't2', origin: { top: '-10%', left: '65%' }, delay: 20, duration: 13.5, angle: '45deg' },

  // Left side entry (grazers moving down-right)
  { id: 'l1', origin: { top: '25%', left: '-10%' }, delay: 12, duration: 15, angle: '45deg' },

  // Desktop only - Rare contemplative moments
  { id: 'l2', origin: { top: '55%', left: '-10%' }, delay: 35, duration: 13.5, angle: '45deg', desktopOnly: true },
  { id: 'g1', origin: { top: '70%', left: '-10%' }, delay: 50, duration: 15, angle: '35deg', desktopOnly: true }
];

interface MeteorCSSProps extends CSSProperties {
  '--angle': string;
  '--delay': string;
  '--duration': string;
}

const OccasionalMeteors: FC<OccasionalMeteorsProps> = memo(({ className = '' }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkDevice = (): void => setIsMobile(window.innerWidth <= 1024 || 'ontouchstart' in window);
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Mobile: Start immediately for instant delight
  const getDelay = (d: number): number => (isMobile ? 0 : d);

  return (
    <div className={`meteor-shower ${className}`} aria-hidden="true">
      {METEORS.map(m => {
        if (isMobile && m.desktopOnly) return null;

        const style: MeteorOriginStyle & MeteorCSSProps = {
          ...m.origin,
          '--angle': m.angle,
          '--delay': `${getDelay(m.delay)}s`,
          '--duration': `${m.duration}s`,
        };

        return (
          <div
            key={m.id}
            className="meteor"
            style={style}
          />
        );
      })}
    </div>
  );
});

OccasionalMeteors.displayName = 'OccasionalMeteors';

export default OccasionalMeteors;