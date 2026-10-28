// Two anonymous counts on the pages with the story player, for every visitor:
// a story started (its first play in this page load) and a story heard for 30
// seconds (once per story per page load). Each item of the player counts as a
// story, the introduction too. The seconds are the card's own: the playhead's
// distance while the item plays, a seek or a stall dropped (cardMoment.ts).
// Each row carries the figure and, for an undecided grant arrival, the card's
// arm. Everything lives in page memory: nothing is stored, nothing read back.

import { probeField } from '@client/utils/probeSession';
import { cardArm, onProductionHost } from './heardSeconds';
import { MAX_STORY_STEP_S, storyKey } from './cardMoment';
import type { StorySource } from './cardMoment';

/** Seconds of one story heard before it counts as heard. */
export const STORY_HEARD_S = 30;

// Absolute on purpose: agoracosmica.org has no /v1/* route, so a relative path
// would fall through the SPA fallback and never reach the worker.
const FUNNEL_URL = 'https://llm.agoracosmica.org/v1/funnel';

/** One keyless funnel row, from the production hosts only. Fire and forget. */
export function postCount(row: Record<string, unknown>): void {
  if (!onProductionHost()) return;
  try {
    // JSON drops an undefined field, so an unmarked browser sends no probe and
    // a visitor without an arm sends no label.
    const body = JSON.stringify({ ...row, probe: probeField() });
    // sendBeacon survives a navigation that follows; text/plain keeps it a
    // simple CORS request, so no preflight gets lost on the way out.
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(FUNNEL_URL, new Blob([body], { type: 'text/plain' }))
    ) {
      return;
    }
    fetch(FUNNEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* never surface */
    });
  } catch {
    /* same posture */
  }
}

type StoryStep = 'story_started' | 'story_heard';

let watching = false;
const started = new Set<string>();
const heard = new Set<string>();
const seconds = new Map<string, number>();

/**
 * Count the player's stories for this page load. Installed once per document:
 * the player's module, and with it this one, lives across its page changes in
 * place. Returns the detach.
 */
export function watchListens(source: StorySource, post: (row: Record<string, unknown>) => void = postCount): () => void {
  if (watching) return () => {};
  watching = true;
  let lastKey: string | null = null;
  let lastTime = 0;
  const send = (step: StoryStep, figureId: string, lang: string): void => {
    post({ step, figureId, language: lang, mode: cardArm() ?? undefined });
  };
  const read = (): void => {
    const s = source.getState();
    const key = storyKey(s);
    if (key !== null && s.queue && s.status === 'playing') {
      const { figureId, lang } = s.queue;
      if (!started.has(key)) {
        started.add(key);
        send('story_started', figureId, lang);
      }
      if (key === lastKey && !heard.has(key)) {
        const step = s.time - lastTime;
        if (step > 0 && step <= MAX_STORY_STEP_S) {
          const total = (seconds.get(key) ?? 0) + step;
          seconds.set(key, total);
          if (total >= STORY_HEARD_S) {
            heard.add(key);
            send('story_heard', figureId, lang);
          }
        }
      }
    }
    lastKey = key;
    lastTime = s.time;
  };
  const stop = source.subscribe(read);
  read();
  return () => {
    watching = false;
    stop();
  };
}
