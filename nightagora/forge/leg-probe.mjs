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
const SECONDS = Number(flag('seconds', 30))
const SETTLE = Number(flag('settle', 6))
const VIEW = { width: Number(flag('width', 1440)), height: Number(flag('height', 900)) }
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

/** the entry as the visitor waits it out: the gold field is lit from the
    press and struck on the wing's first frame, so its own life IS the wait */
async function timeEntry(page, how) {
  return page.evaluate(async (how) => {
    const struck = () => {
      const gold = document.getElementById('goldbreath')
      return gold !== null && !gold.classList.contains('lit')
    }
    let t0 = performance.now()
    if (how === 'press') {
      // the module boots on its own time; the press is not a press until the
      // page can take one
      for (let i = 0; i < 600 && window.__forge === undefined; i++) await new Promise(r => setTimeout(r, 20))
      window.__forge.jump('pane', { slug: 'vinci' })
      for (let i = 0; i < 400 && !document.querySelector('.pane-enter:not([hidden])'); i++) await new Promise(r => setTimeout(r, 20))
      // the press is the moment the wait starts, not the page load
      t0 = performance.now()
      document.querySelector('.pane-enter').click()
    }
    // the field's own line is the warm up's count of frames paid for, so the
    // moment it first opens splits the wait into the part that is the wing
    // arriving and the part that is the walk being paid for
    let warm = null
    for (let i = 0; i < 6000; i++) {
      const line = document.querySelector('#goldbreath .dark-line')
      if (warm === null && line instanceof HTMLElement && /scaleX\(0\.[0-9]/.test(line.style.transform))
        warm = performance.now() - t0
      if (document.body.dataset['phase'] === 'wing' && struck())
        return { total: Math.round(performance.now() - t0) / 1000, warm: warm === null ? null : Math.round(warm) / 1000 }
      await new Promise(r => setTimeout(r, 16))
    }
    return null
  }, how)
}

/** one entry, in a context of its own, so two wings never share a GPU */
async function oneEntry(browser, url, how, again) {
  const ctx = await browser.newContext({ viewport: VIEW })
  const page = await ctx.newPage()
  try {
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
      const press = await oneEntry(browser, `${BASE}/?probe=1&tier=${tier}`, 'press', true)
      const link = await oneEntry(browser, `${BASE}/w/${WING}?probe=1&tier=${tier}`, 'link', true)
      const say = (r) => r === null ? 'never' : `${r.total} s (the wing arriving ${r.warm ?? '?'} s, then the warm up)`
      console.log(`== ${tier} == the press in the lobby: cold ${say(press.cold)}, warm cache ${say(press.warm)}`)
      console.log(`            the deep link: cold ${say(link.cold)}, warm cache ${say(link.warm)}`)
      continue
    }
    const ctx = await browser.newContext({ viewport: VIEW })
    const page = await ctx.newPage()
    const noise = []
    if (WALK) {
      page.on('pageerror', e => noise.push(`PAGE ERROR ${e.message.slice(0, 90)}`))
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
