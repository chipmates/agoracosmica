#!/usr/bin/env node

// Generates sitemap.xml and writes to build/ directory
// Run after vite build

import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
// The poem pages render from this module, so their routes and their crawl
// status cannot drift from what the sitemap claims. The Rumi and Meditations
// pages carry their flag in the same module.
import { isIndexable, poemRoutes, readingPages } from '../../marketing/src/data/poems/index.mjs';
import { SHAKESPEARE_QUOTES_INDEXABLE, SHAKESPEARE_QUOTES_PATH } from '../../marketing/src/data/quotes/shakespeare.mjs';
// The theme pages print the same date as their JSON-LD dateModified.

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
// en/de/x-default hreflang block. Three legal pages are German-only; the
// privacy policy is the lone English page (its DE counterpart is /datenschutz,
// reached via a 301, so they share no hreflang signal by design). The terms
// pages (/nutzungsbedingungen + /terms) are a cross-slug hreflang pair below.
const NO_HREFLANG_PATHS = new Set(['/impressum', '/datenschutz', '/cookie-policy', '/privacy', '/figures/emily-dickinson/poems',
  '/figures/william-blake/poems', '/figures/william-shakespeare/sonnets', '/figures/rumi/poems',
  '/de/figures/plato/hoehlengleichnis', '/de/figures/plato/ideenlehre']);

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
  'marketing/src/landing',
  'marketing/src/components/BaseHead.astro',
  'marketing/src/lib/schemas.ts',
);
const ABOUT_MOD = gitLastModified(
  'marketing/src/pages/about.astro',
  'marketing/src/pages/de/about.astro',
  'marketing/src/components/AboutContent.astro',
);
const FIGURE_TEMPLATE_MOD = gitLastModified(
  'marketing/src/pages/figures/[slug].astro',
  'marketing/src/pages/de/figures/[slug].astro',
  'marketing/src/components/FigureDetailContent.astro',
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

const LEGAL_MOD = {
  '/impressum': gitLastModified('marketing/src/pages/impressum.astro', 'client/src/pages/ImpressumPage.tsx'),
  '/datenschutz': gitLastModified('marketing/src/pages/datenschutz.astro', 'client/src/pages/DatenschutzPage.tsx'),
  '/cookie-policy': gitLastModified('marketing/src/pages/cookie-policy.astro', 'client/src/pages/CookiePolicyPage.tsx'),
  '/nutzungsbedingungen': gitLastModified('marketing/src/pages/nutzungsbedingungen.astro', 'marketing/src/pages/terms.astro', 'client/src/pages/NutzungsbedingungenPage.tsx'),
  '/privacy': gitLastModified('marketing/src/pages/privacy.astro'),
};

const urls = [];

// Home (EN + DE as separate URLs)
urls.push(url('/', '1.0', HOME_MOD, 'weekly'));
urls.push(deUrl('/', '1.0', HOME_MOD, 'weekly'));

// Static pages (EN + DE pairs)
urls.push(url('/about', '0.8', ABOUT_MOD));
urls.push(deUrl('/about', '0.8', ABOUT_MOD));

// Figure detail pages
for (const slug of FIGURE_SLUGS) {
  const mod = figureLastmod(slug);
  urls.push(url(`/figures/${slug}`, '0.7', mod));
  urls.push(deUrl(`/figures/${slug}`, '0.7', mod));
}

// Emily Dickinson poems page (corpus/flagship; EN-only, no hreflang twin)
urls.push(url('/figures/emily-dickinson/poems', '0.6', gitLastModified('marketing/src/pages/figures/emily-dickinson/poems.astro')));

// Poem and sonnet source pages on the Dickinson pattern (single-language,
// no hreflang twin) plus the EN-only category page and the DE-only Plato
// school pages.
urls.push(url('/figures/william-blake/poems', '0.6', gitLastModified('marketing/src/pages/figures/william-blake/poems.astro')));
urls.push(url('/figures/william-shakespeare/sonnets', '0.6', gitLastModified('marketing/src/pages/figures/william-shakespeare/sonnets.astro')));
if (isIndexable(readingPages.rumi)) {
  urls.push(url(readingPages.rumi.path, '0.6', gitLastModified('marketing/src/pages/figures/rumi/poems.astro')));
}

// The Shakespeare quotes page, English only; its flag also sets its noindex.
if (SHAKESPEARE_QUOTES_INDEXABLE) {
  NO_HREFLANG_PATHS.add(SHAKESPEARE_QUOTES_PATH);
  urls.push(url(SHAKESPEARE_QUOTES_PATH, '0.6', gitLastModified(
    'marketing/src/pages/figures/william-shakespeare/quotes.astro',
    'marketing/src/data/quotes/shakespeare.mjs',
  )));
}

// Poem pages, the poems index and the Meditations passages, English only. A
// page that carries noindex is left out: both read the same flags.
if (poemRoutes.length > 0) {
  const POEM_MOD = gitLastModified(
    'marketing/src/data/poems/index.mjs',
    'marketing/src/components/PoemPage.astro',
    'marketing/src/pages/poems.astro',
  );
  for (const route of poemRoutes) {
    const path = route.replace(/\/$/, '');
    NO_HREFLANG_PATHS.add(path);
    urls.push(url(path, '0.5', POEM_MOD));
  }
}
if (isIndexable(readingPages.meditations)) {
  NO_HREFLANG_PATHS.add(readingPages.meditations.path);
  urls.push(url(
    readingPages.meditations.path,
    '0.6',
    gitLastModified(
      'marketing/src/pages/figures/marcus-aurelius/meditations.astro',
      'marketing/src/data/texts/aurelius.mjs',
    ),
  ));
}
urls.push(url('/de/figures/plato/hoehlengleichnis', '0.6', gitLastModified('marketing/src/pages/de/figures/plato/hoehlengleichnis.astro')));
urls.push(url('/de/figures/plato/ideenlehre', '0.6', gitLastModified('marketing/src/pages/de/figures/plato/ideenlehre.astro')));

// Cross-slug pairs (the explainers, the method page, the terms). Unlike every
// pair above, these EN/DE twins use DIFFERENT slugs, so the standard url()/deUrl() helpers (which
// assume a /de prefix of the same slug) cannot express their hreflang block.
// crossPair() emits both pages of a pair, each listing the SAME alternate set
// pointing hreflang="en" -> EN slug, hreflang="de" -> DE slug, x-default -> EN.
function crossPair(enPath, dePath, priority, lastmod, changefreq = 'monthly') {
  const enUrl = `${SITE_URL}${slash(enPath)}`;
  const deFullUrl = `${SITE_URL}${slash(dePath)}`;
  const alternates =
    `    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}" />\n` +
    `    <xhtml:link rel="alternate" hreflang="de" href="${deFullUrl}" />\n` +
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${enUrl}" />\n`;
  const entry = (loc) =>
    `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n${alternates}  </url>`;
  return [entry(enUrl), entry(deFullUrl)];
}


// Topic explainer pages (cross-slug EN/DE twins like the hubs above)
const HEROS_JOURNEY_MOD = gitLastModified(
  'marketing/src/pages/the-heros-journey.astro',
  'marketing/src/pages/de/heldenreise.astro',
);
urls.push(...crossPair('/the-heros-journey', '/de/heldenreise', '0.7', HEROS_JOURNEY_MOD));
const STOICISM_MOD = gitLastModified(
  'marketing/src/pages/stoicism.astro',
  'marketing/src/pages/de/stoizismus.astro',
);
urls.push(...crossPair('/stoicism', '/de/stoizismus', '0.7', STOICISM_MOD));

// Methodology / editorial-standards page (trust + E-E-A-T). Cross-slug EN/DE
// twin (/methodology vs /de/methodik), so crossPair() like the hubs.
const METHODOLOGY_MOD = gitLastModified(
  'marketing/src/pages/methodology.astro',
  'marketing/src/pages/de/methodik.astro',
  'marketing/src/components/MethodologyContent.astro',
);
urls.push(...crossPair('/methodology', '/de/methodik', '0.6', METHODOLOGY_MOD));

// Legal pages (German only, no hreflang pairs, no /de/ prefix)
urls.push(url('/impressum', '0.3', LEGAL_MOD['/impressum']));
urls.push(url('/datenschutz', '0.3', LEGAL_MOD['/datenschutz']));
urls.push(url('/cookie-policy', '0.3', LEGAL_MOD['/cookie-policy']));
// Terms of Service: the German original and its English convenience
// translation form a cross-slug hreflang pair (no /de/ prefix on the DE slug).
urls.push(...crossPair('/terms', '/nutzungsbedingungen', '0.3', LEGAL_MOD['/nutzungsbedingungen']));
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
