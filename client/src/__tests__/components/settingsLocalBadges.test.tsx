// The Settings cards for voice, voice input and the model carry a short badge
// that says where each one runs. With a service in Local Mode the badge says
// so, in the app's language, and follows the Local Mode switches while
// Settings are open.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import en from '../../assets/translations/ui-en.json';
import de from '../../assets/translations/ui-de.json';

const h = vi.hoisted(() => ({ lang: 'de' as 'en' | 'de', byok: false }));

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
  keyStorage: { hasUsableKey: vi.fn(async () => h.byok) },
}));
// The panels inside the cards are not under test here.
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

// Local Mode's model switch is on only together with its route, as the panel saves them.
const LOCAL_LLM = { provider: 'custom-openai', kind: 'custom-openai' as const, baseURL: 'http://127.0.0.1:1234/v1', model: 'local-model' };
const setLocal = (llmEnabled: boolean, ttsEnabled: boolean, sttEnabled: boolean) =>
  saveServiceConfig({ ...defaultConfig, llm: llmEnabled ? LOCAL_LLM : defaultConfig.llm, localMode: { llmEnabled, ttsEnabled, sttEnabled } });

const Card = () => null;
const openPanel = () => render(
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

const badges = (lines: { ourServers: string; local: string; aiModelBadgeFree: string; aiModelBadgeLocal: string }) => ({
  hosted: screen.queryAllByText(lines.ourServers).length,
  local: screen.queryAllByText(lines.local).length,
  freeModel: screen.queryAllByText(lines.aiModelBadgeFree).length,
  localModel: screen.queryAllByText(lines.aiModelBadgeLocal).length,
});

const DE = de.settings.preferences as unknown as { ourServers: string; local: string; aiModelBadgeFree: string; aiModelBadgeLocal: string };
const EN = en.settings.preferences as unknown as typeof DE;

describe('the Settings badges in Local Mode', () => {
  beforeEach(() => {
    h.lang = 'de';
    h.byok = false;
  });
  afterEach(() => cleanup());

  it('German, all three local: the local labels, no hosted or free label', async () => {
    setLocal(true, true, true);
    openPanel();
    await act(async () => {});

    expect(DE.local).toBeTruthy();
    expect(badges(DE)).toEqual({ hosted: 0, local: 2, freeModel: 0, localModel: 1 });
  });

  it('English, all three local: the local labels', async () => {
    h.lang = 'en';
    setLocal(true, true, true);
    openPanel();
    await act(async () => {});

    expect(EN.local).toBeTruthy();
    expect(badges(EN)).toEqual({ hosted: 0, local: 2, freeModel: 0, localModel: 1 });
  });

  it('only the voice local: only the voice card says so', async () => {
    setLocal(false, true, false);
    openPanel();
    await act(async () => {});

    expect(badges(DE)).toEqual({ hosted: 1, local: 1, freeModel: 1, localModel: 0 });
  });

  it('a local model wins over a saved key, as the chat does', async () => {
    h.byok = true;
    setLocal(true, false, false);
    openPanel();
    await act(async () => {});

    expect(badges(DE).localModel).toBe(1);
  });

  it('follows the Local Mode switches while Settings are open', async () => {
    setLocal(false, false, false);
    openPanel();
    await act(async () => {});
    expect(badges(DE)).toEqual({ hosted: 2, local: 0, freeModel: 1, localModel: 0 });

    act(() => setLocal(true, true, true));

    expect(badges(DE)).toEqual({ hosted: 0, local: 2, freeModel: 0, localModel: 1 });
  });
});
