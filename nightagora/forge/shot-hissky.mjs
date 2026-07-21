// Rig eye for the His Sky concept page: three life-stages, two stages.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = Number(process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://localhost:${PORT}/hissky.html`
const OUT = new URL('./shots/', import.meta.url).pathname

const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
})
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) break
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  for (const vp of [
    { tag: 'desktop', width: 1512, height: 950 },
    { tag: 'mobile', width: 390, height: 844, deviceScaleFactor: 2 },
  ]) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor ?? 1,
    })
    page.on('pageerror', (e) => console.log('[pageerror]', e.message))
    await page.goto(BASE)
    await page.waitForFunction(() => Boolean(window.__hisSky))
    await page.waitForTimeout(1500)
    for (const [name, t] of [
      ['first-night', 0.06],
      ['growing', 0.5],
      ['wreath-complete', 1],
    ]) {
      await page.evaluate((v) => window.__hisSky.set(v), t)
      await page.waitForTimeout(2600)
      await page.screenshot({ path: `${OUT}hissky-${name}-${vp.tag}.png` })
      console.log(`[hissky] ${name} ${vp.tag}`)
    }
    await page.close()
  }
  await browser.close()
} finally {
  server.kill()
}
