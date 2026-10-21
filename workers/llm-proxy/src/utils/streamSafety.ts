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

interface Exclusion {
  /** What may not follow the match: the continuation that names a thing instead of saying the slogan. */
  unless: string;
  /** A lookahead that holds once the text after the match has arrived as far as `unless` reads. */
  known: string;
}

// A whitespace run longer than RUN_CAP is no longer the one space an exclusion
// allows between two words: "white power" followed by five spaces is the slogan,
// whatever comes after them.
const RUN_CAP = 4;

// A space in an exclusion is a run of up to RUN_CAP spaces or tabs, never a line
// break: "white power" at a line's end is the slogan, whatever heads the next line.
const SPACE = `[ \\t]{1,${RUN_CAP}}`;
const literal = (word: string): string => word.replace(/ /g, SPACE);

/** What the text may show at `word[i]` instead of that character, once it has shown the characters before it. */
function deviations(word: string, i: number): string[] {
  const char = word[i];
  if (char === ' ') return ['[^ \\t]', `[ \\t]{${RUN_CAP + 1}}`];
  // After a space the run is read greedily, so the deviation is no space either.
  return [word[i - 1] === ' ' ? `[^ \\t${char}]` : `[^${char}]`];
}

/** The match may not be followed by `word`; the text after it is known once it deviates from the word or completes it. */
function notLiteral(word: string): Exclusion {
  const known = [...word].flatMap((_, i) => deviations(word, i).map(deviation => literal(word.slice(0, i)) + deviation));
  return { unless: literal(word), known: `(?=${[...known, literal(word)].join('|')})` };
}

// Holocaustleugnung and Holocaustleugner with their inflections (Leugnungen,
// Leugnerin, Leugnerinnen, Leugnern, Leugners) name the crime and its
// offenders; the word ends there. Known once the word ends, or runs past the
// longest ending.
const NOUN_ENDINGS: Exclusion = {
  unless: '(?:ung(?:en)?|er(?:in(?:nen)?|n|s)?)\\b',
  known: '(?=\\w{0,7}\\W|\\w{8})',
};

// Only absolute §4 JMStV violations: keep this list tight to avoid false positives.
// `forming` names the one place a match dissolves for a character and forms
// again ("Untermensch" is a match, "Untermensche" none, "Untermenschen" one),
// so the reads are held across it.
// A denial stays cut whatever its sentence does with it: no sentence frame is
// safe, "calling the Holocaust a hoax is ..." included.
const CRITICAL_OUTPUT_PATTERNS: { pattern: RegExp; exclusion?: Exclusion; forming?: RegExp }[] = [
  { pattern: /heil\s+hitler/i },
  { pattern: /sieg\s+heil/i },
  { pattern: /holocaust.{0,20}(l[uü]ge|hoax|fake)/i },
  // The compound, joined directly or by one hyphen, is the mention.
  { pattern: /holocaust-?leugn/i, exclusion: NOUN_ENDINGS },
  // "leugn" at a distance (a separate word, another compound, a second one after
  // the compound) is the denial: one character other than a hyphen, or two to
  // twenty of any kind, lie between.
  { pattern: /holocaust(?:[^\n-]|.{2,20})leugn/i },
  { pattern: /\b(Rassenschande|Volksverr[aä]ter|Untermensch(en)?)\b/i, forming: /\bUntermensche$/i },
  // "The white power structure" is the civil rights movement's name for its opponent.
  { pattern: /\bwhite\s*power\b/i, exclusion: notLiteral(' structure') },
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

function compile({ pattern, exclusion, forming }: { pattern: RegExp; exclusion?: Exclusion; forming?: RegExp }): Rule {
  const source = `(?:${pattern.source})`;
  const flags = pattern.flags + 'g';
  const unless = exclusion ? `(?!${exclusion.unless})` : '';
  // A trailing \b reads the next character.
  const known = exclusion?.known ?? (pattern.source.endsWith('\\b') ? '(?=[\\s\\S])' : '');
  return {
    whole: new RegExp(source + unless, flags),
    settled: new RegExp(source + unless + known, flags),
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
 * Shrink every whitespace run, so a long run between two words of a pattern
 * cannot push the first word out of the kept tail: to one space, or to one
 * no-break space when it is longer than RUN_CAP, which no exclusion's space
 * matches. A run holding a line break becomes that break, so `.` in a pattern
 * still stops where it did. The run at the end keeps its length up to
 * RUN_CAP + 1, since the next read may continue it.
 */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, (run, at: number) => {
    if (/[\n\r\u2028\u2029]/.test(run)) return '\n';
    if (at + run.length === text.length) return ' '.repeat(Math.min(run.length, RUN_CAP + 1));
    return run.length > RUN_CAP ? '\u00a0' : ' ';
  });
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
