// src/components/LoginContainer.tsx
//
// Cinematic entry: no brand header anymore (wordmark, tagline, trust band all
// live on the homepage + the welcome step). The container just frames the
// portal, which carries the whole "Vorspann".
import { forwardRef, ReactNode } from 'react';
import './LoginContainer.css';
import PerfectPortal from './PerfectPortal';

interface LoginContainerProps {
  isFormVisible: boolean;
  handlePortalClick: () => void;
  children: ReactNode;
  loginSuccessful?: boolean;
}

const LoginContainer = forwardRef<HTMLDivElement, LoginContainerProps>(
  ({ isFormVisible, handlePortalClick, children, loginSuccessful = false }, ref) => {
    return (
      <div className="login-content">
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
