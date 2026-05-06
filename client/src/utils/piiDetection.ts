/**
 * Client-side PII detection for chat input.
 *
 * Warns (does not block) when personal data patterns are detected.
 * Only high-confidence patterns to minimize false positives.
 * Historical dates and philosophical references should NOT trigger.
 */

const PII_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  // German IBAN (DE + 2 check + 18 digits)
  { pattern: /\bDE\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}\b/i, type: 'iban' },

  // Email address
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, type: 'email' },

  // German phone number (+49, 0049, or local 0-prefix with 8-14 digits)
  { pattern: /\b(?:\+49|0049)\s?[\d\s/.-]{8,14}\b/, type: 'phone' },

  // Credit card number (4 groups of 4 digits)
  { pattern: /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/, type: 'credit-card' },
];

export interface PIIDetectionResult {
  detected: boolean;
  type?: string;
}

/**
 * Check a message for personal data patterns.
 * Returns { detected: true, type } if PII found, { detected: false } otherwise.
 */
export function detectPII(message: string): PIIDetectionResult {
  for (const { pattern, type } of PII_PATTERNS) {
    if (pattern.test(message)) {
      return { detected: true, type };
    }
  }
  return { detected: false };
}
