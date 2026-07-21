// The forge's eyes: deterministic screenshots of every scene state.
// Usage: pnpm build && node forge/shot.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 5199
const BASE = `http://localhost:${PORT}`
const OUT = new URL('./shots/', import.meta.url).pathname

const STATES = [
  { name: 'transit', jump: ['transit', { transit: 0.6 }] },
  { name: 'flash', jump: ['held', { sinceFlash: 0.18 }] },
  { name: 'held', jump: ['held', {}] },
  { name: 'door', jump: ['door', { door: 0.55 }] },
  { name: 'sky', jump: ['sky', {}] },
]
const VIEWPORTS = [
  { tag: 'desktop', width: 1512, height: 950, deviceScaleFactor: 1 },
  { tag: 'desktop-webgpu', width: 1512, height: 950, deviceScaleFactor: 1, query: '?webgpu' },
  { tag: 'mobile', width: 390, height: 844, deviceScaleFactor: 2 },
]

function startPreview() {
  const child = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: false,
  })
  return child
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
try {
  await waitForServer(BASE)
  const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu'] })
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
    })
    page.on('pageerror', (err) => console.error(`[pageerror] ${err.message}`))
    page.on('console', (msg) => {
      const text = msg.text()
      if (msg.type() === 'error' || msg.type() === 'warning' || text.includes('[na]'))
        console.log(`[console.${msg.type()}] ${text}`)
    })
    await page.goto(BASE + (vp.query ?? ''))
    await page.waitForFunction(() => Boolean(window.__forge))
    await page.waitForTimeout(1200) // let pipelines compile
    for (const s of STATES) {
      await page.evaluate(([phase, opts]) => {
        window.__forge.freeze(12.4)
        window.__forge.jump(phase, opts)
      }, s.jump)
      await page.waitForTimeout(450)
      await page.screenshot({ path: `${OUT}${s.name}-${vp.tag}.png` })
    }
    await page.close()
  }
  await browser.close()
  console.log(`shots written to forge/shots/`)
} finally {
  server.kill()
}
