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
  dickinson: {
    en: 'American poet. She wrote nearly eighteen hundred poems in Amherst and published almost none in her lifetime.',
    de: 'Amerikanische Dichterin. Sie schrieb in Amherst fast achtzehnhundert Gedichte und veröffentlichte zu Lebzeiten kaum eines.',
  },
  campbell: {
    en: "American scholar of myth. He found one shape under the world's myths, the hero's journey.",
    de: 'Amerikanischer Mythenforscher. Unter den Mythen der Welt fand er eine Form, die Heldenreise.',
  },
  eckhart: {
    en: "German Dominican and mystic. He preached in German that the soul's ground and God's ground are one.",
    de: 'Deutscher Dominikaner und Mystiker. Er predigte auf Deutsch, dass der Grund der Seele und der Grund Gottes eins sind.',
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
      { href: '/figures/marcus-aurelius/meditations/', label: 'Die Selbstbetrachtungen auf Englisch lesen, übersetzt von George Long →' },
      { href: '/de/stoizismus/', label: 'Stoizismus, was er ist und wie man ihn übt →' },
    ],
  },
  campbell: {
    en: [{ href: '/the-heros-journey/', label: "The hero's journey, from call to return →" }],
    de: [{ href: '/de/heldenreise/', label: 'Die Heldenreise, vom Ruf bis zur Rückkehr →' }],
  },
};

/** The figure's own writing on this site, offered under the plate. */
export interface OwnWords {
  href: string;
  label: string;
  /** A short note beside the link, on the same line (the text's language). */
  note?: string;
}

const OWN_WORDS: Record<string, Record<PlayerLang, OwnWords>> = {
  aurelius: {
    en: { href: '/figures/marcus-aurelius/meditations/', label: 'His own words: the Meditations' },
    de: { href: '/figures/marcus-aurelius/meditations/', label: 'Seine eigenen Worte: die Selbstbetrachtungen', note: 'auf Englisch' },
  },
  dickinson: {
    en: { href: '/figures/emily-dickinson/poems/', label: 'Her own words: the poems' },
    de: { href: '/figures/emily-dickinson/poems/', label: 'Ihre eigenen Worte: die Gedichte', note: 'auf Englisch' },
  },
};

export function ownWords(figureId: string, lang: PlayerLang): OwnWords | null {
  return OWN_WORDS[figureId]?.[lang] ?? null;
}

// The note at a player page's end: what the portrait and the stories are. Per
// figure, because "from his writings" holds only for one who left writings.
const STORY_NOTES: Record<string, Record<PlayerLang, (name: string) => string>> = {
  aurelius: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his writings and the sources and read by a synthetic voice. Not a recording. Never his own words.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Schriften und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme. Nie seine eigenen Worte.`,
  },
  dickinson: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of her life in the first person, written with AI from her poems and letters and the sources and read by a synthetic voice. Not a recording. Never her own words.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung ihres Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach ihren Gedichten und Briefen und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme. Nie ihre eigenen Worte.`,
  },
  campbell: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his books and the sources and read by a synthetic voice. Not a recording. Never his own words.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Büchern und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme. Nie seine eigenen Worte.`,
  },
  eckhart: {
    en: name => `The portrait of ${name} is an AI-generated image. The stories on this page are a retelling of his life in the first person, written with AI from his sermons and treatises and the sources and read by a synthetic voice. Not a recording. Never his own words.`,
    de: name => `Das Porträt von ${name} ist ein KI-erzeugtes Bild. Die Geschichten auf dieser Seite sind eine Nacherzählung seines Lebens in der Ich-Form. Geschrieben wurden sie mit KI nach seinen Predigten und Traktaten und den Quellen. Eine synthetische Stimme liest sie vor. Keine Aufnahme. Nie seine eigenen Worte.`,
  },
};

export function storyNote(figureId: string, lang: PlayerLang, name: string): string | null {
  return STORY_NOTES[figureId]?.[lang]?.(name) ?? null;
}

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

// The women among the thirty, for the notes that name whose words a retelling is not.
const SHE = new Set(['angelou', 'austen', 'beauvoir', 'bingen', 'dickinson', 'kahlo', 'lovelace', 'tubman', 'woolf']);

export function isShe(figureId: string): boolean {
  return SHE.has(figureId);
}
