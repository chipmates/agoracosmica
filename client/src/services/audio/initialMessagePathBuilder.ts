/**
 * Initial Message Path Builder
 *
 * Builds paths for pre-created initial messages stored in Cloudflare R2.
 * Follows same pattern as story audio for consistency.
 *
 * Path pattern: initial-messages/{figure}/{lang}/{mode}/{file}.webm
 *
 * Created: October 16, 2025
 */

export type ConversationMode = 'wisdom' | 'freetalk' | 'quest';
export type SupportedLanguage = 'en' | 'de';

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['en', 'de'];

function sanitizeFigureId(figure: string): string {
  // Only allow lowercase alphanumeric characters (valid figure IDs are like 'plato', 'laozi', 'vinci')
  if (!/^[a-z]+$/.test(figure)) {
    throw new Error(`Invalid figure ID: ${figure}`);
  }
  return figure;
}

export const initialMessagePathBuilder = {
  /**
   * Build initial message audio path
   *
   * @param figure - Figure ID (e.g., 'plato', 'laozi')
   * @param mode - Conversation mode
   * @param seedId - Seed ID (1-12) for wisdom/quest, null for freetalk
   * @param language - Language code (en/de)
   * @returns Path relative to media base URL
   *
   * @example
   * getAudioPath('plato', 'wisdom', 1, 'en')
   * // → 'initial-messages/plato/en/wisdom/seed_01.webm'
   *
   * @example
   * getAudioPath('laozi', 'freetalk', null, 'de')
   * // → 'initial-messages/laozi/de/freetalk/greeting.webm'
   */
  getAudioPath(
    figure: string,
    mode: ConversationMode,
    seedId: number | null,
    language: SupportedLanguage = 'en'
  ): string {
    // Build filename based on mode
    const filename = mode === 'freetalk'
      ? 'greeting.webm'
      : `seed_${String(seedId).padStart(2, '0')}.webm`;

    // Path pattern: initial-messages/{figure}/{lang}/{mode}/{file}.webm
    return `initial-messages/${sanitizeFigureId(figure)}/${language}/${mode}/${filename}`;
  },

  /**
   * Build initial message text path
   *
   * Same as audio path but with .txt extension
   * Text files are in docs folder locally, will be in Cloudflare for production
   *
   * @param figure - Figure ID
   * @param mode - Conversation mode
   * @param seedId - Seed ID (null for freetalk)
   * @param language - Language code
   * @returns Path to .txt file
   */
  getTextPath(
    figure: string,
    mode: ConversationMode,
    seedId: number | null,
    language: SupportedLanguage = 'en'
  ): string {
    const filename = mode === 'freetalk'
      ? 'greeting.txt'
      : `seed_${String(seedId).padStart(2, '0')}.txt`;

    // Same pattern as audio, just .txt instead of .webm
    return `initial-messages/${sanitizeFigureId(figure)}/${language}/${mode}/${filename}`;
  },

  /**
   * Get path with language fallback
   *
   * Tries preferred language first, falls back to English if not found.
   * For MVP, we assume all files exist in both languages.
   *
   * @param figure - Figure ID
   * @param mode - Conversation mode
   * @param seedId - Seed ID (null for freetalk)
   * @param preferredLanguage - User's preferred language
   * @returns Path and resolved language
   *
   * @example
   * getPathWithFallback('plato', 'wisdom', 1, 'de')
   * // → { path: 'initial-messages/plato/de/wisdom/seed_01.webm', language: 'de' }
   */
  getPathWithFallback(
    figure: string,
    mode: ConversationMode,
    seedId: number | null,
    preferredLanguage: SupportedLanguage
  ): { path: string; language: SupportedLanguage } {
    // For MVP: All files exist in both EN and DE
    // In future, could add HEAD request to check existence
    const path = this.getAudioPath(figure, mode, seedId, preferredLanguage);

    return {
      path,
      language: preferredLanguage
    };
  },

  /**
   * Check if initial message exists for this combination
   *
   * Used to decide: use pre-created message vs generate with LLM
   *
   * @param figure - Figure ID
   * @param mode - Conversation mode
   * @param seedId - Seed ID (null for freetalk)
   * @returns true if initial message exists
   *
   * @example
   * hasInitialMessage('plato', 'wisdom', 1) // → true
   * hasInitialMessage('plato', 'wisdom', 99) // → false (only 1-12)
   * hasInitialMessage('plato', 'freetalk', null) // → true
   */
  hasInitialMessage(
    _figure: string,
    mode: ConversationMode,
    seedId: number | null
  ): boolean {
    // FreeTalk: All 30 figures have greeting
    if (mode === 'freetalk') {
      return true;
    }

    // Wisdom and Quest: All figures have seeds 1-12
    if (seedId === null) {
      return false; // Wisdom/Quest require seedId
    }

    // Valid seed range: 1-12
    return seedId >= 1 && seedId <= 12;
  },

  /**
   * Get all supported languages
   *
   * @returns Array of supported language codes
   */
  getSupportedLanguages(): readonly SupportedLanguage[] {
    return SUPPORTED_LANGUAGES;
  },

  /**
   * Validate language code
   *
   * @param language - Language code to validate
   * @returns true if language is supported
   */
  isLanguageSupported(language: string): language is SupportedLanguage {
    return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage);
  }
};

/**
 * Type guard for conversation mode
 */
export function isConversationMode(value: string): value is ConversationMode {
  return ['wisdom', 'freetalk', 'quest'].includes(value);
}

/**
 * Type guard for supported language
 */
export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}
