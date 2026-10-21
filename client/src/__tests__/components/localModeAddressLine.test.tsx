// The model card under Local Mode says where the model runs. Local Mode takes
// any address (this computer, another one on the network, a server), so the
// card names the address and never claims the visitor's own computer. On a
// self-host build the key section's intro reads true sentence by sentence.
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

const Card = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

async function cardText(baseURL: string): Promise<string> {
  saveServiceConfig({
    ...defaultConfig,
    llm: { provider: 'custom-openai', kind: 'custom-openai', baseURL, model: 'qwen3-local' },
    localMode: { llmEnabled: true, ttsEnabled: false, sttEnabled: false },
  });
  const view = render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  return view.container.textContent ?? '';
}

describe('the model card under Local Mode', () => {
  afterEach(() => {
    cleanup();
    h.selfHost = false;
  });

  it.each([
    ['de', 'http://127.0.0.1:1234/v1', 'Läuft unter http://127.0.0.1:1234/v1'],
    ['de', 'http://192.168.1.20:11434/v1', 'Läuft unter http://192.168.1.20:11434/v1'],
    ['en', 'https://llm.example.org/v1', 'Runs at https://llm.example.org/v1'],
  ] as const)('%s, %s: names the address, not the visitor\'s computer', async (lang, address, line) => {
    h.lang = lang;
    const text = await cardText(address);
    expect(text).toContain(line);
    expect(text).toContain(lang === 'de' ? de.settings.aiModelKey.statusLocal : en.settings.aiModelKey.statusLocal);
    expect(text).not.toMatch(/deinem Rechner|your computer/);
  });

  it.each(['de', 'en'] as const)('self-host, %s: the key intro says what the key does before what answers without one', async (lang) => {
    h.lang = lang;
    h.selfHost = true;
    saveServiceConfig({ ...defaultConfig });
    const view = render(<AiModelPanel SettingCard={Card} CATEGORY_ICONS={{}} />);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const intro = (lang === 'de' ? de : en).settings.aiModelKey.keySectionIntroSelfHost;
    expect(view.container.textContent).toContain(intro);
    const [first, second] = intro.split(/(?<=\.) /);
    expect(first).toMatch(lang === 'de' ? /^Mit einem OpenRouter-Key/ : /^With an OpenRouter key/);
    expect(second).toMatch(lang === 'de' ? /^Ohne Key/ : /^Without a key/);
    expect(intro).not.toMatch(/[—–;]|kostenlos|free/i);
  });
});
