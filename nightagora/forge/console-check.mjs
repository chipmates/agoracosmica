// THE CONSOLE STAYS CLEAN. The museum is walked the way a visitor walks it,
// on the desktop (1440 by 900) and on the phone (390 by 844): the lobby's
// front door, then every stop of the wing (the rooms' walk, then the stops
// only the life's walk has), and the close looks opened at each. The check fails on any page error, any console error and any
// warning that is not on the short list below, each of which says why it
// may stand. It also asks for the icon the page names, since a browser with
// a tab strip asks for it and a headless one does not.
//
//   node forge/console-check.mjs [port]                  (else FORGE_PORT, else 5199)
//   node forge/console-check.mjs 5479 --looks=all        (every close look of every stop)
//   node forge/console-check.mjs 5479 --looks=none       (the stops alone)
//   node forge/console-check.mjs 5479 --viewports=phone --langs=en,de --measure --out=<dir>
//   node forge/console-check.mjs 5479 --order=life --stops=picture-room-lisa --report=<file>
//
// --looks=kinds (the default) opens the first close look of each kind a stop
// offers (a machine, a work, a sheet, a leaf, a codex...) at every stop:
// every kind's own module is loaded and drawn from every place it is opened
// from, in the time a landing sweep can give. --looks=all opens every one at
// every stop, which takes about an hour.
// --measure reads the phone close look's layout at each look: whatever stands
// under the close mark, a label whose words leave its chip, and a line of
// the card's words sliced by the edge its scroll box ends at.
//
// It shoots a running server of this checkout and starts none.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { assertServer, browserArgs, waitForServer, wingStanding } from './rig.mjs'

const args = process.argv.slice(2)
const positional = args.filter((a) => !a.startsWith('--'))
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const PORT = Number(positional[0] ?? process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://localhost:${PORT}`
const LOOKS = flag('looks') ?? 'kinds'
const LANGS = (flag('langs') ?? 'en').split(',')
const ONLY_VIEWPORTS = flag('viewports')?.split(',') ?? null
const ONLY_STOPS = flag('stops')?.split(',') ?? null
/** rooms, life, or both: the rooms walked whole and the life's own stops after */
const ORDER = flag('order') ?? 'both'
const MEASURE = args.includes('--measure')
const OUT = flag('out') ? resolve(flag('out')) : null
const REPORT = flag('report') ? resolve(flag('report')) : null

/* THE WARNINGS THAT MAY STAND, each with the reason it is not the museum's
   fault or not a fault. Everything else a warning says fails the check. */
const ALLOWED = [
  {
    match: /^Machine set [a-z-]+ goes ahead of page loads still in flight: /,
    reason: 'a report of a timing decision on a slow load: a machine set stops waiting for the room\'s own page loads after its courtesy and loads beside them; nothing is dropped (machines/parts.ts)',
  },
]

const VIEWPORTS = [
  { tag: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
  { tag: 'phone', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
]

const WING_MS = 300_000
const DRESSED_MS = 60_000
const STAND_MS = 90_000
const REST_MS = 800
/** what a stop is given to paint its marks and its row once the walker rests */
const ROOM_MS = 1_500
const ROW_MS = 6_000
const OPEN_MS = 45_000
const SHUT_MS = 20_000
/** what a close look is given to draw and to say what it has to say */
const LOOK_MS = 2_500
/** the whole run's clock under a landing sweep, and an --all walk's */
const RUN_MS = (LOOKS === 'all' ? 150 : 22) * 60_000

const heard = []
const failures = []
const visited = []
const measures = []
const started = Date.now()
let where = 'the rig'
let browser = null
let finished = false

const clock = setTimeout(() => {
  failures.push(`the run passed its ${Math.round(RUN_MS / 60_000)} minute clock, standing at ${where}`)
  finish(1)
}, RUN_MS)

function allowed(text) {
  return ALLOWED.find((a) => a.match.test(text)) ?? null
}

/** one line per distinct message, with every place it was heard */
function tally() {
  const byKey = new Map()
  for (const h of heard) {
    const key = `${h.kind}|${h.text}`
    const had = byKey.get(key)
    if (had) {
      had.count++
      if (had.where.length < 6 && !had.where.includes(h.where)) had.where.push(h.where)
    } else byKey.set(key, { ...h, count: 1, where: [h.where] })
  }
  return [...byKey.values()]
}

function finish(code) {
  if (finished) return
  finished = true
  clearTimeout(clock)
  const lines = tally()
  for (const l of lines) {
    if (l.kind === 'warning' && l.allowedBy) continue
    failures.push(`${l.kind} x${l.count} at ${l.where.join(', ')}: ${l.text.split('\n')[0].slice(0, 240)}${l.source ? ` (${l.source})` : ''}`)
  }
  const ok = code === 0 && failures.length === 0
  const report = {
    ok,
    port: PORT,
    looks: LOOKS,
    langs: LANGS,
    minutes: Math.round((Date.now() - started) / 6000) / 10,
    failures,
    heard: lines,
    visited: visited.length,
    ...(MEASURE ? { measures } : {}),
  }
  if (REPORT) writeFileSync(REPORT, JSON.stringify({ ...report, visitedList: visited }, null, 1))
  console.log(JSON.stringify(report, null, 1))
  const close = browser ? browser.close().catch(() => {}) : Promise.resolve()
  void close.then(() => process.exit(ok ? 0 : 1))
}

/** THE CALLER OF A WARNING. The console's own location is the line inside
    the library that wrote it; the stack says which of ours asked. */
function installListener() {
  Error.stackTraceLimit = 60
  const keep = (kind) => {
    const was = console[kind].bind(console)
    console[kind] = (...said) => {
      try {
        const stack = (new Error().stack ?? '').split('\n').slice(2)
        const ours = stack.find((l) => /\/src\//.test(l) && !/node_modules|@vite/.test(l)) ?? ''
        const text = said.map((s) => (typeof s === 'string' ? s : s instanceof Error ? s.message : String(s))).join(' ')
        ;(window.__consoleHeard ??= []).push({ kind, text, ours: ours.trim(), top: (stack[0] ?? '').trim() })
      } catch {
        /* a listener that throws would be the console's first error */
      }
      was(...said)
    }
  }
  keep('warn')
  keep('error')
}

function hear(kind, text, source, stack) {
  const by = kind === 'warning' ? allowed(text) : null
  heard.push({ kind, text, source, where, allowedBy: by ? by.reason : undefined, ...(stack ? { stack } : {}) })
}

async function drainStacks(page) {
  const said = await page.evaluate(() => {
    const out = window.__consoleHeard ?? []
    window.__consoleHeard = []
    return out
  }).catch(() => [])
  for (const s of said) {
    const kind = s.kind === 'warn' ? 'warning' : 'error'
    const match = heard.findLast((h) => h.kind === kind && h.text.startsWith(s.text.slice(0, 80)) && !h.caller)
    if (match) match.caller = s.ours || s.top
  }
}

/** At the stop and at rest, twice over: the walking mark is written a frame
    after a leg starts. */
async function standAt(page, id) {
  const here = await page.evaluate(() => window.__forge?.state?.().stationId)
  if (here !== id) {
    const took = await page.evaluate((at) => window.__forge.station(at), id)
    if (!took) return false
  }
  const rest = () => page
    .waitForFunction((want) => window.__forge.state().stationId === want && !document.querySelector('#wing[data-walking]'), id, { timeout: STAND_MS, polling: 250 })
    .then(() => true)
    .catch(() => false)
  if (!(await rest())) return false
  await page.waitForTimeout(REST_MS)
  return rest()
}

/** The close looks the standing stop offers, off the cells it paints. A
    room reads its own exhibits once its sets have landed, so the first stop
    waits for a row far longer than the rest. */
async function offered(page, ms) {
  await page
    .waitForFunction(() => document.querySelectorAll('button[data-exhibit]').length > 0, null, { timeout: ms, polling: 250 })
    .catch(() => {})
  return page.evaluate(() =>
    [...document.querySelectorAll('button[data-exhibit]')]
      .filter((cell) => !cell.disabled)
      .map((cell) => cell.dataset.exhibit)
      .filter((id, at, all) => Boolean(id) && all.indexOf(id) === at))
}

const kindOf = (id) => id.split('/')[0]

/** The visitor's own press first, the wing's named way in where the press
    is not taken. A date opens the life window, a close look all the same. */
async function openLook(page, station, id) {
  const stands = () => page
    .waitForFunction((want) => {
      const at = document.querySelector('.vitrine-card')?.dataset.exhibit
      return at === want || Boolean(at && at.startsWith(`${want}/`)) || Boolean(document.querySelector('dialog.wing-life[open]'))
    }, id, { timeout: OPEN_MS, polling: 200 })
    .then(() => true)
    .catch(() => false)
  const pressed = await page.evaluate((want) => {
    const cell = [...document.querySelectorAll(`button[data-exhibit="${want}"]`)]
      .find((n) => !n.disabled && n.getClientRects().length > 0)
    if (!cell) return false
    cell.click()
    return true
  }, id)
  if (pressed && (await stands())) return 'press'
  await page.evaluate(([at, view]) => window.__forge.jump('wing', { slug: 'vinci', station: at, view }), [station, `open:${id}`])
  return (await stands()) ? 'named' : null
}

async function shutLook(page) {
  await page.keyboard.press('Escape')
  const shut = () => page
    .waitForFunction(() => !document.querySelector('.vitrine-card') && !document.querySelector('dialog.wing-life[open]') && !document.querySelector('#wing[data-walking]'),
      null, { timeout: SHUT_MS, polling: 200 })
    .then(() => true)
    .catch(() => false)
  if (await shut()) return true
  await page.evaluate(() => document.querySelector('.vitrine-shut:not([hidden])')?.click())
  return shut()
}

/** THE PHONE CLOSE LOOK, READ. What stands under the close mark, a label
    whose words leave its own box, and every line of the card's words sliced
    by the edge its scroll box ends at, at rest. */
async function measure(page) {
  return page.evaluate(() => {
    const visible = (el) => el.getClientRects().length > 0 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
    const box = (r) => ({ x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 })
    const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
    const lineRects = (root) => {
      const out = []
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!n.textContent.trim() || !n.parentElement || !visible(n.parentElement)) continue
        const range = document.createRange()
        range.selectNodeContents(n)
        for (const r of range.getClientRects()) if (r.width > 0.5 && r.height > 0.5) out.push({ r, text: n.textContent.trim().slice(0, 60), el: n.parentElement })
      }
      return out
    }
    const vitrine = document.querySelector('.vitrine')
    const card = document.querySelector('.vitrine-card')
    const shutEl = document.querySelector('.vitrine-shut')
    const out = { exhibit: card?.dataset.exhibit ?? null, payload: vitrine?.dataset.payload ?? null, fill: vitrine?.dataset.fill ?? null, underShut: [], chip: null, sliced: [], underControls: [] }
    if (!vitrine || !card) return out
    const shut = shutEl && visible(shutEl) ? shutEl.getBoundingClientRect() : null
    out.shut = shut ? box(shut) : null
    if (shut) {
      for (const el of vitrine.querySelectorAll('*')) {
        if (el === shutEl || el.contains(shutEl) || shutEl.contains(el) || !visible(el)) continue
        const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())
        const mark = el.matches('button, a, input, img, [role="button"]')
        if (!own && !mark) continue
        const r = el.getBoundingClientRect()
        if (overlap(r, shut) > 1) out.underShut.push({ cls: el.className?.baseVal ?? el.className, text: (el.textContent ?? '').trim().slice(0, 40), box: box(r) })
      }
    }
    const chipEl = document.querySelector('.vitrine-folio')
    if (chipEl && visible(chipEl)) {
      const r = chipEl.getBoundingClientRect()
      const lines = lineRects(chipEl)
      const outside = lines.filter(({ r: l }) => l.top < r.top - 0.5 || l.bottom > r.bottom + 0.5 || l.left < r.left - 0.5 || l.right > r.right + 0.5)
      out.chip = { box: box(r), lines: lines.length, outside: outside.map((o) => o.text), underShut: shut ? overlap(r, shut) > 1 : false, text: chipEl.textContent.trim() }
    }
    const controls = [...card.querySelectorAll('.vitrine-controls, .vitrine-payload-controls, .vitrine-walk')].filter(visible).map((c) => c.getBoundingClientRect())
    const scrollers = [card, ...card.querySelectorAll('*')].filter((el) => {
      if (!visible(el)) return false
      const s = getComputedStyle(el)
      return /(auto|scroll|hidden|clip)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1
    })
    for (const sc of scrollers) {
      const r = sc.getBoundingClientRect()
      const clipTop = r.top + sc.clientTop
      const clipBottom = clipTop + sc.clientHeight
      for (const { r: l, text, el } of lineRects(sc)) {
        if (controls.some((c) => el.closest('.vitrine-controls, .vitrine-payload-controls, .vitrine-walk') && overlap(l, c) > 0)) continue
        if (l.top < clipBottom - 1 && l.bottom > clipBottom + 1 && l.top >= clipTop - 1)
          out.sliced.push({ scroller: sc.className, text, lineTop: Math.round(l.top), lineBottom: Math.round(l.bottom), edge: Math.round(clipBottom) })
      }
    }
    for (const { r: l, text, el } of lineRects(card)) {
      if (el.closest('.vitrine-controls, .vitrine-payload-controls, .vitrine-walk')) continue
      let clip = { top: -1e9, bottom: 1e9 }
      for (let a = el; a && a !== card.parentElement; a = a.parentElement) {
        const s = getComputedStyle(a)
        if (/(auto|scroll|hidden|clip)/.test(s.overflowY)) {
          const ar = a.getBoundingClientRect()
          clip = { top: Math.max(clip.top, ar.top + a.clientTop), bottom: Math.min(clip.bottom, ar.top + a.clientTop + a.clientHeight) }
        }
      }
      const seen = { left: l.left, right: l.right, top: Math.max(l.top, clip.top), bottom: Math.min(l.bottom, clip.bottom) }
      if (seen.bottom <= seen.top) continue
      if (controls.some((c) => overlap(seen, c) > 1)) out.underControls.push({ text, line: box(l) })
    }
    return out
  })
}

async function lookAt(page, vp, lang, station, id) {
  const label = `${vp.tag}/${lang}/${station}/${id}`
  where = label
  process.stderr.write(`  ${label}\n`)
  const via = await openLook(page, station, id)
  const record = { where: label, via }
  visited.push(record)
  if (!via) {
    failures.push(`${label}: the close look never opened`)
    await shutLook(page)
    return
  }
  await page.waitForTimeout(LOOK_MS)
  if (MEASURE && vp.tag === 'phone') {
    const m = await measure(page).catch((e) => ({ error: e.message }))
    measures.push({ where: label, ...m })
    if (OUT) await page.screenshot({ path: join(OUT, `${lang}-${station}-${id.replaceAll('/', '_')}.png`) }).catch(() => {})
  }
  await drainStacks(page)
  if (!(await shutLook(page))) failures.push(`${label}: the close look never shut`)
}

async function walkViewport(vp, lang) {
  const { tag, ...shape } = vp
  const ctx = await browser.newContext({ viewport: { width: shape.width, height: shape.height }, deviceScaleFactor: shape.deviceScaleFactor,
    isMobile: shape.isMobile ?? false, hasTouch: shape.hasTouch ?? false })
  await ctx.addInitScript(installListener)
  const page = await ctx.newPage()
  page.on('console', (m) => {
    const type = m.type()
    if (type !== 'error' && type !== 'warning' && type !== 'assert') return
    const at = m.location()
    const source = at?.url ? `${at.url.replace(BASE, '')}:${at.lineNumber}` : ''
    hear(type === 'warning' ? 'warning' : 'error', m.text(), source)
  })
  page.on('pageerror', (e) => {
    const stack = (e.stack ?? '').split('\n').slice(1, 12).map((l) => l.trim().replace(BASE, ''))
    hear('pageerror', `${e.message}`, stack[0] ?? '', stack)
  })

  /* THE FRONT DOOR. The lobby is where a visitor arrives, and the page's
     own icon is asked for here, as a browser with a tab strip would. */
  where = `${tag}/${lang}/lobby`
  process.stderr.write(`${where}\n`)
  await page.goto(`${BASE}/?lang=${lang}&probe=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(window.__forge), null, { timeout: WING_MS }).catch(() => {})
  await page.waitForTimeout(2_500)
  const icon = await page.evaluate(async () => {
    const link = document.querySelector('link[rel~="icon"]')
    const href = link ? link.href : new URL('/favicon.ico', location.href).href
    try {
      const res = await fetch(href, { cache: 'no-store' })
      return { href, status: res.status, type: res.headers.get('content-type') ?? '' }
    } catch (e) {
      return { href, status: 0, type: String(e) }
    }
  })
  if (icon.status !== 200 || /text\/html/.test(icon.type))
    failures.push(`${where}: the page's icon ${icon.href.replace(BASE, '')} answers ${icon.status} ${icon.type}`)
  await drainStacks(page)

  await ctx.addInitScript(() => { try { sessionStorage.setItem('vinci-welcome', '1') } catch { /* private mode */ } })
  const kindsSeen = new Set()
  /* THE TWO ORDERS. The rooms are the wing's own walk; the life, asked for by
     its address, stands at a few stops the rooms do not have, and those are
     walked too so that no stop goes unread. */
  const roomIds = await walkOrder(page, vp, lang, 'rooms', null, kindsSeen)
  if (ORDER !== 'rooms' && roomIds) await walkOrder(page, vp, lang, 'life', ORDER === 'life' ? null : new Set(roomIds), kindsSeen)
  await drainStacks(page)
  await ctx.close()
}

/** One entry into the wing in one order, every stop of it not in `skip`
    stood at, and its close looks opened. Returns the order's stops. */
async function walkOrder(page, vp, lang, order, skip, kindsSeen) {
  const { tag } = vp
  if (order === 'rooms' && ORDER === 'life') return []
  where = `${tag}/${lang}/entry${order === 'life' ? ' (life)' : ''}`
  process.stderr.write(`${where}\n`)
  await page.goto(`${BASE}/w/vinci?lang=${lang}&probe=1${order === 'life' ? '&order=life' : ''}`, { waitUntil: 'domcontentloaded' })
  if (!(await wingStanding(page, WING_MS))) {
    failures.push(`${where}: the wing never stood`)
    return null
  }
  await page
    .waitForFunction(() => (window.__forge?.state?.().texturesPending ?? 1) === 0 && !document.querySelector('#wing[data-walking]'), null, { timeout: DRESSED_MS, polling: 250 })
    .catch(() => {})
  await drainStacks(page)
  const ids = await page.evaluate(() => window.__forge.state().stationIds ?? [])
  if (!ids.length) failures.push(`${where}: the wing reports no stop`)
  let first = true
  for (const id of ids.filter((s) => (!skip || !skip.has(s)) && (!ONLY_STOPS || ONLY_STOPS.includes(s)))) {
    where = `${tag}/${lang}/${id}`
    process.stderr.write(`${where}\n`)
    if (!(await standAt(page, id))) {
      failures.push(`${where}: never stood at this stop`)
      continue
    }
    await page.waitForTimeout(ROOM_MS)
    visited.push({ where, via: 'stop' })
    await drainStacks(page)
    if (LOOKS === 'none') continue
    const looks = await offered(page, first ? DRESSED_MS : ROW_MS)
    first = false
    for (const look of looks) {
      /* A CARD OPENS DIFFERENTLY FROM EACH STOP THAT OFFERS IT (the eye walks
         from where it stands), so the kinds are taken once per stop */
      if (LOOKS === 'kinds') {
        const key = `${id}|${kindOf(look)}`
        if (kindsSeen.has(key)) continue
        kindsSeen.add(key)
      }
      await lookAt(page, vp, lang, id, look)
      if (!(await standAt(page, id))) {
        failures.push(`${where}: never stood again after ${look}`)
        break
      }
    }
  }
  return ids
}

async function main() {
  await waitForServer(BASE, 40)
  await assertServer(BASE)
  if (OUT) mkdirSync(OUT, { recursive: true })
  browser = await chromium.launch({ args: browserArgs() })
  for (const vp of VIEWPORTS.filter((v) => !ONLY_VIEWPORTS || ONLY_VIEWPORTS.includes(v.tag)))
    for (const lang of LANGS) await walkViewport(vp, lang)
}

main().then(() => finish(0), (err) => {
  failures.push(`the check could not run: ${err.message}`)
  finish(1)
})
