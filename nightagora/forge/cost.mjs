// THE COST OF A FRAME — what each stage of the night asks of a GPU, at each
// of the three tiers, in the two numbers that cannot be argued with (draw
// calls and triangles) and the two that must be read with care (the interval
// between presented frames, and what the CPU spent submitting one).
//
// Usage:  pnpm build && node forge/cost.mjs [--strict] [--tier=hero]
//   --strict  exit non-zero when a tier is over its own budget
//   FORGE_PORT   which port to run the preview on (default 5199)
//   FORGE_FPS    also fail on the frame interval (off by default: the rig
//                renders offscreen and headless, where nothing is locked to
//                a display, so the interval is a throughput bound and not
//                the owner's frame rate)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import {
  assertAdapter,
  assertBackend,
  assertServer,
  browserArgs,
  TIERS,
  waitForServer,
} from './rig.mjs'

const PORT = Number(process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://localhost:${PORT}`
const STRICT = process.argv.includes('--strict')
const FPS_STRICT = process.env['FORGE_FPS'] === '1'
const only = process.argv.find((a) => a.startsWith('--tier='))?.split('=')[1]
const tiers = only ? [only] : TIERS

// the stages of the museum's path, in the order a visitor meets them
const STAGES = [
  ['held', 'held', {}],
  ['descent', 'descent', { desc: 0.5 }],
  ['agora', 'agora', {}],
  ['wheel', 'wheel', { chapter: 0 }],
  ['pane', 'pane', { slug: 'vinci' }],
  ['breath', 'breath', {}],
  ['wing', 'wing', { slug: 'vinci' }],
]

const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const failures = []
try {
  await waitForServer(BASE)
  const said = await assertServer(BASE)
  console.log(`server ${said.head.slice(0, 7)} at ${said.root}\n`)

  const browser = await chromium.launch({ args: browserArgs() })
  for (const tier of tiers) {
    const page = await browser.newPage({ viewport: { width: 1512, height: 950 } })
    let line = ''
    page.on('console', (m) => {
      if (m.text().startsWith('backend=')) line = m.text()
    })
    await page.goto(`${BASE}/?tier=${tier}`)
    await page.waitForFunction(() => Boolean(window.__forge))
    await page.waitForTimeout(1800)
    const stamp = await assertBackend(page)
    assertAdapter(line, process.env['FORGE_BACKEND'] ?? 'webgpu')
    if (stamp.tier !== tier) throw new Error(`asked for tier=${tier}, the app stamped ${stamp.tier}`)

    const budget = await page.evaluate(() => window.__forge.cost().budget)
    console.log(
      `${tier.toUpperCase()}  budget ${budget.draws} draws / ` +
        `${(budget.triangles / 1e6).toFixed(1)}M tris / ${budget.fps} fps`
    )
    console.log(
      `${'stage'.padEnd(10)}${'draws'.padStart(7)}${'tris'.padStart(10)}` +
        `${'frame p50'.padStart(11)}${'p95'.padStart(8)}${'cpu p50'.padStart(9)}${'p95'.padStart(8)}`
    )
    for (const [name, phase, opts] of STAGES) {
      await page.evaluate(([p, o]) => window.__forge.jump(p, o), [phase, opts])
      for (let i = 0; i < 60; i++) {
        if (await page.evaluate((p) => document.body.dataset.forge === p, phase)) break
        await page.waitForTimeout(80)
      }
      // the meter's window is 120 frames: give it the whole window, and give
      // the first frames of a new stage time to compile out of the reading
      await page.waitForTimeout(600)
      await page.evaluate(() => window.__forge.tier(document.body.dataset.tier))
      await page.waitForTimeout(2400)
      const c = await page.evaluate(() => window.__forge.cost())
      console.log(
        `${name.padEnd(10)}${String(c.draws).padStart(7)}${String(c.triangles).padStart(10)}` +
          `${c.frameMsP50.toFixed(1).padStart(11)}${c.frameMsP95.toFixed(1).padStart(8)}` +
          `${c.cpuMsP50.toFixed(1).padStart(9)}${c.cpuMsP95.toFixed(1).padStart(8)}`
      )
      if (c.draws > budget.draws) failures.push(`${tier}/${name}: ${c.draws} draws over ${budget.draws}`)
      if (c.triangles > budget.triangles)
        failures.push(`${tier}/${name}: ${c.triangles} triangles over ${budget.triangles}`)
      if (c.textureMB > budget.textureMB)
        failures.push(`${tier}/${name}: ${c.textureMB} MB of texture over ${budget.textureMB}`)
      if (FPS_STRICT && c.frameMsP95 > 1000 / budget.fps)
        failures.push(`${tier}/${name}: p95 ${c.frameMsP95} ms over ${(1000 / budget.fps).toFixed(1)}`)
    }
    console.log('')
    await page.close()
  }
  await browser.close()

  if (failures.length) {
    console.log('OVER BUDGET:')
    for (const f of failures) console.log(' ·', f)
    if (STRICT) process.exitCode = 1
  } else {
    console.log('every tier inside its budget')
  }
} catch (err) {
  console.error(`RIG REFUSED: ${err.message}`)
  process.exitCode = 1
} finally {
  server.kill()
}
