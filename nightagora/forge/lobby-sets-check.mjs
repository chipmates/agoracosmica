// THE LOBBY'S SETS STAY IN THE LOBBY. The court's lapis marble, the bowl's
// dark bronze and the colonnade's pale limestone are the lobby's library
// sets, about 21 MB of KTX2 at the standard tier. A visitor who opens a
// wing's address is not standing in the lobby, so the lobby must not spend
// that line on them. This reads the network the way a visitor pays it, on
// the desktop (1440 by 900) and on the phone (390 by 844):
//
//   wing     a wing's address, cold: every set request while the entry lifts
//            and for --hold ms after, each with the modules that asked for it
//   return   then the way home pressed: what the lobby fetches, and how long
//            until its sets are on the GPU
//   last     the wing's last stop, deep-linked: the prefetch the way home in
//            front of the visitor allows, and its refusal under Save-Data and
//            on a 3G line
//   lobby    the lobby's own address, --runs times: the first frame and the
//            moment its sets are on the GPU
//
//   node forge/lobby-sets-check.mjs [port] [--runs=3] [--hold=12000]
//     [--viewports=desktop,phone] [--only=wing,return,last,lobby] [--out=<file>]
//     [--frames=<dir>]   also shoot the lobby's stops, frozen, from its own
//                        address and after the way home from the wing
//
// It shoots a running server of this checkout and starts none. It exits
// non-zero when a wing's address fetched the lapis marble (the one set no
// wing asks for), when the lobby did not fetch all three, or when the last
// stop's prefetch ran under Save-Data or on a 3G line.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { assertServer, browserArgs, wingStanding } from './rig.mjs'

const args = process.argv.slice(2)
const positional = args.filter((a) => !a.startsWith('--'))
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const PORT = Number(positional[0] ?? process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://localhost:${PORT}`
const RUNS = Number(flag('runs') ?? 3)
const HOLD = Number(flag('hold') ?? 12000)
const ONLY = new Set((flag('only') ?? 'wing,return,last,lobby').split(','))
const OUT = flag('out') ? resolve(flag('out')) : null
const WING = flag('wing') ?? 'vinci'
/** where the lobby's stops are shot, from its own address and after a wing */
const FRAMES = flag('frames') ? resolve(flag('frames')) : null
const STOPS = ['transit', 'held', 'descent', 'agora', 'wheel']

const SETS = ['marble-lapis', 'bronze-dark', 'limestone-pale']
/** the lobby's own set: no wing asks for it, so it is the witness */
const LOBBY_ONLY = 'marble-lapis'
const SET_URL = new RegExp(`/library/(${SETS.join('|')})/([a-z0-9.]+)`)

const VIEWPORTS = [
  { tag: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { tag: 'phone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
].filter((vp) => !flag('viewports') || flag('viewports').split(',').includes(vp.tag))

/** the line a visitor stands on, as the Network Information API reports it */
const LINES = {
  plain: null,
  'save-data': { saveData: true, effectiveType: '4g' },
  '3g': { saveData: false, effectiveType: '3g' },
}

const report = { port: PORT, runs: RUNS, hold: HOLD, wing: WING, viewports: {} }
const failures = []

/** a page that records every set request, when it left, what it weighed and
    which of the app's modules stand in the stack that asked for it */
async function openPage(browser, vp, line = null) {
  const context = await browser.newContext({
    viewport: vp.viewport,
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile ?? false,
    hasTouch: vp.hasTouch ?? false,
  })
  if (line) {
    await context.addInitScript((said) => {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: { ...said, downlink: 10, rtt: 50, addEventListener() {}, removeEventListener() {} },
      })
    }, line)
  }
  const page = await context.newPage()
  page.setDefaultTimeout(120000)
  // the dev client reloads on any save in the checkout, which would restart
  // the measurement in the middle
  await page.route('**/@vite/client', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: 'export {}' })
  )
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Debugger.enable')
  await cdp.send('Debugger.setAsyncCallStackDepth', { maxDepth: 64 })
  /* THE REQUEST IS WHAT THE LINE PAYS. Read off the protocol and not off the
     page's own finished events: a map streamed through the loader's progress
     reader is reported aborted by the page once it has been read whole, and
     its bytes were paid all the same. */
  const sets = []
  const byId = new Map()
  const t0 = { at: Date.now() }
  cdp.on('Network.requestWillBeSent', (e) => {
    const m = SET_URL.exec(e.request.url)
    if (!m) return
    const files = new Set()
    for (let stack = e.initiator?.stack; stack; stack = stack.parent) {
      for (const frame of stack.callFrames ?? []) {
        const src = /\/src\/(.+?\.ts)/.exec(frame.url)
        if (src) files.add(src[1])
      }
    }
    const row = { set: m[1], file: m[2], atMs: Date.now() - t0.at, bytes: 0, done: null, askedBy: [...files] }
    byId.set(e.requestId, row)
    sets.push(row)
  })
  cdp.on('Network.dataReceived', (e) => {
    const row = byId.get(e.requestId)
    if (row && !row.done) row.bytes += e.dataLength
  })
  cdp.on('Network.loadingFinished', (e) => {
    const row = byId.get(e.requestId)
    if (!row) return
    row.bytes = e.encodedDataLength || row.bytes
    row.done = 'finished'
  })
  cdp.on('Network.loadingFailed', (e) => {
    const row = byId.get(e.requestId)
    if (row) row.done = e.errorText
  })
  return { context, page, sets, errors, t0 }
}

/** the ms until the page's library holds nothing in flight, polled at 50 ms */
async function dressedAfter(page, since, ms = 60000) {
  return page
    .waitForFunction(() => window.__forge?.state?.().texturesPending === 0, null, { timeout: ms, polling: 50 })
    .then(() => Date.now() - since)
    .catch(() => null)
}

const summary = (rows) => {
  const by = {}
  for (const r of rows) {
    const s = (by[r.set] ??= { files: [], MB: 0, askedBy: new Set() })
    s.files.push(r.file)
    s.MB += (r.bytes ?? 0) / 1048576
    for (const f of r.askedBy) s.askedBy.add(f)
  }
  return Object.fromEntries(
    Object.entries(by).map(([k, v]) => [k, { files: v.files.sort(), MB: Math.round(v.MB * 100) / 100, askedBy: [...v.askedBy] }])
  )
}

try {
  const said = await assertServer(BASE)
  report.head = said.head
  const browser = await chromium.launch({ args: browserArgs() })
  for (const vp of VIEWPORTS) {
    const into = (report.viewports[vp.tag] = {})

    if (ONLY.has('wing') || ONLY.has('return')) {
      const { context, page, sets, errors, t0 } = await openPage(browser, vp)
      t0.at = Date.now()
      await page.goto(`${BASE}/w/${WING}`)
      const stood = await wingStanding(page, 240000)
      const standingMs = Date.now() - t0.at
      await page.waitForTimeout(HOLD)
      const atWing = sets.slice()
      into.wing = {
        stood,
        standingMs,
        station: await page.evaluate(() => window.__forge?.state?.().stationId ?? null),
        sets: summary(atWing),
        requests: atWing,
        errors: errors.slice(),
      }
      if (atWing.some((r) => r.set === LOBBY_ONLY)) failures.push(`${vp.tag}: the wing's address fetched ${LOBBY_ONLY}`)
      if (ONLY.has('return')) {
        const pressedAt = Date.now()
        const before = sets.length
        await page.evaluate(() => document.querySelector('.wing-lobby')?.click())
        await page.waitForFunction(() => document.body.dataset.phase === 'wheel', null, { timeout: 20000 })
        const dressedMs = await dressedAfter(page, pressedAt)
        const after = sets.slice(before)
        into.return = { dressedMs, sets: summary(after), errors: errors.slice() }
        const have = new Set(sets.map((r) => r.set))
        const lacking = SETS.filter((s) => !have.has(s))
        if (lacking.length) failures.push(`${vp.tag}: back in the lobby, never fetched ${lacking.join(', ')}`)
      }
      await context.close()
    }

    if (ONLY.has('last')) {
      into.last = {}
      const probe = await openPage(browser, vp)
      await probe.page.goto(`${BASE}/w/${WING}`)
      await wingStanding(probe.page, 240000)
      const ids = await probe.page.evaluate(() => window.__forge.state().stationIds)
      await probe.context.close()
      const lastId = ids[ids.length - 1]
      for (const [name, line] of Object.entries(LINES)) {
        const { context, page, sets, errors, t0 } = await openPage(browser, vp, line)
        t0.at = Date.now()
        await page.goto(`${BASE}/w/${WING}#s=${lastId}`)
        await wingStanding(page, 240000)
        await page.waitForTimeout(HOLD)
        const station = await page.evaluate(() => window.__forge.state().stationId)
        const lapis = sets.some((r) => r.set === LOBBY_ONLY)
        into.last[name] = { station, lastId, prefetched: lapis, sets: summary(sets), errors: errors.slice() }
        if (line && lapis) failures.push(`${vp.tag}: the last stop prefetched the lobby under ${name}`)
        if (!line && station === lastId && !lapis) failures.push(`${vp.tag}: the last stop did not prefetch on a plain line`)
        await context.close()
      }
    }

    if (FRAMES) {
      mkdirSync(FRAMES, { recursive: true })
      for (const origin of ['lobby', 'wing']) {
        const { context, page, errors } = await openPage(browser, vp)
        if (origin === 'wing') {
          await page.goto(`${BASE}/w/${WING}`)
          await wingStanding(page, 240000)
          await page.evaluate(() => document.querySelector('.wing-lobby')?.click())
          await page.waitForFunction(() => document.body.dataset.phase === 'wheel', null, { timeout: 20000 })
        } else {
          await page.goto(`${BASE}/`)
          await page.waitForFunction(() => Boolean(window.__forge), null, { timeout: 60000 })
          await page.waitForTimeout(1800)
        }
        for (const stop of STOPS) {
          await page.evaluate((s) => {
            window.__forge.freeze(12.4)
            window.__forge.jump(s, {})
          }, stop)
          await page.waitForFunction((s) => document.body.dataset.forge === s, stop, { timeout: 8000 }).catch(() => {
            failures.push(`${vp.tag} ${origin}: the stop ${stop} never took`)
          })
          await page.waitForTimeout(1700)
          if ((await dressedAfter(page, Date.now(), 60000)) === null) failures.push(`${vp.tag} ${origin} ${stop}: the library never finished`)
          await page.screenshot({ path: `${FRAMES}/${vp.tag}-${origin}-${stop}.png` })
        }
        into[`frames-${origin}`] = { tier: await page.evaluate(() => document.body.dataset.tier), errors: errors.slice() }
        await context.close()
      }
    }

    if (ONLY.has('lobby')) {
      into.lobby = []
      for (let run = 0; run < RUNS; run++) {
        const { context, page, sets, errors, t0 } = await openPage(browser, vp)
        let firstFrameMs = null
        page.on('console', (m) => {
          if (firstFrameMs === null && m.text().includes('[na] first frame requested')) firstFrameMs = Date.now() - t0.at
        })
        t0.at = Date.now()
        await page.goto(`${BASE}/`)
        await page.waitForFunction(() => Boolean(window.__forge), null, { timeout: 60000 })
        const dressedMs = await dressedAfter(page, t0.at)
        await page.waitForTimeout(500)
        into.lobby.push({ run, firstFrameMs, dressedMs, sets: summary(sets), errors: errors.slice() })
        const have = new Set(sets.map((r) => r.set))
        const lacking = SETS.filter((s) => !have.has(s))
        if (lacking.length) failures.push(`${vp.tag} lobby run ${run}: never fetched ${lacking.join(', ')}`)
        await context.close()
      }
    }
  }
  await browser.close()
} catch (err) {
  failures.push(`the check could not run: ${err.message}`)
}

report.failures = failures
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(report, null, 2))
}
for (const [tag, v] of Object.entries(report.viewports)) {
  if (v.wing) console.log(`${tag} wing (stood ${v.wing.standingMs} ms, at ${v.wing.station}): ${JSON.stringify(v.wing.sets)}`)
  if (v.return) console.log(`${tag} return (dressed ${v.return.dressedMs} ms after the press): ${JSON.stringify(v.return.sets)}`)
  if (v.last) for (const [k, l] of Object.entries(v.last)) console.log(`${tag} last stop ${l.station} (${k}): prefetched=${l.prefetched} ${JSON.stringify(l.sets)}`)
  if (v.lobby) for (const r of v.lobby) console.log(`${tag} lobby run ${r.run}: first frame ${r.firstFrameMs} ms, dressed ${r.dressedMs} ms, ${Object.keys(r.sets).join(' ')}`)
  for (const part of ['wing', 'return']) for (const e of v[part]?.errors ?? []) console.log(`${tag} ${part} ${e}`)
}
if (failures.length) {
  console.log('FAILURES:')
  for (const f of failures) console.log(' ·', f)
  process.exitCode = 1
} else console.log('clean')
