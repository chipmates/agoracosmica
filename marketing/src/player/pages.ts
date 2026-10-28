// The switch: figure pages listed here play their stories in place and carry
// the dock. Every other figure page builds from the old template unchanged.
// A figure's companion pages (its own deeper pages) carry the router and the
// dock too, so a listener can open them without the story stopping.

import { poemsByPoet } from '../data/poems/index.mjs';
import { figureSlugToId } from '@client/data/public/slugMap';

const LIVE: readonly string[] = ['marcus-aurelius', 'joseph-campbell', 'emily-dickinson', 'meister-eckhart', 'plato', 'william-blake'];

// The fit check (scripts/check-player-fit.mjs) builds every figure on the player into its own folder, so a figure's
// page is checked before it is listed above; a plain build never sets the flag.
export const STORY_PLAYER_SLUGS: readonly string[] = process.env.PLAYER_FIT_ALL === '1' ? Object.keys(figureSlugToId) : LIVE;

/** Pages outside the figure template that keep the dock alive, by path. */
export const STORY_PLAYER_COMPANIONS: Readonly<Record<string, readonly string[]>> = {
  'marcus-aurelius': ['/figures/marcus-aurelius/meditations/', '/stoicism/', '/de/stoizismus/'],
  'joseph-campbell': ['/the-heros-journey/', '/de/heldenreise/'],
  'emily-dickinson': ['/figures/emily-dickinson/poems/', ...poemsByPoet('dickinson').map((poem: { path: string }) => poem.path)],
  'plato': ['/de/figures/plato/hoehlengleichnis/', '/de/figures/plato/ideenlehre/'],
  'william-blake': ['/figures/william-blake/poems/', ...poemsByPoet('blake').map((poem: { path: string }) => poem.path)],
};

export function hasStoryPlayer(slug: string): boolean {
  return STORY_PLAYER_SLUGS.includes(slug);
}

export function isStoryCompanionPath(path: string): boolean {
  const withSlash = path.endsWith('/') ? path : `${path}/`;
  return STORY_PLAYER_SLUGS.some(slug => (STORY_PLAYER_COMPANIONS[slug] ?? []).includes(withSlash));
}
