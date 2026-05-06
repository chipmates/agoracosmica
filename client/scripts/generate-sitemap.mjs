#!/usr/bin/env node

// Generates sitemap.xml and writes to build/ directory
// Run after vite build

import { writeFileSync } from 'fs';
import { join } from 'path';

const SITE_URL = 'https://agoracosmica.org';
const BUILD_DIR = join(import.meta.dirname, '..', 'build');

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

const THEME_IDS = [
  'meaning-purpose', 'loss-grief', 'who-am-i', 'mind-creativity',
  'love-connection', 'freedom-justice', 'faith-death-mystery', 'moral-life',
];

const today = new Date().toISOString().split('T')[0];

// CF Pages serves directories with a 308 redirect from /foo to /foo/, so the
// canonical, sitemap, and served URL must all use the trailing-slash form to
// avoid a redirect hop on every crawl. Root stays bare (/).
const slash = (p) => (p === '/' ? '/' : p.endsWith('/') ? p : `${p}/`);

function url(rawPath, priority, changefreq = 'monthly') {
  // Decide DE-only legal status BEFORE normalization (callers pass /impressum without slash).
  const isLegalDe = ['/impressum', '/datenschutz'].includes(rawPath);
  const path = slash(rawPath);
  const fullUrl = `${SITE_URL}${path}`;
  const enUrl = fullUrl;
  const deUrl = `${SITE_URL}/de${path}`;

  let entry = `  <url>\n    <loc>${fullUrl}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n`;

  if (!isLegalDe) {
    entry += `    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}" />\n`;
    entry += `    <xhtml:link rel="alternate" hreflang="de" href="${deUrl}" />\n`;
    entry += `    <xhtml:link rel="alternate" hreflang="x-default" href="${enUrl}" />\n`;
  }

  entry += `  </url>`;
  return entry;
}

function deUrl(rawPath, priority, changefreq = 'monthly') {
  const path = slash(rawPath);
  return `  <url>\n    <loc>${SITE_URL}/de${path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}${path}" />\n    <xhtml:link rel="alternate" hreflang="de" href="${SITE_URL}/de${path}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${path}" />\n  </url>`;
}

const urls = [];

// Home (EN + DE as separate URLs — both are physically prerendered now)
urls.push(url('/', '1.0', 'weekly'));
urls.push(deUrl('/', '1.0', 'weekly'));

// Static pages (EN + DE pairs)
for (const page of ['/about', '/contact']) {
  urls.push(url(page, '0.8'));
  urls.push(deUrl(page, '0.8'));
}

// Catalog pages
urls.push(url('/figures', '0.9', 'weekly'));
urls.push(deUrl('/figures', '0.9', 'weekly'));
urls.push(url('/themes', '0.9', 'weekly'));
urls.push(deUrl('/themes', '0.9', 'weekly'));

// Figure detail pages
for (const slug of FIGURE_SLUGS) {
  urls.push(url(`/figures/${slug}`, '0.7'));
  urls.push(deUrl(`/figures/${slug}`, '0.7'));
}

// Theme detail pages
for (const theme of THEME_IDS) {
  urls.push(url(`/themes/${theme}`, '0.8'));
  urls.push(deUrl(`/themes/${theme}`, '0.8'));
}

// Legal pages (German only, no hreflang pairs)
urls.push(url('/impressum', '0.3'));
urls.push(url('/datenschutz', '0.3'));
urls.push(url('/cookie-policy', '0.3'));
urls.push(url('/nutzungsbedingungen', '0.3'));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;

writeFileSync(join(BUILD_DIR, 'sitemap.xml'), sitemap);
console.log(`Sitemap generated: ${urls.length} URLs`);
