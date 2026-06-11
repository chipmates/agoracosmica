#!/usr/bin/env node

// Generates sitemap.xml and writes to build/ directory
// Run after vite build

import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const SITE_URL = 'https://agoracosmica.org';
const SCRIPTS_DIR = import.meta.dirname;
const CLIENT_DIR = join(SCRIPTS_DIR, '..');
const REPO_ROOT = join(CLIENT_DIR, '..');
const BUILD_DIR = join(CLIENT_DIR, 'build');

// Slug mapping (must stay in sync with slugMap.ts)
const FIGURE_SLUGS = [
  'marcus-aurelius', 'maya-angelou', 'jane-austen', 'simone-de-beauvoir',
  'hildegard-von-bingen', 'william-blake', 'joseph-campbell', 'leonardo-da-vinci',
  'emily-dickinson', 'dogen-zenji', 'meister-eckhart', 'albert-einstein',
  'galileo-galilei', 'mahatma-gandhi', 'siddhartha-gautama', 'johann-wolfgang-von-goethe',
  'carl-gustav-jung', 'frida-kahlo', 'martin-luther-king-jr', 'laozi',
  'ada-lovelace', 'nelson-mandela', 'wolfgang-amadeus-mozart', 'friedrich-nietzsche',
  'plato', 'rumi', 'arthur-schopenhauer', 'william-shakespeare',
  'harriet-tubman', 'virginia-woolf',
];

// Mapping must stay in sync with marketing/src/data/public/slugMap.ts (slug → figure id).
const SLUG_TO_ID = {
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

const today = new Date().toISOString().split('T')[0];

// Per-URL <lastmod> sourced from git log of the most relevant content files,
// so Google can prioritize re-crawl of pages that actually changed. Uncommitted
// or untracked files fall through to today, which is the right default for
// brand-new pages added in the current commit.
function gitLastModified(...relPaths) {
  const paths = relPaths.filter(p => existsSync(join(REPO_ROOT, p)));
  if (paths.length === 0) return today;
  try {
    const out = execSync(
      `git log -1 --format=%cI -- ${paths.map(p => `'${p}'`).join(' ')}`,
      { cwd: REPO_ROOT, encoding: 'utf8' },
    ).trim();
    return out ? out.split('T')[0] : today;
  } catch {
    return today;
  }
}

// CF Pages serves directories with a 308 redirect from /foo to /foo/, so the
// canonical, sitemap, and served URL must all use the trailing-slash form to
// avoid a redirect hop on every crawl. Root stays bare (/).
const slash = (p) => (p === '/' ? '/' : p.endsWith('/') ? p : `${p}/`);

// Single-language pages with no twin. Sitemap emits a bare URL and skips the
// en/de/x-default hreflang block. The four legal pages are German-only; the
// privacy policy is the lone English page (its DE counterpart is /datenschutz,
// reached via a 301, so they share no hreflang signal by design).
const NO_HREFLANG_PATHS = new Set(['/impressum', '/datenschutz', '/cookie-policy', '/nutzungsbedingungen', '/privacy']);

function url(rawPath, priority, lastmod, changefreq = 'monthly') {
  const isLegalDe = NO_HREFLANG_PATHS.has(rawPath);
  const path = slash(rawPath);
  const fullUrl = `${SITE_URL}${path}`;
  const enUrl = fullUrl;
  const deUrl = `${SITE_URL}/de${path}`;

  let entry = `  <url>\n    <loc>${fullUrl}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n`;

  if (!isLegalDe) {
    entry += `    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}" />\n`;
    entry += `    <xhtml:link rel="alternate" hreflang="de" href="${deUrl}" />\n`;
    entry += `    <xhtml:link rel="alternate" hreflang="x-default" href="${enUrl}" />\n`;
  }

  entry += `  </url>`;
  return entry;
}

function deUrl(rawPath, priority, lastmod, changefreq = 'monthly') {
  const path = slash(rawPath);
  return `  <url>\n    <loc>${SITE_URL}/de${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}${path}" />\n    <xhtml:link rel="alternate" hreflang="de" href="${SITE_URL}/de${path}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${path}" />\n  </url>`;
}

// Page-type lastmod sources. The Astro page template is one signal; per-page
// content (figure JSON, theme data) is the other. Take the max via git log
// across both.
const HOME_MOD = gitLastModified(
  'marketing/src/pages/index.astro',
  'marketing/src/pages/de/index.astro',
  'marketing/src/components/BaseHead.astro',
  'marketing/src/lib/schemas.ts',
);
const ABOUT_MOD = gitLastModified(
  'marketing/src/pages/about.astro',
  'marketing/src/pages/de/about.astro',
  'marketing/src/components/AboutContent.astro',
);
const CONTACT_MOD = gitLastModified(
  'marketing/src/pages/contact.astro',
  'marketing/src/pages/de/contact.astro',
  'marketing/src/components/ContactContent.astro',
);
const ECHOES_MOD = gitLastModified(
  'marketing/src/pages/echoes.astro',
  'marketing/src/pages/de/echoes.astro',
  'marketing/src/components/EchoesContent.astro',
);
const FIGURES_CATALOG_MOD = gitLastModified(
  'marketing/src/pages/figures/index.astro',
  'marketing/src/pages/de/figures/index.astro',
  'marketing/src/components/FiguresCatalogContent.astro',
);
const THEMES_CATALOG_MOD = gitLastModified(
  'marketing/src/pages/themes/index.astro',
  'marketing/src/pages/de/themes/index.astro',
  'marketing/src/components/ThemesCatalogContent.astro',
);
const FIGURE_TEMPLATE_MOD = gitLastModified(
  'marketing/src/pages/figures/[slug].astro',
  'marketing/src/pages/de/figures/[slug].astro',
  'marketing/src/components/FigureDetailContent.astro',
);
const THEME_TEMPLATE_MOD = gitLastModified(
  'marketing/src/pages/themes/[theme].astro',
  'marketing/src/pages/de/themes/[theme].astro',
  'marketing/src/components/ThemeDetailContent.astro',
);

function figureLastmod(slug) {
  const figureId = SLUG_TO_ID[slug];
  const contentMod = gitLastModified(
    `client/src/assets/translations/figures/en/${figureId}.json`,
    `client/src/assets/translations/figures/de/${figureId}.json`,
    'client/src/data/public/figureSeo.ts',
  );
  return [FIGURE_TEMPLATE_MOD, contentMod].sort().reverse()[0];
}

function themeLastmod() {
  // Theme content lives in public-en.json / public-de.json under themes.*
  const contentMod = gitLastModified(
    'client/src/assets/translations/public-en.json',
    'client/src/assets/translations/public-de.json',
  );
  return [THEME_TEMPLATE_MOD, contentMod].sort().reverse()[0];
}

const LEGAL_MOD = {
  '/impressum': gitLastModified('marketing/src/pages/impressum.astro', 'client/src/pages/ImpressumPage.tsx'),
  '/datenschutz': gitLastModified('marketing/src/pages/datenschutz.astro', 'client/src/pages/DatenschutzPage.tsx'),
  '/cookie-policy': gitLastModified('marketing/src/pages/cookie-policy.astro', 'client/src/pages/CookiePolicyPage.tsx'),
  '/nutzungsbedingungen': gitLastModified('marketing/src/pages/nutzungsbedingungen.astro', 'client/src/pages/NutzungsbedingungenPage.tsx'),
  '/privacy': gitLastModified('marketing/src/pages/privacy.astro'),
};

const urls = [];

// Home (EN + DE as separate URLs)
urls.push(url('/', '1.0', HOME_MOD, 'weekly'));
urls.push(deUrl('/', '1.0', HOME_MOD, 'weekly'));

// Static pages (EN + DE pairs)
urls.push(url('/about', '0.8', ABOUT_MOD));
urls.push(deUrl('/about', '0.8', ABOUT_MOD));
urls.push(url('/contact', '0.8', CONTACT_MOD));
urls.push(deUrl('/contact', '0.8', CONTACT_MOD));
urls.push(url('/echoes', '0.6', ECHOES_MOD));
urls.push(deUrl('/echoes', '0.6', ECHOES_MOD));

// Catalog pages
urls.push(url('/figures', '0.9', FIGURES_CATALOG_MOD, 'weekly'));
urls.push(deUrl('/figures', '0.9', FIGURES_CATALOG_MOD, 'weekly'));
urls.push(url('/themes', '0.9', THEMES_CATALOG_MOD, 'weekly'));
urls.push(deUrl('/themes', '0.9', THEMES_CATALOG_MOD, 'weekly'));

// Figure detail pages
for (const slug of FIGURE_SLUGS) {
  const mod = figureLastmod(slug);
  urls.push(url(`/figures/${slug}`, '0.7', mod));
  urls.push(deUrl(`/figures/${slug}`, '0.7', mod));
}

// Theme detail pages
for (const theme of THEME_IDS) {
  const mod = themeLastmod();
  urls.push(url(`/themes/${theme}`, '0.8', mod));
  urls.push(deUrl(`/themes/${theme}`, '0.8', mod));
}

// Legal pages (German only, no hreflang pairs, no /de/ prefix)
urls.push(url('/impressum', '0.3', LEGAL_MOD['/impressum']));
urls.push(url('/datenschutz', '0.3', LEGAL_MOD['/datenschutz']));
urls.push(url('/cookie-policy', '0.3', LEGAL_MOD['/cookie-policy']));
urls.push(url('/nutzungsbedingungen', '0.3', LEGAL_MOD['/nutzungsbedingungen']));
// English privacy policy: a substantive indexable page with no German twin.
// Emitted bare (no hreflang block) like the German legal pages.
urls.push(url('/privacy', '0.3', LEGAL_MOD['/privacy']));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;

writeFileSync(join(BUILD_DIR, 'sitemap.xml'), sitemap);
console.log(`Sitemap generated: ${urls.length} URLs`);
