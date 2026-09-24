// THE MACHINE'S CLOSE LOOK, SHOT: the film wing opened at the hall, the
// aerial screw's mark pressed the way a hand presses it, and the close look
// kept at every state a visitor meets there: the whole, each step pressed, each
// view, the drawer. `--island=live` asks for the live island, `--island=filmed`
// for the filmed cycle; without it the device decides, as a visitor's would.
//
//   node forge/film/machine-look.mjs --base=https://127.0.0.1:5551 --release=w6 --out=<dir>
//     [--engines=chromium,webkit,firefox] [--widths=390,1512] [--langs=de,en] [--island=live|filmed]
//     [--cpu=4]   Chromium's CPU throttling, the phone's proxy
//
// It shoots a running server and starts none.
import { chromium, firefox, webkit } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { browserArgs } from '../rig.mjs'

const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const at = a.indexOf('=')
  return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
}))
const BASE = String(flags.get('base') ?? 'https://127.0.0.1:5551')
const RELEASE = String(flags.get('release') ?? 'w6')
const OUT = resolve(String(flags.get('out') ?? 'machine-look'))
const ENGINES = String(flags.get('engines') ?? 'chromium').split(',')
const WIDTHS = String(flags.get('widths') ?? '390,1512').split(',').map(Number)
const LANGS = String(flags.get('langs') ?? 'de').split(',')
const ISLAND = flags.has('island') ? String(flags.get('island')) : null
const CPU = Number(flags.get('cpu') ?? 1)
const STEPS = flags.has('steps') ? String(flags.get('steps')).split(',') : ['whole', 'steps', 'views', 'drawer']
const HEIGHT = { 360: 800, 390: 844, 430: 932, 1440: 900, 1512: 950, 1280: 800, 1920: 1080 }
const TYPES = { chromium, webkit, firefox }
mkdirSync(OUT, { recursive: true })

/** what the close look says of itself, and where its parts stand */
function lookNow() {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return cs.display === 'none' || cs.visibility === 'hidden' ? null : { top: Math.round(b.top), left: Math.round(b.left), width: Math.round(b.width), height: Math.round(b.height) } }
  const said = window.__naLook?.readout?.() ?? null
  return {
    look: said,
    caption: document.querySelector('.vitrine-caption')?.textContent ?? '',
    current: [...document.querySelectorAll('.vitrine-step-item')].findIndex((b) => b.getAttribute('aria-current') === 'step'),
    stepsShown: [...document.querySelectorAll('.vitrine-steps')].some((l) => getComputedStyle(l).display !== 'none'),
    view: r('.vitrine-view'), card: r('.vitrine-card'), folio: r('.vitrine-folio'), band: r('.desk-clb'),
  }
}

async function run(engine, width, lang) {
  const height = HEIGHT[width] ?? Math.round(width * 1.8)
  const phone = width < 700
  const dir = join(OUT, engine, `${width}-${lang}${ISLAND ? `-${ISLAND}` : ''}`)
  mkdirSync(dir, { recursive: true })
  const browser = await TYPES[engine].launch(engine === 'chromium' ? { args: browserArgs() } : {})
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, ignoreHTTPSErrors: true,
    locale: lang === 'de' ? 'de-DE' : 'en-GB', ...(phone && engine !== 'firefox' ? { isMobile: true, hasTouch: true } : {}) })
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vinci-welcome', '1'); localStorage.setItem('agc_probe', '1') } catch { /* seen */ } })
  const page = await ctx.newPage()
  if (CPU > 1 && engine === 'chromium') {
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  }
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`) })
  const record = { engine, width, lang, island: ISLAND, cpu: CPU, errors, shots: [] }
  const shot = async (name) => {
    await page.screenshot({ path: join(dir, `${name}.png`), timeout: 30000 }).catch(() => null)
    record.shots.push({ name, ...(await page.evaluate(lookNow).catch((e) => ({ error: String(e) }))) })
  }
  const t0 = Date.now()
  try {
    const q = `film=${RELEASE}&order=life&probe=1&lang=${lang}${ISLAND ? `&island=${ISLAND}` : ''}`
    await page.goto(`${BASE}/w/vinci?${q}#s=flight`, { waitUntil: 'load', timeout: 120000 })
    await page.waitForFunction(() => { const s = document.querySelector('.na-film-still'); return s && s.complete && s.naturalWidth > 0 && document.querySelector('.na-film')?.dataset.state === 'rest' }, null, { timeout: 120000, polling: 100 })
    await page.waitForTimeout(1200)
    const mark = await page.$('.film-dot[data-exhibit="machine/aerial-screw"]')
    if (!mark) { record.failed = 'no aerial screw mark at flight'; return record }
    await mark.click({ timeout: 8000 }).catch(() => mark.evaluate((e) => e.click()))
    const pressed = Date.now()
    // the close look stands once its payload says so: the island drawn, or the cycle's first frame shown
    const stood = await page.waitForFunction(() => window.__naLook?.readout?.()?.standing === true, null, { timeout: 90000, polling: 50 }).then(() => true).catch(() => false)
    record.pressToStanding = (Date.now() - pressed) / 1000
    if (!stood) { record.failed = 'the close look never stood'; await shot('00-never'); return record }
    await page.waitForTimeout(3000)
    if (STEPS.includes('whole')) await shot('01-whole')
    if (STEPS.includes('steps')) {
      const count = await page.evaluate(() => document.querySelectorAll('.vitrine-step-item').length)
      for (let i = 0; i < count; i++) {
        await page.evaluate((k) => document.querySelectorAll('.vitrine-step-item')[k]?.click(), i)
        await page.waitForFunction((k) => window.__naLook?.readout?.()?.landed === k, i, { timeout: 8000, polling: 50 }).catch(() => null)
        await page.waitForTimeout(900)
        await shot(`02-step${i + 1}`)
      }
    }
    if (STEPS.includes('views')) {
      const views = await page.evaluate(() => [...document.querySelectorAll('.vitrine-viewpoint')].filter((b) => !b.disabled).length)
      for (let i = 1; i < views; i++) {
        await page.evaluate((k) => [...document.querySelectorAll('.vitrine-viewpoint')].filter((b) => !b.disabled)[k]?.click(), i)
        await page.waitForTimeout(1600)
        await shot(`03-view${i}`)
      }
      if (views > 1) await page.evaluate(() => document.querySelector('.vitrine-viewpoint')?.click())
    }
    if (STEPS.includes('drawer')) {
      const more = await page.$('.vitrine-card .vitrine-more')
      if (more && await more.isVisible()) {
        await more.click().catch(() => null)
        await page.waitForTimeout(700)
        await shot('04-drawer')
        await more.click().catch(() => null)
      }
    }
    record.readout = await page.evaluate(() => window.__naLook?.readout?.() ?? null)
  } catch (err) {
    record.failed = String(err.message ?? err).slice(0, 300)
  } finally {
    record.seconds = (Date.now() - t0) / 1000
    await ctx.close()
    await browser.close()
  }
  return record
}

const report = { base: BASE, release: RELEASE, island: ISLAND, cpu: CPU, runs: [] }
for (const engine of ENGINES) for (const width of WIDTHS) for (const lang of LANGS) {
  const r = await run(engine, width, lang)
  report.runs.push(r)
  console.log(`${engine} ${width} ${lang}${ISLAND ? ` ${ISLAND}` : ''}: ${r.failed ? `FAILED ${r.failed}` : `standing after ${r.pressToStanding} s, ${r.shots.length} shots`} · mode ${r.readout?.mode ?? '?'} · errors ${r.errors.length}${r.errors.length ? ` (${r.errors[0]})` : ''}`)
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1))
}
