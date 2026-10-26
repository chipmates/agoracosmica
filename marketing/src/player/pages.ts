// The switch: figure pages listed here play their stories in place and carry
// the dock. Every other figure page builds from the old template unchanged.
// A figure's companion pages (its own deeper pages) carry the router and the
// dock too, so a listener can open them without the story stopping.

export const STORY_PLAYER_SLUGS: readonly string[] = ['marcus-aurelius'];

/** Pages outside the figure template that keep the dock alive, by path. */
export const STORY_PLAYER_COMPANIONS: Readonly<Record<string, readonly string[]>> = {
  'marcus-aurelius': ['/figures/marcus-aurelius/meditations/', '/stoicism/', '/de/stoizismus/'],
};

export function hasStoryPlayer(slug: string): boolean {
  return STORY_PLAYER_SLUGS.includes(slug);
}

export function isStoryCompanionPath(path: string): boolean {
  const withSlash = path.endsWith('/') ? path : `${path}/`;
  return STORY_PLAYER_SLUGS.some(slug => (STORY_PLAYER_COMPANIONS[slug] ?? []).includes(withSlash));
}
