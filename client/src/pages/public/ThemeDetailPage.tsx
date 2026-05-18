// Theme detail page V2 - curated wisdom quotes, figures by theme, councils
// Remove this file when stripping marketing pages from a fork

import { useMemo } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { usePublicLang } from '../../components/public/PublicLangContext';
import Breadcrumbs from '../../components/public/Breadcrumbs';
import MetaTags from '../../components/public/MetaTags';
import JsonLd, { articleSchema } from '../../components/public/JsonLd';
import CouncilPreview from '../../components/public/CouncilPreview';
import WisdomQuote from '../../components/public/WisdomQuote';
import PublicCTA from '../../components/public/PublicCTA';
import EchoNote from '../../components/public/EchoNote';
import StaticImage from '../../components/public/StaticImage';
import {
  THEMES,
  councilsByTheme,
  type ThemeId,
} from '../../data/councilCatalog';
import { getThemeSeeds } from '../../data/public/themeSeedCrossRef';
import { getFigureById } from '../../data/public/figuresCatalog';
import { figureIdToSlug } from '../../data/public/slugMap';
import { publicUrl, canonicalUrl } from '../../utils/public/publicSeo';

const VALID_THEMES = new Set(THEMES.map(t => t.id));

// One representative figure per theme for OG image. Mirrors prerender.mjs
// THEME_OG_FIGURE. Each theme gets a distinct social preview.
const THEME_OG_FIGURE: Record<string, string> = {
  'meaning-purpose': 'aurelius',
  'loss-grief': 'mandela',
  'who-am-i': 'kahlo',
  'mind-creativity': 'einstein',
  'love-connection': 'rumi',
  'freedom-justice': 'king',
  'faith-death-mystery': 'bingen',
  'moral-life': 'gandhi',
};

const RELATED_THEMES: Record<string, string[]> = {
  'meaning-purpose': ['who-am-i', 'moral-life', 'faith-death-mystery'],
  'loss-grief': ['love-connection', 'faith-death-mystery', 'who-am-i'],
  'who-am-i': ['meaning-purpose', 'mind-creativity', 'freedom-justice'],
  'mind-creativity': ['who-am-i', 'meaning-purpose', 'love-connection'],
  'love-connection': ['loss-grief', 'moral-life', 'who-am-i'],
  'freedom-justice': ['moral-life', 'who-am-i', 'meaning-purpose'],
  'faith-death-mystery': ['meaning-purpose', 'loss-grief', 'moral-life'],
  'moral-life': ['freedom-justice', 'meaning-purpose', 'love-connection'],
};

export default function ThemeDetailPage() {
  const { theme } = useParams<{ theme: string }>();
  const { lang, t } = usePublicLang();

  const isValid = theme && VALID_THEMES.has(theme as ThemeId);

  const councils = useMemo(() => {
    if (!isValid || !theme) return [];
    return councilsByTheme[theme as ThemeId] || [];
  }, [theme, isValid]);

  // Curated wisdom: seeds matched to this theme by tag overlap
  const wisdomSeeds = useMemo(() => {
    if (!theme) return [];
    return getThemeSeeds(theme, lang);
  }, [theme, lang]);

  // Figures whose seeds overlap with this theme
  const themeFigures = useMemo(() => {
    return wisdomSeeds
      .map(s => ({ id: s.figureId, figure: getFigureById(s.figureId, lang) }))
      .filter(f => f.figure)
      .slice(0, 8);
  }, [wisdomSeeds, lang]);

  const relatedThemeIds = theme ? (RELATED_THEMES[theme] || []).slice(0, 3) : [];

  if (!isValid) {
    return <Navigate to={publicUrl(lang, '/themes')} replace />;
  }

  const themeName = t(`themes.${theme}.name`);
  const themeTagline = t(`themes.${theme}.tagline`);
  const themeDescription = t(`themes.${theme}.description`);
  const themeIntroRaw = t(`themes.${theme}.intro`);
  const themeIntro = themeIntroRaw && themeIntroRaw !== `themes.${theme}.intro` ? themeIntroRaw : '';
  const ogFigureId = theme ? THEME_OG_FIGURE[theme] : undefined;
  const themeOgImage = ogFigureId
    ? `https://media.agoracosmica.org/images/figures/${ogFigureId}/main/1200.webp`
    : undefined;

  return (
    <div className="pub-content">
      <MetaTags
        title={`${themeName} - ${themeTagline}`}
        description={themeDescription.slice(0, 160)}
        canonicalPath={`/themes/${theme}`}
        ogType="article"
        ogImage={themeOgImage}
        lang={lang}
      />
      <JsonLd
        data={articleSchema({
          title: themeName,
          description: themeDescription.slice(0, 160),
          url: canonicalUrl(publicUrl(lang, `/themes/${theme}`)),
          lang,
          image: themeOgImage,
        })}
      />

      <Breadcrumbs
        items={[
          { label: t('breadcrumbs.themes'), path: '/themes' },
          { label: themeName },
        ]}
      />

      {/* Theme Introduction */}
      <section className="pub-section">
        <h1 className="pub-hero__title">{themeName}</h1>
        <p style={{
          fontSize: 'var(--text-lg)',
          fontStyle: 'italic',
          color: 'var(--gold-subtle)',
          margin: '0.5rem 0 1.5rem',
        }}>
          {themeTagline}
        </p>
        <div className="pub-section__text">
          <p>{themeDescription}</p>
        </div>
      </section>

      <EchoNote variant="theme" />

      {/* Long-form intro essay (200-400 words, per-theme) */}
      {themeIntro && (
        <section className="pub-section">
          <div className="pub-section__text">
            {themeIntro.split('\n\n').map((para, i) => (
              <p key={i} style={{ marginBottom: '1rem' }}>{para}</p>
            ))}
          </div>
        </section>
      )}

      {/* Curated Wisdom */}
      {wisdomSeeds.length > 0 && (
        <section className="pub-section">
          <h2 className="pub-section__title">{t('themes.curatedWisdom')}</h2>
          {wisdomSeeds.slice(0, 6).map((seed, i) => (
            <WisdomQuote
              key={`${seed.figureId}-${i}`}
              figureId={seed.figureId}
              figureName={seed.figureName}
              seedTitle={seed.seedTitle}
              quote={seed.quote}
            />
          ))}
        </section>
      )}

      {/* Figures in this theme */}
      {themeFigures.length > 0 && (
        <section className="pub-section">
          <h2 className="pub-section__title">{t('figures.relatedFigures')}</h2>
          <div className="pub-grid pub-grid--2">
            {themeFigures.map(({ id, figure: fig }) => {
              if (!fig) return null;
              const slug = figureIdToSlug[id];
              return (
                <Link
                  key={id}
                  to={publicUrl(lang, `/figures/${slug}`)}
                  className="pub-figure-card"
                  style={{ flexDirection: 'row', gap: '0.75rem' }}
                >
                  <StaticImage
                    figureId={id}
                    type="thumbnail"
                    alt={fig.name}
                    loading="lazy"
                    width={64}
                    height={64}
                  />
                  <div>
                    <div className="pub-figure-card__name">{fig.name}</div>
                    <div className="pub-figure-card__tradition">{fig.tradition}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Council Debates */}
      {councils.length > 0 && (
        <section className="pub-section">
          <h2 className="pub-section__title">
            {councils.length} {t('themes.councils')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {councils
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map(council => (
                <CouncilPreview key={council.id} council={council} />
              ))}
          </div>
        </section>
      )}

      {/* Related Themes */}
      {relatedThemeIds.length > 0 && (
        <section className="pub-section">
          <h2 className="pub-section__title">{t('themes.relatedThemes')}</h2>
          <div className="pub-grid pub-grid--3">
            {relatedThemeIds.map(relId => (
              <Link
                key={relId}
                to={publicUrl(lang, `/themes/${relId}`)}
                className="pub-theme-card"
              >
                <h3 className="pub-theme-card__name">{t(`themes.${relId}.name`)}</h3>
                <p className="pub-theme-card__tagline">{t(`themes.${relId}.tagline`)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <PublicCTA variant="sticky" />
    </div>
  );
}
