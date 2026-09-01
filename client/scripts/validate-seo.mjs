#!/usr/bin/env node

// SEO / brand invariant guard for the prerendered marketing pages. Run after the
// marketing build (expects built HTML in agoracosmica/marketing/dist). Exits
// non-zero on a hard failure so a regression can't ship. Codifies the invariants
// established in the 2026-06-04 SEO/landing work, so the bugs we fixed stay fixed.
//
//   node client/scripts/validate-seo.mjs

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const SCRIPTS_DIR = import.meta.dirname;
const DIST = join(SCRIPTS_DIR, '..', '..', 'marketing', 'dist');

// Pages knowingly allowed a >60-char title pending a copy decision (2026-06-04):
// the DE figures catalog. Remove from here once shortened. The DE home left the
// list once its <title> stopped repeating the locked tagline (that line now
// lives on og:title, which has no length budget).
const TITLE_OVER60_OK = new Set(['de/figures/index.html']);
// Legal pages are standalone (no EN/DE twin), so no hreflang block, matching
// the sitemap generator's deliberate omission. The 404 page is excluded too:
// hreflang annotations belong on indexable 200-status pages only, and CF Pages
// serves 404.html with HTTP 404.
const NO_HREFLANG = new Set(['privacy', 'impressum', 'datenschutz', 'cookie-policy', 'nutzungsbedingungen', '404', 'figures/emily-dickinson/poems',
  'figures/william-blake/poems', 'figures/william-shakespeare/sonnets', 'figures/rumi/poems',
  'talk-to-historical-figures', 'de/figures/plato/hoehlengleichnis', 'de/figures/plato/ideenlehre']);

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
}
function decode(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/gi, "'").replace(/&middot;/g, '·')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

if (!existsSync(DIST)) {
  console.error(`No built pages at ${DIST}. Run the marketing build first.`);
  process.exit(1);
}

const files = walk(DIST);
const hard = [];
const warn = [];
const descs = new Map();

for (const f of files) {
  const rel = f.slice(DIST.length + 1);
  const slug = rel.replace(/\/index\.html$/, '').replace(/\.html$/, '');
  const html = readFileSync(f, 'utf8');
  const dhtml = decode(html);
  const isLegal = NO_HREFLANG.has(slug);

  // 1. At most one BreadcrumbList per page (the dup-schema bug).
  const bc = (html.match(/"BreadcrumbList"/g) || []).length;
  if (bc > 1) hard.push(`${rel}: ${bc} BreadcrumbList blocks (duplicate schema)`);

  // 2. Zero inline style="" attributes (CSP style-src has hashes voiding 'unsafe-inline').
  const inlineStyles = (html.match(/<[^>]+\sstyle="/g) || []).length;
  if (inlineStyles) hard.push(`${rel}: ${inlineStyles} inline style="" attribute(s) (CSP would block)`);

  // 3. No forbidden "greatest minds" framing (locked positioning). Plural only:
  // the collective positioning claim is always plural ("greatest minds"). The
  // singular "great mind" occurs in genuine quotes (Woolf, "the great mind is
  // androgynous") and must not trip the guard.
  if (/great(est)? minds|gr(ö|oe)(ß|ss)te[nr]? (denker|geister)/i.test(dhtml))
    hard.push(`${rel}: forbidden "greatest minds / größten Denker" framing`);

  // 4. Meta description: present, <=160, unique.
  const dm = html.match(/<meta name="description" content="([^"]*)"/);
  if (!dm) hard.push(`${rel}: missing meta description`);
  else {
    const d = decode(dm[1]);
    if (d.length > 160) hard.push(`${rel}: meta description ${d.length} chars (>160)`);
    if (descs.has(d)) warn.push(`${rel}: duplicate meta description (shared with ${descs.get(d)})`);
    else descs.set(d, rel);
  }

  // 5. Title: present, <=60 (allowlisted exceptions).
  const tm = html.match(/<title>([^<]*)<\/title>/);
  if (!tm) hard.push(`${rel}: missing <title>`);
  else {
    const t = decode(tm[1]);
    if (t.length > 60 && !TITLE_OVER60_OK.has(rel)) hard.push(`${rel}: title ${t.length} chars (>60): "${t}"`);
  }

  // 6. hreflang en/de/x-default on non-legal pages.
  if (!isLegal) {
    for (const hl of ['en', 'de', 'x-default'])
      if (!html.includes(`hreflang="${hl}"`)) hard.push(`${rel}: missing hreflang="${hl}"`);
  }

  // 7. Exactly one <h1>.
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 === 0) hard.push(`${rel}: no <h1>`);
  else if (h1 > 1) warn.push(`${rel}: ${h1} <h1> tags (expected 1)`);

  // 8. og + canonical present.
  for (const og of ['og:title', 'og:description', 'og:image'])
    if (!html.includes(`property="${og}"`)) hard.push(`${rel}: missing ${og}`);
  if (!html.includes('rel="canonical"')) hard.push(`${rel}: missing canonical`);

  // 9. Em-dash in visible body that is NOT a quote attribution. Attribution
  //    dashes ("— Rumi", "— Joseph Campbell") are an allowed typographic
  //    convention; prose em-dashes ("Lachen — und ...") are the AI marker we
  //    forbid. Heuristic: an em-dash followed by space + a capitalized word is
  //    attribution; anything else is flagged.
  const body = decode(html.replace(/<script[\s\S]*?<\/script>/g, ''));
  if (/—(?!\s+[A-ZÄÖÜ])/.test(body)) warn.push(`${rel}: non-attribution em-dash in body text`);

  // Visible body TEXT (tags stripped), shared by the content-presence guards
  // below. Hydration props="{…}" blobs and JSON-LD do not count as text.
  const text = body.replace(/<[^>]+>/g, ' ');

  // 10. Homepage content-presence guard. The six ways moved from a static card
  //     grid into the interactive LibraryShowcase, whose six panels are all
  //     server-rendered. Assert every mode name + the volume band survive in
  //     crawlable TEXT (tags stripped, so the hydration props="{…}" blob does
  //     NOT count). If a future refactor pushes the panels JS-only, their prose
  //     lives only in that attribute and this guard fails the deploy instead of
  //     silently thinning the homepage.
  const HOMEPAGE_TERMS = {
    'index.html': ['Story', 'Wisdom', 'Prism', 'Quest', 'Council', 'Free Talk', '360', '110'],
    'de/index.html': ['Story', 'Weisheit', 'Prisma', 'Quest', 'Council', 'Free Talk', '360', '110'],
  };
  if (HOMEPAGE_TERMS[rel]) {
    for (const term of HOMEPAGE_TERMS[rel])
      if (!text.includes(term)) hard.push(`${rel}: homepage missing crawlable text "${term}" (six-ways content regression?)`);
  }

  // 11. AI-disclosure invariants (the 2026-07 Art-50 transparency revision).
  //     Codified so a copy rewrite can't silently strip the disclosure surface.
  const isDe = rel.startsWith('de/');
  const isFigureDetail = /^(de\/)?figures\/[^/]+\/index\.html$/.test(rel);
  const isThemeDetail = /^(de\/)?themes\/[^/]+\/index\.html$/.test(rel);

  // 11a. Every figure detail page, theme detail page, and hub page names the
  //      AI nature in crawlable body text ("AI Echo" / "AI-generated" and the
  //      DE equivalents, incl. the "KI-erzeugt" variant used in the notice
  //      copy). Theme pages carry it via EchoNote, hubs via their L2 lines.
  // The wisdom hub (EN + DE) was consolidated into /figures/ in 2026-07 and
  // 301s there, so it is no longer a built page.
  const HUB_PAGES = new Set([
    'ai-philosophy-tutor/index.html', 'de/philosophie-lernen/index.html',
    'open-source-philosophy-app/index.html', 'de/open-source-philosophy-app/index.html',
  ]);
  if (isFigureDetail || isThemeDetail || HUB_PAGES.has(rel)) {
    const aiWord = isDe ? /KI-Echo|KI-generiert|KI-erzeugt|KI-Stimme/ : /AI Echo|AI-generated|AI voice/;
    if (!aiWord.test(text)) hard.push(`${rel}: page has no AI disclosure in visible body text`);
  }

  // 11b. Share-card alt text labels the portrait as AI-generated on figure +
  //      theme detail pages, so the disclosure travels with the artifact
  //      off-platform.
  if (isFigureDetail || isThemeDetail) {
    const prefix = isDe ? 'KI-generiertes Porträt:' : 'AI-generated portrait:';
    const am = html.match(/<meta property="og:image:alt" content="([^"]*)"/);
    if (!am) hard.push(`${rel}: missing og:image:alt`);
    else if (!decode(am[1]).startsWith(prefix))
      hard.push(`${rel}: og:image:alt must start with "${prefix}" (got "${decode(am[1])}")`);
  }

  // 11c. Figure JSON-LD keeps the disambiguatingDescription that separates the
  //      AI Echo from the real Wikidata person.
  if (isFigureDetail && !html.includes('"disambiguatingDescription"'))
    hard.push(`${rel}: figure JSON-LD missing "disambiguatingDescription"`);

  // 11d. The entry pages (home + both catalogs, EN + DE) each carry at least
  //      one disclosure line in visible text. Matched against the disclosure
  //      vocabulary, not one exact phrase: home + themes say "AI Echo", the
  //      figures catalog's EchoNote says "AI voice" / "AI-generated images".
  const DISCLOSURE_PAGES = new Set([
    'index.html', 'de/index.html',
    'figures/index.html', 'de/figures/index.html',
    'themes/index.html', 'de/themes/index.html',
  ]);
  if (DISCLOSURE_PAGES.has(rel)) {
    const disclosure = isDe
      ? /KI-Echo|KI-Stimme|KI-generiert|KI-erzeugt/
      : /AI Echo|AI voice|AI-generated/;
    if (!disclosure.test(text)) hard.push(`${rel}: missing AI disclosure line in visible text`);
  }
}

// 12. Terms-of-service pair: both language versions published, both carrying
//     the version string that the in-app consent record points at, and the EN
//     convenience translation naming the German text as the binding one.
const TERMS_PAGES = [
  { rel: 'terms/index.html', mustContain: ['Version 1.0.0', 'legally binding'] },
  { rel: 'nutzungsbedingungen/index.html', mustContain: ['Version 1.0.0'] },
];
for (const { rel, mustContain } of TERMS_PAGES) {
  const p = join(DIST, rel);
  if (!existsSync(p)) { hard.push(`${rel}: page missing from build`); continue; }
  const page = decode(readFileSync(p, 'utf8'));
  for (const s of mustContain)
    if (!page.includes(s)) hard.push(`${rel}: missing required text "${s}"`);
}

console.log(`validate-seo: checked ${files.length} built pages.`);
if (warn.length) {
  console.log(`\n⚠️  ${warn.length} warning(s):`);
  warn.forEach((w) => console.log('  - ' + w));
}
if (hard.length) {
  console.log(`\n❌ ${hard.length} hard failure(s):`);
  hard.forEach((h) => console.log('  - ' + h));
  process.exit(1);
}
console.log('\n✅ All SEO invariants hold.');
