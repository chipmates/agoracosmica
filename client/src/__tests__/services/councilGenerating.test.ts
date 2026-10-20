// The council ends when its playback queue runs dry and generation is over.
// A slow stream (a local model, or text only) can leave the queue empty while
// the model is still writing; the council must wait for the next segment.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const harness = vi.hoisted(() => ({
  emitLater: null as null | (() => void),
}));

vi.mock('../../services/council/generator', () => ({
  default: {
    generateCouncil: vi.fn(async ({ onSegment }: { onSegment: (s: unknown) => void }) => {
      onSegment({ id: 0, speaker: 'ADA LOVELACE', speakerId: 'lovelace', content: 'Eins.', type: 'dialogue' });
      await new Promise<void>((resolve) => { harness.emitLater = resolve; });
      onSegment({ id: 1, speaker: 'ALBERT EINSTEIN', speakerId: 'einstein', content: 'Zwei.', type: 'dialogue' });
      return { success: true, segments: [], metadata: {} };
    }),
  },
}));

vi.mock('../../services/audio/voices', () => ({
  getVoicesForCouncil: () => ({}),
}));

import CustomCouncilService from '../../services/council/CustomCouncilService';

function mainService() {
  return {
    councilState: { isActive: true, participants: ['einstein'], question: 'Was ist ein gutes Leben?', moderator: 'lovelace', type: 'debate' as const },
    config: {},
    _getUserTTSSettings: () => ({ enabled: false }),
    _getUserLanguage: () => 'de',
    _notifyError: vi.fn(),
    _notifyCouncilLoaderChange: vi.fn(),
    _notifySpeakerChange: vi.fn(),
    _notifyCouncilMessage: vi.fn(),
    _notifyAudioPlaybackStart: vi.fn(),
    _getSpeakerId: (s: string) => s.toLowerCase(),
    _getEchoName: (id: string) => id,
    completeDebate: vi.fn(),
  };
}

describe('council playback while the stream still runs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    harness.emitLater = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for the next segment instead of ending the council', async () => {
    const main = mainService();
    const service = new CustomCouncilService(main as never);
    // TTS buffering is not under test here.
    (service as unknown as { _maintainSmartTTSBuffer: () => Promise<string> })._maintainSmartTTSBuffer = async () => '+0';

    const run = service.startCustomGeneration();
    // The first segment shows and its reading pause passes; the model is still writing.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(main._notifyCouncilMessage).toHaveBeenCalledTimes(1);
    expect(main.completeDebate).not.toHaveBeenCalled();

    harness.emitLater?.();
    await run;
    await vi.advanceTimersByTimeAsync(10_000);
    const shown = main._notifyCouncilMessage.mock.calls.map(([m]) => (m as { content: string }).content);
    expect(shown).toEqual(['Eins.', 'Zwei.']);
    expect(main.completeDebate).toHaveBeenCalledTimes(1);
  });

  it('ends the council when the stream is over and the queue is empty', async () => {
    const main = mainService();
    const service = new CustomCouncilService(main as never);
    (service as unknown as { _maintainSmartTTSBuffer: () => Promise<string> })._maintainSmartTTSBuffer = async () => '+0';

    const run = service.startCustomGeneration();
    await vi.advanceTimersByTimeAsync(10_000);
    harness.emitLater?.();
    await run;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(main.completeDebate).toHaveBeenCalledTimes(1);
  });
});

describe('council playback after a superseded generation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    harness.emitLater = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets a newer council keep waiting when an older stream ends', async () => {
    const main = mainService();
    const service = new CustomCouncilService(main as never);
    (service as unknown as { _maintainSmartTTSBuffer: () => Promise<string> })._maintainSmartTTSBuffer = async () => '+0';

    const first = service.startCustomGeneration();
    await vi.advanceTimersByTimeAsync(10_000);
    const finishFirst = harness.emitLater;
    const second = service.startCustomGeneration();
    await vi.advanceTimersByTimeAsync(10_000);
    finishFirst?.();
    await first;
    await vi.advanceTimersByTimeAsync(10_000);
    const ended = main.completeDebate.mock.calls.length;
    harness.emitLater?.();
    await second;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(ended).toBe(0);
    expect(main.completeDebate).toHaveBeenCalledTimes(1);
  });
});
