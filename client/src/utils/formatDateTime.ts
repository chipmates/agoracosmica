// A date and time in the app's language, not the browser's. A browser set to
// the same language keeps its regional form (en-GB, de-AT).
export function formatDateTime(value: string | number | Date, appLanguage: string): string {
  const lang = appLanguage.toLowerCase().startsWith('de') ? 'de' : 'en';
  const browser = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  const locale = browser.toLowerCase().split('-')[0] === lang ? browser : lang;
  try {
    return new Date(value).toLocaleString(locale);
  } catch {
    return new Date(value).toLocaleString(lang);
  }
}
