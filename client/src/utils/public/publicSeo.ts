// SEO URL helpers for public pages
// Remove this file when stripping marketing pages from a fork

const SITE_URL = 'https://agoracosmica.org';

type Language = 'en' | 'de';

export function publicUrl(lang: Language, path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return lang === 'de' ? `/de${cleanPath}` : cleanPath;
}

export function canonicalUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${cleanPath}`;
}

export function alternateUrls(basePath: string): { en: string; de: string } {
  const cleanPath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return {
    en: `${SITE_URL}${cleanPath}`,
    de: `${SITE_URL}/de${cleanPath}`,
  };
}

export function stripLangPrefix(pathname: string): string {
  if (pathname.startsWith('/de/')) return pathname.slice(3);
  if (pathname === '/de') return '/';
  return pathname;
}
