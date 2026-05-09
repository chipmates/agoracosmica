import { FC, useEffect, useRef, useState } from 'react';
import { Info } from '@phosphor-icons/react';
import useTranslation from '../../hooks/useTranslation';
import {
  getEncourageKey,
  nextTierRemaining,
  type CommunityTier,
} from './computeVotingPower';
import styles from './CommunityGovernanceModal.module.css';

interface CommunityStats {
  joinedCount: number | null;
  totalPower: number | null;
}

interface VotingPowerHeroProps {
  base: number;
  earned: number;
  total: number;
  totalFigures: number;
  tier?: CommunityTier;
  stats?: CommunityStats;
}

const STAR_VISIBLE_CAP = 12;
const COUNT_UP_MS = 800;

export const VotingPowerHero: FC<VotingPowerHeroProps> = ({
  earned,
  total,
  totalFigures: _totalFigures,
  tier: tierProp,
  stats,
}) => {
  const tier: CommunityTier =
    tierProp ?? (earned >= 3 ? 'council' : earned >= 1 ? 'voice' : 'listener');

  const { tString } = useTranslation();
  const [displayedPower, setDisplayedPower] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const fromValue = 0;
    const toValue = total;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(fromValue + (toValue - fromValue) * eased);
      setDisplayedPower(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [total]);

  const visibleStars = Math.min(total, STAR_VISIBLE_CAP);
  const overflow = Math.max(0, total - STAR_VISIBLE_CAP);

  const glowTier = total >= 5 ? 'strong' : total >= 2 ? 'mid' : 'zero';
  const encourageKey = getEncourageKey(total);
  const encourage = tString(
    `community.votingPower.${encourageKey}`,
    'Your voice carries weight.'
  );

  const breakdown =
    earned === 0
      ? tString('community.votingPower.breakdownEmpty', 'no voice yet')
      : tString('community.votingPower.breakdown', '{earned} earned').replace(
          '{earned}',
          String(earned)
        );

  const tierLabel = tString(`community.tier.${tier}`, tier);
  const tierDesc = tString(`community.tier.${tier}Desc`, '');
  const remainingToCouncil = nextTierRemaining(earned);
  const nextTierHint =
    tier === 'listener'
      ? tString('community.tier.nextListener', '')
      : tier === 'voice'
      ? tString('community.tier.nextVoice', '').replace(
          '{remaining}',
          String(remainingToCouncil)
        )
      : tString('community.tier.nextCouncil', '');

  const formulaDetail = tString(
    'community.votingPower.formulaDetail',
    'Master your first seed (all 4 modes) to earn +1. Every fully completed figure (all 12 seeds mastered) adds another +1.'
  );

  return (
    <div
      className={`${styles.hero} ${styles[`heroTier-${glowTier}`]} ${
        styles[`heroCommunityTier-${tier}`]
      }`}
    >
      <div className={styles.heroAurora} aria-hidden="true" />

      <div className={styles.heroTierBadge}>
        <span className={styles.heroTierLabel}>{tierLabel}</span>
        <span className={styles.heroTierDesc}>{tierDesc}</span>
      </div>

      <div className={styles.heroStars} aria-hidden="true">
        {Array.from({ length: visibleStars }).map((_, i) => (
          <span
            key={i}
            className={styles.heroStar}
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
        {overflow > 0 && (
          <span className={styles.heroStarOverflow}>+{overflow}</span>
        )}
      </div>

      <div className={styles.heroNumeralWrap}>
        <div className={styles.heroNumeral} aria-live="polite">
          {displayedPower}
        </div>
        <button
          type="button"
          className={`${styles.heroInfoBtn} ${
            showDetails ? styles.heroInfoBtnOpen : ''
          }`}
          onClick={() => setShowDetails((v) => !v)}
          aria-label={tString('common.learnMore', 'Learn more')}
          aria-expanded={showDetails}
        >
          <Info size={16} weight={showDetails ? 'fill' : 'regular'} />
        </button>
      </div>

      <div className={styles.heroLabel}>
        {tString('community.votingPower.label', 'voting power')}
      </div>

      <div className={styles.heroBreakdown}>{breakdown}</div>

      <p className={styles.heroEncourage}>{encourage}</p>

      {showDetails && (
        <div className={styles.heroDetails}>
          <p className={styles.heroFormula}>{formulaDetail}</p>
          {nextTierHint && (
            <p className={styles.heroNextTier}>{nextTierHint}</p>
          )}
        </div>
      )}

      {stats && (stats.joinedCount !== null || stats.totalPower !== null) && (
        <div className={styles.heroStats}>
          <div className={styles.heroStatBlock}>
            <span className={styles.heroStatValue}>
              {stats.joinedCount !== null
                ? stats.joinedCount.toLocaleString()
                : tString('community.stats.loading', '—')}
            </span>
            <span className={styles.heroStatLabel}>
              {tString('community.stats.joined', 'Joined')}{' '}
              <span className={styles.heroStatLabelDim}>
                {tString('community.stats.voices', 'voices')}
              </span>
            </span>
          </div>
          <div className={styles.heroStatDivider} aria-hidden="true" />
          <div className={styles.heroStatBlock}>
            <span className={styles.heroStatValue}>
              {stats.totalPower !== null
                ? stats.totalPower.toLocaleString()
                : tString('community.stats.loading', '—')}
            </span>
            <span className={styles.heroStatLabel}>
              {tString('community.stats.totalPower', 'Total community power')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
