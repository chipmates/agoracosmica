// Simple audio player for public page samples
// No TTS, no AudioContext, no circuit breaker
// Remove this file when stripping marketing pages from a fork

import { useState, useRef, useCallback } from 'react';
import { usePublicLang } from './PublicLangContext';

interface PublicAudioPlayerProps {
  audioUrl: string;
  label: string;
}

export default function PublicAudioPlayer({ audioUrl, label }: PublicAudioPlayerProps) {
  const { t } = usePublicLang();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => setError(true));
    }
  }, [playing]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress((audio.currentTime / audio.duration) * 100);
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * audio.duration;
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (error) return null;

  return (
    <div className="pub-audio" role="region" aria-label={label}>
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onError={() => setError(true)}
      />

      <button
        className="pub-audio__play"
        onClick={togglePlay}
        aria-label={playing ? t('audio.pause') : t('audio.play')}
      >
        {playing ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <rect x="4" y="3" width="4" height="14" rx="1" />
            <rect x="12" y="3" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 3.5v13l11-6.5z" />
          </svg>
        )}
      </button>

      <div
        className="pub-audio__track"
        onClick={handleSeek}
        role="slider"
        aria-label="Audio progress"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
      >
        <div className="pub-audio__progress" style={{ width: `${progress}%` }} />
      </div>

      {duration > 0 && (
        <span className="pub-audio__time">
          {formatTime((audioRef.current?.currentTime || 0))} / {formatTime(duration)}
        </span>
      )}
    </div>
  );
}
