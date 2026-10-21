// A self-host build has no hosted audio of its own. Voice and transcription
// stay off there until something can serve them: the operator's audio
// endpoint (AGORA_AUDIO_API_URL) or the visitor's own containers through Local
// Mode, each switch for its own service. The off that a missing service
// forces is never saved back over the visitor's own choice.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Build = { selfHost: boolean; audioApiUrl?: string };

/** serviceConfig as one build would load it. */
async function load(build: Build) {
  vi.resetModules();
  vi.doMock('../../config/deployment', () => ({ isSelfHost: build.selfHost }));
  vi.doMock('../../config/runtime', async (importActual) => ({
    ...(await importActual<typeof import('../../config/runtime')>()),
    audioApiUrl: build.audioApiUrl ?? '',
  }));
  const config = await import('../../services/audio/config/serviceConfig');
  const settings = await import('../../services/settings/settingsService');
  const { useDomainStore } = await import('../../stores/domainStore');
  const raw = () => useDomainStore.getState().serviceConfig.raw as string;
  return { ...config, ...settings, raw };
}

const localMode = (tts: boolean, stt: boolean) => ({ llmEnabled: false, ttsEnabled: tts, sttEnabled: stt });

describe('voice and transcription in a self-host build', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.doUnmock('../../config/deployment');
    vi.doUnmock('../../config/runtime');
  });

  it('without an audio service both stay off, as before', async () => {
    const m = await load({ selfHost: true });
    m.saveServiceConfig({ ...m.defaultConfig, localMode: localMode(false, false) });
    expect(m.loadServiceConfig()).toMatchObject({ ttsEnabled: false, sttEnabled: false });
  });

  it('Local Mode voice turns the voice on, Local Mode transcription the microphone', async () => {
    const m = await load({ selfHost: true });
    m.saveServiceConfig({ ...m.defaultConfig, localMode: localMode(true, false) });
    expect(m.loadServiceConfig()).toMatchObject({ ttsEnabled: true, sttEnabled: false });

    m.saveServiceConfig({ ...m.defaultConfig, localMode: localMode(false, true) });
    expect(m.loadServiceConfig()).toMatchObject({ ttsEnabled: false, sttEnabled: true });

    m.saveServiceConfig({ ...m.defaultConfig, localMode: localMode(true, true) });
    expect(m.loadServiceConfig()).toMatchObject({ ttsEnabled: true, sttEnabled: true });
  });

  it('an operator audio endpoint serves both', async () => {
    const m = await load({ selfHost: true, audioApiUrl: 'https://audio.example.org' });
    m.saveServiceConfig({ ...m.defaultConfig, localMode: localMode(false, false) });
    expect(m.loadServiceConfig()).toMatchObject({ ttsEnabled: true, sttEnabled: true });
  });

  it('switching Local Mode on, as the panel does, does not save the forced off', async () => {
    const m = await load({ selfHost: true });
    m.saveServiceConfig({ ...m.defaultConfig, localMode: localMode(false, false) });

    // The panel's toggle: load, flip the one switch, save.
    const c = m.loadServiceConfig();
    expect(c.ttsEnabled).toBe(false);
    c.localMode = { ...c.localMode!, ttsEnabled: true };
    m.saveServiceConfig(c);

    expect(JSON.parse(m.raw())).toMatchObject({ ttsEnabled: true, sttEnabled: true });
    expect(m.loadServiceConfig()).toMatchObject({ ttsEnabled: true, sttEnabled: false });
  });

  it('a Settings footer save leaves the saved switches as they were', async () => {
    const m = await load({ selfHost: true });
    m.saveServiceConfig({ ...m.defaultConfig, localMode: localMode(false, false) });

    const saved = m.handleConfigChange(m.loadServiceConfig(), 'ttsSettings.speed', '1.1');
    m.saveConfiguration(saved);

    expect(JSON.parse(m.raw())).toMatchObject({ ttsEnabled: true, sttEnabled: true, ttsSettings: { speed: 1.1 } });
  });

  it('a visitor who turned voice input off keeps it off when Local Mode could serve it', async () => {
    // (Voice input: a development build turns a saved voice-off back on by design.)
    const m = await load({ selfHost: true });
    m.saveServiceConfig({ ...m.defaultConfig, sttEnabled: false, localMode: localMode(true, true) });
    expect(m.loadServiceConfig()).toMatchObject({ ttsEnabled: true, sttEnabled: false });
  });

  it('the hosted build is unchanged: both on as saved', async () => {
    const m = await load({ selfHost: false });
    m.saveServiceConfig({ ...m.defaultConfig, localMode: localMode(false, false) });
    expect(m.loadServiceConfig()).toMatchObject({ ttsEnabled: true, sttEnabled: true });
  });
});
