// The hosted badges on the Settings cards: the model badge makes a precise
// free-tier claim (never "free" alone), and voice and voice input name whose
// servers they are, so beside "Local" nobody reads them as their own.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import en from '../../assets/translations/ui-en.json';
import de from '../../assets/translations/ui-de.json';

const h = vi.hoisted(() => ({ lang: 'de' as 'en' | 'de' }));

vi.mock('../../hooks/useTranslation', async () => {
  const bundles = {
    en: (await import('../../assets/translations/ui-en.json')).default,
    de: (await import('../../assets/translations/ui-de.json')).default,
  };
  const lookup = (bundle: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);
  const t = (key: string, fallback?: string) => {
    const value = lookup(bundles[h.lang], key);
    return typeof value === 'string' ? value : fallback ?? key;
  };
  return { useTranslation: () => ({ tString: t, tNode: t, t, language: h.lang }) };
});
vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: { hasUsableKey: vi.fn(async () => false) },
}));
vi.mock('../../components/settings/panels/LanguagePanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/VoicePanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/SpeechPanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/AiModelPanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/LocalModePanel', () => ({ default: () => null }));

class NoResize {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', NoResize);

import PraeferenzenPanel from '../../components/settings/panels/PraeferenzenPanel';
import { defaultConfig, saveServiceConfig } from '../../services/audio/config/serviceConfig';

const Card = () => null;
const openPanel = async () => {
  saveServiceConfig({ ...defaultConfig, localMode: { llmEnabled: false, ttsEnabled: false, sttEnabled: false } });
  render(
    <PraeferenzenPanel
      config={{ ttsEnabled: true, sttEnabled: true }}
      selectedLanguage={h.lang}
      onChange={() => {}}
      onLanguageChange={() => {}}
      SettingCard={Card}
      OptionButtons={Card}
      CATEGORY_ICONS={{}}
    />,
  );
  await act(async () => {});
};

const badgeTexts = () =>
  [...document.querySelectorAll('[class*="badge" i]')].map((el) => el.textContent?.trim() ?? '').filter(Boolean);

describe('the hosted badges on the Settings cards', () => {
  beforeEach(() => {
    h.lang = 'de';
  });
  afterEach(() => cleanup());

  it('German: our servers for voice and voice input, the free tier by its name', async () => {
    await openPanel();

    expect(screen.getAllByText('Unsere Server')).toHaveLength(2);
    expect(screen.getByText('Kostenloser Tarif')).toBeTruthy();
    expect(screen.queryByText('Selbst gehostet')).toBeNull();
    expect(screen.queryByText('Europa · Kostenlos')).toBeNull();
  });

  it('English: our servers, and the free tier as before', async () => {
    h.lang = 'en';
    await openPanel();

    expect(screen.getAllByText('Our servers')).toHaveLength(2);
    expect(screen.getByText('Europe · Free tier')).toBeTruthy();
    expect(screen.queryByText('Self-hosted')).toBeNull();
  });

  it('no badge word breaks the house rules, in either language', () => {
    for (const bundle of [de, en]) {
      const lines = Object.values(bundle.settings.preferences as Record<string, string>);
      for (const line of lines) {
        expect(line).not.toMatch(/[–—]/);
        expect(line).not.toMatch(/\bprivat/i);
        // "free" or "kostenlos" only as a named tier, never alone.
        if (/\bfree\b|kostenlos/i.test(line)) expect(line).toMatch(/free tier|kostenloser tarif/i);
      }
    }
  });

  it('the badges are what the cards show', async () => {
    await openPanel();
    const shown = badgeTexts();
    expect(shown).toEqual(expect.arrayContaining(['Unsere Server', 'Kostenloser Tarif']));
  });
});
