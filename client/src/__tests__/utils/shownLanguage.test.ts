// Beacon language labels come from the language the app is showing, held in
// memory, never from a storage read made for the count.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function captureBeacon() {
  const sendBeacon = vi.fn((_url: string, _body: Blob) => true);
  Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true, writable: true });
  return sendBeacon;
}

async function lastBody(sendBeacon: ReturnType<typeof captureBeacon>): Promise<Record<string, unknown>> {
  const calls = sendBeacon.mock.calls;
  return JSON.parse(await calls[calls.length - 1][1].text());
}

describe('beacon language', () => {
  beforeEach(() => {
    vi.resetModules();
    document.documentElement.lang = 'en';
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'sendBeacon');
    document.documentElement.lang = 'en';
  });

  it('ignores a stored language and reads no storage for the label', async () => {
    localStorage.setItem('selectedLanguage', 'de');
    localStorage.setItem('language', 'de');
    const getItem = vi.mocked(localStorage.getItem);
    getItem.mockClear();
    const sendBeacon = captureBeacon();
    const { sendFunnelBeacon } = await import('../../utils/funnelBeacon');
    getItem.mockClear();
    sendFunnelBeacon('figure_selected', { figureId: 'aurelius' });
    expect((await lastBody(sendBeacon)).language).toBe('en');
    const keysRead = getItem.mock.calls.map((c) => c[0]);
    expect(keysRead).not.toContain('selectedLanguage');
    expect(keysRead).not.toContain('language');
  });

  it('follows the language the app reports', async () => {
    const sendBeacon = captureBeacon();
    const { noteShownLanguage } = await import('../../utils/shownLanguage');
    const { sendFunnelBeacon } = await import('../../utils/funnelBeacon');
    const { detectCurrentLanguage } = await import('../../utils/playbackBeacon');
    noteShownLanguage('de');
    sendFunnelBeacon('mode_selected', { mode: 'story' });
    expect((await lastBody(sendBeacon)).language).toBe('de');
    expect(detectCurrentLanguage()).toBe('de');
    noteShownLanguage('en');
    sendFunnelBeacon('mode_selected', { mode: 'story' });
    expect((await lastBody(sendBeacon)).language).toBe('en');
  });

  it('falls back to the document language before the app reports one', async () => {
    document.documentElement.lang = 'de';
    const { shownLanguage } = await import('../../utils/shownLanguage');
    expect(shownLanguage()).toBe('de');
  });

  it('is reported by the language slice on boot and on a change', async () => {
    const shown = await import('../../utils/shownLanguage');
    const { useDomainStore } = await import('../../stores/domainStore');
    localStorage.setItem('selectedLanguage', 'de');
    await useDomainStore.getState().initializeLanguage();
    expect(shown.shownLanguage()).toBe('de');
    await useDomainStore.getState().setLanguage('en');
    expect(shown.shownLanguage()).toBe('en');
  });
});
