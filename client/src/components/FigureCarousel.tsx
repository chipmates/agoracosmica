import React, { useState, useEffect, useCallback, FC, MouseEvent, KeyboardEvent } from 'react';
import { useSwipeable } from 'react-swipeable';
import { getHistoricalFigures } from '../api/figures';
import { CategoryTab, ActionButton } from './Button';
import { BookOpen, Check, Sparkle, Play, Pause } from "@phosphor-icons/react";
import OptimizedImage from './OptimizedImage';
import { useTranslation } from '../hooks/useTranslation';
import WisdomMapModal from './WisdomMapModal';
import type { Figure, Seed } from '../types/global';
import { useUIStore } from '../stores/uiStore';
import EchoExplainerHelp, { ECHO_EXPLAINER_HELP_ID } from './EchoExplainerHelp';
import { useFigureTrailer } from '../hooks/useFigureTrailer';
import './FigureCarousel.css';

interface FigureCarouselProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFigure?: (figure: Figure) => void;
  selectedFigure?: Figure | null;
  setShowHamburgerMenu?: (show: boolean) => void;
}

interface CategoryIDs {
  SAGES: string;
  REFORMERS: string;
  CREATORS: string;
}

interface BaseFigureNames {
  [categoryId: string]: string[];
}

interface FigureIdToCategory {
  [figureId: string]: string;
}

// Category ID constants (module-scoped to avoid re-creation on render)
const CATEGORY_IDS: CategoryIDs = {
  SAGES: 'sages',
  REFORMERS: 'reformers',
  CREATORS: 'creators'
};

const FigureCarousel: FC<FigureCarouselProps> = ({
  isOpen,
  onClose,
  onSelectFigure,
  selectedFigure,
  setShowHamburgerMenu = () => {}
}) => {
  const { tString, tNode, language } = useTranslation();

  // Figure page trailer — standalone audio player (play-on-tap, never autoplay)
  const trailer = useFigureTrailer();

  // Echo explainer helper — show once for users who haven't seen it
  const shouldShowHelp = useUIStore((state) => state.shouldShowHelp);
  const [showEchoHelp, setShowEchoHelp] = useState<boolean>(() => shouldShowHelp(ECHO_EXPLAINER_HELP_ID));

  // Format the echo prefix based on current language
  const echoPrefix = tString('figures.echoOf', 'Echo of');
  
  // Get the base figure names for categorization
  const baseFigureNames: BaseFigureNames = {
    [CATEGORY_IDS.SAGES]: [
      `${echoPrefix} Siddhartha Gautama`, `${echoPrefix} Plato`, `${echoPrefix} Marcus Aurelius`, `${echoPrefix} Laozi`,
      `${echoPrefix} Hildegard von Bingen`, `${echoPrefix} Rumi`, `${echoPrefix} Meister Eckhart`, `${echoPrefix} Dōgen Zenji`,
      `${echoPrefix} Carl Gustav Jung`, `${echoPrefix} Joseph Campbell`
    ],
    [CATEGORY_IDS.REFORMERS]: [
      `${echoPrefix} Mahatma Gandhi`, `${echoPrefix} Nelson Mandela`, `${echoPrefix} Martin Luther King Jr.`, `${echoPrefix} Harriet Tubman`,
      `${echoPrefix} Simone de Beauvoir`, `${echoPrefix} Maya Angelou`, `${echoPrefix} Friedrich Nietzsche`, `${echoPrefix} Frida Kahlo`,
      `${echoPrefix} Arthur Schopenhauer`, `${echoPrefix} Ada Lovelace`
    ],
    [CATEGORY_IDS.CREATORS]: [
      `${echoPrefix} William Shakespeare`, `${echoPrefix} Leonardo da Vinci`, `${echoPrefix} Wolfgang Amadeus Mozart`, `${echoPrefix} Johann Wolfgang von Goethe`,
      `${echoPrefix} Galileo Galilei`, `${echoPrefix} Albert Einstein`, `${echoPrefix} William Blake`, `${echoPrefix} Jane Austen`,
      `${echoPrefix} Emily Dickinson`, `${echoPrefix} Virginia Woolf`
    ]
  };
  
  // Create a map of figure IDs to categories for easier lookup
  const figureIdToCategory: FigureIdToCategory = {};
  Object.entries(baseFigureNames).forEach(([category, names]) => {
    names.forEach(name => {
      // Extract figure ID from name by finding the last part that could be a last name
      let figureId: string;
      
      // Handle multi-part and special case names first
      if (name.includes('von Bingen')) figureId = 'bingen';
      else if (name.includes('von Goethe')) figureId = 'goethe';
      else if (name.includes('da Vinci')) figureId = 'vinci';
      else if (name.includes('Luther King Jr.')) figureId = 'king';
      else if (name.includes('Zenji') || name.includes('Dōgen')) figureId = 'zenji'; // Check both "Zenji" and "Dōgen"
      else if (name.includes('Gautama')) figureId = 'gautama';
      else {
        // For standard names, extract the last part
        const nameParts = name.split(' ');
        const lastName = nameParts[nameParts.length - 1].toLowerCase();
        figureId = lastName;
      }
      
      figureIdToCategory[figureId] = category;
    });
  });
  
  // Find which category the selected figure belongs to
  const findInitialCategory = (): string => {
    if (!selectedFigure) return CATEGORY_IDS.SAGES;
    return figureIdToCategory[selectedFigure.id] || CATEGORY_IDS.SAGES;
  };
  
  // Get the figures with translations for the current language
  // Initialize synchronously so findInitialIndex has data on first render
  const [translatedFigures, setTranslatedFigures] = useState<Figure[]>(() => getHistoricalFigures(language));

  // Update translated figures when language changes
  useEffect(() => {
    setTranslatedFigures(getHistoricalFigures(language));
  }, [language]);
  
  // Find the index of the selected figure within its category
  const findInitialIndex = (category: string): number => {
    if (!selectedFigure) return 0;
    
    const categoryFigures = translatedFigures.filter(f => 
      figureIdToCategory[f.id] === category
    );
    
    // First try exact ID match
    let index = categoryFigures.findIndex(f => f.id === selectedFigure.id);
    
    // If not found, try a more flexible partial match
    if (index === -1 && selectedFigure.name) {
      // Extract the figure's base ID from the full name
      // This pattern tries to match "Echo of" in the current language or any common language variant
      // Make sure to escape special characters in the translated prefix
      const escapedPrefix = echoPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const echoPattern = new RegExp(`^${escapedPrefix}\\s+|^Echo (of|von|de|del|di|des)\\s+`, 'i');
      const cleanedName = selectedFigure.name.replace(echoPattern, '');
      const lastName = cleanedName.split(' ').pop()?.toLowerCase() || '';
      
      // Try to match based on the last name portion
      index = categoryFigures.findIndex(f => f.id.toLowerCase() === lastName);
    }
    
    return index !== -1 ? index : 0;
  };
  
  // Initialize state with the correct category and index for the selected figure
  const initialCategory = findInitialCategory();
  
  const [currentCategory, setCurrentCategory] = useState<string>(initialCategory);
  const [currentIndex, setCurrentIndex] = useState<number>(findInitialIndex(initialCategory));
  const [showFullInfo, setShowFullInfo] = useState<boolean>(false);
  const [showWisdom, setShowWisdom] = useState<boolean>(false);
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);
  const [hasNavigated, setHasNavigated] = useState<boolean>(false);
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  // Ref to track miniature elements for auto-scrolling
  const miniatureRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // First-time visitor modal removed - handled in HomePage
  
  // PWA safe areas handled by viewport-fixes.css - no JavaScript needed
  useEffect(() => {
    // Check dynamic viewport units support
    if (CSS.supports('height', '100dvh')) {
      // Use dynamic viewport - safe areas handled by CSS padding
      document.documentElement.style.setProperty('--figure-container-height', '100dvh');
    }
  }, []);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ESC key handler to close the figure carousel
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown as any);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown as any);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) setShowHamburgerMenu(false);
    return () => setShowHamburgerMenu(true);
  }, [isOpen, setShowHamburgerMenu]);
  
  // Removed first-time visitor check - now handled in HomePage
  // The WisdomGalleryModal is shown before FigureCarousel in the new flow
  
  // Add effect to update index when category changes
  useEffect(() => {
    // When user changes category, check if selected figure is in the new category
    if (selectedFigure) {
      const figures = translatedFigures.filter(f => figureIdToCategory[f.id] === currentCategory);
      const index = figures.findIndex(f => f.id === selectedFigure.id);
      
      // If the figure is in this category, select it
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [currentCategory, selectedFigure, translatedFigures]);

  // Auto-scroll active miniature to center when currentIndex changes
  useEffect(() => {
    // Only scroll if we have navigation intent (user interacted)
    if (!hasNavigated) return;

    const activeMiniature = miniatureRefs.current[currentIndex];
    if (activeMiniature) {
      // Smooth scroll to center the active miniature
      activeMiniature.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center' // Center horizontally in the scroll container
      });
    }
  }, [currentIndex, hasNavigated]);

  // Group figures by category using our mapping
  const figures = translatedFigures.filter(f => figureIdToCategory[f.id] === currentCategory);

  // ULTRATHINK: Direct swipe navigation - no transitions
  const handleSwipeNavigation = useCallback((direction: 'left' | 'right') => {
    const newIndex = direction === 'left' 
      ? (currentIndex + 1) % figures.length
      : (currentIndex - 1 + figures.length) % figures.length;
    setCurrentIndex(newIndex);
    setHasNavigated(true); // User swiped, showing navigation intent
  }, [currentIndex, figures.length]);
  
  const handlers = useSwipeable({
    onSwipedLeft:  () => handleSwipeNavigation('left'),
    onSwipedRight: () => handleSwipeNavigation('right'),
    onSwipedUp:    () => setShowFullInfo(true),
    onSwipedDown:  () => setShowFullInfo(false),
    trackMouse: true
  });

  const currentFigure = figures[currentIndex];
  
  // Mobile-optimized display name for long names
  const getDisplayName = (figure?: Figure): string => {
    if (windowWidth >= 400 || !figure?.name) return figure?.name || '';
    
    // Shorten specific long names on mobile
    // Handle both with and without "Echo of/Echo von" prefix
    if (figure.name.includes('Goethe')) {
      return figure.name.replace(/Johann Wolfgang von Goethe/, 'Goethe');
    }
    if (figure.name.includes('Mozart')) {
      return figure.name.replace(/Wolfgang Amadeus Mozart/, 'Mozart');
    }
    if (figure.name.includes('Bingen')) {
      return figure.name.replace(/Hildegard von Bingen/, 'Hildegard v. Bingen');
    }
    
    return figure.name;
  };
  
  // 2025 STATE-OF-THE-ART: Smart preloading only after navigation intent
  useEffect(() => {
    if (!hasNavigated || figures.length <= 1) return;
    
    const preloadTimer = setTimeout(() => {
      // Preload adjacent images
      const nextIndex = (currentIndex + 1) % figures.length;
      const prevIndex = (currentIndex - 1 + figures.length) % figures.length;
      
      [nextIndex, prevIndex].forEach(index => {
        const figure = figures[index];
        if (figure && !preloadedImages.has(figure.id)) {
          const figureName = figure.id === 'dogen' ? 'zenji' : figure.id;
          
          // Preload the actual images that OptimizedImage will use
          const img1 = new Image();
          img1.src = `/assets/figures/full/${figureName}-main-1200.png`;
          
          const img2 = new Image();
          img2.src = `/assets/figures/full/${figureName}-main-1200.webp`;
          
          // Track that we've preloaded this figure
          setPreloadedImages(prev => new Set([...prev, figure.id]));
        }
      });
    }, 500); // Wait 500ms after navigation to preload
    
    return () => clearTimeout(preloadTimer);
  }, [currentIndex, figures, hasNavigated, preloadedImages]);

  // Stop any trailer when the figure changes or the carousel closes — never
  // leave audio playing behind a swipe, a category switch, or a close.
  useEffect(() => {
    trailer.stop();
  }, [currentFigure?.id, isOpen, trailer.stop]);

  const handleSelect = () => {
    if (onSelectFigure) onSelectFigure(currentFigure);
    else console.error('onSelectFigure is not defined');
  };

  if (!isOpen) return null;

  // Handle keyboard navigation for categories
  const handleCategoryKeyNavigation = useCallback((key: string, category: string) => {
    const categoryKeys = Object.keys(CATEGORY_IDS);
    const currentIndex = categoryKeys.findIndex(k => CATEGORY_IDS[k as keyof CategoryIDs] === category);
    let newIndex = currentIndex;
    
    switch(key) {
      case 'ArrowLeft':
        newIndex = currentIndex > 0 ? currentIndex - 1 : categoryKeys.length - 1;
        break;
      case 'ArrowRight':
        newIndex = currentIndex < categoryKeys.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = categoryKeys.length - 1;
        break;
    }
    
    if (newIndex !== currentIndex) {
      setCurrentCategory(CATEGORY_IDS[categoryKeys[newIndex] as keyof CategoryIDs]);
      // Focus the new tab
      setTimeout(() => {
        const newTab = document.getElementById(`tab-${CATEGORY_IDS[categoryKeys[newIndex] as keyof CategoryIDs]}`);
        newTab?.focus();
      }, 0);
    }
  }, []);

  // Category swipe handlers — must be at component level (Rules of Hooks)
  const categoryKeys = Object.keys(CATEGORY_IDS) as (keyof CategoryIDs)[];
  const categorySwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = categoryKeys.findIndex(key => CATEGORY_IDS[key] === currentCategory);
      const nextIndex = currentIndex < categoryKeys.length - 1 ? currentIndex + 1 : 0;
      setCurrentCategory(CATEGORY_IDS[categoryKeys[nextIndex]]);
    },
    onSwipedRight: () => {
      const currentIndex = categoryKeys.findIndex(key => CATEGORY_IDS[key] === currentCategory);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : categoryKeys.length - 1;
      setCurrentCategory(CATEGORY_IDS[categoryKeys[prevIndex]]);
    },
    trackMouse: false
  });

  const renderCategories = () => {
    return (
      <div
        className="categories-section"
        role="tablist"
        aria-label={tString('figures.categoriesLabel', 'Figure categories')}
        {...(windowWidth < 1024 ? categorySwipeHandlers : {})}
      >
        {categoryKeys.map((categoryKey) => {
          const categoryId = CATEGORY_IDS[categoryKey];
          const isActive = currentCategory === categoryId;

          return (
            <CategoryTab
              key={categoryId}
              category={categoryId}
              isActive={isActive}
              onSelect={setCurrentCategory}
              onKeyNavigate={handleCategoryKeyNavigation}
              className="figure-category-tab"
            >
              {tNode(`figures.categories.${categoryId.toLowerCase()}`)}
            </CategoryTab>
          );
        })}
      </div>
    );
  };

  // ULTRATHINK: Direct miniature selection - no transitions
  const handleMiniatureClick = useCallback((index: number) => {
    if (index === currentIndex) return;
    setCurrentIndex(index);
    setHasNavigated(true); // User clicked a miniature, showing navigation intent
  }, [currentIndex]);
  
  const handleMiniatureKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleMiniatureClick(index);
    }
  };

  const handleMiniatureMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty('--mouse-x', `${x}%`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}%`);
  };

  const handleMiniatureMouseLeave = (e: MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--mouse-x', '50%');
    e.currentTarget.style.setProperty('--mouse-y', '50%');
  };
  
  const renderMiniatures = () => (
    <div className="miniatures-section">
      {figures.map((figure, index) => {
        const isActive = index === currentIndex;
        const isPriority = isActive || 
                          index === (currentIndex + 1) % figures.length || 
                          index === (currentIndex - 1 + figures.length) % figures.length;
        
        return (
          <div
            key={index}
            ref={(el) => { miniatureRefs.current[index] = el; }} // Track ref for auto-scrolling
            className={`miniature ${isActive ? 'active' : ''}`}
            onClick={() => handleMiniatureClick(index)}
            // 2025 accessibility enhancements
            role="button"
            tabIndex={0}
            aria-label={`Select ${figure.name}`}
            aria-pressed={isActive}
            onKeyDown={(e) => handleMiniatureKeyDown(e, index)}
            // Minimal Quantum Glow - mouse tracking for gradient origin
            onMouseMove={handleMiniatureMouseMove}
            onMouseLeave={handleMiniatureMouseLeave}
          >
            <OptimizedImage
              src={figure.id}
              type="ui"
              purpose="thumbnail"
              priority={isPriority}
              // SIMPLE: Basic loading attributes
              fetchPriority={isActive ? "high" : "low"}
              loading={isPriority ? "eager" : "lazy"}
              decoding={isActive ? "sync" : "async"}
              alt={figure.name}
            />
          </div>
        );
      })}
    </div>
  );

  // ULTRATHINK: Simplified image handling - no complex transitions
  
  // Enhanced image loading with modern optimization
  const renderMainImage = () => {
    if (!currentFigure) return null;

    const handleInfoOverlayClick = () => {
      setShowFullInfo(!showFullInfo);
    };

    const trailerStatus = trailer.activeId === currentFigure.id ? trailer.status : 'idle';
    const trailerEngaged = trailerStatus === 'loading' || trailerStatus === 'playing';

    const handleTrailerClick = (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation(); // don't toggle the about overlay
      trailer.toggle(currentFigure.id, language);
    };
    // Keep Enter/Space on the trailer button from also toggling the overlay.
    const handleTrailerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
    };
    
    return (
      <div className="main-image-section">
        <div className="figure-image-container">
          <OptimizedImage
            src={currentFigure.id}
            type="ui"
            purpose="main"
            priority={true}
            withBlurUp={true}
            className="figure-image"
            // SIMPLE: Basic loading optimization
            fetchPriority="high"
            decoding="sync"
            loading="eager"
          />
          <div
            className="info-overlay"
            onClick={handleInfoOverlayClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleInfoOverlayClick(); } }}
            aria-expanded={showFullInfo}
            aria-label={tString('carousel.toggleInfo', 'Toggle figure information')}
          >
            <h2>{getDisplayName(currentFigure)}</h2>

            {currentFigure.learn && (
              <p className="figure-learn">{currentFigure.learn}</p>
            )}

            <button
              type="button"
              className={`figure-trailer-btn ${trailerEngaged ? 'is-active' : ''}`}
              onClick={handleTrailerClick}
              onKeyDown={handleTrailerKeyDown}
            >
              {trailerEngaged
                ? <Pause size={16} weight="fill" />
                : <Play size={16} weight="fill" />}
              <span className="figure-trailer-label">
                {trailerEngaged
                  ? tString('figures.trailerPause', 'Pause')
                  : tString('figures.trailerPlay', 'Play intro')}
              </span>
            </button>

            {showFullInfo && currentFigure.about && (
              <div className="figure-about-text">
                {currentFigure.about.split('\n\n').map((para, index) => (
                  <div key={index}>{para}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderActions = () => {
    const isDesktop = windowWidth > 1024;

    return (
      <div className="actions-section">
        <ActionButton
          variant="gold"
          onClick={() => setShowFullInfo(!showFullInfo)}
          size="medium"
          fullWidth={windowWidth < 400}
          icon={windowWidth < 400 ? null : <BookOpen size={isDesktop ? 18 : 16} weight="fill" />}
          aria-label={`${tString('figures.about', 'About')} ${currentFigure?.name || ''}`}
          aria-expanded={showFullInfo}
        >
          {tNode('figures.about')}
        </ActionButton>
        <ActionButton
          variant="coral"
          onClick={handleSelect}
          size="medium"
          fullWidth={windowWidth < 400}
          icon={windowWidth < 400 ? null : <Check size={isDesktop ? 18 : 16} weight="bold" />}
          aria-label={`${tString('figures.select', 'Select')} ${currentFigure?.name || ''}`}
        >
          {tNode('figures.select')}
        </ActionButton>
        <ActionButton
          variant="gold"
          onClick={() => setShowWisdom(true)}
          size="medium"
          fullWidth={windowWidth < 400}
          icon={windowWidth < 400 ? null : <Sparkle size={isDesktop ? 18 : 16} weight="fill" />}
          aria-label={`${tString('figures.wisdom', 'Wisdom')} ${currentFigure?.name || ''}`}
        >
          {tNode('figures.wisdom')}
        </ActionButton>
      </div>
    );
  };

  const handleSeedSelect = (seed: Seed, mode?: string) => {
    if (currentFigure) {
      handleSelect();
    }

    setShowWisdom(false);
    onClose();

    if (seed && seed.id && (window as any).handleSeedSelect) {
      setTimeout(() => {
        (window as any).handleSeedSelect?.(seed, mode);
      }, 100);
    }
  };

  return (
    <>
      <div
        id="figure-carousel"
        className={`figure-carousel ${windowWidth>=1601?'extra-large-screen':''}`}
        {...handlers}
      >
        {/* MOBILE LAYOUT */}
        {windowWidth<768 && (
          <>
            {renderCategories()}
            {renderMiniatures()}
            {renderMainImage()}
            {renderActions()}
          </>
        )}

        {/* TABLET LAYOUT */}
        {windowWidth>=768 && windowWidth<=1024 && (
          <>
            {renderCategories()}
            <div className="tablet-layout">
              {renderMiniatures()}
              <div className="tablet-main-content">
                {renderMainImage()}
              </div>
            </div>
            {renderActions()}
          </>
        )}

        {/* DESKTOP LAYOUT */}
        {windowWidth>1024 && (
          <div className="desktop-layout">
            <div className="left-sidebar">
              {renderCategories()}
              {renderMiniatures()}
            </div>
            <div className="carousel-content-area">
              {renderMainImage()}
            </div>
            <div className="right-sidebar">
              {renderActions()}
            </div>
          </div>
        )}
      </div>

      {showWisdom && (
        <WisdomMapModal
          isOpen={showWisdom}
          onClose={() => setShowWisdom(false)}
          selectedFigure={currentFigure}
          defaultView="map"
          onSeedSelect={handleSeedSelect}
          showSelectButton={true}
          isForSeedConversation
        />
      )}

      {showEchoHelp && (
        <EchoExplainerHelp onDismiss={() => setShowEchoHelp(false)} />
      )}
    </>
  );
};

export default FigureCarousel;
