// THE MOTION EYE. Stills cannot show motion, so a wing is also walked: a
// real recorded pass along its rail, forward and back, on the real GPU, at
// the hero tier on the desktop and the calm tier on the phone.
//
//   pnpm build && node forge/motion-scan.mjs [slug] [outDir]
//   FORGE_PORT=5199 MOTION_VP=mobile node forge/motion-scan.mjs vinci
//
// It records the walk, dumps the frames, and flags two things a still can
// never show:
//   · STUCK: the station the walk asked for is not the station standing
//   · A-B-A: a region that changes and changes back between three frames,
//     which is a blink, a pop or a tear. Clusters of flagged frames on one
//     transition mean the camera passed through something (W7). The frames
//     are named so they can be read by eye, which is the only verdict.
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
const BASE = `http://localhost:${PORT}`
const OUT = join(APP_ROOT, 'forge', 'shots', MOBILE ? `${OUT_NAME}-mobile` : OUT_NAME)
const VP = MOBILE
  ? { width: 390, height: 844, deviceScaleFactor: 2 }
  : { width: 1280, height: 720, deviceScaleFactor: 2 }

/** a blink is a region that changes and changes back: |a-b| and |c-b| both
    move, and a and c land back on each other */
const CHANGE = 5
const RETURN = 2

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const flags = []
/** one still per station on the way out: the judge's motion strip is a
    frame from each room, not eight frames of whichever second the video
    happened to be in */
const stationFrames = []
const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', cwd: APP_ROOT })
let stations = 0
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

// ---- the frames, and the blink scan over them
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

/* The A-B-A scan. The grid comes out of ffmpeg rather than out of an image
   library: one 16 by 16 grey frame per video frame, in one raw stream, so
   the whole walk is compared with arithmetic and no second decoder. */
const GRID = 16
function grid(video) {
  return new Promise((done, fail) => {
    const ff = spawn('ffmpeg', [
      '-loglevel', 'error', '-i', video, '-vsync', '0',
      '-vf', `scale=${GRID}:${GRID}`, '-pix_fmt', 'gray', '-f', 'rawvideo', '-',
    ])
    const chunks = []
    ff.stdout.on('data', (d) => chunks.push(d))
    ff.on('error', fail)
    ff.on('close', () => done(Buffer.concat(chunks)))
  })
}

let clusters = []
let frameCount = 0
let flaggedCount = 0
if (videos.length) {
  const raw = await grid(join(OUT, videos[0]))
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
  frameCount = count
  flaggedCount = flagged.length
  out(`[motion] ${count} frames, ${flagged.length} flagged, scanning for clusters`)
  // a lone flagged frame is noise; a run of them is a transition that tore
  let run = []
  const close = () => {
    if (run.length >= 3)
      clusters.push({ from: `f${String(run[0].n + 1).padStart(4, '0')}.png`, to: `f${String(run[run.length - 1].n + 1).padStart(4, '0')}.png`, frames: run.length })
  }
  for (const f of flagged) {
    if (run.length && f.n - run[run.length - 1].n <= 2) run.push(f)
    else {
      close()
      run = [f]
    }
  }
  close()
  out(`[motion] ${clusters.length} cluster(s)`)
}

for (const c of clusters) flags.push(`A-B-A cluster ${c.from} to ${c.to} (${c.frames} frames): read them by eye`)

out(`[motion] wing ${SLUG}: ${stations} station(s), frames in forge/shots/${MOBILE ? `${OUT_NAME}-mobile` : OUT_NAME}/`)
if (flags.length) {
  out('MOTION SCAN FLAGGED:')
  for (const f of [...new Set(flags)]) out(` \u00b7 ${f}`)
  process.exitCode = 1
} else {
  out('clean: every station reached forward and back, no A-B-A cluster')
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
        frames: frameCount,
        flagged: flaggedCount,
        clusters: clusters.length,
        clusterFrames: clusters,
        dir: `forge/shots/${MOBILE ? `${OUT_NAME}-mobile` : OUT_NAME}`,
        flags: [...new Set(flags)],
        ok: flags.length === 0,
      },
      null,
      2
    )
  )
