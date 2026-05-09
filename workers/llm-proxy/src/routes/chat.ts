// POST /v1/chat — validate + proxy SSE to Nebius

import { authenticateRequest } from '../middleware/auth';
import { validateChatRequest } from '../middleware/validation';
import { checkAndIncrementRateLimit } from '../middleware/rateLimit';
import { buildSystemPrompt } from '../services/promptLoader';
import { proxyToNebius } from '../services/nebius';
import { screenCouncilContent } from '../utils/contentScreen';
import { createSafetyFilteredStream } from '../services/streamFilter';
import { logComplianceEvent, getSeverity } from '../utils/complianceLog';
import { trackLlmEvent, trackRateLimit, readMarketingSource, readCountry } from '../utils/analytics';
import { LLM_CONFIG } from '../config';
import type { Env } from '../utils/types';

export async function handleChat(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const startMs = Date.now();

  // 1. Authenticate JWT
  const authResult = await authenticateRequest(request, env);
  if ('error' in authResult) return authResult.error;

  // 2. Parse and validate request
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const validation = validateChatRequest(body);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({ error: validation.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { figureId, mode, language, messages, seedData, tools } = validation.data;

  // 2b. Content safety screen on user messages
  const contentCheck = screenCouncilContent('', messages);
  if (contentCheck.blocked) {
    void logComplianceEvent(request, env, {
      type: 'input_blocked',
      severity: getSeverity('input_blocked', contentCheck.category || 'unknown'),
      category: contentCheck.category || 'unknown',
      figureId,
      mode,
      language,
    });
    const isCrisis = contentCheck.responseType === 'crisis';
    return new Response(
      JSON.stringify({
        error: 'content_safety',
        responseType: contentCheck.responseType || 'policy',
        message: isCrisis
          ? 'This conversation needs support beyond what a philosophical dialogue can offer. Please reach out to a crisis helpline.'
          : 'This request cannot be processed. Would you like to discuss a philosophical topic instead?',
      }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Check rate limits (increments counter; see rateLimit.ts for race caveats)
  const rateLimit = await checkAndIncrementRateLimit(request, env, authResult.payload);
  if (!rateLimit.allowed) {
    trackRateLimit(env, 'chat', rateLimit.reason === 'global' ? 'global' : 'daily', readMarketingSource(request), readCountry(request));
    const errorMsg = rateLimit.reason === 'global'
      ? 'Free tier is temporarily at capacity. Set up your own API key for unlimited access.'
      : 'Daily message limit reached. Your conversations will resume tomorrow.';
    return new Response(
      JSON.stringify({
        error: errorMsg,
        reason: rateLimit.reason,
        quota: {
          daily: rateLimit.daily,
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

  // 4. Build system prompt from bundled instructions
  // seedData: client sends processed seed data (targetSeed, seedsOverview, etc.)
  // Instructions remain server-owned — only the content data comes from client
  const seedDataJson = seedData ? JSON.stringify(seedData) : undefined;
  const systemPrompt = buildSystemPrompt(figureId, mode, language, seedDataJson);
  if (!systemPrompt) {
    return new Response(
      JSON.stringify({ error: `No instructions found for ${figureId}/${mode}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 5. Proxy to Nebius with SSE pass-through
  const nebiusResponse = await proxyToNebius({
    systemPrompt,
    messages,
    env,
    tools,
    presencePenalty: LLM_CONFIG.DEFAULT_PRESENCE_PENALTY,
  });

  // 6. Rate limit already incremented atomically in step 3

  // 7. Add quota headers to response
  const headers = new Headers(nebiusResponse.headers);
  headers.set('X-Quota-Daily-Used', String(rateLimit.daily.used));
  headers.set('X-Quota-Daily-Limit', String(rateLimit.daily.limit));
  headers.set('X-Quota-Resets-At', rateLimit.resetsAt);

  // 8. Apply output safety filter on SSE stream
  const filteredBody = nebiusResponse.body
    ? createSafetyFilteredStream(nebiusResponse.body)
    : nebiusResponse.body;

  // 9. Anonymous analytics (fire-and-forget)
  ctx.waitUntil(Promise.resolve().then(() => {
    trackLlmEvent(env, {
      endpoint: 'chat',
      figureId,
      mode,
      language,
      status: nebiusResponse.status,
      durationMs: Date.now() - startMs,
      marketingSource: readMarketingSource(request),
      country: readCountry(request),
    });
  }));

  return new Response(filteredBody, {
    status: nebiusResponse.status,
    headers,
  });
}
