// Build gate: no emitted asset may carry an ad-tech-looking name. Chunk names
// become public URLs, and content blockers (AdGuard, 1Blocker, Wipr) match
// words like "conversion" or "ad" in URLs. A blocked chunk takes every island
// that imports it down with it, unhydrated, with no visible error. This
// shipped once: listenedConversion.<hash>.js killed all interactive islands
// for blocker users on iOS and macOS Safari.
import { readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILD = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'build');

const BLOCKED_WORDS = new Set([
  'ad', 'ads', 'advert', 'adsense', 'affiliate', 'analytics', 'banner',
  'beacon', 'consent', 'conversion', 'conversions', 'doubleclick', 'gclid',
  'pixel', 'promo', 'sponsor', 'sponsored', 'telemetry', 'track', 'tracker',
  'tracking', 'utm',
]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(js|css)$/.test(entry)) yield path;
  }
}

// "LabLibrary.DbOa4KjD.js" -> ["lab", "library"]: drop extension and the
// 8-char content hash, split the rest on case, dot and dash boundaries.
function words(file) {
  const stem = basename(file)
    .replace(/\.(js|css)$/, '')
    .replace(/[.-][A-Za-z0-9_-]{8}$/, '');
  return stem
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z]+/)
    .filter(Boolean)
    .map(w => w.toLowerCase());
}

const offenders = [];
for (const file of walk(BUILD)) {
  const hit = words(file).find(w => BLOCKED_WORDS.has(w));
  if (hit) offenders.push(`${file.slice(BUILD.length + 1)}  (word: "${hit}")`);
}

if (offenders.length > 0) {
  console.error('Asset names that content blockers may match:');
  for (const o of offenders) console.error('  ' + o);
  console.error('Rename the source file to something blockers have no reason to touch.');
  process.exit(1);
}
console.log('check-asset-names: all emitted asset names are blocker-neutral');
