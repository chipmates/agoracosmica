// SEO URL helpers for public pages
// Remove this file when stripping marketing pages from a fork

const SITE_URL = 'https://agoracosmica.org';

type Language = 'en' | 'de';

// CF Pages serves directories with a 308 redirect from /foo to /foo/, so every
// public URL the site emits (links, canonical, hreflang) must already carry the
// trailing slash. Otherwise crawlers hit a 308 on every internal link and the
// canonical drifts from the prerendered HTML.
function withSlash(path: string): string {
  if (path === '/') return '/';
  return path.endsWith('/') ? path : `${path}/`;
}

export function publicUrl(lang: Language, path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const slashed = withSlash(cleanPath);
  return lang === 'de' ? `/de${slashed}` : slashed;
}

export function canonicalUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${withSlash(cleanPath)}`;
}

export function alternateUrls(basePath: string): { en: string; de: string } {
  const cleanPath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const slashed = withSlash(cleanPath);
  return {
    en: `${SITE_URL}${slashed}`,
    de: `${SITE_URL}/de${slashed}`,
  };
}

export function stripLangPrefix(pathname: string): string {
  if (pathname.startsWith('/de/')) return pathname.slice(3);
  if (pathname === '/de') return '/';
  return pathname;
}
