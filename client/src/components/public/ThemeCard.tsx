// Theme tile for the themes catalog grid
// Remove this file when stripping marketing pages from a fork

import { Link } from 'react-router-dom';
import { usePublicLang } from './PublicLangContext';
import { publicUrl } from '../../utils/public/publicSeo';

interface ThemeCardProps {
  themeId: string;
  councilCount: number;
}

export default function ThemeCard({ themeId, councilCount }: ThemeCardProps) {
  const { lang, t } = usePublicLang();

  return (
    <Link
      to={publicUrl(lang, `/themes/${themeId}`)}
      className="pub-theme-tile"
    >
      <h2 className="pub-theme-tile__name">
        {t(`themes.${themeId}.name`)}
      </h2>
      <p className="pub-theme-tile__question">
        {t(`themes.${themeId}.tagline`)}
      </p>
      <p className="pub-theme-tile__count">
        {councilCount} {t('themes.councils')}
      </p>
    </Link>
  );
}
