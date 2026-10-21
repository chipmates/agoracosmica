// When a Local Mode audio service does not answer, the app says so in its own
// language, through the banner that already reports audio outages.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import en from '../../assets/translations/ui-en.json';
import de from '../../assets/translations/ui-de.json';

const h = vi.hoisted(() => ({ lang: 'en' as 'en' | 'de' }));

vi.mock('../../hooks/useTranslation', async () => {
  const bundles = {
    en: (await import('../../assets/translations/ui-en.json')).default,
    de: (await import('../../assets/translations/ui-de.json')).default,
  };
  const lookup = (bundle: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);
  return {
    useTranslation: () => ({
      tString: (key: string, fallback?: string) => {
        const value = lookup(bundles[h.lang], key);
        return typeof value === 'string' ? value : fallback ?? '';
      },
      language: h.lang,
    }),
  };
});

import NetworkStatusBanner from '../../components/NetworkStatusBanner';

const lines = {
  en: { stt: en.errors.network.localSttUnavailable, tts: en.errors.network.localTtsUnavailable },
  de: { stt: de.errors.network.localSttUnavailable, tts: de.errors.network.localTtsUnavailable },
};

const report = (service: 'stt' | 'tts') =>
  act(() => { window.dispatchEvent(new CustomEvent('local-mode-unavailable', { detail: { service } })); });

describe('the Local Mode banner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.lang = 'en';
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each(['en', 'de'] as const)('names the service that did not answer (%s)', (lang) => {
    h.lang = lang;
    render(<NetworkStatusBanner />);
    expect(screen.queryByRole('alert')).toBeNull();

    report('stt');
    expect(screen.getByRole('alert').textContent).toBe(lines[lang].stt);

    report('tts');
    expect(screen.getByRole('alert').textContent).toBe(lines[lang].tts);
  });

  it('shows the voice line once a minute while every chunk reports, for 10 s each time', () => {
    render(<NetworkStatusBanner />);
    report('tts');
    expect(screen.getByRole('alert').textContent).toBe(lines.en.tts);
    act(() => { vi.advanceTimersByTime(6000); });
    report('tts');
    act(() => { vi.advanceTimersByTime(4100); });
    expect(screen.queryByRole('alert')).toBeNull();

    report('tts');
    expect(screen.queryByRole('alert')).toBeNull();

    act(() => { vi.advanceTimersByTime(50_000); });
    report('tts');
    expect(screen.getByRole('alert').textContent).toBe(lines.en.tts);
  });

  it('shows the transcription line on every recording', () => {
    render(<NetworkStatusBanner />);
    report('stt');
    act(() => { vi.advanceTimersByTime(10_100); });
    expect(screen.queryByRole('alert')).toBeNull();

    report('stt');
    expect(screen.getByRole('alert').textContent).toBe(lines.en.stt);
  });

  it('keeps every line short and free of dashes and semicolons', () => {
    for (const line of [lines.en.stt, lines.en.tts, lines.de.stt, lines.de.tts]) {
      expect(line).toBeTruthy();
      expect(line).not.toMatch(/[\u2013\u2014;]| - /);
      expect(line.length).toBeLessThanOrEqual(120);
    }
  });
});
