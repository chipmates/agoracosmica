// Theme detail page: a life question, the voices who answer it, the council
// debates around it. Revised per Theme-Pages-Revision-Plan.md.
// Remove this file when stripping marketing pages from a fork

import { useMemo } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { usePublicLang } from '../../components/public/PublicLangContext';
import Breadcrumbs from '../../components/public/Breadcrumbs';
import MetaTags from '../../components/public/MetaTags';
import JsonLd, { articleSchema } from '../../components/public/JsonLd';
import EchoNote from '../../components/public/EchoNote';
import CollapsibleSection from '../../components/public/CollapsibleSection';
import ThemeVoice from '../../components/public/ThemeVoice';
import PublicCTA from '../../components/public/PublicCTA';
import CouncilHero from '../../components/public/CouncilHero';
import {
  THEMES,
  councilsByTheme,
  getLocalizedTitle,
  getLocalizedHook,
  getShortDisplayName,
  type ThemeId,
  type CatalogCouncil,
} from '../../data/councilCatalog';
import { getThemeVoices } from '../../data/public/themeVoices';
import { publicUrl, canonicalUrl } from '../../utils/public/publicSeo';
import { captureCouncilIntent } from '../../utils/public/entryIntent';
import { sendConversion } from '../../utils/public/gclidCapture';

const VALID_THEMES = new Set(THEMES.map(t => t.id));

// One representative figure per theme for the OG image. Mirrors prerender.mjs
// THEME_OG_FIGURE.
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

  const isValid = !!theme && VALID_THEMES.has(theme as ThemeId);

  const councils = useMemo(() => {
    if (!isValid || !theme) return [];
    return [...(councilsByTheme[theme as ThemeId] || [])]
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [theme, isValid]);

  const heroCouncil: CatalogCouncil | undefined = councils[0];
  const otherCouncils = councils.slice(1);

  // Per-row deep-link click handler — mirrors PublicCTA. Writes the intent to
  // sessionStorage, fires the start_exploring conversion inside the click so
  // its keepalive beacon survives the navigation, then the <a href="/"> does
  // the hard nav into the app, where routeAfterOnboarding picks up the intent
  // and opens that specific council.
  const handleRowClick = (councilId: string) => (): void => {
    captureCouncilIntent(councilId, lang);
    sendConversion('start_exploring');
  };

  if (!isValid || !theme) {
    return <Navigate to={publicUrl(lang, '/themes')} replace />;
  }

  const themeName = t(`themes.${theme}.name`);
  const themeTagline = t(`themes.${theme}.tagline`);
  const themeDescription = t(`themes.${theme}.description`);
  const themeIntroRaw = t(`themes.${theme}.intro`);
  const themeIntro =
    themeIntroRaw && themeIntroRaw !== `themes.${theme}.intro` ? themeIntroRaw : '';

  // The intro essay reads as a lead paragraph, one paragraph per voice, then a
  // closing coda. It renders faced when the curated voices line up with the
  // essay's middle paragraphs, otherwise as plain prose.
  const paragraphs = themeIntro
    ? themeIntro.split('\n\n').map(p => p.trim()).filter(Boolean)
    : [];
  const voices = getThemeVoices(theme);
  const faced = voices.length > 0 && paragraphs.length >= voices.length + 2;
  const lead = faced ? paragraphs[0] : '';
  const voiceParas = faced ? paragraphs.slice(1, 1 + voices.length) : [];
  const coda = faced ? paragraphs.slice(1 + voices.length).join(' ') : '';

  const relatedThemeIds = (RELATED_THEMES[theme] || []).slice(0, 3);
  const ogFigureId = THEME_OG_FIGURE[theme];
  const themeOgImage = ogFigureId
    ? `https://media.agoracosmica.org/images/figures/${ogFigureId}/main/1200.webp`
    : undefined;

  const councilTypeLabel = (type: 'confrontational' | 'reflective'): string =>
    lang === 'de'
      ? type === 'confrontational' ? 'konfrontativ' : 'reflektiv'
      : type;

  return (
    <div className="pub-content pub-theme">
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

      <header className="pub-theme-hero">
        <div className="pub-theme-hero__eyebrow">
          {t('themes.detailEyebrow', 'A life question')}
        </div>
        <h1 className="pub-theme-hero__name">{themeName}</h1>
        <p className="pub-theme-hero__question">{themeTagline}</p>
      </header>

      <div className="pub-theme-body">
        <EchoNote variant="theme" />

        {faced ? (
          <>
            {lead && <p className="pub-voices__lead">{lead}</p>}
            <section>
              {voices.map((voice, i) => (
                <ThemeVoice
                  key={voice.figureId}
                  figureId={voice.figureId}
                  stance={lang === 'de' ? voice.stanceDe : voice.stance}
                  paragraph={voiceParas[i] || ''}
                />
              ))}
            </section>
            {coda && <p className="pub-theme-coda">{coda}</p>}
          </>
        ) : (
          themeIntro && (
            <section className="pub-section">
              <div className="pub-section__text">
                {paragraphs.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          )
        )}

        {heroCouncil && <CouncilHero council={heroCouncil} />}

        {otherCouncils.length > 0 && (
          <CollapsibleSection
            title={t('themes.moreDebates', 'More debates in this theme')}
            count={otherCouncils.length}
          >
            <div className="pub-council-list">
              {otherCouncils.map(council => (
                <a
                  key={council.id}
                  href="/"
                  onClick={handleRowClick(council.id)}
                  className="pub-council-row pub-council-row--link"
                  aria-label={`${t('cta.listenDebate', 'Listen to this debate')}: ${getLocalizedTitle(council, lang)}`}
                >
                  <div className="pub-council-row__head">
                    <span className="pub-council-row__title">
                      {getLocalizedTitle(council, lang)}
                    </span>
                    <span className="pub-council-row__tag">
                      {councilTypeLabel(council.type)}
                    </span>
                  </div>
                  <p className="pub-council-row__hook">
                    {getLocalizedHook(council, lang)}
                  </p>
                  <p className="pub-council-row__figures">
                    {[council.moderator, ...council.participants]
                      .map(p => getShortDisplayName(p.id))
                      .join(' · ')}
                  </p>
                  <span className="pub-council-row__cta">
                    {t('cta.listenDebate', 'Listen to this debate')}
                  </span>
                </a>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {relatedThemeIds.length > 0 && (
          <CollapsibleSection title={t('themes.relatedThemes')}>
            <div className="pub-theme-rel">
              {relatedThemeIds.map(relId => (
                <Link
                  key={relId}
                  to={publicUrl(lang, `/themes/${relId}`)}
                  className="pub-theme-rel__link"
                >
                  {t(`themes.${relId}.name`)}
                </Link>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>

      <PublicCTA variant="sticky" councilCta councilId={heroCouncil?.id} />
    </div>
  );
}
