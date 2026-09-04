// The greeting a visitor hears has to come from the same stack as the replies
// that follow it, and the two English sets live in different R2 keyspaces. A
// wrong path here is either a 404 on the opening line or, worse, a greeting in
// one voice and an answer in another.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initialMessagePathBuilder,
  QWEN_EN_REV,
} from '../../services/audio/initialMessagePathBuilder';

const B = initialMessagePathBuilder;

describe('initialMessagePathBuilder — engine selection', () => {
  it('keeps the unversioned root when no engine is named', () => {
    expect(B.getAudioPath('plato', 'wisdom', 1, 'en')).toBe(
      'initial-messages/plato/en/wisdom/seed_01.webm'
    );
    expect(B.getAudioPath('laozi', 'freetalk', null, 'de')).toBe(
      'initial-messages/laozi/de/freetalk/greeting.webm'
    );
  });

  it('keeps the unversioned root for Kokoro', () => {
    expect(B.getAudioPath('plato', 'wisdom', 1, 'en', 'kokoro')).toBe(
      'initial-messages/plato/en/wisdom/seed_01.webm'
    );
    expect(B.getAudioPath('woolf', 'quest', 12, 'en', 'kokoro')).toBe(
      'initial-messages/woolf/en/quest/seed_12.webm'
    );
  });

  it('moves English to the versioned language segment for Qwen', () => {
    expect(B.getAudioPath('plato', 'wisdom', 1, 'en', 'qwen')).toBe(
      `initial-messages/plato/en-${QWEN_EN_REV}/wisdom/seed_01.webm`
    );
    expect(B.getAudioPath('woolf', 'freetalk', null, 'en', 'qwen')).toBe(
      `initial-messages/woolf/en-${QWEN_EN_REV}/freetalk/greeting.webm`
    );
  });

  it('leaves German where it is whatever engine is asked for', () => {
    expect(B.getAudioPath('laozi', 'wisdom', 3, 'de', 'qwen')).toBe(
      'initial-messages/laozi/de/wisdom/seed_03.webm'
    );
  });

  it('never versions the text path — both sets speak the same words', () => {
    expect(B.getTextPath('plato', 'wisdom', 1, 'en')).toBe(
      'initial-messages/plato/en/wisdom/seed_01.txt'
    );
  });

  it('passes the engine through the language fallback', () => {
    expect(B.getPathWithFallback('rumi', 'quest', 7, 'en', 'qwen')).toEqual({
      path: `initial-messages/rumi/en-${QWEN_EN_REV}/quest/seed_07.webm`,
      language: 'en',
    });
    expect(B.getPathWithFallback('rumi', 'quest', 7, 'en')).toEqual({
      path: 'initial-messages/rumi/en/quest/seed_07.webm',
      language: 'en',
    });
  });

  it('still rejects a figure id that is not a plain lowercase name', () => {
    expect(() => B.getAudioPath('../etc', 'wisdom', 1, 'en', 'qwen')).toThrow();
  });
});

describe('getEnglishEngine — flag gate', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('answers kokoro with the flag off, whatever is stored', async () => {
    vi.stubEnv('VITE_EN_VOICE_ENGINE_CHOICE', '');
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getEnglishEngine } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({ englishEngine: 'qwen' });
    expect(getEnglishEngine()).toBe('kokoro');
  });

  it('answers with the stored engine once the flag is on', async () => {
    vi.stubEnv('VITE_EN_VOICE_ENGINE_CHOICE', 'true');
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getEnglishEngine } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({ englishEngine: 'qwen' });
    expect(getEnglishEngine()).toBe('qwen');

    useDomainStore.setState({ englishEngine: 'kokoro' });
    expect(getEnglishEngine()).toBe('kokoro');
  });

  it('treats a value that is not an engine as never having picked', async () => {
    vi.stubEnv('VITE_EN_VOICE_ENGINE_CHOICE', 'true');
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getEnglishEngine } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({ englishEngine: 'elevenlabs' as never });
    expect(getEnglishEngine()).toBe('qwen');

    useDomainStore.setState({ englishEngine: null });
    expect(getEnglishEngine()).toBe('qwen');
  });
});

describe('getVoiceForNormalMode — English cast per engine', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_EN_VOICE_ENGINE_CHOICE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('sends the Qwen id for each gender when Qwen is chosen', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoiceForNormalMode } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({ englishEngine: 'qwen' });
    expect(getVoiceForNormalMode('plato', 'kokoro', null, 'en')).toBe('en_solaris');
    expect(getVoiceForNormalMode('woolf', 'kokoro', null, 'en')).toBe('en_lyra');
  });

  it('keeps the Kokoro pick when Kokoro is chosen', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoiceForNormalMode } = await import('../../services/audio/voices/voiceResolver');
    const { ENGLISH_TECHNICAL_VOICES } = await import('../../services/audio/voices/voiceDefinitions');

    useDomainStore.setState({
      englishEngine: 'kokoro',
      english: { maleVoice: 'saturn', femaleVoice: 'celeste' },
    });
    expect(getVoiceForNormalMode('plato', 'kokoro', null, 'en')).toBe(ENGLISH_TECHNICAL_VOICES.saturn);
    expect(getVoiceForNormalMode('woolf', 'kokoro', null, 'en')).toBe(ENGLISH_TECHNICAL_VOICES.celeste);
  });

  it('pins to Kokoro for a caller that can only reach that stack', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoiceForNormalMode } = await import('../../services/audio/voices/voiceResolver');
    const { ENGLISH_TECHNICAL_VOICES } = await import('../../services/audio/voices/voiceDefinitions');

    useDomainStore.setState({
      englishEngine: 'qwen',
      english: { maleVoice: 'orion', femaleVoice: 'stella' },
    });
    expect(getVoiceForNormalMode('plato', 'kokoro', null, 'en', 'kokoro')).toBe(
      ENGLISH_TECHNICAL_VOICES.orion
    );
  });

  it('leaves German untouched', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoiceForNormalMode } = await import('../../services/audio/voices/voiceResolver');
    const { GERMAN_TECHNICAL_VOICES } = await import('../../services/audio/voices/voiceDefinitions');

    useDomainStore.setState({ englishEngine: 'qwen' });
    expect(getVoiceForNormalMode('plato', 'kokoro', null, 'de')).toBe(
      GERMAN_TECHNICAL_VOICES.solaris
    );
  });
});

describe('getVoicesForCouncil — English councils follow the engine', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_EN_VOICE_ENGINE_CHOICE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // plato, rumi, laozi are male; woolf, kahlo are female.
  const COUNCIL = ['plato', 'woolf', 'rumi', 'laozi'];

  it('seats distinct Qwen voices, defaults first', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoicesForCouncil } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({ englishEngine: 'qwen' });
    const mapping = getVoicesForCouncil(COUNCIL, 'kokoro', 'en');
    const seated = Object.values(mapping);

    expect(seated.every((v) => v.startsWith('en_'))).toBe(true);
    expect(new Set(seated).size).toBe(seated.length);
    // The one-to-one defaults lead, so a small council sounds familiar.
    expect(mapping.plato).toBe('en_solaris');
    expect(mapping.woolf).toBe('en_lyra');
  });

  it('never repeats a voice in an all-male council', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoicesForCouncil } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({ englishEngine: 'qwen' });
    const mapping = getVoicesForCouncil(['plato', 'rumi', 'laozi', 'goethe'], 'kokoro', 'en');
    const seated = Object.values(mapping);

    expect(seated).toHaveLength(4);
    expect(new Set(seated).size).toBe(4);
  });

  it('leaves the Kokoro council untouched', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoicesForCouncil } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({ englishEngine: 'kokoro' });
    const mapping = getVoicesForCouncil(COUNCIL, 'kokoro', 'en');

    expect(Object.values(mapping).some((v) => v.startsWith('en_'))).toBe(false);
    expect(new Set(Object.values(mapping)).size).toBe(4);
  });

  it('leaves the German council untouched', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoicesForCouncil } = await import('../../services/audio/voices/voiceResolver');
    const { GERMAN_TECHNICAL_VOICES } = await import('../../services/audio/voices/voiceDefinitions');

    useDomainStore.setState({ englishEngine: 'qwen' });
    const mapping = getVoicesForCouncil(COUNCIL, 'kokoro', 'de');

    expect(mapping.plato).toBe(GERMAN_TECHNICAL_VOICES.solaris);
    expect(mapping.woolf).toBe(GERMAN_TECHNICAL_VOICES.lyra);
  });
});

describe('Local Mode pins English to Kokoro', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    vi.stubEnv('VITE_EN_VOICE_ENGINE_CHOICE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    window.localStorage.clear();
  });

  const enableLocalTts = async (on: boolean) => {
    const { loadServiceConfig, saveServiceConfig } = await import(
      '../../services/audio/config/serviceConfig'
    );
    const config = loadServiceConfig();
    config.localMode = { llmEnabled: false, ttsEnabled: on, sttEnabled: false };
    saveServiceConfig(config);
  };

  it('reports kokoro while Local Mode voice is on, whatever is stored', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getEnglishEngine, isLocalModeEnglishTts } = await import(
      '../../services/audio/voices/voiceResolver'
    );

    useDomainStore.setState({ englishEngine: 'qwen' });
    await enableLocalTts(true);

    expect(isLocalModeEnglishTts()).toBe(true);
    expect(getEnglishEngine()).toBe('kokoro');
  });

  it('gives the stored pick back when Local Mode voice goes off', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getEnglishEngine } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({ englishEngine: 'qwen' });
    await enableLocalTts(true);
    expect(getEnglishEngine()).toBe('kokoro');

    await enableLocalTts(false);
    // The pick was never overwritten, so it simply applies again.
    expect(useDomainStore.getState().englishEngine).toBe('qwen');
    expect(getEnglishEngine()).toBe('qwen');
  });

  it('sends the greeting to the Kokoro clip set while Local Mode voice is on', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getEnglishEngine } = await import('../../services/audio/voices/voiceResolver');
    const { initialMessagePathBuilder } = await import(
      '../../services/audio/initialMessagePathBuilder'
    );

    useDomainStore.setState({ englishEngine: 'qwen' });
    await enableLocalTts(true);

    expect(initialMessagePathBuilder.getAudioPath('plato', 'wisdom', 1, 'en', getEnglishEngine()))
      .toBe('initial-messages/plato/en/wisdom/seed_01.webm');
  });
});

describe('voice preferences slice — stored shape survives', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    window.localStorage.clear();
  });

  it('leaves a pre-engine blob unset, so the flip default still reaches it', async () => {
    window.localStorage.setItem(
      'voicePreferences',
      JSON.stringify({ english: { maleVoice: 'saturn', femaleVoice: 'celeste' } })
    );

    const { createVoicePreferencesSlice } = await import(
      '../../stores/slices/voicePreferencesSlice'
    );
    const slice = createVoicePreferencesSlice(() => undefined, () => undefined);

    expect(slice.englishEngine).toBeNull();
    // The Kokoro pick is untouched, so picking Kokoro later restores the voices.
    expect(slice.english).toEqual({ maleVoice: 'saturn', femaleVoice: 'celeste' });
  });

  it('honours a stored engine choice', async () => {
    window.localStorage.setItem(
      'voicePreferences',
      JSON.stringify({ englishEngine: 'kokoro' })
    );

    const { createVoicePreferencesSlice } = await import(
      '../../stores/slices/voicePreferencesSlice'
    );
    const slice = createVoicePreferencesSlice(() => undefined, () => undefined);

    expect(slice.englishEngine).toBe('kokoro');
  });
});

// The hole this closes: if the dark build persisted the resolved engine, every
// visitor between that deploy and the flip would carry an explicit 'kokoro' and
// would never see the Qwen default.
describe('engine persistence — only an explicit pick is written', () => {
  const STORE_KEY = 'agora-cosmica-store';

  const persistedEngine = (): unknown => {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return undefined;
    return (JSON.parse(raw) as { state?: Record<string, unknown> }).state?.englishEngine;
  };

  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    window.localStorage.clear();
  });

  it('writes nothing for the engine while the flag is off', async () => {
    vi.stubEnv('VITE_EN_VOICE_ENGINE_CHOICE', '');
    const { useDomainStore } = await import('../../stores/domainStore');

    // Any unrelated write flushes the whole persisted slice.
    useDomainStore.getState().saveVoicePreferences({
      english: { maleVoice: 'saturn', femaleVoice: 'celeste' },
    });

    expect(persistedEngine()).toBeUndefined();
    expect(window.localStorage.getItem(STORE_KEY)).not.toContain('englishEngine');
  });

  it('gives a visitor with nothing stored the qwen default once the flag is on', async () => {
    vi.stubEnv('VITE_EN_VOICE_ENGINE_CHOICE', 'true');
    const { getEnglishEngine } = await import('../../services/audio/voices/voiceResolver');

    expect(persistedEngine()).toBeUndefined();
    expect(getEnglishEngine()).toBe('qwen');
  });

  it('keeps a user pick of kokoro across a reload', async () => {
    vi.stubEnv('VITE_EN_VOICE_ENGINE_CHOICE', 'true');
    const first = await import('../../stores/domainStore');
    first.useDomainStore.getState().setEnglishEngine('kokoro');
    expect(persistedEngine()).toBe('kokoro');

    // Fresh module graph over the same storage is the reload.
    vi.resetModules();
    const { getEnglishEngine } = await import('../../services/audio/voices/voiceResolver');
    expect(getEnglishEngine()).toBe('kokoro');
  });

  it('does not pin a visitor who never picked, even after other writes', async () => {
    vi.stubEnv('VITE_EN_VOICE_ENGINE_CHOICE', 'true');
    const first = await import('../../stores/domainStore');
    first.useDomainStore.getState().saveVoicePreferences({
      english: { maleVoice: 'saturn', femaleVoice: 'celeste' },
    });
    expect(persistedEngine()).toBeUndefined();

    vi.resetModules();
    const { getEnglishEngine } = await import('../../services/audio/voices/voiceResolver');
    expect(getEnglishEngine()).toBe('qwen');
  });
});

// The Qwen English cast carries five voices per gender. A pick has to reach the
// reply, the council seat and the opening line, and the pre-rendered en-q1 clips
// were cut with the gender defaults only.
describe('shouldUsePregeneratedGreeting — the clip set was cut with the defaults', () => {
  it('accepts the Qwen default for each gender', async () => {
    const { shouldUsePregeneratedGreeting } = await import(
      '../../services/audio/initialMessagePathBuilder'
    );

    expect(shouldUsePregeneratedGreeting('qwen', 'female', 'lyra')).toBe(true);
    expect(shouldUsePregeneratedGreeting('qwen', 'male', 'solaris')).toBe(true);
  });

  it('rejects any other Qwen pick, so the greeting is spoken live', async () => {
    const { shouldUsePregeneratedGreeting } = await import(
      '../../services/audio/initialMessagePathBuilder'
    );

    expect(shouldUsePregeneratedGreeting('qwen', 'female', 'vega')).toBe(false);
    expect(shouldUsePregeneratedGreeting('qwen', 'male', 'umbra')).toBe(false);
    // A voice from the other section is not the default either.
    expect(shouldUsePregeneratedGreeting('qwen', 'female', 'solaris')).toBe(false);
    expect(shouldUsePregeneratedGreeting('qwen', 'male', undefined)).toBe(false);
  });

  it('keeps the Kokoro rule as it was', async () => {
    const { shouldUsePregeneratedGreeting } = await import(
      '../../services/audio/initialMessagePathBuilder'
    );

    expect(shouldUsePregeneratedGreeting('kokoro', 'female', 'stella')).toBe(true);
    expect(shouldUsePregeneratedGreeting('kokoro', 'male', 'orion')).toBe(true);
    expect(shouldUsePregeneratedGreeting('kokoro', 'female', 'celeste')).toBe(false);
    expect(shouldUsePregeneratedGreeting('kokoro', 'male', 'saturn')).toBe(false);
  });
});

describe('Qwen English picks — one voice per gender', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    vi.stubEnv('VITE_EN_VOICE_ENGINE_CHOICE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    window.localStorage.clear();
  });

  it('answers with the picked voice for the figure gender', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoiceForNormalMode } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({
      englishEngine: 'qwen',
      qwenEnglishVoices: { male: 'umbra', female: 'vega' },
    });

    expect(getVoiceForNormalMode('plato', 'kokoro', null, 'en')).toBe('en_umbra');
    expect(getVoiceForNormalMode('woolf', 'kokoro', null, 'en')).toBe('en_vega');
  });

  it('falls back to the gender default when nothing is stored', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoiceForNormalMode } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({ englishEngine: 'qwen' });

    expect(useDomainStore.getState().qwenEnglishVoices).toEqual({ male: 'solaris', female: 'lyra' });
    expect(getVoiceForNormalMode('plato', 'kokoro', null, 'en')).toBe('en_solaris');
    expect(getVoiceForNormalMode('woolf', 'kokoro', null, 'en')).toBe('en_lyra');
  });

  it('falls back to the gender default for a value that is not a voice of that gender', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoiceForNormalMode } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({
      englishEngine: 'qwen',
      // A stale name and a voice from the other section.
      qwenEnglishVoices: { male: 'stella', female: 'solaris' } as never,
    });

    expect(getVoiceForNormalMode('plato', 'kokoro', null, 'en')).toBe('en_solaris');
    expect(getVoiceForNormalMode('woolf', 'kokoro', null, 'en')).toBe('en_lyra');
  });

  it('leaves the Kokoro pick and the German pick alone', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoiceForNormalMode } = await import('../../services/audio/voices/voiceResolver');
    const { ENGLISH_TECHNICAL_VOICES, GERMAN_TECHNICAL_VOICES } = await import(
      '../../services/audio/voices/voiceDefinitions'
    );

    useDomainStore.setState({
      englishEngine: 'kokoro',
      english: { maleVoice: 'saturn', femaleVoice: 'celeste' },
      qwenEnglishVoices: { male: 'umbra', female: 'vega' },
    });

    expect(getVoiceForNormalMode('plato', 'kokoro', null, 'en')).toBe(ENGLISH_TECHNICAL_VOICES.saturn);
    expect(getVoiceForNormalMode('woolf', 'kokoro', null, 'en')).toBe(ENGLISH_TECHNICAL_VOICES.celeste);
    expect(getVoiceForNormalMode('plato', 'kokoro', null, 'de')).toBe(GERMAN_TECHNICAL_VOICES.solaris);
  });

  it('sends the greeting live for a pick the clip set never heard', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { isUsingDefaultVoice } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({
      englishEngine: 'qwen',
      qwenEnglishVoices: { male: 'solaris', female: 'lyra' },
    });
    expect(isUsingDefaultVoice('plato', 'en')).toBe(true);
    expect(isUsingDefaultVoice('woolf', 'en')).toBe(true);

    useDomainStore.setState({ qwenEnglishVoices: { male: 'umbra', female: 'vega' } });
    expect(isUsingDefaultVoice('plato', 'en')).toBe(false);
    expect(isUsingDefaultVoice('woolf', 'en')).toBe(false);
  });

  it('keeps a pick across a reload and never writes it into the Kokoro slot', async () => {
    const first = await import('../../stores/domainStore');
    first.useDomainStore.getState().updateQwenEnglishPreferences('corvus', 'ceres');

    const persisted = JSON.parse(window.localStorage.getItem('agora-cosmica-store') || '{}');
    expect(persisted.state.qwenEnglishVoices).toEqual({ male: 'corvus', female: 'ceres' });
    expect(persisted.state.english).toEqual({ maleVoice: 'orion', femaleVoice: 'stella' });

    // Fresh module graph over the same storage is the reload.
    vi.resetModules();
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoiceForNormalMode } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({ englishEngine: 'qwen' });
    expect(getVoiceForNormalMode('plato', 'kokoro', null, 'en')).toBe('en_corvus');
    expect(getVoiceForNormalMode('woolf', 'kokoro', null, 'en')).toBe('en_ceres');
  });
});

describe('getVoicesForCouncil — the Qwen rotation starts at the picks', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    vi.stubEnv('VITE_EN_VOICE_ENGINE_CHOICE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    window.localStorage.clear();
  });

  it('seats the picked voice first and keeps every seat distinct', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoicesForCouncil } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({
      englishEngine: 'qwen',
      qwenEnglishVoices: { male: 'umbra', female: 'vega' },
    });

    const mapping = getVoicesForCouncil(['plato', 'woolf', 'rumi', 'laozi'], 'kokoro', 'en');
    const seated = Object.values(mapping);

    expect(mapping.plato).toBe('en_umbra');
    expect(mapping.woolf).toBe('en_vega');
    expect(new Set(seated).size).toBe(seated.length);
    expect(seated.every((v) => v.startsWith('en_'))).toBe(true);
  });

  it('never repeats a voice in an all-male council built off a pick', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoicesForCouncil } = await import('../../services/audio/voices/voiceResolver');

    useDomainStore.setState({
      englishEngine: 'qwen',
      qwenEnglishVoices: { male: 'corvus', female: 'lyra' },
    });

    const mapping = getVoicesForCouncil(['plato', 'rumi', 'laozi', 'goethe'], 'kokoro', 'en');
    const seated = Object.values(mapping);

    expect(mapping.plato).toBe('en_corvus');
    expect(seated).toHaveLength(4);
    expect(new Set(seated).size).toBe(4);
  });

  it('leaves the Kokoro and German councils where they were', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');
    const { getVoicesForCouncil } = await import('../../services/audio/voices/voiceResolver');
    const { GERMAN_TECHNICAL_VOICES } = await import('../../services/audio/voices/voiceDefinitions');

    useDomainStore.setState({
      englishEngine: 'kokoro',
      qwenEnglishVoices: { male: 'umbra', female: 'vega' },
    });
    const kokoro = getVoicesForCouncil(['plato', 'woolf', 'rumi', 'laozi'], 'kokoro', 'en');
    expect(Object.values(kokoro).some((v) => v.startsWith('en_'))).toBe(false);

    useDomainStore.setState({ englishEngine: 'qwen' });
    const german = getVoicesForCouncil(['plato', 'woolf'], 'kokoro', 'de');
    expect(german.plato).toBe(GERMAN_TECHNICAL_VOICES.solaris);
    expect(german.woolf).toBe(GERMAN_TECHNICAL_VOICES.lyra);
  });
});

describe('voice preferences slice — the Qwen picks', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    window.localStorage.clear();
  });

  it('starts every visitor on the gender defaults', async () => {
    const { createVoicePreferencesSlice } = await import(
      '../../stores/slices/voicePreferencesSlice'
    );
    const slice = createVoicePreferencesSlice(() => undefined, () => undefined);

    expect(slice.qwenEnglishVoices).toEqual({ male: 'solaris', female: 'lyra' });
  });

  it('reads a stored pick and repairs a value outside its gender', async () => {
    window.localStorage.setItem(
      'voicePreferences',
      JSON.stringify({ qwenEnglishVoices: { male: 'phoenix', female: 'umbra' } })
    );

    const { createVoicePreferencesSlice } = await import(
      '../../stores/slices/voicePreferencesSlice'
    );
    const slice = createVoicePreferencesSlice(() => undefined, () => undefined);

    expect(slice.qwenEnglishVoices).toEqual({ male: 'phoenix', female: 'lyra' });
  });

  it('updates one gender without touching the other', async () => {
    const { useDomainStore } = await import('../../stores/domainStore');

    useDomainStore.getState().updateQwenEnglishPreferences(undefined, 'astra');
    expect(useDomainStore.getState().qwenEnglishVoices).toEqual({ male: 'solaris', female: 'astra' });

    useDomainStore.getState().updateQwenEnglishPreferences('hyperion');
    expect(useDomainStore.getState().qwenEnglishVoices).toEqual({ male: 'hyperion', female: 'astra' });
  });
});
