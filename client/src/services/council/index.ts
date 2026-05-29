/**
 * CosmicCouncilService - Main Orchestrator
 * Manages philosophical council debates with two specialized approaches:
 * 1. Curated councils - Pre-written content with pre-recorded audio
 * 2. Custom councils - Dynamic generation with progressive streaming
 * 
 * This main service handles orchestration, state management, and delegation
 * to the appropriate specialized service based on council configuration.
 */

import { loadServiceConfig } from '../audio/config/serviceConfig';
import { cleanupAudioResources } from '../audio/audioQueueManager';
import CuratedCouncilService from './CuratedCouncilService';
import CustomCouncilService from './CustomCouncilService';
import { useDomainStore } from '../../stores/domainStore';
import { councilLog, councilWarn, councilError } from './logger';

interface ServiceConfig {
  tts?: string;
  ttsSettings?: {
    model?: string;
    speed?: number;
  };
  ttsEnabled?: boolean;
  stt?: string;
  sttEnabled?: boolean;
  llm?: { provider: string; model: string };
}

interface CouncilParticipant {
  id?: string;
  name?: string;
}

interface CouncilConfig {
  category?: {
    type?: string;
    titleKey?: string;
  };
  curated?: boolean;
  moderator?: string | CouncilParticipant;
  participants?: (string | CouncilParticipant)[];
  question?: string;
  councilId?: string;
  image?: string;
  level?: 1 | 2;
}

interface CouncilState {
  isActive: boolean;
  isCompleted: boolean;
  type: 'debate' | 'advisory';
  currentSpeaker: string | null;
  moderator: string | null;
  participants: string[];
  question: string;
  dialogueHistory: DialogueEntry[];
  mode: 'curated' | 'custom';
  councilTitle?: string;
  councilImage?: string;
}

interface DialogueEntry {
  speaker: string;
  content: string;
  timestamp: number;
}

interface AudioPipeline {
  currentSpeaker: string | null;
  isStreaming: boolean;
  streamingSession: any;
  completeResponse: string;
  audioQueueFinished: boolean;
}

export interface CouncilMessage {
  type: string;
  speaker?: string;
  speakerName?: string;
  content?: string;
  segmentId?: string | number;
  timestamp?: number;
  message?: string;
}

interface LoaderState {
  isVisible: boolean;
  stage: string;
  participants: string[];
  question: string;
}

type EventCallback = (data: any) => void;

interface Listeners {
  onStateChange: EventCallback[];
  onSpeakerChange: EventCallback[];
  onPhaseChange: EventCallback[];
  onError: EventCallback[];
  onMessageSpoken: EventCallback[];
  onCouncilMessage: EventCallback[];
  onCouncilLoaderChange: EventCallback[];
  onAudioPlaybackStart: EventCallback[];
}

interface StartCouncilResult {
  success: boolean;
  message?: string;
  error?: string;
}

export class CosmicCouncilService {
  config: ServiceConfig;
  councilState: CouncilState;
  private audioPipeline: AudioPipeline;
  private listeners: Listeners;
  private curatedService: CuratedCouncilService;
  private customService: CustomCouncilService;

  constructor() {
    // Load user configuration from settings
    this.config = loadServiceConfig();

    // Council state management
    this.councilState = {
      isActive: false,
      isCompleted: false, // Track if debate finished naturally (keeps interface open for review)
      type: 'debate', // 'debate' or 'advisory' - determines council type
      currentSpeaker: null,
      moderator: null, // Set dynamically for each council
      participants: [], // Set dynamically for each council
      question: '',
      dialogueHistory: [],
      mode: 'custom' // 'curated' or 'custom'
    };

    // Streaming audio pipeline management  
    this.audioPipeline = {
      currentSpeaker: null,
      isStreaming: false,
      streamingSession: null,
      completeResponse: '',
      audioQueueFinished: false
    };

    // Event listeners for UI updates
    this.listeners = {
      onStateChange: [],
      onSpeakerChange: [],
      onPhaseChange: [],
      onError: [],
      onMessageSpoken: [],
      onCouncilMessage: [], // For chatbox integration
      onCouncilLoaderChange: [], // For loader state changes
      onAudioPlaybackStart: [] // For live subtitle sync
    };

    // Initialize specialized services
    // Cast is safe: CosmicCouncilService implements all methods expected by sub-service MainService interfaces
    this.curatedService = new CuratedCouncilService(this as unknown as ConstructorParameters<typeof CuratedCouncilService>[0]);
    this.customService = new CustomCouncilService(this as unknown as ConstructorParameters<typeof CustomCouncilService>[0]);
  }

  // =============================================================================
  // PUBLIC API - Council Control
  // =============================================================================

  /**
   * Start a cosmic council debate session
   */
  async startCouncilDebate(councilConfig: CouncilConfig): Promise<StartCouncilResult> {
    try {
      councilLog('🌌 Starting Cosmic Council with config:', councilConfig);
      
      // Clear any existing audio session to prevent conflicts
      councilLog('🧹 Clearing existing audio session for council');
      cleanupAudioResources();
      
      // Determine council type and generation mode
      const councilType = councilConfig.category?.type || 'debate';
      const mode = councilConfig.curated ? 'curated' : 'custom';
      
      councilLog(`🎯 Council type: ${councilType}, mode: ${mode}`);
      
      // Initialize council state
      this.councilState = {
        ...this.councilState,
        isActive: true,
        type: councilType as 'debate' | 'advisory',
        currentSpeaker: (typeof councilConfig.moderator === 'object' ? councilConfig.moderator?.id : councilConfig.moderator) || 'gautama',
        moderator: (typeof councilConfig.moderator === 'object' ? councilConfig.moderator?.id : councilConfig.moderator) || 'gautama',
        participants: councilConfig.participants?.map(p => (typeof p === 'object' ? p?.id : p) || '').filter(Boolean) || ['plato', 'bingen', 'nietzsche', 'beauvoir'],
        question: councilConfig.question || '',
        dialogueHistory: [],
        councilTitle: councilConfig.category?.titleKey || 'Cosmic Council',
        councilImage: councilConfig.image || '',
        mode: mode
      };

      this._notifyStateChange();

      // Delegate to appropriate service
      councilLog(`🔄 Delegating to ${mode} service`);
      
      if (mode === 'curated' && councilConfig.councilId) {
        // Start curated council playback
        await this.curatedService.startCuratedPlayback(councilConfig.councilId, councilConfig.level || 1);
      } else {
        // Start custom council generation
        const genResult = await this.customService.startCustomGeneration();
        if (!genResult.success) {
          throw new Error(genResult.error || 'Custom generation failed');
        }
      }

      return {
        success: true,
        message: `${mode === 'curated' ? 'Curated' : 'Custom'} council started successfully`
      };

    } catch (error: any) {
      councilError('❌ Error starting council:', error);
      this._notifyError(error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mark debate as completed but keep interface open for review
   * This is called when debate finishes naturally
   */
  completeDebate(): void {
    councilLog('🎉 Council debate completed - keeping interface open for review');
    
    this.councilState = {
      ...this.councilState,
      isCompleted: true, // Mark as completed
      isActive: true, // Keep active for review
      currentSpeaker: null // No more speakers
    };
    
    this._notifyStateChange();
  }

  /**
   * Stop council debate and cleanup resources
   * This is called when the close button is pressed
   */
  async stopCouncil(): Promise<void> {
    councilLog('🛑 Stopping council debate');
    
    try {
      // Stop appropriate service based on current mode
      if (this.councilState.mode === 'curated') {
        councilLog('🛑 Stopping curated council playback');
        this.curatedService.stopCuratedPlayback();
      } else {
        councilLog('🛑 Stopping custom council generation');
        this.customService.cleanup();
      }

      // Cleanup audio pipeline
      this.audioPipeline.currentSpeaker = null;
      this.audioPipeline.isStreaming = false;
      this.audioPipeline.streamingSession = null;
      this.audioPipeline.completeResponse = '';
      this.audioPipeline.audioQueueFinished = false;

      cleanupAudioResources();
      
    } catch (error) {
      councilError('Error during council cleanup:', error);
    }
    
    // Full reset for user-initiated close
    this.councilState = {
      ...this.councilState,
      isActive: false,
      isCompleted: false, // Reset completion state
      type: 'debate', // Reset to default type
      currentSpeaker: null,
      dialogueHistory: [] // Clear history to prevent memory buildup
    };
    
    this._notifyStateChange();
    councilLog('✅ Council stopped and resources cleaned up');
  }

  /**
   * Legacy method name for backward compatibility with UI
   * Alias for stopCouncil()
   */
  async endCouncil(): Promise<void> {
    councilLog('🔄 Legacy endCouncil() called, redirecting to stopCouncil()');
    return await this.stopCouncil();
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Map speaker name to canonical ID
   */
  _getSpeakerId(speakerName: string): string {
    // Official naming conventions - use canonical IDs only
    const speakerMap: Record<string, string> = {
      'ANGELOU': 'angelou',
      'AURELIUS': 'aurelius', 
      'AVERROES': 'averroes',
      'BEAUVOIR': 'beauvoir',
      'DE BEAUVOIR': 'beauvoir',
      'SIMONE DE BEAUVOIR': 'beauvoir',
      'BINGEN': 'bingen',
      'HILDEGARD': 'bingen',
      'HILDEGARD VON BINGEN': 'bingen',
      'BUTLER': 'butler',
      'CAMUS': 'camus',
      'DALAI': 'dalai',
      'DALAI LAMA': 'dalai',
      'DESCARTES': 'descartes',
      'DOUGLAS': 'douglas',
      'FREDERICK DOUGLAS': 'douglas',
      'EINSTEIN': 'einstein',
      'ALBERT EINSTEIN': 'einstein',
      'FRANKL': 'frankl',
      'VIKTOR FRANKL': 'frankl',
      'GANDHI': 'gandhi',
      'MOHANDAS GANDHI': 'gandhi',
      'MAHATMA GANDHI': 'gandhi',
      'GAUTAMA': 'gautama',
      'SIDDHARTHA GAUTAMA': 'gautama',
      'BUDDHA': 'gautama',
      'GIBRAN': 'gibran',
      'KAHLIL GIBRAN': 'gibran',
      'JUNG': 'jung',
      'CARL JUNG': 'jung',
      'CARL GUSTAV JUNG': 'jung',
      'KABIR': 'kabir',
      'KING': 'king',
      'MARTIN LUTHER KING': 'king',
      'LUTHER': 'luther',
      'MERTON': 'merton',
      'THOMAS MERTON': 'merton',
      'NIETZSCHE': 'nietzsche',
      'FRIEDRICH NIETZSCHE': 'nietzsche',
      'PLATO': 'plato',
      'RUMI': 'rumi',
      'JALAL AD-DIN RUMI': 'rumi',
      'SARTRE': 'sartre',
      'JEAN-PAUL SARTRE': 'sartre',
      'TERESA': 'teresa',
      'MOTHER TERESA': 'teresa',
      'THOREAU': 'thoreau',
      'HENRY DAVID THOREAU': 'thoreau',
      'TOLLE': 'tolle',
      'ECKHART TOLLE': 'tolle',
      'VINCI': 'vinci',
      'LEONARDO DA VINCI': 'vinci',
      'DA VINCI': 'vinci',
      'LEONARDO': 'vinci',
      'WEIL': 'weil',
      'SIMONE WEIL': 'weil'
    };
    
    return speakerMap[speakerName] || speakerName.toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Get dialogue speaker label as used in curated council files
   */
  _getDialogueSpeakerLabel(participantId: string): string {
    // Map participant IDs to speaker labels used in dialogue files
    const speakerLabelMap: Record<string, string> = {
      'angelou': 'ANGELOU',
      'aurelius': 'AURELIUS',
      'averroes': 'AVERROES',
      'beauvoir': 'DE BEAUVOIR',
      'bingen': 'BINGEN',
      'butler': 'BUTLER',
      'camus': 'CAMUS',
      'dalai': 'DALAI LAMA',
      'descartes': 'DESCARTES',
      'douglas': 'DOUGLAS',
      'einstein': 'EINSTEIN',
      'frankl': 'FRANKL',
      'gandhi': 'GANDHI',
      'gautama': 'GAUTAMA',
      'gibran': 'GIBRAN',
      'jung': 'JUNG',
      'kabir': 'KABIR',
      'king': 'KING',
      'luther': 'LUTHER',
      'merton': 'MERTON',
      'nietzsche': 'NIETZSCHE',
      'plato': 'PLATO',
      'rumi': 'RUMI',
      'sartre': 'SARTRE',
      'teresa': 'TERESA',
      'thoreau': 'THOREAU',
      'tolle': 'TOLLE',
      'vinci': 'VINCI',
      'weil': 'WEIL'
    };
    
    return speakerLabelMap[participantId] || participantId.toUpperCase();
  }

  /**
   * Get full name for display
   */
  _getFullName(participantId: string): string {
    const nameMap: Record<string, string> = {
      'angelou': 'Maya Angelou',
      'aurelius': 'Marcus Aurelius',
      'averroes': 'Averroes',
      'beauvoir': 'Simone de Beauvoir',
      'bingen': 'Hildegard von Bingen',
      'butler': 'Judith Butler',
      'camus': 'Albert Camus',
      'dalai': 'Dalai Lama',
      'descartes': 'René Descartes',
      'douglas': 'Frederick Douglass',
      'einstein': 'Albert Einstein',
      'frankl': 'Viktor Frankl',
      'gandhi': 'Mohandas Gandhi',
      'gautama': 'Siddhartha Gautama',
      'gibran': 'Kahlil Gibran',
      'jung': 'Carl Jung',
      'kabir': 'Kabir',
      'king': 'Martin Luther King Jr.',
      'luther': 'Martin Luther',
      'merton': 'Thomas Merton',
      'nietzsche': 'Friedrich Nietzsche',
      'plato': 'Plato',
      'rumi': 'Rumi',
      'sartre': 'Jean-Paul Sartre',
      'teresa': 'Mother Teresa',
      'thoreau': 'Henry David Thoreau',
      'tolle': 'Eckhart Tolle',
      'vinci': 'Leonardo da Vinci',
      'weil': 'Simone Weil'
    };
    
    return nameMap[participantId] || participantId;
  }

  /**
   * Get echo name with prefix for UI display
   */
  _getEchoName(participantId: string): string {
    const baseName = this._getFullName(participantId);
    const echoPrefix = 'Echo of';
    return `${echoPrefix} ${baseName}`;
  }

  /**
   * Get user's preferred language from UI settings
   */
  _getUserLanguage(): string {
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
   * Get user's TTS settings from configuration
   */
  _getUserTTSSettings(): { provider: string | undefined; model: string; speed: number; enabled: boolean } {
    // Always read fresh config — settings may change between councils
    const freshConfig = loadServiceConfig();
    return {
      provider: freshConfig.tts,
      model: freshConfig.ttsSettings?.model || 'tts-1',
      speed: freshConfig.ttsSettings?.speed || 1.0,
      enabled: freshConfig.ttsEnabled !== false
    };
  }

  /**
   * Add entry to dialogue history with memory management
   */
  _addToDialogueHistory(speaker: string, content: string): void {
    councilLog(`📝 Adding to dialogue history: ${speaker}`);
    
    if (!speaker || !content?.trim()) {
      councilWarn('Invalid speaker or content for dialogue history');
      return;
    }

    // Truncate very long content to prevent memory issues
    const truncatedContent = content.length > 2000 ? content.substring(0, 2000) + '...' : content;

    this.councilState.dialogueHistory.push({
      speaker: this._getFullName(speaker),
      content: truncatedContent,
      timestamp: Date.now()
    });

    // Keep only last 15 exchanges to prevent memory bloat (reduced from 20)
    if (this.councilState.dialogueHistory.length > 15) {
      this.councilState.dialogueHistory = this.councilState.dialogueHistory.slice(-15);
    }
  }

  // =============================================================================
  // EVENT SYSTEM - UI Integration
  // =============================================================================

  /**
   * Add event listener for council state changes
   */
  addEventListener(event: keyof Listeners, callback: EventCallback): void {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
      councilLog(`🔌 [CouncilService] Event listener registered: ${event}, total listeners: ${this.listeners[event].length}`);
    } else {
      councilWarn(`⚠️ [CouncilService] Unknown event type: ${event}`);
    }
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: keyof Listeners, callback: EventCallback): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Notify state change to all listeners
   */
  _notifyStateChange(): void {
    councilLog('🔄 Council state changed:', this.councilState);
    
    if (this.listeners.onStateChange.length === 0) return;
    
    this.listeners.onStateChange.forEach(callback => {
      try {
        callback(this.councilState);
      } catch (error) {
        councilError('Error in state change callback:', error);
      }
    });
  }

  /**
   * Notify speaker change
   */
  _notifySpeakerChange(speaker: string): void {
    this.listeners.onSpeakerChange.forEach(callback => {
      try {
        callback(speaker);
      } catch (error) {
        councilError('Error in speaker change callback:', error);
      }
    });
  }

  /**
   * Notify error
   */
  _notifyError(error: Error): void {
    this.listeners.onError.forEach(callback => {
      try {
        callback(error);
      } catch (error) {
        councilError('Error in error callback:', error);
      }
    });
  }

  /**
   * Notify message spoken for audio feedback
   */
  _notifyMessageSpoken(speaker: string, message: string): void {
    this.listeners.onMessageSpoken.forEach(callback => {
      try {
        callback({ speaker, message });
      } catch (error) {
        councilError('Error in message spoken callback:', error);
      }
    });
  }

  /**
   * 🔥 NEW: Notify chatbox with council message for integration
   */
  _notifyCouncilMessage(messageData: CouncilMessage): void {
    councilLog('🚀 Council message:', messageData.type, messageData.speakerName);
    councilLog(`📢 [CouncilService] Broadcasting to ${this.listeners.onCouncilMessage.length} listeners`);

    this.listeners.onCouncilMessage.forEach((callback, index) => {
      try {
        councilLog(`📤 [CouncilService] Calling listener #${index + 1}`);
        callback(messageData);
      } catch (error) {
        councilError('Error in council message callback:', error);
      }
    });
  }

  /**
   * Notify when audio playback begins for a segment (for live subtitle sync)
   */
  _notifyAudioPlaybackStart(data: { speaker: string; speakerId: string; content: string; duration: number }): void {
    this.listeners.onAudioPlaybackStart.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        councilError('Error in audio playback start callback:', error);
      }
    });
  }

  /**
   * 🔄 NEW: Get current loader state from active service
   */
  getCurrentLoaderState(): LoaderState {
    if (this.councilState.mode === 'custom' && this.customService) {
      return this.customService.getCurrentLoaderState();
    }
    // Default state for other modes
    return {
      isVisible: false,
      stage: 'generating',
      participants: [],
      question: ''
    };
  }

  /**
   * 🔄 NEW: Notify UI about council loader state changes
   */
  _notifyCouncilLoaderChange(loaderState: LoaderState): void {
    councilLog('🔄 Council loader state:', loaderState.isVisible ? `${loaderState.stage} (visible)` : 'hidden');
    
    this.listeners.onCouncilLoaderChange.forEach((callback, _index) => {
      try {
        callback(loaderState);
      } catch (error) {
        councilError('Error in council loader change callback:', error);
      }
    });
  }

  // =============================================================================
  // PUBLIC GETTERS - State Access
  // =============================================================================

  /**
   * Get current council state
   */
  getCouncilState(): CouncilState & { currentSpeaker: string | null; isStreaming: boolean } {
    return {
      ...this.councilState,
      // Add runtime information
      currentSpeaker: this.audioPipeline.currentSpeaker,
      isStreaming: this.audioPipeline.isStreaming
    };
  }

  /**
   * Check if council is active
   */
  isActive(): boolean {
    return this.councilState.isActive;
  }

  /**
   * Get current speaker
   */
  getCurrentSpeaker(): string | null {
    return this.councilState.currentSpeaker;
  }

  /**
   * Get dialogue history
   */
  getDialogueHistory(): DialogueEntry[] {
    return this.councilState.dialogueHistory;
  }

  // =============================================================================
  // CLEANUP AND MEMORY MANAGEMENT
  // =============================================================================

  /**
   * Comprehensive cleanup of all council resources
   */
  cleanup(): void {
    councilLog('🧹 Comprehensive council cleanup');

    // Cleanup specialized services
    this.curatedService.cleanup();
    this.customService.cleanup();

    // Clear audio pipeline
    this.audioPipeline.currentSpeaker = null;
    this.audioPipeline.isStreaming = false;
    this.audioPipeline.streamingSession = null;
    this.audioPipeline.completeResponse = '';
    this.audioPipeline.audioQueueFinished = false;

    // Clear all event listeners
    // Zustand controller manages listener lifecycle
    councilLog('⏭️ [CouncilService] Skipping listener cleanup - Zustand controller manages lifecycle');

    // Reset council state
    this.councilState = {
      isActive: false,
      isCompleted: false,
      type: 'debate',
      currentSpeaker: null,
      moderator: null, // Set dynamically per council
      participants: [], // Set dynamically per council
      question: '',
      dialogueHistory: [],
      mode: 'custom'
    };
  }

  /**
   * Get memory usage statistics for debugging
   */
  getMemoryStats(): { dialogueHistoryLength: number; listenersCount: number; curatedServiceActive: boolean; customServiceActive: boolean } {
    return {
      dialogueHistoryLength: this.councilState.dialogueHistory.length,
      listenersCount: Object.values(this.listeners).reduce((sum, arr) => sum + arr.length, 0),
      curatedServiceActive: this.curatedService.isActive(),
      customServiceActive: this.customService.isActive()
    };
  }
}

// Create singleton instance
export const cosmicCouncilService = new CosmicCouncilService();
export default CosmicCouncilService;
