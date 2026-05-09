import { FC } from 'react';
import './CosmicLogo.css';

interface CosmicLogoProps {
  className?: string;
}

/**
 * CosmicLogo Component — Eclipse variant (brand logo 2026)
 *
 * Radial-gradient dot with subtle glow halos.
 * Each usage context controls its own size and animation.
 */
const CosmicLogo: FC<CosmicLogoProps> = ({ className = '' }) => (
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
    className={`cosmic-logo ${className}`}
  >
    <defs>
      <radialGradient id="cosmicDotGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="var(--gold-light, #f8e696)" />
        <stop offset="40%" stopColor="var(--gold-subtle, #e6bc5c)" />
        <stop offset="100%" stopColor="var(--gold-deep, #be9b37)" />
      </radialGradient>
      <filter id="cosmicRingGlow" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="2" />
      </filter>
      <filter id="cosmicDotGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>
    {/* Ring glow halo */}
    <circle cx="100" cy="100" r="76" fill="none" stroke="var(--gold-subtle, #e6bc5c)" strokeWidth="7" opacity="0.15" filter="url(#cosmicRingGlow)" />
    {/* Ring */}
    <circle cx="100" cy="100" r="76" fill="none" stroke="var(--gold-subtle, #e6bc5c)" strokeWidth="3.5" />
    {/* Dot glow halo */}
    <circle cx="100" cy="100" r="31" fill="var(--gold-subtle, #e6bc5c)" opacity="0.12" filter="url(#cosmicDotGlow)" />
    {/* Dot with radial gradient */}
    <circle cx="100" cy="100" r="31" fill="url(#cosmicDotGrad)" />
  </svg>
);

export default CosmicLogo;