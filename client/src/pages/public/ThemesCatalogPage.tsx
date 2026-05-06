// Themes catalog page - 8 life question themes
// Remove this file when stripping marketing pages from a fork

import { useMemo } from 'react';
import { usePublicLang } from '../../components/public/PublicLangContext';
import Breadcrumbs from '../../components/public/Breadcrumbs';
import MetaTags from '../../components/public/MetaTags';
import JsonLd, { itemListSchema } from '../../components/public/JsonLd';
import ThemeCard from '../../components/public/ThemeCard';
import { THEMES, councilsByTheme } from '../../data/councilCatalog';
import { canonicalUrl, publicUrl } from '../../utils/public/publicSeo';

export default function ThemesCatalogPage() {
  const { lang, t } = usePublicLang();

  const schemaItems = useMemo(() =>
    THEMES.map(theme => ({
      name: t(`themes.${theme.id}.name`),
      url: canonicalUrl(publicUrl(lang, `/themes/${theme.id}`)),
      description: t(`themes.${theme.id}.tagline`),
    })),
    [lang, t]
  );

  return (
    <div className="pub-content">
      <MetaTags
        title={t('themes.pageTitle')}
        description={t('themes.pageDescription')}
        canonicalPath="/themes"
        lang={lang}
      />
      <JsonLd data={itemListSchema(schemaItems)} />

      <Breadcrumbs items={[{ label: t('breadcrumbs.themes') }]} />

      <h1 className="pub-hero__title">{t('themes.pageTitle')}</h1>
      <p className="pub-section__text" style={{ marginBottom: '2rem' }}>
        {t('themes.pageDescription')}
      </p>

      <div className="pub-grid pub-grid--2">
        {THEMES.map(theme => (
          <ThemeCard
            key={theme.id}
            themeId={theme.id}
            councilCount={councilsByTheme[theme.id]?.length || 0}
          />
        ))}
      </div>
    </div>
  );
}
