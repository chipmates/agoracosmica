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
    vi.unstubAllEnvs();
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

  // The one screen path that saves an off while the gate's mark stands: the
  // Stimme or Spracheingabe switch in Settings, turned on and off again (it
  // reads off while the gate holds it), then the footer save.
  it.each([
    ['ttsEnabled', 'ttsEnabled'],
    ['sttEnabled', 'sttEnabled'],
  ] as const)('%s turned off in Settings while the gate held it off stays off once Local Mode could serve it', async (field, lmField) => {
    // As a production build reads it: a development build turns a saved voice-off back on.
    vi.stubEnv('DEV', false);
    const m = await load({ selfHost: true });
    m.saveServiceConfig({ ...m.defaultConfig, localMode: localMode(false, false) });

    const opened = m.loadServiceConfig();
    expect(opened[field]).toBe(false);
    const toggledOn = m.handleConfigChange(opened, field, true);
    const toggledOff = m.handleConfigChange(toggledOn, field, false);
    m.saveConfiguration(toggledOff);
    expect(JSON.parse(m.raw())[field]).toBe(false);

    // Then the guide's Local Mode switch for that service, as the panel does it.
    const c = m.loadServiceConfig();
    c.localMode = { ...c.localMode!, [lmField]: true };
    m.saveServiceConfig(c);
    expect(JSON.parse(m.raw())[field]).toBe(false);
    expect(m.loadServiceConfig()[field]).toBe(false);
  });

  it('a switch chosen in Settings leaves the other one to the gate', async () => {
    const m = await load({ selfHost: true });
    m.saveServiceConfig({ ...m.defaultConfig, localMode: localMode(false, false) });

    const off = m.handleConfigChange(m.handleConfigChange(m.loadServiceConfig(), 'ttsEnabled', true), 'ttsEnabled', false);
    m.saveConfiguration(off);
    expect(JSON.parse(m.raw())).toMatchObject({ ttsEnabled: false, sttEnabled: true });

    const on = m.handleConfigChange(m.loadServiceConfig(), 'ttsEnabled', true);
    m.saveConfiguration(on);
    expect(JSON.parse(m.raw())).toMatchObject({ ttsEnabled: true, sttEnabled: true });
  });

  it('a visitor who turned voice input off keeps it off when Local Mode could serve it', async () => {
    // (Voice input: a development build turns a saved voice-off back on by design.)
    const m = await load({ selfHost: true });
    m.saveServiceConfig({ ...m.defaultConfig, sttEnabled: false, localMode: localMode(true, true) });
    expect(m.loadServiceConfig()).toMatchObject({ ttsEnabled: true, sttEnabled: false });
  });

  // What a self-host build before this one saved on every save, its key gate
  // included: the forced off, written as if it were the visitor's choice.
  const savedByAnEarlierBuild = (m: Awaited<ReturnType<typeof load>>, lm: ReturnType<typeof localMode>) =>
    JSON.stringify({ ...m.defaultConfig, ttsEnabled: false, sttEnabled: false, localMode: lm });

  it('a browser an earlier build set up: its saved off is no choice, Local Mode serves both', async () => {
    const m = await load({ selfHost: true });
    const { useDomainStore } = await import('../../stores/domainStore');
    useDomainStore.getState().setServiceConfig({ raw: savedByAnEarlierBuild(m, localMode(true, true)), parsed: null });
    expect(m.loadServiceConfig()).toMatchObject({ ttsEnabled: true, sttEnabled: true });
  });

  it('a browser an earlier build set up: the guide\'s two switches turn voice and microphone on', async () => {
    const m = await load({ selfHost: true });
    const { useDomainStore } = await import('../../stores/domainStore');
    useDomainStore.getState().setServiceConfig({ raw: savedByAnEarlierBuild(m, localMode(false, false)), parsed: null });
    expect(m.loadServiceConfig()).toMatchObject({ ttsEnabled: false, sttEnabled: false });

    // The panel's toggles: load, flip one switch, save; twice.
    for (const key of ['ttsEnabled', 'sttEnabled'] as const) {
      const c = m.loadServiceConfig();
      c.localMode = { ...c.localMode!, [key]: true };
      m.saveServiceConfig(c);
    }
    expect(m.loadServiceConfig()).toMatchObject({ ttsEnabled: true, sttEnabled: true });
  });

  it('after a save on this build, an off is the visitor\'s again', async () => {
    const m = await load({ selfHost: true });
    const { useDomainStore } = await import('../../stores/domainStore');
    useDomainStore.getState().setServiceConfig({ raw: savedByAnEarlierBuild(m, localMode(true, true)), parsed: null });
    const c = m.loadServiceConfig();
    m.saveServiceConfig({ ...c, sttEnabled: false });
    expect(m.loadServiceConfig()).toMatchObject({ ttsEnabled: true, sttEnabled: false });
  });

  it('the hosted build reads a saved off as the visitor\'s, mark or not', async () => {
    const m = await load({ selfHost: false });
    const { useDomainStore } = await import('../../stores/domainStore');
    useDomainStore.getState().setServiceConfig({ raw: savedByAnEarlierBuild(m, localMode(true, true)), parsed: null });
    expect(m.loadServiceConfig()).toMatchObject({ sttEnabled: false });
  });

  it('the hosted build is unchanged: both on as saved', async () => {
    const m = await load({ selfHost: false });
    m.saveServiceConfig({ ...m.defaultConfig, localMode: localMode(false, false) });
    expect(m.loadServiceConfig()).toMatchObject({ ttsEnabled: true, sttEnabled: true });
  });
});
