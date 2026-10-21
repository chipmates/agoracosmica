// Dates and times in the app's language, not the browser's. A browser set to
// the same language keeps its regional form (en-GB, de-AT).
function localeFor(appLanguage: string): { locale: string; lang: string } {
  const lang = appLanguage.toLowerCase().startsWith('de') ? 'de' : 'en';
  const browser = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return { locale: browser.toLowerCase().split('-')[0] === lang ? browser : lang, lang };
}

export function formatDateTime(value: string | number | Date, appLanguage: string): string {
  const { locale, lang } = localeFor(appLanguage);
  try {
    return new Date(value).toLocaleString(locale);
  } catch {
    return new Date(value).toLocaleString(lang);
  }
}

export function formatTime(value: string | number | Date, appLanguage: string): string {
  const { locale, lang } = localeFor(appLanguage);
  try {
    return new Date(value).toLocaleTimeString(locale);
  } catch {
    return new Date(value).toLocaleTimeString(lang);
  }
}

export function formatDate(value: string | number | Date, appLanguage: string): string {
  const { locale, lang } = localeFor(appLanguage);
  try {
    return new Date(value).toLocaleDateString(locale, { dateStyle: 'long' });
  } catch {
    return new Date(value).toLocaleDateString(lang, { dateStyle: 'long' });
  }
}
