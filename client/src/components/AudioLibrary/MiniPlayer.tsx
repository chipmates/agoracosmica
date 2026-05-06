// src/components/AudioLibrary/MiniPlayer.tsx
import React, { FC, useState, useEffect, useRef, MouseEvent as ReactMouseEvent } from 'react';
import { Play, Pause, CaretUp } from '@phosphor-icons/react';
import OptimizedFigureImage from '../OptimizedFigureImage';
import { useTranslation } from '../../hooks/useTranslation';
import { Story } from '../../types/global';
import './MiniPlayer.css';

interface Figure {
  name: string;
  imageKey?: string;
  [key: string]: any;
}

interface PlaybackState {
  isPlaying: boolean;
  progress?: number;
}

interface CurrentPlayback {
  story?: Story;
  figureName?: string;
}

interface AudioService {
  getCurrentPlayback: () => CurrentPlayback | null;
  getPlaybackState: () => PlaybackState;
  pause: () => void;
  resume: () => void;
  on: (event: string, handler: Function) => void;
  off: (event: string, handler: Function) => void;
}

interface MiniPlayerProps {
  story?: Story;
  figure?: Figure;
  onExpand: () => void;
  audioService?: AudioService;
}

const MiniPlayer: FC<MiniPlayerProps> = ({ story, figure, onExpand, audioService }) => {
  const { t, tString } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStory, setCurrentStory] = useState<Story | undefined>(story);
  const [currentFigure, setCurrentFigure] = useState<Figure | undefined>(figure);
  const [isLoading, setIsLoading] = useState(false);
  
  // 2025 Battery optimization: Track page visibility for lock screen efficiency
  const [isPageVisible, setIsPageVisible] = useState(!document.hidden);
  
  // Track when we manually change the playback state to prevent race conditions
  const manualStateChangeRef = useRef(false);
  
  // Initialize and sync with audio service state
  useEffect(() => {
    if (!audioService) return;
    
    // Initial state from service, not just props
    const playback = audioService.getCurrentPlayback();
    if (playback && playback.story) {
      setCurrentStory(playback.story);
      if (playback.figureName) {
        // Extract imageKey from figure name for image loading
        const figureNameLower = playback.figureName.toLowerCase();
        let imageKey = 'default';
        
        // Extract the key from the figure name
        if (figureNameLower.includes('leonardo') || figureNameLower.includes('vinci')) {
          imageKey = 'vinci';
        } else if (figureNameLower.includes('king jr')) {
          imageKey = 'king';
        } else if (figureNameLower.includes('dōgen') || figureNameLower.includes('dogen')) {
          imageKey = 'zenji';
        } else {
          // Get the last word of the name (after "Echo of")
          const nameParts = playback.figureName.replace(/^echo of\s+/i, '').split(' ');
          imageKey = nameParts[nameParts.length - 1].toLowerCase();
        }
        
        setCurrentFigure({
          ...figure,
          name: playback.figureName,
          imageKey: imageKey
        } as Figure);
      }
    } else {
      // Fall back to props if no current playback
      setCurrentStory(story);
      setCurrentFigure(figure);
    }
    
    const playbackState = audioService.getPlaybackState();
    setIsPlaying(playbackState.isPlaying);
    setProgress(playbackState.progress || 0);
    
    // Set up event listener for playback updates
    const handlePlaybackUpdate = (state: PlaybackState): void => {
      // If we've just manually changed the play state, don't let the event override our state
      if (manualStateChangeRef.current) {
        // Still update progress
        setProgress(state.progress || 0);
      } else {
        // Normal update
        setIsPlaying(state.isPlaying);
        setProgress(state.progress || 0);
      }
    };
    
    const handleTrackChange = (): void => {
      const playback = audioService.getCurrentPlayback();
      if (playback && playback.story) {
        setCurrentStory(playback.story);
        if (playback.figureName) {
          // Extract imageKey from figure name for image loading
          const figureNameLower = playback.figureName.toLowerCase();
          let imageKey = 'default';
          
          // Extract the key from the figure name
          if (figureNameLower.includes('leonardo') || figureNameLower.includes('vinci')) {
            imageKey = 'vinci';
          } else if (figureNameLower.includes('king jr')) {
            imageKey = 'king';
          } else if (figureNameLower.includes('dōgen') || figureNameLower.includes('dogen')) {
            imageKey = 'zenji';
          } else {
            // Get the last word of the name (after "Echo of")
            const nameParts = playback.figureName.replace(/^echo of\s+/i, '').split(' ');
            imageKey = nameParts[nameParts.length - 1].toLowerCase();
          }
          
          setCurrentFigure({
            ...figure,
            name: playback.figureName,
            imageKey: imageKey
          } as Figure);
        }
      }
    };
    
    const handleLoadingChange = (loading: boolean): void => {
      setIsLoading(loading);
    };
    
    audioService.on('playbackUpdate', handlePlaybackUpdate);
    audioService.on('trackChange', handleTrackChange);
    audioService.on('loadingChange', handleLoadingChange);
    
    return () => {
      audioService.off('playbackUpdate', handlePlaybackUpdate);
      audioService.off('trackChange', handleTrackChange);
      audioService.off('loadingChange', handleLoadingChange);
    };
  }, [audioService, story, figure]);
  
  // 2025 Page Visibility API - Ultimate battery optimization for lock screen usage
  useEffect(() => {
    const handleVisibilityChange = (): void => {
      setIsPageVisible(!document.hidden);
    };
    const handleFocus = (): void => setIsPageVisible(true);
    const handleBlur = (): void => setIsPageVisible(false);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);
  
  // Handle play/pause
  const handlePlayPause = (e: ReactMouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation(); // Prevent expanding the player
    
    // Don't allow play/pause when loading
    if (isLoading || !audioService) return;
    
    // Set flag to prevent event interference
    manualStateChangeRef.current = true;
    
    // Update state immediately for responsive UI
    setIsPlaying(!isPlaying);
    
    if (isPlaying) {
      audioService.pause();
    } else {
      audioService.resume();
    }
    
    // Clear the manual state change flag after a delay
    setTimeout(() => {
      manualStateChangeRef.current = false;
    }, 300); // Longer timeout to ensure all events have processed
  };
  
  if (!currentStory) return null;
  
  return (
    <div 
      className={`mini-player ${isPlaying ? 'mini-player--playing' : ''}`} 
      data-visibility={isPageVisible ? 'visible' : 'hidden'}
      onClick={onExpand}
    >
      {/* Background and blur effect */}
      <div className="mini-player__backdrop"></div>
      
      {/* Progress bar */}
      <div 
        className="mini-player__progress" 
        style={{ 
          width: `${progress}%` 
        }}
      ></div>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="mini-player__loading">
          <div className="mini-player__loading-spinner"></div>
        </div>
      )}
      
      {/* Player content */}
      <div className="mini-player__content">
        {/* Story thumbnail */}
        <div className="mini-player__thumbnail">
          <OptimizedFigureImage
            figure={currentFigure || 'default'}
            type="thumbnail"
            priority={true}
            isPlaying={isPlaying}
            className="mini-player__figure-image"
            alt={typeof currentFigure?.name === 'string' ? currentFigure.name : 'Figure'}
          />
        </div>
        
        {/* Story info */}
        <div className="mini-player__info">
          <div className="mini-player__figure-name">
            {typeof currentFigure?.name === 'string' ? currentFigure.name : 'Unknown Figure'}
          </div>
          <div className="mini-player__title">
            <span className="mini-player__seed-number">{currentStory.seedId}.</span>
            <span className="mini-player__seed-title">
              {typeof currentStory.title === 'string' ? currentStory.title : 'Story'}
            </span>
          </div>
        </div>
        
        {/* Controls */}
        <div className="mini-player__controls">
          <button
            className="mini-player__play-button"
            onClick={handlePlayPause}
            aria-label={isPlaying ? tString('audioLibrary.controls.pause', 'Pause') : tString('audioLibrary.controls.play', 'Play')}
          >
            {isPlaying ? <Pause size={18} data-test="pause-icon" /> : <Play size={18} data-test="play-icon" />}
          </button>
          
          <button
            className="mini-player__expand-button"
            onClick={onExpand}
            aria-label={tString('audioLibrary.controls.expandPlayer', 'Expand player')}
          >
            <CaretUp size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MiniPlayer;