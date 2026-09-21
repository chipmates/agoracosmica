#!/usr/bin/env node
// THE FREE AREA AS A MACHINE (the frozen desktop design, step 6).
//
//   node forge/free-area.mjs <port> [--lang=en,de] [--widths=1280x800,1440x900]
//                                   [--order=life] [--strict] [--json]
//
// THE CONTRACT. The words never move to clear a subject: the words are a
// fixed box on one margin, and the station's frame is composed so what the
// visitor is meant to look at stands outside that box. This program measures
// both boxes in a real page, at every station, in both languages and at three
// widths, and names every station and pose where the subject falls inside
// one. It moves nothing: the list it prints is the rail seat's to re-aim.
//
// WHAT COUNTS AS THE SUBJECT. The story layer says what a station shows in
// prose (`sees`), which no machine can resolve, so the subject is read from
// what the wing itself anchors to the scene: the marks and labels that stand
// on the works, the dates and the machines at that station. A mark inside the
// words' box IS the subject under the words, and it is also the rule the
// design's own step 5 writes for marks. Stations whose subject carries no
// mark are reported as unmeasured rather than as passing.
//
// THE THREE REMEDIES, in the design's own order: the narrow measure (560),
// then the rail seat's re-aim, then the text seat's other subject. This
// program takes the first one itself: it re-measures every failing station
// with the narrow measure and says which ones it clears.
import { chromium } from 'playwright'
import { browserArgs, wingStanding } from './rig.mjs'

const argv = process.argv.slice(2)
const flags = argv.filter(a => a.startsWith('--'))
const words = argv.filter(a => !a.startsWith('--'))
const flag = (name, fallback) => {
  const hit = flags.find(f => f === `--${name}` || f.startsWith(`--${name}=`))
  if (hit === undefined) return fallback
  const value = hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : ''
  return value === '' ? true : value
}
const port = Number(words[0] ?? process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://localhost:${port}`
const LANGS = String(flag('lang', 'en,de')).split(',')
const WIDTHS = String(flag('widths', '1280x800,1440x900,1920x1080')).split(',')
  .map(s => s.split('x').map(Number))
const ORDER = flag('order', '')
const STRICT = flags.includes('--strict')
const JSON_OUT = flags.includes('--json')
const say = line => { if (!JSON_OUT) console.log(line) }

/** the boxes of the chrome and of everything the wing anchors to the scene */
function readStage() {
  const box = el => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  }
  const seen = el => {
    const r = el.getBoundingClientRect()
    if (r.width < 6 || r.height < 6) return false
    const cs = getComputedStyle(el)
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05
  }
  const marks = []
  const layer = document.querySelector('#wing .wing-labels')
  for (const el of layer ? layer.querySelectorAll('*') : []) {
    // an anchored mark is placed by the wing itself, never laid out in flow
    if (getComputedStyle(el).position === 'static') continue
    if (!seen(el)) continue
    if (el.closest('.vinci-dock, .wing-plan, .wing-life, .vitrine, dialog')) continue
    marks.push({ ...box(el), name: `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').split(' ')[0]}`,
      label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 48) })
  }
  const cap = document.querySelector('.desk-cap')
  const drawer = document.querySelector('.desk-drawer')
  return {
    stage: { w: innerWidth, h: innerHeight },
    words: cap && cap.getBoundingClientRect().height > 1 ? box(cap) : null,
    drawer: drawer && drawer.getBoundingClientRect().height > 1 ? box(drawer) : null,
    measure: document.querySelector('#wing')?.dataset['measure'] ?? '',
    marks,
  }
}

const over = (a, b) => {
  if (!a || !b) return 0
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? Math.round(w * h) : 0
}

const browser = await chromium.launch({ args: browserArgs() })
const report = { base: BASE, order: ORDER || 'today', widths: WIDTHS, langs: LANGS, stations: [] }
const failures = []
const unmeasured = []

for (const [width, height] of WIDTHS) {
  for (const lang of LANGS) {
    const ctx = await browser.newContext({ viewport: { width, height } })
    await ctx.addInitScript(() => { try { sessionStorage.setItem('vinci-welcome', '1') } catch {} })
    const page = await ctx.newPage()
    const query = [ORDER && `order=${ORDER}`, `lang=${lang}`, 'desk=words,ways,drawer']
      .filter(Boolean).join('&')
    await page.goto(`${BASE}/w/vinci?${query}`, { waitUntil: 'domcontentloaded' })
    if (!(await wingStanding(page, 180000))) {
      failures.push(`${lang}/${width}: the wing never stood`)
      await page.close(); await ctx.close(); continue
    }
    const only = String(flag('stations', '')).split(',').filter(Boolean)
    const ids = (await page.evaluate(() => window.__forge?.state?.().stationIds ?? []))
      .filter(id => !only.length || only.includes(id))
    for (const id of ids) {
      await page.evaluate(s => window.__forge.station(s), id)
      await page.waitForFunction(want => {
        const s = window.__forge?.state?.()
        return s && s.stationId === want && s.texturesPending === 0
          && !document.querySelector('#wing[data-walking]')
      }, id, { timeout: 120000, polling: 200 }).catch(() => {})
      await page.waitForTimeout(900)
      const shut = await page.evaluate(readStage)
      // the drawer is the second box the contract names
      await page.evaluate(() => document.querySelector('.desk-more')?.click())
      await page.waitForTimeout(500)
      const open = await page.evaluate(readStage)
      await page.evaluate(() => {
        const drawer = document.querySelector('.desk-drawer')
        if (drawer && drawer.getBoundingClientRect().height > 1) document.querySelector('.desk-drawer-close')?.click()
      })
      await page.waitForTimeout(300)

      const inWords = shut.marks.filter(m => over(m, shut.words))
      const inDrawer = open.drawer ? open.marks.filter(m => over(m, open.drawer)) : []
      const row = { id, lang, width, height, marks: shut.marks.length,
        words: shut.words, drawer: open.drawer, drawerMeasured: Boolean(open.drawer),
        measure: shut.measure,
        underWords: inWords.map(m => ({ name: m.name, label: m.label, px: over(m, shut.words) })),
        underDrawer: inDrawer.map(m => ({ name: m.name, label: m.label, px: over(m, open.drawer) })) }
      if (!shut.marks.length) unmeasured.push(`${lang}/${width}/${id}`)
      if (row.underWords.length || row.underDrawer.length) {
        // the first remedy, taken here: the narrow measure of 560
        await page.evaluate(() => document.querySelector('#wing')?.setAttribute('data-measure', 'narrow'))
        await page.waitForTimeout(300)
        const narrow = await page.evaluate(readStage)
        const stillWords = narrow.marks.filter(m => over(m, narrow.words))
        row.narrowClears = stillWords.length === 0
        await page.evaluate(() => document.querySelector('#wing')?.removeAttribute('data-measure'))
        failures.push(`${lang}/${width}/${id}: ${row.underWords.length} mark(s) under the words`
          + `${row.underDrawer.length ? `, ${row.underDrawer.length} under the drawer` : ''}`
          + ` [${[...row.underWords, ...row.underDrawer].map(m => m.label || m.name).join(' | ')}]`
          + ` ${row.narrowClears ? '· the narrow measure clears it' : '· the narrow measure does not clear it: a re-aim'}`)
      }
      report.stations.push(row)
      say(`  ${lang}/${width}/${id} ${row.underWords.length + row.underDrawer.length ? 'COVERED' : 'clear'}`
        + ` (${shut.marks.length} mark(s))`)
    }
    await page.close(); await ctx.close()
  }
}
await browser.close()

report.failures = failures
report.unmeasured = unmeasured
if (JSON_OUT) console.log(JSON.stringify(report, null, 1))
else {
  console.log('')
  console.log(`THE FREE AREA, ${report.stations.length} reading(s), order ${report.order}`)
  for (const line of failures) console.log(`  COVERED  ${line}`)
  if (!failures.length) console.log('  every station clear at every width, both languages')
  if (unmeasured.length) console.log(`  UNMEASURED (no mark stands here): ${unmeasured.join(', ')}`)
}
process.exit(STRICT && failures.length ? 1 : 0)
