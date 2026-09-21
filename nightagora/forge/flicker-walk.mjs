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
//
// THE CLOCK IS EVEN. The first reading of this instrument scaled with the
// machine's load: the app's walk runs on wall time, so the same leg came back
// at 24 frames a second under four rendering seats and at 57 with the machine
// to itself, and the same defect was then read over half as many frames of a
// picture that had moved twice as far between them. Two runs were not
// comparable and the gate could not be made hard. So the page is put on a
// frame clock before the cast starts: one virtual step of 1/60 s per real
// animation frame, handed to every `requestAnimationFrame` callback, which is
// where the app's loop takes its `dt` from. A leg is then the same number of
// frames and the pose at frame n is a pure function of n, whatever the
// machine is doing. `performance.now()` still advances inside a frame, capped
// at the step, so a work-budget loop still measures real work; only the frame
// boundary is even. The residual is taken along THAT clock, not the wall's.
// AND THE CAST HOLDS THE REINS: the page may run three frames ahead of the
// screencast and no further, so the encoder no longer decides how much of the
// walk is read. `--wall-clock` puts the old behaviour back for a comparison.
//
// AND IT CAN BE AIMED. `--soffit` keeps, in each frame, only the tiles the
// gate passage's own ceiling prism projects onto; `--region` takes any world
// box; `--aim <place>` takes one of the named places below. A whole-frame
// reading of a walk through a passage is mostly street and court, and the
// owner's sighting is on the ceiling.
//
// AND THE SURFACE MAY COUNT FOR ITSELF. When the page publishes
// `window.__naShadow` (a flat object of counters), it is read on the same
// animation frame as the pose, and the report says what the break did on the
// frames each counter moved on against the frames it did not. A replay from
// the outside guesses which frames a mechanism fired on; this asks.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { APP_ROOT, assertAdapter, assertBackend, assertServer, browserArgs, waitForServer, wingStanding } from './rig.mjs'
import { decodeGrey, pngSize, reader, setTile, TILE, writePng } from './flicker-frames.mjs'

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
/* THE CEILING, NOT THE FRAME. `--region x0,y0,z0,x1,y1,z1` is a world box in
   the app's own coordinates; `--soffit` asks the page for the gate passage's
   own. Only the tiles the box projects onto are read. */
const REGION = (value('region', '') || '').split(',').map(Number).filter((n) => Number.isFinite(n))
const SOFFIT = flag('soffit')
/* how many times each leg is walked: the even clock's own proof */
const RUNS = Math.max(1, Number(value('runs', '1')) || 1)
/* the cell the reading averages over: 32 px reads a surface, a smaller one
   reads an edge that moves by a pixel (`--tile 8`) */
if (value('tile', '')) setTile(Number(value('tile', '32')))
const EVEN = !flag('wall-clock')
const MASK_FRAME = flag('mask-frame')
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
/* the ceiling is real seconds, and one frame at a time the same leg takes
   several times as long in real seconds as it does on the wall clock */
const LEG_CEILING_MS = flag('ahead') && value('ahead', '3') === '1' ? 180_000 : 40_000
/* THE OTHER WAY A VISITOR MOVES THE PICTURE. He presses the next mark and
   the rail carries him, and he also STANDS AND DRAGS THE GAZE. A held gate
   reads a still camera and a walking eye reads a moving body; a swept look is
   neither, and on a floor read at a grazing angle it is the harder test: the
   pixel's footprint turns without the eye travelling. `--drag <station>`
   stands at the station and sweeps the look with the page's own pointer
   input, which is the visitor's own path and not a pose written from
   outside. */
const DRAG_AT = value('drag', '')
const DRAG_STEPS = Math.max(10, Number(value('drag-steps', '90')) || 90)
const DRAG_PX = Number(value('drag-px', '2')) || 2
const DRAG_WAIT_MS = Number(value('drag-wait', '25')) || 25
/** the pace the visitor set, written to the device before the page opens */
const PACE = value('pace', '')
/** the pose has stood when it has not moved for this many frames */
const STAND_FRAMES = 10
const STAND_CEILING_MS = 30_000
const STAND_EPSILON = 1e-5
const ARRIVED_SETTLE_MS = 2200
/** one virtual frame of the even clock */
const STEP_MS = 1000 / 60

/* ---- the even clock ----------------------------------------------------- */

/* Installed after the wing has stood and its warm-up has run, never before:
   the build and the warm walk spend a budget measured in milliseconds, and a
   clock that only moves at a frame boundary would hand them the whole house
   in one frame. From here the museum's own loop sees an even 16.67 ms. */
/* AND THE CAST HOLDS THE REINS. An even clock alone is not enough: the page
   still draws as fast as the machine lets it while the screencast encodes
   1440 by 900 PNGs, so a loaded machine handed back 156 of 725 drawn frames
   in one run and 5 in another, and a reading over a fifth of the frames is
   not the same reading. So the clock is GATED: the page may run a few frames
   ahead of the cast and no further, and every captured frame buys one more.
   The leg then takes as long in real seconds as the machine needs, and comes
   back with the same frames every time. A watchdog grants a frame after three
   seconds of starvation so a stopped cast cannot hang the walk. */
/* AND WITH `--ahead 1` THE WALK IS THE SAME WALK TWICE. Three frames of slack
   let the encoder decide WHICH drawn frames come back, so two runs of one leg
   read different poses at the same frame number and their event counts cannot
   be compared. At one frame of credit the page draws, the cast returns that
   frame, and only then is the next one drawn: every drawn frame is a captured
   frame, and the pose at captured frame n is the pose at drawn frame n. The
   leg then costs as many real seconds as the encoder needs. */
const AHEAD_FRAMES = Math.max(1, Number(value('ahead', '3')) || 3)
const STARVED_MS = 3000
async function installEvenClock(page, step) {
  return page.evaluate(([stepMs, ahead, starvedMs]) => {
    const w = window
    if (w.__even) return { installed: false, why: 'already on the even clock' }
    const realRaf = w.requestAnimationFrame.bind(w)
    const realNow = performance.now.bind(performance)
    const state = {
      step: stepMs, virtual: realNow(), frames: 0, at: realNow(), realNow, dropped: 0,
      gate: false, credit: ahead, ahead, granted: 0, stalls: 0, starved: realNow(),
    }
    w.__even = state
    w.__even.hold = () => {
      state.gate = true
      state.credit = ahead
      state.granted = 0
      state.stalls = 0
      state.starved = realNow()
    }
    w.__even.release = () => {
      state.gate = false
    }
    w.__even.grant = () => {
      state.credit++
      state.granted++
    }
    let seq = 0
    let queue = []
    let pumping = false
    const tick = () => {
      if (state.gate && state.credit <= 0) {
        if (realNow() - state.starved > starvedMs) {
          state.credit = 1
          state.stalls++
          state.starved = realNow()
        }
        realRaf(tick)
        return
      }
      state.starved = realNow()
      if (state.gate) state.credit--
      pumping = false
      state.virtual += stepMs
      state.at = realNow()
      state.frames++
      const due = queue
      queue = []
      for (const [, cb] of due) {
        try {
          cb(state.virtual)
        } catch (e) {
          state.dropped++
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
    // real time inside a frame, capped at the step, so the clock never runs
    // backwards at a boundary and a budget loop still measures real work
    performance.now = () => state.virtual + Math.min(stepMs, realNow() - state.at)
    return { installed: true, step: stepMs, ahead }
  }, [step, AHEAD_FRAMES, STARVED_MS])
}

/* ---- the world box, and the tiles it covers ----------------------------- */

/* THE GATE PASSAGE'S CEILING, as a world prism: the four corners of the
   soffit's own underside and the two heights of its plate. Measured off the
   wing's own factory, not written by hand — the downward faces of the passage
   lining at the passage head — by
   `forge/shots/ceiling-flicker/soffit-box.mjs`, which prints this line again
   from the same `createGatePassage` the app builds. The passage runs on a
   diagonal, so its axis-aligned box would be half again the ceiling it names
   and the quad is what the mask samples. 2.94 by 2.60 m at the head, which is
   the construction's own clear width. `--region x0,y0,z0,x1,y1,z1` overrides
   it with any world box; `--mask-frame` paints the mask over a frame, which
   is how it is checked by eye rather than by this comment. */
const SOFFIT_PRISM = { quad: [[14.996, 18.043], [17.461, 16.443], [18.928, 18.59], [16.463, 20.191]], y: [3.2, 3.36] }
/* THE THREE PLACES THE OWNER NAMED, as world boxes in the app's own
   coordinates, so a run names its place rather than carrying six numbers
   somebody typed. Each is projected per frame, so the rectangle follows its
   target through the leg.
   `grave-shadow`: the gallery's east return, inner face, where the cast edge
   crosses it behind the grave. `supper-block`: the light block at the foot of
   the glazed north front, the box the court seat read the same place with.
   `line-floor`: the line station's floor, the band ahead of the eye that
   stands clear of the card and the row. */
const PLACES = {
  'grave-shadow': { name: "the grave's shadow edge", box: [-61.2, -4.6, 16.05, -50, -0.35, 16.45] },
  /* the two metres of that wall the cast edge actually crosses, for a reading
     that is the edge and almost nothing else */
  'grave-edge': { name: "the grave's shadow edge, close", box: [-57, -2.3, 16.05, -55, -1.3, 16.45] },
  /* the court's own paving between the eye and the grave, which is what a
     cast shadow falls ON at that station */
  'grave-paving': { name: "the court paving at the grave", box: [-57, -6.55, 21, -47, -6.35, 29] },
  'supper-block': { name: 'the block at the foot of the glazed front', box: [-45, -6.6, 33.6, -30, -6.2, 34.3] },
  'line-floor': { name: "the line station's floor", box: [-34.5, -6.36, 44, -25.5, -6.26, 59] },
}
const PLACE = value('aim', '')
if (PLACE && !PLACES[PLACE]) throw new Error(`no such aim: ${PLACE}. One of ${Object.keys(PLACES).join(', ')}`)
const boxAim = (name, box) => ({
  name,
  quad: [[box[0], box[2]], [box[3], box[2]], [box[3], box[5]], [box[0], box[5]]],
  y: [box[1], box[4]],
  box,
})
const AIM =
  REGION.length === 6
    ? boxAim(`world box ${REGION.join(',')}`, REGION)
    : PLACE
    ? boxAim(PLACES[PLACE].name, PLACES[PLACE].box)
    : SOFFIT
    ? { name: 'the gate passage ceiling', ...SOFFIT_PRISM }
    : null

/** the camera's three world axes off an XYZ Euler, exactly as three builds them */
function cameraFrame(pose) {
  const [, px, py, pz, rx, ry, rz, fov] = pose
  const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz)
  const ae = a * e, af = a * f, be = b * e, bf = b * f
  return {
    eye: [px, py, pz],
    right: [c * e, af + be * d, bf - ae * d],
    up: [-c * f, ae - bf * d, be + af * d],
    back: [d, -b * c, a * c],
    tan: Math.tan(((fov || 50) * Math.PI) / 360),
  }
}

/* THE PRISM'S SIX FACES, CLIPPED TO THE EYE AND DRAWN AS TILES. The visitor
   walks right under this ceiling, so at the closest pass half of it is behind
   the camera and has no projection at all: each face is clipped against the
   near plane in world space first, then its triangles are drawn into the tile
   mask. A tile is in the region when its centre falls inside a triangle or a
   triangle's edge crosses it, so a ceiling that fills the frame and a ceiling
   three metres off both come back tight. `--mask-frame` is what proves it. */
const NEAR_M = 0.12
function regionMask(pose, region, w, h, cols, rows, out) {
  out.fill(0)
  if (!pose) return 0
  const { eye, right, up, back, tan } = cameraFrame(pose)
  const aspect = w / h
  const [a, b, c, d] = region.quad
  const [y0, y1] = region.y
  const P = (xz, y) => [xz[0], y, xz[1]]
  const faces = [
    [P(a, y0), P(b, y0), P(c, y0), P(d, y0)],
    [P(a, y1), P(b, y1), P(c, y1), P(d, y1)],
    [P(a, y0), P(b, y0), P(b, y1), P(a, y1)],
    [P(b, y0), P(c, y0), P(c, y1), P(b, y1)],
    [P(c, y0), P(d, y0), P(d, y1), P(c, y1)],
    [P(d, y0), P(a, y0), P(a, y1), P(d, y1)],
  ]
  const depth = (p) => -((p[0] - eye[0]) * back[0] + (p[1] - eye[1]) * back[1] + (p[2] - eye[2]) * back[2])
  const project = (p) => {
    const vx = p[0] - eye[0], vy = p[1] - eye[1], vz = p[2] - eye[2]
    const z = -(vx * back[0] + vy * back[1] + vz * back[2])
    const cx = vx * right[0] + vy * right[1] + vz * right[2]
    const cy = vx * up[0] + vy * up[1] + vz * up[2]
    return [((cx / (z * tan * aspect) + 1) / 2) * w, ((1 - cy / (z * tan)) / 2) * h]
  }
  const put = (sx, sy) => {
    if (!(sx >= 0 && sy >= 0 && sx < w && sy < h)) return
    out[((sy / TILE) | 0) * cols + ((sx / TILE) | 0)] = 1
  }
  for (const face of faces) {
    const kept = []
    for (let i = 0; i < face.length; i++) {
      const A = face[i], B = face[(i + 1) % face.length]
      const da = depth(A), db = depth(B)
      if (da > NEAR_M) kept.push(A)
      if (da > NEAR_M !== db > NEAR_M) {
        const t = (NEAR_M - da) / (db - da)
        kept.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t])
      }
    }
    if (kept.length < 3) continue
    const flat = kept.map(project)
    for (let i = 1; i + 1 < flat.length; i++) {
      const p = flat[0], q = flat[i], r = flat[i + 1]
      const x0 = Math.max(0, Math.min(p[0], q[0], r[0])), x1 = Math.min(w - 1, Math.max(p[0], q[0], r[0]))
      const z0 = Math.max(0, Math.min(p[1], q[1], r[1])), z1 = Math.min(h - 1, Math.max(p[1], q[1], r[1]))
      const side = (A, B, X, Y) => (B[0] - A[0]) * (Y - A[1]) - (B[1] - A[1]) * (X - A[0])
      for (let ty = (z0 / TILE) | 0; ty <= ((z1 / TILE) | 0); ty++)
        for (let tx = (x0 / TILE) | 0; tx <= ((x1 / TILE) | 0); tx++) {
          const cxp = tx * TILE + TILE / 2, cyp = ty * TILE + TILE / 2
          const s1 = side(p, q, cxp, cyp), s2 = side(q, r, cxp, cyp), s3 = side(r, p, cxp, cyp)
          if (!((s1 < 0 || s2 < 0 || s3 < 0) && (s1 > 0 || s2 > 0 || s3 > 0))) put(cxp, cyp)
        }
      // the edges, so a sliver narrower than a tile is still its own region
      for (const [A, B] of [[p, q], [q, r], [r, p]]) {
        const steps = Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / (TILE / 2)) || 1
        for (let s = 0; s <= steps; s++) put(A[0] + ((B[0] - A[0]) * s) / steps, A[1] + ((B[1] - A[1]) * s) / steps)
      }
    }
  }
  let n = 0
  for (let k = 0; k < cols * rows; k++) if (out[k]) n++
  return n
}

/* ---- the capture -------------------------------------------------------- */

/* EVERY FRAME STRAIGHT TO DISK. A leg is ten seconds of composited frames and
   a desktop frame is over a megabyte of PNG: held in an array that is a
   gigabyte of heap for arithmetic that only ever looks at three frames at a
   time. So the cast writes as it receives and keeps the timestamps only. */
/* `lockstep` false lets a repeat buy a frame anyway, which is what a HOLD
   needs: a still page emits the same surface for ever, so in lockstep the
   cast stalls on its own watchdog and the control comes back with one frame
   and no control at all. */
function castToDisk(page, client, dir, lockstep = AHEAD_FRAMES === 1) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const times = []
  const drawn = []
  const strict = lockstep
  let n = 0
  let stopped = false
  /* THE HANDLER WRITES BEFORE IT AWAITS ANYTHING. Awaiting inside it let two
     frames interleave, and a frame in flight past the end of a cast then
     wrote into a folder its own run had already read and removed. */
  /* AND A SURFACE THAT HAS NOT CHANGED IS NOT A FRAME. The cast emits
     whatever the compositor is holding, which on a gated page is the frame
     before the one just drawn; granting on that lets the page run ahead of
     its own pictures again, and at one frame of credit it stalls on a
     surface it has already sent. So in lockstep an exact repeat is counted,
     acked and NOT granted: the next emission carries the new picture, and
     one grant then stands for exactly one drawn frame. */
  let previous = ''
  let stale = 0
  const onFrame = (ev) => {
    if (stopped) return
    const bytes = Buffer.from(ev.data, 'base64')
    const digest = createHash('sha1').update(bytes).digest('hex')
    const repeat = digest === previous
    const grant = !(strict && repeat)
    if (repeat) stale++
    else {
      previous = digest
      const at = join(dir, `f${String(n + 1).padStart(4, '0')}.png`)
      try {
        writeFileSync(at, bytes)
      } catch {
        mkdirSync(dir, { recursive: true })
        writeFileSync(at, bytes)
      }
      n++
      times.push(ev.metadata.timestamp * 1000)
      drawn.push(null)
    }
    void (async () => {
      try {
        await client.send('Page.screencastFrameAck', { sessionId: ev.sessionId })
        // the frame is on disk: the page may draw one more
        if (grant) await client.send('Runtime.evaluate', { expression: 'window.__even&&window.__even.grant()', returnByValue: true })
      } catch {
        /* the cast was stopped while a frame was in flight */
      }
    })()
  }
  let heldFrom = null
  return {
    async start() {
      stopped = false
      client.on('Page.screencastFrame', onFrame)
      // the even clock's own frame number at the moment the gate closes: with
      // one frame of credit, captured frame n is drawn frame heldFrom + n
      heldFrom = await page.evaluate(() => {
        window.__even?.hold()
        return window.__even ? window.__even.frames : null
      })
      await client.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 })
    },
    async stop() {
      stopped = true
      client.off('Page.screencastFrame', onFrame)
      await client.send('Page.stopScreencast')
      const even = await page.evaluate(() => (window.__even ? { granted: window.__even.granted, stalls: window.__even.stalls, frames: window.__even.frames } : null))
      await page.evaluate(() => window.__even?.release())
      return { times, frames: n, even, heldFrom, stale, drawn }
    },
    get count() {
      return n
    },
  }
}

/** the app's own pose, once per animation frame. The stamp stays on the REAL
 * clock, because that is what the cast stamps its frames with; the even
 * clock's own frame number rides beside it as the axis the reading is taken
 * along. */
/* AND WHATEVER THE SURFACE ITSELF COUNTS. A page that publishes
   `window.__naShadow` as a flat object of numbers (a refocus counter, a
   shadow-map invalidation counter, a re-weld counter, a caster count) has
   that object read on the same animation frame as the pose, so the frames a
   mechanism fired on are named by the app rather than replayed from the
   outside. Absent, nothing changes. */
async function startRecorder(page) {
  await page.evaluate(() => {
    const w = window
    const real = w.__even ? w.__even.realNow : performance.now.bind(performance)
    const probe = w.__naShadow && typeof w.__naShadow === 'object' ? Object.keys(w.__naShadow).sort() : null
    w.__walk = { origin: performance.timeOrigin, samples: [], probeKeys: probe }
    const tick = () => {
      const s = w.__forge?.state?.()
      const c = s?.cam
      if (c)
        w.__walk.samples.push([
          real(), c.p[0], c.p[1], c.p[2], c.r[0], c.r[1], c.r[2], c.fov, s.draws, s.tris,
          w.__even ? w.__even.frames : null,
          probe ? probe.map((k) => Number(w.__naShadow[k])) : null,
        ])
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
    w.__walk = { origin: held.origin, samples: [], probeKeys: held.probeKeys }
    return { origin: held.origin, samples: held.samples, probeKeys: held.probeKeys }
  })
}

/** the pose has stood still for ten frames, or the ceiling was reached */
async function waitForStand(page) {
  return page.evaluate(
    ([want, ceiling, eps]) =>
      new Promise((done) => {
        /* the ceiling is real seconds even under the even clock: a page that
           draws at 25 frames a second would otherwise be given two and a half
           times the patience for the same wait */
        const clock = window.__even ? window.__even.realNow : performance.now.bind(performance)
        const pose = () => {
          const c = window.__forge?.state?.().cam
          return c ? [...c.p, ...c.r, c.fov] : null
        }
        const began = clock()
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
          const ms = Math.round(clock() - began)
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
async function readRun(name, dir, allTimes, samples, origin, keepPairs, heldFrom = null, probeKeys = null) {
  const all = readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
  /* A STILL PICTURE HANDS BACK ONE SURFACE. The cast writes only frames that
     differ, so a hold on a page that draws the same pixels for ever comes
     back with one file: the residual cannot be taken and the control is that
     count, not a refusal. */
  if (all.length < 6)
    return {
      error: `the screencast handed back ${all.length} frames`,
      distinct: all.length,
      stood: all.length <= 1 ? 'the picture stood bit for bit' : null,
    }
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
  /* A HOLD WHOSE PICTURE NEVER CHANGES CANNOT BE READ, AND THAT IS THE
     CONTROL. Six frames are the least the residual needs; under it the
     honest number is how many emissions came back and how many of them were
     the same surface to the bit. */
  if (files.length < 6)
    return {
      error: `only ${files.length} of ${all.length} frames were new`,
      framesCast: all.length, distinct: files.length, repeatedFrames: repeats,
      stood: files.length <= 1 ? 'the picture stood bit for bit' : null,
    }
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
    // the counters ride at the end of a sample and are counts, never a ramp
    return a.map((v, j) => (typeof v === 'number' && typeof b[j] === 'number' ? v + (b[j] - v) * k : v))
  }
  for (let n = 0; n < N; n++) pose[n] = poseAt(times[n]) ?? pose[n]
  /* AND WHERE THE CAST HELD THE REINS ONE FRAME AT A TIME, THE POSE IS NOT
     MATCHED BY A CLOCK AT ALL. Captured frame n is drawn frame heldFrom + n,
     so the pose is the sample the app wrote on that very frame, and two runs
     of one leg then carry the same pose at the same frame number to the bit.
     The offset between the two countings is read off the clock match and
     rounded once (a cast may hand back the surface that stood before the
     gate closed), never per frame. */
  let byFrame = null
  if (AHEAD_FRAMES === 1 && EVEN && heldFrom !== null) {
    const held = new Map()
    for (const s of samples) if (Number.isFinite(s[10])) held.set(s[10], s)
    const offsets = []
    for (let n = 0; n < N; n++) {
      const p = pose[n]
      if (p && Number.isFinite(p[10])) offsets.push(Math.round(p[10]) - (heldFrom + kept[n] + 1))
    }
    const shift = offsets.length ? Math.round(median(offsets)) : 0
    const matched = []
    let missing = 0
    for (let n = 0; n < N; n++) {
      const want = heldFrom + kept[n] + 1 + shift
      const s = held.get(want)
      if (s) matched.push(s)
      else { missing++; matched.push(pose[n]) }
    }
    byFrame = { shift, missing, frames: matched.map((p) => (p && Number.isFinite(p[10]) ? p[10] : null)) }
    if (missing <= N * 0.02) for (let n = 0; n < N; n++) pose[n] = matched[n]
  }
  /* THE AXIS THE READING IS TAKEN ALONG. On the even clock the picture moves
     by the app's own frame, not by the wall's millisecond, so the line
     through a tile's two neighbours is drawn in frames. Off it, the wall
     clock is all there is. */
  const even = EVEN && pose.every((p) => p && Number.isFinite(p[10]))
  const clock = even ? pose.map((p) => p[10] * STEP_MS) : times
  const fired = replayRefocus(samples)
  const refocusFrames = new Set()
  for (const i of fired) {
    const n = poseIndex.findIndex((k) => k >= i)
    if (n > 0) refocusFrames.add(n)
  }
  /* AND THE FRAMES THE SURFACE ITSELF SAYS A MECHANISM FIRED ON. Each counter
     is read once a frame; a captured frame whose value differs from the
     previous captured frame's is a frame that mechanism ran on. */
  const probeChanged = {}
  if (probeKeys) {
    for (const [j, key] of probeKeys.entries()) {
      const fires = new Set()
      let previous = null
      for (let n = 0; n < N; n++) {
        const row = pose[n]?.[11]
        if (!Array.isArray(row)) continue
        const v = row[j]
        if (previous !== null && v !== previous) fires.add(n)
        previous = v
      }
      probeChanged[key] = fires
    }
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
    const span = clock[n + 1] - clock[n - 1]
    const w = span > 0 ? (clock[n] - clock[n - 1]) / span : 0.5
    for (let c = 0; c < cells; c++)
      resid[n][c] = means[n][c] - (means[n - 1][c] + (means[n + 1][c] - means[n - 1][c]) * w)
  }

  /* THE REGION, FRAME BY FRAME: which tiles the aimed surface covers in the
     frame the residual was taken from. A tile that is ceiling at one end of
     the leg and court at the other contributes only the frames in which it
     is ceiling, so the spread of a ceiling tile is a ceiling number. */
  const masks = []
  const regionTiles = []
  for (let n = 0; n < N; n++) {
    if (!AIM) {
      masks.push(null)
      continue
    }
    const m = new Uint8Array(cells)
    regionTiles.push(regionMask(n >= first && n <= last ? pose[n] : null, AIM, w, h, cols, rows, m))
    masks.push(m)
  }
  const inAim = (n, c) => !AIM || masks[n][c] === 1

  const spread = new Float64Array(cells)
  const habit = new Float64Array(cells)
  const seen = new Int32Array(cells)
  for (let c = 0; c < cells; c++) {
    const all = []
    for (let n = first + 1; n + 1 <= last; n++) if (inAim(n, c)) all.push(resid[n][c])
    seen[c] = all.length
    const m = all.reduce((s, v) => s + v, 0) / (all.length || 1)
    spread[c] = all.length >= 4 ? Math.sqrt(all.reduce((s, v) => s + (v - m) ** 2, 0) / all.length) : 0
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
    let read = 0
    /* AND WHAT THE AIMED SURFACE WAS WORTH IN LEVELS, not only what it broke
       by: a surface that alternates between two shadings every other frame
       moves its own mean and leaves the residual of that mean behind, which
       is a reading no tile threshold can swallow. */
    let lum = 0
    for (let c = 0; c < cells; c++) {
      if (!inAim(n, c)) continue
      read++
      lum += means[n][c]
      const a = Math.abs(resid[n][c])
      sum += a
      if (a > D2_ABS) over++
    }
    const a = pose[n]
    const b = pose[n + 1]
    breakSeries.push({
      n,
      over,
      tilesRead: read,
      mean: +(sum / (read || 1)).toFixed(3),
      lum: +(lum / (read || 1)).toFixed(3),
      refocus: refocusFrames.has(n),
      movedMm: a && b ? +(Math.hypot(b[1] - a[1], b[2] - a[2], b[3] - a[3]) * 1000).toFixed(1) : null,
      turnedDeg: a && b ? +((Math.abs(b[5] - a[5]) + Math.abs(b[4] - a[4])) * (180 / Math.PI)).toFixed(3) : null,
    })
  }
  /* THE TABLE THE MECHANISM IS NAMED IN: for every counter, the frames it
     moved on against the frames it did not, read on the same series. */
  const probeTest = {}
  for (const key of Object.keys(probeChanged)) {
    const on = breakSeries.filter((s) => probeChanged[key].has(s.n))
    const off = breakSeries.filter((s) => !probeChanged[key].has(s.n))
    probeTest[key] = {
      frames: on.length,
      tilesOverOn: +median(on.map((s) => s.over)).toFixed(1),
      tilesOverOff: +median(off.map((s) => s.over)).toFixed(1),
      meanBreakOn: +median(on.map((s) => s.mean)).toFixed(3),
      meanBreakOff: +median(off.map((s) => s.mean)).toFixed(3),
      worstOn: Math.max(0, ...on.map((s) => s.over)),
    }
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
      if (!inAim(n, c)) continue
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
        fired: Object.keys(probeChanged).filter((key) => probeChanged[key].has(n)),
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
  const middle = Math.floor((first + last) / 2)
  read.into(buf, middle)
  let worstSpread = 0
  for (let c = 0; c < cells; c++) if (spread[c] > worstSpread) worstSpread = spread[c]
  /* THE AIM, PAINTED OVER THE PICTURE. A region written as six numbers is a
     claim about what the reading covers; this is the frame that proves it. */
  if (AIM && MASK_FRAME) {
    const rgb = Buffer.alloc(w * h * 3)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = Math.min(rows - 1, (y / TILE) | 0) * cols + Math.min(cols - 1, (x / TILE) | 0)
        const g = buf[y * w + x]
        const i = (y * w + x) * 3
        rgb[i] = masks[middle][c] ? Math.min(255, g + 70) : Math.round(g * 0.55)
        rgb[i + 1] = masks[middle][c] ? Math.round(g * 0.85) : Math.round(g * 0.55)
        rgb[i + 2] = masks[middle][c] ? Math.round(g * 0.35) : Math.round(g * 0.55)
      }
    await writePng(join(OUT, `${name}-aim.png`), rgb, w, h)
  }
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
  /* only the tiles the reading actually read: aimed at a ceiling, most of the
     frame carries no number at all and its zeros are not a median */
  const readTiles = []
  for (let c = 0; c < cells; c++) if (seen[c] >= 4) readTiles.push(spread[c])
  readTiles.sort((a, b) => a - b)
  const floor = Math.max(1.2, 4 * median(readTiles))
  mask.fill(0)
  for (let c = 0; c < cells; c++) if (seen[c] >= 4 && spread[c] > floor) mask[c] = 1
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
      tilesRead: readTiles.length,
      median: +median(readTiles).toFixed(2),
      p99: readTiles.length ? +readTiles[Math.min(readTiles.length - 1, Math.floor(readTiles.length * 0.99))].toFixed(2) : 0,
      worst: +worstSpread.toFixed(2),
      floor: +floor.toFixed(2),
    },
    aim: AIM
      ? {
          name: AIM.name,
          tilesPerFrame: {
            median: +median(regionTiles.filter((n) => n > 0)).toFixed(1),
            max: Math.max(0, ...regionTiles),
            framesWithNone: regionTiles.filter((n) => n === 0).length,
          },
        }
      : null,
    clock: even ? 'even' : 'wall',
    byFrame: byFrame ? { shift: byFrame.shift, missing: byFrame.missing } : null,
    /* THE WALK ITSELF, so one run may be laid over another frame for frame:
       the drawn frame number and the eye it was drawn from, rounded to a
       tenth of a millimetre and a ten thousandth of a degree. */
    trace: pose.map((p) =>
      p
        ? [
            // counted from the frame the gate closed on, so two runs of one
            // leg are on one axis and not on the page's lifetime
            p[10] === null || heldFrom === null ? null : Math.round(p[10]) - heldFrom,
            +p[1].toFixed(4), +p[2].toFixed(4), +p[3].toFixed(4), +p[4].toFixed(5), +p[5].toFixed(5), +p[6].toFixed(5),
          ]
        : null
    ),
    /* THE LOAD-INDEPENDENT LENGTH OF THE LEG. On the even clock this is the
       number the same leg has to come back with whatever else the machine is
       doing, and the capture rate beside it is what changed instead. */
    virtualFrames: even ? Math.round(pose[last][10] - pose[first][10]) : null,
    regions,
    probe: probeKeys ? { keys: probeKeys, test: probeTest } : null,
    /* THE SERIES ITSELF, so a reading can be taken again off the run rather
       than by walking the leg again: one row a frame with what the frame
       broke by and which counters moved on it. */
    series: breakSeries.map((s) => ({
      n: s.n, over: s.over, tiles: s.tilesRead, mean: s.mean, lum: s.lum, refocus: s.refocus,
      fired: Object.keys(probeChanged).filter((key) => probeChanged[key].has(s.n) && key !== 'checks'),
      movedMm: s.movedMm, turnedDeg: s.turnedDeg,
    })),
    events: events.length,
    /* THE COUNT DIVIDED BY WHAT IT WAS COUNTED OVER. An event count is a
       count over captured frames, so it rises with the capture alone; the
       rate is what two runs may be compared on. */
    eventsPer100: +((100 * events.length) / Math.max(1, last - first)).toFixed(2),
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
  // the pace is the visitor's own and lives on the device
  if (PACE) await page.addInitScript((p) => { try { localStorage.setItem('na-gait-pace', p) } catch { /* the default walks */ } }, PACE)
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
        const clock = window.__even ? window.__even.realNow : performance.now.bind(performance)
        const pose = () => {
          const c = window.__forge?.state?.().cam
          return c ? [...c.p, ...c.r, c.fov] : null
        }
        const began = clock()
        let last = pose()
        let held = 0
        const tick = () => {
          const now = pose()
          held = now && last && now.every((v, i) => Math.abs(v - last[i]) <= eps) ? held + 1 : 0
          last = now ?? last
          if (held >= want || clock() - began >= ceiling) return done(null)
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    [LEG_CEILING_MS, STAND_FRAMES, STAND_EPSILON]
  )
  const { times, even, heldFrom, stale } = await cast.stop()
  const rec = await stopRecorder(page)
  const seconds = +((Date.now() - began) / 1000).toFixed(2)
  const run = await readRun(name, join(RAW, name), times, rec.samples, rec.origin, keepPairs, heldFrom, rec.probeKeys)
  return { leg: `${from} to ${to}`, name, stoodAt, seconds, gate: even, staleEmissions: stale, ...run }
}

/** stand at a station and sweep the look, with the page's own pointer */
async function dragLook(page, client, at, name, keepPairs) {
  const took = await page.evaluate((s) => window.__forge.station?.(s) ?? false, at)
  if (!took) return { drag: at, error: `the frame would not stand at ${at}` }
  await waitForStand(page)
  await page.waitForTimeout(ARRIVED_SETTLE_MS)
  await page.evaluate(() => window.__forge.grain?.(false))
  await page.waitForTimeout(300)
  const cast = castToDisk(page, client, join(RAW, name))
  await startRecorder(page)
  await cast.start()
  const began = Date.now()
  const x0 = Math.round(VP.width / 2), y0 = Math.round(VP.height / 2)
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  // across and a little down: the sweep a visitor makes to read a floor
  for (let i = 1; i <= DRAG_STEPS; i++) {
    await page.mouse.move(x0 - i * DRAG_PX, y0 - Math.round(i * DRAG_PX * 0.18))
    await page.waitForTimeout(DRAG_WAIT_MS)
  }
  await page.mouse.up()
  await page.waitForTimeout(600)
  const { times, even, heldFrom, stale } = await cast.stop()
  const rec = await stopRecorder(page)
  const seconds = +((Date.now() - began) / 1000).toFixed(2)
  const run = await readRun(name, join(RAW, name), times, rec.samples, rec.origin, keepPairs, heldFrom, rec.probeKeys)
  return { leg: `the look swept at ${at}`, drag: at, name, seconds, gate: even, staleEmissions: stale, ...run }
}

/** the same eye, the same length, nobody walking: the instrument's own floor.
 * The passage is a leg and not a station, so the control can be asked for one
 * of the wing's own named compositions (`--view gateway`), which is how the
 * held gate stands its camera there. */
async function holdControl(page, client, at, name, view = '') {
  const took = view
    ? await page.evaluate(
        ([slug, station, composition]) => {
          window.__forge.jump('wing', { slug, station, view: composition })
          return true
        },
        [SLUG, at, view]
      )
    : await page.evaluate((s) => window.__forge.station?.(s) ?? false, at)
  if (!took) return { hold: at, error: `the frame would not stand at ${at}` }
  await waitForStand(page)
  await page.waitForTimeout(ARRIVED_SETTLE_MS)
  await page.evaluate(() => window.__forge.grain?.(false))
  await page.waitForTimeout(300)
  const cast = castToDisk(page, client, join(RAW, name), false)
  await startRecorder(page)
  await cast.start()
  const until = Date.now() + 12000
  while (cast.count < HOLD_FRAMES && Date.now() < until) await page.waitForTimeout(40)
  const { times, even, heldFrom, stale } = await cast.stop()
  const rec = await stopRecorder(page)
  const run = await readRun(name, join(RAW, name), times, rec.samples, rec.origin, null, heldFrom, rec.probeKeys)
  return { hold: at, name, gate: even, staleEmissions: stale, ...run }
}

mkdirSync(OUT, { recursive: true })
const LEGS = (value('leg', 'arrival:courtyard') || 'arrival:courtyard').split(',').map((s) => s.split(':'))
const flags = []
const runs = []
/** the first walk of each leg, kept so the next walk can be laid over it */
const traces = new Map()
let head = 'unknown'
say(`flicker-walk: wing/${SLUG} on port ${PORT}, ${MOBILE ? 'phone' : 'desktop'} ${VP.width}x${VP.height}, tier ${TIER}`)
const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', cwd: APP_ROOT })
let browser = null
try {
  await waitForServer(BASE)
  head = (await assertServer(BASE)).head
  say(`[walk] server ${head.slice(0, 7)}`)
  browser = await chromium.launch({ args: browserArgs() })
  /* A LOCAL SWITCH IS A QUERY, NOT A REBUILD. Separating one candidate from
     another means running the same wing with one thing changed; rebuilding
     between them costs a lock hold each and leaves the runs on different
     bytes. `FLICKER_QUERY=nosnap` hands the page whatever the experiment
     reads, and the query it ran under is in the report. */
  const EXTRA = process.env['FLICKER_QUERY'] ? `&${process.env['FLICKER_QUERY']}` : ''
  if (EXTRA) say(`[walk] query ${EXTRA.slice(1)}`)
  const { page, problems, line } = await openPage(browser, `${BASE}/w/${SLUG}?tier=${TIER}${EXTRA}`)
  for (const p of problems) flags.push(p)
  const stamp = await assertBackend(page)
  assertAdapter(line(), process.env['FORGE_BACKEND'] ?? 'webgpu')
  if (stamp.tier !== TIER) throw new Error(`asked for tier=${TIER}, the app stamped ${stamp.tier}`)
  const client = await page.context().newCDPSession(page)
  const pairs = join(OUT, 'pairs')

  if (EVEN) {
    const even = await installEvenClock(page, STEP_MS)
    say(`[walk] ${even.installed ? `even clock on, ${STEP_MS.toFixed(3)} ms a frame` : even.why}`)
    await page.waitForTimeout(600)
  }
  if (AIM) say(`[walk] aimed at ${AIM.name}`)

  /* the control stands where the aim can see: a hold aimed at a ceiling the
     eye is not under is a zero that proves nothing */
  const HOLD_AT = value('hold', '') || LEGS[0][0]
  const HOLD_VIEW = value('view', '')
  const control = await holdControl(page, client, HOLD_AT, `${TAG}-hold-${HOLD_AT}${HOLD_VIEW ? `-${HOLD_VIEW}` : ''}`, HOLD_VIEW)
  runs.push(control)
  say(
    control.error
      ? `  hold ${control.hold}: ${control.stood ?? control.error}` +
        ` (${control.distinct ?? '?'} distinct surface(s), ${control.staleEmissions ?? 0} emission(s) identical to the one before)`
      : `  hold at ${control.hold}: ${control.frames} frames of ${control.gate?.frames ?? '?'} drawn, ` +
        `${control.events} event(s), spread p99 ${control.spread.p99}, ${control.aim ? `${control.aim.tilesPerFrame.median} tile(s) aimed` : 'whole frame'}`
  )

  for (let pass = 1; pass <= RUNS && DRAG_AT; pass++) {
    const run = await dragLook(page, client, DRAG_AT, `${TAG}-drag-${DRAG_AT}${RUNS > 1 ? `-run${pass}` : ''}`, pairs)
    run.pass = pass
    runs.push(run)
    if (run.error) { flags.push(`${run.drag}: ${run.error}`); say(`  drag at ${run.drag}: ${run.error}`); continue }
    say(
      `  the look swept at ${run.drag}${RUNS > 1 ? ` run ${pass}` : ''}: ${run.frames} frames at ${run.fps} fps` +
        `${run.virtualFrames === null ? '' : `, ${run.virtualFrames} of the even clock`}, ` +
        `the eye moved ${run.eyeStepMm.median} mm a frame, ${run.events} event(s) (${run.eventsPer100} per 100 frames) ` +
        `over ${run.eventTiles} tile(s), spread median ${run.spread.median} p99 ${run.spread.p99}` +
        `${run.aim ? ` over ${run.aim.tilesPerFrame.median} tile(s) a frame` : ''}`
    )
    for (const r of run.regions.slice(0, 3))
      say(`    · spread region ${r.tiles} tiles at [${r.at}] box [${r.box}], mean ${r.meanSpread}, peak ${r.peakSpread}`)
  }
  for (let pass = 1; pass <= RUNS && !DRAG_AT; pass++)
  for (const [from, to] of LEGS) {
    for (const [a, b] of flag('back') || flag('all') ? [[from, to], [to, from]] : [[from, to]]) {
      const run = await walkLeg(page, client, a, b, `${TAG}-${a}-to-${b}${RUNS > 1 ? `-run${pass}` : ''}`, pairs)
      run.pass = pass
      runs.push(run)
      if (run.error) {
        flags.push(`${run.leg}: ${run.error}`)
        say(`  ${run.leg}: ${run.error}`)
        continue
      }
      /* THE WALK LAID OVER THE FIRST WALK OF THE SAME LEG. Two runs are only
         comparable when the eye stood in the same place at the same frame
         number, so the difference is measured and printed rather than
         assumed, and it is the first thing the report is read for. */
      const before = traces.get(run.leg)
      if (!before) traces.set(run.leg, run.trace)
      else {
        const byFrame = new Map(before.filter(Boolean).map((p) => [p[0], p]))
        let shared = 0, mm = 0, deg = 0
        for (const p of run.trace) {
          if (!p) continue
          const q = byFrame.get(p[0])
          if (!q) continue
          shared++
          mm = Math.max(mm, Math.hypot(p[1] - q[1], p[2] - q[2], p[3] - q[3]) * 1000)
          deg = Math.max(deg, Math.max(Math.abs(p[4] - q[4]), Math.abs(p[5] - q[5]), Math.abs(p[6] - q[6])) * 180 / Math.PI)
        }
        run.againstRun1 = { sharedFrames: shared, maxEyeMm: +mm.toFixed(3), maxTurnDeg: +deg.toFixed(4) }
        say(`    · against run 1: ${shared} frame(s) in both, the eye differs by at most ${mm.toFixed(3)} mm and ${deg.toFixed(4)} deg`)
      }
      say(
        `  ${run.leg}${RUNS > 1 ? ` run ${pass}` : ''}: ${run.frames} frames at ${run.fps} fps over ${run.metresWalked} m` +
          `${run.virtualFrames === null ? '' : `, ${run.virtualFrames} of the even clock, ${run.gate?.stalls ?? '?'} stall(s)`}, ` +
          `eye step ${run.eyeStepMm.median} mm median / ${run.eyeStepMm.max} mm max, ` +
          `${run.events} event(s) (${run.eventsPer100} per 100 frames) over ${run.eventTiles} tile(s), ` +
          `spread median ${run.spread.median} p99 ${run.spread.p99}` +
          `${run.byFrame ? `, matched by frame (shift ${run.byFrame.shift}, ${run.byFrame.missing} unmatched)` : ''}` +
          `${run.aim ? ` over ${run.aim.tilesPerFrame.median} tile(s) a frame` : ''}, ` +
          `${run.cascade.eventsOnARefocus} of them on one of ${run.cascade.refocusFramesCaptured} cascade refocus frame(s) (chance ${run.cascade.chance})`
      )
      say(
        `    · break per frame: ${run.cascadeTest.tilesOverOnRefocus} tile(s) over ${D2_ABS} levels on a refocus frame ` +
          `against ${run.cascadeTest.tilesOverOffRefocus} off one, mean ${run.cascadeTest.meanBreakOnRefocus} against ${run.cascadeTest.meanBreakOffRefocus}`
      )
      for (const [key, t] of Object.entries(run.probe?.test ?? {}))
        say(
          `    · ${key} moved on ${t.frames} frame(s): ${t.tilesOverOn} tile(s) over ${D2_ABS} levels against ` +
            `${t.tilesOverOff} off, mean ${t.meanBreakOn} against ${t.meanBreakOff}, worst ${t.worstOn}`
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
/* the traces are the walk itself and they are long: they live beside the
   report, never inside it */
const traceFile = join(OUT, `${TAG}-traces.json`)
writeFileSync(
  traceFile,
  JSON.stringify(runs.filter((r) => r.trace).map((r) => ({ name: r.name, leg: r.leg ?? r.hold, pass: r.pass ?? null, trace: r.trace })))
)
for (const r of runs) delete r.trace
/* the per-frame series is the same size as the trace and belongs beside it */
const seriesFile = join(OUT, `${TAG}${PLACE ? `-${PLACE}` : ''}${process.env['FLICKER_QUERY'] ? `-${process.env['FLICKER_QUERY']}` : ''}-series.json`)
writeFileSync(
  seriesFile,
  JSON.stringify(runs.filter((r) => r.series).map((r) => ({ name: r.name, leg: r.leg ?? r.hold, pass: r.pass ?? null, series: r.series })))
)
for (const r of runs) delete r.series
const report = {
  instrument: 'flicker-walk',
  surface: `wing/${SLUG}`,
  head,
  viewport: MOBILE ? 'phone' : 'desktop',
  stage: [VP.width, VP.height],
  tier: TIER,
  floors: { strideM: STRIDE_M, d2Abs: D2_ABS, d2Factor: D2_FACTOR, eventTiles: EVENT_TILES, tile: TILE },
  clock: EVEN ? { kind: 'even', stepMs: +STEP_MS.toFixed(4) } : { kind: 'wall' },
  aim: AIM,
  query: process.env['FLICKER_QUERY'] ?? '',
  ahead: AHEAD_FRAMES,
  runs,
  events: walks.reduce((s, r) => s + r.events, 0),
  dir: 'forge/shots/flicker-walk',
  traces: traceFile,
  seriesFile,
  flags,
}
report.ok = flags.length === 0
say(`flicker-walk: ${report.events} walking event(s) over ${walks.length} leg(s)`)
process.stdout.write(JSON.stringify(report, null, 2) + '\n')
process.exitCode = flags.length ? 1 : 0
