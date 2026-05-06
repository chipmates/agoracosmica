// Progress tracking for audio playback
import { audioStoryService } from '../../AudioStoryService';

interface ProgressData {
  progress: number;
  currentTime: number;
  duration: number;
}

type ProgressCallback = (data: ProgressData) => void;

/**
 * Progress tracker class
 */
export class ProgressTracker {
  private progressInterval: NodeJS.Timeout | null;
  private onProgress: ProgressCallback;

  constructor(onProgress: ProgressCallback) {
    this.progressInterval = null;
    this.onProgress = onProgress;
  }
  
  /**
   * Start progress tracking interval
   */
  start(): void {
    // Clear any existing interval
    this.stop();
    
    // Start new interval
    this.progressInterval = setInterval(() => {
      const playbackStatus = audioStoryService.getPlaybackStatus();
      
      if (playbackStatus) {
        this.onProgress({
          progress: playbackStatus.progress,
          currentTime: playbackStatus.currentTime,
          duration: playbackStatus.duration
        });
      }
    }, 500); // Update every 500ms
  }
  
  /**
   * Stop progress tracking interval
   */
  stop(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
  
  /**
   * Check if tracking is active
   */
  isActive(): boolean {
    return this.progressInterval !== null;
  }
}