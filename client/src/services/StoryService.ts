// StoryService.ts - Simplified story service for pre-created stories only
// Supports WebM/Opus (primary) + MP3 (fallback) audio + TXT files for EN/DE languages
// Direct path construction - no manifest system needed
// Drop-in replacement that preserves history and seed conversation integration

import { getMediaUrl, getMediaHeaders } from '../utils/mediaConfig';
import { normalizeFigureName } from '../utils/nameUtils';
import { eventEmitter } from './EventEmitter';
import { Language, Seed } from '../types/global';

export interface StoryTimestampParagraph {
  index: number;
  start: number;
  end: number;
  text_preview: string;
}

export interface StoryTimestamps {
  version: number;
  paragraphs: StoryTimestampParagraph[];
  source: 'whisper' | 'elevenlabs';
  audio_duration: number;
}

interface StoryData {
  type: 'prerecorded';
  audioUrl: string;
  text: string;
  needsTranslation: boolean;
  requestedLanguage?: string;
  languageUsed?: string;
  timestamps?: StoryTimestamps;
}

interface TextReadyEvent {
  role: 'assistant';
  content: string;
}

/**
 * Converts hyphenated seed IDs (e.g., "gautama-1") to numeric format ("1") 
 */
const normalizeSeedId = (seedId: string | number): string => {
  if (typeof seedId !== 'string') {
    return seedId.toString();
  }
  
  // Special case for Martin Luther King Jr.
  if (seedId.startsWith('king-')) {
    return seedId.split('-')[1];
  }
  
  // Pattern: "name-number" -> "number"
  const match = seedId.match(/^([a-z]+)-(\d+)$/i);
  if (match) {
    return match[2];
  }
  return seedId;
};

/**
 * Build S3 path using direct construction (no manifest needed)
 * Pattern: stories/{figure}/{lang}/{figure}_{seed}_{lang}.{ext}
 */
const buildStoryPath = (figure: string, seedId: string, language: string, extension: string): string => {
  return `stories/${figure}/${language}/${figure}_${seedId}_${language}.${extension}`;
};

/** Detect WebM/Opus support (cached). Dev always uses MP3 (local assets). */
let _canPlayWebm: boolean | null = null;
function canPlayWebm(): boolean {
  if (_canPlayWebm === null) {
    if (import.meta.env.DEV) {
      _canPlayWebm = false; // Dev only has MP3 locally
    } else {
      try {
        const audio = document.createElement('audio');
        _canPlayWebm = audio.canPlayType('audio/webm; codecs=opus') !== '';
      } catch {
        _canPlayWebm = false;
      }
    }
  }
  return _canPlayWebm;
}

/** Preferred audio format: WebM in production (with MP3 fallback), MP3 in dev */
function getPreferredAudioFormat(): 'webm' | 'mp3' {
  return canPlayWebm() ? 'webm' : 'mp3';
}

class StoryService {
  private cache: Map<string, StoryData>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Load pre-created S3 story (WebM audio + TXT text)
   * Same interface as complex StoryService - preserves history/seed conversation integration
   */
  async loadStory(
    figure: string,
    seedId: string | number,
    language: Language | string,
    seedData: Seed | null = null,
    options: { signal?: AbortSignal } = {}
  ): Promise<StoryData> {
    const { signal } = options;
    const throwIfAborted = () => {
      if (signal?.aborted) {
        throw new DOMException('Story request aborted', 'AbortError');
      }
    };

    throwIfAborted();

    if (!figure || !seedId || !language) {
      throw new Error('Missing required parameters for story loading');
    }

    let langCode = language.toLowerCase();
    
    // Only support EN/DE as per simplification requirements
    if (!['en', 'de'].includes(langCode)) {
      console.warn(`Unsupported language: ${langCode}. Falling back to English.`);
      langCode = 'en';
    }

    const normalizedFigure = normalizeFigureName(figure);
    const normalizedSeedId = normalizeSeedId(seedId);

    // Check cache first
    const cacheKey = `${normalizedFigure}::${normalizedSeedId}::${langCode}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      // Re-emit text for UI consistency (critical for history/seed conversation)
      if (cached.text) {
        eventEmitter.emit<TextReadyEvent>('textReady', {
          role: 'assistant',
          content: cached.text
        });
      }
      return cached;
    }

    throwIfAborted();

    // Try preferred format (WebM in production, MP3 in dev), then fallback
    const preferred = getPreferredAudioFormat();
    const fallbackFmt = preferred === 'webm' ? 'mp3' : null;

    let story = await this.tryLoadStoryWithFormat(
      normalizedFigure,
      normalizedSeedId,
      langCode,
      preferred,
      signal
    );

    // Fallback to MP3 if WebM not available
    if (!story && fallbackFmt) {
      story = await this.tryLoadStoryWithFormat(
        normalizedFigure,
        normalizedSeedId,
        langCode,
        fallbackFmt,
        signal
      );
    }

    if (!story && langCode !== 'en') {
      console.warn(
        `No pre-created story found for ${normalizedFigure} seed ${normalizedSeedId} in ${langCode}. ` +
        `Attempting English fallback.`
      );
      let fallbackStory = await this.tryLoadStoryWithFormat(
        normalizedFigure,
        normalizedSeedId,
        'en',
        preferred,
        signal
      );
      if (!fallbackStory && fallbackFmt) {
        fallbackStory = await this.tryLoadStoryWithFormat(
          normalizedFigure,
          normalizedSeedId,
          'en',
          fallbackFmt,
          signal
        );
      }

      if (fallbackStory) {
        story = {
          ...fallbackStory,
          needsTranslation: true,
          requestedLanguage: langCode,
          languageUsed: 'en',
        };

        const fallbackCacheKey = `${normalizedFigure}::${normalizedSeedId}::en`;
        if (!this.cache.has(fallbackCacheKey)) {
          this.cache.set(fallbackCacheKey, fallbackStory);
        }
      }
    }

    // If no pre-created story found at all, throw error
    if (!story) {
      throw new Error(
        `No pre-created story found for ${normalizedFigure} seed ${normalizedSeedId} in ${langCode}. ` +
        `Expected files: ${buildStoryPath(normalizedFigure, normalizedSeedId, langCode, preferred)}`
      );
    }

    // Check abort BEFORE caching — aborted loads may have partial data
    throwIfAborted();

    // Cache the result
    this.cache.set(cacheKey, {
      ...story,
      requestedLanguage: langCode,
      languageUsed: story.languageUsed ?? langCode,
    });

    // Emit text for UI integration - CRITICAL for history and seed conversation
    if (story.text) {
      eventEmitter.emit<TextReadyEvent>('textReady', {
        role: 'assistant', 
        content: story.text
      });
    }

    return {
      ...story,
      requestedLanguage: langCode,
      languageUsed: story.languageUsed ?? langCode,
    };
  }

  /**
   * Try to load story with specific audio format (webm or mp3)
   */
  async tryLoadStoryWithFormat(
    figure: string,
    seedId: string,
    langCode: string,
    audioFormat: string,
    signal?: AbortSignal
  ): Promise<StoryData | null> {
    if (signal?.aborted) {
      throw new DOMException('Story request aborted', 'AbortError');
    }
    // Build paths directly - no manifest needed!
    const audioPath = buildStoryPath(figure, seedId, langCode, audioFormat);
    const textPath = buildStoryPath(figure, seedId, langCode, 'txt');

    // Get media URLs (environment-aware: dev uses proxy, prod uses Worker)
    let audioUrl: string;
    try {
      audioUrl = getMediaUrl(audioPath);
      if (signal?.aborted) {
        throw new DOMException('Story request aborted', 'AbortError');
      }
    } catch {
      return null;
    }

    // Check if audio file exists
    if (!(await this.checkResourceExists(audioUrl, signal))) {
      return null;
    }

    // Load text content (optional - some stories might not have text)
    let textContent = '';
    let textUrl: string;
    try {
      textUrl = getMediaUrl(textPath);
      if (signal?.aborted) {
        throw new DOMException('Story request aborted', 'AbortError');
      }
      if (await this.checkResourceExists(textUrl, signal)) {
        textContent = await this.loadTextContent(textUrl, signal);
      }
    } catch {
      // Text file not found - continue without text
    }

    // Load timestamps (optional - highlighting works without them)
    let timestamps: StoryTimestamps | undefined;
    try {
      const timestampsPath = buildStoryPath(figure, seedId, langCode, 'timestamps.json');
      const timestampsUrl = getMediaUrl(timestampsPath);
      if (!signal?.aborted && await this.checkResourceExists(timestampsUrl, signal)) {
        timestamps = await this.loadTimestamps(timestampsUrl, signal);
      }
    } catch {
      // Timestamps not found - continue without highlighting
    }

    return {
      type: 'prerecorded',
      audioUrl: audioUrl,
      text: textContent,
      needsTranslation: false,
      timestamps
    };
  }

  /**
   * Check if resource exists at URL (using Range request like original system)
   */
  async checkResourceExists(url: string, signal?: AbortSignal): Promise<boolean> {
    if (!url) return false;
    try {
      // Get authentication headers for media requests
      const authHeaders = getMediaHeaders();

      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          Range: 'bytes=0-0',
          ...authHeaders  // Include JWT token for authentication
        },
        signal
      });
      const exists = resp.status === 200 || resp.status === 206;
      return exists;
    } catch (error: any) {
      // AbortError means the caller cancelled — re-throw so the caller can handle it
      if (error?.name === 'AbortError') {
        throw error;
      }
      // Some browsers block range checks for signed URLs via CORS. In that case, allow the
      // consumer to attempt playback anyway rather than failing fast.
      console.warn(`StoryService: Resource check failed for ${url}:`, error?.message ?? error);
      if (error?.name === 'TypeError' || /Failed to fetch/i.test(String(error?.message))) {
        return true;
      }
      return false;
    }
  }

  /**
   * Load text content from URL
   */
  async loadTextContent(url: string, signal?: AbortSignal): Promise<string> {
    if (!url) return '';

    try {
      // Get authentication headers for media requests
      const authHeaders = getMediaHeaders();

      const response = await fetch(url, {
        signal,
        headers: authHeaders  // Include JWT token for authentication
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      return text;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      console.error(`StoryService: Error loading text content from ${url}:`, error);
      return '';
    }
  }

  /**
   * Load timestamps JSON for paragraph-level highlighting
   */
  async loadTimestamps(url: string, signal?: AbortSignal): Promise<StoryTimestamps | undefined> {
    if (!url) return undefined;

    try {
      const authHeaders = getMediaHeaders();
      const response = await fetch(url, {
        signal,
        headers: authHeaders
      });

      if (!response.ok) return undefined;

      // Guard against Vite's HTML 404 fallback in dev
      const ct = response.headers.get('content-type') ?? '';
      if (!ct.includes('application/json')) return undefined;

      const data = await response.json();

      // Basic validation
      if (data?.paragraphs && Array.isArray(data.paragraphs)) {
        return data as StoryTimestamps;
      }
      return undefined;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      return undefined;
    }
  }

  /**
   * Clear cache (for development/testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance for drop-in replacement
// This preserves the exact same interface as the complex StoryService
const storyService = new StoryService();
export default storyService;
