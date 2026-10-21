// Local Mode audio fails closed. With local transcription or local voice on and
// the local service down, the call throws and the banner hears about it; the
// recording or the text never goes to the hosted audio servers instead.
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

import { transcribeAudio } from '../../services/audio/stt';
import { convertTextToSpeech } from '../../services/audio/tts';
import { LocalModeSttUnavailable } from '../../services/audio/stt/localModeSTT';
import { LocalModeTtsUnavailable } from '../../services/audio/tts/localModeTTS';

const LOCAL = 'http://127.0.0.1:';
const URLS = {
  sttURL: `${LOCAL}8000`,
  ttsKokoroURL: `${LOCAL}8880`,
  ttsQwenURL: `${LOCAL}8887`,
};

type LocalAnswer = 'refused' | 404 | 503 | 'hang';

/** Local endpoints answer as told; anything else answers like a working hosted server. */
function serve(local: LocalAnswer): void {
  vi.mocked(global.fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.startsWith(LOCAL)) {
      if (local === 'refused') throw new TypeError('Failed to fetch');
      if (local === 'hang') {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
        });
      }
      return new Response('', { status: local });
    }
    // A real fetch with a stopped signal rejects before it sends anything.
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    if (url.includes('/transcriptions')) {
      return new Response(JSON.stringify({ text: 'hosted transcript' }), { status: 200 });
    }
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/webm' } });
  });
}

const fetchedUrls = () => vi.mocked(global.fetch).mock.calls.map(([input]) => String(input));
const recording = () => new Blob([new Uint8Array(4096)], { type: 'audio/webm' });

describe('Local Mode audio with the local service down', () => {
  const heard: Array<{ service: string }> = [];
  const listen = (e: Event) => heard.push((e as CustomEvent).detail);
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  let blobUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    heard.length = 0;
    window.addEventListener('local-mode-unavailable', listen);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    // jsdom's Blob is not the one Node's createObjectURL accepts.
    blobUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  });

  afterEach(() => {
    window.removeEventListener('local-mode-unavailable', listen);
    warn.mockRestore();
    error.mockRestore();
    blobUrl.mockRestore();
    h.localMode = { llmEnabled: false, ttsEnabled: false, sttEnabled: false };
  });

  it.each(['refused', 404, 503] as const)('transcription throws and sends nothing to the hosted servers (local %s)', async (answer) => {
    h.localMode = { llmEnabled: false, ttsEnabled: false, sttEnabled: true, ...URLS };
    serve(answer);

    await expect(transcribeAudio(recording(), 'self-hosted', 'de')).rejects.toBeInstanceOf(LocalModeSttUnavailable);

    expect(fetchedUrls().length).toBeGreaterThan(0);
    expect(fetchedUrls().every((url) => url.startsWith(LOCAL))).toBe(true);
    expect(heard).toEqual([{ service: 'stt' }]);
  });

  it.each([
    ['de', 'refused'],
    ['en', 'refused'],
    ['de', 503],
    ['en', 404],
  ] as const)('voice throws and sends nothing to the hosted servers (%s, local %s)', async (language, answer) => {
    h.localMode = { llmEnabled: false, ttsEnabled: true, sttEnabled: false, ...URLS };
    serve(answer);

    await expect(
      convertTextToSpeech('Was macht ein gutes Leben aus?', 1, 'aurelius', 'self-hosted', 1, language, 'session-1'),
    ).rejects.toBeInstanceOf(LocalModeTtsUnavailable);

    expect(fetchedUrls().length).toBeGreaterThan(0);
    expect(fetchedUrls().every((url) => url.startsWith(LOCAL))).toBe(true);
    expect(heard).toEqual([{ service: 'tts' }]);
  });

  it('a stop during a local voice request ends as a stop: no hosted call, no banner', async () => {
    h.localMode = { llmEnabled: false, ttsEnabled: true, sttEnabled: false, ...URLS };
    serve('hang');
    const controller = new AbortController();

    const run = convertTextToSpeech('Hallo', 1, 'aurelius', 'self-hosted', 1, 'de', 'session-1', controller.signal);
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();

    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchedUrls().every((url) => url.startsWith(LOCAL))).toBe(true);
    expect(heard).toEqual([]);
  });

  it('with Local Mode off, transcription and voice use the hosted servers as before', async () => {
    serve('refused');

    const text = await transcribeAudio(recording(), 'self-hosted', 'de');
    const audio = await convertTextToSpeech('Hallo', 1, 'aurelius', 'self-hosted', 1, 'de', 'session-1');

    expect(text.text).toBe('hosted transcript');
    expect(audio.url).toBeTruthy();
    expect(fetchedUrls().some((url) => url.startsWith(LOCAL))).toBe(false);
    expect(heard).toEqual([]);
  });
});
