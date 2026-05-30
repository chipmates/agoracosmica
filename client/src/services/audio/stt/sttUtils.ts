// src/services/audio/stt/sttUtils.ts

// ============================================
// Type Definitions
// ============================================

export interface TranscriptionResponse {
  text: string;
  metadata: TranscriptionMetadata;
}

export interface TranscriptionMetadata {
  provider: string;
  timestamp: string;
  model?: string;
  language?: string;
  duration?: number;
  confidence?: number;
  segments?: number;
}

// ============================================
// Errors
// ============================================

/**
 * Thrown for a blob that has no decodable audio (empty or header-only). Whisper
 * fails such input at av.open with an EOF error, which surfaces as a 500. We
 * throw this BEFORE any network request so the doomed payload is never sent,
 * and the caller can map it to a friendly "we did not catch that" message.
 */
export class EmptyAudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmptyAudioError';
  }
}

/** Carries the HTTP status so the retry loop can skip non-retryable 4xx. */
export class SttHttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'SttHttpError';
  }
}

/**
 * Minimum byte floor for a decodable audio blob. A 0-byte or header-only blob
 * (no audio frames) makes Whisper fail at av.open with EOFError. This is a
 * heuristic backstop only. The authoritative guard is the recording-duration
 * check in UnifiedInputContainer (a real utterance is never this short), since
 * byte count alone cannot prove decodability. Kept low to never reject real
 * short speech.
 */
export const MIN_AUDIO_BYTES = 512;

// ============================================
// Utility Functions
// ============================================

/**
 * Validates audio blob before processing
 */
export const validateAudioBlob = (blob: Blob): boolean => {
  if (!blob) {
    throw new Error('No audio blob provided');
  }

  // Lower bound: reject empty / header-only blobs that Whisper cannot decode.
  // This is the cross-caller backstop; the recorder enforces a duration floor.
  if (blob.size < MIN_AUDIO_BYTES) {
    throw new EmptyAudioError(`Audio blob too small to decode: ${blob.size} bytes`);
  }

  // Accept base MIME types and codec-suffixed variants (e.g., audio/webm;codecs=opus, audio/mp4)
  const baseType = blob.type.split(';')[0].trim();
  const validBaseTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/ogg'];
  if (!validBaseTypes.includes(baseType)) {
    throw new Error(`Unsupported audio format: ${blob.type}. Supported formats: ${validBaseTypes.join(', ')}`);
  }

  const maxSize = 25 * 1024 * 1024; // 25MB
  if (blob.size > maxSize) {
    throw new Error(`Audio file too large: ${(blob.size / 1024 / 1024).toFixed(2)}MB. Maximum size: 25MB`);
  }

  return true;
};

/**
 * Formats transcription response for consistency across providers
 */
export const formatTranscriptionResponse = (
  response: { text: string; metadata?: Partial<TranscriptionMetadata> },
  provider: string
): TranscriptionResponse => {
  return {
    text: response.text,
    metadata: {
      provider,
      timestamp: new Date().toISOString(),
      ...response.metadata
    }
  };
};

