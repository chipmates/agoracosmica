// client/src/stores/slices/languageSlice.ts
//
// Language management slice for Zustand
// Replaces LanguageContext with Zustand state management

import { LANGUAGE_CODES, LanguageCode } from '../../constants/languages';
import type { Language, Translation } from '../../types/global';
import { LocalStorageAdapter } from '../../storage/localAdapter';

// ============================================================================
// TYPES
// ============================================================================

export interface LanguageSliceState {
  language: {
    current: Language;
    uiTranslations: Translation;
    seedTitlesTranslations: Translation;
    helpersTranslations: Translation;
    isLoading: boolean;
    error: string | null;
  };
}

export interface LanguageSliceActions {
  setLanguage: (lang: string) => Promise<void>;
  loadTranslations: (lang: Language) => Promise<void>;
  isLanguageSupported: (lang: string | null | undefined) => boolean;
  getSupportedLanguages: () => string[];
  getSeedTitle: (figureId: string, seedId: string | number) => string | null;
  initializeLanguage: () => Promise<void>;
}

export type LanguageSlice = LanguageSliceState & LanguageSliceActions;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Detect browser language preference
 * Priority: 1) Saved preference, 2) Browser language, 3) Default to English
 */
const detectBrowserLanguage = (): Language => {
  // Check for saved preference first
  const savedLanguage = LocalStorageAdapter.getString('selectedLanguage');
  if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'de')) {
    return savedLanguage as Language;
  }

  // Get browser language
  const browserLang = navigator.language || 'en';

  // Check if it's a German variant (de, de-DE, de-AT, de-CH, etc.)
  if (browserLang.toLowerCase().startsWith('de')) {
    return 'de';
  }

  // Default to English for all other languages
  return 'en';
};

/**
 * One-time cleanup of deprecated storage keys (GDPR compliance)
 */
const cleanupDeprecatedKeys = (): void => {
  try {
    const hasLoadedBefore = LocalStorageAdapter.getString('hasLoadedBefore');
    if (hasLoadedBefore !== null) {
      LocalStorageAdapter.remove('hasLoadedBefore');
    }
  } catch {
    // Silent cleanup failure - not critical
  }
};

// ============================================================================
// SLICE CREATOR
// ============================================================================

export const createLanguageSlice = (
  set: any,
  get: any
): LanguageSlice => ({
  // ============================================================================
  // STATE
  // ============================================================================
  language: {
    current: 'en', // Will be initialized properly via initializeLanguage()
    uiTranslations: {},
    seedTitlesTranslations: {},
    helpersTranslations: {},
    isLoading: false,
    error: null,
  },

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Initialize language on app startup
   * Detects browser language and loads translations
   */
  initializeLanguage: async () => {
    // One-time cleanup
    cleanupDeprecatedKeys();

    // Detect initial language (browser or saved preference)
    const initialLanguage = detectBrowserLanguage();

    // Persist so future hydrations don't override with stale data
    LocalStorageAdapter.setString('selectedLanguage', initialLanguage);

    // Update state with initial language (synchronously)
    set((state: any) => ({
      language: {
        ...state.language,
        current: initialLanguage,
        isLoading: true,
      },
    }));

    // Load translations for initial language
    await get().loadTranslations(initialLanguage);
  },

  /**
   * Set language and load translations
   * Validates language code before setting
   */
  setLanguage: async (lang: string) => {
    const lowerLang = lang.toLowerCase();

    // Validate language code
    if (!LANGUAGE_CODES[lowerLang as LanguageCode]) {
      console.warn(`[Language] Attempted to set invalid language: ${lang}`);
      return;
    }

    const newLanguage = lowerLang as Language;
    const currentLanguage = get().language.current;

    // Skip if already set to this language
    if (currentLanguage === newLanguage) {
      return;
    }

    // Update language state (persist middleware handles storage automatically)
    set((state: any) => ({
      language: {
        ...state.language,
        current: newLanguage,
        isLoading: true,
        error: null,
      },
    }));

    // CRITICAL: Also update legacy localStorage key for backward compatibility
    // detectBrowserLanguage() checks this key first on startup
    LocalStorageAdapter.setString('selectedLanguage', newLanguage);

    // Load new translations
    await get().loadTranslations(newLanguage);
  },

  /**
   * Load translations for a specific language
   * Loads UI, constellations, seed titles, and helpers translations
   */
  loadTranslations: async (lang: Language) => {
    try {
      // Load all translation files in parallel
      const [uiTranslations, constellationsTranslations, seedTitlesTranslations, helpersTranslations] = await Promise.all([
        import(`../../assets/translations/ui-${lang}.json`),
        import(`../../assets/translations/constellations/${lang}.json`).catch(() => ({ default: {} })),
        import(`../../assets/translations/seedsdata/ui-${lang}.json`).catch(() => ({ default: {} })),
        import(`../../assets/translations/helpers/${lang}.json`).catch(() => ({ default: {} }))
      ]);

      // Merge UI translations (ui + constellations)
      const mergedUiTranslations = {
        ...(uiTranslations.default || uiTranslations),
        ...(constellationsTranslations.default || constellationsTranslations)
      };

      // Update state with loaded translations
      set((state: any) => ({
        language: {
          ...state.language,
          current: lang,
          uiTranslations: mergedUiTranslations,
          seedTitlesTranslations: seedTitlesTranslations.default || seedTitlesTranslations,
          helpersTranslations: helpersTranslations.default || helpersTranslations,
          isLoading: false,
          error: null,
        },
      }));

      // Initialize seeds cache with new language
      const { initializeSeedsCache } = await import('../../services/seedCacheInitializer');
      await initializeSeedsCache(lang);

      // Track last applied language
      if (lang !== LocalStorageAdapter.getString('lastAppliedLanguage')) {
        LocalStorageAdapter.setString('lastAppliedLanguage', lang);
      }

    } catch (error) {
      console.error(`[Language] Failed to load translations for ${lang}:`, error);

      // Fall back to English if not already trying English
      if (lang !== 'en') {

        try {
          const [fallbackUiTranslations, fallbackConstellationsTranslations, fallbackSeedTitlesTranslations, fallbackHelpersTranslations] = await Promise.all([
            import('../../assets/translations/ui-en.json'),
            import('../../assets/translations/constellations/en.json').catch(() => ({ default: {} })),
            import('../../assets/translations/seedsdata/ui-en.json').catch(() => ({ default: {} })),
            import('../../assets/translations/helpers/en.json').catch(() => ({ default: {} }))
          ]);

          const mergedFallbackTranslations = {
            ...(fallbackUiTranslations.default || fallbackUiTranslations),
            ...(fallbackConstellationsTranslations.default || fallbackConstellationsTranslations)
          };

          set((state: any) => ({
            language: {
              ...state.language,
              uiTranslations: mergedFallbackTranslations,
              seedTitlesTranslations: fallbackSeedTitlesTranslations.default || fallbackSeedTitlesTranslations,
              helpersTranslations: fallbackHelpersTranslations.default || fallbackHelpersTranslations,
              isLoading: false,
              error: `Failed to load ${lang} translations, fell back to English`,
            },
          }));

        } catch (fallbackError) {
          console.error('[Language] Failed to load fallback English translations:', fallbackError);

          set((state: any) => ({
            language: {
              ...state.language,
              uiTranslations: {},
              seedTitlesTranslations: {},
              helpersTranslations: {},
              isLoading: false,
              error: 'Failed to load translations',
            },
          }));
        }
      } else {
        // Already trying English and failed - no fallback available
        set((state: any) => ({
          language: {
            ...state.language,
            isLoading: false,
            error: 'Failed to load English translations',
          },
        }));
      }
    }
  },

  /**
   * Check if a language code is supported
   */
  isLanguageSupported: (lang: string | null | undefined): boolean => {
    if (!lang) return false;
    return Boolean(LANGUAGE_CODES[lang.toLowerCase() as LanguageCode]);
  },

  /**
   * Get list of all supported languages
   */
  getSupportedLanguages: (): string[] => {
    return Object.keys(LANGUAGE_CODES);
  },

  /**
   * Get translated seed title for a specific figure and seed
   *
   * @param figureId - Figure identifier (e.g., "laozi", "vinci")
   * @param seedId - Seed identifier (number or string)
   * @returns Translated seed title or null if not found
   */
  getSeedTitle: (figureId: string, seedId: string | number): string | null => {
    const { seedTitlesTranslations } = get().language;

    if (!seedTitlesTranslations || !figureId) return null;

    // Normalize figureId - strip "Echo of " prefix and get the last name
    let normalizedFigureId = figureId.toLowerCase()
      .replace(/^echo of /i, '')
      .replace(/^echo von /i, '')
      .replace(/^echo de /i, '')
      .trim();
    // Special case: "Martin Luther King Jr." → "king" (not "jr")
    if (normalizedFigureId.includes('king')) {
      normalizedFigureId = 'king';
    } else if (normalizedFigureId.includes('mark aurel') || normalizedFigureId.includes('marc aurel')) {
      // German exonym: last-word split would yield "aurel"
      normalizedFigureId = 'aurelius';
    } else {
      normalizedFigureId = normalizedFigureId.split(' ').pop() || normalizedFigureId;
    }

    if (!normalizedFigureId) return null;

    // Try to get the translation for this figure and seed ID
    const figureTranslations = seedTitlesTranslations[normalizedFigureId];
    if (typeof figureTranslations === 'object' && figureTranslations !== null) {
      const seedTranslation = (figureTranslations as Translation)[seedId.toString()];
      return typeof seedTranslation === 'string' ? seedTranslation : null;
    }

    return null;
  },
});
