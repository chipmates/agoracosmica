// Audio path building utilities
// Handles convention-based audio file path generation

// Define languages that have audio support - only English and German for now
export const AUDIO_SUPPORTED_LANGUAGES = ['en', 'de'] as const;

export type SupportedLanguage = typeof AUDIO_SUPPORTED_LANGUAGES[number];

// Simple convention-based audio path builder (replaces manifest dependency)
// All figures have seeds 0-12 in both English and German
// Seed 0 = Foreword ("A Note on {Figure}"), Seeds 1-12 = Story episodes
export const audioPathBuilder = {
  // Build the audio path following the convention: stories/{figure}/{lang}/{figure}_{seed}_{lang}.webm
  getAudioPath(figureId: string, seedId: string | number, language: string): string {
    return `stories/${figureId}/${language}/${figureId}_${seedId}_${language}.webm`;
  },

  // Check if a seed exists (all figures have seeds 0-12)
  hasSeed(_figureId: string, seedId: string | number): boolean {
    const seedNum = parseInt(String(seedId));
    return seedNum >= 0 && seedNum <= 12;
  },

  // Check if audio exists for the given parameters
  hasAudio(figureId: string, seedId: string | number, language: string): boolean {
    return this.hasSeed(figureId, seedId) && AUDIO_SUPPORTED_LANGUAGES.includes(language as SupportedLanguage);
  },

  // Get all available seeds for a figure (0-12, foreword + 12 episodes)
  getAvailableSeeds(_figureId: string): number[] {
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  },

  // All figures have a foreword
  hasForeword(_figureId: string): boolean {
    return true;
  }
};

/**
 * Find available audio path with language fallback
 */
export function findAvailableAudioPath(normalizedFigureId: string, seedId: string | number, preferredLanguage: string): {
  audioPath: string | null;
  audioLanguage: string | null;
  error: string | null;
} {
  // Check if this seed exists (seeds 0-12)
  if (!audioPathBuilder.hasSeed(normalizedFigureId, seedId)) {
    return { audioPath: null, audioLanguage: null, error: 'Invalid seed number' };
  }

  // First try the selected language if it's supported
  if (audioPathBuilder.hasAudio(normalizedFigureId, seedId, preferredLanguage)) {
    return {
      audioPath: audioPathBuilder.getAudioPath(normalizedFigureId, seedId, preferredLanguage),
      audioLanguage: preferredLanguage,
      error: null,
    };
  }

  // Fallback: try other supported languages
  for (const fallbackLang of AUDIO_SUPPORTED_LANGUAGES) {
    if (fallbackLang !== preferredLanguage && audioPathBuilder.hasAudio(normalizedFigureId, seedId, fallbackLang)) {
      return {
        audioPath: audioPathBuilder.getAudioPath(normalizedFigureId, seedId, fallbackLang),
        audioLanguage: fallbackLang,
        error: null,
      };
    }
  }

  return { audioPath: null, audioLanguage: null, error: 'No audio available for this story' };
}
