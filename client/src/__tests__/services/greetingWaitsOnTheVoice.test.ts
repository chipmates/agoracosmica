// A greeting's words are stored; what the visitor waits for is its voice. The
// waiting card reads the stage to know whose machine that wait is on, so the
// greeting says it waits for the voice, and only a greeting the model has to
// write waits on the model.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const harness = vi.hoisted(() => ({
  stages: [] as Array<string | null>,
  stageWhenVoiceAsked: undefined as string | null | undefined,
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
        harness.stageWhenVoiceAsked = harness.stages[harness.stages.length - 1] ?? null;
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
import type { StreamConversationParams } from '../../controllers/conversationController';

function freeTalk() {
  harness.state = {
    figures: { selectedId: 'aurelius' },
    mode: { selected: 'free_conversation' },
    seeds: { selectedId: null, byFigure: { aurelius: [] } },
    language: { current: 'de' },
    conversation: { historyKey: 'thread-1', messages: [] },
    setProcessingStage: (stage: string | null) => { harness.stages.push(stage); },
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

describe('the greeting tells the card what it waits for', () => {
  beforeEach(() => {
    freeTalk();
    harness.stages = [];
    harness.stageWhenVoiceAsked = undefined;
    harness.localMode = { llmEnabled: true, ttsEnabled: false, sttEnabled: false };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(generateResponse).mockClear();
  });

  it('a spoken greeting waits for the voice, not the model (model local, voice ours)', async () => {
    await start();
    expect(harness.stageWhenVoiceAsked).toBe('shaping');
  });

  it('the voice local, the model ours: the same wait, the voice', async () => {
    harness.localMode = { llmEnabled: false, ttsEnabled: true, sttEnabled: false };
    await start();
    expect(harness.stageWhenVoiceAsked).toBe('shaping');
  });

  it('a greeting with neither voice nor stored words leaves no wait on the voice behind', async () => {
    vi.mocked(initialMessageService.getInitialMessage).mockResolvedValueOnce(null as never);
    await start();
    expect(harness.stageWhenVoiceAsked).toBe('shaping');
    expect(harness.stages[harness.stages.length - 1] ?? null).not.toBe('shaping');
  });
});
