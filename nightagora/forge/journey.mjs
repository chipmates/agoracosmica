// The forge's second eye: walk the LIVE museum like a visitor — real
// scroll events, real clicks, real drags, real timers, no __forge.jump
// cleanup — and shoot each beat. Catches stuck states the deterministic
// jump rig cannot see.
//
//   pnpm build && node forge/journey.mjs                 the lobby's night
//   pnpm build && node forge/journey.mjs wing <slug>     one wing's rail
//   JOURNEY_VP=mobile ...                                the phone postcard
//
// The lobby's walk is: eclipse, descent, lobby, wheel, pane, breath, wing,
// back to the wheel, then the wing's own address cold.
//
// THE WING'S WALK IS INPUT, NOT API. A station reached with
// `window.__forge` is a station the rig reached, not a station a visitor
// can reach, so the wing walk moves only with the wheel, a drag or a click,
// and it says which of the three moved it. It walks the rail forward
// through every station and back, drags to the four corners of the look
// cone at each one, activates the door at each one and records where it
// goes, and reloads at a station to prove the hash is a return path. The
// forge hook is read for the station standing and for nothing else.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { assertAdapter, assertBackend, assertServer, browserArgs, waitForServer } from './rig.mjs'

const plain = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const SURFACE = plain[0] ?? process.env['JOURNEY_SURFACE'] ?? 'lobby'
const WING = SURFACE === 'wing'
const SLUG = WING ? (plain[1] ?? process.env['JOURNEY_SLUG'] ?? 'vinci') : ''
const PORT = Number(process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://localhost:${PORT}`
// JOURNEY_VP=mobile walks the same night at the phone postcard
const MOBILE = process.env['JOURNEY_VP'] === 'mobile'
const VP = MOBILE
  ? { width: 390, height: 844, deviceScaleFactor: 2 }
  : { width: 1512, height: 950, deviceScaleFactor: 1 }
const TIER = process.env['JOURNEY_TIER'] ?? (MOBILE ? 'calm' : 'hero')
const NAME = `${WING ? `journey-wing-${SLUG}` : 'journey'}${MOBILE ? '-mobile' : ''}`
const OUT = new URL(`./shots/${NAME}/`, import.meta.url).pathname
/** the four corners of the look cone, as the direction a hand drags in */
const CORNERS = [
  { n: 1, dx: -1, dy: -1 },
  { n: 2, dx: 1, dy: -1 },
  { n: 3, dx: 1, dy: 1 },
  { n: 4, dx: -1, dy: 1 },
]

function startPreview() {
  return spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: false,
  })
}

mkdirSync(OUT, { recursive: true })
const server = startPreview()
const doors = []
const trouble = []
let browser = null
try {
  await waitForServer(BASE)
  const said = await assertServer(BASE)
  console.log(`[journey] server ${said.head.slice(0, 7)} at ${said.root}, tier ${TIER}`)
  browser = await chromium.launch({ args: browserArgs() })
  const context = await browser.newContext({
    viewport: { width: VP.width, height: VP.height },
    deviceScaleFactor: VP.deviceScaleFactor,
  })
  /* THE DOOR OPENS THE LIBRARY, AND THE RIG IS NOT THE LIBRARY. Every
     request to the app's own origin is answered locally, so a walk records
     where the door goes without a single call over the wire. */
  await context.route(/agoracosmica\.org/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>the door</title>' })
  )
  // an anchor with target=_blank never passes through window.open, so both
  // paths are recorded: the stub for a script, the popup for a link
  await context.addInitScript(() => {
    window.__doors = []
    const real = window.open.bind(window)
    window.open = (url, ...rest) => {
      window.__doors.push(String(url ?? ''))
      return real(url, ...rest)
    }
  })
  const page = await context.newPage()
  // the listener goes on AFTER the walk's own page exists: the context
  // announces every page it opens, its first one included
  context.on('page', (popup) => {
    if (popup === page) return
    doors.push({ how: 'popup', url: popup.url() })
    void popup.close().catch(() => {})
  })
  let firstLine = ''
  page.on('pageerror', (err) => console.error(`[pageerror] ${err.message}`))
  page.on('console', (msg) => {
    if (msg.text().startsWith('backend=')) firstLine = msg.text()
    if (msg.type() === 'error') console.log(`[console.error] ${msg.text()}`)
  })
  await page.goto(WING ? `${BASE}/w/${SLUG}?tier=${TIER}` : `${BASE}/?tier=${TIER}`)
  await page.waitForFunction(() => Boolean(window.__forge))
  const stamp = await assertBackend(page)
  assertAdapter(firstLine, process.env['FORGE_BACKEND'] ?? 'webgpu')
  if (stamp.tier !== TIER) throw new Error(`asked for tier=${TIER}, the app stamped ${stamp.tier}`)
  console.log(`[journey] ${firstLine}`)

  let step = 0
  const state = () =>
    page.evaluate(() => ({
      phase: document.body.dataset.phase,
      status: document.getElementById('status')?.textContent ?? '',
    }))
  const shot = async (name) => {
    const s = await state()
    step += 1
    const tag = `${String(step).padStart(2, '0')}-${name}`
    console.log(`[journey] ${tag}  phase=${s.phase}  status="${s.status}"`)
    await page.screenshot({ path: `${OUT}${tag}.png` })
  }
  const wheel = async (dy, times = 1, gap = 120) => {
    for (let i = 0; i < times; i++) {
      await page.mouse.wheel(0, dy)
      await page.waitForTimeout(gap)
    }
  }
  const fail = (why) => {
    throw new Error(why)
  }
  const waitPhase = async (want, ms = 15000) => {
    try {
      await page.waitForFunction((p) => document.body.dataset.phase === p, want, { timeout: ms })
      return true
    } catch {
      const s = await state()
      console.log(`[journey] STUCK waiting for "${want}" — at phase=${s.phase} status="${s.status}"`)
      await shot(`STUCK-wanted-${want}`)
      return false
    }
  }

  if (WING) {
    /* ------------------------------------------------- THE WING'S OWN RAIL
       Everything below moves with the wheel, a drag or a click. The forge
       hook is read to say WHICH station is standing and never to reach one:
       a rail that only an API can walk is a rail no visitor has walked. */
    if (!(await waitPhase('wing', 15000))) fail(`the deep link /w/${SLUG} never stood in a wing`)
    await page.waitForTimeout(1800)
    const cx = Math.round(VP.width / 2)
    const cy = Math.round(VP.height / 2)
    const now = () =>
      page.evaluate(() => {
        const s = window.__forge.state()
        return { i: s.station, id: s.stationId, ids: s.stationIds ?? [], n: s.stations }
      })
    const first = await now()
    if (!first.n) fail('the wing reports no station')
    console.log(`[journey] ${first.n} station(s): ${first.ids.join(', ') || '(unnamed)'}`)
    await shot(`station-${String(first.i + 1).padStart(2, '0')}-${first.id || 'start'}`)

    /** one step along the rail, with a hand: the wheel first, then a drag
        on the rail itself, then the rail's own control for that station */
    const nudge = async (want, dir) => {
      const rail = page.locator('.wing-rail')
      const tries = [
        ['wheel', async () => {
          await page.mouse.move(cx, cy)
          for (let k = 0; k < 3; k++) {
            await page.mouse.wheel(0, dir * 320)
            await page.waitForTimeout(140)
          }
        }],
        ['drag', async () => {
          const box = (await rail.count()) ? await rail.boundingBox() : null
          const ax = box ? box.x + box.width / 2 : cx
          const ay = box ? box.y + box.height / 2 : cy
          await page.mouse.move(ax, ay)
          await page.mouse.down()
          for (let k = 1; k <= 10; k++) {
            await page.mouse.move(ax - dir * 24 * k, ay)
            await page.waitForTimeout(18)
          }
          await page.mouse.up()
        }],
        ['click', async () => {
          const marks = page.locator('.wing-rail button, .wing-rail [role="button"], .wing-step')
          const count = await marks.count()
          if (count > want) await marks.nth(want).click({ force: true })
        }],
      ]
      for (const [how, gesture] of tries) {
        await gesture()
        await page.waitForTimeout(900)
        if ((await now()).i === want) return how
      }
      return null
    }

    /** the four corners of the look cone, reached by dragging the gaze */
    const cone = async (id) => {
      const px = Math.round(VP.width * 0.22)
      const py = Math.round(VP.height * 0.18)
      const reached = []
      for (const c of CORNERS) {
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let k = 1; k <= 8; k++) {
          await page.mouse.move(cx + (c.dx * px * k) / 8, cy + (c.dy * py * k) / 8)
          await page.waitForTimeout(20)
        }
        await page.waitForTimeout(320)
        const r = await page.evaluate(() => window.__forge.state().cam.r)
        await page.screenshot({ path: `${OUT}cone-${id}-c${c.n}.png` })
        await page.mouse.up()
        await page.waitForTimeout(260)
        reached.push({
          n: c.n,
          yaw: ((r?.[1] ?? 0) * 180) / Math.PI,
          pitch: ((r?.[0] ?? 0) * 180) / Math.PI,
        })
      }
      return reached
    }
    /** what the four drags actually reached, said plainly. A hand that
        drags to four corners and reads the same gaze at all four is a
        station with no look cone, which is a fact about the wing. */
    const coneLine = (reached) => {
      const said = reached.map((c) => `c${c.n} yaw ${c.yaw.toFixed(1)} pitch ${c.pitch.toFixed(1)}`).join(' \u00b7 ')
      const span = Math.max(...reached.map((c) => c.yaw)) - Math.min(...reached.map((c) => c.yaw))
      const rise = Math.max(...reached.map((c) => c.pitch)) - Math.min(...reached.map((c) => c.pitch))
      return span < 0.5 && rise < 0.5 ? `${said}  (the drag moved no gaze: this station has no look cone)` : said
    }

    /** the door, activated: a click on the control the frame puts at every
        station, and the address it opened */
    const knock = async (id) => {
      const door = page.locator('.wing-door').first()
      if (!(await door.count())) {
        trouble.push(`${id}: no door at this station`)
        return null
      }
      const before = doors.length
      await door.click({ force: true })
      await page.waitForTimeout(900)
      const opened = doors.slice(before).map((d) => d.url)
      const stubbed = await page.evaluate(() => (window.__doors ?? []).slice(-1))
      const url = opened[0] ?? stubbed[0] ?? null
      if (!url) trouble.push(`${id}: the door was activated and opened nothing`)
      return url
    }

    const walked = []
    for (let i = 0; i < first.n; i++) {
      const here = await now()
      if (i > 0) {
        const how = await nudge(i, 1)
        if (!how) {
          console.log(`[journey] STUCK: no wheel, drag or click moved the rail from ${here.id} to station ${i + 1}`)
          await shot(`STUCK-forward-${i + 1}`)
          fail(`the rail does not move forward with input at station ${i + 1}`)
        }
        walked.push(how)
      }
      const at = await now()
      const tag = `${String(at.i + 1).padStart(2, '0')}-${at.id || `station-${at.i + 1}`}`
      if (i > 0) await shot(`station-${tag}`)
      const corners = await cone(at.id || tag)
      const url = await knock(at.id || tag)
      console.log(`[journey] station ${at.i + 1}/${at.n} ${at.id}  door=${url ?? 'NONE'}`)
      console.log(`[journey]   cone: ${coneLine(corners)}`)
    }
    console.log(`[journey] forward with input: ${[...new Set(walked)].join(', ') || 'one station, nothing to move'}`)

    // the hash is the return path: a reload stands the visitor where he stood
    const standing = await now()
    const hash = new URL(page.url()).hash
    const wants = standing.n > 1 || standing.i > 0
    if (wants && hash !== `#s=${standing.i}`) trouble.push(`the URL says "${hash}" at station ${standing.i + 1}`)
    await page.reload()
    await page.waitForFunction(() => Boolean(window.__forge))
    if (!(await waitPhase('wing', 15000))) fail('the reload did not land in the wing')
    await page.waitForTimeout(1800)
    const after = await now()
    if (after.i !== standing.i)
      trouble.push(`the reload at station ${standing.i + 1} landed at ${after.i + 1}`)
    await shot(`reload-at-${String(standing.i + 1).padStart(2, '0')}`)
    console.log(`[journey] reload at station ${standing.i + 1}: hash "${hash || '(none)'}" -> standing at ${after.i + 1}`)

    // and back, the same way, with a hand
    for (let i = standing.i - 1; i >= 0; i--) {
      const how = await nudge(i, -1)
      if (!how) {
        console.log(`[journey] STUCK: no wheel, drag or click moved the rail back to station ${i + 1}`)
        await shot(`STUCK-back-${i + 1}`)
        fail(`the rail does not move back with input at station ${i + 1}`)
      }
      walked.push(how)
    }
    const home = await now()
    if (home.i !== 0) trouble.push(`the walk back stopped at station ${home.i + 1}, not the first`)
    await shot('back-at-the-first-station')

    // the way home lands in the lobby, never in the overture
    await page.locator('.wing-lobby').first().click({ force: true })
    if (!(await waitPhase('wheel', 10000))) fail('the way home did not land at the wheel')
    await page.waitForTimeout(1600)
    await shot('lobby-again')

    console.log(`[journey] doors opened: ${doors.length}`)
    for (const d of doors.slice(0, 3)) console.log(`[journey]   ${d.how} ${d.url}`)
    if (trouble.length) {
      console.log('JOURNEY FLAGGED:')
      for (const t of [...new Set(trouble)]) console.log(' ·', t)
      process.exitCode = 1
    } else {
      console.log('clean: every station reached forward and back with input, a door at each, the hash a return path')
    }
    await browser.close()
    server.kill()
    process.exit(process.exitCode ?? 0)
  }

  // 1 · the overture plays itself: transit -> held
  await waitPhase('held')
  await shot('held')

  // 2 · the descent: one gesture, and the plates carry you down
  await wheel(300, 2)
  if (!(await waitPhase('descent', 8000))) fail('the walk stopped here')
  await page.waitForTimeout(1200)
  await shot('descent')
  if (!(await waitPhase('agora', 15000))) fail('the walk stopped here')
  await page.waitForTimeout(2500)
  await shot('agora')

  // 3 · the lobby: after the arrival breath, the gaze rises to the wheel
  await page.waitForTimeout(1800)
  await wheel(300, 10)
  if (!(await waitPhase('wheel'))) fail('the walk stopped here')
  await page.waitForTimeout(2500)
  await shot('wheel')

  // 4 · a name, then its pane
  const chip = page.locator('.star-chip.lit').first()
  try {
    await chip.waitFor({ state: 'visible', timeout: 12000 })
  } catch {
    console.log('[journey] STUCK: no name lit on the wheel')
    await shot('STUCK-no-names')
    fail('the walk stopped here')
  }
  await chip.click({ force: true })
  await page.waitForTimeout(1400)
  await shot('pane')

  // 5 · the wheel turns until a name with a museum is standing, then the
  // pane's own door: one gold breath, a hard cut, the first station
  const closePane = async () => {
    if (await page.locator('#figure-pane').isVisible()) {
      await page.locator('.pane-close').click()
      await page.waitForTimeout(900)
    }
  }
  let entered = false
  for (let house = 0; house < 6 && !entered; house++) {
    await closePane()
    await page.waitForTimeout(1000)
    const names = await page.locator('.star-chip.lit').count()
    for (let i = 0; i < names; i++) {
      // the wheel breathes, so a name is never "stable": the click is
      // forced rather than waited for
      await page.locator('.star-chip.lit').nth(i).click({ force: true })
      await page.waitForTimeout(900)
      if (await page.locator('.pane-enter').isVisible()) {
        await shot('pane-with-a-museum')
        await page.locator('.pane-enter').click()
        entered = true
        break
      }
      await closePane()
    }
    if (entered) break
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(1600)
  }
  if (!entered) {
    console.log('[journey] STUCK: no wing reachable from the wheel')
    await shot('STUCK-no-wing')
    fail('the walk stopped here')
  }
  if (!(await waitPhase('breath', 6000))) fail('the walk stopped here')
  await shot('breath')
  if (!(await waitPhase('wing', 10000))) fail('the walk stopped here')
  await page.waitForTimeout(1600)
  await shot('wing')
  const url = page.url()
  if (!/\/w\/[a-z0-9-]+/.test(url)) {
    console.log(`[journey] STUCK: the wing has no address of its own (${url})`)
    await shot('STUCK-no-address')
    fail('the walk stopped here')
  }

  // 6 · the way home lands at the wheel, never at the overture
  await page.locator('.wing-lobby').click()
  if (!(await waitPhase('wheel', 8000))) fail('the walk stopped here')
  await page.waitForTimeout(2000)
  await shot('wheel-again')

  // 7 · the deep link: the wing opens with no overture at all
  await page.goto(`${BASE}${new URL(url).pathname}?tier=${TIER}`)
  await page.waitForFunction(() => Boolean(window.__forge))
  if (!(await waitPhase('wing', 12000))) fail('the walk stopped here')
  await page.waitForTimeout(1600)
  await shot('wing-deep-link')

  await browser.close()
  console.log(`journey shots written to forge/shots/${NAME}/`)
} catch (err) {
  console.error(`RIG REFUSED: ${err.message}`)
  process.exitCode = 1
} finally {
  // a browser left open holds this process alive after the server is gone,
  // which is how a failed walk turned into a hang
  await browser?.close().catch(() => {})
  server.kill()
}
