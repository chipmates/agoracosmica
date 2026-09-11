// THE FLICKER GATE. A still cannot show a shimmer and a sampled strip cannot
// show a z-fight: both live BETWEEN frames. This is the instrument that
// measures what a frame does over time while the visitor is standing still,
// and while a hand turns the gaze.
//
//   node forge/flicker.mjs [port] [lobby | wing <slug>] [--stations a,b|all]
//   FLICKER_VP=mobile node forge/flicker.mjs 5199 wing vinci --json
//   node forge/flicker.mjs 5199 --self-test        (prove the detector fires)
//
// It brings its own preview server, like the motion eye, so it runs on a
// port nothing else is holding.
//
// TWO TESTS, PER STATION.
//
//   STATIC   the camera is held and the app's own clock is frozen, and 30
//            consecutive frames are recorded at whatever rate the tier
//            actually reaches (a CDP screencast, one PNG per composited
//            frame). Per pixel, the temporal standard deviation of luminance
//            over those 30 frames. A still scene that is not still IS the
//            defect: an edge the resolve cannot settle, two coplanar
//            surfaces trading the depth test, a shadow cascade hunting.
//            Reported: the share of pixels over 6 levels, the LONGEST
//            connected region of them (a shimmering edge or a z-fight band
//            reads as a line or a band, not as a scatter), and a heat map.
//
//   DRAG     the look cone crossed in 120 steps. At each step the gaze is
//            set and then HELD while four consecutive frames are recorded;
//            the frames between two steps are dropped. Both of the things
//            this test is after can only be told from the picture moving
//            when the camera is not: a pop-in is a region whose mean jumps
//            while the camera moved less than one pixel there, and a
//            shimmer is an edge pixel alternating over ten levels for more
//            than three frames. So the drag is 120 held readings along one
//            path rather than one continuous sweep.
//
//            THE FIRST READING OF THIS TEST, MEASURED AND KEPT. Read the
//            other way, over the pairs where the camera DID move, this
//            museum's own lobby answers 31 percent of the frame as
//            shimmer. A rotating view slides detail through every tile
//            whose mean holds still, so that number is the picture moving
//            and not an edge failing to settle. It is why the camera is
//            held at each of the 120 directions instead.
//
// THE FILM HAS TO BE HELD STILL. The post chain reseeds its grain every
// frame by design (see src/stack/post.ts), so every pixel of every frame
// moves a little and an instrument with no switch measures the film's own
// tooth. `__forge.grain(false)` takes the dial to zero. The static test runs
// TWICE, once with the film off and once with it on, and both readings are
// in the report; the gate is decided on the film-off reading, because the
// grain is a print, not a fault.
//
// WHAT THE THRESHOLDS ARE. FAIL when the film-off unstable share is over
// 0.5 percent, when any connected unstable region is longer than 40 px, or
// when one pop-in event occurs. WARN when the drag shimmer is over 0.2
// percent. They are the commission's numbers, not measured ones, and every
// run prints its own margin against them so a wing that sits at 0.4 percent
// is visible before it is a failure.
//
// PROVING IT FIRES. `--self-test` builds a fixture of its own (its own tiny
// server, three straight out of node_modules, no post chain) and runs the
// same detector over four scenes: two coplanar quads at one depth with the
// second quad added and then removed, and a drag with a mesh toggled in the
// middle of it and then the same drag without. A clean museum says nothing
// about the instrument; these four runs do.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { closeSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { APP_ROOT, assertAdapter, assertBackend, assertServer, browserArgs, DEFAULT_CONE, waitForServer } from './rig.mjs'

const argv = process.argv.slice(2)
const plain = argv.filter((a) => !a.startsWith('--'))
const SELF_TEST = argv.includes('--self-test')
const KEEP = argv.includes('--keep-frames')
const PORT = Number(plain[0] ?? process.env['FORGE_PORT'] ?? 5199)
const SURFACE = plain[1] ?? process.env['FORGE_SURFACE'] ?? 'lobby'
const WING = SURFACE === 'wing'
const SLUG = WING ? (plain[2] ?? process.env['FORGE_SLUG'] ?? 'vinci') : ''
const ASKED = (argv.find((a) => a.startsWith('--stations='))?.slice(11) ??
  (argv.includes('--stations') ? argv[argv.indexOf('--stations') + 1] : '') ??
  process.env['FLICKER_STATIONS'] ??
  '').trim()
const MOBILE = process.env['FLICKER_VP'] === 'mobile'
const TIER = process.env['FLICKER_TIER'] ?? (MOBILE ? 'calm' : 'hero')
const BASE = `http://localhost:${PORT}`
const VP = MOBILE
  ? { width: 390, height: 844, deviceScaleFactor: 2 }
  : { width: 1512, height: 950, deviceScaleFactor: 1 }
const OUT = join(APP_ROOT, 'forge', 'shots', 'flicker')
const RAW = join(OUT, 'raw')

const say = (line) => process.stderr.write(`${line}\n`)

/* WHAT THE MUSEUM ITSELF ANIMATES. A held camera cannot judge a room that is
   alive by design, so `forge/FLICKER-BASE.json` names the stations whose own
   life is in the frame and why. A named station still gets measured, printed
   and drawn; its STATIC line warns instead of failing, and its pop-in line
   gates like every other. The file's own note carries the rest. */
const LIVING = (() => {
  try {
    return JSON.parse(readFileSync(join(APP_ROOT, 'forge', 'FLICKER-BASE.json'), 'utf8')).living ?? {}
  } catch {
    return {}
  }
})()
const livingWhy = (station) => LIVING[`${WING ? `wing/${SLUG}` : SURFACE}/${station}`] ?? null

/* ---- the numbers the gate is decided on --------------------------------- */
/** consecutive frames per static reading */
const STATIC_FRAMES = 30
/** a pixel is unstable when its temporal sd over those frames is over this */
const SD_LEVELS = 6
/** and the surface fails when that many of its pixels are */
const UNSTABLE_SHARE = 0.005
/** a connected run of unstable pixels longer than this is an edge or a band */
const REGION_PX = 40
/** the drag: 120 gaze directions across the cone */
const DRAG_STEPS = 120
/** consecutive frames held at each of them: four, because the shimmer this
    test is after has to outlast three */
const HOLD_FRAMES = 4
/** a region whose mean jumps this far between two frames the camera was
    held for did not move into the frame, it appeared in it */
const POP_LEVELS = 20
/** an edge pixel alternating over this is shimmering */
const SHIMMER_LEVELS = 10
/** and it has alternated only if it came back to where it started */
const SHIMMER_RETURN = 2
/** over this share of the drag's own pixels the run warns */
const SHIMMER_SHARE = 0.002
/* HOW LONG A GAZE IS HELD BEFORE THE HOLD IS READ, and why it is not zero.
   Measured on the wing, whose frames are bit-identical when the camera is
   held: after `look()` and two animation frames, the screencast still hands
   back TWO frames of the gaze before, and one more that is neither (the
   page's own labels project off the last frame's matrices, so they arrive a
   frame late). Ninety milliseconds after the look, eight frames in a row are
   the same frame. Without this wait a step of camera motion sits inside a
   hold the test calls held, which is 17 to 39 invented pop-ins per walk. */
const SETTLE_MS = 90
const TILE = 32

/* ---- PNG, ffmpeg, and the arithmetic over the frames --------------------- */

/** width and height out of a PNG's IHDR, so no image library is needed */
function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

/* EVERY FRAME AS ONE RAW GREY STREAM, ON DISK. A drag is 240 frames and a
   desktop frame is 1.4 MB of luminance: held in memory that is a third of a
   gigabyte for arithmetic that only ever looks at two frames at a time. So
   ffmpeg writes the whole walk as raw grey to one file and the reader below
   hands out one frame at a time into a buffer it reuses. */
function decodeGrey(dir, raw) {
  return new Promise((done, fail) => {
    const ff = spawn('ffmpeg', [
      '-loglevel', 'error', '-y', '-f', 'image2', '-i', join(dir, 'f%04d.png'),
      '-pix_fmt', 'gray', '-f', 'rawvideo', raw,
    ], { stdio: 'ignore' })
    ff.on('error', fail)
    ff.on('close', () => done(raw))
  })
}

function reader(raw, size) {
  const fd = openSync(raw, 'r')
  const frames = Math.floor(statSync(raw).size / size)
  return {
    frames,
    into(buf, i) {
      readSync(fd, buf, 0, size, i * size)
      return buf
    },
    close() {
      closeSync(fd)
    },
  }
}

/** a PPM out of arithmetic, then ffmpeg makes it a PNG: no image library */
async function writePng(path, rgb, w, h) {
  const ppm = `${path}.ppm`
  writeFileSync(ppm, Buffer.concat([Buffer.from(`P6\n${w} ${h}\n255\n`), rgb]))
  await new Promise((done) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-i', ppm, path], { stdio: 'ignore' })
    ff.on('close', done)
  })
  rmSync(ppm, { force: true })
}

/** per pixel, the temporal standard deviation of luminance over the frames,
    accumulated one frame at a time so no walk is ever held whole */
function temporalSd(read, size) {
  const sum = new Float64Array(size)
  const sq = new Float64Array(size)
  const buf = Buffer.alloc(size)
  for (let n = 0; n < read.frames; n++) {
    read.into(buf, n)
    for (let i = 0; i < size; i++) {
      const v = buf[i]
      sum[i] += v
      sq[i] += v * v
    }
  }
  const n = read.frames
  const sd = new Float32Array(size)
  const mean = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    const m = sum[i] / n
    mean[i] = m
    sd[i] = Math.sqrt(Math.max(0, sq[i] / n - m * m))
  }
  return { sd, mean }
}

/* THE LONGEST CONNECTED REGION, which is the shape half of the reading. A
   scatter of unstable pixels is noise in the capture; a LINE of them is an
   edge the resolve cannot settle, and a BAND of them is two surfaces trading
   the depth test. So the mask is walked into connected regions (eight
   neighbours) and each one is reported by the longer side of its own box. */
function regions(mask, w, h, limit = 12) {
  const seen = new Uint8Array(mask.length)
  const stack = new Int32Array(mask.length)
  const found = []
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    let top = 0
    stack[top++] = start
    seen[start] = 1
    let area = 0
    let x0 = w
    let x1 = -1
    let y0 = h
    let y1 = -1
    while (top) {
      const p = stack[--top]
      const x = p % w
      const y = (p - x) / w
      area++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= w) continue
          const q = ny * w + nx
          if (mask[q] && !seen[q]) {
            seen[q] = 1
            stack[top++] = q
          }
        }
      }
    }
    found.push({ area, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, length: Math.max(x1 - x0 + 1, y1 - y0 + 1) })
  }
  found.sort((a, b) => b.length - a.length || b.area - a.area)
  return found.slice(0, limit)
}

/* THE HEAT MAP. The picture's own luminance, dimmed, so a reader can see
   WHERE the instability sits, with the unstable pixels painted over it:
   amber from the first level of movement, white where it is a defect. */
async function heatMap(path, sd, mean, w, h) {
  const rgb = Buffer.alloc(w * h * 3)
  for (let i = 0; i < sd.length; i++) {
    const base = Math.round(mean[i] * 0.28)
    const t = sd[i] / SD_LEVELS
    let r = base
    let g = base
    let b = base
    if (t > 0.15) {
      const k = Math.min(1, t)
      r = Math.round(base + (255 - base) * Math.min(1, k * 1.4))
      g = Math.round(base + (190 - base) * k)
      b = Math.round(base * (1 - k * 0.8))
      if (t > 1) {
        // over the floor: white, so a defect cannot be read as a warm surface
        const o = Math.min(1, (t - 1) / 2)
        g = Math.round(g + (255 - g) * o)
        b = Math.round(b + (255 - b) * o)
      }
    }
    rgb[i * 3] = r
    rgb[i * 3 + 1] = g
    rgb[i * 3 + 2] = b
  }
  await writePng(path, rgb, w, h)
}

/** where the drag's shimmer and pops accumulated, one cell per tile */
async function tileMap(path, counts, cols, rows, w, h, worst) {
  const rgb = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = counts[Math.min(rows - 1, (y / TILE) | 0) * cols + Math.min(cols - 1, (x / TILE) | 0)]
      const k = worst ? Math.min(1, c / worst) : 0
      const i = (y * w + x) * 3
      rgb[i] = Math.round(24 + 231 * k)
      rgb[i + 1] = Math.round(24 + 160 * k)
      rgb[i + 2] = Math.round(28 * (1 - k))
    }
  }
  await writePng(path, rgb, w, h)
}

/* ---- the capture ---------------------------------------------------------
   A CDP screencast, which hands back one PNG per composited frame at the
   rate the tier actually reaches. `page.screenshot` in a loop would hand
   back one frame per round trip, at a cadence the rig chose rather than the
   one the app runs at, and the static test is a question about the app's
   own frames. Every frame is acked, or the stream stops after two.        */
async function screencast(page, client, want, ms = 12000) {
  const frames = []
  const times = []
  const onFrame = async (ev) => {
    if (frames.length < want) {
      frames.push(Buffer.from(ev.data, 'base64'))
      times.push(ev.metadata.timestamp * 1000)
    }
    try {
      await client.send('Page.screencastFrameAck', { sessionId: ev.sessionId })
    } catch {
      /* the cast was stopped while a frame was in flight */
    }
  }
  client.on('Page.screencastFrame', onFrame)
  await client.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 })
  const until = Date.now() + ms
  while (frames.length < want && Date.now() < until) await page.waitForTimeout(30)
  await client.send('Page.stopScreencast')
  client.off('Page.screencastFrame', onFrame)
  return { frames, times }
}

/** two animation frames, so a shot that follows is a frame the app drew
    after the one before it and not the same composited surface twice */
const nextFrames = (page) =>
  page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
  )

function saveFrames(dir, frames) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  frames.forEach((f, i) => writeFileSync(join(dir, `f${String(i + 1).padStart(4, '0')}.png`), f))
}

/* ---- the two tests ------------------------------------------------------ */

async function staticReading(page, client, dir, film) {
  await page.evaluate((on) => window.__forge.grain?.(on), film)
  await page.waitForTimeout(400)
  const { frames, times } = await screencast(page, client, STATIC_FRAMES)
  if (frames.length < STATIC_FRAMES) return { error: `the screencast handed back ${frames.length} of ${STATIC_FRAMES} frames` }
  const { w, h } = pngSize(frames[0])
  /* THE CAPTURE HAS TO BE REAL FRAMES. A screencast that hands the same
     composited surface back twice would read as perfect stability, so the
     repeats are counted and reported beside every number. */
  const hashes = frames.map((f) => createHash('sha1').update(f).digest('hex'))
  let repeats = 0
  for (let i = 1; i < hashes.length; i++) if (hashes[i] === hashes[i - 1]) repeats++
  saveFrames(dir, frames)
  const raw = `${dir}.gray`
  await decodeGrey(dir, raw)
  const size = w * h
  const read = reader(raw, size)
  if (read.frames !== frames.length) {
    read.close()
    rmSync(raw, { force: true })
    return { error: `ffmpeg decoded ${read.frames} of ${frames.length} frames` }
  }
  const { sd, mean } = temporalSd(read, size)
  read.close()
  if (!KEEP) {
    rmSync(dir, { recursive: true, force: true })
    rmSync(raw, { force: true })
  }
  const mask = new Uint8Array(size)
  let over = 0
  let worstSd = 0
  let total = 0
  for (let i = 0; i < size; i++) {
    if (sd[i] > SD_LEVELS) {
      mask[i] = 1
      over++
    }
    if (sd[i] > worstSd) worstSd = sd[i]
    total += sd[i]
  }
  const found = regions(mask, w, h)
  const span = times.length > 1 ? times[times.length - 1] - times[0] : 0
  return {
    frames: frames.length,
    width: w,
    height: h,
    fps: span ? +(((frames.length - 1) * 1000) / span).toFixed(1) : null,
    repeatedFrames: repeats,
    unstablePixels: over,
    unstableShare: +(over / size).toFixed(6),
    meanSd: +(total / size).toFixed(3),
    worstSd: +worstSd.toFixed(2),
    longestRegionPx: found[0]?.length ?? 0,
    regions: found.slice(0, 6).map((r) => ({ length: r.length, area: r.area, at: [r.x, r.y], box: [r.w, r.h] })),
    sd,
    mean,
  }
}

/* THE DRAG. The cone is crossed in 120 steps, and each step is shot twice
   with the camera held: the held pair is where a pop-in can be told from
   the picture moving, and the pair between two steps is where the shimmer
   is. `pop` is a hook the self-test uses to toggle a mesh in the middle of
   the drag; the museum's own runs pass none. */
async function dragReading(page, client, dir, cone, pop = null) {
  await page.evaluate(() => window.__forge.grain?.(false))
  const [y0, y1] = cone.yaw
  const [p0, p1] = cone.pitch
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const popped = []
  const gaze = []
  let shots = 0
  const keep = (frames) => {
    for (const f of frames) {
      shots++
      writeFileSync(join(dir, `f${String(shots).padStart(4, '0')}.png`), f)
    }
    return frames.length
  }
  const began = Date.now()
  let short = 0
  /* THE FIRST FRAME OF A BURST IS THROWN AWAY, and this is the finding that
     made the pop line usable. A screencast hands back the surface that is
     standing when it starts, and the two animation frames waited out above
     resolve BEFORE the app has drawn the one they asked for, so that first
     frame can still be the gaze from the step before. Kept, it put a whole
     step of camera motion inside a hold the test calls held: this museum's
     own lobby reported 70 pop-ins that way, all of them the picture
     turning. Dropped, the same walk reports what is actually there. */
  const burst = async (n) => (await screencast(page, client, n + 1)).frames.slice(1)
  for (let i = 0; i < DRAG_STEPS; i++) {
    const t = DRAG_STEPS === 1 ? 0 : i / (DRAG_STEPS - 1)
    // one pass across the cone: the yaw crosses it and the pitch rides a
    // slow arc through it, so the drag is a look around and not a pan
    const yaw = y0 + (y1 - y0) * t
    const pitch = p0 + (p1 - p0) * (0.5 - 0.5 * Math.cos(t * Math.PI * 2))
    await page.evaluate(([y, p]) => window.__forge.look(y, p), [yaw, pitch])
    await nextFrames(page)
    await page.waitForTimeout(SETTLE_MS)
    let got = 0
    if (pop && pop.steps.includes(i)) {
      /* THE MESH IS TOGGLED INSIDE THE HOLD, between two frames of the same
         gaze: that is what a pop-in is, and it is the only moment at which
         one can be told from the picture turning. */
      got += keep(await burst(HOLD_FRAMES / 2))
      await page.evaluate(() => window.__flicker.pop())
      popped.push(i)
      // the toggle is a scene change, and a scene change is not a frame
      // until the app has drawn one
      await nextFrames(page)
      got += keep(await burst(HOLD_FRAMES / 2))
    } else {
      got += keep(await burst(HOLD_FRAMES))
    }
    // a hold the cast came up short on is read at the next gaze, not guessed
    if (got < HOLD_FRAMES) short++
    gaze.push({ yaw: +yaw.toFixed(2), pitch: +pitch.toFixed(2), frames: got, at: shots - got })
  }
  await page.evaluate(() => window.__forge.look(0, 0))
  const first = readFileSync(join(dir, 'f0001.png'))
  const { w, h } = pngSize(first)
  const raw = `${dir}.gray`
  await decodeGrey(dir, raw)
  const size = w * h
  const read = reader(raw, size)
  if (read.frames !== shots) {
    read.close()
    rmSync(raw, { force: true })
    return { error: `ffmpeg decoded ${read.frames} of ${shots} frames` }
  }

  const cols = Math.ceil(w / TILE)
  const rows = Math.ceil(h / TILE)
  const cells = cols * rows
  /** one tile's mean, for the pop test, which reads a tile through the hold
      rather than a frame through its tiles */
  const tileMeanAt = (f, c, colCount) => {
    const cx = c % colCount
    const cy = (c / colCount) | 0
    const xEnd = Math.min(w, (cx + 1) * TILE)
    const yEnd = Math.min(h, (cy + 1) * TILE)
    let sum = 0
    let n = 0
    for (let y = cy * TILE; y < yEnd; y++) {
      const row = y * w
      for (let x = cx * TILE; x < xEnd; x++) {
        sum += f[row + x]
        n++
      }
    }
    return sum / n
  }

  const held = []
  for (let i = 0; i < HOLD_FRAMES; i++) held.push(Buffer.alloc(size))
  const tileLevels = new Float64Array(HOLD_FRAMES)
  const counts = new Int32Array(cells)
  const pops = []
  let shimmerPixels = 0
  let steps = 0
  let worstGaze = null
  for (let i = 0; i < DRAG_STEPS; i++) {
    const g = gaze[i]
    if (!g || g.frames < HOLD_FRAMES) continue
    steps++
    for (let k = 0; k < HOLD_FRAMES; k++) read.into(held[k], g.at + k)
    /* THE POP: consecutive frames of ONE gaze, so the camera moved zero
       pixels between them, and a region whose mean STEPS did not move into
       the frame, it appeared in it.

       A step, not a fluctuation. The museum's own fire moves a tile's mean
       by fifty levels and back again inside the same hold, and calling that
       a pop-in would make the line useless in a room with a fire. So the
       hold is read as flat, jump, flat: the frames before the jump agree
       with each other, the frames after agree with each other, and the two
       levels are more than POP_LEVELS apart. A mesh that arrives does
       exactly this; a flame never does. */
    let worst = 0
    let where = null
    let hit = 0
    for (let c = 0; c < cells; c++) {
      for (let k = 0; k < HOLD_FRAMES; k++) tileLevels[k] = tileMeanAt(held[k], c, cols)
      let step = 0
      for (let k = 1; k < HOLD_FRAMES; k++) {
        let before = 0
        let after = 0
        let spread = 0
        for (let j = 0; j < k; j++) before += tileLevels[j]
        before /= k
        for (let j = k; j < HOLD_FRAMES; j++) after += tileLevels[j]
        after /= HOLD_FRAMES - k
        for (let j = 0; j < HOLD_FRAMES; j++)
          spread = Math.max(spread, Math.abs(tileLevels[j] - (j < k ? before : after)))
        const jump = Math.abs(after - before)
        if (jump > POP_LEVELS && spread <= POP_LEVELS / 2 && jump > step) step = jump
      }
      if (step > worst) {
        worst = step
        where = [(c % cols) * TILE, ((c / cols) | 0) * TILE]
      }
      if (step) {
        hit++
        // the drag's map carries both of the things the drag looks for
        counts[c]++
      }
    }
    if (hit) pops.push({ step: i, yaw: g.yaw, pitch: g.pitch, tiles: hit, jump: +worst.toFixed(1), at: where })
    /* THE SHIMMER: a pixel that alternates over ten levels through all four
       frames and lands back where it began, twice over. An edge the resolve
       cannot settle does this; a texture streaming in does not. */
    const [fa, fb, fc, fd] = held
    let alternating = 0
    let unstable = 0
    for (let y = 0; y < h; y++) {
      const row = y * w
      const cRow = ((y / TILE) | 0) * cols
      for (let x = 0; x < w; x++) {
        const k = row + x
        const va = fa[k]
        const vb = fb[k]
        const vc = fc[k]
        const vd = fd[k]
        const m = (va + vb + vc + vd) / 4
        const sd = Math.sqrt(((va - m) ** 2 + (vb - m) ** 2 + (vc - m) ** 2 + (vd - m) ** 2) / 4)
        if (sd > SD_LEVELS) unstable++
        if (
          Math.abs(va - vb) > SHIMMER_LEVELS &&
          Math.abs(vb - vc) > SHIMMER_LEVELS &&
          Math.abs(vc - vd) > SHIMMER_LEVELS &&
          Math.abs(va - vc) <= SHIMMER_RETURN &&
          Math.abs(vb - vd) <= SHIMMER_RETURN
        ) {
          alternating++
          counts[cRow + ((x / TILE) | 0)]++
        }
      }
    }
    shimmerPixels += alternating
    const share = unstable / size
    if (!worstGaze || share > worstGaze.unstableShare)
      worstGaze = { step: i, yaw: g.yaw, pitch: g.pitch, unstableShare: +share.toFixed(6), alternatingPixels: alternating }
  }
  read.close()
  if (!KEEP) {
    rmSync(dir, { recursive: true, force: true })
    rmSync(raw, { force: true })
  }

  let worstCell = 0
  for (let c = 0; c < cells; c++) if (counts[c] > worstCell) worstCell = counts[c]
  const loudest = []
  for (let c = 0; c < cells; c++)
    if (counts[c]) loudest.push({ at: [(c % cols) * TILE, ((c / cols) | 0) * TILE], pixels: counts[c] })
  loudest.sort((a2, b2) => b2.pixels - a2.pixels)
  return {
    steps: DRAG_STEPS,
    stepsRead: steps,
    shortHolds: short,
    frames: shots,
    holdFrames: HOLD_FRAMES,
    seconds: +((Date.now() - began) / 1000).toFixed(1),
    width: w,
    height: h,
    cone,
    popped,
    pops: pops.slice(0, 12),
    popEvents: pops.length,
    shimmerPixels,
    shimmerShare: steps ? +(shimmerPixels / (size * steps)).toFixed(6) : 0,
    shimmerTiles: loudest.slice(0, 6),
    worstGaze,
    counts,
    cols,
    rows,
    worstCell,
  }
}

/* ---- standing where the reading is taken -------------------------------- */

async function openPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: VP.width, height: VP.height }, deviceScaleFactor: VP.deviceScaleFactor })
  const problems = []
  let firstLine = ''
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.text().startsWith('backend=')) firstLine = m.text()
    if (m.type() === 'error') problems.push(`console: ${m.text()}`)
  })
  await page.goto(url)
  await page.waitForFunction(() => Boolean(window.__forge))
  await page.waitForTimeout(2000)
  return { page, problems, line: () => firstLine }
}

/** the lobby's two places a visitor stands and looks around, and a wing's
    own rooms: the sealed spec's stations when a round stands above the app,
    the first, the middle and the last when it does not */
function plan(ids) {
  const named = ASKED && ASKED !== 'all' ? ASKED.split(',').map((s) => s.trim()).filter(Boolean) : null
  if (!WING) {
    const both = [
      { id: 'agora', jump: ['agora', {}] },
      { id: 'wheel', jump: ['wheel', { chapter: 0 }] },
    ]
    return named ? both.filter((s) => named.includes(s.id)) : both
  }
  if (ASKED === 'all') return ids.map((id) => ({ id, station: id }))
  if (ASKED) {
    const named = ASKED.split(',').map((s) => s.trim()).filter(Boolean)
    return named.map((id) => ({ id, station: id }))
  }
  if (ids.length <= 3) return ids.map((id) => ({ id, station: id }))
  const pick = [ids[0], ids[(ids.length / 2) | 0], ids[ids.length - 1]]
  return pick.map((id) => ({ id, station: id }))
}

function verdict(off, drag, living = null) {
  const still = []
  const hard = []
  if (off?.error) hard.push(off.error)
  if (drag?.error) hard.push(drag.error)
  if (off && !off.error) {
    if (off.unstableShare > UNSTABLE_SHARE)
      still.push(`${(off.unstableShare * 100).toFixed(3)} percent of pixels unstable over ${SD_LEVELS} levels, the bar is ${UNSTABLE_SHARE * 100}`)
    if (off.longestRegionPx > REGION_PX)
      still.push(`one unstable region is ${off.longestRegionPx} px long, the bar is ${REGION_PX}`)
  }
  if (drag && !drag.error && drag.popEvents) still.push(`${drag.popEvents} pop-in event(s) with the camera held`)
  const soft = []
  if (drag && !drag.error && drag.shimmerShare > SHIMMER_SHARE)
    soft.push(`drag shimmer ${(drag.shimmerShare * 100).toFixed(3)} percent, the bar is ${SHIMMER_SHARE * 100}`)
  /* A DECLARED STATION LOSES ITS HARD GATE, all of it. A flame that sweeps a
     third of the frame between two held frames reads as a pop-in as surely
     as a mesh arriving late does, so a room that is alive by design cannot
     be failed on either line. What it cannot do is go unmeasured: the
     numbers, the heat maps and the reason are all in the report. */
  if (living) soft.push(...still)
  if (hard.length || (!living && still.length)) return { state: 'FAIL', why: [...hard, ...(living ? [] : still)], soft }
  if (soft.length) return { state: 'WARN', why: soft, soft }
  return { state: 'PASS', why: [], soft, stale: Boolean(living) }
}

/** how much room the reading has before each of its own floors */
function margins(off, drag) {
  return {
    unstableShare: off?.unstableShare === undefined ? null : +(off.unstableShare / UNSTABLE_SHARE).toFixed(3),
    longestRegion: off?.longestRegionPx === undefined ? null : +(off.longestRegionPx / REGION_PX).toFixed(3),
    shimmer: drag?.shimmerShare === undefined ? null : +(drag.shimmerShare / SHIMMER_SHARE).toFixed(3),
  }
}

async function readStation(browser, url, spot, cone, opts = {}) {
  const { page, problems, line } = await openPage(browser, url)
  if (opts.assertApp) {
    const stamp = await assertBackend(page)
    assertAdapter(line(), process.env['FORGE_BACKEND'] ?? 'webgpu')
    if (stamp.tier !== TIER) throw new Error(`asked for tier=${TIER}, the app stamped ${stamp.tier}`)
  }
  /* THE APP'S OWN CLOCK IS FROZEN for the static reading. A fire that
     flickers and a sky that drifts are the museum working, not a fault, and
     an instrument that cannot tell them apart measures the wrong thing.
     What a frozen clock still lets move is the renderer: the resolve, the
     depth test, the shadow cascades. That is the whole subject here. */
  if (opts.freeze !== false) await page.evaluate(() => window.__forge.freeze?.(12.4))
  if (spot.jump) await page.evaluate(([p, o]) => window.__forge.jump(p, o), spot.jump)
  if (spot.station) {
    const took = await page.evaluate((s) => window.__forge.station?.(s) ?? false, spot.station)
    if (!took) {
      await page.close()
      return { station: spot.id, error: `the frame would not stand at ${spot.id}` }
    }
  }
  await page.waitForTimeout(2200)
  const hasSwitch = await page.evaluate(() => typeof window.__forge.grain === 'function')
  const client = await page.context().newCDPSession(page)
  const off = await staticReading(page, client, join(RAW, `${spot.id}-off`), false)
  if (!off.error) {
    await heatMap(join(OUT, `${spot.id}-static.png`), off.sd, off.mean, off.width, off.height)
    delete off.sd
    delete off.mean
  }
  const on = await staticReading(page, client, join(RAW, `${spot.id}-on`), true)
  if (!on.error) {
    await heatMap(join(OUT, `${spot.id}-static-film.png`), on.sd, on.mean, on.width, on.height)
    delete on.sd
    delete on.mean
  }
  const drag = await dragReading(page, client, join(RAW, `${spot.id}-drag`), cone, opts.pop ?? null)
  // a map of nothing is not evidence of nothing, it is a black frame in a
  // packet: the drag's map is written only where the drag found something
  const dragMap = !drag.error && drag.worstCell > 0
  if (dragMap) await tileMap(join(OUT, `${spot.id}-drag.png`), drag.counts, drag.cols, drag.rows, drag.width, drag.height, drag.worstCell)
  delete drag.counts
  await page.close()
  const living = livingWhy(spot.id)
  const v = verdict(off, drag, living)
  return {
    station: spot.id,
    state: v.state,
    why: v.why,
    /* a declaration that turns out to hold a still room is reported, so the
       list in FLICKER-BASE.json cannot grow quietly past what it explains */
    living,
    staleDeclaration: v.stale === true,
    filmSwitch: hasSwitch,
    static: { filmOff: off, filmOn: on },
    drag,
    margins: margins(off, drag),
    problems,
    heatMap: `forge/shots/flicker/${spot.id}-static.png`,
    dragMap: dragMap ? `forge/shots/flicker/${spot.id}-drag.png` : null,
  }
}

/* ---- the fixture that proves the detector fires ------------------------- */

const FIXTURE = `<!doctype html><meta charset="utf-8"><title>flicker fixture</title>
<style>html,body{margin:0;height:100%;background:#05070c;overflow:hidden}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three.webgpu.js","three/webgpu":"/three.webgpu.js","three/tsl":"/three.tsl.js"}}</script>
<script type="module">
import * as THREE from 'three'
const q = new URLSearchParams(location.search)
const ZFIGHT = q.get('zfight') === '1'
const renderer = new THREE.WebGPURenderer({ antialias: false })
renderer.setSize(innerWidth, innerHeight)
document.body.append(renderer.domElement)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 500)
camera.position.set(0, 1.6, 6)
scene.add(new THREE.AmbientLight(0xffffff, 1.4))
const key = new THREE.DirectionalLight(0xffe6c0, 2.2)
key.position.set(4, 6, 5)
scene.add(key)
// a floor and a wall, so the fixture is a room and not a void
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x6b6257 }))
floor.rotation.x = -Math.PI / 2
scene.add(floor)
const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), new THREE.MeshStandardMaterial({ color: 0x8c8375 }))
wall.position.set(0, 6, -12)
scene.add(wall)
for (let i = 0; i < 40; i++) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0x554d44 }))
  b.position.set((i % 8) * 2 - 7, 0.3, -((i / 8) | 0) * 2 - 1)
  scene.add(b)
}
/* TWO COPLANAR QUADS AT ONE DEPTH, and a camera that creeps along its own
   view axis by a fraction of a millimetre per frame. Both cases get the
   creep; only the z-fight case gets the second quad, so what the reading
   sees is the quad and never the motion. The creep is what makes a z-fight
   a TEMPORAL defect: the depth values shift in the last bits, the two
   surfaces trade the depth test pixel by pixel, and the overlap crawls,
   while the picture itself moves about a hundredth of a pixel. */
const a = new THREE.Mesh(new THREE.PlaneGeometry(9, 5, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2f5f8f }))
a.position.set(0, 2.4, -4)
a.rotation.set(-0.5, 0.22, 0)
scene.add(a)
// the same plane, at the same place, cut into a different set of triangles:
// two surfaces whose interpolated depth agrees to the last bits and no
// further, which is what a z-fight actually is
const b = new THREE.Mesh(new THREE.PlaneGeometry(9, 5, 3, 5), new THREE.MeshStandardMaterial({ color: 0xd8b45a }))
b.position.copy(a.position)
b.rotation.copy(a.rotation)
if (ZFIGHT) scene.add(b)
/* THE MESH THE POP TEST TOGGLES: a slab in the middle of the view, added
   between two frames the camera is held for. */
const slab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 0.3), new THREE.MeshStandardMaterial({ color: 0xf0e4cf }))
slab.position.set(0, 1.6, 0.4)
let yaw = 0, pitch = 0
window.__flicker = { pop: () => { slab.parent ? scene.remove(slab) : scene.add(slab) } }
window.__forge = {
  look: (y, p) => { yaw = y * Math.PI / 180; pitch = p * Math.PI / 180 },
  freeze: () => {},
  grain: () => false,
  state: () => ({ phase: 'fixture' }),
}
let n = 0
function frame() {
  requestAnimationFrame(frame)
  camera.position.z = 6 + Math.sin(n++ * 0.7) * 0.00006
  camera.rotation.set(pitch, yaw, 0, 'YXZ')
  renderer.render(scene, camera)
}
renderer.init().then(() => { document.body.dataset.ready = '1'; frame() })
</script>`

/** the fixture's own server: the page above and three's own ESM build */
function fixtureServer(port) {
  const three = join(APP_ROOT, 'node_modules', 'three', 'build')
  return new Promise((done) => {
    const server = createServer((req, res) => {
      const path = (req.url ?? '/').split('?')[0]
      // three's own ESM build, straight out of node_modules (three.webgpu.js
      // imports three.core.js beside it, so the whole folder is reachable)
      if (path.endsWith('.js') && !path.slice(1).includes('/')) {
        res.writeHead(200, { 'content-type': 'text/javascript' })
        res.end(readFileSync(join(three, path.slice(1))))
        return
      }
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(FIXTURE)
    })
    server.listen(port, '127.0.0.1', () => done(server))
  })
}

async function selfTest() {
  const server = await fixtureServer(PORT)
  const browser = await chromium.launch({ args: browserArgs() })
  const runs = []
  try {
    for (const zfight of [true, false]) {
      const { page } = await openPage(browser, `${BASE}/?zfight=${zfight ? 1 : 0}`)
      await page.waitForFunction(() => document.body.dataset['ready'] === '1')
      await page.waitForTimeout(1200)
      const client = await page.context().newCDPSession(page)
      const r = await staticReading(page, client, join(RAW, `self-${zfight ? 'zfight' : 'clean'}`), false)
      if (!r.error) {
        await heatMap(join(OUT, `self-${zfight ? 'zfight' : 'clean'}-static.png`), r.sd, r.mean, r.width, r.height)
        delete r.sd
        delete r.mean
      }
      await page.close()
      runs.push({
        case: zfight ? 'two coplanar quads at one depth' : 'the same scene with the second quad removed',
        expect: zfight ? 'FAIL' : 'PASS',
        got: verdict(r, null).state,
        why: verdict(r, null).why,
        reading: r,
      })
      say(`  ${zfight ? 'z-fight' : 'clean  '}  ${verdict(r, null).state}  ${(r.unstableShare * 100).toFixed(3)} percent unstable, longest region ${r.longestRegionPx} px`)
    }
    for (const popping of [true, false]) {
      const { page } = await openPage(browser, `${BASE}/?zfight=0`)
      await page.waitForFunction(() => document.body.dataset['ready'] === '1')
      await page.waitForTimeout(1200)
      const steps = [30, 62, 95]
      const client = await page.context().newCDPSession(page)
      const d = await dragReading(page, client, join(RAW, `self-${popping ? 'pop' : 'nopop'}`), DEFAULT_CONE, popping ? { steps } : null)
      await page.close()
      const v = verdict(null, d)
      const caught = (d.pops ?? []).map((p) => p.step)
      runs.push({
        case: popping ? 'a mesh toggled mid-drag, at three known steps' : 'the same drag with nothing toggled',
        expect: popping ? 'FAIL' : 'PASS',
        got: v.state,
        toggledAt: popping ? steps : [],
        caughtAt: caught,
        why: v.why,
        reading: { popEvents: d.popEvents, pops: d.pops, shimmerShare: d.shimmerShare },
      })
      say(`  ${popping ? 'pop    ' : 'no pop '}  ${v.state}  ${d.popEvents} pop event(s)${popping ? ` at step(s) ${caught.join(', ')}` : ''}, shimmer ${(d.shimmerShare * 100).toFixed(3)} percent`)
    }
  } finally {
    await browser.close()
    server.close()
  }
  const expected = runs.every((r) => r.got === r.expect) &&
    runs.filter((r) => r.toggledAt?.length).every((r) => r.toggledAt.every((s) => r.caughtAt.includes(s)))
  return { selfTest: runs, expected }
}

/* ---- the run ------------------------------------------------------------ */

mkdirSync(OUT, { recursive: true })
const flags = []
let report = null

if (SELF_TEST) {
  say(`flicker self-test on port ${PORT}: the detector against a fixture of its own`)
  const r = await selfTest()
  report = { surface: 'self-test', viewport: MOBILE ? 'mobile' : 'desktop', ...r }
  if (!r.expected) flags.push('the self-test did not come out as expected: a case the detector must catch, or must not, went the other way')
} else {
  say(`flicker: ${WING ? `wing/${SLUG}` : SURFACE} on port ${PORT}, ${MOBILE ? 'phone' : 'desktop'}, tier ${TIER}`)
  const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', cwd: APP_ROOT })
  const stations = []
  let head = 'unknown'
  try {
    await waitForServer(BASE)
    const said = await assertServer(BASE)
    head = said.head
    say(`[flicker] server ${said.head.slice(0, 7)}`)
    const browser = await chromium.launch({ args: browserArgs() })
    const url = WING ? `${BASE}/w/${SLUG}?tier=${TIER}` : `${BASE}/?tier=${TIER}`
    let ids = []
    if (WING) {
      const { page } = await openPage(browser, url)
      ids = await page.evaluate(() => window.__forge.state().stationIds ?? [])
      await page.close()
    }
    const spots = plan(ids)
    if (!spots.length) flags.push('no station to stand at')
    for (const spot of spots) {
      say(`[flicker] ${spot.id}`)
      const r = await readStation(browser, url, spot, DEFAULT_CONE, { assertApp: true })
      stations.push(r)
      if (r.error) {
        flags.push(`${spot.id}: ${r.error}`)
        say(`  ${spot.id}: ${r.error}`)
        continue
      }
      const off = r.static.filmOff
      const on = r.static.filmOn
      say(
        `  ${r.state}  film off ${(off.unstableShare * 100).toFixed(3)} percent over ${SD_LEVELS} levels, longest region ${off.longestRegionPx} px` +
          ` | film on ${(on.unstableShare * 100).toFixed(3)} percent, mean sd ${on.meanSd} against ${off.meanSd}` +
          ` | drag ${r.drag.popEvents} pop(s), shimmer ${(r.drag.shimmerShare * 100).toFixed(3)} percent` +
          ` | ${off.fps} fps, ${off.repeatedFrames} repeated frame(s)`
      )
      for (const w of r.why) say(`    · ${w}`)
      if (r.living) say(`    · declared living in FLICKER-BASE.json: ${r.living}`)
      if (r.staleDeclaration)
        say(`    · declared living, and nothing moves here: drop ${WING ? `wing/${SLUG}` : SURFACE}/${spot.id} from FLICKER-BASE.json`)
      for (const p of r.problems) flags.push(`${spot.id}: ${p}`)
    }
    await browser.close()
  } catch (err) {
    flags.push(`RIG REFUSED: ${err.message}`)
  } finally {
    server.kill()
  }
  const failed = stations.filter((s) => s.state === 'FAIL' || s.error)
  const warned = stations.filter((s) => s.state === 'WARN')
  const stale = stations.filter((s) => s.staleDeclaration)
  report = {
    surface: WING ? `wing/${SLUG}` : SURFACE,
    head,
    viewport: MOBILE ? 'mobile' : 'desktop',
    tier: TIER,
    floors: {
      staticFrames: STATIC_FRAMES,
      sdLevels: SD_LEVELS,
      unstableShare: UNSTABLE_SHARE,
      regionPx: REGION_PX,
      popLevels: POP_LEVELS,
      shimmerLevels: SHIMMER_LEVELS,
      shimmerShare: SHIMMER_SHARE,
      dragSteps: DRAG_STEPS,
      holdFrames: HOLD_FRAMES,
      settleMs: SETTLE_MS,
      tile: TILE,
    },
    stations,
    dir: 'forge/shots/flicker',
    heatMaps: stations.filter((s) => !s.error).map((s) => s.heatMap),
    living: Object.fromEntries(stations.filter((s) => s.living).map((s) => [s.station, s.living])),
    staleDeclarations: stale.map((s) => s.station),
    state: failed.length ? 'FAIL' : warned.length ? 'WARN' : 'PASS',
    failed: failed.map((s) => s.station),
    warned: warned.map((s) => s.station),
  }
  if (!KEEP) rmSync(RAW, { recursive: true, force: true })
}

report.flags = [...new Set(flags)]
report.ok = report.flags.length === 0 && report.state !== 'FAIL' && report.expected !== false
if (report.flags.length) {
  say('FLICKER FLAGGED:')
  for (const f of report.flags) say(` · ${f}`)
}
say(`flicker: ${report.state ?? (report.ok ? 'PASS' : 'FAIL')}`)
process.stdout.write(JSON.stringify(report, null, 2) + '\n')
process.exitCode = report.ok ? 0 : 1
