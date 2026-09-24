// THE FILM'S EXPORT (render graph W2): clips of the graph rendered by the live
// wing at the film's tier, every delivered frame a shutter of jittered draws
// averaged in linear light in the page, its bytes over a local socket into one
// encoder per clip that writes every rung in one pass.
//
//   node forge/film/export.mjs --clips=six                     the six proof clips, both framings
//   node forge/film/export.mjs --clips='<edge id>,<edge id>'   named clips
//   node forge/film/export.mjs --clips=six --runs=2            the same clips twice, compared
//   node forge/film/export.mjs --framings=wide --scale=2       four times the pixels
//   node forge/film/export.mjs --grain=0.007                   the film baked into the frames
//   node forge/film/export.mjs --stills=stop:flight,stop:works --stage=stills
//                                                              stills only, on the stills' stage
//
// Every clip starts and ends at rest. Its first frame is the departure node's
// still and its last the arrival's, rendered by the same program, and the
// report holds the joins by the sha256 of the raw frames. Every body a clip
// draws in any frame (taken while it is walked once in silence) stands from
// its first frame to its last, and the world's clock is pinned at both ends
// (`film.ts`, pinnedWind). A clip is refused (and written nowhere) when the
// textures in flight at rest are not zero, when the drawn set changes inside
// it anyway, or when the scene casts more shadows than its measured ceiling
// (MUST-FIX M49, M50).
//
//   node forge/film/export.mjs --clips=<id> --mount=live       the wing's streaming
//                                                              left alone: the rule's refusal
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import sharp from 'sharp'
import { APP_ROOT, assertServer, browserArgs, FRAME_TIME_FLAGS, headHere, waitForServer, wingStanding } from '../rig.mjs'
import { BARE, CHROME_OFF, STILL_DESK, installVirtualClock } from '../prerender/clock.mjs'
import { restingPending } from '../prerender/pending.mjs'
import { FPS, FRAMINGS, buildGraph } from './graph.mjs'
import { camPrint as nodePrint, openReplay, replayEdge } from './replay.mjs'
import { openSink, unpack } from './sink.mjs'

/* ---- the recipe (design §4.2, the owner's T0 reading, M50) ---- */
export const EXPORT_FORMAT = 'vinci-film-export-v1'
/** the fewest draws a delivered frame takes; at rest they are the anti-aliasing */
export const MIN_DRAWS = 8
/** the most: a frame that would need more is recorded as over, never hidden */
export const MAX_DRAWS = 48
/** the open share of a frame's time: a 180 degree shutter */
export const SHUTTER = 0.5
/** the shadow-casting lights the scene holds before machines vanish (M50) */
export const CASTER_CEILING = 9
/** delivered pixels per id pixel, per axis */
export const ID_DIV = 4
/** the render stage of each framing: the authored aspect, the top rung wide */
export const STAGES = { wide: { width: 1920, height: 1080 }, upright: { width: 780, height: 1688 } }
/** the rungs (design §6), written in one pass of one encoder */
export const RUNGS = { wide: [[1920, 1080], [1280, 720], [854, 480]], upright: [[720, 1558], [480, 1038]] }
export const STILL_RUNG = { wide: [1920, 1080], upright: [720, 1558] }
/** THE STILLS' STAGE (`--stage=stills`): the framings `stills.mjs` shoots, a
    CSS stage at 1.5 device pixels, drawn and delivered one to one, so the
    film's recipe can be set beside a still of the same pixels */
export const STILL_STAGES = { wide: { css: { width: 1600, height: 900 }, dsf: 1.5 }, upright: { css: { width: 780, height: 1688 }, dsf: 1.5 } }
export const X264 = { preset: 'medium', crf: 23, endsCrf: 12, endsFrames: 3, keyint: FPS, aq: 3, threads: 8 }
/** the ceiling of the world's own motion the joins may carry, of 255 */
const SKY_REACH_M = 800
const CELL_M = 2

/** THE SIX PROOF CLIPS: two legs of the life (one out of doors, one in the
    museum), a step and a run on the picture wall, an approach and a link among
    the machines. */
export const SIX = [
  'stop:study>stop:chamber',
  'stop:reading-table>stop:body',
  'view:picture/baptism-of-christ/front>view:picture/annunciation/front',
  'stop:picture-room>view:picture/ginevra-de-benci/front',
  'stop:flight>view:machine/aerial-screw',
  'view:machine/aerial-screw>view:machine/miter-lock-gates',
]

const sha256 = (data) => createHash('sha256').update(data).digest('hex')
const round = (n, p = 4) => Math.round(n * 10 ** p) / 10 ** p

function flagsOf(argv) {
  const flags = new Map()
  for (const a of argv) {
    if (!a.startsWith('--')) continue
    const at = a.indexOf('=')
    flags.set(at === -1 ? a.slice(2) : a.slice(2, at), at === -1 ? true : a.slice(at + 1))
  }
  return flags
}

/* ---- the shutter ---- */
const halton = (i, b) => {
  let f = 1, r = 0
  for (; i > 0; i = Math.floor(i / b)) { f /= b; r += f * (i % b) }
  return r
}
/** the jitter of draw k of n, in canvas pixels: a Halton 2,3 over one pixel */
export const jitterOf = (n) => Array.from({ length: n }, (_, k) => [round(halton(k + 1, 2) - 0.5, 6), round(halton(k + 1, 3) - 0.5, 6)])
/** the draws of delivered frame i of a leg that began at `origin`: the shutter
    centred on the frame's own instant, which is draw n/2 */
export const shutterTimes = (origin, i, n, shutter = SHUTTER) =>
  Array.from({ length: n }, (_, k) => origin + (i * 1000) / FPS + (k / n - 0.5) * (shutter * 1000) / FPS)

/* ---- the camera, from the replay's prints ---- */
function quat([x, y, z]) {
  // three's Euler order XYZ
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2)
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2)
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3]
}
const angleBetween = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])))
const parse = (print) => print.split(',').map(Number)

/** THE PICTURE'S MOTION a frame, in delivered pixels: the turn times the lens,
    and the walk against the nearest depth the last frame's ids saw */
export function motionOf(prints, i, height, nearM) {
  const at = (k) => parse(prints[Math.max(0, Math.min(prints.length - 1, k))])
  const a = at(i - 1), b = at(i + 1)
  const fov = at(i)[6]
  const focal = height / 2 / Math.tan((fov * Math.PI) / 360)
  const turn = (angleBetween(quat(a.slice(3, 6)), quat(b.slice(3, 6))) / 2) * focal
  const walk = nearM > 0 ? (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2 / nearM) * focal : 0
  return { turn, walk, px: turn + walk }
}
/** draws for a frame: at least one per pixel the open shutter travels */
export function drawsFor(px, shutter = SHUTTER) {
  const want = Math.ceil(px * shutter)
  const n = Math.max(MIN_DRAWS, Math.min(MAX_DRAWS, want + (want % 2)))
  return { n, over: want > MAX_DRAWS }
}

/* ---- what a frame showed, from its ids and depth ---- */
/** THE SITE'S BOX, in cells: 1 km square and 256 m high about the wing's
    origin. Every body of the wing stands inside it; a ray is followed only
    as far as its edge. */
export const CELL_BOX = { R: 256, Y0: -64, YN: 128 }

/** A set of world cells over the site's box, one byte a cell. Cells are W3's
    (`scene.mjs`): 2 m, numbered alike. */
export function cellSet() {
  const { R, Y0, YN } = CELL_BOX
  const bits = new Uint8Array(2 * R * 2 * R * YN)
  const idx = (x, y, z) => ((x + R) * YN + (y - Y0)) * 2 * R + (z + R)
  const inBox = (x, y, z) => x >= -R && x < R && z >= -R && z < R && y >= Y0 && y < Y0 + YN
  return {
    bounds: [[-R * CELL_M, Y0 * CELL_M, -R * CELL_M], [R * CELL_M, (Y0 + YN) * CELL_M, R * CELL_M]],
    add(x, y, z) { if (inBox(x, y, z)) bits[idx(x, y, z)] = 1 },
    /** every cell and every neighbour of one: a body across a cell's edge, or
        between two rays, is never lost */
    dilated() {
      const out = new Uint8Array(bits.length)
      let count = 0
      for (let x = -R; x < R; x++) for (let y = Y0; y < Y0 + YN; y++) {
        const base = idx(x, y, -R)
        for (let z = 0; z < 2 * R; z++) {
          if (!bits[base + z]) continue
          for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
            if (!inBox(x + dx, y + dy, z - R + dz)) continue
            const k = idx(x + dx, y + dy, z - R + dz)
            if (!out[k]) { out[k] = 1; count++ }
          }
        }
      }
      return { bits: out, count }
    },
  }
}

/** a seen set's cells as the gate numbers them, out of its bits */
export function cellNumbers(bits) {
  const { R, Y0, YN } = CELL_BOX
  const out = []
  for (let x = -R; x < R; x++) for (let y = Y0; y < Y0 + YN; y++) {
    const base = ((x + R) * YN + (y - Y0)) * 2 * R
    for (let z = 0; z < 2 * R; z++) if (bits[base + z]) out.push(((x + 2048) * 4096 + (y + 2048)) * 4096 + (z - R + 2048))
  }
  return out
}

/** THE CELLS ONE FRAME SAW: each id pixel's ray from the eye to what it hit (the
    free air too), and the floor and ceiling share for the upright rule */
export function frameCells(cells, frame) {
  const { depth, ids, idSize: [w, h], cam } = frame
  const P = cam.proj, M = cam.world
  // the inverse of a perspective projection, in closed form
  const ix = 1 / P[0], iy = 1 / P[5], ox = P[8], oy = P[9]
  const eye = [M[12], M[13], M[14]]
  const world = new Float64Array(w * h * 3)
  const hit = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    // WebGPU targets read top row first
    const nx = ((x + 0.5) / w) * 2 - 1, ny = 1 - ((y + 0.5) / h) * 2
    const vx = (nx + ox) * ix, vy = (ny + oy) * iy, vz = -1
    const d = depth[i]
    const sky = !(ids[i] > 0) || !(d > 0)
    if (sky && (x % 2 || y % 2)) continue
    const t = sky ? SKY_REACH_M / Math.hypot(vx, vy, vz) : d
    const dx = M[0] * vx + M[4] * vy + M[8] * vz, dy = M[1] * vx + M[5] * vy + M[9] * vz, dz = M[2] * vx + M[6] * vy + M[10] * vz
    const end = [eye[0] + dx * t, eye[1] + dy * t, eye[2] + dz * t]
    if (!sky) { world.set(end, i * 3); hit[i] = 1 }
    walkRay(cells, eye, end)
  }
  // the share of a frame on surfaces facing straight up or down
  let flat = 0, seen = 0
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const i = y * w + x
    if (!hit[i] || !hit[i + 1] || !hit[i + w]) continue
    const a = [world[i * 3], world[i * 3 + 1], world[i * 3 + 2]]
    const u = [world[i * 3 + 3] - a[0], world[i * 3 + 4] - a[1], world[i * 3 + 5] - a[2]]
    const v = [world[(i + w) * 3] - a[0], world[(i + w) * 3 + 1] - a[1], world[(i + w) * 3 + 2] - a[2]]
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const len = Math.hypot(...n)
    if (!(len > 0)) continue
    seen++
    if (Math.abs(n[1]) / len > 0.9) flat++
  }
  return { floorCeiling: seen ? flat / seen : 0 }
}

/** the cells a segment crosses inside the site's box, Amanatides and Woo */
function walkRay(cells, from, to) {
  // the segment clipped to the box, by its slabs
  const [lo, hi] = cells.bounds
  let t0 = 0, t1 = 1
  for (let k = 0; k < 3; k++) {
    const d = to[k] - from[k]
    if (d === 0) { if (from[k] < lo[k] || from[k] >= hi[k]) return; continue }
    let ta = (lo[k] - from[k]) / d, tb = (hi[k] - 1e-6 - from[k]) / d
    if (ta > tb) [ta, tb] = [tb, ta]
    t0 = Math.max(t0, ta)
    t1 = Math.min(t1, tb)
    if (t0 > t1) return
  }
  const a = [0, 1, 2].map((k) => from[k] + (to[k] - from[k]) * t0)
  const b = [0, 1, 2].map((k) => from[k] + (to[k] - from[k]) * t1)
  const c = a.map((v) => Math.floor(v / CELL_M))
  const e = b.map((v) => Math.floor(v / CELL_M))
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const step = d.map((v) => (v > 0 ? 1 : v < 0 ? -1 : 0))
  const tMax = [0, 1, 2].map((k) => (d[k] === 0 ? Infinity : ((c[k] + (step[k] > 0 ? 1 : 0)) * CELL_M - a[k]) / d[k]))
  const tDelta = [0, 1, 2].map((k) => (d[k] === 0 ? Infinity : CELL_M / Math.abs(d[k])))
  cells.add(c[0], c[1], c[2])
  for (let guard = 0; guard < 4000; guard++) {
    if (c[0] === e[0] && c[1] === e[1] && c[2] === e[2]) return
    const k = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : tMax[1] < tMax[2] ? 1 : 2
    if (tMax[k] > 1) return
    c[k] += step[k]
    tMax[k] += tDelta[k]
    cells.add(c[0], c[1], c[2])
  }
}

/* ---- the encoder ---- */
/** one ffmpeg for a clip, every rung in one pass, the ends near lossless */
function openEncoder(framing, frames, dir, stem, stage = STAGES[framing]) {
  const [w, h] = [stage.width, stage.height]
  const rungs = RUNGS[framing]
  const last = frames - 1
  const zones = `zones=0,${X264.endsFrames - 1},crf=${X264.endsCrf}/${Math.max(X264.endsFrames, last - X264.endsFrames + 1)},${last},crf=${X264.endsCrf}`
  const split = rungs.map((_, k) => `[s${k}]`).join('')
  const scales = rungs.map(([rw, rh], k) => `[s${k}]scale=${rw}:${rh}:flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p[o${k}]`).join(';')
  const outs = rungs.map(([rw, rh], k) => {
    mkdirSync(join(dir, `${rw}x${rh}`), { recursive: true })
    return join(dir, `${rw}x${rh}`, `${stem}.part.mp4`)
  })
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-',
    '-filter_complex', `[0:v]split=${rungs.length}${split};${scales}`]
  rungs.forEach((_, k) => {
    args.push('-map', `[o${k}]`, '-c:v', 'libx264', '-preset', X264.preset, '-crf', String(X264.crf), '-profile:v', 'high',
      // the colour goes into the stream's own header: the output options alone leave the transfer
      // untagged, and WebKit then paints the clip brighter than the still it hands over to
      '-x264-params', `keyint=${X264.keyint}:min-keyint=${X264.keyint}:scenecut=0:aq-mode=${X264.aq}:threads=${X264.threads}:colorprim=bt709:transfer=iec61966-2-1:colormatrix=bt709:${zones}`,
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-color_range', 'tv',
      '-an', '-movflags', '+faststart', outs[k])
  })
  const child = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] })
  let err = ''
  child.stderr.on('data', (d) => { err += d })
  const done = new Promise((ok, fail) => child.on('close', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg ${code}: ${err.slice(0, 400)}`)))))
  return {
    rungs: rungs.map(([rw, rh], k) => ({ rung: `${rw}x${rh}`, file: outs[k] })),
    write: (buf) => new Promise((ok) => (child.stdin.write(buf) ? ok() : child.stdin.once('drain', ok))),
    close: async () => { child.stdin.end(); await done },
    /** a refused clip is written nowhere */
    abort: async () => {
      child.kill('SIGKILL')
      await done.catch(() => {})
      for (const f of outs) rmSync(f, { force: true })
    },
  }
}

/** A file under its content address, renamed only when it is whole. */
function address(file, ext) {
  const bytes = readFileSync(file)
  const hash = sha256(bytes)
  const final = file.replace(/\.part\.[a-z0-9]+$/, `.${hash.slice(0, 16)}.${ext}`)
  renameSync(file, final)
  return { file: final, bytes: bytes.length, sha256: hash }
}

/* ---- the page ---- */
function chromeProof() {
  const painted = []
  for (const el of document.body.querySelectorAll('*')) {
    if (el.tagName === 'CANVAS') continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    painted.push(el.tagName.toLowerCase())
  }
  return painted.length
}

/** THE BUILD MUST BE THE TREE. The preview serves `dist/`, and its whoami
    names the checkout's head, not the build's: a source newer than the build
    is refused here instead of rendered from yesterday's bundle. */
function assertBuildFresh() {
  const built = join(APP_ROOT, 'dist', 'index.html')
  if (!existsSync(built)) throw new Error('no build: run pnpm build first')
  const at = statSync(built).mtimeMs
  const newest = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((m, e) => {
    const p = join(dir, e.name)
    return Math.max(m, e.isDirectory() ? newest(p) : statSync(p).mtimeMs)
  }, 0)
  const src = newest(join(APP_ROOT, 'src'))
  if (src > at) throw new Error('a source is newer than the build: run pnpm build first')
}

/** One framing's session: a stage, the wing standing, the export and the clock armed. */
async function openSession(browser, framing, { base, scale, sink, warmNodes, log, view = null }) {
  const at = view?.[framing]
  if (at && scale !== 1) throw new Error('the stills\' stage is drawn one to one: --scale must be 1')
  const stage = at ? { width: at.css.width * at.dsf, height: at.css.height * at.dsf } : STAGES[framing]
  const ratio = at ? at.dsf : scale
  const ctx = await browser.newContext({ viewport: at ? at.css : stage, deviceScaleFactor: ratio })
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vinci-welcome', '1') } catch { /* seen */ } })
  await ctx.addInitScript(installVirtualClock)
  const page = await ctx.newPage()
  const record = { errors: [], projection: [], late: [], chrome: [], aborted: [] }
  let armed = false
  page.on('pageerror', (e) => record.errors.push(e.message.slice(0, 160)))
  // an aborted set is neither ready nor missing: its request names it
  page.on('requestfailed', (r) => record.aborted.push(`${r.failure()?.errorText} ${r.url().replace(base, '')}`))
  page.on('response', (r) => { if (r.status() >= 400) record.aborted.push(`${r.status()} ${r.url().replace(base, '')}`) })
  page.on('console', (m) => { const t = m.text(); if (/Rail projection|frame threw/.test(t)) record.projection.push(t.slice(0, 160)) })
  /* A FILE AFTER THE CLOCK IS A FRAME THAT WAITED FOR IT, unless the page
     asked for it as an image of its own chrome, which is struck and draws no
     pixel of the canvas: those are counted apart */
  page.on('request', (r) => {
    if (!armed || r.url().startsWith('blob:') || r.url().startsWith('data:')) return
    ;(r.resourceType() === 'image' ? record.chrome : record.late).push(r.url().replace(base, ''))
  })
  const first = warmNodes[0]
  // the stills' own address: the desktop's band is chrome, and the film's frame is the whole canvas
  await page.goto(`${base}/w/vinci?probe=1&tier=max&export=1&order=life&pr=${ratio}&desk=${STILL_DESK}#s=${first.station}`, { waitUntil: 'load' })
  if (!(await wingStanding(page))) throw new Error('the wing never stood')
  const said = await page.evaluate(() => ({ backend: document.body.dataset.backend, tier: document.body.dataset.tier }))
  if (said.backend !== 'webgpu' || said.tier !== 'max') throw new Error(`backend ${said.backend}, tier ${said.tier}: the film wants webgpu at max`)
  await page.waitForFunction(() => Boolean(window.__naExport && window.__naFilm), null, { timeout: 60000 })
  /* THE WARM PASS: every node the clips touch is stood at once, so every room
     they pass has been built and every plate asked for before the clock */
  for (const node of warmNodes) {
    await page.evaluate((n) => window.__naFilm.place(n), node)
    await page.waitForTimeout(1500)
    await restingPending(page)
  }
  await page.waitForTimeout(2000)
  await page.evaluate(() => window.__forge.grain(false))
  await page.addStyleTag({ content: CHROME_OFF })
  await page.evaluate((c) => document.documentElement.classList.add(c), BARE)
  await page.waitForTimeout(600)
  await page.evaluate((fps) => window.__pre.arm(fps), FPS)
  await page.waitForFunction(() => window.__pre.queued() > 0, null, { timeout: 10000 })
  armed = true
  const opened = await page.evaluate((o) => window.__naExport.open(o), { width: stage.width, height: stage.height, scale: at ? 1 : scale, idDiv: ID_DIV, socket: sink.url })
  log(`  ${framing}: canvas ${opened.canvas.join('x')} at ratio ${opened.ratio}; in flight at rest ${await page.evaluate(() => window.__forge.state().texturesPending)}; failed requests ${record.aborted.length ? record.aborted.slice(0, 6).join(' | ') : 'none'}`)
  return { ctx, page, record, stage, framing }
}

/** Stand at a node at once and let it settle under the clock. */
async function standAt(page, node) {
  const ok = await page.evaluate((n) => window.__naFilm.place(n), node)
  if (!ok) throw new Error(`${node.id}: the rail refused the placement`)
  return page.evaluate(() => { for (let k = 0; k < 3; k++) window.__pre.step(); return window.__pre.virtualTime() })
}

/**
 * Render one delivered frame through the page and take its bytes off the sink.
 * Returns what the page reported and the frame as it arrived.
 */
async function renderFrame(session, inbox, plan) {
  const wait = inbox.next(plan.tag, plan.i)
  const report = await session.page.evaluate((p) => window.__naExport.frame(p), plan)
  const frame = await wait
  return { report, frame }
}

/** The inbox of frames the sink receives, awaited by tag and index. */
function inboxOf() {
  const held = new Map()
  const waiting = new Map()
  return {
    take(buf) {
      const { head, parts } = unpack(buf)
      if (head.t !== 'frame') return
      const key = `${head.tag}#${head.i}`
      const frame = { head, rgb: parts[0], depth: new Float32Array(parts[1].buffer), ids: new Uint32Array(parts[2].buffer), idSize: head.idSize, cam: head.cam }
      const w = waiting.get(key)
      if (w) { waiting.delete(key); w(frame) } else held.set(key, frame)
    },
    next(tag, i) {
      const key = `${tag}#${i}`
      if (held.has(key)) { const f = held.get(key); held.delete(key); return Promise.resolve(f) }
      return new Promise((r) => waiting.set(key, r))
    },
  }
}

/** a rest frame: every draw of the shutter at one pose */
async function restFrame(session, inbox, tag, i, from, { grain }) {
  const times = Array.from({ length: MIN_DRAWS }, (_, k) => from + 1 + (k / MIN_DRAWS) * (SHUTTER * 1000) / FPS)
  return renderFrame(session, inbox, { tag, i, times, jitter: jitterOf(MIN_DRAWS), anchor: MIN_DRAWS / 2, ids: true, send: true, grain, seed: 0 })
}

async function savePng(rgb, width, height, file) {
  await sharp(Buffer.from(rgb.buffer, rgb.byteOffset, rgb.byteLength), { raw: { width, height, channels: 3 } }).png({ compressionLevel: 6 }).toFile(file)
}

/** THE STILL OF A NODE: stood at once, one rest frame; and a second one a second
    of the world later, which is what the joins may have to carry */
async function exportStill(session, inbox, node, out, opts) {
  const t = await standAt(session.page, node)
  const pending = await session.page.evaluate(() => window.__forge.state().texturesPending)
  const tag = `still ${node.id} ${session.framing}`
  const a = await restFrame(session, inbox, tag, 0, t, opts)
  // what the frame drew: a still shot while the machine is loaded can come
  // out with fewer bodies built, which these counts give away
  const drew = await session.page.evaluate(() => ({ ...(({ draws, tris }) => ({ draws, tris }))(window.__forge.state()), meshes: window.__naExport.mounted().meshes }))
  const t2 = await session.page.evaluate(() => { for (let k = 0; k < 30; k++) window.__pre.step(); return window.__pre.virtualTime() })
  const b = await restFrame(session, inbox, `${tag} later`, 0, t2, opts)
  let moved = 0, sum = 0, max = 0
  for (let k = 0; k < a.frame.rgb.length; k++) {
    const d = Math.abs(a.frame.rgb[k] - b.frame.rgb[k])
    if (d) { moved++; sum += d; if (d > max) max = d }
  }
  const { width, height } = session.stage
  const stem = node.id.replace(/[:/]/g, (c) => (c === ':' ? '-' : '.'))
  const dir = join(out, 'stills', session.framing)
  mkdirSync(join(dir, 'master'), { recursive: true })
  const masterFile = join(dir, 'master', `${stem}.part.png`)
  await savePng(a.frame.rgb, width, height, masterFile)
  const master = address(masterFile, 'png')
  const [rw, rh] = STILL_RUNG[session.framing]
  const rungDir = join(dir, `${rw}x${rh}`)
  mkdirSync(rungDir, { recursive: true })
  const rungFile = join(rungDir, `${stem}.part.png`)
  await sharp(master.file).resize(rw, rh, { fit: 'fill', kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(rungFile)
  return {
    node: node.id, framing: session.framing, raw: sha256(a.frame.rgb), pendingAtRest: pending, drew, size: [width, height],
    cam: a.report.cam, master, rung: address(rungFile, 'png'),
    aSecondLater: { share: round((100 * moved) / a.frame.rgb.length, 4), mean: moved ? round(sum / moved, 2) : 0, max },
    paintedOverCanvas: await session.page.evaluate(chromeProof),
  }
}

/** the camera as the replay prints it: eye, rotation and lens to four decimals */
const printOf = (cam) => [...cam.p.map((v) => round(v)), ...cam.r.map((v) => round(v)), round(cam.fov)].join(',')

/** A CLIP WALKED ONCE UNDER THE CLOCK, KEEPING NOTHING: a room is dressed in
    slices and a machine is built as the eye walks up, so every body a clip can
    show is built before the first still is kept (the capture's round trip). */
async function silentWalk(page, from, to, motion, take = null) {
  // THE MOUNT RULE's set: every body a frame of the walk draws, the departure's and the arrival's included
  if (take) await page.evaluate((tag) => window.__naExport.record(tag), take)
  await page.evaluate((n) => window.__naFilm.place(n), from)
  await page.evaluate(() => { for (let k = 0; k < 3; k++) window.__pre.step() })
  const asked = await page.evaluate(([a, b, m]) => window.__naFilm.walk(a, b, m), [from, to, motion])
  if (!asked) throw new Error(`${from.id} to ${to.id}: the rail refused the silent walk`)
  const steps = await page.evaluate(async () => {
    let n = 0, began = false
    for (; n < 4000; n++) {
      window.__pre.step()
      const walking = window.__naFilm.state().walking
      if (walking) began = true
      if (began && !walking) break
      if (n % 30 === 29) await new Promise((r) => setTimeout(r, 0))
    }
    for (let k = 0; k < 10; k++) window.__pre.step()
    return n
  })
  const bodies = take ? await page.evaluate(() => window.__naExport.record(null)) : null
  return { steps, bodies }
}

/** THE CLIP: rest at the departure, the leg on its own clock, rest at the arrival. */
async function exportClip(session, inbox, edge, nodes, track, out, opts) {
  // the clip's bodies stand from before its first frame (the rule off: the wing's own streaming)
  const held = opts.mount === 'held' ? await session.page.evaluate((tag) => window.__naExport.hold(tag), edge.id) : null
  try {
    return await keepClip(session, inbox, edge, nodes, track, out, opts, held)
  } finally {
    if (held !== null) await session.page.evaluate(() => window.__naExport.hold(null))
  }
}

async function keepClip(session, inbox, edge, nodes, track, out, opts, held) {
  const { page, framing, stage } = session
  const from = nodes.get(edge.from), to = nodes.get(edge.to)
  const tag = `${edge.id} ${framing}`
  const lateBefore = session.record.late.length, chromeBefore = session.record.chrome.length
  const errorsBefore = session.record.errors.length, projectionBefore = session.record.projection.length
  const starvedBefore = await page.evaluate(() => window.__pre.starved())
  const t0 = await standAt(page, from)
  const armed = await page.evaluate(() => window.__naExport.arm())
  const pendingAtRest = await page.evaluate(() => window.__forge.state().texturesPending)
  const paintedOverCanvas = await page.evaluate(chromeProof)
  const refusal = []
  if (pendingAtRest !== 0) refusal.push(`${pendingAtRest} textures in flight at rest (M49)`)
  if (armed.casters > CASTER_CEILING) refusal.push(`${armed.casters} shadow-casting lights over the ceiling of ${CASTER_CEILING} (M50)`)
  if (refusal.length && !opts.force) return { clip: edge.id, framing, refused: refusal, mount: { rule: opts.mount, held } }
  const predicted = track.arrivedAt + 2
  const stem = edge.stem
  const dir = join(out, framing)
  const encoder = openEncoder(framing, predicted, dir, stem, stage)
  const frames = []
  const cells = cellSet()
  let floorCeilingMax = 0
  const began = Date.now()
  const put = async (i, res, meta) => {
    await encoder.write(Buffer.from(res.frame.rgb.buffer, res.frame.rgb.byteOffset, res.frame.rgb.byteLength))
    const fc = frameCells(cells, res.frame)
    floorCeilingMax = Math.max(floorCeilingMax, fc.floorCeiling)
    const print = printOf(res.report.cam)
    const nearM = nearDepth(res.frame)
    // the camera at full precision beside its print: another renderer can take the same eye
    const cam = { p: res.report.cam.p, q: res.report.cam.q, fov: res.report.cam.fov }
    frames.push({ i, sha256: sha256(res.frame.rgb), print, cam, draws: res.report.drawn, walking: res.report.walking, mounted: res.report.mounted, ms: res.report.ms, nearM, floorCeiling: round(fc.floorCeiling, 4), ...meta })
    if (opts.keep.has(i) || i === 0) await savePng(res.frame.rgb, stage.width, stage.height, join(opts.frameDir, `${stem}-${framing}-f${String(i).padStart(4, '0')}.png`))
    return nearM
  }
  /* ONE DRAWN SET INSIDE A CLIP: the first frame that draws another set than
     the clip's first refuses it, unless --force renders it on and keeps the
     refusal in the sidecar */
  let changedAt = null
  const drawnSetHolds = async (i, res) => {
    if (changedAt !== null || res.report.mounted.signature === frames[0].mounted.signature) return true
    const c = res.report.mounted.changed ?? {}
    changedAt = { i, meshes: res.report.mounted.meshes, added: c.added ?? [], removed: c.removed ?? [], addedCount: c.addedCount ?? 0, removedCount: c.removedCount ?? 0 }
    refusal.push(`the drawn set changed inside the clip at frame ${i}: ${changedAt.addedCount} added (${changedAt.added.slice(0, 3).join(', ')}), ${changedAt.removedCount} removed (${changedAt.removed.slice(0, 3).join(', ')})`)
    if (opts.force) return true
    await encoder.abort()
    return false
  }
  // frame 0: the departure at rest
  const f0 = await restFrame(session, inbox, tag, 0, t0, opts)
  let nearM = await put(0, f0, { motion: 0, over: false, wall: Date.now() - began })
  // the press, and the leg taken at the instant it was asked for
  const asked = await page.evaluate(([a, b, m]) => window.__naFilm.walk(a, b, m), [from, to, edge.motion])
  if (!asked) throw new Error(`${tag}: the rail refused the walk`)
  const origin = await page.evaluate(() => {
    for (let k = 0; k < 3 && !window.__naFilm.state().walking; k++) window.__pre.advance(0)
    return { t: window.__pre.virtualTime(), walking: window.__naFilm.state().walking }
  })
  if (!origin.walking) throw new Error(`${tag}: the leg never began`)
  /* THE CLIP STARTS WHERE THE EYE STARTS MOVING, by the replay's own rule: a
     leading frame whose print still repeats the still's is not kept (a walk
     easing in moves less than the print's last digit), so both runners
     number the same instant of the leg alike */
  const stillPrint = frames[0].print
  let last = -1, j = 0, idle = 0
  for (let i = 1; i < predicted + 60; i++) {
    const m = motionOf(track.prints, Math.min(j + 1, track.arrivedAt), stage.height, nearM)
    const { n, over } = drawsFor(m.px)
    const t = Date.now()
    const res = await renderFrame(session, inbox, { tag, i, times: shutterTimes(origin.t, i, n), jitter: jitterOf(n), anchor: n / 2, ids: true, send: true, grain: opts.grain, seed: j + 1 })
    if (j === 0 && printOf(res.report.cam) === stillPrint) {
      if (++idle > 40) throw new Error(`${tag}: the leg never got under way`)
      continue
    }
    j++
    nearM = await put(j, res, { motion: round(m.px, 2), turnPx: round(m.turn, 2), walkPx: round(m.walk, 2), over, wall: Date.now() - t, legFrame: i })
    if (!(await drawnSetHolds(j, res))) {
      return { clip: edge.id, framing, refused: refusal, mount: { rule: opts.mount, held }, mountedChanges: [changedAt], framesRendered: frames.length }
    }
    if (res.report.walking.every((w) => !w)) {
      last = j
      await savePng(res.frame.rgb, stage.width, stage.height, join(opts.frameDir, `${stem}-${framing}-last.png`))
      break
    }
  }
  if (last < 0) throw new Error(`${tag}: the leg never came to rest`)
  await encoder.close()
  const files = {}
  for (const r of encoder.rungs) files[r.rung] = address(r.file, 'mp4')
  const late = session.record.late.slice(lateBefore)
  const starved = (await page.evaluate(() => window.__pre.starved())) - starvedBefore
  const signatures = new Set(frames.map((f) => f.mounted.signature))
  // the browser's track against the replay's, frame for frame
  const replayPrints = [...track.prints, ...track.tail]
  let maxDeviation = 0
  for (const f of frames) {
    const want = replayPrints[Math.min(f.i, replayPrints.length - 1)]
    if (!want) continue
    const a = parse(f.print), b = parse(want)
    for (let k = 0; k < 7; k++) {
      let d = Math.abs(a[k] - b[k])
      if (k >= 3 && k <= 5) d = Math.min(d, Math.abs(Math.abs(d) - 2 * Math.PI))
      maxDeviation = Math.max(maxDeviation, d)
    }
  }
  const seconds = (Date.now() - began) / 1000
  return {
    clip: edge.id, framing, kinds: edge.kinds, stem, frames: frames.length, arrivedAt: last - 1, predicted,
    replay: { arrivedAt: track.arrivedAt, key: track.key },
    joins: { first: frames[0].sha256, last: frames[frames.length - 1].sha256 },
    track: { maxDeviation: round(maxDeviation, 6) },
    projectionThrows: session.record.projection.length - projectionBefore,
    requestsAfterClock: late.length, lateRequests: late.slice(0, 6),
    chromeImagesAfterClock: session.record.chrome.length - chromeBefore,
    mountedChanges: frames.filter((f) => f.mounted.changed).map((f) => ({ i: f.i, meshes: f.mounted.meshes, ...f.mounted.changed })),
    starvedSteps: starved, pageErrors: session.record.errors.length - errorsBefore,
    pendingAtRest, paintedOverCanvas, mountedSetChanges: signatures.size - 1, casters: armed.casters, bodies: armed.bodies,
    mount: { rule: opts.mount, held, drawn: frames[0].mounted.meshes, stoodAtFirst: frames[0].mounted.stood, stoodAtLast: frames[frames.length - 1].mounted.stood },
    floorCeilingMax: round(floorCeilingMax, 4), refused: refusal,
    draws: frames.reduce((s, f) => s + f.draws, 0), over: frames.filter((f) => f.over).length,
    fastest: frames.reduce((b, f) => ((f.motion ?? 0) > (b.motion ?? 0) ? f : b), frames[0]).i,
    seconds, secondsPerFrame: round(seconds / frames.length, 3),
    files, seen: saveSeen(cells, join(out, 'seen', framing), stem), frameRecords: frames,
  }
}

/** the seen set, dilated, kept as its bits (a cell a byte, gzipped): an
    outdoor clip's free air runs to millions of cells */
function saveSeen(cells, dir, stem) {
  const { bits, count } = cells.dilated()
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${stem}.cells.gz`)
  writeFileSync(file, gzipSync(bits))
  return { cells: count, file, box: CELL_BOX, method: 'each id pixel ray to its hit, sky rays on every second pixel to the box, one cell dilated' }
}

/** the depth a frame's nearest tenth of its surfaces stands at */
function nearDepth(frame) {
  const d = []
  for (let k = 0; k < frame.depth.length; k += 3) if (frame.depth[k] > 0 && frame.ids[k] > 0) d.push(frame.depth[k])
  if (!d.length) return 0
  d.sort((a, b) => a - b)
  return d[Math.floor(d.length * 0.1)]
}

/* ---- the keys, where the gate's own module stands in the tree ---- */
async function gateKeys(results, log) {
  const file = join(APP_ROOT, 'forge', 'film', 'keys.mjs')
  if (!existsSync(file)) return { note: 'the gate (W3, forge/film/keys.mjs) is not in this tree: motion from the replay alone' }
  const { treeKeys } = await import(pathToFileURL(file).href)
  const mine = new Map(results.filter((r) => r.seen).map((r) => [`${r.clip} ${r.framing}`, cellNumbers(gunzipSync(readFileSync(r.seen.file)))]))
  const tree = await treeKeys({ log: (s) => log(`  keys: ${s}`), seenOf: undefined })
  // the ID pass's cells replace the frustum where this export saw them
  const { pictureKey } = await import(pathToFileURL(file).href)
  /* the gate recomputes the picture from its own frustum today, so the key it
     holds is that one; the ID pass's key rides beside it for the day the gate
     reads the seen set a sidecar records */
  const out = new Map()
  for (const [at, c] of tree.clips) {
    const cells = mine.get(at)
    out.set(at, { motion: c.motion, picture: c.picture, global: tree.global.key, delivery: tree.delivery.key, ...(cells ? { pictureSeen: pictureKey(cells, tree.world.cells.hashes, c.exposure), seenCells: cells.length, frustumCells: c.seen } : {}) })
  }
  return { tree, keys: out }
}

async function main() {
  const flags = flagsOf(process.argv.slice(2))
  const PORT = Number(flags.get('port') ?? process.env['FORGE_PORT'] ?? 5421)
  const BASE = `http://127.0.0.1:${PORT}`
  const scale = Number(flags.get('scale') ?? 1)
  const runs = Number(flags.get('runs') ?? 1)
  const grain = Number(flags.get('grain') ?? 0)
  const framings = String(flags.get('framings') ?? 'wide,upright').split(',').filter(Boolean)
  const wanted = String(flags.get('clips') ?? 'six')
  const out = resolve(String(flags.get('out') ?? resolve(APP_ROOT, '..', 'film-export')))
  /* `--stage=stills` the stills' own stage; `--stage=stills@0.5` the same
     framings at a share of its size, still at 1.5 device pixels */
  const stageFlag = /^stills(?:@([\d.]+))?$/.exec(String(flags.get('stage') ?? ''))
  const view = stageFlag ? Object.fromEntries(Object.entries(STILL_STAGES).map(([k, v]) => {
    const f = Number(stageFlag[1] ?? 1)
    return [k, { css: { width: Math.round(v.css.width * f), height: Math.round(v.css.height * f) }, dsf: v.dsf }]
  })) : null
  /* stills only: the named nodes stood at once and shot, no clip walked */
  const stillsOnly = flags.has('stills') ? String(flags.get('stills')).split(',').map((s) => s.trim()).filter(Boolean) : null
  const keep = new Set(String(flags.get('keep') ?? '').split(',').filter(Boolean).map(Number))
  const mount = String(flags.get('mount') ?? 'held')
  if (!['held', 'live'].includes(mount)) throw new Error(`--mount is held (the rule) or live (the wing's streaming), not ${mount}`)
  const log = (s) => console.error(s)
  assertBuildFresh()

  const replay = await openReplay()
  const graph = buildGraph(replay.wing)
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const ids = stillsOnly ? [] : wanted === 'six' ? SIX : wanted.split(',').map((s) => s.trim()).filter(Boolean)
  const edges = ids.map((id) => {
    const e = graph.edges.find((x) => x.id === id)
    if (!e) throw new Error(`the graph has no clip ${id}`)
    return e
  })
  const tracks = new Map()
  for (const e of edges) for (const f of framings) tracks.set(`${e.id} ${f}`, replayEdge(replay, graph, e, f, { tail: 2 }))
  const warmNodes = [...new Set(stillsOnly ?? edges.flatMap((e) => [e.from, e.to]))].map((id) => {
    if (!nodes.has(id)) throw new Error(`the graph has no node ${id}`)
    return nodes.get(id)
  })
  log(`${edges.length} clips, ${framings.join(' and ')}, scale ${scale}, ${runs} run(s); the replay at ${replay.wing.loader.revision}`)

  const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', cwd: APP_ROOT })
  log(`preview pid ${server.pid} on ${BASE}`)
  const inbox = inboxOf()
  const sink = await openSink((buf) => inbox.take(buf))
  const all = []
  try {
    await waitForServer(`${BASE}/`)
    const said = await assertServer(BASE)
    log(`server ${said.head.slice(0, 7)}, sink ${sink.url}`)
    for (let run = 1; run <= runs; run++) {
      const runDir = runs > 1 ? join(out, `run-${run}`) : out
      const frameDir = join(runDir, 'frames')
      mkdirSync(frameDir, { recursive: true })
      const browser = await chromium.launch({ args: [...browserArgs(), ...FRAME_TIME_FLAGS] })
      const version = browser.version()
      const results = []
      const stills = []
      try {
        for (const framing of framings) {
          const session = await openSession(browser, framing, { base: BASE, scale, sink, warmNodes, log, view })
          const opts = { grain, keep, frameDir, force: flags.has('force'), mount }
          const before = await session.page.evaluate(() => window.__naExport.mounted().meshes)
          const walked = []
          for (const edge of edges) walked.push(await silentWalk(session.page, nodes.get(edge.from), nodes.get(edge.to), edge.motion, mount === 'held' ? edge.id : null))
          const after = await session.page.evaluate(() => window.__naExport.mounted().meshes)
          log(`  ${framing}: every clip walked once under the clock (${walked.map((w) => w.steps).join(', ')} steps); meshes mounted ${before} before, ${after} after; ${mount === 'held' ? `bodies each clip draws ${walked.map((w) => w.bodies).join(', ')}` : 'the mount rule off'}`)
          for (const node of warmNodes) {
            const s = await exportStill(session, inbox, node, runDir, opts)
            stills.push(s)
            log(`  still ${node.id} ${framing}: ${s.raw.slice(0, 12)}, a second later ${s.aSecondLater.share}% moved (max ${s.aSecondLater.max})`)
          }
          for (const edge of edges) {
            const track = tracks.get(`${edge.id} ${framing}`)
            let r
            try {
              r = await exportClip(session, inbox, edge, nodes, track, runDir, opts)
            } catch (err) {
              r = { clip: edge.id, framing, refused: [`the export failed: ${String(err.message).slice(0, 240)}`] }
            }
            results.push(r)
            if (r.refused?.length && !r.files) { log(`  REFUSED ${edge.id} ${framing}: ${r.refused.join('; ')}`); continue }
            const sf = (id) => stills.find((s) => s.node === id && s.framing === framing)?.raw
            r.joinsAgree = { first: r.joins.first === sf(edge.from), last: r.joins.last === sf(edge.to) }
            log(`  ${edge.id} ${framing}: ${r.frames} frames (the graph ${edge.framings[framing].frames + 1}), ${r.draws} draws, ${r.secondsPerFrame} s a frame; joins ${r.joinsAgree.first}/${r.joinsAgree.last}; track ${r.track.maxDeviation}; late ${r.requestsAfterClock}; mounted changes ${r.mountedSetChanges}; held ${r.mount.held}, stood ${r.mount.stoodAtFirst} at the first frame and ${r.mount.stoodAtLast} at the last`)
          }
          await session.ctx.close()
        }
      } finally {
        await browser.close()
      }
      all.push({ run, dir: runDir, results, stills, version })
    }
  } finally {
    await sink.close()
    server.kill('SIGTERM')
  }

  // ---- the record ----
  const first = all[0]
  const gate = stillsOnly ? { note: 'stills only: no clip, no keys' } : await gateKeys(first.results, log).catch((err) => ({ note: `the gate's keys failed: ${String(err.message).slice(0, 200)}` }))
  const recipe = { mount: mount === 'held' ? 'every body a clip draws stands from its first frame (taken on a silent walk)' : 'the wing\'s own streaming', worldClock: 'pinned: the wind on its loop\'s first frame at rest, whole loops across a leg with the walk', tier: 'max', geometry: 'hero', scale, stage: view ? `stills: ${Object.entries(view).map(([k, v]) => `${k} ${v.css.width}x${v.css.height} CSS at ${v.dsf}`).join(', ')}` : 'film', minDraws: MIN_DRAWS, maxDraws: MAX_DRAWS, shutter: SHUTTER, jitter: 'halton-2-3', average: 'linear light of the display print, one quantisation', grain: grain ? `baked ${grain}, seeded by the frame, the rest frames seed 0` : 'held (laid by the player)', fps: FPS }
  for (const r of first.results) {
    if (!r.files) continue
    const keys = gate.keys?.get(`${r.clip} ${r.framing}`) ?? { motion: r.replay.key, picture: null, global: null, delivery: null }
    const sidecar = {
      format: 'vinci-film-sidecar-v1', exportFormat: EXPORT_FORMAT, clip: r.clip, framing: r.framing,
      renderer: `chromium ${first.version} webgpu, tier max, ${headHere()}`, recipe, keys, keysNote: gate.note ?? null,
      frames: r.frames, joins: r.joins, track: r.track, projectionThrows: r.projectionThrows,
      requestsAfterClock: r.requestsAfterClock, starvedSteps: r.starvedSteps, pageErrors: r.pageErrors, pendingAtRest: r.pendingAtRest,
      paintedOverCanvas: r.paintedOverCanvas, mountedSetChanges: r.mountedSetChanges, casters: r.casters, mount: r.mount,
      chromeImagesAfterClock: r.chromeImagesAfterClock, lateRequests: r.lateRequests, mountedChanges: r.mountedChanges,
      ...(r.framing === 'upright' ? { floorCeilingMax: r.floorCeilingMax } : {}),
      plateTexelNote: 'not measured by the export: the texel line waits for a plate hook',
      seen: r.seen,
      refused: r.refused,
      files: r.files, perFrame: r.frameRecords.map((f) => ({ i: f.i, sha256: f.sha256, draws: f.draws, motion: f.motion ?? 0, turnPx: f.turnPx ?? 0, walkPx: f.walkPx ?? 0, nearM: round(f.nearM ?? 0, 3), floorCeiling: f.floorCeiling, meshes: f.mounted?.meshes, wallMs: f.wall, ms: f.ms, print: f.print, cam: f.cam })),
    }
    mkdirSync(join(first.dir, 'sidecars', r.framing), { recursive: true })
    writeFileSync(join(first.dir, 'sidecars', r.framing, `${r.stem}.json`), JSON.stringify(sidecar, null, 1))
  }
  /* THE RELEASE THE GATE READS (`film-check.mjs --release=<dir>`), where the
     gate stands in the tree: every clip and still with its four keys */
  if (gate.tree) {
    const keysOf = (at, table) => { const k = table.get(at); return k ? { motion: k.motion, picture: k.picture, global: gate.tree.global.key, delivery: gate.tree.delivery.key } : null }
    const stillKeys = new Map([...gate.tree.stills].map(([at, s]) => [at, s]))
    const release = { format: 'vinci-film-release-v1', keysFormat: gate.tree.format, wing: 'vinci', revision: headHere(), renderer: `chromium ${first.version} webgpu, tier max`, fps: FPS, pace: 'walk', global: gate.tree.global.key, delivery: gate.tree.delivery.key, clips: [], stills: [], sampledJoins: [] }
    for (const s of first.stills) {
      const stem = s.node.replace(/[:/]/g, (c) => (c === ':' ? '-' : '.'))
      const sidecar = `sidecars/${s.framing}/stills/${stem}.json`
      const keys = keysOf(`${s.node} ${s.framing}`, stillKeys)
      const rel = (f) => ({ file: f.file.slice(first.dir.length + 1), bytes: f.bytes, sha256: f.sha256 })
      mkdirSync(join(first.dir, 'sidecars', s.framing, 'stills'), { recursive: true })
      writeFileSync(join(first.dir, sidecar), JSON.stringify({ format: 'vinci-film-sidecar-v1', node: s.node, framing: s.framing, renderer: release.renderer, keys, raw: s.raw, pendingAtRest: s.pendingAtRest, pageErrors: 0, paintedOverCanvas: s.paintedOverCanvas }, null, 1))
      release.stills.push({ node: s.node, framing: s.framing, keys, files: { [STILL_RUNG[s.framing].join('x')]: rel(s.rung) }, sidecar })
    }
    for (const r of first.results) {
      if (!r.files) continue
      const files = Object.fromEntries(Object.entries(r.files).map(([rung, f]) => [rung, { file: f.file.slice(first.dir.length + 1), bytes: f.bytes, sha256: f.sha256 }]))
      release.clips.push({ clip: r.clip, framing: r.framing, keys: gate.keys.get(`${r.clip} ${r.framing}`), frames: r.frames, seconds: r.frames / FPS, files, sidecar: `sidecars/${r.framing}/${r.stem}.json` })
    }
    writeFileSync(join(first.dir, 'release.json'), JSON.stringify(release, null, 1))
  }
  const summary = {
    format: EXPORT_FORMAT, head: headHere(), recipe, stages: STAGES, rungs: RUNGS, x264: X264, chromium: first.version,
    keysNote: gate.note ?? 'the gate\'s keys, the picture from this export\'s own seen cells',
    stills: first.stills.map((s) => ({ ...s, cam: undefined })),
    clips: first.results.map((r) => ({ ...r, frameRecords: undefined })),
  }
  if (all.length > 1) {
    const b = all[1]
    summary.proof = first.results.map((r) => {
      const o = b.results.find((x) => x.clip === r.clip && x.framing === r.framing)
      if (!o?.frameRecords || !r.frameRecords) return { clip: r.clip, framing: r.framing, compared: false }
      const n = Math.min(r.frameRecords.length, o.frameRecords.length)
      let same = 0
      for (let k = 0; k < n; k++) if (r.frameRecords[k].sha256 === o.frameRecords[k].sha256) same++
      const mp4 = Object.keys(r.files).map((rung) => ({ rung, same: r.files[rung].sha256 === o.files[rung]?.sha256 }))
      return { clip: r.clip, framing: r.framing, frames: [r.frameRecords.length, o.frameRecords.length], identical: same, mp4 }
    })
    summary.stillProof = first.stills.map((s) => ({ node: s.node, framing: s.framing, same: s.raw === b.stills.find((x) => x.node === s.node && x.framing === s.framing)?.raw }))
  }
  writeFileSync(join(out, 'export.json'), JSON.stringify(summary, null, 1))
  console.log(`\n== the film's export: ${summary.clips.length} clips, scale ${scale}, ${headHere().slice(0, 8)} ==`)
  for (const r of summary.clips) {
    if (!r.files) { console.log(`  REFUSED ${r.clip} ${r.framing}: ${r.refused.join('; ')}`); continue }
    const kb = Object.entries(r.files).map(([rung, f]) => `${rung} ${Math.round((f.bytes * 8) / 1000 / (r.frames / FPS))} kbit/s`).join(', ')
    console.log(`  ${r.clip} ${r.framing}: ${r.frames} frames, ${r.draws} draws (${r.over} over), ${r.secondsPerFrame} s a frame; joins ${r.joinsAgree?.first}/${r.joinsAgree?.last}; track ${r.track.maxDeviation}; late ${r.requestsAfterClock}, starved ${r.starvedSteps}, errors ${r.pageErrors}, pending ${r.pendingAtRest}, mounted changes ${r.mountedSetChanges}, casters ${r.casters}; ${kb}`)
  }
  if (summary.proof) for (const p of summary.proof) console.log(`  proof ${p.clip} ${p.framing}: ${p.identical} / ${p.frames?.[0]} frames identical; mp4 ${p.mp4?.map((m) => `${m.rung} ${m.same}`).join(', ')}`)
  console.log(`  the record: ${join(out, 'export.json')}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
