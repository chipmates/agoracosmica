// THE LEG PROBE — what a frame costs while the visitor is WALKING. Standing
// still a wing holds 17 ms and every budget line passes; the stall is on the
// leg, where the materials of the room ahead are seen for the first time and
// their pipelines compile inside the frame that needed them. A cost meter
// read at a station cannot see that, so this one samples every frame of a
// named leg and prints the worst of them with the second it happened in.
//
//   node forge/leg-probe.mjs <from> <to> [--tier=hero,standard] [--wing=vinci]
//   node forge/leg-probe.mjs --entry [--tier=hero,standard]
//   FORGE_PORT=5288 node forge/leg-probe.mjs chamber garden
//   node forge/leg-probe.mjs --walk [--tier=hero,standard] [--json=out.json]
//
// `--walk` walks every leg of the rail in order in one page, each one read
// to its arrival and two seconds past it: the whole walk a visitor makes.
//
// `--entry` measures the other half of the same wait: the seconds from the
// press in the lobby (and from the deep link) to the wing's first frame,
// cold cache and warm, which is the number the loading screen is judged on.
// It serves its own preview on FORGE_PORT; `--serve=off` shoots a server
// that is already up, and `--dev` spawns the dev server instead, whose
// unbundled modules make every number slower than the one that ships.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { APP_ROOT, assertServer, browserArgs, FRAME_TIME_FLAGS, waitForServer } from './rig.mjs'

const argv = process.argv.slice(2)
const flags = new Map()
const words = []
for (const a of argv) {
  if (!a.startsWith('--')) { words.push(a); continue }
  const at = a.indexOf('=')
  flags.set(at === -1 ? a.slice(2) : a.slice(2, at), at === -1 ? true : a.slice(at + 1))
}
const flag = (name, fallback) => flags.get(name) ?? fallback
const PORT = Number(flag('port', process.env['FORGE_PORT'] ?? 5199))
const BASE = `http://127.0.0.1:${PORT}`
const WING = String(flag('wing', 'vinci'))
const TIERS = String(flag('tier', 'hero,standard')).split(',')
/** stroll, walk or brisk: the pace the visitor set, written to the device. */
const PACE = flags.has('pace') ? String(flag('pace', 'walk')) : ''
const SECONDS = Number(flag('seconds', 30))
const SETTLE = Number(flag('settle', 6))
/* THE PHONE'S OWN STAGE. `--phone` is 390 by 844 at a device ratio of 2 with
   touch, which is the stage every phone reading of this wing is taken at;
   `--throttle` puts a mid-range phone's processor and a fast 4G line under
   it, so the wait is a visitor's wait and not this machine's. */
const PHONE = flags.has('phone')
const VIEW = { width: Number(flag('width', PHONE ? 390 : 1440)), height: Number(flag('height', PHONE ? 844 : 900)) }
const DPR = Number(flag('dpr', PHONE ? 2 : 1))
const THROTTLE = flags.has('throttle')
const CPU = Number(flag('cpu', 4))
const RUNS = Number(flag('runs', 1))
const ENTRY = flags.has('entry')
const DEV = flags.has('dev')
const WALK = flags.has('walk')
const [FROM, TO] = [words[0] ?? 'chamber', words[1] ?? 'garden']

/** the number a station's own card carries, which is what says ARRIVED: the
    rail's index is the station ASKED for and it changes when the leg starts */
const cardNumber = (ids, id) => `${String(ids.indexOf(id) + 1).padStart(2, '0')} / ${ids.length}`

async function sampleLeg(page, ids, to = TO) {
  return page.evaluate(async ([to, toNo, seconds]) => {
    const t0 = performance.now(); const dts = []; let last = t0; let arrived = null; let stop = false
    // what the renderer created for the first time, frame by frame: a leg
    // that creates nothing has nothing to stall on
    const ledger = window.__naStack?.ledger
    const kinds = ['nodeBuilds', 'programs', 'pipelines', 'textures', 'buffers']
    const created = []; let before = ledger?.counts()
    // the rail bar says ARRIVED without a layout: reading the page's text in
    // every frame would force one, and the probe would time its own reading
    const bar = () => {
      const here = document.querySelector('.wing-step[aria-current="true"]')
      return here ? here.dataset.station === to && !document.querySelector('.wing-step[data-target="true"]') : null
    }
    const tick = (t) => {
      dts.push(t - last); last = t
      if (ledger) { const now = ledger.counts(); created.push(kinds.map(k => now[k] - before[k])); before = now }
      if (arrived === null && t - t0 > 1500 && (bar() ?? document.body.innerText.includes(toNo))) arrived = t - t0
      if (!stop) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    await new Promise(r => setTimeout(r, 1500)) // the idle baseline, before the leg
    const idleN = dts.length
    history.pushState({}, '', location.pathname + location.search + '#s=' + to)
    dispatchEvent(new PopStateEvent('popstate'))
    // the window closes two seconds after the arrival, or at the cap
    const began = performance.now()
    while (performance.now() - began < seconds * 1000 && !(arrived !== null && performance.now() - t0 > arrived + 2000))
      await new Promise(r => setTimeout(r, 100))
    stop = true
    const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))]
    const band = (a) => a.length ? {
      frames: a.length, mean: Math.round(a.reduce((x, c) => x + c, 0) / a.length),
      p50: Math.round(q(a, .5)), p95: Math.round(q(a, .95)), max: Math.round(Math.max(...a)),
      over50: a.filter(x => x > 50).length, over100: a.filter(x => x > 100).length,
    } : null
    // THE LEG ENDS AT THE ARRIVAL. What the window holds after it is the room
    // settling, which is a different reading and is reported as one.
    let arrivedN = dts.length
    for (let i = idleN, acc = 0; i < dts.length; i++) { acc += dts[i]; if (arrived !== null && acc >= arrived - 1500) { arrivedN = i; break } }
    const said = (c) => c && c.some(Boolean) ? ` [${kinds.map((k, j) => c[j] ? `${k} ${c[j]}` : '').filter(Boolean).join(' ')}]` : ''
    let acc = 0; const hitches = []
    // a frame's creations are counted in the tick that follows it
    for (let i = 0; i < dts.length; i++) { acc += dts[i]; if (i >= idleN && dts[i] > 50) hitches.push(`${(acc / 1000 - 1.5).toFixed(2)}s ${Math.round(dts[i])}ms${said(created[i])}`) }
    const total = (from, to) => kinds.map((_, j) => created.slice(from, to).reduce((a, c) => a + c[j], 0))
    const firstUse = ledger ? { leg: Object.fromEntries(kinds.map((k, j) => [k, total(idleN, arrivedN)[j]])),
      after: Object.fromEntries(kinds.map((k, j) => [k, total(arrivedN, dts.length)[j]])) } : null
    return {
      idle: band(dts.slice(0, idleN)),
      leg: band(dts.slice(idleN, arrivedN)),
      after: band(dts.slice(arrivedN)),
      arrivedAt: arrived === null ? null : Math.round(arrived) / 1000,
      hitches: hitches.slice(0, 16),
      firstUse,
    }
  }, [to, cardNumber(ids, to), SECONDS])
}

/** THE ENTRY AS A VISITOR MEETS IT, in four moments and one standstill: the
 *  navigation, the first painted frame, the gold line's first step, the wing
 *  standing. The line is sampled on every animation frame, so the longest
 *  stretch in which it does not move is a measurement and not an impression.
 *  The bytes are read off the page's own resource timing at the moment the
 *  wing stands, which is the wait the entry paid for. */
async function timeEntry(page, how) {
  return page.evaluate(async (how) => {
    const struck = () => {
      const gold = document.getElementById('goldbreath')
      return gold !== null && !gold.classList.contains('lit')
    }
    // the navigation is the page's own origin; a press starts its own clock
    let t0 = 0
    if (how === 'press') {
      for (let i = 0; i < 600 && window.__forge === undefined; i++) await new Promise(r => setTimeout(r, 20))
      window.__forge.jump('pane', { slug: 'vinci' })
      for (let i = 0; i < 400 && !document.querySelector('.pane-enter:not([hidden])'); i++) await new Promise(r => setTimeout(r, 20))
      t0 = performance.now()
      document.querySelector('.pane-enter').click()
    }
    /* THE LINE IS READ ON EVERY FRAME, never on a timer: a timer that fires
       while the main thread is blocked reports the block as a standstill of
       its own making, and an animation frame cannot fire at all until the
       page can paint, which is the same thing the visitor sees. */
    const line = () => {
      const el = document.querySelector('#goldbreath .dark-line')
      if (!(el instanceof HTMLElement)) return null
      const m = /scaleX\(([0-9.]+)\)/.exec(el.style.transform)
      return m ? Number(m[1]) : null
    }
    const steps = []
    let last = null
    let watching = true
    const watch = () => {
      const v = line()
      if (v !== null && v !== last) { steps.push([performance.now() - t0, v]); last = v }
      if (watching) requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
    const sentences = new Set()
    let standing = null
    for (let i = 0; i < 12000 && standing === null; i++) {
      const said = document.querySelector('#goldbreath .stage-line, #goldbreath .gold-line, #goldbreath p')
      if (said && said.textContent) sentences.add(said.textContent.trim())
      if (document.body.dataset['phase'] === 'wing' && struck()) standing = performance.now() - t0
      else await new Promise(r => setTimeout(r, 16))
    }
    watching = false
    const paint = performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint')
    const bytes = performance.getEntriesByType('resource').map(r => [r.name, r.transferSize, r.encodedBodySize])
    const nav = performance.getEntriesByType('navigation')[0]
    if (nav) bytes.push([location.href, nav.transferSize, nav.encodedBodySize])
    /* the longest the line stood still, and where: the stretch between two
       counted steps, with the standing frame closing the last one */
    let still = 0, stillAt = null
    const marks = steps.map(s => s[0])
    if (standing !== null) marks.push(standing)
    for (let i = 1; i < marks.length; i++)
      if (marks[i] - marks[i - 1] > still) { still = marks[i] - marks[i - 1]; stillAt = marks[i - 1] }
    const ms = (v) => v === null || v === undefined ? null : Math.round(v)
    return {
      how,
      firstPaint: how === 'press' ? null : ms(paint?.startTime),
      firstStep: steps.length ? ms(steps[0][0]) : null,
      standing: ms(standing),
      steps: steps.length,
      longestStillMs: ms(still),
      longestStillAt: ms(stillAt),
      sentences: [...sentences].filter(Boolean),
      bytes,
    }
  }, how)
}

/** every byte the entry pulled, sorted into the four families a visitor's
 *  connection actually pays for */
function byClass(rows) {
  const family = (url) => {
    if (/\/na-assets\/library\//.test(url)) return 'textures'
    if (/\/na-assets\/models\//.test(url)) return 'models'
    if (/\/na-assets\//.test(url)) return 'plates'
    if (/\.(js|mjs|css)(\?|$)/.test(url) || /\/$|\.html(\?|$)/.test(url)) return 'code'
    return 'other'
  }
  const out = { code: [0, 0], textures: [0, 0], models: [0, 0], plates: [0, 0], other: [0, 0] }
  for (const [url, transfer, encoded] of rows ?? []) {
    const k = family(url)
    out[k][0] += transfer || encoded || 0
    out[k][1]++
  }
  const mb = (n) => Math.round((n / (1024 * 1024)) * 100) / 100
  return Object.fromEntries(Object.entries(out).map(([k, [b, n]]) => [k, { MB: mb(b), files: n }]))
}

/** one entry, in a context of its own, so two wings never share a GPU. The
 *  throttled profile is set on the page's own CDP session, so the numbers
 *  come from the same browser as the unthrottled ones. */
async function oneEntry(browser, url, how, again) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DPR, hasTouch: PHONE, isMobile: PHONE })
  const page = await ctx.newPage()
  try {
    if (THROTTLE) {
      const cdp = await ctx.newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
      // the DevTools "fast 4G" profile, written out so the reading can be repeated
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: 75, downloadThroughput: Math.round((9 * 1000 * 1000 * 0.9) / 8),
        uploadThroughput: Math.round((1.5 * 1000 * 1000 * 0.9) / 8),
      })
    }
    await page.goto(url, { waitUntil: 'commit' })
    const cold = await timeEntry(page, how)
    if (!again) return { cold, warm: null }
    await page.goto('about:blank')
    await page.goto(url, { waitUntil: 'commit' })
    return { cold, warm: await timeEntry(page, how) }
  } finally {
    await ctx.close()
  }
}

const server = flags.has('serve') && flag('serve') === 'off' ? null
  : spawn('pnpm', DEV ? ['exec', 'vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1']
    : ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', cwd: APP_ROOT })
try {
  await waitForServer(`${BASE}/`)
  const said = await assertServer(BASE)
  console.error(`server ${said.head.slice(0, 7)} on ${BASE}${DEV ? ' (dev: unbundled modules, slower than the ship)' : ''}`)
  const browser = await chromium.launch({ args: [...browserArgs(), ...FRAME_TIME_FLAGS] })
  for (const tier of TIERS) {
    if (ENTRY) {
      const stage = `${VIEW.width}x${VIEW.height}${DPR === 1 ? '' : ` dpr${DPR}`}${THROTTLE ? `, cpu /${CPU}, fast 4G` : ''}`
      console.log(`\n== ${tier}, ${stage} ==`)
      console.log('  how                  navigation  first paint  line step  standing  steps  longest still')
      const rows = []
      for (let pass = 1; pass <= RUNS; pass++) {
        const link = await oneEntry(browser, `${BASE}/w/${WING}?probe=1&tier=${tier}`, 'link', !THROTTLE)
        for (const [cache, r] of [['cold', link.cold], ['warm', link.warm]]) {
          if (!r) continue
          rows.push({ tier, stage, how: `deep link ${cache}`, pass, ...r, classes: byClass(r.bytes) })
          const s = (v) => v === null ? '    ?' : `${(v / 1000).toFixed(2)} s`
          console.log(
            `  deep link ${cache} ${pass}      0.00 s     ${s(r.firstPaint)}    ${s(r.firstStep)}   ${s(r.standing)}    ` +
            `${String(r.steps).padStart(3)}    ${s(r.longestStillMs)} from ${s(r.longestStillAt)}`
          )
          const c = byClass(r.bytes)
          console.log(`      bytes over the wire: code ${c.code.MB} MB (${c.code.files}), textures ${c.textures.MB} MB (${c.textures.files}), ` +
            `models ${c.models.MB} MB (${c.models.files}), plates ${c.plates.MB} MB (${c.plates.files}), other ${c.other.MB} MB (${c.other.files})`)
        }
      }
      if (!THROTTLE) {
        const press = await oneEntry(browser, `${BASE}/?probe=1&tier=${tier}`, 'press', true)
        for (const [cache, r] of [['cold', press.cold], ['warm', press.warm]]) {
          if (!r) continue
          rows.push({ tier, stage, how: `press ${cache}`, pass: 1, ...r, classes: byClass(r.bytes) })
          const s = (v) => v === null ? '    ?' : `${(v / 1000).toFixed(2)} s`
          console.log(`  press ${cache}            (from the press)      -    ${s(r.firstStep)}   ${s(r.standing)}    ${String(r.steps).padStart(3)}    ${s(r.longestStillMs)} from ${s(r.longestStillAt)}`)
        }
      }
      const file = flag('json', '')
      if (file) writeFileSync(String(file).replace('.json', `-${tier}${PHONE ? '-phone' : ''}${THROTTLE ? '-throttled' : ''}.json`),
        JSON.stringify(rows.map(r => ({ ...r, bytes: undefined })), null, 1))
      continue
    }
    const ctx = await browser.newContext({ viewport: VIEW })
    const page = await ctx.newPage()
    const noise = []
    if (WALK) {
      page.on('pageerror', e => noise.push(`PAGE ERROR ${e.message.slice(0, 90)}`))
      // The pace is the visitor's own, kept on the device: a walk measured at
      // the default says nothing about the one who set it faster.
      if (PACE) await page.addInitScript(pace => { try { localStorage.setItem('na-gait-pace', pace) } catch { /* a refused store walks at the default */ } }, PACE)
      await page.goto(`${BASE}/w/${WING}?probe=1&tier=${tier}`, { waitUntil: 'load' })
      const ids = await page.waitForFunction(() => {
        const s = window.__forge?.state?.()
        return s && s.phase === 'wing' && s.stationIds.length ? s.stationIds : null
      }, null, { timeout: 90000 }).then(h => h.jsonValue())
      await page.waitForFunction(n => document.body.innerText.includes(n), cardNumber(ids, ids[0]), { timeout: 90000 })
      const legs = []
      for (let i = 0; i + 1 < ids.length; i++) {
        await page.waitForFunction(() => window.__forge.state().texturesPending === 0, null, { timeout: 30000 }).catch(() => {})
        await page.waitForTimeout(SETTLE * 1000)
        const r = await sampleLeg(page, ids, ids[i + 1])
        legs.push({ from: ids[i], to: ids[i + 1], ...r })
        const b = r.leg
        console.log(`${tier.padEnd(9)}${`${ids[i]} to ${ids[i + 1]}`.padEnd(30)}` +
          (b ? `p95 ${String(b.p95).padStart(3)} max ${String(b.max).padStart(5)} over50 ${String(b.over50).padStart(2)}` : 'no frames') +
          `  arrive ${r.arrivedAt ?? 'never'}  ${r.firstUse ? JSON.stringify(r.firstUse.leg) : ''}` +
          (r.hitches.length ? `\n            ${r.hitches.join(' | ')}` : ''))
      }
      const worst = legs.reduce((m, l) => Math.max(m, l.leg?.max ?? 0), 0)
      const over = legs.reduce((n, l) => n + (l.leg?.over50 ?? 0), 0)
      console.log(`${tier}: ${legs.length} legs, worst frame ${worst} ms, ${over} frame(s) over 50 ms on a leg`)
      const file = flag('json', '')
      if (file) writeFileSync(String(file).replace('.json', `-${tier}.json`), JSON.stringify(legs, null, 1))
      console.log(`   console ${noise.filter(l => !/PostProcessing|uv" not found/.test(l)).slice(0, 6).join(' | ') || 'quiet'}`)
      await ctx.close()
      continue
    }
    page.on('console', m => { if (m.type() !== 'log' || /backend=/.test(m.text())) noise.push(m.text().slice(0, 110)) })
    page.on('pageerror', e => noise.push(`PAGE ERROR ${e.message.slice(0, 90)}`))
    {
      await page.goto(`${BASE}/w/${WING}?probe=1&tier=${tier}#s=${FROM}`, { waitUntil: 'load' })
      const ids = await page.waitForFunction(() => {
        const s = window.__forge?.state?.()
        return s && s.phase === 'wing' && s.stationIds.length ? s.stationIds : null
      }, null, { timeout: 90000 }).then(h => h.jsonValue())
      if (!ids.includes(FROM) || !ids.includes(TO)) throw new Error(`${WING} has no leg ${FROM} to ${TO}`)
      await page.waitForFunction(n => document.body.innerText.includes(n), cardNumber(ids, FROM), { timeout: 90000 })
      /* A STATION STILL LOADING IS NOT A LEG. Every set the room streams
         lands in a frame of its own, and a reading taken over them measures
         the arrival of a texture and calls it a walk. */
      const settled = await page.waitForFunction(() => window.__forge.state().texturesPending === 0, null, { timeout: 180000 })
        .then(() => true).catch(() => false)
      await page.waitForTimeout(SETTLE * 1000) // stand still, let the station settle
      const r = await sampleLeg(page, ids)
      console.log(`\n== ${WING} ${FROM} to ${TO}, tier ${tier}, ${VIEW.width}x${VIEW.height} ==`)
      const line = (b) => b ? `${b.frames} frames, mean ${b.mean}, p50 ${b.p50}, p95 ${b.p95}, max ${b.max} ms, over 50 ms: ${b.over50}, over 100 ms: ${b.over100}` : 'NO FRAMES AT ALL: the main thread never yielded in this band'
      if (!settled) console.log('   WARNING: sets were still pending when the leg was walked')
      console.log(`   idle   ${line(r.idle)}`)
      console.log(`   leg    ${line(r.leg)}`)
      console.log(`   after  ${line(r.after)}`)
      console.log(`   arrive ${r.arrivedAt === null ? `not within ${SECONDS} s` : r.arrivedAt + ' s'}`)
      console.log(`   hitches ${r.hitches.length ? r.hitches.join(' | ') : 'none over 50 ms'}`)
      if (r.firstUse) console.log(`   created on the leg ${JSON.stringify(r.firstUse.leg)}, after ${JSON.stringify(r.firstUse.after)}`)
    }
    console.log(`   console ${noise.filter(l => !/PostProcessing|uv" not found/.test(l)).slice(0, 6).join(' | ') || 'quiet'}`)
    await ctx.close()
  }
  await browser.close()
} finally {
  server?.kill('SIGTERM')
}
