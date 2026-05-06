import React, { FC } from 'react';
import { createPortal } from 'react-dom';
import { Play, Crown, ArrowsClockwise, Lock } from '@phosphor-icons/react';
import { CloseButton } from '../Button';
import useTranslation from '../../hooks/useTranslation';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useCouncilProgress } from '../../hooks/useCouncilProgress';
import {
  CatalogCouncil,
  getShortDisplayName,
  getLocalizedTitle,
  getLocalizedQuestion,
  getLocalizedTagline,
  getThemeAccentVar,
  ESTIMATED_DURATION,
} from '../../data/councilCatalog';
import { getCouncilArtwork } from './CouncilArtwork';

interface CouncilDetailSheetProps {
  council: CatalogCouncil | null;
  onClose: () => void;
  onPlay: (council: CatalogCouncil, level?: 1 | 2) => void;
}

const CouncilDetailSheet: FC<CouncilDetailSheetProps> = ({ council, onClose, onPlay }) => {
  const { tString, language } = useTranslation();
  const trapRef = useFocusTrap({ onClose, enabled: !!council });
  const progress = useCouncilProgress(council?.id ?? '', language);

  if (!council) return null;

  const title = getLocalizedTitle(council, language);
  const question = getLocalizedQuestion(council, language);
  const tagline = getLocalizedTagline(council, language);
  const typeEmoji = council.type === 'confrontational' ? '🔥' : '🌊';
  const typeClass = council.type === 'confrontational'
    ? 'council-detail-sheet--confrontational'
    : 'council-detail-sheet--reflective';
  const accentVar = getThemeAccentVar(council.theme);
  const isL1Complete = progress.status === 'completed';
  const safetyLabel = council.safety === 'deep'
    ? tString('cosmicCouncil.safety.deep', 'Contains difficult themes')
    : council.safety === 'sensitive'
      ? tString('cosmicCouncil.safety.sensitive', 'Sensitive topic')
      : null;
  const typeLabel = council.type === 'confrontational'
    ? tString('cosmicCouncil.type.confrontational', 'Confrontational')
    : tString('cosmicCouncil.type.reflective', 'Reflective');

  return createPortal(
    <div
      className="council-detail-sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={trapRef}
        className={`council-detail-sheet ${typeClass}`}
        data-theme={council.theme}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        style={{ borderTopColor: `var(${accentVar})` }}
      >
        {/* Clean readable layout — no artwork noise */}

        <div className="council-detail-sheet__header">
          <div className="council-detail-sheet__title-row">
            <span className="council-detail-sheet__type-badge" aria-label={council.type}>
              {typeEmoji}
            </span>
            <h3 className="council-detail-sheet__title">{title}</h3>
          </div>
          <CloseButton
            onClick={onClose}
            ariaLabel={tString('common.close', 'Close')}
            className="council-detail-sheet__close"
          />
        </div>

        {/* Question with theme-colored accent bar */}
        <p className="council-detail-sheet__question council-detail-sheet__question--accented">
          <span
            className="council-detail-sheet__question-bar"
            style={{ background: `var(${accentVar})` }}
            aria-hidden="true"
          />
          {question}
        </p>

        {/* Tagline as subtitle */}
        {tagline && (
          <p className="council-detail-sheet__preview">{tagline}</p>
        )}

        {/* Figure chips */}
        <div className="council-figure-chips">
          <span className="council-figure-chip council-figure-chip--moderator">
            <Crown size={12} weight="fill" style={{ marginRight: 4, verticalAlign: -1 }} />
            {getShortDisplayName(council.moderator.id)}
          </span>
          {council.participants.map(p => (
            <span key={p.id} className="council-figure-chip">
              {getShortDisplayName(p.id)}
            </span>
          ))}
        </div>

        {/* Primary play button */}
        <button
          className="council-detail-sheet__play"
          onClick={() => onPlay(council, 1)}
          aria-label={`${isL1Complete ? tString('cosmicCouncil.cardFeed.listenAgain', 'Listen Again') : tString('cosmicCouncil.cardFeed.play', 'Begin Council')}, ${title}`}
        >
          {isL1Complete ? <ArrowsClockwise size={18} weight="bold" /> : <Play size={18} weight="fill" />}
          <span>
            {isL1Complete
              ? tString('cosmicCouncil.cardFeed.listenAgain', 'Listen Again')
              : tString('cosmicCouncil.cardFeed.play', 'Begin Council')
            }
          </span>
          <span className="council-detail-sheet__duration">{ESTIMATED_DURATION}</span>
        </button>

        {/* Level 2: locked teaser or unlocked "Go Deeper" */}
        <div className={`council-level2-section ${isL1Complete ? 'council-level2-section--unlocked' : 'council-level2-section--locked'}`}>
          <div className="council-level2-header">
            <span className="council-level2-icon" aria-hidden="true">
              {isL1Complete ? '✦' : <Lock size={14} weight="bold" />}
            </span>
            <h4 className="council-level2-title">
              {tString('cosmicCouncil.level2.title', 'Go Deeper')}
            </h4>
          </div>
          {isL1Complete ? (
            <>
              <p className="council-level2-description">
                {tString(
                  'cosmicCouncil.level2.description',
                  'The same four figures, the same question. Denser ideas, richer metaphors, less guidance. For listeners ready to sit with the full philosophical weight.'
                )}
              </p>
              <button
                className="council-level2-play"
                onClick={() => onPlay(council, 2)}
                aria-label={`${tString('cosmicCouncil.level2.listen', 'Go Deeper')}, ${title}`}
              >
                <Play size={16} weight="fill" />
                <span>{tString('cosmicCouncil.level2.listen', 'Go Deeper')}</span>
                <span className="council-detail-sheet__duration">~15 min</span>
              </button>
            </>
          ) : (
            <p className="council-level2-locked-hint">
              {tString('cosmicCouncil.level2.locked', 'Complete this council to unlock')}
            </p>
          )}
        </div>

        {/* Safety + type indicator (footer) */}
        <div className="council-safety-indicator">
          {safetyLabel && <span>{safetyLabel}</span>}
          <span>{typeLabel}</span>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CouncilDetailSheet;
