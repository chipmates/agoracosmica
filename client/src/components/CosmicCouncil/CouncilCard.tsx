import React, { FC } from 'react';
import { Check } from '@phosphor-icons/react';
import useTranslation from '../../hooks/useTranslation';
import { useCouncilProgress } from '../../hooks/useCouncilProgress';
import { CatalogCouncil, getLocalizedTitle, getLocalizedHook, getShortDisplayName, getThemeAccentVar } from '../../data/councilCatalog';
import { getCouncilArtwork } from './CouncilArtwork';
import CouncilSigil from './CouncilSigil';

interface CouncilCardProps {
  council: CatalogCouncil;
  onSelect: (council: CatalogCouncil) => void;
  isHero?: boolean;
}

const CouncilCard: FC<CouncilCardProps> = ({ council, onSelect, isHero = false }) => {
  const { language } = useTranslation();
  const progress = useCouncilProgress(council.id, language);
  const typeEmoji = council.type === 'confrontational' ? '🔥' : '🌊';
  const typeClass = council.type === 'confrontational' ? 'council-card--confrontational' : 'council-card--reflective';
  const title = getLocalizedTitle(council, language);
  const hasProgress = progress.status !== 'not-started';
  const isCompleted = progress.status === 'completed';
  const accentVar = getThemeAccentVar(council.theme);

  const allNames = [council.moderator, ...council.participants]
    .map(f => getShortDisplayName(f.id))
    .join(' · ');

  const ArtworkComponent = getCouncilArtwork(council.id);

  const handleClick = () => onSelect(council);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(council);
    }
  };

  return (
    <div
      className={`council-card ${typeClass}${isHero ? ' council-card--hero' : ''}${hasProgress ? ' council-card--has-progress' : ''}`}
      data-theme={council.theme}
      role="button"
      tabIndex={0}
      aria-label={`${title} — ${council.type}${isCompleted ? ' — completed' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Artwork layer: v4 hand-crafted SVG or generative sigil fallback */}
      <div className="council-card__art" aria-hidden="true">
        {ArtworkComponent ? (
          <ArtworkComponent color={`var(${accentVar})`} />
        ) : (
          <CouncilSigil
            theme={council.theme}
            seed={council.sortOrder}
            color={`var(${accentVar})`}
          />
        )}
      </div>

      <div className="council-card__content">
        <div className="council-card__header">
          <h3 className="council-card__title">{title}</h3>
          <span className="council-card__type-badge-group">
            {isCompleted && (
              <span className="council-card__badge-check" aria-label="completed">
                <Check size={11} weight="bold" />
              </span>
            )}
            <span aria-label={council.type}>{typeEmoji}</span>
          </span>
        </div>

        <p className="council-card__hook">{getLocalizedHook(council, language)}</p>

        <div className="council-card__footer">
          <span className="council-card__figures-text">{allNames}</span>
          <span className="council-card__duration">~14 min</span>
        </div>

        {hasProgress && !isCompleted && (
          <div
            className="council-progress-track"
            role="progressbar"
            aria-valuenow={progress.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="council-progress-fill"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        )}
      </div>

      <div
        className="council-card__accent-bar"
        style={{ background: `var(${accentVar})` }}
        aria-hidden="true"
      />
    </div>
  );
};

export default CouncilCard;
