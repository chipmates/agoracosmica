// The live council plays its buffer sources on the audio queue's shared
// context. The queue's idle suspend must not stop that context while a held
// source plays: a suspended source never fires 'ended' and the council stalls.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Queue = typeof import('../../services/audio/audioQueueManager');

function fakeContext() {
  const ctx = {
    state: 'running' as AudioContextState,
    suspend: vi.fn(async () => { ctx.state = 'suspended'; }),
    resume: vi.fn(async () => { ctx.state = 'running'; }),
  };
  return ctx;
}

// Empties the queue the way a finished or dropped clip does: the one queued
// file belongs to a session replaced while it waited, so it is skipped and the
// idle countdown starts.
async function goIdle(q: Queue, ctx: ReturnType<typeof fakeContext>): Promise<void> {
  let open!: () => void;
  const gate = new Promise<void>((resolve) => { open = resolve; });
  q.initAudioQueue(ctx as unknown as AudioContext, () => gate, document.createElement('audio'));
  q.setCurrentSession('a');
  q.addToAudioQueue({ name: 'a_1', url: 'blob:test-a-1' });
  q.setCurrentSession('b');
  open();
  await vi.advanceTimersByTimeAsync(0);
}

describe('audio queue: idle suspend and borrowed playback', () => {
  let q: Queue;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    q = await import('../../services/audio/audioQueueManager');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('suspends the shared context 30 s after the queue goes idle', async () => {
    const ctx = fakeContext();
    await goIdle(q, ctx);
    await vi.advanceTimersByTimeAsync(29_000);
    expect(ctx.suspend).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
  });

  it('does not suspend while a borrowed source holds the context', async () => {
    const ctx = fakeContext();
    await goIdle(q, ctx);
    const release = q.holdAudioContext();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ctx.suspend).not.toHaveBeenCalled();
    expect(ctx.state).toBe('running');

    // Released: the idle countdown starts again from the release.
    release();
    await vi.advanceTimersByTimeAsync(29_000);
    expect(ctx.suspend).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
  });

  it('counts each hold once, however often it is released', async () => {
    const ctx = fakeContext();
    await goIdle(q, ctx);
    const first = q.holdAudioContext();
    const second = q.holdAudioContext();
    first();
    first();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ctx.suspend).not.toHaveBeenCalled();
    second();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(ctx.suspend).toHaveBeenCalledTimes(1);
  });
});
