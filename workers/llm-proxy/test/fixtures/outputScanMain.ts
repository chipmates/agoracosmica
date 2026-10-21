// The output scanner as it was before the settle step and the exclusions, kept
// whole for the differential: every text it cuts must stay cut, except the
// named mentions. Test code, not a rule; do not edit.

const CRITICAL_OUTPUT_PATTERNS: RegExp[] = [
  /heil\s+hitler/i,
  /sieg\s+heil/i,
  /holocaust.{0,20}(l[uü]ge|leugn|hoax|fake)/i,
  /\b(Rassenschande|Volksverr[aä]ter|Untermensch(en)?)\b/i,
  /\b(white\s*power|white\s*supremac)\b/i,
  /(?:juden|muslime|jews|muslims).{0,20}(vergasen|vernichten|exterminate|eradicate)/i,
];

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, run => (/[\n\r\u2028\u2029]/.test(run) ? '\n' : ' '));
}

export class MainStreamSafetyScanner {
  private buffer = '';
  private blocked = false;

  check(text: string): boolean {
    if (this.blocked) return false;
    this.buffer = collapseWhitespace(this.buffer + text);
    for (const pattern of CRITICAL_OUTPUT_PATTERNS) {
      if (pattern.test(this.buffer)) {
        this.blocked = true;
        return false;
      }
    }
    if (this.buffer.length > 120) {
      this.buffer = this.buffer.slice(-120);
    }
    return true;
  }

  /** The old scanner had no end-of-stream step; the verdict is final after the last read. */
  finish(): boolean {
    return !this.blocked;
  }

  isBlocked(): boolean {
    return this.blocked;
  }
}
