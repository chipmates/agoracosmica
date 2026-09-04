// src/utils/askContext.ts
//
// The horizon of an ask: what the listener has heard, and nothing past it.
// Both helpers are pure so the spoiler boundary can be proven in a test.

/**
 * A paragraph that carries no words to answer from. Chapter text uses a lone
 * rule between scenes, which reaches the paragraph array as its own entry.
 */
const SEPARATOR_ONLY = /^[-*_\s–—]+$/;

/** Paragraphs are rejoined the way the chapter reads them, one blank line apart. */
const JOIN = '\n\n';

/**
 * Whole paragraphs backward from the paused one until the budget is spent.
 *
 * Backward because the free-tier adapter truncates a long assistant message
 * from the front: the paragraph they stopped on is the one that must survive.
 *
 * @param paragraphs Chapter paragraphs in reading order, separators included.
 * @param activeIndex Index of the paragraph the listener paused on.
 * @param maxChars Budget for the returned text.
 */
export function buildChapterWindow(
  paragraphs: string[],
  activeIndex: number,
  maxChars: number,
): string {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) return '';
  if (!Number.isFinite(maxChars) || maxChars <= 0) return '';

  const start = Math.min(Math.max(Math.floor(activeIndex), 0), paragraphs.length - 1);
  const kept: string[] = [];
  let used = 0;

  for (let i = start; i >= 0; i -= 1) {
    const paragraph = (paragraphs[i] ?? '').trim();
    if (!paragraph || SEPARATOR_ONLY.test(paragraph)) continue;

    const cost = kept.length === 0 ? paragraph.length : paragraph.length + JOIN.length;
    if (used + cost > maxChars) break;

    kept.push(paragraph);
    used += cost;
  }

  if (kept.length === 0) {
    // A single paragraph wider than the whole budget. Keeping its tail beats
    // answering with no chapter at all, and the tail is where they stopped.
    const paused = (paragraphs[start] ?? '').trim();
    return paused ? paused.slice(-maxChars) : '';
  }

  return kept.reverse().join(JOIN);
}

/**
 * The paragraph a listener is on when the chapter has no timestamps: the
 * elapsed fraction of the text, one paragraph back so the window never runs
 * ahead of what was actually spoken.
 */
export function indexWithoutTimestamps(time: number, duration: number, count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return 0;

  const raw = Math.floor((time / duration) * count) - 1;
  return Math.min(Math.max(raw, 0), count - 1);
}
