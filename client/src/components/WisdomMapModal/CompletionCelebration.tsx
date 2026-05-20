// CompletionCelebration.tsx - Premium achievement overlay when all seeds are fully mastered
import React, { useEffect, useState, FC, MouseEvent } from 'react';
import './css/CompletionCelebration.css';
import useTranslation from '../../hooks/useTranslation';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { getConstellationTranslationKey } from '../../utils/constellationTranslationHelper';
import { isSelfHost } from '../../config/deployment';
import type { CommunityTier } from '../CommunityGovernance/computeVotingPower';

interface CompletionCelebrationProps {
  constellationName: string;
  totalSeeds: number;
  onClose?: () => void;
  /** Total voting power including this just-completed figure */
  votingPowerTotal?: number;
  /** If set, the user just crossed into this tier with this completion */
  newlyUnlockedTier?: Exclude<CommunityTier, 'listener'>;
  /** Optional callback to open the Community modal from this celebration */
  onOpenCommunity?: () => void;
}

const CompletionCelebration: FC<CompletionCelebrationProps> = ({
  constellationName,
  totalSeeds,
  onClose,
  votingPowerTotal,
  newlyUnlockedTier,
  onOpenCommunity,
}) => {
  const { t, tString } = useTranslation();
  const trapRef = useFocusTrap({ onClose, lockScroll: false });
  const [visible, setVisible] = useState(false);

  const constellationKey = getConstellationTranslationKey(constellationName);
  const translatedName = constellationKey ? String(t(constellationKey)) : constellationName;

  // Entrance animation trigger
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Auto-dismiss after 12 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, 12000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const handleDismiss = (): void => {
    if (onClose) onClose();
  };

  const handleOpenCommunity = (): void => {
    if (onOpenCommunity) onOpenCommunity();
  };

  const handleContentClick = (e: MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation();
  };

  // Generate sparkle particles
  const sparkles = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 360;
    const distance = 40 + Math.random() * 60;
    const size = 2 + Math.random() * 3;
    const delay = Math.random() * 2;
    const duration = 2 + Math.random() * 2;
    return { angle, distance, size, delay, duration, id: i };
  });

  const tierTransitionTitle = newlyUnlockedTier
    ? tString(
        `seeds.tierTransition${
          newlyUnlockedTier === 'council' ? 'Council' : 'Voice'
        }`,
        ''
      )
    : '';
  const tierTransitionDesc = newlyUnlockedTier
    ? tString(
        `seeds.tierTransition${
          newlyUnlockedTier === 'council' ? 'Council' : 'Voice'
        }Desc`,
        ''
      )
    : '';

  return (
    <div
      ref={trapRef}
      className={`completion-celebration-overlay ${visible ? 'visible' : ''}`}
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      tabIndex={-1}
    >

      {/* Sparkle particles */}
      <div className="celebration-sparkles">
        {sparkles.map(s => (
          <div
            key={s.id}
            className="sparkle-particle"
            style={{
              '--angle': `${s.angle}deg`,
              '--distance': `${s.distance}%`,
              '--size': `${s.size}px`,
              '--delay': `${s.delay}s`,
              '--duration': `${s.duration}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Main card */}
      <div className={`celebration-card ${visible ? 'visible' : ''}`} onClick={handleContentClick}>
        {/* Decorative top accent */}
        <div className="celebration-accent" />

        {/* Achievement icon */}
        <div className="celebration-icon">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
            <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="1" opacity="0.2" />
            {/* Star shape */}
            <path d="M24 8 L27.5 18.5 L38 19.5 L30 26.5 L32 37 L24 31.5 L16 37 L18 26.5 L10 19.5 L20.5 18.5 Z"
              fill="currentColor" opacity="0.9" />
          </svg>
        </div>

        <h2 id="celebration-title">
          {tString('seeds.constellationMastered', 'Constellation Mastered')}
        </h2>

        <p className="celebration-constellation-name">
          {translatedName || constellationName}
        </p>

        <p className="celebration-description">
          {tString('seeds.allSeedsMastered', 'All {count} seeds fully explored across every mode').replace('{count}', String(totalSeeds))}
        </p>

        {/* Divider */}
        <div className="celebration-divider" />

        {/* Voting power reward */}
        <div className="celebration-reward">
          <div className="reward-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L14.5 9H22L16 13.5L18 21L12 16.5L6 21L8 13.5L2 9H9.5L12 2Z"
                fill="currentColor" />
            </svg>
          </div>
          <div className="reward-text">
            <span className="reward-label">{isSelfHost
              ? tString('seeds.selfHostVotingPowerLabel', 'Voting Power')
              : tString('seeds.votingPowerLabel', 'Community Voting Power')}</span>
            <div className="reward-value-row">
              <span className="reward-value">+1</span>
              {votingPowerTotal !== undefined && votingPowerTotal > 1 && (
                <span className="reward-total">
                  {tString('seeds.votingPowerTotal', 'Total: {total}').replace(
                    '{total}',
                    String(votingPowerTotal)
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tier transition (optional) */}
        {newlyUnlockedTier && tierTransitionTitle && (
          <div
            className={`celebration-tier-transition tier-${newlyUnlockedTier}`}
          >
            <div className="tier-transition-title">{tierTransitionTitle}</div>
            <div className="tier-transition-desc">{tierTransitionDesc}</div>
          </div>
        )}

        {/* Action buttons */}
        <div className="celebration-actions">
          <button className="celebration-button" onClick={handleDismiss}>
            {tString('common.continue', 'Continue')}
          </button>
          {onOpenCommunity && (
            <button
              type="button"
              className="celebration-link"
              onClick={handleOpenCommunity}
            >
              {tString('seeds.openCommunity', 'View Community')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompletionCelebration;
