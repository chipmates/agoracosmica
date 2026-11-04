// The story reader's count: a quarter passes only after its words were on screen, in a visible tab, for the time
// they take at the ceiling rate, and once its last word came into view; an end reached faster sends one 'skimmed'.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  READ_CEILING_WPM,
  createReadingCount,
  domQuarters,
  quarterFloor,
  quarterWords,
} from '../../../../marketing/src/player/readingCount';
import type { QuarterView } from '../../../../marketing/src/player/readingCount';

let clock = 0;
let sent: string[] = [];
let keyN = 0;

/** A text of `total` words, read in `lang`, with the view and the clock in the test's hands. */
function reader(total = 1900, lang: 'en' | 'de' = 'en') {
  let view: QuarterView[] = [0, 1, 2, 3].map(() => ({ inView: false, reached: false }));
  let visible = true;
  let listening = false;
  keyN += 1;
  const count = createReadingCount({
    key: `test/${lang}/${keyN}`,
    words: quarterWords(total),
    lang,
    measure: () => view,
    visible: () => visible,
    listening: () => listening,
    send: (e) => sent.push(e),
    now: () => clock,
  });
  return {
    count,
    /** The screen shows quarter `q` (its words in view), its last word reached when `end` is true. */
    show(q: number, end = false) {
      view = view.map((v, i) => ({ inView: i === q, reached: v.reached || i < q || (i === q && end) }));
    },
    hide: (h: boolean) => { visible = !h; },
    listen: (l: boolean) => { listening = l; },
    /** `seconds` of wall time in one-second ticks. */
    wait(seconds: number) {
      for (let i = 0; i < seconds; i++) {
        clock += 1000;
        count.tick();
      }
    },
  };
}

beforeEach(() => {
  clock = 0;
  sent = [];
});

describe('the floors', () => {
  it('600 words a minute in English, German scaled by the silent rates 260 to 236', () => {
    expect(READ_CEILING_WPM.en).toBe(600);
    expect(READ_CEILING_WPM.de).toBe(661);
    expect(quarterWords(1900)).toEqual([475, 475, 475, 475]);
    expect(quarterWords(1901).reduce((a, b) => a + b, 0)).toBe(1901);
    expect(quarterFloor(475, 'en')).toBeCloseTo(47.5, 5);
    expect(quarterFloor(475, 'de')).toBeCloseTo(43.1, 1);
  });
});

describe('reading a story', () => {
  it('a slow read passes each quarter, in the order read, and the end last', () => {
    const r = reader();
    for (let q = 0; q < 4; q++) {
      r.show(q);
      r.wait(60);
      r.show(q, true);
      r.wait(1);
    }
    r.count.flush();
    expect(sent).toEqual(['started', 'progress_25', 'progress_50', 'progress_75', 'completed']);
  });

  it('a fast scroll passes no quarter and sends one skimmed', () => {
    const r = reader();
    for (let q = 0; q < 4; q++) {
      r.show(q);
      r.wait(2);
      r.show(q, true);
      r.wait(1);
    }
    r.count.flush();
    r.count.flush();
    expect(sent).toEqual(['started', 'skimmed']);
  });

  it('the end only after the last quarter\'s floor: reached early, it passes when its time is in', () => {
    const r = reader();
    r.show(3, true);
    r.wait(47);
    expect(sent).toEqual(['started']);
    r.wait(1);
    expect(sent).toEqual(['started', 'completed']);
    r.count.flush();
    expect(sent).toEqual(['started', 'completed']);
  });

  it('time in view is not enough without the quarter\'s last word, and German passes sooner', () => {
    const en = reader(1900, 'en');
    en.show(0);
    en.wait(120);
    expect(sent).toEqual(['started']);
    en.show(0, true);
    en.wait(1);
    expect(sent).toEqual(['started', 'progress_25']);
    sent = [];
    const de = reader(1900, 'de');
    de.show(0, true);
    de.wait(44);
    expect(sent).toEqual(['started', 'progress_25']);
  });

  it('a hidden tab and a story playing in the reader add no time', () => {
    const r = reader();
    r.show(0, true);
    r.hide(true);
    r.wait(100);
    r.hide(false);
    r.listen(true);
    r.wait(100);
    expect(sent).toEqual([]);
    r.listen(false);
    r.wait(48);
    expect(sent).toEqual(['started', 'progress_25']);
  });

  it('a held-back timer adds at most two seconds a tick', () => {
    const r = reader();
    r.show(0, true);
    clock += 60_000;
    r.count.tick();
    expect(sent).toEqual(['started']);
  });

  it('nothing is sent while no words are on screen, and a skim needs the end in view', () => {
    const r = reader();
    r.wait(30);
    r.count.flush();
    expect(sent).toEqual([]);
    r.show(1, true);
    r.wait(2);
    r.count.flush();
    expect(sent).toEqual(['started']);
  });

  it('a reader opened again on the same story counts each step once per page load', () => {
    const key = 'again/en/1';
    const view: QuarterView[] = [0, 1, 2, 3].map((q) => ({ inView: q === 0, reached: q === 0 }));
    const open = () => createReadingCount({
      key, words: quarterWords(1900), lang: 'en', measure: () => view,
      visible: () => true, listening: () => false, send: (e) => sent.push(e), now: () => clock,
    });
    const first = open();
    for (let i = 0; i < 30; i++) { clock += 1000; first.tick(); }
    const second = open();
    for (let i = 0; i < 20; i++) { clock += 1000; second.tick(); }
    expect(sent).toEqual(['started', 'progress_25']);
  });
});

describe('the view of the quarters in the page', () => {
  it('reads each quarter off the words the page shows, against the scroll box', () => {
    const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 10, width: 10, height: bottom - top, x: 0, y: top }) as DOMRect;
    const box = document.createElement('div');
    box.getBoundingClientRect = () => rect(100, 500);
    // Eight shown words, two a quarter, one every 100 px from y = 0: the box shows y 100 to 500.
    const spans = Array.from({ length: 8 }, (_, i) => {
      const el = document.createElement('span');
      el.getBoundingClientRect = () => rect(i * 100, i * 100 + 20);
      return el;
    });
    expect(domQuarters(box, spans)()).toEqual([
      { inView: true, reached: true },
      { inView: true, reached: true },
      { inView: true, reached: false },
      { inView: false, reached: false },
    ]);
    expect(domQuarters(box, [])()).toEqual([0, 1, 2, 3].map(() => ({ inView: false, reached: false })));
  });
});
