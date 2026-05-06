/**
 * AudioLibraryModal - 2025 Modernized Audio Library
 *
 * Built on improved architecture:
 * - Full-width content (no left-shift issues)
 * - Elegant navigation with arrow buttons
 * - Optimized vertical spacing for mobile
 * - Spotify-style one-click playback
 * - Premium centered layout
 */

import React, { useState, useEffect, useRef, FC } from 'react';
import ReactDOM from 'react-dom';
import { ModalContainer, ModalHeader } from '../Modal';
import OptimizedFigureImage from '../OptimizedFigureImage';
import StoryCollection from './StoryCollection';
import NowPlayingView from './NowPlayingView';
import MiniPlayer from './MiniPlayer';
import { getHistoricalFigures } from '../../api/figures';
import { introductionAudioService } from '../../services/IntroductionAudioService';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { useTranslation } from '../../hooks/useTranslation';
import { useUIStore } from '../../stores/uiStore';
import HelperPopup from '../HelperPopup/HelperPopup';
import { CaretLeft, CaretRight, Sparkle, BookOpen, Info, CaretDown, CaretUp, Play, TrendUp, Trophy } from '@phosphor-icons/react';
import { Story } from '../../types/global';
import './AudioLibraryModal.css';

interface Figure {
  id: string;
  name: string;
  image?: string;
  imageKey?: string;
  [key: string]: any;
}

interface AudioLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFigure?: Figure | null;
}

interface PlaybackState {
  isPlaying: boolean;
  story?: Story;
  [key: string]: any;
}

const getLastName = (fullName: string): string => {
  if (!fullName) return '';

  const nameWithoutEcho = fullName
    .replace(/^Echo of /i, '')
    .replace(/^Echo von /i, '')
    .replace(/^Echo de /i, '')
    .trim();

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
  };

  for (const [full, last] of Object.entries(specialCases)) {
    if (nameWithoutEcho.includes(full)) {
      return last;
    }
  }

  return nameWithoutEcho.split(' ').pop() || '';
};

const AudioLibraryModal: FC<AudioLibraryModalProps> = ({
  isOpen,
  onClose,
  selectedFigure: propSelectedFigure
}) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(7);
  const [activeView, setActiveView] = useState<'collection' | 'nowPlaying'>('collection');
  const [selectedFigure, setSelectedFigure] = useState<Figure | null>(null);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<Figure | null>(null);
  const [showMiniPlayer, setShowMiniPlayer] = useState<boolean>(true);
  const { triggerHaptic } = useHapticFeedback();
  const { t, tString, tNode, language } = useTranslation();
  const historicalFigures = React.useMemo(() => getHistoricalFigures(language), [language]);
  const shouldShowHelp = useUIStore((state) => state.shouldShowHelp);
  const dismissHelp = useUIStore((state) => state.dismissHelp);
  const [showAudioHelp, setShowAudioHelp] = useState<boolean>(false);
  const [showFullDisclaimer, setShowFullDisclaimer] = useState<boolean>(false);

  const figures: Figure[] = historicalFigures.map(fig => ({
    ...fig,
    imageKey: fig.id
  }));

  useEffect(() => {
    if (isOpen && shouldShowHelp('audioLibraryHelp')) {
      setShowAudioHelp(true);
    }
  }, [isOpen, shouldShowHelp]);

  useEffect(() => {
    if (isOpen) {
      let initialFigure = propSelectedFigure;
      if (!initialFigure) {
        const savedFigureId = localStorage.getItem('selectedFigure');
        initialFigure = savedFigureId
          ? historicalFigures.find(fig => fig.id === savedFigureId)
          : historicalFigures[0];
      }
      if (initialFigure && !initialFigure.imageKey) {
        initialFigure.imageKey = initialFigure.id;
      }
      setSelectedFigure(initialFigure ?? null);
      // Only restore NowPlaying if audio is actively playing (not after a close/stop)
      const currentPlayback = introductionAudioService.getCurrentPlayback();
      const playbackState = introductionAudioService.getPlaybackState();
      if (currentPlayback && playbackState.isPlaying) {
        setCurrentStory(currentPlayback.story as any);
        setCurrentlyPlaying(initialFigure ?? null);
        setActiveView('nowPlaying');
      }
      setupMediaSession();
      document.body.classList.add('audio-library-open');
    } else {
      document.body.classList.remove('audio-library-open');
    }
    return () => {
      document.body.classList.remove('audio-library-open');
    };
  }, [isOpen, propSelectedFigure]);

  useEffect(() => {
    if (activeView === 'collection') {
      setShowMiniPlayer(true);
    } else {
      setShowMiniPlayer(false);
    }
  }, [activeView]);

  useEffect(() => {
    if (!introductionAudioService) return;
    const handlePlaybackUpdate = (state: PlaybackState) => {
      if (state.isPlaying && selectedFigure) {
        setCurrentlyPlaying(selectedFigure);
      } else if (!state.isPlaying) {
        setCurrentlyPlaying(null);
      }
    };
    introductionAudioService.on('playbackUpdate', handlePlaybackUpdate);
    return () => {
      introductionAudioService.off('playbackUpdate', handlePlaybackUpdate);
    };
  }, [selectedFigure]);

  // Calculate how many figures fit in the carousel (like MiniFigureCarousel)
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>;

    const updateVisibleCount = (): void => {
      if (carouselRef.current) {
        const containerWidth = carouselRef.current.offsetWidth;
        const screenWidth = window.innerWidth;

        // Match responsive figure sizes from CSS + gap
        let cardWidth: number;
        if (screenWidth <= 480) {
          cardWidth = 70 + 12; // 70px avatar + gap
        } else if (screenWidth <= 768) {
          cardWidth = 90 + 20; // 90px avatar + gap
        } else {
          cardWidth = 100 + 24; // 100px avatar + gap
        }

        const navSpace = screenWidth <= 480 ? 100 : 120; // space for both nav buttons
        const available = containerWidth - navSpace;
        const count = Math.floor(available / cardWidth);

        // Keep odd number so selected figure is exactly centered
        const minVisible = screenWidth <= 480 ? 3 : 5;
        const maxVisible = screenWidth <= 480 ? 7 : screenWidth <= 768 ? 9 : 11;
        const clamped = Math.max(minVisible, Math.min(count, maxVisible));
        setVisibleCount(clamped % 2 === 0 ? clamped - 1 : clamped);
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

  const handleFigureSelect = (figure: Figure) => {
    triggerHaptic('light');
    setSelectedFigure(figure);
    localStorage.setItem('selectedFigure', figure.id);
  };

  const handlePrevious = () => {
    if (!selectedFigure) return;
    const idx = figures.findIndex(f => f.id === selectedFigure.id);
    const prevIndex = (idx - 1 + figures.length) % figures.length;
    handleFigureSelect(figures[prevIndex]);
  };

  const handleNext = () => {
    if (!selectedFigure) return;
    const idx = figures.findIndex(f => f.id === selectedFigure.id);
    const nextIndex = (idx + 1) % figures.length;
    handleFigureSelect(figures[nextIndex]);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedFigure, figures]);

  const handlePlayStory = (story: Story): void => {
    triggerHaptic('medium');
    if (currentStory && currentStory.id !== story.id) {
      introductionAudioService.addToHistory(currentStory);
    }
    const figureName = selectedFigure?.name || '';
    setCurrentStory(story);
    introductionAudioService.play(story, figureName);
    setCurrentlyPlaying(selectedFigure);
    setActiveView('nowPlaying');

    // Resume from saved progress once audio is ready
    const progressKey = `storyProgress_${story.figureId}_${story.seedId}_${story.language || 'en'}`;
    try {
      const saved = localStorage.getItem(progressKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lastTimeSeconds > 10) {
          const handleReady = (state: PlaybackState): void => {
            if (state.duration && state.duration > 0) {
              // Unsubscribe BEFORE seeking to avoid seek→emit→handleReady loop
              introductionAudioService.off('playbackUpdate', handleReady);
              const seekPercent = (parsed.lastTimeSeconds / state.duration) * 100;
              introductionAudioService.seek(Math.min(Math.max(seekPercent, 0), 100));
            }
          };
          introductionAudioService.on('playbackUpdate', handleReady);
          // Safety: remove listener after 10s
          setTimeout(() => introductionAudioService.off('playbackUpdate', handleReady), 10000);
        }
      }
    } catch { /* ignore */ }
  };

  const setupMediaSession = (): void => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => introductionAudioService.resume());
      navigator.mediaSession.setActionHandler('pause', () => introductionAudioService.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => introductionAudioService.playNext());
      navigator.mediaSession.setActionHandler('previoustrack', () => introductionAudioService.playPrevious());

      // ±15s skip from lock screen
      const handleSeekBy = (offset: number): void => {
        const state = introductionAudioService.getPlaybackState();
        if (state.duration && state.duration > 0) {
          const newTime = (state.currentTime ?? 0) + offset;
          const newProgress = (newTime / state.duration) * 100;
          introductionAudioService.seek(Math.min(Math.max(newProgress, 0), 100));
        }
      };

      try {
        navigator.mediaSession.setActionHandler('seekbackward', () => handleSeekBy(-15));
        navigator.mediaSession.setActionHandler('seekforward', () => handleSeekBy(15));
      } catch {
        // seekbackward/seekforward not supported in all browsers
      }
    }
  };

  const handleViewChange = (view: 'collection' | 'nowPlaying'): void => {
    triggerHaptic('light');
    if (view === 'collection') {
      setShowMiniPlayer(false);
      setActiveView(view);
      setTimeout(() => setShowMiniPlayer(true), 50);
    } else {
      setShowMiniPlayer(false);
      setActiveView(view);
    }
  };

  const handleClose = (): void => {
    triggerHaptic('medium');
    // Fully stop playback and reset all state so NowPlayingView unmounts cleanly
    introductionAudioService.stop();
    setCurrentStory(null);
    setCurrentlyPlaying(null);
    setActiveView('collection');
    onClose();
  };

  const handleDontShowAudioHelp = (): void => {
    dismissHelp('audioLibraryHelp');
  };

  const selectedIndex = selectedFigure ? figures.findIndex(f => f.id === selectedFigure.id) : 0;

  // Build visible window centered on selected figure (modulo looping)
  const centerOffset = Math.floor(visibleCount / 2);
  const visibleFigures = Array.from(
    { length: Math.min(visibleCount, figures.length) },
    (_, i) => {
      const idx = (selectedIndex - centerOffset + i + figures.length) % figures.length;
      return figures[idx];
    }
  );

  if (!isOpen) return null;

  const helperContent = (
    <div>
      <div style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--gold-subtle) 8%, transparent), color-mix(in srgb, var(--gold-subtle) 3%, transparent))', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', border: '1px solid color-mix(in srgb, var(--gold-subtle) 15%, transparent)' }}>
        <h4 style={{ color: 'var(--gold-subtle)', marginBottom: '0.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          <Sparkle size={18} style={{ color: 'var(--gold-subtle)' }} />
          {tNode('helpers.audioLibrary.welcome.sections.overview.title')}
        </h4>
        <p style={{ margin: 0, opacity: 0.9, paddingLeft: '26px', lineHeight: 1.5 }}>
          {tNode('helpers.audioLibrary.welcome.sections.overview.text')}
        </p>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ color: 'var(--gold-subtle)', marginBottom: '0.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          <BookOpen size={18} style={{ color: 'var(--gold-subtle)' }} />
          {tNode('helpers.audioLibrary.welcome.sections.journey.title')}
        </h4>
        <ul style={{ margin: 0, paddingLeft: '26px', opacity: 0.9, fontSize: '0.9rem', listStyle: 'none' }}>
          {Array.isArray(t('helpers.audioLibrary.welcome.sections.journey.points')) ?
            (t('helpers.audioLibrary.welcome.sections.journey.points') as string[]).map((point, i) => {
              const icons = [Play, TrendUp, Trophy];
              const Icon = icons[i];
              return (
                <li key={i} style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {Icon && <Icon size={14} style={{ color: 'var(--gold-subtle)', opacity: 0.7, flexShrink: 0 }} />}
                  <span>{point}</span>
                </li>
              );
            }) : null}
        </ul>
      </div>
      <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'color-mix(in srgb, var(--gold-subtle) 5%, transparent)', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--gold-subtle) 20%, transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: showFullDisclaimer ? '0.5rem' : 0, cursor: 'pointer' }} onClick={() => setShowFullDisclaimer(!showFullDisclaimer)}>
          <Info size={16} style={{ color: 'var(--gold-subtle)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold-subtle)' }}>
            {tNode('helpers.audioLibrary.welcome.sections.transparency.title')}
          </span>
          {showFullDisclaimer ? <CaretUp size={16} style={{ marginLeft: 'auto', color: 'var(--gold-subtle)' }} /> : <CaretDown size={16} style={{ marginLeft: 'auto', color: 'var(--gold-subtle)' }} />}
        </div>
        {!showFullDisclaimer ? (
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8, paddingLeft: '21px' }}>
            {tNode('helpers.audioLibrary.welcome.sections.transparency.brief')}
          </p>
        ) : (
          <div style={{ paddingLeft: '21px' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9, lineHeight: 1.5 }}>
              {tNode('helpers.audioLibrary.welcome.sections.transparency.expanded')}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {ReactDOM.createPortal(
        <ModalContainer
          isOpen={isOpen}
          onClose={handleClose}
          animationType="fade-scale"
          backgroundVariant="fullscreen"
          modalType="immersive"
        >
          <div className="audio-library">
            {activeView !== 'nowPlaying' && (
              <ModalHeader
                layout="three-column"
                title={tString('audioLibrary.title', 'STORIES')}
                onClose={handleClose}
                closeAriaLabel="Close audio library"
                cosmicStars={true}
              />
            )}

            {activeView !== 'nowPlaying' && (
              <div className="audio-library__carousel-section">
                <button
                  className="audio-library__nav-button audio-library__nav-button--left"
                  onClick={handlePrevious}
                  aria-label="Previous figure"
                >
                  <CaretLeft size={32} weight="bold" />
                </button>

                <div ref={carouselRef} className="audio-library__carousel" role="tablist" aria-label="Select a historical figure">
                  {visibleFigures.map((figure) => {
                    const isSelected = selectedFigure?.id === figure.id;
                    const isPlaying = currentlyPlaying?.id === figure.id;
                    return (
                      <button
                        key={figure.id}
                        className={`audio-library__figure-item ${isSelected ? 'audio-library__figure-item--selected' : ''} ${isPlaying ? 'audio-library__figure-item--playing' : ''}`}
                        onClick={() => handleFigureSelect(figure)}
                        role="tab"
                        aria-selected={isSelected}
                      >
                        <div className="audio-library__figure-avatar">
                          <OptimizedFigureImage
                            figure={{ imageKey: figure.imageKey }}
                            type="thumbnail"
                            alt={figure.name}
                            isActive={isSelected}
                            isPlaying={isPlaying}
                          />
                        </div>
                        <span className="audio-library__figure-name">{getLastName(figure.name)}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  className="audio-library__nav-button audio-library__nav-button--right"
                  onClick={handleNext}
                  aria-label="Next figure"
                >
                  <CaretRight size={32} weight="bold" />
                </button>
              </div>
            )}

            <div className="audio-library__content">
              {activeView === 'nowPlaying' && currentStory && (
                <NowPlayingView
                  story={currentStory}
                  figure={(selectedFigure ?? undefined) as any}
                  audioService={introductionAudioService as any}
                  onBackClick={() => handleViewChange('collection')}
                />
              )}

              {activeView === 'collection' && (
                <StoryCollection
                  figure={selectedFigure}
                  currentStory={currentStory}
                  onPlayStory={handlePlayStory}
                />
              )}
            </div>

            {showAudioHelp && (
              <HelperPopup
                isOpen={true}
                onDismiss={() => {
                  setShowAudioHelp(false);
                  setShowFullDisclaimer(false);
                }}
                title={tString('helpers.audioLibrary.welcome.title', 'Welcome to Audio Library').replace('🎧 ', '')}
                content={helperContent}
                buttonText={tString('helpers.common.beginExploring', 'Begin Exploring')}
                showDontAskAgain={true}
                onDontAskAgain={handleDontShowAudioHelp}
              />
            )}
          </div>
        </ModalContainer>,
        document.body
      )}

      {currentStory && activeView === 'collection' && showMiniPlayer && introductionAudioService && ReactDOM.createPortal(
        <div className="mobile-mini-player-container">
          <MiniPlayer
            story={currentStory}
            figure={(currentlyPlaying || selectedFigure) ?? undefined}
            audioService={introductionAudioService as any}
            onExpand={() => handleViewChange('nowPlaying')}
          />
        </div>,
        document.body
      )}
    </>
  );
};

export default AudioLibraryModal;
