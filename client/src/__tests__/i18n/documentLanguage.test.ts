// The page's lang attribute names the language the app shows (WCAG 3.1.1), so
// screen readers and hyphenation treat German text as German.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('document language', () => {
  beforeEach(() => {
    vi.resetModules();
    document.documentElement.lang = 'en';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.lang = 'en';
  });

  it('is German from the first moment of a German start', async () => {
    localStorage.setItem('selectedLanguage', 'de');
    const { useDomainStore } = await import('../../stores/domainStore');
    const boot = useDomainStore.getState().initializeLanguage();
    expect(document.documentElement.lang).toBe('de');
    await boot;
    expect(document.documentElement.lang).toBe('de');
  });

  it('follows every change of the app language', async () => {
    localStorage.setItem('selectedLanguage', 'en');
    const { useDomainStore } = await import('../../stores/domainStore');
    await useDomainStore.getState().initializeLanguage();
    expect(document.documentElement.lang).toBe('en');
    await useDomainStore.getState().setLanguage('de');
    expect(document.documentElement.lang).toBe('de');
    await useDomainStore.getState().setLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('takes a German browser when no language is stored', async () => {
    vi.stubGlobal('navigator', { ...navigator, language: 'de-AT' });
    const { useDomainStore } = await import('../../stores/domainStore');
    await useDomainStore.getState().initializeLanguage();
    expect(document.documentElement.lang).toBe('de');
  });
});
