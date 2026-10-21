// A self-host build has no free tier. A key OpenRouter rejects (401) is marked
// rejected there as on the hosted build, so Settings stops calling it active;
// nothing is asked and nothing goes anywhere else. A 403 keeps the key.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const harness = vi.hoisted(() => ({
  key: null as null | { valid: boolean; timestamp: number },
  body: {} as Record<string, unknown>,
  calls: [] as Array<{ url: string; body: string }>,
  state: {} as Record<string, unknown>,
}));

vi.mock('../../config/deployment', () => ({ isSelfHost: true }));

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
import { keyStorage } from '../../services/storage/keyStorageService';
import {
  currentOwnKeyAsk,
  OwnKeyRefusedError,
  resetOwnKeyConsentForTests,
} from '../../services/llm/ownKeyConsent';
import { mapErrorToUserMessage } from '../../services/llm/errorMessages';
import de from '../../assets/translations/ui-de.json';


const STATUS = vi.hoisted(() => ({ code: 401 }));

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

function installNetwork(): void {
  harness.calls = [];
  vi.mocked(global.fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    harness.calls.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
    const body = STATUS.code === 401
      ? { error: { code: 401, message: 'User not found.' } }
      : { error: { code: 403, message: 'Key limit exceeded (total limit). $5.00 of $5.00 used; resets .', metadata: { limit_source: 'openrouter_key_limit' } } };
    return new Response(JSON.stringify(body), { status: STATUS.code, headers: { 'Content-Type': 'application/json' } });
  });
}

const toOpenRouter = () => harness.calls.filter((c) => c.url.includes('openrouter.ai'));
const elsewhere = () => harness.calls.filter((c) => !c.url.includes('openrouter.ai'));

function outcome<T>(task: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  return task.then((value) => ({ ok: true as const, value }), (error) => ({ ok: false as const, error }));
}

const chatTurn = (): Promise<unknown> => {
  const stream = createLegacyConversationStream();
  return Promise.resolve(stream({
    requestId: `r-${Math.random()}`,
    threadKey: 'thread-1',
    messages: [
      { role: 'user', content: 'Was macht für dich ein gutes Leben aus?' },
    ] satisfies StreamConversationParams['messages'],
    signal: new AbortController().signal,
    pushAssistantText: () => {},
  }));
};

const lookup = (key: string, fallback?: string): string => {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], de);
  return typeof value === 'string' ? value : fallback ?? key;
};

describe('a self-host build whose stored key OpenRouter turns down', () => {
  beforeEach(() => {
    resetOwnKeyConsentForTests();
    resetState();
    installNetwork();
    harness.key = { valid: true, timestamp: 1_700_000_000_000 };
    vi.mocked(keyStorage.markInvalid).mockClear();
  });

  afterEach(() => {
    resetOwnKeyConsentForTests();
  });

  it('a 401 marks the key rejected, asks nothing and sends nothing elsewhere', async () => {
    STATUS.code = 401;
    const changed: unknown[] = [];
    const listener = (event: Event) => changed.push((event as CustomEvent).detail);
    window.addEventListener('byok-key-changed', listener);
    const result = await outcome(chatTurn());
    window.removeEventListener('byok-key-changed', listener);

    expect(result.ok).toBe(false);
    expect(keyStorage.markInvalid).toHaveBeenCalledWith('openrouter');
    expect(harness.key?.valid).toBe(false);
    expect(changed).toEqual([{ hasKey: false }]);
    expect(currentOwnKeyAsk()).toBeNull();
    expect(toOpenRouter()).toHaveLength(1);
    expect(elsewhere()).toEqual([]);
    expect(mapErrorToUserMessage((result as { error: unknown }).error, lookup)).toBe(de.errors.conversation.byokInvalidKey);
  });

  it('the next send names the rejected key again, without trying it or going elsewhere', async () => {
    STATUS.code = 401;
    await outcome(chatTurn());
    const again = await outcome(chatTurn());

    expect(again.ok).toBe(false);
    expect(toOpenRouter()).toHaveLength(1);
    expect(elsewhere()).toEqual([]);
    expect(currentOwnKeyAsk()).toBeNull();
    expect(mapErrorToUserMessage((again as { error: unknown }).error, lookup)).toBe(de.errors.conversation.byokInvalidKey);
  });

  it('a 403 keeps the key and says why', async () => {
    STATUS.code = 403;
    const result = await outcome(chatTurn());

    expect((result as { error: unknown }).error).toBeInstanceOf(OwnKeyRefusedError);
    expect(keyStorage.markInvalid).not.toHaveBeenCalled();
    expect(harness.key?.valid).toBe(true);
    expect(elsewhere()).toEqual([]);
    expect(mapErrorToUserMessage((result as { error: unknown }).error, lookup)).toBe(de.errors.conversation.byokRefused.budget);
  });
});
