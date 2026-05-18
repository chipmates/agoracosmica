// src/hooks/useFigureTrailer.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPublicTrailerUrl } from '../utils/public/publicMediaUrl';

/**
 * Plays a figure's ~50-second page trailer (rendered audio, served from R2).
 *
 * Deliberately a standalone HTML5 <audio> player, decoupled from the
 * conversation/TTS audio pipeline — a figure trailer is one short clip, and a
 * minimal surface is the most predictable thing on mobile. Tap-to-play only,
 * never autoplay: play() runs inside the tap gesture, which is what iOS needs.
 */

// Each trailer is on R2 as both webm (~370 KB, Opus) and mp3 (~2.1 MB). webm is
// ~6x smaller, so prefer it — but only when the browser is confident it can
// play webm audio. iOS Safari reports no confidence and so gets mp3, which is
// universally supported. Probed once and cached.
let cachedExt: 'webm' | 'mp3' | null = null;
function trailerExt(): 'webm' | 'mp3' {
  if (cachedExt) return cachedExt;
  let webm = false;
  try {
    const probe = document.createElement('audio');
    webm =
      probe.canPlayType('audio/webm; codecs="opus"') === 'probably' ||
      probe.canPlayType('audio/webm; codecs="vorbis"') === 'probably';
  } catch {
    webm = false;
  }
  cachedExt = webm ? 'webm' : 'mp3';
  return cachedExt;
}

export type TrailerStatus = 'idle' | 'loading' | 'playing' | 'error';

export interface FigureTrailerControls {
  /** Figure id whose trailer is currently active (loading or playing), or null. */
  activeId: string | null;
  status: TrailerStatus;
  /** Play this figure's trailer — or pause it if it is already this figure's. */
  toggle: (figureId: string, language: string) => void;
  /** Stop and reset — call on figure change, modal close, or unmount. */
  stop: () => void;
}

export function useFigureTrailer(): FigureTrailerControls {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<TrailerStatus>('idle');

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      try { audio.currentTime = 0; } catch { /* ignore — seek before load */ }
    }
    setActiveId(null);
    setStatus('idle');
  }, []);

  // Never leave a trailer playing behind a closed / unmounted modal.
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      audioRef.current = null;
    };
  }, []);

  const toggle = useCallback(
    (figureId: string, language: string) => {
      const audio = audioRef.current;

      // Tap on the figure that is already active → pause it.
      if (audio && activeId === figureId && status !== 'idle' && status !== 'error') {
        audio.pause();
        setStatus('idle');
        setActiveId(null);
        return;
      }

      const el = audio ?? new Audio();
      if (!audioRef.current) {
        el.preload = 'none';
        audioRef.current = el;
      }

      el.pause();
      el.onplaying = () => setStatus('playing');
      el.onended = () => { setStatus('idle'); setActiveId(null); };
      el.onerror = () => { setStatus('error'); setActiveId(null); };
      el.src = getPublicTrailerUrl(figureId, language === 'de' ? 'de' : 'en', trailerExt());

      setActiveId(figureId);
      setStatus('loading');

      // play() must run inside the tap gesture (iOS) — toggle is always an onClick.
      const result = el.play();
      if (result && typeof result.catch === 'function') {
        result.catch(() => { setStatus('error'); setActiveId(null); });
      }
    },
    [activeId, status]
  );

  return { activeId, status, toggle, stop };
}
