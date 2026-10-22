// Local Mode takes any address (this computer, another one on the network, a
// rented server), so no line places it on the visitor's computer. On a
// self-host build the key intro holds in every state, Local Mode's model on
// beside a stored key included, and the key screen names no free-tier contrast.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({ lang: 'de' as 'de' | 'en', selfHost: false }));

vi.mock('../../config/deployment', () => ({
  get isSelfHost() {
    return h.selfHost;
  },
}));
vi.mock('../../hooks/useTranslation', async () => {
  const bundles = {
    de: (await import('../../assets/translations/ui-de.json')).default,
    en: (await import('../../assets/translations/ui-en.json')).default,
  };
  const lookup = (key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundles[h.lang]);
  const t = (key: string, second?: unknown) => {
    const value = lookup(key);
    if (typeof value !== 'string') return typeof second === 'string' ? second : key;
    if (second && typeof second === 'object') {
      return Object.entries(second as Record<string, string>).reduce((text, [name, v]) => text.replace(`{${name}}`, v), value);
    }
    return value;
  };
  const api = () => ({ t, tString: t, tNode: t, tArray: () => [], language: h.lang });
  return { default: api, useTranslation: api };
});
vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: {
    getKey: vi.fn(async () => null),
    getKeyMetadata: vi.fn(async () => null),
    hasKey: vi.fn(async () => false),
    hasUsableKey: vi.fn(async () => false),
    saveKey: vi.fn(async () => {}),
    deleteKey: vi.fn(async () => {}),
  },
}));
vi.mock('../../services/llm/llmService', () => ({ llmService: { validateKey: vi.fn(async () => true) } }));

import AiModelPanel from '../../components/settings/panels/AiModelPanel';
import { defaultConfig, saveServiceConfig } from '../../services/audio/config/serviceConfig';
import de from '../../assets/translations/ui-de.json';
import en from '../../assets/translations/ui-en.json';
import BYOKSetupModal from '../../components/BYOKSetupModal';
import { useDomainStore } from '../../stores/domainStore';
import { keyStorage } from '../../services/storage/keyStorageService';

const Card = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
const LOCAL_LLM = { provider: 'custom-openai', kind: 'custom-openai' as const, baseURL: 'http://192.168.1.20:11434/v1', model: 'qwen3-local' };
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

async function selfHostCard(local: boolean, keyStored: boolean): Promise<string> {
  h.selfHost = true;
  vi.mocked(keyStorage.getKey).mockResolvedValue(keyStored ? `sk-or-v1-${'a'.repeat(64)}` : null);
  vi.mocked(keyStorage.getKeyMetadata).mockResolvedValue(keyStored ? { valid: true, timestamp: 1 } as never : null);
  saveServiceConfig(local
    ? { ...defaultConfig, llm: { ...LOCAL_LLM }, localMode: { llmEnabled: true, ttsEnabled: false, sttEnabled: false } }
    : { ...defaultConfig });
  const view = render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
  await settle();
  return view.container.textContent ?? '';
}

describe('the self-host key intro holds in every state', () => {
  afterEach(() => {
    cleanup();
    h.selfHost = false;
    vi.mocked(keyStorage.getKey).mockResolvedValue(null);
    vi.mocked(keyStorage.getKeyMetadata).mockResolvedValue(null);
  });

  it.each(['de', 'en'] as const)('%s: a key stored and Local Mode\'s model on: the intro says the own model answers', async (lang) => {
    h.lang = lang;
    const bundle = lang === 'de' ? de : en;
    const text = await selfHostCard(true, true);
    expect(text).toContain(bundle.settings.aiModelKey.keySectionIntroSelfHostLocal);
    expect(text).not.toContain(bundle.settings.aiModelKey.keySectionIntroSelfHost);
    expect(text).toContain(bundle.settings.aiModelKey.statusLocal);
  });

  it.each(['de', 'en'] as const)('%s: Local Mode\'s model on, no key: the same intro', async (lang) => {
    h.lang = lang;
    const bundle = lang === 'de' ? de : en;
    const text = await selfHostCard(true, false);
    expect(text).toContain(bundle.settings.aiModelKey.keySectionIntroSelfHostLocal);
  });

  it.each(['de', 'en'] as const)('%s: Local Mode\'s model off: the key intro, as before', async (lang) => {
    h.lang = lang;
    const bundle = lang === 'de' ? de : en;
    const text = await selfHostCard(false, true);
    expect(text).toContain(bundle.settings.aiModelKey.keySectionIntroSelfHost);
    expect(text).not.toContain(bundle.settings.aiModelKey.keySectionIntroSelfHostLocal);
  });
});

describe('no line places Local Mode on the visitor\'s computer', () => {
  it.each(['de', 'en'] as const)('%s', (lang) => {
    const bundle = lang === 'de' ? de : en;
    const lines = [
      bundle.processing.localWait,
      bundle.processing.localTakingLonger,
      bundle.councilProcessing.localTakingLonger,
      bundle.settings.localMode.description,
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/Rechner|computer|machine/i);
      expect(line).not.toMatch(/[—–;]|kostenlos|\bfree\b|privat/i);
    }
  });
});

describe('the self-host key screen names no free-tier contrast', () => {
  afterEach(() => {
    cleanup();
    h.selfHost = false;
    useDomainStore.getState().closeByokModal();
  });

  it.each(['de', 'en'] as const)('%s', async (lang) => {
    h.lang = lang;
    h.selfHost = true;
    const bundle = lang === 'de' ? de : en;
    const benefit = bundle.byok.wizard.selfHost.benefit1;
    expect(benefit).not.toMatch(/Tageslimit|daily limit|kostenlos|\bfree\b/i);
    useDomainStore.getState().openByokModal(undefined, true);
    const view = render(<BYOKSetupModal />);
    expect(view.container.textContent).toContain(benefit);
    expect(view.container.textContent).not.toMatch(/Keine Tageslimits|No daily limits/);
  });
});
