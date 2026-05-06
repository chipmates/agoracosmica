/**
 * OrientationLock Component
 *
 * Displays an overlay when device is in landscape mode on mobile/tablet.
 * Asks users to rotate to portrait for optimal experience.
 *
 * Implementation: CSS-based detection for maximum compatibility
 */

import React from 'react';
import { useTranslation } from '../hooks/useTranslation';
import './OrientationLock.css';

export const OrientationLock: React.FC = () => {
  const { tString } = useTranslation();

  return (
    <div className="orientation-lock-overlay" aria-live="polite">
      <div className="orientation-lock-content">
        {/* Rotate phone icon */}
        <svg
          className="orientation-lock-icon"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 16L9 13M12 16L15 13M12 16V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        <h2 className="orientation-lock-title">{tString('orientation.title', 'Please Rotate Your Device')}</h2>
        <p className="orientation-lock-message">
          {tString('orientation.message', 'This app is optimized for portrait mode')}
        </p>
      </div>
    </div>
  );
};
