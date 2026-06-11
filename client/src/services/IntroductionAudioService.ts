// src/services/IntroductionAudioService.ts
import { audioStoryService } from './AudioStoryService';
import { loadFigureImageV2, getBestImageFromMetadata } from '../utils/imageLoaderV2';

// Import extracted modules
import { normalizeManifestFigureName } from './audio/introduction/figureNameNormalizer';
import { audioPathBuilder, AUDIO_SUPPORTED_LANGUAGES } from './audio/introduction/audioPathBuilder';
import {
  stopPlayback,
  togglePlayback as togglePlaybackControl,
  restartPlayback
} from './audio/introduction/playbackControls';
import { HistoryManager } from './audio/introduction/historyManager';
import { ProgressTracker } from './audio/introduction/progressTracker';
import { getNextStory, getPreviousStory, getFullFigureName } from './audio/introduction/navigationHelper';

// Re-export for backward compatibility
export { AUDIO_SUPPORTED_LANGUAGES };

// Type definitions
interface AudioControl {
  pause: () => void | Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (time: number) => void;
  setPlaybackRate: (rate: number | string) => void;
}

interface AudioResult {
  control: AudioControl;
}

interface Story {
  title?: string;
  figureId?: string;
  figureName?: string;
  seedId: string | number;
  language?: string;
  [key: string]: any;
}

interface CurrentPlayback {
  story: Story;
  figureName: string;
  language: string;
}

interface PlaybackData {
  duration: number;
  currentTime?: number;
  progress?: number;
  timestamp?: number;
}

interface PlaybackState {
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  playbackRate?: number;
  repeat?: boolean;
}

type EventCallback = (data: any) => void;

interface Listeners {
  [event: string]: EventCallback[];
}

interface NavigationResult {
  story?: Story | null;
  error?: string;
}

class IntroductionAudioService {
  private historyManager: HistoryManager;
  private progressTracker: ProgressTracker;
  private currentPlayback: CurrentPlayback | null;
  private audioControls: AudioControl | null;
  private listeners: Listeners;
  private repeat: boolean;
  private isPlaying: boolean;
  private isLoading: boolean;
  private playbackRate: number;
  private currentProgress: number;
  private currentTime: number;
  private duration: number;
  private queue: Story[];

  constructor() {
    // Initialize managers
    this.historyManager = new HistoryManager();
    this.progressTracker = new ProgressTracker((data: PlaybackData) => {
      if (this.audioControls && this.isPlaying) {
        this.currentProgress = data.progress || 0;
        this.currentTime = data.currentTime || 0;
        this.duration = data.duration;
        
        this.emit('playbackUpdate', {
          isPlaying: true,
          progress: data.progress,
          currentTime: data.currentTime,
          duration: data.duration
        });
      }
    });
    
    // Playback state
    this.currentPlayback = null;
    this.audioControls = null;
    this.listeners = {};
    this.repeat = false;
    this.isPlaying = false;
    this.isLoading = false;
    this.playbackRate = 1.0;
    this.currentProgress = 0;
    this.currentTime = 0;
    this.duration = 0;
    this.queue = [];
  }
  
  // Delegate to imported normalizer
  normalizeManifestFigureName(name: string): string {
    return normalizeManifestFigureName(name);
  }
  
  // Legacy method preserved for compatibility
  _normalizeManifestFigureName_legacy(name: string): string {
    if (!name) return '';
    
    // Check for direct matches first with the full name (including Echo of prefix)
    const lowerFullName = name.toLowerCase();
    const specialCasesWithPrefix: Record<string, string> = {
      'echo of martin luther king jr': 'king',
      'echo of martin luther king jr.': 'king',
      'echo of king jr': 'king',
      'echo of king jr.': 'king',
      'echo of martin luther king': 'king'
    };
    
    if (specialCasesWithPrefix[lowerFullName]) {
      return specialCasesWithPrefix[lowerFullName];
    }
    
    // Remove "Echo of " prefix if present
    let cleanName = name;
    if (name.toLowerCase().startsWith('echo of ')) {
      cleanName = name.substring(8); // Remove "Echo of " prefix
    }
    
    // Special case mapping - match the logic from StoryCollection
    const specialCases: Record<string, string> = {
      'leonardo da vinci': 'vinci',
      'da vinci': 'vinci',
      'leonardo': 'vinci',
      'dogen zenji': 'zenji',
      'zenji': 'zenji',
      'siddhartha gautama': 'gautama',
      'siddhartha': 'gautama',
      'buddha': 'gautama',
      'galileo galilei': 'galilei',
      'galileo': 'galilei',
      'martin luther king jr': 'king',
      'martin luther king jr.': 'king',
      'echo of martin luther king jr': 'king',
      'echo of martin luther king jr.': 'king',
      'king jr': 'king',
      'king jr.': 'king',
      'echo of king jr': 'king',
      'echo of king jr.': 'king',
      'jr.': 'king',
      'jr': 'king',
      'martin luther king': 'king',
      'echo of martin luther king': 'king',
      'hildegard von bingen': 'bingen',
      'hildegard': 'bingen',
      'marcus aurelius': 'aurelius',
      'marcus': 'aurelius',
      'marc aurel': 'aurelius',
      'echo von marc aurel': 'aurelius',
      'johann wolfgang von goethe': 'goethe',
      'wolfgang amadeus mozart': 'mozart',
      'william shakespeare': 'shakespeare',
      'virginia woolf': 'woolf',
      'william blake': 'blake',
      'arthur schopenhauer': 'schopenhauer',
      'friedrich nietzsche': 'nietzsche',
      'jane austen': 'austen',
      'simone de beauvoir': 'beauvoir',
      'frida kahlo': 'kahlo',
      'meister eckhart': 'eckhart',
      'emily dickinson': 'dickinson',
      'maya angelou': 'angelou',
      'albert einstein': 'einstein',
      'harriet tubman': 'tubman',
      'carl gustav jung': 'jung',
      'ada lovelace': 'lovelace',
      'nelson mandela': 'mandela',
      'joseph campbell': 'campbell'
    };
    
    const lowerName = cleanName.toLowerCase();
    if (specialCases[lowerName]) {
      return specialCases[lowerName];
    }
    
    // Default: return last part of the name
    const lastPart = lowerName.split(' ').pop() || '';
    return lastPart;
  }
  
  // Event listener management
  on(event: string, callback: EventCallback): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }
  
  off(event: string, callback: EventCallback): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }
  
  emit(event: string, data: any): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
  
  // Play a story (gated to prevent concurrent play requests)
  async play(story: Story, figureName?: string): Promise<AudioResult> {
    // Prevent concurrent play requests — second call while first is loading
    if (this.isLoading) {
      throw new Error('Play request already in progress');
    }

    try {
      // Signal loading state
      this.isLoading = true;
      this.emit('loadingChange', true);

      // If already playing, stop current playback
      if (this.audioControls) {
        await this.stop();
      }
      
      // Get figure ID and seed ID from story
      const figureId = story.figureId || (figureName && figureName.toLowerCase()) || '';
      const seedId = story.seedId;
      
      // Get language - default to English if not specified
      const language = story.language || 'en';

      // We only play pre-recorded audio files now
      let audioPath: string | null = null;
      
      // Build audio path using convention (no manifest needed)
      if (figureId && seedId) {
        // Normalize figure name for audio file paths
        let normalizedFigureId = this.normalizeManifestFigureName(figureId);

        // Special handling for King Jr. variants
        if (figureId.toLowerCase().includes('king') &&
            (figureId.toLowerCase().includes('jr') ||
             figureId.toLowerCase().includes('luther'))) {
          normalizedFigureId = 'king';
        }
        
        // Check if this seed exists (seeds 1-12)
        if (!audioPathBuilder.hasSeed(normalizedFigureId, seedId)) {
          this.isLoading = false;
          this.emit('loadingChange', false);
          throw new Error('Invalid seed number');
        }
        
        // First try the selected language if it's supported
        if (audioPathBuilder.hasAudio(normalizedFigureId, seedId, language)) {
          audioPath = audioPathBuilder.getAudioPath(normalizedFigureId, seedId, language);
        } 
        // If not found or language not supported, use fallback
        else {
          // Try English first as fallback, then German
          const fallbackLanguages = AUDIO_SUPPORTED_LANGUAGES.filter(lang => lang !== language);
          
          for (const fallbackLang of fallbackLanguages) {
            if (audioPathBuilder.hasAudio(normalizedFigureId, seedId, fallbackLang)) {
              audioPath = audioPathBuilder.getAudioPath(normalizedFigureId, seedId, fallbackLang);
              break;
            }
          }
        }
        
        // If still no audio found (shouldn't happen with our convention)
        if (!audioPath) {
          this.isLoading = false;
          this.emit('loadingChange', false);
          throw new Error('No audio available for this story');
        }
      }
      
      // Add story to history
      this.addToHistory(story);
      
      // Set current playback with full figure name if available
      let fullFigureName = figureId;
      
      try {
        // Try to get the full figure name
        const { historicalFigures } = await import('../api/figures');
        
        // Find the matching figure
        const normalizedFigureId = this.normalizeManifestFigureName(figureId);
        const figureMatch = historicalFigures.find(f => {
          const nameParts = f.name.toLowerCase().split(' ');
          const lastName = nameParts[nameParts.length - 1];
          // More robust comparison using our normalization function
          const normalizedName = this.normalizeManifestFigureName(f.name.toLowerCase());
          return lastName === normalizedFigureId || 
                 normalizedFigureId.includes(lastName) ||
                 lastName.includes(normalizedFigureId) ||
                 normalizedName === normalizedFigureId;
        });
        
        if (figureMatch) {
          fullFigureName = figureMatch.name;
        }
      } catch (error) {
        console.error('Error getting full figure name:', error);
      }
      
      // Set current playback with the full figure name
      this.currentPlayback = {
        story,
        figureName: fullFigureName,
        language
      };
      
      // Emit track change event to update UI while loading
      this.emit('trackChange', this.currentPlayback);
      
      // Import S3 utils directly to avoid circular dependencies
      const { getSignedUrl } = await import('../utils/s3Utils');
      const audioUrl = await getSignedUrl(audioPath!);
      
      
      // Play using pre-recorded audio
      const audioResult = await audioStoryService.playPrerecordedAudio(
        audioUrl,
        {
          onStart: (data) => {
            this.isLoading = false;
            this.emit('loadingChange', false);
            this.handlePlaybackStart(data, story, figureId);
          },
          onProgress: (data) => this.handlePlaybackProgress(data),
          onEnd: () => this.handlePlaybackEnd(story, figureId),
          onError: (error) => {
            this.isLoading = false;
            this.emit('loadingChange', false);
            this.handlePlaybackError(error);
          }
        }
      );
      
      // Store audio controls for later manipulation
      this.audioControls = audioResult.control;
      
      // Set initial playback rate
      if (this.playbackRate !== 1.0 && this.audioControls) {
        this.audioControls.setPlaybackRate(this.playbackRate);
      }
      
      return audioResult;
    } catch (error) {
      console.error('Failed to play instruction story:', error);
      this.isLoading = false;
      this.emit('loadingChange', false);
      throw error;
    }
  }
  
  // Handler for playback start
  private handlePlaybackStart(data: PlaybackData, story: Story, figureId: string): void {
    this.isPlaying = true;
    this.duration = data.duration;
    
    // Start progress tracking
    this.startProgressTracking();
    
    // Set MediaSession metadata for lock screen controls with vite-processed artwork
    if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
      // Load thumbnail asynchronously for lock screen artwork
      loadFigureImageV2(figureId, 'thumbnail').then(async metadata => {
        if (metadata && metadata.length > 0) {
          // Get best image (prioritize WebP, fallback to PNG)
          const bestImage = getBestImageFromMetadata(metadata, 512, 'webp');
          const artworkUrl = bestImage?.primary || bestImage?.webp?.src || bestImage?.png?.src;

          if (artworkUrl) {
            try {
              // Get full figure name with "Echo of..." prefix for elegant lock screen display
              const fullFigureName = await getFullFigureName(figureId);

              navigator.mediaSession.metadata = new MediaMetadata({
                title: story.title || 'Instruction Story',
                artist: fullFigureName || story.figureName || figureId,
                album: 'Agora Cosmica',
                artwork: [
                  { src: artworkUrl, sizes: '512x512', type: 'image/webp' },
                ]
              });
            } catch (error) {
              console.warn('MediaMetadata not supported:', error);
            }
          }
        }
      }).catch(error => {
        console.warn('Failed to load thumbnail for media session:', error);
      });
    }
    
    // Notify listeners
    this.emit('playbackUpdate', {
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      duration: data.duration
    });
  }
  
  // Handler for playback progress
  private handlePlaybackProgress(data: PlaybackData): void {
    this.currentProgress = data.progress || 0;
    this.currentTime = data.currentTime || 0;
    
    // Notify listeners
    this.emit('playbackUpdate', {
      isPlaying: true,
      progress: data.progress,
      currentTime: data.currentTime,
      duration: data.duration
    });
  }
  
  // Handler for playback end
  private handlePlaybackEnd(story: Story, figureId: string): void {
    this.isPlaying = false;
    this.stopProgressTracking();
    
    // Notify listeners
    this.emit('playbackUpdate', {
      isPlaying: false,
      progress: 100,
      currentTime: this.duration,
      duration: this.duration
    });
    
    // If repeat is enabled, play the same story again
    if (this.repeat) {
      setTimeout(() => this.play(story, figureId), 500);
      return;
    }
    
    // Otherwise, play next in queue
    if (this.queue.length > 0) {
      const nextStory = this.queue.shift()!;
      this.emit('queueUpdate', [...this.queue]);
      
      // Use timeout to prevent overlapping audio
      setTimeout(() => {
        this.play(nextStory, nextStory.figureId);
      }, 500);
    }
  }
  
  // Handler for playback error
  private handlePlaybackError(error: any): void {
    console.error('Error playing instruction story:', error);
    this.isPlaying = false;
    this.stopProgressTracking();
    
    // Notify listeners
    this.emit('playbackError', error);
  }
  
  // Stop current playback
  async stop(): Promise<void> {
    const result = await stopPlayback(this.audioControls, this.progressTracker);
    this.audioControls = result.audioControls;
    this.isPlaying = result.isPlaying;
    
    // Notify listeners
    this.emit('playbackUpdate', {
      isPlaying: false,
      progress: this.currentProgress,
      currentTime: this.currentTime,
      duration: this.duration
    });
  }
  
  // Toggle playback - unified method for play/pause
  async togglePlayback(): Promise<void> {
    await togglePlaybackControl(
      this.audioControls,
      this.isPlaying,
      () => this.pause(),
      () => this.resume()
    );
  }
  
  // Pause playback - optimized for reliability
  async pause(): Promise<void> {
    if (!this.audioControls) return;

    try {
      // First, update state immediately for responsive UI
      this.isPlaying = false;
      
      // Stop progress tracking early
      this.stopProgressTracking();
      
      // Get current state for update notification
      const status = audioStoryService.getPlaybackStatus();
      this.currentProgress = status.progress || this.currentProgress;
      this.currentTime = status.currentTime || this.currentTime;
      
      // Notify listeners before pausing for faster UI response
      this.emit('playbackUpdate', {
        isPlaying: false,
        progress: this.currentProgress,
        currentTime: this.currentTime,
        duration: this.duration
      });
      
      // Now actually pause the audio with await
      await this.audioControls.pause();
      
      // Only fire events if we were actually playing before
      // Audio paused
    } catch (error) {
      console.error('Error pausing audio:', error);
      
      // Attempt recovery if pause fails
      try {
        if (this.audioControls) {
          this.audioControls.pause();
        }
      } catch (recoveryError) {
        console.error('Recovery attempt failed:', recoveryError);
      }
    }
  }
  
  // Resume playback - optimized for reliability
  async resume(): Promise<void> {
    if (!this.audioControls) return;

    try {
      // First, update state immediately for responsive UI
      this.isPlaying = true;
      
      // Start progress tracking early
      this.startProgressTracking();
      
      // Get current state for update notification
      const status = audioStoryService.getPlaybackStatus();
      this.currentProgress = status.progress || this.currentProgress;
      this.currentTime = status.currentTime || this.currentTime;
      
      // Notify listeners before resuming for faster UI response
      this.emit('playbackUpdate', {
        isPlaying: true,
        progress: this.currentProgress,
        currentTime: this.currentTime,
        duration: this.duration
      });
      
      // Now actually resume the audio with await
      await this.audioControls.resume();
      
      // Only fire events if we weren't playing before
      // Audio resumed
    } catch (error) {
      console.error('Error resuming audio:', error);
      
      // Attempt recovery if resume fails by trying again
      try {
        if (this.audioControls) {
          setTimeout(() => {
            this.audioControls!.resume();
          }, 100);
        }
      } catch (recoveryError) {
        console.error('Recovery attempt failed:', recoveryError);
      }
    }
  }
  
  // Seek to position
  seek(progress: number): void {
    if (this.audioControls) {
      const seekTime = (progress / 100) * this.duration;
      this.audioControls.seek(seekTime);
      this.currentProgress = progress;
      this.currentTime = seekTime;
      
      // Notify listeners
      this.emit('playbackUpdate', {
        isPlaying: this.isPlaying,
        progress,
        currentTime: seekTime,
        duration: this.duration
      });
    }
  }
  
  // Set playback rate
  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    
    if (this.audioControls) {
      this.audioControls.setPlaybackRate(rate);
    }
    
    // Notify listeners
    this.emit('rateChange', rate);
  }
  
  // Set repeat mode
  setRepeat(enabled: boolean): void {
    this.repeat = enabled;
  }
  
  // Get current playback state
  getPlaybackState(): PlaybackState {
    return {
      isPlaying: this.isPlaying,
      progress: this.currentProgress,
      currentTime: this.currentTime,
      duration: this.duration,
      playbackRate: this.playbackRate,
      repeat: this.repeat
    };
  }
  
  // Add story to queue
  addToQueue(story: Story, figureName: string | null = null): void {
    // If figureName is provided, update the story object
    const enhancedStory = figureName 
      ? { ...story, figureId: figureName.toLowerCase() }
      : story;
    
    this.queue.push(enhancedStory);
    
    // Notify listeners
    this.emit('queueUpdate', [...this.queue]);
  }
  
  // Remove story from queue
  removeFromQueue(index: number): void {
    if (index >= 0 && index < this.queue.length) {
      this.queue.splice(index, 1);
      
      // Notify listeners
      this.emit('queueUpdate', [...this.queue]);
    }
  }
  
  // Clear queue
  clearQueue(): void {
    this.queue = [];
    
    // Notify listeners
    this.emit('queueUpdate', []);
  }
  
  // Set entire queue
  setQueue(newQueue: Story[]): void {
    this.queue = [...newQueue];
    
    // Notify listeners
    this.emit('queueUpdate', [...this.queue]);
  }
  
  // Get queue
  getQueue(): Story[] {
    return [...this.queue];
  }
  
  // Add story to history
  addToHistory(story: Story): void {
    const updatedHistory = this.historyManager.addToHistory(story);
    
    // Notify listeners
    this.emit('historyUpdate', updatedHistory);
  }
  
  // Clear history
  clearHistory(): void {
    const updatedHistory = this.historyManager.clearHistory();
    
    // Notify listeners
    this.emit('historyUpdate', updatedHistory);
  }
  
  // Get history
  getHistory(): Story[] {
    return this.historyManager.getHistory();
  }
  
  // Get current playback
  getCurrentPlayback(): CurrentPlayback | null {
    return this.currentPlayback;
  }
  
  // Play a story without adding it to history (for back navigation)
  async playWithoutAddingToHistory(story: Story, figureName?: string): Promise<AudioResult> {
    if (this.isLoading) {
      throw new Error('Play request already in progress');
    }

    try {
      // Signal loading state
      this.isLoading = true;
      this.emit('loadingChange', true);

      // If already playing, stop current playback
      if (this.audioControls) {
        await this.stop();
      }
      
      // Get figure ID and seed ID from story
      const figureId = story.figureId || (figureName && figureName.toLowerCase()) || '';
      const seedId = story.seedId;
      
      // Get language - default to English if not specified
      const language = story.language || 'en';
      
      
      // We only play pre-recorded audio files now
      let audioPath: string | null = null;
      
      // Build audio path using convention (no manifest needed)
      if (figureId && seedId) {
        // Normalize figure name for audio file paths
        let normalizedFigureId = this.normalizeManifestFigureName(figureId);

        // Special handling for King Jr. variants
        if (figureId.toLowerCase().includes('king') &&
            (figureId.toLowerCase().includes('jr') ||
             figureId.toLowerCase().includes('luther'))) {
          normalizedFigureId = 'king';
        }
        
        // Check if this seed exists (seeds 1-12)
        if (!audioPathBuilder.hasSeed(normalizedFigureId, seedId)) {
          this.isLoading = false;
          this.emit('loadingChange', false);
          throw new Error('Invalid seed number');
        }
        
        // First try the selected language if it's supported
        if (audioPathBuilder.hasAudio(normalizedFigureId, seedId, language)) {
          audioPath = audioPathBuilder.getAudioPath(normalizedFigureId, seedId, language);
        } 
        // If not found or language not supported, use fallback
        else {
          // Try English first as fallback, then German
          const fallbackLanguages = AUDIO_SUPPORTED_LANGUAGES.filter(lang => lang !== language);
          
          for (const fallbackLang of fallbackLanguages) {
            if (audioPathBuilder.hasAudio(normalizedFigureId, seedId, fallbackLang)) {
              audioPath = audioPathBuilder.getAudioPath(normalizedFigureId, seedId, fallbackLang);
              break;
            }
          }
        }
        
        // If still no audio found (shouldn't happen with our convention)
        if (!audioPath) {
          this.isLoading = false;
          this.emit('loadingChange', false);
          throw new Error('No audio available for this story');
        }
      }
      
      // Skip adding to history - this is the key difference from the play() method
      
      // Set current playback with full figure name if available
      let fullFigureName = figureId;
      
      try {
        // Try to get the full figure name
        const { historicalFigures } = await import('../api/figures');
        
        // Find the matching figure
        const normalizedFigureId = this.normalizeManifestFigureName(figureId);
        const figureMatch = historicalFigures.find(f => {
          const nameParts = f.name.toLowerCase().split(' ');
          const lastName = nameParts[nameParts.length - 1];
          // More robust comparison using our normalization function
          const normalizedName = this.normalizeManifestFigureName(f.name.toLowerCase());
          return lastName === normalizedFigureId || 
                 normalizedFigureId.includes(lastName) ||
                 lastName.includes(normalizedFigureId) ||
                 normalizedName === normalizedFigureId;
        });
        
        if (figureMatch) {
          fullFigureName = figureMatch.name;
        }
      } catch (error) {
        console.error('Error getting full figure name:', error);
      }
      
      // Set current playback with the full figure name
      this.currentPlayback = {
        story,
        figureName: fullFigureName,
        language
      };
      
      // Emit track change event to update UI while loading
      this.emit('trackChange', this.currentPlayback);
      
      // Import S3 utils directly to avoid circular dependencies
      const { getSignedUrl } = await import('../utils/s3Utils');
      const audioUrl = await getSignedUrl(audioPath!);
      
      
      // Play using pre-recorded audio
      const audioResult = await audioStoryService.playPrerecordedAudio(
        audioUrl,
        {
          onStart: (data) => {
            this.isLoading = false;
            this.emit('loadingChange', false);
            this.handlePlaybackStart(data, story, figureId);
          },
          onProgress: (data) => this.handlePlaybackProgress(data),
          onEnd: () => this.handlePlaybackEnd(story, figureId),
          onError: (error) => {
            this.isLoading = false;
            this.emit('loadingChange', false);
            this.handlePlaybackError(error);
          }
        }
      );
      
      // Store audio controls for later manipulation
      this.audioControls = audioResult.control;
      
      // Set initial playback rate
      if (this.playbackRate !== 1.0 && this.audioControls) {
        this.audioControls.setPlaybackRate(this.playbackRate);
      }
      
      return audioResult;
    } catch (error) {
      console.error('Failed to play instruction story:', error);
      this.isLoading = false;
      this.emit('loadingChange', false);
      throw error;
    }
  }
  
  // Play next story for the current figure
  async playNext(): Promise<void> {
    // Don't set isLoading here — play() sets it internally.
    // Setting it before play() causes self-blocking (play() rejects if isLoading is true).
    
    // First check if we have items in the queue (use this.queue, not queueManager)
    if (this.queue.length > 0) {
      const nextStory = this.queue.shift();
      this.emit('queueUpdate', [...this.queue]);

      if (nextStory) {
        try {
          await this.play(nextStory, nextStory.figureId);
        } catch (error) {
          this.isLoading = false;
          this.emit('loadingChange', false);
        }
      } else {
        this.isLoading = false;
        this.emit('loadingChange', false);
      }
      return;
    }
    
    // If no queue, get next story for this figure
    try {
      if (!this.currentPlayback || !this.currentPlayback.story || !this.currentPlayback.figureName) {
        this.isLoading = false;
        this.emit('loadingChange', false);
        return;
      }
      
      const currentFigure = this.currentPlayback.figureName;
      const currentSeedId = parseInt(String(this.currentPlayback.story.seedId));
      
      const { story: nextStory, error } = await getNextStory(
        this.currentPlayback,
        currentFigure,
        currentSeedId
      ) as NavigationResult;
      
      if (error || !nextStory) {
        this.isLoading = false;
        this.emit('loadingChange', false);
        return;
      }
      
      // Play the next story
      await this.play(nextStory, nextStory.figureId);
      
      // Emit track change event
      this.emit('trackChange', this.currentPlayback);
      
    } catch (error) {
      this.isLoading = false;
      this.emit('loadingChange', false);
    }
  }
  
  // Play previous story for the current figure
  async playPrevious(): Promise<void> {
    // Don't set isLoading here — play()/playWithoutAddingToHistory() sets it internally.
    
    // First check history
    if (this.historyManager.hasPrevious()) {
      const previousStory = this.historyManager.getPrevious();

      if (previousStory) {
        // Remove current from history before playing previous
        this.historyManager.removeCurrentFromHistory();

        try {
          // Don't add to history when playing previous track
          await this.playWithoutAddingToHistory(previousStory, previousStory.figureId);
        } catch (error) {
          this.isLoading = false;
          this.emit('loadingChange', false);
        }
      } else {
        this.isLoading = false;
        this.emit('loadingChange', false);
      }
      return;
    }
    
    // If no history, get previous story for this figure
    try {
      if (!this.currentPlayback || !this.currentPlayback.story || !this.currentPlayback.figureName) {
        this.isLoading = false;
        this.emit('loadingChange', false);
        return;
      }
      
      const currentFigure = this.currentPlayback.figureName;
      const currentSeedId = parseInt(String(this.currentPlayback.story.seedId));
      
      const { story: prevStory, error } = await getPreviousStory(
        this.currentPlayback,
        currentFigure,
        currentSeedId
      ) as NavigationResult;
      
      if (error || !prevStory) {
        this.isLoading = false;
        this.emit('loadingChange', false);
        return;
      }
      
      // Play the previous story without adding to history
      await this.playWithoutAddingToHistory(prevStory, prevStory.figureId);
      
      // Emit track change event
      this.emit('trackChange', this.currentPlayback);
      
    } catch (error) {
      this.isLoading = false;
      this.emit('loadingChange', false);
    }
  }
  
  // Restart current story
  restart(): void {
    restartPlayback(this.currentPlayback, (story, figureName) => this.play(story, figureName));
  }
  
  // Start progress tracking interval
  private startProgressTracking(): void {
    this.progressTracker.start();
  }

  // Stop progress tracking interval
  private stopProgressTracking(): void {
    this.progressTracker.stop();
  }

  // Cleanup all resources (call when service is no longer needed)
  async destroy(): Promise<void> {
    await this.stop();
    this.stopProgressTracking();
    this.clearQueue();
    this.clearHistory();
    this.listeners = {};
    this.currentPlayback = null;
  }
}

// Create and export singleton
export const introductionAudioService = new IntroductionAudioService();