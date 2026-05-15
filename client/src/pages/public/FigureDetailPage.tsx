// Figure detail page V2 - journey, stories, teachings, concepts, councils, topics
// Remove this file when stripping marketing pages from a fork

import { useState, useMemo, useEffect } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { usePublicLang } from '../../components/public/PublicLangContext';
import Breadcrumbs from '../../components/public/Breadcrumbs';
import MetaTags from '../../components/public/MetaTags';
import JsonLd, { personSchema } from '../../components/public/JsonLd';
import StaticImage from '../../components/public/StaticImage';
import SeedPreview from '../../components/public/SeedPreview';
import CouncilPreview from '../../components/public/CouncilPreview';
import PublicAudioPlayer from '../../components/public/PublicAudioPlayer';
import PublicCTA from '../../components/public/PublicCTA';
import JourneyOverview from '../../components/public/JourneyOverview';
import TopicBadges from '../../components/public/TopicBadges';
import CollapsibleSection from '../../components/public/CollapsibleSection';
import { figureSlugToId } from '../../data/public/slugMap';
import { getFigureById } from '../../data/public/figuresCatalog';
import { getFigureSeo, figureThemes } from '../../data/public/figureSeo';
import { councilCatalog, getShortDisplayName } from '../../data/councilCatalog';
import { getPublicAudioUrl } from '../../utils/public/publicMediaUrl';
import { publicUrl } from '../../utils/public/publicSeo';
import { figureIdToSlug } from '../../data/public/slugMap';

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

interface StoryFileData {
  figure: string;
  chapters: { segment: number; words: number; minutes: number }[];
  totalWords: number;
  totalMinutes: number;
}

export default function FigureDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { lang, t } = usePublicLang();
  const [showAllSeeds, setShowAllSeeds] = useState(false);
  const [seedData, setSeedData] = useState<SeedFileData | null>(null);
  const [storyData, setStoryData] = useState<StoryFileData | null>(null);

  const figureId = slug ? figureSlugToId[slug] : undefined;
  const figure = figureId ? getFigureById(figureId, lang) : undefined;
  const seo = figureId ? getFigureSeo(figureId, lang) : undefined;

  // Dynamic import of seed data
  useEffect(() => {
    if (!figureId) return;
    import(`../../data/public/seeds/${lang}/${figureId}.json`)
      .then(mod => setSeedData(mod.default || mod))
      .catch(() => {});
  }, [figureId, lang]);

  // Dynamic import of story data
  useEffect(() => {
    if (!figureId) return;
    import(`../../data/public/stories/${lang}/${figureId}.json`)
      .then(mod => setStoryData(mod.default || mod))
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

  // Related figures from seed connections
  const relatedFigureIds = useMemo(() => {
    if (!seedData?.seeds) return [];
    const connectionFigures = new Set<string>();
    for (const seed of seedData.seeds) {
      for (const conn of seed.connections || []) {
        if (conn.figure !== figureId) connectionFigures.add(conn.figure);
      }
    }
    return Array.from(connectionFigures).slice(0, 4);
  }, [seedData, figureId]);

  if (!figureId || !figure) {
    return <Navigate to={publicUrl(lang, '/figures')} replace />;
  }

  const seeds = seedData?.seeds || [];
  const displayedSeeds = showAllSeeds ? seeds : seeds.slice(0, 4);
  const audioUrl = getPublicAudioUrl(figureId, lang, 0);

  // Clean about text
  const aboutParagraphs = figure.about.split('\n').filter(p => p.trim() && !p.includes(' \u2022 '));

  // SEO data
  const metaDescription = seo?.description || aboutParagraphs[0]?.slice(0, 160) || figure.about.slice(0, 160);
  const teachingsHeading = seo?.teachingsHeading || `${t('figures.teachings')} (${seeds.length})`;

  return (
    <div className="pub-content">
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
          about: aboutParagraphs[0] || figure.about,
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

      {/* Hero Section */}
      <section className="pub-hero">
        <div className="pub-hero__image" style={{ maxWidth: 280 }}>
          <StaticImage
            figureId={figureId}
            type="main"
            alt={figure.name}
            loading="eager"
          />
        </div>
        <div className="pub-hero__info">
          <h1 className="pub-hero__title">{figure.name}</h1>
          <div className="pub-hero__meta">
            {figure.period && <span className="pub-hero__badge">{figure.period}</span>}
            {figure.tradition && <span className="pub-hero__badge">{figure.tradition}</span>}
            {figure.category && <span className="pub-hero__badge">{figure.category}</span>}
          </div>
          {aboutParagraphs.map((p, i) => (
            <p key={i} className="pub-hero__about">{p}</p>
          ))}
        </div>
      </section>

      {/* Journey Overview */}
      <JourneyOverview
        figureName={figure.name}
        storyMinutes={storyData?.totalMinutes || 120}
        storyChapters={storyData ? storyData.chapters.length - 1 : 12}
        seedCount={seeds.length || 12}
        councilCount={relatedCouncils.length}
      />

      {/* Core Teachings (Seeds) with Story intro */}
      {seeds.length > 0 && (
        <CollapsibleSection title={teachingsHeading} count={seeds.length} defaultOpen>
          {/* Story intro card */}
          <div className="pub-seed" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <h3 className="pub-seed__title" style={{ margin: 0 }}>
                {t('story.title').replace('{name}', figure.name)}
              </h3>
              <span className="pub-journey__badge pub-journey__badge--listen">{t('journey.listen')}</span>
            </div>
            <p className="pub-seed__summary">
              {t('story.subtitle')
                .replace('{count}', String(storyData ? storyData.chapters.length - 1 : 12))
                .replace('{minutes}', String(storyData?.totalMinutes || 120))}
            </p>
            <PublicAudioPlayer
              audioUrl={audioUrl}
              label={`${t('figures.audioSample')} - ${figure.name}`}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {displayedSeeds.map(seed => (
              <SeedPreview key={seed.id} seed={seed} />
            ))}
          </div>
          {seeds.length > 4 && (
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                className="pub-toggle"
                onClick={() => setShowAllSeeds(!showAllSeeds)}
              >
                {showAllSeeds ? t('cta.showLess') : t('cta.showAllTeachings')}
              </button>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Key Concepts */}
      {figure.keyConcepts.length > 0 && (
        <section className="pub-section">
          <h2 className="pub-section__title">{t('figures.keyConcepts')}</h2>
          {figure.essence && (
            <p className="pub-section__text" style={{ marginBottom: '1.5rem' }}>
              {figure.essence}
            </p>
          )}
          <div className="pub-concepts">
            {figure.keyConcepts.map(concept => (
              <div key={concept.term} className="pub-concept">
                <div className="pub-concept__term">{concept.term}</div>
                <div className="pub-concept__def">{concept.definition}</div>
              </div>
            ))}
          </div>
          {figure.primaryWorks.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <strong style={{ color: 'var(--gold-subtle)' }}>{t('figures.primaryWorks')}:</strong>{' '}
              <span className="pub-section__text">{figure.primaryWorks.join(', ')}</span>
            </div>
          )}
        </section>
      )}

      {/* Council Debates */}
      {relatedCouncils.length > 0 && (
        <CollapsibleSection title={t('figures.councilAppearances')} count={relatedCouncils.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {relatedCouncils.map(council => (
              <CouncilPreview key={council.id} council={council} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Topics */}
      <TopicBadges tags={figure.topTags} figureName={figure.name} />

      {/* Related Figures */}
      {relatedFigureIds.length > 0 && (
        <section className="pub-section">
          <h2 className="pub-section__title">{t('figures.relatedFigures')}</h2>
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
                  style={{ flexDirection: 'row', gap: '0.75rem' }}
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
        </section>
      )}

      {/* Themes this figure speaks to */}
      {figureId && figureThemes[figureId] && figureThemes[figureId].length > 0 && (
        <section className="pub-section">
          <h2 className="pub-section__title">{t('figures.themes')}</h2>
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
        </section>
      )}

      {/* CTA */}
      <PublicCTA figureName={getShortDisplayName(figureId)} figureId={figureId} variant="sticky" />
    </div>
  );
}
