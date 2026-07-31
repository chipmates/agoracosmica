#!/usr/bin/env node

// Extracts the council ink plates the theme pages render.
//
//   cd marketing && node scripts/extract-plates.mjs
//
// Reads the app's plate modules (client/src/components/CosmicCouncil/plates/
// <theme>.ts), which carry each council's wide master as a base64 AVIF, and
// writes web-sized copies to public/plates/ plus the CSS that points at them.
// Two plates per theme: the featured debate's own plate, and the theme's
// first other ranked council. The pick is resolved here, once, so the pages
// never recompute it.
//
// The masters are grayscale with the marks in the alpha channel. Only alpha is
// read by mask-image, so the RGB is flattened to white on the way out, which
// costs nothing visually and drops the unused chroma bytes. No colour is ever
// baked in: the band paints the theme ink and the plate shapes it.
//
// Writes (all generated, safe to delete and rebuild):
//   public/plates/<council-id>-<width>.avif
//   src/styles/plates.css        mask-image + mask-position per plate
//   src/lib/platePicks.json      which plate sits in which slot, and its size

import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const MARKETING = join(import.meta.dirname, '..');
const CLIENT = join(MARKETING, '..', 'client');
const PLATES_SRC = join(CLIENT, 'src', 'components', 'CosmicCouncil', 'plates');
const OUT_IMAGES = join(MARKETING, 'public', 'plates');
const OUT_CSS = join(MARKETING, 'src', 'styles', 'plates.css');
const OUT_PICKS = join(MARKETING, 'src', 'lib', 'platePicks.json');

// The masters top out at 1024 wide, so the large variant is a native-size copy
// and the small one carries phones. Both stay under the byte cap.
// The phone variant is held tighter than the desktop one: it renders at a
// third of the master's width, so it can lose quality no one will see.
const VARIANTS = [
  { width: 640, cap: 60 * 1024 },
  { width: 1024, cap: 118 * 1024 },
];
const SMALL_BREAKPOINT = 700; // px, the width above which the large variant loads

// ── the app's data, read as text so this stays a plain node script ──────────

const catalog = JSON.parse(
  readFileSync(join(CLIENT, 'src', 'assets', 'councils', 'councilCatalog.json'), 'utf8'),
);
const catalogTs = readFileSync(join(CLIENT, 'src', 'data', 'councilCatalog.ts'), 'utf8');
const previewsTs = readFileSync(
  join(CLIENT, 'src', 'data', 'public', 'councilPreviews.ts'),
  'utf8',
);

const pluck = (source, pattern) => {
  const found = source.match(pattern);
  if (!found) throw new Error(`extract-plates: could not read ${pattern} from the app source`);
  return found[1];
};

const COUNCIL_SEQUENCE = pluck(catalogTs, /COUNCIL_SEQUENCE: string\[\] = \[([\s\S]*?)\];/)
  .match(/'([^']+)'/g)
  .map(s => s.slice(1, -1));

const BLESSED_BY_THEME = Object.fromEntries(
  [
    ...pluck(catalogTs, /BLESSED_BY_THEME: Record<ThemeId, string> = \{([\s\S]*?)\};/).matchAll(
      /'([^']+)':\s*'([^']+)'/g,
    ),
  ].map(m => [m[1], m[2]]),
);

const PREVIEW_CAST = Object.fromEntries(
  [
    ...pluck(
      previewsTs,
      /PREVIEW_CAST: Record<string, readonly string\[\]> = \{([\s\S]*?)\n\};/,
    ).matchAll(/'([\w-]+)':\s*\[([^\]]+)\]/g),
  ].map(m => [m[1], m[2].match(/'([^']+)'/g).map(s => s.slice(1, -1))]),
);

// A clip only counts while every voice in it is still in the shipped cast,
// same guard the app applies before it offers a preview button.
const hasPreview = councilId => {
  const council = catalog.find(c => c.id === councilId);
  const clip = PREVIEW_CAST[councilId];
  if (!council || !clip) return false;
  const shipped = new Set([council.moderator.id, ...council.participants.map(p => p.id)]);
  return clip.every(figureId => shipped.has(figureId));
};

const sequencePos = id => {
  const i = COUNCIL_SEQUENCE.indexOf(id);
  return i === -1 ? COUNCIL_SEQUENCE.length : i;
};

// ── the plate masters ───────────────────────────────────────────────────────

const PLATE_ENTRY = /'([\w-]+)':\s*\{\s*square:\s*'[^']+',\s*wide:\s*'(data:image\/avif;base64,[^']+)',\s*focal:\s*'([^']+)'/g;

const themes = {};
for (const file of readdirSync(PLATES_SRC).sort()) {
  if (!file.endsWith('.ts') || file === 'index.ts' || file === 'credits.ts') continue;
  const themeId = file.slice(0, -3);
  const text = readFileSync(join(PLATES_SRC, file), 'utf8');
  const plates = {};
  for (const m of text.matchAll(PLATE_ENTRY)) {
    plates[m[1]] = { data: m[2].split(',')[1], focal: m[3] };
  }
  if (Object.keys(plates).length > 0) themes[themeId] = plates;
}

// ── the picks ───────────────────────────────────────────────────────────────

const picks = {};
for (const [themeId, plates] of Object.entries(themes)) {
  const ranked = catalog
    .filter(c => c.theme === themeId)
    .map(c => c.id)
    .sort((a, b) => sequencePos(a) - sequencePos(b))
    .filter(id => plates[id]);
  if (ranked.length === 0) continue;

  const blessed = BLESSED_BY_THEME[themeId];
  // Mirrors the page: the blessed pick holds the featured slot unless its
  // preview clip has been retired, in which case the first ranked council with
  // a live clip takes it.
  const featured =
    blessed && plates[blessed] && hasPreview(blessed)
      ? blessed
      : ranked.find(hasPreview) ?? blessed ?? ranked[0];

  const debate = plates[featured] ? featured : ranked[0];
  const lead = ranked.find(id => id !== debate) ?? debate;
  picks[themeId] = { lead, debate };
}

// ── encode ──────────────────────────────────────────────────────────────────

// Steps quality down until the variant fits the cap, so a dense engraving
// never ships a heavier file than a sparse one.
const QUALITY_LADDER = [50, 44, 38, 32, 26, 20];

async function encode(raw, info, cap) {
  let last = null;
  for (const quality of QUALITY_LADDER) {
    const buffer = await sharp(raw, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .avif({ quality, effort: 6 })
      .toBuffer();
    last = { buffer, quality };
    if (buffer.length <= cap) break;
  }
  return last;
}

if (existsSync(OUT_IMAGES)) rmSync(OUT_IMAGES, { recursive: true });
mkdirSync(OUT_IMAGES, { recursive: true });
mkdirSync(dirname(OUT_PICKS), { recursive: true });

const manifest = { picks: {}, plates: {} };
const cssRules = [];
const used = new Map();

for (const [themeId, slots] of Object.entries(picks)) {
  manifest.picks[themeId] = slots;
  for (const councilId of Object.values(slots)) {
    if (manifest.plates[councilId]) continue;
    const master = themes[themeId][councilId];
    const source = Buffer.from(master.data, 'base64');
    const variants = {};

    for (const { width, cap } of VARIANTS) {
      const { data, info } = await sharp(source)
        .resize({ width, withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
      const { buffer, quality } = await encode(data, info, cap);
      const name = `${councilId}-${width}.avif`;
      writeFileSync(join(OUT_IMAGES, name), buffer);
      variants[width] = {
        src: `/plates/${name}`,
        width: info.width,
        height: info.height,
        bytes: buffer.length,
        quality,
      };
      console.log(
        `  ${name.padEnd(48)} ${String(Math.round(buffer.length / 1024)).padStart(4)} KB  q${quality}`,
      );
    }

    manifest.plates[councilId] = { focal: master.focal, variants };
    used.set(councilId, master.focal);
    cssRules.push(
      `.tq-plate[data-plate='${councilId}'] .tq-plate__ink {\n` +
        `  -webkit-mask-position: ${master.focal};\n` +
        `  mask-position: ${master.focal};\n` +
        `}`,
    );
  }
}

// One variant per media block, and the blocks never overlap: a rule that only
// loses in the cascade still costs a download, so the losing URL is never in
// the stylesheet at all.
const maskBlock = width =>
  [...used.keys()]
    .map(councilId => {
      const src = `/plates/${councilId}-${width}.avif`;
      return (
        `  .tq-plate[data-plate='${councilId}'] .tq-plate__ink {\n` +
        `    -webkit-mask-image: url('${src}');\n` +
        `    mask-image: url('${src}');\n` +
        `  }`
      );
    })
    .join('\n');

writeFileSync(
  OUT_CSS,
  `/* GENERATED by scripts/extract-plates.mjs. Do not edit.\n` +
    `   Which plate a band wears, and where its crop sits. Nothing else: the\n` +
    `   ink colour, the geometry and the tone live in ThemePlate.astro, so a\n` +
    `   palette change never touches this file.\n` +
    `   Phones load the small variant, everything wider the native one. */\n\n` +
    cssRules.join('\n\n') +
    `\n\n@media (max-width: ${SMALL_BREAKPOINT}px) {\n${maskBlock(VARIANTS[0].width)}\n}\n` +
    `\n@media (min-width: ${SMALL_BREAKPOINT + 1}px) {\n${maskBlock(VARIANTS[VARIANTS.length - 1].width)}\n}\n`,
);

writeFileSync(OUT_PICKS, `${JSON.stringify(manifest, null, 2)}\n`);

const total = Object.values(manifest.plates).flatMap(p =>
  Object.values(p.variants).map(v => v.bytes),
);
console.log(
  `\n${total.length} files, ${(total.reduce((a, b) => a + b, 0) / 1024 / 1024).toFixed(2)} MB total, ` +
    `largest ${Math.round(Math.max(...total) / 1024)} KB`,
);
