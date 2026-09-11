// THE MOTION EYE. Stills cannot show motion, so a wing is also walked: a
// real recorded pass along its rail, forward and back, on the real GPU, at
// the hero tier on the desktop and the calm tier on the phone.
//
//   pnpm build && node forge/motion-scan.mjs [slug] [outDir]
//   FORGE_PORT=5199 MOTION_VP=mobile node forge/motion-scan.mjs vinci
//
// It records the walk, dumps the frames, and reports three things a still
// can never show:
//
//   STUCK        the station the walk asked for is not the station standing
//   INTRUSION    the picture collapsed: the frame stopped being a view of a
//                place and became one surface at the near plane, or the
//                clear colour. This is the gate. The wing's law is "no
//                camera inside a wall", and a camera inside a wall renders
//                exactly this: a flat, structureless fill.
//   oscillation  a region that changes and changes back between three
//                frames. A WARNING, never a gate: a camera that travels
//                past a near occluder (a gate arch, a wall, a tree) makes
//                the same signal as a blink, so this number is read by eye
//                and cleared, not failed on.
//
// WHAT THE INTRUSION TEST CAN AND CANNOT SEE. No depth buffer is reachable
// from the rig, so "depth at the frame centre collapses to zero" is
// measured on the PICTURE: over a box that carries no page chrome, the
// spatial spread and the high-frequency energy of the frame, both of which
// a place has and a near surface, an unlit interior or the clear colour do
// not. That catches the collapse, not every intrusion: a TEXTURED wall
// close to the eye still reads as a picture (measured, on this wing: the
// camera driven into the manor's masonry reads sd 5.4 / energy 5.7, well
// over the floors). The geometric half of the same law, the camera's own
// path against the wing's own triangles, belongs to the wing's offline
// checker, and forge/gates.mjs gates on both.
//
// PROVING THE DETECTOR STILL FIRES. A clean wing gives a clean scan, which
// says nothing about the instrument. MOTION_INTRUDE poisons the wing's own
// chunk as it is served, for that run only, so the camera really stands
// where it must never stand:
//
//   MOTION_INTRUDE='(10,-21,1.7,=>(10,-21,-1.5,' \
//     node forge/motion-scan.mjs vinci intruded
//
// (the da Vinci wing's courtyard eye, dropped 1.5 m under the court it
// stands on, which is inside the terrain). The run refuses when the text is
// not in the chunk, so a poisoned run can never pass by missing its target.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { APP_ROOT, assertAdapter, assertBackend, assertServer, browserArgs, waitForServer } from './rig.mjs'

const plain = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const JSON_OUT = process.argv.includes('--json')
const SLUG = plain[0] ?? 'vinci'
const OUT_NAME = plain[1] ?? 'motion'
/* the gates read this scan, so its numbers travel as JSON on stdout and
   every line of progress goes to stderr: a report with a sentence in front
   of its first brace cannot be parsed by the caller */
const out = JSON_OUT ? (line) => process.stderr.write(`${line}\n`) : (line) => console.log(line)
const PORT = Number(process.env['FORGE_PORT'] ?? 5199)
const MOBILE = process.env['MOTION_VP'] === 'mobile'
const TIER = process.env['MOTION_TIER'] ?? (MOBILE ? 'calm' : 'hero')
const INTRUDE = process.env['MOTION_INTRUDE'] ?? ''
const BASE = `http://localhost:${PORT}`
const OUT = join(APP_ROOT, 'forge', 'shots', MOBILE ? `${OUT_NAME}-mobile` : OUT_NAME)
const VP = MOBILE
  ? { width: 390, height: 844, deviceScaleFactor: 2 }
  : { width: 1280, height: 720, deviceScaleFactor: 2 }

/** a blink is a region that changes and changes back: |a-b| and |c-b| both
    move, and a and c land back on each other */
const CHANGE = 5
const RETURN = 2

/* THE INTRUSION FLOORS, and where they come from.
   The box is the middle of the frame in fractions of its own size, chosen
   to hold no page chrome at either viewport: the brand line and the
   station title are above it, the rail and the door block below it.
   A frame is collapsed when it is under BOTH floors at once, and the run
   prints how close the walk came to that corner, so the margin is a number.
   Measured on the merged da Vinci wing: the whole desktop walk stays over
   sd 9.5 / energy 2.9 and the whole phone walk over sd 2.6 with energy 5.3,
   the app's own opening card reads sd 1.8 / energy 1.0, and a camera driven
   1.5 m under the court reads sd 0.9 / energy 1.6. Both walks keep about a
   factor of two over the corner. */
const BOX = { x0: 0.3, x1: 0.7, y0: 0.28, y1: 0.58 }
const BOX_GRID = 48
const SD_FLOOR = 5
const ENERGY_FLOOR = 2.3
/** the world is standing once the box carries this much structure */
const OPEN_ENERGY = 2
/** the opening may not eat more of the recording than this */
const OPEN_SHARE = 0.2
/** at the clear colour: the box's own mean, against the plate the recorder
    caught before the app drew anything */
const CLEAR_LEVEL = 2
const CLEAR_SD = 2
/** one dropped frame is a decoder, not a wall */
const INTRUSION_RUN = 3

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const flags = []
const warnings = []
/** one still per station on the way out: the judge's motion strip is a
    frame from each room, not eight frames of whichever second the video
    happened to be in */
const stationFrames = []
const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', cwd: APP_ROOT })
let stations = 0
let poisoned = 0
try {
  await waitForServer(BASE)
  const said = await assertServer(BASE)
  out(`[motion] server ${said.head.slice(0, 7)}, ${MOBILE ? 'phone' : 'desktop'}, tier ${TIER}`)

  const browser = await chromium.launch({ args: browserArgs() })
  const ctx = await browser.newContext({
    viewport: { width: VP.width, height: VP.height },
    deviceScaleFactor: VP.deviceScaleFactor,
    recordVideo: { dir: OUT, size: { width: VP.width, height: VP.height } },
  })
  const page = await ctx.newPage()
  if (INTRUDE) {
    const [from, to] = INTRUDE.split('=>')
    if (!from || to === undefined) throw new Error(`MOTION_INTRUDE wants '<text>=><text>', got ${INTRUDE}`)
    // the wing's own chunk, and only for this run: the app on disk is not
    // touched, and a run whose poison did not land is not a run
    await page.route(`**/assets/${SLUG}-*.js`, async (route) => {
      const res = await route.fetch()
      const body = await res.text()
      const hits = body.split(from).length - 1
      poisoned += hits
      await route.fulfill({ response: res, body: body.split(from).join(to) })
    })
  }
  let firstLine = ''
  page.on('pageerror', (e) => flags.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.text().startsWith('backend=')) firstLine = m.text()
    if (m.type() === 'error') flags.push(`console: ${m.text()}`)
  })
  // the wing's own address, cold: the overture is never part of a motion scan
  await page.goto(`${BASE}/w/${SLUG}?tier=${TIER}`)
  await page.waitForFunction(() => Boolean(window.__forge))
  await page.waitForTimeout(2200)
  if (INTRUDE && !poisoned) throw new Error(`MOTION_INTRUDE found no '${INTRUDE.split('=>')[0]}' in the ${SLUG} chunk`)
  if (INTRUDE) out(`[motion] POISONED: ${poisoned} site(s) in the ${SLUG} chunk, this run only`)
  const stamp = await assertBackend(page)
  assertAdapter(firstLine, process.env['FORGE_BACKEND'] ?? 'webgpu')
  if (stamp.tier !== TIER) throw new Error(`asked for tier=${TIER}, the app stamped ${stamp.tier}`)
  out(`[motion] ${firstLine}`)

  const state = await page.evaluate(() => window.__forge.state())
  stations = state.stations
  if (state.phase !== 'wing') flags.push(`the deep link did not stand in a wing (phase ${state.phase})`)
  if (!stations) flags.push('the wing reports no station')
  out(`[motion] ${stations} station(s)`)

  // forward, then back, on the rail itself
  const steps = Math.max(1, stations)
  const path = []
  for (let i = 0; i < steps; i++) path.push(i)
  for (let i = steps - 2; i >= 0; i--) path.push(i)
  const ids = state.stationIds ?? []
  let outbound = true
  for (const i of path) {
    if (i === steps - 1) outbound = false
    // by id where the wing has one, because the normalised rail rounds and
    // an integer into it lands on the last station every time
    const id = ids[i]
    if (id === undefined)
      await page.evaluate(([n, c]) => window.__forge.rail(c < 2 ? 0 : n / (c - 1)), [i, steps])
    else await page.evaluate((s) => window.__forge.station(s), id)
    await page.waitForTimeout(1200)
    const at = await page.evaluate(() => window.__forge.state().station)
    if (at !== i) flags.push(`STUCK: asked for station ${i + 1}, standing at ${at + 1}`)
    // and a look around from where the walk stands
    await page.mouse.move(VP.width / 2, VP.height / 2)
    await page.mouse.down()
    for (let x = VP.width / 2; x > VP.width / 2 - 180; x -= 20) {
      await page.mouse.move(x, VP.height / 2 - 30)
      await page.waitForTimeout(16)
    }
    await page.mouse.up()
    await page.waitForTimeout(700)
    if (outbound || i === steps - 1) {
      const name = `walk-${String(i + 1).padStart(2, '0')}-${ids[i] ?? `station-${i + 1}`}.png`
      await page.screenshot({ path: join(OUT, name) })
      stationFrames.push(name)
    }
  }
  await ctx.close()
  await browser.close()
} catch (err) {
  flags.push(`RIG REFUSED: ${err.message}`)
} finally {
  server.kill()
}

// ---- the frames, and the two scans over them
const videos = existsSync(OUT) ? readdirSync(OUT).filter((f) => f.endsWith('.webm')) : []
let frames = []
if (videos.length) {
  await new Promise((done) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(OUT, videos[0]), '-vsync', '0', join(OUT, 'f%04d.png')], { stdio: 'ignore' })
    ff.on('close', done)
  })
  frames = readdirSync(OUT).filter((f) => f.startsWith('f') && f.endsWith('.png')).sort()
}
if (!frames.length) flags.push('no frames: the walk recorded nothing')

/* The grids come out of ffmpeg rather than out of an image library: one
   small grey frame per video frame, in one raw stream, so the whole walk is
   compared with arithmetic and no second decoder. */
function grid(video, vf, side) {
  return new Promise((done, fail) => {
    const ff = spawn('ffmpeg', [
      '-loglevel', 'error', '-i', video, '-vsync', '0',
      '-vf', `${vf}scale=${side}:${side}`, '-pix_fmt', 'gray', '-f', 'rawvideo', '-',
    ])
    const chunks = []
    ff.stdout.on('data', (d) => chunks.push(d))
    ff.on('error', fail)
    ff.on('close', () => done(Buffer.concat(chunks)))
  })
}
const frameName = (n) => `f${String(n).padStart(4, '0')}.png`

/* ---- the oscillation warning: a region that changes and changes back --- */
const GRID = 16
function oscillationScan(raw) {
  const cell = GRID * GRID
  const count = Math.floor(raw.length / cell)
  const at = (i, k) => raw[i * cell + k]
  const flagged = []
  for (let i = 2; i < count; i++) {
    let blinks = 0
    for (let k = 0; k < cell; k++) {
      const a = at(i - 2, k)
      const b = at(i - 1, k)
      const c = at(i, k)
      if (Math.abs(a - b) > CHANGE && Math.abs(b - c) > CHANGE && Math.abs(a - c) < RETURN) blinks++
    }
    if (blinks >= 3) flagged.push({ n: i - 1, cells: blinks })
  }
  // a lone flagged frame is noise; a run of them is one moment of the walk
  const clusters = []
  let run = []
  const close = () => {
    if (run.length >= 3)
      clusters.push({ from: frameName(run[0].n + 1), to: frameName(run[run.length - 1].n + 1), frames: run.length })
  }
  for (const f of flagged) {
    if (run.length && f.n - run[run.length - 1].n <= 2) run.push(f)
    else {
      close()
      run = [f]
    }
  }
  close()
  return { frames: count, flagged: flagged.length, clusters }
}

/* ---- the intrusion gate: did the picture stop being a place? ----------- */
function boxStats(raw) {
  const cell = BOX_GRID * BOX_GRID
  const count = Math.floor(raw.length / cell)
  const rows = []
  for (let i = 0; i < count; i++) {
    const p = raw.subarray(i * cell, (i + 1) * cell)
    let sum = 0
    for (const v of p) sum += v
    const mean = sum / cell
    let acc = 0
    for (const v of p) acc += (v - mean) * (v - mean)
    // the second difference in both directions: what a picture has and a
    // surface at the near plane does not
    let energy = 0
    let n = 0
    for (let y = 1; y < BOX_GRID - 1; y++) {
      for (let x = 1; x < BOX_GRID - 1; x++) {
        const k = y * BOX_GRID + x
        energy += Math.abs(4 * p[k] - p[k - 1] - p[k + 1] - p[k - BOX_GRID] - p[k + BOX_GRID])
        n++
      }
    }
    rows.push({ n: i + 1, mean, sd: Math.sqrt(acc / cell), energy: energy / n })
  }
  return rows
}

function intrusionScan(rows) {
  if (!rows.length) return { opened: 0, frames: 0, intrusions: [], clear: null, closest: null, notes: [], faults: ['no frames'] }
  const notes = []
  const faults = []
  /* the clear colour is measured, not assumed: the recorder catches the
     page before the app has drawn anything, and that plate is flat */
  const first = rows[0]
  const clear = first.sd < 1 ? first.mean : null
  if (clear === null) notes.push('the first recorded frame is not flat, so the clear colour could not be read')
  // the window opens when the world is standing; what came before is the
  // app's own opening (the intro card, the module in flight), not the walk
  const opened = rows.findIndex((r) => r.energy >= OPEN_ENERGY)
  if (opened < 0)
    return { opened: 0, frames: 0, intrusions: [], clear, closest: null, notes, faults: ['the world never drew: no frame carries structure'] }
  if (opened > rows.length * OPEN_SHARE)
    notes.push(`the world first drew at ${frameName(rows[opened].n)}, ${Math.round((100 * opened) / rows.length)} percent into the recording`)
  const window = rows.slice(opened)
  const why = (r) =>
    r.sd < SD_FLOOR && r.energy < ENERGY_FLOOR ? 'one surface at the near plane'
    : clear !== null && Math.abs(r.mean - clear) <= CLEAR_LEVEL && r.sd < CLEAR_SD ? 'the clear colour'
    : null
  const intrusions = []
  let run = []
  const close = () => {
    if (run.length >= INTRUSION_RUN) {
      const worst = run.reduce((a, b) => (b.energy < a.energy ? b : a))
      intrusions.push({
        from: frameName(run[0].n),
        to: frameName(run[run.length - 1].n),
        frames: run.length,
        why: why(worst),
        worst: { frame: frameName(worst.n), sd: +worst.sd.toFixed(2), energy: +worst.energy.toFixed(2), mean: +worst.mean.toFixed(1) },
      })
    }
    run = []
  }
  for (const r of window) {
    if (why(r)) run.push(r)
    else close()
  }
  close()
  /* how close the walk came to the corner it is judged against. Both
     floors have to be crossed at once, so the margin is the smaller of the
     two ratios taken frame by frame, and the closest frame is named. */
  const score = (r) => Math.max(r.sd / SD_FLOOR, r.energy / ENERGY_FLOOR)
  const near = window.reduce((a, b) => (score(b) < score(a) ? b : a))
  return {
    opened,
    frames: window.length,
    intrusions,
    clear,
    closest: {
      margin: +score(near).toFixed(2),
      frame: frameName(near.n),
      sd: +near.sd.toFixed(2),
      energy: +near.energy.toFixed(2),
    },
    notes,
    faults,
  }
}

let oscillation = { frames: 0, flagged: 0, clusters: [] }
let intrusion = { opened: 0, frames: 0, intrusions: [], clear: null, closest: null, notes: [], faults: [] }
if (videos.length) {
  const video = join(OUT, videos[0])
  oscillation = oscillationScan(await grid(video, '', GRID))
  const crop = `crop=iw*${(BOX.x1 - BOX.x0).toFixed(4)}:ih*${(BOX.y1 - BOX.y0).toFixed(4)}:iw*${BOX.x0.toFixed(4)}:ih*${BOX.y0.toFixed(4)},`
  intrusion = intrusionScan(boxStats(await grid(video, crop, BOX_GRID)))
  out(`[motion] ${oscillation.frames} frames, ${intrusion.opened} of them the app's own opening`)
  out(`[motion] intrusion: ${intrusion.intrusions.length} over ${intrusion.frames} frames of the walk`)
  if (intrusion.closest)
    out(
      `[motion] closest to the corner: ${intrusion.closest.margin}x at ${intrusion.closest.frame}` +
        ` (sd ${intrusion.closest.sd} of ${SD_FLOOR}, energy ${intrusion.closest.energy} of ${ENERGY_FLOOR})`
    )
  out(`[motion] oscillation: ${oscillation.flagged} flagged, ${oscillation.clusters.length} cluster(s)`)
}

for (const n of intrusion.notes) warnings.push(n)
for (const n of intrusion.faults ?? []) flags.push(n)
for (const c of intrusion.intrusions)
  flags.push(`INTRUSION ${c.from} to ${c.to} (${c.frames} frames): ${c.why}, worst ${c.worst.frame} sd ${c.worst.sd} energy ${c.worst.energy}`)
for (const c of oscillation.clusters)
  warnings.push(`A-B-A cluster ${c.from} to ${c.to} (${c.frames} frames): read them by eye`)

out(`[motion] wing ${SLUG}: ${stations} station(s), frames in forge/shots/${MOBILE ? `${OUT_NAME}-mobile` : OUT_NAME}/`)
if (warnings.length) {
  out('MOTION SCAN WARNS (read by eye, not a gate):')
  for (const w of [...new Set(warnings)]) out(` · ${w}`)
}
if (flags.length) {
  out('MOTION SCAN FLAGGED:')
  for (const f of [...new Set(flags)]) out(` · ${f}`)
  process.exitCode = 1
} else {
  out(`clean: every station reached forward and back, no intrusion over ${intrusion.frames} frames of the walk`)
}
if (JSON_OUT)
  console.log(
    JSON.stringify(
      {
        wing: SLUG,
        viewport: MOBILE ? 'mobile' : 'desktop',
        tier: TIER,
        stations,
        stationFrames,
        poisoned: INTRUDE ? { rule: INTRUDE, sites: poisoned } : null,
        frames: oscillation.frames,
        walkFrames: intrusion.frames,
        openedAt: intrusion.opened,
        clearLevel: intrusion.clear === null ? null : +intrusion.clear.toFixed(1),
        intrusions: intrusion.intrusions.length,
        intrusionFrames: intrusion.intrusions,
        closest: intrusion.closest,
        floors: { sd: SD_FLOOR, energy: ENERGY_FLOOR, run: INTRUSION_RUN, box: BOX },
        flagged: oscillation.flagged,
        clusters: oscillation.clusters.length,
        clusterFrames: oscillation.clusters,
        dir: `forge/shots/${MOBILE ? `${OUT_NAME}-mobile` : OUT_NAME}`,
        warnings: [...new Set(warnings)],
        flags: [...new Set(flags)],
        ok: flags.length === 0,
      },
      null,
      2
    )
  )
