import React, { FC } from 'react';
import { Sparkle, Hourglass } from '@phosphor-icons/react';
import useTranslation from '../../hooks/useTranslation';
import type { SuggestionSlots } from './computeVotingPower';
import styles from './CommunityGovernanceModal.module.css';

interface SuggestSlotPanelProps {
  slots: SuggestionSlots;
}

export const SuggestSlotPanel: FC<SuggestSlotPanelProps> = ({ slots }) => {
  const { tString } = useTranslation();

  const title = tString('community.suggestPanel.title', 'Your suggestion slots');
  const subtitle = tString(
    'community.suggestPanel.subtitle',
    'Earn 1 slot per 3 fully completed figures.'
  );

  const renderBody = () => {
    if (!slots.unlocked) {
      return (
        <p className={styles.suggestLockedZero}>
          {tString(
            'community.suggestPanel.lockedZero',
            'Complete your first figure to start earning suggestion slots.'
          )}
        </p>
      );
    }

    const earnedLabel = tString('community.suggestPanel.earned', 'Earned');
    const nextLabel =
      slots.nextSlotAt !== null
        ? tString(
            'community.suggestPanel.earnedNext',
            'Next slot at {next} completed figures'
          ).replace('{next}', String(slots.nextSlotAt))
        : tString('community.suggestPanel.earnedMax', 'All slots earned');

    return (
      <div className={styles.suggestUnlocked}>
        <div className={styles.suggestSlotCount}>
          <span className={styles.suggestSlotNumber}>{slots.total}</span>
          <span className={styles.suggestSlotLabel}>{earnedLabel}</span>
        </div>
        <p className={styles.suggestNext}>{nextLabel}</p>
        <div className={styles.suggestComingSoon}>
          <Hourglass size={14} weight="duotone" />
          <span>
            {tString(
              'community.suggestPanel.lockedSlots',
              "When voting opens, you'll be able to suggest a new figure or feature here."
            )}
          </span>
        </div>
      </div>
    );
  };

  return (
    <section className={styles.suggestPanel} aria-labelledby="suggest-panel-title">
      <header className={styles.suggestHeader}>
        <span className={styles.suggestIcon} aria-hidden="true">
          <Sparkle size={18} weight="duotone" />
        </span>
        <div>
          <h3 id="suggest-panel-title" className={styles.suggestTitle}>
            {title}
          </h3>
          <p className={styles.suggestSubtitle}>{subtitle}</p>
        </div>
      </header>
      {renderBody()}
    </section>
  );
};
