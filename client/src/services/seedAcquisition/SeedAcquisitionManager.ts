/**
 * SeedAcquisitionManager.js
 * 
 * A module that handles detection of seed acquisition from LLM responses
 * with support for multiple languages, different message formats,
 * and fuzzy matching to ensure robust detection despite variations.
 */

// Use seedCacheInitializer for seed data access
import { getFigureSeedData } from '../seedCacheInitializer';
import seedStateManager from '../SeedStateManager';
import { useDomainStore } from '../../stores/domainStore';

// Language-specific patterns for seed acquisition detection
// Each language has primary patterns (with emoji) and secondary patterns for fallback
const ACQUISITION_PATTERNS = {
  en: {
    primary: [
      /🌟\s*SEED\s*ACQUIRED:\s*(.+?)\s*🌟/i,
      /demonstrated\s*true\s*understanding\s*of\s*(.+?)[\.\s]/i
    ],
    secondary: [
      /SEED\s*ACQUIRED:?\s*([^\n]+)/i,
      /wisdom\s*is\s*now\s*part\s*of\s*your/i
    ]
  },
  de: {
    primary: [
      /🌟\s*SEED\s*ACQUIRED:\s*(.+?)\s*🌟/i, // Note: English format in German response
      /wahres\s*Verständnis\s*für\s*(.+?)\s*gezeigt/i
    ],
    secondary: [
      /SAMEN\s*ERWORBEN:\s*([^\n]+)/i,
      /Diese\s*Weisheit\s*ist\s*nun\s*Teil/i
    ]
  },
  fr: {
    primary: [
      /🌟\s*SEED\s*ACQUIRED:\s*(.+?)\s*🌟/i, // Note: English format in French response
      /véritable\s*compréhension\s*de\s*(.+?)[\.\s]/i
    ],
    secondary: [
      /GRAINE\s*ACQUISE:\s*([^\n]+)/i,
      /sagesse\s*fait\s*maintenant\s*partie/i
    ]
  },
  es: {
    primary: [
      /🌟\s*SEED\s*ACQUIRED:\s*(.+?)\s*🌟/i, // Note: English format in Spanish response
      /verdadera\s*comprensión\s*de\s*(.+?)[\.\s]/i
    ],
    secondary: [
      /SEMILLA\s*ADQUIRIDA:\s*([^\n]+)/i,
      /sabiduría\s*ahora\s*es\s*parte/i
    ]
  },
  pt: {
    primary: [
      /🌟\s*SEED\s*ACQUIRED:\s*(.+?)\s*🌟/i, // Note: English format in Portuguese response
      /verdadeiro\s*entendimento\s*de\s*(.+?)[\.\s]/i
    ],
    secondary: [
      /SEMENTE\s*ADQUIRIDA:\s*([^\n]+)/i,
      /sabedoria\s*agora\s*faz\s*parte/i
    ]
  },
  it: {
    primary: [
      /🌟\s*SEED\s*ACQUIRED:\s*(.+?)\s*🌟/i, // Note: English format in Italian response
      /vera\s*comprensione\s*di\s*(.+?)[\.\s]/i
    ],
    secondary: [
      /SEME\s*ACQUISITO:\s*([^\n]+)/i,
      /saggezza\s*è\s*ora\s*parte/i
    ]
  },
  ru: {
    primary: [
      /🌟\s*SEED\s*ACQUIRED:\s*(.+?)\s*🌟/i, // Note: English format in Russian response
      /истинное\s*понимание\s*(.+?)[\.\s]/i
    ],
    secondary: [
      /СЕМЯ\s*ПОЛУЧЕНО:\s*([^\n]+)/i,
      /мудрость\s*теперь\s*часть/i
    ]
  },
  zh: {
    primary: [
      /🌟\s*SEED\s*ACQUIRED:\s*(.+?)\s*🌟/i, // Note: English format in Chinese response
      /展示出对(.+?)的真正理解/i
    ],
    secondary: [
      /智慧现已成为您文艺复兴之旅的一部分/i
    ]
  },
  ja: {
    primary: [
      /🌟\s*SEED\s*ACQUIRED:\s*(.+?)\s*🌟/i, // Note: English format in Japanese response
      /(.+?)の真の理解を示しました/i
    ],
    secondary: [
      /知恵は今やあなたのルネサンスの旅の一部/i
    ]
  },
  ar: {
    primary: [
      /🌟\s*SEED\s*ACQUIRED:\s*(.+?)\s*🌟/i, // Note: English format in Arabic response
      /أظهرت فهماً حقيقياً لـ\s*(.+?)[\.\s]/i
    ],
    secondary: [
      /هذه الحكمة الآن جزء من رحلة النهضة/i
    ]
  },
  tr: {
    primary: [
      /🌟\s*SEED\s*ACQUIRED:\s*(.+?)\s*🌟/i, // Note: English format in Turkish response
      /(.+?)\s*hakkında gerçek bir anlayış gösterdiniz/i
    ],
    secondary: [
      /bilgelik artık Rönesans yolculuğunuzun bir parçası/i
    ]
  }
};

// Fallback patterns - these apply to all languages in case of unexpected formatting
const UNIVERSAL_PATTERNS = [
  /🌟\s*.*?SEED.*?ACQUIRED.*?:\s*(.+?)\s*🌟/i,
  /🌟\s*(.+?)\s*🌟/i,
  /SEED\s*ACQUIRED:?\s*([^\n]+)/i
];

// Failure detection patterns
const FAILURE_PATTERNS = {
  primary: /⭕\s*SEED\s*CHALLENGE\s*INCOMPLETE:?\s*(.+?)\s*⭕/i,
  secondary: /Continue\s*your\s*studies|Poursuivez\s*vos\s*études|Continúa\s*tus\s*estudios|Continue\s*seus\s*estudos/i
};

/**
 * Try extracting seed title from message using a set of patterns
 *
 * @param {string} message - The message content to analyze
 * @param {Array} patterns - Array of regular expressions to try
 * @returns {string|null} - Extracted seed title or null if not found
 */
function extractSeedTitle(message: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Normalize a seed title by removing figure prefixes and trimming
 *
 * @param {string} title - The seed title to normalize
 * @returns {string} - The normalized title
 */
function normalizeSeedTitle(title: any) {
  // Handle undefined or null titles
  if (!title || typeof title !== 'string') {
    console.warn('normalizeSeedTitle received invalid title:', title);
    return '';
  }
  
  // Remove figure name prefix if present (e.g., "Jane Austen - The Power of Observation" -> "The Power of Observation")
  if (title.includes(' - ')) {
    title = title.split(' - ').slice(1).join(' - ');
  }
  return title.trim();
}

/**
 * Calculate similarity score between two titles
 * Higher score = more similar
 *
 * @param {string} title1 - First title to compare
 * @param {string} title2 - Second title to compare
 * @returns {number} - Similarity score (0-1)
 */
function calculateSimilarity(title1: string, title2: string) {
  // Normalize both titles
  const normalizedTitle1 = normalizeSeedTitle(title1).toLowerCase();
  const normalizedTitle2 = normalizeSeedTitle(title2).toLowerCase();
  
  // Perfect match
  if (normalizedTitle1 === normalizedTitle2) {
    return 1;
  }
  
  // Split into words and count matches
  const words1 = normalizedTitle1.split(/\s+/);
  const words2 = normalizedTitle2.split(/\s+/);
  
  let matchCount = 0;
  for (const word1 of words1) {
    if (word1.length > 3 && words2.some((word2: string) => word2.includes(word1) || word1.includes(word2))) {
      matchCount++;
    }
  }
  
  // Calculate similarity based on word matches
  return matchCount / Math.max(words1.length, words2.length);
}

/**
 * Find the best matching seed for a given title
 *
 * @param {string} seedTitle - The extracted seed title
 * @param {string} figureId - The figure ID (e.g., 'plato', 'aurelius')
 * @returns {Object|null} - The matching seed info or null if not found
 */
function findMatchingSeed(seedTitle: string, figureId: string): { id: string | number; name: string; score: number } | null {
  // Search in both languages to handle language switching during acquisition
  const currentLanguage = useDomainStore.getState().language.current || 'en';
  const languages = currentLanguage === 'en' ? ['en', 'de'] : ['de', 'en']; // Try current language first

  let figureData = null;

  // Try to find seed data in preferred language order
  for (const lang of languages) {
    const data = getFigureSeedData(figureId, lang);
    if (data && data.seeds && data.seeds.length > 0) {
      figureData = data;
      break;
    }
  }

  if (!figureData) {
    return null;
  }

  // Normalize the extracted title
  const normalizedTitle = normalizeSeedTitle(seedTitle).toLowerCase();
  
  // Find the best match by searching in both languages
  let bestMatch: { id: string | number; name: string; score: number } | null = null;
  let highestScore = 0;

  // Search through all available languages for the best match
  for (const lang of languages) {
    const data = getFigureSeedData(figureId, lang);
    if (!data || !data.seeds) continue;

    for (const seed of data.seeds) {
      // Skip seeds without a title
      if (!seed || (!seed.title && !seed.name)) {
        continue;
      }
      
      // Get the seed title (preferring "title" over "name" for compatibility)
      const seedTitle = seed.title || seed.name || '';
      const seedName = normalizeSeedTitle(seedTitle).toLowerCase();
      
      // Calculate similarity
      const score = calculateSimilarity(normalizedTitle, seedName);
      
      // Update if better match found
      if (score > highestScore) {
        highestScore = score;
        bestMatch = {
          id: seed.id || 0,
          name: seedTitle,
          score
        };
      }
    }
  }

  // Only return if highly confident — low threshold enables spoofing via user input
  // V3 tool calling (award_seed) is now the primary acquisition path
  if (bestMatch && highestScore >= 0.8) {
    return bestMatch;
  }

  return null;
}

/**
 * Check if message indicates a successful seed acquisition
 *
 * @param {string} message - The message content to analyze
 * @param {string} figureId - The current figure ID (e.g., 'plato', 'aurelius')
 * @param {string} language - The selected language code (default: 'en')
 * @returns {Object} - Detection result {success, seedId, seedTitle, confidence}
 */
function detectSeedAcquisition(message: string, figureId: string, language = 'en') {
  // Skip short messages
  if (!message || message.length < 10) {
    return { success: false };
  }

  // Check for failure patterns first to avoid false positives
  if (message.match(FAILURE_PATTERNS.primary) || message.match(FAILURE_PATTERNS.secondary)) {
    return { success: false, isFailure: true };
  }

  // Get language-specific patterns or fall back to English
  const validLanguages = ['en', 'de', 'fr', 'es', 'pt', 'it', 'ru', 'zh', 'ja', 'ar', 'tr'] as const;
  type ValidLanguage = typeof validLanguages[number];
  const langKey = validLanguages.includes(language as ValidLanguage) ? (language as ValidLanguage) : 'en';
  const patterns = ACQUISITION_PATTERNS[langKey];

  // Try primary language-specific patterns first
  let seedTitle = extractSeedTitle(message, patterns.primary);

  // If not found, try secondary patterns
  if (!seedTitle) {
    seedTitle = extractSeedTitle(message, patterns.secondary);
  }

  // If still not found, try universal patterns
  if (!seedTitle) {
    seedTitle = extractSeedTitle(message, UNIVERSAL_PATTERNS);
  }

  // If we found a potential seed title, attempt to match it
  if (seedTitle) {
    const matchingSeed = findMatchingSeed(seedTitle, figureId);

    if (matchingSeed) {
      return {
        success: true,
        seedId: matchingSeed.id,
        seedTitle: seedTitle,
        confidence: matchingSeed.score
      };
    }
  }

  return { success: false };
}

/**
 * Update seed status in both memory and localStorage
 *
 * @param {string} figureId - The figure ID (e.g., 'plato', 'aurelius')
 * @param {string} seedId - The seed ID to mark as gathered
 * @returns {boolean} - Success status
 */
function markSeedAsGathered(figureId: string, seedId: string) {
  try {
    // Use the SeedStateManager to mark the seed as gathered
    const success = seedStateManager.markAsGathered(figureId, seedId);

    // Dispatch event for any existing listeners
    if (typeof window !== 'undefined') {
      // Use CustomEvent if available, otherwise use a simple object
      let event: Event;
      if (typeof CustomEvent === 'function') {
        event = new CustomEvent('seedAcquired', {
          detail: { figureId, seedId }
        });
      } else {
        // Basic fallback for testing
        event = {
          type: 'seedAcquired',
          detail: { figureId, seedId }
        } as unknown as Event;
      }
      window.dispatchEvent(event);
    }

    return success;
  } catch (error) {
    console.error('❌ Error marking seed as gathered:', error);
    return false;
  }
}

/**
 * Process a complete message buffer for potential seed acquisition
 *
 * @param {string} messageBuffer - The complete message content
 * @param {string} figureId - The current figure ID (e.g., 'plato', 'aurelius')
 * @param {string} mode - The current conversation mode
 * @param {string} language - The selected language code
 * @returns {Object} - Detection result
 */
// Dedup guard: prevent duplicate regex-based acquisition within a session
// Tool calling (award_seed) is the primary path; regex is a legacy fallback
const acquiredInSession = new Set<string>();

function processSeedAcquisition(messageBuffer: string, figureId: string, mode: string, language = 'en') {
  // Only process in challenge/quest mode to save computation
  if (mode !== 'challenge') {
    return { success: false, processed: false };
  }

  // Skip if already acquired for this figure in this session (prevents per-chunk re-runs)
  if (acquiredInSession.has(figureId)) {
    return { success: false, processed: false };
  }

  // Detect seed acquisition
  const result = detectSeedAcquisition(messageBuffer, figureId, language);

  // If successful, mark the seed as gathered (once)
  if (result.success && result.seedId) {
    acquiredInSession.add(figureId);
    markSeedAsGathered(figureId, String(result.seedId));
  }

  return { ...result, processed: true };
}

// Export functions using ES6 export syntax
export {
  detectSeedAcquisition,
  markSeedAsGathered,
  processSeedAcquisition
};
