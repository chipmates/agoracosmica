// The stories' label, read from the app's own helper translations (audio library, transparency section), with the
// portraits named between its two halves. Build time only: the islands get the lines as props, so the helper files
// never ship to the browser.

import helpersEn from '@client/assets/translations/helpers/en.json';
import helpersDe from '@client/assets/translations/helpers/de.json';
import type { PlayerLang } from './strings';

export interface StoryLabel {
  /** The section's own heading ("Notice" / "Hinweis"): the name of the dock's "i". */
  title: string;
  /** The label line, the images named in its middle. */
  brief: string;
  expanded: string;
  /** The helper's own two halves, voice first on the lock screen. */
  lock: string;
}

interface HelperFile {
  audioLibrary: { welcome: { sections: { transparency: { title: string; brief: string; expanded: string } } } };
}

// The images' word and the note's sentence about them (placeholders for the writer).
const IMAGES: Record<PlayerLang, { word: string; note: string }> = {
  en: { word: 'AI images', note: 'The portraits are AI images.' },
  de: { word: 'KI-Bilder', note: 'Die Porträts sind KI-Bilder.' },
};

function read(file: unknown, lang: PlayerLang, portraits: boolean): StoryLabel {
  const t = (file as HelperFile).audioLibrary.welcome.sections.transparency;
  const halves = t.brief.split(' · ');
  const withImages = [...halves.slice(0, -1), IMAGES[lang].word, ...halves.slice(-1)].join(' · ');
  // the images' sentence follows the first one, which names the making and the voice
  const cut = t.expanded.indexOf('. ');
  const expanded = cut < 0
    ? `${t.expanded} ${IMAGES[lang].note}`
    : `${t.expanded.slice(0, cut + 1)} ${IMAGES[lang].note} ${t.expanded.slice(cut + 2)}`;
  return portraits
    ? { title: t.title, brief: withImages, expanded, lock: t.brief }
    : { title: t.title, brief: t.brief, expanded: t.expanded, lock: t.brief };
}

const LABELS: Record<PlayerLang, Record<'with' | 'without', StoryLabel>> = {
  en: { with: read(helpersEn, 'en', true), without: read(helpersEn, 'en', false) },
  de: { with: read(helpersDe, 'de', true), without: read(helpersDe, 'de', false) },
};

/** The label for a page; `portraits` is whether that page shows an AI portrait (the images item and sentence only
 * then). */
export function storyLabel(lang: PlayerLang, portraits = true): StoryLabel {
  return LABELS[lang][portraits ? 'with' : 'without'];
}
