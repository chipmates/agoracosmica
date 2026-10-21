// A hosted transcription that fails waits and retries. When the visitor turns
// on Local Mode transcription during that wait, the recording is not sent to
// the hosted servers again: the next try goes to the local service.
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
import { LocalModeSttUnavailable } from '../../services/audio/stt/localModeSTT';

const LOCAL = 'http://127.0.0.1:8000';
const ON = { llmEnabled: false, ttsEnabled: false, sttEnabled: true, sttURL: LOCAL };

/** Hosted answers 503 and lets the test act once it has; local answers as told. */
function serve(local: 'ok' | 'refused', onHosted: () => void): void {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith(LOCAL)) {
      if (local === 'refused') throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify({ text: 'local transcript' }), { status: 200 });
    }
    onHosted();
    return new Response(JSON.stringify({ error: 'busy' }), { status: 503 });
  });
}

const sent = () => vi.mocked(global.fetch).mock.calls.map(([input]) => String(input));
const hosted = () => sent().filter((url) => !url.startsWith(LOCAL));
const local = () => sent().filter((url) => url.startsWith(LOCAL));
const recording = () => new Blob([new Uint8Array(4096)], { type: 'audio/webm' });

describe('Local Mode turned on while a hosted transcription waits to retry', () => {
  const heard: Array<{ service: string }> = [];
  const listen = (e: Event) => heard.push((e as CustomEvent).detail);
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    heard.length = 0;
    window.addEventListener('local-mode-unavailable', listen);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(global.fetch).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.removeEventListener('local-mode-unavailable', listen);
    warn.mockRestore();
    error.mockRestore();
    h.localMode = { llmEnabled: false, ttsEnabled: false, sttEnabled: false };
  });

  it('sends the recording to the hosted servers once, then transcribes it locally', async () => {
    serve('ok', () => { h.localMode = { ...ON }; });

    const run = transcribeAudio(recording(), 'self-hosted', 'de');
    const settled = run.then((r) => r, (e) => e);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await settled;

    expect(hosted()).toHaveLength(1);
    expect(local()).toHaveLength(1);
    expect(result).toMatchObject({ text: 'local transcript' });
  });

  it('fails closed when the local service is down: no second hosted send', async () => {
    serve('refused', () => { h.localMode = { ...ON }; });

    const settled = transcribeAudio(recording(), 'self-hosted', 'en').then((r) => r, (e) => e);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await settled;

    expect(result).toBeInstanceOf(LocalModeSttUnavailable);
    expect(hosted()).toHaveLength(1);
    expect(heard).toEqual([{ service: 'stt' }]);
  });

  it('with Local Mode left off, retries on the hosted servers as before', async () => {
    serve('ok', () => {});

    const settled = transcribeAudio(recording(), 'self-hosted', 'de').then((r) => r, (e) => e);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await settled;

    expect(result).toBeInstanceOf(Error);
    expect(hosted()).toHaveLength(3);
    expect(local()).toHaveLength(0);
  });
});
