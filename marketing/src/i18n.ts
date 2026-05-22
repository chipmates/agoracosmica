// Thin Astro-side wrapper around the existing public-page i18n helpers.
// Single source of truth lives in ../client/src/utils/public/publicI18n.ts —
// same translations, same key lookup, same fallback chain. Importing into
// Astro keeps both renderers in lockstep.

export type Lang = 'en' | 'de';

export const LOCALES = ['en', 'de'] as const satisfies readonly Lang[];
export const DEFAULT_LOCALE: Lang = 'en';

export { getPublicT as getT } from '@client/utils/public/publicI18n';

/**
 * Narrow Astro.currentLocale to our Lang union. Astro guarantees the value
 * matches one of the configured locales, but its type is `string | undefined`,
 * so this gives back a strongly-typed value usable across all pages.
 */
export function asLang(value: string | undefined): Lang {
  return value === 'de' ? 'de' : 'en';
}
