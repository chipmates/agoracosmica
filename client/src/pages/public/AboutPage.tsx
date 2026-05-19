// About page: the nonprofit and the mission, then what the platform offers.
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
  eastern: { en: 'Eastern Wisdom', de: 'Östliche Weisheit' },
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

// The value and barrier strings are authored as "Label: text". Split them so
// the label can stand as a gold heading beside its line.
function splitLabel(value: string): { label: string; text: string } {
  const idx = value.indexOf(': ');
  if (idx === -1) return { label: '', text: value };
  return { label: value.slice(0, idx), text: value.slice(idx + 2) };
}

export default function AboutPage() {
  const { lang, t } = usePublicLang();
  const figures = useMemo(() => getFiguresCatalog(lang), [lang]);
  const figureMap = useMemo(() => new Map(figures.map(f => [f.id, f])), [figures]);

  const values = (['valueGratitude', 'valueCuriosity', 'valueOpenness', 'valueTransformation'] as const)
    .map(k => splitLabel(t(`about.${k}`)));
  const barriers = (['barrierGeographic', 'barrierAcademic', 'barrierAge', 'barrierEconomic'] as const)
    .map(k => splitLabel(t(`about.${k}`)));

  return (
    <div className="pub-content pub-about">
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
      <p className="pub-about-lead">{t('about.mission')}</p>

      {/* Mission */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.missionTitle')}</h2>
        <div className="pub-section__text">
          {t('about.missionStatement').split('\n\n').map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </section>

      {/* About the organization */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.organizationTitle')}</h2>
        <div className="pub-section__text">
          <p>{t('about.organizationStatement')}</p>
        </div>
      </section>

      {/* Values */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.valuesTitle')}</h2>
        <dl className="pub-about-dl">
          {values.map((v, i) => (
            <div key={i} className="pub-about-dl__row">
              <dt>{v.label}</dt>
              <dd>{v.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Promise */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.promiseTitle')}</h2>
        <div className="pub-section__text">
          <p>{t('about.promiseStatement')}</p>
        </div>
      </section>

      {/* Breaking down barriers */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.barriersTitle')}</h2>
        <div className="pub-section__text">
          <p>{t('about.barriersIntro')}</p>
        </div>
        <dl className="pub-about-dl">
          {barriers.map((b, i) => (
            <div key={i} className="pub-about-dl__row">
              <dt>{b.label}</dt>
              <dd>{b.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Definition of success */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.successTitle')}</h2>
        <div className="pub-section__text">
          <p>{t('about.successStatement')}</p>
        </div>
      </section>

      <ContentVolume />

      {/* What you'll find */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.whatYoullFind.title')}</h2>
        <div className="pub-section__text">
          <p>{t('about.whatYoullFind.p1')}</p>
          <p>{t('about.whatYoullFind.p2')}</p>
          <p>{t('about.whatYoullFind.p3')}</p>
        </div>
      </section>

      {/* How it works */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.howItWorks.title')}</h2>
        <div className="pub-section__text">
          <p>{t('about.howItWorks.subtitle')}</p>
        </div>
        <div className="pub-concepts">
          {MODE_CARDS.map(mode => (
            <div key={mode.key} className="pub-concept">
              <div className="pub-concept__head">
                <span className="pub-concept__term">{t(mode.nameKey)}</span>
                <span className={`pub-journey__badge pub-journey__badge--${mode.badge}`}>
                  {t(`journey.${mode.badge}`)}
                </span>
              </div>
              <div className="pub-concept__def">{t(`about.howItWorks.${mode.key}`)}</div>
            </div>
          ))}
          <div className="pub-concept">
            <div className="pub-concept__term">{t('journey.audioLibrary')}</div>
            <div className="pub-concept__def">{t('about.howItWorks.audioLibrary')}</div>
          </div>
        </div>
      </section>

      {/* The 30 figures, grouped by tradition */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.figures.title')}</h2>
        <div className="pub-section__text">
          <p>{t('about.figures.description')}</p>
        </div>
        {TRADITION_GROUPS.map(group => (
          <div key={group.key} className="pub-about-group">
            <h3 className="pub-about-group__label">
              {TRADITION_LABELS[group.key]?.[lang] || group.key}
            </h3>
            <div className="pub-about-group__figures">
              {group.ids.map(id => {
                const fig = figureMap.get(id);
                if (!fig) return null;
                return (
                  <Link
                    key={id}
                    to={publicUrl(lang, `/figures/${figureIdToSlug[id]}`)}
                    className="pub-hero__badge"
                  >
                    {fig.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Built different */}
      <section className="pub-section">
        <h2 className="pub-section__title">{t('about.builtDifferent.title')}</h2>
        <div className="pub-about-points">
          {(['nonprofit', 'factChecked', 'noTracking', 'freeTurns'] as const).map(key => (
            <p key={key}>{t(`about.builtDifferent.${key}`)}</p>
          ))}
          <p>
            {t('about.builtDifferent.github')}{' '}
            <a
              href="https://github.com/chipmates/agoracosmica"
              target="_blank"
              rel="noopener noreferrer"
              className="pub-textlink"
            >
              chipmates/agoracosmica
            </a>
          </p>
        </div>
      </section>

      {/* Closing quote */}
      <div className="pub-about-quote">
        <div className="pub-about-quote__rule" aria-hidden="true" />
        <blockquote>{t('about.closingQuote')}</blockquote>
        <cite className="pub-about-quote__cite">&#8212; {t('about.closingAttribution')}</cite>
      </div>

      <PublicCTA variant="inline" />
    </div>
  );
}
