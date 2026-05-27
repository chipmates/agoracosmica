// client/src/services/llm/types.ts
// Provider abstraction for the LLM service.
//
// `openrouter`     — OpenRouter cloud, BYOK with `sk-or-v1-...` keys, ZDR routing,
//                    HTTP-Referer + X-Title attribution headers, Qwen3-tuned
//                    presence_penalty.
// `custom-openai`  — any OpenAI-compatible server (LM Studio, Ollama, vLLM,
//                    llama.cpp). No OpenRouter-specific request envelope, no
//                    presence_penalty (Qwen3-235B-tuned, degrades smaller models),
//                    optional API key.

export type ProviderKind = 'openrouter' | 'custom-openai';

export interface ProviderConfig {
  kind: ProviderKind;
  baseURL: string;
  /** Send the OpenRouter `HTTP-Referer` + `X-Title` attribution headers. */
  sendOpenRouterHeaders: boolean;
  /** Send the OpenRouter `provider: { zdr, data_collection }` envelope. */
  sendOpenRouterProviderEnvelope: boolean;
  /** Send `presence_penalty: 1.5` (Qwen3-235B persona-collapse mitigation). */
  sendQwen3PresencePenalty: boolean;
}

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_REFERER = 'https://agoracosmica.org';
export const OPENROUTER_APP_NAME = 'Agora Cosmica';

export const defaultOpenRouterConfig: ProviderConfig = {
  kind: 'openrouter',
  baseURL: OPENROUTER_BASE_URL,
  sendOpenRouterHeaders: true,
  sendOpenRouterProviderEnvelope: true,
  sendQwen3PresencePenalty: true,
};

export function buildCustomOpenAIConfig(baseURL: string): ProviderConfig {
  return {
    kind: 'custom-openai',
    baseURL: baseURL.replace(/\/+$/, ''),
    sendOpenRouterHeaders: false,
    sendOpenRouterProviderEnvelope: false,
    sendQwen3PresencePenalty: false,
  };
}
