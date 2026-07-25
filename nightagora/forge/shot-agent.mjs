// One element's own eye. Every polish pass runs its own dev server on its
// own port, so several hands can look at their own part of the night at
// the same time without fighting over one build.
//
// Usage:
//   node forge/shot-agent.mjs <port> <outDir> '<statesJson>'
//
// statesJson is an array of { name, phase, opts } — the same arguments
// window.__forge.jump() takes, e.g.
//   '[{"name":"agora","phase":"agora","opts":{}},
//     {"name":"keeper","phase":"agora","opts":{"keeper":2}}]'
//
// Shots land in forge/shots/<outDir>/<viewport>-<name>.png, and every
// console error and page error is reported at the end. Read the frames.

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const port = Number(process.argv[2] ?? 5300)
const outDir = process.argv[3] ?? 'agent'
const states = JSON.parse(process.argv[4] ?? '[]')
if (!states.length) {
  console.error('no states given')
  process.exit(1)
}

const BASE = `http://localhost:${port}`
const OUT = new URL(`./shots/${outDir}/`, import.meta.url).pathname
const VIEWPORTS = [
  { tag: 'desktop', width: 1512, height: 950, deviceScaleFactor: 1 },
  { tag: 'mobile', width: 390, height: 844, deviceScaleFactor: 2 },
]

async function waitForServer(url, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('dev server never came up')
}

/** the headless GL context can die mid-run on the heavier stages: a lost
    context looks exactly like a bad frame, so the rig proves the state
    took and reloads once if it did not */
async function jump(page, phase, opts, settle) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.evaluate(([p, o]) => {
      window.__forge.freeze(12.4)
      window.__forge.jump(p, o ?? {})
    }, [phase, opts])
    await page.waitForTimeout(settle)
    const ok = await page.evaluate((p) => document.body.dataset.phase === p, phase)
    if (ok) return true
    await page.reload()
    await page.waitForFunction(() => Boolean(window.__forge))
    await page.waitForTimeout(1500)
  }
  return false
}

mkdirSync(OUT, { recursive: true })
const server = spawn('pnpm', ['exec', 'vite', '--port', String(port), '--strictPort'], {
  stdio: 'ignore',
})
const problems = []
try {
  await waitForServer(BASE)
  const browser = await chromium.launch()
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
    })
    page.on('pageerror', (e) => problems.push(`[${vp.tag}] pageerror: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`[${vp.tag}] console: ${m.text()}`)
    })
    // a returning visitor: the Sitting is already taken, so a frame is
    // never shot through the contract card
    await page.addInitScript(() => {
      try {
        localStorage.setItem('na-gate', '1')
        localStorage.setItem('na-first', '1')
      } catch {
        /* private mode */
      }
    })
    // THE RIG MUST NOT LIE. Vite's HMR client reloads the page whenever any
    // hand saves a file, the forge jump is lost, and the shot lands on the
    // intro card with no error raised. Several seats lost rounds to this.
    await page.route('**/@vite/client', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: 'export {}' })
    )
    await page.goto(BASE)
    await page.waitForFunction(() => Boolean(window.__forge))
    await page.waitForTimeout(1800)
    for (const s of states) {
      const took = await jump(page, s.phase, s.opts, s.settle ?? 450)
      if (!took) problems.push(`[${vp.tag}] ${s.name}: the stage never took (context lost twice)`)
      await page.screenshot({ path: `${OUT}${vp.tag}-${s.name}.png` })
    }
    await page.close()
  }
  await browser.close()
  console.log(`shots written to forge/shots/${outDir}/`)
  if (problems.length) {
    console.log('PROBLEMS:')
    for (const p of [...new Set(problems)]) console.log(' ·', p)
  } else {
    console.log('clean: no console errors')
  }
} finally {
  server.kill()
}
