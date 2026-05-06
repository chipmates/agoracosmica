import { LocalStorageAdapter } from './localAdapter';

const SELECTED_LANGUAGE_KEY = 'selectedLanguage';
const SELECTED_MODE_KEY = 'selectedMode';
const SELECTED_SEED_PREFIX = 'selectedSeed_';
const SELECTED_FIGURE_KEY = 'selectedFigure';
const SELECTED_FIGURE_OBJECT_KEY = 'selectedFigureObject';
const SERVICE_CONFIG_KEY = 'serviceConfig';
const MOBILE_AUDIO_CONFIGURED_KEY = 'mobileAudioConfigured';
const HAS_SHOWN_TTS_NOTICE_KEY = 'hasShownMobileTTSNotice';
const TTS_CONFIGURED_KEY = 'ttsConfigured';
const ONBOARDING_COMPLETE_KEY = 'onboardingComplete';
const ONBOARDING_SKIPPED_KEY = 'onboardingSkipped';
const HAS_VISITED_BEFORE_KEY = 'hasVisitedBefore';
const FORCE_ONBOARDING_KEY = 'forceOnboarding';
const USER_NAME_KEY = 'userName';
const USER_EMAIL_KEY = 'userEmail';
const VOICE_PREFERENCES_KEY = 'voicePreferences';

export interface StoredSeed<T = unknown> {
  data: T | null;
}

export interface OnboardingStatus {
  complete: boolean;
  skipped: boolean;
}

export interface ServiceConfigPayload {
  raw: string | null;
}

export interface VoicePreferences {
  // Legacy Kokoro preferences (flat structure for backwards compat)
  femaleVoice?: string; // Kokoro cosmic name (e.g., 'stella', 'luna')
  maleVoice?: string;   // Kokoro cosmic name (e.g., 'orion', 'jupiter')

  // New structured preferences
  openai?: {
    femaleVoice: string; // OpenAI cosmic name (e.g., 'nova', 'alloy', 'shimmer')
    maleVoice: string;   // OpenAI cosmic name (e.g., 'onyx', 'echo', 'ash')
  };
  kokoro?: {
    femaleVoice: string; // Kokoro cosmic name (e.g., 'stella', 'luna')
    maleVoice: string;   // Kokoro cosmic name (e.g., 'orion', 'jupiter')
  };
}

export const preferencesAdapter = {
  getPreferredLanguage(): string {
    return LocalStorageAdapter.getString(SELECTED_LANGUAGE_KEY) ?? 'en';
  },

  setPreferredLanguage(language: string): void {
    LocalStorageAdapter.setString(SELECTED_LANGUAGE_KEY, language);
  },

  getSelectedFigureId(): string | null {
    return LocalStorageAdapter.getString(SELECTED_FIGURE_KEY);
  },

  setSelectedFigureId(figureId: string | null): void {
    if (!figureId) {
      LocalStorageAdapter.remove(SELECTED_FIGURE_KEY);
      return;
    }
    LocalStorageAdapter.setString(SELECTED_FIGURE_KEY, figureId);
  },

  getSelectedFigureObject<T = unknown>(): T | null {
    return LocalStorageAdapter.getJSON<T | null>(SELECTED_FIGURE_OBJECT_KEY, null);
  },

  setSelectedFigureObject<T = unknown>(figure: T | null): void {
    if (!figure) {
      LocalStorageAdapter.remove(SELECTED_FIGURE_OBJECT_KEY);
      return;
    }
    LocalStorageAdapter.setJSON(SELECTED_FIGURE_OBJECT_KEY, figure);
  },

  getSelectedSeed<T = unknown>(figureId: string): T | null {
    if (!figureId) {
      return null;
    }
    return LocalStorageAdapter.getJSON<T | null>(`${SELECTED_SEED_PREFIX}${figureId}`, null);
  },

  setSelectedSeed<T = unknown>(figureId: string, seed: T | null): void {
    const key = `${SELECTED_SEED_PREFIX}${figureId}`;
    if (!figureId) {
      return;
    }

    if (seed) {
      LocalStorageAdapter.setJSON(key, seed);
    } else {
      LocalStorageAdapter.remove(key);
    }
  },

  getSelectedMode(): string | null {
    return LocalStorageAdapter.getString(SELECTED_MODE_KEY);
  },

  setSelectedMode(mode: string | null): void {
    if (!mode) {
      LocalStorageAdapter.remove(SELECTED_MODE_KEY);
      return;
    }
    LocalStorageAdapter.setString(SELECTED_MODE_KEY, mode);
  },

  getOnboardingStatus(): OnboardingStatus {
    const complete = LocalStorageAdapter.getString(ONBOARDING_COMPLETE_KEY) === 'true';
    const skipped = LocalStorageAdapter.getString(ONBOARDING_SKIPPED_KEY) === 'true';
    return { complete, skipped };
  },

  setOnboardingComplete(): void {
    LocalStorageAdapter.setString(ONBOARDING_COMPLETE_KEY, 'true');
    LocalStorageAdapter.remove(ONBOARDING_SKIPPED_KEY);
  },

  setOnboardingSkipped(): void {
    LocalStorageAdapter.setString(ONBOARDING_SKIPPED_KEY, 'true');
    LocalStorageAdapter.remove(ONBOARDING_COMPLETE_KEY);
  },

  resetOnboarding(): void {
    LocalStorageAdapter.remove(ONBOARDING_COMPLETE_KEY);
    LocalStorageAdapter.remove(ONBOARDING_SKIPPED_KEY);
  },

  hasVisitedBefore(): boolean {
    return LocalStorageAdapter.getString(HAS_VISITED_BEFORE_KEY) === 'true';
  },

  markVisited(): void {
    LocalStorageAdapter.setString(HAS_VISITED_BEFORE_KEY, 'true');
  },

  clearVisited(): void {
    LocalStorageAdapter.remove(HAS_VISITED_BEFORE_KEY);
  },

  shouldForceOnboarding(): boolean {
    return LocalStorageAdapter.getString(FORCE_ONBOARDING_KEY) === 'true';
  },

  setForceOnboarding(value: boolean): void {
    if (value) {
      LocalStorageAdapter.setString(FORCE_ONBOARDING_KEY, 'true');
    } else {
      LocalStorageAdapter.remove(FORCE_ONBOARDING_KEY);
    }
  },

  getServiceConfig(): ServiceConfigPayload {
    return { raw: LocalStorageAdapter.getString(SERVICE_CONFIG_KEY) };
  },

  setServiceConfig(config: unknown): void {
    LocalStorageAdapter.setString(SERVICE_CONFIG_KEY, JSON.stringify(config));
  },

  clearServiceConfig(): void {
    LocalStorageAdapter.remove(SERVICE_CONFIG_KEY);
  },

  isMobileAudioConfigured(): boolean {
    return LocalStorageAdapter.getString(MOBILE_AUDIO_CONFIGURED_KEY) === 'true';
  },

  markMobileAudioConfigured(): void {
    LocalStorageAdapter.setString(MOBILE_AUDIO_CONFIGURED_KEY, 'true');
  },

  resetMobileAudioConfig(): void {
    LocalStorageAdapter.remove(MOBILE_AUDIO_CONFIGURED_KEY);
  },

  clearLegacyTtsNotices(): void {
    LocalStorageAdapter.remove(HAS_SHOWN_TTS_NOTICE_KEY);
    LocalStorageAdapter.remove(TTS_CONFIGURED_KEY);
  },

  getVoicePreferences(): VoicePreferences {
    const stored = LocalStorageAdapter.getJSON<VoicePreferences | null>(VOICE_PREFERENCES_KEY, null);

    // Return stored with defaults for missing values
    return {
      // Legacy flat structure (for backwards compat)
      femaleVoice: stored?.femaleVoice || stored?.kokoro?.femaleVoice || 'stella',
      maleVoice: stored?.maleVoice || stored?.kokoro?.maleVoice || 'orion',

      // Structured preferences
      openai: {
        femaleVoice: stored?.openai?.femaleVoice || 'nova',
        maleVoice: stored?.openai?.maleVoice || 'onyx'
      },
      kokoro: {
        femaleVoice: stored?.kokoro?.femaleVoice || stored?.femaleVoice || 'stella',
        maleVoice: stored?.kokoro?.maleVoice || stored?.maleVoice || 'orion'
      }
    };
  },

  setVoicePreferences(prefs: Partial<VoicePreferences>): void {
    const current = LocalStorageAdapter.getJSON<VoicePreferences>(VOICE_PREFERENCES_KEY, {});
    const updated = { ...current, ...prefs };
    LocalStorageAdapter.setJSON(VOICE_PREFERENCES_KEY, updated);
  },

  clearVoicePreferences(): void {
    LocalStorageAdapter.remove(VOICE_PREFERENCES_KEY);
  },
};
