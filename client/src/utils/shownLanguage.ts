// The language the app is showing, held in memory for the count labels, so no
// beacon reads the browser's storage for it. The language slice reports every
// change; before the first report, the document's own lang attribute stands in.

let shown: 'en' | 'de' | null = null;

export function noteShownLanguage(lang: string): void {
  shown = lang.toLowerCase().startsWith('de') ? 'de' : 'en';
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
