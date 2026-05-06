// src/services/audio/tts/index.ts
// TTS routing: All audio self-hosted on GEX130
// Circuit breaker: after 3 consecutive failures, skip TTS for 60s (text-only fallback)

import { TTS_SERVICES } from '../config/serviceConfig';
import { selfHostedTTS } from './selfHostedTTS';

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
  service: string = TTS_SERVICES.SELF_HOSTED,
  speed: number | string = 1.0,
  language: string = 'en',
  sessionId?: string,
  signal?: AbortSignal,
): Promise<AudioFile> => {
  // Circuit breaker: skip TTS if server is down (text-only fallback)
  if (isCircuitOpen()) {
    throw new Error('TTS circuit breaker open — text-only mode');
  }

  const validatedSpeed = validateSpeed(speed);
  const fileBaseName = typeof responseIndex === 'string' ? responseIndex : String(responseIndex);

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
