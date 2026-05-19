// About page V2 - What You'll Find, visual modes, tradition groups, Built Different
// Remove this file when stripping marketing pages from a fork

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePublicLang } from '../../components/public/PublicLangContext';
import Breadcrumbs from '../../components/public/Breadcrumbs';
import MetaTags from '../../components/public/MetaTags';
import JsonLd, { agoraCosmicaSchema, organizationSchema, webSiteSchema } from '../../components/public/JsonLd';
import PublicCTA from '../../components/public/PublicCTA';
import ContentVolume from '../../components/public/ContentVolume';
import { getFiguresCatalog } from '../../data/public/figuresCatalog';
import { figureIdToSlug } from '../../data/public/slugMap';
import { publicUrl } from '../../utils/public/publicSeo';

// Tradition groupings for the figures section
const TRADITION_GROUPS = [
  { key: 'western', ids: ['aurelius', 'plato', 'nietzsche', 'schopenhauer', 'beauvoir', 'eckhart'] },
  { key: 'eastern', ids: ['laozi', 'gautama', 'rumi', 'zenji'] },
  { key: 'literature', ids: ['woolf', 'dickinson', 'shakespeare', 'austen', 'goethe', 'blake'] },
  { key: 'art', ids: ['kahlo', 'mozart', 'vinci'] },
  { key: 'science', ids: ['einstein', 'galilei', 'lovelace'] },
  { key: 'justice', ids: ['king', 'gandhi', 'mandela', 'tubman', 'angelou'] },
  { key: 'psychology', ids: ['jung', 'campbell'] },
  { key: 'mysticism', ids: ['bingen'] },
];

const TRADITION_LABELS: Record<string, { en: string; de: string }> = {
  western: { en: 'Western Philosophy', de: 'Westliche Philosophie' },
  eastern: { en: 'Eastern Wisdom', de: '\u00d6stliche Weisheit' },
  literature: { en: 'Literature & Poetry', de: 'Literatur & Poesie' },
  art: { en: 'Art & Expression', de: 'Kunst & Ausdruck' },
  science: { en: 'Science & Innovation', de: 'Wissenschaft & Innovation' },
  justice: { en: 'Justice & Liberation', de: 'Gerechtigkeit & Befreiung' },
  psychology: { en: 'Psychology & Myth', de: 'Psychologie & Mythos' },
  mysticism: { en: 'Mysticism', de: 'Mystik' },
};

const MODE_CARDS = [
  { key: 'story', nameKey: 'journey.modeStory', badge: 'listen' },
  { key: 'wisdom', nameKey: 'journey.modeWisdom', badge: 'talk' },
  { key: 'prism', nameKey: 'journey.modePrism', badge: 'listen' },
  { key: 'quest', nameKey: 'journey.modeQuest', badge: 'talk' },
  { key: 'freetalk', nameKey: 'journey.freetalk', badge: 'talk' },
  { key: 'council', nameKey: 'journey.modeCouncil', badge: 'listen' },
];

export default function AboutPage() {
  const { lang, t } = usePublicLang();
  const figures = useMemo(() => getFiguresCatalog(lang), [lang]);
  const figureMap = useMemo(() => new Map(figures.map(f => [f.id, f])), [figures]);

  return (
    <div className="pub-content">
      <MetaTags
        title={t('about.pageTitle')}
        description={t('about.pageDescription')}
        canonicalPath="/about"
        lang={lang}
      />
      <JsonLd data={agoraCosmicaSchema()} />
      <JsonLd data={organizationSchema()} />
      <JsonLd data={webSiteSchema()} />

      <Breadcrumbs items={[{ label: t('breadcrumbs.about') }]} />

      <h1 className="pub-hero__title">{t('about.pageTitle')}</h1>
      <p style={{
        fontSize: 'var(--text-lg)',
        fontStyle: 'italic',
        color: 'var(--gold-subtle)',
        margin: '0.5rem 0 1.5rem',
      }}>
        {t('about.mission')}
      </p>

      {/* Mission */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.missionTitle')}</h2>
        <div className="pub-section__text">
          {t('about.missionStatement').split('\n\n').map((para, i) => (
            <p key={i} style={{ marginBottom: '1rem' }}>{para}</p>
          ))}
        </div>
      </section>

      {/* About the Organization */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.organizationTitle')}</h2>
        <div className="pub-section__text">
          <p>{t('about.organizationStatement')}</p>
        </div>
      </section>

      {/* Our Values */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.valuesTitle')}</h2>
        <ul className="pub-section__text" style={{ paddingLeft: '1.25rem' }}>
          <li style={{ marginBottom: '0.5rem' }}>{t('about.valueGratitude')}</li>
          <li style={{ marginBottom: '0.5rem' }}>{t('about.valueCuriosity')}</li>
          <li style={{ marginBottom: '0.5rem' }}>{t('about.valueOpenness')}</li>
          <li>{t('about.valueTransformation')}</li>
        </ul>
      </section>

      {/* Our Promise */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.promiseTitle')}</h2>
        <div className="pub-section__text">
          <p>{t('about.promiseStatement')}</p>
        </div>
      </section>

      {/* Breaking Down Barriers */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.barriersTitle')}</h2>
        <div className="pub-section__text">
          <p style={{ marginBottom: '1rem' }}>{t('about.barriersIntro')}</p>
          <ul style={{ paddingLeft: '1.25rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>{t('about.barrierGeographic')}</li>
            <li style={{ marginBottom: '0.5rem' }}>{t('about.barrierAcademic')}</li>
            <li style={{ marginBottom: '0.5rem' }}>{t('about.barrierAge')}</li>
            <li>{t('about.barrierEconomic')}</li>
          </ul>
        </div>
      </section>

      {/* Our Definition of Success */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.successTitle')}</h2>
        <div className="pub-section__text">
          <p>{t('about.successStatement')}</p>
        </div>
      </section>

      <ContentVolume />

      {/* What You'll Find */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.whatYoullFind.title')}</h2>
        <div className="pub-section__text">
          <p>{t('about.whatYoullFind.p1')}</p>
          <p>{t('about.whatYoullFind.p2')}</p>
          <p>{t('about.whatYoullFind.p3')}</p>
        </div>
      </section>

      {/* How It Works - Mode Cards */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.howItWorks.title')}</h2>
        <p className="pub-section__text" style={{ marginBottom: '1.25rem' }}>
          {t('about.howItWorks.subtitle')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {MODE_CARDS.map(mode => (
            <div key={mode.key} className="pub-concept">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                <span className="pub-concept__term" style={{ margin: 0 }}>
                  {t(mode.nameKey)}
                </span>
                <span className={`pub-journey__badge pub-journey__badge--${mode.badge}`}>
                  {t(`journey.${mode.badge}`)}
                </span>
              </div>
              <div className="pub-concept__def">
                {t(`about.howItWorks.${mode.key}`)}
              </div>
            </div>
          ))}
          {/* Audio Library */}
          <div className="pub-concept">
            <div className="pub-concept__term">{t('journey.audioLibrary')}</div>
            <div className="pub-concept__def">
              {t('about.howItWorks.audioLibrary')}
            </div>
          </div>
        </div>
      </section>

      {/* The 30 Figures - grouped by tradition */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.figures.title')}</h2>
        <p className="pub-section__text" style={{ marginBottom: '1.25rem' }}>
          {t('about.figures.description')}
        </p>
        {TRADITION_GROUPS.map(group => (
          <div key={group.key} style={{ marginBottom: '1rem' }}>
            <h3 style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-sm)',
              color: 'var(--gold-subtle)',
              marginBottom: '0.5rem',
              fontWeight: 600,
            }}>
              {TRADITION_LABELS[group.key]?.[lang] || group.key}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {group.ids.map(id => {
                const fig = figureMap.get(id);
                if (!fig) return null;
                return (
                  <Link
                    key={id}
                    to={publicUrl(lang, `/figures/${figureIdToSlug[id]}`)}
                    className="pub-hero__badge"
                    style={{ textDecoration: 'none' }}
                  >
                    {fig.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Built Different */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.builtDifferent.title')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(['nonprofit', 'factChecked', 'noTracking', 'freeTurns'] as const).map(key => (
            <p key={key} className="pub-section__text" style={{ margin: 0 }}>
              {t(`about.builtDifferent.${key}`)}
            </p>
          ))}
          <p className="pub-section__text" style={{ margin: 0 }}>
            {t('about.builtDifferent.github')}{' '}
            <a
              href="https://github.com/chipmates/agoracosmica"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--gold-primary)' }}
            >
              chipmates/agoracosmica
            </a>
          </p>
        </div>
      </section>

      {/* Closing quote */}
      <section className="pub-section" style={{ marginTop: '2rem' }}>
        <blockquote style={{
          padding: '1.5rem 1.75rem',
          borderLeft: '3px solid var(--gold-subtle)',
          background: 'color-mix(in srgb, var(--gold-subtle) 6%, transparent)',
          borderRadius: '0.5rem',
          fontStyle: 'italic',
          color: 'var(--text-primary)',
          lineHeight: '1.7',
        }}>
          <p style={{ margin: 0 }}>{t('about.closingQuote')}</p>
          <footer style={{
            marginTop: '0.75rem',
            fontStyle: 'normal',
            color: 'var(--gold-subtle)',
            fontSize: 'var(--text-sm)',
          }}>
            — {t('about.closingAttribution')}
          </footer>
        </blockquote>
      </section>

      <PublicCTA variant="inline" />
    </div>
  );
}
