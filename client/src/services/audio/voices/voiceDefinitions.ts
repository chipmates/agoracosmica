/**
 * Voice Definitions - 2026 Self-Hosted Architecture
 *
 * Two voice sets based on language:
 * - German: 5M + 5F cloned voices via Qwen3-TTS / F5-TTS on GEX130
 * - English: 5M + 5F Kokoro voices (finetuned blends) on GEX130
 *
 * Both served via self-hosted gateway (api.agoracosmica.org)
 * Server auto-selects TTS model based on language + load.
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export type GermanVoice = 'lyra' | 'astra' | 'vega' | 'andromeda' | 'ceres' | 'umbra' | 'solaris' | 'phoenix' | 'hyperion' | 'corvus';
export type EnglishVoice = 'stella' | 'luna' | 'aurora' | 'nova' | 'celeste' | 'orion' | 'sirius' | 'jupiter' | 'saturn' | 'mercury';
export type Gender = 'male' | 'female';

// Legacy type aliases for migration compatibility
export type OpenAIVoice = GermanVoice;
export type KokoroVoice = EnglishVoice;

// ============================================
// GERMAN VOICES (Qwen3-TTS / F5-TTS on GEX130)
// ============================================

/**
 * German voice IDs sent to the server gateway.
 * Server routes to Qwen3-TTS (quality) or F5-TTS (fast) based on load.
 */
export const GERMAN_TECHNICAL_VOICES = {
  // Female voices (5 total, ranked by ChipMates)
  lyra: 'f1_warm_wise_v1',              // #1 — Best overall female
  astra: 'f5_deep_commanding_v2',       // #2 — Authoritative
  vega: 'f1_warm_wise_v2',              // #3 — Wise variant
  andromeda: 'f2_commanding_thinker_v1', // #4 — Intellectual (The Expanse spirit)
  ceres: 'f1_warm_mentor_v2',           // #5 — Warm mentor (Ceres Station)

  // Male voices (5 total, ranked by ChipMates)
  solaris: 'm3_rich_narrator_v3',       // #1 — Best overall male, rich narrator
  umbra: 'm5_rich_baritone_v1',         // #2 — Rich baritone
  phoenix: 'm1_warm_elder_v3',          // #3 — Wise elder
  hyperion: 'm1_warm_elder_v2',         // #4 — Elder variant (Dan Simmons)
  corvus: 'm3_intellectual_v2',         // #5 — Thoughtful, academic (Stephenson)
} as const;

export const GERMAN_VOICES = {
  male: ['solaris', 'umbra', 'phoenix', 'hyperion', 'corvus'] as const,
  female: ['lyra', 'astra', 'vega', 'andromeda', 'ceres'] as const
} as const;

export const GERMAN_VOICE_INFO: Record<GermanVoice, { name: string; gender: Gender; character: string }> = {
  // Female
  lyra: { name: 'Lyra', gender: 'female', character: 'warm-wise' },
  astra: { name: 'Astra', gender: 'female', character: 'commanding' },
  vega: { name: 'Vega', gender: 'female', character: 'wise' },
  andromeda: { name: 'Andromeda', gender: 'female', character: 'intellectual' },
  ceres: { name: 'Ceres', gender: 'female', character: 'nurturing' },
  // Male
  umbra: { name: 'Umbra', gender: 'male', character: 'baritone' },
  solaris: { name: 'Solaris', gender: 'male', character: 'narrator' },
  phoenix: { name: 'Phoenix', gender: 'male', character: 'elder' },
  hyperion: { name: 'Hyperion', gender: 'male', character: 'elder' },
  corvus: { name: 'Corvus', gender: 'male', character: 'intellectual' },
};

export const GERMAN_DEFAULTS = {
  male: 'solaris' as GermanVoice,
  female: 'lyra' as GermanVoice
} as const;

// ============================================
// ENGLISH VOICES (Kokoro on GEX130, finetuned blends)
// ============================================

/**
 * English voice IDs sent to the server gateway.
 * Server routes to Kokoro (~105ms). Blend syntax supported.
 */
export const ENGLISH_TECHNICAL_VOICES = {
  // Female voices (5 total)
  stella: 'af_heart',                      // #1 — Warm and clear
  luna: 'af_bella',                        // #2 — Energetic
  aurora: 'af_nova',                       // #3 — Dynamic
  nova: 'af_aoede(100)+af_heart(50)',      // #4 — Warm, melodic blend
  celeste: 'af_heart(20)+bf_emma(80)',     // #5 — British, elegant blend

  // Male voices (5 total — cross-gender blends for richer tone)
  orion: 'am_michael(75)+af_heart(25)',    // #1 — Best male, clear
  sirius: 'bm_george(75)+af_nicole(25)',   // #2 — British, professional
  jupiter: 'am_liam(75)+af_nicole(25)',    // #3 — American
  saturn: 'bm_lewis(100)+af_nicole(50)',   // #4 — British, storytelling
  mercury: 'am_onyx(75)+af_heart(25)',     // #5 — Deep
} as const;

export const ENGLISH_VOICES = {
  male: ['orion', 'sirius', 'jupiter', 'saturn', 'mercury'] as const,
  female: ['stella', 'luna', 'aurora', 'nova', 'celeste'] as const
} as const;

export const ENGLISH_VOICE_INFO: Record<EnglishVoice, { name: string; gender: Gender; accent: string }> = {
  // Female
  stella: { name: 'Stella', gender: 'female', accent: 'american' },
  luna: { name: 'Luna', gender: 'female', accent: 'american' },
  aurora: { name: 'Aurora', gender: 'female', accent: 'american' },
  nova: { name: 'Nova', gender: 'female', accent: 'american' },
  celeste: { name: 'Celeste', gender: 'female', accent: 'british' },
  // Male
  orion: { name: 'Orion', gender: 'male', accent: 'american' },
  sirius: { name: 'Sirius', gender: 'male', accent: 'british' },
  jupiter: { name: 'Jupiter', gender: 'male', accent: 'american' },
  saturn: { name: 'Saturn', gender: 'male', accent: 'british' },
  mercury: { name: 'Mercury', gender: 'male', accent: 'american' },
};

export const ENGLISH_DEFAULTS = {
  male: 'orion' as EnglishVoice,
  female: 'stella' as EnglishVoice
} as const;

// ============================================
// Legacy aliases (for migration from old openai/kokoro naming)
// ============================================

export const OPENAI_DEFAULTS = GERMAN_DEFAULTS;
export const KOKORO_DEFAULTS = ENGLISH_DEFAULTS;
export const KOKORO_TECHNICAL_VOICES = ENGLISH_TECHNICAL_VOICES;
export const KOKORO_VOICES = ENGLISH_VOICES;
export const KOKORO_VOICE_INFO = ENGLISH_VOICE_INFO;
export const OPENAI_VOICES = GERMAN_VOICES;
export const OPENAI_VOICE_INFO = GERMAN_VOICE_INFO;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get technical Kokoro voice ID from user-friendly name.
 * The English-side counterpart to getGermanTechnicalVoice; still the live
 * resolver used by VoicePanel and voiceResolver.
 */
export function getKokoroTechnicalVoice(voiceName: KokoroVoice | string): string {
  return ENGLISH_TECHNICAL_VOICES[voiceName as EnglishVoice] || ENGLISH_TECHNICAL_VOICES.stella;
}

/**
 * Get technical German voice ID from cosmic name
 */
export function getGermanTechnicalVoice(voiceName: GermanVoice | string): string {
  return GERMAN_TECHNICAL_VOICES[voiceName as GermanVoice] || GERMAN_TECHNICAL_VOICES.solaris;
}

