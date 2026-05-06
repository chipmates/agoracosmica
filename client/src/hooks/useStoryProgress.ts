/**
 * useStoryProgress - Track per-story listening progress for Audio Library
 *
 * Reads progress from localStorage (storyProgress_{figureId}_{seedId}_{language})
 * and completion from storageKeysV2. Updates in real-time via the
 * storyProgressUpdated CustomEvent (dispatched every 5s during playback).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { isStoryCompleted } from '../utils/storageKeysV2';

type StoryProgressState =
  | { status: 'not-started' }
  | { status: 'in-progress'; percentage: number }
  | { status: 'completed' };

type StoryProgressMap = Record<string, StoryProgressState>;

interface StoryInfo {
  id: string;
  seedId: string;
  duration?: number;
}

function readStoryProgress(
  figureId: string,
  story: StoryInfo,
  language: string
): StoryProgressState {
  if (isStoryCompleted(figureId, story.seedId)) {
    return { status: 'completed' };
  }

  try {
    const key = `storyProgress_${figureId}_${story.seedId}_${language}`;
    const raw = localStorage.getItem(key);
    if (!raw) return { status: 'not-started' };

    const data = JSON.parse(raw) as { lastTimeSeconds?: number };
    if (data.lastTimeSeconds == null || data.lastTimeSeconds <= 0) {
      return { status: 'not-started' };
    }

    if (!story.duration || story.duration <= 0) {
      return { status: 'in-progress', percentage: 15 };
    }

    const pct = Math.min(
      Math.round((data.lastTimeSeconds / story.duration) * 100),
      99
    );
    return { status: 'in-progress', percentage: Math.max(pct, 1) };
  } catch {
    return { status: 'not-started' };
  }
}

export function useStoryProgress(
  figureId: string,
  stories: StoryInfo[],
  language: string
): StoryProgressMap {
  const buildMap = useCallback((): StoryProgressMap => {
    if (!figureId || stories.length === 0) return {};
    const map: StoryProgressMap = {};
    for (const story of stories) {
      map[story.id] = readStoryProgress(figureId, story, language);
    }
    return map;
  }, [figureId, stories, language]);

  const [progressMap, setProgressMap] = useState<StoryProgressMap>(buildMap);

  // Keep a ref to stories for the event handler (avoid stale closure)
  const storiesRef = useRef(stories);
  storiesRef.current = stories;
  const figureIdRef = useRef(figureId);
  figureIdRef.current = figureId;
  const languageRef = useRef(language);
  languageRef.current = language;

  // Re-read all progress when figure/stories/language change
  useEffect(() => {
    setProgressMap(buildMap());
  }, [buildMap]);

  // Listen for real-time progress updates
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.key) return;

      // Parse key: storyProgress_{figureId}_{seedId}_{language}
      const parts = (detail.key as string).split('_');
      if (parts.length < 4 || parts[0] !== 'storyProgress') return;

      const keyFigureId = parts[1];
      const keySeedId = parts[2];

      if (keyFigureId !== figureIdRef.current) return;

      const storyId = `${keyFigureId}-${keySeedId}`;
      const story = storiesRef.current.find(s => s.id === storyId);
      if (!story) return;

      const newState = readStoryProgress(
        figureIdRef.current,
        story,
        languageRef.current
      );

      setProgressMap(prev => {
        const prevState = prev[storyId];
        if (
          prevState &&
          prevState.status === newState.status &&
          (prevState.status !== 'in-progress' ||
            (newState.status === 'in-progress' &&
              prevState.percentage === newState.percentage))
        ) {
          return prev;
        }
        return { ...prev, [storyId]: newState };
      });
    };

    window.addEventListener('storyProgressUpdated', handler);
    return () => window.removeEventListener('storyProgressUpdated', handler);
  }, []);

  return progressMap;
}
