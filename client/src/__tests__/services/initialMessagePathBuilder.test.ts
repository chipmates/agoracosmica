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
