// A greeting spoken in a voice the visitor picked is rendered live. With Local
// Mode voice on, the local service speaks it and fails closed like every other
// line: the greeting text never goes to the hosted gateway.
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

import { initialMessageService } from '../../services/audio/initialMessageService';
import { LocalModeTtsUnavailable } from '../../services/audio/tts/localModeTTS';

const LOCAL = 'http://127.0.0.1:';
const URLS = { ttsKokoroURL: `${LOCAL}8880`, ttsQwenURL: `${LOCAL}8887` };
const GREETING = 'Sei gegrüßt. Ich bin Marc Aurel. Worüber möchtest du sprechen?';

/** The greeting text file answers; local voice answers as told; anything else answers like a working hosted gateway. */
function serve(local: 'ok' | 'refused'): void {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/initial-messages/')) {
      return new Response(GREETING, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    if (url.startsWith(LOCAL) && local === 'refused') throw new TypeError('Failed to fetch');
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/wav' } });
  });
}

const speechRequests = () => vi.mocked(global.fetch).mock.calls
  .map(([input]) => String(input))
  .filter((url) => url.endsWith('/v1/audio/speech'));

let run = 0;
const greet = (language: 'de' | 'en') =>
  initialMessageService.getInitialMessageWithDynamicAudio('aurelius', 'freetalk', null, language, 1.0, `greet-${++run}`, 'session-1');

describe('a custom-voice greeting in Local Mode', () => {
  const heard: Array<{ service: string }> = [];
  const listen = (e: Event) => heard.push((e as CustomEvent).detail);
  let warn: ReturnType<typeof vi.spyOn>;
  let blobUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    heard.length = 0;
    window.addEventListener('local-mode-unavailable', listen);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // jsdom's Blob is not the one Node's createObjectURL accepts.
    blobUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.mocked(global.fetch).mockClear();
    // A greeting rendered in an earlier test would answer from memory.
    (initialMessageService as unknown as { dynamicAudioCache: Map<string, unknown> }).dynamicAudioCache.clear();
  });

  afterEach(() => {
    window.removeEventListener('local-mode-unavailable', listen);
    warn.mockRestore();
    blobUrl.mockRestore();
    h.localMode = { llmEnabled: false, ttsEnabled: false, sttEnabled: false };
  });

  it('is spoken by the local service, nothing goes to the hosted gateway', async () => {
    h.localMode = { llmEnabled: false, ttsEnabled: true, sttEnabled: false, ...URLS };
    serve('ok');

    const message = await greet('de');

    expect(message?.text).toBe(GREETING);
    expect(message?.audioUrls.length).toBeGreaterThan(0);
    expect(speechRequests().length).toBeGreaterThan(0);
    expect(speechRequests().every((url) => url.startsWith(`${URLS.ttsQwenURL}/`))).toBe(true);
  });

  it('throws when the local service is down, and sends nothing to the hosted gateway', async () => {
    h.localMode = { llmEnabled: false, ttsEnabled: true, sttEnabled: false, ...URLS };
    serve('refused');

    await expect(greet('en')).rejects.toBeInstanceOf(LocalModeTtsUnavailable);

    expect(speechRequests().length).toBeGreaterThan(0);
    expect(speechRequests().every((url) => url.startsWith(LOCAL))).toBe(true);
    expect(heard.length).toBeGreaterThan(0);
    expect(heard.every((e) => e.service === 'tts')).toBe(true);
  });

  it('with Local Mode off, goes to the hosted gateway as before', async () => {
    serve('refused');

    const message = await greet('de');

    expect(message?.text).toBe(GREETING);
    expect(speechRequests().length).toBeGreaterThan(0);
    expect(speechRequests().some((url) => url.startsWith(LOCAL))).toBe(false);
    expect(heard).toEqual([]);
  });
});

describe('the greeting kept for a revisit', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let blobUrl: ReturnType<typeof vi.spyOn>;
  const LOCAL_ON = { llmEnabled: false, ttsEnabled: true, sttEnabled: false, ...URLS };

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    blobUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.mocked(global.fetch).mockClear();
    (initialMessageService as unknown as { dynamicAudioCache: Map<string, unknown> }).dynamicAudioCache.clear();
  });

  afterEach(() => {
    warn.mockRestore();
    blobUrl.mockRestore();
    h.localMode = { llmEnabled: false, ttsEnabled: false, sttEnabled: false };
  });

  it('a greeting spoken locally is kept: the revisit plays it from memory', async () => {
    h.localMode = LOCAL_ON;
    serve('ok');

    await greet('de');
    const spoken = speechRequests().length;
    expect(spoken).toBeGreaterThan(0);

    const again = await greet('de');

    expect(again?.audioUrls.length).toBeGreaterThan(0);
    expect(speechRequests().length).toBe(spoken);
  });

  it('a greeting kept from our servers is not replayed in Local Mode: the local voice speaks it', async () => {
    serve('ok');
    await greet('de');
    expect(speechRequests().some((url) => url.startsWith(LOCAL))).toBe(false);

    h.localMode = LOCAL_ON;
    vi.mocked(global.fetch).mockClear();
    await greet('de');

    expect(speechRequests().length).toBeGreaterThan(0);
    expect(speechRequests().every((url) => url.startsWith(`${URLS.ttsQwenURL}/`))).toBe(true);
  });

  it('a greeting kept from Local Mode is not replayed with Local Mode off', async () => {
    h.localMode = LOCAL_ON;
    serve('ok');
    await greet('en');

    h.localMode = { llmEnabled: false, ttsEnabled: false, sttEnabled: false };
    vi.mocked(global.fetch).mockClear();
    await greet('en');

    expect(speechRequests().length).toBeGreaterThan(0);
    expect(speechRequests().some((url) => url.startsWith(LOCAL))).toBe(false);
  });
});
