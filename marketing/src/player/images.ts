// The images' word and sentence in the stories' label, and the dock's way of adding them. No helper import: the dock
// island ships this module, label.ts builds the pages' labels with the same words and checks the two agree.

import type { PlayerLang } from './strings';

/** The images' word and the note's sentence about them (placeholders for the writer). */
export const IMAGES: Record<PlayerLang, { word: string; note: string }> = {
  en: { word: 'AI images', note: 'The portraits are AI images.' },
  de: { word: 'KI-Bilder', note: 'Die Porträts sind KI-Bilder.' },
};

/** A label with the images named: the word before the brief's last half, the sentence after the note's first one. A
 * label that already names them stays as it is. */
export function withImages<T extends { brief: string; expanded: string }>(labels: Record<PlayerLang, T>): Record<PlayerLang, T> {
  const one = (l: T, lang: PlayerLang): T => {
    const { word, note } = IMAGES[lang];
    const halves = l.brief.split(' · ');
    const brief = halves.includes(word) ? l.brief : [...halves.slice(0, -1), word, ...halves.slice(-1)].join(' · ');
    const cut = l.expanded.indexOf('. ');
    const expanded = l.expanded.includes(note) ? l.expanded
      : cut < 0 ? `${l.expanded} ${note}` : `${l.expanded.slice(0, cut + 1)} ${note} ${l.expanded.slice(cut + 2)}`;
    return { ...l, brief, expanded };
  };
  return { en: one(labels.en, 'en'), de: one(labels.de, 'de') };
}
