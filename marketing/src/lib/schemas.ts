// JSON-LD schema generators. Self-contained — no @client dependency, so the
// React-side JsonLd.tsx can be deleted without breaking marketing.

import { MEDIA_URL, ORG_LOGO, SITE_URL } from './urls';
import type { Lang } from '../i18n';
import { figureEntities } from './figureEntities';

const ORG_ID = `${SITE_URL}/#organization`;
const AGORA_ID = `${SITE_URL}/#agora-cosmica`;

export function personSchema(figure: {
  name: string;
  about: string;
  period: string;
  tradition: string;
  slug: string;
  lang: string;
  image?: string;
}): Record<string, unknown> {
  // Trailing slash: the canonical URL form. The no-slash form 301s, and
  // @ids pointing at redirecting URLs weaken entity reconciliation.
  const url = `${SITE_URL}${figure.lang === 'de' ? '/de' : ''}/figures/${figure.slug}/`;
  const entity = figureEntities[figure.slug];
  const sameAs = entity
    ? [
        figure.lang === 'de' ? entity.wikipediaDe : entity.wikipediaEn,
        entity.wikidata,
      ].filter(Boolean)
    : [];
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${url}#person`,
    name: figure.name,
    description: figure.about,
    url,
    knowsAbout: figure.tradition,
    ...(figure.image && { image: figure.image }),
    ...(entity?.birthDate && { birthDate: entity.birthDate }),
    ...(entity?.deathDate && { deathDate: entity.deathDate }),
    ...(sameAs.length && { sameAs }),
    mainEntityOfPage: url,
  };
}

// AudioObject for a figure's narrated audio introduction (the ~50s trailer on
// R2). Makes the audio a crawlable, audio-rich-result-eligible entity instead
// of being hidden behind a React island button, and reinforces the
// living-library-you-can-talk-to entity. The mp3 form is used so crawlers can
// read it (webm is the in-app primary). Trailer URLs verified live for all
// 30 figures in both languages.
export function audioObjectSchema(figure: {
  figureId: string;
  name: string;
  slug: string;
  lang: Lang;
}): Record<string, unknown> {
  const pageUrl = `${SITE_URL}${figure.lang === 'de' ? '/de' : ''}/figures/${figure.slug}/`;
  const contentUrl = `${MEDIA_URL}/trailers/figures/${figure.figureId}/${figure.lang}/${figure.figureId}_trailer_${figure.lang}.mp3`;
  return {
    '@context': 'https://schema.org',
    '@type': 'AudioObject',
    '@id': `${pageUrl}#audio`,
    name:
      figure.lang === 'de'
        ? `${figure.name}: Audio-Einführung`
        : `${figure.name}: audio introduction`,
    contentUrl,
    encodingFormat: 'audio/mpeg',
    inLanguage: figure.lang,
    about: { '@id': `${pageUrl}#person` },
    mainEntityOfPage: pageUrl,
  };
}

export function organizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    '@id': ORG_ID,
    additionalType: 'https://schema.org/NGO',
    name: 'ChipMates gemeinnützige GmbH',
    url: SITE_URL,
    logo: ORG_LOGO,
    sameAs: ['https://github.com/chipmates/agoracosmica'],
    description:
      'A small German non-profit building Agora Cosmica, an open source wisdom platform with 30 historical figures.',
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
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'agoracosmica@chipmates.ai',
      contactType: 'customer support',
      availableLanguage: ['English', 'German'],
    },
  };
}

export function agoraCosmicaSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': AGORA_ID,
    name: 'Agora Cosmica',
    url: SITE_URL,
    logo: ORG_LOGO,
    description:
      'A nonprofit, open source wisdom platform and podcast. Listen to life stories, learn from teachings, and talk with 30 figures from history, in English and German.',
    slogan: 'A Living Library You Can Talk To',
    sameAs: [
      'https://github.com/chipmates/agoracosmica',
      'https://www.youtube.com/@agoracosmica',
      'https://www.youtube.com/@agoracosmicade',
      'https://open.spotify.com/show/3V02q5c8NAnFD1W2kQBYzd',
      'https://open.spotify.com/show/5i63mEKJuCVniSIViXbEP8',
      'https://podcasts.apple.com/us/podcast/agora-cosmica/id1871505788',
      'https://podcasts.apple.com/us/podcast/agora-cosmica-deutsch/id1871505945',
    ],
    parentOrganization: { '@id': ORG_ID },
  };
}

export function webSiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: 'Agora Cosmica',
    url: SITE_URL,
    description: 'A Living Library You Can Talk To',
    publisher: { '@id': AGORA_ID },
    inLanguage: ['en', 'de'],
  };
}

export function articleSchema(article: {
  title: string;
  description: string;
  url: string;
  lang: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
}): Record<string, unknown> {
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
    author: {
      '@type': 'EducationalOrganization',
      '@id': ORG_ID,
      name: 'ChipMates gemeinnützige GmbH',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'EducationalOrganization',
      '@id': ORG_ID,
      name: 'ChipMates gemeinnützige GmbH',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: ORG_LOGO },
    },
  };
}

export function breadcrumbSchema(
  items: { name: string; url: string }[],
): Record<string, unknown> {
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

export function faqSchema(
  items: { q: string; a: string }[],
  canonical: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${canonical}#faq`,
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  };
}

export function itemListSchema(
  items: { name: string; url: string; description?: string; image?: string }[],
): Record<string, unknown> {
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

// Podcast + software schemas, Astro-only — the React app never emitted these.

const PODCASTS: Record<Lang, {
  name: string;
  description: string;
  feedUrl: string;
  coverUrl: string;
  id: string;
}> = {
  en: {
    name: 'Agora Cosmica',
    description:
      'Lives that still speak. First-person audiobooks inspired by remarkable people from history.',
    feedUrl: `${MEDIA_URL}/podcasts/agora-cosmica/feed.xml`,
    coverUrl: `${MEDIA_URL}/podcasts/agora-cosmica/cover.jpg?v=7`,
    id: `${MEDIA_URL}/podcasts/agora-cosmica/#series`,
  },
  de: {
    name: 'Agora Cosmica Deutsch',
    description:
      'Leben, die noch sprechen. Hörbücher in der Ich-Perspektive, inspiriert von besonderen Menschen der Geschichte.',
    feedUrl: `${MEDIA_URL}/podcasts/agora-cosmica-de/feed.xml`,
    coverUrl: `${MEDIA_URL}/podcasts/agora-cosmica-de/cover.jpg?v=7`,
    id: `${MEDIA_URL}/podcasts/agora-cosmica-de/#series`,
  },
};

export function podcastSeriesSchema(lang: Lang): Record<string, unknown> {
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
    publisher: { '@id': AGORA_ID },
  };
}

export function softwareApplicationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/#webapp`,
    name: 'Agora Cosmica',
    url: `${SITE_URL}/app`,
    applicationCategory: 'EducationApplication',
    operatingSystem: 'Web Browser',
    browserRequirements: 'Requires JavaScript',
    description:
      'An open source wisdom platform with 30 historical figures, fully bilingual in English and German.',
    inLanguage: ['en', 'de'],
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
    publisher: { '@id': AGORA_ID },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      description: '30 free messages a day',
    },
    featureList: [
      '30 historical figures with audio life stories',
      '12 teachings per figure',
      'Multi-perspective dialogues (Prism mode)',
      'Conversation in English and German',
      'Pre-produced council debates',
      'No tracking cookies, no profiling',
    ],
  };
}

export function podcastRssLink(lang: Lang): { title: string; href: string } {
  const p = PODCASTS[lang];
  return { title: p.name, href: p.feedUrl };
}
