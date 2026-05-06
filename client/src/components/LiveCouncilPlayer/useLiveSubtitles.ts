import { useState, useEffect, useRef } from 'react';
import { getShortDisplayName } from '../../data/councilCatalog';
import useTranslation from '../../hooks/useTranslation';
import type { AudioPlaybackInfo } from '../../stores/slices/domainTypes';

interface LiveSubtitleState {
  visibleText: string;
  speakerName: string;
}

// Words revealed per tick — 3 matches natural speech phrase rhythm (~700ms intervals)
const WORDS_PER_TICK = 3;

// Clamp tick interval to reasonable speech bounds
const MIN_MS_PER_TICK = 300;   // fastest reveal
const MAX_MS_PER_TICK = 1000;  // slowest reveal

/**
 * WPM-based typewriter subtitles synced to audio playback.
 *
 * Reveals 2 words per tick, timed to the segment's actual speech rate.
 * Works with any TTS provider — no timestamps needed.
 *
 * The component renders visibleText in a fixed-height container with
 * CSS bottom-anchoring + mask fade for a clean scrolling effect.
 */
export function useLiveSubtitles(
  speaker: string | null,
  audioPlayback: AudioPlaybackInfo | null
): LiveSubtitleState {
  const [wordCount, setWordCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPlaybackIdRef = useRef<string | null>(null);

  const { tString } = useTranslation();
  const shortName = getShortDisplayName(speaker ?? undefined);
  // i18n: localized "Echo of {name}" / "Echo von {name}". Same pattern used in
  // AudioLibrary/NowPlayingView.tsx + StoryCollection.tsx.
  const speakerName = shortName !== 'Unknown'
    ? tString('figures.echoOfName', `Echo of ${shortName}`).replace('{name}', shortName)
    : '';

  const text = audioPlayback?.content ?? '';
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  // Unique per segment: combine speakerId + startedAt to detect same-speaker consecutive segments
  const playbackId = audioPlayback
    ? `${audioPlayback.speakerId ?? ''}_${audioPlayback.startedAt ?? 0}`
    : null;

  // Calculate tick interval: duration / (wordCount / wordsPerTick)
  const totalTicks = Math.ceil(words.length / WORDS_PER_TICK);
  const msPerTick = (audioPlayback && totalTicks > 0)
    ? Math.max(MIN_MS_PER_TICK, Math.min(
        (audioPlayback.duration * 1000) / totalTicks,
        MAX_MS_PER_TICK
      ))
    : 500;

  // Start/reset word reveal timer on new audio segment
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // No audio → clear
    if (!audioPlayback || words.length === 0) {
      setWordCount(0);
      prevPlaybackIdRef.current = null;
      return;
    }

    // Same segment still playing → don't restart
    if (playbackId === prevPlaybackIdRef.current) return;
    prevPlaybackIdRef.current = playbackId;

    // New segment: show first batch immediately
    setWordCount(WORDS_PER_TICK);

    if (words.length > WORDS_PER_TICK) {
      const totalWords = words.length;
      intervalRef.current = setInterval(() => {
        setWordCount(prev => {
          const next = prev + WORDS_PER_TICK;
          if (next >= totalWords) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            return totalWords;
          }
          return next;
        });
      }, msPerTick);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [playbackId]); // eslint-disable-line react-hooks/exhaustive-deps

  // No audio → no subtitle
  if (!audioPlayback || words.length === 0) {
    return { visibleText: '', speakerName };
  }

  const safeCount = Math.min(wordCount, words.length);
  const visibleText = words.slice(0, safeCount).join(' ');

  return { visibleText, speakerName };
}
