// client/src/services/audio/stt/selfHostedSTT.ts
// Self-hosted STT on GEX130 (api.agoracosmica.org)
// Server runs Whisper large-v3-turbo via speaches container

import { fetchWithTimeout } from '../../../utils/fetchWithTimeout';

// In dev, empty base → requests go through Vite proxy (avoids mixed-content + COEP)
// In prod, empty base → requests go through CF Worker proxy (adds auth server-side)
const AUDIO_API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_AUDIO_API_URL || '');

interface SelfHostedSTTResult {
  text: string;
  metadata: {
    provider: string;
    model: string;
    language?: string;
    duration?: number;
    segments?: number;
  };
}

/**
 * Self-hosted STT via GEX130 gateway
 * OpenAI-compatible endpoint, no API key required (Cloudflare-protected)
 */
export const selfHostedSTT = async (audioBlob: Blob, language?: string): Promise<SelfHostedSTTResult> => {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    if (language) {
      const langCode = language.toLowerCase().startsWith('de') ? 'de' : 'en';
      formData.append('language', langCode);
    }
    formData.append('response_format', 'verbose_json');

    const response = await fetchWithTimeout(`${AUDIO_API_BASE}/v1/audio/transcriptions`, {
      method: 'POST',
      body: formData,
      timeoutMs: 30_000,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error((errorData as any).error || `STT failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.text) {
      throw new Error('No transcription text in response');
    }

    return {
      text: data.text,
      metadata: {
        provider: 'self-hosted',
        model: 'whisper-1',
        language: data.language,
        duration: data.duration,
        segments: data.segments?.length
      }
    };

  } catch (error) {
    console.error('[Self-hosted STT] Error:', error);
    throw error;
  }
};
