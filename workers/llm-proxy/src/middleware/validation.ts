// Request validation: figureId whitelist, mode, message limits, tool whitelist

import { VALID_FIGURES, VALID_MODES, LLM_CONFIG, ALLOWED_TOOLS, AWARD_SEED_TOOL } from '../config';
import type { ChatRequest, ChatMessage, ToolDefinition } from '../utils/types';

type ValidationResult = {
  valid: true;
  data: ChatRequest;
} | {
  valid: false;
  error: string;
};

export function validateChatRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const req = body as Record<string, unknown>;

  // figureId
  if (typeof req.figureId !== 'string' || !VALID_FIGURES.includes(req.figureId as any)) {
    return { valid: false, error: `Invalid figureId. Must be one of: ${VALID_FIGURES.join(', ')}` };
  }

  // mode
  if (typeof req.mode !== 'string' || !VALID_MODES.includes(req.mode as any)) {
    return { valid: false, error: `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}` };
  }

  // language — allowlist only
  const VALID_LANGUAGES = ['de', 'en', 'es', 'fr', 'it', 'pt', 'nl', 'pl', 'ja', 'ko', 'zh'];
  if (typeof req.language !== 'string' || !VALID_LANGUAGES.includes(req.language)) {
    return { valid: false, error: `Invalid language. Must be one of: ${VALID_LANGUAGES.join(', ')}` };
  }

  // messages
  if (!Array.isArray(req.messages)) {
    return { valid: false, error: 'messages must be an array' };
  }

  if (req.messages.length === 0) {
    return { valid: false, error: 'messages must be a non-empty array' };
  }

  if (req.messages.length > LLM_CONFIG.MAX_CLIENT_MESSAGES) {
    return { valid: false, error: `Maximum ${LLM_CONFIG.MAX_CLIENT_MESSAGES} messages allowed` };
  }

  for (const msg of req.messages) {
    if (!msg || typeof msg !== 'object') {
      return { valid: false, error: 'Each message must be an object' };
    }
    const m = msg as Record<string, unknown>;

    // No system messages from client
    if (m.role === 'system') {
      return { valid: false, error: 'System messages are not allowed from client' };
    }

    if (m.role !== 'user' && m.role !== 'assistant') {
      return { valid: false, error: 'Message role must be "user" or "assistant"' };
    }

    if (typeof m.content !== 'string') {
      return { valid: false, error: 'Message content must be a string' };
    }

    if (m.role === 'user' && m.content.length > LLM_CONFIG.MAX_MESSAGE_CHARS) {
      return { valid: false, error: `User message exceeds ${LLM_CONFIG.MAX_MESSAGE_CHARS} character limit` };
    }

    // Assistant messages get a higher but still bounded limit to prevent cost inflation
    if (m.role === 'assistant' && m.content.length > LLM_CONFIG.MAX_MESSAGE_CHARS * 4) {
      return { valid: false, error: 'Assistant message content too long' };
    }
  }

  // tools (optional) — client signals intent, but we always use server-side definitions
  let validatedTools: ToolDefinition[] | undefined;
  if (req.tools !== undefined) {
    if (!Array.isArray(req.tools)) {
      return { valid: false, error: 'tools must be an array' };
    }
    for (const tool of req.tools) {
      if (!tool || typeof tool !== 'object') {
        return { valid: false, error: 'Each tool must be an object' };
      }
      const t = tool as Record<string, unknown>;
      if (t.type !== 'function' || !t.function || typeof t.function !== 'object') {
        return { valid: false, error: 'Invalid tool format' };
      }
      const fn = t.function as Record<string, unknown>;
      if (typeof fn.name !== 'string' || !ALLOWED_TOOLS.includes(fn.name as any)) {
        return { valid: false, error: `Tool "${fn.name}" is not allowed. Only ${ALLOWED_TOOLS.join(', ')} permitted.` };
      }
    }
    // Replace client-supplied schemas with trusted server-side definitions
    validatedTools = [AWARD_SEED_TOOL] as ToolDefinition[];
  }

  // seedId (optional) — strict alphanumeric + hyphens/underscores only
  let seedId: string | undefined;
  if (req.seedId !== undefined) {
    const raw = String(req.seedId);
    if (!/^[a-z0-9_-]{1,100}$/.test(raw)) {
      return { valid: false, error: 'Invalid seedId format' };
    }
    seedId = raw;
  }

  // seedData (optional) — processed seed data from client for instruction template injection
  // Content is public (seed JSON from GitHub repo), instructions remain server-owned
  let seedData: Record<string, unknown> | undefined;
  if (req.seedData !== undefined) {
    if (!req.seedData || typeof req.seedData !== 'object' || Array.isArray(req.seedData)) {
      return { valid: false, error: 'seedData must be a JSON object' };
    }
    const seedDataStr = JSON.stringify(req.seedData);
    if (seedDataStr.length > 25_000) {
      return { valid: false, error: 'seedData exceeds 25KB limit' };
    }
    // Reject deeply nested objects to prevent CPU exhaustion
    const depthCheck = (obj: unknown, depth: number): boolean => {
      if (depth > 5) return false;
      if (obj && typeof obj === 'object') {
        for (const val of Object.values(obj as Record<string, unknown>)) {
          if (!depthCheck(val, depth + 1)) return false;
        }
      }
      return true;
    };
    if (!depthCheck(req.seedData, 0)) {
      return { valid: false, error: 'seedData exceeds maximum nesting depth' };
    }
    seedData = req.seedData as Record<string, unknown>;
  }

  return {
    valid: true,
    data: {
      figureId: req.figureId as string,
      mode: req.mode as ChatRequest['mode'],
      language: req.language as string,
      messages: req.messages as ChatMessage[],
      seedId,
      seedData,
      tools: validatedTools,
    },
  };
}
