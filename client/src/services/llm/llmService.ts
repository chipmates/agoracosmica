// client/src/services/llm/llmService.ts
// Provider-agnostic LLM service (OpenAI-compatible API)
// Supports: OpenRouter (BYOK), Nebius (free-tier via proxy), any OpenAI-compatible local server

import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import {
  type ProviderConfig,
  defaultOpenRouterConfig,
  OPENROUTER_REFERER,
  OPENROUTER_APP_NAME,
} from './types';
import { createThinkingTagFilter, stripThinkingTagsFromText } from '../../utils/thinkingTagStripper';

interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  tools?: Array<{ type: string; function: { name: string; description: string; parameters: any } }>;
  provider?: {
    zdr?: boolean;
    data_collection?: string;
  };
}

interface LLMErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

export class LLMApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'LLMApiError';
  }
}

const isRetriableStatus = (status: number): boolean =>
  status === 429 || status === 503;

// Strict chat templates (LM Studio + Smoffyy Qwen3.6 revised, some llama.cpp
// variants) reject same-role runs with "No user query found in messages."
// Story mode legitimately produces assistant+assistant runs (story chunk +
// prism context + history). Lenient providers tolerate them; we merge here so
// the wire payload alternates regardless of provider strictness.
const mergeConsecutiveSameRole = (messages: LLMMessage[]): LLMMessage[] => {
  if (messages.length < 2) return messages;
  const merged: LLMMessage[] = [];
  for (const msg of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      merged[merged.length - 1] = {
        role: last.role,
        content: `${last.content}\n\n${msg.content}`,
      };
    } else {
      merged.push({ role: msg.role, content: msg.content });
    }
  }
  return merged;
};

interface ChatOptions {
  messages: LLMMessage[];
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  streamCallback?: (chunk: string) => void;
  fallbackModel?: string;
  tools?: LLMRequest['tools'];
  onToolCall?: (toolCall: { name: string; arguments: string; id?: string }) => void;
  signal?: AbortSignal;
  zdr?: boolean;
  /** Override the provider config. Defaults to OpenRouter. */
  providerConfig?: ProviderConfig;
}

class LLMService {
  /**
   * Validate API key format. Provider-conditional:
   *   - openrouter:    sk-or-v1-<64-hex>
   *   - custom-openai: anything non-empty (servers often need no key at all)
   */
  private isValidKeyFormat(apiKey: string, providerConfig: ProviderConfig): boolean {
    if (providerConfig.kind === 'custom-openai') {
      // For custom endpoints we accept either an empty key (Ollama, LM Studio
      // with no auth) or any non-empty string the user types in.
      return true;
    }
    return /^sk-or-v1-[a-f0-9]{64}$/.test(apiKey);
  }

  /**
   * Validate API key.
   *   - openrouter: format check + `/models` round-trip.
   *   - custom-openai: `/models` reachability probe (5 s timeout).
   */
  async validateKey(apiKey: string, providerConfig: ProviderConfig = defaultOpenRouterConfig): Promise<boolean> {
    if (providerConfig.kind === 'openrouter') {
      const isValidFormat = this.isValidKeyFormat(apiKey, providerConfig);
      if (!isValidFormat) return false;
    }

    try {
      const models = await this.getModels(apiKey, providerConfig);
      return Array.isArray(models) && models.length > 0;
    } catch (error) {
      console.error('[LLM Service] Key validation failed:', error);
      return false;
    }
  }

  /**
   * Probe a custom OpenAI-compatible endpoint and return its model list.
   * Used by the settings UI to surface "Detected: model1, model2, ..." and to
   * gate the Save button.
   */
  async probeEndpoint(
    baseURL: string,
    apiKey?: string,
  ): Promise<{ reachable: boolean; models: string[]; error?: string }> {
    const normalized = baseURL.replace(/\/+$/, '');
    try {
      const headers: Record<string, string> = {};
      if (apiKey && apiKey.trim()) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }
      const response = await fetchWithTimeout(`${normalized}/models`, {
        headers,
        timeoutMs: 5_000,
      });
      if (!response.ok) {
        return { reachable: false, models: [], error: `HTTP ${response.status}` };
      }
      const data = await response.json();
      const models = Array.isArray(data?.data)
        ? data.data.map((m: any) => String(m?.id || '')).filter(Boolean)
        : [];
      return { reachable: true, models };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      return { reachable: false, models: [], error: message };
    }
  }

  /**
   * Chat completion with optional fallback model on retriable errors (429, 503)
   */
  async chat(options: ChatOptions): Promise<{ response: string; metadata: any }> {
    const {
      messages,
      apiKey,
      model = 'qwen/qwen3-235b-a22b-2507',
      temperature = 0.7,
      maxTokens = 2000,
      streamCallback,
      fallbackModel,
      tools,
      onToolCall,
      signal,
      zdr,
      providerConfig = defaultOpenRouterConfig,
    } = options;

    try {
      return await this._makeRequest({ messages, apiKey, model, temperature, maxTokens, streamCallback, tools, onToolCall, signal, zdr, providerConfig });
    } catch (error) {
      if (
        fallbackModel &&
        fallbackModel !== model &&
        error instanceof LLMApiError &&
        isRetriableStatus(error.status)
      ) {
        console.warn(
          `[LLM] ${error.status} on ${model}, retrying with ${fallbackModel} in 2s`
        );
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 2000);
          signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
        });
        return await this._makeRequest({ messages, apiKey, model: fallbackModel, temperature, maxTokens, streamCallback, tools, onToolCall, signal, zdr, providerConfig });
      }
      throw error;
    }
  }

  private async _makeRequest(options: {
    messages: LLMMessage[];
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
    streamCallback?: (chunk: string) => void;
    tools?: LLMRequest['tools'];
    onToolCall?: (toolCall: { name: string; arguments: string; id?: string }) => void;
    signal?: AbortSignal;
    zdr?: boolean;
    providerConfig: ProviderConfig;
  }): Promise<{ response: string; metadata: any }> {
    const { messages, apiKey, model, temperature, maxTokens, streamCallback, tools, onToolCall, signal, zdr, providerConfig } = options;

    const requestBody: LLMRequest = {
      model,
      messages: mergeConsecutiveSameRole(messages),
      temperature,
      max_tokens: maxTokens,
      stream: !!streamCallback
    };

    if (providerConfig.sendQwen3PresencePenalty) {
      // Persona-collapse mitigation for figure impersonation (deep-research-persona-collapse).
      // Qwen3-235B research: 1.6-2.1× diversity gain, no quality loss.
      // Disabled for custom-openai providers: smaller local models repetition-collapse under it.
      requestBody.presence_penalty = 1.5;
    }

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    if (zdr && providerConfig.sendOpenRouterProviderEnvelope) {
      requestBody.provider = { zdr: true, data_collection: 'deny' };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    if (providerConfig.sendOpenRouterHeaders) {
      headers['HTTP-Referer'] = OPENROUTER_REFERER;
      headers['X-Title'] = OPENROUTER_APP_NAME;
    }

    const response = await fetchWithTimeout(`${providerConfig.baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal,
      timeoutMs: 30_000,
    });

    if (!response.ok) {
      let error: LLMErrorResponse;
      try {
        error = await response.json();
      } catch {
        const text = await response.text().catch(() => '');
        error = { error: { message: text || `HTTP ${response.status}`, type: 'api_error', code: String(response.status) } };
      }
      throw this.handleError(error, response.status, providerConfig);
    }

    if (streamCallback) {
      return this.handleStreamingResponse(response, streamCallback, onToolCall, providerConfig);
    }

    const data = await response.json();

    if (onToolCall && data.choices[0]?.message?.tool_calls) {
      for (const tc of data.choices[0].message.tool_calls) {
        onToolCall({
          name: tc.function.name,
          arguments: tc.function.arguments,
          id: tc.id,
        });
      }
    }

    const rawContent = data.choices[0].message.content || '';
    return {
      response: stripThinkingTagsFromText(rawContent),
      metadata: {
        model: data.model,
        usage: data.usage,
        provider: providerConfig.kind,
      }
    };
  }

  private async handleStreamingResponse(
    response: Response,
    callback: (chunk: string) => void | Promise<void>,
    onToolCall: ((toolCall: { name: string; arguments: string; id?: string }) => void) | undefined,
    providerConfig: ProviderConfig
  ): Promise<{ response: string; metadata: any }> {
    if (!response.body) {
      throw new LLMApiError('Streaming response has no body', 500);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';

    const toolCalls = new Map<number, { name: string; arguments: string; id?: string }>();
    const thinkFilter = createThinkingTagFilter();

    const emit = async (rawContent: string) => {
      if (!rawContent) return;
      // Always-on `<think>` strip — never let thinking blocks reach the UI.
      const visible = thinkFilter.filter(rawContent);
      if (visible) {
        fullResponse += visible;
        const result = callback(visible);
        if (result instanceof Promise) await result;
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!; // Keep incomplete last line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));

              // Some servers (LM Studio with strict chat templates, Ollama)
              // stream JSON error payloads with HTTP 200 instead of HTTP error
              // codes. Surface them on the console rather than letting the
              // parser blow up on a missing `choices` array.
              if (data.error) {
                console.warn('[LLM] Stream error payload:', data.error);
                continue;
              }

              const delta = data.choices?.[0]?.delta;

              const content = delta?.content || '';
              if (content) {
                await emit(content);
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!toolCalls.has(idx)) {
                    toolCalls.set(idx, { name: '', arguments: '', id: undefined });
                  }
                  const acc = toolCalls.get(idx)!;
                  if (tc.id) acc.id = tc.id;
                  if (tc.function?.name) acc.name = tc.function.name;
                  if (tc.function?.arguments) acc.arguments += tc.function.arguments;
                }
              }
            } catch (e) {
              console.warn('[LLM] Failed to parse SSE line:', e);
            }
          }
        }
      }
      // Flush any remaining buffer content after stream ends
      if (buffer.trim() && buffer.startsWith('data: ') && buffer !== 'data: [DONE]') {
        try {
          const data = JSON.parse(buffer.slice(6));
          const content = data.choices?.[0]?.delta?.content || '';
          if (content) {
            await emit(content);
          }
        } catch {
          // Incomplete trailing data, ignore
        }
      }
      // Flush the think-filter's tail (any non-stripping buffered text).
      const tail = thinkFilter.flush();
      if (tail) {
        fullResponse += tail;
        const result = callback(tail);
        if (result instanceof Promise) await result;
      }
    } finally {
      reader.releaseLock();
    }

    if (onToolCall && toolCalls.size > 0) {
      for (const [, tc] of toolCalls) {
        if (tc.name) {
          onToolCall(tc);
        }
      }
    }

    return {
      response: fullResponse,
      metadata: { provider: providerConfig.kind, streaming: true }
    };
  }

  private handleError(error: LLMErrorResponse, status: number, providerConfig: ProviderConfig): LLMApiError {
    const message = error.error?.message || 'Unknown error';
    const isOpenRouter = providerConfig.kind === 'openrouter';

    switch (status) {
      case 401:
        return new LLMApiError(
          isOpenRouter
            ? 'Invalid API key. Please check your OpenRouter key.'
            : 'Endpoint returned 401. Check the API key, or leave it blank if your local server does not require one.',
          status,
        );
      case 402:
        return new LLMApiError(
          isOpenRouter
            ? 'Insufficient credits. Please add credits to your OpenRouter account.'
            : `Endpoint returned 402: ${message}`,
          status,
        );
      case 404:
        return new LLMApiError(
          isOpenRouter
            ? `Model not found: ${message}`
            : 'Endpoint returned 404. Check the model name matches what your server has loaded.',
          status,
        );
      case 429:
        return new LLMApiError('Rate limit exceeded. Please wait a moment and try again.', status);
      case 503:
        return new LLMApiError(
          isOpenRouter
            ? 'Service temporarily unavailable. Please try again.'
            : 'Endpoint returned 503. The model may still be loading on your local server.',
          status,
        );
      default:
        return new LLMApiError(`LLM error: ${message}`, status);
    }
  }

  async getModels(apiKey: string, providerConfig: ProviderConfig = defaultOpenRouterConfig): Promise<any[]> {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const response = await fetchWithTimeout(`${providerConfig.baseURL}/models`, {
      headers,
      timeoutMs: 10_000,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }

    const data = await response.json();
    return data.data;
  }
}

export const llmService = new LLMService();
