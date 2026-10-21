// A voice preview in Settings plays the stored sample first. When the sample
// cannot load and Local Mode voice is on, the local voice speaks the sample
// sentence, or the banner says the local voice is down. The sentence never goes
// to the hosted voice servers.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../hooks/useTranslation', () => {
  const t = (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key);
  const api = { t, tString: t, tNode: t, tArray: () => [] };
  return { default: () => api, useTranslation: () => api };
});

import VoicePanel from '../../components/settings/panels/VoicePanel';
import { useDomainStore } from '../../stores/domainStore';
import { defaultConfig, saveServiceConfig } from '../../services/audio/config/serviceConfig';

const LOCAL = 'http://127.0.0.1:';
const URLS = { sttURL: `${LOCAL}8000`, ttsKokoroURL: `${LOCAL}8880`, ttsQwenURL: `${LOCAL}8887` };
const SAMPLE = 'voice-previews/';

const wav = () => {
  const bytes = new Uint8Array(64);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x41, 0x56, 0x45], 8);
  return bytes;
};

/** The stored sample is missing; the local voice answers as told; the hosted one would speak. */
function serve(local: 'ok' | 'down'): void {
  vi.mocked(global.fetch).mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes(SAMPLE)) return new Response('not found', { status: 404 });
    if (url.startsWith(LOCAL)) {
      if (local === 'down') throw new TypeError('Failed to fetch');
      return new Response(wav(), { status: 200, headers: { 'Content-Type': 'audio/wav' } });
    }
    return new Response(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), { status: 200, headers: { 'Content-Type': 'audio/webm' } });
  });
}

const calls = () => vi.mocked(global.fetch).mock.calls.map(([input, init]) => ({ url: String(input), body: String(init?.body ?? '') }));
const hostedSpeech = () => calls().filter(({ url }) => !url.startsWith(LOCAL) && !url.includes(SAMPLE));
const localSpeech = () => calls().filter(({ url }) => url.startsWith(LOCAL));

class NoResize {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', NoResize);

const Card: React.FC<{ children?: React.ReactNode }> = ({ children }) => <div>{children}</div>;
const Options: React.FC = () => null;

function renderPanel() {
  return render(
    <VoicePanel
      SettingCard={Card}
      CATEGORY_ICONS={new Proxy({}, { get: () => null })}
      OptionButtons={Options}
      config={{ ttsEnabled: true, ttsSettings: { speed: 1, model: 'tts-1' } }}
      onChange={() => {}}
    />,
  );
}

const pressFirstPreview = (container: HTMLElement) => {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button.voice-plate-btn')]
    .find((b) => /preview/i.test(b.textContent ?? ''));
  expect(button).toBeTruthy();
  fireEvent.click(button!);
};

describe('the Settings voice preview when its stored sample cannot load', () => {
  const heard: Array<{ service: string }> = [];
  const listen = (e: Event) => heard.push((e as CustomEvent).detail);
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  let blobUrl: ReturnType<typeof vi.spyOn>;
  let play: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    heard.length = 0;
    window.addEventListener('local-mode-unavailable', listen);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    blobUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    useDomainStore.setState((s) => ({ language: { ...s.language, current: 'de' } }));
    vi.mocked(global.fetch).mockClear();
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener('local-mode-unavailable', listen);
    warn.mockRestore();
    error.mockRestore();
    blobUrl.mockRestore();
    play.mockRestore();
  });

  it('Local Mode voice on: the local voice speaks the sample, nothing hosted', async () => {
    saveServiceConfig({ ...defaultConfig, localMode: { llmEnabled: false, ttsEnabled: true, sttEnabled: false, ...URLS } });
    serve('ok');
    const { container } = renderPanel();

    pressFirstPreview(container);

    await waitFor(() => expect(localSpeech()).toHaveLength(1));
    expect(localSpeech()[0].body).toContain('Die Ideen großer Köpfe');
    expect(hostedSpeech()).toEqual([]);
  });

  it('Local Mode voice on and down: the banner, nothing hosted', async () => {
    saveServiceConfig({ ...defaultConfig, localMode: { llmEnabled: false, ttsEnabled: true, sttEnabled: false, ...URLS } });
    serve('down');
    const { container } = renderPanel();

    pressFirstPreview(container);

    await waitFor(() => expect(heard).toEqual([{ service: 'tts' }]));
    expect(hostedSpeech()).toEqual([]);
  });

  it('Local Mode off: the hosted voice speaks the sample, as before', async () => {
    saveServiceConfig({ ...defaultConfig, localMode: { llmEnabled: false, ttsEnabled: false, sttEnabled: false, ...URLS } });
    serve('ok');
    const { container } = renderPanel();

    pressFirstPreview(container);

    await waitFor(() => expect(hostedSpeech()).toHaveLength(1));
    expect(hostedSpeech()[0].url).toMatch(/\/v1\/audio\/speech$/);
    expect(localSpeech()).toEqual([]);
  });
});
