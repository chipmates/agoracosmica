// THE STABILITY AUDIT. Why a picture flickers, by machine, over a whole
// wing, so that no flicker needs a screenshot from the owner again.
//
//   node forge/stability-audit.mjs <port> <wing> [options]
//   node forge/stability-audit.mjs 5341 vinci --stations line-early,grave
//   node forge/stability-audit.mjs 5341 vinci --all --legs 3 --json
//
// WHAT IT DOES. At a pose it holds the world still (an even clock with the
// step taken to zero: the museum keeps drawing, its own time does not move)
// and renders the SAME pose several times with the camera moved by a known
// FRACTION of a pixel, through the projection's own view offset. Beside each
// of those frames it takes two buffers the picture alone cannot give:
//
//   id      one integer per pixel, the mesh that won the depth test
//   depth   that pixel's distance from the eye, in metres, linear
//
// Then, per tile:
//
//   CLASS 1  DEPTH FIGHTING  the id alternates between two bodies whose
//            depths at that pixel are the same to within what the depth
//            buffer resolves there. Both bodies are named.
//   CLASS 2  GEOMETRIC ALIASING  the id alternates, and the two depths are
//            far apart: a silhouette or a feature thinner than the pixel.
//            The feature's projected thickness is measured in pixels.
//   CLASS 3  SHADING  the id holds and the shaded picture does not. The
//            material of the body that holds is named.
//   CLASS 4  TEMPORAL  what moves with the camera NOT moving at all, once
//            the world's own clock is let run. Read with `--time`.
//
// THE CONTROL EVERY POSE CARRIES. Two of the frames are taken at exactly the
// same offset. Whatever those two disagree about is the machine and the
// clock, never the sub-pixel grid, and a tile only counts when its shifted
// reading beats its own control.
//
// WHAT IT CANNOT SEE. A defect that needs the eye to MOVE (parallax between
// two bodies, a shadow map refocusing on a walking frame) is not a sub-pixel
// shift and is not in this reading: the walking eye is forge/flicker-walk.mjs
// and the two instruments answer different questions. It also cannot see a
// body that never wins a pixel: a hair-thin rail that is missing from every
// one of the shifted frames reads as clean here and as a hole in the picture
// to a visitor.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { APP_ROOT, assertAdapter, assertBackend, assertServer, browserArgs, headHere, waitForServer, wingStanding } from './rig.mjs'

const argv = process.argv.slice(2)
const plain = argv.filter((a) => !a.startsWith('--'))
const flag = (name) => argv.includes(`--${name}`)
const value = (name, fallback = null) => {
  const at = argv.indexOf(`--${name}`)
  return at >= 0 && argv[at + 1] && !argv[at + 1].startsWith('--') ? argv[at + 1] : fallback
}
const PORT = Number(plain[0] ?? 5341)
const SLUG = plain[1] ?? 'vinci'
const BASE = `http://localhost:${PORT}`
const JSON_OUT = flag('json')
const out = JSON_OUT ? (line) => process.stderr.write(`${line}\n`) : (line) => console.log(line)

const MOBILE = (value('vp', 'desktop') ?? 'desktop') === 'mobile'
const TIER = value('tier', MOBILE ? 'calm' : 'hero')
const DEPTH = value('depth', '')
const SAMPLES = value('samples', '')
const PR = value('pr', '')
const DPR = Number(value('dpr', '')) || 0
const OUT_NAME = value('out', 'stability')
const OUT = join(APP_ROOT, 'forge', 'shots', OUT_NAME)
const LEG_POSES = Number(value('legs', '0')) || 0
/** virtual frames between two stops on a leg */
const LEG_STRIDE = Number(value('stride', '40')) || 40
const STATIONS = value('stations', '')
/** read only the first n of whatever station list this run resolves to */
const FIRST = Number(value('first', '0')) || 0
const ALL = flag('all')
const TIME_READ = flag('time')
const KEEP_MAPS = !flag('no-maps')
const SERVE = !flag('no-serve')
const LOUD = flag('loud')
const SHOT = flag('shot')
/** how many times the whole station sweep is read, for the spread */
const RUNS = Number(value('runs', '1')) || 1
/** write the baseline this run measures, which is the only way it changes */
const WRITE_BASE = flag('write-base')
/** read the baseline and refuse a head that is worse than it */
const VERIFY = flag('verify')
/* FOUR STATIONS A GATE, AND EVERY STATION WITHIN FOUR GATES. Reading sixteen
   stations at the visitor's ratio costs minutes that no gate can spend on
   every landing, and reading the same four for ever leaves twelve unwatched.
   The window rotates by the HEAD's own hash, so the choice is a fact about
   the commit and not about the hour it ran. */
const ROTATE = Number(value('rotate', '0')) || 0
/** frames held at one offset before it is read */
const SETTLE = Number(value('settle', '4')) || 4
/* FRAMES HELD AT A STATION BEFORE THE WORLD IS FROZEN. Ninety was a guess
   and it is not enough: the near shadow cascade snaps on its own rule and a
   set that arrives late redresses a surface. Three hundred is five seconds
   of the wing's own time with the eye standing still. */
const SETTLE_FRAMES = Number(value('hold', '300')) || 300
/** the reading WITHOUT the library wait, to separate it from the rest */
const NO_DRESS = flag('no-dress')
/* THE STAGE THE OWNER ACTUALLY HAS. The rig's desktop eye has shot at a
   device ratio of one for months, and the sample count the backend keeps
   depends on that ratio: a reading at ratio one is not a reading of his
   screen. `--dpr` names it. */
const VP = MOBILE
  ? { width: 390, height: 844, deviceScaleFactor: DPR || 2 }
  : { width: 1512, height: 950, deviceScaleFactor: DPR || 1 }

/* THE SUB-PIXEL GRID. Four offsets that are not a rotation of each other, so
   a feature aligned with one axis cannot hide from all of them, and the two
   zeros that make the control. */
const SHIFTS = [
  { tag: 'a', dx: 0, dy: 0 },
  { tag: 'b', dx: 0.5, dy: 0 },
  { tag: 'c', dx: 0, dy: 0.5 },
  { tag: 'd', dx: 0.5, dy: 0.5 },
  { tag: 'e', dx: 0.25, dy: 0.75 },
  { tag: 'ctrl', dx: 0, dy: 0 },
]
const TILE = 8
/* TWO FACES AT ONE PLACE. Under this gap the two bodies are at the same
   depth as far as any visitor is concerned, and the fight is class 1
   whatever the buffer's own resolution says; the measured gap and the
   buffer's resolution ride beside every row so the reading can be judged. */
const COPLANAR_M = 0.002
/** a shaded step this small is the encoder and the grain, not the material */
const LIGHT_STEP = 3

mkdirSync(OUT, { recursive: true })

/* ---- the classifier, run inside the page over its own buffers ----------- */
/* IT RUNS IN THE PAGE ON PURPOSE. Three buffers at 1512 by 950 are 13 MB a
   frame; six frames a pose across the wire would be the whole run. The
   function is handed over as source and closes over nothing. */
function classify(params) {
  const hook = window.__naAudit
  const frames = hook.frames()
  const bodies = hook.bodies()
  const { w, h, tile, coplanar, lightStep, flip } = params
  const shifted = frames.filter((f) => f.tag !== 'ctrl')
  const control = frames.filter((f) => f.tag === 'ctrl' || f.tag === 'a')
  if (shifted.length < 2) return { error: 'fewer than two shifted frames' }
  const tw = Math.ceil(w / tile)
  const th = Math.ceil(h / tile)
  const cells = tw * th
  const cls = new Int8Array(cells)
  const strength = new Float32Array(cells)
  const groups = new Map()
  const note = (key, pixel) => {
    let g = groups.get(key)
    if (!g) groups.set(key, (g = { key, pixels: 0, tiles: 0, gapSum: 0, thickSum: 0, lightSum: 0, x: 0, y: 0, depth: 0 }))
    g.pixels++
    g.gapSum += pixel.gap
    g.thickSum += pixel.thick
    g.lightSum += pixel.light
    g.x += pixel.x
    g.y += pixel.y
    g.depth += pixel.depth
  }
  /* the control's own disagreement, per pixel, so the shifted reading is
     never read against zero on a machine that is drawing five wings */
  const ctrlLight = new Uint8Array(w * h)
  const ctrlId = new Uint8Array(w * h)
  if (control.length >= 2) {
    const a = control[0]
    const b = control[control.length - 1]
    for (let i = 0; i < ctrlLight.length; i++) {
      ctrlLight[i] = Math.min(255, Math.abs(a.light[i] - b.light[i]))
      ctrlId[i] = a.id[i] === b.id[i] ? 0 : 1
    }
  }
  const row = (y) => (flip ? h - 1 - y : y)
  const base = shifted[0]
  /* WHAT A SHIFT IS ALLOWED TO DO. Moving the projection by half a pixel
     moves the whole picture by half a pixel, so a naive difference between
     two shifted frames measures the image's own gradient and calls every
     textured wall unstable. Two tests instead, both of them local:
       a body is FLAGGED only where the body that takes the pixel is not
       even in the unshifted frame's own eight neighbours, which is a
       feature appearing out of nothing rather than a boundary moving;
       a shading step is FLAGGED only where the shifted value falls outside
       the unshifted frame's own neighbourhood range, which no resampling
       of that neighbourhood could produce. */
  let edges = 0
  let edgeJump = 0
  let flips = 0
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      let one = 0
      let two = 0
      let three = 0
      for (let y = Math.max(1, ty * tile); y < Math.min(h - 1, (ty + 1) * tile); y++) {
        for (let x = Math.max(1, tx * tile); x < Math.min(w - 1, (tx + 1) * tile); x++) {
          const light = y * w + x
          const buf = row(y) * w + x
          if (ctrlId[light]) continue
          const idA = base.id[buf]
          const depthA = base.depth[buf]
          // the unshifted frame's own eight neighbours, in both buffers
          let lo = base.light[light]
          let hi = lo
          const around = []
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const n = (y + dy) * w + (x + dx)
              const nb = row(y + dy) * w + (x + dx)
              if (base.light[n] < lo) lo = base.light[n]
              if (base.light[n] > hi) hi = base.light[n]
              around.push(base.id[nb])
            }
          const slack = lightStep + ctrlLight[light]
          for (let f = 1; f < shifted.length; f++) {
            const idB = shifted[f].id[buf]
            if (idB !== idA) {
              flips++
              const gap = Math.abs(shifted[f].depth[buf] - depthA)
              const known = around.indexOf(idB) >= 0
              /* WHAT THE VISITOR SEES WHERE THE BODY CHANGED: the shaded
                 frame's own step at that pixel, past what the control moved
                 by. This is the number multisampling is meant to lower, and
                 the local contrast is not it. */
              const jump = Math.max(0, Math.abs(shifted[f].light[light] - base.light[light]) - ctrlLight[light])
              if (gap <= coplanar && idA > 0 && idB > 0) {
                // two faces at one place: a fight whatever the neighbours say
                let thick = 1
                for (let k = x + 1; k < Math.min(w, x + 32); k++) if (shifted[f].id[row(y) * w + k] === idB) thick++; else break
                one++
                const pair = idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`
                note(`1:${pair}`, { gap, thick, light: jump, x, y, depth: depthA })
              } else if (!known) {
                let thick = 1
                for (let k = x + 1; k < Math.min(w, x + 32); k++) if (shifted[f].id[row(y) * w + k] === idB) thick++; else break
                two++
                note(`2:${idB}|${idA}`, { gap, thick, light: jump, x, y, depth: shifted[f].depth[buf] })
              } else {
                edges++
                edgeJump += jump
              }
              break
            }
            const l = shifted[f].light[light]
            const over = l > hi + slack ? l - hi - slack : l < lo - slack ? lo - slack - l : 0
            if (over > 0) {
              three++
              note(`3:${idA}`, { gap: 0, thick: 0, light: over, x, y, depth: depthA })
              break
            }
          }
        }
      }
      const cell = ty * tw + tx
      const total = one + two + three
      if (!total) continue
      cls[cell] = one >= two && one >= three ? 1 : two >= three ? 2 : 3
      strength[cell] = total
    }
  }
  // a tile count per group, taken again over the tiles the group owns
  for (const g of groups.values()) g.tiles = Math.round(g.pixels / (tile * tile) * 10) / 10
  const named = (id) => {
    const body = bodies[id - 1]
    return body ? `${body.path || body.name} [${body.material}]` : id === 0 ? 'nothing (sky)' : `body ${id}`
  }
  const table = [...groups.values()]
    .map((g) => {
      const [kind, who] = g.key.split(':')
      const pair = who.split('|').map(Number)
      return {
        cls: Number(kind),
        bodies: pair.map(named),
        pixels: g.pixels,
        tiles: g.tiles,
        meanGapMm: Math.round((g.gapSum / g.pixels) * 100000) / 100,
        meanThickPx: Math.round((g.thickSum / g.pixels) * 100) / 100,
        meanLight: Math.round((g.lightSum / g.pixels) * 100) / 100,
        atM: Math.round((g.depth / g.pixels) * 100) / 100,
        at: [Math.round(g.x / g.pixels), Math.round(g.y / g.pixels)],
      }
    })
    .sort((a, b) => b.pixels - a.pixels)
  let flagged = 0
  for (let i = 0; i < cells; i++) if (strength[i] >= 2) flagged++
  const classPixels = { 1: 0, 2: 0, 3: 0 }
  for (const g of groups.values()) classPixels[Number(g.key.split(':')[0])] += g.pixels
  return {
    w, h, tw, th, tile,
    cls: Array.from(cls),
    strength: Array.from(strength, (v) => Math.round(v)),
    flaggedTiles: flagged,
    edges,
    edgeJump: edges ? Math.round((edgeJump / edges) * 100) / 100 : 0,
    flips,
    classPixels,
    controlPixels: ctrlId.reduce((s, v) => s + v, 0),
    /* THE FORTY LOUDEST, AND EVERY ROW THE RATCHET COULD EVER NAME. A cap
       alone makes membership depend on what else stands in the frame: a row
       of two thousand pixels falls outside the forty at a busy station and
       inside them at a quiet one, and a set built that way flutters. */
    table: table.filter((row, at) => at < 40 || row.pixels >= 200),
    bodies: bodies.length,
  }
}

/* ---- which way up the readback came, settled by the picture itself ------ */
/* A render target read back may come row 0 at the top or row 0 at the
   bottom, and a reading taken the wrong way up is a reading of another part
   of the room. The buffers themselves decide it: the shaded frame is known
   to be top down, so whichever way up the depth buffer agrees with the
   frame's own near-and-far is the way up it is. */
function decideFlip() {
  const hook = window.__naAudit
  const f = hook.frames()[0]
  if (!f) return { flip: false, why: 'no frame' }
  const { w, h } = hook.stage()
  const band = Math.max(1, Math.round(h * 0.12))
  const mean = (from, to) => {
    let sum = 0
    let n = 0
    for (let y = from; y < to; y++)
      for (let x = 0; x < w; x += 4) {
        const d = f.depth[y * w + x]
        if (d > 0) {
          sum += d
          n++
        }
      }
    return n ? sum / n : 0
  }
  const first = mean(0, band)
  const last = mean(h - band, h)
  let lightFirst = 0
  let lightLast = 0
  for (let y = 0; y < band; y++) for (let x = 0; x < w; x += 4) lightFirst += f.light[y * w + x]
  for (let y = h - band; y < h; y++) for (let x = 0; x < w; x += 4) lightLast += f.light[y * w + x]
  /* the floor is under the eye and the far wall is over it: the band with
     the smaller mean depth is the bottom of the picture */
  return { flip: first < last, first, last, lightFirst, lightLast }
}

/* ---- the clock, freezable ------------------------------------------------ */
async function installClock(page, step) {
  return page.evaluate((stepMs) => {
    const w = window
    if (w.__naClock) return { installed: false, why: 'already installed' }
    const realRaf = w.requestAnimationFrame.bind(w)
    const realNow = performance.now.bind(performance)
    const state = { step: stepMs, virtual: realNow(), at: realNow(), frames: 0, realNow }
    w.__naClock = state
    let seq = 0
    let queue = []
    let pumping = false
    const tick = () => {
      pumping = false
      state.virtual += state.step
      state.at = realNow()
      state.frames++
      const due = queue
      queue = []
      for (const [, cb] of due) {
        try {
          cb(state.virtual)
        } catch (e) {
          console.error(e)
        }
      }
      if (queue.length) pump()
    }
    const pump = () => {
      if (pumping) return
      pumping = true
      realRaf(tick)
    }
    w.requestAnimationFrame = (cb) => {
      const id = ++seq
      queue.push([id, cb])
      pump()
      return id
    }
    w.cancelAnimationFrame = (id) => {
      queue = queue.filter(([i]) => i !== id)
    }
    // real time inside a frame, capped at the step, so a budget loop still
    // measures real work and a frozen clock never runs backwards
    performance.now = () => state.virtual + Math.min(state.step, realNow() - state.at)
    return { installed: true, step: stepMs }
  }, step)
}

const setStep = (page, step) => page.evaluate((s) => { window.__naClock.step = s }, step)
const clockFrames = (page) => page.evaluate(() => window.__naClock.frames)
async function waitFrames(page, n) {
  const from = await clockFrames(page)
  await page.waitForFunction((want) => window.__naClock.frames >= want, from + n, { timeout: 30000, polling: 16 })
}

/* ---- one pose, read ------------------------------------------------------ */
async function readPose(page, name, params) {
  const began = Date.now()
  const step = (what) => { if (LOUD) out(`[stability]     ${what} +${Date.now() - began} ms`) }
  const armed = await page.evaluate(() => { window.__naAudit.clear(); return window.__naAudit.arm() })
  step(`armed ${armed} bodies`)
  for (const s of SHIFTS) {
    await page.evaluate(([dx, dy]) => window.__naAudit.shift(dx, dy), [s.dx, s.dy])
    /* THE CANVAS LAGS THE DRAW. A graphics context presents when it is
       ready, so a canvas read inside one frame can still hold the frame
       before it, and a shaded frame belonging to another offset than the
       id buffer beside it is a shading step that was never there. The
       offset is put on again on every draw, so a few frames at one offset
       settle both buffers on one pose. */
    await waitFrames(page, SETTLE)
    await page.evaluate((tag) => window.__naAudit.capture(tag), s.tag)
    step(`captured ${s.tag}`)
  }
  await page.evaluate(() => window.__naAudit.shift(0, 0))
  const flip = params.flip ?? (await page.evaluate(decideFlip)).flip
  step(`flip ${flip}`)
  const report = await page.evaluate(classify, { ...params, flip })
  step('classified')
  await page.evaluate(() => window.__naAudit.clear())
  return { name, flip, ...report }
}

/** a reading at one device ratio is four times the pixels of another: every
    count travels per million pixels of the stage it was taken on */
const per = (pose, cls) => Math.round(((pose.classPixels?.[cls] ?? 0) * 1e6) / (pose.w * pose.h))
/** and what the picture actually jumped by, in levels, where that class fired */
const light = (pose, cls) => {
  if (!pose.table) return 0
  const rows = (pose.table ?? []).filter((r) => r.cls === cls)
  const px = rows.reduce((s, r) => s + r.pixels, 0)
  return px ? Math.round((rows.reduce((s, r) => s + r.meanLight * r.pixels, 0) / px) * 10) / 10 : 0
}

/* ---- the heat map -------------------------------------------------------- */
const CLASS_COLOUR = [
  [0, 0, 0],
  [220, 60, 50],
  [70, 150, 240],
  [240, 200, 70],
  [150, 90, 220],
]
async function heatMap(pose, file) {
  if (!pose.tw) return
  const { tw, th, cls, strength } = pose
  const top = Math.max(1, ...strength)
  const raw = Buffer.alloc(tw * th * 3)
  for (let i = 0; i < tw * th; i++) {
    const colour = CLASS_COLOUR[cls[i]] ?? CLASS_COLOUR[0]
    const weight = Math.min(1, 0.25 + (0.75 * strength[i]) / top)
    raw[i * 3] = Math.round(colour[0] * weight)
    raw[i * 3 + 1] = Math.round(colour[1] * weight)
    raw[i * 3 + 2] = Math.round(colour[2] * weight)
  }
  await sharp(raw, { raw: { width: tw, height: th, channels: 3 } })
    .resize(tw * TILE, th * TILE, { kernel: 'nearest' })
    .png()
    .toFile(file)
}

/* ---- the run ------------------------------------------------------------- */
const server = SERVE ? spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', cwd: APP_ROOT }) : null
/** a refused run must still put the browser down: playwright holds the
    process open for as long as one is alive */
let openBrowser = null
const poses = []
const faults = []
let depthState = null
let sampleState = null
let cost = null
let costAfter = null
let stage = null
try {
  await waitForServer(BASE)
  const said = await assertServer(BASE)
  out(`[stability] server ${said.head.slice(0, 7)}, ${MOBILE ? 'phone' : 'desktop'}, tier ${TIER}${DEPTH ? `, depth=${DEPTH}` : ''}`)

  const browser = await chromium.launch({ args: browserArgs() })
  openBrowser = browser
  const ctx = await browser.newContext({ viewport: { width: VP.width, height: VP.height }, deviceScaleFactor: VP.deviceScaleFactor })
  // the wing's welcome sheet is not the room: the flag it keeps is set
  // before the first navigation
  await ctx.addInitScript((flagName) => {
    try {
      sessionStorage.setItem(flagName, '1')
    } catch {
      /* a refused store already counts as seen */
    }
  }, `${SLUG}-welcome`)
  const page = await ctx.newPage()
  let firstLine = ''
  page.on('pageerror', (e) => faults.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.text().startsWith('backend=')) firstLine = m.text()
    if (m.type() === 'error') {
      faults.push(`console: ${m.text()}`)
      if (LOUD) out(`[stability] CONSOLE ERROR ${m.text()}`)
    }
  })
  const query =
    `?tier=${TIER}&audit=1` +
    (DEPTH ? `&depth=${DEPTH}` : '') +
    (SAMPLES ? `&samples=${SAMPLES}` : '') +
    (PR ? `&pr=${PR}` : '')
  await page.goto(`${BASE}/w/${SLUG}${query}`)
  await page.waitForFunction(() => Boolean(window.__forge))
  if (!(await wingStanding(page))) faults.push('the wing never stood: its entry field did not lift')
  await assertBackend(page)
  assertAdapter(firstLine, process.env['FORGE_BACKEND'] ?? 'webgpu')
  await page.waitForFunction(() => Boolean(window.__naAudit), null, { timeout: 30000 })
  /* THE FILM OFF. The chain reseeds its grain on every frame by design, so
     a reading taken over it measures the tooth at every pixel of every
     frame and calls the whole picture unstable. */
  const filmOff = await page.evaluate(() => window.__forge.grain(false) === false)
  if (!filmOff) faults.push('the film would not go off: every reading carries the grain')
  out(`[stability] ${firstLine}`)

  depthState = await page.evaluate(() => ({ ...window.__naStack.depth(), ...window.__naAudit.depth() }))
  sampleState = await page.evaluate(() => window.__naAudit.samples())
  cost = await page.evaluate(() => window.__forge.cost())
  out(`[stability] samples asked=${sampleState.asked} normalised=${sampleState.normalised} allocated=${sampleState.allocated} at pixel ratio ${sampleState.pixelRatio} (${sampleState.backend})`)
  out(`[stability] stage ${cost.tier}: frame p50 ${cost.frameMsP50} ms, p95 ${cost.frameMsP95}, ${cost.draws} draws, ${cost.triangles} tris, frame buffers ${cost.frameMB} MB, textures ${cost.textureMB} MB`)
  stage = await page.evaluate(() => window.__naAudit.stage())
  out(`[stability] depth asked=${depthState.asked || 'default'} reversed=${depthState.reversed} log=${depthState.logarithmic} near=${depthState.near} far=${depthState.far}`)
  if (DEPTH === 'reversed' && !depthState.reversed) faults.push('the reversed depth switch did not take on this backend')
  if (DEPTH === 'log' && !depthState.logarithmic) faults.push('the logarithmic depth switch did not take on this backend')

  await installClock(page, 1000 / 60)
  const state = await page.evaluate(() => window.__forge.state())
  let ids = ALL || !STATIONS ? state.stationIds : STATIONS.split(',').map((s) => s.trim()).filter(Boolean)
  if (ROTATE > 0 && ids.length > ROTATE) {
    const head = headHere()
    let seed = 0
    for (const ch of head) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
    const windows = Math.ceil(ids.length / ROTATE)
    const turn = seed % windows
    const rotated = []
    for (let k = 0; k < ROTATE; k++) rotated.push(ids[(turn * ROTATE + k) % ids.length])
    out(`[stability] window ${turn + 1} of ${windows} by the head's own hash: ${rotated.join(', ')}`)
    ids = rotated
  }
  if (FIRST > 0) ids = ids.slice(0, FIRST)
  out(`[stability] ${ids.length} station(s) of ${state.stationIds.length}`)

  const params = { w: stage.w, h: stage.h, tile: TILE, coplanar: COPLANAR_M, lightStep: LIGHT_STEP }
  let flip = null
  for (let sweep = 0; sweep < RUNS; sweep++)
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const took = await page.evaluate((s) => window.__forge.station(s), id)
    if (!took) {
      faults.push(`no such station: ${id}`)
      continue
    }
    /* THE WALK TO IT RUNS ON THE CLOCK; THE READING IS TAKEN STANDING, AND
       STANDING MEANS THREE THINGS, NOT ONE. The wing's own arrival ends the
       walk. Then the LIBRARY has to be done: a set still in flight dresses
       its surface one frame later and the same build reads a tenth apart.
       Then the SUN has to have settled: the near cascade re-snaps only once
       the eye has moved a few metres, so its box at a station depends on
       which frames the walk in was sampled at, and a station just arrived at
       carries the walk's own last box until the next snap. The eye is held
       for a while with the clock still running, which is what lets both
       finish; only then is the world frozen. */
    await page
      .waitForFunction((want) => window.__forge.state().stationId === want, id, { timeout: 60000, polling: 100 })
      .catch(() => faults.push(`the walk never arrived at ${id}`))
    const dressed = NO_DRESS
      ? false
      : await page
          .waitForFunction(() => window.__forge.state().texturesPending === 0, null, { timeout: 120000, polling: 200 })
          .then(() => true)
          .catch(() => false)
    if (!dressed && !NO_DRESS) faults.push(`the library never finished dressing ${id}`)
    await waitFrames(page, SETTLE_FRAMES)
    const pending = await page.evaluate(() => window.__forge.state().texturesPending)
    await setStep(page, 0)
    const pose = await readPose(page, `station ${id}`, { ...params, flip })
    pose.station = id
    pose.sweep = sweep
    pose.texturesPending = pending
    pose.dressed = dressed
    flip ??= pose.flip
    poses.push(pose)
    out(
      `[stability] ${id}: ${pose.flaggedTiles} tile(s) of ${pose.tw * pose.th}` +
        ` | per million stage px: class 1 ${per(pose, 1)}, class 2 ${per(pose, 2)}, class 3 ${per(pose, 3)}` +
        ` | jump ${light(pose, 1)} / ${light(pose, 2)} / ${light(pose, 3)} levels` +
        ` | ${pose.edges} boundary move(s) at ${pose.edgeJump} levels`
    )
    if (SHOT) await page.screenshot({ path: join(OUT, `shot-${MOBILE ? 'phone' : 'desktop'}-${TIER}-dpr${VP.deviceScaleFactor}${SAMPLES ? `-s${SAMPLES}` : ''}-${id}.png`), animations: 'disabled', timeout: 60000 })
    if (KEEP_MAPS) await heatMap(pose, join(OUT, `heat-${MOBILE ? 'phone' : 'desktop'}-${TIER}-dpr${VP.deviceScaleFactor}${SAMPLES ? `-s${SAMPLES}` : ''}-${id}.png`))
    await setStep(page, 1000 / 60)

    // and the leg from here to the next station, sampled while it walks
    if (LEG_POSES && i + 1 < ids.length) {
      const next = ids[i + 1]
      await page.evaluate((s) => window.__forge.station(s), next)
      for (let k = 0; k < LEG_POSES; k++) {
        await waitFrames(page, LEG_STRIDE)
        const arrived = await page.evaluate(() => window.__forge.state().stationId)
        await setStep(page, 0)
        const legPose = await readPose(page, `leg ${id}:${next} +${(k + 1) * LEG_STRIDE}`, { ...params, flip })
        poses.push(legPose)
        out(`[stability]   ${legPose.name}: ${legPose.flaggedTiles} tile(s)`)
        if (KEEP_MAPS && k === 0) await heatMap(legPose, join(OUT, `heat-${MOBILE ? 'phone' : 'desktop'}-${TIER}-leg-${id}-${next}.png`))
        await setStep(page, 1000 / 60)
        if (arrived === next) break
      }
      await waitFrames(page, 240)
    }
  }

  /* CLASS 4, READ APART. The camera does not move at all and the world's own
     clock does: whatever changes is the picture's own time, which is the one
     family a sub-pixel shift cannot separate. */
  if (TIME_READ) {
    await setStep(page, 1000 / 60)
    await page.evaluate(() => { window.__naAudit.clear(); window.__naAudit.arm() })
    for (const tag of ['a', 'b', 'c', 'ctrl']) {
      await page.evaluate(() => window.__naAudit.shift(0, 0))
      await page.evaluate((t) => window.__naAudit.capture(t), tag)
      await waitFrames(page, 6)
    }
    const timed = await page.evaluate(classify, { ...params, flip: flip ?? false })
    poses.push({ name: 'time, the eye held', ...timed })
    out(`[stability] time held: ${timed.flaggedTiles} tile(s) move with the camera standing`)
  }

  costAfter = await page.evaluate(() => window.__forge.cost())
  await ctx.close()
  await browser.close()
} catch (err) {
  faults.push(`RIG REFUSED: ${err.message}`)
} finally {
  await openBrowser?.close().catch(() => {})
  server?.kill()
}

/* ---- the one ranked table for the whole run ------------------------------ */
const ranked = new Map()
for (const pose of poses) {
  for (const row of pose.table ?? []) {
    const key = `${row.cls}:${row.bodies.join(' + ')}`
    let g = ranked.get(key)
    if (!g) ranked.set(key, (g = { cls: row.cls, bodies: row.bodies, pixels: 0, gap: 0, thick: 0, light: 0, at: 0, eyes: [] }))
    g.pixels += row.pixels
    g.gap += row.meanGapMm * row.pixels
    g.thick += row.meanThickPx * row.pixels
    g.light += row.meanLight * row.pixels
    g.at += row.atM * row.pixels
    if (!g.eyes.includes(pose.name)) g.eyes.push(pose.name)
  }
}
const table = [...ranked.values()]
  .map((g) => ({
    cls: g.cls,
    bodies: g.bodies,
    pixels: g.pixels,
    gapMm: Math.round((g.gap / g.pixels) * 100) / 100,
    thickPx: Math.round((g.thick / g.pixels) * 100) / 100,
    light: Math.round((g.light / g.pixels) * 100) / 100,
    atM: Math.round((g.at / g.pixels) * 100) / 100,
    eyes: g.eyes,
  }))
  .sort((a, b) => b.pixels - a.pixels)

/* ---- THE RATCHET ------------------------------------------------------- */
/* THE PICTURE MAY ONLY GET CALMER. What this instrument measures splits in
   two, and only one half can carry a gate.
     NOT FIT TO GATE: the per-million counts. They move by up to three times
     between two sessions at an outdoor station, because a count is a count
     of pixels that crossed a threshold and the threshold sits in the noise.
     They are recorded for the reader and never compared.
     FIT TO GATE: the SET of bodies the classes name, and the step in levels
     at a boundary. Two sweeps of one station read the same step to within a
     few percent, and a pair of bodies fighting over one depth either exists
     in the wing or does not. A new name in either set is a new defect; a
     station whose step climbs past its own measured spread is a regression.
   The baseline never rewrites itself: a seat that improves a station writes
   it with `--write-base` in the same commit, and the diff shows what moved. */
const BASE_FILE = join(APP_ROOT, 'forge', 'STABILITY-BASE.json')
/** a body enters a set only above this many pixels in one pose: under it a
    row is one tile of noise and would make the set flutter run to run */
const SET_FLOOR = 200
/* AND THE GATE ASKS FOR MORE THAN THE BASELINE REMEMBERS. A set read once
   is not the set read three times: names near the floor come and go between
   sweeps, and the first gate run proved it by refusing six of them, none
   over a thousand pixels. So the baseline REMEMBERS everything over
   SET_FLOOR and the gate only calls a name new when it holds this much of
   one pose. Asymmetric in the safe direction: every real defect this
   instrument has ever named held four to twenty-eight thousand pixels. */
const GATE_FLOOR = 2000
/* HOW FAR A STATION'S STEP MAY CLIMB. The picture is now calm enough that
   the step sits near the floor of what this instrument can separate, and one
   station moves by up to 2.9x between two sweeps of one session. A ceiling
   proportional to the baseline alone would fire on that; a ceiling with a
   whole level of headroom does not, and the regression this gate exists for
   (the uncapped buffer, nine to thirty-two levels) is still two to eight
   times over the widest ceiling in the wing. */
const stepCeiling = was => Math.max(was * 1.6, was + 1)

function setsOf(poses, floor = SET_FLOOR) {
  const one = new Set()
  const two = new Set()
  for (const pose of poses) {
    for (const row of pose.table ?? []) {
      if (row.pixels < floor) continue
      const name = row.bodies.join(' + ')
      if (row.cls === 1) one.add(name)
      else if (row.cls === 2) two.add(name)
    }
  }
  return { class1Pairs: [...one].sort(), class2Bodies: [...two].sort() }
}

function stationsOf(poses) {
  const byStation = {}
  for (const pose of poses) {
    if (!pose.station) continue
    const row = (byStation[pose.station] ??= { step: [], perMpx: { 1: [], 2: [], 3: [] } })
    row.step.push(pose.edgeJump)
    for (const cls of [1, 2, 3]) row.perMpx[cls].push(per(pose, cls))
  }
  const out = {}
  for (const [id, row] of Object.entries(byStation)) {
    out[id] = {
      stepLevels: { min: Math.min(...row.step), max: Math.max(...row.step), runs: row.step.length, read: row.step },
      perMpx: Object.fromEntries([1, 2, 3].map((c) => [c, { min: Math.min(...row.perMpx[c]), max: Math.max(...row.perMpx[c]) }])),
    }
  }
  return out
}

if (WRITE_BASE && !faults.length) {
  const base = {
    note: 'the stability ratchet. The sets and the step levels are gated; the per-million counts are recorded and are not.',
    head: headHere(), measured: new Date().toISOString().slice(0, 10),
    viewport: MOBILE ? 'mobile' : 'desktop', deviceScaleFactor: VP.deviceScaleFactor, tier: TIER,
    stage, samples: sampleState, runs: RUNS, setFloorPx: SET_FLOOR, gateFloorPx: GATE_FLOOR,
    ...setsOf(poses), stations: stationsOf(poses),
  }
  writeFileSync(BASE_FILE, JSON.stringify(base, null, 1) + '\n')
  out(`[stability] baseline written: ${Object.keys(base.stations).length} station(s), ` +
    `${base.class1Pairs.length} class 1 pair(s), ${base.class2Bodies.length} class 2 body/bodies`)
}

let ratchet = null
if (VERIFY) {
  let base = null
  try {
    base = JSON.parse(readFileSync(BASE_FILE, 'utf8'))
  } catch (err) {
    faults.push(`the baseline could not be read: ${err.message}`)
  }
  if (base) {
    const mine = setsOf(poses, GATE_FLOOR)
    const seen = stationsOf(poses)
    const newPairs = mine.class1Pairs.filter((name) => !base.class1Pairs.includes(name))
    const newBodies = mine.class2Bodies.filter((name) => !base.class2Bodies.includes(name))
    const risen = []
    for (const [id, row] of Object.entries(seen)) {
      const was = base.stations[id]
      if (!was) continue // a station the baseline never read is not a regression
      const ceiling = stepCeiling(was.stepLevels.max)
      if (row.stepLevels.max > ceiling)
        risen.push(`${id} ${row.stepLevels.max} levels over ${+ceiling.toFixed(2)} (baseline ${was.stepLevels.min} to ${was.stepLevels.max})`)
    }
    ratchet = {
      base: base.head, measured: base.measured, stations: Object.keys(seen),
      newClass1Pairs: newPairs, newClass2Bodies: newBodies, risenSteps: risen,
      ok: !newPairs.length && !newBodies.length && !risen.length,
    }
    for (const name of newPairs) faults.push(`RATCHET: a class 1 pair the baseline does not carry: ${name}`)
    for (const name of newBodies) faults.push(`RATCHET: a class 2 body the baseline does not carry: ${name}`)
    for (const line of risen) faults.push(`RATCHET: the step rose at ${line}`)
    out(ratchet.ok
      ? `[stability] RATCHET ok against ${base.head.slice(0, 7)}: no new named body, no station past its spread`
      : `[stability] RATCHET RED: ${newPairs.length} new pair(s), ${newBodies.length} new body/bodies, ${risen.length} station(s) risen`)
  }
}

const report = {
  wing: SLUG,
  viewport: MOBILE ? 'mobile' : 'desktop',
  tier: TIER,
  stage,
  deviceScaleFactor: VP.deviceScaleFactor,
  depth: depthState,
  samples: sampleState,
  cost,
  costAfter,
  shifts: SHIFTS,
  tile: TILE,
  coplanarM: COPLANAR_M,
  lightStep: LIGHT_STEP,
  stagePixels: stage ? stage.w * stage.h : 0,
  poses: poses.map((p) => ({
    name: p.name,
    station: p.station ?? null,
    sweep: p.sweep ?? 0,
    texturesPending: p.texturesPending ?? null,
    dressed: p.dressed ?? null,
    flaggedTiles: p.flaggedTiles,
    perMpx: { 1: per(p, 1), 2: per(p, 2), 3: per(p, 3) },
    lightLevels: { 1: light(p, 1), 2: light(p, 2), 3: light(p, 3) },
    edgeJump: p.edgeJump,
    classPixels: p.classPixels,
    edges: p.edges,
    flips: p.flips,
    tiles: p.tw ? p.tw * p.th : 0,
    controlPixels: p.controlPixels,
    bodies: p.bodies,
    table: p.table,
  })),
  table: table.slice(0, 60),
  ratchet,
  faults,
  ok: faults.length === 0,
}
const stem =
  `stability-${MOBILE ? 'phone' : 'desktop'}-${TIER}-dpr${VP.deviceScaleFactor}` +
  `${DEPTH ? `-${DEPTH}` : ''}${SAMPLES ? `-s${SAMPLES}` : ''}${PR ? `-pr${PR}` : ''}`
writeFileSync(join(OUT, `${stem}.json`), JSON.stringify(report, null, 2))

if (!JSON_OUT) {
  out('')
  out(`THE RANKED TABLE (${table.length} group(s), ${poses.length} pose(s))`)
  for (const row of table.slice(0, 25)) {
    out(
      ` class ${row.cls} · ${row.pixels} px · gap ${row.gapMm} mm · ${row.thickPx} px wide · light ${row.light} · at ${row.atM} m` +
        `\n   ${row.bodies.join('  +  ')}\n   seen by: ${row.eyes.slice(0, 4).join(', ')}${row.eyes.length > 4 ? ` and ${row.eyes.length - 4} more` : ''}`
    )
  }
}
if (faults.length) {
  out('STABILITY AUDIT FLAGGED:')
  for (const f of [...new Set(faults)]) out(` · ${f}`)
  process.exitCode = 1
}
if (JSON_OUT) console.log(JSON.stringify(report, null, 2))
