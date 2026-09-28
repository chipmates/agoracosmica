// Pages in a running search test keep their markup unchanged until 2026-10-28.
export const FROZEN_PAGES: ReadonlySet<string> = new Set([
  '/figures/virginia-woolf/',
  '/figures/hildegard-von-bingen/',
  '/figures/arthur-schopenhauer/',
  '/figures/nelson-mandela/',
  '/figures/frida-kahlo/',
  '/figures/simone-de-beauvoir/',
  '/figures/galileo-galilei/',
  '/figures/leonardo-da-vinci/',
  '/de/figures/virginia-woolf/',
  '/de/figures/harriet-tubman/',
  '/de/figures/hildegard-von-bingen/',
  '/de/figures/jane-austen/',
]);

/** Whether a figure page in the running search test is frozen, by language and slug. */
export function isFrozenFigurePage(lang: 'en' | 'de', slug: string): boolean {
  return FROZEN_PAGES.has(`${lang === 'de' ? '/de' : ''}/figures/${slug}/`);
}

// Shared strings changed after the test began. A frozen page keeps the old
// wording in its cross-links (theme cards, related figures) until the test ends.
const FROZEN_STRINGS: Readonly<Record<string, string>> = {
  'en:themes.meaning-purpose.tagline': 'What makes a life worth living?',
  'en:themes.freedom-justice.tagline': 'What does it mean to be free?',
  'de:tradition.dickinson': 'Amerikanische Poesie',
};

/** On a frozen page, the wording a shared string had when the test began; otherwise `current`. */
export function frozenWording(frozen: boolean, lang: 'en' | 'de', key: string, current: string): string {
  return (frozen && FROZEN_STRINGS[`${lang}:${key}`]) || current;
}
