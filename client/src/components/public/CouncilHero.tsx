// Featured-debate hero card for the theme detail page. Replicates the in-app
// CouncilDetailSheet structure (emoji + title, question with theme accent bar,
// tagline, figures) tuned for a cold public visitor: portraits instead of name
// chips, the question as the page's loudest element, and a 50s audio preview.
// No primary CTA inside the card — the sticky PublicCTA at the bottom of the
// page deep-links to this same council, so an in-card Begin Council button
// would just duplicate it. Drops the Level 2 "Go Deeper" block and safety
// footer for the same reason as Track 3.1 in the plan.
// Remove this file when stripping marketing pages from a fork

import { usePublicLang } from './PublicLangContext';
import StaticImage from './StaticImage';
import PublicCouncilPreviewButton from './PublicCouncilPreviewButton';
import {
  CatalogCouncil,
  getLocalizedTitle,
  getLocalizedQuestion,
  getLocalizedTagline,
  getShortDisplayName,
  getThemeAccentVar,
} from '../../data/councilCatalog';

interface CouncilHeroProps {
  council: CatalogCouncil;
}

export default function CouncilHero({ council }: CouncilHeroProps) {
  const { t, lang } = usePublicLang();

  const title = getLocalizedTitle(council, lang);
  const question = getLocalizedQuestion(council, lang);
  const tagline = getLocalizedTagline(council, lang);
  const accentVar = getThemeAccentVar(council.theme);
  const typeEmoji = council.type === 'confrontational' ? '🔥' : '🌊';
  const cast = [council.moderator, ...council.participants];

  return (
    <section className="pub-council-hero" data-theme={council.theme}>
      <div className="pub-council-hero__eyebrow">
        {t('themes.featuredDebate', 'Featured debate')}
      </div>

      <div className="pub-council-hero__title-row">
        <span className="pub-council-hero__type" aria-hidden="true">{typeEmoji}</span>
        <h2 className="pub-council-hero__title">{title}</h2>
      </div>

      <p className="pub-council-hero__question">
        <span
          className="pub-council-hero__question-bar"
          style={{ background: `var(${accentVar})` }}
          aria-hidden="true"
        />
        <span className="pub-council-hero__question-text">{question}</span>
      </p>

      {tagline && (
        <p className="pub-council-hero__tagline">{tagline}</p>
      )}

      <div className="pub-council-hero__cast" role="list">
        {cast.map((figure, idx) => {
          const isModerator = idx === 0;
          return (
            <div key={figure.id} className="pub-council-hero__cast-item" role="listitem">
              <div className="pub-council-hero__portrait-frame">
                <StaticImage
                  figureId={figure.id}
                  type="thumbnail"
                  alt={figure.name}
                  loading="lazy"
                  width={96}
                  height={96}
                />
                {isModerator && (
                  <span
                    className="pub-council-hero__crown"
                    aria-label={t('themes.moderator', 'Moderator')}
                    title={t('themes.moderator', 'Moderator')}
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                      <path d="M2 7l5 5 5-9 5 9 5-5v12H2z" />
                    </svg>
                  </span>
                )}
              </div>
              <span className="pub-council-hero__cast-name">
                {getShortDisplayName(figure.id)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="pub-council-hero__actions">
        <PublicCouncilPreviewButton councilId={council.id} />
      </div>
    </section>
  );
}
