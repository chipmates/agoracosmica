// Topic catalog for Community Governance modal.
// Data-only file: ordered categories, items per category, future-state flags.
// Translation labels resolve via the keys in `community.*` of ui-{en,de}.json.

import { historicalFiguresBase } from '../../api/figures';

export type TopicCategoryId =
  | 'languages'
  | 'apps'
  | 'books'
  | 'figures'
  | 'imageUpgrade'
  | 'voiceUpgrade';

export interface TopicItem {
  id: string;
  // The full translation key (e.g. `community.languages.es`). Resolves to a label.
  // For figure-keyed items the label is the literal `displayName` instead.
  labelKey?: string;
  // Native-script display string (used for languages only).
  native?: string;
  // For figure-keyed items (image/voice upgrade): figure ID for the portrait.
  figureId?: string;
  // Pre-resolved display name for figure-keyed items (sync, no translation lookup).
  displayName?: string;
}

export interface TopicCategory {
  id: TopicCategoryId;
  iconName: 'Translate' | 'DeviceMobile' | 'Books' | 'UserPlus' | 'Palette' | 'Microphone';
  isFuture: boolean;
  defaultOpen: boolean;
  items: TopicItem[];
}

// Qwen 3 TTS supported languages (excluding EN + DE which are already shipped).
// Source: Qwen3-TTS model card, locked 2026-04-30.
// Chinese: kept as a single entry until Qwen's Cantonese-vs-Mandarin handling
// is confirmed. Regional dialects (Beijing, Sichuanese, Wu, Hokkien, Shaanxi,
// Nanjing, Tianjin) are accent variants Qwen handles within zh.
const LANGUAGE_ORDER: Array<{ id: string; native: string }> = [
  { id: 'es', native: 'Español' },
  { id: 'fr', native: 'Français' },
  { id: 'it', native: 'Italiano' },
  { id: 'pt', native: 'Português' },
  { id: 'zh', native: '中文' },
  { id: 'ja', native: '日本語' },
  { id: 'ko', native: '한국어' },
  { id: 'ru', native: 'Русский' },
];

// Curated 16: 8 male + 8 female, ordered roughly chronologically.
// Each fills a distinct geographic / era / discipline / tradition gap in the
// existing 30 figures.
//
// Inclusion criterion: figures within "tolerated scope" — meaning the figure's
// historical significance and wisdom output justify inclusion AND any
// documented controversies (Darwin's racial taxonomies, Augustine's just-war
// doctrine, Arendt's Heidegger entanglement, Maathai's 2004 HIV comments, etc.)
// can be honestly surfaced via the existing shadow treatment, rather than
// hidden — the same pattern used for Schopenhauer's misogyny in the current 30.
//
// Risk tier alone is NOT a disqualifier; the shadow framework absorbs it.
// Touch this list with care.
const FIGURE_SUGGESTIONS: string[] = [
  'confucius',      // ~551 BCE — China, Confucian ethics
  'hypatia',        // ~370 CE  — Roman Egypt, mathematics + ancient female voice
  'augustine',      //  354 CE  — Roman North Africa, Christian theology
  'avicenna',       //  980 CE  — Persia, Islamic Golden Age polymath
  'maimonides',     // 1138 CE  — Spain/Egypt, Jewish-Islamic-Greek synthesis
  'mirabai',        // 1498     — India, Hindu Bhakti mystic poet
  'spinoza',        // 1632     — Netherlands, rationalist pantheism
  'wollstonecraft', // 1759     — England, foundational feminism
  'darwin',         // 1809     — England, biology + evolution
  'douglass',       // 1818     — USA, abolitionist orator + slave narrative
  'tolstoy',        // 1828     — Russia, moral novelist + religious philosophy
  'curie',          // 1867     — Poland/France, physics + chemistry
  'arendt',         // 1906     — Germany/USA, political philosophy
  'carson',         // 1907     — USA, environmentalism + Silent Spring
  'morrison',       // 1931     — USA, Nobel novelist + race/memory
  'maathai',        // 1940     — Kenya, environmentalism + Sub-Saharan Africa
];

// Category order rules:
//   1. `apps` is always pinned first (product priority).
//   2. Once vote tallies are live, the remaining categories sort by descending
//      total votes (see sortCategoriesByVotes below). Future-flagged categories
//      always sit at the bottom regardless of votes.
//   3. In locked-state (current), the static order below stands in for that
//      ranking. Reasoned default: apps → languages (broad reach) → figures
//      (creative) → books (niche) → image/voice upgrades (future).
export const TOPIC_CATALOG: TopicCategory[] = [
  {
    id: 'apps',
    iconName: 'DeviceMobile',
    isFuture: false,
    defaultOpen: true,
    items: [
      { id: 'app-ios', labelKey: 'community.apps.ios' },
      { id: 'app-android', labelKey: 'community.apps.android' },
    ],
  },
  {
    id: 'languages',
    iconName: 'Translate',
    isFuture: false,
    defaultOpen: false,
    items: LANGUAGE_ORDER.map(({ id, native }) => ({
      id: `lang-${id}`,
      labelKey: `community.languages.${id}`,
      native,
    })),
  },
  {
    id: 'figures',
    iconName: 'UserPlus',
    isFuture: false,
    defaultOpen: false,
    items: FIGURE_SUGGESTIONS.map((id) => ({
      id: `figure-${id}`,
      labelKey: `community.figureSuggestions.${id}`,
    })),
  },
  {
    id: 'books',
    iconName: 'Books',
    isFuture: false,
    defaultOpen: false,
    items: [
      { id: 'book-free-pdf', labelKey: 'community.books.freePdf' },
      { id: 'book-print-on-demand', labelKey: 'community.books.printOnDemand' },
    ],
  },
  {
    id: 'imageUpgrade',
    iconName: 'Palette',
    isFuture: true,
    defaultOpen: false,
    items: historicalFiguresBase.map((fig) => ({
      id: `image-${fig.id}`,
      figureId: fig.id,
      displayName: stripEchoPrefix(fig.baseNameEn),
    })),
  },
  {
    id: 'voiceUpgrade',
    iconName: 'Microphone',
    isFuture: true,
    defaultOpen: false,
    items: historicalFiguresBase.map((fig) => ({
      id: `voice-${fig.id}`,
      figureId: fig.id,
      displayName: stripEchoPrefix(fig.baseNameEn),
    })),
  },
];

function stripEchoPrefix(name: string): string {
  return name.replace(/^Echo of\s+/i, '');
}

/**
 * Sort categories by descending total votes once vote data is available.
 *
 * Rules:
 * - `apps` is always pinned first (product priority).
 * - Future-flagged categories (image/voice upgrade) always at the bottom.
 * - The remaining (non-pinned, non-future) categories sort by `voteCounts[id]`
 *   descending; ties fall back to original catalog order for stability.
 *
 * If `voteCounts` is undefined/empty, returns the catalog unchanged.
 * Wire this from TopicsList once the snapshot endpoint exposes per-category
 * tallies (planned for the voting-open phase).
 */
export function sortCategoriesByVotes(
  catalog: TopicCategory[],
  voteCounts: Partial<Record<TopicCategoryId, number>> | undefined
): TopicCategory[] {
  if (!voteCounts || Object.keys(voteCounts).length === 0) return catalog;

  const indexOf = new Map(catalog.map((cat, i) => [cat.id, i]));
  const pinned = catalog.filter((c) => c.id === 'apps');
  const future = catalog.filter((c) => c.isFuture);
  const middle = catalog.filter((c) => c.id !== 'apps' && !c.isFuture);

  middle.sort((a, b) => {
    const va = voteCounts[a.id] ?? 0;
    const vb = voteCounts[b.id] ?? 0;
    if (vb !== va) return vb - va;
    return (indexOf.get(a.id) ?? 0) - (indexOf.get(b.id) ?? 0);
  });

  return [...pinned, ...middle, ...future];
}

export const FIGURES_PER_SUGGESTION_SLOT = 3;
