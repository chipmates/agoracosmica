#!/usr/bin/env node

// Prerender public pages to static HTML for SEO
// Phase 1: HTML shell pages with meta tags + JSON-LD for crawlers
// Phase 2 (future): Full React SSR rendering with react-dom/server

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const BUILD_DIR = join(import.meta.dirname, '..', 'build');
const SITE_URL = 'https://agoracosmica.org';
const ORG_ID = `${SITE_URL}/#organization`;
const ORG_LOGO = 'https://media.agoracosmica.org/images/ui/logo/512.webp';
const MEDIA_URL = 'https://media.agoracosmica.org';
const TODAY = new Date().toISOString().split('T')[0];
const LAUNCH_DATE = '2026-05-06';

// Homepage copy. Brand-first title pattern (peer convention: Khan Academy,
// Duolingo, Coursera). Locked taglines, locked trust signals, no em-dash.
const HOME_COPY = {
  en: {
    fullTitle: 'Agora Cosmica - A Living Library You Can Talk To',
    description: 'Listen to life stories, learn from teachings, and converse with 30 figures from history. Marcus Aurelius to Frida Kahlo. Nonprofit, open source.',
  },
  de: {
    fullTitle: 'Agora Cosmica - Eine lebendige Bibliothek, mit der du sprechen kannst',
    description: 'Höre Lebensgeschichten, lerne aus Lehren und sprich mit 30 Figuren der Geschichte. Marcus Aurelius bis Frida Kahlo. Gemeinnützig, Open Source.',
  },
};

// Read the built index.html as template
const template = readFileSync(join(BUILD_DIR, 'index.html'), 'utf-8');

// Slug mapping
const FIGURE_SLUGS = {
  'marcus-aurelius': 'aurelius', 'maya-angelou': 'angelou', 'jane-austen': 'austen',
  'simone-de-beauvoir': 'beauvoir', 'hildegard-von-bingen': 'bingen', 'william-blake': 'blake',
  'joseph-campbell': 'campbell', 'leonardo-da-vinci': 'vinci', 'emily-dickinson': 'dickinson',
  'dogen-zenji': 'zenji', 'meister-eckhart': 'eckhart', 'albert-einstein': 'einstein',
  'galileo-galilei': 'galilei', 'mahatma-gandhi': 'gandhi', 'siddhartha-gautama': 'gautama',
  'johann-wolfgang-von-goethe': 'goethe', 'carl-gustav-jung': 'jung', 'frida-kahlo': 'kahlo',
  'martin-luther-king-jr': 'king', 'laozi': 'laozi', 'ada-lovelace': 'lovelace',
  'nelson-mandela': 'mandela', 'wolfgang-amadeus-mozart': 'mozart', 'friedrich-nietzsche': 'nietzsche',
  'plato': 'plato', 'rumi': 'rumi', 'arthur-schopenhauer': 'schopenhauer',
  'william-shakespeare': 'shakespeare', 'harriet-tubman': 'tubman', 'virginia-woolf': 'woolf',
};

const THEME_IDS = [
  'meaning-purpose', 'loss-grief', 'who-am-i', 'mind-creativity',
  'love-connection', 'freedom-justice', 'faith-death-mystery', 'moral-life',
];

// Load figure catalog for meta tags
const CLIENT_DIR = join(import.meta.dirname, '..');
function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

// Load translation files for meta descriptions
const publicEn = readJson(join(CLIENT_DIR, 'src/assets/translations/public-en.json'));
const publicDe = readJson(join(CLIENT_DIR, 'src/assets/translations/public-de.json'));

// Memoized figure-translation reads (one file per figure × lang, accessed up to 4 times)
const figureTranslationCache = new Map();
function getFigureTranslation(id, lang) {
  const key = `${id}:${lang}`;
  if (!figureTranslationCache.has(key)) {
    figureTranslationCache.set(
      key,
      readJson(join(CLIENT_DIR, `src/assets/translations/figures/${lang}/${id}.json`)) || {}
    );
  }
  return figureTranslationCache.get(key);
}

function getFigureName(id, lang) {
  // Strip the "Echo of/von" brand prefix for SEO-clean figure-name keywords.
  // Brand term "Echo" stays in body UI; titles benefit from clean entity names.
  return getFigureTranslation(id, lang)?.name?.replace(/^Echo (of|von) /, '') || id;
}

function getFigureAbout(id, lang) {
  return (getFigureTranslation(id, lang)?.about || '').split('\n')[0].slice(0, 160);
}

function getFigureFullAbout(id, lang) {
  return (getFigureTranslation(id, lang)?.about || '')
    .split('\n')
    .filter(p => p.trim() && !p.includes(' • '))
    .join(' ')
    // Strip em-dashes (locked rule: no em-dash in displayed text).
    // Convert to commas, then collapse adjacent punctuation.
    .replace(/—/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/,,+/g, ',')
    .replace(/,\s+,/g, ',')
    .slice(0, 500);
}

function getFigureTradition(id, lang) {
  return getFigureTranslation(id, lang)?.tradition || '';
}

function getFigurePeriod(id, lang) {
  return getFigureTranslation(id, lang)?.period || '';
}

// Memoized seed reads — used by figure-page noscript for teaching titles + connections
const figureSeedsCache = new Map();
function getFigureSeeds(id, lang) {
  const key = `${id}:${lang}`;
  if (!figureSeedsCache.has(key)) {
    const data = readJson(join(CLIENT_DIR, `src/data/public/seeds/${lang}/${id}.json`));
    figureSeedsCache.set(key, data?.seeds || []);
  }
  return figureSeedsCache.get(key);
}

// Tradition groups — mirrors AboutPage.tsx TRADITION_GROUPS
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

const TRADITION_LABELS = {
  western: { en: 'Western Philosophy', de: 'Westliche Philosophie' },
  eastern: { en: 'Eastern Wisdom', de: 'Östliche Weisheit' },
  literature: { en: 'Literature & Poetry', de: 'Literatur & Poesie' },
  art: { en: 'Art & Expression', de: 'Kunst & Ausdruck' },
  science: { en: 'Science & Innovation', de: 'Wissenschaft & Innovation' },
  justice: { en: 'Justice & Liberation', de: 'Gerechtigkeit & Befreiung' },
  psychology: { en: 'Psychology & Myth', de: 'Psychologie & Mythos' },
  mysticism: { en: 'Mysticism', de: 'Mystik' },
};

// Reverse lookup: id → slug
const ID_TO_SLUG = Object.fromEntries(
  Object.entries(FIGURE_SLUGS).map(([slug, id]) => [id, slug])
);

// Load figureSeo.ts as plain text and extract per-field values.
// Cached after first read to avoid re-parsing for every figure × lang × field.
let _seoFileText = null;
function loadSeoFile() {
  if (_seoFileText === null) {
    try {
      _seoFileText = readFileSync(join(CLIENT_DIR, 'src/data/public/figureSeo.ts'), 'utf-8');
    } catch { _seoFileText = ''; }
  }
  return _seoFileText;
}

function getFigureSeoField(id, lang, field) {
  const seoFile = loadSeoFile();
  if (!seoFile) return null;
  const figBlock = seoFile.match(new RegExp(`${id}:\\s*\\{[\\s\\S]*?\\}\\s*,\\s*\\}`, 'm'));
  if (!figBlock) return null;
  const langBlock = figBlock[0].match(new RegExp(`${lang}:\\s*\\{[\\s\\S]*?${field}:\\s*"([^"]*)"`, 'm'));
  return langBlock?.[1] || null;
}

function getFigureSeoDesc(id, lang) {
  return getFigureSeoField(id, lang, 'description');
}

function getFigureSeoTitle(id, lang) {
  return getFigureSeoField(id, lang, 'seoTitle');
}

function t(lang, key) {
  const translations = lang === 'de' ? publicDe : publicEn;
  const keys = key.split('.');
  let result = translations;
  for (const k of keys) {
    result = result?.[k];
  }
  return typeof result === 'string' ? result : key;
}

// =============================================================
// JSON-LD schema generators
// Mirrors client/src/components/public/JsonLd.tsx — keep in sync.
// =============================================================

function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    '@id': ORG_ID,
    name: 'ChipMates gemeinnützige GmbH',
    url: SITE_URL,
    logo: ORG_LOGO,
    description: 'A small German non-profit building Agora Cosmica, an open source wisdom platform with 30 historical figures.',
    slogan: 'A Living Library You Can Talk To',
    knowsAbout: ['philosophy', 'history', 'historical figures', 'wisdom traditions'],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Schusterstr. 50',
      addressLocality: 'Freiburg im Breisgau',
      postalCode: '79098',
      addressCountry: 'DE',
    },
    email: 'agoracosmica@chipmates.ai',
    sameAs: ['https://github.com/chipmates/agoracosmica'],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'agoracosmica@chipmates.ai',
      contactType: 'customer support',
      availableLanguage: ['English', 'German'],
    },
  };
}

function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: 'Agora Cosmica',
    url: SITE_URL,
    description: 'A Living Library You Can Talk To',
    publisher: { '@id': ORG_ID },
    inLanguage: ['en', 'de'],
  };
}

function personSchema(figure) {
  const url = `${SITE_URL}${figure.lang === 'de' ? '/de' : ''}/figures/${figure.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${url}#person`,
    name: figure.name,
    description: figure.about,
    url,
    knowsAbout: figure.tradition,
    ...(figure.image && { image: figure.image }),
    mainEntityOfPage: url,
  };
}

function articleSchema(article) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${article.url}#article`,
    headline: article.title,
    description: article.description,
    url: article.url,
    inLanguage: article.lang,
    ...(article.image && { image: article.image }),
    ...(article.datePublished && { datePublished: article.datePublished }),
    ...(article.dateModified && { dateModified: article.dateModified }),
    mainEntityOfPage: article.url,
    publisher: {
      '@type': 'EducationalOrganization',
      '@id': ORG_ID,
      name: 'ChipMates gemeinnützige GmbH',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: ORG_LOGO },
    },
  };
}

function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function itemListSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: item.url,
      ...(item.description && { description: item.description }),
      ...(item.image && { image: item.image }),
    })),
  };
}

function softwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/#webapp`,
    name: 'Agora Cosmica',
    url: SITE_URL,
    applicationCategory: 'EducationApplication',
    operatingSystem: 'Web Browser',
    browserRequirements: 'Requires JavaScript',
    description: 'An open source wisdom platform with 30 historical figures, fully bilingual in English and German.',
    inLanguage: ['en', 'de'],
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
    publisher: { '@id': ORG_ID },
    featureList: [
      '30 historical figures with audio life stories',
      '12 teachings per figure',
      'Multi-perspective dialogues (Prism mode)',
      'Conversation in English and German',
      'Pre-produced council debates',
      'No tracking, no cookies',
    ],
  };
}

// Podcast metadata — sourced from Marketing/feeds/<show>/podcast-data.json
const PODCASTS = {
  en: {
    name: 'Agora Cosmica',
    description: 'Lives that still speak. First-person audiobooks inspired by remarkable people from history.',
    feedUrl: 'https://media.agoracosmica.org/podcasts/agora-cosmica/feed.xml',
    coverUrl: 'https://media.agoracosmica.org/podcasts/agora-cosmica/cover.jpg?v=7',
    id: 'https://media.agoracosmica.org/podcasts/agora-cosmica/#series',
  },
  de: {
    name: 'Agora Cosmica Deutsch',
    description: 'Leben, die noch sprechen. Hörbücher in der Ich-Perspektive, inspiriert von besonderen Menschen der Geschichte.',
    feedUrl: 'https://media.agoracosmica.org/podcasts/agora-cosmica-de/feed.xml',
    coverUrl: 'https://media.agoracosmica.org/podcasts/agora-cosmica-de/cover.jpg?v=7',
    id: 'https://media.agoracosmica.org/podcasts/agora-cosmica-de/#series',
  },
};

function podcastSeriesSchema(lang) {
  const p = PODCASTS[lang];
  return {
    '@context': 'https://schema.org',
    '@type': 'PodcastSeries',
    '@id': p.id,
    name: p.name,
    description: p.description,
    url: SITE_URL,
    webFeed: p.feedUrl,
    image: p.coverUrl,
    inLanguage: lang,
    publisher: { '@id': ORG_ID },
  };
}

function rssLinkTag(lang) {
  const p = PODCASTS[lang];
  return `<link rel="alternate" type="application/rss+xml" title="${p.name}" href="${p.feedUrl}" />`;
}

function serializeSchemas(schemas) {
  if (!schemas || schemas.length === 0) return '';
  return schemas
    .map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join('\n    ');
}

// =============================================================
// Noscript body generators
// Substantive HTML for non-JS crawlers (Bingbot, LLM browse-tools, Common
// Crawl, social unfurlers). Provides keyword-rich content + internal links.
// No em-dash or semicolons — locked rule for displayed text.
// =============================================================

// Figure → themes mapping. Mirrors figureSeo.ts `figureThemes` export.
// Each figure curated to 1-3 themes their teachings speak to most directly.
const FIGURE_THEMES = {
  angelou: ['who-am-i', 'freedom-justice'],
  aurelius: ['meaning-purpose', 'faith-death-mystery', 'moral-life'],
  austen: ['love-connection'],
  beauvoir: ['who-am-i', 'freedom-justice'],
  bingen: ['love-connection', 'faith-death-mystery'],
  blake: ['mind-creativity'],
  campbell: ['meaning-purpose', 'who-am-i'],
  vinci: ['mind-creativity'],
  dickinson: ['who-am-i', 'faith-death-mystery'],
  zenji: ['who-am-i', 'faith-death-mystery', 'moral-life'],
  eckhart: ['loss-grief', 'love-connection', 'faith-death-mystery'],
  einstein: ['mind-creativity'],
  galilei: ['mind-creativity', 'faith-death-mystery'],
  gandhi: ['freedom-justice', 'moral-life'],
  gautama: ['meaning-purpose', 'faith-death-mystery', 'moral-life'],
  goethe: ['mind-creativity', 'meaning-purpose'],
  jung: ['loss-grief', 'who-am-i'],
  kahlo: ['who-am-i'],
  king: ['loss-grief', 'freedom-justice', 'moral-life'],
  laozi: ['faith-death-mystery'],
  lovelace: ['mind-creativity'],
  mandela: ['loss-grief', 'freedom-justice'],
  mozart: ['mind-creativity'],
  nietzsche: ['meaning-purpose', 'who-am-i'],
  plato: ['moral-life'],
  rumi: ['meaning-purpose', 'love-connection'],
  schopenhauer: ['meaning-purpose', 'faith-death-mystery'],
  shakespeare: ['love-connection', 'who-am-i'],
  tubman: ['loss-grief', 'freedom-justice'],
  woolf: ['who-am-i', 'mind-creativity'],
};

// One representative figure per theme — drives the theme page OG image.
// Each theme picks a uniquely iconic figure to give every theme a distinct
// social preview (vs the generic default OG). Post-launch this can be replaced
// with custom designed theme images.
const THEME_OG_FIGURE = {
  'meaning-purpose': 'aurelius',       // Stoic, asks "what is worth doing"
  'loss-grief': 'mandela',             // 27 years of loss carried with dignity
  'who-am-i': 'kahlo',                 // 55 self-portraits literalize the question
  'mind-creativity': 'einstein',       // universal symbol of creative thought
  'love-connection': 'rumi',           // THE love poet
  'freedom-justice': 'king',           // civil rights, beloved community
  'faith-death-mystery': 'bingen',     // mystic visions, the Living Light
  'moral-life': 'gandhi',              // satyagraha, ethics as practice
};

// 4-5 representative figures per theme (manual curation, themes are stable)
const THEME_FIGURE_HINTS = {
  'meaning-purpose': ['aurelius', 'gautama', 'campbell', 'rumi', 'nietzsche'],
  'loss-grief': ['king', 'mandela', 'jung', 'eckhart', 'tubman'],
  'who-am-i': ['beauvoir', 'jung', 'kahlo', 'woolf', 'nietzsche'],
  'mind-creativity': ['einstein', 'vinci', 'mozart', 'woolf', 'blake'],
  'love-connection': ['rumi', 'austen', 'shakespeare', 'eckhart', 'bingen'],
  'freedom-justice': ['mandela', 'king', 'gandhi', 'tubman', 'beauvoir'],
  'faith-death-mystery': ['laozi', 'gautama', 'eckhart', 'bingen', 'aurelius'],
  'moral-life': ['aurelius', 'gandhi', 'king', 'plato', 'gautama'],
};

function homeNoscript(lang) {
  const prefix = lang === 'de' ? '/de' : '';
  const isDe = lang === 'de';
  const tagline = isDe
    ? 'Eine lebendige Bibliothek, mit der du sprechen kannst'
    : 'A Living Library You Can Talk To';
  const intro = isDe
    ? '30 historische Persönlichkeiten erzählen ihre Lebensgeschichten in der ersten Person. Höre ihre Geschichten, lerne aus ihren Lehren, stelle ihnen Fragen. Von Marcus Aurelius bis Frida Kahlo, von Laozi bis Ada Lovelace.'
    : '30 historical figures speak in first-person portraits. Listen to their life stories, learn from their teachings, ask them questions. From Marcus Aurelius to Frida Kahlo, from Laozi to Ada Lovelace.';
  const trustLine = isDe
    ? 'Gemeinnützig, Open Source, ohne Tracking. Gebaut von ChipMates gemeinnützige GmbH, einem deutschen Non-Profit für Bildung in Freiburg.'
    : 'Nonprofit, open source, no tracking. Built by ChipMates gemeinnützige GmbH, a German educational nonprofit in Freiburg.';
  const figuresHeading = isDe ? '30 Persönlichkeiten der Geschichte' : '30 Figures from history';
  const themesHeading = isDe ? '8 Themen des Lebens' : '8 Life Themes';
  const learnMoreHeading = isDe ? 'Mehr erfahren' : 'Learn more';

  const figuresHtml = TRADITION_GROUPS.map(group => {
    const groupLabel = TRADITION_LABELS[group.key][lang];
    const items = group.ids
      .map(id => `<a href="${prefix}/figures/${ID_TO_SLUG[id]}">${getFigureName(id, lang)}</a>`)
      .join(', ');
    return `<p><strong>${groupLabel}:</strong> ${items}</p>`;
  }).join('\n      ');

  const themesHtml = THEME_IDS.map(themeId => {
    const tname = t(lang, `themes.${themeId}.name`);
    const ttagline = t(lang, `themes.${themeId}.tagline`);
    return `<li><a href="${prefix}/themes/${themeId}">${tname}</a> (${ttagline})</li>`;
  }).join('\n        ');

  return `
      <h1>Agora Cosmica</h1>
      <p><em>${tagline}</em></p>
      <p>${intro}</p>
      <p>${trustLine}</p>

      <h2>${figuresHeading}</h2>
      ${figuresHtml}

      <h2>${themesHeading}</h2>
      <ul>
        ${themesHtml}
      </ul>

      <h2>${learnMoreHeading}</h2>
      <ul>
        <li><a href="${prefix}/about">${isDe ? 'Über Agora Cosmica' : 'About Agora Cosmica'}</a></li>
        <li><a href="${prefix}/contact">${isDe ? 'Kontakt' : 'Contact'}</a></li>
      </ul>
    `;
}

function figureNoscript(id, slug, lang) {
  const prefix = lang === 'de' ? '/de' : '';
  const isDe = lang === 'de';
  const name = getFigureName(id, lang);
  const period = getFigurePeriod(id, lang);
  const tradition = getFigureTradition(id, lang);
  const fullAbout = getFigureFullAbout(id, lang);
  const seeds = getFigureSeeds(id, lang);

  const teachingsHtml = seeds.slice(0, 4)
    .map(s => `<li>${s.title}</li>`)
    .join('\n        ');

  const connectionsSet = new Set();
  for (const seed of seeds) {
    for (const conn of (seed.connections || [])) {
      if (conn.figure !== id && ID_TO_SLUG[conn.figure]) connectionsSet.add(conn.figure);
    }
  }
  const relatedIds = [...connectionsSet].slice(0, 4);
  const relatedHtml = relatedIds
    .map(rid => `<li><a href="${prefix}/figures/${ID_TO_SLUG[rid]}">${getFigureName(rid, lang)}</a></li>`)
    .join('\n        ');

  // Themes this figure speaks to (bidirectional internal linking for SEO topic clusters)
  const themeIds = FIGURE_THEMES[id] || [];
  const themesHtml = themeIds
    .map(themeId => `<li><a href="${prefix}/themes/${themeId}">${t(lang, `themes.${themeId}.name`)}</a> (${t(lang, `themes.${themeId}.tagline`)})</li>`)
    .join('\n        ');

  const meta = [tradition, period].filter(Boolean).join(', ');
  const teachingsHeading = isDe ? 'Lehren' : 'Teachings';
  const connectHeading = isDe
    ? `${name} auf Agora Cosmica`
    : `${name} on Agora Cosmica`;
  const connectCopy = isDe
    ? `Höre die 12-Kapitel-Lebensgeschichte, erkunde 12 Lehren mit Audio, stelle Fragen im Dialog. Gemeinnützig, Open Source, ohne Tracking.`
    : `Listen to the 12-chapter life story, explore 12 teachings with audio, ask questions in dialogue. Nonprofit, open source, no tracking.`;
  const relatedHeading = isDe ? 'Verwandte Persönlichkeiten' : 'Related Figures';
  const browseHeading = isDe ? 'Stöbern' : 'Browse';

  return `
      <h1>${name}</h1>
      ${meta ? `<p><strong>${meta}</strong></p>` : ''}
      <p>${fullAbout}</p>

      ${seeds.length > 0 ? `<h2>${teachingsHeading}</h2>
      <ul>
        ${teachingsHtml}
      </ul>` : ''}

      <h2>${connectHeading}</h2>
      <p>${connectCopy}</p>

      ${relatedIds.length > 0 ? `<h2>${relatedHeading}</h2>
      <ul>
        ${relatedHtml}
      </ul>` : ''}

      ${themeIds.length > 0 ? `<h2>${isDe ? 'Themen' : 'Themes'}</h2>
      <ul>
        ${themesHtml}
      </ul>` : ''}

      <h2>${browseHeading}</h2>
      <ul>
        <li><a href="${prefix}/figures">${isDe ? 'Alle 30 Persönlichkeiten' : 'All 30 Figures'}</a></li>
        <li><a href="${prefix}/themes">${isDe ? 'Alle 8 Themen' : 'All 8 Life Themes'}</a></li>
        <li><a href="${prefix}/">Agora Cosmica</a></li>
      </ul>
    `;
}

function themeNoscript(themeId, lang) {
  const prefix = lang === 'de' ? '/de' : '';
  const isDe = lang === 'de';
  const name = t(lang, `themes.${themeId}.name`);
  const tagline = t(lang, `themes.${themeId}.tagline`);
  const desc = t(lang, `themes.${themeId}.description`);
  const introRaw = t(lang, `themes.${themeId}.intro`);
  const intro = introRaw !== `themes.${themeId}.intro` ? introRaw : '';
  const introHtml = intro
    ? intro.split('\n\n').map(p => `<p>${p}</p>`).join('\n      ')
    : '';

  const figureIds = THEME_FIGURE_HINTS[themeId] || [];
  const figuresHtml = figureIds
    .map(id => `<li><a href="${prefix}/figures/${ID_TO_SLUG[id]}">${getFigureName(id, lang)}</a></li>`)
    .join('\n        ');

  const otherThemes = THEME_IDS.filter(id => id !== themeId).slice(0, 3);
  const otherThemesHtml = otherThemes
    .map(id => `<li><a href="${prefix}/themes/${id}">${t(lang, `themes.${id}.name`)}</a></li>`)
    .join('\n        ');

  return `
      <h1>${name}</h1>
      <p><em>${tagline}</em></p>
      <p>${desc}</p>

      ${introHtml}

      <h2>${isDe ? 'Persönlichkeiten zu diesem Thema' : 'Figures who speak to this theme'}</h2>
      <ul>
        ${figuresHtml}
      </ul>

      <h2>${isDe ? 'Weitere Themen' : 'Other Themes'}</h2>
      <ul>
        ${otherThemesHtml}
      </ul>

      <h2>${isDe ? 'Stöbern' : 'Browse'}</h2>
      <ul>
        <li><a href="${prefix}/figures">${isDe ? 'Alle 30 Persönlichkeiten' : 'All 30 Figures'}</a></li>
        <li><a href="${prefix}/themes">${isDe ? 'Alle 8 Themen' : 'All 8 Life Themes'}</a></li>
        <li><a href="${prefix}/">Agora Cosmica</a></li>
      </ul>
    `;
}

function aboutNoscript(lang) {
  const prefix = lang === 'de' ? '/de' : '';
  const isDe = lang === 'de';
  const intro = isDe
    ? 'Agora Cosmica ist eine lebendige Bibliothek mit 30 historischen Persönlichkeiten. Höre ihre Lebensgeschichten, lerne aus ihren Lehren, sprich mit ihnen im Dialog. Gemeinnützig, Open Source, ohne Tracking.'
    : 'Agora Cosmica is a living library of 30 historical figures. Listen to their life stories, learn from their teachings, talk with them in dialogue. Nonprofit, open source, no tracking.';
  const grounded = isDe
    ? 'Jede Stimme basiert auf Hauptwerken, historischem Kontext und gegengeprüften Quellen. Die Echos sind KI-erzeugt, ihre Worte variieren. Das Quellmaterial bleibt. Wo die Erzählung über das Dokumentierte hinausgeht, benennt der Faktencheck, was nachgebildet ist.'
    : 'Every voice is grounded in primary works, historical context, and cross-checked sources. The Echoes are AI-rendered, so what they say will vary. The source material does not. When the prose extends beyond documented record, the factcheck names what is recreated.';
  const builder = isDe
    ? 'Gebaut von ChipMates gemeinnützige GmbH, einem deutschen Non-Profit für Bildung aus Freiburg im Breisgau. Eingetragen beim Amtsgericht Freiburg, HRB 728848. Förderung der Bildung als satzungsmäßiger Zweck.'
    : 'Built by ChipMates gemeinnützige GmbH, a German educational nonprofit based in Freiburg im Breisgau. Registered with Amtsgericht Freiburg, HRB 728848. Charitable purpose: advancement of education.';
  // Mission paragraphs from translations (split on \n\n for multi-paragraph render)
  const missionStatement = t(lang, 'about.missionStatement');
  const missionParas = missionStatement && missionStatement !== 'about.missionStatement'
    ? missionStatement.split('\n\n').map(p => `<p>${p}</p>`).join('\n      ')
    : '';
  const missionTitle = isDe ? 'Unsere Mission' : 'Our Mission';

  // Organization, Values, Promise, Barriers, Success — Ad Grants nonprofit signal depth
  const organizationStatement = t(lang, 'about.organizationStatement');
  const organizationTitle = t(lang, 'about.organizationTitle');
  const valuesTitle = t(lang, 'about.valuesTitle');
  const promiseTitle = t(lang, 'about.promiseTitle');
  const promiseStatement = t(lang, 'about.promiseStatement');
  const barriersTitle = t(lang, 'about.barriersTitle');
  const barriersIntro = t(lang, 'about.barriersIntro');
  const successTitle = t(lang, 'about.successTitle');
  const successStatement = t(lang, 'about.successStatement');
  const closingQuote = t(lang, 'about.closingQuote');
  const closingAttribution = t(lang, 'about.closingAttribution');
  const modes = isDe
    ? '<strong>Geschichte</strong> (12 Audio-Kapitel pro Person), <strong>Weisheit</strong> (12 Lehren), <strong>Prisma</strong> (Mehrperspektiven-Dialoge), <strong>Quest</strong> (begleiteter Lernpfad), <strong>Free Talk</strong> (offenes Gespräch) und <strong>Council</strong> (Debatte zwischen Persönlichkeiten).'
    : '<strong>Story</strong> (12 audio chapters per figure), <strong>Wisdom</strong> (12 teachings), <strong>Prism</strong> (multi-perspective dialogues), <strong>Quest</strong> (guided learning path), <strong>Free Talk</strong> (open conversation), and <strong>Council</strong> (debate between figures).';

  return `
      <h1>${isDe ? 'Über Agora Cosmica' : 'About Agora Cosmica'}</h1>
      <p>${intro}</p>

      ${missionParas ? `<h2>${missionTitle}</h2>
      ${missionParas}` : ''}

      <h2>${organizationTitle}</h2>
      <p>${organizationStatement}</p>

      <h2>${valuesTitle}</h2>
      <ul>
        <li>${t(lang, 'about.valueGratitude')}</li>
        <li>${t(lang, 'about.valueCuriosity')}</li>
        <li>${t(lang, 'about.valueOpenness')}</li>
        <li>${t(lang, 'about.valueTransformation')}</li>
      </ul>

      <h2>${promiseTitle}</h2>
      <p>${promiseStatement}</p>

      <h2>${barriersTitle}</h2>
      <p>${barriersIntro}</p>
      <ul>
        <li>${t(lang, 'about.barrierGeographic')}</li>
        <li>${t(lang, 'about.barrierAcademic')}</li>
        <li>${t(lang, 'about.barrierAge')}</li>
        <li>${t(lang, 'about.barrierEconomic')}</li>
      </ul>

      <h2>${successTitle}</h2>
      <p>${successStatement}</p>

      <p>${grounded}</p>
      <p>${builder}</p>

      <blockquote><p><em>${closingQuote}</em></p><p>— ${closingAttribution}</p></blockquote>

      <h2>${isDe ? 'Sechs Wege, Wissen zu erleben' : 'Six ways to engage'}</h2>
      <p>${modes}</p>

      <h2>${isDe ? 'Stöbern' : 'Browse'}</h2>
      <ul>
        <li><a href="${prefix}/figures">${isDe ? '30 Persönlichkeiten' : '30 Figures'}</a></li>
        <li><a href="${prefix}/themes">${isDe ? '8 Themen des Lebens' : '8 Life Themes'}</a></li>
        <li><a href="${prefix}/contact">${isDe ? 'Kontakt' : 'Contact'}</a></li>
        <li><a href="https://github.com/chipmates/agoracosmica">GitHub</a></li>
      </ul>
    `;
}

function contactNoscript(lang) {
  const prefix = lang === 'de' ? '/de' : '';
  const isDe = lang === 'de';
  const intro = isDe
    ? 'Schreib uns gerne. Wir antworten auf Deutsch oder Englisch.'
    : 'Get in touch. We reply in English or German.';

  return `
      <h1>${isDe ? 'Kontakt' : 'Contact'}</h1>
      <p>${intro}</p>

      <h2>E-Mail</h2>
      <p><a href="mailto:agoracosmica@chipmates.ai">agoracosmica@chipmates.ai</a></p>

      <h2>${isDe ? 'Adresse' : 'Address'}</h2>
      <address>
        ChipMates gemeinnützige GmbH<br />
        Schusterstr. 50<br />
        79098 Freiburg im Breisgau<br />
        ${isDe ? 'Deutschland' : 'Germany'}
      </address>

      <h2>${isDe ? 'Stöbern' : 'Browse'}</h2>
      <ul>
        <li><a href="${prefix}/about">${isDe ? 'Über uns' : 'About'}</a></li>
        <li><a href="${prefix}/figures">${isDe ? '30 Persönlichkeiten' : '30 Figures'}</a></li>
        <li><a href="${prefix}/">Agora Cosmica</a></li>
      </ul>
    `;
}

function figuresCatalogNoscript(lang) {
  const prefix = lang === 'de' ? '/de' : '';
  const isDe = lang === 'de';
  const intro = isDe
    ? '30 historische Persönlichkeiten, gruppiert nach Tradition. Jede Persönlichkeit hat eine 12-Kapitel-Lebensgeschichte mit Audio, 12 Lehren und ein interaktives Dialogformat.'
    : '30 historical figures, grouped by tradition. Each figure has a 12-chapter audio life story, 12 teachings, and interactive dialogue.';

  const figuresHtml = TRADITION_GROUPS.map(group => {
    const groupLabel = TRADITION_LABELS[group.key][lang];
    const items = group.ids
      .map(id => `<li><a href="${prefix}/figures/${ID_TO_SLUG[id]}">${getFigureName(id, lang)}</a></li>`)
      .join('\n          ');
    return `<h2>${groupLabel}</h2>
      <ul>
          ${items}
      </ul>`;
  }).join('\n\n      ');

  return `
      <h1>${isDe ? '30 Persönlichkeiten' : '30 Figures'}</h1>
      <p>${intro}</p>

      ${figuresHtml}

      <h2>${isDe ? 'Stöbern' : 'Browse'}</h2>
      <ul>
        <li><a href="${prefix}/themes">${isDe ? '8 Themen des Lebens' : '8 Life Themes'}</a></li>
        <li><a href="${prefix}/about">${isDe ? 'Über Agora Cosmica' : 'About Agora Cosmica'}</a></li>
        <li><a href="${prefix}/">Agora Cosmica</a></li>
      </ul>
    `;
}

function themesCatalogNoscript(lang) {
  const prefix = lang === 'de' ? '/de' : '';
  const isDe = lang === 'de';
  const intro = isDe
    ? '8 Lebensthemen, jeweils erkundet durch die Stimmen mehrerer Persönlichkeiten der Geschichte.'
    : '8 life themes, each explored through the voices of multiple historical figures.';

  const themesHtml = THEME_IDS.map(themeId => {
    const name = t(lang, `themes.${themeId}.name`);
    const tagline = t(lang, `themes.${themeId}.tagline`);
    return `<li><a href="${prefix}/themes/${themeId}">${name}</a>. ${tagline}</li>`;
  }).join('\n        ');

  return `
      <h1>${isDe ? '8 Themen des Lebens' : '8 Life Themes'}</h1>
      <p>${intro}</p>

      <ul>
        ${themesHtml}
      </ul>

      <h2>${isDe ? 'Stöbern' : 'Browse'}</h2>
      <ul>
        <li><a href="${prefix}/figures">${isDe ? '30 Persönlichkeiten' : '30 Figures'}</a></li>
        <li><a href="${prefix}/about">${isDe ? 'Über Agora Cosmica' : 'About Agora Cosmica'}</a></li>
        <li><a href="${prefix}/">Agora Cosmica</a></li>
      </ul>
    `;
}

// =============================================================

function generateMetaTags(page) {
  const { title, description, path: rawPath, lang, ogType = 'website', ogImage } = page;
  const fullTitle = page.fullTitle || `${title} | Agora Cosmica`;
  // CF Pages 308-redirects /foo to /foo/, so canonical + hreflang must use the
  // trailing-slash form to keep crawler hops to one. Root stays bare.
  const path = rawPath === '/' ? '/' : rawPath.endsWith('/') ? rawPath : `${rawPath}/`;
  const canonical = `${SITE_URL}${lang === 'de' ? '/de' : ''}${path}`;
  const enUrl = `${SITE_URL}${path}`;
  const deUrl = `${SITE_URL}/de${path}`;
  // OG fallback matches MetaTags.tsx — 1200×630 WebP for social unfurls.
  // favicon.svg (32×32) is too small for Twitter/Facebook/LinkedIn cards.
  const image = ogImage || `${MEDIA_URL}/images/ui/og-default/1200.webp`;

  return `
    <title>${fullTitle}</title>
    <meta name="description" content="${description.replace(/"/g, '&quot;')}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="alternate" hreflang="en" href="${enUrl}" />
    <link rel="alternate" hreflang="de" href="${deUrl}" />
    <link rel="alternate" hreflang="x-default" href="${enUrl}" />
    <meta property="og:title" content="${fullTitle}" />
    <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:site_name" content="Agora Cosmica" />
    <meta property="og:locale" content="${lang === 'de' ? 'de_DE' : 'en_US'}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${fullTitle}" />
    <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />
  `;
}

// Legal footer links — required by German TMG/DDG (Impressum + Datenschutz must
// be reachable from every page) and provides static-HTML link equity to legal
// pages that would otherwise be orphans for non-JS crawlers.
const LEGAL_PAGE_PATHS = ['/impressum', '/datenschutz', '/cookie-policy', '/nutzungsbedingungen'];

// Project-of attribution. Mandatory on every page for Ad Grants nonprofit
// disclosure + general transparency. Appears on legal pages too (just without
// the recursive legal-link list).
function projectAttribution(lang) {
  const text = lang === 'de'
    ? 'Ein Projekt der ChipMates gemeinnützige GmbH · Freiburg'
    : 'A project of ChipMates gemeinnützige GmbH · Freiburg, Germany';
  return `<p><strong>${text}</strong></p>`;
}

function legalFooterLinks(lang) {
  const isDe = lang === 'de';
  const label = isDe ? 'Rechtliches' : 'Legal';
  return `
      ${projectAttribution(lang)}
      <h2>${label}</h2>
      <ul>
        <li><a href="/impressum">Impressum</a></li>
        <li><a href="/datenschutz">Datenschutz</a></li>
        <li><a href="/cookie-policy">Cookie Policy</a></li>
        <li><a href="/nutzungsbedingungen">Nutzungsbedingungen</a></li>
      </ul>`;
}

function generateNoscriptContent(page) {
  const isLegalPage = LEGAL_PAGE_PATHS.includes(page.path);
  // Legal pages get just the attribution (avoid recursive legal-link self-references).
  // Other pages get full attribution + legal links.
  const trailingBlock = isLegalPage ? projectAttribution(page.lang) : legalFooterLinks(page.lang);
  // Page-specific rich noscript wins over generic fallback
  if (page.noscript) return page.noscript + trailingBlock;
  return `
    <h1>${page.title}</h1>
    <p>${page.description}</p>
    ${projectAttribution(page.lang)}
    <p><a href="mailto:agoracosmica@chipmates.ai">Contact us</a></p>
  `;
}

function writePage(routePath, page) {
  const schemaBlock = serializeSchemas(page.schemas);
  const metaBlock = generateMetaTags(page);
  const rssBlock = page.rssLink || '';
  const preloadBlock = page.preloadImage
    ? `<link rel="preload" as="image" href="${page.preloadImage}" type="image/webp" fetchpriority="high" />`
    : '';
  let headInjection = metaBlock;
  if (rssBlock) headInjection += '\n    ' + rssBlock;
  if (preloadBlock) headInjection += '\n    ' + preloadBlock;
  if (schemaBlock) headInjection += '\n    ' + schemaBlock;

  // Strip the source-template default description before injecting page-specific
  // meta tags. Prevents two `<meta name="description">` tags per page.
  let html = template
    .replace(/<meta[\s]+name="description"[\s\S]+?\/>/, '')
    .replace('<title>Agora Cosmica</title>', headInjection)
    .replace(
      '<noscript>You need to enable JavaScript to run this app.</noscript>',
      `<noscript>${generateNoscriptContent(page)}</noscript>`
    )
    .replace(
      '<html lang="en"',
      `<html lang="${page.lang}"`
    );

  // Write to build directory
  const outDir = join(BUILD_DIR, routePath);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
}

// Generate all pages
console.log('=== Prerendering Public Pages ===');
let count = 0;

// Static pages
for (const lang of ['en', 'de']) {
  const prefix = lang === 'de' ? '/de' : '';
  const homeUrl = `${SITE_URL}${prefix}/`;
  const figuresUrl = `${SITE_URL}${prefix}/figures`;
  const themesUrl = `${SITE_URL}${prefix}/themes`;
  const aboutUrl = `${SITE_URL}${prefix}/about`;
  const contactUrl = `${SITE_URL}${prefix}/contact`;

  // Homepage. EN routePath '' overwrites the Vite SPA shell at build/index.html.
  // DE routePath '/de' lands as build/de/index.html (the directory already exists).
  writePage(prefix, {
    title: 'Agora Cosmica',
    fullTitle: HOME_COPY[lang].fullTitle,
    description: HOME_COPY[lang].description,
    path: '/',
    lang,
    ogType: 'website',
    schemas: [
      organizationSchema(),
      webSiteSchema(),
      podcastSeriesSchema(lang),
    ],
    rssLink: rssLinkTag(lang),
    noscript: homeNoscript(lang),
  });
  count++;

  // About
  writePage(`${prefix}/about`, {
    title: t(lang, 'about.pageTitle'),
    description: t(lang, 'about.pageDescription'),
    path: '/about',
    lang,
    schemas: [
      organizationSchema(),
      webSiteSchema(),
      softwareApplicationSchema(),
      podcastSeriesSchema(lang),
      breadcrumbSchema([
        { name: t(lang, 'breadcrumbs.home'), url: homeUrl },
        { name: t(lang, 'breadcrumbs.about'), url: aboutUrl },
      ]),
    ],
    rssLink: rssLinkTag(lang),
    noscript: aboutNoscript(lang),
  });
  count++;

  // Contact
  writePage(`${prefix}/contact`, {
    title: t(lang, 'contact.pageTitle'),
    description: t(lang, 'contact.pageDescription'),
    path: '/contact',
    lang,
    schemas: [
      organizationSchema(),
      breadcrumbSchema([
        { name: t(lang, 'breadcrumbs.home'), url: homeUrl },
        { name: t(lang, 'breadcrumbs.contact'), url: contactUrl },
      ]),
    ],
    noscript: contactNoscript(lang),
  });
  count++;

  // Figures catalog
  const figureItems = Object.entries(FIGURE_SLUGS).map(([slug, id]) => ({
    name: getFigureName(id, lang),
    url: `${SITE_URL}${prefix}/figures/${slug}`,
    image: `${MEDIA_URL}/images/figures/${id}/main/1200.webp`,
  }));
  writePage(`${prefix}/figures`, {
    title: t(lang, 'figures.pageTitle'),
    description: t(lang, 'figures.pageDescription'),
    path: '/figures',
    lang,
    schemas: [
      itemListSchema(figureItems),
      breadcrumbSchema([
        { name: t(lang, 'breadcrumbs.home'), url: homeUrl },
        { name: t(lang, 'breadcrumbs.figures'), url: figuresUrl },
      ]),
    ],
    noscript: figuresCatalogNoscript(lang),
  });
  count++;

  // Themes catalog
  const themeItems = THEME_IDS.map(themeId => ({
    name: t(lang, `themes.${themeId}.name`),
    url: `${SITE_URL}${prefix}/themes/${themeId}`,
    description: t(lang, `themes.${themeId}.tagline`),
  }));
  writePage(`${prefix}/themes`, {
    title: t(lang, 'themes.pageTitle'),
    description: t(lang, 'themes.pageDescription'),
    path: '/themes',
    lang,
    schemas: [
      itemListSchema(themeItems),
      breadcrumbSchema([
        { name: t(lang, 'breadcrumbs.home'), url: homeUrl },
        { name: t(lang, 'breadcrumbs.themes'), url: themesUrl },
      ]),
    ],
    noscript: themesCatalogNoscript(lang),
  });
  count++;

  // Figure detail pages
  for (const [slug, id] of Object.entries(FIGURE_SLUGS)) {
    const name = getFigureName(id, lang);
    const seoDesc = getFigureSeoDesc(id, lang);
    const about = seoDesc || getFigureAbout(id, lang);
    const figureUrl = `${SITE_URL}${prefix}/figures/${slug}`;
    const figureImage = `${MEDIA_URL}/images/figures/${id}/main/1200.webp`;

    const seoTitle = getFigureSeoTitle(id, lang);
    writePage(`${prefix}/figures/${slug}`, {
      title: `${name} - ${t(lang, 'figures.life')} & ${t(lang, 'figures.teachings')}`,
      fullTitle: seoTitle || undefined,
      description: about || `${name} - Philosophy and teachings on Agora Cosmica`,
      path: `/figures/${slug}`,
      lang,
      ogType: 'profile',
      ogImage: figureImage,
      schemas: [
        personSchema({
          name,
          about: getFigureFullAbout(id, lang) || about,
          period: getFigurePeriod(id, lang),
          tradition: getFigureTradition(id, lang),
          slug,
          lang,
          image: figureImage,
        }),
        breadcrumbSchema([
          { name: t(lang, 'breadcrumbs.home'), url: homeUrl },
          { name: t(lang, 'breadcrumbs.figures'), url: figuresUrl },
          { name, url: figureUrl },
        ]),
      ],
      preloadImage: figureImage,
      noscript: figureNoscript(id, slug, lang),
    });
    count++;
  }

  // Theme detail pages
  for (const themeId of THEME_IDS) {
    const name = t(lang, `themes.${themeId}.name`);
    const tagline = t(lang, `themes.${themeId}.tagline`);
    const desc = t(lang, `themes.${themeId}.description`);
    const themeUrl = `${SITE_URL}${prefix}/themes/${themeId}`;

    const ogFigureId = THEME_OG_FIGURE[themeId];
    const themeOgImage = ogFigureId
      ? `${MEDIA_URL}/images/figures/${ogFigureId}/main/1200.webp`
      : undefined;
    writePage(`${prefix}/themes/${themeId}`, {
      title: `${name} - ${tagline}`,
      description: (desc || tagline).slice(0, 160),
      path: `/themes/${themeId}`,
      lang,
      ogType: 'article',
      ogImage: themeOgImage,
      schemas: [
        articleSchema({
          title: name,
          description: (desc || tagline).slice(0, 200),
          url: themeUrl,
          lang,
          image: themeOgImage,
          datePublished: LAUNCH_DATE,
          dateModified: TODAY,
        }),
        breadcrumbSchema([
          { name: t(lang, 'breadcrumbs.home'), url: homeUrl },
          { name: t(lang, 'breadcrumbs.themes'), url: themesUrl },
          { name, url: themeUrl },
        ]),
      ],
      noscript: themeNoscript(themeId, lang),
    });
    count++;
  }
}

// Legal pages (single language, no prefix, no schemas — minimal SEO value)
for (const [path, titleKey] of [
  ['/impressum', 'Impressum'],
  ['/datenschutz', 'Datenschutz'],
  ['/cookie-policy', 'Cookie Policy'],
  ['/nutzungsbedingungen', 'Nutzungsbedingungen'],
]) {
  writePage(path, {
    title: titleKey,
    description: `${titleKey} - Agora Cosmica / ChipMates gemeinnützige GmbH`,
    path,
    lang: 'de',
  });
  count++;
}

console.log(`  Prerendered ${count} pages`);

// =============================================================
// llms.txt — markdown overview for AI crawlers (ChatGPT, Perplexity,
// Claude browse-tools, Brave Search, Common Crawl). 2025-2026 emerging
// convention: a curated, structured map of the site for LLM ingestion.
// EN-only follows peer convention (Anthropic, FastAPI, Stripe).
// =============================================================

function extractHook(seoTitle, name) {
  if (!seoTitle) return '';
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return seoTitle
    .replace(new RegExp(`^${escaped} - `), '')
    .replace(' | Agora Cosmica', '')
    .trim();
}

function generateLlmsTxt() {
  const lines = [];
  const push = (s = '') => lines.push(s);

  push('# Agora Cosmica');
  push();
  push('> A Living Library You Can Talk To.');
  push('> Nonprofit, open source. Built by ChipMates gemeinnützige GmbH (Freiburg, Germany).');
  push();
  push('Agora Cosmica is a wisdom platform with 30 historical figures, fully bilingual in English and German. The platform runs in the browser, requires no account beyond a chosen name, and stores no tracking data.');
  push();
  push('The platform offers six modes: four educational chapters (Story / Wisdom / Prism / Quest) plus two open formats (Free Talk and Council).');
  push();
  push('License: AGPL-3.0 (code). Content currently © ChipMates gemeinnützige GmbH, transitioning to CC-BY 4.0 in 2026.');
  push();
  push('Languages:');
  push('- English: https://agoracosmica.org/');
  push('- German: https://agoracosmica.org/de/');
  push();
  push('## Modes');
  push();
  push('- **Story**: 12-chapter narrated audio life story per figure');
  push('- **Wisdom**: 12 core teachings per figure with audio');
  push('- **Prism**: multi-perspective dialogues between figures');
  push('- **Quest**: guided learning challenge with verdict');
  push('- **Free Talk**: open conversation with any figure');
  push('- **Council**: debate between multiple figures (110 pre-produced + unlimited custom)');
  push();
  push('## Figures (30)');
  push();
  push('Each figure has 12 audio life-story chapters, 12 teachings with audio, interactive dialogue, and optional council appearances. All content is bilingual EN/DE.');
  push();

  for (const group of TRADITION_GROUPS) {
    push(`### ${TRADITION_LABELS[group.key].en}`);
    for (const id of group.ids) {
      const slug = ID_TO_SLUG[id];
      const name = getFigureName(id, 'en');
      const period = getFigurePeriod(id, 'en');
      const tradition = getFigureTradition(id, 'en');
      const hook = extractHook(getFigureSeoTitle(id, 'en'), name);
      const meta = [period, tradition].filter(Boolean).join(', ');
      const metaPart = meta ? ` (${meta})` : '';
      const hookPart = hook ? `: ${hook}` : '';
      push(`- [${name}](${SITE_URL}/figures/${slug})${metaPart}${hookPart}`);
    }
    push();
  }

  push('## Themes (8)');
  push();
  push('Cross-figure thematic explorations, drawing from multiple figures\' teachings and curated council debates.');
  push();
  for (const themeId of THEME_IDS) {
    const tname = t('en', `themes.${themeId}.name`);
    const tagline = t('en', `themes.${themeId}.tagline`);
    push(`- [${tname}](${SITE_URL}/themes/${themeId}): ${tagline}`);
  }
  push();

  push('## About this project');
  push();
  push('- [About Agora Cosmica](https://agoracosmica.org/about)');
  push('- [Contact](https://agoracosmica.org/contact)');
  push('- [GitHub repository (AGPL-3.0)](https://github.com/chipmates/agoracosmica)');
  push('- [Podcast EN (RSS)](https://media.agoracosmica.org/podcasts/agora-cosmica/feed.xml)');
  push('- [Podcast DE (RSS)](https://media.agoracosmica.org/podcasts/agora-cosmica-de/feed.xml)');
  push('- [Sitemap](https://agoracosmica.org/sitemap.xml)');
  push();
  push('## German pages');
  push();
  push('Every figure, theme, about, and contact page has a German mirror at `/de/<path>`. Examples:');
  push('- https://agoracosmica.org/de/ (German homepage)');
  push('- https://agoracosmica.org/de/figures (All 30 figures, German)');
  push('- https://agoracosmica.org/de/themes (All 8 themes, German)');
  push('- https://agoracosmica.org/de/figures/<slug> (Individual figure pages)');
  push();
  push('## Trust signals');
  push();
  push('- Nonprofit (Förderung der Bildung, the German legal charitable purpose: advancement of education)');
  push('- Open source (AGPL-3.0)');
  push('- No tracking, no cookies, no advertising');
  push('- Self-hosted TTS/STT in Germany (Hetzner)');
  push('- All audio + content cached on Cloudflare R2 with 1-year immutable edge');
  push();

  writeFileSync(join(BUILD_DIR, 'llms.txt'), lines.join('\n') + '\n');
  console.log(`  llms.txt generated: ${lines.length} lines`);
}

generateLlmsTxt();

console.log('=== Done ===');
