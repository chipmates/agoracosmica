// src/components/AudioLibrary/NowPlayingView.tsx
import React, { FC, useState, useEffect, useRef, useCallback, ChangeEvent, MouseEvent } from 'react';
import { Play, Pause, ClockCounterClockwise, ClockClockwise, SkipBack, SkipForward } from '@phosphor-icons/react';
import OptimizedImage from '../OptimizedImage';
import { CloseButton } from '../Button';
import useTranslation from '../../hooks/useTranslation';
import { useLiquidGlass } from '../../hooks/useLiquidGlass';
import { Story } from '../../types/global';
import { markStoryCompleted } from '../../utils/storageKeysV2';
import './NowPlayingView.css';

interface Figure {
  id?: string;
  name?: string;
  // Add other figure properties as needed
}

interface PlaybackState {
  isPlaying: boolean;
  progress?: number;
  currentTime?: number;
  duration?: number;
  playbackRate?: number;
}

interface CurrentPlayback {
  story?: Story;
  figureName?: string;
}

interface AudioService {
  getCurrentPlayback: () => CurrentPlayback | null;
  getPlaybackState: () => PlaybackState;
  togglePlayback: () => void;
  seek: (progress: number) => void;
  playPrevious: () => void;
  playNext: () => void;
  setPlaybackRate: (rate: number) => void;
  on: (event: string, handler: (data?: any) => void) => void;
  off: (event: string, handler: (data?: any) => void) => void;
}

interface NowPlayingViewProps {
  story: Story;
  figure: Figure;
  audioService: AudioService;
  onBackClick: () => void;
}

const NowPlayingView: FC<NowPlayingViewProps> = ({ story, figure, audioService, onBackClick }) => {
  // Core audio state - single source of truth from the service
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const { tString, tNode } = useTranslation();
  const { glassClasses } = useLiquidGlass('audio');
  
  // Helper function to get figure display name with proper Echo translation
  const getFigureDisplayName = (fullName: string): string => {
    if (!fullName) return '';
    
    // Extract the base name without Echo prefix
    const baseName = fullName
      .replace(/^Echo of /i, '')
      .replace(/^Echo von /i, '')
      .replace(/^Echo de /i, '')
      .trim();
    
    // Return with translated Echo prefix
    return tString('figures.echoOfName', `Echo of ${baseName}`).replace('{name}', baseName);
  };
  
  // UI state
  const [showControls, setShowControls] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  
  // 2025 Battery optimization: Track page visibility for lock screen efficiency
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);
  
  // Refs
  const progressRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const playPauseDebounceRef = useRef(false);
  const durationSecondsRef = useRef(0);
  const currentTimeSecondsRef = useRef(0);
  const hasResumedRef = useRef<string>(''); // Track which story we've already resumed

  // 2025 Optimized inactivity timeouts for battery efficiency (in ms)
  const MOBILE_TIMEOUT = 4000;   // 4 seconds for mobile - touch interface needs time
  const TABLET_TIMEOUT = 4500;   // 4.5 seconds for tablet - hybrid interface  
  const DESKTOP_TIMEOUT = 3000;  // 3 seconds for desktop - mouse precision allows shorter time
  
  // Handle window resize to detect device type - with throttling
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    
    const handleResize = (): void => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const width = window.innerWidth;
        setIsMobile(width < 768);
        setIsTablet(width >= 768 && width < 1024);
        setIsDesktop(width >= 1024);
      }, 100); // 100ms throttle
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);
  
  // 2025 Page Visibility API - Ultimate battery optimization for lock screen usage
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      const visible = !document.hidden;
      setIsPageVisible(visible);
    };
    
    const handleFocus = (): void => setIsPageVisible(true);
    const handleBlur = (): void => setIsPageVisible(false);
    
    // Listen for page visibility changes (screen lock, tab switch, etc.)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also handle window focus/blur for additional coverage
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);
  
  // Format time helper
  const formatTime = useCallback((seconds: number): string => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);
  
  // Track current story directly from service (instead of props)
  const [currentStory, setCurrentStory] = useState<Story>(story);
  const [currentFigure, setCurrentFigure] = useState<Figure>(figure);
  const [isLoading, setIsLoading] = useState(false);
  
  // Listen for track changes and update local state
  useEffect(() => {
    if (!audioService) return;
    
    const handleTrackChange = (): void => {
      const playback = audioService.getCurrentPlayback();
      if (playback && playback.story) {
        setCurrentStory(playback.story);
        // Get figure info if needed and it exists
        if (playback.figureName) {
          // Create a copy of the figure with the updated name
          setCurrentFigure({
            ...figure,
            name: playback.figureName,
            // Keep other figure properties but update name to match current track
          });
        }
      }
    };
    
    const handleLoadingChange = (loading: boolean): void => {
      setIsLoading(loading);
    };
    
    // Initialize with current data from service, not just props
    const playback = audioService.getCurrentPlayback();
    if (playback && playback.story) {
      setCurrentStory(playback.story);
      if (playback.figureName) {
        setCurrentFigure({
          ...figure,
          name: playback.figureName,
        });
      }
    } else {
      // Fall back to props if no current playback
      setCurrentStory(story);
      setCurrentFigure(figure);
    }
    
    // Subscribe to track change events
    audioService.on('trackChange', handleTrackChange);
    audioService.on('loadingChange', handleLoadingChange);
    
    return () => {
      audioService.off('trackChange', handleTrackChange);
      audioService.off('loadingChange', handleLoadingChange);
    };
  }, [audioService, story, figure]);
  
  // ── Cross-player progress sync (shared with StoryPlayer) ──
  const getProgressKey = useCallback((s: Story): string | null => {
    if (!s?.figureId || !s?.seedId) return null;
    return `storyProgress_${s.figureId}_${s.seedId}_${s.language || 'en'}`;
  }, []);

  const saveProgress = useCallback(() => {
    const key = getProgressKey(currentStory);
    if (!key || currentTimeSecondsRef.current < 5) return;
    try {
      localStorage.setItem(key, JSON.stringify({
        lastTimeSeconds: currentTimeSecondsRef.current,
        lastParagraphIndex: 0,
        updatedAt: new Date().toISOString()
      }));
      window.dispatchEvent(new CustomEvent('storyProgressUpdated', { detail: { key } }));
    } catch { /* localStorage full — ignore */ }
  }, [currentStory, getProgressKey]);

  // Save every 5s while playing
  useEffect(() => {
    if (!isPlaying || currentTimeSecondsRef.current < 1) return;
    const timer = setInterval(saveProgress, 5000);
    return () => clearInterval(timer);
  }, [isPlaying, saveProgress]);

  // Save on pause
  useEffect(() => {
    if (!isPlaying && currentTimeSecondsRef.current > 5) {
      saveProgress();
    }
  }, [isPlaying, saveProgress]);

  // Save on unmount
  useEffect(() => {
    return () => { saveProgress(); };
  }, [saveProgress]);

  // Clear progress when playback reaches the end
  // Track completion via state instead of running on every render
  const [reachedEnd, setReachedEnd] = useState(false);

  // Detect end inside the playback update handler (via effect on progress)
  useEffect(() => {
    if (durationSecondsRef.current > 0 && currentTimeSecondsRef.current > 0 &&
        currentTimeSecondsRef.current >= durationSecondsRef.current - 1) {
      if (!reachedEnd) setReachedEnd(true);
    }
  }, [progress, reachedEnd]);

  useEffect(() => {
    if (reachedEnd) {
      const key = getProgressKey(currentStory);
      if (key) {
        try { localStorage.removeItem(key); } catch {}
      }
      // Mark story mode as completed for this seed's progress bar
      if (currentStory?.figureId && currentStory?.seedId) {
        markStoryCompleted(currentStory.figureId, currentStory.seedId);
      }
      // Notify StoryCollection so its progress bar updates to completed
      if (key) {
        window.dispatchEvent(new CustomEvent('storyProgressUpdated', { detail: { key } }));
      }
    }
  }, [reachedEnd, getProgressKey, currentStory]);

  // Resume from saved position when duration becomes available
  const tryResumeFromSaved = useCallback(() => {
    if (!audioService || !currentStory || durationSecondsRef.current <= 0) return;
    const storyKey = `${currentStory.figureId}-${currentStory.seedId}`;
    if (hasResumedRef.current === storyKey) return;

    const key = getProgressKey(currentStory);
    if (!key) return;

    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lastTimeSeconds > 10) {
          const seekPercent = (parsed.lastTimeSeconds / durationSecondsRef.current) * 100;
          audioService.seek(Math.min(Math.max(seekPercent, 0), 100));
        }
      }
    } catch { /* corrupt data — ignore */ }
    hasResumedRef.current = storyKey;
  }, [audioService, currentStory, getProgressKey]);

  useEffect(() => {
    if (duration !== '0:00') {
      tryResumeFromSaved();
    }
  }, [duration, tryResumeFromSaved]);

  // Listen for progress updates from StoryPlayer
  useEffect(() => {
    const key = getProgressKey(currentStory);
    if (!key) return;

    const handleExternalProgress = (e: Event): void => {
      const detail = (e as CustomEvent).detail;
      if (detail?.key !== key) return;
      if (isPlaying) return; // Don't override while playing

      // Reset resume flag so next tryResume will work
      hasResumedRef.current = '';
      tryResumeFromSaved();
    };

    window.addEventListener('storyProgressUpdated', handleExternalProgress);
    return () => window.removeEventListener('storyProgressUpdated', handleExternalProgress);
  }, [currentStory, getProgressKey, isPlaying, tryResumeFromSaved]);

  // Track when we manually change the playback state to prevent race conditions
  const manualStateChangeRef = useRef(false);
  
  // Synchronize with audio service - THE CORE OF THE IMPLEMENTATION
  useEffect(() => {
    if (!audioService || !currentStory) return;
    
    // Initial state synchronization
    const initState = (): void => {
      const playbackState = audioService.getPlaybackState();
      
      setIsPlaying(playbackState.isPlaying);
      setProgress(playbackState.progress || 0);
      setPlaybackRate(playbackState.playbackRate || 1.0);

      if (playbackState.currentTime != null) {
        setCurrentTime(formatTime(playbackState.currentTime));
        currentTimeSecondsRef.current = playbackState.currentTime;
      }

      if (playbackState.duration != null) {
        setDuration(formatTime(playbackState.duration));
        durationSecondsRef.current = playbackState.duration;
      }

      // Update progress bar visual directly
      if (progressRef.current) {
        progressRef.current.style.setProperty(
          '--progress-percent', 
          `${isNaN(playbackState.progress || 0) ? 0 : playbackState.progress}%`
        );
      }
    };
    
    // Initialize state
    initState();
    
    // Set up listeners for state changes
    const handlePlaybackUpdate = (state: PlaybackState): void => {
      // If we've just manually changed the play state, don't let the event override our state
      // This prevents race conditions with the button UI
      if (manualStateChangeRef.current) {
        // However, still update other properties like progress
        setProgress(state.progress || 0);

        if (state.currentTime != null) {
          setCurrentTime(formatTime(state.currentTime));
          currentTimeSecondsRef.current = state.currentTime;
        }

        if (state.duration != null) {
          setDuration(formatTime(state.duration));
          durationSecondsRef.current = state.duration;
        }

        // Update progress bar visual directly
        // 2025 Battery optimization: Skip visual updates when page is hidden
        if (progressRef.current && isPageVisible) {
          progressRef.current.style.setProperty(
            '--progress-percent',
            `${isNaN(state.progress || 0) ? 0 : state.progress}%`
          );
        }
      } else {
        // Normal update when no manual change was made
        setIsPlaying(state.isPlaying);
        setProgress(state.progress || 0);

        if (state.currentTime != null) {
          setCurrentTime(formatTime(state.currentTime));
          currentTimeSecondsRef.current = state.currentTime;
        }

        if (state.duration != null) {
          setDuration(formatTime(state.duration));
          durationSecondsRef.current = state.duration;
        }

        // Update progress bar visual directly
        if (progressRef.current) {
          progressRef.current.style.setProperty(
            '--progress-percent', 
            `${isNaN(state.progress || 0) ? 0 : state.progress}%`
          );
        }
      }
    };
    
    const handleRateChange = (rate: number): void => {
      setPlaybackRate(rate);
    };
    
    // Subscribe to audio service events
    audioService.on('playbackUpdate', handlePlaybackUpdate);
    audioService.on('rateChange', handleRateChange);
    
    // Clean up listeners
    return () => {
      audioService.off('playbackUpdate', handlePlaybackUpdate);
      audioService.off('rateChange', handleRateChange);
    };
  }, [audioService, currentStory, formatTime, isPageVisible]);
  
  // Auto-hide controls after inactivity
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      return;
    }
    
    // Determine the appropriate timeout based on device type
    let inactivityTimeout: number;
    if (isDesktop) {
      inactivityTimeout = DESKTOP_TIMEOUT;
    } else if (isTablet) {
      inactivityTimeout = TABLET_TIMEOUT;
    } else {
      inactivityTimeout = MOBILE_TIMEOUT;
    }
    
    let hideTimeout: NodeJS.Timeout | undefined;
    const resetTimer = (): void => {
      if (hideTimeout) clearTimeout(hideTimeout);
      setShowControls(true);
      hideTimeout = setTimeout(() => setShowControls(false), inactivityTimeout);
    };
    
    resetTimer();
    
    const handleUserActivity = (): void => resetTimer();
    
    // Handle touch end for mobile/tablet - restart the hide timer
    const handleTouchEnd = (): void => {
      // On touch devices, restart the timer after touch ends
      resetTimer();
    };
    
    // 2025 Battery optimization: Don't run auto-hide when page is hidden
    if (!isPageVisible) {
      if (hideTimeout) clearTimeout(hideTimeout);
      return () => {}; // Early return to skip all event listeners when page hidden
    }
    
    // Show controls on any user interaction
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('touchend', handleTouchEnd); // Critical for mobile
    window.addEventListener('keydown', handleUserActivity);
    
    // Note: Removed the "smart detection" that was causing the ugly intermediate state
    // Controls now hide/show as a complete unit for cleaner UX
    
    return () => {
      if (hideTimeout) clearTimeout(hideTimeout);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleUserActivity);
    };
  }, [isPlaying, isDesktop, isTablet, isMobile, isPageVisible]);
  
  // ESC key handler to close the now playing view
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onBackClick();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onBackClick]);
  
  // Use formatTime from the callback defined above
  
  // Play/pause handler using the togglePlayback method
  const handlePlayPause = useCallback((): void => {
    if (!audioService || isLoading) return; // Don't toggle if still loading
    
    // Microdebounce (50ms) to prevent double-clicks
    if (playPauseDebounceRef.current) return;
    playPauseDebounceRef.current = true;
    
    try {
      // Set flag to prevent event interference
      manualStateChangeRef.current = true;
      
      // Update UI immediately
      setIsPlaying(!isPlaying);
      
      // Call the service's togglePlayback method
      audioService.togglePlayback();
      
      // Clear the manual state change flag after a delay
      // This ensures we don't get our UI state overridden by events from the service
      setTimeout(() => {
        manualStateChangeRef.current = false;
      }, 300); // Longer timeout to ensure all events have processed
    } catch (error) {
      console.error('Error toggling playback:', error);
      manualStateChangeRef.current = false; // Reset on error
    }
    
    // Clear debounce after 50ms - just enough to prevent accidental double-clicks
    setTimeout(() => {
      playPauseDebounceRef.current = false;
    }, 50);
  }, [audioService, isPlaying, isLoading]);
  
  // Enhanced seek with optimistic UI updates
  const handleSeek = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
    if (!audioService) return;
    
    const newProgress = parseFloat(e.target.value);
    
    // Optimistic update for smoother UX
    if (progressRef.current) {
      progressRef.current.style.setProperty('--progress-percent', `${newProgress}%`);
    }
    
    // Actual seek operation
    audioService.seek(newProgress);
  }, [audioService]);
  
  // Skip forward/backward by N seconds
  const handleSkip = useCallback((seconds: number): void => {
    if (!audioService || durationSecondsRef.current <= 0) return;
    const currentSeconds = (progress / 100) * durationSecondsRef.current;
    const newSeconds = currentSeconds + seconds;
    const newProgress = (newSeconds / durationSecondsRef.current) * 100;
    audioService.seek(Math.min(Math.max(newProgress, 0), 100));
  }, [audioService, progress]);

  // Track navigation
  const handlePrevious = useCallback((): void => {
    if (!audioService) return;
    audioService.playPrevious();
  }, [audioService]);

  const handleNext = useCallback((): void => {
    if (!audioService) return;
    audioService.playNext();
  }, [audioService]);
  
  // Increment/decrement speed - from StoryAudioPlayer
  const adjustSpeed = (increment: number, event?: MouseEvent<HTMLButtonElement>): void => {
    if (event) {
      event.stopPropagation();
    }
    
    // Calculate new speed with increment
    const newSpeed = Math.round((playbackRate + increment) * 100) / 100;
    
    // Clamp between 0.5 and 2.0
    const clampedSpeed = Math.min(Math.max(newSpeed, 0.5), 2.0);
    
    // Apply the speed change
    audioService.setPlaybackRate(clampedSpeed);
    setPlaybackRate(clampedSpeed);
  };
  
  // Toggle controls visibility on click
  const handleContainerClick = (e: MouseEvent<HTMLDivElement>): void => {
    // Don't toggle if clicking on a control
    const target = e.target as HTMLElement;
    if (target.closest('.now-playing-view__controls-overlay')) return;
    
    setShowControls(!showControls);
  };
  
  return (
    <div 
      ref={containerRef}
      className={`now-playing-view ${isPlaying ? 'now-playing-view--playing' : ''}`}
      data-state={isPlaying ? 'playing' : 'paused'}
      data-controls={showControls ? 'visible' : 'hidden'}
      data-visibility={isPageVisible ? 'visible' : 'hidden'}
      onClick={handleContainerClick}
    >
      {/* Cosmic background - stars removed for cleaner appearance */}
      <div className="now-playing-view__cosmic-background">
      </div>
      
      {/* Close button (always visible) */}
      <div className="now-playing-view__close-container">
        <CloseButton
          onClick={onBackClick}
          size="md"
          className="now-playing-close"
          aria-label={tString('audioLibrary.controls.backToCollection', 'Back to collection')}
        />
      </div>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="now-playing-view__loading">
          <div className="now-playing-view__loading-spinner"></div>
          <p className="now-playing-view__loading-text">{tNode('audioLibrary.loadingAudio')}</p>
        </div>
      )}
      
      {/* Full-screen figure image container */}
      <div className="now-playing-view__figure-container">
        {currentFigure && (
          <OptimizedImage
            src={currentFigure.id}
            type="ui"
            purpose="main"
            priority={true}
            withBlurUp={true}
            className="now-playing-view__figure-image"
            alt={tString('audioLibrary.nowPlaying.imageOf', `Image of ${currentFigure && currentFigure.name ? getFigureDisplayName(currentFigure.name) : ''}`).replace('{{figureName}}', currentFigure && currentFigure.name ? getFigureDisplayName(currentFigure.name) : '')}
          />
        )}
        
        {/* Subtle glow effect for the playing state */}
        <div className="now-playing-view__image-glow"></div>
        
        {/* Controls overlay at bottom with integrated title and controls */}
        <div className={`now-playing-view__controls-overlay ${glassClasses} ${showControls ? 'now-playing-view__controls-overlay--visible' : ''}`}>
          {/* Title information moved to top of controls */}
          <div className="now-playing-view__title-container">
            <p className="now-playing-view__figure-name">{currentFigure && currentFigure.name ? getFigureDisplayName(currentFigure.name) : ''}</p>
            <h3 className="now-playing-view__title">
              <span className="now-playing-view__seed-number">{currentStory?.seedId}.</span>
              <span className="now-playing-view__seed-title">{currentStory?.title || tNode('audioLibrary.nowPlaying.defaultTitle')}</span>
            </h3>
          </div>

          {/* Progress bar with cosmic gradient */}
          <div className="now-playing-view__progress">
            <input
              ref={progressRef}
              type="range"
              min="0"
              max="100"
              value={isNaN(progress) ? 0 : progress}
              onChange={handleSeek}
              className="now-playing-view__progress-slider"
              aria-label={tString('audioLibrary.controls.progress', 'Progress')}
              style={{
                '--progress-percent': `${isNaN(progress) ? 0 : progress}%`
              } as React.CSSProperties}
              onTouchStart={() => setShowControls(true)}
              onMouseDown={() => setShowControls(true)}
            />
            <div className="now-playing-view__time-display">
              <span className="now-playing-view__current-time">{currentTime}</span>
              <span className="now-playing-view__duration">{duration}</span>
            </div>
          </div>
          
          {/* Playback controls — prev | skip-15 | play | skip+15 | next | speed */}
          <div className="now-playing-view__playback-controls">
            <button
              className="now-playing-view__track-button"
              onClick={handlePrevious}
              aria-label={tString('audioLibrary.controls.previousTrack', 'Previous track')}
            >
              <SkipBack size={16} weight="bold" />
            </button>

            <button
              className="now-playing-view__skip-button"
              onClick={() => handleSkip(-15)}
              aria-label={tString('audioLibrary.controls.skipBack', 'Skip back 15 seconds')}
            >
              <ClockCounterClockwise size={20} weight="bold" />
              <span className="now-playing-view__skip-label">15</span>
            </button>

            <button
              ref={playButtonRef}
              className="now-playing-view__control-button now-playing-view__play-button"
              onClick={handlePlayPause}
              aria-label={isPlaying ? tString('audioLibrary.controls.pause', 'Pause') : tString('audioLibrary.controls.play', 'Play')}
              data-state={isPlaying ? "playing" : "paused"}
            >
              {isPlaying ? <Pause size={20} data-test="pause-icon" /> : <Play size={20} data-test="play-icon" />}
            </button>

            <button
              className="now-playing-view__skip-button"
              onClick={() => handleSkip(15)}
              aria-label={tString('audioLibrary.controls.skipForward', 'Skip forward 15 seconds')}
            >
              <ClockClockwise size={20} weight="bold" />
              <span className="now-playing-view__skip-label">15</span>
            </button>

            <button
              className="now-playing-view__track-button"
              onClick={handleNext}
              aria-label={tString('audioLibrary.controls.nextTrack', 'Next track')}
            >
              <SkipForward size={16} weight="bold" />
            </button>
            
            <div className="now-playing-view__speed-control">
              <button
                className="now-playing-view__speed-arrow-small now-playing-view__increase"
                onClick={(e) => adjustSpeed(0.05, e)}
                aria-label={tString('audioLibrary.controls.increaseSpeed', 'Increase speed')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 15L12 8L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              <div
                className="now-playing-view__speed-label"
                aria-live="polite"
              >
                {playbackRate.toFixed(2)}×
              </div>

              <button
                className="now-playing-view__speed-arrow-small now-playing-view__decrease"
                onClick={(e) => adjustSpeed(-0.05, e)}
                aria-label={tString('audioLibrary.controls.decreaseSpeed', 'Decrease speed')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 15L12 8L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="rotate(180 12 12)"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NowPlayingView;