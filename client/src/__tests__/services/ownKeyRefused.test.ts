// OpenRouter answers 403 for a spending limit, a moderation flag, a guardrail
// or a missing permission: the request is refused, the key is not rejected.
// Only a 401 rejects a key. A 403 keeps the key, asks nothing, sends nothing to
// the free tier, and says why in the page's language.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const harness = vi.hoisted(() => ({
  key: null as null | { valid: boolean; timestamp: number },
  body: {} as Record<string, unknown>,
  calls: [] as Array<{ url: string; body: string }>,
  state: {} as Record<string, unknown>,
}));

vi.mock('../../services/proxy/sessionManager', () => ({
  getSessionToken: vi.fn(async () => 'test-token'),
  invalidateToken: vi.fn(),
}));

vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: {
    hasKey: vi.fn(async () => harness.key !== null),
    hasUsableKey: vi.fn(async () => harness.key !== null && harness.key.valid),
    getKey: vi.fn(async () => (harness.key ? `sk-or-v1-${'a'.repeat(64)}` : null)),
    getKeyMetadata: vi.fn(async () =>
      harness.key ? { valid: harness.key.valid, timestamp: harness.key.timestamp } : null,
    ),
    markInvalid: vi.fn(async () => {
      if (harness.key) harness.key.valid = false;
    }),
  },
}));

vi.mock('../../services/audio/instructionProcessor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/audio/instructionProcessor')>()),
  fetchInstructions: vi.fn(async () => 'system prompt'),
}));

vi.mock('../../services/audio/tts', () => ({
  convertTextToSpeech: vi.fn(async (_text: string, index: string) => ({ url: `blob:${index}`, name: index })),
}));

vi.mock('../../services/audio/tts/ttsSessions', () => ({
  getOrRollConversationSessionId: () => 'session-1',
  touchConversationSession: () => {},
}));

vi.mock('../../services/audio/audioQueueManager', () => ({
  addToAudioQueue: vi.fn(),
  setCurrentSession: vi.fn(),
  cleanupAudioResources: vi.fn(),
  getBufferDurationSeconds: () => 0,
  getAudioQueueStatus: () => ({ isPlaying: false, queueLength: 0 }),
}));

vi.mock('../../services/seedCacheInitializer', () => ({
  getSeedById: vi.fn(async () => null),
}));

vi.mock('../../stores/domainStore', () => ({
  useDomainStore: { getState: () => harness.state },
}));

vi.mock('../../stores', () => ({
  useDomainStore: { getState: () => harness.state },
}));

import { createLegacyConversationStream } from '../../controllers/conversationStreamDriver';
import type { StreamConversationParams } from '../../controllers/conversationController';
import SummaryService from '../../services/SummaryService';
import generator from '../../services/council/generator';
import { askDriver } from '../../services/ask/askDriver';
import { keyStorage } from '../../services/storage/keyStorageService';
import {
  currentOwnKeyAsk,
  OwnKeyRefusedError,
  ownKeyRefusalFrom,
  resetOwnKeyConsentForTests,
} from '../../services/llm/ownKeyConsent';
import { mapErrorToUserMessage } from '../../services/llm/errorMessages';
import { noteShownLanguage } from '../../utils/shownLanguage';
import de from '../../assets/translations/ui-de.json';
import en from '../../assets/translations/ui-en.json';

const EARLIER = 'Das Geheimnis liegt unter dem alten Birnbaum im Garten.';
const FREE_TIER_ROUTE = /\/v1\/(chat|council|summary|session)$/;

// The bodies as OpenRouter's error page shows them.
const BODIES = {
  budget: {
    error: {
      code: 403,
      message: 'Budget limit exceeded (monthly limit). $10.20 of $10.00 used; resets 2026-11-02T12:00:00.000Z.',
      metadata: { limit_source: 'openrouter_key_limit', scope: 'key_limit', limit_usd: 10, spend_usd: 10.2, resets_at: '2026-11-02T12:00:00.000Z' },
    },
  },
  budgetShared: {
    error: {
      code: 403,
      message: 'Budget limit exceeded (weekly limit). Contact your org admin. $52.00 of $50.00 used; resets 2026-11-02T12:00:00.000Z.',
      metadata: { limit_source: 'openrouter_guardrail_budget', scope: 'workspace_default_member', limit_usd: 50, spend_usd: 52, resets_at: '2026-11-02T12:00:00.000Z' },
    },
  },
  contentPolicy: {
    error: { code: 403, message: 'Provider returned error', metadata: { error_type: 'content_policy_violation', provider_name: 'Google', raw: '{"finishReason":"SAFETY"}' } },
  },
  modelRefusal: {
    error: { code: 403, message: 'The model refused to respond to this request.', metadata: { error_type: 'refusal', provider_name: 'Anthropic' } },
  },
  moderation: {
    error: {
      code: 403,
      message: 'Your chosen model requires moderation and your input was flagged for "harassment".',
      metadata: { reasons: ['harassment'], flagged_input: 'Was ist Freiheit?', provider_name: 'Example', model_slug: 'qwen/qwen3-235b-a22b-2507' },
    },
  },
  guardrail: {
    error: { code: 403, message: 'Request blocked: prompt injection patterns detected', metadata: { patterns: ['ignore all previous instructions'] } },
  },
  forbidden: { error: { code: 403, message: 'Forbidden' } },
} as const;

function resetState(): void {
  harness.state = {
    figures: { selectedId: 'aurelius' },
    mode: { selected: 'free_conversation' },
    seeds: { selectedId: null, byFigure: { aurelius: [] } },
    language: { current: 'de' },
    conversation: { historyKey: 'thread-1', messages: [] },
    serviceConfig: { raw: null, parsed: null },
    setProcessingStage: () => {},
    setQuota: () => {},
    setEndpointQuota: () => {},
    setFreeTierState: () => {},
    setSelectedFigureId: () => {},
    setSelectedSeed: () => {},
    openRateLimitModal: () => {},
  };
}

function sseResponse(text: string): Response {
  const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
  return new Response(sse, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function installNetwork(): void {
  harness.calls = [];
  vi.mocked(global.fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    harness.calls.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
    if (url.includes('openrouter.ai')) {
      return new Response(JSON.stringify(harness.body), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    return sseResponse('Eine Antwort.');
  });
}

const toOpenRouter = () => harness.calls.filter((c) => c.url.includes('openrouter.ai'));
const toUs = () => harness.calls.filter((c) => !c.url.includes('openrouter.ai') && FREE_TIER_ROUTE.test(c.url));

function outcome<T>(task: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  return task.then((value) => ({ ok: true as const, value }), (error) => ({ ok: false as const, error }));
}

const chatTurn = (): Promise<unknown> => {
  const stream = createLegacyConversationStream();
  return Promise.resolve(stream({
    requestId: `r-${Math.random()}`,
    threadKey: 'thread-1',
    messages: [
      { role: 'user', content: EARLIER },
      { role: 'assistant', content: 'Dann bleibt es dort gut verwahrt.' },
      { role: 'user', content: 'Was macht für dich ein gutes Leben aus?' },
    ] satisfies StreamConversationParams['messages'],
    signal: new AbortController().signal,
    pushAssistantText: () => {},
  }));
};

const aside = (): Promise<unknown> => askDriver.ask({
  figureId: 'aurelius',
  language: 'de',
  seedId: '1',
  contextWindow: 'Ein Kapitel über den Garten.',
  question: EARLIER,
  priorPairs: [],
  speak: false,
  signal: new AbortController().signal,
  onText: () => {},
  onFirstToken: () => {},
  onVoiceEnd: () => {},
});

const summary = (): Promise<unknown> => SummaryService.generateSummary(
  [
    { role: 'user', content: EARLIER },
    { role: 'assistant', content: 'Dann bleibt es dort gut verwahrt.' },
  ],
  'aurelius',
  1,
);

const council = (): Promise<unknown> => {
  (generator as any).signal = new AbortController().signal;
  (generator as any).onProgressiveSegment = null;
  return (generator as any).callLLM({
    systemMessage: 'council template',
    userMessage: EARLIER,
    expectedSpeakers: ['ADA LOVELACE', 'ALBERT EINSTEIN'],
    config: { provider: 'openrouter', model: 'qwen/qwen3-235b-a22b-2507', maxTokens: 4000, temperature: 0.8, language: 'de' },
  });
};

const routes: Array<[string, () => Promise<unknown>]> = [
  ['a chat turn', chatTurn],
  ['a question inside a story', aside],
  ['a summary', summary],
  ['a council', council],
];

const lookup = (bundle: unknown) => (key: string, fallback?: string): string => {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);
  return typeof value === 'string' ? value : fallback ?? key;
};

describe('a 403 from OpenRouter on a stored own key', () => {
  beforeEach(() => {
    resetOwnKeyConsentForTests();
    resetState();
    installNetwork();
    harness.key = { valid: true, timestamp: 1_700_000_000_000 };
    vi.mocked(keyStorage.markInvalid).mockClear();
    noteShownLanguage('de');
  });

  afterEach(() => {
    resetOwnKeyConsentForTests();
  });

  describe.each(Object.keys(BODIES) as Array<keyof typeof BODIES>)('%s', (kind) => {
    it.each(routes)('%s: keeps the key, asks nothing, sends nothing to us, and says why', async (_name, run) => {
      harness.body = BODIES[kind];
      const result = await outcome(run());

      expect(result.ok).toBe(false);
      const error = (result as { error: unknown }).error;
      expect(error).toBeInstanceOf(OwnKeyRefusedError);
      expect((error as OwnKeyRefusedError).reason).toBe(kind);

      expect(toOpenRouter()).toHaveLength(1);
      expect(keyStorage.markInvalid).not.toHaveBeenCalled();
      expect(harness.key?.valid).toBe(true);
      expect(currentOwnKeyAsk()).toBeNull();
      expect(toUs()).toEqual([]);

      const line = mapErrorToUserMessage(error, lookup(de));
      expect(line.startsWith((de.errors.conversation.byokRefused as Record<string, string>)[kind].slice(0, 40))).toBe(true);
      expect(line).not.toBe(de.errors.conversation.byokInvalidKey);
      expect(line).not.toMatch(/[—–;]/);
    });
  });

  it('the next send tries the same key again, since nothing marked it', async () => {
    harness.body = BODIES.budget;
    await outcome(chatTurn());
    await outcome(chatTurn());
    expect(toOpenRouter()).toHaveLength(2);
    expect(toUs()).toEqual([]);
  });
});

describe('reading the refusal', () => {
  it('names the reason from the metadata, and from the message where there is none', () => {
    expect(ownKeyRefusalFrom(BODIES.budget.error)).toMatchObject({ reason: 'budget', resetsAt: '2026-11-02T12:00:00.000Z' });
    expect(ownKeyRefusalFrom(BODIES.budgetShared.error)).toMatchObject({ reason: 'budgetShared', resetsAt: '2026-11-02T12:00:00.000Z' });
    expect(ownKeyRefusalFrom({ message: 'Key limit exceeded (total limit). $5.00 of $5.00 used; resets 2026-11-01T00:00:00.000Z.' }))
      .toMatchObject({ reason: 'budget', resetsAt: '2026-11-01T00:00:00.000Z' });
    expect(ownKeyRefusalFrom({ message: 'Budget limit exceeded (lifetime limit). $5.00 of $5.00 used; resets .' }))
      .toMatchObject({ reason: 'budget', resetsAt: null });
    expect(ownKeyRefusalFrom(BODIES.moderation.error).reason).toBe('moderation');
    expect(ownKeyRefusalFrom(BODIES.guardrail.error).reason).toBe('guardrail');
    expect(ownKeyRefusalFrom({ message: 'Request blocked: content filter' }).reason).toBe('guardrail');
    expect(ownKeyRefusalFrom(BODIES.forbidden.error).reason).toBe('forbidden');
    expect(ownKeyRefusalFrom(null).reason).toBe('forbidden');
  });

  it('a spending limit with a reset date names the day in the page language', () => {
    const error = new OwnKeyRefusedError('budget', '2026-11-02T12:00:00.000Z');
    noteShownLanguage('de');
    const deLine = mapErrorToUserMessage(error, lookup(de));
    expect(deLine).toContain('2.\u00A0November\u00A02026');
    expect(deLine).not.toContain('{date}');
    noteShownLanguage('en');
    const enLine = mapErrorToUserMessage(error, lookup(en));
    expect(enLine).toContain('November\u00A02,\u00A02026');
    expect(enLine).toMatch(/^OpenRouter stopped this request/);
    noteShownLanguage('de');
  });

  it('every refusal line exists in both languages, free of dashes and semicolons', () => {
    for (const bundle of [de, en]) {
      const lines = bundle.errors.conversation.byokRefused as Record<string, string>;
      expect(Object.keys(lines).sort()).toEqual([
        'budget', 'budgetShared', 'budgetSharedUntil', 'budgetUntil', 'contentPolicy', 'forbidden', 'guardrail', 'modelRefusal', 'moderation',
      ]);
      for (const line of Object.values(lines)) expect(line).not.toMatch(/[—–;]/);
    }
  });
});
