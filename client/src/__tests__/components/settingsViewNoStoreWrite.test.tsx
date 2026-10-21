// The whole Preferences view, the Local Mode panel and the Settings modal
// included, renders without writing the store. Taking over another tab's saved
// settings is a store update; inside a render React warns ("Cannot update a
// component while rendering a different component").
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

vi.mock('../../hooks/useTranslation', async () => {
  const bundle = (await import('../../assets/translations/ui-de.json')).default;
  const lookup = (key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);
  const t = (key: string, fallback?: string) => {
    const value = lookup(key);
    return typeof value === 'string' ? value : fallback ?? key;
  };
  const api = () => ({ tString: t, tNode: t, t, language: 'de' });
  return { default: api, useTranslation: api };
});
vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: { hasUsableKey: vi.fn(async () => false), getKey: vi.fn(async () => null) },
}));
vi.mock('../../components/settings/panels/LanguagePanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/VoicePanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/SpeechPanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/AiModelPanel', () => ({ default: () => null }));

class NoResize {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', NoResize);

import PraeferenzenPanel from '../../components/settings/panels/PraeferenzenPanel';
import LocalModePanel from '../../components/settings/panels/LocalModePanel';
import SettingsModal from '../../components/SettingsModal';
import { defaultConfig, saveServiceConfig, type ServiceConfig } from '../../services/audio/config/serviceConfig';
import { useDomainStore } from '../../stores/domainStore';

const STORE = 'agora-cosmica-store';
const OFF = { llmEnabled: false, ttsEnabled: false, sttEnabled: false };
const ON = { llmEnabled: true, ttsEnabled: true, sttEnabled: true };

/** Another tab saves Local Mode on; this tab has not heard the storage event yet. */
function otherTabSavesLocalModeOn(): string {
  const blob = JSON.parse(window.localStorage.getItem(STORE) || '{"state":{},"version":1}');
  const config: ServiceConfig = { ...JSON.parse(blob.state.serviceConfig.raw), localMode: { ...ON } };
  blob.state.serviceConfig = { raw: JSON.stringify(config), parsed: config };
  const value = JSON.stringify(blob);
  window.localStorage.setItem(STORE, value);
  return value;
}

/** A second subscriber, as the rest of the app is. */
const Elsewhere = () => {
  useDomainStore((state) => state.serviceConfig.raw);
  return null;
};

const Card = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
const preferences = () => (
  <>
    <Elsewhere />
    <PraeferenzenPanel
      config={{ ttsEnabled: true, sttEnabled: true }}
      selectedLanguage="de"
      onChange={() => {}}
      onLanguageChange={() => {}}
      SettingCard={Card}
      OptionButtons={Card}
      CATEGORY_ICONS={{}}
    />
  </>
);
const modal = () => (
  <>
    <Elsewhere />
    <SettingsModal isOpen={true} onClose={() => {}} initialTab="preferences" />
  </>
);

/** Store writes while `run` renders. */
const writesDuring = (run: () => void): unknown[] => {
  const writes: unknown[] = [];
  const stop = useDomainStore.subscribe((state, prev) => {
    if (state.serviceConfig !== prev.serviceConfig) writes.push(state.serviceConfig);
  });
  run();
  stop();
  return writes;
};

const switches = () =>
  screen.queryAllByRole('checkbox').map((el) => (el as HTMLInputElement).checked);

describe('the Preferences view renders without a store write', () => {
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    saveServiceConfig({ ...defaultConfig, localMode: { ...OFF } });
    errors = vi.spyOn(console, 'error');
  });

  afterEach(() => {
    cleanup();
    errors.mockRestore();
  });

  it('with the real Local Mode panel: no write on opening or on a render again', () => {
    const before = useDomainStore.getState().serviceConfig;
    otherTabSavesLocalModeOn();

    let view!: ReturnType<typeof render>;
    expect(writesDuring(() => { view = render(preferences()); })).toEqual([]);
    expect(writesDuring(() => view.rerender(preferences()))).toEqual([]);
    expect(useDomainStore.getState().serviceConfig).toBe(before);
    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/Cannot update a component/);
  });

  it('the Local Mode panel follows the saved switches once the other tab\'s save arrives', () => {
    render(<LocalModePanel SettingCard={Card} CATEGORY_ICONS={{}} />);
    const off = switches();
    expect(off.length).toBeGreaterThanOrEqual(3);
    expect(off.every((on) => !on)).toBe(true);

    const pending = otherTabSavesLocalModeOn();
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORE, newValue: pending }));
    });

    expect(switches().slice(0, 3)).toEqual([true, true, true]);
  });

  it('the Settings modal: no write when it renders again', () => {
    const view = render(modal());
    otherTabSavesLocalModeOn();

    expect(writesDuring(() => view.rerender(modal()))).toEqual([]);
    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/Cannot update a component/);
  });
});

describe('the model settings read from a saved settings string', () => {
  it('keeps a local endpoint, and derives the kind of an older save from its provider', async () => {
    const { llmFromRaw } = await import('../../services/audio/config/serviceConfig');
    expect(llmFromRaw(JSON.stringify({ llm: { provider: 'custom-openai', model: 'm', baseURL: 'http://127.0.0.1:1234/v1' } })))
      .toMatchObject({ kind: 'custom-openai', model: 'm', baseURL: 'http://127.0.0.1:1234/v1' });
    expect(llmFromRaw(JSON.stringify({ llm: { provider: 'openrouter', model: 'qwen/qwen3-235b-a22b-2507' } })).kind).toBe('openrouter');
    expect(llmFromRaw('not json')).toEqual(defaultConfig.llm);
    expect(llmFromRaw(null)).toEqual(defaultConfig.llm);
  });
});
