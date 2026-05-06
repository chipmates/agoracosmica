// ForewordModal.tsx - Modal to display figure's foreword with audio
import React, { FC, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CloseButton } from '../Button';
import { useForeword } from '../../hooks/useForeword';
import { useTranslation } from '../../hooks/useTranslation';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Play, Pause, SpeakerSimpleHigh, Info, Scroll } from '@phosphor-icons/react';
import './ForewordModal.css';

interface ForewordModalProps {
  figureId: string;
  figureName?: string;
  onClose: () => void;
}

/**
 * ForewordModal - Modal showing the figure's foreword/listener's guide
 * Features text content with optional audio playback
 */
export const ForewordModal: FC<ForewordModalProps> = ({
  figureId,
  figureName,
  onClose
}) => {
  const { tString } = useTranslation();
  const trapRef = useFocusTrap({ onClose });
  const { foreword, loading, error } = useForeword(figureId);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [foreword]);

  // Stop audio when modal closes
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper to render content via portal
  const renderModal = (content: React.ReactNode) => {
    return createPortal(content, document.body);
  };

  if (loading) {
    return renderModal(
      <div className="foreword-modal-container">
        <div className="foreword-modal">
          <div className="foreword-modal__loading">
            <div className="foreword-modal__spinner" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !foreword) {
    return renderModal(
      <div className="foreword-modal-container">
        <div className="foreword-modal">
          <div className="foreword-modal__header">
            <CloseButton onClick={onClose} />
          </div>
          <div className="foreword-modal__error">
            <Info size={32} />
            <p>{tString('foreword.notAvailable', 'Foreword not available for this figure.')}</p>
          </div>
        </div>
      </div>
    );
  }

  return renderModal(
    <div className="foreword-modal-container">
      <div className="foreword-modal" ref={trapRef} role="dialog" aria-modal="true" aria-label={tString('audioLibrary.foreword', 'Foreword')} tabIndex={-1}>
        {/* Header */}
        <div className="foreword-modal__header">
          <div className="foreword-modal__title-group">
            <h1 className="foreword-modal__title">
              <Scroll size={20} weight="duotone" />
              {tString('audioLibrary.foreword', 'Foreword')}
            </h1>
            {figureName && (
              <p className="foreword-modal__subtitle">{figureName}</p>
            )}
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {/* Audio Player */}
        {foreword.audioUrl && (
          <div className="foreword-modal__player">
            <audio ref={audioRef} src={foreword.audioUrl} preload="metadata" />

            <button
              className="foreword-modal__play-btn"
              onClick={togglePlayback}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={20} weight="fill" />
              ) : (
                <Play size={20} weight="fill" />
              )}
            </button>

            <div className="foreword-modal__progress">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="foreword-modal__slider"
              />
              <div className="foreword-modal__time">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {isPlaying && (
              <SpeakerSimpleHigh size={18} className="foreword-modal__speaker" />
            )}
          </div>
        )}

        {/* Content */}
        <div className="foreword-modal__content scrollbar-gold">
          <div className="foreword-modal__text">
            {foreword.text.split('\n\n').map((paragraph, idx) => (
              paragraph.trim() ? <p key={idx}>{paragraph}</p> : null
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForewordModal;
