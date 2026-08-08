// Real story runtimes, measured from the produced audio. Every figure ships a
// durations file keyed by language and segment number, so a chapter door can
// print the length of the file it opens. A missing entry returns null and the
// door then carries no duration at all: an invented number would be worse than
// none. Same posture as councilRuntime.

import type { Lang } from '../i18n';

type Durations = Record<string, number>;

const durationModules = import.meta.glob<{ default: Durations }>(
  '../../../client/src/assets/stories/*/durations.json',
  { eager: true },
);

const byFigure = new Map<string, Durations>();
for (const [path, mod] of Object.entries(durationModules)) {
  const parts = path.split('/');
  const figureId = parts[parts.length - 2];
  byFigure.set(figureId, mod.default);
}

/** The twelve chapters. Segment 0 is the spoken note, not part of the life. */
const FIRST_CHAPTER = 1;
const LAST_CHAPTER = 12;

function seconds(figureId: string, lang: Lang, chapter: number): number | null {
  const entry = byFigure.get(figureId);
  if (!entry) return null;
  const value = entry[`${lang}_${chapter}`];
  return typeof value === 'number' && value > 0 ? value : null;
}

/** One chapter, rounded to whole minutes. */
export function chapterMinutes(figureId: string, lang: Lang, chapter: number): number | null {
  const total = seconds(figureId, lang, chapter);
  return total === null ? null : Math.max(1, Math.round(total / 60));
}

/** All twelve chapters of one life, in minutes. */
export function figureMinutes(figureId: string, lang: Lang): number | null {
  let total = 0;
  for (let n = FIRST_CHAPTER; n <= LAST_CHAPTER; n += 1) {
    const value = seconds(figureId, lang, n);
    if (value === null) return null;
    total += value;
  }
  return total > 0 ? Math.round(total / 60) : null;
}

/** Every life together, in whole hours. Null while the audio is not present. */
export function totalStoryHours(lang: Lang): number | null {
  let total = 0;
  for (const figureId of byFigure.keys()) {
    const value = figureMinutes(figureId, lang);
    if (value === null) return null;
    total += value;
  }
  return total > 0 ? Math.round(total / 60) : null;
}

/** How many figures have their audio measured. Zero on a content-free checkout. */
export function measuredFigureCount(): number {
  return byFigure.size;
}

/** A runtime a row can carry: "2 h 37 min" / "2 Std. 37 Min." */
export function longRuntimeLabel(minutes: number | null, lang: Lang): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === 'de') {
    if (h === 0) return `${m} Min.`;
    return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
  }
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The same runtime, short enough for a chapter row. */
export function shortRuntimeLabel(minutes: number | null, lang: Lang): string | null {
  if (!minutes) return null;
  return lang === 'de' ? `${minutes} Min.` : `${minutes} min`;
}
