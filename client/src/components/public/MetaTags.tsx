// Per-page SEO meta tags for public pages
// Remove this file when stripping marketing pages from a fork

import { useEffect } from 'react';
import { alternateUrls, canonicalUrl } from '../../utils/public/publicSeo';

interface MetaTagsProps {
  title: string;
  fullTitle?: string;  // overrides "${title} | Agora Cosmica" when provided (per-figure SEO titles)
  description: string;
  canonicalPath: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'profile';
  lang: 'en' | 'de';
}

export default function MetaTags({
  title,
  fullTitle: fullTitleOverride,
  description,
  canonicalPath,
  ogImage,
  ogType = 'website',
  lang,
}: MetaTagsProps) {
  const fullTitle = fullTitleOverride || `${title} | Agora Cosmica`;
  const canonical = canonicalUrl(lang === 'de' ? `/de${canonicalPath}` : canonicalPath);
  const alternates = alternateUrls(canonicalPath);
  const image = ogImage || 'https://media.agoracosmica.org/images/ui/og-default/1200.webp';

  useEffect(() => {
    document.title = fullTitle;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const setLink = (rel: string, href: string, attrs?: Record<string, string>) => {
      const selector = attrs
        ? `link[rel="${rel}"][hreflang="${attrs.hreflang}"]`
        : `link[rel="${rel}"]:not([hreflang])`;
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        if (attrs) Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
        document.head.appendChild(el);
      }
      (el as HTMLLinkElement).href = href;
    };

    setMeta('name', 'description', description);

    // Open Graph
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:type', ogType);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:locale', lang === 'de' ? 'de_DE' : 'en_US');
    setMeta('property', 'og:locale:alternate', lang === 'de' ? 'en_US' : 'de_DE');
    setMeta('property', 'og:site_name', 'Agora Cosmica');

    // Twitter Card
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);

    // Canonical + hreflang
    setLink('canonical', canonical);
    setLink('alternate', alternates.en, { hreflang: 'en' });
    setLink('alternate', alternates.de, { hreflang: 'de' });
    setLink('alternate', alternates.en, { hreflang: 'x-default' });
  }, [fullTitle, description, canonical, image, ogType, lang, alternates.en, alternates.de]);

  return null;
}
