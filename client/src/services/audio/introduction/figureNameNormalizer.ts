// Figure name normalization for audio file matching
// This handles the various ways figure names appear in the system

/**
 * Normalize figure names for manifest/audio file lookup
 * Handles special cases and variations in figure naming
 */
export function normalizeManifestFigureName(name: string): string {
  if (!name) return '';
  
  // Check for direct matches first with the full name (including Echo of prefix)
  const lowerFullName = name.toLowerCase();
  const specialCasesWithPrefix: Record<string, string> = {
    'echo of martin luther king jr': 'king',
    'echo of martin luther king jr.': 'king',
    'echo of king jr': 'king',
    'echo of king jr.': 'king',
    'echo of martin luther king': 'king'
  };
  
  if (specialCasesWithPrefix[lowerFullName]) {
    return specialCasesWithPrefix[lowerFullName];
  }
  
  // Remove "Echo of " prefix if present
  let cleanName = name;
  if (name.toLowerCase().startsWith('echo of ')) {
    cleanName = name.substring(8); // Remove "Echo of " prefix
  }
  
  // Special case mapping - match the logic from StoryCollection
  const specialCases: Record<string, string> = {
    'leonardo da vinci': 'vinci',
    'da vinci': 'vinci',
    'leonardo': 'vinci',
    'dogen zenji': 'zenji',
    'zenji': 'zenji',
    'siddhartha gautama': 'gautama',
    'siddhartha': 'gautama',
    'buddha': 'gautama',
    'galileo galilei': 'galilei',
    'galileo': 'galilei',
    'martin luther king jr': 'king',
    'martin luther king jr.': 'king',
    'echo of martin luther king jr': 'king',
    'echo of martin luther king jr.': 'king',
    'king jr': 'king',
    'king jr.': 'king',
    'echo of king jr': 'king',
    'echo of king jr.': 'king',
    'jr.': 'king',
    'jr': 'king',
    'martin luther king': 'king',
    'king': 'king',
    'hildegard von bingen': 'bingen',
    'von bingen': 'bingen',
    'hildegard': 'bingen',
    'alan turing': 'turing',
    'turing': 'turing',
    'rachel carson': 'carson',
    'carson': 'carson',
    'nikola tesla': 'tesla',
    'tesla': 'tesla',
    'ada lovelace': 'lovelace',
    'lovelace': 'lovelace',
    'pythagoras': 'pythagoras',
    'rumi': 'rumi',
    'jalal ad-din rumi': 'rumi',
    'jalal ad-din': 'rumi',
    'confucius': 'confucius',
    'kong qiu': 'confucius',
    'hypatia': 'hypatia',
    'hypatia of alexandria': 'hypatia',
    'ibn rushd': 'rushd',
    'averroes': 'rushd',
    'maimonides': 'maimonides',
    'rambam': 'maimonides',
    'moses ben maimon': 'maimonides',
    'voltaire': 'voltaire',
    'françois-marie arouet': 'voltaire',
    'marie curie': 'curie',
    'curie': 'curie',
    'albert einstein': 'einstein',
    'einstein': 'einstein',
    'carl jung': 'jung',
    'jung': 'jung',
    'joseph campbell': 'campbell',
    'campbell': 'campbell',
    'echo of pythagoras': 'pythagoras',
    'echo of rumi': 'rumi',
    'echo of confucius': 'confucius',
    'echo of hypatia': 'hypatia',
    'echo of ibn rushd': 'rushd',
    'echo of maimonides': 'maimonides',
    'echo of voltaire': 'voltaire',
    'echo of marie curie': 'curie',
    'echo of albert einstein': 'einstein',
    'echo of carl jung': 'jung',
    'echo of joseph campbell': 'campbell',
    'marc aurel': 'aurelius',
    'echo von marc aurel': 'aurelius'
  };
  
  const lowerCleanName = cleanName.toLowerCase();
  
  // Check special cases
  if (specialCases[lowerCleanName]) {
    return specialCases[lowerCleanName];
  }
  
  // If no special case, try to extract the last name
  const parts = cleanName.split(' ');
  const lastName = parts[parts.length - 1].toLowerCase();
  
  // Check if the last name matches any special case value
  const specialCaseValues = Object.values(specialCases);
  if (specialCaseValues.includes(lastName)) {
    return lastName;
  }
  
  // Final fallback: return the last name
  return lastName;
}

/**
 * Check for special King Jr. variants
 */
export function isKingJrVariant(figureId: string): boolean {
  return figureId.toLowerCase().includes('king') && 
         (figureId.toLowerCase().includes('jr') || 
          figureId.toLowerCase().includes('luther'));
}