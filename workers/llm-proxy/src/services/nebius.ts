// SSE pass-through proxy to Nebius Token Factory (EU)
//
// One dispatch path for every generating route: per-model request shaping, an
// availability fallback on upstream error or a stalled first token, and a usage
// tap that feeds the spend governor. The stream reaching the client is the
// provider's own bytes, with nothing added and nothing reordered.

import { LLM_CONFIG, TTFT_FALLBACK_MS, type ServingModel } from '../config';
import type { TokenUsage } from './spendGovernor';
import type { Env, ChatMessage, ToolDefinition } from '../utils/types';

export type FallbackReason = 'upstream_error' | 'latency';

export interface DispatchOptions {
  systemPrompt: string;
  messages: ChatMessage[];
  env: Env;
  /** The model to ask first. */
  model: ServingModel;
  /** Retry target on error or stall. Omit for no availability fallback. */
  fallback?: ServingModel;
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  /** Send the model's persona-collapse penalty. /v1/chat only. */
  usePresencePenalty?: boolean;
  /** Appended after the visitor messages, e.g. the council safety reminder. */
  trailingSystemMessage?: string;
  /** Called once per upstream response that reports usage. */
  onUsage?: (model: ServingModel, usage: TokenUsage) => void;
}

export interface DispatchResult {
  ok: boolean;
  status: number;
  stream: ReadableStream<Uint8Array> | null;
  /** Ready-made client response when the dispatch failed. */
  error?: Response;
  /** The model that actually answered. */
  served: ServingModel;
  fallbackReason?: FallbackReason;
}

export async function dispatchToNebius(options: DispatchOptions): Promise<DispatchResult> {
  const { model, fallback } = options;
  const canFallBack = !!fallback && fallback.id !== model.id;

  const first = await callModel(model, options, canFallBack);
  if (first.ok) {
    return { ok: true, status: 200, stream: first.stream, served: model };
  }

  if (!canFallBack || !fallback) {
    return { ok: false, status: first.status, stream: null, error: upstreamError(first.status), served: model };
  }

  const second = await callModel(fallback, options, false);
  if (second.ok) {
    return {
      ok: true,
      status: 200,
      stream: second.stream,
      served: fallback,
      fallbackReason: first.reason,
    };
  }

  return { ok: false, status: second.status, stream: null, error: upstreamError(second.status), served: fallback };
}

type Attempt =
  | { ok: true; stream: ReadableStream<Uint8Array> }
  | { ok: false; status: number; reason: FallbackReason };

/**
 * One upstream call. With a fallback available, the first token has a deadline:
 * the client has seen nothing yet, so a stalled attempt can be abandoned and
 * re-issued invisibly.
 */
async function callModel(
  model: ServingModel,
  options: DispatchOptions,
  withDeadline: boolean,
): Promise<Attempt> {
  const { env, onUsage } = options;
  const meter = !!onUsage && model.metered;

  const llmMessages: Array<{ role: string; content: string }> = [
    { role: 'system', content: options.systemPrompt },
    ...options.messages.map(m => ({ role: m.role, content: m.content })),
  ];
  if (options.trailingSystemMessage) {
    llmMessages.push({ role: 'system', content: options.trailingSystemMessage });
  }

  const requestBody: Record<string, unknown> = {
    model: model.id,
    messages: llmMessages,
    temperature: options.temperature ?? LLM_CONFIG.DEFAULT_TEMPERATURE,
    max_tokens: options.maxTokens ?? LLM_CONFIG.MAX_OUTPUT_TOKENS,
    stream: true,
    ...model.extras,
  };

  if (options.usePresencePenalty) {
    requestBody.presence_penalty = model.chatPresencePenalty;
  }
  if (options.tools && options.tools.length > 0) {
    requestBody.tools = options.tools;
  }
  // Usage frames ride the metered stream only, so the unmetered wire format is
  // untouched. Clients ignore the trailing frame (it carries no choices).
  if (meter) {
    requestBody.stream_options = { include_usage: true };
  }

  const controller = new AbortController();
  let response: Response;
  try {
    response = await fetch(`${env.NEBIUS_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.NEBIUS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    console.error(`[Nebius] ${model.key} request failed: ${(err as Error).message}`);
    return { ok: false, status: 502, reason: 'upstream_error' };
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Nebius] ${model.key} ${response.status}: ${errorText.slice(0, 500)}`);
    return { ok: false, status: response.status === 429 ? 429 : 502, reason: 'upstream_error' };
  }

  if (!response.body) {
    return { ok: false, status: 502, reason: 'upstream_error' };
  }

  let stream = response.body;
  if (withDeadline) {
    const started = await openWithDeadline(stream, controller);
    if (!started) {
      console.warn(`[Nebius] ${model.key} produced no first token within ${TTFT_FALLBACK_MS}ms`);
      return { ok: false, status: 504, reason: 'latency' };
    }
    stream = started;
  }

  return { ok: true, stream: meter ? tapUsage(stream, model, onUsage!) : stream };
}

/**
 * Wait for the first chunk, then hand back a stream that replays it. Returns
 * null when the deadline passes first, having aborted the upstream request.
 */
async function openWithDeadline(
  source: ReadableStream<Uint8Array>,
  controller: AbortController,
): Promise<ReadableStream<Uint8Array> | null> {
  const reader = source.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<'deadline'>(resolve => {
    timer = setTimeout(() => resolve('deadline'), TTFT_FALLBACK_MS);
  });

  const outcome = await Promise.race([reader.read(), deadline]);
  if (timer !== undefined) clearTimeout(timer);

  if (outcome === 'deadline') {
    controller.abort();
    void reader.cancel().catch(() => {});
    return null;
  }

  const first = outcome as ReadableStreamReadResult<Uint8Array>;
  return new ReadableStream<Uint8Array>({
    start(target) {
      if (first.done) {
        target.close();
        return;
      }
      target.enqueue(first.value!);
    },
    async pull(target) {
      const { value, done } = await reader.read();
      if (done) {
        target.close();
        return;
      }
      target.enqueue(value!);
    },
    cancel(reason) {
      void reader.cancel(reason).catch(() => {});
    },
  });
}

/**
 * Pass every byte through untouched while summing the usage frames. A client
 * that disconnects mid-stream leaves the turn uncounted, so the counter can
 * only ever undercount.
 */
function tapUsage(
  source: ReadableStream<Uint8Array>,
  model: ServingModel,
  onUsage: (model: ServingModel, usage: TokenUsage) => void,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = '';
  let promptTokens = 0;
  let completionTokens = 0;
  let seen = false;

  const read = (line: string): void => {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') return;
    try {
      const usage = (JSON.parse(line.slice(6)) as { usage?: Record<string, unknown> }).usage;
      if (usage && typeof usage.prompt_tokens === 'number') {
        promptTokens += usage.prompt_tokens;
        completionTokens += typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0;
        seen = true;
      }
    } catch {
      // Not a complete JSON frame yet
    }
  };

  return source.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) read(line);
    },
    flush() {
      read(buffer);
      if (seen) onUsage(model, { promptTokens, completionTokens });
    },
  }));
}

function upstreamError(status: number): Response {
  const outward = status === 429 ? 429 : 502;
  return new Response(
    JSON.stringify({
      error: outward === 429
        ? 'LLM provider rate limited. Please try again in a moment.'
        : 'LLM service temporarily unavailable. Please try again.',
    }),
    { status: outward, headers: { 'Content-Type': 'application/json' } }
  );
}
