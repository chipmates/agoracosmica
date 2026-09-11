// WHAT THE OBJECT BENCH COSTS, per tier, read off the standing bench.
//
//   node forge/blender/probe-object.mjs <port> <object> [state]
//
// The rig's shots say what a frame looks like. This says what it costs: draw
// calls, triangles, the texture the body holds and the texture in the whole
// frame, at each of the three tiers, straight out of the bench's own
// telemetry. A tier is switched by going round the address again, because a
// body allocated for one tier cannot be re-dressed live.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { browserArgs, TIERS, VIEWPORTS, waitForServer } from '../rig.mjs'

const port = Number(process.argv[2] ?? 5199)
const object = process.argv[3] ?? 'dovecote'
const state = process.argv[4] ?? 'approach'
const BASE = `http://localhost:${port}`

const server = spawn('pnpm', ['exec', 'vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
const rows = []
try {
  await waitForServer(BASE)
  const browser = await chromium.launch({ args: browserArgs() })
  for (const vp of Object.values(VIEWPORTS)) {
    for (const tier of TIERS) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
      })
      await page.route('**/@vite/client', (r) =>
        r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export {}' })
      )
      await page.goto(`${BASE}/bench/vinci/object/${object}?tier=${tier}`)
      await page.waitForFunction(() => Boolean(window.__forge))
      await page.evaluate((s) => window.__forge.station(s), state)
      await page.waitForFunction(() => document.body.dataset.forge === 'bench', null, { timeout: 30000 })
      await page.waitForTimeout(4000)
      const said = await page.evaluate(() => window.__forge.bench())
      rows.push({ viewport: vp.tag, tier, ...said })
      await page.close()
    }
  }
  await browser.close()
} finally {
  server.kill()
}
const budget = { hero: 512, standard: 256, calm: 96 }
console.log('viewport  tier      draws  triangles   body MB   frame MB   budget   frame ms p50/p95')
for (const row of rows) {
  const cost = row.cost
  console.log(
    `${row.viewport.padEnd(9)} ${row.tier.padEnd(9)} ${String(cost.draws).padStart(4)} ` +
      `${cost.triangles.toLocaleString('en').padStart(10)} ${row.body.textureMB.toFixed(1).padStart(8)} ` +
      `${cost.textureMB.toFixed(1).padStart(9)} ${String(budget[row.tier]).padStart(7)} ` +
      `${String(cost.frameMsP50).padStart(9)} / ${cost.frameMsP95}`
  )
}
console.log(JSON.stringify(rows, null, 2).slice(0, 0))
const over = rows.filter((r) => r.cost.textureMB > budget[r.tier])
console.log(over.length ? `OVER BUDGET: ${over.map((r) => `${r.viewport}/${r.tier}`).join(', ')}` : 'every tier inside its texture budget')
process.exitCode = over.length ? 1 : 0
