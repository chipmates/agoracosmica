// The twelve stories of one figure, as the player reads them from the page:
// the same titles and minutes the contents render, and each story's year,
// place and ledger for the reading view. Build time only.

import { getSeedsFor } from '../lib/seeds';
import { chapterDisplayMinutes } from '../lib/storyRuntime';
import { getChapterFactcheck } from '../lib/factchecks';
import { cleanDisplayText, cleanFactText } from '../lib/figureWorld';
import { figureImage } from '../lib/figureImages';
import type { PlayerLang } from './strings';
import type { StoryQueue } from './types';

export function buildStoryQueue(
  figureId: string,
  slug: string,
  name: string,
  lang: PlayerLang,
): StoryQueue {
  const entries = getSeedsFor(figureId, lang).map((seed, i) => {
    const fc = getChapterFactcheck(figureId, lang, i + 1);
    return {
      n: i + 1,
      title: cleanDisplayText(seed.title),
      minutes: chapterDisplayMinutes(figureId, lang, i + 1),
      year: cleanFactText(fc?.year) || undefined,
      place: cleanFactText(fc?.setting) || undefined,
      documented: cleanFactText(fc?.documented?.[0]) || undefined,
      recreated: cleanFactText(fc?.recreated?.[0]) || undefined,
    };
  });
  return {
    figureId,
    slug,
    lang,
    name,
    artwork: figureImage(figureId, 'thumbnail', 640),
    entries,
  };
}
