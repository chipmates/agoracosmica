import en from './en';
import de from './de';
import type { LandingWords } from './types';

export type { LandingWords } from './types';

const WORDS = { en, de } as const;

export function landingWords(lang: 'en' | 'de'): LandingWords {
  return WORDS[lang];
}
