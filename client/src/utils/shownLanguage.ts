// The language the app is showing, held in memory for the count labels, so no
// beacon reads the browser's storage for it. The language slice reports every
// change, and the page's lang attribute follows it (WCAG 3.1.1: screen readers
// and hyphenation read German text as German). Before the first report, the
// document's own lang attribute stands in.

let shown: 'en' | 'de' | null = null;

export function noteShownLanguage(lang: string): void {
  shown = lang.toLowerCase().startsWith('de') ? 'de' : 'en';
  try {
    if (typeof document !== 'undefined') document.documentElement.lang = shown;
  } catch {
    // no document to mark
  }
}

export function shownLanguage(): 'en' | 'de' {
  if (shown) return shown;
  try {
    const docLang = typeof document !== 'undefined' ? document.documentElement.lang : '';
    return docLang.toLowerCase().startsWith('de') ? 'de' : 'en';
  } catch {
    return 'en';
  }
}
