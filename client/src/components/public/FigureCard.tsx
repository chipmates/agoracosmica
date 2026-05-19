// Figure card for the catalog grid
// Remove this file when stripping marketing pages from a fork

import { Link } from 'react-router-dom';
import { usePublicLang } from './PublicLangContext';
import { publicUrl } from '../../utils/public/publicSeo';
import { figureIdToSlug } from '../../data/public/slugMap';
import StaticImage from './StaticImage';
import type { PublicFigure } from '../../data/public/figuresCatalog';

interface FigureCardProps {
  figure: PublicFigure;
}

export default function FigureCard({ figure }: FigureCardProps) {
  const { lang } = usePublicLang();
  const slug = figureIdToSlug[figure.id] || figure.id;

  // The card leads with the golden learn line, the same promise the detail
  // page opens with. It turns the grid into a scan of outcomes, not names.
  // Falls back to the first line of the bio if a learn line is missing.
  const learnLine = figure.learn.trim();
  const fallback = figure.about.split('\n')[0].slice(0, 110);

  return (
    <Link
      to={publicUrl(lang, `/figures/${slug}`)}
      className="pub-figure-card"
    >
      <div className="pub-figure-card__image">
        <StaticImage
          figureId={figure.id}
          type="thumbnail"
          alt={figure.name}
          loading="lazy"
        />
      </div>
      <div className="pub-figure-card__body">
        <h2 className="pub-figure-card__name">{figure.name}</h2>
        <p className="pub-figure-card__tradition">{figure.tradition}</p>
        {learnLine ? (
          <p className="pub-figure-card__learn">{learnLine}</p>
        ) : (
          <p className="pub-figure-card__about">{fallback}</p>
        )}
      </div>
    </Link>
  );
}
