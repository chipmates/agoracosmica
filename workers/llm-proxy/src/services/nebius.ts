// SSE pass-through proxy to Nebius Token Factory (Finland, EU)

import { LLM_CONFIG } from '../config';
import type { Env, ChatMessage, ToolDefinition } from '../utils/types';

interface NebiusRequestOptions {
  systemPrompt: string;
  messages: ChatMessage[];
  env: Env;
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  presencePenalty?: number;
}

export async function proxyToNebius(options: NebiusRequestOptions): Promise<Response> {
  const { systemPrompt, messages, env, tools, maxTokens, temperature, presencePenalty } = options;

  // Assemble messages with system prompt first
  const llmMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  const requestBody: Record<string, unknown> = {
    model: env.NEBIUS_MODEL,
    messages: llmMessages,
    temperature: temperature ?? LLM_CONFIG.DEFAULT_TEMPERATURE,
    max_tokens: maxTokens ?? LLM_CONFIG.MAX_OUTPUT_TOKENS,
    stream: true,
  };

  if (presencePenalty !== undefined) {
    requestBody.presence_penalty = presencePenalty;
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
  }

  const nebiusResponse = await fetch(`${env.NEBIUS_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.NEBIUS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!nebiusResponse.ok) {
    const errorText = await nebiusResponse.text();
    console.error(`[Nebius] ${nebiusResponse.status}: ${errorText.slice(0, 500)}`);

    const status = nebiusResponse.status === 429 ? 429 : 502;
    return new Response(
      JSON.stringify({
        error: status === 429
          ? 'LLM provider rate limited. Please try again in a moment.'
          : 'LLM service temporarily unavailable. Please try again.',
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // SSE pass-through: stream Nebius response directly to client
  return new Response(nebiusResponse.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
