// Playback control methods for audio service
import { audioStoryService } from '../../AudioStoryService';

interface AudioControl {
  pause: () => void | Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (time: number) => void;
  setPlaybackRate: (rate: number | string) => void;
}

interface ProgressTracker {
  start: () => void;
  stop: () => void;
  isActive: () => boolean;
}

interface PlaybackState {
  isPlaying: boolean;
  currentProgress: number;
  currentTime: number;
}

interface StopResult {
  audioControls: AudioControl | null;
  isPlaying: boolean;
}

interface SeekResult {
  currentProgress: number;
  currentTime: number;
}

interface CurrentPlayback {
  story: any;
  figureName: string;
  language?: string;
}

type PlayFunction = (story: any, figureName?: string) => any;
type PauseFunction = () => void | Promise<void>;
type ResumeFunction = () => void | Promise<void>;

/**
 * Stop current playback
 */
export async function stopPlayback(audioControls: AudioControl | null, progressTracking: ProgressTracker): Promise<StopResult> {
  if (audioControls) {
    await audioControls.stop();
    progressTracking.stop();
    return {
      audioControls: null,
      isPlaying: false
    };
  }
  return { audioControls, isPlaying: false };
}

/**
 * Toggle playback - unified method for play/pause
 */
export async function togglePlayback(audioControls: AudioControl | null, isPlaying: boolean, pauseFn: PauseFunction, resumeFn: ResumeFunction): Promise<void> {
  if (!audioControls) return;
  
  try {
    if (isPlaying) {
      await pauseFn();
    } else {
      await resumeFn();
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Pause playback - optimized for reliability
 */
export async function pausePlayback(audioControls: AudioControl | null, progressTracking: ProgressTracker, currentState: PlaybackState): Promise<PlaybackState> {
  if (!audioControls) return currentState;
  
  try {
    // First, update state immediately for responsive UI
    const wasPlaying = currentState.isPlaying;
    
    // Stop progress tracking early
    progressTracking.stop();
    
    // Get current state for update notification
    const status = audioStoryService.getPlaybackStatus();
    const newState = {
      isPlaying: false,
      currentProgress: status.progress || currentState.currentProgress,
      currentTime: status.currentTime || currentState.currentTime
    };
    
    // Now actually pause the audio with await
    await audioControls.pause();
    
    return newState;
  } catch (error) {
    // Attempt recovery if pause fails
    try {
      if (audioControls) {
        audioControls.pause();
      }
    } catch (recoveryError) {
      // Recovery failed
    }
    throw error;
  }
}

/**
 * Resume playback - optimized for reliability
 */
export async function resumePlayback(audioControls: AudioControl | null, progressTracking: ProgressTracker, currentState: PlaybackState): Promise<PlaybackState> {
  if (!audioControls) return currentState;
  
  try {
    // First, update state immediately for responsive UI
    const wasPlaying = currentState.isPlaying;
    
    // Start progress tracking early
    progressTracking.start();
    
    // Get current state for update notification
    const status = audioStoryService.getPlaybackStatus();
    const newState = {
      isPlaying: true,
      currentProgress: status.progress || currentState.currentProgress,
      currentTime: status.currentTime || currentState.currentTime
    };
    
    // Now actually resume the audio with await
    await audioControls.resume();
    
    return newState;
  } catch (error) {
    // Attempt recovery if resume fails by trying again
    try {
      if (audioControls) {
        setTimeout(() => {
          audioControls.resume();
        }, 100);
      }
    } catch (recoveryError) {
      // Recovery failed
    }
    throw error;
  }
}

/**
 * Seek to position
 */
export function seekToPosition(audioControls: AudioControl | null, progress: number, duration: number): SeekResult | null {
  if (audioControls) {
    const seekTime = (progress / 100) * duration;
    audioControls.seek(seekTime);
    return {
      currentProgress: progress,
      currentTime: seekTime
    };
  }
  return null;
}

/**
 * Set playback rate
 */
export function setPlaybackRate(audioControls: AudioControl | null, rate: number): void {
  if (audioControls) {
    audioControls.setPlaybackRate(rate);
  }
}

/**
 * Restart current story
 */
export function restartPlayback(currentPlayback: CurrentPlayback | null, playFn: PlayFunction): void {
  if (currentPlayback) {
    playFn(currentPlayback.story, currentPlayback.figureName);
  }
}