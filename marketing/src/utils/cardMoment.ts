// When the card on the public pages may ask: after a minute of story audio
// heard on a page with the story player, or at a poem's end on a page that
// shows poems. Nothing else raises it. Every count here lives in page memory:
// it survives the player's page changes in place and starts from nothing on a
// full page load.

/** Story audio heard before the card asks, in seconds of the story's own time. */
export const STORY_MOMENT_S = 60;

// A playhead step longer than this is a seek or a stall, not listening. Above
// the 0.375 s a 250 ms timeupdate carries at the player's top rate of 1.5.
const MAX_STORY_STEP_S = 4;

/** The parts of the player's state the moment reads. */
export interface StoryStateLike {
  queue: { figureId: string; lang: string } | null;
  current: number | null;
  status: string;
  time: number;
  readerOpen: boolean;
}

export interface StorySource {
  subscribe(listener: () => void): () => void;
  getState(): StoryStateLike;
}

let storySeconds = 0;

/** Seconds of story audio heard in this document so far. */
export function storySecondsHeard(): number {
  return storySeconds;
}

/**
 * Count the playhead's own distance while a story plays, from the player's
 * state, and call `onReach` once when the total passes the threshold. Wall
 * time never counts: a paused or stalled story adds nothing, a faster rate
 * reaches the minute sooner. Returns the detach.
 */
export function watchStorySeconds(
  source: StorySource,
  onReach: () => void,
  threshold: number = STORY_MOMENT_S
): () => void {
  let lastKey: string | null = null;
  let lastTime = 0;
  let done = false;
  let stop: () => void = () => {};
  const read = (): void => {
    if (done) return;
    const s = source.getState();
    const key = s.queue && s.current !== null ? `${s.queue.figureId}/${s.queue.lang}/${s.current}` : null;
    if (key !== null && key === lastKey && s.status === 'playing') {
      const step = s.time - lastTime;
      if (step > 0 && step <= MAX_STORY_STEP_S) storySeconds += step;
    }
    lastKey = key;
    lastTime = s.time;
    if (storySeconds >= threshold) {
      done = true;
      stop();
      onReach();
    }
  };
  stop = source.subscribe(read);
  read();
  return () => {
    done = true;
    stop();
  };
}

// ---- the poem's end -------------------------------------------------------

// The poem texts as the poem templates render them: the single poem pages and
// the sonnets (PoemPage.astro), the Blake, Rumi and sonnet collections
// (EssayStyles), and Dickinson's collection, whose text is one block with line
// breaks. A renamed class there silences the moment, so a test pins them.
export const POEM_TEXT_SELECTOR = '.pm-poem__text, .esy-poem__text, .ed-poem__text';
const POEM_LINE_SELECTOR = '.pm-poem__line, .esy-poem__line';

// A visitor needs time to read the lines above the last one before its being
// in view means anything (a short poem can stand whole on the first screen).
// Two seconds a verse line, from eight to forty-five seconds of visible page.
const READ_S_PER_LINE = 2;
const READ_MIN_S = 8;
const READ_MAX_S = 45;

export function poemReadMs(lines: number): number {
  const seconds = Math.min(READ_MAX_S, Math.max(READ_MIN_S, READ_S_PER_LINE * lines));
  return seconds * 1000;
}

export interface PoemEnd {
  /** The last verse line's box, or null while it is not rendered (a closed fold). */
  lastLine(): DOMRect | null;
  lines: number;
}

function boxOf(el: Element): DOMRect | null {
  const box = el.getBoundingClientRect();
  return box.height > 0 ? box : null;
}

// Dickinson's collection prints each poem as one text with line breaks: the
// last line's box comes from a range over its characters.
function lastTextLineBox(el: Element): DOMRect | null {
  const doc = el.ownerDocument;
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.data.trim()) last = node;
  }
  if (!last) return null;
  const text = last.data.replace(/\s+$/, '');
  try {
    const range = doc.createRange();
    range.setStart(last, text.lastIndexOf('\n') + 1);
    range.setEnd(last, text.length);
    const boxes = range.getClientRects();
    const box = boxes.length ? boxes[boxes.length - 1] : null;
    return box && box.height > 0 ? box : null;
  } catch {
    return null; // no layout to read: the moment simply does not come
  }
}

export function findPoemEnds(root: ParentNode): PoemEnd[] {
  const ends: PoemEnd[] = [];
  root.querySelectorAll(POEM_TEXT_SELECTOR).forEach((text) => {
    const lineEls = Array.from(text.querySelectorAll(POEM_LINE_SELECTOR));
    const last = lineEls[lineEls.length - 1];
    if (last) {
      const lines = lineEls.filter((l) => (l.textContent ?? '').trim()).length;
      ends.push({ lastLine: () => boxOf(last), lines });
      return;
    }
    const lines = (text.textContent ?? '').split('\n').filter((l) => l.trim()).length;
    if (lines) ends.push({ lastLine: () => lastTextLineBox(text), lines });
  });
  return ends;
}

function wholeInView(box: DOMRect | null, height: number): boolean {
  return !!box && box.top >= 0 && box.bottom <= height;
}

// Re-checks the layout when nothing scrolls: a fold opened by keyboard, the
// fonts arriving, the reading time running out.
const POEM_CHECK_MS = 1000;

/**
 * Call `onReach` once a poem's last line has been wholly in view and the page
 * has been visible for that poem's reading time. The callback gets the line's
 * box reader, so the card can keep clear of it. Returns the detach.
 */
export function watchPoemEnd(
  win: Window,
  ends: PoemEnd[],
  onReach: (line: () => DOMRect | null) => void
): () => void {
  const doc = win.document;
  const now = (): number => win.performance.now();
  let bankedMs = 0;
  let visibleSince = doc.visibilityState === 'hidden' ? -1 : now();
  let reached: { needMs: number; line: () => DOMRect | null } | null = null;
  let done = false;

  const visibleMs = (): number => bankedMs + (visibleSince >= 0 ? now() - visibleSince : 0);

  function check(): void {
    if (done || doc.visibilityState === 'hidden') return;
    for (const end of ends) {
      const needMs = poemReadMs(end.lines);
      if (reached && reached.needMs <= needMs) continue;
      if (wholeInView(end.lastLine(), win.innerHeight)) reached = { needMs, line: end.lastLine };
    }
    if (reached && visibleMs() >= reached.needMs) {
      const line = reached.line;
      detach();
      onReach(line);
    }
  }

  function onVisibility(): void {
    if (doc.visibilityState === 'hidden') {
      if (visibleSince >= 0) bankedMs += now() - visibleSince;
      visibleSince = -1;
    } else if (visibleSince < 0) {
      visibleSince = now();
      check();
    }
  }

  const timer = win.setInterval(check, POEM_CHECK_MS);
  win.addEventListener('scroll', check, { passive: true });
  win.addEventListener('resize', check);
  doc.addEventListener('toggle', check, true);
  doc.addEventListener('visibilitychange', onVisibility);

  function detach(): void {
    if (done) return;
    done = true;
    win.clearInterval(timer);
    win.removeEventListener('scroll', check);
    win.removeEventListener('resize', check);
    doc.removeEventListener('toggle', check, true);
    doc.removeEventListener('visibilitychange', onVisibility);
  }

  check();
  return detach;
}

// ---- keeping clear --------------------------------------------------------

/** True when two boxes share an area (touching edges do not count). */
export function boxesOverlap(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom &&
    a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0;
}
