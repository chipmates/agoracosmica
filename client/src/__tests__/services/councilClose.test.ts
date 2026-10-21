// Closing a council stops its stream at once. The stop then runs through the
// generator's failure path, so the service has to tell a stop from a fault:
// a council the visitor closed, or one a newer council replaced, reports no
// error. A real fault still does.
import { describe, it, expect, vi, afterEach } from 'vitest';

const harness = vi.hoisted(() => ({
  fail: null as null | (() => void),
}));

vi.mock('../../services/council/generator', () => ({
  default: {
    generateCouncil: vi.fn(({ signal }: { signal?: AbortSignal }) => new Promise((resolve) => {
      // The real generator turns a stopped read into this result.
      signal?.addEventListener('abort', () => resolve({ success: false, error: 'LLM call failed: The reply was stopped' }), { once: true });
      harness.fail = () => resolve({ success: false, error: 'LLM call failed: Request failed: 503' });
    })),
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('a council stopped while it streams', () => {
  afterEach(() => {
    harness.fail = null;
  });

  it('ends quietly when the visitor closes it', async () => {
    const main = mainService();
    const service = new CustomCouncilService(main as never);
    const run = service.startCustomGeneration();
    await settle();

    service.cleanup();
    const result = await run;

    expect(result).toMatchObject({ success: true, stopped: true });
    expect(main._notifyError).not.toHaveBeenCalled();
  });

  it('ends quietly when a newer council replaces it, and leaves the newer loader alone', async () => {
    const main = mainService();
    const service = new CustomCouncilService(main as never);
    const first = service.startCustomGeneration();
    await settle();

    const second = service.startCustomGeneration();
    const firstResult = await first;
    await settle();

    expect(firstResult).toMatchObject({ success: true, stopped: true });
    expect(main._notifyError).not.toHaveBeenCalled();
    const calls = main._notifyCouncilLoaderChange.mock.calls;
    const loader = calls[calls.length - 1]?.[0] as { isVisible: boolean };
    expect(loader.isVisible).toBe(true);

    service.cleanup();
    await second;
  });

  it('still reports a real fault', async () => {
    const main = mainService();
    const service = new CustomCouncilService(main as never);
    const run = service.startCustomGeneration();
    await settle();

    harness.fail?.();
    const result = await run;

    expect(result.success).toBe(false);
    expect(main._notifyError).toHaveBeenCalledTimes(1);
  });
});
