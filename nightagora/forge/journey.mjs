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

  // 2 · scroll opens the door, the stone holds, the agora reveals
  await wheel(300, 8)
  await waitPhase('stone', 20000)
  await shot('stone')
  await waitPhase('agora', 20000)
  await page.waitForTimeout(2500)
  await shot('agora')

  // 3 · scroll up from the agora fire into the sky of thirty
  await wheel(300, 10)
  if (!(await waitPhase('sky'))) process.exit(1)
  await page.waitForTimeout(2500)
  await shot('sky')

  // 4 · scrolling back down must not strand the visitor
  await wheel(-300, 10)
  await page.waitForTimeout(2000)
  await shot('sky-after-scroll-up')

  // 5 · choose Marcus -> crossing -> camp (tap his focused light, twice:
  // once to lock the card, once to cross)
  // probe the roster until the card names Marcus — indices are not stable
  let found = false
  for (let i = 0; i < 30; i++) {
    await page.evaluate((k) => window.__forge.focusWanderer(k), i)
    await page.waitForTimeout(120)
    const card = await page.evaluate(() => {
      const el = document.getElementById('atlas-card')
      return {
        hidden: !el || el.hidden,
        name: document.querySelector('#atlas-card .card-name')?.textContent ?? '',
        left: el ? el.style.left : '',
        top: el ? el.style.top : '',
      }
    })
    if (/marcus/i.test(card.name)) {
      console.log(`[journey] Marcus is index ${i}, card at (${card.left}, ${card.top}) hidden=${card.hidden}`)
      found = true
      break
    }
  }
  if (!found) console.log('[journey] Marcus never appeared on the atlas card')
  await page.waitForTimeout(500)
  await shot('marcus-card')
  const light = await page.evaluate(() => {
    const el = document.getElementById('atlas-card')
    if (!el || el.hidden) return null
    // syncCard anchors the card at (light.x + 22, light.y - 24)
    return { x: parseFloat(el.style.left) - 22, y: parseFloat(el.style.top) + 24 }
  })
  if (light) {
    console.log(`[journey] tapping the light at (${light.x}, ${light.y})`)
    await page.mouse.click(light.x, light.y)
    await page.waitForTimeout(300)
    await page.mouse.click(light.x, light.y)
  } else {
    console.log('[journey] no visible card to derive the light position from')
  }
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
