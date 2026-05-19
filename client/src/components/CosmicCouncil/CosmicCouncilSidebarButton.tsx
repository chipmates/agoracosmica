import { FC, MouseEvent as ReactMouseEvent, RefObject } from 'react';
import OptimizedImage from '../OptimizedImage';
import useTranslation from '../../hooks/useTranslation';
import CosmicCouncilIntegration from './CosmicCouncilIntegration';
import { useUIStore } from '../../stores/uiStore';
import { useDomainStore } from '../../stores/domainStore';

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
  onCouncilStart,
  isHovered,
  onMouseMove,
  onMouseLeave,
  buttonRef,
  onButtonClick
}) => {
  const { tString } = useTranslation();
  // Modal-open state lives in uiStore so handleCouncilEnd in HomePage can
  // re-open the catalog after the council ends (returns user to council page,
  // not main page).
  const isModalOpen = useUIStore((s) => s.modals.councilSetupOpen);
  const setCouncilSetupOpen = useUIStore((s) => s.setCouncilSetupOpen);
  const openWisdomGallery = useUIStore((s) => s.openWisdomGallery);

  const handleClick = (): void => {
    setCouncilSetupOpen(true);
    if (onButtonClick) onButtonClick(); // Close sidebar
  };

  const handleModalClose = (): void => {
    setCouncilSetupOpen(false);
  };

  // Dismissing the catalog (X, backdrop, Escape). A visitor who never picked
  // a figure (the theme-to-council deep-link case) is sent to the WisdomGallery
  // to choose a guide. A visitor who already has one just returns to the app.
  // Both updates batch in one handler, so no empty screen flashes between.
  const handleCatalogDismiss = (): void => {
    setCouncilSetupOpen(false);
    if (!useDomainStore.getState().figures.selectedId) {
      openWisdomGallery();
    }
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
        onCategoryModalClose={handleCatalogDismiss}
        onCouncilStart={handleCouncilStartWithConfig}
      />
    </>
  );
};