// The forge's second eye: walk the LIVE museum like a visitor — real
// scroll events, real clicks, real timers, no __forge.jump cleanup — and
// shoot each beat. Catches stuck states the deterministic jump rig cannot
// see. The walk is: eclipse, descent, lobby, wheel, pane, breath, wing,
// back to the wheel, then the wing's own address cold.
// Usage: pnpm build && node forge/journey.mjs  (JOURNEY_VP=mobile for the phone)
// The phone walks the CALM tier, because that is the tier the public gate is
// measured on: a lobby that only holds together at the hero tier has not been
// walked by anyone who will actually arrive.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { assertAdapter, assertBackend, assertServer, browserArgs, waitForServer } from './rig.mjs'

const PORT = Number(process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://localhost:${PORT}`
// JOURNEY_VP=mobile walks the same night at the phone postcard
const MOBILE = process.env['JOURNEY_VP'] === 'mobile'
const VP = MOBILE
  ? { width: 390, height: 844, deviceScaleFactor: 2 }
  : { width: 1512, height: 950, deviceScaleFactor: 1 }
const TIER = process.env['JOURNEY_TIER'] ?? (MOBILE ? 'calm' : 'hero')
const OUT = new URL(`./shots/${MOBILE ? 'journey-mobile' : 'journey'}/`, import.meta.url).pathname

function startPreview() {
  return spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: false,
  })
}

mkdirSync(OUT, { recursive: true })
const server = startPreview()
try {
  await waitForServer(BASE)
  const said = await assertServer(BASE)
  console.log(`[journey] server ${said.head.slice(0, 7)} at ${said.root}, tier ${TIER}`)
  const browser = await chromium.launch({ args: browserArgs() })
  const page = await browser.newPage({
    viewport: { width: VP.width, height: VP.height },
    deviceScaleFactor: VP.deviceScaleFactor,
  })
  let firstLine = ''
  page.on('pageerror', (err) => console.error(`[pageerror] ${err.message}`))
  page.on('console', (msg) => {
    if (msg.text().startsWith('backend=')) firstLine = msg.text()
    if (msg.type() === 'error') console.log(`[console.error] ${msg.text()}`)
  })
  await page.goto(`${BASE}/?tier=${TIER}`)
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

  // 1 · the overture plays itself: transit -> held
  await waitPhase('held')
  await shot('held')

  // 2 · the descent: one gesture, and the plates carry you down
  await wheel(300, 2)
  if (!(await waitPhase('descent', 8000))) process.exit(1)
  await page.waitForTimeout(1200)
  await shot('descent')
  if (!(await waitPhase('agora', 15000))) process.exit(1)
  await page.waitForTimeout(2500)
  await shot('agora')

  // 3 · the lobby: after the arrival breath, the gaze rises to the wheel
  await page.waitForTimeout(1800)
  await wheel(300, 10)
  if (!(await waitPhase('wheel'))) process.exit(1)
  await page.waitForTimeout(2500)
  await shot('wheel')

  // 4 · a name, then its pane
  const chip = page.locator('.star-chip.lit').first()
  try {
    await chip.waitFor({ state: 'visible', timeout: 12000 })
  } catch {
    console.log('[journey] STUCK: no name lit on the wheel')
    await shot('STUCK-no-names')
    process.exit(1)
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
    process.exit(1)
  }
  if (!(await waitPhase('breath', 6000))) process.exit(1)
  await shot('breath')
  if (!(await waitPhase('wing', 10000))) process.exit(1)
  await page.waitForTimeout(1600)
  await shot('wing')
  const url = page.url()
  if (!/\/w\/[a-z0-9-]+/.test(url)) {
    console.log(`[journey] STUCK: the wing has no address of its own (${url})`)
    await shot('STUCK-no-address')
    process.exit(1)
  }

  // 6 · the way home lands at the wheel, never at the overture
  await page.locator('.wing-lobby').click()
  if (!(await waitPhase('wheel', 8000))) process.exit(1)
  await page.waitForTimeout(2000)
  await shot('wheel-again')

  // 7 · the deep link: the wing opens with no overture at all
  await page.goto(`${BASE}${new URL(url).pathname}?tier=${TIER}`)
  await page.waitForFunction(() => Boolean(window.__forge))
  if (!(await waitPhase('wing', 12000))) process.exit(1)
  await page.waitForTimeout(1600)
  await shot('wing-deep-link')

  await browser.close()
  console.log(`journey shots written to forge/shots/${MOBILE ? 'journey-mobile' : 'journey'}/`)
} catch (err) {
  console.error(`RIG REFUSED: ${err.message}`)
  process.exitCode = 1
} finally {
  server.kill()
}
