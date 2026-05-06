// src/services/audio/llm/index.ts
// LLM routing: OpenRouter BYOK → free-tier proxy (Nebius via CF Worker)

import { generateBYOKResponse } from './llmAdapter';
import { generateFreeTierResponse } from '../../proxy/freeTierAdapter';
import { keyStorage } from '../../storage/keyStorageService';
import { useDomainStore } from '../../../stores/domainStore';
import { LLM_SERVICES } from '../config/serviceConfig';
import seedDataProcessor from '../../seedDataProcessor';
import {
  validateAndPreprocessMessages,
  validateResponse,
  performanceMonitor,
  estimateTokens,
  TextChunker
} from './llmUtils';
import { loadServiceConfig } from '../config/serviceConfig';

// ============================================
// Type Definitions
// ============================================

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface PresetResponse {
  response: string;
  [key: string]: any;
}

export interface LLMResponse {
  response: string;
  metadata?: {
    type?: string;
    language?: string;
    tokensEstimated?: number;
    performance?: any;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface GenerateResponseOptions {
  messages: Message[];
  instructions: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  streamingCallback?: (chunk: string) => Promise<void>;
  presetResponse?: PresetResponse | null;
  language?: string | null;
  tools?: Array<{ type: string; function: { name: string; description: string; parameters: any } }>;
  onToolCall?: (toolCall: { name: string; arguments: string; id?: string }) => void;
  signal?: AbortSignal;
}

// ============================================
// Main Export
// ============================================

export const generateResponse = async ({
  messages,
  instructions,
  model,
  maxTokens = 4000,
  temperature = 1,
  streamingCallback,
  presetResponse = null,
  language = null,
  tools,
  onToolCall,
  signal
}: GenerateResponseOptions): Promise<LLMResponse> => {
  const perfMetrics = performanceMonitor.startRequest();

  try {
    const selectedLanguage = language ||
                           useDomainStore.getState().language.current ||
                           'en';

    // Preset response path (stories, etc.)
    if (presetResponse) {
      const chunker = new TextChunker(selectedLanguage);
      if (streamingCallback) {
        await chunker.processChunk(presetResponse.response, streamingCallback);
        await chunker.finish(streamingCallback);
      }

      return {
        ...presetResponse,
        metadata: {
          type: 'preset',
          language: selectedLanguage,
          tokensEstimated: estimateTokens(presetResponse.response)
        }
      };
    }

    const processedMessages = validateAndPreprocessMessages(messages);

    // Get seed data from store
    let seedData: any = null;
    const selectedFigureId = useDomainStore.getState().figures.selectedId;
    const selectedSeedId = useDomainStore.getState().seeds.selectedId;

    if (selectedFigureId && selectedSeedId) {
      seedData = useDomainStore.getState().seeds.byFigure[selectedFigureId]?.find(
        s => s.id.toString() === selectedSeedId
      );
    }

    // ============================================
    // Routing: BYOK (OpenRouter) → Free-tier (Nebius proxy)
    // ============================================

    // Check key existence AND validity — an invalid key should fall through to free-tier
    const keyMeta = await keyStorage.getKeyMetadata('openrouter');
    const hasValidOpenRouterKey = keyMeta !== null && keyMeta?.valid === true;

    if (hasValidOpenRouterKey) {
      // BYOK path: user's own OpenRouter key
      const serviceConfig = loadServiceConfig();
      try {
        const result = await generateBYOKResponse({
          messages: processedMessages,
          instructions,
          seedData,
          model: model || LLM_SERVICES.OPENROUTER.models.QWEN3_235B,
          zdr: serviceConfig.llm.zdr ?? false,
          maxTokens,
          temperature,
          languageId: selectedLanguage,
          streamingCallback: async (chunk: string) => {
            if (chunk.trim()) {
              await streamingCallback?.(chunk);
            }
          },
          tools,
          onToolCall,
          signal
        });

        const perfResult = performanceMonitor.endRequest(perfMetrics, true);

        return {
          ...result,
          metadata: {
            ...result.metadata,
            performance: perfResult,
            language: selectedLanguage,
            tokensEstimated: estimateTokens(result.response)
        }
      };
      } catch (error: any) {
        // Mark BYOK key as invalid on auth errors so next request falls through to free-tier
        if (error?.status === 401 || error?.status === 403) {
          console.warn('[LLM] BYOK key rejected (HTTP', error.status, ') — marking invalid, falling through to free-tier');
          await keyStorage.markInvalid('openrouter');
          // Fall through to free-tier path below instead of throwing
        } else {
          throw error;
        }
      }
    }

    // ============================================
    // Free-tier path: Nebius via Cloudflare Worker proxy (WP6)
    // ============================================

    const selectedFigureIdForFree = useDomainStore.getState().figures.selectedId;
    if (!selectedFigureIdForFree) {
      throw new Error('No figure selected');
    }

    // Map ConversationMode enum to instruction file mode
    // 'challenge' → 'seed_challenge' (matches instruction file naming)
    const storeMode = useDomainStore.getState().mode.selected || 'free_conversation';
    const currentMode = storeMode === 'challenge' ? 'seed_challenge' : storeMode;

    // Process seed data for the free-tier path (same processing as BYOK via instructionProcessor)
    // This gives the worker the structured seed data (targetSeed, seedsOverview, etc.)
    // so the LLM gets the same quality context as BYOK users
    let processedSeedData: any = undefined;
    const allSeeds = useDomainStore.getState().seeds.byFigure[selectedFigureIdForFree] || [];
    const figureMeta = { figure: selectedFigureIdForFree.charAt(0).toUpperCase() + selectedFigureIdForFree.slice(1) };

    if (currentMode === 'seed_challenge' && seedData) {
      processedSeedData = seedDataProcessor.processSeedChallengeData(seedData, allSeeds, figureMeta, selectedLanguage);
    } else if (currentMode === 'seed_conversation' && seedData) {
      processedSeedData = seedDataProcessor.processSeedConversationData(seedData, allSeeds, figureMeta, selectedLanguage);
    } else if (currentMode === 'free_conversation') {
      processedSeedData = seedDataProcessor.processFreeConversationData(allSeeds, figureMeta, selectedLanguage);
    }

    const result = await generateFreeTierResponse({
      messages: processedMessages,
      figureId: selectedFigureIdForFree,
      mode: currentMode,
      language: selectedLanguage,
      seedId: useDomainStore.getState().seeds.selectedId || undefined,
      seedData: processedSeedData,
      streamingCallback: async (chunk: string) => {
        if (chunk.trim()) {
          await streamingCallback?.(chunk);
        }
      },
      tools,
      onToolCall,
      signal,
    });

    const perfResult = performanceMonitor.endRequest(perfMetrics, true);

    return {
      ...result,
      metadata: {
        ...result.metadata,
        performance: perfResult,
        language: selectedLanguage,
        tokensEstimated: estimateTokens(result.response),
      },
    };

  } catch (error) {
    console.error('[LLM] Generation failed:', error instanceof Error ? error.message : 'unknown error');
    performanceMonitor.endRequest(perfMetrics, false);
    throw error;
  }
};
