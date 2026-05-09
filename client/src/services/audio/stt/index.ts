// src/services/audio/stt/index.ts
// STT routing: All speech recognition self-hosted on GEX130
// Circuit breaker: after 3 consecutive failures, disable STT for 60s

import { STT_SERVICES } from '../config/serviceConfig';
import { selfHostedSTT } from './selfHostedSTT';
import { validateAudioBlob, formatTranscriptionResponse, TranscriptionResponse } from './sttUtils';

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
  if (isCircuitOpen()) {
    throw new Error('STT circuit breaker open — speech recognition temporarily unavailable');
  }

  try {
    validateAudioBlob(audioBlob);

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
      }
    }

    recordFailure();
    throw lastError;

  } catch (error) {
    console.error('[STT] Transcription failed:', error);
    throw error;
  }
};
