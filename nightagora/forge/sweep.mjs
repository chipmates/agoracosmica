// The forge's third eye: a dense scrub of one journey leg, assembled
// into a single contact sheet, so the in-between frames a live scroller
// meets are all READ, not just the posed stations.
// Usage: pnpm build && node forge/sweep.mjs [phase] [from] [to] [step]
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = Number(process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://localhost:${PORT}`
const OUT = new URL('./shots/', import.meta.url).pathname

const PHASE = process.argv[2] ?? 'descent'
const FROM = Number(process.argv[3] ?? 0.02)
const TO = Number(process.argv[4] ?? 0.98)
const STEP = Number(process.argv[5] ?? 0.04)

function startPreview() {
  return spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: false,
  })
}

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('preview server never came up')
}

mkdirSync(OUT, { recursive: true })
const server = startPreview()
try {
  await waitForServer(BASE)
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1210, height: 756 } })
  page.on('pageerror', (err) => console.error(`[pageerror] ${err.message}`))
  await page.goto(BASE)
  await page.waitForFunction(() => Boolean(window.__forge))
  await page.waitForTimeout(1200)

  const frames = []
  for (let d = FROM; d <= TO + 1e-9; d += STEP) {
    const desc = Math.round(d * 1000) / 1000
    await page.evaluate(
      ([phase, value]) => {
        window.__forge.freeze(12.4)
        window.__forge.jump(phase, { desc: value })
      },
      [PHASE, desc]
    )
    await page.waitForTimeout(320)
    const buf = await page.screenshot({ type: 'jpeg', quality: 70 })
    frames.push({ desc, data: buf.toString('base64') })
    console.log(`[sweep] ${PHASE} ${desc}`)
  }

  // assemble the contact sheet in a fresh page
  const cols = 5
  const w = 605
  const h = 378
  const rows = Math.ceil(frames.length / cols)
  const sheet = await browser.newPage({
    viewport: { width: cols * w, height: rows * (h + 22) },
  })
  await sheet.setContent(`<body style="margin:0;background:#111;font:11px monospace;color:#ddd">
    ${frames
      .map(
        (f) => `<div style="float:left;width:${w}px">
          <img src="data:image/jpeg;base64,${f.data}" style="width:${w}px;height:${h}px;display:block" />
          <div style="height:22px;line-height:22px;padding-left:6px">desc ${f.desc}</div>
        </div>`
      )
      .join('')}
  </body>`)
  await sheet.waitForTimeout(600)
  await sheet.screenshot({ path: `${OUT}sweep-${PHASE}.png`, fullPage: true })
  await browser.close()
  console.log(`contact sheet written to forge/shots/sweep-${PHASE}.png`)
} finally {
  server.kill()
}
