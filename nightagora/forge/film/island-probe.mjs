// THE ISLAND AGAINST THE LINE, on Playwright's device profiles: the close
// look of the aerial screw opened by a hand, and the island's own reading kept
// (its first frame after the press, its frames a second over the counted
// window, the slowest frame, the verdict). No screenshot is taken while it
// counts. CPU throttling is Chromium's proxy for a slower phone; the GPU is
// this machine's own, so these numbers are a proxy and never a phone's: the
// owner's iPhone and a cheap Android decide.
//
//   node forge/film/island-probe.mjs --base=https://127.0.0.1:5551 --release=w6 --out=<file.json>
//     [--island=live]   force the island (the count runs, a miss is recorded and not handed over)
//     [--runs=<name>,…] a subset of the profiles below
//
// Without --island the device decides, and the run records what it chose,
// whether a miss handed over to the filmed cycle, and what the device kept.
import { chromium, webkit, devices } from 'playwright'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { browserArgs } from '../rig.mjs'

const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const at = a.indexOf('=')
  return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
}))
const BASE = String(flags.get('base') ?? 'https://127.0.0.1:5551')
const RELEASE = String(flags.get('release') ?? 'w6')
const OUT = resolve(String(flags.get('out') ?? 'island-probe.json'))
const ISLAND = flags.has('island') ? String(flags.get('island')) : null

const PROFILES = [
  { name: 'desktop-1512', engine: 'chromium', context: { viewport: { width: 1512, height: 950 } }, cpu: 1 },
  { name: 'desktop-1512-cpu20', engine: 'chromium', context: { viewport: { width: 1512, height: 950 } }, cpu: 20 },
  { name: 'pixel7', engine: 'chromium', context: devices['Pixel 7'], cpu: 1 },
  { name: 'pixel7-cpu4', engine: 'chromium', context: devices['Pixel 7'], cpu: 4 },
  { name: 'pixel7-cpu6', engine: 'chromium', context: devices['Pixel 7'], cpu: 6 },
  { name: 'galaxy-a55-cpu8', engine: 'chromium', context: devices['Galaxy A55'] ?? devices['Galaxy S9+'], cpu: 8 },
  { name: 'iphone13', engine: 'webkit', context: devices['iPhone 13'], cpu: 1 },
  { name: 'iphone15', engine: 'webkit', context: devices['iPhone 15'] ?? devices['iPhone 14'], cpu: 1 },
]
const RUNS = flags.has('runs') ? String(flags.get('runs')).split(',') : PROFILES.map((p) => p.name)

async function probe(profile) {
  const type = profile.engine === 'webkit' ? webkit : chromium
  const browser = await type.launch(profile.engine === 'chromium' ? { args: browserArgs() } : {})
  const ctx = await browser.newContext({ ...profile.context, ignoreHTTPSErrors: true, locale: 'en-GB' })
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vinci-welcome', '1'); localStorage.setItem('agc_probe', '1') } catch { /* seen */ } })
  const page = await ctx.newPage()
  if (profile.cpu > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: profile.cpu })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
  const out = { profile: profile.name, engine: profile.engine, cpu: profile.cpu, viewport: profile.context.viewport, errors }
  try {
    await page.goto(`${BASE}/w/vinci?film=${RELEASE}&order=life&probe=1&lang=en${ISLAND ? `&island=${ISLAND}` : ''}#s=flight`, { waitUntil: 'load', timeout: 180000 })
    await page.waitForFunction(() => document.querySelector('.na-film')?.dataset.state === 'rest', null, { timeout: 180000, polling: 250 })
    await page.waitForTimeout(1500)
    out.backend = await page.evaluate(() => document.body.dataset.backend ?? null)
    const mark = await page.$('.film-dot[data-exhibit="machine/aerial-screw"]')
    if (!mark) throw new Error('no aerial screw mark')
    await mark.evaluate((e) => e.click())
    const t0 = Date.now()
    await page.waitForFunction(() => { const r = window.__naLook?.readout?.(); return r && r.mode && (r.mode === 'filmed' ? r.standing : r.verdict !== 'counting') }, null, { timeout: 120000, polling: 250 })
    out.wallSeconds = (Date.now() - t0) / 1000
    await page.waitForTimeout(ISLAND ? 0 : 1500)
    out.reading = await page.evaluate(() => window.__naLook.readout())
    out.kept = await page.evaluate(() => { try { return localStorage.getItem('na-island') } catch { return 'closed' } })
  } catch (err) {
    out.failed = String(err.message ?? err).slice(0, 240)
  } finally {
    await ctx.close()
    await browser.close()
  }
  return out
}

const report = { base: BASE, release: RELEASE, island: ISLAND, line: { openMs: 2000, fps: 30 }, runs: [] }
for (const profile of PROFILES.filter((p) => RUNS.includes(p.name))) {
  const r = await probe(profile)
  report.runs.push(r)
  const g = r.reading ?? {}
  console.log(`${r.profile} (${r.engine}, cpu ×${r.cpu}): ${r.failed ? `FAILED ${r.failed}` : `mode ${g.mode} (${g.why}), open ${g.openMs ?? '-'} ms, ${g.fps ?? '-'} fps, worst ${g.worstMs ?? '-'} ms, ${g.verdict ?? '-'}${g.handedOver ? ', handed over' : ''}, kept ${r.kept}`}`)
  writeFileSync(OUT, `${JSON.stringify(report, null, 1)}\n`)
}
