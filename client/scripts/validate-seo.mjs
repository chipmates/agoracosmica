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
// the DE home (the LOCKED platform tagline) + the DE figures catalog. Remove
// from here once shortened.
const TITLE_OVER60_OK = new Set(['de/index.html', 'de/figures/index.html']);
// Legal pages are standalone (no EN/DE twin), so no hreflang block, matching
// the sitemap generator's deliberate omission. The 404 page is excluded too:
// hreflang annotations belong on indexable 200-status pages only, and CF Pages
// serves 404.html with HTTP 404.
const NO_HREFLANG = new Set(['privacy', 'impressum', 'datenschutz', 'cookie-policy', 'nutzungsbedingungen', '404', 'figures/emily-dickinson/poems']);

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
    const text = body.replace(/<[^>]+>/g, ' ');
    for (const term of HOMEPAGE_TERMS[rel])
      if (!text.includes(term)) hard.push(`${rel}: homepage missing crawlable text "${term}" (six-ways content regression?)`);
  }
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
