// The Settings footer saves what the visitor edited in the open Settings (the
// voice switch, the speed, the transcription switch). It must not save back the
// rest of the settings as they were when Settings opened: Local Mode, switched
// on meanwhile in the same Settings or in another tab, has to stay on.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('../../hooks/useTranslation', () => {
  const t = (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key);
  const api = { t, tString: t, tNode: t, tArray: () => [] };
  return { default: () => api, useTranslation: () => api };
});

// The preference panels, reduced to the three edits that reach the footer save.
vi.mock('../../components/settings/panels/PraeferenzenPanel', () => ({
  default: ({ onChange }: { onChange: (key: string, value: unknown) => void }) => (
    <div>
      <button onClick={() => onChange('ttsSettings.speed', '1.1')}>speed 1.1</button>
      <button onClick={() => onChange('ttsEnabled', false)}>voice off</button>
      <button onClick={() => onChange('sttEnabled', false)}>voice input off</button>
    </div>
  ),
}));
vi.mock('../../components/settings/panels/RechtDatenschutzPanel', () => ({ default: () => null }));
vi.mock('../../components/settings/panels/InfoPanel', () => ({ default: () => null }));

import SettingsModal from '../../components/SettingsModal';
import { defaultConfig, loadServiceConfig, saveServiceConfig, type ServiceConfig } from '../../services/audio/config/serviceConfig';

const STORE = 'agora-cosmica-store';
const URLS = { sttURL: 'http://127.0.0.1:8000', ttsKokoroURL: 'http://127.0.0.1:8880', ttsQwenURL: 'http://127.0.0.1:8887' };
const OFF = { llmEnabled: false, ttsEnabled: false, sttEnabled: false, ...URLS };

const saved = (): ServiceConfig => {
  const blob = JSON.parse(window.localStorage.getItem(STORE) || '{}');
  return JSON.parse(blob.state.serviceConfig.raw);
};

/** What the Local Mode panel does: read, flip both switches, save at once. */
function switchLocalModeOnHere(): void {
  const config = loadServiceConfig();
  config.localMode = { ...config.localMode!, ttsEnabled: true, sttEnabled: true };
  saveServiceConfig(config);
}

/** The same switch made in another tab: its store writes the shared blob, this tab hears the storage event. */
function switchLocalModeOnInOtherTab(): void {
  const blob = JSON.parse(window.localStorage.getItem(STORE) || '{"state":{},"version":1}');
  const config: ServiceConfig = { ...JSON.parse(blob.state.serviceConfig.raw), localMode: { ...OFF, ttsEnabled: true, sttEnabled: true } };
  blob.state.serviceConfig = { raw: JSON.stringify(config), parsed: config };
  const value = JSON.stringify(blob);
  window.localStorage.setItem(STORE, value);
  window.dispatchEvent(new StorageEvent('storage', { key: STORE, newValue: value }));
}

const openSettings = () => render(<SettingsModal isOpen onClose={() => {}} initialTab="preferences" />);
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

class NoResize {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('the Settings footer save with Local Mode switched on after Settings opened', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', NoResize);
    saveServiceConfig({ ...defaultConfig, localMode: { ...OFF } });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('same Settings: saving the speed keeps Local Mode on', () => {
    openSettings();
    act(() => switchLocalModeOnHere());

    press('speed 1.1');
    press('settings.save');

    expect(saved().localMode).toMatchObject({ ttsEnabled: true, sttEnabled: true });
    expect(saved().ttsSettings.speed).toBe(1.1);
    expect(loadServiceConfig().localMode).toMatchObject({ ttsEnabled: true, sttEnabled: true });
  });

  it('second tab: saving the speed in Settings opened before the switch keeps Local Mode on', () => {
    openSettings();
    act(() => switchLocalModeOnInOtherTab());

    press('speed 1.1');
    press('settings.save');

    expect(saved().localMode).toMatchObject({ ttsEnabled: true, sttEnabled: true });
    expect(saved().ttsSettings.speed).toBe(1.1);
  });

  it('the switches edited in Settings are still saved', () => {
    openSettings();
    act(() => switchLocalModeOnHere());

    press('voice off');
    press('voice input off');
    press('settings.save');

    expect(saved()).toMatchObject({ ttsEnabled: false, sttEnabled: false });
    expect(saved().localMode).toMatchObject({ ttsEnabled: true, sttEnabled: true });
  });
});
