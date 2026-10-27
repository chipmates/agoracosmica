// The introduction and the twelve stories of one figure, as the player reads
// them from the page: the same titles, minutes, years and places the contents
// render. No story text and no fact list: both are fetched when the visitor
// opens them, never part of the indexed HTML. Build time only.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getSeedsFor } from '../lib/seeds';
import { chapterDisplayMinutes } from '../lib/storyRuntime';
import { getChapterFactcheck } from '../lib/factchecks';
import { cleanDisplayText, cleanFactText } from '../lib/figureWorld';
import { figureImage } from '../lib/figureImages';
import { playerStrings } from './strings';
import { isShe } from './figureCopy';
import type { PlayerLang } from './strings';
import type { QueueEntry, RelatedLife, StoryQueue } from './types';

const durationModules = import.meta.glob<{ default: Record<string, number> }>(
  '../../../client/src/assets/stories/*/durations.json',
  { eager: true },
);

function seconds(figureId: string, lang: PlayerLang, n: number): number | undefined {
  for (const [file, mod] of Object.entries(durationModules)) {
    if (file.split('/').slice(-2, -1)[0] !== figureId) continue;
    const value = mod.default[`${lang}_${n}`];
    return typeof value === 'number' && value > 0 ? value : undefined;
  }
  return undefined;
}

// The app's per-family content version (client/vite.config.mjs, contentVersions):
// R2 sends these files with a one-year immutable cache, so the page asks for
// the same versioned address the app asks for, from the same content tree.
function hashDir(dir: string, hash: ReturnType<typeof createHash>): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      hashDir(full, hash);
      continue;
    }
    if (entry.name.startsWith('.') || !/\.(json|txt)$/.test(entry.name)) continue;
    try {
      hash.update(entry.name).update(readFileSync(full));
    } catch {
      // a link into the story tree may dangle
    }
  }
}

let versionsMemo: { factchecks?: string; stories?: string } | null = null;
function contentVersions(): { factchecks?: string; stories?: string } {
  if (versionsMemo) return versionsMemo;
  const assets = path.resolve(process.cwd(), '../client/src/assets');
  const one = (dir: string) => {
    const hash = createHash('sha1');
    hashDir(path.join(assets, dir), hash);
    return hash.digest('hex').slice(0, 10);
  };
  versionsMemo = { factchecks: one('factchecks'), stories: one('stories') };
  return versionsMemo;
}

/** Whether the stories' years follow the life's order (each story's first year at or after the one before). */
export function inLifeOrder(queue: StoryQueue): boolean {
  const years = queue.entries.filter(e => e.n > 0).map(e => Number((e.year ?? '').match(/\d{3,4}/)?.[0] ?? NaN));
  return years.every((y, i) => i === 0 || Number.isNaN(y) || Number.isNaN(years[i - 1]!) || y >= years[i - 1]!);
}

export function buildStoryQueue(
  figureId: string,
  slug: string,
  name: string,
  lang: PlayerLang,
  related: RelatedLife[] = [],
): StoryQueue {
  const P = playerStrings(lang);
  const introSeconds = seconds(figureId, lang, 0);
  const intro: QueueEntry = {
    n: 0,
    title: P.introTitle,
    minutes: introSeconds ? Math.max(1, Math.round(introSeconds / 60)) : null,
    seconds: introSeconds,
  };
  const stories: QueueEntry[] = getSeedsFor(figureId, lang).map((seed, i) => {
    const fc = getChapterFactcheck(figureId, lang, i + 1);
    return {
      n: i + 1,
      title: cleanDisplayText(seed.title),
      minutes: chapterDisplayMinutes(figureId, lang, i + 1),
      seconds: seconds(figureId, lang, i + 1),
      year: cleanFactText(fc?.year) || undefined,
      place: cleanFactText(fc?.setting) || undefined,
      age: cleanFactText(fc?.age) || undefined,
    };
  });
  return {
    figureId,
    slug,
    lang,
    name,
    artwork: figureImage(figureId, 'thumbnail', 640),
    entries: introSeconds ? [intro, ...stories] : stories,
    versions: contentVersions(),
    related,
    she: isShe(figureId),
  };
}
