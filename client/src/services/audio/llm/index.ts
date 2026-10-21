// src/services/audio/llm/index.ts
// LLM routing: OpenRouter BYOK → free-tier proxy (Nebius via CF Worker)

import { generateBYOKResponse } from './llmAdapter';
import { generateFreeTierResponse } from '../../proxy/freeTierAdapter';
import { keyStorage } from '../../storage/keyStorageService';
import { useDomainStore } from '../../../stores/domainStore';
import { LLM_SERVICES } from '../config/serviceConfig';
import seedDataProcessor from '../../seedDataProcessor';
import { applyCarriedEntry, applyAsideRules, type CarriedEntry } from '../instructionProcessor';
import {
  validateAndPreprocessMessages,
  performanceMonitor,
  estimateTokens,
  TextChunker
} from './llmUtils';
import { loadServiceConfig } from '../config/serviceConfig';
import { isSelfHost } from '../../../config/deployment';
import { ensureFreeTierAllowed, OwnKeyRejectedError } from '../../llm/ownKeyConsent';

// ============================================
// Type Definitions
// ============================================

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * What a chat LLM request is: the auto greeting that opens a chat, a turn the
 * visitor typed, or the carried question they chose before the conversation
 * opened. Rides along on the request as a label; it never changes the prompt or
 * the routing (the carried question's `entry` field does that).
 */
export type ChatTurnKind = 'greeting' | 'turn' | 'prefilled' | 'aside';

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
  turnKind?: ChatTurnKind;
  /**
   * Set when the send carries a question the visitor chose before the
   * conversation opened. Changes how the figure opens, so unlike turnKind it
   * is a behavior trigger, not a label.
   */
  entry?: CarriedEntry;
  /** The teaching that grounds the carried question. null suppresses it. */
  anchorSeedId?: string | number | null;
  /**
   * The mode this request runs in. Given, it wins over the store: an aside is
   * generated while a story player is on screen, where the store's mode
   * describes the room, not the request.
   */
  mode?: string;
  /**
   * Set when the question was asked from a paused chapter. Like `entry` this is
   * a behavior trigger, not a label: it adds the aside rules to the prompt.
   */
  aside?: boolean;
  /**
   * The conversation a yes to the free tier covers, once a stored key was
   * rejected. Defaults to the open chat thread.
   */
  consentScope?: string;
  /**
   * False for callers with a free-tier route of their own (councils,
   * summaries): a rejected key then throws OwnKeyRejectedError instead of
   * turning into a chat request.
   */
  freeTierFallback?: boolean;
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
  signal,
  turnKind,
  entry,
  anchorSeedId,
  mode,
  aside,
  consentScope,
  freeTierFallback = true
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
      hasUsableProvider = await keyStorage.hasUsableKey('openrouter');
    }

    if (hasUsableProvider) {
      // BYOK / Local Mode path
      try {
        // These requests never reach the worker, so the carried-question
        // directive is applied here instead of in the proxy's prompt loader.
        const directiveOptions = {
          entry,
          aside,
          anchorSeedId,
          mode: mode ?? useDomainStore.getState().mode.selected ?? undefined,
          userMessageCount: processedMessages.filter(m => m.role === 'user').length,
        };
        const byokInstructions = applyAsideRules(
          applyCarriedEntry(instructions, directiveOptions),
          directiveOptions,
        );
        const result = await generateBYOKResponse({
          messages: processedMessages,
          instructions: byokInstructions,
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
        // A Local Mode endpoint failing surfaces as is: the visitor chose to run
        // locally, so nothing moves to OpenRouter or to the free tier.
        if (providerKind === 'custom-openai') {
          throw error;
        }
        if ((error?.status === 401 || error?.status === 403) && !isSelfHost) {
          console.warn('[LLM] BYOK key rejected (HTTP', error.status, '), marking it invalid');
          await keyStorage.markInvalid('openrouter');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('byok-key-changed', { detail: { hasKey: false } }));
          }
          if (!freeTierFallback) {
            throw new OwnKeyRejectedError(null, error.status);
          }
          // On to the free tier below, which asks the visitor first.
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

    if (!freeTierFallback) {
      throw new OwnKeyRejectedError(null);
    }

    // A stored key that was rejected: the conversation reaches our servers only
    // after the visitor's yes. Without a stored key this returns at once.
    await ensureFreeTierAllowed({
      kind: 'chat',
      scope: consentScope ?? `chat:${useDomainStore.getState().conversation?.historyKey ?? 'none'}`,
      signal,
    });

    // ============================================
    // Free-tier path: Nebius via Cloudflare Worker proxy (WP6)
    // ============================================

    const selectedFigureIdForFree = useDomainStore.getState().figures.selectedId;
    if (!selectedFigureIdForFree) {
      throw new Error('No figure selected');
    }

    // Map ConversationMode enum to instruction file mode
    // 'challenge' → 'seed_challenge' (matches instruction file naming)
    const requestMode = mode || useDomainStore.getState().mode.selected || 'free_conversation';
    const currentMode = requestMode === 'challenge' ? 'seed_challenge' : requestMode;

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
      // The selected seed doubles as the anchor: an ask-intent arrival has
      // its question's seed on record, a default arrival sits on seed 1. A
      // carried question that names no teaching of its own suppresses the
      // anchor instead, because a wrong teaching grounds an answer worse than
      // none does.
      const anchor = entry === 'carried'
        ? anchorSeedId
        : useDomainStore.getState().seeds.selectedId;
      processedSeedData = seedDataProcessor.processFreeConversationData(
        allSeeds, figureMeta, selectedLanguage, anchor ?? undefined
      );
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
      turnKind,
      entry,
      aside,
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
