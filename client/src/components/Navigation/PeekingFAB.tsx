import React, { FC, useState, useEffect, useRef, TouchEvent, MouseEvent, KeyboardEvent } from 'react';
import { List } from '@phosphor-icons/react';
import useTranslation from '../../hooks/useTranslation';
import './PeekingFAB.css';

type FABState = 'hidden' | 'peeking' | 'visible' | 'attention';

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

/**
 * PeekingFAB - Revolutionary mobile navigation component
 * Combines edge hint, navigation trigger, and profile display
 * Uses spring physics for natural interaction
 */
export const PeekingFAB: FC<PeekingFABProps> = ({ 
  user, 
  onMenuOpen, 
  isMenuOpen,
  isVisible = true 
}) => {
  const { t, tString, tNode } = useTranslation();
  // Lock first-time status at mount so localStorage flips mid-session don't cause UI flicker
  const isFirstTimeRef = useRef<boolean>(localStorage.getItem('fabDiscovered') !== 'true');
  const [state, setState] = useState<FABState>('peeking'); // Start in peeking state to be more visible
  const [showHint, setShowHint] = useState<boolean>(isFirstTimeRef.current);
  const [position, setPosition] = useState(-16); // Start partially visible
  const [isDragging, setIsDragging] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const fabRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const idleTimer = useRef<NodeJS.Timeout | null>(null);
  const attentionTimer = useRef<NodeJS.Timeout | null>(null);
  const hintTimer = useRef<NodeJS.Timeout | null>(null);
  const hasInteracted = useRef(false);

  // Check if user has discovered FAB before
  const hasDiscovered = (): boolean => localStorage.getItem('fabDiscovered') === 'true';

  // First-time users see the "Tap for menu" hint immediately on mount, fading after 5s
  useEffect(() => {
    if (!isFirstTimeRef.current) return;
    if (isMenuOpen || !isVisible) return;
    hintTimer.current = setTimeout(() => setShowHint(false), 5000);
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, [isMenuOpen, isVisible]);

  // FAB stays at peeking always (no hide-on-activity) — older users keep object permanence.
  // First-time users still get an attention bounce after ~60s idle if they haven't tapped.
  useEffect(() => {
    if (isMenuOpen || !isVisible) return;
    if (hasDiscovered()) return;

    idleTimer.current = setTimeout(() => {
      if (hasInteracted.current) return;
      attentionTimer.current = setTimeout(() => {
        if (!hasInteracted.current) setState('attention');
      }, 30000);
    }, 30000);

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (attentionTimer.current) clearTimeout(attentionTimer.current);
    };
  }, [isMenuOpen, isVisible]);
  
  // Handle touch interactions
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>): void => {
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setIsDragging(false);
    
    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      // Could show quick actions menu here
    }, 500);
  };
  
  const handleTouchMove = (e: TouchEvent<HTMLDivElement>): void => {
    if (touchStartX === null) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    
    // Start dragging if moved enough
    if (Math.abs(deltaX) > 5) {
      setIsDragging(true);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
      
      // Update position with bounds
      const newPosition = Math.max(-28, Math.min(56, -28 + deltaX));
      setPosition(newPosition);
    }
  };
  
  const handleTouchEnd = (_e: TouchEvent<HTMLDivElement>): void => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    if (isDragging) {
      // Magnetic snap points
      if (position > 30) {
        // Snap open sidebar
        onMenuOpen();
        setPosition(-28);
        setState('hidden');
      } else if (position > -20) {
        // Snap to visible
        setPosition(0);
        setState('visible');
      } else {
        // Snap to hidden
        setPosition(-28);
        setState('hidden');
      }
    } else {
      // It was a tap
      handleTap();
    }
    
    setTouchStartX(null);
    setIsDragging(false);
  };
  
  const handleTap = (): void => {
    hasInteracted.current = true;

    // Clear the persistent first-run hint and mark the FAB as discovered
    if (!hasDiscovered()) {
      setShowHint(false);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      localStorage.setItem('fabDiscovered', 'true');
    }

    onMenuOpen();
  };

  // Default content is the universal hamburger icon — most reliable cue for older
  // users who scan the screen for "menu". Avatars are honored when explicitly set.
  const getDisplayContent = (): React.ReactElement => {
    if (user?.avatar) {
      return <img src={user.avatar} alt={user.name || 'User'} className="peeking-fab-avatar" />;
    }
    return <List size={22} weight="bold" className="peeking-fab-icon" aria-hidden="true" />;
  };
  
  // Hide when menu is open
  if (isMenuOpen || !isVisible) return null;
  
  return (
    <div
      ref={fabRef}
      className={`peeking-fab ${state} ${isDragging ? 'dragging' : ''}`}
      style={{ transform: `translateX(${position}px) translateY(-50%)` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => !('ontouchstart' in window) && handleTap()}
      role="button"
      aria-label={tString('navigation.openMenu', 'Open menu')}
      aria-expanded={isMenuOpen}
      aria-controls="navigation"
      tabIndex={0}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleTap();
        }
      }}
    >
      <div className="peeking-fab-content">
        {getDisplayContent()}
      </div>

      {showHint && (
        <div className="peeking-fab-hint visible" role="status">
          {tNode('navigation.swipeForMenu')}
        </div>
      )}
    </div>
  );
};