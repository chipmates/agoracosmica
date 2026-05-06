// Theme card for catalog grid
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
      className="pub-theme-card"
    >
      <h2 className="pub-theme-card__name">
        {t(`themes.${themeId}.name`)}
      </h2>
      <p className="pub-theme-card__tagline">
        {t(`themes.${themeId}.tagline`)}
      </p>
      <p className="pub-theme-card__count">
        {councilCount} {t('themes.councils')}
      </p>
    </Link>
  );
}
