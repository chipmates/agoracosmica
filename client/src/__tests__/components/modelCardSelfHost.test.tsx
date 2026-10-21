// The open model card on a self-host instance: it has no free tier, so the
// card never names one; without a key or a local model it says there is no
// model yet.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';

const keys = vi.hoisted(() => ({ openrouter: null as string | null }));

vi.mock('../../config/deployment', () => ({ isSelfHost: true }));
vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: {
    getKey: vi.fn(async () => keys.openrouter),
    getKeyMetadata: vi.fn(async () => (keys.openrouter ? { valid: true } : null)),
    saveKey: vi.fn(async () => {}),
    deleteKey: vi.fn(async () => {}),
  },
}));
vi.mock('../../services/llm/llmService', () => ({ llmService: { validateKey: vi.fn(async () => true) } }));
vi.mock('../../hooks/useTranslation', () => {
  const api = () => ({
    t: (key: string) => key,
    tString: (_key: string, fallback?: string) => fallback ?? '',
    tNode: (key: string) => key,
  });
  return { default: api, useTranslation: api };
});

import AiModelPanel from '../../components/settings/panels/AiModelPanel';
import { defaultConfig, saveServiceConfig } from '../../services/audio/config/serviceConfig';

const Card = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
const FREE_TIER_WORDS = ['settings.aiModelKey.statusFree', 'settings.aiModelKey.modelTagline', 'settings.aiModelKey.keySectionIntro'];

describe('the open model card on a self-host instance', () => {
  afterEach(() => {
    cleanup();
    keys.openrouter = null;
  });

  it('no key, no local model: no model yet, and no free tier anywhere', async () => {
    saveServiceConfig({ ...defaultConfig });
    render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
    expect(await screen.findByText('settings.aiModelKey.statusNoModel')).toBeTruthy();
    for (const key of FREE_TIER_WORDS) expect(screen.queryByText(key)).toBeNull();
    expect(screen.getByText('settings.aiModelKey.keySectionIntroSelfHost')).toBeTruthy();
  });

  it('with a key: the key\'s model, and still no free tier', async () => {
    keys.openrouter = 'sk-or-v1-test';
    saveServiceConfig({ ...defaultConfig });
    render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
    expect(await screen.findByText('settings.aiModelKey.statusByok')).toBeTruthy();
    expect(screen.getByText('Qwen3 235B')).toBeTruthy();
    for (const key of FREE_TIER_WORDS) expect(screen.queryByText(key)).toBeNull();
  });

  it('with the local model: the local model', async () => {
    saveServiceConfig({
      ...defaultConfig,
      llm: { provider: 'custom-openai', kind: 'custom-openai', baseURL: 'http://127.0.0.1:1234/v1', model: 'qwen3-local' },
      localMode: { llmEnabled: true, ttsEnabled: false, sttEnabled: false },
    });
    render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
    expect(await screen.findByText('qwen3-local')).toBeTruthy();
    expect(screen.getByText('settings.aiModelKey.statusLocal')).toBeTruthy();
    for (const key of FREE_TIER_WORDS) expect(screen.queryByText(key)).toBeNull();
  });
});
