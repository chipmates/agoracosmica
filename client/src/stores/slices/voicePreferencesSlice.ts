// src/stores/slices/voicePreferencesSlice.ts
// Voice Preferences Slice - German and English voice selection

import type { GermanVoice, EnglishVoice } from '../../services/audio/voices/voiceDefinitions';
import { GERMAN_DEFAULTS, ENGLISH_DEFAULTS } from '../../services/audio/voices/voiceDefinitions';

// Legacy type aliases for migration compatibility
import type { OpenAIVoice, KokoroVoice } from '../../services/audio/voices/voiceDefinitions';

/**
 * Voice preferences state structure
 * Uses german/english keys internally, with openai/kokoro aliases for backwards compat
 */
export interface VoicePreferencesState {
  german: {
    maleVoice: GermanVoice;
    femaleVoice: GermanVoice;
  };
  english: {
    maleVoice: EnglishVoice;
    femaleVoice: EnglishVoice;
  };
  // Legacy aliases (point to same data — kept for backwards compat during migration)
  openai: {
    maleVoice: GermanVoice;
    femaleVoice: GermanVoice;
  };
  kokoro: {
    maleVoice: EnglishVoice;
    femaleVoice: EnglishVoice;
  };
}

/**
 * Voice preferences actions
 */
export interface VoicePreferencesActions {
  loadVoicePreferences: () => VoicePreferencesState;
  saveVoicePreferences: (preferences: Partial<VoicePreferencesState>) => void;
  updateGermanPreferences: (maleVoice?: GermanVoice, femaleVoice?: GermanVoice) => void;
  updateEnglishPreferences: (maleVoice?: EnglishVoice, femaleVoice?: EnglishVoice) => void;
  // Legacy aliases
  updateOpenAIPreferences: (maleVoice?: OpenAIVoice, femaleVoice?: OpenAIVoice) => void;
  updateKokoroPreferences: (maleVoice?: KokoroVoice, femaleVoice?: KokoroVoice) => void;
  clearVoicePreferences: () => void;
  getDefaultPreferences: () => VoicePreferencesState;
}

export type VoicePreferencesSlice = VoicePreferencesState & VoicePreferencesActions;

/**
 * Get default voice preferences
 */
const getDefaultPreferencesInternal = (): VoicePreferencesState => {
  const german = {
    maleVoice: GERMAN_DEFAULTS.male,
    femaleVoice: GERMAN_DEFAULTS.female
  };
  const english = {
    maleVoice: ENGLISH_DEFAULTS.male,
    femaleVoice: ENGLISH_DEFAULTS.female
  };
  return {
    german,
    english,
    openai: german,
    kokoro: english
  };
};

/**
 * Validate a German voice name (returns default if invalid/old OpenAI voice)
 */
const isValidGermanVoice = (voice: string): voice is GermanVoice => {
  const valid: string[] = ['lyra', 'astra', 'vega', 'andromeda', 'ceres', 'umbra', 'solaris', 'phoenix', 'hyperion', 'corvus'];
  return valid.includes(voice);
};

const isValidEnglishVoice = (voice: string): voice is EnglishVoice => {
  const valid: string[] = ['stella', 'luna', 'aurora', 'nova', 'celeste', 'orion', 'sirius', 'jupiter', 'saturn', 'mercury'];
  return valid.includes(voice);
};

/**
 * Migrate old OpenAI voice names to new German cosmic names
 * Old: echo→solaris, onyx→umbra, ash→phoenix, nova→lyra, alloy→astra, shimmer→vega
 */
const migrateOpenAIVoice = (oldVoice: string): GermanVoice => {
  const migration: Record<string, GermanVoice> = {
    echo: 'solaris',
    onyx: 'umbra',
    ash: 'phoenix',
    nova: 'lyra',
    alloy: 'astra',
    shimmer: 'vega'
  };
  if (isValidGermanVoice(oldVoice)) return oldVoice;
  return migration[oldVoice] || GERMAN_DEFAULTS.male;
};

/**
 * Bootstrap voice preferences from localStorage on init
 * Handles migration from old openai/kokoro format
 */
const bootstrapVoicePreferences = (): VoicePreferencesState => {
  try {
    if (typeof localStorage === 'undefined') {
      return getDefaultPreferencesInternal();
    }

    const stored = localStorage.getItem('voicePreferences');

    if (!stored) {
      return getDefaultPreferencesInternal();
    }

    const parsed = JSON.parse(stored);

    // Migrate: check for old openai/kokoro keys → new german/english keys
    const rawGerman = parsed.german || parsed.openai;
    const rawEnglish = parsed.english || parsed.kokoro;

    const german = {
      maleVoice: rawGerman?.maleVoice
        ? (isValidGermanVoice(rawGerman.maleVoice) ? rawGerman.maleVoice : migrateOpenAIVoice(rawGerman.maleVoice))
        : GERMAN_DEFAULTS.male,
      femaleVoice: rawGerman?.femaleVoice
        ? (isValidGermanVoice(rawGerman.femaleVoice) ? rawGerman.femaleVoice : migrateOpenAIVoice(rawGerman.femaleVoice))
        : GERMAN_DEFAULTS.female
    };

    const english = {
      maleVoice: rawEnglish?.maleVoice && isValidEnglishVoice(rawEnglish.maleVoice)
        ? rawEnglish.maleVoice
        : ENGLISH_DEFAULTS.male,
      femaleVoice: rawEnglish?.femaleVoice && isValidEnglishVoice(rawEnglish.femaleVoice)
        ? rawEnglish.femaleVoice
        : ENGLISH_DEFAULTS.female
    };

    return { german, english, openai: german, kokoro: english };

  } catch (error) {
    console.error('❌ [VoicePrefs] Error loading preferences:', error);
    return getDefaultPreferencesInternal();
  }
};

/**
 * Create voice preferences slice
 */
export const createVoicePreferencesSlice = (
  set: any,
  get: any
): VoicePreferencesSlice => {
  const initial = bootstrapVoicePreferences();

  return {
    // Initial state
    german: initial.german,
    english: initial.english,
    openai: initial.german,  // Legacy alias
    kokoro: initial.english, // Legacy alias

    // Actions
    loadVoicePreferences: () => {
      const german = get().german;
      const english = get().english;
      return { german, english, openai: german, kokoro: english };
    },

    saveVoicePreferences: (preferences: Partial<VoicePreferencesState>) => {
      const currentGerman = get().german;
      const currentEnglish = get().english;

      // Accept both new (german/english) and old (openai/kokoro) keys
      const newGerman = {
        ...currentGerman,
        ...(preferences.german || preferences.openai)
      };
      const newEnglish = {
        ...currentEnglish,
        ...(preferences.english || preferences.kokoro)
      };

      set(() => ({
        german: newGerman,
        english: newEnglish,
        openai: newGerman,
        kokoro: newEnglish
      }));
    },

    updateGermanPreferences: (maleVoice?: GermanVoice, femaleVoice?: GermanVoice) => {
      if (!maleVoice && !femaleVoice) return;
      const current = get().german;
      const updated = {
        maleVoice: maleVoice ?? current.maleVoice,
        femaleVoice: femaleVoice ?? current.femaleVoice
      };
      get().saveVoicePreferences({ german: updated });
    },

    updateEnglishPreferences: (maleVoice?: EnglishVoice, femaleVoice?: EnglishVoice) => {
      if (!maleVoice && !femaleVoice) return;
      const current = get().english;
      const updated = {
        maleVoice: maleVoice ?? current.maleVoice,
        femaleVoice: femaleVoice ?? current.femaleVoice
      };
      get().saveVoicePreferences({ english: updated });
    },

    // Legacy aliases
    updateOpenAIPreferences: (maleVoice?: OpenAIVoice, femaleVoice?: OpenAIVoice) => {
      get().updateGermanPreferences(maleVoice as GermanVoice, femaleVoice as GermanVoice);
    },

    updateKokoroPreferences: (maleVoice?: KokoroVoice, femaleVoice?: KokoroVoice) => {
      get().updateEnglishPreferences(maleVoice as EnglishVoice, femaleVoice as EnglishVoice);
    },

    clearVoicePreferences: () => {
      const defaults = getDefaultPreferencesInternal();
      set(() => ({
        german: defaults.german,
        english: defaults.english,
        openai: defaults.german,
        kokoro: defaults.english
      }));
    },

    getDefaultPreferences: () => {
      return getDefaultPreferencesInternal();
    }
  };
};
