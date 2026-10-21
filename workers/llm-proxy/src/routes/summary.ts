// POST /v1/summary — generate conversation summary via Nebius (separate rate limit)

import { authenticateRequest } from '../middleware/auth';
import { readJsonBody } from '../middleware/bodyLimit';
import { checkAndIncrementSummaryRateLimit, giveBackSummary } from '../middleware/rateLimit';
import { dispatchToNebius, type DispatchResult } from '../services/nebius';
import { fallbackModel } from '../services/modelRouting';
import { alertOutage } from '../services/telegram';
import { isInjection, screenCouncilContent } from '../utils/contentScreen';
import { createSafetyFilteredStream } from '../services/streamFilter';
import { logComplianceEvent, getSeverity } from '../utils/complianceLog';
import { trackLlmEvent, trackRateLimit, readCountry, readDevice, readProbe } from '../utils/analytics';
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


/**
 * The client formats each turn as "Human [mode] (ISO time): text" or
 * "Assistant [mode] (ISO time): text", joined by blank lines. The head ends at
 * the first ": " after the timestamp, whose own colons never carry a space.
 */
const TURN_HEAD = /^(Human|Assistant)\b[^\n]*?: /;
const SUMMARY_SCREEN_TURNS = 6;

/**
 * Screen only the last few user turns of a formatted history. A segment that
 * starts with neither head (a blank line inside a turn) is treated as the
 * visitor's text, never skipped. Figure segments are checked only for prompt
 * injection, so a caller cannot launder an attack under an "Assistant:" label
 * while a story about Woolf still summarises. Returns the history with every
 * blocked segment removed, or null when nothing usable is left, plus the
 * category of the first blocked segment for the compliance log.
 */
export function screenSummaryHistory(history: string): { history: string | null; droppedCategory?: string } {
  const segments = history.split(/\n\n(?=(?:Human|Assistant)\b[^\n]*?: )/);
  const isUser = (seg: string) => !/^Assistant\b[^\n]*?: /.test(seg);
  const userIndexes = segments.map((seg, i) => (isUser(seg) ? i : -1)).filter(i => i >= 0);
  const recent = new Set(userIndexes.slice(-SUMMARY_SCREEN_TURNS));
  let droppedCategory: string | undefined;
  const kept = segments.filter((seg, i) => {
    const text = seg.replace(TURN_HEAD, '');
    if (isUser(seg)) {
      if (!recent.has(i)) return true;
      const result = screenCouncilContent('', [{ role: 'user', content: text }]);
      if (result.blocked) {
        droppedCategory = droppedCategory ?? (result.category || 'unknown');
        return false;
      }
      return true;
    }
    if (isInjection(text)) {
      droppedCategory = droppedCategory ?? 'jailbreak';
      return false;
    }
    return true;
  });
  const userLeft = kept.some(seg => isUser(seg) && seg.replace(TURN_HEAD, '').trim().length > 0);
  if (!userLeft) return { history: null, droppedCategory };
  return { history: kept.join('\n\n'), droppedCategory };
}

/**
 * How long a summary's first bytes must stand before it counts. A visitor who
 * is already gone is noticed when those bytes are written, a few milliseconds
 * later in local workerd, and a give-back inside the window buys at most a
 * second of the model's answer.
 */
const DELIVERY_GRACE_MS = 1000;

/**
 * The summary stream, telling `settle` once whether it reached the visitor:
 * yes when its first bytes stood for DELIVERY_GRACE_MS or the stream ended
 * after them, no when it ends empty, fails or is cancelled before that. The
 * runtime reads ahead of the socket, so a read alone does not prove delivery.
 */
function watchDelivery(
  source: ReadableStream<Uint8Array>,
  settle: (delivered: boolean) => void,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let handedOut = false;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const decide = (delivered: boolean) => {
    if (settled) return;
    settled = true;
    if (timer !== null) clearTimeout(timer);
    settle(delivered);
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch (err) {
        decide(false);
        controller.error(err);
        return;
      }
      if (result.done) {
        decide(handedOut);
        controller.close();
        return;
      }
      controller.enqueue(result.value);
      if (!handedOut && result.value.byteLength > 0) {
        handedOut = true;
        timer = setTimeout(() => decide(true), DELIVERY_GRACE_MS);
      }
    },
    cancel(reason) {
      decide(false);
      return reader.cancel(reason);
    },
  }, { highWaterMark: 0 });
}

export async function handleSummary(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const startMs = Date.now();

  // 1. Authenticate JWT
  const authResult = await authenticateRequest(request, env);
  if ('error' in authResult) return authResult.error;

  // 2. Parse and validate request
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const validation = validateSummaryRequest(body);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({ error: validation.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { figureId, seedTitle, language, history } = validation.data;

  // 2b. Content safety screen on the visitor's own recent turns. The figure's
  // words are never screened: a story about Woolf is not a visitor in danger,
  // and a recap that fails on a screening rule is a bad trade. A blocked turn
  // is dropped from the history and the recap is built from what remains.
  const screened = screenSummaryHistory(history);
  if (screened.droppedCategory) {
    ctx.waitUntil(logComplianceEvent(request, env, {
      type: 'input_blocked',
      severity: getSeverity('input_blocked', screened.droppedCategory),
      category: screened.droppedCategory,
      figureId,
    }));
  }
  if (screened.history === null) {
    return new Response(
      JSON.stringify({ error: 'content_safety', message: 'Summary could not be generated.' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const screenedHistory = screened.history;

  // 3. Check summary-specific rate limit (2/day per identity; see rateLimit.ts for race caveats).
  // Counted now, so parallel requests meet the cap, and given back below when
  // no summary reaches the visitor, up to the identity's daily give-backs.
  const rateLimit = await checkAndIncrementSummaryRateLimit(request, env, authResult.payload);
  if (!rateLimit.allowed) {
    trackRateLimit(env, 'summary', 'summary', readCountry(request), readDevice(request));
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

  let settle: (delivered: boolean) => void = () => {};
  const delivered = new Promise<boolean>((resolve) => { settle = resolve; });
  ctx.waitUntil(delivered.then((yes) => (yes ? undefined : giveBackSummary(env, rateLimit))));

  // 4. Build system prompt server-side
  const figureName = figureId.charAt(0).toUpperCase() + figureId.slice(1);
  const systemPrompt = buildSummaryPrompt(figureName, seedTitle);

  // 5. Proxy to Nebius. A recap is not a conversation turn: no figure voice, no
  // mode evaluation behind it, so it stays on the model it has always used.
  let dispatch: DispatchResult;
  try {
    dispatch = await dispatchToNebius({
      systemPrompt,
      messages: [{ role: 'user', content: screenedHistory }],
      env,
      model: fallbackModel(env),
      maxTokens: 4000,
      temperature: 0.7,
    });
  } catch (err) {
    settle(false);
    throw err;
  }

  const track = (status: number) => {
    trackLlmEvent(env, {
      endpoint: 'summary',
      figureId,
      mode: 'summary',
      language,
      status,
      durationMs: Date.now() - startMs,
      country: readCountry(request),
      device: readDevice(request),
      // The greeting/turn label belongs to chat rows only.
      kind: '',
      probe: readProbe((body as Record<string, unknown>).probe),
    });
  };

  if (!dispatch.ok || !dispatch.stream) {
    settle(false);
    const failure = dispatch.error ?? new Response(
      JSON.stringify({ error: 'LLM service temporarily unavailable. Please try again.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
    ctx.waitUntil(Promise.resolve().then(() => track(failure.status)));
    ctx.waitUntil(alertOutage(env, { asked: dispatch.served, upstreamStatus: dispatch.upstreamStatus }));
    return failure;
  }

  // 6. Add rate limit headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  headers.set('X-AI-Model', dispatch.served.disclosureLabel);
  headers.set('X-Summary-Daily-Used', String(rateLimit.used));
  headers.set('X-Summary-Daily-Limit', String(rateLimit.limit));
  headers.set('X-Summary-Resets-At', rateLimit.resetsAt);

  // 7. Apply output safety filter
  const filteredBody = watchDelivery(createSafetyFilteredStream(dispatch.stream), settle);

  // 8. Anonymous analytics (fire-and-forget)
  ctx.waitUntil(Promise.resolve().then(() => track(200)));

  return new Response(filteredBody, { status: 200, headers });
}
