// Shared build-time helpers for the figure detail template: the counts the
// hero states out loud, the council ranking, and the typed lattice.
// Everything here is derived from data. Nothing is hardcoded per figure.

import { getSeedsFor } from './seeds';
import type { Seed } from './seeds';
import { councilCatalog, BLESSED_BY_THEME, COUNCIL_SEQUENCE } from '@client/data/councilCatalog';
import type { CatalogCouncil, ThemeId } from '@client/data/councilCatalog';
import { figureThemes } from '@client/data/public/figureSeo';
import { figureIdToSlug } from '@client/data/public/slugMap';

/**
 * Displayed-prose laundering. Seed, catalog and story text carry em/en dashes
 * and semicolons, which the writing rule forbids on screen. Also collapses the
 * hard line breaks the story hooks use as paragraph marks.
 */
export function cleanDisplayText(s: string | undefined): string {
  return (s ?? '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The same laundering for factcheck strings, which are verified prose and must
 * not lose a single fact. A dash held tight between two characters is a range
 * or a compound (1904-1910, Jung-Freud, age 11-12), so it becomes a hyphen and
 * keeps its meaning. Only a spaced dash is the prose dash the writing rule
 * forbids, and only that one becomes a comma. Nothing else is touched: no
 * rewording, no shortening, no strengthening.
 */
export function cleanFactText(s: string | undefined): string {
  return (s ?? '')
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/(\S)[—–](\S)/g, '$1-$2')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- counting, spoken out loud -------------------------------------------
// The hero states the size of the figure's world in words, not digits, so it
// reads as a sentence. Every number is computed from the data at build time.

const ONES_EN = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS_EN = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ONES_DE = [
  'null', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht',
  'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn',
  'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn',
];
const TENS_DE = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

/** A whole number 0-99 as a word. Falls back to digits outside that range. */
export function numberWord(n: number, lang: 'en' | 'de'): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
  const ones = lang === 'de' ? ONES_DE : ONES_EN;
  const tens = lang === 'de' ? TENS_DE : TENS_EN;
  if (n < 20) return lang === 'de' && n === 1 ? 'eine' : ones[n];
  const t = Math.floor(n / 10);
  const r = n % 10;
  if (r === 0) return tens[t];
  return lang === 'de' ? `${ones[r]}und${tens[t]}` : `${tens[t]}-${ones[r]}`;
}

/** Sentence-case a word that starts a sentence. */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface FigureWorld {
  chapters: number;
  councils: number;
  connections: number;
}

export function getFigureWorld(figureId: string, lang: 'en' | 'de'): FigureWorld {
  const seeds = getSeedsFor(figureId, lang);
  return {
    chapters: seeds.length,
    councils: councilsFor(figureId).length,
    connections: seeds.reduce((n, s) => n + (s.connections?.length ?? 0), 0),
  };
}

// --- councils -------------------------------------------------------------

/** Every council this figure moderates or takes part in. */
export function councilsFor(figureId: string): CatalogCouncil[] {
  return councilCatalog.filter(
    c => c.moderator.id === figureId || c.participants.some(p => p.id === figureId),
  );
}

/**
 * Only one council per theme has a produced 50s preview: the theme's featured
 * council, the lowest-sortOrder one. Deriving the set from that invariant keeps
 * the players in lockstep with what actually exists on R2 (verified live:
 * the eight below return 200, everything else 404s), instead of a hand-kept id
 * list that rots silently.
 */
const PREVIEW_IDS = new Set(
  Object.keys(BLESSED_BY_THEME).map(theme => {
    const inTheme = councilCatalog
      .filter(c => c.theme === (theme as ThemeId))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return inTheme[0]?.id;
  }).filter((id): id is string => Boolean(id)),
);

export const hasCouncilPreview = (councilId: string): boolean => PREVIEW_IDS.has(councilId);

const SEQUENCE_POS = new Map(COUNCIL_SEQUENCE.map((id, i) => [id, i]));
const sequencePos = (id: string): number => SEQUENCE_POS.get(id) ?? COUNCIL_SEQUENCE.length;

/**
 * This figure's councils, best first. The blessed council of one of the
 * figure's OWN themes leads (that is the debate the figure page promises), then
 * any other blessed council, then the curated listening order.
 */
export function rankedCouncilsFor(figureId: string): CatalogCouncil[] {
  const own = new Set(figureThemes[figureId] ?? []);
  const blessed = new Set(Object.values(BLESSED_BY_THEME));
  const rank = (c: CatalogCouncil): number => {
    if (blessed.has(c.id) && own.has(c.theme)) return 0;
    if (blessed.has(c.id)) return 1;
    return 2;
  };
  return [...councilsFor(figureId)].sort(
    (a, b) => rank(a) - rank(b) || sequencePos(a.id) - sequencePos(b.id),
  );
}

// --- the typed lattice ----------------------------------------------------

export type EdgeType = 'foundation' | 'expansion' | 'tension';

export interface LatticeEdge {
  /** The seed on THIS page the edge leaves from. */
  fromTitle: string;
  fromChapter: number;
  /** The figure it reaches. */
  toFigureId: string;
  toFigureName: string;
  toSeedTitle: string;
  /** /figures/{slug}/#idea-{n}, or the figure page when the seed is unresolved. */
  href: string;
}

/** `urlFor` returns an already-slashed page URL (publicUrl does that). */
type UrlFor = (path: string) => string;

/**
 * The figure's outbound connections grouped by type. Every seed carries exactly
 * one of each, so the three rails come out even. The target chapter number is
 * resolved by matching the connection's seedTitle against that figure's own
 * seed list in the SAME language, which is what makes the #idea-n anchor land
 * on the right chapter.
 */
export function getLattice(
  figureId: string,
  lang: 'en' | 'de',
  resolveName: (id: string) => string | undefined,
  urlFor: UrlFor,
): Record<EdgeType, LatticeEdge[]> {
  const seeds = getSeedsFor(figureId, lang);
  const out: Record<EdgeType, LatticeEdge[]> = { foundation: [], expansion: [], tension: [] };

  for (const seed of seeds) {
    for (const conn of seed.connections ?? []) {
      const type = conn.type as EdgeType;
      if (!out[type]) continue;
      const slug = figureIdToSlug[conn.figure];
      const name = resolveName(conn.figure);
      if (!slug || !name || conn.figure === figureId) continue;
      const theirSeeds: Seed[] = getSeedsFor(conn.figure, lang);
      const idx = theirSeeds.findIndex(s => s.title === conn.seedTitle);
      const base = urlFor(`/figures/${slug}`);
      out[type].push({
        fromTitle: cleanDisplayText(seed.title),
        fromChapter: seed.id,
        toFigureId: conn.figure,
        toFigureName: name,
        toSeedTitle: cleanDisplayText(conn.seedTitle),
        href: idx >= 0 ? `${base}#idea-${idx + 1}` : base,
      });
    }
  }
  return out;
}
