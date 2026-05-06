/**
 * useSubtitleSync - Syncs character-level timestamps to word-level subtitles
 *
 * Takes prism segment data + current playback time → returns current subtitle state.
 * Character timestamps from ElevenLabs contain <break> tags that are filtered out.
 *
 * Sentence chunking: Groups words into 4-6 word chunks at natural break points
 * (sentence end, pause, max length) for trailer-style "one sentence at a time" display.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PrismSegmentWithOffset, PrismTimestamps } from '../../services/prism/PrismService';

interface WordBoundary {
  word: string;
  startTime: number;
  endTime: number;
}

export interface SentenceChunk {
  text: string;
  startTime: number;
  endTime: number;
  words: WordBoundary[];
}

export interface SubtitleState {
  /** Currently speaking segment */
  currentSegment: PrismSegmentWithOffset | null;
  /** Index of current segment */
  currentSegmentIndex: number;
  /** Speaker's figure ID (for image switching) */
  figureId: string;
  /** Speaker name (display) */
  speakerName: string;
  /** Current subtitle text (words spoken so far in current segment) */
  spokenText: string;
  /** Current word being spoken */
  currentWord: string;
  /** Full text of current segment */
  fullText: string;
  /** Progress within current segment (0-1) */
  segmentProgress: number;
  /** Active sentence chunk text (trailer-style display) */
  currentChunk: string;
  /** Index of current chunk within segment (for animation keying) */
  currentChunkIndex: number;
  /** True briefly when chunk changes (CSS animation trigger) */
  isChunkTransition: boolean;
}

const EMPTY_STATE: SubtitleState = {
  currentSegment: null,
  currentSegmentIndex: -1,
  figureId: '',
  speakerName: '',
  spokenText: '',
  currentWord: '',
  fullText: '',
  segmentProgress: 0,
  currentChunk: '',
  currentChunkIndex: -1,
  isChunkTransition: false,
};

const MAX_WORDS_PER_LINE = 6;
const MIN_WORDS_FOR_BREAK = 4;
const PAUSE_THRESHOLD_SECONDS = 0.3;

/**
 * Group word boundaries into sentence chunks (4-6 words).
 * Breaks at: sentence end (.!?), pause > 0.3s, or max 6 words.
 */
function buildChunks(wordBoundaries: WordBoundary[]): SentenceChunk[] {
  if (wordBoundaries.length === 0) return [];

  const chunks: SentenceChunk[] = [];
  let currentWords: WordBoundary[] = [];

  for (let i = 0; i < wordBoundaries.length; i++) {
    const wb = wordBoundaries[i];
    currentWords.push(wb);

    const wordCount = currentWords.length;
    const isLastWord = i === wordBoundaries.length - 1;
    const endsWithPunctuation = /[.!?]$/.test(wb.word);
    const nextWord = wordBoundaries[i + 1];
    const hasPause = nextWord ? (nextWord.startTime - wb.endTime) > PAUSE_THRESHOLD_SECONDS : false;

    const shouldBreak =
      isLastWord ||
      wordCount >= MAX_WORDS_PER_LINE ||
      (wordCount >= MIN_WORDS_FOR_BREAK && (endsWithPunctuation || hasPause));

    if (shouldBreak) {
      chunks.push({
        text: currentWords.map(w => w.word).join(' '),
        startTime: currentWords[0].startTime,
        endTime: currentWords[currentWords.length - 1].endTime,
        words: [...currentWords],
      });
      currentWords = [];
    }
  }

  return chunks;
}

/**
 * Parse character timestamps into clean text with timing,
 * filtering out <break> tags from ElevenLabs output.
 */
function parseTimestamps(timestamps: PrismTimestamps): {
  text: string;
  wordBoundaries: WordBoundary[];
  chunks: SentenceChunk[];
} {
  const chars = timestamps.characters;
  const starts = timestamps.character_start_times_seconds;
  const ends = timestamps.character_end_times_seconds;

  // Filter out <break> tags and reconstruct clean text with timing
  let cleanText = '';
  const charTimings: Array<{ char: string; start: number; end: number }> = [];
  let i = 0;

  while (i < chars.length) {
    // Detect <break> tag pattern
    if (chars[i] === '<') {
      // Skip until closing >
      while (i < chars.length && chars[i] !== '>') i++;
      i++; // skip the >
      continue;
    }
    cleanText += chars[i];
    charTimings.push({ char: chars[i], start: starts[i], end: ends[i] });
    i++;
  }

  // Group characters into words
  const wordBoundaries: WordBoundary[] = [];
  let currentWord = '';
  let wordStart = 0;
  let wordEnd = 0;

  for (let j = 0; j < charTimings.length; j++) {
    const ct = charTimings[j];
    if (ct.char === ' ' || ct.char === '\n') {
      if (currentWord.length > 0) {
        wordBoundaries.push({ word: currentWord, startTime: wordStart, endTime: wordEnd });
        currentWord = '';
      }
    } else {
      if (currentWord.length === 0) {
        wordStart = ct.start;
      }
      currentWord += ct.char;
      wordEnd = ct.end;
    }
  }
  // Last word
  if (currentWord.length > 0) {
    wordBoundaries.push({ word: currentWord, startTime: wordStart, endTime: wordEnd });
  }

  const chunks = buildChunks(wordBoundaries);

  return { text: cleanText.trim(), wordBoundaries, chunks };
}

export function useSubtitleSync(
  segments: PrismSegmentWithOffset[],
  currentTimeSeconds: number,
  timestampsBySegment: Map<number, PrismTimestamps>
): SubtitleState {
  const [state, setState] = useState<SubtitleState>(EMPTY_STATE);
  const parsedCacheRef = useRef<Map<number, ReturnType<typeof parseTimestamps>>>(new Map());
  const lastSegmentIndexRef = useRef(-1);
  const lastChunkIndexRef = useRef(-1);

  // Get parsed timestamps for a segment (cached)
  const getParsed = useCallback((segmentIndex: number): ReturnType<typeof parseTimestamps> | null => {
    if (parsedCacheRef.current.has(segmentIndex)) {
      return parsedCacheRef.current.get(segmentIndex)!;
    }
    const timestamps = timestampsBySegment.get(segmentIndex);
    if (!timestamps) return null;

    const parsed = parseTimestamps(timestamps);
    parsedCacheRef.current.set(segmentIndex, parsed);
    return parsed;
  }, [timestampsBySegment]);

  // Clear cache when timestamps change
  useEffect(() => {
    parsedCacheRef.current.clear();
  }, [timestampsBySegment]);

  // Update subtitle state on every time change (including seek-while-paused)
  useEffect(() => {
    if (segments.length === 0) return;

    // Find which segment contains the current time
    let currentSegment: PrismSegmentWithOffset | null = null;
    for (const seg of segments) {
      if (currentTimeSeconds >= seg.startOffset && currentTimeSeconds < seg.endOffset) {
        currentSegment = seg;
        break;
      }
    }

    // After last segment ends, show last segment's final state
    if (!currentSegment && currentTimeSeconds > 0) {
      const lastSeg = segments[segments.length - 1];
      if (currentTimeSeconds >= lastSeg.endOffset) {
        currentSegment = lastSeg;
      }
    }

    if (!currentSegment) {
      setState(EMPTY_STATE);
      return;
    }

    const segIndex = currentSegment.segmentIndex;
    const localTime = currentTimeSeconds - currentSegment.startOffset;
    const segmentProgress = Math.min(localTime / currentSegment.duration, 1);

    // Check if segment changed
    if (segIndex !== lastSegmentIndexRef.current) {
      lastSegmentIndexRef.current = segIndex;
      lastChunkIndexRef.current = -1;
    }

    // Try to get parsed timestamps for word-level sync
    const parsed = getParsed(segIndex);

    if (parsed && parsed.wordBoundaries.length > 0) {
      // Word-level subtitle sync (progressive, for transcript)
      let spokenWords: string[] = [];
      let currentWord = '';

      for (const wb of parsed.wordBoundaries) {
        if (localTime >= wb.startTime) {
          spokenWords.push(wb.word);
          if (localTime >= wb.startTime && localTime < wb.endTime) {
            currentWord = wb.word;
          }
        }
      }

      // If past the last word, mark all as spoken
      if (spokenWords.length === 0 && localTime > 0) {
        spokenWords = parsed.wordBoundaries.map(wb => wb.word);
      }

      // Chunk-level sync (cinematic display)
      let chunkText = '';
      let chunkIndex = -1;
      for (let ci = 0; ci < parsed.chunks.length; ci++) {
        const chunk = parsed.chunks[ci];
        if (localTime >= chunk.startTime) {
          chunkText = chunk.text;
          chunkIndex = ci;
        }
      }

      const isChunkTransition = chunkIndex !== lastChunkIndexRef.current && chunkIndex >= 0;
      lastChunkIndexRef.current = chunkIndex;

      setState({
        currentSegment,
        currentSegmentIndex: segIndex,
        figureId: currentSegment.figureId,
        speakerName: currentSegment.speaker,
        spokenText: spokenWords.join(' '),
        currentWord,
        fullText: parsed.text,
        segmentProgress,
        currentChunk: chunkText,
        currentChunkIndex: chunkIndex,
        isChunkTransition,
      });
    } else {
      // Fallback: show full segment text with progress-based reveal
      const text = currentSegment.text;
      const charCount = Math.floor(text.length * segmentProgress);

      setState({
        currentSegment,
        currentSegmentIndex: segIndex,
        figureId: currentSegment.figureId,
        speakerName: currentSegment.speaker,
        spokenText: text.substring(0, charCount),
        currentWord: '',
        fullText: text,
        segmentProgress,
        currentChunk: text.substring(0, charCount),
        currentChunkIndex: 0,
        isChunkTransition: false,
      });
    }
  }, [segments, currentTimeSeconds, getParsed]);

  return state;
}
