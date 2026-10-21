// After a stored key is rejected, the free tier answers only after the
// visitor's yes. The yes covers one conversation while that key stays; a no,
// a closed question or a send that is gone sends nothing.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const harness = vi.hoisted(() => ({
  key: null as null | { valid: boolean; timestamp: number },
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
import {
  answerOwnKeyAsk,
  currentOwnKeyAsk,
  OwnKeyRejectedError,
  resetOwnKeyConsentForTests,
  type OwnKeyChoice,
} from '../../services/llm/ownKeyConsent';
import { mapErrorToUserMessage } from '../../services/llm/errorMessages';
import de from '../../assets/translations/ui-de.json';

const EARLIER = 'Das Geheimnis liegt unter dem alten Birnbaum im Garten.';
const ANSWER = 'Ein gutes Leben ist ein waches Leben.';
const FREE_TIER_ROUTE = /\/v1\/(chat|council|summary)$/;

function resetState(historyKey = 'thread-1'): void {
  harness.state = {
    figures: { selectedId: 'aurelius' },
    mode: { selected: 'free_conversation' },
    seeds: { selectedId: null, byFigure: { aurelius: [] } },
    language: { current: 'de' },
    conversation: { historyKey, messages: [] },
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

function installNetwork(status = 401): void {
  harness.calls = [];
  vi.mocked(global.fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    harness.calls.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
    if (url.includes('openrouter.ai')) {
      return new Response(
        JSON.stringify({ error: { message: 'User not found.', code: status } }),
        { status, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return sseResponse(ANSWER);
  });
}

const toOpenRouter = () => harness.calls.filter((c) => c.url.includes('openrouter.ai'));
const toFreeTier = () => harness.calls.filter((c) => !c.url.includes('openrouter.ai') && FREE_TIER_ROUTE.test(c.url));

async function waitForQuestion() {
  await vi.waitFor(() => expect(currentOwnKeyAsk()).not.toBeNull(), { timeout: 2000, interval: 5 });
  return currentOwnKeyAsk()!;
}

/** Settles a promise into a value, so a rejection can be read after an answer. */
function outcome<T>(task: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  return task.then((value) => ({ ok: true as const, value }), (error) => ({ ok: false as const, error }));
}

function chatTurn(controller = new AbortController()): { task: Promise<string>; controller: AbortController } {
  const shown: string[] = [];
  const stream = createLegacyConversationStream();
  const task = Promise.resolve(stream({
    requestId: `r-${Math.random()}`,
    threadKey: String((harness.state.conversation as { historyKey: string }).historyKey),
    messages: [
      { role: 'user', content: EARLIER },
      { role: 'assistant', content: 'Dann bleibt es dort gut verwahrt.' },
      { role: 'user', content: 'Was macht für dich ein gutes Leben aus?' },
    ] satisfies StreamConversationParams['messages'],
    signal: controller.signal,
    pushAssistantText: (chunk: string) => shown.push(chunk),
  })).then(() => shown.join(' '));
  return { task, controller };
}

function council(controller = new AbortController()): Promise<{ fullResponse: string }> {
  (generator as any).signal = controller.signal;
  (generator as any).onProgressiveSegment = null;
  return (generator as any).callLLM({
    systemMessage: 'council template',
    userMessage: EARLIER,
    expectedSpeakers: ['ADA LOVELACE', 'ALBERT EINSTEIN'],
    config: { provider: 'openrouter', model: 'qwen/qwen3-235b-a22b-2507', maxTokens: 4000, temperature: 0.8, language: 'de' },
  });
}

const tString = (key: string, fallback?: string): string => {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], de);
  return typeof value === 'string' ? value : fallback ?? key;
};

describe('the free tier after a rejected key', () => {
  beforeEach(() => {
    resetOwnKeyConsentForTests();
    resetState();
    installNetwork();
    harness.key = { valid: true, timestamp: 1_700_000_000_000 };
  });

  afterEach(() => {
    resetOwnKeyConsentForTests();
  });

  it.each([401])('HTTP %i: asks, sends nothing before the yes, then answers from the free tier as before', async (status) => {
    installNetwork(status);
    const { task } = chatTurn();

    const ask = await waitForQuestion();
    expect(ask.kind).toBe('chat');
    expect(toOpenRouter()).toHaveLength(1);
    expect(toFreeTier()).toEqual([]);

    answerOwnKeyAsk('yes');
    const shown = await task;

    expect(shown).toContain('Ein gutes Leben');
    expect(toFreeTier()).toHaveLength(1);
    const body = JSON.parse(toFreeTier()[0].body);
    expect(toFreeTier()[0].url).toMatch(/\/v1\/chat$/);
    // As today: the conversation so far rides along.
    expect(body.messages.map((m: { content: string }) => m.content)).toEqual([
      EARLIER,
      'Dann bleibt es dort gut verwahrt.',
      'Was macht für dich ein gutes Leben aus?',
    ]);
    expect(currentOwnKeyAsk()).toBeNull();
  });

  it('a yes covers the rest of that conversation without asking again', async () => {
    const first = chatTurn();
    await waitForQuestion();
    answerOwnKeyAsk('yes');
    await first.task;

    const second = chatTurn();
    await expect(second.task).resolves.toContain('Ein gutes Leben');
    expect(currentOwnKeyAsk()).toBeNull();
    // The key is marked rejected, so OpenRouter is not tried a second time.
    expect(toOpenRouter()).toHaveLength(1);
    expect(toFreeTier()).toHaveLength(2);
  });

  it('another conversation asks again', async () => {
    const first = chatTurn();
    await waitForQuestion();
    answerOwnKeyAsk('yes');
    await first.task;

    resetState('thread-2');
    const other = chatTurn();
    await waitForQuestion();
    expect(toFreeTier()).toHaveLength(1);
    answerOwnKeyAsk('yes');
    await other.task;
    expect(toFreeTier()).toHaveLength(2);
  });

  it('a new key starts without a yes, even in the same conversation', async () => {
    const first = chatTurn();
    await waitForQuestion();
    answerOwnKeyAsk('yes');
    await first.task;

    harness.key = { valid: true, timestamp: 1_800_000_000_000 };
    const again = chatTurn();
    await waitForQuestion();
    expect(toOpenRouter()).toHaveLength(2);
    expect(toFreeTier()).toHaveLength(1);
    answerOwnKeyAsk('dismissed');
    await outcome(again.task);
  });

  it.each<[Exclude<OwnKeyChoice, 'yes'>, string]>([
    ['check-key', ''],
    ['dismissed', de.errors.conversation.byokInvalidKey],
  ])('%s: sends nothing and ends the turn', async (choice, toast) => {
    const { task } = chatTurn();
    await waitForQuestion();
    answerOwnKeyAsk(choice);
    const result = await outcome(task);

    expect(result.ok).toBe(false);
    const error = (result as { error: unknown }).error;
    expect(error).toBeInstanceOf(OwnKeyRejectedError);
    expect((error as OwnKeyRejectedError).choice).toBe(choice);
    expect(mapErrorToUserMessage(error, tString)).toBe(toast);
    expect(toFreeTier()).toEqual([]);

    // A no is not remembered: the next send asks again.
    const next = chatTurn();
    await waitForQuestion();
    answerOwnKeyAsk('dismissed');
    await outcome(next.task);
    expect(toFreeTier()).toEqual([]);
  });

  it('a send that is gone takes its question with it', async () => {
    const { task, controller } = chatTurn();
    await waitForQuestion();
    controller.abort();
    const result = await outcome(task);

    expect(result.ok).toBe(false);
    expect((result as { error: Error }).error.name).toBe('AbortError');
    expect(currentOwnKeyAsk()).toBeNull();
    expect(toFreeTier()).toEqual([]);
  });

  it('two sends in one conversation share one question', async () => {
    harness.key = { valid: false, timestamp: 1_700_000_000_000 };
    const a = chatTurn();
    const b = chatTurn();
    const ask = await waitForQuestion();
    answerOwnKeyAsk('yes');
    await Promise.all([a.task, b.task]);
    expect(currentOwnKeyAsk()).toBeNull();
    expect(ask.kind).toBe('chat');
    expect(toFreeTier()).toHaveLength(2);
  });

  it('a question inside a story asks as a chat and answers from the chat route after the yes', async () => {
    const shown: string[] = [];
    const task = askDriver.ask({
      figureId: 'aurelius',
      language: 'de',
      seedId: '1',
      contextWindow: 'Ein Kapitel über den Garten.',
      question: EARLIER,
      priorPairs: [],
      speak: false,
      signal: new AbortController().signal,
      onText: (t) => shown.push(t),
      onFirstToken: () => {},
      onVoiceEnd: () => {},
    });
    const ask = await waitForQuestion();
    expect(ask.kind).toBe('chat');
    expect(toFreeTier()).toEqual([]);
    answerOwnKeyAsk('yes');
    await task;
    expect(toFreeTier()).toHaveLength(1);
    expect(JSON.parse(toFreeTier()[0].body).aside).toBe(true);
    expect(shown.join('')).toContain('Ein gutes Leben');
  });

  it('a summary asks as a summary and, after the yes, uses the summary route, never the chat route', async () => {
    const task = SummaryService.generateSummary(
      [
        { role: 'user', content: EARLIER },
        { role: 'assistant', content: 'Dann bleibt es dort gut verwahrt.' },
      ],
      'aurelius',
      1,
    );
    const ask = await waitForQuestion();
    expect(ask.kind).toBe('summary');
    expect(toFreeTier()).toEqual([]);
    answerOwnKeyAsk('yes');
    const summary = await task;

    expect(summary.metadata.llmProvider).toBe('free-tier');
    expect(toFreeTier().map((c) => c.url)).toEqual(['/v1/summary']);
    expect(JSON.parse(toFreeTier()[0].body).history).toContain('Birnbaum');
  });

  it('a council asks as a council, uses the council route after the yes, and the next council asks again', async () => {
    const first = council();
    const ask = await waitForQuestion();
    expect(ask.kind).toBe('council');
    expect(toFreeTier()).toEqual([]);
    answerOwnKeyAsk('yes');
    await first;
    expect(toFreeTier().map((c) => c.url)).toEqual(['/v1/council']);

    const second = outcome(council());
    await waitForQuestion();
    expect(toFreeTier()).toHaveLength(1);
    answerOwnKeyAsk('check-key');
    expect((await second).ok).toBe(false);
    expect(toFreeTier()).toHaveLength(1);
  });

  it('a visitor without a stored key is never asked', async () => {
    harness.key = null;
    const { task } = chatTurn();
    await expect(task).resolves.toContain('Ein gutes Leben');
    expect(currentOwnKeyAsk()).toBeNull();
    expect(toFreeTier()).toHaveLength(1);
  });

  it('a working key never meets the question', async () => {
    vi.mocked(global.fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      harness.calls.push({ url: String(input), body: typeof init?.body === 'string' ? init.body : '' });
      return sseResponse(ANSWER);
    });
    const { task } = chatTurn();
    await expect(task).resolves.toContain('Ein gutes Leben');
    expect(currentOwnKeyAsk()).toBeNull();
    expect(toOpenRouter()).toHaveLength(1);
    expect(toFreeTier()).toEqual([]);
  });
});
