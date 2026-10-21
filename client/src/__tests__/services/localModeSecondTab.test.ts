// Two tabs of the app share the saved settings. When the visitor turns Local
// Mode on in one tab, a tab that was open before must use it for its next
// transcription, its retries and its speech, and must never save its older
// settings back over the new choice.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDomainStore } from '../../stores/domainStore';
import { defaultConfig, loadServiceConfig, saveServiceConfig, type ServiceConfig } from '../../services/audio/config/serviceConfig';
import { transcribeAudio } from '../../services/audio/stt';
import { convertTextToSpeech } from '../../services/audio/tts';

const STORE = 'agora-cosmica-store';
const LOCAL = 'http://127.0.0.1:';
const URLS = { sttURL: `${LOCAL}8000`, ttsKokoroURL: `${LOCAL}8880`, ttsQwenURL: `${LOCAL}8887` };
const OFF = { llmEnabled: false, ttsEnabled: false, sttEnabled: false, ...URLS };
const ON = { llmEnabled: false, ttsEnabled: true, sttEnabled: true, ...URLS };

const configWith = (localMode: typeof OFF): ServiceConfig => ({ ...defaultConfig, localMode: { ...localMode } });

/** What the other tab's store writes when the visitor flips the switches there. */
function saveFromOtherTab(localMode: typeof OFF): string {
  const blob = JSON.parse(window.localStorage.getItem(STORE) || '{"state":{},"version":1}');
  const config = configWith(localMode);
  blob.state.serviceConfig = { raw: JSON.stringify(config), parsed: config };
  const value = JSON.stringify(blob);
  window.localStorage.setItem(STORE, value);
  return value;
}

const savedLocalMode = () => {
  const blob = JSON.parse(window.localStorage.getItem(STORE) || '{}');
  const raw = blob?.state?.serviceConfig?.raw;
  return raw ? JSON.parse(raw).localMode : null;
};

const wav = () => {
  const bytes = new Uint8Array(64);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x41, 0x56, 0x45], 8);
  return bytes;
};

/** The local services answer well; the hosted ones answer as `hosted` says. */
function serve(hosted: () => Response = () => new Response(JSON.stringify({ text: 'hosted transcript' }), { status: 200 })): void {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith(LOCAL)) {
      if (url.includes('/transcriptions')) return new Response(JSON.stringify({ text: 'local transcript' }), { status: 200 });
      return new Response(wav(), { status: 200, headers: { 'Content-Type': 'audio/wav' } });
    }
    return hosted();
  });
}

const sent = () => vi.mocked(global.fetch).mock.calls.map(([input]) => String(input));
const hostedCalls = () => sent().filter((url) => !url.startsWith(LOCAL));
const localCalls = () => sent().filter((url) => url.startsWith(LOCAL));
const recording = () => new Blob([new Uint8Array(4096)], { type: 'audio/webm' });

describe('Local Mode switched on in another tab', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  let blobUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    blobUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    // This tab: open since before the switch, Local Mode off in its memory and on disk.
    saveServiceConfig(configWith(OFF));
    vi.mocked(global.fetch).mockClear();
    vi.mocked(window.localStorage.setItem).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    warn.mockRestore();
    error.mockRestore();
    blobUrl.mockRestore();
  });

  it('the next transcription goes to the local service', async () => {
    saveFromOtherTab(ON);
    serve();

    const result = await transcribeAudio(recording(), 'self-hosted', 'de');

    expect(result.text).toBe('local transcript');
    expect(hostedCalls()).toEqual([]);
  });

  it('a transcription retry goes local once the other tab switched during the wait', async () => {
    vi.useFakeTimers();
    let first = true;
    serve(() => {
      if (first) {
        first = false;
        saveFromOtherTab(ON);
      }
      return new Response(JSON.stringify({ error: 'busy' }), { status: 503 });
    });

    const run = transcribeAudio(recording(), 'self-hosted', 'de');
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await run;

    expect(result.text).toBe('local transcript');
    expect(hostedCalls()).toHaveLength(1);
    expect(localCalls()).toHaveLength(1);
  });

  it('the next reply is spoken by the local voice', async () => {
    saveFromOtherTab(ON);
    serve();

    const audio = await convertTextToSpeech('Freiheit beginnt im Inneren.', 1, 'aurelius', 'self-hosted', 1, 'de', 'session-1');

    expect(audio.backend).toBe('qwen-local');
    expect(hostedCalls()).toEqual([]);
  });

  it('a later write of this tab keeps the new choice on disk and in memory', () => {
    saveFromOtherTab(ON);

    useDomainStore.getState().setAudioPlaying(true);
    useDomainStore.getState().setAudioPlaying(false);

    expect(savedLocalMode()).toMatchObject({ ttsEnabled: true, sttEnabled: true });
    expect(JSON.parse(useDomainStore.getState().serviceConfig.raw as string).localMode).toMatchObject({ ttsEnabled: true, sttEnabled: true });
  });

  it('the storage event brings the choice into memory without writing back', () => {
    const value = saveFromOtherTab(ON);
    vi.mocked(window.localStorage.setItem).mockClear();

    window.dispatchEvent(new StorageEvent('storage', { key: STORE, newValue: value }));

    expect(loadServiceConfig().localMode).toMatchObject({ ttsEnabled: true, sttEnabled: true });
    expect(vi.mocked(window.localStorage.setItem)).not.toHaveBeenCalled();
  });

  it('a switch in this tab merges with the other tab and is saved', () => {
    saveFromOtherTab({ ...OFF, ttsEnabled: true });

    // As the Local Mode panel does: read, flip one switch, save.
    const config = loadServiceConfig();
    config.localMode = { ...config.localMode!, sttEnabled: true };
    saveServiceConfig(config);

    expect(savedLocalMode()).toMatchObject({ ttsEnabled: true, sttEnabled: true });
  });

  it('this tab turning Local Mode off again is kept', () => {
    saveFromOtherTab(ON);
    const config = loadServiceConfig();
    config.localMode = { ...config.localMode!, ttsEnabled: false, sttEnabled: false };
    saveServiceConfig(config);

    useDomainStore.getState().setAudioPlaying(true);

    expect(savedLocalMode()).toMatchObject({ ttsEnabled: false, sttEnabled: false });
  });
});
