// Aggregated keyword tags for a figure
// Targets long-tail search queries
// Remove this file when stripping marketing pages from a fork

import { usePublicLang } from './PublicLangContext';

interface TopicBadgesProps {
  tags: string[];
  figureName: string;
}

export default function TopicBadges({ tags, figureName }: TopicBadgesProps) {
  const { t } = usePublicLang();

  if (tags.length === 0) return null;

  return (
    <section className="pub-section">
      <h2 className="pub-section__title">
        {t('topics.title').replace('{name}', figureName)}
      </h2>
      <div className="pub-topics">
        {tags.map(tag => (
          <span key={tag} className="pub-topics__badge">
            {tag.replace(/-/g, ' ')}
          </span>
        ))}
      </div>
    </section>
  );
}
