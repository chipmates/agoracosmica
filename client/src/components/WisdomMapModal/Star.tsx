// Star.tsx - Individual star component for the constellation map
import { FC, CSSProperties, useState, useRef, useEffect } from 'react';
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
  /** Celestial Atlas mode: engraved SVG star states instead of the CSS glow. */
  atlas?: boolean;
  /** One-shot gilding animation right after a bloom is witnessed. */
  isNova?: boolean;
  onClick: (seed: Seed) => void;
}

/* ------------------------------------------------------------------
   Engraved star geometry, ported 1:1 from the Celestial Atlas
   prototype (proto-b renderStar): dotted surveyor circle with four
   hairline ticks for the ungathered, then the gilding ladder —
   point, rays, halo, breathing gold leaf.
   ------------------------------------------------------------------ */

const ray = (
  angle: number,
  r0: number,
  r1: number,
  stroke: string,
  strokeWidth: number,
  key: string,
  nova: boolean,
  novaIndex: number
) => {
  const a = (angle * Math.PI) / 180;
  const len = r1 - r0;
  return (
    <line
      key={key}
      x1={Math.cos(a) * r0}
      y1={Math.sin(a) * r0}
      x2={Math.cos(a) * r1}
      y2={Math.sin(a) * r1}
      className={`as-ray ${nova ? 'as-ray-nova' : ''}`}
      stroke={stroke}
      strokeWidth={strokeWidth}
      style={
        nova
          ? ({
              '--ray-len': `${len}px`,
              animationDelay: `${260 + novaIndex * 45}ms`,
            } as CSSProperties)
          : undefined
      }
    />
  );
};

const AtlasStarVisual: FC<{
  level: number;
  isNext: boolean;
  isSelected: boolean;
  isNova: boolean;
  nextLabel: string;
}> = ({
  level,
  isNext,
  isSelected,
  isNova,
  nextLabel,
}) => {
  const gradId = `asCore${level}`;
  let novaRay = 0;
  const nextRay = () => novaRay++;

  return (
    <svg
      className="atlas-star-svg"
      viewBox="-32 -32 64 64"
      width="64"
      height="64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={gradId}>
          <stop offset="0%" stopColor="#FFE9A8" />
          <stop offset="55%" stopColor="#E6BC5C" />
          <stop offset="100%" stopColor="#D4A539" />
        </radialGradient>
        <radialGradient id="asGlow">
          <stop offset="0%" stopColor="rgba(255, 215, 0, 0.55)" />
          <stop offset="45%" stopColor="rgba(230, 188, 92, 0.18)" />
          <stop offset="100%" stopColor="rgba(230, 188, 92, 0)" />
        </radialGradient>
      </defs>

      {/* selection and next markers, engraved */}
      {isSelected && <circle r={16} className="as-selected-ring" />}
      {isNext && level === 0 && (
        <g className="as-next">
          <circle r={24} className="as-next-ring" />
          <line x1={18} y1={-18} x2={34} y2={-34} className="as-next-leader" />
          <text x={38} y={-38} className="as-next-label">
            {nextLabel}
          </text>
        </g>
      )}

      {level === 0 && (
        <g>
          <circle r={8} className="as-dotted" />
          {[0, 90, 180, 270].map((a) => {
            const rd = (a * Math.PI) / 180;
            return (
              <line
                key={a}
                x1={Math.cos(rd) * 11.5}
                y1={Math.sin(rd) * 11.5}
                x2={Math.cos(rd) * 15.5}
                y2={Math.sin(rd) * 15.5}
                className="as-tick"
              />
            );
          })}
          <circle r={1.9} className="as-ink-core" />
        </g>
      )}

      {level === 1 && (
        <g>
          <circle
            r={7.5}
            className="as-ring"
            stroke="color-mix(in srgb, var(--gold-deep) 55%, transparent)"
          />
          <circle r={3.2} fill="var(--gold-subtle)" className={`as-core ${isNova ? 'as-core-nova' : ''}`} />
        </g>
      )}

      {level === 2 && (
        <g>
          <circle
            r={8.5}
            className="as-ring"
            stroke="color-mix(in srgb, var(--gold-deep) 60%, transparent)"
          />
          {[0, 90, 180, 270].map((a) =>
            ray(a, 8, 17, 'color-mix(in srgb, var(--gold-subtle) 75%, transparent)', 1, `r${a}`, isNova, nextRay())
          )}
          <circle r={4.2} fill="var(--gold-subtle)" className={`as-core ${isNova ? 'as-core-nova' : ''}`} />
        </g>
      )}

      {level === 3 && (
        <g>
          <circle r={18} fill="url(#asGlow)" className="as-soft-glow" />
          <circle
            r={11}
            className="as-halo"
            stroke="color-mix(in srgb, var(--gold-primary) 35%, transparent)"
          />
          {[0, 90, 180, 270].map((a) =>
            ray(a, 9, 21, 'color-mix(in srgb, var(--gold-primary) 85%, transparent)', 1.1, `r${a}`, isNova, nextRay())
          )}
          {[45, 135, 225, 315].map((a) =>
            ray(a, 8, 15, 'color-mix(in srgb, var(--gold-subtle) 60%, transparent)', 0.9, `d${a}`, isNova, nextRay())
          )}
          <circle r={5.2} fill="var(--gold-primary)" className={`as-core ${isNova ? 'as-core-nova' : ''}`} />
        </g>
      )}

      {level >= 4 && (
        <g>
          <circle r={27} fill="url(#asGlow)" className="as-breathe" />
          <circle
            r={12.5}
            className="as-halo"
            stroke="color-mix(in srgb, var(--gold-primary) 48%, transparent)"
          />
          <circle
            r={17.5}
            className="as-halo"
            stroke="color-mix(in srgb, var(--gold-deep) 32%, transparent)"
          />
          {[0, 90, 180, 270].map((a) =>
            ray(a, 10, 27, 'color-mix(in srgb, var(--gold-primary) 92%, transparent)', 1.15, `r${a}`, isNova, nextRay())
          )}
          {[45, 135, 225, 315].map((a) =>
            ray(a, 9, 18, 'color-mix(in srgb, var(--gold-subtle) 70%, transparent)', 0.95, `d${a}`, isNova, nextRay())
          )}
          <circle r={6.4} fill={`url(#${gradId})`} className={`as-core ${isNova ? 'as-core-nova' : ''}`} />
        </g>
      )}
    </svg>
  );
};

const Star: FC<StarProps> = ({
  seed,
  position,
  symbolicMeaning,
  mainStar = false,
  constellationPoint = false,
  isNextSeed = false,
  isSelected = false,
  level = 0,
  atlas = false,
  isNova = false,
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

      // Calculate initial position (centered above)
      let x = rect.left + rect.width / 2;
      let y = rect.top;
      let placement: 'top' | 'bottom' = 'top';
      let align: 'left' | 'center' | 'right' = 'center';

      // Check vertical bounds - if tooltip would go off top OR overlap with header, place it below
      const spaceAbove = rect.top - headerHeight;

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
  
  // Atlas mode: display level folds `gathered` in, so a gathered seed with
  // no bloom progress still reads as first gilding rather than construction.
  const atlasLevel = Math.max(level, seed.gathered ? 1 : 0);

  return (
    <>
      <div
        ref={starRef}
        className={
          atlas
            ? `star atlas-star as-lv${atlasLevel} ${nextSeedClass} ${selectedClass} ${isNova ? 'is-nova' : ''}`
            : `star ${seed.gathered ? 'gathered' : ''} ${level > 0 ? `bloom-level bloom-level-${level}` : ''} ${mainStarClass} ${constellationClass} ${nextSeedClass} ${selectedClass}`
        }
        style={starStyle}
        onClick={() => onClick(seed)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick(seed)}
        onMouseEnter={isHoverCapable ? () => setIsHovered(true) : undefined}
        onMouseLeave={isHoverCapable ? () => setIsHovered(false) : undefined}
        role="button"
        tabIndex={0}
        aria-label={`${seedId}. ${seedTitle} - ${statusText}`}
      >
        {atlas ? (
          <AtlasStarVisual
            level={atlasLevel}
            isNext={isNextSeed}
            isSelected={isSelected}
            isNova={isNova}
            nextLabel={tString('wisdomAtlas.next', 'next')}
          />
        ) : (
          <>
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
          </>
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
          {symbolicMeaning && !symbolicMeaning.includes('.') && symbolicMeaning !== seedTitle && (
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