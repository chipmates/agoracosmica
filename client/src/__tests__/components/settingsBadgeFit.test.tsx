// A Settings card's badge sits beside its title, which may take two lines. On
// a 360 px phone the longest badges that leave "Dein Key & KI-Modell" whole
// are the free-tier ones, "Kostenloser Tarif" and "Europe · Free tier" (17
// and 18 characters). The model badge names the route (own key, local model,
// a rejected key), and the panel below names the model. On narrow screens a longer badge wraps
// instead of cutting the title.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const h = vi.hoisted(() => ({ lang: 'de' as 'en' | 'de', byok: false, rejected: false }));

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

const FITS_AT_360 = 'Europe · Free tier'.length;

const Card = () => null;
// Local Mode's model switch is on only together with its route, as the panel saves them.
const LOCAL_LLM = { provider: 'custom-openai', kind: 'custom-openai' as const, baseURL: 'http://127.0.0.1:1234/v1', model: 'local-model' };
const badgesIn = async (state: { llm: boolean; tts: boolean; stt: boolean; byok: boolean; voice: boolean; rejected?: boolean }) => {
  h.byok = state.byok;
  h.rejected = state.rejected ?? false;
  saveServiceConfig({
    ...defaultConfig,
    llm: state.llm ? LOCAL_LLM : defaultConfig.llm,
    localMode: { llmEnabled: state.llm, ttsEnabled: state.tts, sttEnabled: state.stt },
  });
  render(
    <PraeferenzenPanel
      config={{ ttsEnabled: state.voice, sttEnabled: state.voice }}
      selectedLanguage={h.lang}
      onChange={() => {}}
      onLanguageChange={() => {}}
      SettingCard={Card}
      OptionButtons={Card}
      CATEGORY_ICONS={{}}
    />,
  );
  await act(async () => {});
  const texts = [...document.querySelectorAll('[class*="badge" i]')].map((el) => el.textContent?.trim() ?? '').filter(Boolean);
  cleanup();
  return texts;
};

const STATES = {
  hosted: { llm: false, tts: false, stt: false, byok: false, voice: true },
  local: { llm: true, tts: true, stt: true, byok: false, voice: true },
  mixed: { llm: false, tts: true, stt: false, byok: false, voice: true },
  ownKey: { llm: false, tts: false, stt: false, byok: true, voice: true },
  ownKeyMixed: { llm: false, tts: false, stt: true, byok: true, voice: true },
  voiceOff: { llm: false, tts: false, stt: false, byok: false, voice: false },
  rejected: { llm: false, tts: false, stt: false, byok: false, voice: true, rejected: true },
};

describe('the Settings card badges leave the title its room', () => {
  beforeEach(() => {
    h.lang = 'de';
    h.byok = false;
  });
  afterEach(() => cleanup());

  for (const lang of ['de', 'en'] as const) {
    for (const [name, state] of Object.entries(STATES)) {
      it(`${lang}, ${name}: no badge is longer than the free-tier ones`, async () => {
        h.lang = lang;
        const texts = await badgesIn(state);
        expect(texts.length).toBeGreaterThanOrEqual(4);
        for (const text of texts) expect({ text, length: text.length }).toEqual({ text, length: Math.min(text.length, FITS_AT_360) });
      });
    }
  }

  it('the model badge names the route and leaves the model to the panel', async () => {
    expect(await badgesIn(STATES.ownKey)).toContain('Eigener Key');
    expect(await badgesIn(STATES.local)).toContain('Lokales Modell');
    expect(await badgesIn(STATES.rejected)).toContain('Key abgelehnt');
    h.lang = 'en';
    expect(await badgesIn(STATES.ownKey)).toContain('Your key');
    expect(await badgesIn(STATES.local)).toContain('Local model');
    expect(await badgesIn(STATES.rejected)).toContain('Key rejected');
  });

  it('on narrow screens a badge longer than its share wraps instead of cutting the title', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/components/settings/CollapsibleSection.module.css'), 'utf8');
    const mobile = css.slice(css.indexOf('@media (max-width: 768px)'));
    const badge = mobile.slice(mobile.indexOf('.badge {'), mobile.indexOf('}', mobile.indexOf('.badge {')));
    expect(badge).toMatch(/max-width:\s*min\(/);
    expect(badge).toMatch(/white-space:\s*normal/);
  });
});
