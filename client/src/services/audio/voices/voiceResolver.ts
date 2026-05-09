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
  type GermanVoice, type EnglishVoice, type Gender,
  GERMAN_VOICES, ENGLISH_VOICES,
  GERMAN_DEFAULTS, ENGLISH_DEFAULTS,
  getGermanTechnicalVoice, getKokoroTechnicalVoice
} from './voiceDefinitions';
import { useDomainStore } from '../../../stores/domainStore';
import { getFigureGender } from '../../../utils/figureGender';
import { councilLog, councilWarn } from '../../council/logger';

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
 * @returns Technical voice ID for the server gateway
 */
export function getVoiceForNormalMode(
  figureName: string,
  _ttsEngine: 'openai' | 'kokoro' | string = 'kokoro',
  councilMapping?: VoiceMapping | null,
  language?: string
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
    return getVoiceForGender('male', voiceLang);
  }

  return getVoiceForGender(genderResult as Gender, voiceLang);
}

/**
 * Get technical voice ID for a specific gender based on user preferences + language
 */
function getVoiceForGender(gender: Gender, language: 'german' | 'english'): string {
  const state = useDomainStore.getState();

  if (language === 'german') {
    const prefs = state.german || state.openai;
    const cosmicVoice = prefs[`${gender}Voice`] as GermanVoice;
    return getGermanTechnicalVoice(cosmicVoice);
  } else {
    const prefs = state.english || state.kokoro;
    const cosmicVoice = prefs[`${gender}Voice`] as EnglishVoice;
    return getKokoroTechnicalVoice(cosmicVoice);
  }
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
  } else {
    const prefs = state.english || state.kokoro;
    const userVoice = prefs[`${gender}Voice`] as EnglishVoice;
    return userVoice === ENGLISH_DEFAULTS[gender as 'male' | 'female'];
  }
}

// ============================================
// COUNCIL MODE: Fixed Variety
// ============================================

/**
 * Get voices for council (fixed rotation for variety)
 *
 * @param participants - Array of figure IDs (max 6: 3 male + 3 female)
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

  // Get voice arrays (use first 3 for councils — max distinction)
  const councilVoices = voiceLang === 'german'
    ? { male: GERMAN_VOICES.male.slice(0, 3), female: GERMAN_VOICES.female.slice(0, 3) }
    : { male: ENGLISH_VOICES.male.slice(0, 3), female: ENGLISH_VOICES.female.slice(0, 3) };

  const getTechnical = voiceLang === 'german' ? getGermanTechnicalVoice : getKokoroTechnicalVoice;

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
