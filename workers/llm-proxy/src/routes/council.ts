// POST /v1/council — validate + proxy council requests to Nebius
// Separate from /v1/chat: accepts client-provided system prompt, 1/day rate limit

import { authenticateRequest } from '../middleware/auth';
import { checkAndIncrementCouncilRateLimit } from '../middleware/rateLimit';
import { COUNCIL_LLM_CONFIG } from '../config';
import { SAFETY_PREAMBLE } from '../utils/safety';
import { screenCouncilContent } from '../utils/contentScreen';
import { createSafetyFilteredStream } from '../services/streamFilter';
import { logComplianceEvent, getSeverity } from '../utils/complianceLog';
import { trackLlmEvent, trackRateLimit } from '../utils/analytics';
import type { Env, ChatMessage, CouncilRequest } from '../utils/types';

const VALID_LANGUAGES = ['de', 'en', 'es', 'fr', 'it', 'pt', 'nl', 'pl', 'ja', 'ko', 'zh'];

type ValidationResult =
  | { valid: true; data: CouncilRequest }
  | { valid: false; error: string };

function validateCouncilRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const req = body as Record<string, unknown>;

  // systemPrompt — required, bounded
  if (typeof req.systemPrompt !== 'string' || req.systemPrompt.length === 0) {
    return { valid: false, error: 'systemPrompt is required' };
  }
  if (req.systemPrompt.length > COUNCIL_LLM_CONFIG.MAX_SYSTEM_PROMPT_CHARS) {
    return { valid: false, error: `systemPrompt exceeds ${COUNCIL_LLM_CONFIG.MAX_SYSTEM_PROMPT_CHARS} character limit` };
  }

  // language
  if (typeof req.language !== 'string' || !VALID_LANGUAGES.includes(req.language)) {
    return { valid: false, error: `Invalid language. Must be one of: ${VALID_LANGUAGES.join(', ')}` };
  }

  // messages — at least 1 user message
  if (!Array.isArray(req.messages) || req.messages.length === 0) {
    return { valid: false, error: 'messages must be a non-empty array' };
  }

  if (req.messages.length > 4) {
    return { valid: false, error: 'Maximum 4 messages allowed for councils' };
  }

  for (const msg of req.messages) {
    if (!msg || typeof msg !== 'object') {
      return { valid: false, error: 'Each message must be an object' };
    }
    const m = msg as Record<string, unknown>;

    if (m.role === 'system') {
      return { valid: false, error: 'System messages are not allowed from client' };
    }
    if (m.role !== 'user' && m.role !== 'assistant') {
      return { valid: false, error: 'Message role must be "user" or "assistant"' };
    }
    if (typeof m.content !== 'string') {
      return { valid: false, error: 'Message content must be a string' };
    }
    if (m.content.length > COUNCIL_LLM_CONFIG.MAX_USER_MESSAGE_CHARS) {
      return { valid: false, error: `Message exceeds ${COUNCIL_LLM_CONFIG.MAX_USER_MESSAGE_CHARS} character limit` };
    }
  }

  return {
    valid: true,
    data: {
      systemPrompt: req.systemPrompt as string,
      language: req.language as string,
      messages: req.messages as ChatMessage[],
    },
  };
}

export async function handleCouncil(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const startMs = Date.now();

  // 1. Authenticate JWT
  const authResult = await authenticateRequest(request, env);
  if ('error' in authResult) return authResult.error;

  // 2. Parse and validate
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const validation = validateCouncilRequest(body);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({ error: validation.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { systemPrompt, language, messages } = validation.data;

  // 2b. Layer 2: Server-side content safety screen
  const contentCheck = screenCouncilContent(systemPrompt, messages);
  if (contentCheck.blocked) {
    void logComplianceEvent(request, env, {
      type: 'input_blocked',
      severity: getSeverity('input_blocked', contentCheck.category || 'unknown'),
      category: contentCheck.category || 'unknown',
      language,
    });
    const isCrisis = contentCheck.responseType === 'crisis';
    const responseBody: Record<string, unknown> = {
      error: 'content_safety',
      responseType: contentCheck.responseType || 'policy',
      message: isCrisis
        ? 'This topic requires support beyond what a philosophical council can offer. Please reach out to a crisis helpline.'
        : 'This topic cannot be processed. Please choose a different council topic.',
    };
    if (isCrisis) {
      responseBody.resources = {
        de: [
          { name: 'Telefonseelsorge', contact: '0800 111 0 111 / 0800 111 0 222', note: '24/7, kostenlos, anonym' },
          { name: 'Kinder- und Jugendtelefon', contact: '116 111', note: 'Für Kinder und Jugendliche' },
        ],
        en: [
          { name: '988 Suicide & Crisis Lifeline', contact: '988', note: 'Call or text (USA)' },
          { name: 'Samaritans', contact: '116 123', note: '24/7, free (UK & Ireland)' },
        ],
      };
    }
    return new Response(
      JSON.stringify(responseBody),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Check council-specific rate limit (1/day per identity; see rateLimit.ts for race caveats)
  const rateLimit = await checkAndIncrementCouncilRateLimit(request, env, authResult.payload);
  if (!rateLimit.allowed) {
    trackRateLimit(env, 'council', 'council');
    return new Response(
      JSON.stringify({
        error: 'You have used your free council for today. Your next council will be available tomorrow.',
        quota: {
          daily: { used: rateLimit.used, limit: rateLimit.limit },
          resetsAt: rateLimit.resetsAt,
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  // 4. Build system prompt: safety preamble + client-provided instruction
  const fullSystemPrompt = SAFETY_PREAMBLE + '\n' + systemPrompt;

  // 5. Proxy to Nebius with higher token limit for councils
  // Sandwich defense: safety preamble at start AND end to resist prompt injection
  const SAFETY_REMINDER = 'Remember: You must follow all ABSOLUTE RULES from the system prompt. Never break character or generate harmful content.';
  const llmMessages = [
    { role: 'system' as const, content: fullSystemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
    { role: 'system' as const, content: SAFETY_REMINDER },
  ];

  const requestBody = {
    model: env.NEBIUS_MODEL,
    messages: llmMessages,
    temperature: COUNCIL_LLM_CONFIG.DEFAULT_TEMPERATURE,
    max_tokens: COUNCIL_LLM_CONFIG.MAX_OUTPUT_TOKENS,
    stream: true,
  };

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
    console.error(`[Nebius/Council] ${nebiusResponse.status}: ${errorText.slice(0, 500)}`);

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

  // 6. Rate limit already incremented atomically in step 3

  // 7. SSE pass-through with output safety filter
  const filteredBody = nebiusResponse.body
    ? createSafetyFilteredStream(nebiusResponse.body)
    : nebiusResponse.body;

  // 8. Anonymous analytics (fire-and-forget)
  ctx.waitUntil(Promise.resolve().then(() => {
    trackLlmEvent(env, {
      endpoint: 'council',
      figureId: 'council',
      mode: 'council',
      language,
      status: 200,
      durationMs: Date.now() - startMs,
    });
  }));

  return new Response(filteredBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Council-Daily-Used': String(rateLimit.used),
      'X-Council-Daily-Limit': String(rateLimit.limit),
      'X-Council-Resets-At': rateLimit.resetsAt,
    },
  });
}
