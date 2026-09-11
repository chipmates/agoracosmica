// The forge's second eye: walk the LIVE journey like a visitor — real
// scroll events, real timers, no __forge.jump cleanup — and shoot each
// beat. Catches stuck states the deterministic jump rig cannot see.
// Usage: pnpm build && node forge/journey.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = Number(process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://localhost:${PORT}`
// JOURNEY_VP=mobile walks the same night at the phone postcard
const MOBILE = process.env['JOURNEY_VP'] === 'mobile'
const VP = MOBILE
  ? { width: 390, height: 844, deviceScaleFactor: 2 }
  : { width: 1512, height: 950, deviceScaleFactor: 1 }
const OUT = new URL(`./shots/${MOBILE ? 'journey-mobile' : 'journey'}/`, import.meta.url).pathname

function startPreview() {
  return spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: false,
  })
}

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('preview server never came up')
}

mkdirSync(OUT, { recursive: true })
const server = startPreview()
try {
  await waitForServer(BASE)
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: VP.width, height: VP.height },
    deviceScaleFactor: VP.deviceScaleFactor,
  })
  page.on('pageerror', (err) => console.error(`[pageerror] ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[console.error] ${msg.text()}`)
  })
  await page.goto(BASE)
  await page.waitForFunction(() => Boolean(window.__forge))

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
  await wheel(300, 5, 200)
  await page.waitForTimeout(1400)
  await shot('descent-breath')
  await wheel(300, 5, 200)
  await page.waitForTimeout(1200)
  await shot('descent-early')
  // scrub back a little mid-dive: the travel must reverse cleanly
  await wheel(-300, 3, 200)
  await page.waitForTimeout(1200)
  await shot('descent-scrubbed-back')
  // forward until the landing takes
  for (let i = 0; i < 40; i++) {
    const s = await state()
    if (s.phase === 'agora') break
    await wheel(300, 1, 140)
  }
  await waitPhase('agora', 15000)
  await page.waitForTimeout(2500)
  await shot('agora')

  // 3 · after the arrival breath, scroll up into the sky of thirty
  await page.waitForTimeout(1800)
  await wheel(300, 10)
  if (!(await waitPhase('sky'))) process.exit(1)
  await page.waitForTimeout(2500)
  await shot('sky')

  // 4 · the wheel: open a name, then read its pane
  await page.waitForTimeout(1200)
  const chip = page.locator('.star-chip.lit').first()
  await chip.waitFor({ state: 'visible', timeout: 12000 })
  await chip.click()
  await page.waitForTimeout(1400)
  await shot('pane')
  await page.locator('.pane-close').click()
  await page.waitForTimeout(1200)
  await shot('sky-again')
  await page.locator('#sky-return').click()
  if (await waitPhase('agora', 10000)) {
    await page.waitForTimeout(2500)
    await shot('fire-again')
  }

  await browser.close()
  console.log(`journey shots written to forge/shots/journey/`)
} finally {
  server.kill()
}
