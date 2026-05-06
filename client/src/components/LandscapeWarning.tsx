// src/components/LandscapeWarning.tsx
import React, { FC } from 'react';
import './LandscapeWarning.css';
import { useTranslation } from '../hooks/useTranslation';

/**
 * LandscapeWarning Component
 * 
 * Simple warning shown when device is in landscape orientation.
 * 
 * @returns {JSX.Element} Warning message for landscape orientation
 */
const LandscapeWarning: FC = () => {
  const { tNode } = useTranslation();

  return (
    <div className="landscape-warning">
      <div className="warning-text">
        {tNode('device.landscapeWarning')}
      </div>
    </div>
  );
};

export default LandscapeWarning;