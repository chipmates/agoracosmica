// -------------------------------------------------------
//  llmUtils.ts - Revised to Exclude Background Loading
// -------------------------------------------------------

// 1. Imports for language messages and mode messages
import { LANGUAGE_FRAME_MESSAGES } from './languageFrameMessages';
import { storyModeMessages } from './storyModeMessages';
import { seedConversationMessages } from './seedConversationMessages';
import { freeConversationMessages } from './freeConversationMessages';
import { challengeModeMessages } from './challengeModeMessages';
import type { Message, LLMResponse } from './index';

// ============================================
// Type Definitions
// ============================================

interface ChunkParams {
  minWords: number;
  minChars: number;
  targetChars: number;
  maxChars: number;
  targetTokens: number;
}

interface ScalingFactor {
  upTo: number;
  factor: number;
}

interface LanguageParameters {
  group: string;
  params: ChunkParams;
  scaling: ScalingFactor[];
}

interface RequestMetrics {
  startTime: number;
  requestId: string;
}

interface PerformanceResult {
  requestId: string;
  latency: number;
  success: boolean;
  averageLatency: number;
  errorRate: number;
}

// -------------------------------------------------------
// 2. Combine mode messages
// -------------------------------------------------------
export const MODE_FRAME_MESSAGES: Record<string, any> = {
  story: storyModeMessages,
  seed_conversation: seedConversationMessages,
  free_conversation: freeConversationMessages,
  challenge: challengeModeMessages
};

// -------------------------------------------------------
// 3. Language Groups & Parameters
// -------------------------------------------------------
const CHUNK_PARAMS: Record<string, ChunkParams> = {
  de: {
    minWords: 8,
    minChars: 80,
    targetChars: 200,
    maxChars: 260,
    targetTokens: 80
  },
  en: {
    minWords: 8,
    minChars: 80,
    targetChars: 200,
    maxChars: 280,
    targetTokens: 100
  },
  latin: {
    minWords: 8,
    minChars: 80,
    targetChars: 170,
    maxChars: 220,
    targetTokens: 80
  },
  cjk: {
    minWords: 12,
    minChars: 30,
    targetChars: 80,
    maxChars: 120,
    targetTokens: 60
  },
  rtl: {
    minWords: 10,
    minChars: 80,
    targetChars: 135,
    maxChars: 170,
    targetTokens: 70
  }
};

const SCALING_STRATEGY: ScalingFactor[] = [
  { upTo: 200, factor: 1.4 },
  { upTo: 500, factor: 1.5 },
  { upTo: 750, factor: 1.3 },
  { upTo: 1000, factor: 1.2 },
  { upTo: 1500, factor: 1.1 }
];

// -------------------------------------------------------
// 4. Export of Frame Messages if needed
// -------------------------------------------------------
export { LANGUAGE_FRAME_MESSAGES };

// -------------------------------------------------------
// 5. getLanguageParameters
// -------------------------------------------------------
export function getLanguageParameters(languageId: string): LanguageParameters {
  const normalizedId = languageId.toLowerCase().substring(0, 2);

  // DE and EN get their own optimized TTS chunk params (F5-TTS sweet spots).
  // DE: 200 char target (F5 training distribution ~180-220 chars at 10s ref clips).
  // EN: 280 char target (English runs ~40% more chars per equivalent audio length).
  if (CHUNK_PARAMS[normalizedId]) {
    return {
      group: normalizedId,
      params: CHUNK_PARAMS[normalizedId],
      scaling: SCALING_STRATEGY
    };
  }

  const languageGroups: Record<string, string[]> = {
    latin: ['fr', 'es', 'pt', 'it', 'tr'],
    cyrillic: ['ru', 'bg'],
    cjk: ['zh', 'ja'],
    rtl: ['ar']
  };

  for (const [group, codes] of Object.entries(languageGroups)) {
    if (codes.includes(normalizedId)) {
      return {
        group,
        params: CHUNK_PARAMS[group] || CHUNK_PARAMS.latin,
        scaling: SCALING_STRATEGY
      };
    }
  }

  // Default to latin for unknown languages
  return {
    group: 'latin',
    params: CHUNK_PARAMS.latin,
    scaling: SCALING_STRATEGY
  };
}

// -------------------------------------------------------
// 6. validateAndPreprocessMessages
// -------------------------------------------------------
export function validateAndPreprocessMessages(messages: Message[]): Message[] {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array');
  }

  return messages.map((msg, index) => {
    if (!msg) {
      throw new Error(`Message at index ${index} is null or undefined`);
    }
    
    if (!msg.role || !msg.content) {
      console.error('Invalid message at index', index, ':', msg);
      throw new Error(`Message at index ${index} must have role and content`);
    }

    if (!['user', 'assistant'].includes(msg.role)) {
      console.error('Invalid role at index', index, ':', msg.role, 'Full message:', msg);
      throw new Error(`Message role must be user or assistant, got '${msg.role}' at index ${index}`);
    }

    const cleanedContent = msg.content
      .trim()
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); // remove control chars (preserve \t \n \r)

    return { ...msg, content: cleanedContent };
  });
}

// -------------------------------------------------------
// 7. estimateTokens
// -------------------------------------------------------
export function estimateTokens(text: string): number {
  if (!text) return 0;

  const emojiCount = (text.match(/[\p{Emoji}]/gu) || []).length;
  const wordCount = text.trim().split(/\s+/).length;
  const specialCharCount = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;

  return Math.ceil(wordCount * 1.3) + (emojiCount * 3) + (specialCharCount * 0.5);
}

// -------------------------------------------------------
// 8. validateResponse
// -------------------------------------------------------
export function validateResponse(response: LLMResponse): LLMResponse {
  if (!response || typeof response.response !== 'string') {
    throw new Error('Invalid response format');
  }

  // Content quality check: detect if LLM output contains code/HTML instead of natural language.
  // This is NOT an XSS filter — React text rendering prevents XSS at the rendering layer.
  // These patterns indicate prompt injection or model failure, not a rendering vulnerability.
  const suspiciousPatterns = [
    /<script\b/i,
    /javascript:/i,
    /data:\s*text\/html/i,
    /on(?:error|load|click)\s*=/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(response.response)) {
      console.warn('[LLM] Response contains suspicious content (possible prompt injection):', response.response.slice(0, 200));
      throw new Error('Response contains potentially harmful content');
    }
  }

  return response;
}

// -------------------------------------------------------
// 9. Performance Monitor
// -------------------------------------------------------
export class PerformanceMonitor {
  // Sliding window of recent latencies (last 50 requests) — prevents unbounded accumulation
  private recentLatencies: number[] = [];
  private recentErrors = 0;
  private requestCount = 0;
  private static readonly WINDOW_SIZE = 50;

  startRequest(): RequestMetrics {
    return {
      startTime: performance.now(),
      requestId: Math.random().toString(36).substring(7)
    };
  }

  endRequest(reqMetrics: RequestMetrics, success = true): PerformanceResult {
    const latency = performance.now() - reqMetrics.startTime;

    this.requestCount++;
    this.recentLatencies.push(latency);
    if (!success) this.recentErrors++;

    // Trim to window size
    if (this.recentLatencies.length > PerformanceMonitor.WINDOW_SIZE) {
      this.recentLatencies.shift();
    }

    const avgLatency = this.recentLatencies.reduce((a, b) => a + b, 0) / this.recentLatencies.length;

    return {
      requestId: reqMetrics.requestId,
      latency,
      success,
      averageLatency: avgLatency,
      errorRate: this.recentErrors / this.requestCount
    };
  }
}

// A single global instance
export const performanceMonitor = new PerformanceMonitor();

// -------------------------------------------------------
// 10. TextChunker
// -------------------------------------------------------
export class TextChunker {
  private params: ChunkParams;
  private currentBuffer: string;
  private sentenceQueue: string[];
  private currentChunkIndex: number;
  /**
   * Hold-back buffer for the most-recently-built chunk (chunks 2+).
   * Chunk 1 always emits immediately to preserve TTFA. Chunks 2+ are held
   * one step: emitted when the next chunk is built (we know there is more
   * audio coming) or in finish() — possibly merged with a tiny tail.
   *
   * Why: short trailing chunks like "Verstanden?" (1 word, ~11 chars) get
   * rendered as standalone utterances with their own sentence-final
   * intonation envelope. They sound detached from the preceding speech,
   * even after the server-side tail-silence fix made them no longer
   * "rushed". The merge fixes this perceptual seam — confirmed in the
   * 2026-05-02 quality lab matrix on DE Innere Freiheit (qwen3).
   */
  private heldEmission: string | null;

  constructor(languageId = 'english') {
    const { params } = getLanguageParameters(languageId);
    this.params = params;
    this.currentBuffer = '';
    this.sentenceQueue = [];
    this.currentChunkIndex = 1;
    this.heldEmission = null;
  }

  async processChunk(text: string, streamingCallback: (chunk: string) => Promise<void>): Promise<void> {
    if (!text) return;
    this.currentBuffer += text;
    this.extractSentences(false);

    while (this.canEmit()) {
      await this.emitNextChunk(streamingCallback);
    }
  }

  async finish(streamingCallback: (chunk: string) => Promise<void>): Promise<void> {
    this.extractSentences(true);

    // Build remaining chunks but COLLECT them rather than emitting directly,
    // so the tail-merge logic below can decide whether to fold a tiny final
    // chunk into its predecessor.
    const remainingChunks: string[] = [];
    while (this.sentenceQueue.length > 0) {
      const parts = this.buildChunk();
      remainingChunks.push(...parts);
      this.currentChunkIndex++;
    }

    // Tail-merge: if the final emission would be < TAIL_MERGE_THRESHOLD chars,
    // merge it into the previous emission. The "previous" is either another
    // entry in remainingChunks OR the heldEmission carried over from streaming.
    const TAIL_MERGE_THRESHOLD = 80;
    // Worst-case merge: a max-sized predecessor + a threshold-sized tail.
    // For DE this is 260 + 80 = 340 (under 500 gateway cap); for EN it is
    // 280 + 80 = 360 (under 600). Safety bound that never blows the cap.
    const maxMerged = this.params.maxChars + TAIL_MERGE_THRESHOLD;

    if (remainingChunks.length > 0) {
      const lastIdx = remainingChunks.length - 1;
      const tail = remainingChunks[lastIdx];
      if (tail.length < TAIL_MERGE_THRESHOLD) {
        if (remainingChunks.length >= 2) {
          const prev = remainingChunks[lastIdx - 1];
          const merged = `${prev.trimEnd()} ${tail.trimStart()}`;
          if (merged.length <= maxMerged) {
            remainingChunks.splice(lastIdx - 1, 2, merged);
          }
        } else if (this.heldEmission !== null) {
          const merged = `${this.heldEmission.trimEnd()} ${tail.trimStart()}`;
          if (merged.length <= maxMerged) {
            this.heldEmission = merged;
            remainingChunks.pop();
          }
        }
      }
    }

    // Flush held first (in original streaming order), then any remaining.
    if (this.heldEmission !== null) {
      await streamingCallback(this.heldEmission);
      this.heldEmission = null;
    }
    for (const part of remainingChunks) {
      await streamingCallback(part);
    }

    this.reset();
  }

  reset(): void {
    this.currentBuffer = '';
    this.sentenceQueue = [];
    this.currentChunkIndex = 1;
    this.heldEmission = null;
  }

  /**
   * During streaming: check if queued sentences are ready to emit.
   *
   * Per the 2026-04-17 F5 sweep: clean-output zone is 140–300 chars; lower
   * (50–95) renders ~10% fast. Chunks below 140 are why live audio felt
   * rushed at the start. We hold both early chunks to the 140 floor so they
   * stay in the validated zone — pays ~0.3–0.7s extra TTFA on chunk 1 in
   * exchange for matching the prosody quality of pre-rendered audio.
   *
   * Chunks 1+2: 140 chars (bottom of F5 clean zone).
   * Chunks 3+:  200 chars (targetChars — sweet spot).
   */
  private canEmit(): boolean {
    if (this.sentenceQueue.length === 0) return false;

    let total = 0;
    for (const s of this.sentenceQueue) {
      total += s.length;
    }

    if (this.currentChunkIndex <= 2) {
      return total >= this.params.minChars + 60;
    }

    return total >= this.params.targetChars;
  }

  /**
   * Build a chunk from queued sentences and emit (or hold) via callback.
   * Each part becomes a separate TTS call.
   *
   * Chunk 1 emits immediately to preserve TTFA — first audio reaches the
   * user as soon as the chunker has 140 chars.
   *
   * Chunks 2+ are held one step in `heldEmission` so finish() can fold a
   * tiny tail into them. The held chunk gets flushed when the next chunk
   * is built (proves there's more audio coming, no merge needed) or in
   * finish() (where the tail-merge decision happens).
   */
  private async emitNextChunk(streamingCallback: (chunk: string) => Promise<void>): Promise<void> {
    const parts = this.buildChunk();
    for (const part of parts) {
      if (this.currentChunkIndex === 1) {
        await streamingCallback(part);
      } else {
        if (this.heldEmission !== null) {
          await streamingCallback(this.heldEmission);
        }
        this.heldEmission = part;
      }
    }
    this.currentChunkIndex++;
  }

  /**
   * Accumulate complete sentences toward a per-chunk target.
   * Targets match canEmit() thresholds:
   *   Chunks 1+2: minChars + 60 (~140) — bottom of F5 clean zone
   *   Chunks 3+:  targetChars (~200)   — sweet spot for inference
   * Hard-stop at maxChars; oversized single sentences split at clause boundaries.
   * Returns array — usually 1 item.
   */
  private buildChunk(): string[] {
    if (this.sentenceQueue.length === 0) return [];

    const { minChars, targetChars, maxChars } = this.params;

    const chunkTarget = this.currentChunkIndex <= 2
      ? minChars + 60
      : targetChars;

    let accumulated = '';
    let count = 0;

    for (let i = 0; i < this.sentenceQueue.length; i++) {
      const candidate = accumulated + this.sentenceQueue[i];

      // Would exceed maxChars — stop if we already have enough
      if (candidate.length > maxChars && count > 0 && accumulated.length >= minChars) {
        break;
      }

      accumulated = candidate;
      count++;

      // Reached or exceeded per-chunk target — stop accumulating
      if (accumulated.length >= chunkTarget) break;

      // Hard stop at maxChars
      if (accumulated.length >= maxChars) break;
    }

    this.sentenceQueue.splice(0, count);
    return this.splitIfOversized(accumulated);
  }

  private extractSentences(flushAll: boolean): void {
    const text = this.currentBuffer;
    const pattern = /([^.!?。！？]+[.!?。！？])([\s\n]*)/g;

    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const sentenceRaw = match[1] + match[2];
      this.sentenceQueue.push(sentenceRaw);
      lastIndex = pattern.lastIndex;
    }

    if (flushAll) {
      const leftover = text.slice(lastIndex);
      if (leftover.trim()) {
        this.sentenceQueue.push(leftover);
      }
      this.currentBuffer = '';
    } else {
      this.currentBuffer = text.slice(lastIndex);
    }
  }

  /**
   * Split text exceeding maxChars at clause boundaries (comma, semicolon, colon, dash).
   * Each part becomes a separate TTS call. Never cuts mid-word.
   */
  private splitIfOversized(text: string): string[] {
    if (text.length <= this.params.maxChars) return [text];

    const { maxChars } = this.params;
    const result: string[] = [];
    let remaining = text;

    while (remaining.length > maxChars) {
      let splitAt = -1;
      const clauseBreaks = [',', ';', ':', '\u2013', '\u2014'];

      // Search backwards from maxChars for a clause boundary
      for (let i = maxChars; i >= maxChars * 0.4; i--) {
        if (clauseBreaks.includes(remaining.charAt(i))) {
          splitAt = i;
          break;
        }
      }

      // Fallback: split at nearest space
      if (splitAt < 0) {
        for (let i = maxChars; i >= maxChars * 0.4; i--) {
          if (remaining.charAt(i) === ' ') {
            splitAt = i;
            break;
          }
        }
      }

      if (splitAt < 0) {
        // No good split point — emit as-is (rare: single very long word)
        result.push(remaining.trim());
        remaining = '';
        break;
      }

      result.push(remaining.slice(0, splitAt + 1).trimEnd());
      remaining = remaining.slice(splitAt + 1).trimStart();
    }

    if (remaining.trim()) {
      result.push(remaining.trim());
    }

    return result;
  }
}