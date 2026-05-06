// src/hooks/useStoryHighlighting.ts
// Manages paragraph-level highlighting synchronized with audio playback

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { StoryTimestamps } from '../services/StoryService';

interface UseStoryHighlightingParams {
  currentTimeSeconds: number;
  isPlaying: boolean;
  timestamps: StoryTimestamps | undefined;
  paragraphCount: number;
}

interface UseStoryHighlightingResult {
  activeParagraphIndex: number | null;
  paragraphProgress: { current: number; total: number };
  seekToParagraph: (index: number) => number | null;
  isHighlightingAvailable: boolean;
}

/**
 * Binary search to find which paragraph contains the given time.
 * Returns the paragraph index, or null if not found.
 */
function findActiveParagraph(
  paragraphs: StoryTimestamps['paragraphs'],
  timeSeconds: number
): number | null {
  if (paragraphs.length === 0) return null;

  // Before first paragraph
  if (timeSeconds < paragraphs[0].start) return null;

  // After last paragraph — keep last one active
  const last = paragraphs[paragraphs.length - 1];
  if (timeSeconds >= last.end) return last.index;

  // Binary search
  let low = 0;
  let high = paragraphs.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const p = paragraphs[mid];

    if (timeSeconds >= p.start && timeSeconds < p.end) {
      return p.index;
    } else if (timeSeconds < p.start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  // Fallback: find nearest paragraph (handles small gaps between paragraphs)
  let closest = 0;
  let minDist = Infinity;
  for (let i = 0; i < paragraphs.length; i++) {
    const dist = Math.min(
      Math.abs(timeSeconds - paragraphs[i].start),
      Math.abs(timeSeconds - paragraphs[i].end)
    );
    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }
  return paragraphs[closest].index;
}

const useStoryHighlighting = ({
  currentTimeSeconds,
  isPlaying,
  timestamps,
  paragraphCount
}: UseStoryHighlightingParams): UseStoryHighlightingResult => {
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const hasPlayedRef = useRef<boolean>(false);

  const isHighlightingAvailable = useMemo(
    () => !!timestamps && timestamps.paragraphs.length > 0,
    [timestamps]
  );

  // Track whether audio has been played at least once
  useEffect(() => {
    if (isPlaying) {
      hasPlayedRef.current = true;
    }
  }, [isPlaying]);

  // Update active paragraph based on current time
  useEffect(() => {
    if (!isHighlightingAvailable || !timestamps) return;

    // Hysteresis: only update if time changed by >100ms to prevent flickering
    if (Math.abs(currentTimeSeconds - lastUpdateTimeRef.current) < 0.1) return;
    lastUpdateTimeRef.current = currentTimeSeconds;

    const newIndex = findActiveParagraph(timestamps.paragraphs, currentTimeSeconds);
    setActiveParagraphIndex(prev => {
      if (prev === newIndex) return prev;
      return newIndex;
    });
  }, [currentTimeSeconds, timestamps, isHighlightingAvailable]);

  // Reset when timestamps change (new story loaded)
  useEffect(() => {
    setActiveParagraphIndex(null);
    hasPlayedRef.current = false;
    lastUpdateTimeRef.current = 0;
  }, [timestamps]);

  const paragraphProgress = useMemo(() => ({
    current: activeParagraphIndex !== null ? activeParagraphIndex + 1 : 0,
    total: paragraphCount
  }), [activeParagraphIndex, paragraphCount]);

  const seekToParagraph = useCallback((index: number): number | null => {
    if (!timestamps || index < 0 || index >= timestamps.paragraphs.length) {
      return null;
    }
    return timestamps.paragraphs[index].start;
  }, [timestamps]);

  return {
    activeParagraphIndex: hasPlayedRef.current ? activeParagraphIndex : null,
    paragraphProgress,
    seekToParagraph,
    isHighlightingAvailable
  };
};

export default useStoryHighlighting;
