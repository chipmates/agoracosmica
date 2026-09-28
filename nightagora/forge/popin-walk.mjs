// THE LATE MACHINE. A machine that is drawn only once the eye is near it
// arrives inside a picture that already shows its room: the walk sees a
// plinth, then the machine on it. This instrument walks named legs one frame
// at a time and asks the collection, on every frame, which machines stand
// (`?popin` publishes `window.__naStands`), and asks the camera which of them
// are in its frame. A machine in the frame of a room the eye can see and not
// standing is a late machine; the frame it arrives in is written out beside
// the one before it.
//
//   node forge/popin-walk.mjs <port> [--legs a:b,c:d] [--phone] [--query k=v&..] [--out dir] [--shots n,n]
//   a leg may name a machine's own walk: works:machine/multi-barrel-gun
//   --shots writes those frames of every leg, for a before and after at one pose
// Each leg also reports the frame's draws and triangles (mean and most), what
// drawing a machine earlier costs.
//
// It brings its own preview server on the port, like the other walking eyes.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { APP_ROOT, assertServer, browserArgs, waitForServer, wingStanding } from './rig.mjs'

const argv = process.argv.slice(2)
const value = (name, fallback = '') => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const PORT = Number(argv.find((a) => /^\d+$/.test(a)) ?? 5199)
const PHONE = argv.includes('--phone')
const QUERY = value('query', '')
const SHOTS = new Set(value('shots', '').split(',').filter(Boolean).map(Number))
const OUT = resolve(value('out', join(APP_ROOT, 'forge', 'shots', 'popin-walk')))
const LEGS = value('legs', 'picture-room-west:flight,flight:works').split(',').map((s) => s.split(':').length > 2
  ? [s.split(':')[0], s.split(':').slice(1).join(':')] : s.split(':'))
const VP = PHONE
  ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { width: 1440, height: 900, deviceScaleFactor: 1 }
const TIER = PHONE ? 'standard' : 'hero'
const BASE = `http://localhost:${PORT}`
/** a leg is over once its pose has not moved for this many frames */
const STAND_FRAMES = 20
/** and a leg that has not begun to move in this many frames is a cut */
const GRACE_FRAMES = 240
const MAX_FRAMES = 3000
/** the collection's rooms, where a machine of the hall can be seen from */
const HALL = { x: [-61.66, -39.02], z: [42.04, 63.66], yBelow: -1.9 }
const PAVILION = { x: [-61.7, -22.0], z: [34.07, 63.7], yBelow: -1.5 }
const say = (line) => process.stderr.write(`${line}\n`)

/** the camera's axes off its XYZ Euler, as three builds them */
function frameOf(cam, aspect) {
  const [rx, ry, rz] = cam.r
  const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz)
  const ae = a * e, af = a * f, be = b * e, bf = b * f
  return {
    eye: cam.p,
    right: [c * e, af + be * d, bf - ae * d],
    up: [-c * f, ae - bf * d, be + af * d],
    back: [d, -b * c, a * c],
    tanY: Math.tan((cam.fov * Math.PI) / 360),
    aspect,
  }
}
/** the share of a box's 27 lattice points the frame holds, in front of the eye */
function inFrame(box, cam, aspect) {
  const F = frameOf(cam, aspect)
  let seen = 0
  for (const u of [0, 0.5, 1]) for (const v of [0, 0.5, 1]) for (const w of [0, 0.5, 1]) {
    const p = [box[0] + (box[3] - box[0]) * u, box[1] + (box[4] - box[1]) * v, box[2] + (box[5] - box[2]) * w]
    const q = [p[0] - F.eye[0], p[1] - F.eye[1], p[2] - F.eye[2]]
    const z = -(q[0] * F.back[0] + q[1] * F.back[1] + q[2] * F.back[2])
    if (z < 0.2) continue
    const x = (q[0] * F.right[0] + q[1] * F.right[1] + q[2] * F.right[2]) / (z * F.tanY * F.aspect)
    const y = (q[0] * F.up[0] + q[1] * F.up[1] + q[2] * F.up[2]) / (z * F.tanY)
    if (Math.abs(x) <= 1 && Math.abs(y) <= 1) seen++
  }
  return seen / 27
}
const inside = (p, room) => p[0] > room.x[0] && p[0] < room.x[1] && p[2] > room.z[0] && p[2] < room.z[1] && p[1] < room.yBelow
/** whether the eye stands where this machine's ground can be seen at all */
function roomSeen(ground, eye) {
  if (ground === 'hall') return inside(eye, HALL)
  if (ground === 'court') return !inside(eye, HALL) && (!inside(eye, PAVILION) || eye[2] < 42)
  return false
}

/* ONE FRAME AT A TIME. The page's animation frames are queued and released
   one by one, each a sixtieth of a second on the page's own clock, so a leg
   is the same frames every run and the rig reads every one of them. */
async function installStepper(page) {
  await page.evaluate(() => {
    const w = window
    const realRaf = w.requestAnimationFrame.bind(w), realNow = performance.now.bind(performance)
    const state = { virtual: realNow(), credit: 0, frames: 0, at: realNow() }
    let queue = []
    w.__step = state
    const tick = () => {
      if (state.credit <= 0) { realRaf(tick); return }
      state.credit--
      state.virtual += 1000 / 60
      state.at = realNow()
      state.frames++
      const due = queue
      queue = []
      for (const cb of due) { try { cb(state.virtual) } catch (err) { console.error(err) } }
      realRaf(tick)
    }
    realRaf(tick)
    w.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length }
    w.cancelAnimationFrame = () => {}
    performance.now = () => state.virtual + Math.min(1000 / 60, realNow() - state.at)
  })
}
/** release one frame and wait until it has been drawn and the next queued */
async function stepFrame(page) {
  return page.evaluate(() => new Promise((done) => {
    const s = window.__step, want = s.frames + 1
    s.credit++
    const wait = () => (s.frames >= want ? setTimeout(done, 0) : setTimeout(wait, 1))
    wait()
  }))
}
const read = (page) => page.evaluate(() => {
  const c = window.__forge.cost()
  return { cam: window.__forge.state().cam, stands: window.__naStands?.() ?? null, draws: c.draws, triangles: c.triangles }
})

async function walk(page, from, to, tag) {
  const machine = to.startsWith('machine/')
  // stand at the start, on the page's own clock
  const took = await page.evaluate((s) => window.__forge.station(s), from)
  if (!took) return { leg: `${from} to ${to}`, error: `would not stand at ${from}` }
  for (let i = 0; i < 400; i++) await stepFrame(page)
  const began = machine
    ? await page.evaluate(([at, view]) => { window.__forge.jump('wing', { slug: 'vinci', station: at, view }); return true }, [from, `walk:${to}`])
    : await page.evaluate((s) => window.__forge.station(s), to)
  if (!began) return { leg: `${from} to ${to}`, error: `would not walk to ${to}` }
  const frames = []
  let last = null, still = 0, moved = false
  let previousShot = null
  const late = []
  const firstSeen = new Map(), firstDrawn = new Map()
  for (let n = 0; n < MAX_FRAMES; n++) {
    await stepFrame(page)
    const { cam, stands, draws, triangles } = await read(page)
    if (!stands) return { leg: `${from} to ${to}`, error: 'the page publishes no stands: build with ?popin' }
    const pose = [...cam.p, ...cam.r]
    const same = last && pose.every((v, i) => Math.abs(v - last[i]) < 1e-5)
    if (!same || n > GRACE_FRAMES) moved = true
    still = moved && same ? still + 1 : 0
    last = pose
    const row = { n, eye: cam.p.map((v) => +v.toFixed(2)), drawn: [], lateIn: [], draws, triangles }
    if (SHOTS.has(n)) await page.screenshot({ path: join(OUT, `${tag}-f${String(n).padStart(4, '0')}-shot.png`) })
    for (const s of stands) {
      if (!s.box) continue
      const share = inFrame(s.box, cam, VP.width / VP.height)
      const seen = share > 0 && roomSeen(s.ground, cam.p)
      if (seen && !firstSeen.has(s.slug)) firstSeen.set(s.slug, n)
      if (s.visible && !firstDrawn.has(s.slug)) firstDrawn.set(s.slug, n)
      if (s.visible) row.drawn.push(s.slug)
      if (seen && !s.visible) row.lateIn.push(s.slug)
    }
    // a machine drawn now that the frame before held in view and not drawn;
    // a frame is only shot where one is late or was late a frame ago
    const before = frames[frames.length - 1]
    const shot = row.lateIn.length || before?.lateIn.length ? await page.screenshot({ type: 'png' }) : null
    if (before) for (const slug of row.drawn) if (before.lateIn.includes(slug) && previousShot && shot) {
      const stem = `${tag}-f${String(n).padStart(4, '0')}-${slug}`
      writeFileSync(join(OUT, `${stem}-before.png`), previousShot)
      writeFileSync(join(OUT, `${stem}-after.png`), shot)
      late.push({ slug, frame: n, eye: row.eye })
    }
    frames.push(row)
    previousShot = shot
    if (still >= STAND_FRAMES) break
  }
  const lateFrames = frames.filter((f) => f.lateIn.length).length
  const byMachine = {}
  for (const f of frames) for (const slug of f.lateIn) byMachine[slug] = (byMachine[slug] ?? 0) + 1
  const most = (k) => Math.max(...frames.map((f) => f[k]))
  const mean = (k) => Math.round(frames.reduce((a, f) => a + f[k], 0) / frames.length)
  return {
    leg: `${from} to ${to}`, frames: frames.length, lateFrames, lateByMachine: byMachine, arrivals: late,
    draws: { mean: mean('draws'), most: most('draws') }, triangles: { mean: mean('triangles'), most: most('triangles') },
    firstSeen: Object.fromEntries(firstSeen), firstDrawn: Object.fromEntries(firstDrawn),
  }
}

mkdirSync(OUT, { recursive: true })
const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', cwd: APP_ROOT })
let browser = null
const report = { instrument: 'popin-walk', viewport: PHONE ? 'phone' : 'desktop', tier: TIER, query: QUERY, legs: [] }
try {
  await waitForServer(BASE)
  report.head = (await assertServer(BASE)).head
  browser = await chromium.launch({ args: browserArgs() })
  const context = await browser.newContext({ viewport: { width: VP.width, height: VP.height }, deviceScaleFactor: VP.deviceScaleFactor,
    isMobile: VP.isMobile ?? false, hasTouch: VP.hasTouch ?? false })
  await context.addInitScript(() => { try { sessionStorage.setItem('vinci-welcome', '1') } catch { /* private mode */ } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/w/vinci?tier=${TIER}&probe=1&popin=1${QUERY ? `&${QUERY}` : ''}#s=${LEGS[0][0]}`)
  await page.waitForFunction(() => Boolean(window.__forge))
  if (!(await wingStanding(page))) throw new Error('the wing never stood')
  await page.waitForFunction(() => (window.__forge.state().texturesPending ?? 1) === 0, null, { timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await installStepper(page)
  for (const [from, to] of LEGS) {
    const tag = `${PHONE ? 'phone' : 'desktop'}-${from}-to-${to.replace('/', '.')}`
    const r = await walk(page, from, to, tag)
    report.legs.push(r)
    say(r.error ? `  ${r.leg}: ${r.error}` : `  ${r.leg}: ${r.frames} frames, ${r.lateFrames} with a machine in view and not standing ${JSON.stringify(r.lateByMachine)}, ${r.arrivals.length} arrival(s) in view; draws ${r.draws.mean} mean ${r.draws.most} most, triangles ${r.triangles.mean} mean ${r.triangles.most} most`)
  }
  report.pageErrors = errors
} catch (err) {
  report.refused = String(err.message)
  say(`RIG REFUSED: ${err.message}`)
} finally {
  if (browser) await browser.close().catch(() => {})
  server.kill()
}
writeFileSync(join(OUT, `report-${PHONE ? 'phone' : 'desktop'}.json`), JSON.stringify(report, null, 1))
process.stdout.write(JSON.stringify(report, null, 1) + '\n')
