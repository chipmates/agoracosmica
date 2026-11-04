// Reading a story counted in the shape of listening to it: started, each quarter of the text, and the end, plus one
// 'skimmed' row for a text whose end was reached too fast. A quarter counts once its words were on screen, in a
// visible tab, for at least the time its words take at the ceiling rate below, and its last word has come into
// view. The clock stands while the story plays in the reader (that is listening). Everything lives in page memory.

import type { PlaybackEvent } from '@client/utils/playbackBeacon';
import type { PlayerLang } from './strings';

// Words a minute no reader passes and still reads: 600 in English (the mean is about 240, Brysbaert 2019), German
// scaled by the same paper's silent rates for the two languages (260 against 236 words a minute).
export const READ_CEILING_WPM: Readonly<Record<PlayerLang, number>> = { en: 600, de: Math.round((600 * 260) / 236) };

const QUARTER_EVENTS: readonly PlaybackEvent[] = ['progress_25', 'progress_50', 'progress_75', 'completed'];

// Longest slice one tick may add: a timer the browser held back is not time on the text.
const MAX_SLICE_S = 2;

/** Where each quarter stands in the view at one moment. */
export interface QuarterView {
  /** Some of the quarter's words are inside the reader's view. */
  inView: boolean;
  /** The quarter's last word is in view or above it. */
  reached: boolean;
}

export interface ReadingOptions {
  /** The story (figure, language, number): its counts go on across reopenings within the page load. */
  key: string;
  /** Word count of each quarter, in order. */
  words: readonly number[];
  lang: PlayerLang;
  measure: () => QuarterView[];
  /** The tab is visible. */
  visible: () => boolean;
  /** The story plays in the reader: its time is listening's. */
  listening: () => boolean;
  send: (event: PlaybackEvent | 'skimmed') => void;
  now?: () => number;
}

export interface ReadingCount {
  /** Add the time since the last tick to every quarter in view, and send what passed. */
  tick(): void;
  /** The reading may be over (the reader closes, the page hides): an end reached too fast says so, once. */
  flush(): void;
}

/** The four quarters' word counts of a text of `total` words. */
export function quarterWords(total: number): number[] {
  const cut = (q: number) => Math.round((total * q) / 4);
  return [0, 1, 2, 3].map(q => cut(q + 1) - cut(q));
}

/** Seconds a quarter of `words` words must be on screen in `lang`. */
export function quarterFloor(words: number, lang: PlayerLang): number {
  return (words / READ_CEILING_WPM[lang]) * 60;
}

interface Kept {
  seconds: number[];
  reached: boolean[];
  passed: boolean[];
  started: boolean;
  skimmed: boolean;
}

// One record per story for this page load, so a reader closed and opened again counts each step once.
const kept = new Map<string, Kept>();

export function createReadingCount(o: ReadingOptions): ReadingCount {
  const now = o.now ?? (() => Date.now());
  const floors = o.words.map(w => quarterFloor(w, o.lang));
  let k = kept.get(o.key);
  if (!k || k.seconds.length !== o.words.length) {
    k = { seconds: o.words.map(() => 0), reached: o.words.map(() => false), passed: o.words.map(() => false), started: false, skimmed: false };
    kept.set(o.key, k);
  }
  const { seconds, reached, passed } = k;
  const state = k;
  let last = now();

  return {
    tick() {
      const t = now();
      const slice = Math.min(MAX_SLICE_S, Math.max(0, (t - last) / 1000));
      last = t;
      if (!o.visible() || o.listening()) return;
      const view = o.measure();
      if (!view.some(v => v.inView)) return;
      if (!state.started) {
        state.started = true;
        o.send('started');
      }
      view.forEach((v, q) => {
        if (v.inView) seconds[q] = (seconds[q] ?? 0) + slice;
        if (v.reached) reached[q] = true;
        if (!passed[q] && reached[q] && seconds[q]! >= floors[q]!) {
          passed[q] = true;
          o.send(QUARTER_EVENTS[q]!);
        }
      });
    },
    flush() {
      const end = o.words.length - 1;
      if (state.skimmed || !reached[end] || passed[end]) return;
      state.skimmed = true;
      o.send('skimmed');
    },
  };
}

/**
 * The view of the reader's four quarters, read off the words the page shows (an introduction's heading is set apart
 * and has none), at each quarter's first and last word, against the scroll box.
 */
export function domQuarters(box: HTMLElement, spans: readonly HTMLElement[]): () => QuarterView[] {
  const words = quarterWords(spans.length);
  const firsts: number[] = [];
  words.reduce((at, w) => {
    firsts.push(at);
    return at + w;
  }, 0);
  return () => {
    const view = box.getBoundingClientRect();
    return words.map((w, q) => {
      const at = firsts[q] ?? 0;
      const first = spans[at]?.getBoundingClientRect();
      const lastWord = spans[at + w - 1]?.getBoundingClientRect();
      if (!first || !lastWord || w === 0) return { inView: false, reached: false };
      return {
        inView: first.top < view.bottom && lastWord.bottom > view.top,
        reached: lastWord.top < view.bottom,
      };
    });
  };
}
