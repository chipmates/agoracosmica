// Public page translations - standalone, no Zustand dependency
// Remove this file when stripping marketing pages from a fork

import publicEn from '../../assets/translations/public-en.json';
import publicDe from '../../assets/translations/public-de.json';

const translations: Record<string, Record<string, unknown>> = {
  en: publicEn,
  de: publicDe,
};

type Language = 'en' | 'de';

function traverseKeys(obj: unknown, keys: string[]): unknown {
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function getPublicT(lang: Language) {
  return (key: string, fallback?: string): string => {
    const result = traverseKeys(translations[lang], key.split('.'));
    if (typeof result === 'string') return result;
    // Fallback to English
    const enResult = traverseKeys(translations.en, key.split('.'));
    if (typeof enResult === 'string') return enResult;
    return fallback ?? key;
  };
}
