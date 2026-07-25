// The camp's own eye: every station of his walk, at both stages, in one
// pass — plus a real-input probe, because shots looking good is NOT
// evidence the walk works (Round-3 rig lesson).
// Usage: pnpm build && node forge/shot-camp.mjs [round-label]
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = Number(process.env['FORGE_PORT'] ?? 5197)
const BASE = `http://localhost:${PORT}`
const ROUND = process.argv[2] ?? 'round-0'
const OUT = new URL(`./shots/camp/${ROUND}/`, import.meta.url).pathname

const STATES = [
  { name: '01-shore', camp: 'shore' },
  { name: '02-ford', camp: 'ford' },
  { name: '03-trace', camp: 'trace' },
  { name: '04-gate', camp: 'gate' },
  { name: '05-via', camp: 'via' },
  { name: '06-praetorium', camp: 'praetorium' },
  { name: '07-hearth', camp: 'hearth' },
  { name: '08-desk', camp: 'desk' },
  { name: '09-vista', camp: 'vista' },
  { name: '10-dusk', camp: 'dusk' },
  // Michel's law: the same ground with the gaze raised
  { name: '11-gaze-via', camp: 'via', gaze: 1 },
  { name: '12-gaze-gate', camp: 'gate', gaze: 0.55 },
]

const VIEWPORTS = [
  { tag: 'desktop', width: 1512, height: 950, deviceScaleFactor: 1 },
  { tag: 'mobile', width: 390, height: 844, deviceScaleFactor: 2 },
]

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
const problems = []
try {
  await waitForServer(BASE)
  const browser = await chromium.launch()
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
    })
    page.on('pageerror', (err) => problems.push(`[${vp.tag}] pageerror: ${err.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`[${vp.tag}] console: ${msg.text()}`)
    })
    // the Sitting is taken once per visitor: the rig walks a returning
    // night, so his desk is not shot through the contract card
    await page.addInitScript(() => {
      try {
        localStorage.setItem('na-gate', '1')
        localStorage.setItem('na-first', '1')
      } catch {
        /* private mode */
      }
    })
    await page.goto(BASE)
    await page.waitForFunction(() => Boolean(window.__forge))
    await page.waitForTimeout(1500)
    for (const s of STATES) {
      await page.evaluate(([camp, gaze]) => {
        window.__forge.freeze(12.4)
        window.__forge.jump('camp', { camp, gaze })
      }, [s.camp, s.gaze ?? 0])
      await page.waitForTimeout(420)
      await page.screenshot({ path: `${OUT}${vp.tag}-${s.name}.png` })
    }

    // ---- the probe: real input only, no forge jumps
    if (vp.tag === 'desktop') {
      await page.goto(BASE)
      await page.waitForFunction(() => Boolean(window.__forge))
      await page.waitForTimeout(900)
      await page.evaluate(() => window.__forge.jump('camp', {}))
      await page.waitForTimeout(300)
      const before = await page.evaluate(() => window.__forge.state().campWalk)
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, 140)
        await page.waitForTimeout(70)
      }
      await page.waitForTimeout(500)
      const afterWheel = await page.evaluate(() => window.__forge.state().campWalk)
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(500)
      const afterKeys = await page.evaluate(() => window.__forge.state().campWalk)
      // and the gaze: the night's grammar is grab-the-world, so pulling the
      // sky DOWN raises the eye. The sky must answer it.
      await page.mouse.move(700, 340)
      await page.mouse.down()
      await page.mouse.move(700, 700, { steps: 12 })
      await page.mouse.up()
      await page.waitForTimeout(700)
      const gaze = await page.evaluate(() => window.__forge.state().campGaze)
      await page.screenshot({ path: `${OUT}probe-live-gaze.png` })
      console.log(
        `probe: walk ${before.toFixed(3)} -> wheel ${afterWheel.toFixed(3)} -> keys ${afterKeys.toFixed(3)} | gaze ${gaze.toFixed(3)}`
      )
      if (afterWheel <= before + 0.02) problems.push('PROBE: wheel does not walk')
      if (afterKeys <= afterWheel + 0.005) problems.push('PROBE: keys do not walk')
      if (gaze < 0.2) problems.push('PROBE: drag does not raise the gaze')
    }
    await page.close()
  }
  await browser.close()
  console.log(`shots written to forge/shots/camp/${ROUND}/`)
  if (problems.length) {
    console.log('\nPROBLEMS:')
    for (const p of [...new Set(problems)]) console.log(' ·', p)
  } else {
    console.log('clean: no console errors, probe alive')
  }
} finally {
  server.kill()
}
