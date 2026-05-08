import React, { FC, useState, useEffect, useRef } from 'react';
import { List } from '@phosphor-icons/react';
import useTranslation from '../../hooks/useTranslation';
import './PeekingFAB.css';

interface User {
  name?: string;
  email?: string;
  avatar?: string;
}

interface PeekingFABProps {
  user?: User;
  onMenuOpen: () => void;
  isMenuOpen: boolean;
  isVisible?: boolean;
}

export const PeekingFAB: FC<PeekingFABProps> = ({
  user,
  onMenuOpen,
  isMenuOpen,
  isVisible = true,
}) => {
  const { tString } = useTranslation();
  const [showAttention, setShowAttention] = useState(false);
  const idleTimer = useRef<NodeJS.Timeout | null>(null);
  const hasInteracted = useRef(false);

  const hasDiscovered = (): boolean => localStorage.getItem('fabDiscovered') === 'true';

  useEffect(() => {
    if (isMenuOpen || !isVisible) return;
    if (hasDiscovered()) return;

    idleTimer.current = setTimeout(() => {
      if (!hasInteracted.current) setShowAttention(true);
    }, 60000);

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [isMenuOpen, isVisible]);

  const handleTap = (): void => {
    hasInteracted.current = true;
    setShowAttention(false);
    if (!hasDiscovered()) {
      localStorage.setItem('fabDiscovered', 'true');
    }
    onMenuOpen();
  };

  const renderContent = (): React.ReactElement => {
    if (user?.avatar) {
      return <img src={user.avatar} alt={user.name || 'User'} className="peeking-fab-avatar" />;
    }
    return <List size={22} weight="bold" className="peeking-fab-icon" aria-hidden="true" />;
  };

  if (isMenuOpen || !isVisible) return null;

  return (
    <button
      type="button"
      className={`peeking-fab${showAttention ? ' attention' : ''}`}
      onClick={handleTap}
      aria-label={tString('navigation.openMenu', 'Open menu')}
      aria-expanded={isMenuOpen}
      aria-controls="navigation"
    >
      <div className="peeking-fab-content">{renderContent()}</div>
    </button>
  );
};
