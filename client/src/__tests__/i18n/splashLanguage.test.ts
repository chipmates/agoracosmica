// The static splash shows before the app loads. A same-origin script picks its
// language the way the app will at start (?lang=, the stored choice, the
// browser), so a German visitor never sees the English lines first. The
// splash's lines are the app's own locked strings, word for word.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import uiEn from '../../assets/translations/ui-en.json';
import uiDe from '../../assets/translations/ui-de.json';

const CLIENT = resolve(__dirname, '../../..');
const script = readFileSync(resolve(CLIENT, 'public/splash-lang.js'), 'utf8');
const shell = readFileSync(resolve(CLIENT, 'index.html'), 'utf8');

function runAt(search: string): string {
  window.history.replaceState({}, '', `/app${search}`);
  new Function(script)();
  return document.documentElement.lang;
}

describe('splash language', () => {
  beforeEach(() => {
    document.documentElement.lang = 'en';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
    document.documentElement.lang = 'en';
  });

  it('follows the stored choice over the browser', () => {
    localStorage.setItem('selectedLanguage', 'de');
    expect(runAt('')).toBe('de');
    vi.stubGlobal('navigator', { ...navigator, language: 'de-DE' });
    localStorage.setItem('selectedLanguage', 'en');
    expect(runAt('')).toBe('en');
  });

  it('follows a lang link over the stored choice', () => {
    localStorage.setItem('selectedLanguage', 'en');
    expect(runAt('?lang=de&figure=laozi')).toBe('de');
  });

  it('falls back to the browser, as the app does', () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'de-AT' });
    expect(runAt('')).toBe('de');
    localStorage.setItem('selectedLanguage', 'fr');
    expect(runAt('')).toBe('de');
    vi.stubGlobal('navigator', { ...navigator, language: 'fr-FR' });
    expect(runAt('')).toBe('en');
  });

  it('is loaded as a same-origin script in the head, before the splash', () => {
    const tag = shell.indexOf('<script src="/splash-lang.js"></script>');
    expect(tag).toBeGreaterThan(-1);
    expect(tag).toBeLessThan(shell.indexOf('</head>'));
  });

  it('carries the app\'s locked lines in both languages', () => {
    const splash = shell.slice(shell.indexOf('<div class="agc-splash"'), shell.indexOf('<script src="/config.js">'));
    const text = (lang: string) => [...splash.matchAll(new RegExp(`<span lang="${lang}">([^<]*)</span>`, 'g'))].map((m) => m[1]);
    expect(text('en')).toEqual([uiEn.app.brandTagline, uiEn.entry.trustLine]);
    expect(text('de')).toEqual([uiDe.app.brandTagline, uiDe.entry.trustLine]);
  });
});
