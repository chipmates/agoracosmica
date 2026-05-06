// Language constants - single source of truth
// Replaces the old stories-manifest.js LANGUAGE_CODES

/**
 * Language code to display name mapping
 */
export const LANGUAGE_CODES = {
  en: 'English',
  de: 'German',
  es: 'Spanish',
  zh: 'Chinese',
  fr: 'French',
  ar: 'Arabic',
  pt: 'Portuguese',
  ru: 'Russian',
  ja: 'Japanese',
  it: 'Italian',
  tr: 'Turkish',
  bg: 'Bulgarian'
} as const;

/**
 * Type for valid language codes
 */
export type LanguageCode = keyof typeof LANGUAGE_CODES;

/**
 * Type for language display names
 */
export type LanguageDisplayName = typeof LANGUAGE_CODES[LanguageCode];

/**
 * Languages that have pre-recorded audio stories (WebM format)
 */
export const AUDIO_SUPPORTED_LANGUAGES: readonly LanguageCode[] = ['en', 'de'] as const;

/**
 * Type for audio-supported languages
 */
export type AudioSupportedLanguage = typeof AUDIO_SUPPORTED_LANGUAGES[number];

/**
 * Default language for the application
 */
export const DEFAULT_LANGUAGE: LanguageCode = 'en';

/**
 * Helper to check if a language has audio support
 * @param language - Language code to check
 * @returns True if the language has audio support
 */
export const hasAudioSupport = (language: string): language is AudioSupportedLanguage => {
  return (AUDIO_SUPPORTED_LANGUAGES as readonly string[]).includes(language);
};

/**
 * Helper to get language display name
 * @param code - Language code
 * @returns Display name for the language or the code itself if not found
 */
export const getLanguageDisplayName = (code: string): string => {
  return LANGUAGE_CODES[code as LanguageCode] || code;
};