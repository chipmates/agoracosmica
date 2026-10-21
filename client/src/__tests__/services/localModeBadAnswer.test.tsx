// A local audio service that answers with a server error, or with something
// that is not a transcript or not audio, fails closed like one that does not
// answer at all: the banner says so in the app's language, nothing goes hosted.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import en from '../../assets/translations/ui-en.json';
import de from '../../assets/translations/ui-de.json';

const h = vi.hoisted(() => ({
  lang: 'de' as 'en' | 'de',
  localMode: { llmEnabled: false, ttsEnabled: false, sttEnabled: false } as Record<string, unknown>,
}));

vi.mock('../../services/audio/config/serviceConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/audio/config/serviceConfig')>();
  return {
    ...actual,
    loadServiceConfig: () => ({ ...actual.defaultConfig, localMode: { ...h.localMode } }),
  };
});

vi.mock('../../hooks/useTranslation', async () => {
  const bundles = {
    en: (await import('../../assets/translations/ui-en.json')).default,
    de: (await import('../../assets/translations/ui-de.json')).default,
  };
  const lookup = (bundle: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);
  return {
    useTranslation: () => ({
      tString: (key: string, fallback?: string) => {
        const value = lookup(bundles[h.lang], key);
        return typeof value === 'string' ? value : fallback ?? '';
      },
      language: h.lang,
    }),
  };
});

import NetworkStatusBanner from '../../components/NetworkStatusBanner';
import { transcribeAudio } from '../../services/audio/stt';
import { convertTextToSpeech } from '../../services/audio/tts';
import { LocalModeSttUnavailable } from '../../services/audio/stt/localModeSTT';
import { LocalModeTtsUnavailable } from '../../services/audio/tts/localModeTTS';

const LOCAL = 'http://127.0.0.1:';
const URLS = { sttURL: `${LOCAL}8000`, ttsKokoroURL: `${LOCAL}8880`, ttsQwenURL: `${LOCAL}8887` };

/** The local service answers with `local`; anything else answers like a working hosted server. */
function serve(local: () => Response): void {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith(LOCAL)) return local();
    if (url.includes('/transcriptions')) return new Response(JSON.stringify({ text: 'hosted transcript' }), { status: 200 });
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/webm' } });
  });
}

const hostedCalls = () => vi.mocked(global.fetch).mock.calls.map(([input]) => String(input)).filter((url) => !url.startsWith(LOCAL));
const recording = () => new Blob([new Uint8Array(4096)], { type: 'audio/webm' });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const sttAnswers: Array<[string, () => Response]> = [
  ['a server error (500)', () => json({ error: 'model crashed' }, 500)],
  ['a bad request (400)', () => json({ error: 'unsupported language' }, 400)],
  ['a 200 without a text field', () => json({ segments: [] })],
  ['a 200 that is not JSON', () => new Response('<html>proxy error</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })],
];

const bytes = (text: string) => new TextEncoder().encode(text);

const ttsAnswers: Array<[string, () => Response]> = [
  ['a server error (500)', () => new Response('boom', { status: 500, statusText: 'Internal Server Error' })],
  ['a 200 with a JSON error instead of audio', () => json({ error: 'voice not found' })],
  ['a 200 with an empty body', () => new Response(new Uint8Array(0), { status: 200, headers: { 'Content-Type': 'audio/wav' } })],
  ['a 200 of octet-stream that is not audio', () => new Response(bytes('not audio at all'), { status: 200, headers: { 'Content-Type': 'application/octet-stream' } })],
  ['a 200 with no type that is a web page', () => new Response(bytes('<html>proxy page</html>'), { status: 200 })],
];

const wav = () => {
  const body = new Uint8Array(64);
  body.set(bytes('RIFF'), 0);
  body.set(bytes('WAVE'), 8);
  return body;
};

describe('Local Mode with a local service that answers badly', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  let blobUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    blobUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.mocked(global.fetch).mockClear();
    h.lang = 'de';
  });

  afterEach(() => {
    cleanup();
    warn.mockRestore();
    error.mockRestore();
    blobUrl.mockRestore();
    h.localMode = { llmEnabled: false, ttsEnabled: false, sttEnabled: false };
  });

  it.each(sttAnswers)('transcription: %s shows the local line and sends nothing hosted', async (_name, answer) => {
    h.localMode = { llmEnabled: false, ttsEnabled: false, sttEnabled: true, ...URLS };
    serve(answer);
    render(<NetworkStatusBanner />);

    await act(async () => {
      await expect(transcribeAudio(recording(), 'self-hosted', 'de')).rejects.toBeInstanceOf(LocalModeSttUnavailable);
    });

    expect(screen.getByRole('alert').textContent).toBe(de.errors.network.localSttUnavailable);
    expect(hostedCalls()).toEqual([]);
  });

  it.each(ttsAnswers)('voice: %s shows the local line and sends nothing hosted', async (_name, answer) => {
    h.localMode = { llmEnabled: false, ttsEnabled: true, sttEnabled: false, ...URLS };
    h.lang = 'en';
    serve(answer);
    render(<NetworkStatusBanner />);

    await act(async () => {
      await expect(
        convertTextToSpeech('Was macht ein gutes Leben aus?', 1, 'aurelius', 'self-hosted', 1, 'en', 'session-1'),
      ).rejects.toBeInstanceOf(LocalModeTtsUnavailable);
    });

    expect(screen.getByRole('alert').textContent).toBe(en.errors.network.localTtsUnavailable);
    expect(hostedCalls()).toEqual([]);
  });

  it.each([['an empty text', ''], ['only blanks', '  ']])('transcription: %s shows the heard-nothing line and sends nothing hosted', async (_name, text) => {
    h.localMode = { llmEnabled: false, ttsEnabled: false, sttEnabled: true, ...URLS };
    serve(() => json({ text }));
    render(<NetworkStatusBanner />);

    await act(async () => {
      const failure = await transcribeAudio(recording(), 'self-hosted', 'de').catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(Error);
      expect(failure).not.toBeInstanceOf(LocalModeSttUnavailable);
    });

    expect(screen.getByRole('alert').textContent).toBe(de.errors.network.localSttEmpty);
    expect(hostedCalls()).toEqual([]);
  });

  it('a working local voice that sends WAV as octet-stream still speaks', async () => {
    h.localMode = { llmEnabled: false, ttsEnabled: true, sttEnabled: false, ...URLS };
    serve(() => new Response(wav(), { status: 200, headers: { 'Content-Type': 'application/octet-stream' } }));

    const audio = await convertTextToSpeech('Hallo', 1, 'aurelius', 'self-hosted', 1, 'de', 'session-1');

    expect(audio.backend).toBe('qwen-local');
    expect(hostedCalls()).toEqual([]);
  });

  it('a working local voice still speaks', async () => {
    h.localMode = { llmEnabled: false, ttsEnabled: true, sttEnabled: false, ...URLS };
    serve(() => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/wav' } }));

    const audio = await convertTextToSpeech('Hallo', 1, 'aurelius', 'self-hosted', 1, 'de', 'session-1');

    expect(audio.backend).toBe('qwen-local');
    expect(hostedCalls()).toEqual([]);
  });
});
