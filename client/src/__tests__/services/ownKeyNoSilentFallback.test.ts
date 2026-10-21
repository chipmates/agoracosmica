// A stored OpenRouter key that OpenRouter turns down (401 or 403) must not
// carry the conversation to our servers on its own. Each route that could fall
// back is driven to the rejection, and the network log is read before anyone
// answers: only OpenRouter may have seen the conversation.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const harness = vi.hoisted(() => ({
  key: null as null | { valid: boolean; timestamp: number },
  rejectWith: 401,
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

// Found by glob so this file also runs against code that predates the module.
const consentModules = import.meta.glob('../../services/llm/ownKeyConsent.ts');

// Something said earlier in the conversation, to follow where it travels.
const EARLIER = 'Das Geheimnis liegt unter dem alten Birnbaum im Garten.';
const FREE_TIER_ROUTE = /\/v1\/(chat|council|summary)$/;

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
      if (harness.rejectWith === 200) return sseResponse('Eine Antwort.');
      return new Response(
        JSON.stringify({ error: { message: 'User not found.', code: harness.rejectWith } }),
        { status: harness.rejectWith, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return sseResponse('Eine Antwort.');
  });
}

const toOpenRouter = () => harness.calls.filter((c) => c.url.includes('openrouter.ai'));
const toFreeTier = () => harness.calls.filter((c) => !c.url.includes('openrouter.ai') && FREE_TIER_ROUTE.test(c.url));
const conversationLeftForUs = () =>
  harness.calls.filter((c) => !c.url.includes('openrouter.ai') && c.body.includes('Birnbaum'));

/** Lets a route run until it ends or stops to wait; never answers anything. */
async function runUntilQuiet(task: Promise<unknown>, ms = 400): Promise<'ended' | 'waiting'> {
  let ended = false;
  task.then(() => { ended = true; }, () => { ended = true; });
  for (let waited = 0; waited < ms && !ended; waited += 10) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return ended ? 'ended' : 'waiting';
}

const controllers: AbortController[] = [];
function signal(): AbortSignal {
  const controller = new AbortController();
  controllers.push(controller);
  return controller.signal;
}

function chatTurn(): Promise<void> {
  const stream = createLegacyConversationStream();
  return Promise.resolve(stream({
    requestId: `r-${Math.random()}`,
    threadKey: 'thread-1',
    messages: [
      { role: 'user', content: EARLIER },
      { role: 'assistant', content: 'Dann bleibt es dort gut verwahrt.' },
      { role: 'user', content: 'Was macht für dich ein gutes Leben aus?' },
    ] satisfies StreamConversationParams['messages'],
    signal: signal(),
    pushAssistantText: () => {},
  }));
}

function summary(): Promise<unknown> {
  return SummaryService.generateSummary(
    [
      { role: 'user', content: EARLIER },
      { role: 'assistant', content: 'Dann bleibt es dort gut verwahrt.' },
    ],
    'aurelius',
    1,
  );
}

function council(): Promise<unknown> {
  (generator as any).signal = signal();
  (generator as any).onProgressiveSegment = null;
  return (generator as any).callLLM({
    systemMessage: 'council template',
    userMessage: EARLIER,
    expectedSpeakers: ['ADA LOVELACE', 'ALBERT EINSTEIN'],
    config: { provider: 'openrouter', model: 'qwen/qwen3-235b-a22b-2507', maxTokens: 4000, temperature: 0.8, language: 'de' },
  });
}

function aside(): Promise<void> {
  return askDriver.ask({
    figureId: 'aurelius',
    language: 'de',
    seedId: '1',
    contextWindow: 'Ein Kapitel über den Garten.',
    question: EARLIER,
    priorPairs: [],
    speak: false,
    signal: signal(),
    onText: () => {},
    onFirstToken: () => {},
    onVoiceEnd: () => {},
  });
}

const routes: Array<[string, () => Promise<unknown>]> = [
  ['a typed or spoken chat turn', chatTurn],
  ['a question asked inside a story', aside],
  ['a summary', summary],
  ['a council', council],
];

describe('a stored key that OpenRouter rejects', () => {
  beforeEach(() => {
    resetState();
    installNetwork();
    harness.key = { valid: true, timestamp: 1_700_000_000_000 };
    vi.mocked(keyStorage.markInvalid).mockClear();
  });

  afterEach(async () => {
    for (const controller of controllers.splice(0)) controller.abort();
    for (const load of Object.values(consentModules)) {
      const mod = (await load()) as { resetOwnKeyConsentForTests?: () => void };
      mod.resetOwnKeyConsentForTests?.();
    }
  });

  describe.each([401, 403])('with HTTP %i', (status) => {
    it.each(routes)('%s: tries OpenRouter, then sends nothing to the free tier on its own', async (_name, run) => {
      harness.rejectWith = status;
      await runUntilQuiet(run());

      expect(toOpenRouter().length).toBeGreaterThan(0);
      expect(keyStorage.markInvalid).toHaveBeenCalled();
      expect(toFreeTier()).toEqual([]);
      expect(conversationLeftForUs()).toEqual([]);
    });
  });

  it.each(routes)('%s, once the key is marked rejected: no free tier and no history before a yes', async (_name, run) => {
    harness.key = { valid: false, timestamp: 1_700_000_000_000 };
    await runUntilQuiet(run());

    expect(toOpenRouter()).toEqual([]);
    expect(toFreeTier()).toEqual([]);
    expect(conversationLeftForUs()).toEqual([]);
  });

  it("a council's no comes back as the visitor's answer, not as a failed call", async () => {
    harness.key = { valid: false, timestamp: 1_700_000_000_000 };
    const consent = await import('../../services/llm/ownKeyConsent');
    const outcome = council().then(() => null, (error: unknown) => error);
    await vi.waitFor(() => expect(consent.currentOwnKeyAsk()).not.toBeNull());
    consent.answerOwnKeyAsk('dismissed');

    const error = await outcome;
    expect(error).toBeInstanceOf(consent.OwnKeyRejectedError);
    expect((error as InstanceType<typeof consent.OwnKeyRejectedError>).choice).toBe('dismissed');
  });

  it('a visitor without a stored key still gets the free tier at once, history included', async () => {
    harness.key = null;
    expect(await runUntilQuiet(chatTurn())).toBe('ended');

    expect(toOpenRouter()).toEqual([]);
    expect(toFreeTier()).toHaveLength(1);
    expect(toFreeTier()[0].body).toContain('Birnbaum');
  });
});

describe('zero data retention with a working own key', () => {
  beforeEach(() => {
    resetState();
    installNetwork();
    harness.rejectWith = 200;
    harness.key = { valid: true, timestamp: 1_700_000_000_000 };
  });

  afterEach(() => {
    for (const controller of controllers.splice(0)) controller.abort();
  });

  it('is asked of OpenRouter when the stored settings never set the flag', async () => {
    await runUntilQuiet(chatTurn());

    const [call] = toOpenRouter();
    expect(call).toBeDefined();
    expect(JSON.parse(call.body).provider).toMatchObject({ zdr: true, data_collection: 'deny' });
  });

  it('stays off only when the visitor turned it off', async () => {
    (harness.state as { serviceConfig: unknown }).serviceConfig = {
      raw: JSON.stringify({ llm: { provider: 'openrouter', kind: 'openrouter', model: 'qwen/qwen3-235b-a22b-2507', zdr: false } }),
      parsed: null,
    };
    await runUntilQuiet(chatTurn());

    const [call] = toOpenRouter();
    expect(call).toBeDefined();
    expect(JSON.parse(call.body).provider).toBeUndefined();
  });
});
