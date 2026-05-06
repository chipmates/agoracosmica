// client/src/services/llm/llmService.ts
// Provider-agnostic LLM service (OpenAI-compatible API)
// Supports: OpenRouter (BYOK), Nebius (free-tier via proxy)

import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

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
}

class LLMService {
  private baseURL = 'https://openrouter.ai/api/v1';
  private referer = 'https://agoracosmica.org';
  private appName = 'Agora Cosmica';

  /**
   * Validate API key format
   * OpenRouter keys start with sk-or-v1-
   */
  private isValidKeyFormat(apiKey: string): boolean {
    return /^sk-or-v1-[a-f0-9]{64}$/.test(apiKey);
  }

  /**
   * Validate API key by listing models
   */
  async validateKey(apiKey: string): Promise<boolean> {
    const isValidFormat = this.isValidKeyFormat(apiKey);

    if (!isValidFormat) {
      return false;
    }

    try {
      const models = await this.getModels(apiKey);
      return Array.isArray(models) && models.length > 0;
    } catch (error) {
      console.error('[LLM Service] Key validation failed:', error);
      return false;
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
      zdr
    } = options;

    try {
      return await this._makeRequest({ messages, apiKey, model, temperature, maxTokens, streamCallback, tools, onToolCall, signal, zdr });
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
        return await this._makeRequest({ messages, apiKey, model: fallbackModel, temperature, maxTokens, streamCallback, tools, onToolCall, signal, zdr });
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
  }): Promise<{ response: string; metadata: any }> {
    const { messages, apiKey, model, temperature, maxTokens, streamCallback, tools, onToolCall, signal, zdr } = options;

    const requestBody: LLMRequest = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      // Persona-collapse mitigation for figure impersonation (deep-research-persona-collapse).
      // Qwen3-235B research: 1.6-2.1× diversity gain, no quality loss.
      presence_penalty: 1.5,
      stream: !!streamCallback
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    if (zdr) {
      requestBody.provider = { zdr: true, data_collection: 'deny' };
    }

    const response = await fetchWithTimeout(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': this.referer,
        'X-Title': this.appName
      },
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
      throw this.handleError(error, response.status);
    }

    if (streamCallback) {
      return this.handleStreamingResponse(response, streamCallback, onToolCall);
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

    return {
      response: data.choices[0].message.content || '',
      metadata: {
        model: data.model,
        usage: data.usage,
        provider: 'openrouter'
      }
    };
  }

  private async handleStreamingResponse(
    response: Response,
    callback: (chunk: string) => void | Promise<void>,
    onToolCall?: (toolCall: { name: string; arguments: string; id?: string }) => void
  ): Promise<{ response: string; metadata: any }> {
    if (!response.body) {
      throw new LLMApiError('Streaming response has no body', 500);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';

    const toolCalls = new Map<number, { name: string; arguments: string; id?: string }>();

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
              const delta = data.choices[0]?.delta;

              const content = delta?.content || '';
              if (content) {
                fullResponse += content;
                const result = callback(content);
                if (result instanceof Promise) {
                  await result;
                }
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
          const content = data.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            const result = callback(content);
            if (result instanceof Promise) await result;
          }
        } catch {
          // Incomplete trailing data — ignore
        }
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
      metadata: { provider: 'openrouter', streaming: true }
    };
  }

  private handleError(error: LLMErrorResponse, status: number): LLMApiError {
    const message = error.error?.message || 'Unknown error';

    switch (status) {
      case 401:
        return new LLMApiError('Invalid API key. Please check your OpenRouter key.', status);
      case 402:
        return new LLMApiError('Insufficient credits. Please add credits to your OpenRouter account.', status);
      case 429:
        return new LLMApiError('Rate limit exceeded. Please wait a moment and try again.', status);
      case 503:
        return new LLMApiError('Service temporarily unavailable. Please try again.', status);
      default:
        return new LLMApiError(`LLM error: ${message}`, status);
    }
  }

  async getModels(apiKey: string): Promise<any[]> {
    const response = await fetchWithTimeout(`${this.baseURL}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
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
