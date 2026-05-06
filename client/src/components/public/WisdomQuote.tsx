// Curated seed quote with figure attribution for theme pages
// Remove this file when stripping marketing pages from a fork

import { Link } from 'react-router-dom';
import { usePublicLang } from './PublicLangContext';
import { publicUrl } from '../../utils/public/publicSeo';
import { figureIdToSlug } from '../../data/public/slugMap';
import StaticImage from './StaticImage';

interface WisdomQuoteProps {
  figureId: string;
  figureName: string;
  seedTitle: string;
  quote: string;
}

export default function WisdomQuote({
  figureId,
  figureName,
  seedTitle,
  quote,
}: WisdomQuoteProps) {
  const { lang } = usePublicLang();
  const slug = figureIdToSlug[figureId] || figureId;

  return (
    <div className="pub-wisdom-quote">
      <blockquote className="pub-quote">
        {quote}
      </blockquote>
      <Link
        to={publicUrl(lang, `/figures/${slug}`)}
        className="pub-wisdom-quote__attribution"
      >
        <StaticImage
          figureId={figureId}
          type="thumbnail"
          alt={figureName}
          className="pub-wisdom-quote__thumb"
          loading="lazy"
          width={40}
          height={40}
        />
        <div>
          <span className="pub-wisdom-quote__name">{figureName}</span>
          <span className="pub-wisdom-quote__seed">{seedTitle}</span>
        </div>
      </Link>
    </div>
  );
}
