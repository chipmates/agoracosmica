// JSON-LD structured data for public pages
// Remove this file when stripping marketing pages from a fork

interface JsonLdProps {
  data: Record<string, unknown>;
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// Schema generators

export function personSchema(figure: {
  name: string;
  about: string;
  period: string;
  tradition: string;
  slug: string;
  lang: string;
  image?: string;
}) {
  const url = `https://agoracosmica.org${figure.lang === 'de' ? '/de' : ''}/figures/${figure.slug}`;
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

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    '@id': 'https://agoracosmica.org/#organization',
    name: 'ChipMates gemeinn\u00fctzige GmbH',
    url: 'https://agoracosmica.org',
    logo: 'https://media.agoracosmica.org/images/ui/logo/512.webp',
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

export function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://agoracosmica.org/#website',
    name: 'Agora Cosmica',
    url: 'https://agoracosmica.org',
    description: 'A Living Library You Can Talk To',
    publisher: {
      '@id': 'https://agoracosmica.org/#organization',
    },
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
}) {
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
      '@id': 'https://agoracosmica.org/#organization',
      name: 'ChipMates gemeinn\u00fctzige GmbH',
      url: 'https://agoracosmica.org',
      logo: {
        '@type': 'ImageObject',
        url: 'https://media.agoracosmica.org/images/ui/logo/512.webp',
      },
    },
  };
}

export function breadcrumbSchema(
  items: { name: string; url: string }[]
) {
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

export function itemListSchema(
  items: { name: string; url: string; description?: string; image?: string }[]
) {
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
