// client/src/services/audio/tts/localModeTTS.ts
//
// Local Mode TTS: routes EN to the local Kokoro container (port 8880) and DE
// to the local Qwen3-TTS container (port 8887) or Apple-Silicon native MLX
// instance (same port). Both speak OpenAI-compatible `/v1/audio/speech`.
//
// The 10 archetype voice slugs for DE (e.g. `m1_warm_elder_v2`) are passed
// through verbatim — our Qwen FastAPI wrapper resolves them to the right
// reference WAV / embedding. Kokoro voice IDs for EN (e.g. `af_heart`) are
// also passed through verbatim.
//
// On a 404 / connection refused from the DE endpoint, the caller's exception
// handler decides whether to fall back to the hosted DE path (see index.ts).

import { getVoiceForNormalMode } from '../voices/voiceResolver';
import { fetchWithTimeout } from '../../../utils/fetchWithTimeout';
import { localTtsKokoroUrl, localTtsQwenUrl } from '../../../config/runtime';
import type { AudioFile } from './index';
import type { VoiceMapping } from '../voices/voiceResolver';

const IS_IOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
) && !(window as any).MSStream;

function isGerman(language?: string): boolean {
  if (!language) return false;
  const lower = language.toLowerCase();
  return lower === 'de' || lower === 'german' || lower === 'deutsch';
}

export class LocalModeTtsUnavailable extends Error {
  constructor(message: string, public readonly language: string, public readonly url: string) {
    super(message);
    this.name = 'LocalModeTtsUnavailable';
  }
}

interface LocalModeTTSUrls {
  kokoroUrl?: string;
  qwenUrl?: string;
}

export async function localModeTTS(
  text: string,
  fileBaseName: string,
  figureName: string,
  speed: number = 1.0,
  explicitVoice?: string,
  councilMapping?: VoiceMapping,
  language?: string,
  signal?: AbortSignal,
  urlOverrides?: LocalModeTTSUrls,
): Promise<AudioFile> {
  const de = isGerman(language);
  const kokoroBase = (urlOverrides?.kokoroUrl?.trim() || localTtsKokoroUrl).replace(/\/+$/, '');
  const qwenBase = (urlOverrides?.qwenUrl?.trim() || localTtsQwenUrl).replace(/\/+$/, '');
  const endpoint = de ? qwenBase : kokoroBase;
  const voiceId =
    explicitVoice || getVoiceForNormalMode(figureName, 'kokoro', councilMapping, language);

  // Format choice per backend:
  //   - MLX Qwen v0.1 (DE) only supports WAV — no choice for DE local on Apple
  //     Silicon. iOS users may hit reliability issues until mlx_server adds MP3.
  //   - Kokoro (EN) accepts both. iOS Safari plays MP3 reliably via HTML5
  //     audio; WAV from blob URLs is flaky (first sample plays then `ended`
  //     fires early). On non-iOS browsers WAV is fine and lets the
  //     appendTailSilence path work below.
  const responseFormat = de ? 'wav' : (IS_IOS ? 'mp3' : 'wav');
  const requestBody: Record<string, unknown> = {
    model: de ? 'Qwen/Qwen3-TTS-12Hz-0.6B-Base' : 'kokoro',
    input: text,
    voice: voiceId,
    response_format: responseFormat,
    speed,
  };
  if (de) {
    requestBody.task_type = 'Base';
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${endpoint}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      timeoutMs: 30_000, // longer than hosted: local first-call may JIT a model
      signal,
    });
  } catch (err) {
    // Connection refused, DNS failure, timeout — treat as unavailable so the
    // caller can decide whether to fall back to the hosted path.
    throw new LocalModeTtsUnavailable(
      err instanceof Error ? err.message : 'unknown network error',
      de ? 'de' : 'en',
      endpoint,
    );
  }

  if (!response.ok) {
    if (response.status === 404 || response.status === 503) {
      throw new LocalModeTtsUnavailable(
        `Local TTS endpoint returned ${response.status} (model not loaded or service down)`,
        de ? 'de' : 'en',
        endpoint,
      );
    }
    const errorText = await response.text().catch(() => '');
    console.error('[Local Mode TTS] API error:', response.status, errorText);
    throw new Error(`Local TTS failed: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  // Append 150 ms tail silence client-side (mirrors the prod gateway's
  // TTS_TAIL_SILENCE_MS=150 — masks the HTML5 <audio> encoder-padding clip
  // at the end of short clips).
  const padded = appendTailSilence(arrayBuffer, responseFormat === 'wav' ? 'wav' : 'mp3');

  const contentType = response.headers.get('content-type') || (responseFormat === 'wav' ? 'audio/wav' : 'audio/mpeg');
  const isMp3 = contentType.includes('mpeg') || contentType.includes('mp3');
  const ext = isMp3 ? '.mp3' : (responseFormat === 'wav' ? '.wav' : '.webm');
  const mimeType = isMp3 ? 'audio/mpeg' : (responseFormat === 'wav' ? 'audio/wav' : 'audio/webm');

  const audioBlob = new Blob([padded], { type: mimeType });
  const url = URL.createObjectURL(audioBlob);
  const estimatedDuration = text.length * 0.05;

  return {
    name: `${fileBaseName}${ext}`,
    url,
    speed,
    estimatedDuration,
    backend: de ? 'qwen-local' : 'kokoro-local',
  };
}

/**
 * Append ~150 ms of digital silence to the end of an audio buffer.
 *
 * For WAV: parses the RIFF header, computes silence sample count from the
 * fmt chunk's sample rate + channels + bits-per-sample, appends zero bytes to
 * the data chunk, and rewrites the RIFF + data chunk lengths.
 *
 * For MP3: appending raw zero bytes is a no-op for most MP3 decoders (they
 * stop at the last valid frame). We use the Web Audio API decode → encode
 * path only if absolutely needed; for the common case we return the buffer
 * unchanged, since the encoder-padding clip is much less pronounced on MP3.
 */
function appendTailSilence(buffer: ArrayBuffer, format: 'wav' | 'mp3'): ArrayBuffer {
  if (format !== 'wav') return buffer;
  try {
    const view = new DataView(buffer);
    // RIFF header: "RIFF" + size + "WAVE"
    if (view.getUint32(0, false) !== 0x52494646 /* 'RIFF' */) return buffer;
    if (view.getUint32(8, false) !== 0x57415645 /* 'WAVE' */) return buffer;

    // Walk chunks to find fmt and data
    let pos = 12;
    let sampleRate = 24000;
    let channels = 1;
    let bitsPerSample = 16;
    let dataOffset = -1;
    let dataSize = 0;
    while (pos + 8 <= buffer.byteLength) {
      const chunkId = view.getUint32(pos, false);
      const chunkSize = view.getUint32(pos + 4, true);
      if (chunkId === 0x666d7420 /* 'fmt ' */) {
        channels = view.getUint16(pos + 10, true);
        sampleRate = view.getUint32(pos + 12, true);
        bitsPerSample = view.getUint16(pos + 22, true);
      } else if (chunkId === 0x64617461 /* 'data' */) {
        dataOffset = pos + 8;
        dataSize = chunkSize;
        break;
      }
      pos += 8 + chunkSize + (chunkSize % 2);
    }
    if (dataOffset < 0) return buffer;

    const silenceSamples = Math.round(0.15 * sampleRate);
    const bytesPerSample = (bitsPerSample / 8) * channels;
    const silenceBytes = silenceSamples * bytesPerSample;

    const out = new ArrayBuffer(buffer.byteLength + silenceBytes);
    new Uint8Array(out).set(new Uint8Array(buffer), 0);
    // Silence is already zero-init from ArrayBuffer.

    const outView = new DataView(out);
    // RIFF total size = file size - 8
    outView.setUint32(4, buffer.byteLength + silenceBytes - 8, true);
    // data chunk size
    outView.setUint32(dataOffset - 4, dataSize + silenceBytes, true);
    return out;
  } catch (e) {
    console.warn('[Local Mode TTS] tail silence append failed:', e);
    return buffer;
  }
}
