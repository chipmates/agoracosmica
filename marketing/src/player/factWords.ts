// The facts' words, read unchanged from the app's own translations (its fact
// panel), so the page labels what is documented and what is built as the app
// does. Build time only: the island gets the words as props.

import uiEn from '@client/assets/translations/ui-en.json';
import uiDe from '@client/assets/translations/ui-de.json';
import type { PlayerLang } from './strings';

export interface FactWords {
  facts: string;
  /** "Story {number}" */
  storyNumber: string;
  year: string;
  age: string;
  setting: string;
  documented: string;
  recreated: string;
  note: string;
  notes: string;
  /** The way on to the figure's sources. */
  figureOverview: string;
}

const KEYS: (keyof FactWords)[] = [
  'facts', 'storyNumber', 'year', 'age', 'setting', 'documented', 'recreated', 'note', 'notes', 'figureOverview',
];

function read(file: unknown): FactWords {
  const section = (file as { factCheck: Record<string, string> }).factCheck;
  const out = {} as FactWords;
  for (const key of KEYS) out[key] = section[key] ?? '';
  return out;
}

const WORDS: Record<PlayerLang, FactWords> = { en: read(uiEn), de: read(uiDe) };

export function factWords(lang: PlayerLang): FactWords {
  return WORDS[lang];
}
