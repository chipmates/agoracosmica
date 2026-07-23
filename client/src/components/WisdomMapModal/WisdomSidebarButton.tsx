import { FC, MouseEvent as ReactMouseEvent, RefObject } from 'react';
import OptimizedImage from '../OptimizedImage';
import useTranslation from '../../hooks/useTranslation';
import { useUIStore } from '../../stores/uiStore';

interface WisdomSidebarButtonProps {
  isHovered?: boolean;
  onMouseMove?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  buttonRef?: RefObject<HTMLButtonElement>;
  onButtonClick?: () => void;
}

/**
 * Sidebar button for the Wisdom hub. Opens the ONE store-driven wisdom map
 * mount (SeedsModal in ModalsContainer) instead of carrying its own modal
 * instance and routing seed selection through the window bridge, which is
 * how this button worked before 2026-07-23. Seed selection now flows through
 * HomePage's handleSeedSelect prop binding like every other modal.
 */
export const WisdomSidebarButton: FC<WisdomSidebarButtonProps> = ({
  isHovered,
  onMouseMove,
  onMouseLeave,
  buttonRef,
  onButtonClick
}) => {
  const { tString } = useTranslation();
  const setSeedsModalOpen = useUIStore((s) => s.setSeedsModalOpen);

  const handleClick = (): void => {
    setSeedsModalOpen(true);
    if (onButtonClick) onButtonClick();
  };

  return (
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
  );
};
