import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface Sent { step?: string; event?: string; bucket?: number; mode?: string; type?: string }
const sent: Sent[] = [];

vi.stubGlobal('fetch', vi.fn((_url: string, init: { body: string }) => {
  sent.push(JSON.parse(init.body));
  return Promise.resolve({ ok: true });
}));

import {
  listenBucket,
  listenTrackKey,
  noteListenPlay,
  noteListenPause,
  noteListenProgress,
  noteListenEnded,
} from '../../utils/playbackBeacon';

const ctx = { type: 'story' as const, figureId: 'aurelius', mode: 'story' };

describe('listenBucket', () => {
  it('maps seconds to the six documented buckets', () => {
    expect(listenBucket(0)).toBe(0);
    expect(listenBucket(14.9)).toBe(0);
    expect(listenBucket(15)).toBe(1);
    expect(listenBucket(59)).toBe(1);
    expect(listenBucket(60)).toBe(2);
    expect(listenBucket(179)).toBe(2);
    expect(listenBucket(180)).toBe(3);
    expect(listenBucket(599)).toBe(3);
    expect(listenBucket(600)).toBe(4);
    expect(listenBucket(1799)).toBe(4);
    expect(listenBucket(1800)).toBe(5);
    expect(listenBucket(99999)).toBe(5);
  });
});

describe('listen tracker', () => {
  beforeEach(() => {
    sent.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('fires each quarter once and completes a track heard through', () => {
    const key = listenTrackKey(ctx, 'https://media/a.mp3');
    noteListenPlay(key, ctx);
    // 200s track, sampled every 10s of wall clock at the matching position.
    for (let t = 5; t <= 200; t += 5) {
      vi.advanceTimersByTime(5000);
      noteListenProgress(key, t, 200);
    }
    vi.advanceTimersByTime(1000);
    noteListenEnded(key, 200, 200);

    const events = sent.map((s) => s.event);
    expect(events.filter((e) => e === 'progress_25')).toHaveLength(1);
    expect(events.filter((e) => e === 'progress_50')).toHaveLength(1);
    expect(events.filter((e) => e === 'progress_75')).toHaveLength(1);
    expect(events.indexOf('progress_25')).toBeLessThan(events.indexOf('progress_50'));
    const terminal = sent.filter((s) => s.event === 'completed' || s.event === 'ended');
    expect(terminal).toHaveLength(1);
    expect(terminal[0].event).toBe('completed');
    expect(terminal[0].bucket).toBe(3); // ~200s heard
    // The engaged listened arm rode along with the first quarter.
    expect(sent.filter((s) => s.step === 'engaged').map((s) => s.mode)).toEqual(['listened']);
  });

  it('ends short and buckets only what was heard', () => {
    const key = listenTrackKey(ctx, 'https://media/b.mp3');
    noteListenPlay(key, ctx);
    for (let t = 5; t <= 40; t += 5) {
      vi.advanceTimersByTime(5000);
      noteListenProgress(key, t, 600);
    }
    noteListenEnded(key, 40, 600);
    const terminal = sent.filter((s) => s.event === 'completed' || s.event === 'ended');
    expect(terminal).toHaveLength(1);
    expect(terminal[0].event).toBe('ended');
    expect(terminal[0].bucket).toBe(1); // 15-59s
  });

  it('writes nothing terminal below the noise floor', () => {
    const key = listenTrackKey(ctx, 'https://media/c.mp3');
    noteListenPlay(key, ctx);
    vi.advanceTimersByTime(5000);
    noteListenProgress(key, 5, 600);
    noteListenEnded(key, 5, 600);
    expect(sent.filter((s) => s.event === 'completed' || s.event === 'ended')).toHaveLength(0);
  });

  it('stops the clock while paused, so a seek buys no seconds', () => {
    const key = listenTrackKey(ctx, 'https://media/d.mp3');
    noteListenPlay(key, ctx);
    for (let t = 5; t <= 20; t += 5) {
      vi.advanceTimersByTime(5000);
      noteListenProgress(key, t, 600);
    }
    noteListenPause(key);
    vi.advanceTimersByTime(600000); // ten minutes paused
    noteListenPlay(key, ctx);
    vi.advanceTimersByTime(1000);
    noteListenProgress(key, 21, 600);
    noteListenEnded(key, 21, 600);
    const terminal = sent.filter((s) => s.event === 'ended');
    expect(terminal[0].bucket).toBe(1); // ~21s, not ten minutes
  });

  it('seeking past a quarter still fires it, so the funnel stays monotone', () => {
    const key = listenTrackKey(ctx, 'https://media/e.mp3');
    noteListenPlay(key, ctx);
    vi.advanceTimersByTime(2000);
    noteListenProgress(key, 480, 600); // jumped to 80%
    const events = sent.map((s) => s.event);
    expect(events.filter((e) => e && e.startsWith('progress_'))).toEqual([
      'progress_25', 'progress_50', 'progress_75',
    ]);
  });
});
