// SeedDetailsPanel.tsx - Seed details with smart action button.
//
// Two presentations, one behavior:
// - default: the floating bottom panel (flat-map tiers, unchanged)
// - atlas:   a margin-docked annotation on the Celestial Atlas plate.
//   It docks left or right of the constellation (never covering the figure),
//   with a small-caps kicker, Caslon title, italic summary and four diamond
//   mastery pips (proto B's seed note). Same props flow, same actions.
import React, { FC, CSSProperties, useMemo } from 'react';
import { CloseButton, RippleButton } from '../Button';
import useTranslation from '../../hooks/useTranslation';
import useSeedTranslation from '../../hooks/useSeedTranslation';
import { isStoryCompleted, isPrismCompleted, STORAGE_KEYS } from '../../utils/storageKeysV2';
import { computeSeedSlices } from '../../utils/seedLevelComputation';
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
  /** Celestial Atlas presentation: margin-docked annotation. */
  atlas?: boolean;
  /** Which plate margin the note docks into (opposite the star). */
  atlasDockSide?: 'left' | 'right';
  /** Vertical anchor near the star, percent of the map height. */
  atlasDockTopPct?: number;
  /** Translated constellation name for the kicker line. */
  constellationName?: string;
}

const SeedDetailsPanel: FC<SeedDetailsPanelProps> = ({
  seed,
  onClose,
  onViewDetails,
  onSelect,
  showSelectButton = false,
  figureId,
  onModeSelect,
  onOpenModeSelector,
  atlas = false,
  atlasDockSide = 'right',
  atlasDockTopPct = 50,
  constellationName = ''
}) => {
  const { t, tNode, tString } = useTranslation();
  const { getTranslatedSeedTitle } = useSeedTranslation();

  // Per-mode completion drives both the smart button and the mastery pips
  const modeStatus = useMemo(() => {
    if (!seed || !figureId) return null;
    const sId = seed.id;
    return {
      storyDone: isStoryCompleted(figureId, sId),
      wisdomDone: !!localStorage.getItem(STORAGE_KEYS.getStarSeedHistory(figureId, sId)),
      prismDone: isPrismCompleted(figureId, sId),
      questDone: !!localStorage.getItem(STORAGE_KEYS.getChallengeHistory(figureId, sId)),
    };
  }, [seed, figureId]);

  // Compute smart button state based on completion priority chain
  const smartAction = useMemo(() => {
    if (!modeStatus) return null;
    const { storyDone, wisdomDone, prismDone, questDone } = modeStatus;

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
  }, [modeStatus, tString]);

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

  const seedNumber = String(seed.id).includes('-') ? String(seed.id).split('-')[1] : String(seed.id);
  const title =
    getTranslatedSeedTitle(seed) ||
    (t('seeds.seedTitle', {
      title: seed.title.includes(' - ') ? seed.title.split(' - ')[1] : seed.title,
    }) as React.ReactNode);
  const summary =
    seed.summary ||
    (seed.description
      ? seed.description.split('. ').slice(0, 3).join('. ') + '.'
      : 'Explore this seed to discover philosophical wisdom.');

  // Pips read the SAME slice computation that drives the star's gilding
  // level on the plate, so note and star always agree.
  const pipSlice = figureId ? computeSeedSlices(figureId, [seed as any])[0] : undefined;
  const masteryLevel = pipSlice
    ? [pipSlice.storyDone, pipSlice.wisdomDone, pipSlice.prismDone, pipSlice.questDone].filter(
        Boolean
      ).length
    : 0;

  const panelClass = atlas
    ? `seed-details-panel atlas-seed-dock dock-${atlasDockSide}`
    : 'seed-details-panel';
  const panelStyle = atlas
    ? ({ '--dock-top': `${atlasDockTopPct}%` } as CSSProperties)
    : undefined;

  return (
    <div
      className={panelClass}
      style={panelStyle}
      role="dialog"
      aria-label={`Seed details for ${getTranslatedSeedTitle(seed) || seed.title}`}
    >
      {atlas && (
        <p className="atlas-seed-kicker">
          {String(
            t('wisdomAtlas.seedKicker', { num: seedNumber, constellation: constellationName })
          )}
        </p>
      )}

      {/* Header with seed number, title and close button */}
      <div className="seed-details-header">
        <h3>
          {atlas ? title : <>{seedNumber}. {title}</>}
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
        <p className="seed-preview-summary">{summary}</p>
      </div>

      {/* Mastery pips (atlas note only): four diamonds, one per chapter,
          each wearing its chapter colour */}
      {atlas && pipSlice && (
        <div
          className="atlas-seed-pips"
          role="img"
          aria-label={String(t('wisdomAtlas.mastery', { level: masteryLevel }))}
        >
          {([
            ['story', pipSlice.storyDone],
            ['wisdom', pipSlice.wisdomDone],
            ['prism', pipSlice.prismDone],
            ['quest', pipSlice.questDone],
          ] as const).map(([mode, done]) => (
            <span key={mode} className={`atlas-pip pip-${mode} ${done ? 'on' : ''}`} />
          ))}
        </div>
      )}

      {/* Action buttons in footer. Atlas mode keeps the same smart-action
          footer, restyled by Atlas.css into the engraved ink pair (the
          listen-first note stays primary by design decision).
          The smart action wears its chapter colour via --note-mode. */}
      <div
        className="seed-details-footer"
        style={
          atlas
            ? ({
                '--note-mode':
                  smartAction?.mode === 'seed_conversation'
                    ? 'var(--mode-wisdom)'
                    : smartAction?.mode === 'prism'
                    ? 'var(--mode-prism)'
                    : smartAction?.mode === 'challenge'
                    ? 'var(--mode-quest)'
                    : 'var(--mode-story)',
              } as CSSProperties)
            : undefined
        }
      >
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
