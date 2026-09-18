// THE WALKING FLICKER EYE. The gate beside this one (`flicker.mjs`) holds the
// camera and asks what still moves. That is the right question in a room a
// visitor stands in, and the wrong one in a passage a visitor only walks
// through: the defect the owner reported at the gate is a WALKING defect, and
// a held camera passed it four times out of five.
//
//   node forge/flicker-walk.mjs [port] <slug> [--leg a:b] [--back] [--all]
//   FLICKER_VP=mobile FLICKER_TIER=standard node forge/flicker-walk.mjs 5313 vinci
//   node forge/flicker-walk.mjs 5313 vinci --leg arrival:courtyard --keep-frames
//
// It brings its own preview server, like the gate and the motion eye, so it
// runs on a port nothing else is holding.
//
// WHAT IT DOES. The wing is stood at the leg's first station, the film is
// switched off, a recorder inside the page writes the app's own camera pose
// once per animation frame, and a CDP screencast records every composited
// frame while `station()` walks the visitor to the second station. Each frame
// is matched to the pose it was drawn from by the page's own clock. Then the
// leg is walked back, so a defect that only fires in one direction is still
// seen. A HOLD of the same length is recorded first, at the same eye, as the
// control: whatever the detector says about a camera that never moved is what
// the instrument itself contributes.
//
// HOW A DEFECT IS TOLD FROM THE PICTURE MOVING. This is the whole problem. A
// walking eye slides every edge in the frame across every tile, so a tile's
// luminance changes by tens of levels between two frames and none of it is a
// fault. What a walk does NOT do is break the derivative: over 16 ms of a
// stroll a tile's luminance moves smoothly, so its SECOND difference in time
// is small. A shadow cascade that snaps to a new focus, a mip level that
// swaps, two faces that trade the depth test and a body that arrives late all
// do the same thing to one frame and nothing to its neighbours, which is a
// second difference the size of the jump itself. So the reading is
//
//     d2(tile, n) = m(n+1) - 2 m(n) + m(n-1)
//
// against the tile's own habit over the walk (the median |d2| of that tile),
// with an absolute floor under it. A tile that breaks is only reported as an
// EVENT when it breaks together with its neighbours: a surface flickers as a
// surface, while a single tile riding a high-contrast edge is the picture
// turning. The eye's own step between the two frames is printed beside every
// event, so an event that sits on a hitch (the eye jumped further than a
// stride) can be discarded by eye rather than by the instrument's word.
//
// THE FRAMES ARE NOT EVENLY SPACED, and the first reading proved what that
// costs. A screencast of a 1440 px stage comes back at twenty to thirty
// frames a second with intervals between 16 and 90 ms, so a plain second
// difference reads the SAMPLING and not the picture. The difference is
// therefore taken against the straight line through the two neighbours at
// their own timestamps,
//
//     resid(n) = m(n) - [ m(n-1) + (m(n+1) - m(n-1)) * w ],
//     w = (t(n) - t(n-1)) / (t(n+1) - t(n-1))
//
// which is zero for any luminance that rises or falls at a steady rate, at
// any spacing. What is left is the part of the frame that is not on the line
// its neighbours draw: the break.
//
// WHAT THE SPREAD IS. Per tile, the standard deviation of that residual over
// the leg. Not of the step: a walking eye slides the whole picture, so the
// step's spread is high everywhere and says nothing. The residual's spread is
// the number the owner's sighting has to land in, and the map paints it over
// the picture so the reader can see WHERE, not only how much.
//
// AND THE SIGN HAS TO AGREE. An edge crossing a tile breaks the line in
// whatever direction that edge runs, so a cluster of edge tiles breaks in
// every direction at once. A surface whose lighting changes breaks the same
// way all over itself. So an event is a connected cluster whose residuals
// agree in sign, and the share that agrees is printed with it.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { APP_ROOT, assertAdapter, assertBackend, assertServer, browserArgs, waitForServer, wingStanding } from './rig.mjs'
import { decodeGrey, pngSize, reader, TILE, writePng } from './flicker-frames.mjs'

const argv = process.argv.slice(2)
const plain = argv.filter((a) => !a.startsWith('--'))
const flag = (name) => argv.includes(`--${name}`)
const value = (name, fallback = '') => {
  const inline = argv.find((a) => a.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const PORT = Number(plain[0] ?? process.env['FORGE_PORT'] ?? 5199)
const SLUG = plain[1] ?? process.env['FORGE_SLUG'] ?? 'vinci'
const KEEP = flag('keep-frames')
const MOBILE = process.env['FLICKER_VP'] === 'mobile'
const TIER = process.env['FLICKER_TIER'] ?? (MOBILE ? 'standard' : 'hero')
const BASE = `http://localhost:${PORT}`
/* THE FRAMES THIS INSTRUMENT IS READ WITH are the frames the owner's walk is
   read with: 1440 by 900 and 390 by 844. The held gate stands at 1512 by 950
   and both are in the report, so a number from one is never quoted as the
   other's. */
const VP = MOBILE
  ? { width: 390, height: 844, deviceScaleFactor: 2 }
  : { width: 1440, height: 900, deviceScaleFactor: 1 }
/* THE PASSAGE, NOT THE WHOLE LEG. `--near x,z,r` keeps only the frames whose
   eye stands within r metres of (x, z) in the app's own coordinates, so the
   spread map is of the place the owner named and not of seventeen metres of
   street and court around it. */
const NEAR = (value('near', '') || '').split(',').map(Number).filter((n) => Number.isFinite(n))
const OUT = join(APP_ROOT, 'forge', 'shots', 'flicker-walk')
const RAW = join(OUT, 'raw')
const TAG = `${MOBILE ? 'phone' : 'desktop'}-${TIER}`

const say = (line) => process.stderr.write(`${line}\n`)

/* ---- the numbers the reading is decided on ------------------------------ */
/** one notch of the wheel, and the longest the eye may move between two
    frames before the pair is a hitch rather than a walk (rail.ts) */
const STRIDE_M = 0.78
/** a tile breaks when its second difference clears this many levels */
const D2_ABS = 10
/** and clears its own habit over the walk by this factor */
const D2_FACTOR = 8
/** a surface flickers as a surface: this many connected tiles make an event */
const EVENT_TILES = 4
/** and they break the line the same way: the share of one sign in a cluster */
const SIGN_AGREEMENT = 0.8
/** the levels the spread map paints as full heat */
const SPREAD_CEILING = 8
/** how long the hold control runs, and the ceiling on one leg */
const HOLD_FRAMES = 90
const LEG_CEILING_MS = 40_000
/** the pose has stood when it has not moved for this many frames */
const STAND_FRAMES = 10
const STAND_CEILING_MS = 30_000
const STAND_EPSILON = 1e-5
const ARRIVED_SETTLE_MS = 2200

/* ---- the capture -------------------------------------------------------- */

/* EVERY FRAME STRAIGHT TO DISK. A leg is ten seconds of composited frames and
   a desktop frame is over a megabyte of PNG: held in an array that is a
   gigabyte of heap for arithmetic that only ever looks at three frames at a
   time. So the cast writes as it receives and keeps the timestamps only. */
function castToDisk(page, client, dir) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const times = []
  let n = 0
  const onFrame = async (ev) => {
    n++
    writeFileSync(join(dir, `f${String(n).padStart(4, '0')}.png`), Buffer.from(ev.data, 'base64'))
    times.push(ev.metadata.timestamp * 1000)
    try {
      await client.send('Page.screencastFrameAck', { sessionId: ev.sessionId })
    } catch {
      /* the cast was stopped while a frame was in flight */
    }
  }
  return {
    async start() {
      client.on('Page.screencastFrame', onFrame)
      await client.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 })
    },
    async stop() {
      await client.send('Page.stopScreencast')
      client.off('Page.screencastFrame', onFrame)
      return { times, frames: n }
    },
    get count() {
      return n
    },
  }
}

/** the app's own pose, once per animation frame, on the page's own clock */
async function startRecorder(page) {
  await page.evaluate(() => {
    const w = window
    w.__walk = { origin: performance.timeOrigin, samples: [] }
    const tick = () => {
      const s = w.__forge?.state?.()
      const c = s?.cam
      if (c) w.__walk.samples.push([performance.now(), c.p[0], c.p[1], c.p[2], c.r[0], c.r[1], c.r[2], c.fov, s.draws, s.tris])
      w.__walk.raf = requestAnimationFrame(tick)
    }
    w.__walk.raf = requestAnimationFrame(tick)
  })
}

async function stopRecorder(page) {
  return page.evaluate(() => {
    const w = window
    cancelAnimationFrame(w.__walk.raf)
    const held = w.__walk
    w.__walk = { origin: held.origin, samples: [] }
    return { origin: held.origin, samples: held.samples }
  })
}

/** the pose has stood still for ten frames, or the ceiling was reached */
async function waitForStand(page) {
  return page.evaluate(
    ([want, ceiling, eps]) =>
      new Promise((done) => {
        const pose = () => {
          const c = window.__forge?.state?.().cam
          return c ? [...c.p, ...c.r, c.fov] : null
        }
        const began = performance.now()
        let last = pose()
        if (!last) {
          done({ stood: false, why: 'this surface reports no camera pose', ms: 0 })
          return
        }
        let held = 0
        const tick = () => {
          const now = pose()
          const still = Boolean(now) && now.every((v, i) => Math.abs(v - last[i]) <= eps)
          held = still ? held + 1 : 0
          last = now ?? last
          const ms = Math.round(performance.now() - began)
          if (held >= want) return done({ stood: true, ms })
          if (ms >= ceiling) return done({ stood: false, why: `the pose was still moving after ${ms} ms`, ms })
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    [STAND_FRAMES, STAND_CEILING_MS, STAND_EPSILON]
  )
}

/* ---- the arithmetic over one captured run ------------------------------- */

/** every tile's mean luminance in one frame */
function tileMeans(buf, w, h, cols, rows, out) {
  out.fill(0)
  const counts = new Int32Array(cols * rows)
  for (let y = 0; y < h; y++) {
    const row = y * w
    const cRow = ((y / TILE) | 0) * cols
    for (let x = 0; x < w; x++) {
      const c = cRow + ((x / TILE) | 0)
      out[c] += buf[row + x]
      counts[c]++
    }
  }
  for (let c = 0; c < out.length; c++) out[c] /= counts[c] || 1
  return out
}

const median = (values) => {
  if (!values.length) return 0
  const a = Float64Array.from(values).sort()
  const mid = a.length >> 1
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

/** connected tiles, eight neighbours, as boxes */
function clusterTiles(mask, cols, rows) {
  const seen = new Uint8Array(mask.length)
  const stack = new Int32Array(mask.length)
  const found = []
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    let top = 0
    stack[top++] = start
    seen[start] = 1
    let n = 0
    let x0 = cols
    let x1 = -1
    let y0 = rows
    let y1 = -1
    const members = []
    while (top) {
      const p = stack[--top]
      const x = p % cols
      const y = (p - x) / cols
      n++
      members.push(p)
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= rows) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= cols) continue
          const q = ny * cols + nx
          if (mask[q] && !seen[q]) {
            seen[q] = 1
            stack[top++] = q
          }
        }
      }
    }
    found.push({ tiles: n, members, at: [x0 * TILE, y0 * TILE], box: [(x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE] })
  }
  found.sort((a, b) => b.tiles - a.tiles)
  return found
}

/** the spread painted over the picture, so the reader sees WHERE it sits */
async function spreadMap(path, spread, base, cols, rows, w, h, worst) {
  const rgb = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = Math.min(rows - 1, (y / TILE) | 0) * cols + Math.min(cols - 1, (x / TILE) | 0)
      const k = worst ? Math.min(1, spread[c] / worst) : 0
      const under = Math.round(base[y * w + x] * 0.3)
      const i = (y * w + x) * 3
      rgb[i] = Math.round(under + (255 - under) * Math.min(1, k * 1.5))
      rgb[i + 1] = Math.round(under + (190 - under) * k)
      rgb[i + 2] = Math.round(under * (1 - k * 0.8))
    }
  }
  await writePng(path, rgb, w, h)
}

/* THE NEAR CASCADE'S OWN REFOCUS, REPLAYED OFF THE POSE LOG. The wing points
   the key light at a spot ten metres ahead of the eye and only moves it when
   that spot has drifted three metres (`vinci/index.ts`, `focusNearCascade`,
   called once per frame). The recorder writes one pose per animation frame,
   which is exactly the cadence that function runs at, so the frames on which
   the cascade snaps can be named BEFORE a single line of the wing is changed.
   If the events land on those frames, the cascade is the mechanism. */
const AHEAD_M = 10
const REFOCUS_M = 3

function replayRefocus(samples) {
  const fired = []
  let focus = null
  for (const [i, s] of samples.entries()) {
    const [, px, py, pz, rx, ry] = s
    const c1 = Math.cos(rx), s1 = Math.sin(rx), c2 = Math.cos(ry), s2 = Math.sin(ry)
    // the camera's own -Z axis, read off an XYZ Euler exactly as three does
    const f = [-s2, s1 * c2, -c1 * c2]
    const ahead = [px + f[0] * AHEAD_M, py + f[1] * AHEAD_M, pz + f[2] * AHEAD_M]
    if (!focus || (ahead[0] - focus[0]) ** 2 + (ahead[1] - focus[1]) ** 2 + (ahead[2] - focus[2]) ** 2 >= REFOCUS_M ** 2) {
      focus = ahead
      fired.push(i)
    }
  }
  return fired
}

/**
 * One captured run, read whole: the spread per tile, the events, and the
 * worst three frame pairs written out beside the report.
 */
async function readRun(name, dir, allTimes, samples, origin, keepPairs) {
  const all = readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
  if (all.length < 6) return { error: `the screencast handed back ${all.length} frames` }
  /* A REPEATED SURFACE IS NOT A FRAME, and on a walk it is a defect in the
     reading. The cast hands the same composited surface back whenever the
     page is slower than the encoder; kept in the series, that repeat breaks
     the line through its neighbours everywhere the picture is moving, which
     is the whole frame, and the detector then reports the capture. So an
     exact repeat is dropped, with its timestamp, and the count is printed. */
  const files = []
  const kept = []
  let repeats = 0
  let previous = ''
  for (const [i, f] of all.entries()) {
    const digest = createHash('sha1').update(readFileSync(join(dir, f))).digest('hex')
    if (digest === previous) {
      repeats++
      continue
    }
    previous = digest
    files.push(f)
    kept.push(i)
  }
  const times = kept.map((i) => allTimes[i])
  if (files.length < 6) return { error: `only ${files.length} of ${all.length} frames were new` }
  const { w, h } = pngSize(readFileSync(join(dir, files[0])))
  for (const [i, f] of all.entries()) if (!kept.includes(i)) rmSync(join(dir, f), { force: true })
  /* ffmpeg reads the folder by its numbering, so the kept frames are renamed
     into one unbroken run before it is asked for the grey stream */
  for (const [n, f] of files.entries()) {
    const want = `k${String(n + 1).padStart(4, '0')}.png`
    if (f !== want) copyFileSync(join(dir, f), join(dir, want))
  }
  for (const f of files) if (!f.startsWith('k')) rmSync(join(dir, f), { force: true })
  const raw = `${dir}.gray`
  await decodeGrey(dir, raw, 'k%04d.png')
  const size = w * h
  const read = reader(raw, size)
  if (read.frames !== files.length) {
    read.close()
    return { error: `ffmpeg decoded ${read.frames} of ${files.length} frames` }
  }
  const names = files.map((_, n) => `k${String(n + 1).padStart(4, '0')}.png`)
  const cols = Math.ceil(w / TILE)
  const rows = Math.ceil(h / TILE)
  const cells = cols * rows
  const N = read.frames

  /* EVERY FRAME MATCHED TO THE POSE IT WAS DRAWN FROM. The cast stamps a
     frame with the wall clock at its swap; the recorder stamps a pose with
     the page's own clock at the animation frame that drew it. One origin
     joins them, and the pose taken is the last one written before the swap. */
  const poseEpoch = samples.map((s) => origin + s[0])
  const pose = []
  const poseIndex = []
  let cursor = 0
  for (let n = 0; n < N; n++) {
    const t = times[n]
    while (cursor + 1 < poseEpoch.length && poseEpoch[cursor + 1] <= t) cursor++
    const i = Math.min(cursor, samples.length - 1)
    poseIndex.push(i)
    pose.push(samples[i] ?? null)
  }
  /* which captured frames carry a cascade refocus: the wing refocuses on an
     animation frame, and the cast keeps only some of them, so a refocus
     belongs to the first captured frame at or after the sample it fired on */
  /* THE POSE IS INTERPOLATED, NOT SNAPPED. The cast and the recorder count
     from the same epoch but not at the same cadence, so taking the nearest
     sample reported two frames of a walk as the same eye. Between the two
     samples that bracket a frame the walk is a straight line to well under a
     millimetre. */
  const poseAt = (t) => {
    let i = 0
    while (i + 1 < poseEpoch.length && poseEpoch[i + 1] <= t) i++
    const a = samples[i]
    const b = samples[i + 1]
    if (!a) return null
    if (!b) return a
    const span = poseEpoch[i + 1] - poseEpoch[i]
    const k = span > 0 ? Math.max(0, Math.min(1, (t - poseEpoch[i]) / span)) : 0
    return a.map((v, j) => v + (b[j] - v) * k)
  }
  for (let n = 0; n < N; n++) pose[n] = poseAt(times[n]) ?? pose[n]
  const fired = replayRefocus(samples)
  const refocusFrames = new Set()
  for (const i of fired) {
    const n = poseIndex.findIndex((k) => k >= i)
    if (n > 0) refocusFrames.add(n)
  }

  /* the window: the frames the reading is taken over */
  let first = 0
  let last = N - 1
  if (NEAR.length === 3) {
    const inside = []
    for (let n = 0; n < N; n++) {
      const a = pose[n]
      if (a && Math.hypot(a[1] - NEAR[0], a[3] - NEAR[1]) <= NEAR[2]) inside.push(n)
    }
    if (inside.length >= 6) {
      first = inside[0]
      last = inside[inside.length - 1]
    }
  }

  const buf = Buffer.alloc(size)
  const means = []
  for (let n = 0; n < N; n++) {
    if (n < first || n > last) {
      means.push(null)
      continue
    }
    read.into(buf, n)
    means.push(tileMeans(buf, w, h, cols, rows, new Float64Array(cells)))
  }

  /* THE RESIDUAL, frame by frame and tile by tile: what the picture did that
     the line through its own neighbours does not explain. */
  const resid = []
  for (let n = 0; n < N; n++) resid.push(new Float64Array(cells))
  for (let n = first + 1; n + 1 <= last; n++) {
    const span = times[n + 1] - times[n - 1]
    const w = span > 0 ? (times[n] - times[n - 1]) / span : 0.5
    for (let c = 0; c < cells; c++)
      resid[n][c] = means[n][c] - (means[n - 1][c] + (means[n + 1][c] - means[n - 1][c]) * w)
  }
  const spread = new Float64Array(cells)
  const habit = new Float64Array(cells)
  for (let c = 0; c < cells; c++) {
    const all = []
    for (let n = first + 1; n + 1 <= last; n++) all.push(resid[n][c])
    const m = all.reduce((s, v) => s + v, 0) / (all.length || 1)
    spread[c] = Math.sqrt(all.reduce((s, v) => s + (v - m) ** 2, 0) / (all.length || 1))
    habit[c] = median(all.map(Math.abs))
  }

  /* THE FRAME'S OWN BREAK, for every frame of the leg: how much of the
     picture left the line its neighbours draw. This is the series the
     cascade question is decided on, because it does not depend on the event
     detector agreeing with anything: if the near cascade's snap is the
     mechanism, the frames the replay names are the frames this series
     spikes on, and no clustering rule can hide that. */
  const breakSeries = []
  for (let n = first + 1; n + 1 <= last; n++) {
    let over = 0
    let sum = 0
    for (let c = 0; c < cells; c++) {
      const a = Math.abs(resid[n][c])
      sum += a
      if (a > D2_ABS) over++
    }
    const a = pose[n]
    const b = pose[n + 1]
    breakSeries.push({
      n,
      over,
      mean: +(sum / cells).toFixed(3),
      refocus: refocusFrames.has(n),
      movedMm: a && b ? +(Math.hypot(b[1] - a[1], b[2] - a[2], b[3] - a[3]) * 1000).toFixed(1) : null,
      turnedDeg: a && b ? +((Math.abs(b[5] - a[5]) + Math.abs(b[4] - a[4])) * (180 / Math.PI)).toFixed(3) : null,
    })
  }
  const onRefocus = breakSeries.filter((s) => s.refocus)
  const offRefocus = breakSeries.filter((s) => !s.refocus)
  const cascadeTest = {
    frames: breakSeries.length,
    refocusFrames: onRefocus.length,
    meanBreakOnRefocus: +median(onRefocus.map((s) => s.mean)).toFixed(3),
    meanBreakOffRefocus: +median(offRefocus.map((s) => s.mean)).toFixed(3),
    tilesOverOnRefocus: +median(onRefocus.map((s) => s.over)).toFixed(1),
    tilesOverOffRefocus: +median(offRefocus.map((s) => s.over)).toFixed(1),
    worstTen: [...breakSeries].sort((a, b) => b.over - a.over || b.mean - a.mean).slice(0, 10),
  }

  /* the events: a frame where connected tiles break the line together, and
     break it the same way */
  const mask = new Uint8Array(cells)
  const events = []
  for (let n = first + 1; n + 1 <= last; n++) {
    mask.fill(0)
    let any = false
    for (let c = 0; c < cells; c++) {
      const a = Math.abs(resid[n][c])
      if (a > D2_ABS && a > D2_FACTOR * Math.max(0.35, habit[c])) {
        mask[c] = 1
        any = true
      }
    }
    if (!any) continue
    for (const cluster of clusterTiles(mask, cols, rows)) {
      if (cluster.tiles < EVENT_TILES) continue
      let worst = 0
      let signed = 0
      let up = 0
      for (const c of cluster.members) {
        const r = resid[n][c]
        signed += r
        if (r > 0) up++
        if (Math.abs(r) > Math.abs(worst)) worst = r
      }
      const agree = Math.max(up, cluster.tiles - up) / cluster.tiles
      if (agree < SIGN_AGREEMENT) continue
      const a = pose[n]
      const b = pose[n + 1]
      const moved = a && b ? Math.hypot(b[1] - a[1], b[2] - a[2], b[3] - a[3]) : null
      const turned = a && b ? (Math.abs(b[5] - a[5]) + Math.abs(b[4] - a[4])) * (180 / Math.PI) : null
      events.push({
        frame: n,
        tiles: cluster.tiles,
        at: cluster.at,
        box: cluster.box,
        peak: +worst.toFixed(1),
        meanResid: +(signed / cluster.tiles).toFixed(2),
        signAgreement: +agree.toFixed(2),
        eyeMovedMm: moved === null ? null : +(moved * 1000).toFixed(1),
        turnedDeg: turned === null ? null : +turned.toFixed(3),
        withinStride: moved === null ? null : moved <= STRIDE_M,
        eye: a ? [+a[1].toFixed(2), +a[2].toFixed(2), +a[3].toFixed(2)] : null,
        refocus: refocusFrames.has(n),
      })
    }
  }
  events.sort((a, b) => b.tiles * Math.abs(b.peak) - a.tiles * Math.abs(a.peak))

  /* the worst three, as frames a reader can open */
  const pairs = []
  if (keepPairs) {
    mkdirSync(keepPairs, { recursive: true })
    for (const [i, e] of events.slice(0, 3).entries()) {
      const written = []
      for (const k of [-1, 0, 1]) {
        const f = names[e.frame + k]
        if (!f) continue
        const out = `${name}-event${i + 1}-f${String(e.frame + k).padStart(4, '0')}.png`
        copyFileSync(join(dir, f), join(keepPairs, out))
        written.push(out)
      }
      pairs.push({ event: i + 1, frame: e.frame, tiles: e.tiles, peak: e.peak, at: e.at, box: e.box, frames: written })
    }
  }

  /* the spread map, over the middle frame of the run */
  read.into(buf, Math.floor((first + last) / 2))
  let worstSpread = 0
  for (let c = 0; c < cells; c++) if (spread[c] > worstSpread) worstSpread = spread[c]
  /* THE MAP IS PAINTED AGAINST A FIXED CEILING, not against its own worst
     tile. Scaled to the maximum, a run whose median is half its peak comes
     back orange from edge to edge and localises nothing. */
  await spreadMap(join(OUT, `${name}-spread.png`), spread, buf, cols, rows, w, h, SPREAD_CEILING)
  copyFileSync(join(dir, names[Math.floor((first + last) / 2)]), join(OUT, `${name}-middle.png`))
  read.close()
  rmSync(raw, { force: true })
  if (!KEEP) rmSync(dir, { recursive: true, force: true })

  /* the loudest regions of the spread map, as connected tiles over the
     run's own median: the place the owner's eye is pointed at */
  const floor = Math.max(1.2, 4 * median(Array.from(spread)))
  mask.fill(0)
  for (let c = 0; c < cells; c++) if (spread[c] > floor) mask[c] = 1
  const regions = clusterTiles(mask, cols, rows)
    .slice(0, 6)
    .map((r) => ({
      tiles: r.tiles,
      at: r.at,
      box: r.box,
      meanSpread: +(r.members.reduce((s, c) => s + spread[c], 0) / r.tiles).toFixed(2),
      peakSpread: +Math.max(...r.members.map((c) => spread[c])).toFixed(2),
    }))

  const span = times.length > 1 ? times[times.length - 1] - times[0] : 0
  const steps = []
  for (let n = 0; n + 1 < N; n++) {
    const a = pose[n]
    const b = pose[n + 1]
    if (a && b) steps.push(Math.hypot(b[1] - a[1], b[2] - a[2], b[3] - a[3]))
  }
  return {
    frames: N,
    window: NEAR.length === 3 ? { near: NEAR, first, last, read: last - first + 1 } : null,
    framesCast: all.length,
    repeatedFrames: repeats,
    width: w,
    height: h,
    fps: span ? +(((N - 1) * 1000) / span).toFixed(1) : null,
    poseSamples: samples.length,
    metresWalked: +steps.reduce((s, v) => s + v, 0).toFixed(2),
    eyeStepMm: {
      median: +(median(steps) * 1000).toFixed(1),
      max: +(Math.max(0, ...steps) * 1000).toFixed(1),
      overStride: steps.filter((s) => s > STRIDE_M).length,
    },
    spread: {
      median: +median(Array.from(spread)).toFixed(2),
      p99: +Array.from(spread).sort((a, b) => a - b)[Math.floor(cells * 0.99)].toFixed(2),
      worst: +worstSpread.toFixed(2),
      floor: +floor.toFixed(2),
    },
    regions,
    events: events.length,
    eventTiles: events.reduce((s, e) => s + e.tiles, 0),
    cascadeTest,
    cascade: {
      refocusesReplayed: fired.length,
      refocusFramesCaptured: refocusFrames.size,
      eventsOnARefocus: events.filter((e) => e.refocus).length,
      /* the share the coincidence would reach by chance, for the reader */
      chance: N > 2 ? +(refocusFrames.size / (N - 2)).toFixed(3) : null,
    },
    worst: events.slice(0, 8),
    pairs,
    maps: [`forge/shots/flicker-walk/${name}-spread.png`, `forge/shots/flicker-walk/${name}-middle.png`],
  }
}

/* ---- the run ------------------------------------------------------------ */

async function openPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: VP.width, height: VP.height }, deviceScaleFactor: VP.deviceScaleFactor })
  const problems = []
  let firstLine = ''
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.text().startsWith('backend=')) firstLine = m.text()
    if (m.type() === 'error') problems.push(`console: ${m.text()}`)
  })
  await page.addInitScript(() => {
    const mark = () => document.body?.classList.add('forge')
    if (document.body) mark()
    else document.addEventListener('DOMContentLoaded', mark)
  })
  await page.goto(url)
  await page.waitForFunction(() => Boolean(window.__forge))
  await page.waitForTimeout(2000)
  if (!(await wingStanding(page))) problems.push('the wing never stood: its entry field did not lift')
  return { page, problems, line: () => firstLine }
}

/** stand at `from`, then walk to `to` with the cast running */
async function walkLeg(page, client, from, to, name, keepPairs) {
  const took = await page.evaluate((s) => window.__forge.station?.(s) ?? false, from)
  if (!took) return { leg: `${from} to ${to}`, error: `the frame would not stand at ${from}` }
  const stoodAt = await waitForStand(page)
  await page.waitForTimeout(ARRIVED_SETTLE_MS)
  await page.evaluate(() => window.__forge.grain?.(false))
  await page.waitForTimeout(300)

  const cast = castToDisk(page, client, join(RAW, name))
  await startRecorder(page)
  await cast.start()
  const began = Date.now()
  const walked = await page.evaluate((s) => window.__forge.station?.(s) ?? false, to)
  if (!walked) {
    await cast.stop()
    await stopRecorder(page)
    return { leg: `${from} to ${to}`, error: `the frame would not walk to ${to}` }
  }
  /* THE CAST RUNS UNTIL THE WALK IS OVER, and the walk is over when the app's
     own pose has stopped moving, not when a guessed delay has run out. */
  await page.evaluate(
    ([ceiling, want, eps]) =>
      new Promise((done) => {
        const pose = () => {
          const c = window.__forge?.state?.().cam
          return c ? [...c.p, ...c.r, c.fov] : null
        }
        const began = performance.now()
        let last = pose()
        let held = 0
        const tick = () => {
          const now = pose()
          held = now && last && now.every((v, i) => Math.abs(v - last[i]) <= eps) ? held + 1 : 0
          last = now ?? last
          if (held >= want || performance.now() - began >= ceiling) return done(null)
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    [LEG_CEILING_MS, STAND_FRAMES, STAND_EPSILON]
  )
  const { times } = await cast.stop()
  const rec = await stopRecorder(page)
  const seconds = +((Date.now() - began) / 1000).toFixed(2)
  const run = await readRun(name, join(RAW, name), times, rec.samples, rec.origin, keepPairs)
  return { leg: `${from} to ${to}`, name, stoodAt, seconds, ...run }
}

/** the same eye, the same length, nobody walking: the instrument's own floor */
async function holdControl(page, client, at, name) {
  const took = await page.evaluate((s) => window.__forge.station?.(s) ?? false, at)
  if (!took) return { hold: at, error: `the frame would not stand at ${at}` }
  await waitForStand(page)
  await page.waitForTimeout(ARRIVED_SETTLE_MS)
  await page.evaluate(() => window.__forge.grain?.(false))
  await page.waitForTimeout(300)
  const cast = castToDisk(page, client, join(RAW, name))
  await startRecorder(page)
  await cast.start()
  const until = Date.now() + 12000
  while (cast.count < HOLD_FRAMES && Date.now() < until) await page.waitForTimeout(40)
  const { times } = await cast.stop()
  const rec = await stopRecorder(page)
  const run = await readRun(name, join(RAW, name), times, rec.samples, rec.origin, null)
  return { hold: at, name, ...run }
}

mkdirSync(OUT, { recursive: true })
const LEGS = (value('leg', 'arrival:courtyard') || 'arrival:courtyard').split(',').map((s) => s.split(':'))
const flags = []
const runs = []
let head = 'unknown'
say(`flicker-walk: wing/${SLUG} on port ${PORT}, ${MOBILE ? 'phone' : 'desktop'} ${VP.width}x${VP.height}, tier ${TIER}`)
const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', cwd: APP_ROOT })
let browser = null
try {
  await waitForServer(BASE)
  head = (await assertServer(BASE)).head
  say(`[walk] server ${head.slice(0, 7)}`)
  browser = await chromium.launch({ args: browserArgs() })
  const { page, problems, line } = await openPage(browser, `${BASE}/w/${SLUG}?tier=${TIER}`)
  for (const p of problems) flags.push(p)
  const stamp = await assertBackend(page)
  assertAdapter(line(), process.env['FORGE_BACKEND'] ?? 'webgpu')
  if (stamp.tier !== TIER) throw new Error(`asked for tier=${TIER}, the app stamped ${stamp.tier}`)
  const client = await page.context().newCDPSession(page)
  const pairs = join(OUT, 'pairs')

  const control = await holdControl(page, client, LEGS[0][0], `${TAG}-hold-${LEGS[0][0]}`)
  runs.push(control)
  say(
    control.error
      ? `  hold ${control.hold}: ${control.error}`
      : `  hold at ${control.hold}: ${control.frames} frames, ${control.events} event(s), spread p99 ${control.spread.p99}`
  )

  for (const [from, to] of LEGS) {
    for (const [a, b] of flag('back') || flag('all') ? [[from, to], [to, from]] : [[from, to]]) {
      const run = await walkLeg(page, client, a, b, `${TAG}-${a}-to-${b}`, pairs)
      runs.push(run)
      if (run.error) {
        flags.push(`${run.leg}: ${run.error}`)
        say(`  ${run.leg}: ${run.error}`)
        continue
      }
      say(
        `  ${run.leg}: ${run.frames} frames at ${run.fps} fps over ${run.metresWalked} m, ` +
          `eye step ${run.eyeStepMm.median} mm median / ${run.eyeStepMm.max} mm max, ` +
          `${run.events} event(s) over ${run.eventTiles} tile(s), spread median ${run.spread.median} p99 ${run.spread.p99}, ` +
          `${run.cascade.eventsOnARefocus} of them on one of ${run.cascade.refocusFramesCaptured} cascade refocus frame(s) (chance ${run.cascade.chance})`
      )
      say(
        `    · break per frame: ${run.cascadeTest.tilesOverOnRefocus} tile(s) over ${D2_ABS} levels on a refocus frame ` +
          `against ${run.cascadeTest.tilesOverOffRefocus} off one, mean ${run.cascadeTest.meanBreakOnRefocus} against ${run.cascadeTest.meanBreakOffRefocus}`
      )
      for (const e of run.worst.slice(0, 3))
        say(
          `    · frame ${e.frame}: ${e.tiles} tiles at [${e.at}] box [${e.box}], peak ${e.peak}, ` +
            `step ${e.meanStep}, the eye moved ${e.eyeMovedMm} mm and turned ${e.turnedDeg} deg`
        )
      for (const r of run.regions.slice(0, 3))
        say(`    · spread region ${r.tiles} tiles at [${r.at}] box [${r.box}], mean ${r.meanSpread}, peak ${r.peakSpread}`)
    }
  }
  await page.close()
} catch (err) {
  flags.push(`RIG REFUSED: ${err.message}`)
  say(`RIG REFUSED: ${err.message}`)
} finally {
  /* A BROWSER LEFT OPEN HOLDS THE PROCESS AND THE GPU. Every exit of this
     script comes through here, including a refusal. */
  if (browser) await browser.close().catch(() => {})
  server.kill()
}
if (!KEEP) rmSync(RAW, { recursive: true, force: true })

const walks = runs.filter((r) => r.leg && !r.error)
const report = {
  instrument: 'flicker-walk',
  surface: `wing/${SLUG}`,
  head,
  viewport: MOBILE ? 'phone' : 'desktop',
  stage: [VP.width, VP.height],
  tier: TIER,
  floors: { strideM: STRIDE_M, d2Abs: D2_ABS, d2Factor: D2_FACTOR, eventTiles: EVENT_TILES, tile: TILE },
  runs,
  events: walks.reduce((s, r) => s + r.events, 0),
  dir: 'forge/shots/flicker-walk',
  flags,
}
report.ok = flags.length === 0
say(`flicker-walk: ${report.events} walking event(s) over ${walks.length} leg(s)`)
process.stdout.write(JSON.stringify(report, null, 2) + '\n')
process.exitCode = flags.length ? 1 : 0
