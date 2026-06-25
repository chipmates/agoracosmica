/**
 * FigureTestModal - Test Modal for Figure Seeds Display
 *
 * A mobile-first modal showcasing:
 * - Cosmic header with stars
 * - Horizontal figure carousel (30 figures)
 * - Seed list for selected figure (12 seeds)
 *
 * Built according to CLAUDE.md principles and design system.
 */

import { FC, useState, useEffect, useRef } from 'react';
import { ModalContainer, ModalHeader } from '../Modal';
import OptimizedFigureImage from '../OptimizedFigureImage';
import { historicalFiguresBase } from '../../api/figures';
import { Clock, CaretLeft, CaretRight } from '@phosphor-icons/react';
import './FigureTestModal.css';

// Type definitions
interface Figure {
  id: string;
  name: string;
  imageKey: string;
}

interface Seed {
  id: number | string;
  title: string;
  duration?: string; // For display purposes
}

interface SeedCollection {
  figure: string;
  seeds: Seed[];
}

interface FigureTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Helper function to extract last name from full name
 * Handles special cases like "Leonardo da Vinci", "King Jr.", etc.
 */
const getLastName = (fullName: string): string => {
  if (!fullName) return '';

  // Remove "Echo of" prefix
  const nameWithoutEcho = fullName
    .replace(/^Echo of /i, '')
    .replace(/^Echo von /i, '')
    .replace(/^Echo de /i, '')
    .trim();

  // Special cases for compound names
  const specialCases: Record<string, string> = {
    'Leonardo da Vinci': 'da Vinci',
    'Hildegard von Bingen': 'von Bingen',
    'Martin Luther King Jr.': 'King Jr.',
    'Simone de Beauvoir': 'de Beauvoir',
    'Dōgen Zenji': 'Dōgen',
    'Dogen Zenji': 'Dōgen',
    'Wolfgang Amadeus Mozart': 'Mozart',
    'Carl Gustav Jung': 'Jung',
    'Johann Wolfgang von Goethe': 'Goethe',
    'Mark Aurel': 'Mark Aurel',
  };

  // Check special cases
  for (const [full, last] of Object.entries(specialCases)) {
    if (nameWithoutEcho.includes(full)) {
      return last;
    }
  }

  // Default: return last word
  return nameWithoutEcho.split(' ').pop() || '';
};

/**
 * Helper to format duration (for mock data)
 */
const formatDuration = (minutes: number, seconds: number): string => {
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Load seed data for a figure
 */
const loadSeedData = async (figureId: string): Promise<SeedCollection | null> => {
  try {
    // Dynamic import of seed data
    const seedModule = await import(`../../assets/translations/seeds/en/${figureId}-seeds.json`);
    return seedModule.default || seedModule;
  } catch (error) {
    console.warn(`Could not load seeds for ${figureId}:`, error);
    return null;
  }
};

/**
 * FigureTestModal Component
 */
const FigureTestModal: FC<FigureTestModalProps> = ({ isOpen, onClose }) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [selectedFigure, setSelectedFigure] = useState<Figure | null>(null);
  const [seedData, setSeedData] = useState<SeedCollection | null>(null);
  const [isLoadingSeeds, setIsLoadingSeeds] = useState(false);

  // Prepare figures list with imageKeys
  const figures: Figure[] = historicalFiguresBase.map(fig => ({
    id: fig.id,
    name: fig.baseNameEn,
    imageKey: fig.id
  }));

  // Initialize with first figure
  useEffect(() => {
    if (isOpen && !selectedFigure) {
      setSelectedFigure(figures[0]);
    }
  }, [isOpen]);

  // Load seeds when figure changes
  useEffect(() => {
    if (!selectedFigure) return;

    const loadSeeds = async () => {
      setIsLoadingSeeds(true);
      const data = await loadSeedData(selectedFigure.id);
      setSeedData(data);
      setIsLoadingSeeds(false);
    };

    loadSeeds();
  }, [selectedFigure]);

  // Scroll to selected figure when it changes
  useEffect(() => {
    if (!selectedFigure || !carouselRef.current) return;

    const index = figures.findIndex(f => f.id === selectedFigure.id);
    if (index === -1) return;

    const item = itemsRef.current[index];
    if (!item) return;

    // Calculate scroll position to center the item
    const carousel = carouselRef.current;
    const itemRect = item.getBoundingClientRect();
    const carouselRect = carousel.getBoundingClientRect();
    const centerPosition = item.offsetLeft - (carouselRect.width / 2) + (itemRect.width / 2);

    carousel.scrollTo({
      left: centerPosition,
      behavior: 'smooth'
    });
  }, [selectedFigure, figures]);

  // Handle figure selection
  const handleFigureSelect = (figure: Figure) => {
    setSelectedFigure(figure);
  };

  // Navigate to previous figure
  const handlePrevious = () => {
    if (!selectedFigure) return;
    const currentIndex = figures.findIndex(f => f.id === selectedFigure.id);
    if (currentIndex > 0) {
      setSelectedFigure(figures[currentIndex - 1]);
    }
  };

  // Navigate to next figure
  const handleNext = () => {
    if (!selectedFigure) return;
    const currentIndex = figures.findIndex(f => f.id === selectedFigure.id);
    if (currentIndex < figures.length - 1) {
      setSelectedFigure(figures[currentIndex + 1]);
    }
  };

  // Keyboard navigation (Arrow keys)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedFigure, figures]);

  // Check if we can navigate
  const currentIndex = selectedFigure ? figures.findIndex(f => f.id === selectedFigure.id) : -1;
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < figures.length - 1;

  // Calculate total duration (mock data)
  const totalSeeds = seedData?.seeds?.length || 12;
  const totalDuration = totalSeeds > 0
    ? formatDuration(Math.floor(totalSeeds * 4.5), Math.floor((totalSeeds * 4.5 % 1) * 60))
    : '67:40';

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      animationType="fade-scale"
      backgroundVariant="fullscreen"
      modalType="immersive"
    >
      <div className="figure-test-modal">
        {/* Cosmic Header */}
        <ModalHeader
          layout="simple"
          theme="gold"
          cosmicStars={true}
          onClose={onClose}
          className="figure-test-modal__header"
        >
          <h1 className="figure-test-modal__title">STORIES</h1>
        </ModalHeader>

        {/* Figure Carousel */}
        <div className="figure-test-modal__carousel-section">
          {/* Left Arrow */}
          <button
            className="figure-test-modal__nav-button figure-test-modal__nav-button--left"
            onClick={handlePrevious}
            disabled={!canGoPrevious}
            aria-label="Previous figure"
            title="Previous figure (←)"
          >
            <CaretLeft size={32} weight="bold" />
          </button>

          <div
            ref={carouselRef}
            className="figure-test-modal__carousel"
            role="tablist"
            aria-label="Select a historical figure"
          >
            {figures.map((figure, index) => {
              const isSelected = selectedFigure?.id === figure.id;
              return (
                <button
                  key={figure.id}
                  ref={(el) => { itemsRef.current[index] = el; }}
                  className={`figure-test-modal__figure-item ${isSelected ? 'figure-test-modal__figure-item--selected' : ''}`}
                  onClick={() => handleFigureSelect(figure)}
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls="seed-list"
                >
                  <div className="figure-test-modal__figure-avatar">
                    <OptimizedFigureImage
                      figure={{ imageKey: figure.imageKey }}
                      type="thumbnail"
                      alt={figure.name}
                      isActive={isSelected}
                      className="figure-test-modal__figure-image"
                    />
                  </div>
                  <span className="figure-test-modal__figure-name">
                    {getLastName(figure.name)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Arrow */}
          <button
            className="figure-test-modal__nav-button figure-test-modal__nav-button--right"
            onClick={handleNext}
            disabled={!canGoNext}
            aria-label="Next figure"
            title="Next figure (→)"
          >
            <CaretRight size={32} weight="bold" />
          </button>
        </div>

        {/* Seed List */}
        <div
          id="seed-list"
          className="figure-test-modal__content"
          role="tabpanel"
          aria-labelledby="stories-heading"
        >
          {/* Summary Line */}
          <div className="figure-test-modal__summary">
            <span className="figure-test-modal__summary-count">
              {totalSeeds} stories
            </span>
            <span className="figure-test-modal__summary-separator">•</span>
            <span className="figure-test-modal__summary-duration">
              <Clock size={16} weight="regular" />
              <span>{totalDuration}</span>
            </span>
          </div>

          {/* Seed List */}
          {isLoadingSeeds ? (
            <div className="figure-test-modal__loading">
              Loading seeds...
            </div>
          ) : seedData?.seeds && seedData.seeds.length > 0 ? (
            <ul className="figure-test-modal__seed-list">
              {seedData.seeds.map((seed, index) => (
                <li
                  key={seed.id}
                  className="figure-test-modal__seed-item"
                >
                  <span className="figure-test-modal__seed-number">
                    {index + 1}
                  </span>
                  <span className="figure-test-modal__seed-title">
                    {seed.title}
                  </span>
                  <span className="figure-test-modal__seed-duration">
                    {seed.duration || formatDuration(
                      Math.floor(3 + Math.random() * 5),
                      Math.floor(Math.random() * 60)
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="figure-test-modal__empty">
              No seeds available for {selectedFigure?.name}
            </div>
          )}
        </div>
      </div>
    </ModalContainer>
  );
};

export default FigureTestModal;
