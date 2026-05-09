/**
 * PrismPreviewCard - Preview overlay shown before prism playback
 *
 * Displays seed title, quote, host figure, connection figures with
 * their roles (foundation/expansion/tension), and duration.
 * Uses HelperPopup CSS classes for consistent glass morphism styling.
 */

import { FC } from 'react';
import { Play, X } from '@phosphor-icons/react';
import { useTranslation } from '../../hooks/useTranslation';
import { useResponsive } from '../../hooks/useResponsive';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { getShortDisplayName } from '../../data/councilCatalog';
import './PrismPreviewCard.css';

interface ConnectionPreview {
  figure: string;
  type: 'foundation' | 'expansion' | 'tension';
  summary: string;
}

interface PrismPreviewCardProps {
  seedTitle: string;
  seedQuote?: string;
  hostName: string;
  hostFigureId: string;
  connections: ConnectionPreview[];
  totalDuration: number;
  savedProgress: { lastTimeSeconds: number } | null;
  onListen: () => void;
  onBack: () => void;
}

function formatDuration(seconds: number): string {
  return String(Math.round(seconds / 60));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const TYPE_LABELS: Record<string, string> = {
  foundation: 'prismPlayer.preview.foundation',
  expansion: 'prismPlayer.preview.expansion',
  tension: 'prismPlayer.preview.tension',
};

const PrismPreviewCard: FC<PrismPreviewCardProps> = ({
  seedTitle,
  seedQuote,
  hostFigureId,
  connections,
  totalDuration,
  savedProgress,
  onListen,
  onBack,
}) => {
  const { tString } = useTranslation();
  const { isMobile } = useResponsive();
  const trapRef = useFocusTrap<HTMLDivElement>({ onClose: onBack, enabled: true });

  const durationLabel = tString(
    'prismPlayer.preview.duration',
    '~{minutes} min'
  ).replace('{minutes}', formatDuration(totalDuration));

  const hasSavedProgress = savedProgress && savedProgress.lastTimeSeconds > 10;

  const listenLabel = hasSavedProgress
    ? tString('prismPlayer.preview.continue', 'Continue')
    : tString('prismPlayer.preview.listen', 'Listen');

  const progressLabel = hasSavedProgress
    ? `${formatTime(savedProgress!.lastTimeSeconds)} / ${formatTime(totalDuration)}`
    : null;

  return (
    <div className={`helper-popup-container ${isMobile ? 'fullscreen-mobile' : ''}`}>
      <div
        ref={trapRef}
        className={`helper-popup prism-preview ${isMobile ? 'fullscreen-mobile' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prism-preview-title"
      >
        {/* Header */}
        <div className="helper-header">
          <h3 id="prism-preview-title" className="helper-title">
            {seedTitle}
          </h3>
          <p className="prism-preview__host">
            {tString('prismPlayer.preview.hostedBy', 'Hosted by')} {getShortDisplayName(hostFigureId)}
          </p>
        </div>

        {/* Content */}
        <div className="helper-content">
          {/* Quote */}
          {seedQuote && (
            <blockquote className="prism-preview__quote">
              {seedQuote}
            </blockquote>
          )}

          {/* Connections */}
          {connections.length > 0 && (
            <div className="prism-preview__connections">
              <h4>{tString('prismPlayer.preview.perspectives', 'Perspectives in this Prism')}</h4>
              {connections.map((conn) => (
                <div key={conn.figure} className="prism-preview__connection">
                  <span className={`prism-preview__type-dot prism-preview__type-dot--${conn.type}`} />
                  <div className="prism-preview__connection-body">
                    <span className="prism-preview__connection-header">
                      <strong>{getShortDisplayName(conn.figure)}</strong>
                      <span className="prism-preview__type-label">
                        {tString(TYPE_LABELS[conn.type] || conn.type, conn.type)}
                      </span>
                    </span>
                    <span className="prism-preview__connection-summary">{conn.summary}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="helper-actions prism-preview__actions">
          <button
            className="prism-preview__btn prism-preview__btn--back"
            onClick={onBack}
            aria-label={tString('common.close', 'Close')}
          >
            <X size={16} weight="bold" />
            {tString('common.close', 'Close')}
          </button>

          <button
            className="prism-preview__btn prism-preview__btn--listen"
            onClick={onListen}
            aria-label={`${listenLabel} ${durationLabel}`}
          >
            <Play size={18} weight="fill" />
            <span>{listenLabel}</span>
            <span className="prism-preview__duration">
              {progressLabel || durationLabel}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrismPreviewCard;
