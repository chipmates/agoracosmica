import { eventEmitter } from './EventEmitter';
import { cleanupAudioResources } from './audioService';
import storyService from './StoryService';
import { getSeedById } from './seedCacheInitializer';
import { Seed, Language } from '../types/global';
import { useDomainStore } from '../stores/domainStore';
import { createRequestGate } from '../utils/async/requestGate';
import { abortable, AbortableTask } from '../utils/async/abortable';

interface ActiveStory {
  figure: string;
  seedId: string;
  language: string;
  startTime: number;
  mode: string;
}

interface StoryResult {
  type: 'prerecorded' | 'generated';
  [key: string]: any;
}

interface RefreshStoryParams {
  figure: string;
  seedId: string | number;
  language?: string;
  onComplete?: (story: StoryResult) => void;
  onError?: (error: any) => void;
}

interface StartStoryParams {
  figure: string;
  seedId: string | number;
  language: string;
  seedData?: Seed | null;
  isRestoration?: boolean;
  onComplete?: (story: StoryResult) => void;
  onError?: (error: any) => void;
}

class StoryIntegrationManager {
  private activeStory: ActiveStory | null;
  private storyGate = createRequestGate();
  private activeStoryTask: AbortableTask<StoryResult> | null = null;

  constructor() {
    this.activeStory = null;
  }

  /**
   * Reloads story data for history entries that contain prerecorded stories
   * This gets fresh S3 URLs for audio content
   */
  async refreshStoryFromHistory({ 
    figure, 
    seedId, 
    language, 
    onComplete, 
    onError 
  }: RefreshStoryParams): Promise<StoryResult | null> {
    try {
      // First, check if we can find the seed data
      const normalizedSeedId = seedId?.toString() || "";

      // Find the seed data using the multilingual seed cache
      // The language parameter should be provided, otherwise fall back to Zustand
      const languageToUse = language || useDomainStore.getState().language.current || 'en';
      
      // Handle different seed ID formats
      let seedIdToSearch = normalizedSeedId;
      
      // If the seedId includes the figure prefix, extract just the number
      if (normalizedSeedId.includes('-')) {
        const parts = normalizedSeedId.split('-');
        seedIdToSearch = parts[parts.length - 1];
      }
      
      // Try to get the seed data - getSeedById handles various ID formats
      const seedData = getSeedById(figure, seedIdToSearch, languageToUse as Language);
      
      if (!seedData) {
        console.error(`Could not find seed ${normalizedSeedId} for figure ${figure} in language ${languageToUse}`);
        return null;
      }
      
      // Now load the story with fresh URLs
      return this.startStory({
        figure,
        seedId: normalizedSeedId,
        language: language || 'en',
        seedData,
        onComplete,
        onError
      });
      
    } catch (err) {
      console.error('Error refreshing story from history:', err);
      onError?.(err);
      return null;
    }
  }

  async startStory({ 
    figure, 
    seedId, 
    language, 
    seedData, 
    onComplete, 
    onError 
  }: StartStoryParams): Promise<StoryResult> {
    const normalizedSeedId = seedId?.toString() || '';
    const gateKey = `${figure}:${normalizedSeedId}:${language}`;
    const pass = this.storyGate.begin(gateKey);

    // Abort any in-flight story load before starting a new one
    this.activeStoryTask?.abort();
    await this.resetCurrentStory();

    this.activeStory = {
      figure,
      seedId: normalizedSeedId,
      language,
      startTime: Date.now(),
      mode: 'introduction'
    };

    eventEmitter.emit('storyStart', this.activeStory);

    const task = abortable<StoryResult>(async (signal) => {
      if (import.meta.env.DEV) console.log('[StoryIntegrationManager] Loading story:', { figure, normalizedSeedId, language });
      const story = await storyService.loadStory(
        figure,
        normalizedSeedId,
        language,
        seedData || null,
        { signal }
      );
      if (signal.aborted) {
        throw new DOMException('Story request aborted', 'AbortError');
      }
      if (import.meta.env.DEV) console.log('[StoryIntegrationManager] Story loaded:', { type: story.type, hasText: !!story.text, audioUrl: story.audioUrl?.substring(0, 80) });
      return story;
    });

    this.activeStoryTask = task;

    try {
      const story = await task.promise;

      if (!pass.isCurrent() || task.signal.aborted) {
        if (import.meta.env.DEV) console.warn('[StoryIntegrationManager] Story load STALE — pass.isCurrent:', pass.isCurrent(), 'aborted:', task.signal.aborted);
        return story;
      }

      // Call onComplete immediately — setting React state should not be delayed.
      // The original 300ms/1000ms setTimeout made onComplete fragile under
      // StrictMode double-firing (the pass could go stale during the delay).
      if (import.meta.env.DEV) console.log('[StoryIntegrationManager] ✓ Calling onComplete with story type:', story.type);
      onComplete?.(story);

      // Emit storyComplete event with a short delay for audio readiness
      const delay = story.type === 'prerecorded' ? 300 : 1000;
      setTimeout(() => {
        if (pass.isCurrent() && !task.signal.aborted) {
          eventEmitter.emit('storyComplete', story);
        }
      }, delay);

      return story;
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') {
        throw err;
      }
      this.handleStoryError(err);
      onError?.(err);
      throw err;
    } finally {
      if (this.activeStoryTask === task) {
        this.activeStoryTask = null;
      }
    }
  }

  async resetCurrentStory(): Promise<void> {
    if (this.activeStoryTask) {
      this.activeStoryTask.abort();
      this.activeStoryTask = null;
    }

    if (this.activeStory) {
      cleanupAudioResources();
      this.activeStory = null;
    }
  }

  handleStoryError(error: any): void {
    console.error('Story error:', error);
    
    // Add more context to help debug seed ID issues
    if (this.activeStory) {
      console.error(`Error details - figure: ${this.activeStory.figure}, seedId: ${this.activeStory.seedId} (${typeof this.activeStory.seedId}), language: ${this.activeStory.language}`);
    }
    
    // Enhance error message for specific types of errors
    let enhancedError: any = error;
    if (error instanceof TypeError && error.message.includes('match')) {
      const errorMessage = `Type error with seed ID formatting. Please ensure seed ID is a valid string. Original error: ${error.message}`;
      enhancedError = new Error(errorMessage);
      enhancedError.originalError = error;
    }
    
    eventEmitter.emit('storyError', enhancedError);
  }

  cleanup(): void {
    void this.resetCurrentStory();
  }
}

export const storyIntegrationManager = new StoryIntegrationManager();
