#!/usr/bin/env node

// Submits the sitemap URLs to IndexNow so Bing (plus Yandex/Seznam/Naver) crawl
// new and changed pages within ~24h instead of waiting for an organic recrawl.
// Bing's index also backs ChatGPT Search, so this is the prerequisite for being
// citable there. It is a server-to-server ping: no cookies, no visitor data, it
// only names our own URLs, so it stays inside the no-tracking line.
//
// Run AFTER a deploy (the key file must already be live at the site root, or
// IndexNow rejects the batch on key validation):
//   node client/scripts/submit-indexnow.mjs            submit every sitemap URL
//   node client/scripts/submit-indexnow.mjs --dry-run  print the URLs, POST nothing
//
// The key is auto-discovered from client/public/<hexkey>.txt, so the key file
// and this script can never drift out of sync.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const SCRIPTS_DIR = import.meta.dirname;
const CLIENT_DIR = join(SCRIPTS_DIR, '..');
const PUBLIC_DIR = join(CLIENT_DIR, 'public');
const BUILD_DIR = join(CLIENT_DIR, 'build');
const SITE_HOST = 'agoracosmica.org';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const dryRun = process.argv.includes('--dry-run');

// The IndexNow key is the basename of the <hexkey>.txt file hosted at the root.
const keyFile = readdirSync(PUBLIC_DIR).find((f) => /^[0-9a-f]{8,128}\.txt$/.test(f));
if (!keyFile) {
  console.error('No IndexNow key file (client/public/<hexkey>.txt) found.');
  process.exit(1);
}
const key = keyFile.replace(/\.txt$/, '');
const keyLocation = `https://${SITE_HOST}/${keyFile}`;

// URL list comes from the built sitemap, so it always matches what we actually ship.
const sitemapPath = join(BUILD_DIR, 'sitemap.xml');
if (!existsSync(sitemapPath)) {
  console.error(`No sitemap at ${sitemapPath}. Run the production build first.`);
  process.exit(1);
}
const xml = readFileSync(sitemapPath, 'utf8');
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (urlList.length === 0) {
  console.error('No <loc> URLs found in the sitemap.');
  process.exit(1);
}

console.log(`IndexNow: ${urlList.length} URLs, key ${key.slice(0, 6)}…, keyLocation ${keyLocation}`);
if (dryRun) {
  urlList.forEach((u) => console.log('  ' + u));
  console.log('(dry run, nothing submitted)');
  process.exit(0);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: SITE_HOST, key, keyLocation, urlList }),
});
// 200 = OK, 202 = accepted (key validation pending). Both count as success.
const ok = res.status === 200 || res.status === 202;
console.log(`IndexNow responded ${res.status} ${res.statusText} — ${ok ? 'success' : 'FAILED'}`);
process.exit(ok ? 0 : 1);
