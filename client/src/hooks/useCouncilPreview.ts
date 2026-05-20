// src/hooks/useCouncilPreview.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPublicCouncilPreviewUrl } from '../utils/public/publicMediaUrl';

/**
 * Plays a council's ~50-second theme-page preview clip (rendered audio, served
 * from R2). Mirrors useFigureTrailer — a standalone HTML5 <audio> player,
 * decoupled from the in-app TTS pipeline, tap-to-play only, never autoplay.
 *
 * 50s matches the figure trailer length: with four voices in a council, a
 * shorter clip would land in the middle of an exchange and lose its hook.
 */

// Each preview is on R2 as both webm (Opus) and mp3. webm is much smaller, so
// prefer it — but only when the browser is confident it can play webm audio.
// iOS Safari reports no confidence and so gets mp3. Probed once and cached.
let cachedExt: 'webm' | 'mp3' | null = null;
function previewExt(): 'webm' | 'mp3' {
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

export type CouncilPreviewStatus = 'idle' | 'loading' | 'playing' | 'error';

export interface CouncilPreviewControls {
  /** Council id whose preview is currently active (loading or playing), or null. */
  activeId: string | null;
  status: CouncilPreviewStatus;
  /** Play this council's preview — or pause it if it is already this council's. */
  toggle: (councilId: string, language: string) => void;
  /** Stop and reset — call on page change or unmount. */
  stop: () => void;
}

export function useCouncilPreview(): CouncilPreviewControls {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<CouncilPreviewStatus>('idle');

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      try { audio.currentTime = 0; } catch { /* ignore — seek before load */ }
    }
    setActiveId(null);
    setStatus('idle');
  }, []);

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
    (councilId: string, language: string) => {
      const audio = audioRef.current;

      if (audio && activeId === councilId && status !== 'idle' && status !== 'error') {
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
      el.src = getPublicCouncilPreviewUrl(councilId, language === 'de' ? 'de' : 'en', previewExt());

      setActiveId(councilId);
      setStatus('loading');

      // play() must run inside the tap gesture (iOS).
      const result = el.play();
      if (result && typeof result.catch === 'function') {
        result.catch(() => { setStatus('error'); setActiveId(null); });
      }
    },
    [activeId, status]
  );

  return { activeId, status, toggle, stop };
}
