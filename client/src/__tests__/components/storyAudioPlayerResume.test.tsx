// The resume contract between the player and its audio element: a position and
// a play request that arrive before the element has its metadata must be held,
// not dropped. The reading-position banner fires both on a cold mount, where
// the duration is still 0 and the element refuses a seek while it loads.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const audio = vi.hoisted(() => ({
  state: {
    isPlaying: false,
    isLoading: true,
    durationSeconds: 0,
    currentTimeSeconds: 0,
  },
  seek: vi.fn(),
  togglePlay: vi.fn(),
  order: [] as string[],
}));

vi.mock('../../hooks/useAudio', () => ({
  default: () => ({
    isPlaying: audio.state.isPlaying,
    isLoading: audio.state.isLoading,
    progress: 0,
    currentTime: '0:00',
    currentTimeSeconds: audio.state.currentTimeSeconds,
    duration: '0:00',
    durationSeconds: audio.state.durationSeconds,
    playbackRate: 1,
    togglePlay: (...args: unknown[]) => {
      audio.order.push('play');
      return audio.togglePlay(...args);
    },
    seek: (...args: unknown[]) => {
      audio.order.push('seek');
      return audio.seek(...args);
    },
    changePlaybackRate: vi.fn(),
    restart: vi.fn(),
    audioElement: null,
    audioRef: { current: null },
  }),
}));

vi.mock('../../hooks/useMediaSession', () => ({ useMediaSession: () => undefined }));

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    tString: (_key: string, fallback = '') => fallback,
    tNode: (key: string) => key,
    tArray: () => [],
  }),
}));

import StoryAudioPlayer from '../../components/StoryAudioPlayer';

const CHAPTER = 'https://example.invalid/aurelius_1_en.mp3';

function mount(props: Record<string, unknown> = {}) {
  const view = render(<StoryAudioPlayer audioUrl={CHAPTER} {...props} />);
  return {
    view,
    update: (next: Record<string, unknown>) =>
      view.rerender(<StoryAudioPlayer audioUrl={CHAPTER} {...props} {...next} />),
  };
}

/** Metadata arrives: the duration lands and the loading flag drops. */
function elementBecomesReady(update: (next: Record<string, unknown>) => void, props: Record<string, unknown>) {
  audio.state.isLoading = false;
  audio.state.durationSeconds = 800;
  update(props);
}

describe('StoryAudioPlayer resume requests', () => {
  beforeEach(() => {
    audio.state = { isPlaying: false, isLoading: true, durationSeconds: 0, currentTimeSeconds: 0 };
    audio.seek.mockClear();
    audio.togglePlay.mockClear();
    audio.order.length = 0;
  });

  it('holds a cold-mount seek and play until the element is ready, seek first', () => {
    const props = { seekToTime: 200, playRequest: 1 };
    const { update } = mount(props);

    // Nothing yet: no duration to turn 200 seconds into a position, and the
    // element would refuse the seek anyway.
    expect(audio.seek).not.toHaveBeenCalled();
    expect(audio.togglePlay).not.toHaveBeenCalled();

    // The caller clears its own target on the next tick. The request survives.
    update({ ...props, seekToTime: null });
    expect(audio.seek).not.toHaveBeenCalled();

    elementBecomesReady(update, { ...props, seekToTime: null });
    expect(audio.seek).toHaveBeenCalledTimes(1);
    expect(audio.seek.mock.calls[0][0]).toBeCloseTo(25, 5);
    expect(audio.togglePlay).toHaveBeenCalledTimes(1);
    expect(audio.order).toEqual(['seek', 'play']);
  });

  it('applies a seek and a play straight away on a ready element', () => {
    audio.state.isLoading = false;
    audio.state.durationSeconds = 800;
    const { update } = mount({ seekToTime: null, playRequest: 0 });

    update({ seekToTime: 400, playRequest: 1 });
    expect(audio.seek).toHaveBeenCalledTimes(1);
    expect(audio.seek.mock.calls[0][0]).toBeCloseTo(50, 5);
    expect(audio.order).toEqual(['seek', 'play']);
  });

  it('never replays a request it has already served', () => {
    audio.state.isLoading = false;
    audio.state.durationSeconds = 800;
    const { update } = mount({ seekToTime: null, playRequest: 0 });

    update({ seekToTime: 400, playRequest: 1 });
    update({ seekToTime: null, playRequest: 1 });
    update({ seekToTime: null, playRequest: 1 });
    expect(audio.seek).toHaveBeenCalledTimes(1);
    expect(audio.togglePlay).toHaveBeenCalledTimes(1);
  });

  it('seeks without playing when only a position is sent', () => {
    audio.state.isLoading = false;
    audio.state.durationSeconds = 800;
    const { update } = mount({ seekToTime: null });

    update({ seekToTime: 80 });
    expect(audio.seek).toHaveBeenCalledTimes(1);
    expect(audio.seek.mock.calls[0][0]).toBeCloseTo(10, 5);
    expect(audio.togglePlay).not.toHaveBeenCalled();
  });

  it('leaves a playing chapter alone when a resume arrives', () => {
    audio.state.isLoading = false;
    audio.state.durationSeconds = 800;
    audio.state.isPlaying = true;
    const { update } = mount({ seekToTime: null, playRequest: 0 });

    update({ seekToTime: 400, playRequest: 1 });
    expect(audio.seek).toHaveBeenCalledTimes(1);
    expect(audio.togglePlay).not.toHaveBeenCalled();
  });

  it('clamps a stored position that sits past the end of the chapter', () => {
    const props = { seekToTime: 9000, playRequest: 1 };
    const { update } = mount(props);
    elementBecomesReady(update, { ...props, seekToTime: null });
    expect(audio.seek.mock.calls[0][0]).toBe(100);
  });
});
