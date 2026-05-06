// src/components/CosmicBackground.tsx
import React, { FC } from 'react';
import './CosmicBackground.css';
import OccasionalMeteors from './OccasionalMeteors';
import ParticleEffect from './ParticleEffect';
import HorizonDore from './HorizonDore';
import HistoricalFigures from './HistoricalFigures';

/**
 * CosmicBackground Component
 * 
 * Renders a cosmic background for the login page.
 * ParticleEffect renders dynamic stars for all devices (desktop and mobile).
 * 
 * Safari browsers get the star animations but mouse trail particles are
 * disabled for performance reasons. All other browsers get the full
 * interactive experience with both stars and mouse particles.
 */
interface CosmicBackgroundProps {
  hideMeteors?: boolean;
}

const CosmicBackground: FC<CosmicBackgroundProps> = ({ hideMeteors = false }) => {
  return (
    <>
      {/* For all devices: Interactive particle effect with canvas */}
      <ParticleEffect />

      {/* Occasional meteor effects - just a few meteors */}
      {!hideMeteors && <OccasionalMeteors />}
      
      {/* Doré Paradiso horizon — rocky outcrop with two hooded figures */}
      <HorizonDore />
      
      {/* Historical figures approaching the portal */}
      <HistoricalFigures />
    </>
  );
};

export default CosmicBackground;