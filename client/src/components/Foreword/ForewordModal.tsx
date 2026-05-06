// ForewordModal.tsx - Modal to display figure's foreword with audio
import React, { FC, ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { CloseButton } from '../Button';
import { useForeword } from '../../hooks/useForeword';
import { useTranslation } from '../../hooks/useTranslation';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import useAudio from '../../hooks/useAudio';
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

  // useAudio (rather than a declarative <audio> tag) — iOS Safari produces
  // silent playback on the first tap unless audio data is preloaded and
  // load() is called explicitly. The hook handles both, and matches how
  // StoryAudioPlayer drives playback for stories from the same R2 bucket.
  const {
    isPlaying,
    progress,
    currentTime,
    duration,
    togglePlay,
    seek,
  } = useAudio(foreword?.audioUrl ?? null, {
    autoplay: false,
    initialVolume: 1.0,
  });

  const handleSeek = (e: ChangeEvent<HTMLInputElement>): void => {
    seek(parseFloat(e.target.value));
  };

  const renderModal = (content: React.ReactNode): React.ReactPortal =>
    createPortal(content, document.body);

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
            <button
              className="foreword-modal__play-btn"
              onClick={togglePlay}
              aria-label={isPlaying ? tString('audioLibrary.controls.pause', 'Pause') : tString('audioLibrary.controls.play', 'Play')}
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
                max={100}
                step={0.1}
                value={isNaN(progress) ? 0 : progress}
                onChange={handleSeek}
                className="foreword-modal__slider"
                aria-label={tString('audioLibrary.controls.progress', 'Progress')}
              />
              <div className="foreword-modal__time">
                <span>{currentTime}</span>
                <span>{duration}</span>
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
