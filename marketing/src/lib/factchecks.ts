// Build-time access to the per-figure factcheck records.
//
// Same eager-glob shape as seeds.ts and stories.ts. The factcheck files are
// curated content pulled by `pnpm setup:assets`, so a checkout that has not run
// it resolves to an empty map and every consumer renders without the metadata
// rather than failing the build.
//
// Fact law: anything read from here renders VERBATIM or is omitted. Never
// paraphrase a documented/recreated string, never strengthen one, never invent.

interface FactcheckStory {
  number: number;
  title: string;
  year?: string;
  age?: string;
  setting?: string;
  /** documented | mixed | recreated */
  basis?: string;
  documented?: string[];
  recreated?: string[];
}

interface FactcheckSources {
  primary?: string[];
  scholarly?: string[];
  archives?: string[];
  shadow?: string[];
}

interface FactcheckShadow {
  personal?: string[];
  historical?: string[];
  context?: string[];
}

interface FactcheckFile {
  figure: string;
  stories?: FactcheckStory[];
  sources?: FactcheckSources;
  shadow?: FactcheckShadow;
}

const enFiles = import.meta.glob<{ default: FactcheckFile }>(
  '../../../client/src/assets/factchecks/en/*.json',
  { eager: true },
);
const deFiles = import.meta.glob<{ default: FactcheckFile }>(
  '../../../client/src/assets/factchecks/de/*.json',
  { eager: true },
);

function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1].replace(/\.json$/, '');
}

const enById = new Map<string, FactcheckFile>();
const deById = new Map<string, FactcheckFile>();
for (const [path, mod] of Object.entries(enFiles)) enById.set(basename(path), mod.default);
for (const [path, mod] of Object.entries(deFiles)) deById.set(basename(path), mod.default);

function fileFor(figureId: string, lang: 'en' | 'de'): FactcheckFile | undefined {
  return (lang === 'de' ? deById : enById).get(figureId);
}

/** The factcheck record for one chapter (1-12), or undefined. */
export function getChapterFactcheck(
  figureId: string,
  lang: 'en' | 'de',
  chapter: number,
): FactcheckStory | undefined {
  return fileFor(figureId, lang)?.stories?.find(s => s.number === chapter);
}

/**
 * The bibliography, flattened in citation order and de-duplicated. The
 * shadow-only references are left out: they belong to a block that does not
 * ship yet, and listing them without their subject would be a loose end.
 */
export function getBibliography(figureId: string, lang: 'en' | 'de'): string[] {
  const sources = fileFor(figureId, lang)?.sources;
  if (!sources) return [];
  const all = [
    ...(sources.primary ?? []),
    ...(sources.scholarly ?? []),
    ...(sources.archives ?? []),
  ];
  return [...new Set(all.map(s => s.trim()).filter(Boolean))];
}

/** Verified material about the figure's own record. See FigureShadow.astro. */
export function getShadowRecord(
  figureId: string,
  lang: 'en' | 'de',
): FactcheckShadow | undefined {
  return fileFor(figureId, lang)?.shadow;
}

export type { FactcheckStory, FactcheckShadow };
