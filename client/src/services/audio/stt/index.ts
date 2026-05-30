// src/services/audio/stt/index.ts
// STT routing: hosted by default (GEX130 Whisper) or Local Mode (local
// Whisper container, port 8000) when the user has enabled it in settings.
// Circuit breaker: after 3 consecutive failures, disable STT for 60s.

import { STT_SERVICES, loadServiceConfig } from '../config/serviceConfig';
import { selfHostedSTT } from './selfHostedSTT';
import { localModeSTT, LocalModeSttUnavailable } from './localModeSTT';
import { validateAudioBlob, formatTranscriptionResponse, TranscriptionResponse, EmptyAudioError, SttHttpError } from './sttUtils';

// ============================================
// Circuit Breaker
// ============================================

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 60_000;

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

const isCircuitOpen = (): boolean => {
  if (consecutiveFailures < FAILURE_THRESHOLD) return false;
  if (Date.now() > circuitOpenUntil) {
    consecutiveFailures = FAILURE_THRESHOLD - 1;
    return false;
  }
  return true;
};

const recordSuccess = () => { consecutiveFailures = 0; };
const recordFailure = () => {
  consecutiveFailures++;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + COOLDOWN_MS;
    console.warn(`[STT] Circuit breaker open — disabling STT for ${COOLDOWN_MS / 1000}s`);
    // Notify UI so user sees a banner/toast
    window.dispatchEvent(new CustomEvent('circuit-breaker', {
      detail: { service: 'stt', state: 'open', cooldownMs: COOLDOWN_MS }
    }));
  }
};

// ============================================
// Configuration
// ============================================

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// Main Export
// ============================================

export const transcribeAudio = async (
  audioBlob: Blob,
  _service: string = STT_SERVICES.SELF_HOSTED,
  language: string = 'en'
): Promise<TranscriptionResponse> => {
  // validateAudioBlob runs BEFORE the retry loop. An empty / undecodable blob
  // throws EmptyAudioError here and propagates straight out, so the doomed
  // payload is never POSTed (and never re-sent 3x by the loop below). This is
  // the belt to the recorder's duration-guard suspenders.
  try {
    validateAudioBlob(audioBlob);
  } catch (err) {
    if (import.meta.env.DEV && err instanceof EmptyAudioError) {
      // Dev-only, ZDR-safe: metadata only, never audio content.
      window.dispatchEvent(new CustomEvent('stt-debug', {
        detail: { event: 'empty-blob-rejected', size: audioBlob.size, type: audioBlob.type },
      }));
    }
    throw err;
  }

  // Local Mode: route to the local Whisper container, no circuit breaker
  // (single user, fail fast). On unavailable, fall back to hosted.
  const config = loadServiceConfig();
  if (config.localMode?.sttEnabled) {
    try {
      const result = await localModeSTT(audioBlob, language, config.localMode.sttURL);
      return formatTranscriptionResponse(result, 'local');
    } catch (error) {
      if (error instanceof LocalModeSttUnavailable) {
        console.warn(`[STT] Local Mode unavailable (${error.url}): ${error.message} — falling back to hosted`);
        window.dispatchEvent(new CustomEvent('local-mode-stt-fallback', {
          detail: { url: error.url, message: error.message }
        }));
        // fall through to hosted
      } else {
        throw error;
      }
    }
  }

  if (isCircuitOpen()) {
    throw new Error('STT circuit breaker open — speech recognition temporarily unavailable');
  }

  try {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          await sleep(RETRY_DELAY * attempt);
        }

        const result = await selfHostedSTT(audioBlob, language);
        recordSuccess();
        return formatTranscriptionResponse(result, 'self-hosted');

      } catch (error) {
        console.error(`[STT] Attempt ${attempt + 1} failed:`, error);
        lastError = error as Error;
        // Don't retry deterministic client errors (4xx). They fail identically
        // every attempt, so retrying only amplifies load on the fleet. Transient
        // failures (network, timeout, 5xx) keep the existing backoff retry.
        if (error instanceof SttHttpError && error.status >= 400 && error.status < 500) {
          break;
        }
      }
    }

    recordFailure();
    throw lastError;

  } catch (error) {
    console.error('[STT] Transcription failed:', error);
    throw error;
  }
};
