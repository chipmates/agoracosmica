#!/usr/bin/env node
//
// setup-assets.mjs — fetch content assets from the production CDN.
//
// Run after a fresh `pnpm install` to populate gitignored content folders:
//   - src/assets/translations/seeds/{en,de}/<figure>-seeds.json
//   - src/assets/translations/figures/{en,de}/<figure>.json
//   - src/assets/factchecks/{en,de}/<figure>.json
//   - src/assets/voice_profiles/{en,de}/<figure>.json
//   - src/assets/instructions/<figure>/<mode>.json
//
// Why content is not in the repo: per CONTENT-LICENSE.md, content is © ChipMates
// gemeinnützige GmbH until the CC-BY 4.0 transition. Code (AGPL-3.0) ships in
// this repo; content is fetched at setup-time from the production CDN.
//
// Re-running is safe: existing files are skipped. Use --force to re-fetch all.

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const CDN = process.env.AGORACOSMICA_CDN || 'https://media.agoracosmica.org';
const CLIENT_DIR = join(import.meta.dirname, '..');
const FORCE = process.argv.includes('--force');
const PARALLEL = 12;

const LANGS = ['en', 'de'];

const FIGURES = [
  'angelou', 'aurelius', 'austen', 'beauvoir', 'bingen', 'blake',
  'campbell', 'dickinson', 'eckhart', 'einstein', 'galilei', 'gandhi',
  'gautama', 'goethe', 'jung', 'kahlo', 'king', 'laozi', 'lovelace',
  'mandela', 'mozart', 'nietzsche', 'plato', 'rumi', 'schopenhauer',
  'shakespeare', 'tubman', 'vinci', 'woolf', 'zenji',
];

const INSTRUCTION_MODES = ['free_conversation', 'seed_challenge', 'seed_conversation'];

async function fetchOne(url, localPath) {
  if (!FORCE && existsSync(localPath)) {
    return { skipped: true };
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { error: `HTTP ${res.status} ${url}` };
    }
    const text = await res.text();
    mkdirSync(dirname(localPath), { recursive: true });
    writeFileSync(localPath, text);
    return { fetched: true, bytes: text.length };
  } catch (e) {
    return { error: `${e.message} ${url}` };
  }
}

async function downloadGroup({ name, urlBase, localBase, files }) {
  process.stdout.write(`${name.padEnd(22)} `);
  let fetched = 0, skipped = 0, bytes = 0;
  const errors = [];

  for (let i = 0; i < files.length; i += PARALLEL) {
    const chunk = files.slice(i, i + PARALLEL);
    const results = await Promise.all(
      chunk.map(f =>
        fetchOne(`${CDN}/${urlBase}/${f}`, join(CLIENT_DIR, localBase, f)),
      ),
    );
    for (const r of results) {
      if (r.fetched) { fetched++; bytes += r.bytes; }
      else if (r.skipped) { skipped++; }
      else { errors.push(r.error); }
    }
  }

  const mb = (bytes / 1_048_576).toFixed(1);
  console.log(
    `${String(fetched).padStart(4)} fetched · ` +
    `${String(skipped).padStart(4)} skipped · ` +
    `${mb.padStart(5)} MB` +
    (errors.length ? ` · ${errors.length} ERRORS` : ''),
  );
  if (errors.length) {
    errors.slice(0, 3).forEach(e => console.error(`  ⚠ ${e}`));
    if (errors.length > 3) console.error(`  ⚠ ... and ${errors.length - 3} more`);
  }
  return { fetched, skipped, bytes, errors };
}

console.log(`\n📦 Fetching content from ${CDN}${FORCE ? ' (--force, overwriting)' : ''}\n`);

const groups = [
  {
    name: 'Wisdom seeds',
    urlBase: 'seeds',
    localBase: 'src/assets/translations/seeds',
    files: LANGS.flatMap(l => FIGURES.map(f => `${l}/${f}-seeds.json`)),
  },
  {
    name: 'Figure translations',
    urlBase: 'figure-translations',
    localBase: 'src/assets/translations/figures',
    files: LANGS.flatMap(l => FIGURES.map(f => `${l}/${f}.json`)),
  },
  {
    name: 'Factchecks',
    urlBase: 'factchecks',
    localBase: 'src/assets/factchecks',
    files: LANGS.flatMap(l => FIGURES.map(f => `${l}/${f}.json`)),
  },
  {
    name: 'Voice profiles',
    urlBase: 'voice-profiles',
    localBase: 'src/assets/voice_profiles',
    files: LANGS.flatMap(l => FIGURES.map(f => `${l}/${f}.json`)),
  },
  {
    name: 'Instructions',
    urlBase: 'instructions',
    localBase: 'src/assets/instructions',
    files: FIGURES.flatMap(f => INSTRUCTION_MODES.map(m => `${f}/${m}.json`)),
  },
];

const start = Date.now();
let totalErrors = 0;
for (const g of groups) {
  const result = await downloadGroup(g);
  totalErrors += result.errors.length;
}
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

console.log(`\n✨ Setup complete in ${elapsed}s`);
if (totalErrors > 0) {
  console.error(`\n${totalErrors} files failed. Check your network and re-run with --force to retry.`);
  process.exit(1);
}
console.log(`\nNext: pnpm dev   (or pnpm build)\n`);
