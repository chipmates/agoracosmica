/**
 * Voice Resolver - 2026 Self-Hosted Architecture
 *
 * Language-based voice resolution:
 * - German language → German voices (Qwen3-TTS / F5-TTS)
 * - English language → English voices (Kokoro)
 *
 * Two modes:
 * 1. NORMAL: User's selected voice for figure's gender
 * 2. COUNCIL: Fixed rotation for speaker variety
 */

import {
  type GermanVoice, type EnglishVoice, type Gender, type EnglishEngine,
  GERMAN_VOICES, ENGLISH_VOICES, QWEN_ENGLISH_VOICES,
  GERMAN_DEFAULTS, ENGLISH_DEFAULTS,
  getGermanTechnicalVoice, getKokoroTechnicalVoice,
  getQwenEnglishTechnicalVoice, getQwenEnglishVoiceId,
  resolveEnglishEngine
} from './voiceDefinitions';
import { useDomainStore } from '../../../stores/domainStore';
import { getFigureGender } from '../../../utils/figureGender';
import { councilLog, councilWarn } from '../../council/logger';
import { loadServiceConfig } from '../config/serviceConfig';
import { EN_VOICE_ENGINE_CHOICE } from '../../../config/features';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface VoiceMapping {
  [figureId: string]: string; // figureName → voiceId
}

// ============================================
// LANGUAGE DETECTION
// ============================================

/**
 * Resolve the active voice language from various formats
 * Returns 'german' or 'english'
 */
function resolveVoiceLanguage(langHint?: string): 'german' | 'english' {
  if (langHint) {
    const lower = langHint.toLowerCase();
    if (lower === 'de' || lower === 'german' || lower === 'deutsch') return 'german';
    if (lower === 'en' || lower === 'english') return 'english';
  }
  // Fall back to store language
  const storeLang = useDomainStore.getState().language?.current;
  if (storeLang === 'de') return 'german';
  return 'english';
}

/**
 * Local Mode runs Kokoro for English, so the whole English path follows it:
 * the greeting comes from the Kokoro clip set that is already on R2 and the
 * live reply from the local container. The stored pick is left alone and takes
 * effect again as soon as Local Mode goes off.
 */
export function isLocalModeEnglishTts(): boolean {
  try {
    return !!loadServiceConfig().localMode?.ttsEnabled;
  } catch {
    return false;
  }
}

/**
 * Which stack renders English for this visitor. Kokoro while the surface is
 * dark, so nothing about the live path moves until the flag flips, and a pick
 * made under an earlier flag state is ignored rather than acted on.
 */
export function getEnglishEngine(): EnglishEngine {
  if (!EN_VOICE_ENGINE_CHOICE) return 'kokoro';
  if (isLocalModeEnglishTts()) return 'kokoro';
  return resolveEnglishEngine(useDomainStore.getState().englishEngine);
}

// ============================================
// NORMAL MODE: User Preference-Based
// ============================================

/**
 * Get voice for normal conversations (user's selected voice)
 *
 * @param figureName - Figure ID (e.g., 'laozi', 'bingen')
 * @param ttsEngine - Legacy param, ignored. Language detected from store.
 * @param councilMapping - Optional council voice mapping (overrides user preferences)
 * @param language - Optional language hint ('en', 'de', 'english', 'german')
 * @param engineOverride - Pins the English stack for a caller that can only
 *                         reach one of them (Local Mode runs Kokoro for EN)
 * @returns Technical voice ID for the server gateway
 */
export function getVoiceForNormalMode(
  figureName: string,
  _ttsEngine: 'openai' | 'kokoro' | string = 'kokoro',
  councilMapping?: VoiceMapping | null,
  language?: string,
  engineOverride?: EnglishEngine
): string {
  // Check if this is a council (custom mapping provided)
  if (councilMapping && councilMapping[figureName]) {
    const voice = councilMapping[figureName];
    councilLog(`🏛️ [VoiceResolver] Using council voice for ${figureName}: ${voice}`);
    return voice;
  }

  // Resolve language
  const voiceLang = resolveVoiceLanguage(language);

  // Normal mode: Use user preference
  const genderResult = getFigureGender(figureName);

  if (genderResult === 'unknown') {
    councilWarn(`⚠️ [VoiceResolver] Unknown gender for ${figureName}, defaulting to male`);
    return getVoiceForGender('male', voiceLang, engineOverride);
  }

  return getVoiceForGender(genderResult as Gender, voiceLang, engineOverride);
}

/**
 * Get technical voice ID for a specific gender based on user preferences + language
 */
function getVoiceForGender(
  gender: Gender,
  language: 'german' | 'english',
  engineOverride?: EnglishEngine
): string {
  const state = useDomainStore.getState();

  if (language === 'german') {
    const prefs = state.german || state.openai;
    const cosmicVoice = prefs[`${gender}Voice`] as GermanVoice;
    return getGermanTechnicalVoice(cosmicVoice);
  }

  // Qwen English is one voice per gender, the same rule the German path uses
  // to reach its cloned cast. Kokoro keeps the per-voice preference.
  if ((engineOverride ?? getEnglishEngine()) === 'qwen') {
    return getQwenEnglishTechnicalVoice(gender);
  }

  const prefs = state.english || state.kokoro;
  const cosmicVoice = prefs[`${gender}Voice`] as EnglishVoice;
  return getKokoroTechnicalVoice(cosmicVoice);
}

/**
 * Check if the user's voice preference matches the default for a figure.
 * Used to decide: pre-created audio (default voice) vs dynamic TTS (custom voice).
 */
export function isUsingDefaultVoice(figureId: string, language?: string): boolean {
  const voiceLang = resolveVoiceLanguage(language);
  const gender = getFigureGender(figureId);

  // Unknown gender → safe default: use pre-created audio
  if (gender === 'unknown') return true;

  const state = useDomainStore.getState();

  if (voiceLang === 'german') {
    const prefs = state.german || state.openai;
    const userVoice = prefs[`${gender}Voice`] as GermanVoice;
    return userVoice === GERMAN_DEFAULTS[gender as 'male' | 'female'];
  }

  // Qwen English has nothing to deviate from: one voice per gender, and the
  // pre-rendered clips were cut with it.
  if (getEnglishEngine() === 'qwen') return true;

  const prefs = state.english || state.kokoro;
  const userVoice = prefs[`${gender}Voice`] as EnglishVoice;
  return userVoice === ENGLISH_DEFAULTS[gender as 'male' | 'female'];
}

// ============================================
// COUNCIL MODE: Fixed Variety
// ============================================

/**
 * Get voices for council (fixed rotation for variety)
 *
 * English councils follow the same engine as everything else: the Qwen cast
 * carries 5 voices per gender, same as Kokoro and the German cast, so a council
 * seats distinct voices either way.
 *
 * @param participants - Array of figure IDs (max 4 total: 1 moderator + 3 participants)
 * @param ttsEngine - Legacy param. Language used instead.
 * @param language - Optional language hint
 * @returns Voice mapping object { figureId: technicalVoiceId }
 */
export function getVoicesForCouncil(
  participants: string[],
  _ttsEngine: 'openai' | 'kokoro' | string = 'kokoro',
  language?: string
): VoiceMapping {
  const voiceLang = resolveVoiceLanguage(language);

  // Separate by gender
  const males = participants.filter(p => getFigureGender(p) === 'male');
  const females = participants.filter(p => getFigureGender(p) === 'female');

  councilLog(`🏛️ [VoiceResolver] Council composition: ${males.length} males, ${females.length} females (${voiceLang})`);

  // Use the full pool of 5 voices per gender. Council size is capped at 4
  // figures, so even an all-same-gender council gets 4 distinct voices with
  // one in reserve.
  const englishQwen = voiceLang === 'english' && getEnglishEngine() === 'qwen';

  const councilVoices: { male: readonly string[]; female: readonly string[] } =
    voiceLang === 'german'
      ? { male: GERMAN_VOICES.male, female: GERMAN_VOICES.female }
      : englishQwen
        ? { male: QWEN_ENGLISH_VOICES.male, female: QWEN_ENGLISH_VOICES.female }
        : { male: ENGLISH_VOICES.male, female: ENGLISH_VOICES.female };

  const getTechnical: (voiceName: string) => string =
    voiceLang === 'german'
      ? getGermanTechnicalVoice
      : englishQwen
        ? getQwenEnglishVoiceId
        : getKokoroTechnicalVoice;

  const mapping: VoiceMapping = {};

  // Assign male voices
  males.forEach((figureId, index) => {
    const voiceIndex = index % councilVoices.male.length;
    const cosmicVoice = councilVoices.male[voiceIndex];
    mapping[figureId] = getTechnical(cosmicVoice);
    councilLog(`🎭 [Council] ${figureId} (male ${index + 1}) → ${cosmicVoice} (${mapping[figureId]})`);
  });

  // Assign female voices
  females.forEach((figureId, index) => {
    const voiceIndex = index % councilVoices.female.length;
    const cosmicVoice = councilVoices.female[voiceIndex];
    mapping[figureId] = getTechnical(cosmicVoice);
    councilLog(`🎭 [Council] ${figureId} (female ${index + 1}) → ${cosmicVoice} (${mapping[figureId]})`);
  });

  councilLog(`✅ [Council] Voice mapping complete:`, mapping);
  return mapping;
}
