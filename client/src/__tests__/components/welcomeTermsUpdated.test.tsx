// A browser whose stored record holds another terms version sees one line on
// what changed, with the version, the date and the link to the terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import uiDe from '../../assets/translations/ui-de.json';
import uiEn from '../../assets/translations/ui-en.json';

vi.mock('../../storage/preferencesIndexedDbAdapter', () => ({
  preferencesIndexedDbAdapter: {
    hasUserProfile: vi.fn(() => Promise.resolve(true)),
    setUserProfile: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('../../utils/entryBeacon', () => ({ sendEntryBeacon: vi.fn() }));
vi.mock('../../utils/signupBeacon', () => ({ sendSignupBeacon: vi.fn() }));
vi.mock('../../utils/funnelBeacon', () => ({ sendFunnelBeaconOnce: vi.fn(), sendFunnelBeacon: vi.fn() }));
vi.mock('../../utils/public/gclidCapture', () => ({ sendConversion: vi.fn() }));

import WelcomeDisclosureModal from '../../components/WelcomeDisclosureModal';
import { useDomainStore } from '../../stores';
import { CURRENT_AGB_VERSION, formatTermsDate } from '../../utils/public/termsVersion';
import type { Translation } from '../../types/global';

const setLanguage = (lang: 'de' | 'en') =>
  useDomainStore.setState((s) => ({
    language: { ...s.language, current: lang, uiTranslations: (lang === 'de' ? uiDe : uiEn) as unknown as Translation },
  }));

const show = () => {
  render(<WelcomeDisclosureModal isOpen onComplete={() => {}} onSkip={() => {}} />);
  return document.getElementById('agc-terms-updated');
};

const NBSP = '\u00a0';

describe('the line for a returning browser', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    setLanguage('de');
  });

  it('names the version, the date and links the German terms', () => {
    localStorage.setItem('agb_consent', JSON.stringify({ version: '1.0.0', timestamp: 1 }));
    const line = show();
    expect(line).not.toBeNull();
    const text = (line?.textContent ?? '').split(NBSP).join(' ');
    expect(text).toContain(`Version ${CURRENT_AGB_VERSION}`);
    expect(text).toContain(formatTermsDate('de'));
    expect(text).toContain('Nutzungsbedingungen');
    expect(line?.querySelector('a')?.getAttribute('href')).toBe('/nutzungsbedingungen');
  });

  it('speaks English with the English terms', () => {
    setLanguage('en');
    localStorage.setItem('agb_consent', JSON.stringify({ version: '1.0.0', timestamp: 1 }));
    const line = show();
    const text = (line?.textContent ?? '').split(NBSP).join(' ');
    expect(text).toContain(`version ${CURRENT_AGB_VERSION}`);
    expect(text).toContain(formatTermsDate('en'));
    expect(line?.querySelector('a')?.getAttribute('href')).toBe('/terms');
  });

  it('stays away on a first visit', () => {
    expect(show()).toBeNull();
  });

  // The phone layout tightens only the returning footer (the CSS module's
  // footerWithUpdate); a first visit keeps its footer as it was.
  it('marks the footer only when the line is shown', () => {
    const footerOf = () => document.getElementById('agc-clickwrap-notice')?.parentElement?.className ?? '';
    show();
    expect(footerOf()).not.toMatch(/footerWithUpdate/);
    cleanup();
    localStorage.setItem('agb_consent', JSON.stringify({ version: '1.0.0', timestamp: 1 }));
    show();
    expect(footerOf()).toMatch(/footerWithUpdate/);
  });

  it('stays away over a record of the current version', () => {
    localStorage.setItem('agb_consent', JSON.stringify({ version: CURRENT_AGB_VERSION, timestamp: 1 }));
    expect(show()).toBeNull();
  });

  it('stays away when the record names no version', () => {
    localStorage.setItem('agb_consent', JSON.stringify({ timestamp: 1 }));
    expect(show()).toBeNull();
  });

  it.each([['de', uiDe], ['en', uiEn]] as const)('keeps the %s wording to the copy rules', (_lang, ui) => {
    const consent = (ui as unknown as { legal: { consent: Record<string, string> } }).legal.consent;
    const line = `${consent.termsUpdated} ${consent.termsUpdatedLink}`;
    expect(line).toContain('{link}');
    expect(line).not.toMatch(/[\u2013\u2014;]/);
    expect(line).not.toMatch(/\b(free|kostenlos|private|privat)\b/i);
  });
});
