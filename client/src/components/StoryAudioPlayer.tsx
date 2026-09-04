// src/components/StoryAudioPlayer.tsx
import { FC, useState, useRef, useEffect, useCallback, ChangeEvent } from 'react';
import { Play, Pause, ClockCounterClockwise, ClockClockwise } from '@phosphor-icons/react';
import './StoryAudioPlayer.css';
import useAudio from '../hooks/useAudio';
import { useMediaSession } from '../hooks/useMediaSession';
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
   *  optional figureId, and on stories the chapter ordinal. */
  playbackBeacon?: { type: PlaybackContentType; figureId?: string; mode?: string; chapter?: number };
  /** Figure whose Echo is speaking. Drives lock screen artwork and artist. */
  figureId?: string;
  /** Episode title for the lock screen. */
  mediaTitle?: string;
  /**
   * While an answer speaks over a paused chapter, the lock screen shows the
   * answer instead of the episode. The chapter keeps the Media Session either
   * way, so there is never a second owner to hand it over to: transport goes to
   * the answer, the position bar goes quiet, and the chapter does not move.
   */
  sessionOverride?: { title: string; isPlaying: boolean; onTogglePlay: () => void };
  /** Incrementing counter that resumes the chapter. Ignored while playing. */
  playRequest?: number;
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
  playbackBeacon,
  figureId,
  mediaTitle,
  sessionOverride,
  playRequest
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
    audioRef,
  } = useAudio(audioUrl, {
    autoplay: false,
    initialVolume: 1.0,
    onPlaybackComplete,
    // A media element hands its handler a DOM Event, which stringifies to
    // "[object Event]" and would reach the visitor's error box verbatim. The
    // replacement is translated, since the message is rendered to the visitor.
    onError: onError
      ? (error) => onError(error instanceof Error
          ? error
          : new Error(typeof error === 'string'
              ? error
              : tString('errors.audioLoadFailed', 'The audio could not be loaded. Please try again.')))
      : undefined,
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

  // Resume after an answer: the narration fades back in instead of cutting in
  // at full level, which is what makes the return feel like one telling.
  const fadeFrameRef = useRef<number | null>(null);
  const fadeInPlayback = useCallback((durationMs = 300): void => {
    const element = audioRef.current;
    if (!element) return;
    if (fadeFrameRef.current !== null) cancelAnimationFrame(fadeFrameRef.current);

    element.volume = 0;
    const startedAt = performance.now();
    const step = (now: number): void => {
      const ratio = Math.min((now - startedAt) / durationMs, 1);
      element.volume = ratio;
      fadeFrameRef.current = ratio < 1 ? requestAnimationFrame(step) : null;
    };
    fadeFrameRef.current = requestAnimationFrame(step);
  }, [audioRef]);

  useEffect(() => () => {
    if (fadeFrameRef.current !== null) cancelAnimationFrame(fadeFrameRef.current);
  }, []);

  // Handle external play requests. Unlike togglePlayRequest this only ever
  // plays, so a resume that arrives on a playing chapter is a no-op.
  const playRequestRef = useRef<number>(0);
  useEffect(() => {
    if (!playRequest || playRequest === playRequestRef.current) return;
    playRequestRef.current = playRequest;
    if (isPlaying) return;
    fadeInPlayback();
    void togglePlay();
  }, [playRequest, isPlaying, togglePlay, fadeInPlayback]);

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

  // Lock screen / OS transport controls for the story episode. An override
  // swaps what the controls act on without changing who owns the session:
  // duration 0 keeps the position bar out, and every seek is dropped so the
  // chapter cannot move while the answer speaks.
  const overridden = Boolean(sessionOverride);
  useMediaSession({
    title: sessionOverride ? sessionOverride.title : (mediaTitle ?? ''),
    figureId: figureId ?? '',
    isPlaying: sessionOverride ? sessionOverride.isPlaying : isPlaying,
    currentTimeSeconds: overridden ? 0 : currentTimeSeconds,
    durationSeconds: overridden ? 0 : durationSeconds,
    playbackRate: overridden ? 1 : playbackRate,
    onTogglePlay: sessionOverride ? sessionOverride.onTogglePlay : togglePlay,
    onSkipBack: overridden ? () => {} : () => handleSkip(-15),
    onSkipForward: overridden ? () => {} : () => handleSkip(15),
    onSeekTo: overridden
      ? undefined
      : (seconds: number) => {
          if (durationSeconds > 0) seek((seconds / durationSeconds) * 100);
        },
    enabled: Boolean(figureId && audioUrl),
  });

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
          {/* AI disclosure chip, in the player chrome without its own row.
              Sits between the timestamps, so it stays co-visible with the
              controls at the point of listening (Art 50 label placement). */}
          <span className="ai-voice-chip ai-voice-chip--inline">
            {tString('aiDisclosure.voiceChip', 'AI voice, not a recording')}
          </span>
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
