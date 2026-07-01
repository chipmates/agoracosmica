// React island: a lean, premium audio player for the landing-lab sample cards.
//
// Contract for the bake-off:
//  - Static first paint: the button + bar render in server HTML; JS only wires
//    playback. No autoplay, no LCP cost (client:visible).
//  - One at a time: a module-level controller pauses whatever else is playing
//    before starting, so four sample players never talk over each other.
//  - Taste, not the whole meal: when tasteSeconds is set, playback stops at
//    that mark and the card reveals a "hear the whole thing" continuation, so
//    the sample whets without giving away the full chapter on the landing.
//  - webm (Opus) primary, mp3 fallback for iOS Safari.

import { useEffect, useRef, useState } from 'react';

interface Props {
  audioWebm: string;
  audioMp3: string;
  /** idle button label, e.g. "Play Chapter 1" */
  label: string;
  /** display duration for the idle state, e.g. "13:54" */
  duration: string;
  /** cap playback to a taste; omit to allow the full piece */
  tasteSeconds?: number;
  /** where "hear the whole thing" points once the taste ends */
  continueHref?: string;
  continueLabel?: string;
  /** visual size hint */
  variant?: 'default' | 'compact';
}

// One shared "stop the current player" handle across every island instance.
let stopCurrent: (() => void) | null = null;

// Called by the parent (LabLibrary) when switching tabs. Panels no longer
// unmount on switch (all six are server-rendered for crawlability), so a
// playing sample must be paused explicitly instead of being torn down.
export function stopAllSamples(): void {
  if (stopCurrent) stopCurrent();
}

function pickSource(webm: string, mp3: string): string {
  if (typeof document === 'undefined') return webm;
  const a = document.createElement('audio');
  const canWebm = a.canPlayType('audio/webm; codecs="opus"') || a.canPlayType('audio/webm');
  return canWebm ? webm : mp3;
}

function fmt(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function LabSamplePlayer({
  audioWebm,
  audioMp3,
  label,
  duration,
  tasteSeconds,
  continueHref,
  continueLabel,
  variant = 'default',
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'playing' | 'paused' | 'ended'>('idle');
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    return () => {
      // Tear down on unmount so a backgrounded page stops audio.
      const el = audioRef.current;
      if (el) {
        el.pause();
        el.src = '';
      }
      if (stopCurrent && status === 'playing') stopCurrent = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ensureAudio(): HTMLAudioElement {
    if (audioRef.current) return audioRef.current;
    const el = new Audio();
    el.preload = 'none';
    el.src = pickSource(audioWebm, audioMp3);
    el.addEventListener('timeupdate', () => {
      const t = el.currentTime;
      setCurrent(t);
      if (tasteSeconds && t >= tasteSeconds) {
        el.pause();
        el.currentTime = 0;
        setStatus('ended');
      }
    });
    el.addEventListener('loadedmetadata', () => {
      setTotal(tasteSeconds ? Math.min(tasteSeconds, el.duration) : el.duration);
    });
    el.addEventListener('ended', () => setStatus('ended'));
    audioRef.current = el;
    return el;
  }

  function toggle() {
    const el = ensureAudio();
    if (status === 'playing') {
      el.pause();
      setStatus('paused');
      stopCurrent = null;
      return;
    }
    // Pause any other island first.
    if (stopCurrent) stopCurrent();
    if (status === 'ended') el.currentTime = 0;
    void el.play().then(() => setStatus('playing')).catch(() => setStatus('paused'));
    stopCurrent = () => {
      el.pause();
      setStatus('paused');
    };
  }

  const playing = status === 'playing';
  const ended = status === 'ended';
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const showContinue = ended && !!continueHref;

  // CSP-safe progress width: set via CSSOM (JS) so no inline style="" attribute
  // is ever emitted in server HTML (a strict style-src would block that).
  useEffect(() => {
    const el = fillRef.current;
    if (el) el.style.width = `${pct}%`;
  }, [pct]);

  return (
    <div className={`lab-player lab-player--${variant} ${playing ? 'is-on' : ''}`}>
      <button
        type="button"
        className="lab-player__btn"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? 'Playing, pause' : status === 'paused' ? 'Playing, resume' : label}
      >
        <span className="lab-player__icon" aria-hidden="true">
          {playing ? (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M4 3h3v10H4zM9 3h3v10H9z" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M4 3l9 5-9 5z" /></svg>
          )}
        </span>
        <span className="lab-player__label">{playing || status === 'paused' ? 'Playing' : label}</span>
      </button>

      <div className="lab-player__track" aria-hidden="true">
        <div ref={fillRef} className="lab-player__fill" />
      </div>

      <span className="lab-player__time">
        {status === 'idle' ? duration : `${fmt(current)} / ${fmt(total)}`}
      </span>

      {showContinue && (
        <a
          className="lab-player__continue"
          href={continueHref}
          {...(continueHref?.startsWith('/app') ? { 'data-agc-cta': 'start-exploring' } : {})}
        >
          {continueLabel ?? 'Hear the whole thing'}
        </a>
      )}
    </div>
  );
}
