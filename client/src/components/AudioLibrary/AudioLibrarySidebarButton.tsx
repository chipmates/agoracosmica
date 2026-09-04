import { FC, useState, useEffect, MouseEvent as ReactMouseEvent, RefObject } from 'react';
import AudioLibraryModal from './AudioLibraryModal';
import SidebarIcon from '../SidebarIcon';
import useTranslation from '../../hooks/useTranslation';
import { Figure } from '../../types/global';
import { AUDIO_LIBRARY_EVENT, consumeAudioLibraryRequest } from '../../utils/public/entryIntent';

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
  const { tString } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = (): void => {
    setIsModalOpen(true);
    if (onButtonClick) onButtonClick();
  };

  // An audio-library deep-link opens the same modal this button owns. Routing
  // releases the request only after the welcome step. The mount check covers a
  // release that lands before this listener exists; the request is one-shot
  // either way, so the library can never re-open on its own later.
  useEffect(() => {
    const open = (): void => {
      if (consumeAudioLibraryRequest()) setIsModalOpen(true);
    };
    open();
    window.addEventListener(AUDIO_LIBRARY_EVENT, open);
    return () => window.removeEventListener(AUDIO_LIBRARY_EVENT, open);
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        className="nav-button"
        onClick={handleClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        aria-label={tString('navigation.audioLibrary', 'Audio Library')}
      >
        <div className="button-frame">
          <SidebarIcon
          name="library"
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