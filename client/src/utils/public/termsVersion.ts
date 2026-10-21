// The terms' version and date. The values live in termsVersion.json, the one
// place a version step changes: the consent record, the app's terms page, both
// public terms pages and client/scripts/validate-seo.mjs read them from there.

import terms from './termsVersion.json';

type Language = 'en' | 'de';

/**
 * The terms version the consent record is stamped with. A stored record with
 * any other value shows the welcome screen again.
 */
export const CURRENT_AGB_VERSION: string = terms.version;

/** The terms' "Stand" / "Last updated" date, as an ISO day (YYYY-MM-DD). */
export const TERMS_DATE: string = terms.date;

/** "27. April 2026" / "April 27, 2026"; UTC so no time zone shifts the day. */
export function formatTermsDate(lang: Language, isoDay: string = TERMS_DATE): string {
  const [year, month, day] = isoDay.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** The header line of every terms page. */
export function termsVersionLine(lang: Language): string {
  return lang === 'de'
    ? `Version ${CURRENT_AGB_VERSION} · Stand: ${formatTermsDate('de')}`
    : `Version ${CURRENT_AGB_VERSION} · Last updated: ${formatTermsDate('en')}`;
}
