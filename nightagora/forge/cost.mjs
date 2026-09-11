// THE COST OF A FRAME — what each stage of the night actually asks of a
// GPU, in draw calls and triangles. The rig's fps numbers are software-
// rasterizer artifacts and cannot be trusted; these two numbers can.
// Usage: pnpm build && FORGE_PORT=5199 node forge/cost.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const PORT = Number(process.env['FORGE_PORT'] ?? 5194)
const BASE = `http://localhost:${PORT}`
const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
async function wait(url, tries = 90) {
  for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.ok) return } catch {} await new Promise(r => setTimeout(r, 300)) }
  throw new Error('no server')
}
try {
  await wait(BASE)
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1512, height: 950 } })
  await p.goto(BASE)
  await p.waitForFunction(() => Boolean(window.__forge))
  await p.waitForTimeout(1600)
  for (const [name, phase, opts] of [
    ['held', 'held', {}], ['descent', 'descent', { desc: 0.5 }], ['agora', 'agora', {}],
    ['wheel', 'wheel', { chapter: 0 }], ['pane', 'pane', { slug: 'vinci' }],
    ['breath', 'breath', {}], ['wing', 'wing', { slug: 'vinci' }],
  ]) {
    await p.evaluate(([ph, o]) => window.__forge.jump(ph, o), [phase, opts])
    for (let i = 0; i < 60; i++) {
      if (await p.evaluate((ph) => document.body.dataset.forge === ph, phase)) break
      await p.waitForTimeout(80)
    }
    await p.waitForTimeout(400)
    const s = await p.evaluate(() => window.__forge.state())
    console.log(`${name.padEnd(12)} draws=${String(s.draws).padStart(5)}  tris=${String(s.tris).padStart(8)}`)
  }
  await b.close()
} finally { server.kill() }
