// src/services/audioService.ts

import { transcribeAudio } from './audio/stt';
import { convertTextToSpeech } from './audio/tts';
import { generateResponse } from './audio/llm';
import { loadServiceConfig } from './audio/config/serviceConfig';
import { 
  getStorageKeyForMode, 
  getStoredStoryContent,
  saveStoryContent,
  STORAGE_KEYS 
} from '../utils/storageKeysV2';
import { MODE_FRAME_MESSAGES, LANGUAGE_FRAME_MESSAGES } from './audio/llm/llmUtils';
import { processPlaceholders } from '../utils/placeholderUtils';
import { getContextForMode, INSTRUCTION_MODES } from './audio/conversationContext';
import { initialMessageService } from './audio/initialMessageService';
import type { ConversationMode as InitialMessageMode } from './audio/initialMessagePathBuilder';
import { fetchInstructions } from './audio/instructionProcessor';
import { 
  addToAudioQueue, 
  cleanupAudioResources, 
  getAudioQueueStatus,
  setCurrentSession 
} from './audio/audioQueueManager';
import { Seed, Message, ConversationMode } from '../types/global';
import { LocalStorageAdapter } from '../storage/localAdapter';

import { useDomainStore } from '../stores';

let responseCounter = 0;

// Types for audio service
interface AudioFile {
  url: string;
  duration?: number;
  timestamp?: number;
}

interface AudioProcessResult {
  transcription: string;
  responseText: string;
  metadata: {
    config: {
      provider: string;
      model: string;
      language?: string;
    };
    [key: string]: any;
  };
}

interface InitiateConversationResult {
  mode?: string;
  language?: string;
  usePreCreatedStories?: boolean;
}

interface PlaybackCallbacks {
  onStart?: (data: { duration: number; timestamp: number }) => void;
  onProgress?: (data: { currentTime: number; duration: number; progress: number }) => void;
  onComplete?: () => void;
  onError?: (error: any) => void;
}

interface ServiceConfig {
  llm: {
    provider: string;
    model: string;
    [key: string]: any;
  };
  stt: any;
  tts: any;
  ttsSettings?: {
    speed?: number;
  };
}

interface TranscriptionResult {
  text: string;
  [key: string]: any;
}

interface LLMResponse {
  response: string;
  metadata?: Record<string, any>;
}

interface TextReadyEvent {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
}

type EventCallback = (data: any) => void;

// Simple event emitter
export const eventEmitter = {
  listeners: {} as Record<string, EventCallback[]>,
  on(event: string, callback: EventCallback): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  },
  emit(event: string, data: any): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  },
  removeListener(event: string, callback: EventCallback): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }
};

// BYOK architecture: OpenRouter for LLM, self-hosted TTS/STT on GEX130

interface ProcessAudioOptions {
  skipLLM?: boolean;
}

export const processAudio = async (
  audioBlob: Blob,
  options: ProcessAudioOptions = {}
): Promise<AudioProcessResult> => {
  const config = loadServiceConfig();
  const selectedLanguage = useDomainStore.getState().language.current || 'en';

  try {
    // Emit 'hearing' stage so the ProcessingLoader shifts its quote pool to
    // the STT-specific one while Whisper is transcribing.
    useDomainStore.getState().setProcessingStage('hearing');
    const transcription: TranscriptionResult = await transcribeAudio(audioBlob, config.stt, selectedLanguage);
    const selectedFigureId = useDomainStore.getState().figures.selectedId;

    // Get the full figure name from the selected figure object
    const selectedFigureObj = selectedFigureId
      ? useDomainStore.getState().figures.list.find(f => f.id === selectedFigureId)
      : null;
    const selectedFigure = selectedFigureObj?.name || selectedFigureId; // Use full name if available

    let selectedMode = useDomainStore.getState().mode.selected;

    if (!Object.values(INSTRUCTION_MODES).includes(selectedMode as any)) {
      selectedMode = ConversationMode.STORY;
      // Invalid mode, defaulting to mode
    }

    const selectedSeedId = useDomainStore.getState().seeds.selectedId;
    const selectedSeed = selectedFigureId && selectedSeedId
      ? useDomainStore.getState().seeds.byFigure[selectedFigureId]?.find(s => s.id.toString() === selectedSeedId) ?? null
      : null;

    if (options.skipLLM) {
      return {
        transcription: transcription.text,
        responseText: '',
        metadata: {
          config: {
            provider: config.llm.provider,
            model: config.llm.model,
            language: selectedLanguage,
          },
        },
      };
    }

    // Process transcription with selected context

    eventEmitter.emit('textReady', { 
      role: 'user', 
      content: transcription.text 
    } as TextReadyEvent);

    const instructions = await fetchInstructions(selectedFigureId!, selectedMode!, selectedSeed);
    
    // Use the new context collection system
    const seedId = selectedSeed?.id || selectedSeed;
    const contextHistory = getContextForMode(selectedMode!, selectedFigureId!, seedId as string | number);
    
    
    const messages: Message[] = [
      ...contextHistory,
      { role: 'user', content: transcription.text }
    ];
    

    const response: LLMResponse = await generateResponse({
      messages,
      instructions,
      model: config.llm.model,
      streamingCallback: async (chunk: string) => {
        if (!chunk.trim()) return;

        responseCounter++;
        const responseIndex = String(responseCounter);

        // Emit text first - user sees response regardless of TTS status
        eventEmitter.emit('textReady', {
          role: 'assistant',
          content: chunk
        } as TextReadyEvent);

        // Attempt TTS with error handling - graceful degradation if audio fails
        try {
          const audioFile = await convertTextToSpeech(
            chunk,
            responseIndex,
            selectedFigureId || selectedFigure || '',
            config.tts,
            config.ttsSettings?.speed || 1.0,
            selectedLanguage
          );
          eventEmitter.emit('audioReady', audioFile);
        } catch (error) {
          console.error('[TTS Streaming] Audio generation failed for chunk:', error);
        }
      }
    });

    // Save to appropriate storage based on mode
    // CRITICAL FIX: Don't save to storage for introduction/story modes (read-only)
    if (selectedMode !== INSTRUCTION_MODES.FREE_CONVERSATION &&
        selectedMode !== INSTRUCTION_MODES.INTRODUCTION &&
        selectedMode !== INSTRUCTION_MODES.STORY &&
        selectedSeed) {
      const storageKey = getStorageKeyForMode(selectedMode!, selectedFigureId!, selectedSeed.id);
      const currentHistory = JSON.parse(LocalStorageAdapter.getString(storageKey!) || '[]');
      const updatedHistory = [
        ...currentHistory,
        { role: 'user', content: transcription.text },
        { role: 'assistant', content: response.response }
      ];
      LocalStorageAdapter.setString(storageKey!, JSON.stringify(updatedHistory));
    } else if (selectedMode === INSTRUCTION_MODES.FREE_CONVERSATION) {
      // Free conversation saves globally for the figure
      const storageKey = getStorageKeyForMode(selectedMode, selectedFigureId!);
      const currentHistory = JSON.parse(LocalStorageAdapter.getString(storageKey!) || '[]');
      const updatedHistory = [
        ...currentHistory,
        { role: 'user', content: transcription.text },
        { role: 'assistant', content: response.response }
      ];
      LocalStorageAdapter.setString(storageKey!, JSON.stringify(updatedHistory));
    }

    return { 
      transcription: transcription.text, 
      responseText: response.response,
      metadata: {
        ...response.metadata,
        config: {
          provider: config.llm.provider,
          model: config.llm.model
        }
      }
    };

  } catch (error) {
    throw error;
  }
};

export const processTextMessage = async (
  message: string,
  figureId: string,
  isInitialMessage: boolean = false
): Promise<AudioProcessResult> => {
  // Legacy path — controller architecture (onSubmitMessage) should handle messages.
  // This path still works but emits to an event bus with no active listeners.
  if (import.meta.env.DEV) {
    console.warn('[audioService] processTextMessage called — this is the legacy path. Controller should handle messages via onSubmitMessage.');
  }
  const config = loadServiceConfig();

  try {
    let selectedMode = useDomainStore.getState().mode.selected;

    if (!Object.values(INSTRUCTION_MODES).includes(selectedMode as any)) {
      selectedMode = ConversationMode.STORY;
      // Invalid mode, defaulting to mode
    }

    const selectedSeedId = useDomainStore.getState().seeds.selectedId;
    const selectedSeed: Seed | null = selectedSeedId
      ? useDomainStore.getState().seeds.byFigure[figureId]?.find(s => s.id.toString() === selectedSeedId) ?? null
      : null;
    const selectedLanguage = useDomainStore.getState().language.current || 'en';

    eventEmitter.emit('textReady', { 
      role: 'user', 
      content: message,
      hidden: isInitialMessage // Mark initial messages as hidden
    } as TextReadyEvent);

    const instructions = await fetchInstructions(
      figureId, 
      selectedMode!,
      selectedSeed
    );

    const baseMessage = isInitialMessage 
      ? message.replace(/\(Respond in .*\)$/, '') 
      : message;
    
    const languageContext = selectedLanguage || 'english';

    // Use the new context collection system
    // CRITICAL FIX: Always include context for seed_conversation (even for initial messages)
    let priorHistory: Message[] = [];
    const seedId = selectedSeed?.id || selectedSeed;
    if (selectedMode === INSTRUCTION_MODES.SEED_CONVERSATION && seedId) {
      // Always collect context for seed_conversation
      priorHistory = getContextForMode(selectedMode, figureId, seedId as string | number);
    } else if (!isInitialMessage) {
      // Collect context for non-initial message
      priorHistory = getContextForMode(selectedMode!, figureId, seedId as string | number);
    }

    // Ensure priorHistory is valid
    const validPriorHistory = (priorHistory || []).filter(msg => 
      msg && msg.role && msg.content && typeof msg.content === 'string'
    );
    
    // Ensure baseMessage is valid
    if (!baseMessage || typeof baseMessage !== 'string') {
      console.error('Invalid baseMessage:', baseMessage);
      throw new Error('Base message is required for processing');
    }
    
    const messages: Message[] = [
      ...validPriorHistory,
      { role: 'user', content: baseMessage }
    ];

    const response: LLMResponse = await generateResponse({
      messages,
      instructions,
      model: config.llm.model,
      language: languageContext,
      streamingCallback: async (chunk: string) => {
        if (!chunk.trim()) return;

        responseCounter++;
        const responseIndex = String(responseCounter);

        // Emit text first - user sees response regardless of TTS status
        eventEmitter.emit('textReady', {
          role: 'assistant',
          content: chunk
        } as TextReadyEvent);

        // Attempt TTS with error handling - graceful degradation if audio fails
        try {
          const audioFile = await convertTextToSpeech(
            chunk,
            responseIndex,
            figureId,
            config.tts,
            config.ttsSettings?.speed || 1.0,
            languageContext
          );
          eventEmitter.emit('audioReady', audioFile);
        } catch (error) {
          console.error('[TTS Streaming] Audio generation failed for chunk:', error);
        }
      }
    });

    // Controller owns persistence in Zustand pipeline
    return { 
      transcription: message, 
      responseText: response.response,
      metadata: {
        ...response.metadata,
        config: {
          provider: config.llm.provider,
          model: config.llm.model,
          language: languageContext
        }
      }
    };

  } catch (error) {
    throw error;
  }
};

export const initiateConversation = async (
  language: string,
  figureId: string
): Promise<InitiateConversationResult> => {
  try {
    let selectedMode = useDomainStore.getState().mode.selected;

    if (!Object.values(INSTRUCTION_MODES).includes(selectedMode as any)) {
      selectedMode = ConversationMode.STORY;
      // Defaulting to story mode
    }

    const langCode = language.toLowerCase().substring(0, 2);

    // NOTE: Language should already be set by handleLanguageAutoSelect before this is called
    // We don't set it here to avoid duplicate translation loads
    // Just verify it matches what we expect
    const currentLang = useDomainStore.getState().language.current;
    if (currentLang !== langCode) {
      console.warn(`[initiateConversation] Language mismatch: current=${currentLang}, expected=${langCode}`);
    }

    let seedTitle = '';
    let seedId: number | null = null;
    if (selectedMode !== INSTRUCTION_MODES.FREE_CONVERSATION) {
      const selectedSeedId = useDomainStore.getState().seeds.selectedId;
      const selectedSeed: Seed | null = selectedSeedId
        ? useDomainStore.getState().seeds.byFigure[figureId]?.find(s => s.id.toString() === selectedSeedId) ?? null
        : null;
      if (selectedSeed) {
        seedTitle = selectedSeed.title ||
                   ((selectedSeed as any).name && (selectedSeed as any).name.split(' - ')[1]) ||
                   (selectedSeed as any).name ||
                   '';
        seedId = selectedSeed.id ? Number(selectedSeed.id) : null;
      }
    }

    // 🎯 NEW: Check if we have a pre-created initial message
    // If yes, use simple placeholder instead of detailed LLM prompt
    let initialMessage: string;

    const modeToInitialMode: Record<string, InitialMessageMode | null> = {
      [INSTRUCTION_MODES.SEED_CONVERSATION]: 'wisdom',
      [INSTRUCTION_MODES.FREE_CONVERSATION]: 'freetalk',
      [INSTRUCTION_MODES.CHALLENGE]: 'quest'
    };

    const initialMsgMode = modeToInitialMode[selectedMode!] || null;
    const hasPreCreated = initialMsgMode &&
                         initialMessageService.hasInitialMessage(figureId, initialMsgMode, seedId);

    if (hasPreCreated) {
      // Use simple placeholder - the pre-created message will be used in streamDriver
      initialMessage = 'Start conversation';

      if (import.meta.env.DEV) {
        console.log('[Init] Using simple placeholder - pre-created message available', {
          figure: figureId,
          mode: initialMsgMode,
          seedId
        });
      }
    } else {
      // No pre-created message - use detailed LLM prompt (fallback)
      const languageFrame = LANGUAGE_FRAME_MESSAGES[langCode] || LANGUAGE_FRAME_MESSAGES.en;
      let modeFrame = MODE_FRAME_MESSAGES[selectedMode!][langCode] ||
                      MODE_FRAME_MESSAGES[selectedMode!].en;

      // Create a replacements object with all potential placeholder values
      const replacements = {
        SEED_TITLE: seedTitle || '',
        FIGURE: figureId || '',
        MODE: selectedMode || '',
        LANGUAGE: language || ''
      };

      // Process all placeholders in the mode frame
      if (selectedMode !== INSTRUCTION_MODES.FREE_CONVERSATION) {
        modeFrame = processPlaceholders(modeFrame, replacements);
      }

      initialMessage = processPlaceholders(`${languageFrame} ${modeFrame}`, replacements);

      if (import.meta.env.DEV) {
        console.log('[Init] Using LLM prompt - no pre-created message', {
          figure: figureId,
          mode: selectedMode,
          seedId
        });
      }
    }

    // Story mode is now handled by StoryService with pre-created S3 stories
    // LLM generation path removed - all stories are pre-created for EN/DE
    if (selectedMode === INSTRUCTION_MODES.STORY || selectedMode === INSTRUCTION_MODES.INTRODUCTION) {
      // Story mode uses pre-created S3 stories
      // StoryIntegrationManager handles story loading
      return {
        mode: 'story',
        language: langCode,
        usePreCreatedStories: true
      };
    }

    const waitForSelection = async (timeoutMs = 800) => {
        const started = Date.now();
        return new Promise<{ figureId: string | null; seedId: string | null }>((resolve) => {
          const tick = () => {
            const s = useDomainStore.getState();
            const f = s.figures.selectedId;
            const seed = s.seeds.selectedId;
            if (f && seed) {
              if (import.meta.env.DEV) {
                console.log('[Mode2Triage][Init] selection ready', { f, seed, elapsed: Date.now() - started });
              }
              resolve({ figureId: f, seedId: seed });
              return;
            }
            if (Date.now() - started >= timeoutMs) {
              if (import.meta.env.DEV) {
                console.warn('[Mode2Triage][Init] selection not ready before timeout', { f, seed, elapsed: Date.now() - started });
              }
              resolve({ figureId: f ?? null, seedId: seed ?? null });
              return;
            }
            // Use a short rAF/timeout cadence to avoid blocking
            if (typeof requestAnimationFrame !== 'undefined') {
              requestAnimationFrame(() => tick());
            } else {
              setTimeout(() => tick(), 16);
            }
          };
          tick();
        });
    };

    // Ensure selection is ready before kicking the stream pipeline
    let { figures: { selectedId: currentFigureId }, seeds: { selectedId: selectedSeedId } } = useDomainStore.getState() as any;
    if (!currentFigureId || !selectedSeedId) {
      const ready = await waitForSelection(1000);
      currentFigureId = ready.figureId;
      selectedSeedId = ready.seedId as any;
    }

    if (currentFigureId && selectedSeedId) {
      // Ensure the conversation thread is ready (historyKey set) before queuing the request
      const waitForThreadKey = async (expectedKey: string, timeoutMs = 1200) => {
          const start = Date.now();
          return new Promise<boolean>((resolve) => {
            const tick = () => {
              const key = useDomainStore.getState().conversation.historyKey;
              if (key === expectedKey) {
                resolve(true);
                return;
              }
              if (Date.now() - start >= timeoutMs) {
                resolve(false);
                return;
              }
              if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(() => tick());
              } else {
                setTimeout(() => tick(), 16);
              }
            };
            tick();
          });
      };

      const storeNow = useDomainStore.getState();
      const { setConversationStarted, setPendingRequestId } = storeNow;

      // Compute expected history key for the current selection
      const selectedMode = storeNow.mode.selected || INSTRUCTION_MODES.SEED_CONVERSATION;
      const expectedKey = getStorageKeyForMode(
        selectedMode,
        String(currentFigureId),
        String(selectedSeedId)
      );
      if (expectedKey) {
        const ok = await waitForThreadKey(expectedKey, 1200);
        if (import.meta.env.DEV) {
          console.log('[Mode2Triage][Init] threadKey wait', { expectedKey, ok });
        }
      }

      // 🎯 CLEAN: No hidden message needed!
      // streamDriver detects first message by checking messages.length === 0
      // Pre-created messages load directly without trigger prompt

      setConversationStarted(true);

      const requestId =
        typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : `req-${Date.now()}`;
      if (import.meta.env.DEV) {
        console.log('[Mode2Triage][Init] setPendingRequestId - triggering stream', {
          requestId,
          hasPreCreated,
          messagesEmpty: true
        });
      }
      setPendingRequestId(requestId);
      return {};
    }

    // Selection not ready within budget
    if (import.meta.env.DEV) {
      console.warn('[Mode2Triage][Init] Selection not ready in time');
    }
    return {};
  } catch (error) {
    throw error;
  }
};

// Re-export from audioQueueManager for backward compatibility
export { cleanupAudioResources, getAudioQueueStatus } from './audio/audioQueueManager';

export const MODES = INSTRUCTION_MODES;

export const playPrerecordedAudio = async (
  audioUrl: string, 
  options: PlaybackCallbacks = {}
): Promise<HTMLAudioElement> => {
  const {
    onStart,
    onProgress,
    onComplete,
    onError
  } = options;

  try {
    cleanupAudioResources();

    const audio = new Audio(audioUrl);
    
    audio.addEventListener('loadedmetadata', () => {
      onStart?.({
        duration: audio.duration,
        timestamp: Date.now()
      });
    });

    audio.addEventListener('timeupdate', () => {
      onProgress?.({
        currentTime: audio.currentTime,
        duration: audio.duration,
        progress: (audio.currentTime / audio.duration) * 100
      });
    });

    audio.addEventListener('ended', () => {
      onComplete?.();
      cleanupAudioResources();
    });

    audio.addEventListener('error', (error) => {
      onError?.(error);
      cleanupAudioResources();
    });

    await audio.play();
    return audio;

  } catch (error) {
    onError?.(error);
    throw error;
  }
};

