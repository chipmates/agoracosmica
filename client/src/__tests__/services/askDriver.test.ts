import { describe, it, expect, beforeEach, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  calls: [] as string[],
  chunks: ['First part of the answer. ', 'Second part of it.'],
  generateCalls: [] as Record<string, unknown>[],
  generateError: null as Error | null,
  hasKey: false,
  queueStatus: { isPlaying: false, queueLength: 0, hasActiveQueue: false, currentSessionId: null, isTranslationActive: false },
}));

vi.mock('../../services/audio/llm', () => ({
  generateResponse: async (options: Record<string, unknown>) => {
    harness.generateCalls.push(options);
    harness.calls.push('generate');
    const streamingCallback = options.streamingCallback as ((c: string) => Promise<void>) | undefined;
    for (const chunk of harness.chunks) {
      await streamingCallback?.(chunk);
    }
    if (harness.generateError) throw harness.generateError;
    return { response: harness.chunks.join('') };
  },
}));

vi.mock('../../services/audio/ttsScheduler', () => {
  class TTSScheduler {
    setBufferProvider(): void {}
    setSession(id: string | null): void {
      harness.calls.push(`setSession:${typeof id === 'string' ? 'id' : id}`);
    }
    async enqueue(job: { id: string; sequenceNumber: number }): Promise<{ url: string; name: string }> {
      harness.calls.push(`enqueue:${job.sequenceNumber}`);
      return { url: `blob:${job.id}`, name: job.id };
    }
    flush(): void {
      harness.calls.push('flush');
    }
    cancelAll(): void {
      harness.calls.push('cancelAll');
    }
  }
  return { TTSScheduler };
});

vi.mock('../../services/audio/audioQueueManager', () => ({
  addToAudioQueue: (file: { name: string }) => harness.calls.push(`queue:${file.name.split('_')[1]}`),
  cleanupAudioResources: () => harness.calls.push('cleanup'),
  getAudioQueueStatus: () => harness.queueStatus,
  getBufferDurationSeconds: () => 0,
  setCurrentSession: () => harness.calls.push('currentSession'),
}));

vi.mock('../../services/audio/tts', () => ({
  convertTextToSpeech: async () => ({ url: 'blob:audio', name: 'audio' }),
}));

vi.mock('../../services/audio/tts/ttsSessions', () => ({
  getOrRollConversationSessionId: () => 'session-1',
  touchConversationSession: () => {},
}));

vi.mock('../../services/audio/instructionProcessor', () => ({
  INSTRUCTION_MODES: {
    STORY: 'story',
    INTRODUCTION: 'introduction',
    SEED_CONVERSATION: 'seed_conversation',
    FREE_CONVERSATION: 'free_conversation',
    CHALLENGE: 'challenge',
  },
  fetchInstructions: async (figure: string, mode: string, _seed: unknown, options: Record<string, unknown>) => {
    harness.calls.push(`instructions:${mode}:${options?.aside === true ? 'aside' : 'plain'}`);
    return `system prompt for ${figure}`;
  },
}));

vi.mock('../../services/audio/config/serviceConfig', () => ({
  loadServiceConfig: () => ({
    stt: 'self-hosted',
    sttEnabled: true,
    tts: 'self-hosted',
    ttsSettings: { speed: 1 },
    ttsEnabled: true,
    llm: { provider: 'OpenRouter', model: 'qwen', kind: 'openrouter' },
    localMode: { llmEnabled: false, ttsEnabled: false, sttEnabled: false },
  }),
}));

vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: { hasUsableKey: async () => harness.hasKey },
}));

vi.mock('../../stores/domainStore', () => ({
  useDomainStore: { getState: () => ({ seeds: { byFigure: { aurelius: [{ id: 3, title: 'A teaching' }] } } }) },
}));

import { askDriver, resetAudioLimitForTests } from '../../services/ask/askDriver';

interface Recorder {
  text: string[];
  firstToken: number;
  voiceEnd: number;
}

function run(overrides: Record<string, unknown> = {}): { promise: Promise<void>; seen: Recorder } {
  const seen: Recorder = { text: [], firstToken: 0, voiceEnd: 0 };
  const promise = askDriver.ask({
    figureId: 'aurelius',
    language: 'en',
    seedId: '3',
    contextWindow: 'He looked at the boy for a long time.',
    question: 'Why did he wait?',
    priorPairs: [],
    speak: true,
    signal: new AbortController().signal,
    onText: (t) => seen.text.push(t),
    onFirstToken: () => { seen.firstToken += 1; },
    onVoiceEnd: () => { seen.voiceEnd += 1; },
    ...overrides,
  } as Parameters<typeof askDriver.ask>[0]);
  return { promise, seen };
}

describe('askDriver', () => {
  beforeEach(() => {
    harness.calls.length = 0;
    harness.generateCalls.length = 0;
    harness.generateError = null;
    harness.hasKey = false;
    harness.chunks = ['First part of the answer. ', 'Second part of it.'];
    resetAudioLimitForTests();
  });

  it('opens the session, enqueues in order, then flushes', async () => {
    const { promise, seen } = run();
    await promise;

    expect(harness.calls).toEqual([
      'cleanup',
      'currentSession',
      'setSession:id',
      'generate',
      'enqueue:1',
      'queue:1',
      'enqueue:2',
      'queue:2',
      'flush',
    ]);
    expect(seen.firstToken).toBe(1);
    expect(seen.text).toHaveLength(2);
    expect(seen.voiceEnd).toBe(1);
  });

  it('sends the aside request on the free-conversation mode', async () => {
    const { promise } = run({ priorPairs: [{ question: 'Earlier?', answer: 'Earlier answer.', paragraphIndex: 2, spoken: true }] });
    await promise;

    const options = harness.generateCalls[0];
    expect(options.mode).toBe('free_conversation');
    expect(options.aside).toBe(true);
    expect(options.turnKind).toBe('aside');
    expect(options.language).toBe('en');
    expect(options.messages).toEqual([
      { role: 'assistant', content: 'He looked at the boy for a long time.' },
      { role: 'user', content: 'Earlier?' },
      { role: 'assistant', content: 'Earlier answer.' },
      { role: 'user', content: 'Why did he wait?' },
    ]);
  });

  it('loads the aside instructions only when the visitor brings a provider', async () => {
    await run().promise;
    expect(harness.calls.some((c) => c.startsWith('instructions:'))).toBe(false);
    expect(harness.generateCalls[0].instructions).toBe('');

    harness.calls.length = 0;
    harness.generateCalls.length = 0;
    harness.hasKey = true;
    await run().promise;

    expect(harness.calls).toContain('instructions:free_conversation:aside');
    expect(harness.generateCalls[0].instructions).toBe('system prompt for aurelius');
  });

  it('stops the voice by cancelling the jobs before dropping the audio', () => {
    askDriver.stopVoice();
    expect(harness.calls).toEqual(['cancelAll', 'cleanup']);
  });

  it('goes text-only for the rest of the session after an audio rate limit', async () => {
    window.dispatchEvent(new CustomEvent('audio-rate-limit', { detail: { hint: 'rate_limited' } }));

    const { promise, seen } = run();
    await promise;

    expect(harness.calls).toEqual(['generate']);
    expect(seen.text).toHaveLength(2);
    expect(seen.voiceEnd).toBe(1);
  });

  it('reads without speaking when the ask asked for text', async () => {
    const { promise, seen } = run({ speak: false });
    await promise;

    expect(harness.calls).toEqual(['generate']);
    expect(seen.firstToken).toBe(1);
    expect(seen.voiceEnd).toBe(1);
  });

  it('leaves a failure before the first token to the caller', async () => {
    harness.chunks = [];
    harness.generateError = new Error('model unreachable');

    const { promise, seen } = run();
    await expect(promise).rejects.toThrow('model unreachable');
    expect(seen.firstToken).toBe(0);
    expect(seen.voiceEnd).toBe(0);
  });

  it('ends the voice when the stream breaks after words have landed', async () => {
    harness.generateError = new Error('stream cut');

    const { promise, seen } = run();
    await expect(promise).rejects.toThrow('stream cut');
    expect(seen.firstToken).toBe(1);
    expect(seen.voiceEnd).toBe(1);
  });

  it('waits for the queue to drain before the voice counts as ended', async () => {
    harness.queueStatus = { ...harness.queueStatus, isPlaying: true, queueLength: 1, hasActiveQueue: true };

    const { promise, seen } = run();
    await promise;
    expect(seen.voiceEnd).toBe(0);

    harness.queueStatus = { ...harness.queueStatus, isPlaying: false, queueLength: 0, hasActiveQueue: false };
    window.dispatchEvent(new CustomEvent('audioEnd'));
    expect(seen.voiceEnd).toBe(1);
  });
});
