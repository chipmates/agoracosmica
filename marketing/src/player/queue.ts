// The twelve stories of one figure, as the player reads them from the page:
// the same titles and minutes the chapter list renders. Build time only.

import { getSeedsFor } from '../lib/seeds';
import { chapterDisplayMinutes } from '../lib/storyRuntime';
import { cleanDisplayText } from '../lib/figureWorld';
import { figureImage } from '../lib/figureImages';
import type { PlayerLang } from './strings';
import type { StoryQueue } from './types';

export function buildStoryQueue(
  figureId: string,
  slug: string,
  name: string,
  lang: PlayerLang,
): StoryQueue {
  const entries = getSeedsFor(figureId, lang).map((seed, i) => ({
    n: i + 1,
    title: cleanDisplayText(seed.title),
    minutes: chapterDisplayMinutes(figureId, lang, i + 1),
  }));
  return {
    figureId,
    slug,
    lang,
    name,
    artwork: figureImage(figureId, 'thumbnail', 640),
    entries,
  };
}
