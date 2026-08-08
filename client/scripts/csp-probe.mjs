// The runtime half of the CSP gate: serve the real build under the real
// response-header CSP and assert a page reports zero violations while its
// islands actually hydrate.
//
// check-csp.mjs proves the hashes line up. This proves the merged policy the
// browser computes from meta AND header still runs the page, which is the part
// no static check can answer: runtime-injected styles, dynamically added
// scripts, and anything a bundler decided to inline late.
//
// Nothing leaves the machine. Every cross-origin request is aborted at the
// route level, after CSP has already scored it, so the probe never touches the
// production workers and never records a pageview.
//
// Prerequisite: none. Playwright is borrowed from the repo's nightagora
// package, the same way tests/e2e/run.mjs does, so client adds no dependency.
//
//   node scripts/csp-probe.mjs             the standard four surfaces
//   node scripts/csp-probe.mjs /de/audio/  one explicit path
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../nightagora/package.json', import.meta.url));
const { chromium } = require('playwright');

const BUILD = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'build');

// One representative of every inline-script shape the build produces: the
// homepage pre-paint marker, a figure page's island set, a theme page, the
// audio library, and German (its own hero markup).
const DEFAULT_PAGES = [
  '/',
  '/figures/marcus-aurelius/',
  '/themes/who-am-i/',
  '/audio/',
  '/de/',
  '/de/figures/index.html',
];

const targets = process.argv.slice(2).filter(a => a.startsWith('/'));
const PAGES = targets.length > 0 ? targets : DEFAULT_PAGES;

// ---------- the response headers Cloudflare Pages would send ----------
function pagesHeaders() {
  const text = readFileSync(join(BUILD, '_headers'), 'utf8');
  const headers = {};
  let inGlobal = false;
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      inGlobal = raw.trim() === '/*';
      continue;
    }
    if (!inGlobal) continue;
    const i = raw.indexOf(':');
    if (i > 0) headers[raw.slice(0, i).trim()] = raw.slice(i + 1).trim();
  }
  if (!headers['Content-Security-Policy']) {
    console.error('csp-probe: no /* Content-Security-Policy in build/_headers');
    process.exit(1);
  }
  return headers;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.mp3': 'audio/mpeg',
};

function startServer(headers) {
  const server = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let path = join(BUILD, normalize(url).replace(/^(\.\.[/\\])+/, ''));
    const stat = statSync(path, { throwIfNoEntry: false });
    if (stat?.isDirectory()) path = join(path, 'index.html');
    const body = (() => {
      try {
        return readFileSync(path);
      } catch {
        return null;
      }
    })();
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    if (body === null) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(body);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ---------- the probe ----------
const COLLECT = `
  window.__csp = [];
  window.addEventListener('securitypolicyviolation', e => {
    window.__csp.push({
      directive: e.effectiveDirective || e.violatedDirective,
      blocked: String(e.blockedURI || '').slice(0, 120),
      sample: String(e.sample || '').slice(0, 120),
      source: String(e.sourceFile || '').slice(0, 160),
      line: e.lineNumber,
    });
  }, true);
`;

const headers = pagesHeaders();
const server = await startServer(headers);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
let failures = 0;

for (const target of PAGES) {
  const page = await browser.newPage();
  await page.addInitScript(COLLECT);
  // CSP scores a request before the network sees it, so cutting the wire here
  // hides no violation. It keeps the probe offline and off the live workers.
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    return route.abort();
  });

  const consoleCsp = [];
  page.on('console', m => {
    if (/Content Security Policy/i.test(m.text())) consoleCsp.push(m.text().replace(/\s+/g, ' ').slice(0, 160));
  });

  await page.goto(base + target, { waitUntil: 'load' });
  // client="idle" islands wait for requestIdleCallback; give them the beat.
  await page.waitForTimeout(1200);
  // client="visible" islands wait for the viewport, so walk the page down and
  // back before judging. An island that is still unhydrated after this really
  // did not run.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);

  const violations = await page.evaluate(() => window.__csp);
  const islands = await page.evaluate(() => {
    const all = [...document.querySelectorAll('astro-island')];
    return {
      total: all.length,
      unhydrated: all.filter(el => el.hasAttribute('ssr')).map(el => el.getAttribute('component-url') || '?'),
    };
  });

  const scriptViolations = violations.filter(v => /script-src/.test(v.directive));
  const otherViolations = violations.filter(v => !/script-src/.test(v.directive));

  // Zero violations of any directive is the standing bar. style-src counts:
  // the hashes Astro adds to the meta policy make its 'unsafe-inline' inert,
  // so an inline style an island sets at runtime would be blocked there too.
  const bad = violations.length > 0 || islands.unhydrated.length > 0;
  if (bad) failures++;

  console.log(`${bad ? 'FAIL' : 'ok  '}  ${target}`);
  console.log(`        islands ${islands.total - islands.unhydrated.length}/${islands.total} hydrated`);
  if (islands.unhydrated.length > 0) {
    console.log(`        NOT HYDRATED: ${[...new Set(islands.unhydrated)].join(', ')}`);
  }
  for (const v of scriptViolations) {
    console.log(`        BLOCKED ${v.directive}  ${v.blocked}  ${v.source}:${v.line}`);
    if (v.sample) console.log(`                sample: ${v.sample}`);
  }
  for (const v of otherViolations) {
    console.log(`        BLOCKED ${v.directive}  ${v.blocked}  ${v.source}:${v.line}`);
    if (v.sample) console.log(`                sample: ${v.sample}`);
  }
  for (const line of consoleCsp.slice(0, 3)) console.log(`        console: ${line}`);

  await page.close();
}

await browser.close();
server.close();

if (failures > 0) {
  console.error(`csp-probe: ${failures}/${PAGES.length} page(s) failed under the production CSP`);
  process.exit(1);
}
console.log(`csp-probe: ${PAGES.length} page(s) clean under the production CSP`);
