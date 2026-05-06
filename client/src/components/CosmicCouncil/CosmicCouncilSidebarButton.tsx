import React, { FC, MouseEvent as ReactMouseEvent, RefObject } from 'react';
import OptimizedImage from '../OptimizedImage';
import useTranslation from '../../hooks/useTranslation';
import CosmicCouncilIntegration from './CosmicCouncilIntegration';
import { useUIStore } from '../../stores/uiStore';

interface Figure {
  name?: string;
  imageKey?: string;
  [key: string]: any;
}

interface CouncilConfig {
  participants?: any[];
  question?: string;
  [key: string]: any;
}

interface CosmicCouncilSidebarButtonProps {
  selectedFigure?: Figure | null;
  onCouncilStart?: (councilConfig: CouncilConfig) => Promise<void> | void;
  isHovered?: boolean;
  onMouseMove?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  buttonRef?: RefObject<HTMLButtonElement>;
  onButtonClick?: () => void;
}

/**
 * Sidebar button for Cosmic Council
 * Replaces the floating button in the new navigation system
 * Opens the council setup modal, then triggers council start
 */
export const CosmicCouncilSidebarButton: FC<CosmicCouncilSidebarButtonProps> = ({ 
  selectedFigure,
  onCouncilStart,
  isHovered,
  onMouseMove,
  onMouseLeave,
  buttonRef,
  onButtonClick 
}) => {
  const { t, tString } = useTranslation();
  // Modal-open state lives in uiStore so handleCouncilEnd in HomePage can
  // re-open the catalog after the council ends (returns user to council page,
  // not main page).
  const isModalOpen = useUIStore((s) => s.modals.councilSetupOpen);
  const setCouncilSetupOpen = useUIStore((s) => s.setCouncilSetupOpen);

  const handleClick = (): void => {
    setCouncilSetupOpen(true);
    if (onButtonClick) onButtonClick(); // Close sidebar
  };

  const handleModalClose = (): void => {
    setCouncilSetupOpen(false);
  };

  const handleCouncilStartWithConfig = async (councilConfig: CouncilConfig): Promise<void> => {
    // Close the modal first
    handleModalClose();
    
    // Call the parent handler with the config
    if (onCouncilStart) {
      await onCouncilStart(councilConfig);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        className="nav-button"
        onClick={handleClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        aria-label={tString('cosmicCouncil.title', 'Cosmic Council')}
      >
        <div className="button-frame">
          <OptimizedImage 
            src="council"
            type="ui"
            purpose="icon"
            priority={true}
            className={`button-icon ${isHovered ? 'hover' : ''}`}
            alt="Cosmic Council"
          />
        </div>
      </button>
      
      {/* Council Setup Modal */}
      <CosmicCouncilIntegration
        categoryModalOpen={isModalOpen}
        onCategoryModalClose={handleModalClose}
        onCouncilStart={handleCouncilStartWithConfig}
      />
    </>
  );
};