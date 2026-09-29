// THE PRESS AT THE PICTURE WALL WALKS. From the angel, with 0, 1 and 2 steps
// along the hang first, the gold to the Lisa, the gold to the west end and the
// way back must each start a walk within 1.5 s and end on the stop they name,
// on the desktop (1440 by 900) and on the phone (390 by 844). It reads only
// the page (the walking mark on #wing and the band's count), so it needs no
// probe and holds against any rewrite of the wing's insides.
//
//   node forge/wall-press-check.mjs [port]            (else FORGE_PORT, else 5199)
//   node forge/wall-press-check.mjs 5479 --viewports=phone --steps=1,1,5 --out=<report file>
//
// WHY IT EXISTS. A step along the hang leaves the eye at a work. A gold
// pressed from there ran the wall to the Lisa and left the rail's return flag
// standing, so every press after it was kept for a return that never came.
// In the case of one step the check goes on: a step from the Lisa must land
// and stay (a flag left standing walks the eye back by itself), and the gold
// and the way back must walk again from a stepped eye.
//
// It shoots a running server of this checkout and starts none.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertServer, browserArgs, waitForServer, wingStanding } from './rig.mjs'

const args = process.argv.slice(2)
const positional = args.filter((a) => !a.startsWith('--'))
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const PORT = Number(positional[0] ?? process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://localhost:${PORT}`
const ONLY_VIEWPORTS = flag('viewports')?.split(',') ?? null
const STEPS = (flag('steps') ?? '0,1,2').split(',').map(Number)
const OUT = flag('out') ? resolve(flag('out')) : null

const VIEWPORTS = [
  {
    tag: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1,
    gold: '.desk-low .desk-on', back: '.desk-low .desk-back', count: '.desk-cap .desk-count',
    step: (page) => page.keyboard.press('ArrowRight'),
  },
  {
    tag: 'phone', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    gold: '.film-gold', back: '.film-back', count: '.film-count',
    step: (page) => page.click('.vinci-phone-step-on'),
  },
]

/** a press that starts no walk in this long was not taken */
const BEGINS_MS = 1_500
const WING_MS = 300_000
const DRESSED_MS = 60_000
/** the longest walk of the picture wall, angel to Lisa, with room to spare */
const REST_MS = 90_000
/** a walk that starts again in this long after it landed was not over */
const SETTLE_MS = 800
const RUN_MS = 20 * 60_000

const failures = []
const cases = []
const started = Date.now()
let where = 'the rig'
let browser = null
let finished = false

const clock = setTimeout(() => {
  failures.push(`the run passed its ${RUN_MS / 60_000} minute clock, standing at ${where}`)
  finish(1)
}, RUN_MS)

function finish(code) {
  if (finished) return
  finished = true
  clearTimeout(clock)
  const ok = code === 0 && failures.length === 0
  const report = { ok, port: PORT, steps: STEPS, minutes: Math.round((Date.now() - started) / 6000) / 10, failures, cases }
  if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 1))
  console.log(JSON.stringify(report, null, 1))
  const close = browser ? browser.close().catch(() => {}) : Promise.resolve()
  void close.then(() => process.exit(ok ? 0 : 1))
}

/** THE WALKING MARK, COUNTED. The frame writes it on #wing for the length of
    a leg, so a walk is one on-edge of it. The press time is the event's own,
    read in the capture phase before any handler runs. */
function installWatch() {
  const state = (window.__wallPress = { edges: [], walking: false, pressAt: 0 })
  const wing = document.getElementById('wing')
  new MutationObserver(() => {
    const now = wing.hasAttribute('data-walking')
    if (now && !state.walking) state.edges.push(performance.now())
    state.walking = now
  }).observe(wing, { attributes: true, attributeFilter: ['data-walking'] })
  const pressed = () => { state.pressAt = performance.now() }
  document.addEventListener('click', pressed, true)
  document.addEventListener('keydown', pressed, true)
}

const countOf = (page, vp) => page.evaluate((sel) => {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(document.querySelector(sel)?.textContent ?? '')
  return m ? Number(m[1]) : null
}, vp.count)

/** At rest: no leg and no dip, held for a moment so a walk that follows the
    landing at once would show. */
async function atRest(page) {
  const still = () => page
    .waitForFunction(() => !document.querySelector('#wing[data-walking]') && !document.querySelector('#wing[data-cut]'),
      null, { timeout: REST_MS, polling: 100 })
    .then(() => true)
    .catch(() => false)
  if (!(await still())) return false
  await page.waitForTimeout(SETTLE_MS)
  return still()
}

/** One press, and what it did: whether a walk began within BEGINS_MS of the
    press itself, how many walks the press made in all, and where the eye
    stands once it rests. */
async function press(page, vp, act) {
  const before = await page.evaluate(() => window.__wallPress.edges.length)
  await page.evaluate(() => document.activeElement?.blur?.())
  await act()
  await page.waitForFunction(([seen, limit]) => window.__wallPress.edges.length > seen || performance.now() - window.__wallPress.pressAt > limit,
    [before, BEGINS_MS], { timeout: BEGINS_MS + 10_000, polling: 50 }).catch(() => {})
  const beganMs = await page.evaluate((seen) => {
    const s = window.__wallPress
    return s.edges.length > seen ? Math.round(s.edges[seen] - s.pressAt) : null
  }, before)
  const rested = await atRest(page)
  const walks = (await page.evaluate(() => window.__wallPress.edges.length)) - before
  return { began: beganMs !== null && beganMs <= BEGINS_MS, beganMs, rested, walks, at: await countOf(page, vp) }
}

/** the expectation of one press, and the words of a failure */
function expect(label, got, at, tag) {
  const said = []
  if (!got.began) said.push('no walk began within 1.5 s')
  if (!got.rested) said.push('the walk never came to rest')
  if (got.began && got.walks !== 1) said.push(`${got.walks} walks, one expected`)
  if (got.at !== at) said.push(`the count reads ${got.at}, ${at} expected`)
  if (said.length) failures.push(`${tag} ${label}: ${said.join(', ')}`)
  return { label, ok: said.length === 0, ...got, ...(said.length ? { said } : {}) }
}

/** The eye at the angel and at rest: the page as it opened, or a jump to it. */
async function stand(page, vp, stops, tag, fresh) {
  if (!fresh) {
    await page.evaluate(() => window.__forge.jump('wing', { slug: 'vinci', station: 'picture-room' }))
    await page.waitForFunction(() => document.body.dataset.forge === 'wing' && window.__forge.state().stationId === 'picture-room',
      null, { timeout: 60_000, polling: 100 })
  }
  const rested = await atRest(page)
  const at = await countOf(page, vp)
  if (rested && at === stops.angel + 1) return true
  failures.push(`${tag} stand: the eye is not at rest at the angel (count ${at}, rested ${rested})`)
  return false
}

async function walkCase(page, vp, stops, count, tail, fresh) {
  const tag = `${vp.tag} ${count} step${count === 1 ? '' : 's'}`
  where = tag
  process.stderr.write(`  ${tag}\n`)
  const phases = []
  cases.push({ viewport: vp.tag, steps: count, phases })
  if (!(await stand(page, vp, stops, tag, fresh))) return
  const asks = {
    step: () => vp.step(page),
    gold: () => page.click(vp.gold),
    back: () => page.click(vp.back),
  }
  const [angel, lisa, west] = [stops.angel + 1, stops.lisa + 1, stops.west + 1]
  for (let i = 1; i <= count; i++) phases.push(expect(`step ${i}`, await press(page, vp, asks.step), angel, tag))
  phases.push(expect('gold to the Lisa', await press(page, vp, asks.gold), lisa, tag))
  phases.push(expect('gold to the west end', await press(page, vp, asks.gold), west, tag))
  phases.push(expect('the way back', await press(page, vp, asks.back), lisa, tag))
  if (!tail) return
  // from the Lisa a step lands at the next work and the eye stays there
  phases.push(expect('a step from the Lisa', await press(page, vp, asks.step), lisa, tag))
  phases.push(expect('gold from a step', await press(page, vp, asks.gold), west, tag))
  phases.push(expect('the way back again', await press(page, vp, asks.back), lisa, tag))
}

async function walkViewport(vp) {
  where = `${vp.tag} entry`
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor,
    ...(vp.isMobile ? { isMobile: true, hasTouch: true } : {}),
  })
  await context.addInitScript(() => {
    try { localStorage.setItem('agc_probe', '1'); sessionStorage.setItem('vinci-welcome', '1') } catch { /* private mode */ }
  })
  await context.route(/agoracosmica\.org|cloudflare|google/, (r) => r.abort())
  const page = await context.newPage()
  page.on('pageerror', (e) => failures.push(`${vp.tag}: page error: ${e.message}`))
  await page.goto(`${BASE}/w/vinci?lang=en#s=picture-room`, { waitUntil: 'domcontentloaded' })
  if (!(await wingStanding(page, WING_MS))) {
    failures.push(`${vp.tag}: the wing never stood`)
    await context.close()
    return
  }
  await page.waitForFunction(() => (window.__forge?.state?.().texturesPending ?? 1) === 0, null, { timeout: DRESSED_MS, polling: 250 }).catch(() => {})
  await page.evaluate(installWatch)
  const ids = await page.evaluate(() => window.__forge.state().stationIds)
  const stops = { angel: ids.indexOf('picture-room'), lisa: ids.indexOf('picture-room-lisa'), west: ids.indexOf('picture-room-west') }
  if (stops.angel < 0 || stops.lisa !== stops.angel + 1 || stops.west !== stops.lisa + 1) {
    failures.push(`${vp.tag}: the walk no longer runs from the angel to the Lisa to the west end (${JSON.stringify(stops)})`)
    await context.close()
    return
  }
  const tailAt = STEPS.includes(1) ? 1 : STEPS.find((n) => n > 0)
  let fresh = true
  for (const count of STEPS) {
    await walkCase(page, vp, stops, count, count === tailAt, fresh)
    fresh = false
  }
  await context.close()
}

async function main() {
  await waitForServer(BASE, 40)
  await assertServer(BASE)
  browser = await chromium.launch({ args: browserArgs() })
  for (const vp of VIEWPORTS) {
    if (ONLY_VIEWPORTS && !ONLY_VIEWPORTS.includes(vp.tag)) continue
    await walkViewport(vp)
  }
  finish(0)
}

main().catch((err) => {
  failures.push(`the check stopped at ${where}: ${err.message}`)
  finish(1)
})
