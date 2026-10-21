/**
 * A summary section starts at a header: a whole line of capitals, digits and
 * punctuation that ends in a colon (the summary prompt asks for capitals and a
 * colon; the model names the headers, so digits, `&`, `/` and brackets occur).
 * Any upper-case letter counts, German umlauts included, and ß. The line opens
 * with a capital, a digit or a bracket, never a quote or a bullet; it holds at
 * least two capitals and no other colon, so "A:", "1914:" and "NOTE: text"
 * stay body lines.
 */
const SECTION_START =
  /\n(?=[\p{Lu}\p{N}([](?:(?!:)[\p{Lu}\p{M}\p{N}\p{P}\p{S}ß \t])*:[ \t]*$)(?=[^\n]*\p{Lu}[^\n]*\p{Lu})/mu;

export function splitSummarySections(content: string): string[] {
  return content.split(SECTION_START).filter(Boolean);
}
