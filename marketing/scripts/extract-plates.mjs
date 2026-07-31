#!/usr/bin/env node

// Extracts the council ink plates the theme pages render.
//
//   cd marketing && node scripts/extract-plates.mjs
//
// Reads the app's plate modules (client/src/components/CosmicCouncil/plates/
// full/<council-id>.ts), which carry each council's whole engraving as a
// base64 AVIF, and writes web-sized copies to public/plates/ plus the CSS that
// points at them. Two plates per theme: the featured debate's own plate, and
// the theme's first other ranked council. The pick is resolved here, once, so
// the pages never recompute it.
//
// Two tiers come out of every plate:
//   band  the 12/5 strip a page wears, cut here from a hand-curated rectangle
//         so the frame lands on a face or a scene instead of a texture wash
//   full  the whole plate at its own proportion, for the lightbox, which
//         fetches it only when a visitor opens one
//
// The masters are grayscale with the marks in the alpha channel. Only alpha is
// read by mask-image, so the RGB is flattened to white on the way out, which
// costs nothing visually and drops the unused chroma bytes. No colour is ever
// baked in: the band paints the theme ink and the plate shapes it.
//
// Writes (all generated, safe to delete and rebuild):
//   public/plates/<council-id>-<width>.avif    band tier
//   public/plates/<council-id>-full.avif       lightbox tier
//   src/styles/plates.css        mask-image per plate, per viewport
//   src/lib/platePicks.json      which plate sits in which slot, and its size

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const MARKETING = join(import.meta.dirname, '..');
const CLIENT = join(MARKETING, '..', 'client');
const PLATES_SRC = join(CLIENT, 'src', 'components', 'CosmicCouncil', 'plates');
const FULL_SRC = join(PLATES_SRC, 'full');
const OUT_IMAGES = join(MARKETING, 'public', 'plates');
const OUT_CSS = join(MARKETING, 'src', 'styles', 'plates.css');
const OUT_PICKS = join(MARKETING, 'src', 'lib', 'platePicks.json');

// A band never renders wider than the reading column, so 1024 is already
// generous on desktop and 640 carries phones. Both stay under the byte cap.
// The phone variant is held tighter than the desktop one: it renders at a
// third of the master's width, so it can lose quality no one will see.
const VARIANTS = [
  { width: 640, cap: 60 * 1024 },
  { width: 1024, cap: 118 * 1024 },
];
const SMALL_BREAKPOINT = 700; // px, the width above which the large variant loads

// The lightbox box is min(92vw, 1100px, …), so 1100 on the long side is the
// most any screen can show. It downloads on first open only, never on load.
const FULL_LONG_EDGE = 1100;
const FULL_CAP = 150 * 1024;

const BAND_RATIO = 12 / 5;

// ── the curation ────────────────────────────────────────────────────────────

// The debate band is bound to the council whose card sits under it, but the
// lead band is free to take any plate in its theme. Two masters have no
// readable band crop in them at all, so the lead steps to one that does.
const LEAD_OVERRIDES = {
  // Hollar's sheet of hand studies is an anatomy exercise: every crop of it
  // reads as texture. Della Bella's mask is a face, which is the question.
  'who-am-i': 'the-mask-that-speaks',
  // A bamboo scroll is two metres of leaves. Rembrandt's beggars at a door
  // put people in the frame, which is what justice is about anyway.
  'freedom-justice': 'the-debt-you-didnt-sign',
  // Dürer's Saint Michael is nearly all wing at band height. The Horsemen
  // from the same series give three riders and three faces instead.
  'meaning-purpose': 'the-calling-that-wont-shut-up',
};

// Plates a page names directly, outside the per-theme picks.
const EXTRA_PLATES = [
  'the-emperor-and-the-fugitive', // the themes hub's opening band, a procession
];

// The band crop, curated per plate against the full master and verified by
// eye: cx/cy is where the 12/5 frame centres, w is how much of the plate's
// width it takes. Cutting it here means the page never crops a mask blind,
// and re-running this script reproduces the same frames.
const DEFAULT_CROP = { cx: 0.5, cy: 0.5, w: 1 };
const BAND_CROP = {
  'the-mask-that-speaks': { cx: 0.5, cy: 0.34, w: 1 },              // brow, eyes, curls
  'the-story-you-keep-telling': { cx: 0.6, cy: 0.36, w: 0.38 },     // the masked faces
  'where-do-you-belong': { cx: 0.5, cy: 0.76, w: 0.9 },             // figures on the steps
  'alone-in-the-room-full-of-people': { cx: 0.46, cy: 0.46, w: 0.72 }, // the platform, the crowd
  'the-calling-that-wont-shut-up': { cx: 0.5, cy: 0.35, w: 0.8 },   // three riders, three faces
  'the-life-you-think-you-want': { cx: 0.42, cy: 0.63, w: 0.78 },   // the onlookers, the heads
  'the-serious-work-of-play': { cx: 0.5, cy: 0.33, w: 0.92 },       // the child, the bubbles
  'the-mind-that-wont-be-quiet': { cx: 0.52, cy: 0.38, w: 0.86 },   // angel, putto, polyhedron
  'the-fear-you-feed': { cx: 0.5, cy: 0.35, w: 0.9 },               // knight, death, devil
  'what-does-your-anger-want': { cx: 0.5, cy: 0.5, w: 0.95 },       // the three faces
  'the-debt-you-didnt-sign': { cx: 0.5, cy: 0.42, w: 0.88 },        // the hand at the door
  'four-freedoms': { cx: 0.46, cy: 0.56, w: 0.9 },                  // the chained men
  'the-god-after-god': { cx: 0.5, cy: 0.4, w: 0.94 },               // volutes and acanthus
  'the-problem-of-evil': { cx: 0.5, cy: 0.345, w: 0.84 },           // Job, his wife, the demon
  'the-meaning-of-pain': { cx: 0.5, cy: 0.35, w: 0.92 },            // the two heads and the skull
  'laughing-at-the-abyss': { cx: 0.5, cy: 0.5, w: 0.94 },           // both dancers, the stage
  'the-emperor-and-the-fugitive': { cx: 0.5, cy: 0.57, w: 0.98 },   // the whole procession
};

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

// Every council's whole engraving, one module per plate. The theme modules
// beside them carry pre-cropped card art, which is the wrong starting point
// here: a curated band needs the uncropped sheet to cut from.
const FULL_ENTRY = /full:\s*'data:image\/avif;base64,([^']+)'/;

const hasFull = councilId => existsSync(join(FULL_SRC, `${councilId}.ts`));

const loadFull = councilId => {
  const found = readFileSync(join(FULL_SRC, `${councilId}.ts`), 'utf8').match(FULL_ENTRY);
  if (!found) throw new Error(`extract-plates: no full master in ${councilId}.ts`);
  return Buffer.from(found[1], 'base64');
};

// ── the picks ───────────────────────────────────────────────────────────────

const themeIds = [...new Set(catalog.map(c => c.theme))].sort();
const picks = {};
for (const themeId of themeIds) {
  const ranked = catalog
    .filter(c => c.theme === themeId)
    .map(c => c.id)
    .sort((a, b) => sequencePos(a) - sequencePos(b))
    .filter(hasFull);
  if (ranked.length === 0) continue;

  const blessed = BLESSED_BY_THEME[themeId];
  // Mirrors the page: the blessed pick holds the featured slot unless its
  // preview clip has been retired, in which case the first ranked council with
  // a live clip takes it.
  const featured =
    blessed && hasFull(blessed) && hasPreview(blessed)
      ? blessed
      : ranked.find(hasPreview) ?? blessed ?? ranked[0];

  // The debate band sits over that council's own card, so it is not free to
  // move. The lead band is, which is where a curated override can land.
  const debate = hasFull(featured) ? featured : ranked[0];
  const override = LEAD_OVERRIDES[themeId];
  const lead =
    (override && hasFull(override) && override !== debate ? override : null) ??
    ranked.find(id => id !== debate) ??
    debate;
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

// The curated rectangle, resolved against the master's real pixels and held
// inside its bounds. A crop that would reach past an edge slides back in
// rather than letterboxing, so the frame always carries marks corner to corner.
const bandRect = (crop, width, height) => {
  let w = Math.min(width, Math.max(16, Math.round(width * crop.w)));
  let h = Math.round(w / BAND_RATIO);
  if (h > height) {
    h = height;
    w = Math.min(width, Math.round(h * BAND_RATIO));
  }
  return {
    left: Math.min(Math.max(0, Math.round(width * crop.cx - w / 2)), width - w),
    top: Math.min(Math.max(0, Math.round(height * crop.cy - h / 2)), height - h),
    width: w,
    height: h,
  };
};

// mask-image reads alpha only, so the colour channels are flattened to white
// on the way out. Costs nothing visually and drops the unused chroma bytes.
const flattenToAlpha = data => {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
  }
  return data;
};

if (existsSync(OUT_IMAGES)) rmSync(OUT_IMAGES, { recursive: true });
mkdirSync(OUT_IMAGES, { recursive: true });
mkdirSync(dirname(OUT_PICKS), { recursive: true });

const manifest = { picks: {}, plates: {} };
const used = [];

const wanted = [
  ...Object.values(picks).flatMap(slots => Object.values(slots)),
  ...EXTRA_PLATES,
];

for (const [themeId, slots] of Object.entries(picks)) manifest.picks[themeId] = slots;

for (const councilId of wanted) {
  if (manifest.plates[councilId]) continue;
  if (!hasFull(councilId)) {
    console.warn(`  ${councilId}: no full master, skipped`);
    continue;
  }
  const source = loadFull(councilId);
  const master = await sharp(source).metadata();
  const crop = BAND_CROP[councilId] ?? DEFAULT_CROP;
  const rect = bandRect(crop, master.width, master.height);
  const variants = {};

  for (const { width, cap } of VARIANTS) {
    const { data, info } = await sharp(source)
      .extract(rect)
      .resize({ width, withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { buffer, quality } = await encode(flattenToAlpha(data), info, cap);
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

  // The lightbox tier: the whole plate, at its own proportion. Nothing on the
  // page references it, so it only travels when someone opens a band.
  const { data, info } = await sharp(source)
    .resize({
      width: master.width >= master.height ? FULL_LONG_EDGE : undefined,
      height: master.height > master.width ? FULL_LONG_EDGE : undefined,
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { buffer, quality } = await encode(flattenToAlpha(data), info, FULL_CAP);
  const fullName = `${councilId}-full.avif`;
  writeFileSync(join(OUT_IMAGES, fullName), buffer);
  console.log(
    `  ${fullName.padEnd(48)} ${String(Math.round(buffer.length / 1024)).padStart(4)} KB  q${quality}`,
  );

  manifest.plates[councilId] = {
    crop,
    variants,
    full: {
      src: `/plates/${fullName}`,
      width: info.width,
      height: info.height,
      bytes: buffer.length,
      quality,
    },
  };
  used.push(councilId);
}

// One variant per media block, and the blocks never overlap: a rule that only
// loses in the cascade still costs a download, so the losing URL is never in
// the stylesheet at all.
const maskBlock = width =>
  used
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
    `   Which plate a band wears. Nothing else: the crop is already cut into\n` +
    `   the file, and the ink colour, the geometry and the tone live in\n` +
    `   ThemePlate.astro, so a palette change never touches this file.\n` +
    `   Phones load the small variant, everything wider the large one.\n` +
    `   The full plate the lightbox shows is named by the page, not here, so\n` +
    `   no stylesheet can make a visitor download one before they ask. */\n` +
    `\n@media (max-width: ${SMALL_BREAKPOINT}px) {\n${maskBlock(VARIANTS[0].width)}\n}\n` +
    `\n@media (min-width: ${SMALL_BREAKPOINT + 1}px) {\n${maskBlock(VARIANTS[VARIANTS.length - 1].width)}\n}\n`,
);

writeFileSync(OUT_PICKS, `${JSON.stringify(manifest, null, 2)}\n`);

const band = Object.values(manifest.plates).flatMap(p =>
  Object.values(p.variants).map(v => v.bytes),
);
const full = Object.values(manifest.plates).map(p => p.full.bytes);
const sum = list => list.reduce((a, b) => a + b, 0);
console.log(
  `\nband: ${band.length} files, ${(sum(band) / 1024 / 1024).toFixed(2)} MB, ` +
    `largest ${Math.round(Math.max(...band) / 1024)} KB\n` +
    `full: ${full.length} files, ${(sum(full) / 1024 / 1024).toFixed(2)} MB, ` +
    `largest ${Math.round(Math.max(...full) / 1024)} KB (fetched on open only)`,
);
