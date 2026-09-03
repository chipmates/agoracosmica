// POST /v1/chat — validate + proxy SSE to Nebius

import { authenticateRequest } from '../middleware/auth';
import { validateChatRequest } from '../middleware/validation';
import { checkAndIncrementRateLimit } from '../middleware/rateLimit';
import { buildSystemPrompt } from '../services/promptLoader';
import { dispatchToNebius } from '../services/nebius';
import { resolveServing } from '../services/modelRouting';
import { recordSpend } from '../services/spendGovernor';
import { AWARD_RETRY_DIRECTIVE, createAwardGuardedStream } from '../services/awardGuard';
import { screenCouncilContent } from '../utils/contentScreen';
import { createSafetyFilteredStream } from '../services/streamFilter';
import { logComplianceEvent, getSeverity } from '../utils/complianceLog';
import { trackGovernor, trackLlmEvent, trackRateLimit, readCountry, readDevice, readProbe } from '../utils/analytics';
import type { ServingModel } from '../config';
import type { TokenUsage } from '../services/spendGovernor';
import type { Env, ToolDefinition } from '../utils/types';

// Which kind of chat request this is, in blob8 of the chat row. The auto
// greeting that opens a chat is an LLM request like any other, so without a
// label the Conversations total cannot be split into machine and human. Read
// off the raw body rather than through validation: it is a label with no
// effect on the prompt, and an unknown value collapses to ''.
// 'prefilled' is reserved for the carried-question entry flow.
const VALID_CHAT_KINDS = new Set(['greeting', 'turn', 'prefilled']);

// How the conversation was entered. Unlike `kind` this is a behavior trigger,
// not a label: 'carried' switches the free-talk prompt to answer-first. It is
// the only accepted value, anything else counts as absent, and it never reaches
// analytics.
const CARRIED_ENTRY = 'carried';

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

  const rawBody = body as Record<string, unknown>;
  const kind = (typeof rawBody.kind === 'string' && VALID_CHAT_KINDS.has(rawBody.kind))
    ? rawBody.kind
    : '';
  const probe = readProbe(rawBody.probe);
  const carriedEntry = rawBody.entry === CARRIED_ENTRY;

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
    const limitLabel = rateLimit.reason === 'global' || rateLimit.reason === 'ip_ceiling'
      ? rateLimit.reason
      : 'daily';
    trackRateLimit(env, 'chat', limitLabel, readCountry(request), readDevice(request));
    const errorMsg = rateLimit.reason === 'global'
      ? 'Free tier is temporarily at capacity. Set up your own API key for unlimited access.'
      : rateLimit.reason === 'ip_ceiling'
        ? 'Too many messages from this network today. Your conversations will resume tomorrow.'
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

  // 4. Resolve the serving model, then build the prompt its profile calls for
  const country = readCountry(request);
  const device = readDevice(request);
  const serving = await resolveServing(env);

  // seedData: client sends processed seed data (targetSeed, seedsOverview, etc.)
  // Instructions remain server-owned — only the content data comes from client
  const seedDataJson = seedData ? JSON.stringify(seedData) : undefined;
  const carried = carriedEntry
    ? { userMessageCount: messages.filter(m => m.role === 'user').length }
    : undefined;
  const systemPrompt = buildSystemPrompt(figureId, mode, language, serving.profile, seedDataJson, carried);
  if (!systemPrompt) {
    return new Response(
      JSON.stringify({ error: `No instructions found for ${figureId}/${mode}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 5. Proxy to Nebius with SSE pass-through
  const meter = (model: ServingModel, usage: TokenUsage) => {
    ctx.waitUntil(recordSpend(env, model, usage, { endpoint: 'chat', country, device }));
  };
  const dispatchOptions = {
    systemPrompt,
    messages,
    env,
    model: serving.model,
    fallback: serving.fallback,
    tools,
    usePresencePenalty: true,
    onUsage: meter,
  };
  const dispatch = await dispatchToNebius(dispatchOptions);

  const track = (status: number) => {
    trackLlmEvent(env, {
      endpoint: 'chat',
      figureId,
      mode,
      language,
      status,
      durationMs: Date.now() - startMs,
      country,
      device,
      kind,
      probe,
    });
  };

  if (!dispatch.ok || !dispatch.stream) {
    const failure = dispatch.error ?? new Response(
      JSON.stringify({ error: 'LLM service temporarily unavailable. Please try again.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
    ctx.waitUntil(Promise.resolve().then(() => track(failure.status)));
    return failure;
  }

  if (dispatch.fallbackReason) {
    trackGovernor(env, {
      event: dispatch.fallbackReason === 'latency' ? 'fallback_latency' : 'fallback_error',
      endpoint: 'chat',
      model: dispatch.served.key,
      spendUsd: serving.spendUsd,
      country,
      device,
    });
  }

  // 6. Rate limit already incremented atomically in step 3

  // 7. Add quota headers to response
  const headers = new Headers({ 'Content-Type': 'text/event-stream' });
  headers.set('Cache-Control', 'no-cache');
  headers.set('Connection', 'keep-alive');
  headers.set('X-AI-Model', dispatch.served.disclosureLabel);
  headers.set('X-Quota-Daily-Used', String(rateLimit.daily.used));
  headers.set('X-Quota-Daily-Limit', String(rateLimit.daily.limit));
  headers.set('X-Quota-Resets-At', rateLimit.resetsAt);

  // 8. Guard a silent quest verdict, then apply the output safety filter
  const guarded = awardsSeed(tools)
    ? createAwardGuardedStream(
      dispatch.stream,
      async () => {
        const retry = await dispatchToNebius({
          ...dispatchOptions,
          model: dispatch.served,
          fallback: undefined,
          trailingSystemMessage: AWARD_RETRY_DIRECTIVE,
        });
        return retry.ok ? retry.stream : null;
      },
    )
    : dispatch.stream;

  // 9. Anonymous analytics (fire-and-forget)
  ctx.waitUntil(Promise.resolve().then(() => track(200)));

  return new Response(createSafetyFilteredStream(guarded), { status: 200, headers });
}

/** Quest turns are the only ones that can end in an award. */
function awardsSeed(tools: ToolDefinition[] | undefined): boolean {
  return !!tools?.some(t => t.function.name === 'award_seed');
}
