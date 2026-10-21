// A stored key OpenRouter rejected, with Local Mode's model on: the local model
// answers, so the card and its badge name it first; a passing test of the
// stored key makes the key usable again without taking the conversation away
// from the local model.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  meta: null as null | { valid: boolean; lastValidated?: string },
  stored: null as null | string,
}));

vi.mock('../../hooks/useTranslation', async () => {
  const de = (await import('../../assets/translations/ui-de.json')).default;
  const lookup = (key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], de);
  const t = (key: string, fallback?: unknown) => {
    const value = lookup(key);
    return typeof value === 'string' ? value : typeof fallback === 'string' ? fallback : key;
  };
  const api = { t, tString: t, tNode: t, tArray: () => [], language: 'de' };
  return { default: () => api, useTranslation: () => api };
});
vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: {
    getKey: vi.fn(async () => h.stored),
    getKeyMetadata: vi.fn(async () => h.meta),
    hasKey: vi.fn(async () => h.stored !== null),
    hasUsableKey: vi.fn(async () => h.meta !== null && h.meta.valid !== false),
    saveKey: vi.fn(async (_provider: string, value: string) => {
      h.stored = value;
      h.meta = { valid: true };
    }),
    deleteKey: vi.fn(),
  },
}));
vi.mock('../../services/llm/llmService', () => ({ llmService: { validateKey: vi.fn(async () => true) } }));
vi.mock('../../components/settings/panels/LanguagePanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/VoicePanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/SpeechPanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/LocalModePanel', () => ({ default: () => null }));

class NoResize {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', NoResize);

import AiModelPanel from '../../components/settings/panels/AiModelPanel';
import PraeferenzenPanel from '../../components/settings/panels/PraeferenzenPanel';
import { useDomainStore } from '../../stores/domainStore';
import { defaultConfig, saveServiceConfig, localModeFromRaw } from '../../services/audio/config/serviceConfig';
import de from '../../assets/translations/ui-de.json';

const Card = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const LOCAL_LLM = { provider: 'custom-openai', kind: 'custom-openai' as const, baseURL: 'http://127.0.0.1:1234/v1', model: 'qwen3-local' };
const raw = () => useDomainStore.getState().serviceConfig.raw as string;
const savedLlm = () => (JSON.parse(raw()) as { llm: { kind?: string; baseURL?: string; model: string } }).llm;

describe('a rejected key beside Local Mode\'s model', () => {
  beforeEach(() => {
    h.stored = 'sk-or-v1-rejected';
    h.meta = { valid: false, lastValidated: '2026-10-21T09:00:00' };
    saveServiceConfig({ ...defaultConfig, llm: { ...LOCAL_LLM }, localMode: { llmEnabled: true, ttsEnabled: false, sttEnabled: false } });
  });
  afterEach(() => cleanup());

  it('the card names the local model; the key field still says the key was rejected', async () => {
    render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
    await settle();

    expect(screen.getByText('qwen3-local')).toBeTruthy();
    expect(screen.getByText(de.settings.aiModelKey.statusLocal)).toBeTruthy();
    expect(screen.queryByText(de.settings.aiModelKey.statusRejected)).toBeNull();
    expect(screen.getByText(de.settings.apiKeys.statusRejected)).toBeTruthy();
  });

  it('the card badge names the local model', async () => {
    render(
      <PraeferenzenPanel
        config={{ ttsEnabled: true, sttEnabled: true }}
        selectedLanguage="de"
        onChange={() => {}}
        onLanguageChange={() => {}}
        SettingCard={Card}
        OptionButtons={Card}
        CATEGORY_ICONS={{}}
      />,
    );
    await settle();

    expect(screen.getByText(de.settings.preferences.aiModelBadgeLocal)).toBeTruthy();
    expect(screen.queryByText(de.settings.preferences.aiModelBadgeRejected)).toBeNull();
  });

  it('a passing test of the stored key keeps the conversation on the local model', async () => {
    render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
    await settle();

    fireEvent.click(screen.getByText(de.settings.apiKeys.buttonTest));
    await settle();

    expect(h.meta).toEqual({ valid: true });
    expect(savedLlm()).toMatchObject({ kind: 'custom-openai', baseURL: LOCAL_LLM.baseURL, model: LOCAL_LLM.model });
    expect(localModeFromRaw(raw()).llmEnabled).toBe(true);
  });
});
