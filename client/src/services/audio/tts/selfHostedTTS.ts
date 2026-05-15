// client/src/services/audio/tts/selfHostedTTS.ts
// Self-hosted TTS on GEX130 (api.agoracosmica.org)
// Server handles model selection: Kokoro (EN fast), F5-TTS (DE fast), Qwen3-TTS (DE quality)

import { getVoiceForNormalMode } from '../voices/voiceResolver';
import { fetchWithTimeout } from '../../../utils/fetchWithTimeout';
import type { AudioFile } from './index';
import type { VoiceMapping } from '../voices/voiceResolver';

// In dev, empty base → requests go through Vite proxy (avoids mixed-content + COEP)
// In prod, empty base → requests go through CF Worker proxy (adds auth server-side)
const AUDIO_API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_AUDIO_API_URL || '');

/**
 * iOS WebKit (Safari + Chrome on iOS — both use WebKit) has known issues with
 * `AudioContext.decodeAudioData()` on certain WebM/Opus payloads: requests
 * succeed, blobs arrive intact, but decoding silently rejects or hangs for
 * some segments. Server-Claude confirmed 0 backend errors for the affected
 * window (2026-05-01 03:17–03:47 UTC) — every byte arrived, but iOS could not
 * decode some of them. Falling back to mp3 on iOS bypasses the Opus decode
 * path entirely. Cost: ~11× larger payloads on iOS (acceptable trade for
 * reliable playback through launch).
 *
 * Cached at module load — UA doesn't change at runtime.
 */
const IS_IOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS 13+ identifies as MacIntel with touch
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
) && !(window as any).MSStream;

/**
 * Map language codes to the format the server expects
 */
function resolveLanguageForServer(language?: string): string {
  if (!language) return 'English';
  const lower = language.toLowerCase();
  if (lower === 'de' || lower === 'german' || lower === 'deutsch') return 'German';
  return 'English';
}

/**
 * Self-hosted TTS via GEX130 gateway
 * OpenAI-compatible endpoint, no API key required (Cloudflare-protected)
 * Returns WebM/Opus for bandwidth savings (~11x smaller than mp3)
 */
export async function selfHostedTTS(
  text: string,
  fileBaseName: string,
  figureName: string,
  speed: number = 1.0,
  explicitVoice?: string,
  councilMapping?: VoiceMapping,
  language?: string,
  sessionId?: string,
  signal?: AbortSignal,
): Promise<AudioFile> {
  const voiceId = explicitVoice || getVoiceForNormalMode(figureName, 'kokoro', councilMapping, language);
  const serverLanguage = resolveLanguageForServer(language);

  try {
    const requestBody = {
      input: text,
      voice: voiceId,
      language: serverLanguage,
      // iOS WebKit can't reliably decode WebM/Opus via Web Audio — see IS_IOS comment.
      // Existing response-handling further down already adapts to mp3 vs webm by
      // sniffing Content-Type, so no other changes needed downstream.
      response_format: IS_IOS ? 'mp3' : 'webm',
      speed: speed
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionId) {
      // Gateway uses this for session-sticky Qwen3-TTS / F5-TTS routing (DE).
      // EN passthrough (Kokoro) ignores the header. Old gateway: unknown header, no-op.
      headers['X-Session-Id'] = sessionId;
    }

    const response = await fetchWithTimeout(`${AUDIO_API_BASE}/v1/audio/speech`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      timeoutMs: 15_000,
      signal,
    });

    if (!response.ok) {
      // Over-limit DE input → structured 400 from gateway. Production's
      // TextChunker keeps chunks well under the 500-char cap, so reaching
      // this branch means a caller bypassed the chunker (pre-render script,
      // misuse). Surface the char counts so the log points straight at the fix.
      if (response.status === 400) {
        let data: Record<string, unknown> = {};
        try { data = await response.json() as Record<string, unknown>; } catch { /* ignore */ }
        if (data.error === 'input_too_long') {
          const err = new Error(
            `TTS input too long (${data.inputChars} chars, max ${data.maxChars}). Chunk client-side before calling.`,
          );
          (err as Error & { status: number; code: string; maxChars?: number }).status = 400;
          (err as Error & { status: number; code: string; maxChars?: number }).code = 'input_too_long';
          (err as Error & { status: number; code: string; maxChars?: number }).maxChars = data.maxChars as number;
          console.error('[Self-hosted TTS]', err.message);
          throw err;
        }
      }

      // Rate limit: parse hint for degradation ladder UI
      if (response.status === 429) {
        let rateLimitData: Record<string, unknown> = {};
        try { rateLimitData = await response.json() as Record<string, unknown>; } catch { /* ignore */ }

        window.dispatchEvent(new CustomEvent('audio-rate-limit', {
          detail: {
            hint: rateLimitData.hint || 'rate_limited',
            message: rateLimitData.error || 'Audio rate limited',
            code: rateLimitData.code,
            gpuLoad: (rateLimitData.quota as Record<string, unknown>)?.gpuLoad,
          }
        }));

        const err = new Error((rateLimitData.error as string) || 'Audio rate limited');
        (err as Error & { status: number; hint: string }).status = 429;
        (err as Error & { status: number; hint: string }).hint = (rateLimitData.hint as string) || 'rate_limited';
        throw err;
      }

      const errorText = await response.text();
      console.error('[Self-hosted TTS] API error:', response.status, errorText);
      throw new Error(`Self-hosted TTS failed: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // Capture server metadata for scheduling + diagnostics
    const xModel = response.headers.get('X-Model') || undefined;
    const xInferenceMs = response.headers.get('X-Inference-Ms');
    const xTotalMs = response.headers.get('X-Total-Ms');
    const xBackend = response.headers.get('X-TTS-Backend') || undefined;
    const xSessionTtlRaw = response.headers.get('X-TTS-Session-Expires-In');
    const xSessionTtlSeconds = xSessionTtlRaw ? parseInt(xSessionTtlRaw, 10) : undefined;

    if (import.meta.env.DEV && xModel) {
      console.log(
        `[Self-hosted TTS] ${xModel}${xBackend ? ` (${xBackend})` : ''}: ${xInferenceMs}ms inference, ${xTotalMs}ms total`
      );
    }

    // Fire-and-forget signal for analytics / distribution monitoring. Consumers
    // hook window-level listener; absent backend header => old gateway, skip.
    if (xBackend && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tts-backend-selected', {
        detail: { backend: xBackend, figure: figureName, language: serverLanguage }
      }));
    }

    // Estimate audio duration from text length (~0.05s per char for German)
    const estimatedDuration = text.length * 0.05;

    // Detect content type from response
    const contentType = response.headers.get('content-type') || 'audio/webm';
    const isWebm = contentType.includes('webm') || contentType.includes('opus') || contentType.includes('ogg');
    const ext = isWebm ? '.webm' : '.mp3';
    const mimeType = isWebm ? 'audio/webm;codecs=opus' : 'audio/mpeg';

    const audioBlob = new Blob([arrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(audioBlob);

    return {
      name: `${fileBaseName}${ext}`,
      url,
      speed,
      estimatedDuration,
      backend: xBackend,
      sessionTtlSeconds: xSessionTtlSeconds
    };

  } catch (error) {
    console.error('[Self-hosted TTS] Error:', error);
    throw error;
  }
}
