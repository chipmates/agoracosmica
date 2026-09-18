/* THE DISPLAY WINDOW OF A LEAF, measured off the store's own files.
 *
 * Every page of the 1883 edition is held as one scan of the whole printed
 * sheet: a running head, the photolithographic plate of the manuscript leaf
 * in the middle of it, and the editor's type under it. A reader opening a
 * leaf wants the leaf, so the window this pass measures is the plate's own
 * rectangle, and the pan still reaches the printed margin because the sheet
 * is evidence too.
 *
 * The measurement is the tone of the plate's paper against the white of the
 * sheet, read off row and column medians: type is a thin dark stroke on
 * white and leaves the median white, while the plate's ground carries its
 * own tone across the whole of its width. Nothing here is a physical
 * registration: no centimetre of the original is claimed, which is why the
 * record it writes carries physicalRegistration false.
 *
 *   node forge/leaf-windows.mjs            measure and write the record
 *   node forge/leaf-windows.mjs --check    measure and compare, write nothing
 *   node forge/leaf-windows.mjs --crops    write the widest and narrowest
 *                                          window as cropped frames
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { STORE } from './vite-na-assets.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = join(HERE, '..')
const PAGES = join(APP, 'src/wings/vinci/table/data/msb-pages.json')
const OUT = join(APP, 'src/wings/vinci/table/data/leaf-windows.json')
const SHOTS = join(HERE, 'shots/reader-2')

/* The profile is read off a small copy: the plate's edge is a tone, not a
   pixel, and 200 samples across resolve it to half a percent of the sheet. */
const SAMPLE = 200
/* How far under the sheet's own white a sample must sit to be the plate. */
const TONE = 8
/* A run may pass this many samples of white without ending: the plate's own
   ground is broken by the white of an unwritten band. */
const BRIDGE = 3
/* A run shorter than this share of the axis is no plate at all. */
const LEAST = .25
/* ONE EDITION PRINTS ONE PLATE SIZE. The tone of the facsimile's own paper
   carries this measurement, and a few leaves were printed on paper so near
   the sheet's white that the run lands on a band of ink inside the leaf
   rather than on the leaf. Such a reading is recognised by its size: a
   window this much under the edition's own median is refused, and that page
   opens at the whole sheet, which is honest, where a tight window would cut
   the leaf. */
const AGAINST_THE_EDITION = .88
/* The plate's edge is soft, so the window keeps this much of the sheet
   around it rather than cutting into the facsimile's own paper. */
const MARGIN = .004

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[sorted.length >> 1]
}
const quantile = (values, share) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))]
}

/** The longest run of samples under the sheet's white, bridging short
 * breaks, as a pair of fractions of the axis. */
function run(profile) {
  const ground = quantile(profile, .9)
  const limit = ground - TONE
  let best = null, from = -1, gap = 0
  for (let at = 0; at <= profile.length; at++) {
    const inside = at < profile.length && profile[at] <= limit
    if (inside) {
      if (from < 0) from = at
      gap = 0
      continue
    }
    if (from < 0) continue
    if (++gap <= BRIDGE && at < profile.length) continue
    const to = at - gap
    if (!best || to - from > best.to - best.from) best = { from, to }
    from = -1
    gap = 0
  }
  if (!best) return null
  const span = (best.to - best.from + 1) / profile.length
  if (span < LEAST) return null
  return [Math.max(0, best.from / profile.length - MARGIN),
    Math.min(1, (best.to + 1) / profile.length + MARGIN)]
}

async function measure(file) {
  const meta = await sharp(file).metadata()
  const { data, info } = await sharp(file).resize({ width: SAMPLE }).greyscale().raw()
    .toBuffer({ resolveWithObject: true })
  const rows = [], columns = []
  for (let y = 0; y < info.height; y++) {
    const line = []
    for (let x = 0; x < info.width; x++) line.push(data[y * info.width + x])
    rows.push(median(line))
  }
  for (let x = 0; x < info.width; x++) {
    const line = []
    for (let y = 0; y < info.height; y++) line.push(data[y * info.width + x])
    columns.push(median(line))
  }
  const across = run(columns), down = run(rows)
  return {
    width: meta.width, height: meta.height,
    window: across && down ? { left: round(across[0]), top: round(down[0]), right: round(across[1]), bottom: round(down[1]) } : null,
  }
}
const round = (value) => Math.round(value * 1e4) / 1e4

const store = (page) => join(STORE, 'wing-vinci/msb', `${page.file.split('/').pop()}`)
const key = (page) => page.file.split('/').pop().replace(/\.jpg$/, '')

async function main() {
  const check = process.argv.includes('--check')
  const crops = process.argv.includes('--crops')
  const pages = JSON.parse(readFileSync(PAGES, 'utf8')).pages
  const measured = {}
  const refused = [], facsimiles = []
  let plates = 0, missing = 0
  for (const page of pages) {
    const file = store(page)
    if (!existsSync(file)) { missing++; continue }
    const read = await measure(file)
    // Only a facsimile page carries a plate; every other page of the
    // edition is type on paper and is shown whole.
    measured[key(page)] = { width: read.width, height: read.height,
      ...(page.page_kind === 'facsimile' && read.window ? { window: read.window } : {}) }
    if (page.page_kind === 'facsimile') facsimiles.push(key(page))
  }
  // THE EDITION IS ITS OWN REFERENCE: every window is read against the
  // median plate of the 1883 volume, and a short reading is refused.
  const spans = facsimiles.map(id => measured[id].window).filter(Boolean)
  const floor = {
    across: quantile(spans.map(w => w.right - w.left), .5) * AGAINST_THE_EDITION,
    down: quantile(spans.map(w => w.bottom - w.top), .5) * AGAINST_THE_EDITION,
  }
  for (const id of facsimiles) {
    const window = measured[id].window
    if (!window) { refused.push(id); continue }
    if (window.right - window.left >= floor.across && window.bottom - window.top >= floor.down) { plates++; continue }
    delete measured[id].window
    refused.push(id)
  }
  const record = {
    schema_version: 1,
    provenance: 'Measured by forge/leaf-windows.mjs off the store\'s own ms-page files. '
      + 'The window is the photolithographic plate\'s rectangle on the printed sheet, read from the tone of its '
      + 'paper against the sheet\'s white; the pan still reaches the whole sheet.',
    physicalRegistration: false,
    method: `row and column medians at ${SAMPLE} samples across, ${TONE} levels under the sheet\'s own white, `
      + `bridging ${BRIDGE} samples, ${MARGIN} of the axis kept around the plate, `
      + `a reading under ${AGAINST_THE_EDITION} of the edition's median plate refused`,
    pages: measured,
  }
  const text = `${JSON.stringify(record, null, 2)}\n`
  const widths = Object.entries(measured).filter(([, read]) => read.window)
    .map(([id, read]) => ({ id, width: (read.window.right - read.window.left) * read.width,
      height: (read.window.bottom - read.window.top) * read.height }))
    .sort((a, b) => a.width - b.width)
  console.log(`${Object.keys(measured).length} page(s) measured, ${plates} plate window(s), ${refused.length} refused, ${missing} file(s) absent`)
  if (refused.length) console.log(`whole sheet: ${refused.map(id => id.split('__').pop()).join(' ')}`)
  console.log(`narrowest ${widths[0]?.id} ${Math.round(widths[0]?.width)} px`)
  console.log(`widest ${widths.at(-1)?.id} ${Math.round(widths.at(-1)?.width)} px`)
  if (crops) {
    mkdirSync(SHOTS, { recursive: true })
    for (const [name, pick] of [['narrowest', widths[0]], ['widest', widths.at(-1)]]) {
      const read = measured[pick.id], window = read.window
      const page = pages.find(entry => key(entry) === pick.id)
      await sharp(store(page)).extract({
        left: Math.round(window.left * read.width), top: Math.round(window.top * read.height),
        width: Math.round((window.right - window.left) * read.width),
        height: Math.round((window.bottom - window.top) * read.height),
      }).resize({ width: 420 }).png().toFile(join(SHOTS, `window-${name}-${pick.id.split('__').pop()}.png`))
    }
  }
  if (check) {
    const before = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
    console.log(before === text ? 'the record on disk is the measurement' : 'THE RECORD ON DISK DIFFERS')
    process.exit(before === text ? 0 : 1)
  }
  writeFileSync(OUT, text)
  console.log(`written ${OUT}`)
}

await main()
