// THE CLOSE LOOK DRAWS ITS MACHINE. Every machine that stands in the mechanism
// hall is opened on the desktop (1440 by 900) and on the phone (390 by 844),
// the way a visitor opens it: its mark at its own station pressed, or, where
// that station shows no mark for it, the wing's own named walk to it. The
// check fails on any page error and on a stage the machine never reached.
//
//   node forge/closelook-check.mjs [port]            (else FORGE_PORT, else 5199)
//   node forge/closelook-check.mjs 5465 --out=<dir>  (keeps every stage it read)
//   node forge/closelook-check.mjs 5465 --viewports=phone --machines=aerial-screw
//
// It shoots a running server of this checkout and starts none.
//
// WHY IT EXISTS. On the desktop the eye walks to the plinth before the machine
// is lent to its table, so the room draws while the close look is already
// open. A pass of the room that broke only then left every desktop close look
// black, and a walk that never opens one could not see it.
//
// A STAGE IS READ, NOT JUDGED. Only the canvas is shot, the chrome hidden for
// the one shot, and only inside the vitrine's viewport. A pixel is the
// machine's where it stands out of its own neighbourhood: the bench's charcoal
// and its ground are smooth at that scale, a machine's edges, joints and
// shadow are not. Calibrated on the eighteen stages of the fixed hall: a
// machine holds 0.04 to 0.22 of its viewport, the bench's empty corners 0 to
// 0.002, and the black stage the regression left holds 0.
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { APP_ROOT, assertServer, browserArgs, waitForServer, wingStanding } from './rig.mjs'

const args = process.argv.slice(2)
const positional = args.filter((a) => !a.startsWith('--'))
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const PORT = Number(positional[0] ?? process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://localhost:${PORT}`
const OUT = flag('out') ? resolve(flag('out')) : null
const ONLY_VIEWPORTS = flag('viewports')?.split(',') ?? null
const ONLY_MACHINES = flag('machines')?.split(',') ?? null

/** a stage holds its machine when more of the viewport than this stands out */
const MACHINE_SHARE = 0.01
/** how far a pixel's luma stands from its neighbourhood's mean, in 8-bit levels */
const STANDS_OUT = 3
/** the neighbourhood's half width, as a share of the viewport's height */
const NEIGHBOURHOOD = 0.02

const VIEWPORTS = [
  { tag: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
  { tag: 'phone', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
]

const WING_MS = 300_000
/** the hall's photographs may still be arriving; the close look does not wait on them */
const DRESSED_MS = 30_000
const PRESS_MS = 20_000
/** a press that opens nothing in this long was not taken */
const PRESSED_MS = 20_000
/** the rest a station is held at before a press */
const REST_MS = 800
const OPEN_MS = 60_000
const SHUT_MS = 45_000
/** frames the stage is given to draw once the machine stands on its table */
const DRAW_MS = 2_500
/** the whole run's clock: the landing sweep gives a checker 25 minutes */
const RUN_MS = 20 * 60_000

/** THE HALL'S MACHINES, off the two tables that place them: the stands say
    which machines stand on the hall's ground, the approaches which station
    each is walked to from. */
function hallMachines() {
  const stands = readFileSync(join(APP_ROOT, 'src/wings/vinci/collection/stands.ts'), 'utf8')
  const approaches = readFileSync(join(APP_ROOT, 'src/wings/vinci/collection/approaches.ts'), 'utf8')
  const inHall = new Set([...stands.matchAll(/'([a-z-]+)':\s*\{[^}\n]*ground:\s*'hall'/g)].map((m) => m[1]))
  const station = new Map([...approaches.matchAll(/'([a-z-]+)':\s*\{\s*station:\s*'([a-z-]+)'/g)].map((m) => [m[1], m[2]]))
  return [...inHall].map((slug) => ({ slug, station: station.get(slug) ?? null }))
}

const failures = []
const readings = []
const started = Date.now()
const clock = setTimeout(() => {
  failures.push(`the run passed its ${RUN_MS / 60_000} minute clock`)
  finish(1)
}, RUN_MS)

let browser = null
let finished = false
function finish(code) {
  if (finished) return
  finished = true
  clearTimeout(clock)
  const ok = code === 0 && failures.length === 0
  console.log(JSON.stringify({ ok, port: PORT, minutes: Math.round((Date.now() - started) / 6000) / 10, failures, readings }, null, 1))
  const close = browser ? browser.close().catch(() => {}) : Promise.resolve()
  void close.then(() => process.exit(ok ? 0 : 1))
}

/** THE SHARE OF THE VIEWPORT THAT STANDS OUT of its neighbourhood, read on
    luma against a box mean taken off a summed table. */
async function machineShare(png) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const r = Math.max(2, Math.round(h * NEIGHBOURHOOD))
  const sum = new Float64Array((w + 1) * (h + 1))
  const luma = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      luma[y * w + x] = l
      row += l
      sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + row
    }
  }
  let out = 0
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1)
      const box = sum[y1 * (w + 1) + x1] - sum[y0 * (w + 1) + x1] - sum[y1 * (w + 1) + x0] + sum[y0 * (w + 1) + x0]
      if (Math.abs(luma[y * w + x] - box / ((y1 - y0) * (x1 - x0))) > STANDS_OUT) out++
    }
  }
  return out / (w * h)
}

/** At the station and at rest, twice over: the walking mark is written a
    frame after a leg starts, and a press during a leg is not taken. */
async function standAt(page, station) {
  const here = await page.evaluate(() => window.__forge?.state?.().stationId)
  if (here !== station) {
    const took = await page.evaluate((id) => window.__forge.station(id), station)
    if (!took) return false
  }
  const rest = () => page
    .waitForFunction((id) => window.__forge.state().stationId === id && !document.querySelector('#wing[data-walking]'), station, { timeout: OPEN_MS, polling: 250 })
    .then(() => true)
    .catch(() => false)
  if (!(await rest())) return false
  await page.waitForTimeout(REST_MS)
  return rest()
}

const standing = (page, id, ms) => page
  .waitForFunction((want) => document.querySelector('.vitrine-card')?.dataset.exhibit === want
    && document.querySelector('.vitrine')?.dataset.surface === 'own', id, { timeout: ms, polling: 200 })
  .then(() => true)
  .catch(() => false)

/** The visitor's way in, the machine's own mark or its cell in the row, and
    where the station shows neither or the press is not taken, the wing's own
    walk to it by name. Says which way it went in and whether it stands. */
async function open(page, id, station) {
  const find = (want) => [...document.querySelectorAll(`[data-exhibit="${want}"]`)]
    .find((n) => n instanceof HTMLButtonElement && !n.disabled && n.getClientRects().length > 0) ?? null
  const marked = await page
    .waitForFunction(find, id, { timeout: PRESS_MS, polling: 500 })
    .then(() => true)
    .catch(() => false)
  const pressed = marked && (await page.evaluate((want) => {
    const mark = [...document.querySelectorAll(`[data-exhibit="${want}"]`)]
      .find((n) => n instanceof HTMLButtonElement && !n.disabled && n.getClientRects().length > 0)
    mark?.click()
    return Boolean(mark)
  }, id))
  if (pressed && (await standing(page, id, PRESSED_MS))) return { via: 'mark', stood: true }
  await page.evaluate(([at, view]) => window.__forge.jump('wing', { slug: 'vinci', station: at, view }), [station, `walk:${id}`])
  return { via: pressed ? 'named walk, the press not taken' : 'named walk', stood: await standing(page, id, OPEN_MS) }
}

async function look(page, vp, machine, errors) {
  const id = `machine/${machine.slug}`
  const where = `${vp.tag}/${machine.slug}`
  const before = errors.length
  const reading = { viewport: vp.tag, machine: machine.slug, station: machine.station, via: null, share: null, errors: 0 }
  readings.push(reading)
  process.stderr.write(`${where}: opening at ${machine.station}\n`)
  if (!(await standAt(page, machine.station))) {
    failures.push(`${where}: never stood at its station ${machine.station}`)
    return
  }
  const { via, stood } = await open(page, id, machine.station)
  reading.via = via
  if (!stood) failures.push(`${where}: the machine never stood on its table`)
  await page.waitForTimeout(DRAW_MS)
  const rect = await page.evaluate(() => {
    const r = document.querySelector('.vitrine-view')?.getBoundingClientRect()
    return r && r.width > 20 && r.height > 20 ? { x: r.left, y: r.top, width: r.width, height: r.height } : null
  })
  if (!rect) {
    failures.push(`${where}: the vitrine has no viewport to read`)
  } else {
    const png = await page.screenshot({ clip: rect, style: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' })
    reading.share = Math.round((await machineShare(png)) * 10000) / 10000
    if (OUT) {
      await sharp(png).toFile(join(OUT, `${vp.tag}-${machine.slug}-stage.png`))
      await page.screenshot({ path: join(OUT, `${vp.tag}-${machine.slug}.png`) })
    }
    if (reading.share < MACHINE_SHARE) failures.push(`${where}: the stage is empty (${reading.share} of the viewport stands out, the line is ${MACHINE_SHARE})`)
  }
  reading.errors = errors.length - before
  if (reading.errors) failures.push(`${where}: ${reading.errors} page error(s): ${errors.slice(before).map((e) => e.split('\n')[0]).join(' | ')}`)
  await page.keyboard.press('Escape')
  const shut = await page
    .waitForFunction(() => !document.querySelector('.vitrine-card') && !document.querySelector('#wing[data-walking]'), null, { timeout: SHUT_MS, polling: 200 })
    .then(() => true)
    .catch(() => false)
  if (!shut) failures.push(`${where}: the close look never shut`)
  process.stderr.write(`${where}: by ${reading.via}, share ${reading.share}, ${reading.errors} error(s)\n`)
}

async function main() {
  await waitForServer(BASE, 40)
  await assertServer(BASE)
  if (OUT) mkdirSync(OUT, { recursive: true })
  const machines = hallMachines()
  if (machines.length === 0) throw new Error('no machine stands on the hall ground in stands.ts')
  for (const m of machines) if (!m.station) failures.push(`${m.slug}: no station in approaches.ts, so no visitor can walk to it`)
  const walked = machines.filter((m) => m.station && (!ONLY_MACHINES || ONLY_MACHINES.includes(m.slug)))
  const stations = [...new Set(walked.map((m) => m.station))]
  browser = await chromium.launch({ args: browserArgs() })
  for (const vp of VIEWPORTS.filter((v) => !ONLY_VIEWPORTS || ONLY_VIEWPORTS.includes(v.tag))) {
    const { tag, ...shape } = vp
    const ctx = await browser.newContext({ viewport: { width: shape.width, height: shape.height }, deviceScaleFactor: shape.deviceScaleFactor,
      isMobile: shape.isMobile ?? false, hasTouch: shape.hasTouch ?? false })
    await ctx.addInitScript(() => { try { sessionStorage.setItem('vinci-welcome', '1') } catch { /* private mode */ } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack ?? ''}`))
    process.stderr.write(`${tag}: the wing\n`)
    await page.goto(`${BASE}/w/vinci?lang=en&probe=1#s=${stations[0]}`, { waitUntil: 'domcontentloaded' })
    if (!(await wingStanding(page, WING_MS))) {
      failures.push(`${tag}: the wing never stood`)
      await ctx.close()
      continue
    }
    await page
      .waitForFunction(() => (window.__forge?.state?.().texturesPending ?? 1) === 0 && !document.querySelector('#wing[data-walking]'), null, { timeout: DRESSED_MS, polling: 250 })
      .catch(() => {})
    if (errors.length) failures.push(`${tag}: ${errors.length} page error(s) before any close look: ${errors.map((e) => e.split('\n')[0]).join(' | ')}`)
    errors.length = 0
    for (const station of stations) for (const m of walked.filter((w) => w.station === station)) await look(page, vp, m, errors)
    await ctx.close()
  }
}

main().then(() => finish(0), (err) => {
  failures.push(`the check could not run: ${err.message}`)
  finish(1)
})
