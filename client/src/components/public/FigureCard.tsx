// Figure card for catalog grid
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

  // Truncate about text to ~100 chars at word boundary
  const shortAbout = figure.about.length > 120
    ? figure.about.slice(0, figure.about.lastIndexOf(' ', 120)) + '...'
    : figure.about;

  // Remove "Echo of " prefix and trailing tag line for card display
  const aboutText = shortAbout.split('\n')[0];

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
        <p className="pub-figure-card__about">{aboutText}</p>
      </div>
    </Link>
  );
}
