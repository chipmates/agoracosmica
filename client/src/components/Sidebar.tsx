import React, { useState, useCallback, useEffect, useRef, FC, MouseEvent, lazy, Suspense } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import './Sidebar.css';
import FigureCarousel from './FigureCarousel';
const SettingsModal = lazy(() => import('./SettingsModal'));
import { AudioLibrarySidebarButton } from './AudioLibrary/AudioLibrarySidebarButton';
import { CosmicCouncilSidebarButton } from './CosmicCouncil/CosmicCouncilSidebarButton';
import { WisdomSidebarButton } from './WisdomMapModal/WisdomSidebarButton';
import { CloseButton } from './Button';
import OptimizedImage from './OptimizedImage';
import { getHistoricalFigures } from '../api/figures';
import { useTranslation } from '../hooks/useTranslation';
import { useLiquidGlass } from '../hooks/useLiquidGlass';
import { Figure, Seed } from '../types/global';
import RenderCounter from '../dev/RenderCounter';

// Type definitions
interface CouncilCategory {
  titleKey: string;
  [key: string]: any;
}

interface CouncilConfig {
  moderator?: string;
  participants?: string[];
  currentSpeaker?: string;
  currentPhase?: string;
  councilTitle?: string;
  councilType?: string;
  isCompleted?: boolean;
  category?: CouncilCategory;
  [key: string]: any;
}

interface SidebarProps {
  selectedFigure: Figure | null;
  onSelectFigure: (figure: Figure) => void;
  onOpenHistoryModal?: () => void;
  onSelectSeed?: (seed: Seed) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenModeSelector: () => void;
  hideOnDesktop?: boolean;
  isCouncilMode?: boolean;
  councilConfig?: CouncilConfig | null;
  onCouncilStart?: (config: any) => void;
}

interface Particle {
  id: string;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
}

interface TouchPoint {
  x: number;
  y: number;
}

const Sidebar: FC<SidebarProps> = ({
  selectedFigure,
  onSelectFigure,
  isOpen,
  onClose,
  hideOnDesktop = false,
  isCouncilMode = false,
  councilConfig = null,
  onCouncilStart
}) => {
  const { t, tString, tNode, language } = useTranslation();
  const historicalFigures = React.useMemo(() => getHistoricalFigures(language), [language]);
  const { glassClasses } = useLiquidGlass('sidebar');
  
  const [isCarouselOpen, setIsCarouselOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState<boolean>(window.innerWidth < 1024);
  const [showFigurePreview, setShowFigurePreview] = useState<boolean>(false);
  const [previewFigures, setPreviewFigures] = useState<Figure[]>([]);
  const [isPageVisible, setIsPageVisible] = useState<boolean>(!document.hidden);
  const [transitionEnabled, setTransitionEnabled] = useState<boolean>(false);
  
  // Hover state for each button
  const [pathsHover, setPathsHover] = useState<boolean>(false);
  const [libraryHover, setLibraryHover] = useState<boolean>(false);
  const [councilHover, setCouncilHover] = useState<boolean>(false);
  const [settingsHover, setSettingsHover] = useState<boolean>(false);

  // 2025 DISCOVERABILITY: Pulse hint (no tooltip - clean approach)
  const [applyPulseAnimation, setApplyPulseAnimation] = useState<boolean>(false);
  
  // Refs for magnetic hover effect
  const figureButtonRef = useRef<HTMLButtonElement>(null);
  const pathsButtonRef = useRef<HTMLButtonElement>(null);
  const libraryButtonRef = useRef<HTMLButtonElement>(null);
  const councilButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Particle effect
  const [particles, setParticles] = useState<Particle[]>([]);
  const particlesContainerRef = useRef<HTMLDivElement>(null);
  
  // Touch gesture tracking
  const touchStartRef = useRef<TouchPoint | null>(null);
  const touchEndRef = useRef<TouchPoint | null>(null);

  // Enable transitions after initial render to prevent flash on page load
  useEffect(() => {
    // Use requestAnimationFrame to ensure this runs after the initial render
    const rafId = requestAnimationFrame(() => {
      setTransitionEnabled(true);
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Listen for programmatic settings open requests (e.g. from RateLimitModal BYOK CTA)
  useEffect(() => {
    const handleOpenSettings = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab;
      setSettingsInitialTab(tab || undefined);
      setIsSettingsOpen(true);
    };
    window.addEventListener('openSettingsRequest', handleOpenSettings);
    return () => window.removeEventListener('openSettingsRequest', handleOpenSettings);
  }, []);

  // 2025 DISCOVERABILITY: Pulse hint for first-time users (clean, no tooltip)
  useEffect(() => {
    // Guarded: a storage-blocked browser must not crash the app to the error
    // boundary when the sidebar mounts. Defaulting to "already seen" simply
    // skips the one-time pulse hint.
    let hasSeenFigureGuide: string | null = 'seen';
    try {
      hasSeenFigureGuide = localStorage.getItem('hasSeenFigureGuide');
    } catch { /* storage blocked — skip the hint */ }

    if (!hasSeenFigureGuide && isMobileOrTablet && isOpen) {
      // Apply pulse animation on first visit (mobile/tablet only)
      setApplyPulseAnimation(true);

      // Stop pulse after 6 seconds (3 pulses × 2s each)
      const pulseTimer = setTimeout(() => {
        setApplyPulseAnimation(false);
        try { localStorage.setItem('hasSeenFigureGuide', 'true'); } catch { /* storage blocked */ }
      }, 6000);

      return () => {
        clearTimeout(pulseTimer);
      };
    }
  }, [isMobileOrTablet, isOpen]);

  // Page Visibility API for battery optimization
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);
      
      // Update data attribute on sidebar element
      if (sidebarRef.current) {
        sidebarRef.current.setAttribute('data-visibility', visible ? 'visible' : 'hidden');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Set initial state
    handleVisibilityChange();
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Detect taskbar and adjust available height
  useEffect(() => {
    const detectTaskbar = () => {
      // Check if viewport height is less than screen height (indicating taskbar/dock)
      const screenHeight = window.screen.height;
      const viewportHeight = window.innerHeight;
      const heightDifference = screenHeight - viewportHeight;
      
      // Taskbar typically takes 40-100px depending on OS and settings
      const hasVisibleTaskbar = heightDifference > 50;


      // Update CSS variable for dynamic calculations
      const taskbarHeight = hasVisibleTaskbar ? Math.min(heightDifference, 100) : 0;
      document.documentElement.style.setProperty('--taskbar-height', `${taskbarHeight}px`);
      document.documentElement.style.setProperty('--available-height', `calc(100vh - ${taskbarHeight}px)`);
    };
    
    // Initial detection
    detectTaskbar();
    
    // Re-detect on resize
    window.addEventListener('resize', detectTaskbar);
    return () => window.removeEventListener('resize', detectTaskbar);
  }, []);

  // Generate preview figures from the same category as the selected figure
  useEffect(() => {
    if (selectedFigure && selectedFigure.name) {
      // Find selected figure's category
      let selectedCategory = '';
      const sagesKey = tString('figures.categories.sages', 'Sages');
      const reformersKey = tString('figures.categories.reformers', 'Reformers');
      const creatorsKey = tString('figures.categories.creators', 'Creators');

      const categories: Record<string, string[]> = {
        [sagesKey]: ['Echo of Laozi', 'Echo of Siddhartha Gautama', 'Echo of Plato', 'Echo of William Blake',
                  'Echo of Rumi', 'Echo of Marcus Aurelius', 'Echo of Meister Eckhart', 'Echo of Dōgen Zenji',
                  'Echo of Hildegard von Bingen', 'Echo of Joseph Campbell'],
        [reformersKey]: ['Echo of Mohandas Gandhi', 'Echo of Martin Luther King Jr.', 'Echo of Nelson Mandela',
                      'Echo of Harriet Tubman', 'Echo of Simone de Beauvoir', 'Echo of Maya Angelou',
                      'Echo of Galileo Galilei', 'Echo of Friedrich Nietzsche',
                      'Echo of Carl Gustav Jung', 'Echo of Albert Einstein'],
        [creatorsKey]: ['Echo of William Shakespeare', 'Echo of Leonardo da Vinci', 'Echo of Johann Wolfgang von Goethe',
                     'Echo of Virginia Woolf', 'Echo of Jane Austen', 'Echo of Emily Dickinson', 'Echo of Frida Kahlo',
                     'Echo of Ada Lovelace', 'Echo of Wolfgang Amadeus Mozart', 'Echo of Arthur Schopenhauer']
      };
      for (const [category, figures] of Object.entries(categories)) {
        if (figures.includes(selectedFigure.name)) {
          selectedCategory = category;
          break;
        }
      }

      // Get all figures from same category except selected one
      const sameCategoryNames = selectedCategory ? (categories[selectedCategory] || []) : [];
      const categoryFigures = historicalFigures.filter(
        figure => figure.name !== selectedFigure.name &&
                  (sameCategoryNames.length > 0 ? sameCategoryNames.includes(figure.name) : true)
      );
      
      // If not enough in category, add some from other categories
      let allFigures = [...categoryFigures];
      if (allFigures.length < 3) {
        const otherFigures = historicalFigures.filter(
          figure => figure.name !== selectedFigure.name && !categoryFigures.includes(figure)
        );
        allFigures = [...categoryFigures, ...otherFigures];
      }
      
      // Randomly select 3 figures
      const shuffled = [...allFigures].sort(() => 0.5 - Math.random());
      setPreviewFigures(shuffled.slice(0, 3));
    } else {
      // If no selected figure, show 3 random figures
      const shuffled = [...historicalFigures].sort(() => 0.5 - Math.random());
      setPreviewFigures(shuffled.slice(0, 3));
    }
  }, [selectedFigure, t]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobileOrTablet(mobile);
      if (!mobile) onClose(); // Close sidebar when switching to desktop
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [onClose]);

  // Swipe gesture handling for mobile/tablet
  useEffect(() => {
    if (!isMobileOrTablet) return;

    const minSwipeDistance = 50; // Minimum distance for a swipe

    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
      touchEndRef.current = null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      
      touchEndRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    };

    const handleTouchEnd = () => {
      if (!touchStartRef.current || !touchEndRef.current) return;

      const distanceX = touchEndRef.current.x - touchStartRef.current.x;
      const distanceY = touchEndRef.current.y - touchStartRef.current.y;
      
      // Check if it's more horizontal than vertical
      if (Math.abs(distanceX) > Math.abs(distanceY)) {
        // Closing gesture: swipe left when sidebar is open
        if (isOpen && distanceX < -minSwipeDistance) {
          onClose();
        }
      }

      touchStartRef.current = null;
      touchEndRef.current = null;
    };

    // Add listeners to sidebar for closing gesture
    const sidebarElement = sidebarRef.current;
    if (isOpen && sidebarElement) {
      sidebarElement.addEventListener('touchstart', handleTouchStart, { passive: true });
      sidebarElement.addEventListener('touchmove', handleTouchMove, { passive: true });
      sidebarElement.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      if (sidebarElement) {
        sidebarElement.removeEventListener('touchstart', handleTouchStart);
        sidebarElement.removeEventListener('touchmove', handleTouchMove);
        sidebarElement.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [isMobileOrTablet, isOpen, onClose]);

  // Scroll lock via ref-counted hook
  useBodyScrollLock(isOpen);

  // Magnetic hover effect with additional safety checks
  const applyMagneticEffect = (
    e: MouseEvent<HTMLButtonElement>,
    buttonRef: React.RefObject<HTMLButtonElement>,
    setHoverState?: React.Dispatch<React.SetStateAction<boolean>>
  ): void => {
    try {
      // Skip effect if user prefers reduced motion
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }
      
      // Skip if button reference doesn't exist
      if (!buttonRef || !buttonRef.current) {
        return;
      }
      
      const button = buttonRef.current;
      
      // Additional check to make sure the element is in the DOM
      if (!button.isConnected) {
        return;
      }
      
      const rect = button.getBoundingClientRect();
      
      // Skip if getBoundingClientRect returned an invalid rectangle
      if (!rect || typeof rect.left !== 'number' || typeof rect.width !== 'number') {
        return;
      }
      
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate mouse distance from center
      const distanceX = e.clientX - centerX;
      const distanceY = e.clientY - centerY;
      
      // Calculate rotation based on mouse position (limited to 10 degrees)
      const rotateX = Math.max(Math.min(-distanceY * 0.05, 10), -10);
      const rotateY = Math.max(Math.min(distanceX * 0.05, 10), -10);
      
      // Apply transformation
      button.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
      
      // Set hover state
      if (setHoverState) setHoverState(true);
    } catch (error) {
      // Silently handle any errors without breaking the UI
      console.warn('Magnetic effect error:', error);
    }
  };
  
  // Reset magnetic effect when mouse leaves - with safety checks
  const resetMagneticEffect = (
    buttonRef: React.RefObject<HTMLButtonElement>,
    setHoverState?: React.Dispatch<React.SetStateAction<boolean>>
  ): void => {
    try {
      if (buttonRef && buttonRef.current && buttonRef.current.isConnected) {
        buttonRef.current.style.transform = '';
        if (setHoverState) setHoverState(false);
      }
    } catch (error) {
      // Silently handle any errors
      console.warn('Reset magnetic effect error:', error);
    }
  };
  
  // Generate random particles
  useEffect(() => {
    // Only run this effect if the sidebar is open and the container reference exists
    if (!isOpen || !particlesContainerRef.current) return;
    
    // Skip effect if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    
    // Generate 10-15 particles with random positions
    const newParticles: Particle[] = [];
    const container = particlesContainerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    for (let i = 0; i < Math.floor(Math.random() * 5) + 10; i++) {
      newParticles.push({
        id: `particle-${Date.now()}-${i}`,
        left: Math.random() * containerWidth,
        top: Math.random() * containerHeight,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 5,
        duration: Math.random() * 10 + 10
      });
    }
    
    setParticles(newParticles);
    
    // Regenerate particles every 10 seconds
    const interval = setInterval(() => {
      if (isOpen && particlesContainerRef.current) {
        const currentContainer = particlesContainerRef.current;
        const width = currentContainer.clientWidth;
        const height = currentContainer.clientHeight;
        
        setParticles(newParticles.map(p => ({
          ...p,
          left: Math.random() * width,
          top: Math.random() * height,
          delay: Math.random() * 5,
          duration: Math.random() * 10 + 10
        })));
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleSelectFigure = useCallback((figure: Figure): void => {
    onSelectFigure(figure);
    setIsCarouselOpen(false);
    onClose();
  }, [onSelectFigure, onClose]);

  const handleButtonClick = (action: () => void): void => {
    action();
    onClose();
  };

  // Always show preview figures to avoid fade-in/out animations
  const handleFigureButtonMouseEnter = (): void => {
    setShowFigurePreview(true);
  };

  const handleFigureButtonMouseLeave = (): void => {
    // Hide preview figures when mouse leaves the button
    setShowFigurePreview(false);
  };

  if (isCarouselOpen) {
    return (
      <FigureCarousel
        isOpen={isCarouselOpen}
        onClose={() => setIsCarouselOpen(false)}
        onSelectFigure={handleSelectFigure}
        selectedFigure={selectedFigure as Figure | null | undefined}
      />
    );
  }


  return (
    <>
      {import.meta.env.DEV && <RenderCounter label="Sidebar" />}
      <div 
        id="navigation"
        ref={sidebarRef}
        className={`sidebar ${isMobileOrTablet ? `mobile ${glassClasses}` : 'desktop'} ${isOpen ? 'open' : ''} ${hideOnDesktop ? 'hide-on-desktop' : ''} ${transitionEnabled ? 'transition-enabled' : ''}`}
        data-visibility={isPageVisible ? 'visible' : 'hidden'}
      >
        {isMobileOrTablet && (
          <CloseButton
            onClick={onClose}
            aria-label={tString('navigation.closeMenu', 'Close menu')}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              zIndex: 1000,
              pointerEvents: 'auto'
            }}
          />
        )}
        
        {/* Cosmic particles effect */}
        <div className="cosmic-particles" ref={particlesContainerRef}>
          {particles.map(particle => (
            <div 
              key={particle.id}
              className="cosmic-particle"
              style={{
                left: `${particle.left}px`,
                top: `${particle.top}px`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.duration}s`
              }}
            />
          ))}
        </div>

        <div className="content-container">
          <div className="sidebar-header">
          <div className="nav-button-container">
            <button
              ref={figureButtonRef}
              className={`nav-button figure-preview-container ${applyPulseAnimation ? 'pulse-hint' : ''}`}
              onClick={() => setIsCarouselOpen(true)}
              onMouseMove={(e) => applyMagneticEffect(e, figureButtonRef)}
              onMouseLeave={() => {
                resetMagneticEffect(figureButtonRef);
                handleFigureButtonMouseLeave();
              }}
              onMouseEnter={handleFigureButtonMouseEnter}
              aria-label={tString('figures.selectFigure', 'Select figure')}
            >
              <div className="button-frame">
                {isCouncilMode && councilConfig ? (
                  // Council Mode Display
                  <div className="council-mode-display">
                    <div className="council-title-container">
                      <OptimizedImage
                        src="council"
                        type="ui"
                        purpose="icon"
                        priority={true}
                        className="council-title-icon-large"
                        alt="Council"
                      />
                      <div className="council-title-text">
                        {councilConfig.category?.titleKey ? tNode(councilConfig.category.titleKey) : 'Council'}
                      </div>
                    </div>
                  </div>
                ) : selectedFigure ? (
                  // Normal Figure Display
                  <>
                    <OptimizedImage
                      src={selectedFigure.id}
                      type="ui"
                      purpose="thumbnail"
                      size={320} // Better match for actual button size (140-180px × 2 DPR)
                      withBlurUp={true}
                      priority={true}
                      alt={selectedFigure.name}
                      className="button-icon main-figure-image"
                    />
                    
                    {/* Preview figures that peek from the edges */}
                    {showFigurePreview && previewFigures.map((figure, index) => (
                      <div 
                        key={figure.name} 
                        className={`preview-figure preview-position-${index}`}
                      >
                        <OptimizedImage
                          src={figure.id}
                          type="ui"
                          purpose="thumbnail"
                          size={160} // Perfect for 60-80px display × 2 DPR
                          withBlurUp={false}
                          priority={false}
                          alt={figure.name}
                          className="preview-figure-image"
                            />
                      </div>
                    ))}
                  </>
                ) : (
                  // Placeholder when no figure is selected
                  <div className="button-icon no-figure-placeholder">
                    <span className="placeholder-text">{tNode('figures.selectFigure')}</span>
                  </div>
                )}
              </div>
            </button>

            {/* Preview indicator - moved outside button like other labels */}
            <span className={`nav-button-label ${showFigurePreview ? 'active' : ''}`}>
              Echos
            </span>
          </div>
          </div>

          <nav className="navigation-grid" role="navigation">
            <div className="nav-button-container">
              <WisdomSidebarButton
                selectedFigure={selectedFigure}
                isHovered={pathsHover}
                onMouseMove={(e: MouseEvent<HTMLButtonElement>) => applyMagneticEffect(e, pathsButtonRef, setPathsHover)}
                onMouseLeave={() => resetMagneticEffect(pathsButtonRef, setPathsHover)}
                buttonRef={pathsButtonRef}
                onButtonClick={() => onClose()}
              />
              <span className="nav-button-label">{tNode('navigation.wisdom')}</span>
            </div>

            <div className="nav-button-container">
              <AudioLibrarySidebarButton
                selectedFigure={selectedFigure}
                isHovered={libraryHover}
                onMouseMove={(e: MouseEvent<HTMLButtonElement>) => applyMagneticEffect(e, libraryButtonRef, setLibraryHover)}
                onMouseLeave={() => resetMagneticEffect(libraryButtonRef, setLibraryHover)}
                buttonRef={libraryButtonRef}
                onButtonClick={() => onClose()}
              />
              <span className="nav-button-label" data-label="audiolibrary">{tNode('navigation.audioLibrary')}</span>
            </div>

            <div className="nav-button-container">
              <CosmicCouncilSidebarButton
                selectedFigure={selectedFigure}
                onCouncilStart={onCouncilStart}
                isHovered={councilHover}
                onMouseMove={(e: MouseEvent<HTMLButtonElement>) => applyMagneticEffect(e, councilButtonRef, setCouncilHover)}
                onMouseLeave={() => resetMagneticEffect(councilButtonRef, setCouncilHover)}
                buttonRef={councilButtonRef}
                onButtonClick={() => onClose()}
              />
              <span className="nav-button-label">Council</span>
            </div>

            <div className="nav-button-container">
              <button
                ref={settingsButtonRef}
                className="nav-button"
                onClick={() => handleButtonClick(() => setIsSettingsOpen(true))}
                onMouseMove={(e) => applyMagneticEffect(e, settingsButtonRef, setSettingsHover)}
                onMouseLeave={() => resetMagneticEffect(settingsButtonRef, setSettingsHover)}
                aria-label={tString('navigation.settings', 'Settings')}
              >
                <div className="button-frame">
                  <OptimizedImage
                    src="settings"
                    type="ui"
                    purpose="icon"
                    priority={true}
                    className={`button-icon ${settingsHover ? 'hover' : ''}`}
                    alt="Settings"
                  />
                </div>
              </button>
              <span className="nav-button-label" data-label="settings">{tNode('navigation.settings')}</span>
            </div>
          </nav>
        </div>
      </div>

      {isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => { setIsSettingsOpen(false); setSettingsInitialTab(undefined); }}
            initialTab={settingsInitialTab}
          />
        </Suspense>
      )}

    </>
  );
};

Sidebar.displayName = 'Sidebar';

export default React.memo(Sidebar);
