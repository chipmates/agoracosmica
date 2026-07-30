// Vite glob for the per-figure story catalogs (twelve chapters each, plus a
// segment-0 note). Same eager-glob shape as seeds.ts: 60 small JSON files, all
// resolved at build time, so a page can name a chapter's real hook and runtime
// instead of hardcoding either.

interface StoryChapter {
  segment: number;
  title: string;
  opening: string;
  /** The authored teaser: the chapter's first beat, written to be quoted. */
  hook: string;
  words: number;
  minutes: number;
}

interface StoryFile {
  figure: string;
  chapters: StoryChapter[];
  totalWords: number;
  totalMinutes: number;
}

const enFiles = import.meta.glob<{ default: StoryFile }>(
  '../../../client/src/data/public/stories/en/*.json',
  { eager: true },
);
const deFiles = import.meta.glob<{ default: StoryFile }>(
  '../../../client/src/data/public/stories/de/*.json',
  { eager: true },
);

function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1].replace(/\.json$/, '');
}

const enById = new Map<string, StoryFile>();
const deById = new Map<string, StoryFile>();
for (const [path, mod] of Object.entries(enFiles)) enById.set(basename(path), mod.default);
for (const [path, mod] of Object.entries(deFiles)) deById.set(basename(path), mod.default);

/** One chapter by its segment number (1..12), or undefined if not produced. */
export function getStoryChapter(
  figureId: string,
  lang: 'en' | 'de',
  segment: number,
): StoryChapter | undefined {
  const map = lang === 'de' ? deById : enById;
  return map.get(figureId)?.chapters.find(c => c.segment === segment);
}

export type { StoryChapter };
