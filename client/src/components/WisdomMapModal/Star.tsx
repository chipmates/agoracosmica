// Star.tsx - Individual star component for the constellation map
import React, { FC, CSSProperties, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './css/Star.css';
import useTranslation from '../../hooks/useTranslation';
import useSeedTranslation from '../../hooks/useSeedTranslation';

interface Seed {
  id: string | number;
  title: string;
  gathered?: boolean;
  [key: string]: any;
}

interface Position extends CSSProperties {
  animationDelay?: string;
}

interface StarProps {
  seed: Seed;
  position: Position | null;
  symbolicMeaning?: string;
  mainStar?: boolean;
  constellationPoint?: boolean;
  isNextSeed?: boolean;
  isSelected?: boolean;
  level?: number;
  onClick: (seed: Seed) => void;
}

const Star: FC<StarProps> = ({
  seed,
  position,
  symbolicMeaning,
  mainStar = false,
  constellationPoint = false,
  isNextSeed = false,
  isSelected = false,
  level = 0,
  onClick
}) => {
  const { tString } = useTranslation();
  const { getTranslatedSeedTitle } = useSeedTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0, placement: 'top' as 'top' | 'bottom', align: 'center' as 'left' | 'center' | 'right' });
  const starRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // 2025 MOBILE UX: Disable hover tooltips on touch devices (redundant, tap opens directly)
  const [isHoverCapable, setIsHoverCapable] = useState(true);

  useEffect(() => {
    // Check if device supports hover (desktop) vs touch-only (mobile/tablet)
    const hasHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    setIsHoverCapable(hasHover);
  }, []);

  useEffect(() => {
    if (isHovered && starRef.current) {
      const rect = starRef.current.getBoundingClientRect();
      const tooltipWidth = 350; // Max tooltip width from CSS
      const tooltipHeight = 150; // Conservative estimate including padding and multi-line text
      const gap = 16; // Gap between star and tooltip
      const headerHeight = 80; // Approximate header/controls height

      // Viewport boundaries
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate initial position (centered above)
      let x = rect.left + rect.width / 2;
      let y = rect.top;
      let placement: 'top' | 'bottom' = 'top';
      let align: 'left' | 'center' | 'right' = 'center';

      // Check vertical bounds - if tooltip would go off top OR overlap with header, place it below
      const spaceAbove = rect.top - headerHeight;
      const spaceBelow = viewportHeight - rect.bottom;

      if (spaceAbove < tooltipHeight + gap || rect.top - tooltipHeight - gap < headerHeight) {
        // Not enough space above or would overlap header - place below
        placement = 'bottom';
        y = rect.bottom;
      }

      // Check horizontal bounds - adjust alignment if needed
      const tooltipLeft = x - tooltipWidth / 2;
      const tooltipRight = x + tooltipWidth / 2;

      if (tooltipLeft < 8) {
        // Too far left - align to left edge
        align = 'left';
        x = rect.left;
      } else if (tooltipRight > viewportWidth - 8) {
        // Too far right - align to right edge
        align = 'right';
        x = rect.right;
      }

      setTooltipPosition({ x, y, placement, align });
    }
  }, [isHovered]);
  
  if (!position) return null;
  
  // Get translated seed title
  const translatedTitle = getTranslatedSeedTitle(seed) || seed.title;
  
  // Define classNames based on seed state
  const mainStarClass = mainStar ? 'main-star' : '';
  const constellationClass = constellationPoint ? 'constellation-point' : '';
  const nextSeedClass = isNextSeed ? 'next-seed' : '';
  const selectedClass = isSelected ? 'star-selected' : '';
  
  // Get status text
  const statusText = seed.gathered ?
    tString('seeds.constellation.elements.items.gathered.title', 'Gathered') :
    tString('seeds.constellation.elements.items.future.title', 'Not yet gathered');
  
  const starStyle: CSSProperties = {
    ...position,
    animationDelay: position?.animationDelay,
    willChange: 'transform, box-shadow'
  };
  
  const seedId = String(seed.id).includes('-') ? String(seed.id).split('-')[1] : String(seed.id);
  const seedTitle = translatedTitle.includes(' - ') ? translatedTitle.split(' - ')[1] : translatedTitle;
  
  return (
    <>
      <div
        ref={starRef}
        className={`star ${seed.gathered ? 'gathered' : ''} ${level > 0 ? `bloom-level bloom-level-${level}` : ''} ${mainStarClass} ${constellationClass} ${nextSeedClass} ${selectedClass}`}
        style={starStyle}
        onClick={() => onClick(seed)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick(seed)}
        onMouseEnter={isHoverCapable ? () => setIsHovered(true) : undefined}
        onMouseLeave={isHoverCapable ? () => setIsHovered(false) : undefined}
        role="button"
        tabIndex={0}
        aria-label={`${seedId}. ${seedTitle} - ${statusText}`}
      >
        {/* Ripple effect container for animation */}
        <div className="star-ripple-container"></div>
        
        {/* Radiating golden circles for selected seed */}
        {isSelected && (
          <div className="radiate-container">
            <div className="radiate-ring"></div>
            <div className="radiate-ring"></div>
            <div className="radiate-ring"></div>
          </div>
        )}
      </div>
      
      {/* Render tooltip through portal - desktop only (mobile uses direct tap) */}
      {isHoverCapable && isHovered && createPortal(
        <div
          ref={tooltipRef}
          className={`star-tooltip-portal ${seed.gathered ? 'gathered' : ''}`}
          style={{
            position: 'fixed',
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform:
              tooltipPosition.align === 'left'
                ? (tooltipPosition.placement === 'top' ? 'translateY(calc(-100% - 16px))' : 'translateY(16px)')
                : tooltipPosition.align === 'right'
                ? (tooltipPosition.placement === 'top' ? 'translateX(-100%) translateY(calc(-100% - 16px))' : 'translateX(-100%) translateY(16px)')
                : (tooltipPosition.placement === 'top' ? 'translateX(-50%) translateY(calc(-100% - 16px))' : 'translateX(-50%) translateY(16px)'),
            zIndex: 10000, // Very high z-index since it's at document root
          }}
        >
          <strong>
            {seedId}. {seedTitle}
          </strong>
          {symbolicMeaning && !symbolicMeaning.includes('.') && (
            <div className="tooltip-symbolism">
              <span>{tString('constellations.symbolizes', 'Symbolizes')}: {symbolicMeaning}</span>
            </div>
          )}
          <div className="tooltip-status">
            {statusText}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Star;