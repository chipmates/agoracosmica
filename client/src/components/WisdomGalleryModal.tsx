/**
 * WisdomGalleryModal - Premium Full-Screen Portrait Gallery
 * Museum-quality experience showcasing figure artwork at hero scale
 * Liquid glass frames with cosmic breathing animations
 * Phase 0: JavaScript with CSS Modules - Following CLAUDE.md principles
 */

import React, { useState, useEffect, useCallback, useRef, FC, KeyboardEvent, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../hooks/useTranslation';
import { getHistoricalFigures, historicalFiguresBase } from '../api/figures';
import { loadFigureTranslation } from '../utils/figureTranslations';
import { useDomainStore } from '../stores/domainStore';
import OptimizedImage from './OptimizedImage';
import Button from './Button/Button';
import { ModalHeader } from './Modal';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useUIStore } from '../stores/uiStore';
import EchoExplainerHelp, { ECHO_EXPLAINER_HELP_ID } from './EchoExplainerHelp';
import { Play, Pause } from '@phosphor-icons/react';
import { useFigureTrailer, type FigureTrailerControls } from '../hooks/useFigureTrailer';

// CSS Modules
import styles from './WisdomGalleryModal.module.css';

/**
 * Gallery figure data - Aurelius, Tubman, Da Vinci
 */
const GALLERY_FIGURES = ['aurelius', 'tubman', 'vinci'];

const FIGURE_ESSENCES: Record<string, string> = {
  aurelius: 'The philosopher-emperor who turned the battlefield into a meditation on virtue and impermanence.',
  tubman: 'Every great dream begins with a dreamer. You have the strength to reach for the stars.',
  vinci: 'The universal mind who saw art in science and science in art, endlessly curious about everything.'
};

interface Figure {
  id: string;
  name: string;
  about: string;
  learn?: string;
}

/**
 * Golden "you will learn" line + trailer play control.
 * Shared by the desktop name row and the mobile portrait frame.
 */
interface FigureHookProps {
  figure: Figure;
  language: string;
  trailer: FigureTrailerControls;
}

const FigureHook: FC<FigureHookProps> = ({ figure, language, trailer }) => {
  const { tString } = useTranslation();
  const status = trailer.activeId === figure.id ? trailer.status : 'idle';
  const engaged = status === 'loading' || status === 'playing';
  const label = engaged
    ? tString('figures.trailerPause', 'Pause')
    : tString('figures.trailerPlay', 'Play intro');

  return (
    <div className={styles.figureHook}>
      {figure.learn && <p className={styles.learnLine}>{figure.learn}</p>}
      <button
        type="button"
        className={`${styles.trailerBtn} ${engaged ? styles.trailerBtnActive : ''}`}
        onClick={(e) => { e.stopPropagation(); trailer.toggle(figure.id, language); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
      >
        {engaged ? <Pause size={15} weight="fill" /> : <Play size={15} weight="fill" />}
        <span className={styles.trailerLabel}>{label}</span>
      </button>
    </div>
  );
};

interface PortraitFrameProps {
  figure: Figure;
  index: number;
  isActive?: boolean;
  isSelected?: boolean;
  onSelect?: (figure: Figure) => void;
  onHover?: (figureId: string) => void;
  onLeave?: () => void;
  onTextShown?: (figure: Figure) => void;
  className?: string;
  isMobile?: boolean;
  showName?: boolean;
  language?: string;
  trailer?: FigureTrailerControls;
  onDeselect?: () => void;
}

/**
 * Individual Portrait Frame Component
 */
const PortraitFrame: FC<PortraitFrameProps> = ({
  figure,
  index,
  isActive = false,
  isSelected = false,
  onHover,
  onLeave,
  onTextShown,
  className = '',
  isMobile = false,
  showName = true,
  language = 'en',
  trailer,
  onDeselect
}) => {
  const { t } = useTranslation();  // Used for aria-label
  const mountedRef = useRef(false);

  // CRITICAL: Always initialize to false - Chrome production rendering bug workaround
  const [showEssence, setShowEssence] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  // Force reset on mount (Chrome production mode workaround)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      setShowEssence(false);
    }
  }, []);

  // Reset state when figure changes (mobile navigation)
  useEffect(() => {
    setShowEssence(false);
    setImageLoaded(false);
  }, [figure.id]);

  const handleMouseEnter = useCallback(() => {
    if (!isMobile) {
      setShowEssence(true);
      onHover?.(figure.id);
    }
  }, [figure.id, onHover, isMobile]);

  const handleMouseLeave = useCallback(() => {
    if (!isMobile) {
      setShowEssence(false);
      onLeave?.();
    }
  }, [onLeave, isMobile]);

  const handleClick = useCallback(() => {
    if (isSelected) {
      // Second click/tap on the already-selected figure → revert.
      setShowEssence(false);
      onDeselect?.();
    } else {
      setShowEssence(true);
      onTextShown?.(figure);
    }
  }, [figure, isSelected, onTextShown, onDeselect]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  const shouldShowEssence = showEssence || isSelected;

  return (
    <div
      className={`${styles.portraitFrame} ${isActive ? styles.active : ''} ${isSelected ? styles.selected : ''} ${shouldShowEssence ? styles.showingEssence : ''} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={String(t('firstTime.selectWithName', { name: figure.name }))}
      style={{
        '--stagger-delay': `${index * 200}ms`,
        '--breath-delay': `${index * 1000}ms`
      } as CSSProperties}
    >
      {/* Liquid Glass Frame */}
      <div className={styles.glassFrame}>
        {/* Portrait Image */}
        <div className={styles.portraitContainer}>
          <OptimizedImage
            src={figure.id === 'dogen' ? 'zenji' : figure.id}
            type="ui"
            purpose="main"
            priority={index < 3}
            className={`${styles.portraitImage} ${imageLoaded ? styles.loaded : ''} ${figure.id === 'vinci' ? styles.flipped : ''}`}
            alt={figure.name}
            onLoad={() => setImageLoaded(true)}
          />

          {/* Museum Spotlight Effect */}
          <div className={styles.spotlight} />

          {/* Breathing Glow */}
          <div className={styles.breathingGlow} />
        </div>

        {/* About Text Overlay */}
        {shouldShowEssence && (
          <div className={styles.essenceOverlay}>
            <div className={styles.essenceText}>
              {figure.about ? figure.about.split('\n\n')[0] : FIGURE_ESSENCES[figure.id]}
            </div>
          </div>
        )}
        
        {/* Mobile Info Icon - Shows text is available */}
        {isMobile && !showEssence && (
          <div className={styles.mobileInfoIcon}>
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
          </div>
        )}
      </div>

      {/* Figure Name */}
      {showName && (
        <div className={styles.figureName}>
          {figure.name}
        </div>
      )}

      {/* Golden line + trailer — mobile only (desktop renders it in the name row) */}
      {showName && trailer && (
        <FigureHook figure={figure} language={language} trailer={trailer} />
      )}
    </div>
  );
};

interface WisdomGalleryModalProps {
  onSelectFigure: (figure: Figure) => void;
  onExploreAll: () => void;
  className?: string;
}

/**
 * Main Wisdom Gallery Modal
 */
const WisdomGalleryModal: FC<WisdomGalleryModalProps> = ({
  onSelectFigure,
  onExploreAll,
  className = ''
}) => {
  const { t, tNode, language } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);

  // Figure page trailer — standalone audio player (play-on-tap, never autoplay)
  const trailer = useFigureTrailer();

  // First visit tracking from Zustand
  const markAsVisited = useDomainStore((state) => state.markAsVisited);

  // Echo explainer helper — show once on first gallery visit
  const shouldShowHelp = useUIStore((state) => state.shouldShowHelp);
  const [showEchoHelp, setShowEchoHelp] = useState<boolean>(() => shouldShowHelp(ECHO_EXPLAINER_HELP_ID));

  const [figures, setFigures] = useState<Figure[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedFigure, setSelectedFigure] = useState<Figure | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );

  // Touch/swipe refs for mobile navigation (refs avoid re-renders on every touchmove)
  const touchStartRef = useRef<number>(0);
  const touchEndRef = useRef<number>(0);

  /**
   * Initialize figures data
   *
   * Figure translations load async from R2, but getHistoricalFigures is
   * synchronous. On a cold cache (a fresh reload that reaches the gallery
   * before anything warmed it) it hands back "Loading…" placeholders. Build
   * once for an instant paint, then warm the cache and rebuild with the real
   * about + learn text.
   */
  useEffect(() => {
    let cancelled = false;

    const buildFigures = () => {
      const allFigures = getHistoricalFigures(language);

      const galleryFigures = GALLERY_FIGURES.map((figureId) => {
        const baseFigure = allFigures.find((f: any) => f.id === figureId);

        if (!baseFigure) {
          console.error(`Gallery figure not found: ${figureId}`);
          return {
            id: figureId,
            name: `Missing: ${figureId}`,
            about: 'Figure data not available'
          };
        }

        return {
          ...baseFigure,
          id: figureId
        };
      });

      if (!cancelled) setFigures(galleryFigures);
    };

    buildFigures();

    Promise.all(
      GALLERY_FIGURES.map((figureId) => {
        const base = historicalFiguresBase.find((f) => f.id === figureId);
        return base
          ? loadFigureTranslation(base.baseNameEn, language)
          : Promise.resolve();
      })
    )
      .then(() => buildFigures())
      .catch(() => { /* placeholders stay shown — nothing else we can do */ });

    return () => { cancelled = true; };
  }, [language]);

  /**
   * Breakpoint listener via matchMedia (fires only at threshold, not every pixel)
   */
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Scroll lock via ref-counted hook
  useBodyScrollLock(true);

  // Stop any trailer when the mobile carousel moves to another figure.
  useEffect(() => {
    trailer.stop();
  }, [currentIndex, trailer.stop]);

  /**
   * Battery optimization - Track page visibility for performance
   * Following NowPlaying/Sidebar patterns
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.hidden;
      if (modalRef.current) {
        modalRef.current.setAttribute('data-visibility', isHidden ? 'hidden' : 'visible');
      }
    };

    // Set initial state
    if (modalRef.current) {
      modalRef.current.setAttribute('data-visibility', document.hidden ? 'hidden' : 'visible');
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  /**
   * Keyboard navigation (no escape - user must commit!)
   */
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft':
          if (isMobile) {
            event.preventDefault();
            setCurrentIndex(prev =>
              prev > 0 ? prev - 1 : figures.length - 1
            );
            setSelectedFigure(null);
          }
          break;
        case 'ArrowRight':
          if (isMobile) {
            event.preventDefault();
            setCurrentIndex(prev =>
              prev < figures.length - 1 ? prev + 1 : 0
            );
            setSelectedFigure(null);
          }
          break;
        case 'Tab': {
          // Focus trap within the gallery modal
          const container = modalRef.current;
          if (!container) break;
          const focusable = container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) { event.preventDefault(); break; }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
            event.preventDefault();
            first.focus();
          }
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, figures.length]);

  /**
   * Focus management
   */
  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.focus();
    }
  }, []);

  /**
   * Handle figure selection
   */
  const handleFigureSelect = useCallback((figure: Figure) => {
    markAsVisited(figure.id);
    onSelectFigure(figure);
  }, [markAsVisited, onSelectFigure]);

  /**
   * Handle explore all
   */
  const handleExploreAll = useCallback(() => {
    markAsVisited(); // Mark as visited without specific selection
    onExploreAll();
  }, [markAsVisited, onExploreAll]);

  /**
   * Handle mobile text shown
   */
  const handleTextShown = useCallback((figure: Figure) => {
    setSelectedFigure(figure);
  }, []);

  /**
   * Revert selection — second click/tap on the chosen figure
   */
  const handleDeselect = useCallback(() => {
    setSelectedFigure(null);
  }, []);

  /**
   * No close function - user must commit to a choice!
   */

  /**
   * Mobile navigation
   */
  const handlePrevious = useCallback(() => {
    setCurrentIndex(prev => prev > 0 ? prev - 1 : figures.length - 1);
    setSelectedFigure(null); // Reset when navigating
  }, [figures.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => prev < figures.length - 1 ? prev + 1 : 0);
    setSelectedFigure(null); // Reset when navigating
  }, [figures.length]);

  /**
   * Touch/Swipe handlers for mobile carousel navigation
   * 2025 best practice: Minimum 50px swipe distance to prevent accidental triggers
   */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = e.targetTouches[0].clientX;
    touchEndRef.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndRef.current = e.targetTouches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !touchEndRef.current) return;

    const swipeDistance = touchStartRef.current - touchEndRef.current;
    const minSwipeDistance = 50; // Minimum 50px for intentional swipe

    if (Math.abs(swipeDistance) < minSwipeDistance) return;

    if (swipeDistance > 0) {
      handleNext();
    } else {
      handlePrevious();
    }

    touchStartRef.current = 0;
    touchEndRef.current = 0;
  }, [handleNext, handlePrevious]);

  /**
   * Render desktop gallery (triptych) with name row
   */
  const renderDesktopGallery = () => (
    <div className={styles.desktopGallery}>
      <div className={styles.portraitGrid}>
        {figures.map((figure, index) => (
          <PortraitFrame
            key={figure.id}
            figure={figure}
            index={index}
            isSelected={selectedFigure?.id === figure.id}
            onTextShown={handleTextShown}
            onDeselect={handleDeselect}
            className={styles.desktopPortrait}
            isMobile={false}
            showName={false}
          />
        ))}
      </div>

      {/* Name Row — name + golden line + trailer for each of the 3 figures */}
      <div className={styles.nameActionRow}>
        {figures.map((figure) => (
          <div key={figure.id} className={styles.nameActionCell}>
            <span className={styles.nameLabel}>{figure.name}</span>
            <FigureHook figure={figure} language={language} trailer={trailer} />
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Render mobile carousel
   */
  const renderMobileCarousel = () => {
    const currentFigure = figures[currentIndex];
    if (!currentFigure) return null;

    return (
      <div
        className={styles.mobileCarousel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Bar Indicators — hidden when figure selected to reclaim space */}
        {!selectedFigure && (
          <div className={styles.barIndicators} aria-hidden="true">
            {figures.map((_, index) => (
              <button
                key={index}
                type="button"
                className={`${styles.bar} ${index === currentIndex ? styles.activeBar : ''}`}
                onClick={() => { setCurrentIndex(index); setSelectedFigure(null); }}
                aria-label={`Go to figure ${index + 1}`}
              />
            ))}
          </div>
        )}

        <PortraitFrame
          figure={currentFigure}
          index={currentIndex}
          isActive={true}
          isSelected={selectedFigure?.id === currentFigure.id}
          onTextShown={handleTextShown}
          onDeselect={handleDeselect}
          className={styles.mobilePortrait}
          isMobile={true}
          language={language}
          trailer={trailer}
        />
      </div>
    );
  };

  if (figures.length === 0) return null;

  return createPortal(
    <div
      ref={modalRef}
      className={`${styles.modal} ${className}`}
      role="dialog"
      aria-modal="true"
      aria-label={String(t('firstTime.title'))}
      tabIndex={-1}
    >
      {/* Cosmic Background */}
      <div className={styles.cosmicBackground} />

      {/* Gallery Content */}
      <div className={styles.galleryContent}>
        {/* Header */}
        <ModalHeader
          layout="simple"
          title={tNode('firstTime.title') || 'Choose Your First Guide'}
          cosmicStars={true}
          showCloseButton={false}
          ariaLabel={String(t('firstTime.title'))}
        />

        {/* Portrait Gallery */}
        <div className={styles.galleryMain}>
          {isMobile ? renderMobileCarousel() : renderDesktopGallery()}
        </div>

        {/* Actions — Select button when figure selected */}
        <div className={styles.galleryActions}>
          {selectedFigure && (
            <Button
              variant="gold"
              size="medium"
              onClick={() => handleFigureSelect(selectedFigure)}
              className={styles.actionButton}
              fullWidth={isMobile}
            >
              {tNode('figures.select')}
            </Button>
          )}
          {/* "Meet Others" gives way to "Select" once a figure is picked */}
          {!selectedFigure && (
            <Button
              variant="ghost"
              onClick={handleExploreAll}
              size={isMobile ? 'large' : 'medium'}
              fullWidth={isMobile}
              className={styles.exploreButton}
            >
              {tNode('firstTime.exploreAll')}
            </Button>
          )}
        </div>
      </div>

      {/* Echo explainer — auto-shows on first visit */}
      {showEchoHelp && (
        <EchoExplainerHelp onDismiss={() => setShowEchoHelp(false)} />
      )}
    </div>,
    document.body
  );
};

export default WisdomGalleryModal;