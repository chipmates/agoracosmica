// The forge's second eye: walk the LIVE journey like a visitor — real
// scroll events, real timers, no __forge.jump cleanup — and shoot each
// beat. Catches stuck states the deterministic jump rig cannot see.
// Usage: pnpm build && node forge/journey.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = Number(process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://localhost:${PORT}`
const OUT = new URL('./shots/journey/', import.meta.url).pathname

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
  const page = await browser.newPage({ viewport: { width: 1512, height: 950 } })
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

  // 2 · the descent: through the ring, the stone gate, the questions,
  // down to the fire
  await wheel(300, 2)
  if (!(await waitPhase('descent', 8000))) process.exit(1)
  await wheel(300, 6, 200)
  await page.waitForTimeout(1600)
  await shot('stone-gate-held')
  // the stone must HOLD against further scrolling until accepted
  await wheel(300, 6, 150)
  await page.waitForTimeout(1200)
  await shot('stone-gate-still-held')
  const quiet = page.locator('#gate-quiet')
  await quiet.waitFor({ state: 'visible', timeout: 5000 })
  await quiet.click()
  await page.waitForTimeout(400)
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

  // 4 · the wheel of the night: step forward two houses and back
  // (one gesture per step; the wheel has a 0.8s cooldown)
  await wheel(300, 2, 1100)
  await page.waitForTimeout(2500)
  await shot('sky-wheeled-forward')
  // step back until the plate reads Philosophers again (the cooldown may
  // swallow an event; a visitor would simply flick once more)
  for (let i = 0; i < 8; i++) {
    const name = await page.evaluate(
      () => document.querySelector('#constellation-plate .plate-name')?.textContent ?? ''
    )
    if (/philosophers/i.test(name)) break
    await wheel(-300, 1)
    await page.waitForTimeout(1100)
  }
  await page.waitForTimeout(1600)
  await shot('sky-wheeled-back')

  // 5 · open Marcus's name -> his pane -> enter his night
  const marcusChip = page.locator('.star-chip', { hasText: 'Marcus Aurelius' })
  await marcusChip.waitFor({ state: 'visible', timeout: 8000 })
  await marcusChip.click()
  await page.waitForTimeout(900)
  await shot('pane-marcus')
  const enter = page.locator('.pane-enter')
  await enter.waitFor({ state: 'visible', timeout: 4000 })
  await enter.click()
  const crossed = await waitPhase('crossing', 8000)
  if (crossed) {
    await shot('crossing')
    await waitPhase('camp', 30000)
    await page.waitForTimeout(2500)
    await shot('camp')

    // 6 · scrolling at the camp must not strand the visitor either
    await wheel(-300, 6)
    await page.waitForTimeout(1500)
    await shot('camp-after-scroll-up')
    await wheel(300, 6)
    await page.waitForTimeout(1500)
    await shot('camp-after-scroll-down')

    // 7 · the way onward: wait for the hearth keeper, take the exit,
    // the return breath should convene the council
    const exit = page.locator('.keeper-exit')
    try {
      await exit.waitFor({ state: 'visible', timeout: 30000 })
      await exit.click()
      if (await waitPhase('council', 10000)) {
        await page.waitForTimeout(4000)
        await shot('council')
        await page.waitForTimeout(4000)
        await shot('council-seated')
      }
    } catch {
      console.log('[journey] keeper exit never appeared at the camp')
      await shot('STUCK-no-keeper-exit')
    }
  }

  await browser.close()
  console.log(`journey shots written to forge/shots/journey/`)
} finally {
  server.kill()
}
