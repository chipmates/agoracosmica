// SeedDetailsPanel.tsx - Floating panel that displays seed details with smart action button
import React, { FC, CSSProperties, useMemo } from 'react';
import { CloseButton, RippleButton } from '../Button';
import useTranslation from '../../hooks/useTranslation';
import useSeedTranslation from '../../hooks/useSeedTranslation';
import { isStoryCompleted, isPrismCompleted, STORAGE_KEYS } from '../../utils/storageKeysV2';
import './css/SeedDetailsPanel.css';

interface Seed {
  id: string | number;
  title: string;
  description?: string;
  gathered?: boolean;
  [key: string]: any;
}

interface SeedDetailsPanelProps {
  seed: Seed | null;
  onClose: () => void;
  onViewDetails: () => void;
  onSelect: (seed: Seed) => void;
  showSelectButton?: boolean;
  figureId?: string;
  onModeSelect?: (seed: Seed, mode: string) => void;
  onOpenModeSelector?: () => void;
}

const SeedDetailsPanel: FC<SeedDetailsPanelProps> = ({
  seed,
  onClose,
  onViewDetails,
  onSelect,
  showSelectButton = false,
  figureId,
  onModeSelect,
  onOpenModeSelector
}) => {
  const { t, tNode, tString } = useTranslation();
  const { getTranslatedSeedTitle } = useSeedTranslation();

  // Compute smart button state based on completion priority chain
  const smartAction = useMemo(() => {
    if (!seed || !figureId) return null;

    const sId = seed.id;
    const storyDone = isStoryCompleted(figureId, sId);
    const wisdomDone = !!localStorage.getItem(STORAGE_KEYS.getStarSeedHistory(figureId, sId));
    const prismDone = isPrismCompleted(figureId, sId);
    const questDone = !!localStorage.getItem(STORAGE_KEYS.getChallengeHistory(figureId, sId));

    if (!storyDone) {
      return { label: tString('seeds.actions.listenToStory', 'Listen to Story'), mode: 'introduction' };
    }
    if (!wisdomDone) {
      return { label: tString('seeds.actions.exploreWisdom', 'Explore Wisdom'), mode: 'seed_conversation' };
    }
    if (!prismDone) {
      return { label: tString('seeds.actions.hearPrism', 'Hear Prism'), mode: 'prism' };
    }
    if (!questDone) {
      return { label: tString('seeds.actions.startQuest', 'Start Quest'), mode: 'challenge' };
    }
    // All done
    return { label: tString('seeds.actions.revisit', 'Revisit'), mode: null };
  }, [seed, figureId, tString]);

  if (!seed) return null;

  const buttonStyle: CSSProperties = {
    height: '36px',
    padding: '4px 12px'
  };

  const handleSmartClick = () => {
    if (!smartAction) return;
    if (smartAction.mode && onModeSelect) {
      onModeSelect(seed, smartAction.mode);
    } else if (!smartAction.mode && onOpenModeSelector) {
      // All done — open mode selector for revisit
      onOpenModeSelector();
    } else {
      // Fallback to legacy select
      onSelect(seed);
    }
  };

  return (
    <div className="seed-details-panel" role="dialog" aria-label={`Seed details for ${getTranslatedSeedTitle(seed) || seed.title}`}>
      {/* Header with seed number, title and close button */}
      <div className="seed-details-header">
        <h3>
          {/* Extract the numeric part of the seed ID and display it with the translated title */}
          {String(seed.id).includes('-') ? String(seed.id).split('-')[1] : seed.id}. {
            getTranslatedSeedTitle(seed) ||
            (t('seeds.seedTitle', { title: seed.title.includes(' - ') ? seed.title.split(' - ')[1] : seed.title }) as React.ReactNode)
          }
        </h3>
        <CloseButton
          size="small"
          onClick={onClose}
          aria-label="Close seed details"
          className="seed-details-close"
        />
      </div>

      {/* Minimal content - summary only */}
      <div className="seed-details-content">
        {/* Summary (v3.0) or first 3 sentences (v1.0 fallback) */}
        <p className="seed-preview-summary">
          {seed.summary || (
            seed.description
              ? seed.description.split('. ').slice(0, 3).join('. ') + '.'
              : 'Explore this seed to discover philosophical wisdom.'
          )}
        </p>
      </div>

      {/* Action buttons in footer */}
      <div className="seed-details-footer">
        {/* Smart action button — shows next step in learning path */}
        {showSelectButton && smartAction ? (
          <RippleButton
            variant={smartAction.mode ? 'coral' : 'gold'}
            onClick={handleSmartClick}
            style={buttonStyle}
            size="small"
          >
            {smartAction.label}
          </RippleButton>
        ) : showSelectButton ? (
          <RippleButton
            variant={seed.gathered ? "gold" : "coral"}
            onClick={() => onSelect(seed)}
            style={buttonStyle}
            size="small"
          >
            {seed.gathered ? tNode('seeds.actions.revisitSeed') : tNode('seeds.actions.focusOnSeed')}
          </RippleButton>
        ) : null}
        <RippleButton
          variant="ghost"
          onClick={onViewDetails}
          style={buttonStyle}
          size="small"
        >
          {tNode('seeds.actions.viewFullDetails')}
        </RippleButton>
      </div>

      {/* More Paths link */}
      {showSelectButton && onOpenModeSelector && (
        <div className="more-paths-link-container">
          <button
            className="more-paths-link"
            onClick={onOpenModeSelector}
          >
            {tString('seeds.actions.morePaths', 'More Paths')} ›
          </button>
        </div>
      )}
    </div>
  );
};

export default SeedDetailsPanel;
