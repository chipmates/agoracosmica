import { useState, useEffect, useRef } from 'react';

// ============================================
// Type Definitions
// ============================================

interface UseAudioOptions {
  autoplay?: boolean;
  initialVolume?: number;
  initialPlaybackRate?: number;
  onPlaybackComplete?: () => void;
  onError?: (error: Event) => void;
}

interface UseAudioResult {
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  currentTime: string;
  currentTimeSeconds: number;
  duration: string;
  durationSeconds: number;
  playbackRate: number;
  togglePlay: () => Promise<void>;
  seek: (position: number) => void;
  changePlaybackRate: (rate: number) => boolean;
  restart: () => void;
  audioElement: HTMLAudioElement | null;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
}

/**
 * Custom hook to handle audio playback with improved browser compatibility
 * and error handling
 */
const useAudio = (audioUrl: string | null | undefined, options: UseAudioOptions = {}): UseAudioResult => {
  const {
    autoplay = false,
    initialVolume = 1.0,
    initialPlaybackRate = 1.0,
    onPlaybackComplete,
    onError
  } = options;

  // State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(initialPlaybackRate);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadedUrlRef = useRef<string>(''); // Track already loaded URLs
  const listenerAbortRef = useRef<AbortController | null>(null); // Cleanup signal for event listeners

  // Callback refs to avoid stale closures in event listeners
  const onPlaybackCompleteRef = useRef(onPlaybackComplete);
  const onErrorRef = useRef(onError);
  onPlaybackCompleteRef.current = onPlaybackComplete;
  onErrorRef.current = onError;

  // Initialize or update audio element when URL changes
  useEffect(() => {
    // Clean up previous timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const isNewUrl = audioUrl !== loadedUrlRef.current;

    // Create a fresh audio element if we don't have one
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audioEl = audioRef.current;

    // Configure the audio element
    audioEl.preload = 'auto';
    audioEl.crossOrigin = 'anonymous';
    audioEl.autoplay = autoplay;
    audioEl.volume = initialVolume;
    audioEl.playbackRate = playbackRate;

    // Set up event listeners (abort previous set if re-running)
    // This MUST run every time — StrictMode cleanup aborts the previous listeners
    if (listenerAbortRef.current) {
      listenerAbortRef.current.abort();
    }
    const abortController = new AbortController();
    listenerAbortRef.current = abortController;
    const signal = abortController.signal;

    // Event handlers (use refs for callbacks to avoid stale closures)
    // All listeners share one AbortController signal for batch cleanup
    audioEl.addEventListener('canplay', () => {
      setIsLoading(false);
      if (audioEl.duration && !isNaN(audioEl.duration)) {
        setDuration(audioEl.duration);
      } else {
        timeoutRef.current = setTimeout(() => {
          if (audioEl.duration && !isNaN(audioEl.duration)) {
            setDuration(audioEl.duration);
          }
        }, 500);
      }
    }, { signal });

    audioEl.addEventListener('timeupdate', () => {
      setCurrentTime(audioEl.currentTime);
      const calcProgress = (audioEl.currentTime / audioEl.duration) * 100;
      setProgress(isNaN(calcProgress) ? 0 : calcProgress);
    }, { signal });

    audioEl.addEventListener('ended', () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      onPlaybackCompleteRef.current?.();
    }, { signal });

    audioEl.addEventListener('play', () => setIsPlaying(true), { signal });
    audioEl.addEventListener('pause', () => setIsPlaying(false), { signal });

    audioEl.addEventListener('error', (e: Event) => {
      console.error('Audio error:', audioEl.error?.code, audioEl.error?.message);
      setIsLoading(false);
      onErrorRef.current?.(e);
    }, { signal });

    audioEl.addEventListener('loadstart', () => setIsLoading(true), { signal });

    audioEl.addEventListener('loadedmetadata', () => {
      if (audioEl.duration && !isNaN(audioEl.duration)) {
        setDuration(audioEl.duration);
      }
    }, { signal });

    // Set the source and load only for new URLs
    if (isNewUrl && audioUrl) {
      loadedUrlRef.current = audioUrl;

      // Pause previous audio if switching URLs
      try { audioEl.pause(); } catch { /* ignore */ }

      // Reset state before loading new audio
      setIsLoading(true);
      setProgress(0);
      setCurrentTime(0);
      setIsPlaying(false);

      // Set source and load
      audioEl.src = audioUrl;
      audioEl.currentTime = 0;

      try {
        audioEl.load();
      } catch (err) {
        console.error('Error during initial audio loading:', err);
      }
    } else if (audioEl.readyState >= 2) {
      // Audio already loaded (e.g. StrictMode remount) — sync state immediately
      setIsLoading(false);
      if (audioEl.duration && !isNaN(audioEl.duration)) {
        setDuration(audioEl.duration);
      }
    }

    // Clean up: stop playback, remove listeners, clear timeouts
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Stop audio to prevent ghost playback after unmount
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      abortController.abort(); // Removes all event listeners attached with this signal
    };
  }, [audioUrl, autoplay, initialVolume]);

  // Simplified toggle play function with better state management
  const togglePlay = async (): Promise<void> => {
    if (!audioRef.current) return;
    
    try {
      const audio = audioRef.current;
      
      // Get current state
      const isPaused = audio.paused;

      if (!isPaused) {
        // Currently playing, so pause
        audio.pause();
        // State will be updated via the 'pause' event
      } else {
        // Currently paused, so play
        // Ensure the playback rate is correctly set
        if (playbackRate !== 1.0) {
          audio.playbackRate = playbackRate;
        }

        try {
          // Try to start playback
          const playPromise = audio.play();

          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Force state update to reflect paused state
              setIsPlaying(false);
            });
          }
          // State will be updated via the 'play' event
        } catch (playError) {
          console.error('Error playing audio:', playError);
          setIsPlaying(false);
        }
      }
    } catch (error) {
      console.error('Toggle play error:', error);
      setIsPlaying(false);
    }
  };

  // Seek to a specific position
  const seek = (position: number): void => {
    if (!audioRef.current || isLoading) return;
    
    // Ensure position is within bounds
    const normalizedPosition = Math.min(Math.max(position, 0), 100);
    const newTime = (normalizedPosition / 100) * duration;
    
    audioRef.current.currentTime = isNaN(newTime) ? 0 : newTime;
    setProgress(normalizedPosition);
    setCurrentTime(newTime);
  };

  // Change the playback rate with improved validation
  const changePlaybackRate = (rate: number): boolean => {
    if (!audioRef.current || isLoading) {
      console.error("Cannot change rate: audio ref not available or audio is loading");
      return false;
    }
    
    // Clamp rate between 0.5 and 2.0
    const validRate = Math.min(Math.max(parseFloat(rate.toString()), 0.5), 2.0);
    
    // Round to 2 decimal places for consistency
    const roundedRate = Math.round(validRate * 100) / 100;
    
    try {
      // Set the playback rate on the audio element
      audioRef.current.playbackRate = roundedRate;
      
      // Update state
      setPlaybackRate(roundedRate);
      return true;
    } catch (error) {
      console.error('Error setting playback rate:', error);
      return false;
    }
  };

  // Restart the audio
  const restart = (): void => {
    if (!audioRef.current || isLoading) return;
    
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    setProgress(0);
    
    // If not playing, start playing
    if (!isPlaying) {
      togglePlay();
    }
  };

  // Format time (mm:ss)
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isPlaying,
    isLoading,
    progress,
    currentTime: formatTime(currentTime),
    currentTimeSeconds: currentTime,
    duration: formatTime(duration),
    durationSeconds: duration,
    playbackRate,
    togglePlay,
    seek,
    changePlaybackRate,
    restart,
    audioElement: audioRef.current,
    audioRef // Expose the ref itself
  };
};

export default useAudio;