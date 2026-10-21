// "Read text instead" holds for the request it was chosen on. Words that arrive
// after the click are shown and never voiced; a greeting waiting on its voice
// shows its stored words at once and stops the voice being made.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const harness = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  defaultVoice: false,
  voiceSignal: null as AbortSignal | null,
  releaseReply: null as null | (() => void),
}));

const GREETING = 'Sei gegrüßt. Ich bin Marc Aurel. Worüber möchtest du sprechen?';
const REPLY = 'Freiheit beginnt im Inneren.';

vi.mock('../../services/audio/config/serviceConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/audio/config/serviceConfig')>();
  return {
    ...actual,
    loadServiceConfig: () => ({ ...actual.defaultConfig, localMode: { llmEnabled: true, ttsEnabled: true, sttEnabled: false } }),
  };
});

vi.mock('../../services/audio/instructionProcessor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/audio/instructionProcessor')>()),
  fetchInstructions: vi.fn(async () => 'system prompt'),
}));

vi.mock('../../services/audio/voices/voiceResolver', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/audio/voices/voiceResolver')>()),
  isUsingDefaultVoice: () => harness.defaultVoice,
}));

vi.mock('../../services/audio/initialMessageService', () => ({
  initialMessageService: {
    hasInitialMessage: () => true,
    // The visitor's own voice, slow: it answers only when its signal is not stopped first.
    getInitialMessageWithDynamicAudio: vi.fn((...args: unknown[]) => {
      harness.voiceSignal = (args[7] as AbortSignal | undefined) ?? null;
      return new Promise((resolve, reject) => {
        harness.voiceSignal?.addEventListener('abort', () => reject(new DOMException('stopped', 'AbortError')));
        setTimeout(() => resolve({ text: GREETING, audioUrl: 'blob:late', audioUrls: ['blob:late'], hasAudio: true }), 200);
      });
    }),
    getInitialMessage: vi.fn(async () => ({
      text: GREETING, audioUrl: 'https://media.example/greeting.mp3', audioUrls: ['https://media.example/greeting.mp3'], hasAudio: true,
    })),
  },
}));

// The model answers when the test lets it: the click comes first.
vi.mock('../../services/audio/llm', () => ({
  generateResponse: vi.fn(async ({ streamingCallback }: { streamingCallback?: (chunk: string) => Promise<void> }) => {
    await new Promise<void>((resolve) => { harness.releaseReply = resolve; });
    await streamingCallback?.(REPLY);
    return { response: REPLY };
  }),
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
}));

vi.mock('../../stores/domainStore', () => ({ useDomainStore: { getState: () => harness.state } }));
vi.mock('../../stores', () => ({ useDomainStore: { getState: () => harness.state } }));

import {
  createLegacyConversationStream,
  isGreetingRequest,
  readTextInstead,
} from '../../controllers/conversationStreamDriver';
import { convertTextToSpeech } from '../../services/audio/tts';
import { addToAudioQueue } from '../../services/audio/audioQueueManager';
import { initialMessageService } from '../../services/audio/initialMessageService';
import type { StreamConversationParams } from '../../controllers/conversationController';

function freeTalk() {
  harness.state = {
    figures: { selectedId: 'aurelius' },
    mode: { selected: 'free_conversation' },
    seeds: { selectedId: null, byFigure: { aurelius: [] } },
    language: { current: 'de' },
    conversation: { historyKey: 'thread-1', messages: [] },
    setProcessingStage: () => {},
  };
}

function run(requestId: string, messages: StreamConversationParams['messages']) {
  const shown: string[] = [];
  const stream = createLegacyConversationStream();
  const done = stream({
    threadKey: 'thread-1',
    messages,
    signal: new AbortController().signal,
    pushAssistantText: (text: string) => { shown.push(text); },
    requestId,
  } as unknown as StreamConversationParams);
  return { shown, done };
}

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

describe('after "Read text instead"', () => {
  beforeEach(() => {
    freeTalk();
    harness.defaultVoice = false;
    harness.voiceSignal = null;
    harness.releaseReply = null;
    vi.mocked(convertTextToSpeech).mockClear();
    vi.mocked(addToAudioQueue).mockClear();
    vi.mocked(initialMessageService.getInitialMessage).mockClear();
  });

  it('a reply whose words arrive after the click is shown, never voiced', async () => {
    const { shown, done } = run('reply-1', [{ role: 'user', content: 'Was ist Freiheit?' }] as never);
    await vi.waitFor(() => expect(harness.releaseReply).not.toBeNull());

    readTextInstead('reply-1');
    harness.releaseReply?.();
    await done;

    expect(shown.join(' ')).toContain('Freiheit beginnt');
    expect(convertTextToSpeech).not.toHaveBeenCalled();
    expect(addToAudioQueue).not.toHaveBeenCalled();
    expect(isGreetingRequest('reply-1')).toBe(false);
  });

  it('the next reply, not chosen to read, is voiced as before', async () => {
    const { done } = run('reply-2', [{ role: 'user', content: 'Und Pflicht?' }] as never);
    await vi.waitFor(() => expect(harness.releaseReply).not.toBeNull());
    harness.releaseReply?.();
    await done;
    await tick(10);
    expect(convertTextToSpeech).toHaveBeenCalled();
  });

  it('a greeting waiting on its own voice shows its words at once and the voice stops', async () => {
    const { shown, done } = run('greet-1', []);
    await vi.waitFor(() => expect(harness.voiceSignal).not.toBeNull());
    expect(isGreetingRequest('greet-1')).toBe(true);

    readTextInstead('greet-1');
    await done;

    expect(shown).toEqual([GREETING]);
    expect(harness.voiceSignal?.aborted).toBe(true);
    await tick(250);
    expect(addToAudioQueue).not.toHaveBeenCalled();
  });

  it('a greeting chosen to read before its stored clip is queued gets its words, no clip', async () => {
    harness.defaultVoice = true;
    let releaseText: () => void = () => {};
    vi.mocked(initialMessageService.getInitialMessage).mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => { releaseText = resolve; });
      return { text: GREETING, audioUrl: 'https://media.example/greeting.mp3', audioUrls: ['https://media.example/greeting.mp3'], hasAudio: true } as never;
    });
    const { shown, done } = run('greet-2', []);
    await vi.waitFor(() => expect(initialMessageService.getInitialMessage).toHaveBeenCalled());

    readTextInstead('greet-2');
    releaseText();
    await done;

    expect(shown).toEqual([GREETING]);
    expect(addToAudioQueue).not.toHaveBeenCalled();
  });

  it('a greeting nobody opted out of is voiced as before', async () => {
    const { shown, done } = run('greet-3', []);
    await done;
    expect(shown).toEqual([GREETING]);
    expect(addToAudioQueue).toHaveBeenCalledWith(expect.objectContaining({ url: 'blob:late' }));
  });
});
