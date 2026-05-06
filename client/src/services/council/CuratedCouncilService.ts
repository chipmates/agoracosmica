/**
 * CuratedCouncilService.ts
 * Handles playback of pre-written council content with pre-recorded audio
 * 
 * Features:
 * - Manifest-based content loading
 * - S3 signed URL handling  
 * - Multi-language support with fallbacks
 * - Sequential audio playback
 * - Development vs production environment handling
 */

import { getSignedUrl } from '../../utils/s3Utils';
import { useDomainStore } from '../../stores/domainStore';
import { canPlayWebm } from '../../utils/audioFormat';
import { councilLog, councilWarn, councilError } from './logger';

interface CouncilSegment {
  id: string;
  speaker: string;
  speakerName: string;
  text: string;
  url: string;
  filename: string;
  duration: number;
}

interface CouncilManifest {
  segments: CouncilSegment[];
  [key: string]: any;
}

interface CuratedPlaybackState {
  councilId: string;
  level: 1 | 2;
  segments: CouncilSegment[];
  currentIndex: number;
  isPlaying: boolean;
  currentAudio: HTMLAudioElement | null;
  manifest: CouncilManifest | null;
}

interface CouncilMessage {
  type: string;
  speaker: string;
  speakerName: string;
  content: string;
  segmentId: string;
  timestamp: number;
}

interface MainService {
  councilState: {
    isActive: boolean;
    currentSpeaker: string;
  };
  _notifyError: (error: Error) => void;
  _notifySpeakerChange: (speaker: string) => void;
  _notifyCouncilMessage: (message: CouncilMessage) => void;
  completeDebate: () => void;
}

export class CuratedCouncilService {
  private mainService: MainService;
  private curatedPlayback: CuratedPlaybackState | null;
  private readonly CURATED_PLAYBACK_RATE: number;

  constructor(mainService: MainService) {
    this.mainService = mainService;
    
    // Curated playback state
    this.curatedPlayback = null;
    
    // Playback rate for curated content (10% faster for dynamic feel)
    this.CURATED_PLAYBACK_RATE = 1.1;
  }

  /**
   * Start playback of curated council content with pre-recorded audio
   */
  async startCuratedPlayback(councilId: string, level: 1 | 2 = 1): Promise<void> {
    try {
      councilLog(`📖 Starting curated council playback: ${councilId} (level ${level})`);

      // Ensure any previous playback is cleaned up
      if (this.curatedPlayback) {
        councilLog('⚠️ Cleaning up previous curated playback');
        this.stopCuratedPlayback();
      }

      // Initialize curated playback state
      this.curatedPlayback = {
        councilId,
        level,
        segments: [],
        currentIndex: 0,
        isPlaying: false,
        currentAudio: null,
        manifest: null
      };

      // Get user language with fallback to English
      const lang = this._getUserLanguage();
      councilLog(`🌐 Using language for Cosmic Council: ${lang}`);

      // Load manifest from S3 with signed URLs
      councilLog('☁️ Loading manifest from S3 with signed URL');
      let response: Response;
      let manifestData: CouncilManifest | undefined;

      // Construct S3 key for manifest (level-aware path)
      const manifestKey = `councils/${councilId}/level-${level}/${lang}/manifest.json`;

      try {
        // Get signed URL for manifest
        const signedManifestUrl = await getSignedUrl(manifestKey);
        councilLog(`🔐 Got signed URL for manifest: ${manifestKey}`);

        response = await fetch(signedManifestUrl);
        const ct = response.headers.get('content-type') ?? '';
        if (response.ok && ct.includes('application/json')) {
          manifestData = await response.json();
        }
      } catch (error: any) {
        councilWarn(`Failed to load manifest for ${lang}:`, error.message);

        // Try English fallback if not already English
        if (lang !== 'en') {
          councilWarn(`Trying English fallback`);
          const fallbackKey = `councils/${councilId}/level-${level}/en/manifest.json`;
          try {
            const signedFallbackUrl = await getSignedUrl(fallbackKey);
            response = await fetch(signedFallbackUrl);
            const fallbackCt = response.headers.get('content-type') ?? '';
            if (response.ok && fallbackCt.includes('application/json')) {
              manifestData = await response.json();
            }
          } catch (fallbackError) {
            councilError('English fallback also failed:', fallbackError);
          }
        }
      }
      
      if (!manifestData) {
        throw new Error(`Failed to load manifest for council: ${councilId}. Please check if the council files exist.`);
      }
      
      // Check if curatedPlayback was cleared during async operations
      if (!this.curatedPlayback) {
        councilError('⚠️ curatedPlayback was cleared during async operation, reinitializing');
        this.curatedPlayback = {
          councilId,
          level,
          segments: [],
          currentIndex: 0,
          isPlaying: false,
          currentAudio: null,
          manifest: null
        };
      }
      
      this.curatedPlayback.manifest = manifestData;
      this.curatedPlayback.segments = manifestData.segments || [];
      
      councilLog(`✅ Loaded manifest with ${this.curatedPlayback.segments.length} segments`);
      councilLog('🎭 Speakers in council:', [...new Set(this.curatedPlayback.segments.map(s => s.speakerName))]);
      
      // Start playback of first segment
      this._playNextCuratedSegment();
      
    } catch (error) {
      councilError('❌ Error loading curated council:', error);
      this.mainService._notifyError(error as Error);
    }
  }

  /**
   * Get user's preferred language
   */
  private _getUserLanguage(): string {
    // Priority order:
    // 1. Selected language from Zustand store
    // 2. Browser language
    // 3. Default to 'en'

    // Check Zustand language store
    const selectedLang = useDomainStore.getState().language.current;
    if (selectedLang) {
      councilLog(`🌐 Found selected language from Zustand: ${selectedLang}`);
      return selectedLang;
    }
    
    // Browser language fallback
    const browserLang = navigator.language.split('-')[0];
    if (['en', 'de'].includes(browserLang)) {
      councilLog(`🌐 Using browser language: ${browserLang}`);
      return browserLang;
    }
    
    // Default
    councilLog(`🌐 Defaulting to English`);
    return 'en';
  }

  /**
   * Play the next segment in a curated council
   */
  private async _playNextCuratedSegment(): Promise<void> {
    if (!this.curatedPlayback || this.curatedPlayback.currentIndex >= this.curatedPlayback.segments.length) {
      councilLog('🏁 Curated council playback complete');
      this.mainService.completeDebate();
      return;
    }
    
    if (!this.mainService.councilState.isActive) {
      councilLog('🛑 Council stopped, halting playback');
      return;
    }
    
    const segment = this.curatedPlayback.segments[this.curatedPlayback.currentIndex];
    councilLog(`🎵 Playing segment ${this.curatedPlayback.currentIndex + 1}/${this.curatedPlayback.segments.length}:`, {
      speaker: segment.speakerName,
      duration: segment.duration,
      url: segment.url
    });
    
    // Update current speaker - use normalized speaker ID for consistent header highlighting
    this.mainService.councilState.currentSpeaker = segment.speaker; // Already normalized in curated councils
    this.mainService._notifySpeakerChange(segment.speaker);
    
    // Send message to chatbox
    councilLog('📝 [CuratedCouncil] Sending message to chatbox:', {
      hasText: !!segment.text,
      textLength: segment.text?.length,
      speaker: segment.speaker,
      speakerName: segment.speakerName
    });

    this.mainService._notifyCouncilMessage({
      type: 'segment',
      speaker: segment.speaker,
      speakerName: segment.speakerName,
      content: segment.text,
      segmentId: segment.id,
      timestamp: Date.now()
    });
    
    // Get signed URL for S3 audio file (level-aware path)
    const { councilId: playbackCouncilId, level: playbackLevel } = this.curatedPlayback;
    const ext = canPlayWebm() ? 'webm' : 'mp3';
    const baseName = segment.filename ? segment.filename.replace(/\.mp3$/, '') : '';
    const audioKey = baseName
      ? `councils/${playbackCouncilId}/level-${playbackLevel}/${this._getUserLanguage()}/${baseName}.${ext}`
      : (segment.url.startsWith('/') ? segment.url.substring(1) : segment.url);
    councilLog(`🔐 Getting signed URL for audio: ${audioKey}`);
    
    let audioUrl: string;
    try {
      audioUrl = await getSignedUrl(audioKey);
      councilLog(`🔊 Got signed URL for audio`);
    } catch (error) {
      councilError(`❌ Failed to get signed URL for audio:`, error);
      this.mainService._notifyError(error as Error);
      // Skip to next segment
      this.curatedPlayback.currentIndex++;
      setTimeout(() => {
        // Safety check: only continue if council is still active
        if (this.mainService.councilState.isActive && this.curatedPlayback) {
          this._playNextCuratedSegment();
        } else {
          councilLog('🛑 Council closed during skip to next segment, stopping playback');
        }
      }, 1000);
      return;
    }
    
    // Create and play audio
    const audio = new Audio(audioUrl);
    this.curatedPlayback.currentAudio = audio;
    this.curatedPlayback.isPlaying = true;
    
    // Apply 10% faster playback rate (1.1x) for curated councils
    // This makes the debate feel more dynamic while still being easily understandable
    audio.playbackRate = this.CURATED_PLAYBACK_RATE;
    councilLog(`⏩ Setting playback rate to ${this.CURATED_PLAYBACK_RATE}x for curated content`);
    
    // Handle audio events
    audio.addEventListener('ended', () => {
      councilLog(`✅ Finished playing segment ${segment.id}`);
      this.curatedPlayback!.currentIndex++;
      this.curatedPlayback!.isPlaying = false;

      // Add natural pause between speakers (adjusted for faster playback)
      // Reduce pause duration proportionally to maintain natural flow
      const basePauseDuration = 750;
      const adjustedPauseDuration = Math.round(basePauseDuration / this.CURATED_PLAYBACK_RATE);
      setTimeout(() => {
        // Safety check: only continue if council is still active
        if (this.mainService.councilState.isActive && this.curatedPlayback) {
          this._playNextCuratedSegment();
        } else {
          councilLog('🛑 Council closed during timeout, skipping next curated segment');
        }
      }, adjustedPauseDuration);
    }, { once: true });

    audio.addEventListener('error', (e) => {
      councilError(`❌ Error playing audio for segment ${segment.id}:`, e);
      this.mainService._notifyError(new Error(`Failed to play audio: ${(e as Event).type || 'Unknown error'}`));

      // Try to continue with next segment
      this.curatedPlayback!.currentIndex++;
      this.curatedPlayback!.isPlaying = false;
      setTimeout(() => {
        // Safety check: only continue if council is still active
        if (this.mainService.councilState.isActive && this.curatedPlayback) {
          this._playNextCuratedSegment();
        } else {
          councilLog('🛑 Council closed during error recovery, skipping retry');
        }
      }, 1000);
    }, { once: true });
    
    // Start playback
    audio.play().catch(error => {
      councilError('❌ Failed to start audio playback:', error);
      this.mainService._notifyError(error);
    });
  }

  /**
   * Stop curated playback immediately
   */
  stopCuratedPlayback(): void {
    if (this.curatedPlayback && this.curatedPlayback.currentAudio) {
      councilLog('⏹️ Stopping curated playback immediately');
      
      // 🔥 IMMEDIATE AUDIO STOP: Set volume to 0 first for instant silence
      this.curatedPlayback.currentAudio.volume = 0;
      this.curatedPlayback.currentAudio.pause();
      this.curatedPlayback.currentAudio.currentTime = 0;
      this.curatedPlayback.currentAudio = null;
      this.curatedPlayback.isPlaying = false;
      
      councilLog('🔇 Curated audio stopped and silenced');
    }
  }

  /**
   * Cleanup curated playback resources
   */
  cleanup(): void {
    this.stopCuratedPlayback();
    this.curatedPlayback = null;
  }

  /**
   * Check if curated playback is active
   */
  isActive(): boolean {
    return !!(this.curatedPlayback && this.curatedPlayback.isPlaying);
  }
}

export default CuratedCouncilService;
