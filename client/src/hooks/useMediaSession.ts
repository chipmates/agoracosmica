/**
 * useMediaSession - OS / lock screen playback controls for any player.
 *
 * Sets up the Media Session API: artwork, title/artist metadata, transport
 * action handlers, and position state for the lock screen seek bar.
 *
 * A document has exactly one Media Session, so ownership is arbitrated here.
 * Several players can be mounted at once (a story behind an open Audio
 * Library, a foreword modal over a story). The one that is actually sounding
 * claims the session; the others go quiet without touching it. Without this,
 * a player mounting in the background would wipe the controls of the player
 * you can hear.
 */

import { useEffect, useRef, useState } from 'react';
import { loadFigureImageV2, getBestImageFromMetadata } from '../utils/imageLoaderV2';
import { getFullFigureName } from '../services/audio/introduction/navigationHelper';
import { useTranslation } from './useTranslation';

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
  /** Absolute seek in seconds, from the lock screen scrubber. */
  onSeekTo?: (seconds: number) => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
  /** Set false while this surface has nothing playable (closed modal, no track). */
  enabled?: boolean;
}

type OwnerToken = Record<string, never>;
type OwnerListener = (owner: OwnerToken | null) => void;

const ownerListeners = new Set<OwnerListener>();
let sessionOwner: OwnerToken | null = null;

function claimSession(token: OwnerToken): void {
  if (sessionOwner === token) return;
  sessionOwner = token;
  ownerListeners.forEach(listener => listener(token));
}

function releaseSession(token: OwnerToken): void {
  if (sessionOwner !== token) return;
  sessionOwner = null;
  ownerListeners.forEach(listener => listener(null));
}

function isSupported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

function setHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null): void {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Not every browser supports every action.
  }
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
  onSeekTo,
  onPreviousTrack,
  onNextTrack,
  enabled = true,
}: UseMediaSessionParams): void {
  const { language } = useTranslation();

  // Stable identity for this player instance
  const tokenRef = useRef<OwnerToken>({} as OwnerToken);
  const [isOwner, setIsOwner] = useState(false);

  // Callback refs so action handlers always call the latest function
  const togglePlayRef = useRef(onTogglePlay);
  const skipBackRef = useRef(onSkipBack);
  const skipForwardRef = useRef(onSkipForward);
  const seekToRef = useRef(onSeekTo);
  const previousTrackRef = useRef(onPreviousTrack);
  const nextTrackRef = useRef(onNextTrack);
  togglePlayRef.current = onTogglePlay;
  skipBackRef.current = onSkipBack;
  skipForwardRef.current = onSkipForward;
  seekToRef.current = onSeekTo;
  previousTrackRef.current = onPreviousTrack;
  nextTrackRef.current = onNextTrack;

  // Cache artwork URLs to avoid re-fetching when speakers alternate
  const artworkCacheRef = useRef<Map<string, string>>(new Map());

  // Effect 1: subscribe to ownership changes, hand the session back on unmount.
  // Declared first so its cleanup runs before the handler cleanup below.
  useEffect(() => {
    const token = tokenRef.current;
    const listener: OwnerListener = owner => setIsOwner(owner === token);
    ownerListeners.add(listener);
    return () => {
      ownerListeners.delete(listener);
      releaseSession(token);
    };
  }, []);

  // Effect 2: claim the session while sounding, or while nobody holds it
  useEffect(() => {
    if (!isSupported()) return;
    const token = tokenRef.current;

    if (!enabled) {
      releaseSession(token);
      return;
    }

    if (isPlaying || sessionOwner === null) {
      claimSession(token);
      setIsOwner(true);
    }
  }, [enabled, isPlaying]);

  // Track-change handlers are optional, so registration keys off their
  // presence rather than the identity of an inline arrow.
  const hasPreviousTrack = Boolean(onPreviousTrack);
  const hasNextTrack = Boolean(onNextTrack);

  // Effect 3: register action handlers while we own the session
  useEffect(() => {
    if (!isSupported() || !isOwner) return;

    setHandler('play', () => togglePlayRef.current());
    setHandler('pause', () => togglePlayRef.current());
    setHandler('seekbackward', () => skipBackRef.current());
    setHandler('seekforward', () => skipForwardRef.current());
    setHandler('seekto', details => {
      const target = details.seekTime;
      if (typeof target === 'number') seekToRef.current?.(target);
    });
    setHandler('previoustrack', hasPreviousTrack ? () => previousTrackRef.current?.() : null);
    setHandler('nexttrack', hasNextTrack ? () => nextTrackRef.current?.() : null);

    return () => {
      // On handover the next owner installs its own handlers, so only wipe the
      // session when nobody took it over.
      if (sessionOwner !== null) return;
      setHandler('play', null);
      setHandler('pause', null);
      setHandler('seekbackward', null);
      setHandler('seekforward', null);
      setHandler('seekto', null);
      setHandler('previoustrack', null);
      setHandler('nexttrack', null);
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    };
  }, [isOwner, hasPreviousTrack, hasNextTrack]);

  // Effect 4: metadata + artwork
  useEffect(() => {
    if (!isSupported() || !isOwner) return;
    if (typeof MediaMetadata === 'undefined' || !figureId) return;

    let cancelled = false;

    const updateMetadata = (artistName: string, artworkUrl?: string) => {
      if (cancelled) return;
      // Lock-screen metadata travels without app context, so the artist
      // line itself carries the AI disclosure. Catalog names already carry
      // an "Echo of/von" prefix, so unwrap it before adding the AI variant.
      const figureName = (artistName || figureId).replace(/^Echo (of|von) /i, '');
      const artist = language === 'de'
        ? `KI-Echo von ${figureName}`
        : `AI Echo of ${figureName}`;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || 'Agora Cosmica',
        artist,
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
  }, [isOwner, figureId, title, language]);

  // Effect 5: playback state + position
  useEffect(() => {
    if (!isSupported() || !isOwner) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    if (durationSeconds > 0 && isFinite(durationSeconds) && 'setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({
          duration: durationSeconds,
          playbackRate: playbackRate > 0 ? playbackRate : 1,
          position: Math.min(Math.max(0, currentTimeSeconds), durationSeconds),
        });
      } catch {
        // Can throw if position > duration due to timing races
      }
    }
  }, [isOwner, isPlaying, currentTimeSeconds, durationSeconds, playbackRate]);
}

export default useMediaSession;
