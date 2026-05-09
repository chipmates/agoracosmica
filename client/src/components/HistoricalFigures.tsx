import { FC } from 'react';
import './HistoricalFigures.css';
import OptimizedImage from './OptimizedImage';

interface HistoricalFiguresProps {
  className?: string;
}

/**
 * HistoricalFigures Component
 * 
 * Renders silhouettes of historical figures arranged around a portal.
 * Includes a central cloaked figure and 8 additional historical figures.
 * Designed to create a cosmic gathering aesthetic.
 * 
 * @param {Object} props Component properties
 * @param {string} [props.className] Additional CSS class name
 * @returns {JSX.Element} Historical figures arranged around the portal
 */
const HistoricalFigures: FC<HistoricalFiguresProps> = ({ className = '' }) => {
  // 2025 ARCHITECTURE: Responsive height via vh units, OptimizedImage auto-dimensions
  // - height="calc(25vh)" → constrains container size (preserves composition)
  // - OptimizedImage provides width/height from metadata automatically
  // - CSS handles positioning and scaling via .historical-figure classes
  // - No imgProps needed - would conflict with responsive CSS

  const FIGURE_HEIGHT = 'calc(25vh)'; // Critical for maintaining figure composition

  return (
    <div className={`historical-figures-container ${className}`}>
      {/* Central hooded figure (numbered as 1) */}
      <div className="historical-figure figure-1">
        <OptimizedImage
          name="figure"
          height={FIGURE_HEIGHT}
          alt=""
          className="figure-image"
          priority={true}
        />
      </div>

      {/* Left side figures */}
      <div className="historical-figure figure-2">
        <OptimizedImage
          name="figure2"
          height={FIGURE_HEIGHT}
          alt="" aria-hidden="true" data-figure="2"
          className="figure-image"
          priority={true}
        />
      </div>

      <div className="historical-figure figure-4">
        <OptimizedImage
          name="figure4"
          height={FIGURE_HEIGHT}
          alt="" aria-hidden="true" data-figure="4"
          className="figure-image"
          priority={true}
        />
      </div>

      <div className="historical-figure figure-6">
        <OptimizedImage
          name="figure6"
          height={FIGURE_HEIGHT}
          alt="" aria-hidden="true" data-figure="6"
          className="figure-image"
          priority={true}
        />
      </div>

      <div className="historical-figure figure-8">
        <OptimizedImage
          name="figure8"
          height={FIGURE_HEIGHT}
          alt="" aria-hidden="true" data-figure="8"
          className="figure-image"
          priority={true}
        />
      </div>

      {/* Right side figures */}
      <div className="historical-figure figure-3">
        <OptimizedImage
          name="figure3"
          height={FIGURE_HEIGHT}
          alt="" aria-hidden="true" data-figure="3"
          className="figure-image"
          priority={true}
        />
      </div>

      <div className="historical-figure figure-5">
        <OptimizedImage
          name="figure5"
          height={FIGURE_HEIGHT}
          alt="" aria-hidden="true" data-figure="5"
          className="figure-image"
          priority={true}
        />
      </div>

      <div className="historical-figure figure-7">
        <OptimizedImage
          name="figure7"
          height={FIGURE_HEIGHT}
          alt="" aria-hidden="true" data-figure="7"
          className="figure-image"
          priority={true}
        />
      </div>

      <div className="historical-figure figure-9">
        <OptimizedImage
          name="figure9"
          height={FIGURE_HEIGHT}
          alt="" aria-hidden="true" data-figure="9"
          className="figure-image"
          priority={true}
        />
      </div>
    </div>
  );
};

export default HistoricalFigures;