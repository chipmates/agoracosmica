// src/components/StoryAudioPlayer.tsx
import { FC, useState, useRef, useEffect, useCallback, ChangeEvent } from 'react';
import { Play, Pause, ClockCounterClockwise, ClockClockwise } from '@phosphor-icons/react';
import './StoryAudioPlayer.css';
import useAudio from '../hooks/useAudio';
import type { PlaybackContentType } from '../utils/playbackBeacon';
import { useTranslation } from '../hooks/useTranslation';

interface StoryAudioPlayerProps {
  audioUrl: string;
  isPrerecorded?: boolean;
  onPlaybackComplete?: () => void;
  onError?: (error: Error) => void;
  triggerPlayHighlight?: boolean;
  onTimeUpdate?: (timeSeconds: number, durationSeconds: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  seekToTime?: number | null;
  togglePlayRequest?: number;
  /** Engagement-funnel beacon context — forwarded to useAudio for the
   *  'started' event on first play. Caller must provide content type +
   *  optional figureId. */
  playbackBeacon?: { type: PlaybackContentType; figureId?: string; mode?: string };
}

const StoryAudioPlayer: FC<StoryAudioPlayerProps> = ({
  audioUrl,
  onPlaybackComplete,
  onError,
  triggerPlayHighlight = false,
  onTimeUpdate,
  onPlayStateChange,
  seekToTime,
  togglePlayRequest,
  playbackBeacon
}) => {
  const { tString } = useTranslation();
  const {
    isPlaying,
    isLoading,
    progress,
    currentTime,
    currentTimeSeconds,
    duration,
    durationSeconds,
    playbackRate,
    togglePlay,
    seek,
    changePlaybackRate,
  } = useAudio(audioUrl, {
    autoplay: false,
    initialVolume: 1.0,
    onPlaybackComplete,
    onError: onError ? (error) => onError(error instanceof Error ? error : new Error(String(error))) : undefined,
    playbackBeacon
  });

  // Forward time updates and play state to parent for highlighting
  useEffect(() => {
    onTimeUpdate?.(currentTimeSeconds, durationSeconds);
  }, [currentTimeSeconds, durationSeconds, onTimeUpdate]);

  useEffect(() => {
    onPlayStateChange?.(isPlaying);
  }, [isPlaying, onPlayStateChange]);

  // Handle external seek requests (e.g. paragraph tap-to-seek)
  useEffect(() => {
    if (seekToTime != null && durationSeconds > 0) {
      const seekPercent = (seekToTime / durationSeconds) * 100;
      seek(Math.min(Math.max(seekPercent, 0), 100));
    }
  }, [seekToTime, durationSeconds, seek]);

  // Handle external toggle play requests (e.g. keyboard shortcuts)
  const togglePlayRequestRef = useRef<number>(0);
  useEffect(() => {
    if (togglePlayRequest && togglePlayRequest !== togglePlayRequestRef.current) {
      togglePlayRequestRef.current = togglePlayRequest;
      togglePlay();
    }
  }, [togglePlayRequest, togglePlay]);

  const progressSliderRef = useRef<HTMLInputElement>(null);

  // State for first-time play button highlight
  const [showPlayHighlight, setShowPlayHighlight] = useState(false);

  // Check if this is user's first story ever (show golden breathing highlight)
  useEffect(() => {
    const hasSeenPlayGuide = localStorage.getItem('hasSeenPlayButtonGuide');

    if (!hasSeenPlayGuide && !isLoading && triggerPlayHighlight) {
      setShowPlayHighlight(true);

      const timer = setTimeout(() => {
        setShowPlayHighlight(false);
        localStorage.setItem('hasSeenPlayButtonGuide', 'true');
      }, 3600);

      return () => clearTimeout(timer);
    }
  }, [isLoading, triggerPlayHighlight]);

  // Handle seeking through the track
  const handleSeek = (evt: ChangeEvent<HTMLInputElement>): void => {
    const newProgress = parseFloat(evt.target.value);
    seek(newProgress);

    if (progressSliderRef.current) {
      progressSliderRef.current.style.setProperty('--progress-percent', `${newProgress}%`);
    }
  };

  // Skip forward/backward by N seconds
  const handleSkip = useCallback((seconds: number): void => {
    if (durationSeconds <= 0) return;
    const newTime = currentTimeSeconds + seconds;
    const newPercent = (newTime / durationSeconds) * 100;
    seek(Math.min(Math.max(newPercent, 0), 100));
  }, [currentTimeSeconds, durationSeconds, seek]);

  // Increment/decrement speed by 0.05
  const adjustSpeed = (increment: number): void => {
    const newSpeed = Math.round((playbackRate + increment) * 100) / 100;
    const clampedSpeed = Math.min(Math.max(newSpeed, 0.5), 2.0);
    changePlaybackRate(clampedSpeed);
  };

  // Set initial CSS variable for progress
  useEffect(() => {
    if (progressSliderRef.current) {
      progressSliderRef.current.style.setProperty('--progress-percent', '0%');
    }
  }, []);

  return (
    <div className="story-audio-player">
      {/* Progress bar — always full-width on top */}
      <div className="player-progress">
        <input
          ref={progressSliderRef}
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={isNaN(progress) ? 0 : progress}
          onChange={handleSeek}
          className="player-slider"
          disabled={isLoading}
          aria-label={tString('audioLibrary.controls.progress', '')}
          style={{
            '--progress-percent': `${isNaN(progress) ? 0 : progress}%`
          } as React.CSSProperties}
        />
        <div className="player-time">
          <span className="player-time__current">{currentTime}</span>
          <span className="player-time__total">{duration}</span>
        </div>
      </div>

      {/* Controls row — skip back, play/pause, skip forward, speed */}
      <div className="player-controls">
        <button
          className="player-skip"
          onClick={() => handleSkip(-15)}
          disabled={isLoading}
          aria-label={tString('audioLibrary.controls.skipBack', 'Skip back 15 seconds')}
        >
          <ClockCounterClockwise size={20} weight="bold" />
          <span className="player-skip__label">15</span>
        </button>

        <button
          onClick={togglePlay}
          className={`player-play ${isPlaying ? 'playing' : ''} ${showPlayHighlight ? 'first-time-highlight' : ''}`}
          disabled={isLoading}
          aria-label={isPlaying ? tString('audioLibrary.controls.pause', '') : tString('audioLibrary.controls.play', '')}
        >
          {isLoading ? (
            <div className="loading-spinner-container">
              <div className="loading-spinner"></div>
            </div>
          ) : (
            isPlaying ? <Pause weight="fill" /> : <Play weight="fill" />
          )}
        </button>

        <button
          className="player-skip"
          onClick={() => handleSkip(15)}
          disabled={isLoading}
          aria-label={tString('audioLibrary.controls.skipForward', 'Skip forward 15 seconds')}
        >
          <ClockClockwise size={20} weight="bold" />
          <span className="player-skip__label">15</span>
        </button>

        <div className="player-speed">
          <button
            className="player-speed__arrow"
            onClick={() => adjustSpeed(0.05)}
            disabled={isLoading}
            aria-label={tString('audioLibrary.controls.increaseSpeed', '')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M19 15L12 8L5 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="player-speed__label">{playbackRate.toFixed(2)}×</span>
          <button
            className="player-speed__arrow"
            onClick={() => adjustSpeed(-0.05)}
            disabled={isLoading}
            aria-label={tString('audioLibrary.controls.decreaseSpeed', '')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 9L12 16L19 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryAudioPlayer;
