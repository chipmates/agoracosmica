// THE STILLS — every stop of a wing's walk as a frame-exact picture, with the
// marks that hang on it and the hashes of what made it.
//
//   node forge/prerender/stills.mjs --port=5363
//   node forge/prerender/stills.mjs --port=5363 --order=life
//   node forge/prerender/stills.mjs --port=5363 --order=life --stops=garden,grave
//   node forge/prerender/stills.mjs --port=5363 --proof=3          (determinism)
//
// The stop list is the WING'S OWN (`__forge.state().stationIds`), so the order
// the address asks for is the order this exports; nothing here carries a
// second list of places.
//
// Two framings, each at an AUTHORED aspect. `rail-projection.ts` fits the lens
// so that the authored aspect gives the largest field a pose ever shows and
// every other canvas sits inside it, so a still shot at 390:844 or at 16:9
// contains every glass of that shape and a player crops, never extends.
//
// The walk into every stop runs on the harness clock (see clock.mjs): the near
// shadow cascade carries history, so a leg sampled on the wall clock puts the
// arrival's shadow box somewhere else every run.
//
// THE HAND-OVER. The picture keeps easing for seconds after a leg lands, so a
// still is only the last frame of a clip when it stands the same number of
// frames past the arrival: `--hold=53` here is `capture.mjs --tail=60`, and at
// those two numbers the two programs write the same bytes.
//
// Nothing under src/ is touched. The chrome is hidden by visibility alone, so
// every box the wing fits its composition around keeps its place.
import { chromium } from 'playwright'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import sharp from 'sharp'
import { APP_ROOT, assertServer, browserArgs, FRAME_TIME_FLAGS, headHere, waitForServer, wingStanding } from '../rig.mjs'
import { BARE, CHROME_OFF, installVirtualClock } from './clock.mjs'
import { restingPending } from './pending.mjs'

const argv = process.argv.slice(2)
const flags = new Map()
for (const a of argv) {
  if (!a.startsWith('--')) continue
  const at = a.indexOf('=')
  flags.set(at === -1 ? a.slice(2) : a.slice(2, at), at === -1 ? true : a.slice(at + 1))
}
const flag = (n, d) => flags.get(n) ?? d

const PORT = Number(flag('port', process.env['FORGE_PORT'] ?? 5363))
const BASE = `http://127.0.0.1:${PORT}`
const WING = String(flag('wing', 'vinci'))
/** the walk the address asks for: the rooms as built, or the life */
const ORDER = String(flag('order', 'rooms'))
const TIER = String(flag('tier', 'hero'))
const SAMPLES = String(flag('samples', '4'))
const FPS = Number(flag('fps', 30))
/** frames held at a stop after the leg lands, before the shot */
const HOLD = Number(flag('hold', 60))
const ONLY = String(flag('stops', 'all'))
const WANT = String(flag('framing', 'upright,wide')).split(',').map((s) => s.trim()).filter(Boolean)
const PROOF = Number(flag('proof', 0))
const DELIVER = flag('deliver', 'on') !== 'off'
const MARKS = flag('marks', 'on') !== 'off'
/** the languages the marks are read in; the still itself carries no word */
const LANGS = String(flag('langs', 'en,de')).split(',').map((s) => s.trim()).filter(Boolean)
/** a second shot 30 steps later, to prove the picture has stopped moving */
const SETTLE_PROBE = flag('settle', 'on') !== 'off'
/** the whole walk run once under the harness clock before a frame is kept */
const PREWALK = flag('prewalk', 'on') !== 'off'
/** wait at a stop until the room has stopped being built; off lines the still
    up with a clip's tail frame for frame */
const RESTED = flag('rest', 'on') !== 'off'
const OUT_ROOT = String(flag('out', resolve(APP_ROOT, '..', 'stills')))

/** THE TWO FRAMINGS.
 *  `css` is the stage the still is rendered on and `dsf` the device pixels per
 *  CSS pixel: the app caps its own buffer at the tier's ratio (hero 1.5), so a
 *  device scale of 1.5 shoots the buffer 1 to 1 instead of resampling it.
 *  `marks` is the review frame of the SAME aspect the wing is authored on, and
 *  the marks are read there: a mark's place is the projection, which is a
 *  function of the aspect alone, but its band, its target and its name are
 *  measured in CSS pixels and only the review frame measures them as a visitor
 *  gets them. */
const FRAMINGS = {
  upright: {
    css: { width: 780, height: 1688 },
    dsf: 1.5,
    marks: { width: 390, height: 844 },
    authored: '390:844',
    /** widths delivered, the first of them the lead picture */
    widths: [1170, 780, 585],
  },
  wide: {
    css: { width: 1600, height: 900 },
    dsf: 1.5,
    marks: { width: 1280, height: 720 },
    authored: '1280:720',
    widths: [1600, 1200, 800],
  },
}
/* THE HAND-OVER PROOF NEEDS ONE SHAPE ON BOTH SIDES. `--view=1080x1920 --dsf=1`
   puts a framing on the capture's own stage, so its arrival frame and this
   still can be compared byte for byte. It is not a delivery shape. */
const VIEW = String(flag('view', ''))
if (VIEW) {
  const [w, h] = VIEW.split('x').map(Number)
  for (const f of Object.values(FRAMINGS)) {
    f.css = { width: w, height: h }
    f.marks = { width: w, height: h }
    f.dsf = Number(flag('dsf', 1))
    f.authored = `${w}:${h} (asked for)`
  }
}

/** the search plan's line for a lead picture */
const LEAD_BYTES = 120 * 1024
const WEBP_LADDER = [82, 76, 70, 64, 58]
const AVIF_LADDER = [56, 50, 44, 38]

const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const shaFile = (file) => sha(readFileSync(file))
const round = (n, p = 4) => Math.round(n * 10 ** p) / 10 ** p
const kB = (n) => Math.round(n / 102.4) / 10

/** HOW FAR TWO FRAMES ARE APART. A hash says they are not the same; this says
 *  whether the difference is a moved shadow or a tooth of light. */
async function diffStat(a, b) {
  const A = await sharp(a).raw().toBuffer({ resolveWithObject: true })
  const B = await sharp(b).raw().toBuffer()
  if (A.data.length !== B.length) return null
  let moved = 0
  let sum = 0
  let max = 0
  for (let i = 0; i < A.data.length; i++) {
    const v = Math.abs(A.data[i] - B[i])
    if (!v) continue
    moved++
    sum += v
    if (v > max) max = v
  }
  return {
    share: round((100 * moved) / A.data.length, 4),
    mean: moved ? round(sum / moved, 2) : 0,
    max,
  }
}

/** the camera as a number a diff can read: eye, gaze and lens */
function camPrint(cam) {
  return [...cam.p.map((v) => round(v)), ...cam.r.map((v) => round(v)), round(cam.fov)].join(',')
}

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: APP_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

/** THE STORY'S OWN SENTENCE FOR WHAT A STOP MUST SHOW. The file is generated
 *  and stands alone, so it is read here the way its own checker reads it. */
function loadStory() {
  const file = join(APP_ROOT, 'src/wings/vinci/story.ts')
  if (!existsSync(file)) return { stops: [], sha256: '' }
  const source = readFileSync(file, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require: (id) => {
      throw new Error(`the story file must stand alone, it imports ${id}`)
    },
  })
  return { stops: module.exports.vinciStory ?? [], sha256: sha(source) }
}

/** WHAT MADE THIS PICTURE, as hashes a later run can compare.
 *  The certificate carries the mounted geometry's own fingerprint; the source
 *  tree turns every other scene edit red; the wing's manifest covers what is
 *  dressed onto it. */
function provenance() {
  const certFile = join(APP_ROOT, 'src/wings/vinci/data/rail-clearance.json')
  const manifestFile = join(APP_ROOT, 'assets/wing-vinci/manifest.json')
  const cert = existsSync(certFile) ? JSON.parse(readFileSync(certFile, 'utf8')) : {}
  return {
    head: headHere(),
    srcTree: git('rev-parse', 'HEAD:./src'),
    dirty: git('status', '--porcelain', '--', 'src', 'assets') !== '',
    certificateSha256: existsSync(certFile) ? shaFile(certFile) : '',
    certificateFormat: cert.format ?? '',
    geometrySha256: cert.geometrySha256 ?? '',
    recipeSha256: cert.recipeSha256 ?? '',
    wingManifestSha256: existsSync(manifestFile) ? shaFile(manifestFile) : '',
  }
}

/** WHAT THE WING IS SHOWING, read off its own frame.
 *  Runs in the page. Every box comes from the live DOM at the settled pose:
 *  the marks are placed by the wing's own projection, and a box measured here
 *  is the box the wing drew. */
function readTheFrame() {
  const W = innerWidth
  const H = innerHeight
  const painted = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    if (r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) return false
    let node = el
    while (node) {
      if (node.hidden) return false
      const cs = getComputedStyle(node)
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) <= 0.02) return false
      node = node.parentElement
    }
    return true
  }
  const box = (el) => {
    const r = el.getBoundingClientRect()
    return { left: r.left / W, top: r.top / H, right: r.right / W, bottom: r.bottom / H }
  }
  const CONTROLS = 'a[href], button, [role="button"], input, select, textarea, summary'
  const target = (el) => {
    const hit = el.matches(CONTROLS) ? el : el.closest(CONTROLS)
    if (!hit) return null
    const r = hit.getBoundingClientRect()
    return Math.round(Math.min(r.width, r.height))
  }
  const kindOf = (el) => {
    if (el.classList.contains('vinci-exhibit-dot')) return 'exhibit'
    if (el.classList.contains('vinci-dot')) return 'station'
    if (el.classList.contains('mark')) return 'place'
    return 'claim'
  }
  const marks = []
  const seen = new Set()
  for (const el of document.querySelectorAll('.vinci-dot, .hotspot.mark, [data-na-claim]')) {
    if (seen.has(el) || !painted(el)) continue
    seen.add(el)
    const anchor = el.getAttribute('data-na-anchor')
    const label = el.getAttribute('aria-label') ?? (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    marks.push({
      id: anchor ?? label,
      idSource: anchor ? 'data-na-anchor' : 'aria-label',
      kind: kindOf(el),
      label,
      certainty: el.getAttribute('data-na-claim'),
      certaintyColour: el.style.getPropertyValue('--certainty').trim() || null,
      anchorClass: el.getAttribute('data-na-anchor-class'),
      opens: el.getAttribute('aria-controls'),
      targetPx: target(el),
      box: box(el),
    })
  }
  /** every panel of the wing's own chrome that is standing: what the words
      already cover on the live frame */
  const panels = []
  for (const sel of ['.vinci-heading', '.wing-rail-group', '.vinci-strip', '.vinci-dock', '.vinci-exhibit-card', '.vinci-cut']) {
    for (const el of document.querySelectorAll(sel)) {
      if (!painted(el)) continue
      panels.push({ selector: sel, box: box(el) })
    }
  }
  return {
    viewport: { width: W, height: H },
    aspect: W / H,
    stationId: window.__forge.state().stationId,
    cut: document.querySelector('[data-cut]') !== null,
    marks,
    panels,
    labels: window.__forge.labels(),
  }
}

/** NO GLYPH IN THE FRAME, PROVED FROM THE DOM.
 *  Runs in the page at the moment of the shot. The chrome is struck by
 *  visibility, so every element the browser is still painting is counted: one
 *  canvas and nothing else is a frame no word of the interface can be in. */
function chromeProof() {
  const painted = []
  for (const el of document.body.querySelectorAll('*')) {
    if (el.tagName === 'CANVAS') continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    painted.push(`${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''}`.slice(0, 60))
  }
  return {
    painted: painted.length,
    what: painted.slice(0, 8),
    checked: document.body.querySelectorAll('*').length,
    method: 'computed visibility over every element of the page, the canvas apart',
  }
}

/** THE BAND THE WORDS MUST LEAVE ALONE: from the top of the highest mark to
 *  the foot of the lowest, in the still's own coordinates. Above it and below
 *  it are the two bands a player may write in. */
function freeBand(marks) {
  if (!marks.length) return null
  const top = Math.min(...marks.map((m) => m.box.top))
  const bottom = Math.max(...marks.map((m) => m.box.bottom))
  return {
    top: round(Math.max(0, top), 5),
    bottom: round(Math.min(1, bottom), 5),
    wordsAbove: round(Math.max(0, top), 5),
    wordsBelow: round(Math.max(0, 1 - bottom), 5),
  }
}

/** THE CROPS A PLAYER MAY TAKE, as the fraction of the still each one keeps.
 *  A glass narrower than the authored aspect keeps the whole height and loses
 *  width; a wider one keeps the whole width and loses height. */
const CROPS = {
  upright: [
    { name: 'narrowest', aspect: 9 / 21, why: 'a 9:21 phone' },
    { name: 'widest', aspect: 0.62, why: 'a short stage with the browser bar in' },
  ],
  wide: [
    { name: 'narrowest', aspect: 1512 / 950, why: 'the desktop window the design is walked on' },
    { name: 'widest', aspect: 21 / 9, why: 'an ultrawide window' },
  ],
}
function cropBox(masterAspect, aspect) {
  if (aspect <= masterAspect) {
    const width = aspect / masterAspect
    return { left: (1 - width) / 2, top: 0, right: 1 - (1 - width) / 2, bottom: 1 }
  }
  const height = masterAspect / aspect
  return { left: 0, top: (1 - height) / 2, right: 1, bottom: 1 - (1 - height) / 2 }
}

/** ONE STOP, WALKED INTO UNDER THE HARNESS CLOCK.
 *  A leg is over when the wing has stopped saying it is walking, the chapter
 *  card has gone and the camera has been still for a few frames: a stop on a
 *  wall is reached in TWO legs, and a chapter boundary is crossed on a card
 *  and not walked at all. */
async function walkTo(page, id, hold, rested = true) {
  return page.evaluate(
    async ([to, holdFor, waitForTheRoom]) => {
      const cost = () => {
        const st = window.__forge.state()
        return `${st.draws}/${st.tris}/${st.texturesPending}`
      }
      const print = () => {
        const c = window.__forge.state().cam
        return [...c.p, ...c.r, c.fov].map((v) => Math.round(v * 1e4) / 1e4).join(',')
      }
      const took = window.__forge.station(to)
      await new Promise((r) => setTimeout(r, 300))
      let began = false
      let still = 0
      let last = print()
      let steps = 0
      for (; steps < 4000; steps++) {
        window.__pre.step()
        await window.__pre.raw()
        const walking = document.querySelector('[data-walking]') !== null
        const crossing = document.querySelector('[data-cut]') !== null
        if (walking) began = true
        const now = print()
        still = now === last && !walking && !crossing ? still + 1 : 0
        last = now
        if (still >= 8 && steps >= 12) break
      }
      const costAtTheEndOfTheLeg = cost()
      for (let i = 0; i < holdFor; i++) {
        window.__pre.step()
        await window.__pre.raw()
      }
      /* AND THE ROOM IS NOT ALWAYS FINISHED WHEN THE LEG IS. The dressing of a
         room is built in slices, so one stop has been measured at 86 and at 93
         draws in two runs. When the cost of a frame changed while the still was
         holding, the room is still being built and the shot waits for it. The
         frames it waits are recorded: at zero the still stands exactly `hold`
         frames past the arrival, which is what a hand-over with a clip's tail
         depends on. */
      let rest = 0
      let grew = cost() !== costAtTheEndOfTheLeg
      if (waitForTheRoom && grew) {
        let stable = 0
        let last = cost()
        while (rest < 900) {
          for (let i = 0; i < 5; i++) {
            window.__pre.step()
            await window.__pre.raw()
          }
          rest += 5
          const now = cost()
          stable = now === last ? stable + 1 : 0
          last = now
          if (stable >= 3) break
        }
      }
      return { took, steps, walked: began, rest, grew }
    },
    [id, hold, rested]
  )
}

/** A BRAKING WALK STOPS DAMAGING THE SURFACE, and a compositor that sees no
 *  damage commits no frame, so the shot waits for a frame that never comes.
 *  The retry paints a layer the canvas covers. */
async function shoot(page, file) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await page.screenshot({ path: file, type: 'png', animations: 'allow', caret: 'initial', timeout: 20000 })
    } catch (err) {
      if (attempt >= 3) throw err
      await page.evaluate((n) => {
        document.body.style.backgroundColor = n % 2 ? '#000000' : '#000001'
      }, attempt)
      await page.evaluate(() => window.__pre.raw())
    }
  }
}

/** the stage a still is shot on, with the film held and the chrome struck */
async function openStage(browser, view, dsf, url) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: dsf })
  await ctx.addInitScript((f) => {
    try {
      sessionStorage.setItem(f, '1')
    } catch {
      /* a refused store already counts as seen */
    }
  }, `${WING}-welcome`)
  await ctx.addInitScript(installVirtualClock)
  const page = await ctx.newPage()
  const errors = []
  const aborted = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
  page.on('requestfailed', (r) => aborted.push(`${r.failure()?.errorText} ${r.url().replace(BASE, '')}`))
  page.on('response', (r) => {
    if (r.status() >= 400) aborted.push(`${r.status()} ${r.url().replace(BASE, '')}`)
  })
  await page.goto(url, { waitUntil: 'load' })
  if (!(await wingStanding(page))) throw new Error('the wing never stood')
  const pending = await restingPending(page)
  const said = await page.evaluate(() => ({ backend: document.body.dataset.backend, tier: document.body.dataset.tier }))
  if (said.backend !== 'webgpu') throw new Error(`backend ${said.backend}, not webgpu`)
  return { ctx, page, errors, aborted, said, pending }
}

const address = (from, lang) =>
  `${BASE}/w/${WING}?probe=1&tier=${TIER}&samples=${SAMPLES}${ORDER === 'life' ? '&order=life' : ''}${lang ? `&lang=${lang}` : ''}#s=${from}`

/** THE STOPS THIS RUN EXPORTS, out of the list the wing itself carries. */
function resolveStops(all, want, limit) {
  const asked = want === 'all' ? all : want.split(',').map((s) => s.trim()).filter(Boolean)
  const missing = asked.filter((s) => !all.includes(s))
  if (missing.length) throw new Error(`the wing has no such stop: ${missing.join(', ')}`)
  return limit ? asked.slice(0, limit) : asked
}

/** THE ROOM AHEAD STREAMS ITS PLATES THE FIRST TIME IT IS STOOD IN. Every stop
 *  is stood at once before a single frame is kept, and stood by CUTTING: the
 *  wing places the eye instantly while the page carries the rig's own marker,
 *  so the warm pass costs no walking. The marker is taken off afterwards or
 *  every leg of the export would be cut too. */
async function warmEveryStop(page, stops) {
  await page.evaluate(() => {
    document.body.dataset['forge'] = 'pending'
  })
  for (const id of stops) {
    await page.evaluate((s) => window.__forge.station(s), id)
    await page.waitForFunction(
      (s) => window.__forge.state().stationId === s && !document.querySelector('[data-walking]'),
      id,
      { timeout: 180000 }
    )
    await restingPending(page)
  }
  /* back at the head of the walk, so the first still is the stop a visitor
     enters on and every later one is a leg walked into it */
  await page.evaluate((s) => window.__forge.station(s), stops[0])
  await restingPending(page)
  await page.evaluate(() => {
    delete document.body.dataset['forge']
  })
}

/** THE PICTURES OF ONE FRAMING. Returns one record per stop, and the stop
 *  list it read off the wing itself. */
async function shootFraming(browser, name, dir, want, limit) {
  const f = FRAMINGS[name]
  mkdirSync(dir, { recursive: true })
  if (SETTLE_PROBE) mkdirSync(join(dir, 'probe'), { recursive: true })
  /* `#s=0` is the legacy station zero, not the head of the walk: the list is
     read off the wing and the warm pass ends at its first stop */
  const { ctx, page, errors, aborted } = await openStage(browser, f.css, f.dsf, address(0))
  const stops = resolveStops(await page.evaluate(() => window.__forge.state().stationIds), want, limit)
  /* every request the page makes after the clock is taken is counted: a frame
     that waited for a file is not a frame of the walk */
  let armed = false
  const late = []
  const thumbs = []
  page.on('request', (r) => {
    if (!armed) return
    /* THE ROW'S THUMBNAILS ARE NOT A FRAME OF THE WALK. The hang registers a
       128 px thumbnail per work as an object URL once its plate is ready:
       those are pictures for the chrome, which is struck, and they touch no
       pixel of the canvas. A file over the wire after the clock was taken
       would be another matter and is counted apart. */
    const url = r.url()
    if (url.startsWith('blob:')) thumbs.push(url)
    else late.push(url.replace(BASE, ''))
  })
  const ratio = await page.evaluate(() => devicePixelRatio)
  await warmEveryStop(page, stops)
  await page.waitForTimeout(3000)
  await page.evaluate(() => window.__forge.grain(false))
  await page.addStyleTag({ content: CHROME_OFF })
  await page.evaluate((c) => document.documentElement.classList.add(c), BARE)
  await page.waitForTimeout(600)
  await page.evaluate((fps) => window.__pre.arm(fps), FPS)
  armed = true
  /* one animation frame is always in flight when the gate closes; the loop
     re-books through the gate on the next real refresh */
  await page.waitForFunction(() => window.__pre.queued() > 0, null, { timeout: 10000 })
  /* THE WALK IS RUN ONCE WITHOUT KEEPING A FRAME. The warm pass places the eye
     on the wall clock, and the near shadow cascade carries that history into
     the first legs; walking the whole list under the harness clock first makes
     the history a function of this clock alone, which is what two runs share. */
  if (PREWALK) for (const id of [...stops, stops[0]]) await walkTo(page, id, 8)
  const shots = []
  for (const id of stops) {
    const leg = await walkTo(page, id, HOLD, RESTED)
    await page.evaluate(() => window.__pre.raw())
    const file = join(dir, `${id}.png`)
    const buf = await shoot(page, file)
    const state = await page.evaluate(() => {
      const st = window.__forge.state()
      return { cam: st.cam, draws: st.draws, tris: st.tris, pending: st.texturesPending, stationId: st.stationId }
    })
    const chrome = await page.evaluate(chromeProof)
    let settled = null
    if (SETTLE_PROBE) {
      await page.evaluate(async () => {
        for (let i = 0; i < 30; i++) {
          window.__pre.step()
          await window.__pre.raw()
        }
      })
      const file2 = join(dir, 'probe', `${id}.settle.png`)
      const later = await shoot(page, file2)
      /* WHAT A SECOND OF THE WORLD COSTS THE PICTURE. The film is held, so a
         difference here is the place itself: water, leaves, a flame, a shadow
         still creeping. It is a reading, not a fault. */
      settled = { same: sha(later) === sha(buf), stepsLater: 30, ...(await diffStat(file, file2)) }
    }
    shots.push({
      id,
      file,
      framing: name,
      bytes: buf.length,
      sha256: sha(buf),
      pixels: { width: Math.round(f.css.width * f.dsf), height: Math.round(f.css.height * f.dsf) },
      cam: camPrint(state.cam),
      fov: round(state.cam.fov),
      draws: state.draws,
      triangles: state.tris,
      texturesPending: state.pending,
      chromeProof: chrome,
      walked: leg.walked,
      legSteps: leg.steps,
      restSteps: leg.rest,
      settled,
    })
    console.error(
      `   ${name} ${id}: ${kB(buf.length)} kB, draws ${state.draws}, ${state.tris} triangles` +
        (settled ? `, a second later ${settled.share}% of bytes move, mean ${settled.mean}, max ${settled.max}` : '')
    )
  }
  const queued = await page.evaluate(() => window.__pre.queued())
  const starved = await page.evaluate(() => window.__pre.starved())
  await ctx.close()
  return { shots, stops, errors, aborted, late, thumbs, starved, queued, ratio }
}

/** THE MARKS OF ONE FRAMING, at the review frame of the same aspect, in one
 *  language. German is the worst case: a longer name takes a wider box, and a
 *  name that finds no clear air is hushed, so the SET of marks can differ. */
async function readMarks(browser, name, stops, lang) {
  const f = FRAMINGS[name]
  const { ctx, page, errors } = await openStage(browser, f.marks, 1, address(stops[0], lang))
  await warmEveryStop(page, stops)
  await page.waitForTimeout(2000)
  await page.evaluate((fps) => window.__pre.arm(fps), FPS)
  await page.waitForFunction(() => window.__pre.queued() > 0, null, { timeout: 10000 })
  const out = new Map()
  for (const id of stops) {
    await walkTo(page, id, HOLD)
    /* the marks place themselves on the wing's own frames, but their ink
       transitions on the compositor's clock, which this harness does not own */
    await page.waitForTimeout(400)
    await page.evaluate(() => window.__pre.raw())
    const frame = await page.evaluate(readTheFrame)
    const cam = await page.evaluate(() => window.__forge.state().cam)
    out.set(id, { ...frame, cam: camPrint(cam), fov: round(cam.fov) })
  }
  await ctx.close()
  return { marks: out, errors }
}

/** WHAT ONE PICTURE COSTS ON THE WIRE. The lead width is held under the search
 *  plan's line by stepping the quality down, and the step taken is recorded. */
async function deliver(master, dir, id, widths, masterHeight, masterWidth) {
  mkdirSync(dir, { recursive: true })
  const made = []
  for (const width of widths) {
    const height = Math.round((masterHeight / masterWidth) * width)
    const lead = width === widths[0]
    const raw = sharp(master).resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    for (const [fmt, ladder] of [['webp', WEBP_LADDER], ['avif', AVIF_LADDER]]) {
      /* AVIF is paid for at the lead width alone: it is the one a page puts
         first, and the encoder costs seconds a picture */
      if (fmt === 'avif' && !lead) continue
      let picked = null
      for (const quality of ladder) {
        const buf =
          fmt === 'webp'
            ? await raw.clone().webp({ quality, effort: 6 }).toBuffer()
            : await raw.clone().avif({ quality, effort: 3 }).toBuffer()
        picked = { quality, buf }
        if (!lead || buf.length <= LEAD_BYTES) break
      }
      const file = join(dir, `${id}-${width}.${fmt}`)
      writeFileSync(file, picked.buf)
      made.push({
        file,
        format: fmt,
        width,
        height,
        quality: picked.quality,
        bytes: picked.buf.length,
        lead,
        overLine: lead && picked.buf.length > LEAD_BYTES,
        sha256: sha(picked.buf),
      })
    }
  }
  return made
}

// ---------------------------------------------------------------- the run
const serveOff = flag('serve') === 'off'
/* the loopback address by name, not by host name: this vite binds `localhost`
   to the v6 address alone and every rig here fetches the v4 one */
const server = serveOff
  ? null
  : spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', cwd: APP_ROOT })
if (server) console.error(`preview pid ${server.pid} on ${BASE}`)
try {
  await waitForServer(`${BASE}/`)
  const said = await assertServer(BASE)
  console.error(`server ${said.head.slice(0, 7)} on ${BASE}`)
  const story = loadStory()
  const made = provenance()
  const browser = await chromium.launch({ args: [...browserArgs(), ...FRAME_TIME_FLAGS] })
  const run = {
    wing: WING,
    order: ORDER,
    tier: TIER,
    samples: Number(SAMPLES),
    fps: FPS,
    hold: HOLD,
    prewalk: PREWALK,
    marksRead: MARKS ? LANGS : [],
    grain: 'held',
    chrome: 'off',
    made,
    storySha256: story.sha256,
    framings: {},
    startedAt: new Date().toISOString(),
  }
  try {
    if (PROOF) {
      /* TWO FRESH CONTEXTS, THE SAME STILLS. Bit identity is read with the
         film held; the film reseeds per rendered frame by design. */
      const name = WANT[0]
      const a = await shootFraming(browser, name, join(OUT_ROOT, `proof-${name}-a`), ONLY, PROOF)
      const b = await shootFraming(browser, name, join(OUT_ROOT, `proof-${name}-b`), ONLY, PROOF)
      let same = 0
      let sameCam = 0
      const differ = []
      for (let i = 0; i < a.shots.length; i++) {
        if (a.shots[i].sha256 === b.shots[i].sha256) same++
        else differ.push(a.shots[i].id)
        if (a.shots[i].cam === b.shots[i].cam) sameCam++
      }
      console.log(`\n== determinism, ${name}, ${a.shots.length} stops, film held ==`)
      console.log(`   identical stills   ${same} / ${a.shots.length}`)
      console.log(`   identical camera   ${sameCam} / ${a.shots.length}`)
      console.log(`   stills that differ ${differ.length ? differ.join(', ') : 'none'}`)
      console.log(`   files after the clock was taken: a ${a.late.length}, b ${b.late.length} (row thumbnails apart: ${a.thumbs.length}, ${b.thumbs.length})`)
      console.log(`   starved steps: a ${a.starved}, b ${b.starved} · page errors: a ${a.errors.length}, b ${b.errors.length}`)
      console.log(`   a second of the world later, still the same frame: ${a.shots.filter((s) => s.settled?.same).length} / ${a.shots.length}`)
      writeFileSync(
        join(OUT_ROOT, `proof-${name}.json`),
        JSON.stringify({ same, sameCam, differ, a: a.shots, b: b.shots, late: { a: a.late, b: b.late } }, null, 1)
      )
      if (same !== a.shots.length) process.exitCode = 1
    } else {
      for (const name of WANT) {
        const f = FRAMINGS[name]
        if (!f) throw new Error(`no framing ${name}: ${Object.keys(FRAMINGS).join(' or ')}`)
        const dir = join(OUT_ROOT, ORDER, name)
        const shot = await shootFraming(browser, name, dir, ONLY, 0)
        const stops = shot.stops
        run.stops = stops
        console.error(`${stops.length} stops in the ${ORDER} order: ${stops.join(', ')}`)
        const read = MARKS ? await readMarks(browser, name, stops, 'en') : { marks: new Map(), errors: [] }
        const readDe = MARKS && LANGS.includes('de') ? await readMarks(browser, name, stops, 'de') : { marks: new Map(), errors: [] }
        const master = { width: Math.round(f.css.width * f.dsf), height: Math.round(f.css.height * f.dsf) }
        const files = []
        for (const s of shot.shots) {
          const frame = read.marks.get(s.id) ?? null
          const german = readDe.marks.get(s.id) ?? null
          const told = story.stops.find((t) => t.id === s.id) ?? null
          const band = frame ? freeBand(frame.marks) : null
          const crops = CROPS[name].map((c) => ({ ...c, keeps: cropBox(master.width / master.height, c.aspect) }))
          if (MARKS) {
            writeFileSync(
              join(dir, `${s.id}.marks.json`),
              JSON.stringify(
                {
                  stop: s.id,
                  framing: name,
                  order: ORDER,
                  still: `${s.id}.png`,
                  stillPixels: master,
                  readAt: frame?.viewport ?? null,
                  /* the still and the marks stand on one projection or the
                     boxes do not belong to this picture */
                  sameProjection: frame ? frame.cam === s.cam : false,
                  cam: s.cam,
                  fov: s.fov,
                  sees: told ? { text: told.sees, certainty: told.certainty, source: 'src/wings/vinci/story.ts' } : null,
                  seesBox: null,
                  seesBoxWhy: 'the wing computes no box for the object its story names; see the ask in the STATUS',
                  marks: frame?.marks ?? [],
                  panels: frame?.panels ?? [],
                  freeBand: band,
                  crops,
                  labels: frame?.labels ?? [],
                  /* the same reading in German, which is the worst case for
                     every box a word sits in */
                  de: german
                    ? { marks: german.marks, panels: german.panels, freeBand: freeBand(german.marks), sameProjection: german.cam === s.cam }
                    : null,
                },
                null,
                1
              )
            )
          }
          const delivered = DELIVER ? await deliver(s.file, join(dir, 'delivery'), s.id, f.widths, master.height, master.width) : []
          const sidecar = {
            stop: s.id,
            framing: name,
            order: ORDER,
            authoredAspect: f.authored,
            master: { file: `${s.id}.png`, ...master, bytes: s.bytes, sha256: s.sha256 },
            delivery: delivered.map((d) => ({ ...d, file: `delivery/${d.file.split('/').pop()}` })),
            scene: made,
            picture: {
              tier: TIER,
              samples: Number(SAMPLES),
              pixelRatio: shot.ratio,
              grain: 'held',
              chrome: 'off',
              draws: s.draws,
              triangles: s.triangles,
              texturesPending: s.texturesPending,
              chromeProof: s.chromeProof,
              cam: s.cam,
              fov: s.fov,
            },
            rig: {
              tool: 'forge/prerender/stills.mjs',
              toolSha256: shaFile(new URL(import.meta.url).pathname),
              clockSha256: shaFile(join(APP_ROOT, 'forge/prerender/clock.mjs')),
              fps: FPS,
              hold: HOLD,
              settleProbe: s.settled,
              walked: s.walked,
              legSteps: s.legSteps,
              /* frames the shot waited for the room to stop being built; at
                 zero the still is exactly `hold` frames past the arrival */
              restSteps: s.restSteps,
              viewport: f.css,
              deviceScaleFactor: f.dsf,
            },
            /* the codec versions belong to the record: the same quality dial
               on another libvips is another file */
            encoder: { library: 'sharp', versions: sharp.versions, webpEffort: 6, avifEffort: 3, leadByteLine: LEAD_BYTES },
            madeAt: new Date().toISOString(),
          }
          writeFileSync(join(dir, `${s.id}.sidecar.json`), JSON.stringify(sidecar, null, 1))
          files.push({ ...s, delivered, marks: frame?.marks.length ?? 0, freeBand: band })
        }
        run.framings[name] = {
          master,
          authored: f.authored,
          viewport: f.css,
          deviceScaleFactor: f.dsf,
          marksReadAt: f.marks,
          pixelRatio: shot.ratio,
          requestsAfterTheClock: shot.late.length,
          thumbnailBlobsAfterTheClock: shot.thumbs.length,
          abortedRequests: shot.aborted,
          starvedSteps: shot.starved,
          pageErrors: shot.errors.concat(read.errors),
          stills: files.map((s) => ({
            id: s.id,
            sha256: s.sha256,
            bytes: s.bytes,
            draws: s.draws,
            triangles: s.triangles,
            marks: s.marks,
            aSecondLater: s.settled,
            freeBand: s.freeBand,
            delivery: s.delivered.map((d) => ({ format: d.format, width: d.width, quality: d.quality, bytes: d.bytes, overLine: d.overLine })),
          })),
        }
        const totalPng = files.reduce((a, s) => a + s.bytes, 0)
        const lead = files.flatMap((s) => s.delivered.filter((d) => d.lead))
        console.log(`\n== ${name} ${master.width}x${master.height} (${f.authored}), ${files.length} stops ==`)
        console.log(`   masters ${kB(totalPng)} kB in ${dir}`)
        for (const s of files) {
          const line = s.delivered.map((d) => `${d.format} ${d.width} ${kB(d.bytes)} kB q${d.quality}`).join(' · ')
          console.log(`   ${s.id.padEnd(20)} ${kB(s.bytes).toString().padStart(7)} kB png · ${s.marks} marks · ${line}`)
        }
        const over = lead.filter((d) => d.overLine)
        console.log(`   lead pictures over the ${LEAD_BYTES / 1024} kB line: ${over.length ? over.map((d) => d.file.split('/').pop()).join(', ') : 'none'}`)
      }
      mkdirSync(join(OUT_ROOT, ORDER), { recursive: true })
      run.endedAt = new Date().toISOString()
      writeFileSync(join(OUT_ROOT, ORDER, 'stills.json'), JSON.stringify(run, null, 1))
      console.log(`\n   the run: ${join(OUT_ROOT, ORDER, 'stills.json')}`)
    }
  } finally {
    await browser.close()
  }
} finally {
  server?.kill('SIGTERM')
}
