// Faced voice-segment for the theme detail page: a figure's portrait, name,
// stance, and their paragraph from the theme's intro essay. Links to the
// figure's own page.
// Remove this file when stripping marketing pages from a fork

import { Link } from 'react-router-dom';
import { usePublicLang } from './PublicLangContext';
import { publicUrl } from '../../utils/public/publicSeo';
import { figureIdToSlug } from '../../data/public/slugMap';
import { getFigureById } from '../../data/public/figuresCatalog';
import StaticImage from './StaticImage';

interface ThemeVoiceProps {
  figureId: string;
  /** Short stance label shown under the name. */
  stance: string;
  /** The figure's paragraph from the theme's intro essay. */
  paragraph: string;
}

export default function ThemeVoice({ figureId, stance, paragraph }: ThemeVoiceProps) {
  const { lang } = usePublicLang();
  const figure = getFigureById(figureId, lang);
  const name = figure?.name || figureId;
  const slug = figureIdToSlug[figureId] || figureId;
  const href = publicUrl(lang, `/figures/${slug}`);

  return (
    <div className="pub-voice">
      {/* portrait link is a mouse convenience; the name link below carries
          the accessible name, so this one stays out of the a11y tree */}
      <Link to={href} className="pub-voice__portrait" tabIndex={-1} aria-hidden="true">
        <StaticImage
          figureId={figureId}
          type="thumbnail"
          alt=""
          loading="lazy"
          width={88}
          height={88}
        />
      </Link>
      <div className="pub-voice__body">
        <Link to={href} className="pub-voice__name">{name}</Link>
        <div className="pub-voice__stance">{stance}</div>
        <p className="pub-voice__text">{paragraph}</p>
      </div>
    </div>
  );
}
