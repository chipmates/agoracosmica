/**
 * splitForGatewayCap.ts — Hetzner-gateway-cap-aware text splitter.
 *
 * Shared between initial-message rendering and live custom-council TTS.
 * Both pipelines hit the same Hetzner gateway with the same hard caps:
 *
 *   DE: 500 chars (Qwen3-TTS / F5)
 *   EN: 600 chars (Kokoro)
 *
 * Above the cap the gateway returns 400 input_too_long and the call fails.
 *
 * Strategy: keep one-shot rendering when text fits. Otherwise split at the
 * sentence boundary nearest the midpoint into 2 chunks (or recursively into
 * 3+ for unusually long inputs). Single seam = single 200 ms breath, which
 * downstream playback already inserts between successive renders.
 *
 * Originally lived in initialMessageService.ts (2026-04 initial-greeting work).
 * Extracted 2026-05-02 so CustomCouncilService can use the same logic when
 * council segments exceed the gateway cap (audit Change CI-3).
 */

export type GatewayLanguage = 'en' | 'de' | 'english' | 'german' | 'deutsch' | string;

const SAFETY_MARGIN = 20; // headroom under the cap for DE preprocessing expansion

export function gatewayCapForLang(language: GatewayLanguage): number {
  const lower = (language || 'en').toLowerCase();
  return lower === 'de' || lower === 'german' || lower === 'deutsch' ? 500 : 600;
}

/**
 * Split `text` into chunks each guaranteed to fit under the gateway cap for
 * the given language. Returns a single-element array when no split is needed.
 */
export function splitForGatewayCap(text: string, language: GatewayLanguage): string[] {
  const cap = gatewayCapForLang(language) - SAFETY_MARGIN;
  if (text.length <= cap) return [text];

  // Sentence boundaries (matches TextChunker.extractSentences pattern)
  const sentencePattern = /([^.!?。！？]+[.!?。！？])(\s*)/g;
  const sentences: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = sentencePattern.exec(text)) !== null) {
    sentences.push(match[1] + match[2]);
    lastIndex = sentencePattern.lastIndex;
  }
  const leftover = text.slice(lastIndex).trim();
  if (leftover) sentences.push(leftover);

  // Single sentence longer than cap — fall back to clause boundary near midpoint.
  if (sentences.length < 2) {
    const half = Math.floor(text.length / 2);
    const clauseChars = [',', ';', ':'];
    let splitAt = -1;
    for (let i = half; i < Math.min(text.length, cap); i++) {
      if (clauseChars.includes(text[i])) { splitAt = i + 1; break; }
    }
    if (splitAt < 0) {
      for (let i = half; i >= Math.max(0, text.length - cap); i--) {
        if (clauseChars.includes(text[i])) { splitAt = i + 1; break; }
      }
    }
    if (splitAt < 0) splitAt = half;
    return [text.slice(0, splitAt).trim(), text.slice(splitAt).trim()];
  }

  // Find sentence-aligned split closest to midpoint, with both halves under cap.
  const target = text.length / 2;
  let bestSplitIdx = 1;
  let bestDiff = Infinity;
  let cumLen = 0;
  for (let i = 0; i < sentences.length - 1; i++) {
    cumLen += sentences[i].length;
    const remaining = text.length - cumLen;
    if (cumLen > cap || remaining > cap) continue; // both halves must fit
    const diff = Math.abs(cumLen - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplitIdx = i + 1;
    }
  }

  const chunk1 = sentences.slice(0, bestSplitIdx).join('').trim();
  const chunk2 = sentences.slice(bestSplitIdx).join('').trim();

  // Recursive guard for unusually long halves.
  if (chunk1.length > cap) return [...splitForGatewayCap(chunk1, language), chunk2];
  if (chunk2.length > cap) return [chunk1, ...splitForGatewayCap(chunk2, language)];
  return [chunk1, chunk2];
}
