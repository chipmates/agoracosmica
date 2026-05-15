// Free-tier LLM adapter: proxies chat through Cloudflare Worker → Nebius
// Mirrors llmAdapter.ts pattern but sends figureId + mode instead of instructions

import { getSessionToken, invalidateToken } from './sessionManager';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import {
  TextChunker,
  validateResponse,
  performanceMonitor,
} from '../audio/llm/llmUtils';
import type { Message, LLMResponse } from '../audio/llm/index';
import { useDomainStore } from '../../stores/domainStore';

const FREE_TIER_API_URL = import.meta.env.VITE_FREE_TIER_API_URL || '';

/** Build request headers including JSON content-type and bearer auth. */
function buildAuthHeaders(token: string, includeContentType = true): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
  };
  if (includeContentType) headers['Content-Type'] = 'application/json';
  return headers;
}

/**
 * Structured error from the free-tier worker. Preserves HTTP status, the
 * worker's `reason` field (e.g. 'global', 'per_ip', 'content_safety'), and
 * the full parsed body so the UI mapper can branch on specifics.
 */
export class FreeTierError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly reason?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'FreeTierError';
  }
}

function reasonFromBody(status: number, body: Record<string, unknown> | null): string | undefined {
  if (!body) return undefined;
  if (typeof body.reason === 'string') return body.reason;
  // 422 content_safety: error field carries the reason; responseType ('crisis'|'policy') refines it
  if (status === 422 && body.error === 'content_safety') {
    const refined = typeof body.responseType === 'string' ? body.responseType : 'policy';
    return `content_safety:${refined}`;
  }
  return undefined;
}

async function parseErrorBody(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return await response.clone().json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Extract X-Quota-* headers from worker response and update Zustand store */
function updateQuotaFromHeaders(response: Response): void {
  const used = response.headers.get('X-Quota-Daily-Used');
  const limit = response.headers.get('X-Quota-Daily-Limit');
  const resetsAt = response.headers.get('X-Quota-Resets-At');
  if (used && limit) {
    useDomainStore.getState().setQuota(
      parseInt(used, 10),
      parseInt(limit, 10),
      resetsAt || ''
    );
  }
}

/** Update council quota from X-Council-* headers (set on every successful /v1/council response) */
function updateCouncilQuotaFromHeaders(response: Response): void {
  const used = response.headers.get('X-Council-Daily-Used');
  const limit = response.headers.get('X-Council-Daily-Limit');
  if (used && limit) {
    useDomainStore.getState().setEndpointQuota('council', parseInt(used, 10), parseInt(limit, 10));
  }
}

/** Update summary quota from X-Summary-* headers (set on every successful /v1/summary response) */
function updateSummaryQuotaFromHeaders(response: Response): void {
  const used = response.headers.get('X-Summary-Daily-Used');
  const limit = response.headers.get('X-Summary-Daily-Limit');
  if (used && limit) {
    useDomainStore.getState().setEndpointQuota('summary', parseInt(used, 10), parseInt(limit, 10));
  }
}

/** Fetch current quota from /v1/quota (used on app init for free-tier users) */
export async function fetchQuota(): Promise<void> {
  const doFetch = async (token: string) => fetchWithTimeout(`${FREE_TIER_API_URL}/v1/quota`, {
    method: 'GET',
    headers: buildAuthHeaders(token, false),
    timeoutMs: 10_000,
  });

  try {
    let token = await getSessionToken();
    let response = await doFetch(token);

    if (response.status === 401) {
      // Token rejected (expired or IP changed) — mirror fetchWithSessionRetry's refresh
      invalidateToken();
      token = await getSessionToken();
      response = await doFetch(token);
    }

    if (response.ok) {
      const data = await response.json() as {
        daily?: { used?: number; limit?: number; resetsAt?: string };
        council?: { used?: number; limit?: number };
        summary?: { used?: number; limit?: number };
      };
      if (data.daily) {
        useDomainStore.getState().setQuota(
          data.daily.used ?? 0,
          data.daily.limit ?? 30,
          data.daily.resetsAt ?? ''
        );
      }
      if (data.council) {
        useDomainStore.getState().setEndpointQuota('council', data.council.used ?? 0, data.council.limit ?? 1);
      }
      if (data.summary) {
        useDomainStore.getState().setEndpointQuota('summary', data.summary.used ?? 0, data.summary.limit ?? 2);
      }
    }
  } catch {
    // Non-critical: counter just won't show until first message
  }
}

interface FreeTierOptions {
  messages: Message[];
  figureId: string;
  mode: string;
  language: string;
  seedId?: string;
  seedData?: any;
  streamingCallback?: (chunk: string) => Promise<void>;
  tools?: Array<{ type: string; function: { name: string; description: string; parameters: any } }>;
  onToolCall?: (toolCall: { name: string; arguments: string; id?: string }) => void;
  signal?: AbortSignal;
}

/**
 * Fetch with automatic session retry on 401.
 * If the server rejects our JWT (expired, IP changed), invalidate the token,
 * get a fresh session via Turnstile, and retry once.
 */
type RateLimitEndpoint = 'chat' | 'council' | 'summary';

async function fetchWithSessionRetry(
  url: string,
  body: Record<string, unknown> | FormData,
  signal?: AbortSignal,
  endpoint?: RateLimitEndpoint,
): Promise<Response> {
  const token = await getSessionToken();

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
    signal,
    timeoutMs: 30_000,
  });

  if (response.status === 401) {
    // Token rejected — invalidate and retry with fresh session
    invalidateToken();
    const freshToken = await getSessionToken();

    const retryResponse = await fetchWithTimeout(url, {
      method: 'POST',
      headers: buildAuthHeaders(freshToken),
      body: JSON.stringify(body),
      signal,
      timeoutMs: 30_000,
    });

    if (!retryResponse.ok) {
      const errBody = await parseErrorBody(retryResponse);
      throw new FreeTierError(
        (errBody?.error as string) || `Request failed: ${retryResponse.status}`,
        retryResponse.status,
        reasonFromBody(retryResponse.status, errBody),
        errBody ?? undefined,
      );
    }
    return retryResponse;
  }

  if (response.status === 429) {
    // Rate limited: parse quota, update store (so the relevant button stays gated), open modal
    const data = (await parseErrorBody(response)) ?? { error: 'Daily limit reached' };
    const quota = (data as any).quota;
    const resetsAt = quota?.resetsAt ?? '';
    const serverUsed: number | null = typeof quota?.daily?.used === 'number' ? quota.daily.used : null;
    const serverLimit: number | null = typeof quota?.daily?.limit === 'number' ? quota.daily.limit : null;
    const ep = endpoint || 'chat';
    const reason = reasonFromBody(429, data); // 'global' or 'per_ip'

    if (ep === 'chat' && serverLimit !== null) {
      useDomainStore.getState().setQuota(serverUsed ?? serverLimit, serverLimit, resetsAt);
    } else if ((ep === 'council' || ep === 'summary') && serverLimit !== null) {
      useDomainStore.getState().setEndpointQuota(ep, serverUsed ?? serverLimit, serverLimit);
    }

    // Open the rate-limit modal only for per-identity daily limits.
    // For 'global' (free-tier capacity) we surface a toast instead so the
    // BYOK upsell wording is specific to capacity, not "you've used yours".
    if (reason !== 'global') {
      useDomainStore.getState().openRateLimitModal(ep, resetsAt, serverLimit);
    }

    throw new FreeTierError(
      (data as any).error || 'Daily limit reached',
      429,
      reason,
      data,
    );
  }

  if (!response.ok) {
    const errBody = await parseErrorBody(response);
    throw new FreeTierError(
      (errBody?.error as string) || `Request failed: ${response.status}`,
      response.status,
      reasonFromBody(response.status, errBody),
      errBody ?? undefined,
    );
  }

  return response;
}

/**
 * Generate a response via the free-tier proxy (CF Worker → Nebius)
 */
export async function generateFreeTierResponse({
  messages,
  figureId,
  mode,
  language,
  seedId,
  seedData,
  streamingCallback,
  tools,
  onToolCall,
  signal,
}: FreeTierOptions): Promise<LLMResponse> {
  const perfMetrics = performanceMonitor.startRequest();

  try {
    // Build request body — no instructions/systemMessage sent from client
    // Truncate long assistant messages to stay under worker's 8000-char limit
    const truncatedCount = messages.filter(m => m.role === 'assistant' && m.content.length > 7500).length;
    if (truncatedCount > 0 && import.meta.env.DEV) {
      console.warn(`[FreeTier] Truncated ${truncatedCount} assistant message(s) to 7500 chars`);
    }

    const requestBody: Record<string, unknown> = {
      figureId,
      mode,
      language,
      messages: messages.map(m => ({
        role: m.role,
        content: m.role === 'assistant' && m.content.length > 7500
          ? m.content.slice(0, 7500) + '...'
          : m.content,
      })),
    };

    if (seedId) requestBody.seedId = seedId;
    if (seedData) requestBody.seedData = seedData;
    if (tools && tools.length > 0) requestBody.tools = tools;

    const response = await fetchWithSessionRetry(`${FREE_TIER_API_URL}/v1/chat`, requestBody, signal, 'chat');

    // Extract quota headers from response (update store for turn counter)
    updateQuotaFromHeaders(response);

    // Parse SSE stream (same pattern as llmService.ts)
    const result = await parseSSEStream(response, streamingCallback, onToolCall, language);

    const perfResult = performanceMonitor.endRequest(perfMetrics, true);

    return validateResponse({
      response: result.fullResponse,
      metadata: {
        provider: 'free-tier',
        model: 'Qwen3-235B',
        streaming: true,
        performance: perfResult,
      },
    });
  } catch (error) {
    performanceMonitor.endRequest(perfMetrics, false);
    throw error;
  }
}

// ============================================
// Free-tier Council Generation
// ============================================

interface FreeTierCouncilOptions {
  systemPrompt: string;
  messages: Message[];
  language: string;
  streamingCallback?: (chunk: string) => Promise<void>;
  signal?: AbortSignal;
}

/**
 * Generate a council response via the free-tier proxy (CF Worker → Nebius)
 * Uses /v1/council endpoint with separate 1/day rate limit
 */
export async function generateFreeTierCouncilResponse({
  systemPrompt,
  messages,
  language,
  streamingCallback,
  signal,
}: FreeTierCouncilOptions): Promise<LLMResponse> {
  const perfMetrics = performanceMonitor.startRequest();

  try {
    const requestBody = {
      systemPrompt,
      language,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    };

    const response = await fetchWithSessionRetry(`${FREE_TIER_API_URL}/v1/council`, requestBody, signal, 'council');

    updateCouncilQuotaFromHeaders(response);

    const result = await parseSSEStream(response, streamingCallback, undefined, language);

    const perfResult = performanceMonitor.endRequest(perfMetrics, true);

    return validateResponse({
      response: result.fullResponse,
      metadata: {
        provider: 'free-tier',
        model: 'Qwen3-235B',
        streaming: true,
        performance: perfResult,
      },
    });
  } catch (error) {
    performanceMonitor.endRequest(perfMetrics, false);
    throw error;
  }
}

// ============================================
// Free-tier Summary Generation
// ============================================

interface FreeTierSummaryOptions {
  figureId: string;
  seedTitle: string;
  language: string;
  history: string; // Pre-formatted conversation history
}

/**
 * Generate a summary via the free-tier proxy (CF Worker → Nebius)
 * Uses /v1/summary endpoint with separate 2/day rate limit
 */
export async function generateFreeTierSummary({
  figureId,
  seedTitle,
  language,
  history,
}: FreeTierSummaryOptions): Promise<LLMResponse> {
  const perfMetrics = performanceMonitor.startRequest();

  try {
    const requestBody = {
      figureId,
      seedTitle,
      language,
      history,
    };

    const response = await fetchWithSessionRetry(`${FREE_TIER_API_URL}/v1/summary`, requestBody, undefined, 'summary');

    updateSummaryQuotaFromHeaders(response);

    const result = await parseSSEStream(response, undefined, undefined, language);

    const perfResult = performanceMonitor.endRequest(perfMetrics, true);

    return validateResponse({
      response: result.fullResponse,
      metadata: {
        provider: 'free-tier',
        model: 'Qwen3-235B',
        streaming: false,
        performance: perfResult,
      },
    });
  } catch (error) {
    performanceMonitor.endRequest(perfMetrics, false);
    throw error;
  }
}

/**
 * Parse SSE stream from the Worker proxy (reuses llmService.ts pattern)
 */
async function parseSSEStream(
  response: Response,
  streamingCallback?: (chunk: string) => Promise<void>,
  onToolCall?: (toolCall: { name: string; arguments: string; id?: string }) => void,
  language?: string,
): Promise<{ fullResponse: string }> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let buffer = '';

  const chunker = streamingCallback ? new TextChunker(language || 'en') : null;
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
            const delta = data.choices?.[0]?.delta;

            // Text content
            const content = delta?.content || '';
            if (content) {
              fullResponse += content;
              if (chunker && streamingCallback) {
                await chunker.processChunk(content, streamingCallback);
              }
            }

            // Tool calls (same accumulation as llmService.ts)
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
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Flush remaining text in chunker
  if (chunker && streamingCallback) {
    await chunker.finish(streamingCallback);
  }

  // Fire tool call callbacks
  if (onToolCall && toolCalls.size > 0) {
    for (const [, tc] of toolCalls) {
      if (tc.name) {
        onToolCall(tc);
      }
    }
  }

  return { fullResponse };
}
