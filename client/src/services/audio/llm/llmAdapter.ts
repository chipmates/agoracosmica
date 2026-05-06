// client/src/services/audio/llm/llmAdapter.ts
// Adapter wrapping llmService (OpenRouter BYOK) for the audio pipeline

import { llmService } from '../../llm/llmService';
import { keyStorage } from '../../storage/keyStorageService';
import { LLM_SERVICES } from '../config/serviceConfig';
import {
  TextChunker,
  validateResponse,
  performanceMonitor
} from './llmUtils';
import type { Message, LLMResponse } from './index';

// ============================================
// Type Definitions
// ============================================

interface SeedData {
  mode?: string;
  title?: string;
  description?: string;
  whySelected?: string[];
  importance?: string[];
  [key: string]: any;
}

interface LLMAdapterOptions {
  messages: Message[];
  instructions: string;
  seedData?: SeedData | null;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  streamingCallback?: (chunk: string) => Promise<void>;
  languageId?: string;
  tools?: Array<{ type: string; function: { name: string; description: string; parameters: any } }>;
  onToolCall?: (toolCall: { name: string; arguments: string; id?: string }) => void;
  signal?: AbortSignal;
  zdr?: boolean;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Process seed data and instructions into system message
 */
const createSystemMessage = (instructions: string, seedData: SeedData | null): string => {
  // Remove trailing context block if present
  if (instructions.includes('\n\nContext for current interaction:')) {
    instructions = instructions.split('\n\nContext for current interaction:')[0];
  }

  if (!seedData) return instructions;

  try {
    // If instructionProcessor already injected seed data via <seed-data> block, skip re-injection
    if (instructions.includes('<seed-data>')) {
      return instructions;
    }

    // Legacy path: instructions without V3 {{SEED_DATA}} templates
    const cleanSeed = {
      title: seedData.title || '',
      description: seedData.description || '',
      whySelected: Array.isArray(seedData.whySelected) ? seedData.whySelected.filter(Boolean) : [],
      importance: Array.isArray(seedData.importance) ? seedData.importance.filter(Boolean) : []
    };

    const replacementData = `
Current Seed Focus:
Title: ${cleanSeed.title}
Description: ${cleanSeed.description}
Key Points of Importance:
${cleanSeed.importance.map(point => `- ${point}`).join('\n')}
Selected Because:
${cleanSeed.whySelected.map(reason => `- ${reason}`).join('\n')}
    `.trim();

    let processedInstructions: string;

    if (!instructions.includes('Context for current interaction:')) {
      processedInstructions = `${instructions}\n\nContext for current interaction:\n${replacementData}`;
    } else {
      processedInstructions = instructions;
    }

    // Remove trailing context blocks
    if (processedInstructions.includes('\n\nContext for current interaction:')) {
      const parts = processedInstructions.split('\n\nContext for current interaction:');
      processedInstructions = parts[0] + '\n\nContext for current interaction:' + parts[1];
    }

    return processedInstructions;
  } catch (error) {
    console.error('[LLMAdapter] Error processing seed data:', error);
    return instructions;
  }
};

/**
 * Convert messages to LLM format and prepend system message
 */
const convertMessages = (
  messages: Message[],
  systemMessage: string
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> => {
  return [
    { role: 'system', content: systemMessage },
    ...messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))
  ];
};

// ============================================
// Main Export - BYOK Adapter (OpenRouter)
// ============================================

/**
 * BYOK adapter: uses user's OpenRouter API key
 */
export const generateBYOKResponse = async ({
  messages,
  instructions,
  seedData = null,
  model = LLM_SERVICES.OPENROUTER.models.QWEN3_235B,
  maxTokens = 16000,
  temperature = 1,
  streamingCallback,
  languageId = 'english',
  tools,
  onToolCall,
  signal,
  zdr
}: LLMAdapterOptions): Promise<LLMResponse> => {
  const perfMetrics = performanceMonitor.startRequest();

  try {
    const apiKey = await keyStorage.getKey('openrouter');
    if (!apiKey) {
      throw new Error('OpenRouter API key not found. Please add your key in settings.');
    }

    const systemMessage = createSystemMessage(instructions, seedData);
    const formattedMessages = convertMessages(messages, systemMessage);

    const chunker = new TextChunker(languageId);
    let responseText = '';

    const result = await llmService.chat({
      messages: formattedMessages,
      apiKey,
      model,
      temperature,
      maxTokens,
      streamCallback: streamingCallback ? async (chunk: string) => {
        responseText += chunk;
        await chunker.processChunk(chunk, streamingCallback);
      } : undefined,
      fallbackModel: undefined,
      tools,
      onToolCall,
      signal,
      zdr
    });

    if (!streamingCallback) {
      responseText = result.response;
    } else {
      await chunker.finish(streamingCallback);
    }

    const response: LLMResponse = {
      response: responseText,
      metadata: {
        model,
        provider: 'openrouter',
        timestamp: new Date().toISOString(),
        performanceMetrics: performanceMonitor.endRequest(perfMetrics, true),
        ...result.metadata
      }
    };

    return validateResponse(response);

  } catch (error) {
    console.error('[LLMAdapter] Error generating BYOK response:', error);
    performanceMonitor.endRequest(perfMetrics, false);
    throw error;
  }
};

