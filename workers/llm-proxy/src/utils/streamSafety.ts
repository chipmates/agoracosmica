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

// Only absolute §4 JMStV violations: keep this list tight to avoid false positives.
// `forming` names the one place a match dissolves for a character and forms
// again ("Untermensch" is a match, "Untermensche" none, "Untermenschen" one),
// so the reads are held across it.
const CRITICAL_OUTPUT_PATTERNS: { pattern: RegExp; forming?: RegExp }[] = [
  { pattern: /heil\s+hitler/i },
  { pattern: /sieg\s+heil/i },
  { pattern: /holocaust.{0,20}(l[uü]ge|leugn|hoax|fake)/i },
  { pattern: /\b(Rassenschande|Volksverr[aä]ter|Untermensch(en)?)\b/i, forming: /\bUntermensche$/i },
  { pattern: /\b(white\s*power|white\s*supremac)\b/i },
  { pattern: /(?:juden|muslime|jews|muslims).{0,20}(vergasen|vernichten|exterminate|eradicate)/i },
];

interface Rule {
  /** Decides a whole text. */
  whole: RegExp;
  /** Decides a text still arriving: the same match, once every character it reads past its end has arrived. */
  settled: RegExp;
  /** A match whose characters after it have not all arrived: no verdict yet, the reads since it began are held. */
  waiting?: RegExp;
  /** The buffer's end inside a match that is not whole for a character, where `waiting` alone would release the reads. */
  forming?: RegExp;
}

function compile({ pattern, forming }: { pattern: RegExp; forming?: RegExp }): Rule {
  const source = `(?:${pattern.source})`;
  const flags = pattern.flags + 'g';
  // A trailing \b reads the next character.
  const known = pattern.source.endsWith('\\b') ? '(?=[\\s\\S])' : '';
  return {
    whole: new RegExp(source, flags),
    settled: new RegExp(source + known, flags),
    waiting: known ? new RegExp(`${source}(?!${known})`, flags) : undefined,
    forming: forming && new RegExp(forming.source, forming.flags + 'g'),
  };
}

const RULES: Rule[] = CRITICAL_OUTPUT_PATTERNS.map(compile);

// REACH exceeds any match plus what a rule reads after it (under 50 characters).
// A read is searched from REACH before its start: everything earlier was decided
// by an earlier read, and a trim can only have cut the context before it.
const REACH = 80;
// KEEP minus REACH exceeds what a rule reads before a match (the character a \b tests).
const KEEP = 120;

/**
 * Shrink every whitespace run to one character, so a long run between two words
 * of a pattern cannot push the first word out of the kept tail. A run holding a
 * line break becomes that break, so `.` in a pattern still stops where it did.
 */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, run => (/[\n\r\u2028\u2029]/.test(run) ? '\n' : ' '));
}

export class StreamSafetyScanner {
  private buffer = '';
  private blocked = false;
  private waiting = false;

  /**
   * Check a text chunk from the SSE stream.
   * Returns true if the chunk is safe to pass through.
   * Returns false if a critical pattern was detected (abort the stream).
   * A match that still waits for the characters after it is no verdict yet,
   * so the same text gets the same verdict however the reads cut it; while
   * one waits, `pending()` is true and the caller holds the reads back.
   */
  check(text: string): boolean {
    if (this.blocked) return false;

    const from = Math.max(0, this.buffer.length - REACH);
    // Collapse after joining: a run can arrive spread over many chunks.
    this.buffer = collapseWhitespace(this.buffer + text);

    // Test the whole buffer before trimming: one network read can carry many
    // deltas, so the start of a long chunk would otherwise never be scanned.
    if (this.find(rule => rule.settled, from)) {
      this.blocked = true;
      return false;
    }
    this.waiting = this.find(rule => rule.waiting, from) || this.find(rule => rule.forming, from);

    if (this.buffer.length > KEEP) {
      this.buffer = this.buffer.slice(-KEEP);
    }

    return true;
  }

  /**
   * The stream has ended: a match that waited for more text is settled now.
   * Returns true if the text is safe.
   */
  finish(): boolean {
    if (this.blocked) return false;
    this.waiting = false;
    if (this.find(rule => rule.whole, Math.max(0, this.buffer.length - REACH))) {
      this.blocked = true;
      return false;
    }
    return true;
  }

  /** True while a match waits for the text after it: the reads since it began carry no verdict yet. */
  pending(): boolean {
    return this.waiting;
  }

  private find(pick: (rule: Rule) => RegExp | undefined, from: number): boolean {
    for (const rule of RULES) {
      const regex = pick(rule);
      if (!regex) continue;
      regex.lastIndex = from;
      if (regex.test(this.buffer)) return true;
    }
    return false;
  }

  isBlocked(): boolean {
    return this.blocked;
  }
}
