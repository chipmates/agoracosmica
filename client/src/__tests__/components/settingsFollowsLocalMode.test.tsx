// Settings on a self-host instance, open while the visitor flips Local Mode's
// voice: the switch tells the app (configChanged) and the open view shows the
// voice on at once. Opening Settings, model card included, writes nothing to the
// store during the render, even with another tab's save waiting.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

vi.mock('../../config/deployment', () => ({ isSelfHost: true }));
vi.mock('../../config/runtime', async (importActual) => ({
  ...(await importActual<typeof import('../../config/runtime')>()),
  audioApiUrl: '',
}));
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
  keyStorage: {
    hasUsableKey: vi.fn(async () => true),
    getKey: vi.fn(async () => null),
    getKeyMetadata: vi.fn(async () => null),
    saveKey: vi.fn(async () => {}),
    deleteKey: vi.fn(async () => {}),
  },
}));
vi.mock('../../services/llm/llmService', () => ({ llmService: { validateKey: vi.fn(async () => true), probeEndpoint: vi.fn(async () => ({ reachable: false, models: [] })) } }));
vi.mock('../../components/settings/panels/LanguagePanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/VoicePanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/SpeechPanel', () => ({ default: () => null }));

class NoResize {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', NoResize);
vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));

import SettingsModal from '../../components/SettingsModal';
import { defaultConfig, saveServiceConfig, type ServiceConfig } from '../../services/audio/config/serviceConfig';
import { useDomainStore } from '../../stores/domainStore';
import de from '../../assets/translations/ui-de.json';

const STORE = 'agora-cosmica-store';
const OFF = { llmEnabled: false, ttsEnabled: false, sttEnabled: false };

/** A second subscriber, as the rest of the app is. */
const Elsewhere = () => {
  useDomainStore((state) => state.serviceConfig.raw);
  return null;
};
// The rest of the app is up first; Settings mounts when opened.
const modal = (open = true) => (
  <>
    <Elsewhere />
    {open && <SettingsModal isOpen={true} onClose={() => {}} initialTab="preferences" />}
  </>
);
const badgeOf = (title: string) =>
  document.querySelector(`button[aria-controls="section-${title}"]`)?.lastElementChild?.querySelector('span')?.textContent ?? null;
const localSwitch = (label: string) =>
  screen.getByText(label).closest('label')!.querySelector('input') as HTMLInputElement;

/** Another tab saves Local Mode's voice on; this tab has not heard the storage event yet. */
function otherTabSavesLocalVoice(): void {
  const blob = JSON.parse(window.localStorage.getItem(STORE) || '{"state":{},"version":1}');
  const config: ServiceConfig = { ...JSON.parse(blob.state.serviceConfig.raw), localMode: { ...OFF, ttsEnabled: true } };
  blob.state.serviceConfig = { raw: JSON.stringify(config), parsed: config };
  window.localStorage.setItem(STORE, JSON.stringify(blob));
}

describe('Settings follow Local Mode while open', () => {
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    saveServiceConfig({ ...defaultConfig, localMode: { ...OFF } });
    errors = vi.spyOn(console, 'error');
  });
  afterEach(() => {
    cleanup();
    errors.mockRestore();
  });

  it('switching Local Mode\'s voice on: configChanged, and the open view shows the voice on', async () => {
    render(modal());
    await act(async () => {});
    expect(badgeOf(de.settings.voice.title)).toBe(de.common.disabled);

    const heard: string[] = [];
    const listen = () => heard.push('configChanged');
    window.addEventListener('configChanged', listen);
    await act(async () => { fireEvent.click(localSwitch(de.settings.localMode.sections.tts.label)); });
    window.removeEventListener('configChanged', listen);

    expect(heard).toContain('configChanged');
    expect(badgeOf(de.settings.voice.title)).toBe(de.settings.preferences.local);
  });

  it('opening Settings with another tab\'s save waiting writes nothing during the render', async () => {
    const view = render(modal(false));
    otherTabSavesLocalVoice();
    view.rerender(modal());
    await act(async () => {});

    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/Cannot update a component/);
    // The other tab's save is taken over after the render, and the view shows it.
    expect(badgeOf(de.settings.voice.title)).toBe(de.settings.preferences.local);
  });
});
