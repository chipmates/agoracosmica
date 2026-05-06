/**
 * LiveCouncilPlayer — Cinematic full-screen overlay for custom (live) councils.
 *
 * Display-only: subscribes to Zustand store for speaker/message changes.
 * Audio continues independently via CustomCouncilService's Web Audio pipeline.
 * Reuses PrismPlayer CSS classes for visual consistency with curated councils.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDomainStore } from '../../stores/domainStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useScreenWakeLock } from '../../hooks/useScreenWakeLock';
import { useLiveSubtitles } from './useLiveSubtitles';
import OptimizedFigureImage from '../OptimizedFigureImage';
import CloseButton from '../Button/CloseButton/CloseButton';
import CosmicCouncilLoader from '../CosmicCouncil/CosmicCouncilLoader';
import HelperPopup from '../HelperPopup/HelperPopup';
import '../PrismPlayer/PrismPlayer.css'; // Base styles for figure images, close button, speaker label
import './LiveCouncilPlayer.css'; // Custom council overrides (must load after PrismPlayer.css)

interface LiveCouncilPlayerProps {
  onClose: () => void;
}

export function LiveCouncilPlayer({ onClose }: LiveCouncilPlayerProps) {
  const { tString } = useTranslation();

  // Narrow Zustand selectors
  const speaker = useDomainStore(state => state.council.speaker);
  const councilConfig = useDomainStore(state => state.council.config);
  const audioPlayback = useDomainStore(state => state.council.audioPlayback);

  const isCompleted = councilConfig?.isCompleted ?? false;

  // Keep the screen awake while the council is in session — Web Audio
  // (used here, unlike curated councils' <audio> + MediaSession path)
  // suspends on iOS screen lock and the streaming pipeline doesn't recover
  // cleanly. Released automatically once the debate completes or this
  // component unmounts.
  useScreenWakeLock(!isCompleted);

  // Bulletproof spinner: show until first audio actually plays
  const hasReceivedFirstAudio = useRef(false);
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    if (audioPlayback && !hasReceivedFirstAudio.current) {
      hasReceivedFirstAudio.current = true;
      setShowLoader(false);
    }
  }, [audioPlayback]);

  // WPM-based subtitles — works with any TTS provider (Kokoro, OpenAI, etc.)
  const { visibleText, speakerName } = useLiveSubtitles(speaker, audioPlayback);

  // Dual-layer figure crossfade (same pattern as PrismPlayer)
  const [figureLayer, setFigureLayer] = useState<{ front: string; back: string }>({ front: '', back: '' });
  const [showFrontLayer, setShowFrontLayer] = useState(true);

  // Handle speaker changes: initialize on first speaker, crossfade on subsequent
  useEffect(() => {
    if (!speaker) return;

    // First speaker — show directly, no crossfade
    if (!figureLayer.front && !figureLayer.back) {
      setFigureLayer({ front: speaker, back: '' });
      setShowFrontLayer(true);
      return;
    }

    // Same speaker as currently visible — no change
    const currentVisible = showFrontLayer ? figureLayer.front : figureLayer.back;
    if (speaker === currentVisible) return;

    // Different speaker — crossfade via hidden layer
    if (showFrontLayer) {
      setFigureLayer(prev => ({ ...prev, back: speaker }));
      requestAnimationFrame(() => {
        setShowFrontLayer(false);
      });
    } else {
      setFigureLayer(prev => ({ ...prev, front: speaker }));
      requestAnimationFrame(() => {
        setShowFrontLayer(true);
      });
    }
  }, [speaker]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return createPortal(
    <div className="live-council-player" role="dialog" aria-modal="true" aria-label={tString('cosmicCouncil.livePlayer', 'Council in session')}>
      <div className="live-council-player__stage prism-player">
        {/* Top bar — speaker name + close (always-visible flow strip).
            Pushes the figure down via --top-bar-h so the portrait isn't
            cropped behind it. */}
        <div className="live-council-player__top-bar">
          <span
            className="live-council-player__top-bar-title"
            key={`speaker-bar-${audioPlayback?.speakerId || speaker || 'idle'}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {speakerName || tString('cosmicCouncil.livePlayer', 'Council in session')}
          </span>
          <CloseButton
            onClick={handleClose}
            ariaLabel={tString('common.close', 'Close')}
          />
        </div>

        {/* Dual-layer crossfade figure images */}
        {figureLayer.front && (
          <div className={`prism-player__figure-bg ${showFrontLayer ? 'prism-player__figure-bg--visible' : 'prism-player__figure-bg--hidden'}`}>
            <OptimizedFigureImage
              figure={figureLayer.front}
              type="main"
              priority={true}
              withBlurUp={true}
              className="prism-player__figure-img"
              alt={speakerName}
            />
          </div>
        )}
        {figureLayer.back && (
          <div className={`prism-player__figure-bg ${!showFrontLayer ? 'prism-player__figure-bg--visible' : 'prism-player__figure-bg--hidden'}`}>
            <OptimizedFigureImage
              figure={figureLayer.back}
              type="main"
              priority={true}
              withBlurUp={true}
              className="prism-player__figure-img"
              alt={speakerName}
            />
          </div>
        )}

        {/* Original CosmicCouncilLoader — shown until first audio plays */}
        {showLoader && !isCompleted && (
          <CosmicCouncilLoader
            councilParticipants={councilConfig?.participants}
            question={councilConfig?.question}
            stage="generating"
          />
        )}

        {/* Bottom strip — dedicated subtitle area. Always rendered so the
            figure layout is stable; subtitle text inside is conditional.
            a11y: subtitle is intentionally NOT aria-live (typewriter would
            spam SRs). Speaker changes are announced via the top bar. */}
        <div className="live-council-player__bottom-bar">
          {visibleText && (
            <div className="live-council-player__subtitle-zone">
              <p
                className="live-council-player__subtitle-text"
                aria-live="off"
              >
                {visibleText}
              </p>
            </div>
          )}
        </div>

        {/* Completion popup */}
        <HelperPopup
          isOpen={isCompleted}
          onDismiss={handleClose}
          title={tString('cosmicCouncil.debateComplete', 'Debate Complete')}
          content={tString('cosmicCouncil.debateCompleteMessage', 'The council has finished.')}
          buttonText={tString('common.close', 'Close')}
          showDontAskAgain={false}
        />
      </div>
    </div>,
    document.body
  );
}

export default LiveCouncilPlayer;
