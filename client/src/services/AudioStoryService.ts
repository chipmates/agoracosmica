// src/services/AudioStoryService.ts

// StoryTextProcessor not needed for Audio Library (only for dynamic TTS)
// import { storyTextProcessor } from './StoryTextProcessor';
// import { convertTextToSpeech } from './audio/tts';

interface AudioObject {
  url: string;
  speed?: number;
}

interface PlaybackOptions {
  onStart?: (data: { duration: number; timestamp: number }) => void;
  onProgress?: (data: { currentTime: number; duration: number; progress: number }) => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
  language?: string;
}

interface AudioControl {
  pause: () => void;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (time: number) => void;
  setPlaybackRate: (rate: number | string) => void;
}

interface PlaybackResult {
  control: AudioControl;
}

interface PlaybackStatus {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
}

class AudioStoryService {
  private currentAudio: HTMLAudioElement | null;
  private isPlaying: boolean;
  private listenerAbort: AbortController | null; // Cleanup signal for audio event listeners

  constructor() {
    this.currentAudio = null;
    this.isPlaying = false;
    this.listenerAbort = null;
  }

  // Handle pre-recorded audio playback
  async playPrerecordedAudio(
    audioUrlOrObject: string | AudioObject, 
    options: PlaybackOptions = {}
  ): Promise<PlaybackResult> {
    const {
      onStart,
      onProgress,
      onEnd,
      onError
    } = options;

    try {
      // Stop any current playback
      await this.stopCurrentAudio();

      // Handle either a string URL or an object with url and speed
      let audioUrl: string = '';
      let initialSpeed = 1.0;
      
      // Check if we received an object with url and speed
      if (typeof audioUrlOrObject === 'object' && audioUrlOrObject !== null) {
        audioUrl = audioUrlOrObject.url;
        initialSpeed = audioUrlOrObject.speed || 1.0;
      } else if (typeof audioUrlOrObject === 'string') {
        audioUrl = audioUrlOrObject;
      }

      // Create new Audio instance
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      // Abort previous listeners before creating new ones
      if (this.listenerAbort) {
        this.listenerAbort.abort();
      }
      this.listenerAbort = new AbortController();
      const { signal } = this.listenerAbort;

      // Store initialSpeed for later use (outside closures)
      const speedToApply = initialSpeed;

      // Set up event listeners (all cleaned up via abort signal on stop)
      audio.addEventListener('loadedmetadata', () => {
        if (speedToApply !== 1.0) {
          audio.playbackRate = speedToApply;
        }
        onStart?.({
          duration: audio.duration,
          timestamp: Date.now()
        });
      }, { signal });

      audio.addEventListener('canplay', () => {
        if (speedToApply !== 1.0 && audio.playbackRate !== speedToApply) {
          audio.playbackRate = speedToApply;
        }
      }, { signal });

      audio.addEventListener('timeupdate', () => {
        onProgress?.({
          currentTime: audio.currentTime,
          duration: audio.duration,
          progress: (audio.currentTime / audio.duration) * 100
        });
      }, { signal });

      audio.addEventListener('ended', () => {
        onEnd?.();
        this.currentAudio = null;
        this.isPlaying = false;
      }, { signal });

      audio.addEventListener('error', (error) => {
        onError?.(error);
        this.currentAudio = null;
        this.isPlaying = false;
      }, { signal });

      // Set playback rate one final time right before playing
      if (speedToApply !== 1.0) {
        audio.playbackRate = speedToApply;
      }
      
      // Start playback - catching promise rejection to handle autoplay restrictions
      this.isPlaying = true;
      try {
        // Use play() as a Promise but don't wait for it
        // This prevents blocking if autoplay is restricted
        const playPromise = audio.play();
        
        // Handle possible autoplay restrictions
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay prevented - still mark as playing so user can click the play button
            this.isPlaying = true;
          });
        }
      } catch (playError) {
        console.error('AudioStoryService: Error starting playback:', playError);
        // Don't throw error - let the UI handle play button state
      }
      
      // Double-check after playback starts
      if (speedToApply !== 1.0 && audio.playbackRate !== speedToApply) {
        audio.playbackRate = speedToApply;
      }

      return {
        control: {
          pause: () => audio.pause(),
          resume: () => audio.play(),
          stop: () => this.stopCurrentAudio(),
          seek: (time: number) => { audio.currentTime = time; },
          setPlaybackRate: (rate: number | string) => {
            const validRate = parseFloat(rate.toString());
            if (!isNaN(validRate)) {
              audio.playbackRate = validRate;

              // Verify the rate was set
              setTimeout(() => {
                if (audio.playbackRate !== validRate) {
                  audio.playbackRate = validRate;
                }
              }, 100);
            }
          }
        }
      };

    } catch (error) {
      console.error('Error playing pre-recorded audio:', error);
      throw error;
    }
  }

  // Handle TTS audio generation and playback
  // NOTE: This method is not used by Audio Library (only for dynamic story mode TTS)
  // Commented out to remove StoryTextProcessor dependency
  /*
  async playGeneratedAudio(text: string, figure: string, options: PlaybackOptions = {}): Promise<PlaybackResult> {
    const {
      onStart,
      onProgress,
      onEnd,
      onError,
      language = 'en'
    } = options;

    try {
      // Process text for TTS
      const processedText = await storyTextProcessor.processStoryText(text, language);
      
      // Generate TTS
      const responseIndex = Date.now();
      const audioFile = await convertTextToSpeech(
        processedText.text,
        responseIndex,
        figure,
        this.config.tts,
        this.config.ttsSettings?.speed || 1.0,
        language
      );

      // Play the generated audio - pass either the URL or the complete audio object
      return await this.playPrerecordedAudio(audioFile, {
        onStart,
        onProgress,
        onEnd,
        onError
      });

    } catch (error) {
      console.error('Error playing generated audio:', error);
      throw error;
    }
  }
  */

  // Stop current audio playback
  async stopCurrentAudio(): Promise<void> {
    // Abort all event listeners first
    if (this.listenerAbort) {
      this.listenerAbort.abort();
      this.listenerAbort = null;
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio = null;
        this.isPlaying = false;
      } catch (error) {
        console.error('Error stopping audio:', error);
      }
    }
  }

  // Get current playback status
  getPlaybackStatus(): PlaybackStatus {
    if (!this.currentAudio) {
      return {
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        progress: 0
      };
    }

    return {
      isPlaying: this.isPlaying,
      currentTime: this.currentAudio.currentTime,
      duration: this.currentAudio.duration,
      progress: (this.currentAudio.currentTime / this.currentAudio.duration) * 100
    };
  }
}

// Create singleton instance
export const audioStoryService = new AudioStoryService();