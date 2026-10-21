// The preference panel reads Local Mode for its badges during render. Taking
// over another tab's saved settings updates the store, which must not happen
// inside a render (React: "Cannot update a component while rendering a
// different component"). The panel reads the store value it subscribes to;
// another tab's change still reaches it through the storage event.
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
  return { useTranslation: () => ({ tString: t, tNode: t, t, language: 'de' }) };
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
import { defaultConfig, saveServiceConfig, localModeFromRaw, type ServiceConfig } from '../../services/audio/config/serviceConfig';
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

/** A second subscriber, as the rest of the app is: an update during another component's render warns. */
const Elsewhere = () => {
  useDomainStore((state) => state.serviceConfig.raw);
  return null;
};

const Card = () => null;
const panel = () => (
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

describe('the preference panel render', () => {
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    saveServiceConfig({ ...defaultConfig, localMode: { ...OFF } });
    errors = vi.spyOn(console, 'error');
  });

  afterEach(() => {
    cleanup();
    errors.mockRestore();
  });

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

  it('does not write the store on opening, even with another tab\'s settings waiting', () => {
    const before = useDomainStore.getState().serviceConfig;
    const pending = otherTabSavesLocalModeOn();

    expect(writesDuring(() => render(panel()))).toEqual([]);
    expect(useDomainStore.getState().serviceConfig).toBe(before);
    // This tab's settings until the storage event arrives.
    expect(screen.getAllByText('Unsere Server')).toHaveLength(2);

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORE, newValue: pending }));
    });

    expect(screen.getAllByText('Lokal')).toHaveLength(2);
    expect(screen.getByText('Lokales Modell')).toBeTruthy();
  });

  it('does not write the store when it renders again, so React has nothing to warn about', () => {
    const view = render(panel());
    otherTabSavesLocalModeOn();

    expect(writesDuring(() => view.rerender(panel()))).toEqual([]);
    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/Cannot update a component/);
  });
});

describe('Local Mode read from the saved settings', () => {
  it('reads the per-service switches', () => {
    const raw = JSON.stringify({ ...defaultConfig, localMode: { llmEnabled: true, ttsEnabled: false, sttEnabled: true, sttURL: 'http://127.0.0.1:8000' } });
    expect(localModeFromRaw(raw)).toMatchObject({ llmEnabled: true, ttsEnabled: false, sttEnabled: true, sttURL: 'http://127.0.0.1:8000' });
  });

  it('expands the old single switch, as loading does', () => {
    expect(localModeFromRaw(JSON.stringify({ localMode: { enabled: true } }))).toMatchObject(ON);
    expect(localModeFromRaw(JSON.stringify({ localMode: { enabled: false } }))).toMatchObject(OFF);
  });

  it('falls back to all off for missing or unreadable settings', () => {
    expect(localModeFromRaw(null)).toMatchObject(OFF);
    expect(localModeFromRaw('{not json')).toMatchObject(OFF);
    expect(localModeFromRaw(JSON.stringify({ sttEnabled: true }))).toMatchObject(OFF);
  });
});
