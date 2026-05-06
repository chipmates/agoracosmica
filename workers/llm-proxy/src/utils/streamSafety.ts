/**
 * Stream-compatible output safety scanner.
 *
 * Checks SSE chunks from the LLM for §4 JMStV absolute violations
 * (hate speech, Holocaust denial, specific slurs). Uses a sliding buffer
 * to detect patterns that span chunk boundaries.
 *
 * This is a last-resort safety net. The primary defense is the safety
 * preamble + input filtering. This scanner only targets content that
 * MUST NEVER reach the user under German law.
 */

// Only absolute §4 JMStV violations — keep this list tight to avoid false positives
const CRITICAL_OUTPUT_PATTERNS: RegExp[] = [
  /heil\s+hitler/i,
  /sieg\s+heil/i,
  /holocaust.{0,20}(l[uü]ge|leugn|hoax|fake)/i,
  /\b(Rassenschande|Volksverr[aä]ter|Untermensch(en)?)\b/i,
  /\b(white\s*power|white\s*supremac)\b/i,
  /(?:juden|muslime|jews|muslims).{0,20}(vergasen|vernichten|exterminate|eradicate)/i,
];

export class StreamSafetyScanner {
  private buffer = '';
  private blocked = false;

  /**
   * Check a text chunk from the SSE stream.
   * Returns true if the chunk is safe to pass through.
   * Returns false if a critical pattern was detected (abort the stream).
   */
  check(text: string): boolean {
    if (this.blocked) return false;

    this.buffer += text;
    // Keep last 120 chars for cross-boundary matching
    if (this.buffer.length > 120) {
      this.buffer = this.buffer.slice(-120);
    }

    for (const pattern of CRITICAL_OUTPUT_PATTERNS) {
      if (pattern.test(this.buffer)) {
        this.blocked = true;
        return false;
      }
    }

    return true;
  }

  isBlocked(): boolean {
    return this.blocked;
  }
}
