import React, { FC, Fragment, useState, useCallback } from 'react';
import {
  CaretDown,
  Translate,
  DeviceMobile,
  Books,
  UserPlus,
  Palette,
  Microphone,
} from '@phosphor-icons/react';
import useTranslation from '../../hooks/useTranslation';
import { TOPIC_CATALOG, TopicCategory } from './topicCatalog';
import { TopicRow } from './TopicRow';
import styles from './CommunityGovernanceModal.module.css';

const ICON_MAP = {
  Translate,
  DeviceMobile,
  Books,
  UserPlus,
  Palette,
  Microphone,
};

export const TopicsList: FC = () => {
  const { tString } = useTranslation();

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      for (const cat of TOPIC_CATALOG) {
        initial[cat.id] = cat.defaultOpen;
      }
      return initial;
    }
  );

  const toggle = useCallback((id: string) => {
    setOpenCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const futureSectionLabel = tString(
    'community.futureSectionHeader',
    'Future · time-intensive'
  );

  return (
    <div className={styles.topicsList}>
      {TOPIC_CATALOG.map((category, idx) => {
        const prev = idx > 0 ? TOPIC_CATALOG[idx - 1] : null;
        const showFutureHeader = category.isFuture && (!prev || !prev.isFuture);
        return (
          <Fragment key={category.id}>
            {showFutureHeader && (
              <div className={styles.futureSectionHeader} aria-hidden="true">
                <span className={styles.futureSectionLine} />
                <span className={styles.futureSectionLabel}>
                  {futureSectionLabel}
                </span>
                <span className={styles.futureSectionLine} />
              </div>
            )}
            <CategoryAccordion
              category={category}
              isOpen={!!openCategories[category.id]}
              onToggle={toggle}
              tString={tString}
            />
          </Fragment>
        );
      })}
    </div>
  );
};

interface CategoryAccordionProps {
  category: TopicCategory;
  isOpen: boolean;
  onToggle: (id: string) => void;
  tString: (key: string, fallback?: string) => string;
}

const CategoryAccordion: FC<CategoryAccordionProps> = ({
  category,
  isOpen,
  onToggle,
  tString,
}) => {
  const Icon = ICON_MAP[category.iconName];
  const title = tString(`community.category.${category.id}`, category.id);
  const hint = tString(`community.category.${category.id}Hint`, '');

  return (
    <div
      className={`${styles.category} ${
        category.isFuture ? styles.categoryFuture : ''
      } ${isOpen ? styles.categoryOpen : ''}`}
    >
      <button
        type="button"
        className={styles.categoryHeader}
        onClick={() => onToggle(category.id)}
        aria-expanded={isOpen}
        aria-controls={`category-panel-${category.id}`}
      >
        <span className={styles.categoryIcon} aria-hidden="true">
          <Icon size={20} weight="duotone" />
        </span>
        <span className={styles.categoryTitle}>{title}</span>
        <span className={styles.categoryCount} aria-label={`${category.items.length} items`}>
          <span className={styles.categoryCountDot} aria-hidden="true">·</span>
          {category.items.length}
        </span>
        <span className={styles.categoryCaret} aria-hidden="true">
          <CaretDown size={16} />
        </span>
      </button>

      {isOpen && (
        <div
          id={`category-panel-${category.id}`}
          className={styles.categoryPanel}
        >
          {hint && <p className={styles.categoryHint}>{hint}</p>}
          <div className={styles.categoryItems}>
            {category.items.map((item) => (
              <TopicRow
                key={item.id}
                item={item}
                isFuture={category.isFuture}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
