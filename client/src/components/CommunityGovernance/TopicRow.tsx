import { FC } from 'react';
import useTranslation from '../../hooks/useTranslation';
import type { TopicItem } from './topicCatalog';
import styles from './CommunityGovernanceModal.module.css';

interface TopicRowProps {
  item: TopicItem;
  isFuture: boolean;
}

export const TopicRow: FC<TopicRowProps> = ({ item, isFuture }) => {
  const { tString } = useTranslation();

  const label = item.displayName
    ? item.displayName
    : item.labelKey
    ? tString(item.labelKey, item.id)
    : item.id;

  const lockedHint = tString('community.lockedHint', 'Voting opens soon');

  return (
    <div
      className={`${styles.topicRow} ${isFuture ? styles.topicRowFuture : ''}`}
      aria-disabled="true"
    >
      <span className={styles.topicLabel}>
        {item.native && (
          <span className={styles.topicNative}>{item.native}</span>
        )}
        <span className={item.native ? styles.topicLatin : styles.topicLabelText}>
          {label}
        </span>
      </span>

      <span className={styles.topicLockedPill}>{lockedHint}</span>
    </div>
  );
};
