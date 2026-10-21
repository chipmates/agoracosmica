/**
 * A summary section starts at a line in capitals that ends its header with a
 * colon (the summary prompt asks for that). German headers carry umlauts and
 * English ones apostrophes, so any upper-case letter counts, plus ß, hyphens and
 * both apostrophe forms; the header stays on one line.
 */
const SECTION_START = /\n(?=\p{Lu}[\p{Lu}ß'’\- \t]+:)/u;

export function splitSummarySections(content: string): string[] {
  return content.split(SECTION_START).filter(Boolean);
}
