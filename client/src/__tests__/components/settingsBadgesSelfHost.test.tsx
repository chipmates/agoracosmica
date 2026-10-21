// On a self-host instance there is no free tier and none of our servers: the
// model badge never says "Kostenloser Tarif" and the voice badges never say
// "Unsere Server". Without a key the model badge says so; audio served by the
// operator's endpoint is the audio server.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({ lang: 'de' as 'en' | 'de', byok: false, rejected: false }));

vi.mock('../../config/deployment', () => ({ isSelfHost: true }));
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
  keyStorage: {
    hasUsableKey: vi.fn(async () => h.byok),
    hasKey: vi.fn(async () => h.byok || h.rejected),
  },
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
const open = async (voice: boolean, local = { llm: false, tts: false, stt: false }) => {
  saveServiceConfig({ ...defaultConfig, localMode: { llmEnabled: local.llm, ttsEnabled: local.tts, sttEnabled: local.stt } });
  render(
    <PraeferenzenPanel
      config={{ ttsEnabled: voice, sttEnabled: voice }}
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

describe('the Settings badges on a self-host instance', () => {
  beforeEach(() => {
    h.lang = 'de';
    h.byok = false;
    h.rejected = false;
  });
  afterEach(() => cleanup());

  it('German, no key, no audio service: no free tier, no servers of ours', async () => {
    await open(false);
    expect(screen.getByText('Kein Key')).toBeTruthy();
    expect(screen.getAllByText('Deaktiviert')).toHaveLength(2);
    expect(screen.queryByText('Kostenloser Tarif')).toBeNull();
    expect(screen.queryByText('Unsere Server')).toBeNull();
  });

  it('German, an operator audio endpoint: the audio server', async () => {
    await open(true);
    expect(screen.getAllByText('Audio-Server')).toHaveLength(2);
    expect(screen.queryByText('Unsere Server')).toBeNull();
  });

  it('German, Local Mode and a key: as on the hosted site', async () => {
    h.byok = true;
    await open(true, { llm: false, tts: true, stt: true });
    expect(screen.getAllByText('Lokal')).toHaveLength(2);
    expect(screen.getByText('Eigener Key')).toBeTruthy();
  });

  it('German, a rejected key: the badge says so, no free tier', async () => {
    h.rejected = true;
    await open(true);
    expect(screen.getByText('Key abgelehnt')).toBeTruthy();
    expect(screen.queryByText('Kein Key')).toBeNull();
    expect(screen.queryByText('Kostenloser Tarif')).toBeNull();
  });

  it('English: no key, the audio server', async () => {
    h.lang = 'en';
    await open(true);
    expect(screen.getByText('No key')).toBeTruthy();
    expect(screen.getAllByText('Audio server')).toHaveLength(2);
    expect(screen.queryByText('Europe · Free tier')).toBeNull();
    expect(screen.queryByText('Our servers')).toBeNull();
  });

  it('the new words keep the house rules and the width of the free-tier badge', async () => {
    const de = (await import('../../assets/translations/ui-de.json')).default.settings.preferences as Record<string, string>;
    const en = (await import('../../assets/translations/ui-en.json')).default.settings.preferences as Record<string, string>;
    for (const line of [de.aiModelBadgeNoKey, de.audioServer, en.aiModelBadgeNoKey, en.audioServer]) {
      expect(line.length).toBeLessThanOrEqual('Europe · Free tier'.length);
      expect(line).not.toMatch(/[–—;]|\bfree\b|kostenlos|privat/i);
    }
  });
});
