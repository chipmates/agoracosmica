// Per-figure words of a player page that the catalogs do not carry: who the
// figure was in one line (placeholders for the writer), and the figure's own
// deeper pages. A figure without a line falls back to the first sentence of
// its lead answer, which is already on the page.

import type { PlayerLang } from './strings';

export interface DeepLink {
  href: string;
  label: string;
  /** The concept heading the link sits under; without one it joins "who he was". */
  under?: string;
}

const HERO_LINES: Record<string, Record<PlayerLang, string>> = {
  aurelius: {
    en: 'Roman emperor and Stoic. He wrote the Meditations as notes to himself.',
    de: 'Römischer Kaiser und Stoiker. Die Selbstbetrachtungen schrieb er als Notizen an sich selbst.',
  },
};

// The same links the figure template gives, plus the Meditations for German
// readers, marked as English, so both languages offer the same pages.
const DEEP_LINKS: Record<string, Record<PlayerLang, DeepLink[]>> = {
  aurelius: {
    en: [
      { href: '/figures/marcus-aurelius/meditations/', label: "Read the Meditations, in George Long's translation →" },
      { href: '/stoicism/', label: 'Stoicism, what it is and how people practice it →' },
      { href: '/figures/marcus-aurelius/meditations/', label: "Read the Meditations, in George Long's translation →", under: 'What is in the Meditations?' },
    ],
    de: [
      { href: '/figures/marcus-aurelius/meditations/', label: 'Die Selbstbetrachtungen lesen, in der englischen Übersetzung von George Long →' },
      { href: '/de/stoizismus/', label: 'Stoizismus, was er ist und wie man ihn übt →' },
    ],
  },
};

function firstSentence(text: string): string {
  const m = text.match(/^.+?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
}

export function heroLine(figureId: string, lang: PlayerLang, leadAnswer: string): string {
  return HERO_LINES[figureId]?.[lang] ?? firstSentence(leadAnswer);
}

export function deepLinks(figureId: string, lang: PlayerLang): DeepLink[] {
  return DEEP_LINKS[figureId]?.[lang] ?? [];
}
