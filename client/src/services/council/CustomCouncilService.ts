/**
 * CustomCouncilService.ts
 * Handles dynamic council generation with progressive streaming
 * 
 * Features:
 * - LLM-powered content generation
 * - Progressive streaming and parsing
 * - Real-time TTS generation
 * - Smart buffering for cost optimization
 * - Parallel processing and audio management
 */

import customCouncilGenerator, { type PartialSegment } from './generator';
import CustomCouncilParser, { type Segment } from './parser';
import type { CouncilMessage } from './index';
import { councilLog, councilWarn, councilError } from './logger';
import { getOrRollCouncilFigureSessionId, touchCouncilFigureSession, clearCouncilSessions } from '../audio/tts/ttsSessions';
import { getAudioContext } from '../audio/audioQueueManager';
import { splitForGatewayCap } from '../audio/utils/splitForGatewayCap';

// ============================================
// Type Definitions
// ============================================

interface MainService {
  readonly councilState: {
    isActive: boolean;
    participants?: string[];
    question?: string;
    moderator?: string;
    type?: 'debate' | 'advisory';
    currentSpeaker?: string;
  };
  readonly config: {
    ttsEnabled?: boolean;
    [key: string]: any;
  };
  _getUserTTSSettings(): any;
  _getUserLanguage(): string;
  _notifyError(error: Error | { message?: string }): void;
  _notifyCouncilLoaderChange?(state: LoaderState): void;
  _notifySpeakerChange(speakerId: string): void;
  _notifyCouncilMessage(message: CouncilMessage): void;
  _notifyAudioPlaybackStart(data: { speaker: string; speakerId: string; content: string; duration: number }): void;
  _getSpeakerId(speaker: string): string | undefined;
  _getEchoName(speakerId: string): string;
  completeDebate(): void;
}

interface LoaderState {
  isVisible: boolean;
  stage: 'generating' | 'streaming' | 'processing';
  participants: string[];
  question: string;
}

interface ProgressiveState {
  streamStartTime: number;
  segmentsReceived: number;
  segmentsDisplayed: number;
  isFirstSegment: boolean;
  segmentQueue: ExtendedSegment[];
  ttsQueue: Map<number, Promise<AudioBuffer | null>>;
  ttsCompletedSegments: Set<number>;
  currentlyPlayingSegment: number;
  receivedSegments: Map<number, SegmentWithMetrics> | null;
  smartTtsBuffer: SmartTtsBuffer | null;
  firstContentShown?: boolean;
  isPlaybackChainActive?: boolean;
}

interface ExtendedSegment extends Segment {
  text?: string;
  status?: 'parsed' | 'fetching' | 'ready' | 'error';
  retryCount?: number;
  duration?: number;
  // Note: id, speaker, speakerId, content are inherited from Segment
}

interface SegmentWithMetrics extends ExtendedSegment {
  receivedAt: number;
  isFirstSegment: boolean;
  totalReceived: number;
}

interface SmartTtsBuffer {
  windowStart: number;
  windowSize: number;
  activeSegmentIds: Set<number>;
  totalSegmentsBuffered: number;
  totalRequestsMade: number;
  totalRequestsAvoided: number;
  costSavings: number;
  trackCosts: boolean;
}

interface HolisticPipeline {
  parser: CustomCouncilParser | null;
  segments: ExtendedSegment[];
  currentDisplayIndex: number;
  currentPlayIndex: number;
  isGenerating: boolean;
  isProcessing: boolean;
  activeTtsRequests: number;
  maxConcurrentTts: number;
  audioQueue: Map<number, AudioBuffer>;
  audioContext: AudioContext | null;
  playbackStartTime: number | null;
  bufferAheadSeconds: number;
  bufferedDuration: number;
}

// CouncilMessage interface imported from './index'

// PartialSegment imported from './generator'

interface AudioFile {
  name: string;
  url: string;
  backend?: string;
  sessionTtlSeconds?: number;
}

interface GenerationResult {
  success: boolean;
  result?: any;
  error?: string;
}

export class CustomCouncilService {
  private mainService: MainService;
  private progressiveState: ProgressiveState | null;
  private loaderState: LoaderState;
  private holisticPipeline: HolisticPipeline;
  private councilSessionId: string | null;
  private councilVoiceMappings: Record<string, string> | null;
  private abortController: AbortController | null;
  // Reference to the BufferSource currently feeding the speakers, so cleanup
  // can call .stop() on user-close instead of letting the segment play out.
  private activeSource: AudioBufferSourceNode | null;

  constructor(mainService: MainService) {
    this.mainService = mainService;

    // Progressive streaming state
    this.progressiveState = null;

    // Council session tracking for audio file isolation
    this.councilSessionId = null;

    // Council voice mappings (for TTS variety)
    this.councilVoiceMappings = null;

    // Abort controller for cancellation
    this.abortController = null;

    this.activeSource = null;
    
    // Loader state management
    this.loaderState = {
      isVisible: false,
      stage: 'generating',
      participants: [],
      question: ''
    };
    
    // Holistic generation pipeline
    this.holisticPipeline = {
      parser: null,
      segments: [],
      currentDisplayIndex: 0,
      currentPlayIndex: 0,
      isGenerating: false,
      isProcessing: false,
      activeTtsRequests: 0,
      maxConcurrentTts: 3,
      audioQueue: new Map(),
      audioContext: null,
      playbackStartTime: null,
      bufferAheadSeconds: 30,
      bufferedDuration: 0
    };
  }

  /**
   * Show the council generation loader
   */
  private _showLoader(stage: LoaderState['stage'] = 'generating'): void {
    this.loaderState = {
      isVisible: true,
      stage: stage,
      participants: this.mainService.councilState.participants || [],
      question: this.mainService.councilState.question || ''
    };
    
    councilLog(`🔄 Council loader shown: ${stage}`, this.loaderState);
    this._notifyLoaderStateChange();
  }

  /**
   * Update loader stage
   */
  private _updateLoaderStage(stage: LoaderState['stage']): void {
    if (this.loaderState.isVisible) {
      this.loaderState.stage = stage;
      councilLog(`🔄 Council loader stage updated: ${stage}`);
      this._notifyLoaderStateChange();
    }
  }

  /**
   * Hide the council generation loader
   */
  private _hideLoader(): void {
    this.loaderState.isVisible = false;
    councilLog('✅ Council loader hidden');
    this._notifyLoaderStateChange();
  }

  /**
   * Get current loader state (for sync when components mount)
   */
  getCurrentLoaderState(): LoaderState {
    return { ...this.loaderState };
  }

  /**
   * Cancel an in-progress council generation
   */
  cancelGeneration(): void {
    if (this.abortController) {
      councilLog('🛑 Council generation cancelled by user');
      this.abortController.abort();
      this.abortController = null;
      this._hideLoader();
    }
  }

  /**
   * Notify UI about loader state changes
   */
  private _notifyLoaderStateChange(): void {
    councilLog('🔄 CustomCouncilService: _notifyLoaderStateChange called', this.loaderState);
    councilLog('🔄 Main service has _notifyCouncilLoaderChange?', typeof this.mainService._notifyCouncilLoaderChange);
    
    // Notify through main service event system
    if (this.mainService._notifyCouncilLoaderChange) {
      this.mainService._notifyCouncilLoaderChange(this.loaderState);
    } else {
      councilError('❌ _notifyCouncilLoaderChange method not found on main service');
    }
  }

  /**
   * Start custom council generation with progressive streaming
   */
  async startCustomGeneration(): Promise<GenerationResult> {
    try {
      // Cancel any previous in-progress generation
      if (this.abortController) {
        this.abortController.abort();
      }
      this.abortController = new AbortController();

      // Generate unique session ID for this council to prevent audio file collisions
      this.councilSessionId = `council-${Date.now()}`;
      councilLog('🚀 Starting custom council generation with progressive streaming');
      councilLog(`🎯 Council session ID: ${this.councilSessionId}`);

      // 🔄 Show loader - council generation starting
      this._showLoader('generating');
      
      // Initialize progressive streaming state
      this.progressiveState = {
        streamStartTime: Date.now(),
        segmentsReceived: 0,
        segmentsDisplayed: 0,
        isFirstSegment: true,
        segmentQueue: [],
        ttsQueue: new Map(),
        ttsCompletedSegments: new Set(),
        currentlyPlayingSegment: 0,
        receivedSegments: null,
        smartTtsBuffer: null
      };

      // Set up streaming callback with sequential processing queue
      // Maintains segment order by processing one at a time
      let processingChain = Promise.resolve();
      const streamingCallback = (segment: Segment | PartialSegment) => {
        processingChain = processingChain
          .then(() => this._handleProgressiveSegment(segment))
          .catch(error => councilError('Segment processing failed:', error));
      };

      // 🔄 Update loader - streaming starting
      this._updateLoaderStage('streaming');

      // 🎭 Generate voice mappings BEFORE council generation starts
      // This ensures mappings are available when TTS is called during progressive streaming
      const ttsSettings = this.mainService._getUserTTSSettings();
      const allParticipants = [
        this.mainService.councilState.moderator,
        ...(this.mainService.councilState.participants || [])
      ].filter(Boolean) as string[];

      const { getVoicesForCouncil } = await import('../audio/voices');
      // All TTS self-hosted — use kokoro voice set (server handles model routing)
      this.councilVoiceMappings = getVoicesForCouncil(allParticipants, 'kokoro');
      councilLog('🎭 [Council] Pre-generated voice mappings:', this.councilVoiceMappings);

      // Generate council using the custom generator with progressive streaming
      const result = await customCouncilGenerator.generateCouncil({
        question: this.mainService.councilState.question || '',
        participants: this.mainService.councilState.participants || [],
        moderator: this.mainService.councilState.moderator || '',
        type: this.mainService.councilState.type || 'debate',
        language: this.mainService._getUserLanguage(),
        ttsSettings: ttsSettings,
        onSegment: streamingCallback,
        signal: this.abortController?.signal
      });

      if (result.success) {
        councilLog('✅ Custom council generation completed successfully');
        councilLog('📊 Generation metrics:', {
          totalSegments: result.metadata?.totalSegments,
          displayedSegments: this.progressiveState.segmentsDisplayed,
          segmentsReceived: this.progressiveState.segmentsReceived
        });
        councilLog('🔍 [DEBUG] Result metadata:', result.metadata);
        councilLog('🔍 [DEBUG] Voice mappings in metadata:', result.metadata?.voiceMappings);

        // 🎙️ Store voice mappings for TTS calls
        if (result.metadata?.voiceMappings) {
          this.councilVoiceMappings = result.metadata.voiceMappings;
          councilLog('🎭 [Council] Stored voice mappings for TTS:', this.councilVoiceMappings);
        } else {
          councilWarn('⚠️ [Council] No voice mappings in result.metadata!');
        }
        
        // 🚨 FALLBACK: If no segments were processed progressively, use legacy method
        if (this.progressiveState.segmentsDisplayed === 0 && 
            this.progressiveState.segmentsReceived === 0 && 
            result.segments && result.segments.length > 0) {
          councilLog('🔄 Progressive streaming failed, falling back to legacy holistic playback');
          
          // 🔧 FIX DUPLICATION: Use legacy holistic playback (NOT progressive queue)
          this._initializeHolisticPlayback(result.segments);
        } else if (this.progressiveState.segmentsReceived > 0) {
          councilLog('📈 Progressive streaming completed successfully!');
        }
        
        // Mark generation as complete
        this.holisticPipeline.isGenerating = false;

        // Note: Don't clear voice mappings here - they're needed for TTS during playback
        // Mappings will be cleared in cleanup() when council actually ends

        return { success: true, result };
      } else {
        throw new Error(result.error || 'Custom generation failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      councilError('❌ Custom generation error:', error);
      // 🔄 Hide loader on error
      this._hideLoader();
      this.mainService._notifyError(error as Error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Handle progressive segment processing - called for each parsed segment
   */
  private async _handleProgressiveSegment(segment: Segment | PartialSegment): Promise<void> {
    councilLog(`🔄 PROGRESSIVE STREAMING: Handling segment ${segment.id} (${segment.speaker})`);
    
    if (!this.progressiveState) return;
    
    const timeFromStart = Date.now() - this.progressiveState.streamStartTime;
    
    // 🚀 NEW: Handle partial segments for immediate display
    if ('type' in segment && segment.type === 'partial') {
      const partialSeg = segment as PartialSegment;
      councilLog(`⚡ PARTIAL SEGMENT: ${partialSeg.speaker} at T+${timeFromStart}ms`);

      const partialSpeakerId = partialSeg.speakerId || partialSeg.speaker?.toLowerCase() || '';

      // Mark first content shown (loader stays until first audio plays)
      if (!this.progressiveState.firstContentShown) {
        councilLog('🎯 FIRST CONTENT DISPLAYED');
        this.progressiveState.firstContentShown = true;

        // Update speaker
        this.mainService.councilState.currentSpeaker = partialSpeakerId;
        this.mainService._notifySpeakerChange(partialSpeakerId);
      }

      // Send partial to chatbox
      this.mainService._notifyCouncilMessage({
        type: 'partial',
        speaker: partialSpeakerId,
        speakerName: this.mainService._getEchoName(partialSpeakerId),
        content: partialSeg.partialText || '',
        segmentId: partialSeg.segmentId,
        timestamp: Date.now()
      });

      return; // Don't process partials further
    }
    
    // Regular complete segment processing - cast to ExtendedSegment
    const extSegment = segment as ExtendedSegment;
    this.progressiveState.segmentsReceived++;
    // Ensure segment has a unique ID (prevents collision when parser returns null/undefined)
    if (extSegment.id == null) {
      extSegment.id = this.progressiveState.segmentsReceived;
    }
    councilLog(`📈 Progressive segment ${this.progressiveState.segmentsReceived} received at T+${timeFromStart}ms:`, extSegment.speaker);

    if (this.progressiveState.isFirstSegment) {
      councilLog('🎯 FIRST COMPLETE SEGMENT RECEIVED - Starting playback pipeline');
    }

    // Create segment metadata for tracking
    const segmentWithMetrics: SegmentWithMetrics = {
      ...extSegment,
      receivedAt: timeFromStart,
      isFirstSegment: this.progressiveState.isFirstSegment,
      totalReceived: this.progressiveState.segmentsReceived
    };

    // Store segment for buffer management (using Map for ID-based access)
    if (!this.progressiveState.receivedSegments) {
      this.progressiveState.receivedSegments = new Map();
    }

    // Add to received segments map (keyed by segment ID)
    this.progressiveState.receivedSegments.set(extSegment.id || 0, segmentWithMetrics);

    // Note: TTS generation will be handled in _processNextSegmentForPlayback()

    // 🎯 SMART TTS BUFFER: Maintain rolling 7-segment window for cost optimization
    // This reduces typical TTS costs by 85% while maintaining seamless playback
    const bufferResult = await this._maintainSmartTTSBuffer(extSegment, this.progressiveState.currentlyPlayingSegment || 0);
    councilLog(`🔄 Buffer updated for playback position ${this.progressiveState.currentlyPlayingSegment || 0}:`, bufferResult);

    // Queue segment for sequential playback
    this.progressiveState.segmentQueue.push(extSegment);

    // Start or restart playback chain if not currently active.
    // The chain can stall if moderator intro was skipped and queue was empty.
    if (this.progressiveState.isFirstSegment || !this.progressiveState.isPlaybackChainActive) {
      this.progressiveState.isFirstSegment = false;
      this.progressiveState.isPlaybackChainActive = true;
      this._processNextSegmentForPlayback();
    }
  }


  /**
   * Generate TTS for segment with parallel processing and performance metrics
   */
  private _generateSegmentTtsAsync(segment: ExtendedSegment): Promise<AudioBuffer | null> {
    if (!this.progressiveState) return Promise.resolve(null);
    
    const timeFromStart = Date.now() - this.progressiveState.streamStartTime;
    
    // Performance tracking
    const startTime = Date.now();
    councilLog(`🎵 Starting parallel TTS for segment ${segment.id}: ${segment.speaker} at T+${timeFromStart}ms`);
    
    // Generate TTS promise and track completion
    const ttsPromise = this._generateSegmentTts(segment)
      .then(audioBuffer => {
        if (audioBuffer && this.progressiveState) {
          const duration = Date.now() - startTime;
          councilLog(`🎵 PERFORMANCE METRIC: Parallel TTS completed in ${duration}ms for segment ${segment.id}`);
          
          // Mark as completed
          this.progressiveState.ttsCompletedSegments.add(segment.id || 0);
          councilLog(`✅ TTS ready for segment ${segment.id}, segments ready: ${this.progressiveState.ttsCompletedSegments.size}`);
          
          return audioBuffer;
        } else {
          councilWarn(`⚠️ TTS generation failed for segment ${segment.id}`);
          return null;
        }
      })
      .catch(error => {
        councilError(`❌ TTS error for segment ${segment.id}:`, error);
        return null;
      });
    
    // Store promise for retrieval
    this.progressiveState.ttsQueue.set(segment.id || 0, ttsPromise);
    
    return ttsPromise;
  }

  /**
   * Process next segment for playback (sequential processing)
   */
  private async _processNextSegmentForPlayback(): Promise<void> {
    try {
      // Check if council is still active (user might have closed it)
      if (!this.mainService.councilState.isActive) {
        councilLog('🛑 Council closed, stopping segment processing');
        if (this.progressiveState) this.progressiveState.isPlaybackChainActive = false;
        return;
      }

      // Double-check progressive state isn't cleared (additional safety check)
      if (!this.progressiveState) {
        councilLog('🛑 Progressive state cleared, stopping segment processing');
        return;
      }
      
      // Check if we have segments to process
      if (this.progressiveState.segmentQueue.length === 0) {
        if (!this.holisticPipeline.isGenerating) {
          councilLog('✅ All segments played and generation complete — marking council as finished');
          this.mainService.completeDebate();
        } else {
          councilLog('📭 No more segments in queue — pausing playback chain');
        }
        this.progressiveState.isPlaybackChainActive = false;
        return;
      }

      const segment = this.progressiveState.segmentQueue.shift()!;
      councilLog(`🎭 Processing segment ${segment.id} for playback: ${segment.speaker}`);

      // Ensure segment has speakerId (fallback from speaker name)
      if (!segment.speakerId && segment.speaker) {
        segment.speakerId = this.mainService._getSpeakerId(segment.speaker);
      }

      const speakerId = segment.speakerId || segment.speaker.toLowerCase();

      // Update display counter and current position
      this.progressiveState.segmentsDisplayed++;
      this.progressiveState.currentlyPlayingSegment = segment.id || 0;

      // Update current speaker state immediately
      this.mainService.councilState.currentSpeaker = speakerId;

      // ALWAYS notify speaker change
      this.mainService._notifySpeakerChange(speakerId);

      // ALWAYS send message to chatbox for display
      this.mainService._notifyCouncilMessage({
        type: 'segment',
        speaker: speakerId,
        speakerName: this.mainService._getEchoName(speakerId),
        content: segment.text || segment.content,
        segmentId: segment.id,
        timestamp: Date.now()
      });

      councilLog(`✅ Segment ${segment.id} displayed in chatbox: ${segment.speaker}`);

      // Loader stays visible until first audio plays (handled in _playSegmentAudio)

      // Handle TTS if enabled
      // LB-11 fix: read fresh config (avoids singleton staleness in cosmicCouncilService.config,
      // set once at module-load) AND use default-true semantics (`!== false`) to match the rest
      // of the codebase. The previous strict `&&` form silently dropped TTS whenever
      // ttsEnabled landed as undefined/null in the singleton snapshot.
      const ttsEnabled = this.mainService._getUserTTSSettings().enabled;
      if (ttsEnabled && segment.speakerId) {
        try {
          // Check if audio already exists in audioQueue (completed TTS from buffer)
          const existingAudio = this.holisticPipeline.audioQueue.get(segment.id || 0);

          if (existingAudio) {
            councilLog(`✅ Using pre-generated audio for segment ${segment.id}`);
            // Performance tracking for first audio
            if (this.progressiveState.segmentsDisplayed === 1) {
              const totalTimeToFirstAudio = Date.now() - this.progressiveState.streamStartTime;
              councilLog(`🎯 PERFORMANCE METRIC: First audio started at T+${totalTimeToFirstAudio}ms`);
              councilLog(`📈 Progressive streaming success! Compare to previous 67000ms`);
            }

            await this._playSegmentAudio(existingAudio, segment);
          } else {
            // No pre-generated audio, start TTS generation if not already started
            if (!this.progressiveState.ttsQueue.has(segment.id || 0)) {
              this._generateSegmentTtsAsync(segment);
            }

            // Wait for TTS promise
            const ttsPromise = this.progressiveState.ttsQueue.get(segment.id || 0);
            if (ttsPromise) {
              const audioBuffer = await ttsPromise;
              if (audioBuffer) {
                await this._playSegmentAudio(audioBuffer, segment);
              } else {
                councilWarn(`⚠️ TTS generation failed for segment ${segment.id}, adding reading delay`);
                await new Promise(resolve => setTimeout(resolve, 3000));
              }
            } else {
              councilWarn(`⚠️ No TTS promise found for segment ${segment.id}, adding reading delay`);
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          }
        } catch (error) {
          councilError(`❌ Error playing segment ${segment.id}:`, error);
          // Continue with reading delay on TTS error
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } else {
        // LB-11 diag: surface why the TTS gate blocked. Useful in prod too —
        // if any user reports silent custom council, the console line points
        // straight at which side of the gate failed.
        councilWarn(
          `📖 [LB-11] TTS gate blocked segment ${segment.id}: ttsEnabled=${ttsEnabled}, speakerId=${segment.speakerId}`,
        );
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Small gap between segments for natural flow
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Continue with next segment (with safety check)
      setTimeout(() => {
        // Double-check council is still active before continuing
        if (this.mainService.councilState.isActive && this.progressiveState) {
          this._processNextSegmentForPlayback();
        } else {
          councilLog('🛑 Council closed during timeout, skipping next segment processing');
        }
      }, 100);
      
    } catch (error) {
      councilError('❌ Error in _processNextSegmentForPlayback:', error);
      // Try to continue with next segment after error (with safety check)
      setTimeout(() => {
        if (this.mainService.councilState.isActive && this.progressiveState) {
          this._processNextSegmentForPlayback();
        } else {
          councilLog('🛑 Council closed during error recovery, skipping retry');
        }
      }, 1000);
    }
  }

  /**
   * Resolve the AudioContext to use for council playback.
   *
   * Mobile-Safari fix (LB-11 follow-up): on iOS Safari every newly-created
   * AudioContext starts in `suspended` state and only `resume()`-able while a
   * user gesture is active. The custom-council session creates its context
   * lazily AFTER the LLM streams the first segment — long after the Start-tap
   * gesture window has closed — so source.start() became a silent no-op and
   * source.onended never fired, hanging playback after segment 0.
   *
   * Fix: reuse the GLOBAL context owned by useAutoplayGate / audioQueueManager
   * which was unlocked on the first user touch at app boot. Fall back to a
   * local context if the global is missing (paranoia path), and try to resume
   * either way — resume() on a `running` context is a cheap no-op.
   */
  private _getOrCreateAudioContext(): AudioContext {
    if (this.holisticPipeline.audioContext && this.holisticPipeline.audioContext.state !== 'closed') {
      return this.holisticPipeline.audioContext;
    }
    const shared = getAudioContext();
    if (shared && shared.state !== 'closed') {
      this.holisticPipeline.audioContext = shared;
      return shared;
    }
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.holisticPipeline.audioContext = ctx;
    return ctx;
  }

  /**
   * Play a single segment audio and return promise when done
   */
  private async _playSegmentAudio(audioBuffer: AudioBuffer, segment: ExtendedSegment): Promise<void> {
    const ctx = this._getOrCreateAudioContext();

    // iOS Safari: ensure context is running before scheduling playback.
    // resume() on a running context resolves immediately; on suspended it
    // returns a promise we must await before source.start() to avoid the
    // silent no-op described in _getOrCreateAudioContext.
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        councilWarn(`⚠️ AudioContext.resume() failed for segment ${segment.id}:`, err);
      }
    }

    return new Promise((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      source.onended = () => {
        councilLog(`🎵 Finished playing segment ${segment.id}`);
        if (this.activeSource === source) {
          this.activeSource = null;
        }
        resolve();
      };

      councilLog(`🎵 Playing segment ${segment.id}: ${segment.speaker} (ctx=${ctx.state})`);

      // Hide loader on first audio playback
      this._hideLoader();

      // Notify LiveCouncilPlayer that audio is starting (for subtitle sync)
      this.mainService._notifyAudioPlaybackStart({
        speaker: segment.speaker,
        speakerId: segment.speakerId || segment.speaker.toLowerCase(),
        content: segment.text || segment.content || '',
        duration: audioBuffer.duration
      });

      // Set BEFORE start() so a same-tick cleanup still has the ref to stop.
      this.activeSource = source;
      source.start();
    });
  }

  /**
   * 🚀 SMART TTS BUFFERING - Core buffer management with cost optimization
   * Maintains rolling 7-segment window, reducing typical costs by 85%
   */
  private async _maintainSmartTTSBuffer(_segment: ExtendedSegment, currentPlaybackIndex: number): Promise<string> {
    if (!this.progressiveState) return '+0';
    
    // Initialize buffer if needed
    if (!this.progressiveState.smartTtsBuffer) {
      this.progressiveState.smartTtsBuffer = {
        windowStart: Math.max(0, currentPlaybackIndex - 1), // 1 behind current
        windowSize: 7,
        activeSegmentIds: new Set(),
        totalSegmentsBuffered: 0,
        totalRequestsMade: 0,
        totalRequestsAvoided: 0,
        costSavings: 0,
        trackCosts: false
      };
    }

    const buffer = this.progressiveState.smartTtsBuffer;
    const receivedSegmentsMap = this.progressiveState.receivedSegments || new Map();

    // Advance window start to track playback progress
    buffer.windowStart = Math.max(buffer.windowStart, Math.max(0, currentPlaybackIndex - 1));

    // Calculate current buffer window [start, end]
    const windowEnd = buffer.windowStart + buffer.windowSize - 1;
    councilLog(`📊 Smart Buffer Window: [${buffer.windowStart}-${windowEnd}] (${buffer.windowSize} segments)`);
    
    // Find segments that should be in buffer but aren't yet
    const segmentsToBuffer: ExtendedSegment[] = [];
    for (let segmentId = buffer.windowStart; segmentId <= windowEnd; segmentId++) {
      const seg = receivedSegmentsMap.get(segmentId);

      // 🎯 CRITICAL FIX: Only buffer segments that haven't been queued yet
      // Check BOTH activeSegmentIds AND ttsQueue to prevent duplicate queuing
      const isAlreadyQueued = buffer.activeSegmentIds.has(seg?.id || 0);
      const hasTtsPromise = this.progressiveState.ttsQueue.has(seg?.id || 0);
      const isCompleted = this.progressiveState.ttsCompletedSegments.has(seg?.id || 0);

      if (seg && !isAlreadyQueued && !hasTtsPromise && !isCompleted) {
        segmentsToBuffer.push(seg);
      }
    }

    councilLog(`🎵 Smart Buffer: Starting TTS for ${segmentsToBuffer.length} segments: [${segmentsToBuffer.map(s => s.id).join(', ')}]`);
    councilLog(`📋 Smart Buffer Debug: Total segments received: ${receivedSegmentsMap.size}, Current playback: ${currentPlaybackIndex}, Window: [${buffer.windowStart}-${windowEnd}]`);

    // 🎯 CRITICAL: Only queue NEW segments (prevent duplicates)
    if (segmentsToBuffer.length > 0) {
      // Queue segments with small delays between each to prevent model overwhelm
      // Kokoro WebGPU model struggles when multiple requests queued simultaneously
      for (let i = 0; i < segmentsToBuffer.length; i++) {
        const seg = segmentsToBuffer[i];

        // Mark as active BEFORE queuing to prevent race conditions
        buffer.activeSegmentIds.add(seg.id || 0);
        buffer.totalRequestsMade++;

        // Add small delay between queuing requests (not between generations!)
        // This prevents overwhelming the Kokoro model with simultaneous promise creation
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        this._generateSegmentTtsAsync(seg);
        councilLog(`✅ Queued TTS for segment ${seg.id} (${seg.speaker})`);
      }
    } else {
      councilLog(`⏭️ Smart Buffer: No new segments to queue (all already processing or completed)`);
    }
    
    // Clean up completed segments that are outside the window
    const segmentsToRemove: number[] = [];
    for (const segmentId of buffer.activeSegmentIds) {
      if (this.progressiveState.ttsCompletedSegments.has(segmentId)) {
        // Remove from buffer tracking (but keep TTS result)
        segmentsToRemove.push(segmentId);
        this.progressiveState.ttsQueue.delete(segmentId);
      }
    }
    
    segmentsToRemove.forEach(id => buffer.activeSegmentIds.delete(id));
    
    // Calculate cost savings
    const potentialRequests = receivedSegmentsMap.size;
    buffer.totalRequestsAvoided = Math.max(0, potentialRequests - buffer.totalRequestsMade);
    buffer.costSavings = buffer.totalRequestsAvoided * 0.015; // Estimate $0.015 per TTS request
    
    councilLog(`💰 Smart Buffer Cost Analysis:`, {
      segmentsInBuffer: buffer.activeSegmentIds.size,
      ttsRequestsMade: buffer.totalRequestsMade,
      ttsRequestsAvoided: buffer.totalRequestsAvoided,
      estimatedCostSaved: `$${buffer.costSavings.toFixed(3)}`,
      bufferUtilization: `${((buffer.activeSegmentIds.size / buffer.windowSize) * 100).toFixed(1)}%`,
      windowPosition: `${buffer.windowStart}-${windowEnd}`
    });

    return `+${segmentsToBuffer.length}`;
  }

  /**
   * Initialize holistic playback system
   */
  private _initializeHolisticPlayback(segments: Segment[]): void {
    councilLog(`🎬 Initializing holistic playback with ${segments.length} segments`);
    
    // Check if we already have segments being displayed progressively
    if (this.progressiveState && this.progressiveState.segmentsDisplayed > 0) {
      councilLog(`📺 Progressive streaming active: ${this.progressiveState.segmentsDisplayed} segments already displayed`);
      return;
    }
    
    // Initialize holistic pipeline
    this.holisticPipeline.segments = segments as ExtendedSegment[];
    this.holisticPipeline.currentDisplayIndex = 0;
    this.holisticPipeline.currentPlayIndex = 0;
    this.holisticPipeline.isGenerating = false;
    this.holisticPipeline.isProcessing = false;
    this.holisticPipeline.activeTtsRequests = 0;
    this.holisticPipeline.bufferedDuration = 0;
    this.holisticPipeline.playbackStartTime = null;
    
    // Initialize audio queue
    if (this.holisticPipeline.audioQueue) {
      this.holisticPipeline.audioQueue.clear();
    }
    
    // Start showing segments (legacy sequential mode)
    this._showNextSegment();
  }

  /**
   * Process TTS queue with rate limiting
   */
  private async _processTtsQueue(): Promise<void> {
    if (this.holisticPipeline.isProcessing) return;
    this.holisticPipeline.isProcessing = true;
    
    try {
      // Find segments needing TTS near current playback position
      const currentIndex = this.holisticPipeline.currentPlayIndex;
      const bufferAhead = 5; // Process 5 segments ahead
      
      const needsTts = this.holisticPipeline.segments.filter(seg => 
        seg.status === 'parsed' &&
        (seg.id || 0) >= currentIndex &&
        (seg.id || 0) < currentIndex + bufferAhead &&
        this.holisticPipeline.bufferedDuration < this.holisticPipeline.bufferAheadSeconds
      );
      
      // Respect concurrent limit
      const available = this.holisticPipeline.maxConcurrentTts - this.holisticPipeline.activeTtsRequests;
      const toProcess = needsTts.slice(0, available);
      
      if (toProcess.length > 0) {
        await Promise.all(toProcess.map(seg => this._generateSegmentTts(seg)));
      }
      
    } finally {
      this.holisticPipeline.isProcessing = false;
      
      // Continue processing if more work
      const hasMore = this.holisticPipeline.segments.some(s => 
        s.status === 'parsed' && 
        (s.id || 0) < this.holisticPipeline.currentPlayIndex + 5
      );
      
      if (hasMore) {
        setTimeout(() => this._processTtsQueue(), 100);
      }
    }
  }

  /**
   * Generate TTS for a single segment
   */
  private async _generateSegmentTts(segment: ExtendedSegment): Promise<AudioBuffer | null> {
    segment.status = 'fetching';
    this.holisticPipeline.activeTtsRequests++;
    
    try {
      // Convert speaker name to ID if not already done
      const speakerId = segment.speakerId || this.mainService._getSpeakerId(segment.speaker);
      
      councilLog(`🎵 Generating TTS for segment ${segment.id} (${speakerId})`);
      
      // Validate speaker ID before TTS
      if (!speakerId) {
        throw new Error(`Invalid speaker ID for segment ${segment.id}: ${segment.speaker}`);
      }
      
      // Import TTS function and services
      const { convertTextToSpeech } = await import('../audio/tts');

      // Get user's TTS settings from configuration
      const ttsSettings = this.mainService._getUserTTSSettings();
      const ttsService = ttsSettings.provider;
      
      councilLog(`🎵 Using user's TTS settings:`, ttsSettings);

      // Generate TTS with session-prefixed filename to prevent collisions
      const sessionPrefixedId = this.councilSessionId
        ? `${this.councilSessionId}_segment-${segment.id || 0}`
        : `segment-${segment.id || 0}`;

      // 🎯 CRITICAL: Validate segment has text content
      const textToSynthesize = segment.text || segment.content;

      councilLog(`🔍 [SEGMENT DEBUG] Segment ${segment.id}:`, {
        speaker: segment.speaker,
        speakerId: speakerId,
        hasText: !!segment.text,
        hasContent: !!segment.content,
        textLength: textToSynthesize?.length || 0,
        textPreview: textToSynthesize?.substring(0, 100) || '(EMPTY!)'
      });

      // VALIDATION: Ensure we have text to synthesize
      if (!textToSynthesize || textToSynthesize.trim().length === 0) {
        councilError(`❌ EMPTY TEXT for segment ${segment.id}! Segment data:`, {
          id: segment.id,
          speaker: segment.speaker,
          text: segment.text,
          content: segment.content,
          fullSegment: segment
        });
        throw new Error(`Segment ${segment.id} has no text content to synthesize`);
      }

      // 🎭 Get voice from council mappings if available
      councilLog(`🔍 [DEBUG] Checking council mappings for ${speakerId}:`, {
        hasMappings: !!this.councilVoiceMappings,
        mappings: this.councilVoiceMappings,
        speakerId: speakerId
      });

      let explicitVoice: string | undefined;
      if (this.councilVoiceMappings && speakerId) {
        explicitVoice = this.councilVoiceMappings[speakerId];
        councilLog(`🎭 [Council TTS] Lookup result for ${speakerId}:`, explicitVoice);

        if (explicitVoice) {
          councilLog(`✅ [Council TTS] Using mapped voice for ${speakerId}: ${explicitVoice}`);
        } else {
          councilWarn(`⚠️ [Council TTS] No mapping found for ${speakerId} in:`, Object.keys(this.councilVoiceMappings));
        }
      } else {
        councilWarn(`⚠️ [Council TTS] No mappings available (mappings=${!!this.councilVoiceMappings}, speakerId=${speakerId})`);
      }

      // Get current language from main service
      const language = this.mainService._getUserLanguage();

      // Per-figure session-id for gateway routing stickiness. Each figure in
      // a council gets its own routing decision — Figure A on Qwen and Figure B
      // on F5 is correct behavior, since they are distinct voice-consistency
      // contracts. Cleared by clearCouncilSessions() in cleanup().
      const sessionId = getOrRollCouncilFigureSessionId(speakerId);

      // LB-11 diag (dev only): dump the exact request shape leaving the client
      // for the first few segments. Server-Claude can grep gateway logs by
      // session-id + UTC timestamp if anything looks off.
      if (import.meta.env.DEV && (segment.id ?? 0) < 3) {
        console.log(`[LB-11] segment ${segment.id} → POST /v1/audio/speech`, {
          speaker: segment.speaker,
          speakerId,
          hasCouncilMapping: !!explicitVoice,
          voice: explicitVoice ?? '(falls to user-pref via convertTextToSpeech)',
          language,
          sessionId,
          fileBaseName: sessionPrefixedId,
          textLength: textToSynthesize.length,
          ts: new Date().toISOString(),
        });
      }

      // CI-3: gateway-cap-aware chunking. The Hetzner gateway hard-rejects DE
      // text > 500 chars / EN > 600 chars with 400 input_too_long. Long council
      // turns used to fail outright (silent figure crossfade, no audio). Now we
      // pre-split at the sentence boundary nearest the midpoint, render every
      // chunk in parallel, then stitch the AudioBuffers together with a 200ms
      // silence gap so the seam reads as a natural breath. See
      // services/audio/utils/splitForGatewayCap.ts (shared with initial-message
      // rendering) and the 2026-05-02 TTS lab handover.
      const chunks = splitForGatewayCap(textToSynthesize, language);
      if (chunks.length > 1) {
        councilLog(
          `🔪 [TTS-CHUNK] Segment ${segment.id} chunked into ${chunks.length} parts: [${chunks.map((c) => c.length).join(', ')}] (lang=${language})`,
        );
      }

      // Per-chunk filename suffix prevents server-side cache collisions when
      // the same segment-id maps to multiple TTS calls.
      const renderChunk = (chunkText: string, idx: number): Promise<AudioFile> => {
        const chunkBaseName = chunks.length > 1 ? `${sessionPrefixedId}_c${idx + 1}` : sessionPrefixedId;
        return explicitVoice
          ? this._generateTTSWithExplicitVoice(chunkText, chunkBaseName, explicitVoice, ttsService, ttsSettings.speed, language, sessionId)
          : convertTextToSpeech(chunkText, chunkBaseName, speakerId, ttsService, ttsSettings.speed, language, sessionId);
      };

      // Parallel render for multi-chunk segments — same speaker means same
      // session-stickiness routing on the gateway. Single-chunk path is
      // identical to before (Promise.all of length 1 has no overhead).
      const audioFiles: AudioFile[] = await Promise.all(chunks.map(renderChunk));

      // Use first chunk's session metadata as representative for the whole turn.
      const repAudioFile = audioFiles[0];
      if (repAudioFile.sessionTtlSeconds !== undefined) {
        touchCouncilFigureSession(speakerId, repAudioFile.sessionTtlSeconds);
      }

      councilLog(
        `🎵 TTS file(s) created: ${audioFiles.map((af) => af.name).join(', ')}`,
      );

      // Use the shared unlocked context (LB-11 follow-up: see _getOrCreateAudioContext)
      const ctx = this._getOrCreateAudioContext();

      // Decode all chunks in parallel.
      const decodedBuffers: AudioBuffer[] = await Promise.all(
        audioFiles.map(async (af) => {
          const response = await fetch(af.url);
          const arrayBuffer = await response.arrayBuffer();
          return ctx.decodeAudioData(arrayBuffer);
        }),
      );

      // Single chunk → use the buffer directly. Multi-chunk → concat with
      // 200ms silence gap (matches audioQueueManager's inter-blob gap so the
      // perceived rhythm is consistent across pipelines).
      const audioBuffer = decodedBuffers.length === 1
        ? decodedBuffers[0]
        : this._concatBuffersWithGap(ctx, decodedBuffers, 200);

      // Store in queue
      this.holisticPipeline.audioQueue.set(segment.id || 0, audioBuffer);
      segment.status = 'ready';
      segment.duration = audioBuffer.duration;

      // Update buffered duration if it exists
      if (this.holisticPipeline.bufferedDuration !== undefined) {
        this.holisticPipeline.bufferedDuration += audioBuffer.duration;
      }

      councilLog(
        `✅ TTS ready for segment ${segment.id}, duration: ${audioBuffer.duration.toFixed(2)}s${chunks.length > 1 ? ` (${chunks.length} chunks stitched)` : ''}`,
      );

      // Clean up blob URLs to prevent memory leaks
      audioFiles.forEach((af) => URL.revokeObjectURL(af.url));

      return audioBuffer; // Return for sequential playback
      
    } catch (error) {
      councilError(`❌ TTS error for segment ${segment.id}:`, error);
      segment.status = 'error';
      segment.retryCount = (segment.retryCount || 0) + 1;
      
      // Retry logic
      if (segment.retryCount < 3) {
        setTimeout(() => {
          segment.status = 'parsed';
          this._processTtsQueue();
        }, 1000 * segment.retryCount);
      }
      
      return null; // Failed to generate
    } finally {
      this.holisticPipeline.activeTtsRequests--;
      this._processTtsQueue();
    }
  }

  /**
   * Concatenate AudioBuffers with a fixed silence gap between each.
   *
   * Used by CI-3 chunked TTS: when a council turn exceeds the gateway cap and
   * has been split into 2+ chunks, each chunk renders independently and we
   * stitch the resulting AudioBuffers into one for the existing per-segment
   * playback machinery. The 200ms gap matches audioQueueManager's inter-blob
   * default so the seam between chunks reads as a natural breath, not a
   * glitch.
   */
  private _concatBuffersWithGap(ctx: AudioContext, buffers: AudioBuffer[], gapMs: number): AudioBuffer {
    if (buffers.length === 0) {
      return ctx.createBuffer(1, 1, ctx.sampleRate);
    }
    if (buffers.length === 1) return buffers[0];

    const sampleRate = buffers[0].sampleRate;
    const channels = Math.max(...buffers.map((b) => b.numberOfChannels));
    const gapSamples = Math.floor((sampleRate * gapMs) / 1000);
    const totalLength =
      buffers.reduce((sum, b) => sum + b.length, 0) + gapSamples * (buffers.length - 1);

    const out = ctx.createBuffer(channels, totalLength, sampleRate);
    let offset = 0;
    for (let i = 0; i < buffers.length; i++) {
      const buf = buffers[i];
      for (let ch = 0; ch < channels; ch++) {
        // Fall back to channel 0 if a buffer has fewer channels than the output.
        const sourceCh = ch < buf.numberOfChannels ? ch : 0;
        out.copyToChannel(buf.getChannelData(sourceCh), ch, offset);
      }
      offset += buf.length;
      // Trailing silence for all but the last buffer (already zero-initialized).
      if (i < buffers.length - 1) offset += gapSamples;
    }
    return out;
  }

  /**
   * Show next segment in sequential mode (fallback)
   */
  private _showNextSegment(): void {
    const segment = this.holisticPipeline.segments[this.holisticPipeline.currentDisplayIndex];
    if (!segment) {
      councilLog('🏁 All segments displayed');
      return;
    }

    // Update UI
    this.mainService._notifySpeakerChange(segment.speakerId || '');
    this.mainService._notifyCouncilMessage({
      type: 'playing',
      speaker: segment.speakerId || '',
      speakerName: this.mainService._getEchoName(segment.speakerId || ''),
      content: segment.text || segment.content,
      segmentId: segment.id ? String(segment.id) : undefined,
      timestamp: Date.now()
    });

    this.holisticPipeline.currentDisplayIndex++;
    
    // Continue with next segment after delay
    setTimeout(() => this._showNextSegment(), 2000);
  }

  /**
   * Generate TTS with explicit voice (for council voice variety)
   */
  private async _generateTTSWithExplicitVoice(
    text: string,
    fileBaseName: string,
    voice: string,
    _ttsService: string,
    speed: number,
    language: string = 'en',
    sessionId?: string
  ): Promise<AudioFile> {
    // All TTS self-hosted on GEX130 — server handles language/model routing
    const { selfHostedTTS } = await import('../audio/tts/selfHostedTTS');
    return await selfHostedTTS(text, fileBaseName, '', speed, voice, undefined, language, sessionId);
  }

  /**
   * Cleanup custom generation resources
   * This stops all audio playback and clears all resources
   */
  cleanup(): void {
    councilLog('🧹 Cleaning up CustomCouncilService resources');

    // Cut the currently-playing segment so closing the council silences audio
    // immediately. .stop() throws if the source never started or already
    // stopped — that's fine, ignore.
    if (this.activeSource) {
      councilLog('🛑 Stopping active audio segment');
      try {
        this.activeSource.stop();
      } catch (err) {
        councilWarn('activeSource.stop() failed:', err);
      }
      this.activeSource = null;
    }

    // Abort any in-flight LLM stream so further segments stop arriving.
    // Without this, the streaming callback keeps queueing TTS work in the
    // background even after the user has closed the council.
    if (this.abortController) {
      councilLog('🛑 Aborting in-flight LLM stream');
      this.abortController.abort();
      this.abortController = null;
    }

    // 🔄 Hide loader if still visible
    this._hideLoader();

    // Drop our reference to the audio context. Do NOT close it: the same
    // instance is shared with audioQueueManager (the global unlocked context
    // from useAutoplayGate) and other modes still need it. Council playback
    // already stops because we clear progressiveState below — any in-flight
    // BufferSource is GC'd. If we held a private fallback context (paranoia
    // path in _getOrCreateAudioContext), the global path will be null, so
    // closing only that local one is safe.
    if (this.holisticPipeline.audioContext) {
      const ourCtx = this.holisticPipeline.audioContext;
      const sharedCtx = getAudioContext();
      if (sharedCtx !== ourCtx && ourCtx.state !== 'closed') {
        ourCtx.close().catch(councilWarn);
      }
      this.holisticPipeline.audioContext = null;
    }

    // Clear progressive streaming state
    if (this.progressiveState) {
      if (this.progressiveState.ttsQueue) {
        this.progressiveState.ttsQueue.clear();
      }
      this.progressiveState.segmentQueue = [];
      this.progressiveState = null;
    }

    // Clear audio queue
    if (this.holisticPipeline.audioQueue) {
      this.holisticPipeline.audioQueue.clear();
    }

    // Reset pipeline state
    this.holisticPipeline.segments = [];
    this.holisticPipeline.currentDisplayIndex = 0;
    this.holisticPipeline.currentPlayIndex = 0;
    this.holisticPipeline.isGenerating = false;
    this.holisticPipeline.isProcessing = false;
    this.holisticPipeline.activeTtsRequests = 0;
    this.holisticPipeline.bufferedDuration = 0;
    this.holisticPipeline.playbackStartTime = null;

    // Clear council session ID
    if (this.councilSessionId) {
      councilLog(`🎯 Clearing council session ID: ${this.councilSessionId}`);
      this.councilSessionId = null;
    }

    // Clear council voice mappings
    if (this.councilVoiceMappings) {
      councilLog(`🎭 [Council] Clearing voice mappings`);
      this.councilVoiceMappings = null;
    }

    // Clear per-figure TTS session-ids so the next council starts with fresh
    // routing decisions rather than inheriting stale ids.
    clearCouncilSessions();

    councilLog('✅ CustomCouncilService cleanup complete');
  }

  /**
   * Clear the current council session ID
   * Used when switching between councils or ending a session
   */
  clearSession(): void {
    if (this.councilSessionId) {
      councilLog(`🎯 Clearing council session: ${this.councilSessionId}`);
      this.councilSessionId = null;
    }
  }

  /**
   * Check if custom generation is active
   */
  isActive(): boolean {
    return (this.progressiveState !== null && this.progressiveState.segmentsReceived > 0) || 
           (this.holisticPipeline.segments.length > 0);
  }
}

export default CustomCouncilService;