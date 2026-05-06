/**
 * TTS Text Cleaner — strips markdown and formatting artifacts from LLM output.
 *
 * LLMs (especially DeepSeek) inject *asterisks*, __underscores__, and other
 * markdown despite explicit instructions to avoid them. Kokoro TTS reads
 * these literally, breaking audio quality.
 *
 * Used by: conversationStreamDriver (all conversation modes), council parser,
 * council generator. Single source of truth — no duplication.
 */

/**
 * Strip markdown formatting and fix punctuation for clean TTS output.
 * Applied to every LLM response chunk before it reaches TTS synthesis.
 */
export function cleanTextForTts(text: string): string {
  return text
    .replace(/\*+/g, '')        // **bold** or *italic* → plain text
    .replace(/_+/g, '')         // __bold__ or _italic_
    .replace(/#+\s?/g, '')      // ## headings
    .replace(/`+/g, '')         // `code` or ```blocks```
    .replace(/[<>]/g, '')       // angle brackets
    .replace(/🌟\s*SEED ACQUIRED:[^🌟]*🌟/g, '') // Strip seed acquired verdict line
    .replace(/⭕\s*SEED CHALLENGE INCOMPLETE:[^⭕]*⭕/g, '') // Strip seed incomplete verdict line
    .replace(/[🌟⭕]/g, '')     // Strip any remaining verdict emojis
    .replace(/^I have (?:now )?asked (?:zero|one|two|three|four|five|\d).*$/gm, '') // Strip V3 question counting lines
    .replace(/\n{2,}/g, '\n')  // collapse blank lines from removals
    .replace(/\s{2,}/g, ' ')   // collapse multiple spaces from removals
    .trim();
}

/**
 * Extended TTS cleaning for council mode — includes stage direction removal
 * and dash-to-comma conversion that council dialogues need.
 */
export function cleanCouncilTextForTts(text: string): string {
  return text
    .replace(/\([A-Z][^)]{3,}\)\s*/g, '')  // Strip stage directions: (Landing Line)
    .replace(/\s+,\s+/g, ', ')              // Fix spaced commas: " , " → ", "
    .replace(/—/g, ', ')                     // Em-dash → comma pause
    .replace(/–/g, ', ')                     // En-dash → comma pause
    .replace(/\*+/g, '')                     // Strip asterisks
    .replace(/_+/g, '')                      // Strip underscores
    .replace(/#+\s?/g, '')                   // Strip headings
    .replace(/`+/g, '')                      // Strip backticks
    .replace(/[<>]/g, '')                    // Strip angle brackets
    .replace(/\s{2,}/g, ' ')                // Collapse multiple spaces
    .trim();
}
