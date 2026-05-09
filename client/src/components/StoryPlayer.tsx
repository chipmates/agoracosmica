// src/components/StoryPlayer.tsx
import React, { useReducer, useEffect, useRef, useState, useCallback, FC } from 'react';
import { useDomainStore } from '../stores/domainStore';
import { useUIStore } from '../stores/uiStore';
import { useTranslation } from '../hooks/useTranslation';
import { Headphones, Info, CaretDown, CaretUp, Play, TrendUp, Trophy, Sparkle, BookOpen, BookBookmark, CheckCircle, Scroll } from '@phosphor-icons/react';
import StoryAudioPlayer from './StoryAudioPlayer';
import AudioLibraryModal from './AudioLibrary/AudioLibraryModal';
import HelperPopup from './HelperPopup/HelperPopup';
import { StoryFactCheckPanel } from './FactCheck';
import { ForewordModal } from './Foreword';
import { figureHasForeword } from '../hooks/useForeword';
import useStoryHighlighting from '../hooks/useStoryHighlighting';
import { Seed } from '../types/global';
// Manifest no longer needed - using direct path construction
// SimpleBar removed - using native CSS scrollbar system from index.css
import './StoryPlayer.css';
import './StoryAudioPlayer.css';

import type { StoryTimestamps } from '../services/StoryService';

// Type definitions
interface StoryData {
  audioUrl?: string;
  text: string;
  type: 'prerecorded' | 'generated';
  needsTranslation?: boolean;
  originalLanguage?: string | null;
  timestamps?: StoryTimestamps;
}

interface StoryPlayerProps {
  figure: string;
  figureName?: string;
  storyData: StoryData;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  selectedSeed?: Seed;
  style?: React.CSSProperties;
}

interface StoryPlayerState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  hasStoredStory: boolean;
  isAudioPlaying: boolean;
  playerKey: number;
  error?: Error;
}

// Actions for the reducer
type StoryPlayerAction =
  | { type: 'LOADING_START' }
  | { type: 'LOADING_COMPLETE' }
  | { type: 'LOADING_ERROR'; payload: Error }
  | { type: 'SET_STORED_STORY'; payload: boolean }
  | { type: 'AUDIO_PLAYING' }
  | { type: 'AUDIO_STOPPED' }
  | { type: 'REFRESH_PLAYER' }
  | { type: 'RESET_STATE' };

// Initial state for the reducer
const initialState: StoryPlayerState = {
  status: 'idle', // 'idle', 'loading', 'ready', 'error'
  hasStoredStory: false,
  isAudioPlaying: false,
  playerKey: Date.now() // Used to force audio player recreation when needed
};

// Reducer function to manage complex state
function storyPlayerReducer(state: StoryPlayerState, action: StoryPlayerAction): StoryPlayerState {
  switch (action.type) {
    case 'LOADING_START':
      return { ...state, status: 'loading' };
    
    case 'LOADING_COMPLETE':
      return { ...state, status: 'ready' };
    
    case 'LOADING_ERROR':
      return { ...state, status: 'error', error: action.payload };
    
    case 'SET_STORED_STORY':
      return { ...state, hasStoredStory: action.payload };
    
    case 'AUDIO_PLAYING':
      return { ...state, isAudioPlaying: true };
    
    case 'AUDIO_STOPPED':
      return { ...state, isAudioPlaying: false };
    
    case 'REFRESH_PLAYER':
      return { ...state, playerKey: Date.now() };
      
    case 'RESET_STATE':
      return { 
        ...initialState,
        playerKey: Date.now() // Create a new key to force recreation
      };
    
    default:
      return state;
  }
}

const StoryPlayer: FC<StoryPlayerProps> = ({
  figure,
  figureName,
  storyData,
  onComplete,
  onError,
  selectedSeed,
  style
}) => {
  // Get current language from Zustand store
  const language = useDomainStore((state) => state.language.current);
  const { t, tString, tNode, tArray } = useTranslation();
  
  // State for audio library modal
  const [isAudioLibraryOpen, setIsAudioLibraryOpen] = useState<boolean>(false);
  // State for story helper popup
  const [showStoryHelp, setShowStoryHelp] = useState<boolean>(false);
  const [showFullDisclaimer, setShowFullDisclaimer] = useState<boolean>(false);
  // State to trigger play button highlight after helper closes
  const [triggerPlayHighlight, setTriggerPlayHighlight] = useState<boolean>(false);
  // State for story factcheck panel
  const [showFactCheck, setShowFactCheck] = useState<boolean>(false);
  // State for foreword modal
  const [showForeword, setShowForeword] = useState<boolean>(false);

  // Audio state for highlighting sync
  const [audioTimeSeconds, setAudioTimeSeconds] = useState<number>(0);
  const [audioDurationSeconds, setAudioDurationSeconds] = useState<number>(0);
  const [audioIsPlaying, setAudioIsPlaying] = useState<boolean>(false);
  // Seek target: set by tap-to-seek, consumed by StoryAudioPlayer, auto-cleared
  const [seekTarget, setSeekTarget] = useState<number | null>(null);
  // Toggle play counter: incrementing triggers play/pause in StoryAudioPlayer
  const [togglePlayRequest, setTogglePlayRequest] = useState<number>(0);
  // Ref for active paragraph auto-scroll
  const activeParagraphRef = useRef<HTMLParagraphElement>(null);

  // Auto-clear seekTarget after it's been consumed by StoryAudioPlayer
  // Parent effects run after child effects, so the seek is performed first
  useEffect(() => {
    if (seekTarget !== null) {
      setSeekTarget(null);
    }
  }, [seekTarget]);

  // Stable callbacks for audio player (avoid re-renders)
  const handleTimeUpdate = useCallback((time: number, dur: number) => {
    setAudioTimeSeconds(time);
    setAudioDurationSeconds(dur);
  }, []);

  const handlePlayStateChange = useCallback((playing: boolean) => {
    setAudioIsPlaying(playing);
  }, []);

  // Track whether story has been fully read (scrolled to bottom)
  const storyReadRef = useRef(false);
  const handleStoryScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (storyReadRef.current) return;
    const el = e.currentTarget;
    // Consider "read" when user is within 50px of the bottom
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
      storyReadRef.current = true;
      onComplete?.();
    }
  }, [onComplete]);

  // Check if figure has foreword
  const hasForeword = figureHasForeword(figure);

  // Use reducer for complex state management
  const [state, dispatch] = useReducer(storyPlayerReducer, initialState);
  const { status, hasStoredStory, playerKey } = state;
  
  // Reference to avoid triggering effects unnecessarily
  const refreshRequestedRef = useRef<boolean>(false);

  // Auto-show helper popup on first story visit
  useEffect(() => {
    const hasSeenHelper = localStorage.getItem('hasSeenStoryModeHelper');
    if (!hasSeenHelper) {
      // Small delay so user sees the story first
      const timer = setTimeout(() => {
        // Don't show while mode selector is open (StoryPlayer may mount behind it)
        if (useUIStore.getState().modals.modeSelectorOpen) return;
        setShowStoryHelp(true);
        localStorage.setItem('hasSeenStoryModeHelper', 'true');
      }, 800);

      return () => clearTimeout(timer);
    }
  }, []); // Only run once on mount

  // Determine if we should show audio player based on data and language
  const shouldShowAudioPlayer = storyData?.audioUrl &&
                             storyData.type === 'prerecorded' &&
                             !storyData.needsTranslation;
  
  // This hook manages story data and storage
  useEffect(() => {
    if (!selectedSeed) return;
    
    // Force audio player re-creation when figure/seed changes
    dispatch({ type: 'REFRESH_PLAYER' });

    // Check if we have a stored story for this figure/seed combo
    // Use figureName for backward compatibility with existing storage keys
    const storageKey = `history_${figureName || figure}_${selectedSeed.id}`;
    try {
      const existingHistory = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      // Look for any story entries with audio
      const hasAudioStory = existingHistory.some((msg: any) => 
        msg.role === 'assistant' && 
        msg.type === 'story' && 
        msg.storyMetadata?.hasAudio === true
      );
      
      // Update our state
      dispatch({ type: 'SET_STORED_STORY', payload: hasAudioStory });
    } catch (error) {
      console.error('Error checking story history:', error);
    }

    // Store current story data if available - IMPORTANT: We only store metadata, not URLs
    if (storyData && storyData.text) {
      try {
        const existingHistory = JSON.parse(localStorage.getItem(storageKey) || '[]');
        
        // Check if this story is already in history
        const hasStory = existingHistory.some((msg: any) => 
          msg.role === 'assistant' && 
          msg.type === 'story' && 
          msg.content === storyData.text
        );

        // If story isn't stored yet and we have text, store it (without URLs)
        if (!hasStory) {
          const storyMessage = {
            role: 'assistant',
            type: 'story',
            content: storyData.text,
            mode: 'introduction',
            timestamp: new Date().toISOString(),
            figureName: figureName || figure,
            seedId: selectedSeed.id, // Store the seedId explicitly for re-fetching
            storyMetadata: {
              source: storyData.type, // 'prerecorded', 'generated', etc.
              hasAudio: storyData.type === 'prerecorded', // Flag if it should have audio
              needsTranslation: !!storyData.needsTranslation,
              originalLanguage: storyData.originalLanguage || null
            }
          };

          const updatedHistory = [...existingHistory, storyMessage];
          localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
          dispatch({ type: 'SET_STORED_STORY', payload: true });
        }
      } catch (error) {
        console.error('Error managing story history:', error);
      }
    }
  }, [storyData, figure, figureName, selectedSeed]);

  // Check if we need to refresh the story data from history
  useEffect(() => {
    // Check if current story data is a translation in progress
    const isTranslationInProgress = storyData?.needsTranslation === true;
    
    // If we have valid story data, ensure loading is cleared
    if (storyData && storyData.text && storyData.type === 'prerecorded' && storyData.audioUrl) {
      if (status === 'loading') {
        dispatch({ type: 'LOADING_COMPLETE' });
      }
      return;
    }
    
    // Only refresh if we have a stored story but no valid audio data
    // AND it's not already a translation in progress
    // AND we're not already loading
    const needsRefresh = hasStoredStory && 
                       (!storyData || !storyData.audioUrl || storyData.type !== 'prerecorded') &&
                       !isTranslationInProgress && // Don't refresh if already translating
                       status !== 'loading'; // Don't refresh if already loading
    
    if (isTranslationInProgress) {
      return;
    }

    // Avoid multiple refresh attempts for the same condition
    if (needsRefresh && !refreshRequestedRef.current) {
      refreshRequestedRef.current = true;
      dispatch({ type: 'LOADING_START' });
      
      // Use dynamic import to avoid circular dependency
      import('../services/StoryIntegrationManager').then(({ storyIntegrationManager }) => {
        storyIntegrationManager.refreshStoryFromHistory({
          figure,
          seedId: selectedSeed?.id ?? '',
          language,
          onComplete: (refreshedStory: any) => {
            // Skip updating if refreshed story is the same as current (prevents loops)
            const isSameStory = refreshedStory?.text === storyData?.text;
            if (isSameStory) {
              dispatch({ type: 'LOADING_COMPLETE' });
              refreshRequestedRef.current = false;
              return;
            }

            // Use an event to notify the parent component about the refreshed story
            const eventData = {
              storyData: refreshedStory,
              figure: figureName || figure,
              seedId: selectedSeed?.id
            };
            const refreshEvent = new CustomEvent('storyRefreshed', {
              detail: eventData
            });
            window.dispatchEvent(refreshEvent);
            dispatch({ type: 'LOADING_COMPLETE' });
            refreshRequestedRef.current = false;
          },
          onError: (err: Error) => {
            dispatch({ type: 'LOADING_ERROR', payload: err });
            refreshRequestedRef.current = false;
          }
        });
      }).catch(err => {
        dispatch({ type: 'LOADING_ERROR', payload: err });
        refreshRequestedRef.current = false;
      });
    }
  }, [hasStoredStory, storyData, figure, selectedSeed?.id, language, status]);

  // When language changes, refresh audio player if needed
  useEffect(() => {
    dispatch({ type: 'REFRESH_PLAYER' });
  }, [language]);
  
  // Handle auto-play issues by forcing player refresh on mount
  useEffect(() => {
    // A short delay ensures all components are properly mounted
    // and the user has had a chance to interact with the page
    const timeoutId = setTimeout(() => {
      dispatch({ type: 'REFRESH_PLAYER' });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, []);

  // Listen for app reset events (triggered when history is cleared)
  useEffect(() => {
    const handleAppReset = () => {
      // Reset our state completely
      dispatch({ type: 'RESET_STATE' });
      // Clear any references to existing player content
      refreshRequestedRef.current = false;
    };

    // Add event listener for our custom reset event
    window.addEventListener('app:reset-state', handleAppReset);

    // Clean up listener when component unmounts
    return () => {
      window.removeEventListener('app:reset-state', handleAppReset);
    };
  }, []);

  // Clear loading state when we have valid story data
  useEffect(() => {
    if (storyData && storyData.text && status === 'loading') {
      dispatch({ type: 'LOADING_COMPLETE' });
    }
  }, [storyData, status]);

  // Reset loading state when figure or seed changes
  useEffect(() => {
    // Reset the refresh requested flag
    refreshRequestedRef.current = false;

    // If we have valid story data on mount/change, ensure we're not stuck in loading
    if (storyData && storyData.text && status === 'loading') {
      dispatch({ type: 'LOADING_COMPLETE' });
    }
  }, [figure, selectedSeed?.id]);

  // Compute paragraphs (needed for hook — must be before early returns)
  const normalizedText = storyData?.text
    ? storyData.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    : '';
  const paragraphs = React.useMemo(
    () => normalizedText.split('\n\n').filter(p => p.trim()),
    [normalizedText]
  );

  // Paragraph highlighting synchronized with audio playback
  const {
    activeParagraphIndex,
    paragraphProgress,
    seekToParagraph,
    isHighlightingAvailable
  } = useStoryHighlighting({
    currentTimeSeconds: audioTimeSeconds,
    isPlaying: audioIsPlaying,
    timestamps: storyData?.timestamps,
    paragraphCount: paragraphs.length
  });

  // Auto-scroll to active paragraph
  useEffect(() => {
    if (activeParagraphIndex === null) return;
    const timer = setTimeout(() => {
      activeParagraphRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [activeParagraphIndex]);

  // --- Reading position memory ---
  const [resumePosition, setResumePosition] = useState<{ time: number; paragraph: number } | null>(null);
  const progressStorageKey = selectedSeed?.id ? `storyProgress_${figure}_${selectedSeed.id}_${language}` : null;
  const resumeDismissedRef = useRef<boolean>(false);
  // Keep a ref for the latest time/paragraph so we can save on unmount/pause
  const latestProgressRef = useRef<{ time: number; paragraph: number }>({ time: 0, paragraph: 0 });

  // Track latest progress values in ref (no re-renders)
  useEffect(() => {
    if (audioTimeSeconds > 0) {
      latestProgressRef.current = { time: audioTimeSeconds, paragraph: activeParagraphIndex ?? 0 };
    }
  }, [audioTimeSeconds, activeParagraphIndex]);

  // Save helper
  const saveProgress = useCallback(() => {
    if (!progressStorageKey || latestProgressRef.current.time < 5) return;
    try {
      localStorage.setItem(progressStorageKey, JSON.stringify({
        lastTimeSeconds: latestProgressRef.current.time,
        lastParagraphIndex: latestProgressRef.current.paragraph,
        updatedAt: new Date().toISOString()
      }));
      window.dispatchEvent(new CustomEvent('storyProgressUpdated', { detail: { key: progressStorageKey } }));
    } catch { /* localStorage full — ignore */ }
  }, [progressStorageKey]);

  // Save progress every 5 seconds while playing
  useEffect(() => {
    if (!audioIsPlaying || audioTimeSeconds < 1) return;
    const timer = setInterval(saveProgress, 5000);
    return () => clearInterval(timer);
  }, [audioIsPlaying, audioTimeSeconds, saveProgress]);

  // Save immediately when pausing
  useEffect(() => {
    if (!audioIsPlaying && latestProgressRef.current.time > 5) {
      saveProgress();
    }
  }, [audioIsPlaying, saveProgress]);

  // Save on unmount (navigating away)
  useEffect(() => {
    return () => { saveProgress(); };
  }, [saveProgress]);

  // Clear progress when playback reaches the end
  useEffect(() => {
    if (audioDurationSeconds > 0 && audioTimeSeconds > 0 && audioTimeSeconds >= audioDurationSeconds - 1) {
      if (progressStorageKey) {
        try { localStorage.removeItem(progressStorageKey); } catch {}
      }
      setResumePosition(null);
    }
  }, [audioTimeSeconds, audioDurationSeconds, progressStorageKey]);

  // Load saved position on mount
  useEffect(() => {
    if (!progressStorageKey) return;
    resumeDismissedRef.current = false;
    try {
      const saved = localStorage.getItem(progressStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lastTimeSeconds > 10) {
          setResumePosition({ time: parsed.lastTimeSeconds, paragraph: parsed.lastParagraphIndex });
          // Auto-dismiss after 8 seconds
          const timer = setTimeout(() => {
            setResumePosition(null);
          }, 8000);
          return () => clearTimeout(timer);
        }
      }
    } catch { /* corrupt data — ignore */ }
  }, [progressStorageKey]);

  // Listen for progress updates from AudioLibrary — auto-seek to synced position
  useEffect(() => {
    if (!progressStorageKey) return;

    const handleExternalProgress = (e: Event): void => {
      const detail = (e as CustomEvent).detail;
      if (detail?.key !== progressStorageKey) return;
      // Don't override if we're currently playing
      if (audioIsPlaying) return;

      try {
        const saved = localStorage.getItem(progressStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.lastTimeSeconds > 10) {
            // Auto-seek to the synced position so progress bar updates immediately
            setSeekTarget(parsed.lastTimeSeconds);
          }
        }
      } catch { /* ignore */ }
    };

    window.addEventListener('storyProgressUpdated', handleExternalProgress);
    return () => window.removeEventListener('storyProgressUpdated', handleExternalProgress);
  }, [progressStorageKey, audioIsPlaying]);

  const handleResume = useCallback(() => {
    if (resumePosition) {
      setSeekTarget(resumePosition.time);
      setResumePosition(null);
      resumeDismissedRef.current = true;
    }
  }, [resumePosition]);

  const handleResumeDismiss = useCallback(() => {
    setResumePosition(null);
    resumeDismissedRef.current = true;
  }, []);

  // Keyboard shortcuts for story playback
  useEffect(() => {
    if (!shouldShowAudioPlayer) return;
    // Don't capture shortcuts when overlays are open
    if (showStoryHelp || showFactCheck || showForeword || isAudioLibraryOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      switch (e.key) {
        case ' ':
          e.preventDefault(); // Prevent page scroll
          setTogglePlayRequest(prev => prev + 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (isHighlightingAvailable && activeParagraphIndex !== null && activeParagraphIndex > 0) {
            const time = seekToParagraph(activeParagraphIndex - 1);
            if (time !== null) setSeekTarget(time);
          } else {
            // Fallback: seek back 15s
            setSeekTarget(Math.max(0, audioTimeSeconds - 15));
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (isHighlightingAvailable && activeParagraphIndex !== null && activeParagraphIndex < paragraphs.length - 1) {
            const time = seekToParagraph(activeParagraphIndex + 1);
            if (time !== null) setSeekTarget(time);
          } else {
            // Fallback: seek forward 15s
            setSeekTarget(audioTimeSeconds + 15);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shouldShowAudioPlayer, isHighlightingAvailable, activeParagraphIndex, audioTimeSeconds, paragraphs.length, seekToParagraph, showStoryHelp, showFactCheck, showForeword, isAudioLibraryOpen]);

  // Display nothing if we don't have valid story data to show
  if (!storyData) {
    return null;
  }

  const { audioUrl } = storyData;

  // Don't show loading if we have valid story data
  const isLoading = status === 'loading' && !storyData.text;
  
  // Don't show the story player at all if we're in translation mode
  if (storyData.needsTranslation) {
    return null;
  }

  const handleStoryHelpDismiss = () => {
    setShowStoryHelp(false);
    setShowFullDisclaimer(false);
    // Trigger play button highlight after helper closes (sequenced animation)
    setTriggerPlayHighlight(true);
  };

  const handleStoryHelpClick = () => {
    setShowStoryHelp(true);
  };
  
  return (
    <div className="elegant-story-player" style={style}>
      {/* Unified container for both player and content */}
      <div className="story-container">
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-text">
              <span>{tNode('storyPlayer.loadingStory')}</span>
              <span className="loading-dot"></span>
              <span className="loading-dot"></span>
              <span className="loading-dot"></span>
            </div>
          </div>
        )}
        
        {/* Show audio player only if we have audio in the current language */}
        {shouldShowAudioPlayer && (
          <>
            {/* Updated audio intro with legal disclosure and factcheck link */}
            <div className="story-intro-container">
              <div className="story-intro-row">
                <button
                  className="story-facts-link"
                  onClick={() => setShowFactCheck(true)}
                >
                  <CheckCircle size={14} weight="duotone" />
                  <span className="story-facts-link__text">{tNode('factCheck.facts')}</span>
                </button>
                {hasForeword && (
                  <button
                    className="story-foreword-link"
                    onClick={() => setShowForeword(true)}
                  >
                    <Scroll size={14} weight="duotone" />
                    <span className="story-foreword-link__text">{tNode('audioLibrary.foreword')}</span>
                  </button>
                )}
                <button
                  className="story-help-link"
                  onClick={handleStoryHelpClick}
                >
                  <span className="story-help-link__text">{tNode('storyPlayer.prerecordedIntro')}</span>
                  <BookOpen size={14} weight="duotone" />
                </button>
              </div>
            </div>
            
            {/* Audio Player with proper key management */}
            <StoryAudioPlayer
              key={`audio-${playerKey}-${language}`}
              audioUrl={audioUrl ?? ''}
              isPrerecorded={true}
              onPlaybackComplete={onComplete}
              onError={onError}
              triggerPlayHighlight={triggerPlayHighlight}
              onTimeUpdate={handleTimeUpdate}
              onPlayStateChange={handlePlayStateChange}
              seekToTime={seekTarget}
              togglePlayRequest={togglePlayRequest}
              playbackBeacon={{ type: 'story', figureId: figure, mode: 'story' }}
            />

            {/* Paragraph progress indicator */}
            {isHighlightingAvailable && paragraphProgress.current > 0 && (
              <div className="story-paragraph-progress">
                <span className="story-paragraph-progress__current">{paragraphProgress.current}</span>
                <span className="story-paragraph-progress__separator"> / </span>
                <span className="story-paragraph-progress__total">{paragraphProgress.total}</span>
              </div>
            )}

            {/* Divider between player and content */}
            <div className="story-divider"></div>
          </>
        )}

        {/* Resume banner — shown when user returns to a partially-listened story */}
        {resumePosition && !resumeDismissedRef.current && (
          <div className="story-resume-banner">
            <span className="story-resume-banner__text">
              {tString('storyPlayer.continueListening', 'Continue where you left off?')}
            </span>
            <button className="story-resume-banner__btn" onClick={handleResume}>
              <Play size={14} weight="fill" />
              {tString('storyPlayer.resume', 'Resume')}
            </button>
            <button className="story-resume-banner__dismiss" onClick={handleResumeDismiss} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {/* Story Content - always show if available */}
        {paragraphs.length > 0 && (
          <div className="story-content">
            <div className="story-scrollable-native scrollbar-gold" onScroll={handleStoryScroll}>
              <div className="story-text">
                {paragraphs.map((paragraph, idx) => {
                  // Source convention: a bare "---" line marks a section break.
                  // Audio pipeline already converts it to a silence; render as a visual separator
                  // so readers don't see the literal three-dash glyph.
                  if (paragraph.trim() === '---') {
                    return <hr key={idx} className="story-paragraph-separator" aria-hidden="true" />;
                  }
                  return (
                    <p
                      key={idx}
                      ref={activeParagraphIndex === idx ? activeParagraphRef : undefined}
                      className={[
                        'story-paragraph',
                        activeParagraphIndex === idx ? 'story-paragraph--active' : '',
                        activeParagraphIndex !== null && activeParagraphIndex !== idx ? 'story-paragraph--inactive' : ''
                      ].filter(Boolean).join(' ')}
                      onClick={isHighlightingAvailable ? () => {
                        const time = seekToParagraph(idx);
                        if (time !== null) setSeekTarget(time);
                      } : undefined}
                      role={isHighlightingAvailable ? 'button' : undefined}
                      tabIndex={isHighlightingAvailable ? 0 : undefined}
                      aria-label={isHighlightingAvailable ? String(t('storyPlayer.jumpToParagraph', { number: idx + 1 })) : undefined}
                    >
                      {paragraph}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Audio Library Modal */}
      <AudioLibraryModal 
        isOpen={isAudioLibraryOpen}
        onClose={() => setIsAudioLibraryOpen(false)}
      />
      
      {/* Story Helper Popup - Reusing AudioLibrary helper content */}
      {showStoryHelp && (
        <HelperPopup
          isOpen={true}
          onDismiss={handleStoryHelpDismiss}
          title={
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}>
              <Headphones size={24} style={{ color: 'var(--gold-subtle)' }} />
              {tNode('helpers.audioLibrary.welcome.title')}
            </div>
          }
          content={
            <div style={{ fontSize: '0.95rem' }}>
              {/* Overview - Premium Content */}
              <div style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--gold-subtle) 8%, transparent), color-mix(in srgb, var(--gold-subtle) 3%, transparent))',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1rem',
                border: '1px solid color-mix(in srgb, var(--gold-subtle) 15%, transparent)'
              }}>
                <h4 style={{
                  color: 'var(--gold-subtle)',
                  marginBottom: '0.5rem',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 600
                }}>
                  <BookBookmark size={18} style={{ color: 'var(--gold-subtle)' }} />
                  {tNode('helpers.audioLibrary.welcome.sections.overview.title')}
                </h4>
                <p style={{ margin: 0, opacity: 0.9, paddingLeft: '26px', lineHeight: 1.5 }}>
                  {tNode('helpers.audioLibrary.welcome.sections.overview.text')}
                </p>
              </div>
              
              {/* Progressive Journey */}
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{
                  color: 'var(--gold-subtle)',
                  marginBottom: '0.5rem',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 600
                }}>
                  <BookOpen size={18} style={{ color: 'var(--gold-subtle)' }} />
                  {tNode('helpers.audioLibrary.welcome.sections.journey.title')}
                </h4>
                <ul style={{
                  margin: 0,
                  paddingLeft: '26px',
                  opacity: 0.9,
                  fontSize: '0.9rem',
                  listStyle: 'none'
                }}>
                  {tArray('helpers.audioLibrary.welcome.sections.journey.points').map((point, i) => {
                      const icons = [Play, TrendUp, Trophy];
                      const Icon = icons[i];
                      return (
                        <li key={i} style={{ 
                          marginBottom: '0.35rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          {Icon && <Icon size={14} style={{ color: 'var(--gold-subtle)', opacity: 0.7, flexShrink: 0 }} />}
                          <span>{point}</span>
                        </li>
                      );
                    })}
                </ul>
              </div>

              {/* Next Steps - Wisdom Mode connection */}
              <div style={{
                marginBottom: '1rem',
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--gold-subtle) 8%, transparent), color-mix(in srgb, var(--gold-subtle) 3%, transparent))',
                borderRadius: '8px',
                padding: '0.75rem',
                border: '1px solid color-mix(in srgb, var(--gold-subtle) 15%, transparent)'
              }}>
                <h4 style={{
                  color: 'var(--gold-subtle)',
                  marginBottom: '0.5rem',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 600
                }}>
                  <Sparkle size={18} style={{ color: 'var(--gold-subtle)' }} />
                  {tNode('helpers.audioLibrary.welcome.sections.nextSteps.title')}
                </h4>
                <p style={{
                  margin: 0,
                  opacity: 0.9,
                  paddingLeft: '26px',
                  lineHeight: 1.5,
                  fontSize: '0.9rem'
                }}>
                  {(() => {
                    const text = tString('helpers.audioLibrary.welcome.sections.nextSteps.text', '');
                    const wisdomWord = language === 'de' ? 'Wisdom Modus' : 'Wisdom Mode';
                    const parts = text.split(wisdomWord);
                    if (parts.length === 2) {
                      return (
                        <>
                          {parts[0]}
                          <span style={{ color: 'var(--purple-base)', fontWeight: 600 }}>{wisdomWord}</span>
                          {parts[1]}
                        </>
                      );
                    }
                    return text;
                  })()}
                </p>
              </div>

              {/* Transparency / Disclaimer - Collapsible */}
              <div style={{ 
                marginTop: '1rem',
                padding: '0.75rem',
                background: 'color-mix(in srgb, var(--gold-subtle) 5%, transparent)',
                borderRadius: '8px',
                border: '1px solid color-mix(in srgb, var(--gold-subtle) 20%, transparent)'
              }}>
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: showFullDisclaimer ? '0.5rem' : 0,
                  cursor: 'pointer'
                }}
                onClick={() => setShowFullDisclaimer(!showFullDisclaimer)}>
                  <Info size={16} style={{ color: 'var(--gold-subtle)' }} />
                  <span style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--gold-subtle)'
                  }}>
                    {tNode('helpers.audioLibrary.welcome.sections.transparency.title')}
                  </span>
                  {showFullDisclaimer ? 
                    <CaretUp size={16} style={{ marginLeft: 'auto', color: 'var(--gold-subtle)' }} /> :
                    <CaretDown size={16} style={{ marginLeft: 'auto', color: 'var(--gold-subtle)' }} />
                  }
                </div>
                
                {!showFullDisclaimer ? (
                  <p style={{
                    margin: 0,
                    fontSize: '0.9375rem',
                    opacity: 0.85,
                    paddingLeft: '21px'
                  }}>
                    {tNode('helpers.audioLibrary.welcome.sections.transparency.brief')}
                  </p>
                ) : (
                  <div style={{ paddingLeft: '21px' }}>
                    <p style={{
                      margin: 0,
                      fontSize: '0.9375rem',
                      opacity: 0.9,
                      lineHeight: 1.5
                    }}>
                      {tNode('helpers.audioLibrary.welcome.sections.transparency.expanded')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          }
          buttonText={tString('helpers.common.gotIt', 'Got it!')}
          showDontAskAgain={false}
        />
      )}

      {/* Story Factcheck Panel */}
      {showFactCheck && selectedSeed && (
        <StoryFactCheckPanel
          figureId={figure}
          figureName={figureName}
          storyNumber={typeof selectedSeed.id === 'number' ? selectedSeed.id : parseInt(String(selectedSeed.id), 10) || 1}
          onClose={() => setShowFactCheck(false)}
        />
      )}

      {/* Foreword Modal */}
      {showForeword && hasForeword && (
        <ForewordModal
          figureId={figure}
          figureName={figureName}
          onClose={() => setShowForeword(false)}
        />
      )}
    </div>
  );
};

export default StoryPlayer;