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
// Utility Functions
// ============================================

/**
 * Validates audio blob before processing
 */
export const validateAudioBlob = (blob: Blob): boolean => {
  if (!blob) {
    throw new Error('No audio blob provided');
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

