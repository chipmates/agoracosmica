// THE TOUCH PROBE — his ground is the one stage with two verbs on a phone:
// ONE finger walks it, TWO fingers are the gaze. Both are load-bearing (the
// night's hour answers the gaze), so both are guarded here.
// Usage: pnpm build && node forge/probe-touch.mjs
import { chromium, devices } from 'playwright'
import { spawn } from 'node:child_process'
const PORT = 5189, BASE = `http://localhost:${PORT}`
const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
async function wait(u, t = 90) { for (let i = 0; i < t; i++) { try { const r = await fetch(u); if (r.ok) return } catch {} await new Promise(r => setTimeout(r, 300)) } throw new Error('no server') }
try {
  await wait(BASE)
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...devices['iPhone 13'], hasTouch: true })
  const p = await ctx.newPage()
  await p.addInitScript(() => { try { localStorage.setItem('na-gate','1'); localStorage.setItem('na-first','1') } catch {} })
  await p.goto(BASE)
  await p.waitForFunction(() => Boolean(window.__forge))
  await p.waitForTimeout(1800)
  await p.evaluate(() => window.__forge.jump('camp', { camp: 'via' }))
  await p.waitForTimeout(500)
  const before = await p.evaluate(() => window.__forge.state())
  // ONE finger, swipe up the frame: it must WALK
  await p.touchscreen.tap(200, 400)
  await p.evaluate(() => {
    const fire = (type, pts) => window.dispatchEvent(new TouchEvent(type, {
      touches: pts.map((q, i) => new Touch({ identifier: i, target: document.body, clientX: q[0], clientY: q[1] })),
      bubbles: true,
    }))
    fire('touchstart', [[200, 600]])
    for (let i = 0; i < 10; i++) fire('touchmove', [[200, 600 - i * 20]])
    fire('touchend', [])
  })
  await p.waitForTimeout(900)
  const walked = await p.evaluate(() => window.__forge.state())
  // TWO fingers, pull the sky down: the gaze must rise
  await p.evaluate(() => {
    const fire = (type, pts) => window.dispatchEvent(new TouchEvent(type, {
      touches: pts.map((q, i) => new Touch({ identifier: i, target: document.body, clientX: q[0], clientY: q[1] })),
      bubbles: true,
    }))
    fire('touchstart', [[150, 620], [250, 620]])
    for (let i = 1; i <= 14; i++) fire('touchmove', [[150, 620 - i * 22], [250, 620 - i * 22]])
    fire('touchend', [])
  })
  await p.waitForTimeout(900)
  const looked = await p.evaluate(() => window.__forge.state())
  console.log(`one finger: walk ${before.campWalk.toFixed(2)} -> ${walked.campWalk.toFixed(2)}`)
  console.log(`two fingers: gaze ${walked.campGaze.toFixed(2)} -> ${looked.campGaze.toFixed(2)}`)
  console.log(walked.campWalk > before.campWalk + 0.03 ? 'WALK OK' : 'WALK FAILED')
  console.log(looked.campGaze > 0.2 ? 'GAZE OK' : 'GAZE FAILED')
  await b.close()
} finally { server.kill() }
