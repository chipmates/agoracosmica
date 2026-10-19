// A blank line always breaks a paragraph. A single newline breaks one only
// after a sentence end (models often put one newline between paragraphs) and
// joins after a comma; any other single newline stays in the text, where the
// bubble's pre-wrap shows it as a line break. Punctuation is never consumed.
const SENTENCE_END_NEWLINE = /([.!?…]["'”’“»«)]*)[ \t]*\n(?![ \t]*\n)/g;

export function splitMessageParagraphs(content: string): string[] {
  return content
    .replace(/\r\n?/g, '\n')
    .replace(/,\n(?![ \t]*\n)/g, ', ')
    .replace(SENTENCE_END_NEWLINE, '$1\n\n')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
}
