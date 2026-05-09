import { FC, useState, MouseEvent as ReactMouseEvent, RefObject } from 'react';
import { createPortal } from 'react-dom';
import WisdomMapModal from './index';
import OptimizedImage from '../OptimizedImage';
import useTranslation from '../../hooks/useTranslation';
import { Figure } from '../../types/global';

interface WisdomSidebarButtonProps {
  selectedFigure?: Figure | null;
  isHovered?: boolean;
  onMouseMove?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  buttonRef?: RefObject<HTMLButtonElement>;
  onButtonClick?: () => void;
}

/**
 * Sidebar button for Wisdom Hub (WisdomMapModal)
 * Self-contained component managing its own modal state.
 * Follows the AudioLibrarySidebarButton pattern.
 */
export const WisdomSidebarButton: FC<WisdomSidebarButtonProps> = ({
  selectedFigure,
  isHovered,
  onMouseMove,
  onMouseLeave,
  buttonRef,
  onButtonClick
}) => {
  const { tString } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = (): void => {
    setIsModalOpen(true);
    if (onButtonClick) onButtonClick();
  };

  const handleSeedSelect = (seed: any, mode?: string): void => {
    // Use the same global pattern as FigureCarousel
    if (window.handleSeedSelect) {
      window.handleSeedSelect(seed, mode);
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        className="nav-button"
        onClick={handleClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        aria-label={tString('navigation.wisdom', 'Wisdom')}
      >
        <div className="button-frame">
          <OptimizedImage
            src="paths"
            type="ui"
            purpose="icon"
            priority={true}
            className={`button-icon ${isHovered ? 'hover' : ''}`}
            alt="Wisdom"
          />
        </div>
      </button>

      {isModalOpen && createPortal(
        <WisdomMapModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          selectedFigure={selectedFigure || null}
          defaultView="map"
          showSelectButton={true}
          onSeedSelect={handleSeedSelect}
          isForSeedConversation
        />,
        document.body
      )}
    </>
  );
};
