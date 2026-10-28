#!/usr/bin/env node
// The story player's fit check over every figure, German and English: run it before a figure's page switches on.
//
//   node marketing/scripts/check-player-fit.mjs                 build every figure on the player, then check all
//   node marketing/scripts/check-player-fit.mjs --dist <dir>    check a build made with PLAYER_FIT_ALL=1
//   options: --figures <slug,...>  --langs de,en  --engines chromium,webkit  --strict  --report <file.tsv>
//            --port <n> (its own static server; a free one by default)
//
// The build goes to node_modules/.cache/player-fit (PLAYER_FIT_ALL=1, see src/player/pages.ts), never to dist/.
// Each page is opened at 390 and 360 px (and 1440 for the map) with the site's own fonts; nothing leaves the machine.
// A DISPLAY fault is the page's: the build fails it (exit 1). A DATA item is a figure's data that no display rule can
// set without dropping a fact: it is listed by file and line with the smallest edit, and fails only with --strict.
//
// Map (in the plate's own units, margin 2): no "next" tag crosses a number, the introduction's name, "via sapientiae",
// the title box, a path, another star's playing ring (r 20) or its own next ring (r 24); where a star has no tag on the
// plate, its line under the map says "<tag>: <n>. <title>"; no number touches a path, another star's ring or another
// number; the introduction's name keeps off the stars, the paths and the numbers; the title box keeps off
// "via sapientiae" and the stars; every story and the introduction has a star of its own. The map is offered only where
// its smallest star target reaches 44 px under a finger (the phone sizes run as touch screens) or 24 px under a mouse
// (1440); the page's own choice is checked against that, a size without the map reports a NOMAP line, and an offered
// map's target under 44 px a TAP line.
// Words: the hero's meta line is the field and plain years (no bracket, no note); a row's place has no slash and no
// bracket; an age reads as an age, and carries "etwa" / "about" where the birth year is approximate; every year
// field sets in the year column (a year or a decade in the large figure, each small line inside the column, nothing
// over the title; a field with no year in figures is the owner's data); a range of numbers never breaks at its
// hyphen; the after-story switch keeps both its words whole.
//
// Playwright is borrowed from the repository's nightagora package, as scripts/csp-probe.mjs does in client/;
// PLAYWRIGHT_PACKAGE=<path to a package.json beside a playwright install> points elsewhere.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync, createReadStream } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MARKETING = join(HERE, '..');
const REPO = join(MARKETING, '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const strict = args.includes('--strict');
const langs = opt('langs', 'de,en').split(',');
const engines = opt('engines', 'chromium').split(',');
const report = opt('report', '');

const require = createRequire(process.env.PLAYWRIGHT_PACKAGE ?? join(REPO, 'nightagora/package.json'));
const pw = require('playwright');

// ---- the build ----------------------------------------------------------
let dist = opt('dist', '');
if (!dist) {
  dist = join(MARKETING, 'node_modules/.cache/player-fit/dist');
  const res = spawnSync('pnpm', ['exec', 'astro', 'build', '--outDir', dist], {
    cwd: MARKETING, stdio: 'inherit', env: { ...process.env, PLAYER_FIT_ALL: '1' },
  });
  if (res.status !== 0) { console.error('FIT: the build failed'); process.exit(2); }
}

// ---- the figures and their data files ---------------------------------
const slugMapSrc = readFileSync(join(REPO, 'client/src/data/public/slugMap.ts'), 'utf8');
const slugToId = Object.fromEntries([...slugMapSrc.slice(0, slugMapSrc.indexOf('};')).matchAll(/'([a-z-]+)':\s*'([a-z]+)'/g)].map(m => [m[1], m[2]]));
const onlyFigures = opt('figures', '');
const slugs = (onlyFigures ? onlyFigures.split(',') : Object.keys(slugToId)).filter(s => slugToId[s]);
const catalogSrc = readFileSync(join(REPO, 'client/src/data/public/figuresCatalog.ts'), 'utf8').split('\n');
const deStart = catalogSrc.findIndex(l => l.includes('figuresCatalogDe'));

function catalogLine(id, lang, key) {
  const from = lang === 'de' ? deStart : 0;
  const at = catalogSrc.findIndex((l, i) => i > from && l.includes(`"id": "${id}"`));
  const line = catalogSrc.findIndex((l, i) => i > at && l.includes(`"${key}":`));
  return { file: 'client/src/data/public/figuresCatalog.ts', line: line + 1, text: (catalogSrc[line] ?? '').trim() };
}
const factLines = new Map();
function factLine(id, lang, n, key) {
  const file = `client/src/assets/factchecks/${lang}/${id}.json`;
  if (!factLines.has(file)) factLines.set(file, existsSync(join(REPO, file)) ? readFileSync(join(REPO, file), 'utf8').split('\n') : []);
  const lines = factLines.get(file);
  const storiesAt = lines.findIndex(l => /"stories"\s*:/.test(l));
  const at = lines.findIndex((l, i) => i > storiesAt && new RegExp(`"number"\\s*:\\s*${n}\\b`).test(l));
  const line = lines.findIndex((l, i) => i > at && l.includes(`"${key}":`));
  return { file, line: line + 1, text: (lines[line] ?? '').trim() };
}

// ---- a static server for the build ------------------------------------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.webp': 'image/webp' };
const fontsDir = join(REPO, 'client/public/fonts');
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let base = dist;
  if (p.startsWith('/fonts/') && existsSync(join(fontsDir, p.slice(6)))) { base = fontsDir; p = p.slice(6); }
  let file = normalize(join(base, p));
  if (!file.startsWith(base)) { res.writeHead(403); res.end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(Number(opt('port', '0')), '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// ---- the verdicts -----------------------------------------------------
const faults = [];
const data = new Map();
let checked = 0;
const fail = (slug, lang, where, what, ev) => { faults.push([slug, lang, where, what, ev]); console.log(`FAIL display ${slug} ${lang} ${where} ${what}: ${ev}`); };
function dataItem(slug, lang, src, what, value, edit) {
  const key = `${src.file}:${src.line}`;
  if (data.has(key)) return;
  data.set(key, { slug, lang, src, what, value, edit });
}

// Runs in the page: everything measured at one width.
function measure({ checkMap }) {
  const out = { map: null, rows: [], meta: null, lead: null, ranges: [], seg: [] };
  const nowrap = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const ws = getComputedStyle(e).whiteSpace; if (ws === 'nowrap' || ws === 'pre') return true; } return false; };
  // a range of numbers anywhere in the hero's meta, the rows and the lead, and whether a break could split it
  for (const root of document.querySelectorAll('.sp-hero__meta, .sp-row__sub, .sp-toc__lead, .sp-row__year')) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      for (const m of n.nodeValue.matchAll(/\d[-–]\d/g)) if (!nowrap(n.parentElement)) out.ranges.push(`${root.className.split(' ')[0]}: ${n.nodeValue.slice(Math.max(0, m.index - 12), m.index + 14)}`);
    }
  }
  const meta = document.querySelector('.sp-hero__meta');
  out.meta = meta ? meta.textContent.replace(/\s+/g, ' ').trim() : null;
  out.lead = document.querySelector('.sp-toc__lead')?.textContent.trim() ?? null;
  for (const row of document.querySelectorAll('.sp-row:not(.sp-row--intro)')) {
    const n = Number(row.dataset.n);
    const year = row.querySelector('.sp-row__year');
    const body = row.querySelector('.sp-row__body');
    const yr = year.getBoundingClientRect();
    const parts = [...year.childNodes].map(c => {
      const el = c.nodeType === 1 ? c : null;
      const r = el ? el.getBoundingClientRect() : (() => { const rg = document.createRange(); rg.selectNodeContents(c); return rg.getBoundingClientRect(); })();
      const small = !!el && /sp-row__(approx|yearto|yearnote)/.test(el.className);
      const lines = el ? new Set([...el.getClientRects()].map(q => Math.round(q.top))).size : 1;
      return { text: c.textContent.trim(), small, right: r.right, left: r.left, lines };
    }).filter(p => p.text);
    const sub = row.querySelector('.sp-row__sub');
    const place = sub?.querySelector('.sp-row__place')?.textContent ?? null;
    const age = sub?.querySelector('.sp-row__age')?.textContent ?? null;
    out.rows.push({ n, yearRight: yr.right, yearLeft: yr.left, bodyLeft: body.getBoundingClientRect().left, parts,
      sub: sub ? sub.textContent : '', place, age });
  }
  // the after-story switch as the open player sets it, for every story's title as the next one
  const titles = [...document.querySelectorAll('.sp-row:not(.sp-row--intro) .sp-row__title')].map(t => t.textContent.trim());
  const de = document.documentElement.lang === 'de';
  const sheet = document.createElement('div');
  sheet.className = 'sp-sheet';
  sheet.style.visibility = 'hidden';
  const bodyEl = document.createElement('div');
  bodyEl.className = 'sp-sheet__body';
  sheet.append(bodyEl);
  document.body.append(sheet);
  titles.forEach((title, i) => {
    const field = document.createElement('div');
    field.className = 'sp-field';
    field.innerHTML = `<span class="sp-fp__after"><span class="sp-field__label"></span><span class="sp-fp__next"></span></span><div class="sp-seg" role="radiogroup"><button type="button" role="radio" aria-checked="true"></button><button type="button" role="radio" aria-checked="false"></button></div>`;
    field.querySelector('.sp-field__label').textContent = de ? 'Nach dieser Geschichte' : 'After this story';
    field.querySelector('.sp-fp__next').textContent = `${de ? 'Danach' : 'Next'}: ${i + 1}. ${title}`;
    const [a, b] = field.querySelectorAll('button');
    a.textContent = de ? 'Weiter' : 'Next';
    b.textContent = de ? 'Stopp' : 'Stop';
    bodyEl.append(field);
    const clipped = [a, b].filter(btn => btn.scrollWidth > btn.clientWidth + 0.5 || btn.getBoundingClientRect().width < 44);
    const segR = field.querySelector('.sp-seg').getBoundingClientRect();
    if (clipped.length || segR.right > field.getBoundingClientRect().right + 0.5) out.seg.push(`${i + 1}: ${clipped.map(btn => `${btn.textContent} ${btn.getBoundingClientRect().width.toFixed(1)}px, text ${btn.scrollWidth}px`).join('; ')}`);
  });
  sheet.remove();
  if (!checkMap) return out;
  const svg = document.querySelector('[data-story-map]');
  if (!svg) return out;
  const spread = document.querySelector('.sp-spread');
  // the page's own choice first, then the map shown for the measure wherever the page withholds it
  const offered = !spread?.hasAttribute('data-map-off');
  const fine = matchMedia('(pointer: fine)').matches;
  document.querySelector('.sp-mapwrap')?.style.removeProperty('display');
  if (spread) spread.dataset.view = 'map';
  const fs = el => parseFloat(getComputedStyle(el).fontSize);
  // caps and figures: their ink sits on the baseline; the box is the advance less the last letter's spacing
  const inkBox = el => {
    const b = el.getBBox(); const y = Number(el.getAttribute('y')); const f = fs(el);
    const ls = parseFloat(getComputedStyle(el).letterSpacing) || 0;
    const anchor = el.getAttribute('text-anchor');
    const l = anchor === 'end' ? b.x + ls : b.x; const r = anchor === 'end' ? b.x + b.width : b.x + b.width - ls;
    return { l, r, t: y - 0.74 * f, b: y + 0.02 * f };
  };
  const emBox = el => { const b = el.getBBox(); return { l: b.x, r: b.x + b.width, t: b.y, b: b.y + b.height }; };
  const stars = [...svg.querySelectorAll('a.sp-star')].map(a => {
    const m = a.querySelector('.sp-star__orn').transform.baseVal.consolidate().matrix;
    return { n: Number(a.dataset.storyStar), x: m.e, y: m.f, a, tap: 2 * a.querySelector('.sp-star__hit').r.baseVal.value * svg.getScreenCTM().a };
  });
  const nums = stars.map(s => { const t = s.a.querySelector('.sp-star__num'); return t ? { n: s.n, box: inkBox(t) } : null; }).filter(Boolean);
  const introEl = svg.querySelector('.sp-star__intro');
  const intro = introEl ? { n: 0, box: emBox(introEl) } : null;
  const via = emBox(svg.querySelector('.sp-atlas__vialabel'));
  const segs = [...svg.querySelectorAll('line.sp-atlas__line')].map(l => ['x1', 'y1', 'x2', 'y2'].map(k => Number(l.getAttribute(k))));
  const inv = svg.getScreenCTM().inverse();
  const cart = document.querySelector('.sp-atlas__cartouche');
  let title = null;
  if (cart) {
    const r = cart.getBoundingClientRect();
    const pts = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(inv));
    title = { l: Math.min(...pts.map(p => p.x)), r: Math.max(...pts.map(p => p.x)), t: Math.min(...pts.map(p => p.y)), b: Math.max(...pts.map(p => p.y)) };
  }
  const tags = stars.map(s => {
    const t = s.a.querySelector('.sp-star__next');
    if (!t) return { n: s.n, box: null };
    s.a.classList.add('is-next');
    const box = inkBox(t);
    s.a.classList.remove('is-next');
    return { n: s.n, box };
  });
  const caps = Object.fromEntries([...document.querySelectorAll('[data-next-cap]')].map(c => [c.dataset.nextCap, c.textContent.trim()]));
  const vb = svg.viewBox.baseVal;
  out.map = { offered, fine, stars: stars.map(({ n, x, y, tap }) => ({ n, x, y, tap })), nums, intro, via, segs, title, tags, caps, w: vb.width, h: vb.height,
    word: svg.dataset.nextWord ?? null, titles: Object.fromEntries([...document.querySelectorAll('.sp-row')].map(r => [r.dataset.n, r.querySelector('.sp-row__title')?.textContent.trim()])) };
  return out;
}

const M = 2;
const grow = (b, x, y = x) => ({ l: b.l - x, r: b.r + x, t: b.t - y, b: b.b + y });
const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const boxDist = (b, x, y) => Math.hypot(Math.max(b.l - x, 0, x - b.r), Math.max(b.t - y, 0, y - b.b));
function segBoxDist([x1, y1, x2, y2], b) {
  // the shortest distance from a segment to a box: sample along the segment (a unit apart)
  const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  let d = Infinity;
  for (let k = 0; k <= n; k++) d = Math.min(d, boxDist(b, x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n));
  return d;
}
const f1 = v => (Math.round(v * 10) / 10).toString();

function judgeMap(slug, lang, where, m) {
  const starAt = new Map(m.stars.map(s => [s.n, s]));
  const word = m.word ?? (lang === 'de' ? 'Danach' : 'Up next');
  for (const t of m.tags) {
    const s = starAt.get(t.n);
    const label = `tag ${t.n}`;
    if (!t.box) {
      const want = `${word}: ${t.n === 0 ? (lang === 'de' ? 'Einführung' : 'Introduction') : `${t.n}. ${m.titles[t.n]}`}`;
      if (m.caps[t.n] !== want) fail(slug, lang, where, `${label} has no place on the plate and no line under it`, m.caps[t.n] ?? 'none');
      continue;
    }
    const b = t.box;
    for (const k of m.nums) if (hit(b, grow(k.box, M))) fail(slug, lang, where, `${label} crosses number ${k.n}`, `${f1(b.l)},${f1(b.t)}`);
    if (m.intro && t.n !== 0 && hit(b, grow(m.intro.box, M))) fail(slug, lang, where, `${label} crosses the introduction's name`, '');
    if (m.intro && t.n === 0 && hit(b, grow(m.intro.box, M))) fail(slug, lang, where, `${label} crosses its own name`, '');
    if (hit(b, grow(m.via, M))) fail(slug, lang, where, `${label} crosses via sapientiae`, `${f1(b.b)} against ${f1(m.via.t)}`);
    if (m.title && hit(b, grow(m.title, M))) fail(slug, lang, where, `${label} crosses the title box`, '');
    for (const o of m.stars) {
      const d = boxDist(b, o.x, o.y);
      if (o.n !== t.n && d < 20 + M) fail(slug, lang, where, `${label} crosses star ${o.n}'s ring`, f1(d));
      if (o.n === t.n && d < 24 + M) fail(slug, lang, where, `${label} crosses its own next ring`, f1(d));
    }
    m.segs.forEach((sg, i) => { const d = segBoxDist(sg, b); if (d < M) fail(slug, lang, where, `${label} crosses path ${i + 1}`, f1(d)); });
    if (b.l < M || b.r > m.w - M || b.t < M) fail(slug, lang, where, `${label} leaves the plate`, `${f1(b.l)}-${f1(b.r)}`);
    if (!s) fail(slug, lang, where, `${label} has no star`, '');
  }
  for (const k of m.nums) {
    m.segs.forEach((sg, i) => { const d = segBoxDist(sg, k.box); if (d < M) fail(slug, lang, where, `number ${k.n} on path ${i + 1}`, f1(d)); });
    for (const o of m.stars) {
      const d = boxDist(k.box, o.x, o.y);
      if (o.n !== k.n && d < 20 + M) fail(slug, lang, where, `number ${k.n} crosses star ${o.n}'s ring`, f1(d));
      if (o.n === k.n && d < 24) fail(slug, lang, where, `number ${k.n} crosses its own ring`, f1(d));
    }
    for (const j of m.nums) if (j.n < k.n && hit(k.box, grow(j.box, M))) fail(slug, lang, where, `numbers ${j.n} and ${k.n} touch`, '');
    if (m.intro && hit(k.box, grow(m.intro.box, M))) fail(slug, lang, where, `number ${k.n} crosses the introduction's name`, '');
    if (hit(k.box, grow(m.via, M))) fail(slug, lang, where, `number ${k.n} crosses via sapientiae`, '');
  }
  if (m.intro) {
    const ib = m.intro.box;
    for (const o of m.stars) {
      const d = boxDist(ib, o.x, o.y);
      if (o.n !== 0 && d < 20 + M) fail(slug, lang, where, `the introduction's name crosses star ${o.n}'s ring`, f1(d));
      if (o.n === 0 && d < 24 + 1) fail(slug, lang, where, `the introduction's name crosses its own ring`, f1(d));
    }
    m.segs.forEach((sg, i) => { const d = segBoxDist(sg, ib); if (d < M) fail(slug, lang, where, `the introduction's name on path ${i + 1}`, f1(d)); });
    if (hit(ib, grow(m.via, M))) fail(slug, lang, where, `the introduction's name crosses via sapientiae`, '');
  }
  for (const o of m.stars) {
    if (boxDist(m.via, o.x, o.y) < 24 + M) fail(slug, lang, where, `via sapientiae under star ${o.n}'s ring`, f1(boxDist(m.via, o.x, o.y)));
    if (m.title && boxDist(m.title, o.x, o.y) < 24 + M) fail(slug, lang, where, `the title box under star ${o.n}'s ring`, f1(boxDist(m.title, o.x, o.y)));
  }
  if (m.title && hit(m.title, grow(m.via, M))) fail(slug, lang, where, 'the title box crosses via sapientiae', `${f1(m.title.t)} against ${f1(m.via.b)}`);
  for (const n of Object.keys(m.titles).map(Number)) if (!starAt.has(n)) fail(slug, lang, where, `story ${n} has no star`, '');
  m.stars.forEach((a, i) => m.stars.slice(i + 1).forEach(b => {
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1) fail(slug, lang, where, `stars ${a.n} and ${b.n} stand at one place`, '');
  }));
  const small = m.stars.reduce((x, o) => (o.tap < x.tap ? o : x), { tap: Infinity });
  const bar = m.fine ? 24 : 44;
  if (m.offered && small.tap < bar) fail(slug, lang, where, 'the map is offered under its tap bar', `${f1(small.tap)} px (star ${small.n}) against ${bar}`);
  if (!m.offered && small.tap >= bar) fail(slug, lang, where, 'the map is withheld over its tap bar', `${f1(small.tap)} px (star ${small.n}) against ${bar}`);
  if (!m.offered) taps.push(`NOMAP ${slug} ${lang} ${where} the list alone: smallest star target ${f1(small.tap)} px (star ${small.n}) under ${bar}`);
  else if (small.tap < 44) taps.push(`TAP ${slug} ${lang} ${where} smallest star target ${f1(small.tap)} px (star ${small.n}), ${m.fine ? 'a mouse' : 'a finger'}`);
}
const taps = [];

const AGE_OK = {
  de: [/^mit (etwa )?\d{1,3}(-\d{1,3})? Jahren$/, /^mit (Anfang|Mitte|Ende) \d0$/, /^ab \d{1,3} Jahren$/, /^(etwa )?in (seinen|ihren) \d0ern$/, /^als Kind$/],
  en: [/^age (about )?\d{1,3}(-\d{1,3})?$/, /^in (his|her) (early|mid|late) \d0s$/, /^from age \d{1,3}$/, /^(roughly )?in (his|her) \d0s$/, /^as a child$/],
};
const EXACT = { de: /^mit \d{1,3} Jahren$/, en: /^age \d{1,3}$/ };
const SEP = / ·\s/;

function judgeWords(slug, id, lang, where, r) {
  if (r.meta !== null) {
    const parts = r.meta.split(/\s·\s/);
    const period = parts.length > 1 ? parts.slice(1).join(' · ') : '';
    if (!/^((ca\.|c\.|um) )?\d{1,4}(\/\d{1,4})?(-\d{1,4}(\/\d{1,4})?)?( v\. Chr\.| BCE| n\. Chr\.| AD)?$/.test(period)
      && !/^((ca\.|c\.|etwa|roughly) )?\d{1,2}(\.|st|nd|rd|th) (Jahrhundert|century)( v\. Chr\.| BCE)?$/.test(period)) {
      const src = catalogLine(id, lang, 'period');
      dataItem(slug, lang, src, 'the hero\'s years are a note, not plain years', period,
        'keep the years alone in "period" and move the note into the facts\' foreword');
    }
  }
  const approxBirth = /^(ca\.|c\.|~|um |etwa|roughly|late |späte )/i.test((r.meta ?? '').split(/\s·\s/).slice(1).join(' ')) || /Jahrhundert|century/.test(r.meta ?? '');
  for (const row of r.rows) {
    // the year column
    const big = row.parts.filter(p => !p.small);
    const src = factLine(id, lang, row.n, 'year');
    const value = (src.text.match(/:\s*"(.*)",?$/) ?? [])[1] ?? '';
    if (big.length === 0 && value && !/\d{3,4}/.test(value)) dataItem(slug, lang, src, 'a year without a year in figures', value, 'a year ("1919", "~1919"), the words into the facts');
    else if (big.length !== 1 || !/^\d{1,4}(er|s)?$/.test(big[0].text)) fail(slug, lang, where, `story ${row.n}'s year column`, `large "${big.map(p => p.text).join('|')}"`);
    for (const p of row.parts) {
      if (p.right > row.yearRight + 0.5 || p.right > row.bodyLeft - 2) fail(slug, lang, where, `story ${row.n}'s year column`, `"${p.text}" ${f1(p.right - row.yearLeft)} px wide in ${f1(row.yearRight - row.yearLeft)}`);
      if (p.small && p.lines > 1) fail(slug, lang, where, `story ${row.n}'s year column`, `"${p.text}" on ${p.lines} lines`);
    }
    // the place and the age, by their marks, else by the row line's separators
    let { place, age } = row;
    if (place === null && age === null) {
      const items = row.sub.split(SEP).map(s => s.trim()).filter(Boolean).slice(0, -1);
      age = items.find(s => /^(mit |age |etwa |about )/.test(s) || /Jahren$/.test(s)) ?? null;
      place = items.find(s => s !== age) ?? null;
    }
    if (place && /[/()]/.test(place)) {
      const src = factLine(id, lang, row.n, 'setting');
      if (/\s\([^()]*\)(,|$)/.test(place) && !place.includes('/')) fail(slug, lang, where, `story ${row.n}'s place has a bracket`, place);
      else dataItem(slug, lang, src, 'a place with a slash or a bracket', place,
        place.includes('/') ? 'name the places with "und" / "and" (or one place)' : 'the place alone, the note into the facts');
    }
    if (age) {
      const a = age.replace(/ /g, ' ');
      if (!/\d/.test(a)) {
        if (/^(mit |age )/.test(a)) fail(slug, lang, where, `story ${row.n}'s age is framed as an age`, a);
        else if (!AGE_OK[lang].some(re => re.test(a))) dataItem(slug, lang, factLine(id, lang, row.n, 'age'), 'an age that is not an age', a, 'an age in years ("~50"), or the field left out');
      } else if (!AGE_OK[lang].some(re => re.test(a))) fail(slug, lang, where, `story ${row.n}'s age`, a);
      else if (approxBirth && EXACT[lang].test(a)) fail(slug, lang, where, `story ${row.n}'s age is exact on an approximate birth year`, a);
    }
  }
  for (const rg of r.ranges) fail(slug, lang, where, 'a range can break at its hyphen', rg);
  for (const s of r.seg) fail(slug, lang, where, 'the after-story switch is cut', s);
}

for (const engine of engines) {
  const browser = await pw[engine].launch();
  for (const width of [390, 360, 1440]) {
    // a phone is a touch screen (its tap bar 44 px), the desktop a mouse (24 px)
    const touch = width < 1000 ? { hasTouch: true, ...(engine === 'chromium' ? { isMobile: true } : {}) } : {};
    const ctx = await browser.newContext({ viewport: { width, height: width > 1000 ? 900 : 844 }, ...touch });
    await ctx.route('**/*', r => (new URL(r.request().url()).origin === origin ? r.continue() : r.abort()));
    const page = await ctx.newPage();
    for (const lang of langs) {
      for (const slug of slugs) {
        const path = lang === 'de' ? `/de/figures/${slug}/` : `/figures/${slug}/`;
        const res = await page.goto(origin + path, { waitUntil: 'load' });
        if (!res || res.status() !== 200 || !(await page.$('.sp-hero'))) { fail(slug, lang, `${engine} ${width}`, 'no player page', String(res?.status())); continue; }
        // the page's script has run once the plate carries its offer (the map's choice is made before it)
        if (!(await page.waitForSelector('[data-story-hero-plate][data-offer]', { state: 'attached', timeout: 10000 }).catch(() => null))) {
          fail(slug, lang, `${engine} ${width}`, 'the page script never ran', ''); continue;
        }
        // the map's own type loads only once the map shows: show it (a withheld map too), wait for the fonts, then
        // measure as built
        await page.evaluate(() => {
          const sp = document.querySelector('.sp-spread'); const was = sp?.dataset.view;
          document.querySelector('.sp-mapwrap')?.style.removeProperty('display');
          if (sp) sp.dataset.view = 'map';
          return document.fonts.ready.then(() => { if (sp) { if (was === undefined) delete sp.dataset.view; else sp.dataset.view = was; } });
        });
        await page.evaluate(() => document.fonts.ready);
        const r = await page.evaluate(measure, { checkMap: true });
        const where = `${engine} ${width}`;
        if (r.map) judgeMap(slug, lang, where, r.map); else fail(slug, lang, where, 'no map', '');
        if (width < 1000) judgeWords(slug, slugToId[slug], lang, where, r);
        checked++;
      }
    }
    await ctx.close();
  }
  await browser.close();
}
server.close();

for (const t of taps) console.log(t);
const items = [...data.values()];
for (const d of items) console.log(`DATA ${d.slug} ${d.lang} ${d.src.file}:${d.src.line} ${d.what}: "${d.value}" -> ${d.edit}`);
if (report) {
  writeFileSync(report, ['kind\tfigure\tlang\twhere\twhat\tevidence',
    ...faults.map(f => ['display', ...f].join('\t')),
    ...items.map(d => ['data', d.slug, d.lang, `${d.src.file}:${d.src.line}`, d.what, `${d.value} -> ${d.edit}`].join('\t'))].join('\n') + '\n');
}
const bad = faults.length + (strict ? items.length : 0);
console.log(`FIT ${bad ? 'FAIL' : 'PASS'}: ${checked} page views, ${faults.length} display fault(s), ${items.length} data item(s) for the owner${strict ? ' (strict)' : ''}`);
process.exit(bad ? 1 : 0);
