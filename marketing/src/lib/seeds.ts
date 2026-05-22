// Vite glob to bundle every seed JSON at build time. Astro static generation
// hits this once per page during the build, so all 60 files (30 EN + 30 DE)
// load eagerly. Total payload is tiny (each seed file is a few KB authored
// text + connections), and the build deduplicates shared content.

interface Connection {
  figure: string;
  seedTitle: string;
  type: string;
}

interface Seed {
  id: number;
  title: string;
  summary: string;
  quote: string;
  tags: string[];
  concept?: string;
  coreInsights?: string[];
  connections?: Connection[];
}

interface SeedFile {
  figure: string;
  seeds: Seed[];
}

const enFiles = import.meta.glob<{ default: SeedFile }>(
  '../../../client/src/data/public/seeds/en/*.json',
  { eager: true },
);
const deFiles = import.meta.glob<{ default: SeedFile }>(
  '../../../client/src/data/public/seeds/de/*.json',
  { eager: true },
);

function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1].replace(/\.json$/, '');
}

const enById = new Map<string, SeedFile>();
const deById = new Map<string, SeedFile>();
for (const [path, mod] of Object.entries(enFiles)) {
  enById.set(basename(path), mod.default);
}
for (const [path, mod] of Object.entries(deFiles)) {
  deById.set(basename(path), mod.default);
}

export function getSeedsFor(figureId: string, lang: 'en' | 'de'): Seed[] {
  const map = lang === 'de' ? deById : enById;
  return map.get(figureId)?.seeds ?? [];
}

export type { Seed, Connection };
