// The story reader's reading count, rendered: while the reader's story is the player's story (playing, paused on
// its end card, or ended) its time is listening and no reading row is sent; the resume offer is not the player's
// story; a timing file that lands after the text does not end the reading.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import type { PlayerState, StoryQueue } from '../../../../marketing/src/player/types';
import type { StoryTiming, TextBlock } from '../../../../marketing/src/player/content';

const h = vi.hoisted(() => ({
  beacons: [] as Record<string, unknown>[],
  timing: null as null | ((t: Record<string, never>) => void),
  holdTiming: false,
}));

vi.mock('@client/utils/playbackBeacon', async (importOriginal) => {
  const real = await importOriginal<typeof import('@client/utils/playbackBeacon')>();
  return { ...real, sendPlaybackBeacon: (p: Record<string, unknown>) => { h.beacons.push(p); } };
});

// 400 words in four paragraphs: a quarter of 100 words, ten seconds at 600 words a minute.
const TEXT: TextBlock[] = [0, 1, 2, 3].map((index) => ({
  index,
  text: Array.from({ length: 10 }, () => 'One two three four five six seven eight nine ten.').join(' '),
  rule: false,
}));

vi.mock('../../../../marketing/src/player/content', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../marketing/src/player/content')>();
  return {
    ...real,
    loadText: () => Promise.resolve(TEXT),
    loadTiming: () => (h.holdTiming
      ? new Promise<StoryTiming>((resolve) => { h.timing = resolve; })
      : Promise.resolve({})),
    loadFacts: () => Promise.resolve({ stories: new Map() }),
  };
});

const { default: StoryReader } = await import('../../../../marketing/src/player/StoryReader');

// Each case its own figure: the count keeps a story's steps for the page load.
let figureN = 0;
let QUEUE: StoryQueue;
let BASE: PlayerState;

function newFigure(): void {
  figureN += 1;
  const figureId = `test-figure-${figureN}`;
  QUEUE = {
    figureId,
    slug: figureId,
    lang: 'en',
    name: 'Test Figure',
    artwork: '',
    entries: [0, 1, 2].map((n) => ({ n, title: `Story ${n}`, minutes: 3, seconds: 180 })),
  };
  BASE = {
    queue: null, current: null, status: 'idle', time: 0, duration: 0, rate: 1, autoNext: true, resume: null,
    readerOpen: true, readerN: 1, readerQueue: QUEUE, dismissed: false, done: [], endCard: null, sheet: null,
    sheetN: null, away: false, awayDir: 'up', saved: [], sleep: 'off', sleepLeft: 0,
  };
}

const view = (state: PlayerState, n: number) => (
  <StoryReader state={state} queue={QUEUE} n={n} label={{ brief: 'Read', expanded: 'Read the story' }}
    factsWord="Facts" documentedWord="Documented" recreatedWord="Recreated" home="/test-figure/" selection="/" />
);

const reading = () => h.beacons.filter((b) => b.way === 'read').map((b) => `${b.chapter}:${b.event}`);

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

async function wait(seconds: number): Promise<void> {
  for (let i = 0; i < seconds; i++) {
    await act(async () => { vi.advanceTimersByTime(1000); });
  }
}

const realRect = Element.prototype.getBoundingClientRect;
const realScrollTo = Element.prototype.scrollTo;
const realScrollBy = Element.prototype.scrollBy;

beforeEach(() => {
  h.beacons = [];
  h.timing = null;
  h.holdTiming = false;
  newFigure();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
  // The whole text stands in one screen: every quarter in view, its last word reached.
  Element.prototype.getBoundingClientRect = () =>
    ({ top: 0, bottom: 1000, left: 0, right: 600, width: 600, height: 1000, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  Element.prototype.scrollTo = () => undefined;
  Element.prototype.scrollBy = () => undefined;
});

afterEach(() => {
  cleanup();
  Element.prototype.getBoundingClientRect = realRect;
  Element.prototype.scrollTo = realScrollTo;
  Element.prototype.scrollBy = realScrollBy;
  vi.useRealTimers();
});

describe('the reader counts reading only while its story is not in the player', () => {
  it('counts a read with nothing playing, the resume offer standing on the page', async () => {
    const state = { ...BASE, resume: { figureId: QUEUE.figureId, lang: QUEUE.lang, n: 1, t: 30 } };
    const r = render(view(state, 1));
    await settle();
    await wait(39);
    expect(reading()).toEqual(['1:started']);
    await wait(2);
    expect(reading()).toEqual(['1:started', '1:progress_25', '1:progress_50', '1:progress_75', '1:completed']);
    r.unmount();
    expect(reading()).toHaveLength(5);
  });

  it('a story heard to its end, its end card shown, then followed into the next story: no reading row', async () => {
    const playing = { ...BASE, queue: QUEUE, current: 1, status: 'playing' as const, time: 170, duration: 180 };
    const r = render(view(playing, 1));
    await settle();
    await wait(10);
    const ended = { ...playing, status: 'paused' as const, time: 180, endCard: { n: 1, next: 2, left: 5 } };
    r.rerender(view(ended, 1));
    await wait(5);
    // the reader follows the voice: the next story loads, the view opens on it
    const next = { ...ended, current: 2, status: 'loading' as const, time: 0, endCard: null };
    r.rerender(view(next, 1));
    r.rerender(view({ ...next, readerN: 2 }, 2));
    await settle();
    await wait(3);
    r.rerender(view({ ...next, readerN: 2, status: 'playing' }, 2));
    await wait(5);
    r.unmount();
    expect(reading()).toEqual([]);
  });

  it('the last story heard to its end, the reader left open a minute, then closed: no reading row', async () => {
    const ended = { ...BASE, queue: QUEUE, current: 2, status: 'paused' as const, time: 180, duration: 180 };
    const r = render(view(ended, 2));
    await settle();
    await wait(60);
    r.unmount();
    expect(reading()).toEqual([]);
  });

  it('a timing file that lands after the text sends no skimmed while the text is read', async () => {
    h.holdTiming = true;
    const r = render(view(BASE, 1));
    await settle();
    await wait(3);
    expect(reading()).toEqual(['1:started']);
    await act(async () => {
      h.timing?.({});
      for (let i = 0; i < 5; i++) await Promise.resolve();
    });
    await wait(1);
    expect(reading()).toEqual(['1:started']);
    await wait(37);
    expect(reading()).toEqual(['1:started', '1:progress_25', '1:progress_50', '1:progress_75', '1:completed']);
    r.unmount();
    expect(reading()).toHaveLength(5);
  });
});
