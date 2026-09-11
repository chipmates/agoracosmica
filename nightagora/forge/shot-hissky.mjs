// The atlas eye: three life-stages, exact bloom marks, real input and stillness.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = Number(process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://localhost:${PORT}/hissky.html`
const OUT = new URL('./shots/', import.meta.url).pathname
const VIEWPORTS = [
  { tag: 'desktop', width: 1512, height: 950, deviceScaleFactor: 1 },
  { tag: 'mobile', width: 390, height: 844, deviceScaleFactor: 2 },
]
const LADDER = Array.from({ length: 12 }, (_, i) => i % 5)
const problems = []
let browser

function check(ok, label, detail = '') {
  if (!ok) problems.push(`${label}${detail ? `: ${detail}` : ''}`)
}

async function rendered(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

async function openPage(vp, reduced = false) {
  const tag = `${vp.tag}${reduced ? ' reduced' : ''}`
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    hasTouch: vp.tag === 'mobile',
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  page.on('pageerror', (e) => problems.push(`[${tag}] pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[${tag}] console: ${m.text()}`)
  })
  await page.goto(BASE)
  await page.waitForFunction(() => (
    typeof window.__hisSky?.set === 'function' &&
    typeof window.__hisSky?.setLevels === 'function' &&
    typeof window.__hisSky?.state === 'function'
  ))
  await rendered(page)
  return page
}

async function shoot(page, name, vp) {
  await rendered(page)
  await page.screenshot({ path: `${OUT}hissky-${name}-${vp.tag}.png` })
  console.log(`[hissky] ${name} ${vp.tag}`)
}

async function state(page, tag) {
  const s = await page.evaluate(() => window.__hisSky.state())
  for (const key of ['levels', 'shown']) {
    check(Array.isArray(s[key]) && s[key].length === 12 &&
      s[key].every((v) => Number.isFinite(v) && v >= 0 && v <= 4),
    `[${tag}] ${key} must contain twelve finite levels in 0..4`, JSON.stringify(s[key]))
  }
  return s
}

async function targets(page, tag, selector) {
  const boxes = await page.locator(selector).evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect()
    return {
      name: el.getAttribute('aria-label') || el.textContent?.trim() || el.className,
      x: r.x, y: r.y, width: r.width, height: r.height,
      inFrame: r.left >= -0.5 && r.top >= -0.5 &&
        r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5,
    }
  }))
  check(boxes.length > 0, `[${tag}] interaction targets exist`, selector)
  for (const b of boxes) {
    check(b.width >= 43.9 && b.height >= 43.9,
      `[${tag}] 44px target ${b.name}`, `${b.width.toFixed(1)} × ${b.height.toFixed(1)}`)
    check(b.inFrame, `[${tag}] target is inside viewport: ${b.name}`, JSON.stringify(b))
  }
}

async function activate(locator, vp) {
  if (vp.tag === 'mobile') await locator.tap()
  else await locator.click()
}

async function checkStageClicks(page, vp) {
  const totals = []
  for (const stage of ['0', '1', '2']) {
    await activate(page.locator(`#stages button[data-stage="${stage}"]`), vp)
    await rendered(page)
    await page.waitForFunction(() => {
      const s = window.__hisSky.state()
      return !s.autoPlay && s.shown.every((v, i) => Math.abs(v - s.levels[i]) < 0.025)
    }, null, { timeout: 12000 })
    const s = await state(page, `${vp.tag} stage ${stage}`)
    totals.push(s.levels.reduce((sum, v) => sum + v, 0))
    check(await page.locator(`#stages button[data-stage="${stage}"]`).evaluate(
      (b) => b.classList.contains('here')),
    `[${vp.tag}] clicked stage ${stage} is selected`)
  }
  check(totals[0] < totals[1] && totals[1] < totals[2] && totals[2] > 47.9,
    `[${vp.tag}] stage clicks advance the same twelve seeds`, JSON.stringify(totals))
  await activate(page.locator('#stages button[data-stage="auto"]'), vp)
  check((await state(page, `${vp.tag} autoplay`)).autoPlay === true,
    `[${vp.tag}] Let it live starts the timeline`)
  await page.evaluate(() => window.__hisSky.set(1))
  await rendered(page)
}

async function checkPanel(page, vp, capture = true) {
  const tag = `${vp.tag}${capture ? '' : ' reduced'} panel`
  const seed = page.locator('.seed-btn').nth(4)
  const panel = page.locator('#seed-panel')
  await activate(seed, vp)
  await panel.waitFor({ state: 'visible' })
  await rendered(page)
  check((await state(page, tag)).selected === 4, `[${tag}] pointer opens the selected seed`)
  const pane = await panel.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return {
      inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      focused: el.contains(document.activeElement),
      width: r.width, height: r.height,
    }
  })
  check(pane.inside, `[${tag}] seed pane fits the viewport`, JSON.stringify(pane))
  check(pane.focused, `[${tag}] focus enters the seed pane`)
  await targets(page, tag, '#seed-panel .panel-close')
  if (capture) await shoot(page, 'seed-pane', vp)
  await activate(page.locator('#seed-panel .panel-close'), vp)
  await panel.waitFor({ state: 'hidden' })
  check(await seed.evaluate((el) => el === document.activeElement), `[${tag}] Close restores seed focus`)
  check((await state(page, tag)).selected === null, `[${tag}] Close clears selection`)

  // Keyboard activation exercises the same visitor path without the rig setter.
  await seed.focus()
  await page.keyboard.press('Enter')
  await panel.waitFor({ state: 'visible' })
  check((await state(page, tag)).selected === 4, `[${tag}] Enter opens the focused seed`)
  await page.keyboard.press('Escape')
  await panel.waitFor({ state: 'hidden' })
  check(await seed.evaluate((el) => el === document.activeElement), `[${tag}] Escape restores seed focus`)
  check((await state(page, tag)).selected === null, `[${tag}] Escape clears selection`)
}

async function checkStillness(page, vp) {
  // Observe the visitor's natural reduced-motion state before any rig setter
  // freezes time; otherwise the rig itself could conceal a motion regression.
  await rendered(page)
  const before = await state(page, `${vp.tag} reduced`)
  const positions = () => page.locator('.seed-btn').evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect()
    return [r.x, r.y]
  }))
  const p0 = await positions()
  // Wall time, not frame count: headless dt is deliberately clamped.
  await page.waitForTimeout(1000)
  const after = await state(page, `${vp.tag} reduced`)
  const p1 = await positions()
  check(after.reduced === true && after.autoPlay === false,
    `[${vp.tag}] reduced motion composes a held state`)
  check(before.elapsed === after.elapsed,
    `[${vp.tag}] reduced decorative time is still`, `${before.elapsed} → ${after.elapsed}`)
  check(JSON.stringify(before.shown) === JSON.stringify(after.shown) &&
    after.shown.every((v, i) => v === after.levels[i]),
  `[${vp.tag}] reduced levels land immediately`)
  check(p0.every((p, i) => p.every((v, axis) => Math.abs(v - p1[i][axis]) < 0.01)),
    `[${vp.tag}] reduced seed positions are still`)
  await activate(page.locator('#stages button[data-stage="0"]'), vp)
  await rendered(page)
  const first = await state(page, `${vp.tag} reduced stage click`)
  check(!first.autoPlay && first.shown.every((v, i) => v === first.levels[i]),
    `[${vp.tag}] reduced stage selection lands immediately`)
  await page.evaluate((levels) => window.__hisSky.setLevels(levels), LADDER)
  await rendered(page)
  await targets(page, `${vp.tag} reduced`, '.seed-btn, #stages button')
  await shoot(page, 'reduced', vp)
  await checkPanel(page, vp, false)
}

const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
})
try {
  let ready = false
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) { ready = true; break }
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  if (!ready) throw new Error('His Sky preview server never came up')
  mkdirSync(OUT, { recursive: true })
  browser = await chromium.launch()
  for (const vp of VIEWPORTS) {
    const page = await openPage(vp)
    try {
      for (const [name, t] of [
        ['first-night', 0.06],
        ['growing', 0.5],
        ['wreath-complete', 1],
      ]) {
        await page.evaluate((v) => window.__hisSky.set(v), t)
        await shoot(page, name, vp)
        await state(page, `${vp.tag} ${name}`)
      }
      await targets(page, vp.tag, '.seed-btn, #stages button')
      await checkStageClicks(page, vp)
      await page.evaluate((levels) => window.__hisSky.setLevels(levels), LADDER)
      await rendered(page)
      const ladder = await state(page, `${vp.tag} bloom ladder`)
      check(ladder.shown.every((v, i) => v === LADDER[i]), `[${vp.tag}] exact five-stage ladder`)
      await shoot(page, 'bloom-ladder', vp)
      await checkPanel(page, vp)
    } catch (e) {
      problems.push(`[${vp.tag}] check: ${e.message}`)
    } finally {
      await page.close()
    }

    const quiet = await openPage(vp, true)
    try {
      await checkStillness(quiet, vp)
    } catch (e) {
      problems.push(`[${vp.tag} reduced] check: ${e.message}`)
    } finally {
      await quiet.close()
    }
  }
} catch (e) {
  problems.push(`[hissky] run: ${e.message}`)
} finally {
  await browser?.close()
  server.kill()
}
if (problems.length) {
  console.log('PROBLEMS:')
  for (const problem of [...new Set(problems)]) console.log(` · ${problem}`)
  process.exitCode = 1
} else {
  console.log('clean: no console errors')
  console.log('His Sky gates: life-stages, bloom ladder, pointer/touch, keyboard, focus, targets and reduced motion pass')
}
