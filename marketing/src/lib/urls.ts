// URL helpers — re-export from the existing client/ implementation so the two
// renderers cannot drift. Trailing-slash convention matches CF Pages, which
// 308-redirects /foo to /foo/.

export {
  publicUrl,
  canonicalUrl,
  alternateUrls,
  stripLangPrefix,
} from '@client/utils/public/publicSeo';

export const SITE_URL = 'https://agoracosmica.org';
export const MEDIA_URL = 'https://media.agoracosmica.org';
export const ORG_LOGO = `${MEDIA_URL}/images/ui/logo/512.webp`;

/** The landing's list of the thirty, where the old figure list's addresses forward (_redirects). */
export function figureListUrl(lang: 'en' | 'de'): string {
  return lang === 'de' ? '/de/#alle' : '/#all';
}
