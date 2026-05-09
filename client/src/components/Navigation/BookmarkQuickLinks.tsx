import React, { FC, useState, CSSProperties } from 'react';
import { Scroll, Sparkle, Mountains, Bird, DiamondsFour, BookOpen } from '@phosphor-icons/react';
import { IconProps } from '@phosphor-icons/react';
import useTranslation from '../../hooks/useTranslation';
import './BookmarkQuickLinks.css';

type ConversationMode =
  | 'story'
  | 'introduction'
  | 'prism'
  | 'wisdom'
  | 'seed_conversation'
  | 'quest'
  | 'challenge'
  | 'freetalk'
  | 'free_conversation';

type ActionType = 'prism' | 'seeds' | 'quest' | 'freetalk' | 'story';
type BookmarkColor = 'gold' | 'purple' | 'orange' | 'green' | 'blue';
type BookmarkPosition = 'left' | 'right';

interface ModeAction {
  icon: React.ComponentType<IconProps>;
  label: string;
  shortLabel: string;
  action: ActionType;
  color: BookmarkColor;
}

interface Bookmark {
  id: string;
  icon: React.ComponentType<IconProps>;
  label: string;
  shortLabel: string;
  action: () => void;
  position: BookmarkPosition;
  color: BookmarkColor;
}

interface BookmarkQuickLinksProps {
  currentMode: ConversationMode;
  onActionClick: (action: ActionType) => void;
  onHistoryClick: () => void;
  isVisible?: boolean;
  className?: string;
}

/**
 * BookmarkQuickLinks - Beautiful bookmark-style navigation tabs
 * Attached to the right edge of the chat container
 * Space-efficient vertical design with 3D paper effect
 */
export const BookmarkQuickLinks: FC<BookmarkQuickLinksProps> = ({
  currentMode,
  onActionClick,
  onHistoryClick,
  isVisible = true,
  className = ''
}) => {
  const { tString } = useTranslation();
  const [hoveredBookmark, setHoveredBookmark] = useState<string | null>(null);
  const isMobile = window.innerWidth <= 767;
  const iconSize = isMobile ? 14 : 16;
  
  // Get next mode action based on learning path: Story → Wisdom → Prism → Quest (end)
  // Quest and Freetalk have no "next" — the learning path is complete.
  const getNextModeAction = (): ModeAction | null => {
    switch (currentMode) {
      case 'story':
      case 'introduction':
        return {
          icon: Sparkle,
          label: tString('quickLinks.exploreSeeds', 'Explore Seeds'),
          shortLabel: 'Wisdom',
          action: 'seeds',
          color: 'purple'
        };
      case 'wisdom':
      case 'seed_conversation':
        return {
          icon: DiamondsFour,
          label: tString('quickLinks.listenPrism', 'Listen to Prism'),
          shortLabel: 'Prism',
          action: 'prism',
          color: 'blue'
        };
      case 'prism':
        return {
          icon: Mountains,
          label: tString('quickLinks.startQuest', 'Start Quest'),
          shortLabel: 'Quest',
          action: 'quest',
          color: 'orange'
        };
      case 'quest':
      case 'challenge':
        return {
          icon: Bird,
          label: tString('quickLinks.startFreetalk', 'Freetalk'),
          shortLabel: 'Freetalk',
          action: 'freetalk',
          color: 'green'
        };
      case 'freetalk':
      case 'free_conversation':
        return {
          icon: BookOpen,
          label: tString('quickLinks.listenToStory', 'Listen to Story'),
          shortLabel: 'Story',
          action: 'story',
          color: 'gold'
        };
      default:
        return null;
    }
  };

  const nextMode = getNextModeAction();

  // Book metaphor: left page = past (history), right page = future (next mode)
  const bookmarks: Bookmark[] = [
    {
      id: 'history',
      icon: Scroll,
      label: tString('navigation.history', 'History'),
      shortLabel: tString('navigation.history', 'History'),
      action: onHistoryClick,
      position: 'left',
      color: 'gold' // History always gold
    },
    ...(nextMode ? [{
      id: 'nextMode',
      icon: nextMode.icon,
      label: nextMode.label,
      shortLabel: nextMode.shortLabel,
      action: () => onActionClick(nextMode.action),
      position: 'right' as BookmarkPosition,
      color: nextMode.color
    }] : [])
  ];
  
  if (!isVisible) return null;
  
  return (
    <div className={`bookmark-quick-links ${className}`}>
      {bookmarks.map((bookmark, index) => (
        <div
          key={bookmark.id}
          className={`bookmark-tab bookmark-${bookmark.position} bookmark-${bookmark.color} ${hoveredBookmark === bookmark.id ? 'hovered' : ''}`}
          onClick={bookmark.action}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bookmark.action(); } }}
          onMouseEnter={() => setHoveredBookmark(bookmark.id)}
          onMouseLeave={() => setHoveredBookmark(null)}
          role="button"
          tabIndex={0}
          aria-label={bookmark.label}
          style={{
            '--bookmark-index': index
          } as CSSProperties}
        >
          {/* Bookmark ribbon/fold effect */}
          <div className="bookmark-fold" />
          
          {/* Icon and label */}
          <div className="bookmark-content">
            <bookmark.icon 
              size={iconSize} 
              className="bookmark-icon"
            />
            <span className="bookmark-label">
              {bookmark.shortLabel}
            </span>
          </div>
          
          {/* Tooltip on hover */}
          {hoveredBookmark === bookmark.id && (
            <div className="bookmark-tooltip">
              {bookmark.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};