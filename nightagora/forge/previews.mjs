// THE EXHIBIT PREVIEWS — one picture for every strip cell that has none.
//
// The hang strip draws a thumbnail where an exhibit's record carries one. A
// machine, the plaque, the grave's two stones and the book carry no
// reproduction of their own, so their cells stand blank. This renders each of
// them from the museum's own room, in the museum's own light, and writes the
// frame into the asset store with a record of its own.
//
// Usage:
//   node forge/previews.mjs [--only=<id>,<id>] [--port=5375] [--write]
//                           [--tier=hero] [--serve=off] [--sheet]
//
//   --only    render these exhibit ids alone (machine/lathe, grave, ...)
//   --write   write the store's files and manifest records; without it the
//             run only writes its frames under forge/shots/previews/
//   --sheet   build the contact sheet from what the store already holds
//   --serve=off  a dev server is already standing on the port
//
// A machine is shot on its own turntable at the whole view, the pose the
// vitrine opens it in; the plaque, the grave's two and the book are shot
// where they stand, through the window the vitrine cuts around the work.
// The run is deterministic: reduced motion holds every clock at rest, the
// night's own clock is frozen, and the same pose gives the same bytes.

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { APP_ROOT, assertServer, browserArgs, waitForServer, wingStanding } from './rig.mjs'
import { STORE } from './vite-na-assets.mjs'

const flags = new Map(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const at = a.indexOf('=')
  return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
}))
const flag = (name, fallback) => flags.get(name) ?? fallback

const PORT = Number(flag('port', process.env['FORGE_PORT'] ?? 5375))
const BASE = `http://127.0.0.1:${PORT}`
const TIER = String(flag('tier', 'hero'))
const WRITE = Boolean(flags.get('write'))
const SHOTS = new URL('./shots/previews/', import.meta.url).pathname
const SCOPE = 'wing-vinci'
const OUT_DIR = join(STORE, SCOPE, 'previews')
const MANIFEST = join(STORE, SCOPE, 'manifest.json')

/** The cell takes a small upright picture, the size the sheet thumbs are. */
const CELL = { width: 208, height: 320 }
/* THE WINDOW IS CHOSEN FOR THE SHAPE OF THE VITRINE'S OWN VIEWPORT, not for a
   reader: the wide stage puts the card beside the work, and this width and
   height leave the work's rectangle at about the cell's proportion. Below
   0.9 the stage turns narrow and lays the viewport out as a phone. */
const WINDOW = { width: 1120, height: 1230, scale: 2 }
/** The night is held at one moment so two runs draw the same frame. */
const CLOCK = 12.4
/** Long enough for the walk to the plinth and the body to be lent. */
const SETTLE_MS = 2600, STILL_TRIES = 14

const LICENCE = 'Generated for this work, regenerable from its script; a frame of the museum\'s own procedural model.'
const MODEL = 'Night Agora renderer, headless; forge/previews.mjs'
const DATE = '2026-09-20'

/** Every exhibit the strip can show whose record carries no picture. The
 *  dates carry their own year in the cell, so they are not blank and are not
 *  here; the compass has no ledge yet and stands in no station's row.
 *
 *  `plate` cuts the cell from a reproduction the store already holds, which
 *  is what an exhibit that IS a picture asks for; `where: 'station'` shoots
 *  the room from the station itself, for an exhibit the visitor is already
 *  standing on and walks to no closer. */
const EXHIBITS = [
  { id: 'machine/parachute', kind: 'machine', station: 'supper-wall' },
  { id: 'machine/revolving-crane', kind: 'machine', station: 'supper-wall' },
  { id: 'machine/anemometer', kind: 'machine', station: 'supper-wall' },
  { id: 'machine/inclinometer', kind: 'machine', station: 'supper-wall' },
  { id: 'plaque/flight-quote', kind: 'place', station: 'supper-wall' },
  { id: 'machine/aerial-screw', kind: 'machine', station: 'flight' },
  { id: 'machine/miter-lock-gates', kind: 'machine', station: 'flight' },
  { id: 'machine/camera-obscura', kind: 'machine', station: 'flight' },
  { id: 'machine/flywheel', kind: 'machine', station: 'flight' },
  { id: 'machine/multi-barrel-gun', kind: 'machine', station: 'works' },
  { id: 'machine/ball-bearing', kind: 'machine', station: 'works' },
  { id: 'machine/rolling-mill', kind: 'machine', station: 'works' },
  { id: 'machine/lathe', kind: 'machine', station: 'works' },
  { id: 'machine/water-lifting-screw', kind: 'machine', station: 'works' },
  // The house's one piece of the collection, on the hall's own ledge.
  { id: 'machine/proportional-compass', kind: 'machine', station: 'hall' },
  { id: 'grave', kind: 'place', station: 'grave' },
  { id: 'grave-diagram', kind: 'place', station: 'grave' },
  { id: 'codex/paris-B', kind: 'manuscript', station: 'reading-table' },
  // The painting at the grave: the cell is the reproduction the room hangs,
  // cut small, not a photograph of the wall it hangs on.
  { id: 'picture/deathbed-painting/front', kind: 'picture', station: 'grave',
    plate: 'vinci/place-plate/jean-auguste-dominique-ingres-francois-ier-recoit-les-derniers-soupirs'
      + '__petit-palais-musee-des-beaux-arts-de-la-ville-de-paris__4096x3252' },
  // The line of dates IS the station: it carries no approach of its own, so
  // its cell is the room from the eye the station stands at. The window is
  // the run of the line itself, read off the frame: the whole view puts a
  // ceiling and a far wall in a cell that has 72 px to say one thing.
  { id: 'line/floor', kind: 'stud', station: 'line-early', where: 'station',
    window: { left: .335, top: .228, width: .402, height: .563 } },
]

const only = flags.get('only') ? String(flags.get('only')).split(',') : null
const wanted = only ? EXHIBITS.filter(e => only.includes(e.id)) : EXHIBITS

/** The file is named by the exhibit, under the folder of its kind: a machine
 *  whose id already says machine does not say it twice. */
const nameOf = e => (e.id.startsWith(`${e.kind}/`) ? e.id.slice(e.kind.length + 1) : e.id).replace(/\//g, '-')
const fileOf = e => `${nameOf(e)}.webp`
const pathOf = e => `previews/${e.kind}/${fileOf(e)}`
const recordId = e => `vinci/exhibit-preview/${e.kind}/${nameOf(e)}`

/* ------------------------------------------------------------ the frame */

/** The rectangle the picture is cut from, in CSS pixels. A machine stands on
 *  its turntable inside the vitrine's viewport, whose foot the caption and
 *  the row take; a place is held in the room, and the vitrine cuts the
 *  window over the work itself. */
async function frameRect(page, kind) {
  return page.evaluate(k => {
    const view = document.querySelector('.vitrine-view')
    if (!view) return null
    const r = view.getBoundingClientRect()
    if (k === 'machine') {
      // The caption and the payload's row take the viewport's foot: the same
      // 118 px the turntable leaves out when it fits the machine.
      return { left: r.left, top: r.top, width: r.width, height: Math.max(80, r.height - 118), from: 'viewport' }
    }
    // A PLACE IS SHOT WHERE IT STANDS. The eye walked the certified leg to it,
    // which frames the object in the whole window and not in the vitrine's own
    // rectangle: the picture is the window, cut to the cell's proportion.
    return { left: 0, top: 0, width: innerWidth, height: innerHeight, from: 'window' }
  }, kind)
}

/** THE PICTURE IS THE MACHINE, not the air around it. The turntable fits a
 *  body into a viewport that is wider than the cell, so a frame of the whole
 *  viewport puts a 40 px cell's worth of machine in the middle of a field of
 *  ground. The body's own extent is read off the frame: the ground is a
 *  smooth gradient, so a row's median IS the ground of that row, and what
 *  stands away from it is the body and its shadow.
 *  Returns the box in the frame's own pixels, already at the cell's
 *  proportion, with air around the body. */
async function contentBox(png, threshold = 18) {
  const scan = 400
  const { data, info } = await sharp(png).greyscale().resize(scan, null).raw().toBuffer({ resolveWithObject: true })
  const w = info.width, h = info.height
  const median = values => { const sorted = Float64Array.from(values).sort(); return sorted[sorted.length >> 1] }
  // The ground is a vertical gradient under a vignette. It is measured at the
  // frame's own border, where the turntable's centred body does not reach: a
  // body that covers more than half of a row would otherwise BE that row's
  // middle, and the ground either side of it would read as the body.
  const edgeX = Math.max(8, Math.round(w * .15)), edgeY = Math.max(8, Math.round(h * .15))
  const rows = new Float64Array(h), columns = new Float64Array(w)
  const side = new Float64Array(edgeX * 2)
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < edgeX; i++) { side[i] = data[y * w + i]; side[edgeX + i] = data[y * w + (w - 1 - i)] }
    rows[y] = median(side)
  }
  const band = new Float64Array(edgeY * 2)
  for (let x = 0; x < w; x++) {
    for (let i = 0; i < edgeY; i++) {
      band[i] = data[i * w + x] - rows[i]
      band[edgeY + i] = data[(h - 1 - i) * w + x] - rows[h - 1 - i]
    }
    columns[x] = median(band)
  }
  const marked = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (Math.abs(data[y * w + x] - rows[y] - columns[x]) > threshold) marked[y * w + x] = 1
  // A body is a run of marked pixels, never a scatter of grain.
  const leastInRow = Math.max(4, Math.round(w * .012)), leastInColumn = Math.max(4, Math.round(h * .012))
  let left = w, right = -1, top = h, bottom = -1
  for (let y = 0; y < h; y++) {
    let count = 0
    for (let x = 0; x < w; x++) count += marked[y * w + x]
    if (count < leastInRow) continue
    top = Math.min(top, y); bottom = Math.max(bottom, y)
  }
  for (let x = 0; x < w; x++) {
    let count = 0
    for (let y = 0; y < h; y++) count += marked[y * w + x]
    if (count < leastInColumn) continue
    left = Math.min(left, x); right = Math.max(right, x)
  }
  if (right < 0 || bottom < 0) return null
  const meta = await sharp(png).metadata()
  const scale = meta.width / w
  return { left: left * scale, top: top * scale, width: (right - left + 1) * scale, height: (bottom - top + 1) * scale,
    share: ((right - left + 1) * (bottom - top + 1)) / (w * h), frame: { width: meta.width, height: meta.height },
    mask: { data: marked, width: w, height: h } }
}

/** The mask the body was read off, written beside the frame when a cut is
 *  doubted: white is what stood away from the ground. */
async function maskFile(box, file) {
  await sharp(Buffer.from(box.mask.data.map(v => v * 255)), { raw: { width: box.mask.width, height: box.mask.height, channels: 1 } })
    .png().toFile(file)
}

/** THE CELL'S OWN PROPORTION, cut inside a rectangle: the wider side gives
 *  way, so a picture of a window is the middle of that window and never the
 *  whole of it letterboxed down to a stripe. */
function atCellProportion(rect, window) {
  const want = CELL.width / CELL.height
  let width = rect.width, height = rect.height
  if (width / height > want) width = height * want
  else height = width / want
  const x = Math.max(0, Math.min(window.width - width, rect.left + rect.width / 2 - width / 2))
  const y = Math.max(0, Math.min(window.height - height, rect.top + rect.height / 2 - height / 2))
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
}

/** The body's box, given air and the cell's proportion, inside its frame. */
function boxForCell(box, air = .1) {
  const want = CELL.width / CELL.height
  const frame = box.frame
  let width = box.width * (1 + air), height = box.height * (1 + air)
  if (width / height > want) height = width / want
  else width = height * want
  const scale = Math.min(1, frame.width / width, frame.height / height)
  width *= scale; height *= scale
  const centreX = box.left + box.width / 2, centreY = box.top + box.height / 2
  const left = Math.max(0, Math.min(frame.width - width, centreX - width / 2))
  const top = Math.max(0, Math.min(frame.height - height, centreY - height / 2))
  return { left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) }
}

/** Two frames the same is a frame that has stopped moving. A frame that is
 *  one colour is a frame of nothing, and the run says so rather than writing
 *  it. Returns the still bytes, or null. */
async function stillFrame(page, clip) {
  let last = null
  for (let i = 0; i < STILL_TRIES; i++) {
    const shot = await page.screenshot({ clip, animations: 'disabled' })
    if (last && Buffer.compare(last, shot) === 0) return shot
    last = shot
    await page.waitForTimeout(350)
  }
  return last
}

/** What the frame holds: the spread of its own luminance. A black or a flat
 *  frame is a failure of the pose or of the light, not a picture. */
async function spread(png) {
  const { data, info } = await sharp(png).greyscale().resize(64, 64, { fit: 'fill' })
    .raw().toBuffer({ resolveWithObject: true })
  let sum = 0
  for (const v of data) sum += v
  const mean = sum / data.length
  let variance = 0
  for (const v of data) variance += (v - mean) ** 2
  return { mean: Math.round(mean), deviation: Math.round(Math.sqrt(variance / data.length)), pixels: info.width * info.height }
}

/** The ground the frame stands on, read off its own corners, so a picture
 *  narrower than the cell is padded with the room's own colour. */
async function groundColour(png) {
  const { data } = await sharp(png).resize(8, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })
  const corners = [0, 7, 56, 63].map(i => data.subarray(i * 3, i * 3 + 3))
  const mix = [0, 1, 2].map(c => Math.round(corners.reduce((sum, p) => sum + p[c], 0) / corners.length))
  return { r: mix[0], g: mix[1], b: mix[2] }
}

async function toCell(png, background) {
  return sharp(png)
    .resize(CELL.width, CELL.height, { fit: 'contain', background, kernel: 'lanczos3' })
    .webp({ quality: 88, effort: 6 })
    .toBuffer()
}

/* ------------------------------------------------------- the museum's own */

async function standAt(page, station, still) {
  await page.goto(`${BASE}/w/vinci?probe=1&tier=${TIER}#s=${station}`)
  await page.waitForFunction(() => Boolean(window.__forge), null, { timeout: 60000 })
  // A MACHINE'S CLOCK IS HELD AT REST so two runs draw one frame; a place is
  // reached by a walk the room draws in real seconds, and a held clock would
  // never let the eye arrive. The still frame below is what proves a place.
  if (still) await page.evaluate(t => window.__forge.freeze(t), CLOCK)
  const stood = await wingStanding(page)
  if (!stood) throw new Error(`the wing never stood at ${station}`)
  await page.waitForFunction(id => {
    const here = document.querySelector('.wing-step[aria-current="true"]')
    return here?.dataset.station === id && !document.querySelector('.wing-step[data-target="true"]')
  }, station, { timeout: 120000, polling: 250 })
  await page.waitForFunction(() => (window.__forge?.state?.().texturesPending ?? 1) === 0, null, { timeout: 120000, polling: 300 })
}

/** The visitor's own way in: the cell of the strip. Where the row does not
 *  hold the exhibit, the eyes' own route opens it by name. */
async function openExhibit(page, exhibit) {
  /* THE CELL OF THE STRIP IS THE WAY IN, for a machine and for a place alike:
     pressed, the room walks its certified leg and the eye stands where the
     approach puts it. The eyes' own route is the fallback for an exhibit
     whose station shows no row (a row of one is not drawn). */
  const cell = page.locator(`.vinci-strip-item[data-exhibit="${exhibit.id}"]`)
  let way = await cell.click({ timeout: 20000 }).then(() => 'cell').catch(() => 'named')
  if (way === 'named') await page.evaluate(([station, view]) => window.__forge.jump('wing', { slug: 'vinci', station, view }),
    [exhibit.station, `walk:${exhibit.id}`])
  await waiting(page, `${exhibit.id}: the vitrine never opened`, () => {
    const view = document.querySelector('.vitrine-view')
    return Boolean(view) && view.getBoundingClientRect().width > 100
  }, 60000)
  await waiting(page, `${exhibit.id}: the library never finished`, () => (window.__forge?.state?.().texturesPending ?? 1) === 0, 120000)
  await waiting(page, `${exhibit.id}: the eye never stood`, () => !document.querySelector('.wing-step[data-target="true"]'), 120000)
  await page.waitForTimeout(SETTLE_MS)
  return way
}

/** The station's own eye, standing: nothing is opened and nothing is walked
 *  to, so the wait is the library's and then the room's own settle. */
async function settleAt(page) {
  await waiting(page, 'the library never finished', () => (window.__forge?.state?.().texturesPending ?? 1) === 0, 120000)
  await page.waitForTimeout(SETTLE_MS)
  return 'stand'
}

/** One wait, one sentence when it fails: a timeout with no name costs a run. */
async function waiting(page, said, predicate, ms) {
  await page.waitForFunction(predicate, null, { timeout: ms, polling: 250 })
    .catch(() => { throw new Error(said) })
}

/** The vitrine's words are put out of the frame for the shot alone: held on
 *  the page, they take the presses the run needs. */
async function hideChrome(page, hidden) {
  await page.evaluate(([css, on]) => {
    let style = document.querySelector('style[data-preview-hide]')
    if (!style) {
      style = document.createElement('style')
      style.dataset['previewHide'] = ''
      document.head.append(style)
    }
    style.textContent = on ? css : ''
  }, [HIDE_CHROME, hidden])
}

async function closeExhibit(page) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)
}

/** The vitrine's own words and controls are not the picture: they are put out
 *  of the frame for the shot and nothing else. */
const HIDE_CHROME = `.vitrine-card,.vitrine-caption,.vitrine-payload-controls,.vitrine-controls,
  [class*='vitrine-folio'],.vitrine-aside,.vitrine-sheet,.vitrine-leader,.vitrine-scrim,.vitrine-hole,
  .vinci-strip,.wing-rail-group,.wing-question,.field-stage,.wing-labels h1,
  .vinci-heading,.vinci-quiet,.vinci-exhibit-dot,.wing-doorblock,
  [data-na-persistent],[data-na-brand]{opacity:0 !important;pointer-events:none !important}`

/* ------------------------------------------------------------ the record */

function loadManifest() {
  const raw = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  return Array.isArray(raw) ? raw : raw.assets
}

/** THE CELL OF AN EXHIBIT THAT IS A PICTURE: the plate itself, whole and
 *  small. No crop, so the rights note the source carries still describes what
 *  the cell shows. Returns the bytes and the size they were written at. */
async function cutPlate(exhibit) {
  const source = loadManifest().find(entry => entry.id === exhibit.plate)
  if (!source) throw new Error(`${exhibit.id}: the store has no ${exhibit.plate}`)
  const file = join(STORE, SCOPE, source.path)
  if (!existsSync(file)) throw new Error(`${exhibit.id}: ${source.path} is recorded and not in the store`)
  const webp = await sharp(file).resize(CELL.width, CELL.height, { fit: 'inside', kernel: 'lanczos3' })
    .webp({ quality: 88, effort: 6 }).toBuffer()
  const meta = await sharp(webp).metadata()
  return { webp, source, width: meta.width, height: meta.height }
}

function recordForPlate(exhibit, cut, bytes, sha) {
  const { source } = cut
  return {
    id: recordId(exhibit),
    path: pathOf(exhibit),
    wing: SCOPE,
    class: source.class,
    licence: source.licence,
    holder: source.holder,
    display: true,
    date: DATE,
    // NO source_url ON A DERIVED FILE: the app reads that field as where the
    // bytes stand, and these bytes stand in the store. The plate's own record
    // carries the origin, and `source` names it.
    note: `The hang strip's cell for ${exhibit.id}: ${source.id} fitted inside `
      + `${CELL.width}x${CELL.height}, whole, no crop, by forge/previews.mjs. `
      + `Origin of the source plate: ${source.source_url ?? 'named in its own record'}.`,
    source: source.id,
    role: 'exhibit-preview',
    sha256: sha,
    bytes,
    width: cut.width,
    height: cut.height,
    station: exhibit.station,
  }
}

function recordFor(exhibit, bytes, sha) {
  return {
    id: recordId(exhibit),
    path: pathOf(exhibit),
    wing: SCOPE,
    class: 'GENERATED',
    licence: LICENCE,
    display: true,
    model: MODEL,
    date: DATE,
    prompt: `One frame of the museum's own ${exhibit.kind === 'machine' ? 'model of ' : ''}${exhibit.id}, `
      + `rendered headless from ${exhibit.where === 'station' ? 'the eye its own station stands at'
        : 'the pose the vitrine opens it in'}, at ${CELL.width}x${CELL.height}, `
      + 'for the hang strip\'s cell. No photograph sampled.',
    source: exhibit.id,
    role: 'exhibit-preview',
    sha256: sha,
    bytes,
    width: CELL.width,
    height: CELL.height,
    station: exhibit.station,
  }
}

function writeRecords(records) {
  const raw = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const list = Array.isArray(raw) ? raw : raw.assets
  for (const record of records) {
    const at = list.findIndex(entry => entry.id === record.id)
    if (at < 0) list.push(record)
    else list[at] = record
  }
  writeFileSync(MANIFEST, JSON.stringify(Array.isArray(raw) ? list : raw, null, 2) + '\n')
}

/* ------------------------------------------------------- the contact sheet */

async function contactSheet(entries) {
  // The sheet is read twice: at the size the file is, and at the size the
  // cell actually draws it, which is the only size that matters.
  const columns = 6, pad = 12, cell = 44
  const rows = Math.ceil(entries.length / columns)
  const width = columns * (CELL.width + pad) + pad
  const height = rows * (CELL.height + pad + 26) + pad + cell + 3 * pad
  const layers = []
  for (const [at, entry] of entries.entries()) {
    const column = at % columns, row = Math.floor(at / columns)
    const left = pad + column * (CELL.width + pad), top = pad + row * (CELL.height + pad + 26)
    layers.push({ input: entry.file, left, top })
    layers.push({
      input: Buffer.from(`<svg width="${CELL.width}" height="24"><text x="0" y="17" font-family="monospace" font-size="13" fill="#e8e0d0">${entry.id}</text></svg>`),
      left, top: top + CELL.height + 2,
    })
  }
  // the row of cells at 44 px, the way the strip draws them
  const strip = pad + rows * (CELL.height + pad + 26)
  for (const [at, entry] of entries.entries()) {
    const small = await sharp(entry.file).resize(cell - 4, cell - 4, { fit: 'inside' }).png().toBuffer()
    layers.push({ input: small, left: pad + at * (cell + 6), top: strip + pad })
  }
  const out = join(SHOTS, 'contact-sheet.png')
  await sharp({ create: { width, height, channels: 3, background: { r: 24, g: 26, b: 30 } } })
    .composite(layers).png().toFile(out)
  console.log(`contact sheet: ${out}`)
}

/* ---------------------------------------------------------------- the run */

mkdirSync(SHOTS, { recursive: true })
if (flags.get('sheet')) {
  await contactSheet(wanted.map(e => ({ id: e.id, file: join(OUT_DIR, e.kind, fileOf(e)) })).filter(e => existsSync(e.file)))
  process.exit(0)
}

/* A CELL CUT FROM A PLATE NEEDS NO ROOM: no server, no browser, no walk. */
const cuts = wanted.filter(exhibit => exhibit.plate)
const shots = wanted.filter(exhibit => !exhibit.plate)
const written = [], problems = []
for (const exhibit of cuts) {
  try {
    const cut = await cutPlate(exhibit)
    const sha = createHash('sha256').update(cut.webp).digest('hex')
    const file = WRITE ? join(OUT_DIR, exhibit.kind, fileOf(exhibit)) : join(SHOTS, fileOf(exhibit))
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, cut.webp)
    written.push({ exhibit, bytes: cut.webp.length, sha, file, record: recordForPlate(exhibit, cut, cut.webp.length, sha) })
    console.log(`${exhibit.id.padEnd(28)} cut   plate     ${cut.width}x${cut.height}  ${cut.webp.length} bytes`)
  } catch (error) {
    problems.push(`${exhibit.id}: ${error.message}`)
  }
}

const server = !shots.length || flag('serve', 'on') === 'off' ? null
  : spawn('pnpm', ['exec', 'vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', cwd: APP_ROOT })
let browser
try {
  if (shots.length) {
  await waitForServer(`${BASE}/`)
  const said = await assertServer(BASE)
  console.log(`server ${said.head.slice(0, 7)} at ${said.root}`)
  browser = await chromium.launch({ args: browserArgs() })
  /* ONE BROWSER, ONE PAGE AT A TIME. The machines are shot with every clock
     held at rest, which is what makes a turntable frame repeatable; the
     places are reached by a walk the room draws, so their pass runs with
     motion and is proved by the frame standing still instead. */
  const openPage = async still => {
    const context = await browser.newContext({
      viewport: { width: WINDOW.width, height: WINDOW.height },
      deviceScaleFactor: WINDOW.scale,
      ...(still ? { reducedMotion: 'reduce' } : {}),
    })
    const page = await context.newPage()
    page.on('pageerror', e => problems.push(`pageerror: ${e.message}`))
    page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`) })
    // The rig must not lie: Vite's client reloads on any save and the frame
    // would be of the entry card with no error raised.
    await page.route('**/@vite/client', route =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: 'export {}' }))
    return { context, page }
  }

  let here = '', still = null, context, page
  for (const exhibit of [...shots].sort((a, b) => Number(a.kind !== 'machine') - Number(b.kind !== 'machine'))) {
    const wantStill = exhibit.kind === 'machine'
    if (wantStill !== still) {
      await context?.close()
      still = wantStill
      here = ''
      ;({ context, page } = await openPage(still))
    }
    if (exhibit.station !== here) {
      here = exhibit.station
      await standAt(page, here, still)
    }
    // AN EXHIBIT THE VISITOR IS ALREADY STANDING ON opens nothing: the room
    // from the station's own eye IS the picture, and a settle stands in for
    // the walk the others take.
    const way = exhibit.where === 'station' ? await settleAt(page) : await openExhibit(page, exhibit)
    const rect = exhibit.where === 'station'
      ? { left: (exhibit.window?.left ?? 0) * WINDOW.width, top: (exhibit.window?.top ?? 0) * WINDOW.height,
        width: (exhibit.window?.width ?? 1) * WINDOW.width, height: (exhibit.window?.height ?? 1) * WINDOW.height,
        from: exhibit.window ? 'run' : 'window' }
      : await frameRect(page, exhibit.kind)
    if (!rect) { problems.push(`${exhibit.id}: no viewport`); await closeExhibit(page); continue }
    const clip = exhibit.kind === 'machine'
      ? { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }
      : atCellProportion(rect, WINDOW)
    await hideChrome(page, true)
    const frame = await stillFrame(page, clip)
    await hideChrome(page, false)
    // A MACHINE IS CUT TO ITS OWN BODY: the turntable fits it into a viewport
    // wider than the cell, and the cell would take the air with it.
    const box = exhibit.kind === 'machine' ? await contentBox(frame) : null
    const cut = box ? boxForCell(box) : null
    const png = cut ? await sharp(frame).extract({ left: cut.left, top: cut.top, width: cut.width, height: cut.height }).png().toBuffer() : frame
    const name = exhibit.id.replace(/\//g, '-')
    writeFileSync(join(SHOTS, `${name}-frame.png`), frame)
    if (box) await maskFile(box, join(SHOTS, `${name}-mask.png`))
    writeFileSync(join(SHOTS, `${name}.png`), png)
    const read = await spread(png)
    const background = await groundColour(png)
    const webp = await toCell(png, background)
    console.log(`${exhibit.id.padEnd(28)} ${way.padEnd(5)} ${rect.from.padEnd(9)} ${clip.width}x${clip.height}`
      + ` cut ${cut ? `${cut.width}x${cut.height}` : 'whole'}`
      + `  mean ${String(read.mean).padStart(3)} spread ${String(read.deviation).padStart(3)}  ${webp.length} bytes`)
    if (read.deviation < 6) problems.push(`${exhibit.id}: the frame is flat (spread ${read.deviation}): the pose, the light or the body`)
    if (exhibit.kind === 'machine' && !box) problems.push(`${exhibit.id}: no body stood out of the ground`)
    if (WRITE) {
      const file = join(OUT_DIR, exhibit.kind, fileOf(exhibit))
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, webp)
      written.push({ exhibit, bytes: webp.length, sha: createHash('sha256').update(webp).digest('hex'), file })
    } else {
      writeFileSync(join(SHOTS, fileOf(exhibit)), webp)
      written.push({ exhibit, bytes: webp.length, sha: '', file: join(SHOTS, fileOf(exhibit)) })
    }
    if (exhibit.where !== 'station') await closeExhibit(page)
  }
  await context?.close()
  }
  if (WRITE) {
    writeRecords(written.map(w => w.record ?? recordFor(w.exhibit, w.bytes, w.sha)))
    console.log(`${written.length} records written to ${MANIFEST}`)
  }
  await contactSheet(written.map(w => ({ id: w.exhibit.id, file: w.file })))
} catch (error) {
  console.error(`REFUSED: ${error.message}`)
  process.exitCode = 1
} finally {
  await browser?.close()
  server?.kill('SIGTERM')
}
if (problems.length) {
  console.log('PROBLEMS:')
  for (const p of [...new Set(problems)]) console.log(' ·', p)
  process.exitCode = 1
}
