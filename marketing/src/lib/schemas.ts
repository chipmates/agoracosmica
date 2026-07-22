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
  // Keeps the entity honest: the page presents an AI Echo and an AI portrait
  // of the real Wikidata person, and the schema says so explicitly.
  const disambiguatingDescription =
    figure.lang === 'de'
      ? `Bildungsbezogenes KI-Echo der historischen Persönlichkeit ${figure.name}. Das Porträt ist ein KI-erzeugtes Bild, keine Fotografie.`
      : `Educational AI Echo of the historical ${figure.name}. The portrait is an AI-generated image, not a photograph.`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${url}#person`,
    name: figure.name,
    description: figure.about,
    disambiguatingDescription,
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
    description:
      figure.lang === 'de'
        ? 'Eine synthetische KI-Stimme, keine Aufnahme der echten Person.'
        : 'A synthetic AI voice, not a recording of the real person.',
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
      'A small German nonprofit building Agora Cosmica, an open source education platform with 30 historical figures.',
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
      'A nonprofit, open source education platform. Listen to life stories, learn from teachings, and talk with 30 figures from history, in English and German.',
    slogan: 'A Living Library You Can Talk To',
    sameAs: [
      'https://github.com/chipmates/agoracosmica',
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

// Software schema, Astro-only — the React app never emitted these.
// (The PodcastSeries schema was removed 2026-07-22 when the podcast was retired.)

export function softwareApplicationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/#webapp`,
    name: 'Agora Cosmica',
    url: `${SITE_URL}/app`,
    applicationCategory: 'EducationApplication',
    applicationSubCategory: 'Philosophy',
    operatingSystem: 'Web Browser',
    browserRequirements: 'Requires JavaScript',
    description:
      'An open source, nonprofit education app to talk with AI Echoes of 30 historical thinkers, grounded in their work. Bilingual English and German.',
    inLanguage: ['en', 'de'],
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
    isAccessibleForFree: true,
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
      'Self-hostable and open source under AGPL-3.0',
      'Bring your own open model (any OpenAI-compatible LLM, local or hosted)',
      'Grounded in primary works with a public factcheck for every figure',
    ],
  };
}
