// src/components/LoginContainer.tsx
import React, { forwardRef, ReactNode } from 'react';
import './LoginContainer.css';
import CosmicLogo from './CosmicLogo';
import PerfectPortal from './PerfectPortal';
import { useTranslation } from '../hooks/useTranslation';

interface LoginContainerProps {
  isFormVisible: boolean;
  handlePortalClick: () => void;
  children: ReactNode;
  loginSuccessful?: boolean;
}

const LoginContainer = forwardRef<HTMLDivElement, LoginContainerProps>(
  ({ isFormVisible, handlePortalClick, children, loginSuccessful = false }, ref) => {
    const { tNode } = useTranslation();

    return (
      <div className="login-content">
        {/* Header with integrated logo */}
        <div className={`login-header-group${loginSuccessful ? ' header-to-quote' : ''}`}>
          <h1 className="headline app-title">
            <span className="headline-text">{tNode('app.name')}</span>
            {/* Logo as child of text for bulletproof positioning */}
            <CosmicLogo className="headline-logo" />
          </h1>
          <p className="brand-tagline">{tNode('app.brandTagline')}</p>
        </div>
        
        {/* Perfect Portal with login form — unmount once rose takes over */}
        {!loginSuccessful && (
          <PerfectPortal
            ref={ref}
            isRevealed={isFormVisible}
            isUnrevealing={false}
            onPortalClick={handlePortalClick}
          >
            {children}
          </PerfectPortal>
        )}
      </div>
    );
  }
);

LoginContainer.displayName = 'LoginContainer';

export default LoginContainer;