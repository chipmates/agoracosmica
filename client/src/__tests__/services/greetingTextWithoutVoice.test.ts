// A greeting in a voice the visitor picked is spoken live. When that voice
// fails (the local voice is down, the hosted voice is paused), the stored
// greeting still shows as text, as the banner promises, and the conversation
// does not start empty.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const harness = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  localMode: { llmEnabled: false, ttsEnabled: true, sttEnabled: false } as Record<string, unknown>,
}));

const GREETING = 'Sei gegrüßt. Ich bin Marc Aurel. Worüber möchtest du sprechen?';

vi.mock('../../services/audio/config/serviceConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/audio/config/serviceConfig')>();
  return { ...actual, loadServiceConfig: () => ({ ...actual.defaultConfig, localMode: { ...harness.localMode } }) };
});

vi.mock('../../services/audio/instructionProcessor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/audio/instructionProcessor')>()),
  fetchInstructions: vi.fn(async () => 'system prompt'),
}));

vi.mock('../../services/audio/voices/voiceResolver', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/audio/voices/voiceResolver')>()),
  isUsingDefaultVoice: () => false,
}));

vi.mock('../../services/audio/initialMessageService', async () => {
  const { LocalModeTtsUnavailable } = await import('../../services/audio/tts/localModeTTS');
  return {
    initialMessageService: {
      hasInitialMessage: () => true,
      getInitialMessageWithDynamicAudio: vi.fn(async () => {
        throw new LocalModeTtsUnavailable('connect ECONNREFUSED', 'de', 'http://127.0.0.1:8887');
      }),
      getInitialMessage: vi.fn(async () => ({
        text: GREETING, audioUrl: 'https://media.example/greeting.mp3', audioUrls: ['https://media.example/greeting.mp3'], hasAudio: true,
      })),
    },
  };
});

vi.mock('../../services/audio/llm', () => ({ generateResponse: vi.fn(async () => ({ response: 'generated' })) }));

vi.mock('../../services/audio/tts', () => ({ convertTextToSpeech: vi.fn() }));

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

import { createLegacyConversationStream } from '../../controllers/conversationStreamDriver';
import { initialMessageService } from '../../services/audio/initialMessageService';
import { generateResponse } from '../../services/audio/llm';
import { addToAudioQueue } from '../../services/audio/audioQueueManager';
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

async function start(signal = new AbortController().signal): Promise<string[]> {
  const shown: string[] = [];
  const stream = createLegacyConversationStream();
  await stream({
    threadKey: 'thread-1',
    messages: [],
    signal,
    pushAssistantText: (text: string) => { shown.push(text); },
    requestId: 'greet-1',
  } as unknown as StreamConversationParams);
  return shown;
}

describe('a custom-voice greeting whose voice fails', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    freeTalk();
    harness.localMode = { llmEnabled: false, ttsEnabled: true, sttEnabled: false };
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(generateResponse).mockClear();
    vi.mocked(addToAudioQueue).mockClear();
    return () => warn.mockRestore();
  });

  it('Local Mode voice down: Free Talk shows the greeting as text, no voice, no model call', async () => {
    const shown = await start();

    expect(shown).toEqual([GREETING]);
    expect(vi.mocked(addToAudioQueue)).not.toHaveBeenCalled();
    expect(vi.mocked(generateResponse)).not.toHaveBeenCalled();
  });

  it('hosted voice paused: the same', async () => {
    harness.localMode = { llmEnabled: false, ttsEnabled: false, sttEnabled: false };
    vi.mocked(initialMessageService.getInitialMessageWithDynamicAudio).mockRejectedValueOnce(
      new Error('TTS circuit breaker open — text-only mode'),
    );

    const shown = await start();

    expect(shown).toEqual([GREETING]);
    expect(vi.mocked(generateResponse)).not.toHaveBeenCalled();
  });

  it('a conversation already left shows nothing', async () => {
    const leave = new AbortController();
    vi.mocked(initialMessageService.getInitialMessageWithDynamicAudio).mockImplementationOnce(async () => {
      leave.abort();
      throw new DOMException('The speech was stopped', 'AbortError');
    });

    const shown = await start(leave.signal);

    expect(shown).toEqual([]);
  });
});
