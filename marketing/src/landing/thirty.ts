// The thirty, one record each, for any landing layout (a row, a list, a carousel): names, years, era, portraits at
// the sizes the layouts draw, and the queue the figure page's plate plays. Build time only: queues read the content
// tree. A page hands the browser its language's records through `stagePayload` (StageData.astro).

import { getFigureById } from '@client/data/public/figuresCatalog';
import { figureIdToSlug } from '@client/data/public/slugMap';
import { getPublicImageSrcSet, getPublicImageUrl } from '@client/utils/public/publicMediaUrl';
import { LIFE_YEARS, STRATA } from '../components/figureStrata';
import { localizedShortName } from '../components/figureNames';
import { getSeedsFor } from '../lib/seeds';
import { publicUrl } from '../lib/urls';
import { portraitAlt } from '../lib/portraitCredit';
import { buildStoryQueue } from '../player/queue';
import { isShe } from '../player/figureCopy';
import { landingWords } from './words';
import type { PlayerLang } from '../player/strings';
import type { StoryQueue } from '../player/types';

export type LandingLang = PlayerLang;
type Both = Record<LandingLang, string>;

export interface Era {
  id: string;
  /** Roman numeral of the band, I newest to V oldest, as on the figures index. */
  num: string;
  name: Both;
  short: Both;
  span: Both;
}

export interface Figure {
  id: string;
  slug: string;
  /** 0 is the oldest. */
  order: number;
  name: Both;
  /** The short name the app's buttons use ("Aurelius" / "Mark Aurel"). */
  short: Both;
  tradition: Both;
  /** The catalog's verified period, as the figure page shows it. */
  period: Both;
  /** The figures index's display-shortened years. */
  years: Both;
  /** The period where it is short enough for a name block, otherwise the shortened years. */
  dates: Both;
  era: Era;
  she: boolean;
  /** Horizontal focal point (percent) for crops that trim the painting's sides. */
  focal: number;
  /** The figure's page, per language. */
  href: Both;
}

// Main paintings are about 2400 x 2904 with the eyes near 50 % / 27.5 %; thumbnails are square face crops.
export const MAIN_SIZES = [600, 900, 1200, 1800, 2400] as const;
export const THUMB_SIZES = [160, 320, 480, 640] as const;
export { MAIN_EYES, THUMB_EYES } from './eyes';

// Audited across all thirty at 390 wide on today's landing (scripts/agora-hero.js); absent means centred.
const FOCAL: Record<string, number> = {
  laozi: 27, campbell: 36, zenji: 40, goethe: 40, jung: 40, eckhart: 42, kahlo: 42, angelou: 43, einstein: 44,
  gandhi: 46, shakespeare: 53, blake: 55, vinci: 55, austen: 57, galilei: 58, king: 58, bingen: 64, nietzsche: 64,
  rumi: 68, mozart: 85,
};

/** Longer catalog periods ("Late Eastern Zhou, roughly ...") give way to the shortened years. */
const DATES_MAX = 24;

// The landing names each era once, in its own words (the figures index keeps its own names).
const ERAS: Era[] = STRATA.map(s => {
  const name = {
    en: landingWords('en').eras[s.id] ?? s.en.name,
    de: landingWords('de').eras[s.id] ?? s.de.name,
  };
  return { id: s.id, num: s.num, name, short: name, span: { en: s.en.span, de: s.de.span } };
});

// STRATA lists the bands newest first and each band newest first: reversed twice, oldest first.
const ORDER: string[] = [...STRATA].reverse().flatMap(s => [...s.figures].reverse());

function both(fn: (lang: LandingLang) => string): Both {
  return { en: fn('en'), de: fn('de') };
}

function build(): Figure[] {
  return ORDER.map((id, order) => {
    const en = getFigureById(id, 'en');
    const de = getFigureById(id, 'de');
    const slug = figureIdToSlug[id];
    if (!en || !de || !slug) throw new Error(`landing/thirty: unknown figure ${id}`);
    const stratum = STRATA.find(s => s.figures.includes(id));
    const era = ERAS.find(e => e.id === stratum?.id);
    const years = LIFE_YEARS[id];
    if (!era || !years) throw new Error(`landing/thirty: no era or years for ${id}`);
    const period = { en: en.period, de: de.period };
    return {
      id,
      slug,
      order,
      name: { en: en.name, de: de.name },
      short: both(l => localizedShortName(id, l)),
      tradition: { en: en.tradition, de: de.tradition },
      period,
      years,
      dates: both(l => (period[l].length <= DATES_MAX ? period[l] : years[l])),
      era,
      she: isShe(id),
      focal: FOCAL[id] ?? 50,
      href: both(l => publicUrl(l, `/figures/${slug}`)),
    };
  });
}

export const THIRTY: readonly Figure[] = build();
export const ERA_LIST: readonly Era[] = ERAS;
export const DEFAULT_FIGURE = 'aurelius';
export { LONG_NAME } from './eyes';

const BY_ID = new Map(THIRTY.map(f => [f.id, f]));

export function figure(id: string): Figure {
  const f = BY_ID.get(id);
  if (!f) throw new Error(`landing/thirty: unknown figure ${id}`);
  return f;
}

/** The thirty grouped by era, oldest era first, each era oldest first. */
export function byEra(): { era: Era; figures: Figure[] }[] {
  return [...ERAS].reverse().map(era => ({ era, figures: THIRTY.filter(f => f.era.id === era.id) }));
}

// ---- portraits --------------------------------------------------------------

export function mainUrl(id: string, size: (typeof MAIN_SIZES)[number] = 900): string {
  return getPublicImageUrl(id, 'main', size, 'webp');
}
export function mainSrcset(id: string): string {
  return getPublicImageSrcSet(id, 'main', 'webp');
}
export function thumbUrl(id: string, size: (typeof THUMB_SIZES)[number] = 160): string {
  return getPublicImageUrl(id, 'thumbnail', size, 'webp');
}
export function thumbSrcset(id: string): string {
  return getPublicImageSrcSet(id, 'thumbnail', 'webp');
}

// ---- the queue: the figure page's own, so a plate here plays what the figure page plays ----

const queueMemo = new Map<string, StoryQueue>();

export function queueFor(id: string, lang: LandingLang): StoryQueue {
  const key = `${id}/${lang}`;
  const hit = queueMemo.get(key);
  if (hit) return hit;
  const f = figure(id);
  // The two lives most tied to this one, as StoryFigurePage.astro picks them for the reader's end.
  const counts = new Map<string, number>();
  for (const seed of getSeedsFor(id, lang)) {
    for (const conn of seed.connections ?? []) {
      if (conn.figure !== id && figureIdToSlug[conn.figure]) counts.set(conn.figure, (counts.get(conn.figure) ?? 0) + 1);
    }
  }
  const related = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).flatMap(([rel]) => {
    const r = getFigureById(rel, lang);
    const slug = figureIdToSlug[rel];
    return r && slug ? [{ name: r.name, href: publicUrl(lang, `/figures/${slug}`) }] : [];
  });
  const q = buildStoryQueue(id, f.slug, f.name[lang], lang, related);
  queueMemo.set(key, q);
  return q;
}

// ---- what the browser gets ----------------------------------------------------

/** One figure as the stage's script swaps it in: every word and address the stage shows, and the queue. */
export interface StageFigure {
  id: string;
  slug: string;
  name: string;
  short: string;
  /** Tradition and dates, the figure page's name-block line. */
  meta: string;
  /** The one line under the name (a placeholder slot, words/<lang>.ts). */
  line: string;
  alt: string;
  era: string;
  href: string;
  focal: number;
  main: { src: string; srcset: string };
  thumb: { src: string; srcset: string };
  queue: StoryQueue;
}

export interface StagePayload {
  lang: LandingLang;
  first: string;
  figures: StageFigure[];
}

export function stageFigure(id: string, lang: LandingLang): StageFigure {
  const f = figure(id);
  const W = landingWords(lang);
  return {
    id,
    slug: f.slug,
    name: f.name[lang],
    short: f.short[lang],
    meta: `${f.tradition[lang]} · ${f.dates[lang]}`,
    line: W.lines[id] ?? '',
    alt: portraitAlt(f.name[lang], lang),
    era: f.era.id,
    href: f.href[lang],
    focal: f.focal,
    main: { src: mainUrl(id, 900), srcset: mainSrcset(id) },
    thumb: { src: thumbUrl(id, 160), srcset: thumbSrcset(id) },
    queue: queueFor(id, lang),
  };
}

export function stagePayload(lang: LandingLang, first: string = DEFAULT_FIGURE): StagePayload {
  return { lang, first, figures: THIRTY.map(f => stageFigure(f.id, lang)) };
}

/** JSON for a `<script type="application/json">`, safe against a closing tag in any string. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
