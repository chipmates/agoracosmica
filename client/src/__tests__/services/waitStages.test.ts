// The waiting cards read the stage to know what a wait is on. A recording is
// 'hearing' only until its transcript is back; a council is 'generating' until
// its first speech is written, and 'streaming' (waiting for the first voice)
// after that.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  stageDuringTranscription: null as string | null,
  releaseFirst: null as null | (() => void),
}));

vi.mock('../../services/audio/stt', () => ({
  transcribeAudio: vi.fn(async () => {
    const { useDomainStore } = await import('../../stores');
    h.stageDuringTranscription = useDomainStore.getState().conversation.processingStage;
    return { text: 'Was ist Freiheit?' };
  }),
}));
vi.mock('../../services/council/generator', () => ({
  default: {
    generateCouncil: vi.fn(async ({ onSegment }: { onSegment: (s: unknown) => void }) => {
      await new Promise<void>((resolve) => { h.releaseFirst = resolve; });
      onSegment({ id: 0, speaker: 'ADA LOVELACE', speakerId: 'lovelace', content: 'Eins.', type: 'dialogue' });
      return { success: true, segments: [], metadata: {} };
    }),
  },
}));
vi.mock('../../services/audio/voices', () => ({ getVoicesForCouncil: () => ({}) }));

import { processAudio } from '../../services/audioService';
import CustomCouncilService from '../../services/council/CustomCouncilService';
import { useDomainStore } from '../../stores';

describe('a recording is heard until its transcript is back', () => {
  beforeEach(() => {
    h.stageDuringTranscription = null;
    useDomainStore.getState().setProcessingStage(null);
  });

  it('hearing while it is transcribed, the model\'s wait once the words are in', async () => {
    const result = await processAudio(new Blob(['x'], { type: 'audio/webm' }), { skipLLM: true });
    expect(result.transcription).toBe('Was ist Freiheit?');
    expect(h.stageDuringTranscription).toBe('hearing');
    expect(useDomainStore.getState().conversation.processingStage).toBe('preparing');
  });

  it('leaves a stage it did not set alone (the visitor chose to read meanwhile)', async () => {
    const { transcribeAudio } = await import('../../services/audio/stt');
    vi.mocked(transcribeAudio).mockImplementationOnce(async () => {
      useDomainStore.getState().setProcessingStage(null);
      return { text: 'Was ist Freiheit?' } as never;
    });
    await processAudio(new Blob(['x'], { type: 'audio/webm' }), { skipLLM: true });
    expect(useDomainStore.getState().conversation.processingStage).toBeNull();
  });
});

describe('a council waits on the model, then on the first voice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.releaseFirst = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays generating until the first speech is written', async () => {
    const stages: string[] = [];
    const main = {
      councilState: { isActive: true, participants: ['einstein'], question: 'Was ist ein gutes Leben?', moderator: 'lovelace', type: 'debate' as const },
      config: {},
      _getUserTTSSettings: () => ({ enabled: false }),
      _getUserLanguage: () => 'de',
      _notifyError: vi.fn(),
      _notifyCouncilLoaderChange: vi.fn((state: { isVisible: boolean; stage: string }) => {
        if (state.isVisible) stages.push(state.stage);
      }),
      _notifySpeakerChange: vi.fn(),
      _notifyCouncilMessage: vi.fn(),
      _notifyAudioPlaybackStart: vi.fn(),
      _getSpeakerId: (s: string) => s.toLowerCase(),
      _getEchoName: (id: string) => id,
      completeDebate: vi.fn(),
    };
    const service = new CustomCouncilService(main as never);
    (service as unknown as { _maintainSmartTTSBuffer: () => Promise<string> })._maintainSmartTTSBuffer = async () => '+0';

    const run = service.startCustomGeneration();
    await vi.advanceTimersByTimeAsync(5_000);
    // The model has written nothing yet.
    expect(service.getCurrentLoaderState().stage).toBe('generating');
    expect(stages).not.toContain('streaming');

    h.releaseFirst?.();
    await vi.advanceTimersByTimeAsync(50);
    expect(stages).toContain('streaming');
    await run;
  });
});
