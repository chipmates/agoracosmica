/**
 * Utility for consistent handling of placeholders across the application
 * Supports multiple formats: {PLACEHOLDER}, [PLACEHOLDER], and {{PLACEHOLDER}}
 */

/**
 * Supported placeholder format types
 */
export type PlaceholderFormat = 'curly' | 'bracket' | 'double-curly';

/**
 * Options for placeholder processing
 */
export interface PlaceholderOptions {
  /** Throw error if placeholder is missing (default: false) */
  throwOnMissing?: boolean;
  /** Log warnings for missing placeholders (default: true) */
  logMissing?: boolean;
  /** Supported placeholder formats (default: all formats) */
  supportedFormats?: PlaceholderFormat[];
}

/**
 * Replacement values map
 */
export interface ReplacementMap {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Process all placeholders in a template string with provided replacements
 * @param template - The template string containing placeholders
 * @param replacements - Key-value pairs of placeholder names and their replacements
 * @param options - Additional processing options
 * @returns The processed string with all placeholders replaced
 */
export function processPlaceholders(
  template: string | null | undefined,
  replacements: ReplacementMap | null | undefined,
  options: PlaceholderOptions = {}
): string {
  if (!template || typeof template !== 'string') {
    console.warn('Invalid template provided to processPlaceholders');
    return '';
  }

  if (!replacements || typeof replacements !== 'object') {
    console.warn('Invalid replacements provided to processPlaceholders');
    return template;
  }

  const {
    throwOnMissing = false,
    logMissing = true,
    supportedFormats = ['curly', 'bracket', 'double-curly']
  } = options;

  let result: string = template;
  const missingPlaceholders: string[] = [];
  const processedPlaceholders: string[] = [];

  // Helper function to escape special regex characters
  const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Process each replacement
  Object.entries(replacements).forEach(([key, value]) => {
    // Skip if value is undefined or null
    if (value === undefined || value === null) {
      if (logMissing) {
        console.warn(`Placeholder value for "${key}" is null or undefined`);
      }
      return;
    }

    const stringValue: string = String(value);
    const escapedKey: string = escapeRegex(key);
    let replacementMade: boolean = false;

    // Format 1: {{PLACEHOLDER}} (process double-curly FIRST to avoid conflicts)
    if (supportedFormats.includes('double-curly')) {
      const doubleCurlyRegex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g');
      if (result.match(doubleCurlyRegex)) {
        result = result.replace(doubleCurlyRegex, stringValue);
        replacementMade = true;
      }
    }

    // Format 2: {PLACEHOLDER} (single curly after double)
    if (supportedFormats.includes('curly')) {
      const curlyRegex = new RegExp(`\\{${escapedKey}\\}`, 'g');
      if (result.match(curlyRegex)) {
        result = result.replace(curlyRegex, stringValue);
        replacementMade = true;
      }
    }

    // Format 3: [PLACEHOLDER]
    if (supportedFormats.includes('bracket')) {
      const bracketRegex = new RegExp(`\\[${escapedKey}\\]`, 'g');
      if (result.match(bracketRegex)) {
        result = result.replace(bracketRegex, stringValue);
        replacementMade = true;
      }
    }

    if (replacementMade) {
      processedPlaceholders.push(key);
    }
  });

  // Check for remaining unprocessed placeholders
  if (logMissing || throwOnMissing) {
    const allFormats: RegExp[] = [];
    if (supportedFormats.includes('double-curly')) allFormats.push(/\{\{([A-Z_0-9]+)\}\}/g);
    if (supportedFormats.includes('curly')) allFormats.push(/\{([A-Z_0-9]+)\}/g);
    if (supportedFormats.includes('bracket')) allFormats.push(/\[([A-Z_0-9]+)\]/g);

    allFormats.forEach(format => {
      let match: RegExpExecArray | null;
      while ((match = format.exec(result)) !== null) {
        if (!missingPlaceholders.includes(match[1])) {
          missingPlaceholders.push(match[1]);
        }
      }
    });

    if (missingPlaceholders.length > 0 && logMissing) {
      console.warn(`Unprocessed placeholders found: ${missingPlaceholders.join(', ')}`);
    }

    if (missingPlaceholders.length > 0 && throwOnMissing) {
      throw new Error(`Missing replacements for placeholders: ${missingPlaceholders.join(', ')}`);
    }
  }

  return result;
}

