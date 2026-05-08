// POST /v1/summary — generate conversation summary via Nebius (separate rate limit)

import { authenticateRequest } from '../middleware/auth';
import { checkAndIncrementSummaryRateLimit } from '../middleware/rateLimit';
import { proxyToNebius } from '../services/nebius';
import { screenCouncilContent } from '../utils/contentScreen';
import { createSafetyFilteredStream } from '../services/streamFilter';
import { logComplianceEvent, getSeverity } from '../utils/complianceLog';
import { trackLlmEvent, trackRateLimit, readMarketingSource, readCountry } from '../utils/analytics';
import { VALID_FIGURES } from '../config';
import type { Env } from '../utils/types';

interface SummaryRequestBody {
  figureId: string;
  seedTitle: string;
  language: string;
  history: string; // Pre-formatted conversation history
}

function validateSummaryRequest(body: unknown): { valid: true; data: SummaryRequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const b = body as Record<string, unknown>;

  if (!b.figureId || typeof b.figureId !== 'string') {
    return { valid: false, error: 'Missing or invalid figureId' };
  }
  if (!VALID_FIGURES.includes(b.figureId as any)) {
    return { valid: false, error: `Invalid figure: ${b.figureId}` };
  }
  if (!b.history || typeof b.history !== 'string') {
    return { valid: false, error: 'Missing or invalid history' };
  }
  if (b.history.length > 50_000) {
    return { valid: false, error: 'History too long (max 50000 chars)' };
  }

  return {
    valid: true,
    data: {
      figureId: b.figureId as string,
      seedTitle: typeof b.seedTitle === 'string' ? b.seedTitle : 'General Discussion',
      language: typeof b.language === 'string' ? b.language : 'en',
      history: b.history as string,
    },
  };
}

function buildSummaryPrompt(figureName: string, seedTitle: string): string {
  return `Summarize the interaction between a user and ${figureName} (a historical figure in an educational app). The seed topic is "${seedTitle}".

This summary replaces the full conversation history as context for future interactions. ${figureName} must be able to continue teaching seamlessly.

Write in the SAME LANGUAGE as the conversation. If German, summarize in German. Never translate.

## Priority order (most to least important)

1. **Key teachings and insights** from ${figureName}: central ideas, memorable quotes (preserve exact wording in quote blocks), stories, and metaphors
2. **User's contributions** (only if the user actually spoke): what they asked, what they understood, personal connections they shared. If the user only listened to a story, note that briefly and focus on the story content instead.
3. **Open threads**: unanswered questions, topics not yet explored, natural next directions
4. **Modes used**: only mention modes that were actually active. Do NOT mention modes the user has not entered. Do NOT speculate about "emerging" or "not yet entered" modes.

## Formatting rules (strict)

- Section headers must be ALL CAPS followed by a colon on their own line (e.g. KEY TEACHINGS AND INSIGHTS:)
- Use bullet points with - for lists
- Wrap direct quotes on their own line starting with " (e.g. "To be or not to be.")
- Sub-sections end with a colon on their own line (e.g. Central metaphor:)
- Never use markdown syntax (no ##, no **, no \`\`\`, no >)
- Never use em dashes or en dashes. Use commas, periods, or restructure sentences instead.
- Be concise. If the interaction was short, the summary should be short. Do not pad or speculate.
- Do NOT start with a title like "Summary of..." since the UI already provides one. Start directly with the first section header.`;
}

export async function handleSummary(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

  const validation = validateSummaryRequest(body);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({ error: validation.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { figureId, seedTitle, language, history } = validation.data;

  // 2b. Content safety screen on history text
  const contentCheck = screenCouncilContent('', [{ role: 'user', content: history }]);
  if (contentCheck.blocked) {
    void logComplianceEvent(request, env, {
      type: 'input_blocked',
      severity: getSeverity('input_blocked', contentCheck.category || 'unknown'),
      category: contentCheck.category || 'unknown',
      figureId,
    });
    return new Response(
      JSON.stringify({ error: 'content_safety', message: 'Summary could not be generated.' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Check summary-specific rate limit (2/day per identity; see rateLimit.ts for race caveats)
  const rateLimit = await checkAndIncrementSummaryRateLimit(request, env, authResult.payload);
  if (!rateLimit.allowed) {
    trackRateLimit(env, 'summary', 'summary', readMarketingSource(request), readCountry(request));
    return new Response(
      JSON.stringify({
        error: `Daily summary limit reached (${rateLimit.limit} per day). Try again tomorrow.`,
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

  // 4. Build system prompt server-side
  const figureName = figureId.charAt(0).toUpperCase() + figureId.slice(1);
  const systemPrompt = buildSummaryPrompt(figureName, seedTitle);

  // 5. Proxy to Nebius
  const nebiusResponse = await proxyToNebius({
    systemPrompt,
    messages: [{ role: 'user', content: history }],
    env,
    maxTokens: 4000,
    temperature: 0.7,
  });

  // 6. Add rate limit headers
  const headers = new Headers(nebiusResponse.headers);
  headers.set('X-Summary-Daily-Used', String(rateLimit.used));
  headers.set('X-Summary-Daily-Limit', String(rateLimit.limit));
  headers.set('X-Summary-Resets-At', rateLimit.resetsAt);

  // 7. Apply output safety filter
  const filteredBody = nebiusResponse.body
    ? createSafetyFilteredStream(nebiusResponse.body)
    : nebiusResponse.body;

  // 8. Anonymous analytics (fire-and-forget)
  ctx.waitUntil(Promise.resolve().then(() => {
    trackLlmEvent(env, {
      endpoint: 'summary',
      figureId,
      mode: 'summary',
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
