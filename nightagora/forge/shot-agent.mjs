// One element's own eye. Every polish pass runs its own dev server on its
// own port, so several hands can look at their own part of the night at
// the same time without fighting over one build.
//
// Usage:
//   node forge/shot-agent.mjs <port> <outDir> '<states>'
//
// States are JSON, or the shorthand the briefs are written in:
//   '[transit, held, descent, agora, wheel, pane vinci, breath, wing vinci]'
// JSON takes { name, phase, opts, settle, tiers }, the same arguments
// window.__forge.jump() takes plus the tiers this state is worth shooting at.
//
// Environment:
//   FORGE_BACKEND=webgpu|webgl2  what the app must report (default webgpu)
//   FORGE_TIER=hero|standard|calm shoot one tier instead of each state's own
//
// Shots land in forge/shots/<outDir>/<viewport>-<tier>-<name>.png. Every
// console error and page error is reported at the end. Read the frames.

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import {
  assertAdapter,
  assertBackend,
  assertServer,
  GPU_FLAGS,
  parseStates,
  shotName,
  VIEWPORTS,
  waitForServer,
} from './rig.mjs'

const port = Number(process.argv[2] ?? 5300)
const outDir = process.argv[3] ?? 'agent'
const states = parseStates(process.argv[4])
if (!states.length) {
  console.error('no states given')
  process.exit(1)
}

const BASE = `http://localhost:${port}`
const OUT = new URL(`./shots/${outDir}/`, import.meta.url).pathname
const WANT_BACKEND = process.env['FORGE_BACKEND'] ?? 'webgpu'
// long enough that no frame is caught mid-transition: the night's slowest
// letterpress fade is 1.6 s and the Keeper reveals his line word by word
const SETTLE = Number(process.env['FORGE_SETTLE'] ?? 1700)
const ONE_TIER = process.env['FORGE_TIER']
const tiersOf = (s) => (ONE_TIER ? [ONE_TIER] : (s.tiers ?? ['hero']))
const allTiers = [...new Set(states.flatMap(tiersOf))]

/** poll for the marker the app writes back. A page-side predicate is used
    rather than waitForFunction: the poller runs in its own world and never
    sees this attribute change. */
async function landed(page, state, ms = 6000) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (await page.evaluate((s) => document.body.dataset.forge === s, state)) return true
    await page.waitForTimeout(80)
  }
  return false
}

/** the headless GL context can die mid-run on the heavier stages: a lost
    context looks exactly like a bad frame, so the rig proves the state
    took and reloads once if it did not. The app writes back the state it
    was ASKED for (data-forge), which is what a wing needs: its module
    arrives a frame later, and the phase alone cannot tell a pane from
    the wheel it is held open on. */
async function jump(page, state, url, settle) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.evaluate(([p, o]) => {
      window.__forge.freeze(12.4)
      window.__forge.jump(p, o ?? {})
    }, [state.phase, state.opts])
    const took = await landed(page, state.phase)
    await page.waitForTimeout(settle)
    if (took) return true
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
  const said = await assertServer(BASE)
  console.log(`server ${said.head.slice(0, 7)} at ${said.root}`)

  const browser = await chromium.launch({ args: GPU_FLAGS })
  for (const vp of Object.values(VIEWPORTS)) {
    for (const tier of allTiers) {
      const wanted = states.filter((s) => tiersOf(s).includes(tier))
      if (!wanted.length) continue
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
      })
      let firstLine = ''
      page.on('pageerror', (e) => problems.push(`[${vp.tag}/${tier}] pageerror: ${e.message}`))
      page.on('console', (m) => {
        const text = m.text()
        if (text.startsWith('backend=')) firstLine = text
        if (m.type() === 'error') problems.push(`[${vp.tag}/${tier}] console: ${text}`)
      })
      // THE RIG MUST NOT LIE. Vite's HMR client reloads the page whenever any
      // hand saves a file, the forge jump is lost, and the shot lands on the
      // intro card with no error raised. Several seats lost rounds to this.
      await page.route('**/@vite/client', (route) =>
        route.fulfill({ status: 200, contentType: 'application/javascript', body: 'export {}' })
      )
      await page.goto(`${BASE}/?tier=${tier}`)
      await page.waitForFunction(() => Boolean(window.__forge))
      await page.waitForTimeout(1800)

      const stamp = await assertBackend(page, WANT_BACKEND)
      assertAdapter(firstLine, WANT_BACKEND)
      if (stamp.tier !== tier) throw new Error(`asked for tier=${tier}, the app stamped ${stamp.tier}`)
      if (vp.tag === 'desktop' && tier === allTiers[0]) console.log(firstLine)

      for (const s of wanted) {
        const took = await jump(page, s, BASE, s.settle ?? SETTLE)
        if (!took) problems.push(`[${vp.tag}/${tier}] ${s.name}: the stage never took`)
        await page.screenshot({ path: `${OUT}${shotName(vp.tag, tier, s.name)}` })
      }
      await page.close()
    }
  }
  await browser.close()
  console.log(`shots written to forge/shots/${outDir}/`)
  if (problems.length) {
    console.log('PROBLEMS:')
    for (const p of [...new Set(problems)]) console.log(' ·', p)
    process.exitCode = 1
  } else {
    console.log('clean: no console errors')
  }
} catch (err) {
  console.error(`RIG REFUSED: ${err.message}`)
  process.exitCode = 1
} finally {
  server.kill()
}
