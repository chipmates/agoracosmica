import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

const PORT = 5198
const BASE = `http://localhost:${PORT}`
const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) break
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1512, height: 950 } })
  page.on('pageerror', (e) => console.log('[pageerror]', e.message))
  await page.goto(BASE)
  await page.waitForFunction(() => Boolean(window.__forge))
  await page.waitForTimeout(800)
  await page.evaluate(() => window.__forge.jump('camp', {}))
  for (let s = 0; s < 5; s++) {
    await page.waitForTimeout(2000)
    const st = await page.evaluate(() => ({
      phase: document.body.dataset.phase,
      sittingHidden: document.getElementById('sitting')?.hidden,
      keeperHidden: document.getElementById('keeper')?.hidden,
      gate: localStorage.getItem('na-gate'),
    }))
    console.log(`t+${(s + 1) * 2}s`, JSON.stringify(st))
  }
  await browser.close()
} finally {
  server.kill()
}
