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
  performanceMonitor,
  estimateTokens,
  TextChunker
} from './llmUtils';
import { loadServiceConfig } from '../config/serviceConfig';
import { isSelfHost } from '../../../config/deployment';

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
    // Routing: BYOK (OpenRouter) OR Local Mode (custom-openai) → Free-tier (Nebius proxy)
    // ============================================

    // Check active provider:
    //   - 'openrouter': require a valid stored OpenRouter key.
    //   - 'custom-openai' (Local Mode): require a configured baseURL; key is optional.
    const serviceConfig = loadServiceConfig();
    const providerKind = serviceConfig.llm.kind ?? 'openrouter';

    let hasUsableProvider = false;
    if (providerKind === 'custom-openai') {
      hasUsableProvider = !!serviceConfig.llm.baseURL?.trim();
    } else {
      const keyMeta = await keyStorage.getKeyMetadata('openrouter');
      hasUsableProvider = keyMeta !== null && keyMeta?.valid === true;
    }

    if (hasUsableProvider) {
      // BYOK / Local Mode path
      try {
        const result = await generateBYOKResponse({
          messages: processedMessages,
          instructions,
          seedData,
          model: model || (providerKind === 'openrouter'
            ? LLM_SERVICES.OPENROUTER.models.QWEN3_235B
            : serviceConfig.llm.model),
          zdr: providerKind === 'openrouter' ? (serviceConfig.llm.zdr ?? false) : false,
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
        // Hosted build: a rejected OpenRouter key marks itself invalid and falls
        // through to the free tier. A custom-openai endpoint failing should NOT
        // fall through to OpenRouter free-tier — that would silently leak the
        // conversation to Nebius after the user explicitly chose Local Mode.
        // Surface the error instead.
        if (providerKind === 'custom-openai') {
          throw error;
        }
        if ((error?.status === 401 || error?.status === 403) && !isSelfHost) {
          console.warn('[LLM] BYOK key rejected (HTTP', error.status, ') — marking invalid, falling through to free-tier');
          await keyStorage.markInvalid('openrouter');
          // The drop to free tier is otherwise silent. Flip the AI Model badge
          // to Free (byok-key-changed) and raise a banner (byok-fell-back) so a
          // power user knows their key was rejected and this reply used free tier.
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('byok-key-changed', { detail: { hasKey: false } }));
            window.dispatchEvent(new CustomEvent('byok-fell-back'));
          }
          // Fall through to free-tier path below instead of throwing
        } else {
          throw error;
        }
      }
    }

    // Self-host / Local Mode has no free-tier proxy. Reaching here means there
    // is no usable provider; surface a clear error rather than calling a worker
    // that is not deployed. The key gate makes this unreachable in normal use.
    if (isSelfHost || providerKind === 'custom-openai') {
      throw new Error(
        providerKind === 'custom-openai'
          ? 'No custom endpoint URL configured. Open settings and set the endpoint.'
          : 'A valid OpenRouter key is required.'
      );
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
