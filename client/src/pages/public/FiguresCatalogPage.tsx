// Figures catalog page - grid of all 30 figures
// Remove this file when stripping marketing pages from a fork

import { useMemo } from 'react';
import { usePublicLang } from '../../components/public/PublicLangContext';
import Breadcrumbs from '../../components/public/Breadcrumbs';
import MetaTags from '../../components/public/MetaTags';
import JsonLd, { itemListSchema } from '../../components/public/JsonLd';
import FigureCard from '../../components/public/FigureCard';
import ContentVolume from '../../components/public/ContentVolume';
import { getFiguresCatalog } from '../../data/public/figuresCatalog';
import { figureIdToSlug } from '../../data/public/slugMap';
import { canonicalUrl, publicUrl } from '../../utils/public/publicSeo';

export default function FiguresCatalogPage() {
  const { lang, t } = usePublicLang();
  const figures = useMemo(() => {
    // Sort by surname (last meaningful name part)
    const surnameOverrides: Record<string, string> = {
      laozi: 'Laozi',
      beauvoir: 'Beauvoir',
      bingen: 'Bingen',
      vinci: 'Vinci',
      zenji: 'Dogen',
      goethe: 'Goethe',
      king: 'King',
      gautama: 'Gautama',
      rumi: 'Rumi',
      plato: 'Plato',
    };
    const getSurname = (f: { id: string; name: string }) => {
      if (surnameOverrides[f.id]) return surnameOverrides[f.id];
      const parts = f.name.split(' ');
      return parts[parts.length - 1];
    };
    return [...getFiguresCatalog(lang)].sort((a, b) =>
      getSurname(a).localeCompare(getSurname(b), lang)
    );
  }, [lang]);

  const schemaItems = figures.map(f => ({
    name: f.name,
    url: canonicalUrl(publicUrl(lang, `/figures/${figureIdToSlug[f.id]}`)),
    description: f.about.split('\n')[0].slice(0, 160),
  }));

  return (
    <div className="pub-content">
      <MetaTags
        title={t('figures.pageTitle')}
        description={t('figures.pageDescription')}
        canonicalPath="/figures"
        lang={lang}
      />
      <JsonLd data={itemListSchema(schemaItems)} />

      <Breadcrumbs items={[{ label: t('breadcrumbs.figures') }]} />

      <h1 className="pub-hero__title">{t('figures.pageTitle')}</h1>
      <ContentVolume />
      <p className="pub-section__text" style={{ marginBottom: '2rem' }}>
        {t('figures.pageDescription')}
      </p>

      <div className="pub-grid pub-grid--3">
        {figures.map(figure => (
          <FigureCard key={figure.id} figure={figure} />
        ))}
      </div>
    </div>
  );
}
