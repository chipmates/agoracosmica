// HOW MUCH OF THE PHONE IS THE ROOM. The chrome of a station (the bar, the
// station card, the hang strip, the door block) is measured as one union of
// rectangles, so overlapping blocks are not counted twice, and what is left
// is the room's own share of the screen.
//
// Usage:
//   node forge/room-share.mjs <port> <tag> [station,station,...]
//
// It runs its own dev server on <port>, walks two narrow viewports (390 x 844
// and 390 x 700) in both languages, and reports every station peeked and
// pulled. Numbers land in forge/shots/phone-station/<tag>.json and the same
// table as text; a frame of every state lands beside them.
//
// Environment:
//   FORGE_TIER   which tier to stand in (calm by default: the phone's own)
//   FORGE_SHOTS  0 to measure without writing frames

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { assertServer, browserArgs, waitForServer, wingStanding } from './rig.mjs'

const port = Number(process.argv[2] ?? 5376)
const tag = process.argv[3] ?? 'before'
const stations = (process.argv[4] ?? 'works,picture-room,grave').split(',').filter(Boolean)
const TIER = process.env['FORGE_TIER'] ?? 'calm'
const SHOTS = process.env['FORGE_SHOTS'] !== '0'
const BASE = `http://localhost:${port}`
const OUT = new URL('./shots/phone-station/', import.meta.url).pathname

const VIEWPORTS = [
  { tag: '390x844', width: 390, height: 844 },
  { tag: '390x700', width: 390, height: 700 },
]

/* WHAT COUNTS AS CHROME. Everything the museum draws over the room at a
   station. The marks in the room (the exhibit dots and the leader lines)
   are the room's own and are not counted. */
const CHROME = [
  '.wing-rail-group',
  '.wing-doorblock',
  '.vinci-heading',
  '.vinci-strip',
  '.vinci-dock[open]',
  '.wing-lobby',
  '.vinci-source',
  '.wing-sheet-foot',
]

const measure = (selectors) =>
  // eslint-disable-next-line no-undef
  {
    const seen = (el) => {
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
      const box = el.getBoundingClientRect()
      return box.width > 0.5 && box.height > 0.5 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth
    }
    const clip = (box) => ({
      left: Math.max(0, box.left),
      top: Math.max(0, box.top),
      right: Math.min(innerWidth, box.right),
      bottom: Math.min(innerHeight, box.bottom),
    })
    const rects = []
    const parts = {}
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (el.hidden || !seen(el)) continue
        const box = clip(el.getBoundingClientRect())
        if (box.right <= box.left || box.bottom <= box.top) continue
        rects.push(box)
        const key = selector.replace(/[^a-z-]/g, '')
        parts[key] = {
          top: Math.round(box.top),
          bottom: Math.round(box.bottom),
          height: Math.round(box.bottom - box.top),
          width: Math.round(box.right - box.left),
        }
      }
    }
    // the union by coordinate compression: a handful of rectangles, so the
    // cell walk is cheaper than any interval tree
    const xs = [...new Set(rects.flatMap((r) => [r.left, r.right]))].sort((a, b) => a - b)
    const ys = [...new Set(rects.flatMap((r) => [r.top, r.bottom]))].sort((a, b) => a - b)
    let covered = 0
    for (let i = 0; i + 1 < xs.length; i++) {
      for (let j = 0; j + 1 < ys.length; j++) {
        const cell = { left: xs[i], right: xs[i + 1], top: ys[j], bottom: ys[j + 1] }
        if (rects.some((r) => r.left <= cell.left && r.right >= cell.right && r.top <= cell.top && r.bottom >= cell.bottom))
          covered += (cell.right - cell.left) * (cell.bottom - cell.top)
      }
    }
    const screen = innerWidth * innerHeight
    /* THE ROOM'S OWN BAND. The share above counts every pixel the chrome
       leaves, including the slivers between two blocks; what a visitor sees
       of the room is the tallest unbroken band of the screen with no chrome
       in it. Both numbers are reported, and the band is the one the eye
       reads as "the room". */
    const lines = rects.map((r) => [r.top, r.bottom]).sort((a, b) => a[0] - b[0])
    let band = 0, bandTop = 0, y = 0
    for (const [top, bottom] of lines) {
      if (top - y > band) { band = top - y; bandTop = y }
      y = Math.max(y, bottom)
    }
    if (innerHeight - y > band) { band = innerHeight - y; bandTop = y }
    /* ANYTHING ELSE THAT PAINTS OVER THE ROOM, so a block nobody listed
       cannot quietly eat the share this file reports. */
    const others = []
    for (const el of document.querySelectorAll('body *')) {
      if (el.hidden || !(el instanceof HTMLElement)) continue
      const style = getComputedStyle(el)
      if (style.position !== 'fixed' && style.position !== 'absolute') continue
      if (!seen(el)) continue
      if (el.closest(selectors.join(','))) continue
      if (el.matches('#wing,.wing-stage,.wing-labels,canvas,svg,.vinci-leader,.vinci-dot,.vinci-exhibit-dot,style,dialog:not([open])')) continue
      if (el.querySelector(selectors.join(','))) continue
      const box = clip(el.getBoundingClientRect())
      others.push(`${el.className || el.tagName} ${Math.round(box.right - box.left)}x${Math.round(box.bottom - box.top)}`)
    }
    return {
      share: Number((1 - covered / screen).toFixed(4)),
      band: Math.round(band),
      bandShare: Number((band / innerHeight).toFixed(4)),
      bandTop: Math.round(bandTop),
      coveredPx: Math.round(covered),
      screen,
      parts,
      others: [...new Set(others)].slice(0, 8),
      targets: [...document.querySelectorAll('#wing button,#wing a,.wing-labels button,.wing-labels a')]
        .filter((el) => seen(el) && !el.hidden)
        .map((el) => {
          const box = el.getBoundingClientRect()
          return { name: el.className || el.tagName, w: Math.round(box.width), h: Math.round(box.height) }
        })
        .filter((t) => t.w < 44 || t.h < 44),
      persistent: [...document.querySelectorAll('[data-na-persistent]')].filter((el) => seen(el) && !el.hidden).length,
    }
  }

mkdirSync(OUT, { recursive: true })
const problems = []
const rows = []
const server = spawn('pnpm', ['exec', 'vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
try {
  await waitForServer(BASE)
  const said = await assertServer(BASE)
  console.log(`server ${said.head.slice(0, 7)} at ${said.root}`)
  const browser = await chromium.launch({ args: browserArgs() })
  for (const vp of VIEWPORTS) {
    for (const lang of ['en', 'de']) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 })
      page.on('pageerror', (e) => problems.push(`[${vp.tag}/${lang}] pageerror: ${e.message}`))
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(`[${vp.tag}/${lang}] console: ${m.text()}`)
      })
      // Vite's own client reloads the page when any hand saves a file, and a
      // measurement taken after that reload is of the entry, not a station.
      await page.route('**/@vite/client', (route) =>
        route.fulfill({ status: 200, contentType: 'application/javascript', body: 'export {}' })
      )
      await page.goto(`${BASE}/?tier=${TIER}`)
      await page.waitForFunction(() => Boolean(window.__forge))
      await page.waitForTimeout(1500)
      for (const station of stations) {
        await page.evaluate(
          ([s, l]) => {
            window.__forge.freeze(12.4)
            window.__forge.jump('wing', { slug: 'vinci', station: s, lang: l })
          },
          [station, lang]
        )
        await wingStanding(page, 90000)
        await page.waitForTimeout(1700)
        /* THE ROW ARRIVES AFTER THE ROOM DOES. A station's exhibits land on
           their own promise, and a frame measured before they do is of a
           station with no wall. */
        await page
          .waitForFunction(() => Boolean(document.querySelector('.vinci-strip:not([hidden]) li')), null, { timeout: 12000, polling: 250 })
          .catch(() => problems.push(`[${vp.tag}/${lang}] ${station}: no row within 12 s`))
        await page.waitForTimeout(400)
        for (const state of ['peek', 'open']) {
          const pulled = await page.evaluate((want) => {
            const card = document.querySelector('.vinci-heading[data-sheet]')
            if (!card) return 'none'
            if (card.dataset.sheet !== want) document.querySelector('.vinci-sheet-grab')?.click()
            return card.dataset.sheet
          }, state)
          await page.waitForTimeout(350)
          const read = await page.evaluate(measure, CHROME)
          rows.push({ viewport: vp.tag, lang, station, sheet: pulled, ...read })
          if (SHOTS)
            await page.screenshot({ path: `${OUT}${tag}-${vp.tag}-${lang}-${station}-${state}.png` })
          if (pulled === 'none') break
        }
      }
      await page.close()
    }
  }
  await browser.close()
} finally {
  server.kill('SIGTERM')
}

const table = [
  '| viewport | lang | station | sheet | room share | room band | bar | card | strip | doorblock | under 44 | persistent |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) =>
    `| ${r.viewport} | ${r.lang} | ${r.station} | ${r.sheet} | ${(r.share * 100).toFixed(1)}% | ${r.band} px ${(r.bandShare * 100).toFixed(1)}% | ` +
    `${r.parts['wing-rail-group']?.height ?? '-'} | ${r.parts['vinci-heading']?.height ?? '-'} | ` +
    `${r.parts['vinci-strip']?.height ?? '-'} | ${r.parts['wing-doorblock']?.height ?? '-'} | ` +
    `${r.targets.length} | ${r.persistent} |`
  ),
].join('\n')
writeFileSync(`${OUT}${tag}.json`, JSON.stringify({ tag, tier: TIER, rows, problems }, null, 2))
writeFileSync(`${OUT}${tag}.md`, `${table}\n`)
console.log(table)
const others = [...new Set(rows.flatMap((r) => r.others))]
if (others.length) console.log(`other fixed blocks over the room: ${others.join(' · ')}`)
if (problems.length) {
  console.log(`\n${problems.length} problems`)
  for (const p of [...new Set(problems)].slice(0, 20)) console.log(`  ${p}`)
}
