// The resume fade. An animation-frame timestamp that predates the call which
// scheduled it used to drive the ratio negative, which throws on `volume` and
// left the chapter playing at zero for the rest of the track: a resume the
// listener saw happen and never heard.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rampVolumeIn } from '../../components/StoryAudioPlayer';

/** An element that refuses an out-of-range volume the way a media element does. */
function fakeElement(): HTMLAudioElement {
  let value = 1;
  return {
    get volume(): number {
      return value;
    },
    set volume(next: number) {
      if (!(next >= 0 && next <= 1)) {
        throw new DOMException(`The volume provided (${next}) is outside the range [0, 1].`, 'IndexSizeError');
      }
      value = next;
    },
  } as HTMLAudioElement;
}

/** A frame clock the test drives by hand, so the timestamps are the test's. */
function frameClock() {
  let pending: FrameRequestCallback | null = null;
  let nextId = 1;
  const raf = vi.fn((cb: FrameRequestCallback) => {
    pending = cb;
    return nextId++;
  });
  const cancel = vi.fn(() => {
    pending = null;
  });
  return {
    raf,
    cancel,
    frame: (now: number) => {
      const cb = pending;
      pending = null;
      cb?.(now);
    },
    pendingFrames: () => (pending ? 1 : 0),
  };
}

describe('rampVolumeIn', () => {
  let clock: ReturnType<typeof frameClock>;

  beforeEach(() => {
    clock = frameClock();
    vi.stubGlobal('requestAnimationFrame', clock.raf);
    vi.stubGlobal('cancelAnimationFrame', clock.cancel);
    vi.spyOn(performance, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reaches full level when the first frame predates the call', () => {
    const element = fakeElement();
    rampVolumeIn(element, 300);
    expect(element.volume).toBe(0);

    // The frame the browser hands back is stamped before performance.now() was
    // read: the old ramp threw here and never scheduled another frame.
    expect(() => clock.frame(980)).not.toThrow();
    expect(element.volume).toBe(0);

    clock.frame(1130);
    expect(element.volume).toBeCloseTo(0.5, 5);

    clock.frame(1280);
    expect(element.volume).toBe(1);
    expect(clock.pendingFrames()).toBe(0);
  });

  it('rises from zero to full over the ramp and then stops asking for frames', () => {
    const element = fakeElement();
    rampVolumeIn(element, 300);

    clock.frame(1000);
    expect(element.volume).toBe(0);
    clock.frame(1075);
    expect(element.volume).toBeCloseTo(0.25, 5);
    clock.frame(1300);
    expect(element.volume).toBe(1);
    expect(clock.pendingFrames()).toBe(0);
  });

  it('never overshoots when a frame lands long after the ramp', () => {
    const element = fakeElement();
    rampVolumeIn(element, 300);
    clock.frame(1000);
    expect(() => clock.frame(60000)).not.toThrow();
    expect(element.volume).toBe(1);
  });

  it('stops on demand and leaves no frame behind', () => {
    const element = fakeElement();
    const stop = rampVolumeIn(element, 300);
    clock.frame(1000);
    stop();
    expect(clock.cancel).toHaveBeenCalled();
    expect(clock.pendingFrames()).toBe(0);
    stop();
  });
});
