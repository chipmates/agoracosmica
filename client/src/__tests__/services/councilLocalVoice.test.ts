// A council gives each speaker a voice of its own. With Local Mode voice on,
// those voices are spoken by the local service too, and fail closed with it:
// a council's words never go to the hosted gateway in Local Mode.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  localMode: { llmEnabled: false, ttsEnabled: false, sttEnabled: false } as Record<string, unknown>,
}));

vi.mock('../../services/audio/config/serviceConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/audio/config/serviceConfig')>();
  return {
    ...actual,
    loadServiceConfig: () => ({ ...actual.defaultConfig, localMode: { ...h.localMode } }),
  };
});

import CustomCouncilService from '../../services/council/CustomCouncilService';
import { LocalModeTtsUnavailable } from '../../services/audio/tts/localModeTTS';
import type { AudioFile } from '../../services/audio/tts';

const LOCAL = 'http://127.0.0.1:';
const URLS = { ttsKokoroURL: `${LOCAL}8880`, ttsQwenURL: `${LOCAL}8887` };
const VOICE = 'm1_warm_elder_v2';

type Speak = (text: string, base: string, voice: string, service: string, speed: number, language?: string, sessionId?: string) => Promise<AudioFile>;

function service(): { speak: Speak } {
  const main = {
    councilState: { isActive: true, participants: ['einstein'], question: 'Was ist ein gutes Leben?', moderator: 'lovelace', type: 'debate' as const },
    config: {},
    _getUserTTSSettings: () => ({ enabled: true, provider: 'self-hosted', speed: 1 }),
    _getUserLanguage: () => 'de',
    _notifyError: vi.fn(),
    _notifyCouncilLoaderChange: vi.fn(),
  };
  const council = new CustomCouncilService(main as never) as unknown as { _generateTTSWithExplicitVoice: Speak };
  return { speak: council._generateTTSWithExplicitVoice.bind(council) };
}

function serve(local: 'refused' | 'ok'): void {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    if (String(input).startsWith(LOCAL) && local === 'refused') throw new TypeError('Failed to fetch');
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/wav' } });
  });
}

const requests = () => vi.mocked(global.fetch).mock.calls.map(([input, init]) => ({
  url: String(input),
  voice: (JSON.parse(String(init?.body ?? '{}')) as { voice?: string }).voice,
}));

describe('a council speaker voice in Local Mode', () => {
  const heard: Array<{ service: string }> = [];
  const listen = (e: Event) => heard.push((e as CustomEvent).detail);
  let warn: ReturnType<typeof vi.spyOn>;
  let blobUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    heard.length = 0;
    window.addEventListener('local-mode-unavailable', listen);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    blobUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  });

  afterEach(() => {
    window.removeEventListener('local-mode-unavailable', listen);
    warn.mockRestore();
    blobUrl.mockRestore();
    h.localMode = { llmEnabled: false, ttsEnabled: false, sttEnabled: false };
  });

  it('is spoken by the local service, in the voice the council gave it', async () => {
    h.localMode = { llmEnabled: false, ttsEnabled: true, sttEnabled: false, ...URLS };
    serve('ok');

    const audio = await service().speak('Ein gutes Leben ist ein waches Leben.', 'council-1_segment-1', VOICE, 'self-hosted', 1, 'de', 's-1');

    expect(audio.backend).toBe('qwen-local');
    expect(requests()).toEqual([{ url: `${URLS.ttsQwenURL}/v1/audio/speech`, voice: VOICE }]);
  });

  it('throws when the local service is down, and sends nothing to the hosted gateway', async () => {
    h.localMode = { llmEnabled: false, ttsEnabled: true, sttEnabled: false, ...URLS };
    serve('refused');

    await expect(
      service().speak('Ein gutes Leben ist ein waches Leben.', 'council-1_segment-1', VOICE, 'self-hosted', 1, 'de', 's-1'),
    ).rejects.toBeInstanceOf(LocalModeTtsUnavailable);

    expect(requests().every((r) => r.url.startsWith(LOCAL))).toBe(true);
    expect(heard).toEqual([{ service: 'tts' }]);
  });

  it('with Local Mode off, goes to the hosted gateway in that voice as before', async () => {
    serve('ok');

    await service().speak('Ein gutes Leben ist ein waches Leben.', 'council-1_segment-1', VOICE, 'self-hosted', 1, 'de', 's-1');

    const sent = requests();
    expect(sent).toHaveLength(1);
    expect(sent[0].url.startsWith(LOCAL)).toBe(false);
    expect(sent[0].url).toMatch(/\/v1\/audio\/speech$/);
    expect(sent[0].voice).toBe(VOICE);
  });
});
