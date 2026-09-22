// THE CAPTURE — one leg of the rail, frame for frame, at the framing's own
// device pixels.
//
//   node forge/prerender/capture.mjs --framing=landscape
//   node forge/prerender/capture.mjs --framing=portrait
//   node forge/prerender/capture.mjs --framing=landscape --proof=90
//
// The walk is driven by a clock this harness owns (see clock.mjs), so a
// screenshot that costs half a second still advances the leg by exactly one
// thirtieth of a second. `--proof=N` captures the first N frames twice, in two
// fresh contexts, and compares them: same pixels, same camera, or the run is
// not deterministic and says so.
//
// Nothing under src/ is touched. The chrome is hidden by visibility alone, so
// every box the wing fits its composition around keeps its place.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { APP_ROOT, assertServer, browserArgs, FRAME_TIME_FLAGS, waitForServer, wingStanding } from '../rig.mjs'
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

const PORT = Number(flag('port', process.env['FORGE_PORT'] ?? 5384))
const BASE = `http://127.0.0.1:${PORT}`
const WING = String(flag('wing', 'vinci'))
const FROM = String(flag('from', 'picture-room'))
const TO = String(flag('to', 'picture-room-west'))
const TIER = String(flag('tier', 'hero'))
const SAMPLES = String(flag('samples', '4'))
const FPS = Number(flag('fps', 30))
const FRAMING = String(flag('framing', 'landscape'))
const PROOF = Number(flag('proof', 0))
const TAIL = Number(flag('tail', 60))
const CAP = Number(flag('cap', 1400))
/** the film reseeds per frame by design; a bit-identity proof holds it still */
const GRAIN = flag('grain', PROOF ? 'off' : 'on') !== 'off'
const OUT_ROOT = String(flag('out', resolve(APP_ROOT, '..', 'capture')))
/** frames kept a second time with the wing's own chrome on, as evidence */
const WITNESS = String(flag('witness', '0,150,300')).split(',').filter(Boolean).map(Number)

const FRAMINGS = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
}
const VIEW = FRAMINGS[FRAMING]
if (!VIEW) throw new Error(`no framing ${FRAMING}: landscape or portrait`)

const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const round = (n, p = 4) => Math.round(n * 10 ** p) / 10 ** p

/** the camera as a number a diff can read: eye, gaze and lens */
function camPrint(cam) {
  return [...cam.p.map((v) => round(v)), ...cam.r.map((v) => round(v)), round(cam.fov)].join(',')
}

async function standWarm(page, id) {
  await page.evaluate((s) => window.__forge.station(s), id)
  await page.waitForFunction(
    (s) => window.__forge.state().stationId === s && !document.querySelector('[data-walking]'),
    id,
    { timeout: 180000 }
  )
  /* the count does not always come to rest at zero: see pending.mjs */
  return restingPending(page)
}

/**
 * A LEG WALKED UNDER THE CAPTURE CLOCK, without keeping a frame.
 *
 * The near shadow cascade is a tight box that only re-snaps when the eye has
 * moved a few metres (`SHADOW.refocusM`), so where its box sits at a station
 * depends on which frames the walk in was sampled at. A leg walked on the wall
 * clock samples different positions every time, and two captures then differ
 * in one patch of lit floor at the far end. Walking in under the capture's own
 * clock makes that history identical, and the capture bit-exact.
 */
async function silentWalk(page, id, settle = 30) {
  return page.evaluate(
    async ([to, hold]) => {
      window.__forge.station(to)
      await new Promise((r) => setTimeout(r, 300))
      let began = false
      let n = 0
      for (; n < 3000; n++) {
        window.__pre.step()
        await window.__pre.raw()
        const walking = Boolean(document.querySelector('[data-walking]'))
        if (walking) began = true
        if (began && !walking) break
      }
      for (let i = 0; i < hold; i++) {
        window.__pre.step()
        await window.__pre.raw()
      }
      return n
    },
    [id, settle]
  )
}

/**
 * One capture of the leg, into its own folder. Returns the frame record.
 * `limit` stops early, which is what the determinism proof shoots.
 */
async function oneCapture(browser, dir, limit) {
  mkdirSync(dir, { recursive: true })
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 })
  /* the wing shows its welcome once per visit; the capture is of rooms */
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
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)))
  /* A FRAME THAT WAITED FOR A FILE IS NOT A FRAME OF THE WALK. Every request
     the page makes after the clock is taken is counted: the capture is only
     deterministic if that count is zero. */
  let armed = false
  const lateRequests = []
  page.on('request', (r) => {
    if (armed) lateRequests.push(r.url().replace(BASE, ''))
  })

  const url = `${BASE}/w/${WING}?probe=1&tier=${TIER}&samples=${SAMPLES}#s=${FROM}`
  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'load' })
  if (!(await wingStanding(page))) throw new Error('the wing never stood')
  const pendingAtRest = await restingPending(page)
  const backend = await page.evaluate(() => ({
    backend: document.body.dataset.backend,
    tier: document.body.dataset.tier,
  }))
  if (backend.backend !== 'webgpu') throw new Error(`backend ${backend.backend}, not webgpu`)
  /* THE WARM PASS. The room ahead streams its plates the first time it is
     walked into; a capture over that would hold a picture popping in, and two
     captures would hold it in different frames. So the leg is walked once,
     both ways, before a single frame is kept. */
  await standWarm(page, TO)
  await standWarm(page, FROM)
  await page.waitForTimeout(4000)
  if (!GRAIN) await page.evaluate(() => window.__forge.grain(false))
  await page.addStyleTag({ content: CHROME_OFF })
  await page.evaluate((c) => document.documentElement.classList.add(c), BARE)
  await page.waitForTimeout(600)
  /* A WITNESS FRAME carries the wing's own chrome: the card, the bar and the
     marks that stand over the works. It is not part of the clip. It is the
     evidence for what a clip cannot hold, and it is taken between two steps,
     so the scene behind it is the same scene. */
  const witness = async (i) => {
    if (!WITNESS.includes(i)) return
    await page.evaluate((c) => document.documentElement.classList.remove(c), BARE)
    await page.evaluate(() => window.__pre.raw())
    await page.screenshot({ path: join(dir, `witness-${String(i).padStart(5, '0')}.png`), type: 'png' })
    await page.evaluate((c) => document.documentElement.classList.add(c), BARE)
    await page.evaluate(() => window.__pre.raw())
  }

  await page.evaluate((fps) => window.__pre.arm(fps), FPS)
  armed = true
  /* THE ONE FRAME ALREADY IN FLIGHT. The loop re-books itself at the top of
     every frame, so at the moment the gate closes one callback is still held
     by the browser. It runs on the next real refresh and only then does the
     loop re-book through the gate. Stepping before that lands the leg's first
     frame on either side of it, which is the whole race. */
  await page.waitForFunction(() => window.__pre.queued() > 0, null, { timeout: 10000 })
  /* the round trip that makes the frame history the same in every run */
  const settleSteps = [await silentWalk(page, TO), await silentWalk(page, FROM)]
  const frames = []
  /** frames whose shot had to be retried, and why the retry exists */
  const stalls = []
  /* A BRAKING WALK STOPS DAMAGING THE SURFACE. Over the last metre the eye
     moves by fractions of a pixel, and a compositor that sees no damage
     commits no frame, so the shot waits for a frame that will never come. The
     retry paints a layer the canvas covers, which costs no visible pixel and
     gives the compositor something to commit. */
  const shoot = async (i) => {
    const file = join(dir, `f${String(i).padStart(5, '0')}.png`)
    let buf
    for (let attempt = 0; ; attempt++) {
      try {
        buf = await page.screenshot({ path: file, type: 'png', animations: 'allow', caret: 'initial', timeout: 20000 })
        break
      } catch (err) {
        if (attempt >= 3) throw err
        stalls.push(i)
        await page.evaluate((n) => {
          document.body.style.backgroundColor = n % 2 ? '#000000' : '#000001'
        }, attempt)
        await page.evaluate(() => window.__pre.raw())
      }
    }
    const s = await page.evaluate(() => {
      const st = window.__forge.state()
      return {
        cam: st.cam,
        draws: st.draws,
        tris: st.tris,
        pending: st.texturesPending,
        walking: Boolean(document.querySelector('[data-walking]')),
        station: st.stationId,
      }
    })
    frames.push({ i, file, bytes: buf.length, sha: sha(buf), cam: camPrint(s.cam), draws: s.draws, tris: s.tris, pending: s.pending, walking: s.walking, station: s.station })
    return s
  }
  /* frame zero is the departure stop as the visitor sits reading it, and it is
     the clip's own first frame: the press cuts into nothing */
  await page.evaluate(() => window.__pre.raw())
  await shoot(0)
  await witness(0)
  /* the frame asks for the station and the rail takes it up through promises
     of its own: the first step waits for those to have settled, or the leg
     begins one frame later in one run than in the other */
  await page.evaluate((s) => window.__forge.station(s), TO)
  await page.waitForTimeout(300)

  /* THE CLIP STARTS WHERE THE EYE STARTS MOVING. The rail takes the request
     up in the first update after it, and whether that update lands before or
     after the frame the gate lets through is not ours to fix from outside. A
     leading frame that repeats the still is dropped instead, so both runs open
     on the same instant of the leg and the still is still the clip's frame 0. */
  const still = frames[0].cam
  let began = false
  let arrivedAt = -1
  let idle = 0
  let i = 1
  let broke = null
  const cap = limit || CAP
  try {
  while (i < cap) {
    await page.evaluate(() => window.__pre.step())
    await page.evaluate(() => window.__pre.raw())
    if (!began) {
      const cam = await page.evaluate(() => window.__forge.state().cam)
      if (camPrint(cam) === still) {
        if (++idle > 40) throw new Error('the leg never got under way')
        continue
      }
      began = true
    }
    const s = await shoot(i)
    await witness(i)
    if (!s.walking && arrivedAt < 0) arrivedAt = i
    if (arrivedAt >= 0 && i >= arrivedAt + TAIL) break
    i++
  }
  } catch (err) {
    broke = String(err.message).slice(0, 200)
    console.error(`the walk stopped at frame ${i}: ${broke}`)
  }
  const queued = await page.evaluate(() => window.__pre.queued())
  const starved = await page.evaluate(() => window.__pre.starved())
  await ctx.close()
  return {
    dir,
    framing: FRAMING,
    view: VIEW,
    tier: TIER,
    samples: SAMPLES,
    fps: FPS,
    grain: GRAIN,
    from: FROM,
    to: TO,
    backend,
    pendingAtRest,
    arrivedAt,
    settleSteps,
    tail: TAIL,
    frames,
    lateRequests,
    errors,
    stalls,
    broke,
    queuedAtEnd: queued,
    starved,
    standingSeconds: round((Date.now() - t0) / 1000, 1),
  }
}

const serveOff = flag('serve') === 'off'
/* the loopback address by name, not by host name: this vite binds `localhost`
   to the v6 address alone and every rig here fetches the v4 one */
const server = serveOff ? null : spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', cwd: APP_ROOT })
if (server) console.error(`preview pid ${server.pid} on ${BASE}`)
try {
  await waitForServer(`${BASE}/`)
  const said = await assertServer(BASE)
  console.error(`server ${said.head.slice(0, 7)} on ${BASE}`)
  const browser = await chromium.launch({ args: [...browserArgs(), ...FRAME_TIME_FLAGS] })
  try {
    if (PROOF) {
      const a = await oneCapture(browser, join(OUT_ROOT, `proof-${FRAMING}-a`), PROOF)
      const b = await oneCapture(browser, join(OUT_ROOT, `proof-${FRAMING}-b`), PROOF)
      let samePixels = 0
      let sameCam = 0
      const differ = []
      for (let i = 0; i < Math.min(a.frames.length, b.frames.length); i++) {
        if (a.frames[i].sha === b.frames[i].sha) samePixels++
        else differ.push(i)
        if (a.frames[i].cam === b.frames[i].cam) sameCam++
      }
      const n = Math.min(a.frames.length, b.frames.length)
      console.log(`\n== determinism, ${FRAMING}, ${n} frames, grain ${GRAIN ? 'on' : 'held'} ==`)
      console.log(`   identical pixels   ${samePixels} / ${n}`)
      console.log(`   identical camera   ${sameCam} / ${n}`)
      console.log(`   frames that differ ${differ.length ? differ.slice(0, 12).join(', ') : 'none'}`)
      console.log(`   requests after the clock was taken: a ${a.lateRequests.length}, b ${b.lateRequests.length}`)
      console.log(`   page errors: a ${a.errors.length}, b ${b.errors.length}`)
      writeFileSync(join(OUT_ROOT, `proof-${FRAMING}.json`), JSON.stringify({ n, samePixels, sameCam, differ, a: { ...a, frames: a.frames.map((f) => ({ i: f.i, sha: f.sha, cam: f.cam })) }, b: { ...b, frames: b.frames.map((f) => ({ i: f.i, sha: f.sha, cam: f.cam })) } }, null, 1))
      if (samePixels !== n) process.exitCode = 1
    } else {
      const dir = join(OUT_ROOT, FRAMING)
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
      const r = await oneCapture(browser, dir, 0)
      const clip = r.frames.filter((f) => f.i <= r.arrivedAt)
      const total = r.frames.reduce((a, f) => a + f.bytes, 0)
      console.log(`\n== ${FRAMING} ${VIEW.width}x${VIEW.height}, tier ${r.tier}, samples ${r.samples} ==`)
      console.log(`   ${clip.length} frames of walk (${round(clip.length / FPS, 2)} s), ${r.frames.length} kept with the tail`)
      console.log(`   arrival at frame ${r.arrivedAt}; departure still f00000, arrival still f${String(r.arrivedAt).padStart(5, '0')}`)
      console.log(`   requests after the clock was taken: ${r.lateRequests.length}${r.lateRequests.length ? ` (${r.lateRequests.slice(0, 4).join(', ')})` : ''}`)
      console.log(`   textures pending, max over the leg: ${Math.max(...r.frames.map((f) => f.pending))}`)
      console.log(`   draws ${clip[0].draws} to ${Math.max(...clip.map((f) => f.draws))}, triangles ${Math.max(...clip.map((f) => f.tris))}`)
      console.log(`   PNG on disk ${round(total / 1024 / 1024 / 1024, 2)} GB in ${dir}`)
      console.log(`   page errors ${r.errors.length ? r.errors.slice(0, 3).join(' | ') : 'none'}`)
      writeFileSync(join(dir, 'frames.json'), JSON.stringify(r, null, 1))
    }
  } finally {
    await browser.close()
  }
} finally {
  server?.kill('SIGTERM')
}
