// client/src/services/audio/stt/localModeSTT.ts
//
// Local Mode STT: routes transcription to the local Whisper container
// (Speaches / faster-whisper). OpenAI-compatible multipart endpoint.

import { fetchWithTimeout } from '../../../utils/fetchWithTimeout';
import { localSttUrl } from '../../../config/runtime';

interface LocalSttResult {
  text: string;
  metadata: {
    provider: string;
    model: string;
    language?: string;
    duration?: number;
    segments?: number;
  };
}

export class LocalModeSttUnavailable extends Error {
  constructor(message: string, public readonly url: string) {
    super(message);
    this.name = 'LocalModeSttUnavailable';
  }
}

/** The local service answered, but heard no words. */
export class LocalModeSttEmpty extends Error {
  constructor(public readonly url: string) {
    super('Local STT heard no words');
    this.name = 'LocalModeSttEmpty';
  }
}

export const localModeSTT = async (
  audioBlob: Blob,
  language?: string,
  urlOverride?: string,
): Promise<LocalSttResult> => {
  const endpoint = (urlOverride?.trim() || localSttUrl).replace(/\/+$/, '');
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  // Speaches accepts any model identifier; the actual model is set at container
  // start via WHISPER__MODEL. Send a sensible default that any OpenAI-compat
  // server recognises.
  formData.append('model', 'whisper-1');
  if (language) {
    const langCode = language.toLowerCase().startsWith('de') ? 'de' : 'en';
    formData.append('language', langCode);
  }
  formData.append('response_format', 'verbose_json');

  let response: Response;
  try {
    response = await fetchWithTimeout(`${endpoint}/v1/audio/transcriptions`, {
      method: 'POST',
      body: formData,
      timeoutMs: 30_000,
    });
  } catch (err) {
    throw new LocalModeSttUnavailable(
      err instanceof Error ? err.message : 'unknown network error',
      endpoint,
    );
  }

  // Any failed or unreadable answer is an outage to the visitor, so the banner
  // names it; an answer with no words gets its own line.
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new LocalModeSttUnavailable(
      `Local STT endpoint returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      endpoint,
    );
  }

  let data: { text?: unknown; language?: string; duration?: number; segments?: unknown[] };
  try {
    data = await response.json();
  } catch {
    throw new LocalModeSttUnavailable('Local STT answer is not JSON', endpoint);
  }
  if (typeof data?.text !== 'string') {
    throw new LocalModeSttUnavailable('Local STT answer has no text field', endpoint);
  }
  if (!data.text.trim()) {
    throw new LocalModeSttEmpty(endpoint);
  }

  return {
    text: data.text,
    metadata: {
      provider: 'local',
      model: 'whisper-local',
      language: data.language,
      duration: data.duration,
      segments: data.segments?.length,
    },
  };
};
