// src/api/levelUpStories.ts
// Free of runtime imports, so the static pages can import it in Node, where
// figures.ts (it reads localStorage on import) cannot load.

/**
 * The figures with a shipped Level Up 2 story, in English and German.
 * A figure joins the list when its first Level Up 2 chapter ships.
 */
export const LEVEL_UP_2_FIGURES: readonly string[] = [
  'aurelius',
  'laozi',
  'nietzsche',
  'jung',
  'gautama',
  'kahlo',
  'rumi',
  'campbell',
  'vinci',
];

const LEVEL_UP_2 = new Set<string>(LEVEL_UP_2_FIGURES);

export function hasLevelUp2Story(id: string): boolean {
  return LEVEL_UP_2.has(id);
}

/**
 * The figures with a Level Up 2 story first, then the rest; each group keeps
 * the order it came in. Returns a new array and leaves the input as it is.
 */
export function levelUp2First<T extends { id: string }>(figures: readonly T[]): T[] {
  const first: T[] = [];
  const rest: T[] = [];
  for (const figure of figures) {
    (LEVEL_UP_2.has(figure.id) ? first : rest).push(figure);
  }
  return [...first, ...rest];
}
