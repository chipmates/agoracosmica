// src/components/LoginContainer.tsx
import { forwardRef, ReactNode } from 'react';
import './LoginContainer.css';
import CosmicLogo from './CosmicLogo';
import PerfectPortal from './PerfectPortal';
import { useTranslation } from '../hooks/useTranslation';
import { isSelfHost } from '../config/deployment';

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
        {/* Org credit — tiny top line, pairs with the wordmark as a lockup */}
        <p className={`brand-credit${loginSuccessful ? ' header-to-quote' : ''}`}>{tNode('app.attribution')}</p>

        {/* Brand wordmark — docks just below the credit after the brand beat */}
        <div className={`login-header-group${loginSuccessful ? ' header-to-quote' : ''}`}>
          <h1 className="headline app-title">
            <span className="headline-text">{tNode('app.name')}</span>
            {/* Logo as child of text for bulletproof positioning */}
            <CosmicLogo className="headline-logo" />
          </h1>
          <p className="brand-tagline">{tNode('app.brandTagline')}</p>
        </div>

        {/* Working-state value statement — fills the band the wordmark vacates */}
        <div className={`intro-clarity${loginSuccessful ? ' header-to-quote' : ''}`}>
          <p className="intro-explainer">{tNode('entry.explainer')}</p>
          {!isSelfHost && <p className="intro-access">{tNode('entry.access')}</p>}
          <p className="intro-trust">{tNode('entry.trustLine')}</p>
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