// THE DOOR'S TWO TIMES on a phone profile: the first painted picture of the
// house and the door standing over it, from the navigation's start. A built
// app is measured, because a dev server's module waterfall is not what a
// visitor pays.
//
//   node forge/film/door-time.mjs --base=https://127.0.0.1:5577 --query='film=base-en&opening=a'
//     [--runs=3] [--cpu=4] [--out=<file.json>] [--lang=en] [--width=390] [--height=844]
//
// Network: the "Slow 4G" preset of the Chromium tools (562.5 ms latency,
// 1.47 Mbit/s down, 675 kbit/s up), the cache empty for every run. A picture
// counts as painted only once nothing lit stands over it: the gold field is
// read beside every paint entry.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { browserArgs } from '../rig.mjs'

const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const at = a.indexOf('=')
  return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
}))
const BASE = String(flags.get('base') ?? `https://127.0.0.1:${process.env['FORGE_PORT'] ?? 5199}`)
const QUERY = String(flags.get('query') ?? 'film=w5')
const RUNS = Number(flags.get('runs') ?? 3)
const CPU = Number(flags.get('cpu') ?? 4)
const LANG = String(flags.get('lang') ?? 'en')
const WIDTH = Number(flags.get('width') ?? 390)
const HEIGHT = Number(flags.get('height') ?? 844)
const NET = { offline: false, latency: 562.5, downloadThroughput: (1.47456 * 1024 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 }

/* In the page before its first script: every paint, the gold field's light,
   the door's open, each stamped on the page's own clock. */
function watch() {
  const seen = { lcp: [], paints: [], gold: [], door: null, doorPainted: null, picture: null }
  window.__doorTime = seen
  const name = (el) => (el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.classList?.length ? `.${[...el.classList].join('.')}` : ''}` : '')
  const goldLit = () => document.getElementById('goldbreath')?.classList.contains('lit') ?? false
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) seen.lcp.push({ t: Math.round(e.renderTime || e.loadTime || e.startTime), el: name(e.element), gold: goldLit() })
  }).observe({ type: 'largest-contentful-paint', buffered: true })
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) seen.paints.push({ t: Math.round(e.renderTime || e.loadTime || e.startTime), el: name(e.element), id: e.identifier, gold: goldLit() })
  }).observe({ type: 'element', buffered: true })
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) seen.paints.push({ t: Math.round(e.startTime), el: e.name })
  }).observe({ type: 'paint', buffered: true })
  const pictureShown = () => {
    const imgs = [...document.querySelectorAll('#na-first, .na-film-still')]
    return imgs.some((img) => img.complete && img.naturalWidth > 0 && getComputedStyle(img).visibility !== 'hidden' && img.getBoundingClientRect().height > 0)
  }
  // a frame is sampled every animation frame: the picture counts once it is decoded, visible and not under the gold
  const tick = () => {
    const now = Math.round(performance.now())
    if (seen.picture === null && pictureShown() && !goldLit()) seen.picture = now
    const door = document.querySelector('dialog.na-plate[open]')
    if (door && seen.door === null) seen.door = now
    if (door && seen.door !== null && seen.doorPainted === null && now > seen.door) seen.doorPainted = now
    if (seen.gold.length === 0 || seen.gold[seen.gold.length - 1].lit !== goldLit()) seen.gold.push({ t: now, lit: goldLit() })
    if (seen.doorPainted === null || seen.picture === null) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

const report = { base: BASE, query: QUERY, cpu: CPU, network: 'Slow 4G (562.5 ms, 1.47 Mbit/s down)', viewport: [WIDTH, HEIGHT], runs: [] }
const browser = await chromium.launch({ args: browserArgs() })
for (let run = 0; run < RUNS; run++) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true })
  await ctx.addInitScript(watch)
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', NET)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
  const url = `${BASE}/w/vinci?probe=1&lang=${LANG}&${QUERY}`
  await page.goto(url, { waitUntil: 'commit', timeout: 120000 })
  await page.waitForFunction(() => {
    const s = window.__doorTime
    return s && s.picture !== null && (s.doorPainted !== null || performance.now() > s.picture + 4000)
  }, null, { timeout: 90000, polling: 250 }).catch(() => errors.push('timed out'))
  // the door is optional: a page without one is read once its picture stands
  await page.waitForTimeout(1500)
  const seen = await page.evaluate(() => window.__doorTime)
  const fcp = seen.paints.find((p) => p.el === 'first-contentful-paint')?.t ?? null
  report.runs.push({ run, url, firstContentfulPaint: fcp, firstPicture: seen.picture, door: seen.doorPainted, gold: seen.gold, lcp: seen.lcp, elementPaints: seen.paints.filter((p) => p.id), errors })
  console.log(`run ${run}: first paint ${fcp} ms, first picture ${seen.picture} ms, door ${seen.doorPainted ?? 'none'} ms`)
  await ctx.close()
}
await browser.close()
const median = (xs) => { const s = xs.filter((x) => x !== null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null }
report.median = { firstPicture: median(report.runs.map((r) => r.firstPicture)), door: median(report.runs.map((r) => r.door)), firstContentfulPaint: median(report.runs.map((r) => r.firstContentfulPaint)) }
console.log(JSON.stringify(report.median))
if (flags.get('out')) writeFileSync(String(flags.get('out')), JSON.stringify(report, null, 1))
