// Unit tests for the global audio-focus coordinator (issue #18).
//
// Invariant under test: only one registered *content* player sounds at a time.
// Starting one pauses the previous holder. Players that never register (UI
// sound effects, ambient loops, the autoplay primer) are never touched.

import { describe, it, expect, vi } from 'vitest';
import {
  registerContentPlayer,
  bindAudioElement,
} from '../../services/audio/audioFocus';

describe('audioFocus coordinator', () => {
  describe('registerContentPlayer (imperative API — councils)', () => {
    it('pauses the previous holder, and only that one, on each new claim', () => {
      const pauseA = vi.fn();
      const pauseB = vi.fn();
      const pauseC = vi.fn();
      const a = registerContentPlayer(pauseA);
      const b = registerContentPlayer(pauseB);
      const c = registerContentPlayer(pauseC);

      a.claim();
      expect(pauseA).not.toHaveBeenCalled(); // nothing was playing yet

      b.claim();
      expect(pauseA).toHaveBeenCalledTimes(1); // A yields to B
      expect(pauseB).not.toHaveBeenCalled(); // never pauses itself

      c.claim();
      expect(pauseB).toHaveBeenCalledTimes(1); // B yields to C
      expect(pauseA).toHaveBeenCalledTimes(1); // A not paused again — it was idle

      a.dispose();
      b.dispose();
      c.dispose();
    });

    it('treats a repeat claim by the current holder as a no-op', () => {
      const pauseA = vi.fn();
      const pauseB = vi.fn();
      const a = registerContentPlayer(pauseA);
      const b = registerContentPlayer(pauseB);

      a.claim();
      b.claim(); // pauses A once
      b.claim();
      b.claim();
      expect(pauseA).toHaveBeenCalledTimes(1);

      a.dispose();
      b.dispose();
    });

    it('does not pause a player that already released focus', () => {
      const pauseA = vi.fn();
      const pauseB = vi.fn();
      const a = registerContentPlayer(pauseA);
      const b = registerContentPlayer(pauseB);

      a.claim();
      a.release(); // A stopped on its own
      b.claim();
      expect(pauseA).not.toHaveBeenCalled(); // A already released — not re-paused

      a.dispose();
      b.dispose();
    });

    it('does not pause a disposed player', () => {
      const pauseA = vi.fn();
      const pauseB = vi.fn();
      const a = registerContentPlayer(pauseA);
      const b = registerContentPlayer(pauseB);

      a.claim();
      a.dispose(); // A torn down while it held focus
      b.claim();
      expect(pauseA).not.toHaveBeenCalled();

      b.dispose();
    });
  });

  describe('bindAudioElement (HTMLAudioElement API — story / prism / library / previews)', () => {
    function makeBound(): { el: HTMLAudioElement; pause: ReturnType<typeof vi.fn>; unbind: () => void } {
      const el = new Audio();
      const pause = vi.fn();
      // jsdom's play()/pause() are no-ops; spy on pause so we can assert the
      // coordinator called it. 'play'/'pause'/'ended' we dispatch by hand,
      // exactly as the browser would when playback actually starts/stops.
      el.pause = pause as unknown as HTMLAudioElement['pause'];
      const unbind = bindAudioElement(el);
      return { el, pause, unbind };
    }

    it('pauses the first element when a second starts playing', () => {
      const first = makeBound();
      const second = makeBound();

      first.el.dispatchEvent(new Event('play'));
      expect(second.pause).not.toHaveBeenCalled();

      second.el.dispatchEvent(new Event('play'));
      expect(first.pause).toHaveBeenCalledTimes(1);
      expect(second.pause).not.toHaveBeenCalled();

      first.unbind();
      second.unbind();
    });

    it('the reporter scenario: three clips in a row leave only the last sounding', () => {
      const a = makeBound();
      const b = makeBound();
      const c = makeBound();

      a.el.dispatchEvent(new Event('play'));
      b.el.dispatchEvent(new Event('play'));
      c.el.dispatchEvent(new Event('play'));

      expect(a.pause).toHaveBeenCalledTimes(1); // paused by B
      expect(b.pause).toHaveBeenCalledTimes(1); // paused by C
      expect(c.pause).not.toHaveBeenCalled(); // last one wins

      a.unbind();
      b.unbind();
      c.unbind();
    });

    it('a user-paused element releases focus and is not re-paused later', () => {
      const first = makeBound();
      first.el.dispatchEvent(new Event('play'));
      first.el.dispatchEvent(new Event('pause')); // user pauses first

      const second = makeBound();
      second.el.dispatchEvent(new Event('play'));
      expect(first.pause).not.toHaveBeenCalled(); // coordinator never paused first

      first.unbind();
      second.unbind();
    });

    it('leaves unregistered sfx / ambient audio completely alone', () => {
      const content = makeBound();

      const sfx = new Audio(); // a UI chime — never registered
      const sfxPause = vi.fn();
      sfx.pause = sfxPause as unknown as HTMLAudioElement['pause'];

      content.el.dispatchEvent(new Event('play'));
      sfx.dispatchEvent(new Event('play')); // exempt element plays alongside

      expect(content.pause).not.toHaveBeenCalled(); // content NOT paused by the chime
      expect(sfxPause).not.toHaveBeenCalled();

      content.unbind();
    });

    it('stops tracking an element after unbind', () => {
      const first = makeBound();
      const second = makeBound();
      second.unbind(); // second leaves the coordinator

      first.el.dispatchEvent(new Event('play'));
      second.el.dispatchEvent(new Event('play')); // no longer registered
      expect(first.pause).not.toHaveBeenCalled();

      first.unbind();
    });
  });

  describe('cross-API interplay (a council and a story share one coordinator)', () => {
    it('a council (imperative) interrupts a playing story (bound element)', () => {
      const story = (() => {
        const el = new Audio();
        const pause = vi.fn();
        el.pause = pause as unknown as HTMLAudioElement['pause'];
        return { el, pause, unbind: bindAudioElement(el) };
      })();
      const councilPause = vi.fn();
      const council = registerContentPlayer(councilPause);

      story.el.dispatchEvent(new Event('play'));
      council.claim(); // council starts a segment
      expect(story.pause).toHaveBeenCalledTimes(1);

      story.unbind();
      council.dispose();
    });

    it('a story (bound element) interrupts a playing council (imperative)', () => {
      const councilPause = vi.fn();
      const council = registerContentPlayer(councilPause);
      const el = new Audio();
      const storyPause = vi.fn();
      el.pause = storyPause as unknown as HTMLAudioElement['pause'];
      const unbind = bindAudioElement(el);

      council.claim(); // council playing
      el.dispatchEvent(new Event('play')); // user starts a story
      expect(councilPause).toHaveBeenCalledTimes(1);

      unbind();
      council.dispose();
    });
  });
});
