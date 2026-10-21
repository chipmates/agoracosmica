// The open model card on a self-host instance: it has no free tier, so the
// card never names one, a rejected key included; without a key or a local
// model it says there is no model yet.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';

const keys = vi.hoisted(() => ({ openrouter: null as string | null, rejected: false }));

vi.mock('../../config/deployment', () => ({ isSelfHost: true }));
vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: {
    getKey: vi.fn(async () => keys.openrouter),
    getKeyMetadata: vi.fn(async () => (keys.openrouter ? { valid: !keys.rejected } : null)),
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
const FREE_TIER_WORDS = [
  'settings.aiModelKey.statusFree', 'settings.aiModelKey.modelTagline', 'settings.aiModelKey.keySectionIntro',
  'settings.aiModelKey.statusRejected',
];

describe('the open model card on a self-host instance', () => {
  afterEach(() => {
    cleanup();
    keys.openrouter = null;
    keys.rejected = false;
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
    expect(await screen.findByText('settings.aiModelKey.statusByokSelfHost')).toBeTruthy();
    expect(screen.getByText('Qwen3 235B')).toBeTruthy();
    for (const key of FREE_TIER_WORDS) expect(screen.queryByText(key)).toBeNull();
    // "No daily limit" is said against the free tier's daily limit, which this build does not have.
    expect(screen.queryByText('settings.aiModelKey.statusByok')).toBeNull();
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

  it('a rejected key: says so and points to the key and Local Mode, with no free tier', async () => {
    keys.openrouter = 'sk-or-v1-test';
    keys.rejected = true;
    saveServiceConfig({ ...defaultConfig });
    render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
    expect(await screen.findByText('settings.aiModelKey.statusRejectedSelfHost')).toBeTruthy();
    for (const key of FREE_TIER_WORDS) expect(screen.queryByText(key)).toBeNull();
  });

  it('the rejected line names no free tier in either language', async () => {
    const de = (await import('../../assets/translations/ui-de.json')).default.settings.aiModelKey as Record<string, unknown>;
    const en = (await import('../../assets/translations/ui-en.json')).default.settings.aiModelKey as Record<string, unknown>;
    for (const line of [de.statusRejectedSelfHost, en.statusRejectedSelfHost]) {
      expect(typeof line).toBe('string');
      expect(line).not.toMatch(/kostenlos|Tarif|\bfree\b|\btier\b|[–—;]/i);
    }
  });
});
