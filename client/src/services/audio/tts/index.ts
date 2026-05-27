// src/services/audio/tts/index.ts
// TTS routing: hosted by default (GEX130 gateway), or Local Mode (Kokoro
// container for EN, Qwen3-TTS container/native for DE) when the user has
// enabled it in settings.
//
// Circuit breaker: after 3 consecutive failures, skip TTS for 60s
// (text-only fallback). Local Mode bypasses the circuit breaker — a single
// user's container is either up or not, no point penalising it for being
// down briefly.

import { TTS_SERVICES, loadServiceConfig } from '../config/serviceConfig';
import { selfHostedTTS } from './selfHostedTTS';
import { localModeTTS, LocalModeTtsUnavailable } from './localModeTTS';

// ============================================
// Type Definitions
// ============================================

export interface AudioFile {
  name: string;
  url: string;
  speed?: number;
  estimatedDuration?: number; // seconds, for buffer-aware scheduling
  backend?: string; // X-TTS-Backend: which engine the gateway routed to (qwen / f5 / kokoro)
  sessionTtlSeconds?: number; // X-TTS-Session-Expires-In: remaining TTL for this session-id's sticky routing
}

// ============================================
// Circuit Breaker (text-only fallback)
// ============================================

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 60_000; // 60 seconds

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

const isCircuitOpen = (): boolean => {
  if (consecutiveFailures < FAILURE_THRESHOLD) return false;
  if (Date.now() > circuitOpenUntil) {
    // Cooldown expired — allow one retry (half-open)
    consecutiveFailures = FAILURE_THRESHOLD - 1;
    return false;
  }
  return true;
};

const recordSuccess = () => {
  consecutiveFailures = 0;
};

const recordFailure = () => {
  consecutiveFailures++;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + COOLDOWN_MS;
    console.warn(`[TTS] Circuit breaker open — skipping TTS for ${COOLDOWN_MS / 1000}s (text-only mode)`);
    // Notify UI so user sees a banner/toast
    window.dispatchEvent(new CustomEvent('circuit-breaker', {
      detail: { service: 'tts', state: 'open', cooldownMs: COOLDOWN_MS }
    }));
  }
};

// ============================================
// Helper Functions
// ============================================

const validateSpeed = (speed: number | string | undefined): number => {
  const parsedSpeed = parseFloat(String(speed));
  if (isNaN(parsedSpeed)) return 1.0;
  return Math.min(Math.max(parsedSpeed, 0.8), 1.3);
};

// ============================================
// Main Export
// ============================================

export const convertTextToSpeech = async (
  text: string,
  responseIndex: number | string,
  figureName: string,
  _service: string = TTS_SERVICES.SELF_HOSTED,
  speed: number | string = 1.0,
  language: string = 'en',
  sessionId?: string,
  signal?: AbortSignal,
): Promise<AudioFile> => {
  const validatedSpeed = validateSpeed(speed);
  const fileBaseName = typeof responseIndex === 'string' ? responseIndex : String(responseIndex);

  // Local Mode: route directly to localhost Kokoro (EN) / Qwen (DE) without
  // touching the hosted gateway. The circuit breaker doesn't apply — single
  // user, local containers, fail fast.
  const config = loadServiceConfig();
  if (config.localMode?.ttsEnabled) {
    try {
      return await localModeTTS(
        text, fileBaseName, figureName, validatedSpeed,
        undefined, undefined, language, signal,
        { kokoroUrl: config.localMode.ttsKokoroURL, qwenUrl: config.localMode.ttsQwenURL },
      );
    } catch (error) {
      // DE local unavailable (no NVIDIA, no Apple Silicon setup script, container
      // crashed): fall back to the hosted DE path. EN local unavailable: also
      // fall back. The user sees a small pill in the UI; conversation continues.
      if (error instanceof LocalModeTtsUnavailable) {
        console.warn(`[TTS] Local Mode unavailable for ${error.language} (${error.url}): ${error.message} — falling back to hosted`);
        window.dispatchEvent(new CustomEvent('local-mode-tts-fallback', {
          detail: { language: error.language, url: error.url, message: error.message }
        }));
        // fall through to hosted path
      } else if (signal?.aborted || (error as Error).name === 'AbortError') {
        throw error;
      } else {
        // Unexpected error from local TTS — surface it.
        throw error;
      }
    }
  }

  // Circuit breaker: skip TTS if server is down (text-only fallback)
  if (isCircuitOpen()) {
    throw new Error('TTS circuit breaker open — text-only mode');
  }

  try {
    const result = await selfHostedTTS(text, fileBaseName, figureName, validatedSpeed, undefined, undefined, language, sessionId, signal);
    recordSuccess();
    return result;
  } catch (error) {
    // 429 = rate limited, server is healthy but protecting GPUs.
    // Don't count toward circuit breaker. The audio-rate-limit event handles UI.
    if ((error as Error & { status?: number }).status === 429) {
      throw error;
    }
    // Caller-initiated abort (LT-12) is not a failure of the service either.
    if (signal?.aborted || (error as Error).name === 'AbortError') {
      throw error;
    }
    recordFailure();
    throw error;
  }
};
