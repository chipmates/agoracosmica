// src/components/CosmicCouncil/MiniFigureCarousel.tsx
import React, { FC, useState, useRef, useEffect, DragEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
// Removed Framer Motion for instant UI response
import { CaretLeft, CaretRight, Crown, CheckCircle } from '@phosphor-icons/react';
import OptimizedFigureImage from '../OptimizedFigureImage';
import useTranslation from '../../hooks/useTranslation';
import { getShortDisplayName } from '../../data/councilCatalog';
import './MiniFigureCarousel.css';

interface Figure {
  id: string;
  name: string;
  // Add other figure properties as needed
}

interface FigureCardProps {
  figure: Figure;
  isSelected: boolean;
  isModerator: boolean;
  onSelect: (figure: Figure) => void;
  onDragStart?: (figure: Figure) => void;
  disabled: boolean;
  disabledReason?: string;
}

interface MiniFigureCarouselProps {
  figures: Figure[];
  onFigureSelect: (figure: Figure) => void;
  selectedFigures?: Figure[];
  moderator?: Figure;
  maxSelection?: number;
  hasModerator?: boolean;
}

const FigureCard: FC<FigureCardProps> = ({
  figure,
  isSelected,
  isModerator,
  onSelect,
  onDragStart,
  disabled,
  disabledReason,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleClick = (): void => {
    if (!disabled) {
      onSelect(figure);
    }
  };

  // a11y: WCAG 2.1.1 keyboard equivalent for the role="option" div. Without
  // this, keyboard-only users can Tab to the listbox container but cannot
  // select a figure inside it.
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      onSelect(figure);
    }
  };

  // When focus lands on a card that's offscreen (because the carousel paged),
  // bring it into view so Tab order remains useful.
  const handleFocus = (): void => {
    cardRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>): void => {
    setIsDragging(true);
    e.dataTransfer.setData('application/json', JSON.stringify(figure));
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(figure);
  };

  const handleDragEnd = (): void => {
    setIsDragging(false);
  };

  return (
    <div
      ref={cardRef}
      className={`mini-figure-card ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${isDragging ? 'dragging' : ''}`}
      role="option"
      aria-selected={isSelected || isModerator}
      // Disabled cards stay in DOM order but skip Tab focus.
      tabIndex={disabled ? -1 : 0}
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      title={disabledReason}
      aria-disabled={disabled || undefined}
      aria-label={
        isModerator
          ? `${figure.name} (moderator)`
          : isSelected
            ? `${figure.name} (selected participant)`
            : figure.name
      }
    >
      <div className="mini-figure-image-container">
        <OptimizedFigureImage
          figure={figure}
          type="thumbnail"
          className="mini-figure-image"
          alt={figure.name}
          width={60}
          height={60}
        />

        {/* Status Indicators */}
        {isModerator && (
          <div className="mini-figure-crown">
            <Crown size={14} weight="fill" />
          </div>
        )}

        {isSelected && !isModerator && (
          <div className="mini-figure-check">
            <CheckCircle size={16} weight="fill" />
          </div>
        )}

        {/* Glow Effect */}
        <div className={`mini-figure-glow ${isSelected ? 'active' : ''}`} />
      </div>

      <div className="mini-figure-name">
        {getShortDisplayName(figure.id)}
      </div>
    </div>
  );
};

const MiniFigureCarousel: FC<MiniFigureCarouselProps> = ({
  figures,
  onFigureSelect,
  selectedFigures = [],
  moderator,
  maxSelection = 4,
  hasModerator = false
}) => {
  const { tString, tNode } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(8);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Touch handling for swipe navigation (matching Gallery Modal pattern)
  const [touchStart, setTouchStart] = useState<number>(0);
  const [touchEnd, setTouchEnd] = useState<number>(0);

  // Calculate visible count based on container width (debounced on resize)
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>;

    const updateVisibleCount = (): void => {
      if (carouselRef.current) {
        const containerWidth = carouselRef.current.offsetWidth;
        const screenWidth = window.innerWidth;

        // Responsive navigation button sizes (match CSS gap values)
        let navButtonWidth = 40;
        let navButtonGap = 12; // 0.75rem
        let cardWidth = 95 + 8; // Desktop: 95px card + 8px gap (0.5rem)

        if (screenWidth <= 480) {
          // Mobile
          navButtonWidth = 32;
          navButtonGap = 5.6; // 0.35rem
          cardWidth = 75 + 5.6; // 75px card + 5.6px gap (0.35rem)
        } else if (screenWidth <= 768) {
          // Tablet
          navButtonWidth = 36;
          navButtonGap = 8; // 0.5rem
          cardWidth = 85 + 6.4; // 85px card + 6.4px gap (0.4rem)
        }

        const availableWidth = containerWidth - (navButtonWidth * 2) - (navButtonGap * 2);
        const newVisibleCount = Math.floor(availableWidth / cardWidth);

        // Responsive min/max limits
        const minVisible = screenWidth <= 480 ? 3 : 4;
        const maxVisible = screenWidth <= 480 ? 8 : screenWidth <= 768 ? 10 : 14;

        setVisibleCount(Math.max(minVisible, Math.min(newVisibleCount, maxVisible)));
      }
    };

    const debouncedUpdate = (): void => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateVisibleCount, 150);
    };

    updateVisibleCount();
    window.addEventListener('resize', debouncedUpdate);
    return () => {
      window.removeEventListener('resize', debouncedUpdate);
      clearTimeout(resizeTimer);
    };
  }, []);

  // Filter and sort figures
  const sortedFigures = [...figures].sort((a, b) => a.name.localeCompare(b.name));
  const totalFigures = sortedFigures.length;

  // Looping navigation with modulo arithmetic
  const handlePrevious = (): void => {
    setCurrentIndex(prev => (prev - 1 + totalFigures) % totalFigures);
  };

  const handleNext = (): void => {
    setCurrentIndex(prev => (prev + 1) % totalFigures);
  };

  // Swipe handlers (matching Gallery Modal pattern - 50px minimum)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>): void => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>): void => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (): void => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50; // Minimum 50px swipe
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNext();
    }
    if (isRightSwipe) {
      handlePrevious();
    }

    // Reset
    setTouchStart(0);
    setTouchEnd(0);
  };

  // Keyboard navigation for carousel
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrevious();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    }
  };

  const handleFigureSelect = (figure: Figure): void => {
    const isAlreadySelected = selectedFigures.find(f => f.id === figure.id);
    const isModerator = moderator?.id === figure.id;
    
    if (!isAlreadySelected && !isModerator && selectedFigures.length < maxSelection) {
      onFigureSelect(figure);
    }
  };

  // Wrapping visible figures using modulo arithmetic
  const visibleFigures = Array.from({ length: Math.min(visibleCount, totalFigures) }, (_, i) =>
    sortedFigures[(currentIndex + i) % totalFigures]
  );

  // Page dot indicators
  const totalPages = Math.ceil(totalFigures / visibleCount);
  const currentPage = Math.floor(currentIndex / visibleCount) % totalPages;

  return (
    <div className="mini-figure-carousel" ref={carouselRef}>
      <div className="mini-carousel-header">
        <h3 className="mini-carousel-title">
          {hasModerator
            ? tNode('cosmicCouncil.setup.selectParticipants')
            : tNode('cosmicCouncil.setup.selectModerator')
          }
        </h3>
        <div className="mini-carousel-counter">
          {hasModerator
            ? `${selectedFigures.length}/3 ${tString('cosmicCouncil.setup.selected', 'selected')}`
            : tString('cosmicCouncil.setup.moderatorNeeded', 'Choose who leads')
          }
        </div>
      </div>

      <div className="mini-carousel-container">
        {/* Previous Button — always clickable (loops) */}
        <button
          className="mini-carousel-nav mini-carousel-prev"
          onClick={handlePrevious}
          aria-label={tString('audioLibrary.controls.previousFigure', 'Previous Figure')}
        >
          <CaretLeft size={20} weight="bold" />
        </button>

        {/* Figures Grid */}
        <div
          className="mini-carousel-grid"
          role="listbox"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-label={tString('cosmicCouncil.setup.selectFigures', 'Select Figures')}
        >
          <div
            className="mini-carousel-track"
          >
            {visibleFigures.map((figure) => {
              const isSelected = selectedFigures.find(f => f.id === figure.id);
              const isModerator = moderator?.id === figure.id;

              const isDisabled = selectedFigures.length >= maxSelection && !isSelected && !isModerator;
              const disabledReason = isDisabled
                ? tString('cosmicCouncil.setup.maxReached', 'Council is full')
                : undefined;

              return (
                <FigureCard
                  key={figure.id}
                  figure={figure}
                  isSelected={!!isSelected}
                  isModerator={isModerator}
                  onSelect={handleFigureSelect}
                  disabled={isDisabled}
                  disabledReason={disabledReason}
                />
              );
            })}
          </div>
        </div>

        {/* Next Button — always clickable (loops) */}
        <button
          className="mini-carousel-nav mini-carousel-next"
          onClick={handleNext}
          aria-label={tString('audioLibrary.controls.nextFigure', 'Next Figure')}
        >
          <CaretRight size={20} weight="bold" />
        </button>
      </div>

      {/* Page Dot Indicators */}
      <div className="mini-carousel-dots">
        {Array.from({ length: totalPages }, (_, i) => (
          <div
            key={i}
            className={`mini-carousel-dot ${i === currentPage ? 'mini-carousel-dot--active' : ''}`}
          />
        ))}
      </div>

      {/* Instruction */}
      <div className="mini-carousel-instructions">
        <p>{tNode('cosmicCouncil.setup.clickInstructions')}</p>
      </div>
    </div>
  );
};

export default MiniFigureCarousel;