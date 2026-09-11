// where the council's name chips actually land, so their contrast can be
// measured on the frame instead of guessed
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const port = Number(process.argv[2] ?? 5250)
const BASE = `http://localhost:${port}`
const server = spawn('pnpm', ['exec', 'vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
async function wait(url, tries = 90) {
  for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.ok) return } catch {} await new Promise(r => setTimeout(r, 300)) }
  throw new Error('no server')
}
try {
  await wait(BASE)
  const b = await chromium.launch()
  const page = await b.newPage({ viewport: { width: 1512, height: 950 } })
  await page.addInitScript(() => { try { localStorage.setItem('na-gate', '1'); localStorage.setItem('na-first', '1') } catch {} })
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export {}' }))
  await page.goto(BASE)
  await page.waitForFunction(() => Boolean(window.__forge))
  await page.waitForTimeout(1800)
  await page.evaluate(() => { window.__forge.freeze(12.4); window.__forge.jump('council', {}) })
  await page.waitForTimeout(600)
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.council-name')].map((el) => {
    const r = el.getBoundingClientRect()
    return { name: el.textContent, x: r.x, y: r.y, w: r.width, h: r.height, hidden: el.hidden }
  }))
  console.log(JSON.stringify(boxes))
  await page.screenshot({ path: new URL('./shots/chips/desktop-council.png', import.meta.url).pathname })
  await b.close()
} finally { server.kill() }
