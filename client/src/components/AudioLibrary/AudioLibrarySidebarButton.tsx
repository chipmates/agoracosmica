import React, { FC, useState, MouseEvent as ReactMouseEvent, RefObject } from 'react';
import AudioLibraryModal from './AudioLibraryModal';
import OptimizedImage from '../OptimizedImage';
import useTranslation from '../../hooks/useTranslation';
import { Figure } from '../../types/global';

interface AudioLibrarySidebarButtonProps {
  selectedFigure?: Figure | null;
  isHovered?: boolean;
  onMouseMove?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  buttonRef?: RefObject<HTMLButtonElement>;
  onButtonClick?: () => void;
}

/**
 * Sidebar button for Audio Library
 * Replaces the floating button in the new navigation system
 * Uses liquid glass design and magnetic hover effects
 */
export const AudioLibrarySidebarButton: FC<AudioLibrarySidebarButtonProps> = ({ 
  selectedFigure,
  isHovered,
  onMouseMove,
  onMouseLeave,
  buttonRef,
  onButtonClick 
}) => {
  const { t, tString } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = (): void => {
    setIsModalOpen(true);
    if (onButtonClick) onButtonClick();
  };

  return (
    <>
      <button
        ref={buttonRef}
        className="nav-button"
        onClick={handleClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        aria-label={tString('audioLibrary.title', 'Audio Library')}
      >
        <div className="button-frame">
          <OptimizedImage 
            src="library"
            type="ui"
            purpose="icon"
            priority={true}
            className={`button-icon ${isHovered ? 'hover' : ''}`}
            alt="Audio Library"
          />
        </div>
      </button>
      
      {isModalOpen && (
        <AudioLibraryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          selectedFigure={selectedFigure}
        />
      )}
    </>
  );
};