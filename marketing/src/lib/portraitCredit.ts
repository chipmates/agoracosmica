// The credit beside every AI portrait on the site and the alt that carries it: one string, so every place says it the
// same way. No catalog import here: the islands read it too.
import type { Lang } from '../i18n';

export const PORTRAIT_CREDIT: Record<Lang, string> = { en: 'AI image', de: 'KI-Bild' };

/** The alt of an AI portrait: the person's name, then the credit. */
export function portraitAlt(name: string, lang: Lang): string {
  return `${name}, ${PORTRAIT_CREDIT[lang]}`;
}
