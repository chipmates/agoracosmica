// German quotation marks at display. The German texts open with „ and ‚ and close with a straight " and '; shown,
// each such closer takes its German form, “ and ‘. One UTF-16 unit stands for one, so every offset into the text
// (the read-along's words, a saved sentence) is the same before and after. The source files are not changed.

type Open = 'D' | 'd' | 'S' | 's';

const LETTER = /[\p{L}\p{N}]/u;
const SPACE = /\s/;
const BEFORE_OPENER = /[\s([{/\-–—]/;

/** The text with each straight closer of a „ or ‚ in its German form. Apostrophes are never touched. */
export function closeGermanQuotes(text: string): string {
  if (!text.includes('"') && !text.includes("'")) return text;
  const at = (i: number): string => (i >= 0 && i < text.length ? text[i]! : ' ');
  // a straight mark that opens: after a space or a bracket, before a letter
  const opener = (i: number): boolean => BEFORE_OPENER.test(at(i - 1)) && !SPACE.test(at(i + 1));
  const out = text.split('');
  const stack: Open[] = [];
  const nearest = (kinds: string, wall = ''): number => {
    for (let k = stack.length - 1; k >= 0; k -= 1) {
      if (kinds.includes(stack[k]!)) return k;
      if (wall.includes(stack[k]!)) return -1;
    }
    return -1;
  };
  // A word-final ' inside a ‚ can be an elision ("müd'"): it is not the closer when the quote still ends in '" ahead.
  const elision = (i: number): boolean => {
    if (!LETTER.test(at(i - 1))) return false;
    for (let j = i + 1; j < text.length; j += 1) {
      const c = text[j]!;
      if (c === '„' || c === '‚' || (c === '\n' && at(j + 1) === '\n')) return false;
      if (c === '"') return at(j - 1) === "'" && j - 1 > i;
    }
    return false;
  };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (c === '„') stack.push('D');
    else if (c === '‚') stack.push('S');
    else if (c === '"') {
      if (opener(i)) {
        stack.push('d');
        continue;
      }
      const k = nearest('Dd');
      if (k < 0) continue;
      if (stack[k] === 'D') out[i] = '“';
      stack.length = k;
    } else if (c === "'") {
      if (LETTER.test(at(i - 1)) && LETTER.test(at(i + 1))) continue;
      if (opener(i)) {
        stack.push('s');
        continue;
      }
      // a single quote closes inside its double quote, never across it
      const k = nearest('Ss', 'Dd');
      if (k < 0 || (stack[k] === 'S' && elision(i))) continue;
      if (stack[k] === 'S') out[i] = '‘';
      stack.length = k;
    }
  }
  return out.join('');
}

/** A story's words as shown: the blocks closed as one text (a quote may run over paragraphs), each word cut from its
 *  own place in its block, so its length and its index stay the model's. */
export function shownWords(blocks: string[], words: { text: string; block: number }[]): string[] {
  const shown = closeGermanQuotes(blocks.join('\n\n')).split('\n\n');
  if (shown.length !== blocks.length) return words.map(w => w.text);
  const cursor = new Map<number, number>();
  return words.map(w => {
    const src = blocks[w.block] ?? '';
    const at = src.indexOf(w.text, cursor.get(w.block) ?? 0);
    if (at < 0) return w.text;
    cursor.set(w.block, at + w.text.length);
    return shown[w.block]!.slice(at, at + w.text.length);
  });
}

