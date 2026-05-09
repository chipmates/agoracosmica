// ListButton.tsx - Simple button to open SeedDetailView (List view)
import { FC } from 'react';
import { ListBullets } from '@phosphor-icons/react';
import './css/ListButton.css';
import { useTranslation } from '../../hooks/useTranslation';

interface ListButtonProps {
  onClick: () => void;
  isActive?: boolean;
  className?: string;
}

const ListButton: FC<ListButtonProps> = ({
  onClick,
  isActive = false,
  className = ''
}) => {
  const { tNode, tString } = useTranslation();

  const listLabel = tNode('seeds.viewModes.list') || 'List';
  const listAriaLabel = tString('seeds.viewModes.switchToList', 'Switch to list view');

  return (
    <button
      className={`list-view-button ${isActive ? 'active' : ''} ${className}`}
      onClick={onClick}
      aria-label={listAriaLabel}
      aria-pressed={isActive}
    >
      <ListBullets size={18} weight={isActive ? 'fill' : 'regular'} />
      <span className="button-label">{listLabel}</span>
    </button>
  );
};

export default ListButton;
