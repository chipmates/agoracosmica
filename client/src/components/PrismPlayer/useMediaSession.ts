/**
 * useMediaSession - Lock screen playback controls for PrismPlayer
 *
 * Sets up Media Session API: artwork (updates on speaker change),
 * title/artist metadata, play/pause/seek action handlers, and
 * position state for the lock screen seek bar.
 *
 * Used by both prisms and curated councils.
 */

import { useEffect, useRef } from 'react';
import { loadFigureImageV2, getBestImageFromMetadata } from '../../utils/imageLoaderV2';
import { getFullFigureName } from '../../services/audio/introduction/navigationHelper';

interface UseMediaSessionParams {
  title: string;
  figureId: string;
  isPlaying: boolean;
  currentTimeSeconds: number;
  durationSeconds: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
}

export function useMediaSession({
  title,
  figureId,
  isPlaying,
  currentTimeSeconds,
  durationSeconds,
  playbackRate,
  onTogglePlay,
  onSkipBack,
  onSkipForward,
}: UseMediaSessionParams): void {
  // Callback refs so action handlers always call the latest function
  const togglePlayRef = useRef(onTogglePlay);
  const skipBackRef = useRef(onSkipBack);
  const skipForwardRef = useRef(onSkipForward);
  togglePlayRef.current = onTogglePlay;
  skipBackRef.current = onSkipBack;
  skipForwardRef.current = onSkipForward;

  // Cache artwork URLs to avoid re-fetching when speakers alternate
  const artworkCacheRef = useRef<Map<string, string>>(new Map());

  // Effect 1: Register action handlers (once on mount, clear on unmount)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => togglePlayRef.current());
    navigator.mediaSession.setActionHandler('pause', () => togglePlayRef.current());

    try {
      navigator.mediaSession.setActionHandler('seekbackward', () => skipBackRef.current());
      navigator.mediaSession.setActionHandler('seekforward', () => skipForwardRef.current());
    } catch {
      // seekbackward/seekforward not supported in all browsers
    }

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      try {
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
      } catch { /* ignore */ }
      navigator.mediaSession.metadata = null;
    };
  }, []);

  // Effect 2: Update metadata + artwork on speaker/title change
  useEffect(() => {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    if (!figureId) return;

    let cancelled = false;

    const updateMetadata = (artistName: string, artworkUrl?: string) => {
      if (cancelled) return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || 'Agora Cosmica',
        artist: artistName || figureId,
        album: 'Agora Cosmica',
        ...(artworkUrl ? { artwork: [{ src: artworkUrl, sizes: '512x512', type: 'image/webp' }] } : {}),
      });
    };

    const cachedArtwork = artworkCacheRef.current.get(figureId);

    // Load full figure name + artwork in parallel
    const namePromise = getFullFigureName(figureId);
    const artworkPromise = cachedArtwork
      ? Promise.resolve(cachedArtwork)
      : loadFigureImageV2(figureId, 'thumbnail')
          .then(metadata => {
            if (!metadata || metadata.length === 0) return null;
            const bestImage = getBestImageFromMetadata(metadata, 512, 'webp');
            return bestImage?.primary || bestImage?.webp?.src || bestImage?.png?.src || null;
          })
          .catch(() => null);

    // Set metadata as soon as both resolve
    Promise.all([namePromise, artworkPromise]).then(([fullName, artworkUrl]) => {
      if (cancelled) return;
      if (artworkUrl && !cachedArtwork) {
        artworkCacheRef.current.set(figureId, artworkUrl);
      }
      updateMetadata(fullName, artworkUrl ?? undefined);
    });

    return () => { cancelled = true; };
  }, [figureId, title]);

  // Effect 3: Sync playback state + position
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    if (durationSeconds > 0 && isFinite(durationSeconds) && 'setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({
          duration: durationSeconds,
          playbackRate,
          position: Math.min(Math.max(0, currentTimeSeconds), durationSeconds),
        });
      } catch {
        // Can throw if position > duration due to timing races
      }
    }
  }, [isPlaying, currentTimeSeconds, durationSeconds, playbackRate]);
}
