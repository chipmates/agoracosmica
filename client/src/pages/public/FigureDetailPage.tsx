// Figure detail page — revised per Figure-Pages-Revision-Plan.md (Workstream C).
// Promise-first hero (portrait, golden learn line, trailer intro), the
// four-step journey, then depth collapsed by default. One sticky CTA.
// Remove this file when stripping marketing pages from a fork

import { useState, useMemo, useEffect } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { usePublicLang } from '../../components/public/PublicLangContext';
import Breadcrumbs from '../../components/public/Breadcrumbs';
import MetaTags from '../../components/public/MetaTags';
import JsonLd, { personSchema } from '../../components/public/JsonLd';
import StaticImage from '../../components/public/StaticImage';
import FigurePortrait from '../../components/public/FigurePortrait';
import PublicTrailerButton from '../../components/public/PublicTrailerButton';
import CouncilPreview from '../../components/public/CouncilPreview';
import PublicCTA from '../../components/public/PublicCTA';
import EchoNote from '../../components/public/EchoNote';
import JourneyOverview from '../../components/public/JourneyOverview';
import CollapsibleSection from '../../components/public/CollapsibleSection';
import { figureSlugToId, figureIdToSlug } from '../../data/public/slugMap';
import { getFigureById } from '../../data/public/figuresCatalog';
import { getFigureSeo, figureThemes } from '../../data/public/figureSeo';
import { councilCatalog, getShortDisplayName } from '../../data/councilCatalog';
import { publicUrl } from '../../utils/public/publicSeo';

interface SeedSummary {
  id: number;
  title: string;
  summary: string;
  quote: string;
  tags: string[];
  concept: string;
  coreInsights: string[];
  connections: { figure: string; seedTitle: string; type: string }[];
}

interface SeedFileData {
  figure: string;
  seeds: SeedSummary[];
}

// Strip the markers the locked writing rule forbids from displayed text.
// Concept definitions come from voice profiles and can carry em-dashes.
function cleanDisplayText(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .trim();
}

export default function FigureDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { lang, t } = usePublicLang();
  const [seedData, setSeedData] = useState<SeedFileData | null>(null);

  const figureId = slug ? figureSlugToId[slug] : undefined;
  const figure = figureId ? getFigureById(figureId, lang) : undefined;
  const seo = figureId ? getFigureSeo(figureId, lang) : undefined;

  // Dynamic import of seed data (teaching titles + figure connections)
  useEffect(() => {
    if (!figureId) return;
    import(`../../data/public/seeds/${lang}/${figureId}.json`)
      .then(mod => setSeedData(mod.default || mod))
      .catch(() => {});
  }, [figureId, lang]);

  // Councils where this figure participates
  const relatedCouncils = useMemo(() => {
    if (!figureId) return [];
    return councilCatalog.filter(c =>
      c.moderator.id === figureId ||
      c.participants.some(p => p.id === figureId)
    );
  }, [figureId]);

  // Related figures drawn from seed connections
  const relatedFigureIds = useMemo(() => {
    if (!seedData?.seeds) return [];
    const figs = new Set<string>();
    for (const seed of seedData.seeds) {
      for (const conn of seed.connections || []) {
        if (conn.figure !== figureId) figs.add(conn.figure);
      }
    }
    return Array.from(figs).slice(0, 4);
  }, [seedData, figureId]);

  if (!figureId || !figure) {
    return <Navigate to={publicUrl(lang, '/figures')} replace />;
  }

  const seeds = seedData?.seeds || [];
  const aboutParas = figure.about.split('\n').map(p => p.trim()).filter(Boolean);
  const metaLine = [figure.tradition, figure.period].filter(Boolean).join('  ·  ');
  const metaDescription = seo?.description || aboutParas[0]?.slice(0, 160) || '';
  const shortName = getShortDisplayName(figureId);

  return (
    <div className="pub-content pub-figure">
      <MetaTags
        title={`${figure.name} - ${t('figures.life')} & ${t('figures.teachings')}`}
        fullTitle={seo?.seoTitle}
        description={metaDescription}
        canonicalPath={`/figures/${slug}`}
        ogType="profile"
        lang={lang}
      />
      <JsonLd
        data={personSchema({
          name: figure.name,
          about: aboutParas[0] || figure.about,
          period: figure.period,
          tradition: figure.tradition,
          slug: slug!,
          lang,
        })}
      />

      <Breadcrumbs
        items={[
          { label: t('breadcrumbs.figures'), path: '/figures' },
          { label: figure.name },
        ]}
      />

      {/* Hero — promise first */}
      <section className="pub-fig-hero">
        <div className="pub-fig-hero__portrait">
          <FigurePortrait figureId={figureId} alt={figure.name} />
        </div>
        <div className="pub-fig-hero__text">
          <p className="pub-fig-hero__eyebrow">{t('figures.echoOf')}</p>
          <h1 className="pub-fig-hero__name">{figure.name}</h1>
          {metaLine && <p className="pub-fig-hero__meta">{metaLine}</p>}
          {figure.learn && (
            <p className="pub-fig-hero__learn">{`“${figure.learn}”`}</p>
          )}
          <PublicTrailerButton figureId={figureId} />
          {aboutParas.map((p, i) => (
            <p key={i} className="pub-fig-hero__about">{p}</p>
          ))}
        </div>
      </section>

      <EchoNote variant="figure" name={figure.name} />

      {/* The four-step journey */}
      <JourneyOverview figureName={figure.name} />

      {/* Depth — collapsed by default */}
      {seeds.length > 0 && (
        <CollapsibleSection title={t('figures.ideasHeading')}>
          <ol className="pub-ideas">
            {seeds.map(seed => (
              <li key={seed.id} className="pub-ideas__item">{seed.title}</li>
            ))}
          </ol>
        </CollapsibleSection>
      )}

      {figure.keyConcepts.length > 0 && (
        <CollapsibleSection title={t('figures.keyIdeas')}>
          <div className="pub-concepts">
            {figure.keyConcepts.map(concept => (
              <div key={concept.term} className="pub-concept">
                <div className="pub-concept__term">{concept.term}</div>
                <div className="pub-concept__def">
                  {cleanDisplayText(concept.definition)}
                </div>
              </div>
            ))}
          </div>
          {figure.primaryWorks.length > 0 && (
            <p className="pub-concept__works">
              <strong>{t('figures.primaryWorks')}:</strong>{' '}
              {figure.primaryWorks.map(cleanDisplayText).join(', ')}
            </p>
          )}
        </CollapsibleSection>
      )}

      {relatedCouncils.length > 0 && (
        <CollapsibleSection
          title={t('figures.councilAppearances')}
          count={relatedCouncils.length}
        >
          <div className="pub-council-list">
            {relatedCouncils.map(council => (
              <CouncilPreview key={council.id} council={council} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {figureThemes[figureId] && figureThemes[figureId].length > 0 && (
        <CollapsibleSection title={t('figures.themes')}>
          <div className="pub-grid pub-grid--3">
            {figureThemes[figureId].map(themeId => (
              <Link
                key={themeId}
                to={publicUrl(lang, `/themes/${themeId}`)}
                className="pub-theme-card"
              >
                <h3 className="pub-theme-card__name">{t(`themes.${themeId}.name`)}</h3>
                <p className="pub-theme-card__tagline">{t(`themes.${themeId}.tagline`)}</p>
              </Link>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {relatedFigureIds.length > 0 && (
        <CollapsibleSection
          title={t('figures.relatedFigures')}
          count={relatedFigureIds.length}
        >
          <div className="pub-grid pub-grid--2">
            {relatedFigureIds.map(relId => {
              const relFigure = getFigureById(relId, lang);
              const relSlug = figureIdToSlug[relId];
              if (!relFigure || !relSlug) return null;
              return (
                <Link
                  key={relId}
                  to={publicUrl(lang, `/figures/${relSlug}`)}
                  className="pub-figure-card"
                  style={{ flexDirection: 'row', gap: '0.75rem', alignItems: 'center', padding: '0.75rem' }}
                >
                  <StaticImage
                    figureId={relId}
                    type="thumbnail"
                    alt={relFigure.name}
                    loading="lazy"
                    width={64}
                    height={64}
                  />
                  <div>
                    <div className="pub-figure-card__name">{relFigure.name}</div>
                    <div className="pub-figure-card__tradition">{relFigure.tradition}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      <PublicCTA figureName={shortName} figureId={figureId} variant="sticky" />
    </div>
  );
}
