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

export const localModeSTT = async (audioBlob: Blob, language?: string): Promise<LocalSttResult> => {
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
    response = await fetchWithTimeout(`${localSttUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      body: formData,
      timeoutMs: 30_000,
    });
  } catch (err) {
    throw new LocalModeSttUnavailable(
      err instanceof Error ? err.message : 'unknown network error',
      localSttUrl,
    );
  }

  if (!response.ok) {
    if (response.status === 404 || response.status === 503) {
      throw new LocalModeSttUnavailable(
        `Local STT endpoint returned ${response.status}`,
        localSttUrl,
      );
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as any).error || `Local STT failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data.text) {
    throw new Error('No transcription text in response');
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
