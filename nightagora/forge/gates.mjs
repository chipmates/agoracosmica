// THE GATES, AS NUMBERS. Half of the quality bar's hard gates had no
// instrument: a gate with no number in the ledger is not a gate. This is the
// one that measures them and writes them down.
//
//   node forge/gates.mjs [port] [lobby | wing <slug>]
//   FORGE_PORT=5199 node forge/gates.mjs        (what the eyes call)
//
// It writes forge/gates.json and prints the same object on stdout, and
// nothing else: the eyes parse stdout from the first brace. Progress goes to
// stderr. It exits non-zero when any line failed, and the JSON says which.
//
// What it measures, per line of the bar:
//   backend        which adapter answered, and that it is not the CPU
//   tiers          draws, triangles, frame p50 and p95 over a ten second
//                  scripted walk, per tier, plus the phone on the calm tier
//   labels         the smallest interactive target, the persistent marks,
//                  the brand lines per frame
//   disclosures    the verbatim diff against the canon file
//   dependencies   the runtime diff against BASE-DEPS, gated by CANON-DEPS
//   manifest       the manifest check
//   honesty        the honesty check
//   register       the three registers of text: every visitor facing string
//                  of the label and the drawer, at every station, in both
//                  languages, refused when it carries a file path, a
//                  section code, a question id, an error bar, a measured
//                  range or a number nobody says aloud
//   cones          the look-cone corners shot, and where they are
//   leak           the key rigs and the scene's objects over 200 rebuilds
//   flicker        what the frame does BETWEEN frames: the temporal spread
//                  of every pixel over 30 consecutive frames at a held
//                  camera, with the film off and on, and a pop-in and
//                  shimmer reading over 120 held gazes across the cone
//
// A WING IS NOT A LOBBY WITH ONE STATION. In wing mode it walks the wing's
// own rail, addressing every station BY ID through the frame's API, and it
// adds the lines the lobby has no use for: every station reached, the cost
// of each station at each tier, the cone corners the round's sealed spec
// names, and the two halves of "no camera inside a wall" (the motion eye's
// intrusion count over a recorded walk at both tiers, and the wing's own
// offline camera clearance against its own triangles). The image's own
// A-B-A oscillation is measured beside them as a WARNING: a camera that
// travels past a near occluder makes the same signal as a blink, so that
// number is read by eye and never fails a run.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { arrive, steadyCost, warmScene } from './settle.mjs'
import {
  APP_ROOT,
  assertAdapter,
  assertBackend,
  assertServer,
  browserArgs,
  coneCorners,
  DEFAULT_CONE,
  headHere,
  TIERS,
  VIEWPORTS,
  waitForServer,
  wingStanding,
} from './rig.mjs'

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const PORT = Number(args[0] ?? process.env['FORGE_PORT'] ?? 5199)
const SURFACE = args[1] ?? process.env['FORGE_SURFACE'] ?? 'lobby'
const WING = SURFACE === 'wing'
const BASE = `http://localhost:${PORT}`
const WALK_MS = 10000
/** a station is stood at until its reading stops moving, never for a fixed
    wait: forge/settle.mjs holds the window and says how long it took. This
    is the cap, not the wait. */
const STATION_MS = 25000
const CONE_DIR = 'gates-cones'
/** a frame named for a corner of the look cone. The rig's own naming is
    `<viewport>-<tier>-<station>-c1..c4`; this is the OTHER spelling, the one
    a spec uses to say which corners a packet owes. A packet holding both is
    holding one station's corners twice. */
const CORNER_SPELLING = /-cone-(?:ul|ur|dl|dr)\.png$/i
/** no offline checker of a wing may hold the gate run longer than this */
const CHECKER_MS = 300000
/** the honesty walk stands at every station of both viewports and waits for
    the walker to complete each leg, so it runs in minutes rather than in a
    checker's five. Past this it is killed: a walk that stands is a gate that
    never ends. Its own guard gives up before this one does. */
const HONESTY_MS = 1800000
/** the register walk stands at every station of both viewports in both
    languages until the room is dressed, so it runs in the honesty walk's
    minutes and not in a checker's five. */
const REGISTER_MS = 1800000

/* THE SEALED SPEC, when this checkout is a round's app. It names the wing,
   and the cone corners the judge's packet is owed per station; a checkout
   with no round above it falls back to the default cone at every station.

   The folder above the app is a round only when the spec says it is: on a
   plain checkout that folder is the repository itself, and a file dropped
   there must never be able to decide what a gate run measures. */
function sealedSpec() {
  const here = resolve(APP_ROOT, '..')
  const path = join(here, 'spec.json')
  if (!existsSync(path)) return null
  try {
    const spec = JSON.parse(readFileSync(path, 'utf8'))
    if (spec?.round !== basename(here)) {
      process.stderr.write(`ignoring ${path}: it names round ${String(spec?.round)}, this app stands in ${basename(here)}\n`)
      return null
    }
    return spec
  } catch {
    return null
  }
}
const SPEC = sealedSpec()
const SLUG = WING ? (args[2] ?? SPEC?.wing ?? process.env['FORGE_SLUG'] ?? 'vinci') : ''
const SPEC_CONES = WING && SPEC?.coneCorners && typeof SPEC.coneCorners === 'object' ? SPEC.coneCorners : null

const say = (line) => process.stderr.write(`${line}\n`)
/** the retina reading walks to four stations and reads six frames at each */
const RETINA_MS = 900000
const lines = []
const gate = (name, ok, detail) => {
  lines.push({ name, ok, detail })
  say(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${typeof detail === 'string' ? detail : ''}`)
}
/* A LINE THAT IS MEASURED BUT NOT GATED. Some numbers are worth carrying in
   every report and cannot be a pass or a fail on their own: they need a
   pair of eyes. They are printed and written down like any other line, and
   they never decide the run. */
const warn = (name, ok, detail) => {
  lines.push({ name, ok, detail, gate: false })
  say(`${ok ? 'PASS' : 'WARN'}  ${name}  ${typeof detail === 'string' ? detail : ''}`)
}

/** what a wing's own checker refused on: its report's error codes when it
    answers JSON, and its last line of output when it does not */
function whyChecker(run) {
  const errors = run.parsed?.errors
  if (Array.isArray(errors) && errors.length)
    return errors.map((e) => `${e.code ?? 'error'}${e.id ? ` (${e.id})` : ''}`).join(', ')
  const said = run.raw.trim().split('\n').filter((l) => l && !/^[[\]{}\s"]/.test(l))
  return said.pop() ?? 'no output'
}

function json(cmd, argv, env = {}, ms = 0, echo = false) {
  return new Promise((done) => {
    const child = spawn(cmd, argv, {
      cwd: APP_ROOT,
      env: { ...process.env, ...env },
      // a checker that hangs may not take the whole gate run with it
      ...(ms ? { timeout: ms, killSignal: 'SIGKILL' } : {}),
    })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    // a checker's own lines are dropped: the gate says what it measured, not
    // how. A run of many minutes is the exception, its progress is carried
    // through, because a long step that stops has to have an address
    child.stderr.on('data', (d) => {
      if (echo) process.stderr.write(d)
    })
    child.on('close', (code) => {
      let parsed = null
      try {
        parsed = JSON.parse(out.slice(out.indexOf('{')))
      } catch {
        /* the caller reports a checker that did not answer JSON */
      }
      done({ code, parsed, raw: out.slice(-4000) })
    })
  })
}

// ------------------------------------------------------- the dependency floor
function dependencies() {
  const now = JSON.parse(readFileSync(join(APP_ROOT, 'package.json'), 'utf8'))
  const base = JSON.parse(readFileSync(join(APP_ROOT, 'forge', 'BASE-DEPS.json'), 'utf8'))
  const canon = JSON.parse(readFileSync(join(APP_ROOT, 'forge', 'CANON-DEPS.json'), 'utf8'))
  const mine = now.dependencies ?? {}
  const theirs = base.dependencies ?? {}
  const named = canon.dependencies ?? {}
  const added = Object.keys(mine).filter((k) => !(k in theirs))
  const removed = Object.keys(theirs).filter((k) => !(k in mine))
  const changed = Object.keys(mine).filter((k) => k in theirs && mine[k] !== theirs[k])
  // a runtime dependency reaches a visitor, so it needs a name and a reason;
  // a dev dependency reaches only this machine and is recorded, not gated
  const uncanonised = Object.keys(mine).filter((k) => !(k in named))
  return { base: base.base, added, removed, changed, uncanonised, runtime: Object.keys(mine) }
}

// ------------------------------------------------------------ the walk itself
async function walk(page, ms) {
  // the journey's own gesture: a hand that turns the gaze, then rests, over
  // and over, so the meter reads a moving frame and not a still one
  const until = Date.now() + ms
  const cx = Math.round((await page.viewportSize()).width / 2)
  const cy = Math.round((await page.viewportSize()).height / 2)
  while (Date.now() < until) {
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    for (let x = cx; x > cx - 220; x -= 22) {
      await page.mouse.move(x, cy - 40)
      await page.waitForTimeout(16)
    }
    await page.mouse.up()
    await page.waitForTimeout(420)
    await page.mouse.down()
    for (let x = cx - 220; x < cx + 220; x += 22) {
      await page.mouse.move(x, cy + 40)
      await page.waitForTimeout(16)
    }
    await page.mouse.up()
    await page.waitForTimeout(420)
  }
}

/** the wing's own address, so a measurement never carries the overture */
const pageUrl = (tier) => (WING ? `${BASE}/w/${SLUG}?tier=${tier}` : `${BASE}/?tier=${tier}`)

/* THE ENTRANCE SHEET IS NOT THE READING. A wing shows its welcome once per
   visit over its arrival frame, so every page that opens the wing's own
   address reads a modal dialog unless the flag the sheet itself keeps is set
   before the first navigation. */
async function shutTheWelcome(page) {
  if (!WING) return
  await page.addInitScript((flag) => {
    try {
      sessionStorage.setItem(flag, '1')
    } catch {
      /* a refused store already counts as seen */
    }
  }, `${SLUG}-welcome`)
}

async function stand(page) {
  if (!WING) {
    await page.evaluate(() => window.__forge.jump('agora', {}))
    return []
  }
  const ids = await page.evaluate(() => window.__forge.state().stationIds ?? [])
  return ids
}

async function measure(browser, tier, vp) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
  })
  let firstLine = ''
  /* which proof the wing's rail ran on. A walk that cannot prove its
     geometry does not walk, it places, and that is a silent loss of the
     museum's whole motion unless a line says so. */
  let railProof = ''
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.text().startsWith('backend=')) firstLine = m.text()
    if (m.text().startsWith('rail proof:')) railProof = m.text()
    if (m.type() === 'error') problems.push(`console: ${m.text()}`)
  })
  await shutTheWelcome(page)
  await page.goto(pageUrl(tier))
  await page.waitForFunction(() => Boolean(window.__forge))
  await page.waitForTimeout(1800)
  const stamp = await assertBackend(page)
  assertAdapter(firstLine, process.env['FORGE_BACKEND'] ?? 'webgpu')
  if (stamp.tier !== tier) throw new Error(`asked for tier=${tier}, the app stamped ${stamp.tier}`)
  if (WING && !(await wingStanding(page))) problems.push('the wing never stood: its entry field did not lift')

  // the walk happens where a hand may turn the gaze, which is the lobby's
  // one place for it; a wing walks its own rail, station by station
  const ids = await stand(page)
  /* THE FIRST SAMPLE IS NOT TAKEN ON A COLD SCENE. The courtyard has read
     183 draws and 1.5 M triangles seconds after a load and 71 once it
     stood, so the run stands at the first station until the count stops
     moving and keeps the cold reading beside it. */
  if (ids.length) await page.evaluate((s) => window.__forge.station?.(s), ids[0])
  const warm = await warmScene(page, { ms: STATION_MS })

  /* EVERY STATION, AT THIS TIER. A wing whose last room is cheap and whose
     third is not has no honest single number, so each station is stood at
     for the meter's own window and read, and the tier's line is the worst
     of them. */
  const stations = {}
  const missed = []
  for (const id of ids) {
    const took = await page.evaluate((s) => window.__forge.station?.(s) ?? false, id)
    const at = await page.evaluate(() => window.__forge.state().stationId)
    if (!took || at !== id || !(await arrive(page, id))) {
      missed.push(`${id} (standing at ${at || 'nowhere'})`)
      continue
    }
    stations[id] = await steadyCost(page, { ms: STATION_MS })
  }
  if (ids.length) {
    const last = ids[ids.length - 1]
    await page.evaluate((s) => window.__forge.station?.(s), last)
    await page.waitForTimeout(600)
  }

  await walk(page, WALK_MS)
  // the gaze rests where the walk left it, and the reading is taken there
  // once it stands: a number read mid-drag is the frame the sample landed on
  const walked = await steadyCost(page, { ms: 12000 })
  const adapter = /adapter=(\S+)/.exec(firstLine)?.[1] ?? 'unknown'
  await page.close()
  // the tier's reading is the worst the surface reaches, walk included
  const readings = [walked, ...Object.values(stations)]
  const worst = {
    ...walked,
    draws: Math.max(...readings.map((r) => r.draws)),
    triangles: Math.max(...readings.map((r) => r.triangles)),
    textureMB: Math.max(...readings.map((r) => r.textureMB)),
    frameMB: Math.max(...readings.map((r) => r.frameMB)),
    frameMsP95: Math.max(...readings.map((r) => r.frameMsP95)),
  }
  /* THE FRAMES THAT COST MORE THAN THE ROOM. A pass that runs every few
     frames (a shadow cascade re-render is the known one) is reported on its
     own line instead of being folded into a count that a budget holds. */
  const refresh = readings
    .map((r) => r.settled?.refresh ?? { frames: 0, draws: 0 })
    .reduce((a, b) => (b.draws > a.draws ? b : a), { frames: 0, draws: 0 })
  const unsteady = Object.entries(stations)
    .filter(([, c]) => c.steady?.held === false)
    .map(([id]) => id)
  return { tier, viewport: vp.tag, adapter, backend: stamp.backend, cost: worst, walk: walked, warm, refresh, unsteady, stations, missed, problems, ids, railProof }
}

/** one tier, said in full: the settled numbers, what the scene cost before
    it stood, and the frames that cost more than the room */
function costLine(name, r) {
  return (
    `  ${name.padEnd(10)} ${r.cost.draws} draws  ${r.cost.triangles} tris  ${r.cost.frameMB} MB frame  ` +
    `${r.cost.textureMB} MB texture  p50 ${r.cost.frameMsP50} ms  p95 ${r.cost.frameMsP95} ms` +
    `\n             cold ${r.warm.cold.draws} draws / ${r.warm.cold.triangles} tris, steady after ` +
    `${(r.warm.ms / 1000).toFixed(1)} s${r.warm.warmed ? '' : ' (NEVER STEADY)'}` +
    `  |  refresh ${r.refresh.frames} frame(s) +${r.refresh.draws} draws` +
    (r.unsteady.length ? `  |  still moving at: ${r.unsteady.join(', ')}` : '')
  )
}

/* THE LOOK CONE, PER STATION. A wing is judged on its four corners at every
   station the sealed spec names, so the count is the spec's and not the
   rig's own idea of a surface. */
function conePlan(ids) {
  if (!WING) return [{ key: 'agora', state: 'agora', opts: {}, corners: 4 }, { key: 'wheel', state: 'wheel', opts: { chapter: 0 }, corners: 4 }]
  const named = SPEC_CONES ? Object.keys(SPEC_CONES) : ids
  return named.map((id) => ({
    key: id,
    station: id,
    corners: SPEC_CONES ? (SPEC_CONES[id]?.length ?? 4) : 4,
  }))
}

async function cones(browser, ids) {
  const dir = join(APP_ROOT, 'forge', 'shots', CONE_DIR)
  mkdirSync(dir, { recursive: true })
  const page = await browser.newPage({ viewport: { width: 1512, height: 950 } })
  await shutTheWelcome(page)
  await page.goto(pageUrl('hero'))
  await page.waitForFunction(() => Boolean(window.__forge))
  await page.waitForTimeout(1800)
  if (WING) await wingStanding(page)
  const plan = conePlan(ids)
  const missing = []
  let shot = 0
  for (const spot of plan) {
    if (spot.station !== undefined) {
      const took = await page.evaluate((s) => window.__forge.station?.(s) ?? false, spot.station)
      if (!took) {
        missing.push(`${spot.station}: the frame would not stand at this station`)
        continue
      }
    } else {
      await page.evaluate(([p, o]) => {
        window.__forge.freeze(12.4)
        window.__forge.jump(p, o)
      }, [spot.state, spot.opts])
    }
    await page.waitForTimeout(1700)
    for (const c of coneCorners(DEFAULT_CONE)) {
      await page.evaluate(([y, p]) => window.__forge.look(y, p), [c.yaw, c.pitch])
      await page.waitForTimeout(420)
      await page.screenshot({ path: join(dir, `desktop-hero-${spot.key}-c${c.n}.png`) })
      shot++
    }
    await page.evaluate(() => window.__forge.look(0, 0))
  }
  await page.close()
  const expected = plan.reduce((n, s) => n + s.corners, 0)
  /* THE PACKET IS NOT THIS RIG'S TO FILL. `final/` is the judge's set and
     the finalize path writes it; the gates' corners are their own
     measurement under their own name in their own folder. A packet that
     holds corners under a SECOND spelling holds two sets for one station,
     so the count is read here rather than found by a hand moving frames
     aside on the night of a judging. */
  const packetDir = join(APP_ROOT, 'forge', 'shots', 'final')
  const spelled = existsSync(packetDir)
    ? readdirSync(packetDir).filter((f) => CORNER_SPELLING.test(f))
    : []
  return {
    shot,
    expected,
    states: plan.map((s) => s.key),
    cone: DEFAULT_CONE,
    dir: `forge/shots/${CONE_DIR}`,
    missing,
    packet: { dir: 'forge/shots/final', spelled: spelled.length, names: spelled.slice(0, 8) },
  }
}

/* THE LEAK COUNTER. A wing rebuilds its key at every station it re-stages,
   so the stack's own list and the scene's object count are read before and
   after two hundred of those rebuilds. A rig that is only pushed shows here
   as 201 rigs and a thousand objects long before it shows in a frame. */
const LEAK_JUMPS = 200
async function leak(browser) {
  const page = await browser.newPage({ viewport: { width: 1512, height: 950 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await shutTheWelcome(page)
  await page.goto(pageUrl('hero'))
  await page.waitForFunction(() => Boolean(window.__forge))
  await page.waitForTimeout(1800)
  // an app that predates these two hooks reports the line as unmeasured
  // rather than taking the whole gate run down with a TypeError
  const has = await page.evaluate(
    () => typeof window.__forge.lights === 'function' && typeof window.__forge.relight === 'function'
  )
  if (!has) {
    await page.close()
    return { jumps: LEAK_JUMPS, unavailable: true, errors }
  }
  const before = await page.evaluate(() => window.__forge.lights())
  const after = await page.evaluate((n) => {
    let last = null
    for (let i = 0; i < n; i++) last = window.__forge.relight()
    return last
  }, LEAK_JUMPS)
  await page.waitForTimeout(600)
  const settled = await page.evaluate(() => window.__forge.lights())
  await page.close()
  return { jumps: LEAK_JUMPS, before, after, settled, errors }
}

/* THE MOTION EYE. It brings its own preview server, so it runs after this
   one is down and the port has answered nothing for a moment. */
async function freePort(ms = 20000) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    try {
      await fetch(BASE, { signal: AbortSignal.timeout(600) })
    } catch {
      return true
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  return false
}

// ------------------------------------------------------------------- the run
say(`gates: ${WING ? `wing/${SLUG}` : SURFACE} on port ${PORT}`)

const deps = dependencies()
gate(
  'dependencies',
  deps.uncanonised.length === 0 && deps.changed.length === 0,
  deps.uncanonised.length
    ? `not in the canon: ${deps.uncanonised.join(', ')}`
    : deps.changed.length
      ? `version moved: ${deps.changed.join(', ')}`
      : `${deps.runtime.length} runtime, all named`
)

const manifest = await json('node', ['forge/manifest-check.mjs', '--json'])
const mf = manifest.parsed
// the check spares a clone with no store, the gate does not: this arm always
// has the store, so a missing one is a silenced gate and not a spared build
const storeHere = Boolean(mf) && mf.store !== null
gate(
  'manifest',
  manifest.code === 0 && storeHere,
  !mf ? 'no JSON from the check'
    : !storeHere ? 'the asset store is not on this machine'
    : `${mf.assets} assets, ${mf.openRecords.length} open record(s)` +
      (mf.appAssets ? `, ${mf.appAssets} recorded in the app` : '')
)

let tiers = {}
let coneReport = { shot: 0, expected: 0, states: [], dir: `forge/shots/${CONE_DIR}`, missing: [], packet: null }
let backend = { ok: false }
let leakReport = null
let stationIds = []
let stationCost = {}
const missedStations = []
const walkProblems = []
/* THE GATE READS THE BUNDLE, NOT THE CHECKOUT. `pnpm preview` serves dist/,
   and the whoami check compares the checkout's HEAD with its own, which is
   the same number on both sides: a bundle built before the last source change
   is measured in silence, and every number of such a run belongs to another
   build. */
const newestUnder = (path) =>
  !existsSync(path) ? 0
  : statSync(path).isDirectory()
    ? readdirSync(path).reduce((newest, name) => Math.max(newest, newestUnder(join(path, name))), 0)
    : statSync(path).mtimeMs
const bundleAt = newestUnder(join(APP_ROOT, 'dist'))
const sourceAt = Math.max(
  newestUnder(join(APP_ROOT, 'src')),
  newestUnder(join(APP_ROOT, 'assets')),
  newestUnder(join(APP_ROOT, 'index.html'))
)
const clock = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
if (!bundleAt || sourceAt > bundleAt) {
  say(`FAIL  the bundle  ${bundleAt
    ? `the bundle is older than the source (dist ${clock(bundleAt)}, source ${clock(sourceAt)})`
    : 'there is no dist'}: run pnpm build, then this gate`)
  process.exit(1)
}
const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', cwd: APP_ROOT })
try {
  await waitForServer(BASE)
  const said = await assertServer(BASE)
  say(`server ${said.head.slice(0, 7)}`)
  const browser = await chromium.launch({ args: browserArgs() })
  for (const tier of TIERS) {
    const r = await measure(browser, tier, VIEWPORTS.desktop)
    tiers[tier] = r
    walkProblems.push(...r.problems.map((p) => `${tier}: ${p}`))
    missedStations.push(...r.missed.map((m) => `${tier}: ${m}`))
    if (r.ids.length > stationIds.length) stationIds = r.ids
    for (const [id, c] of Object.entries(r.stations)) {
      stationCost[id] = { ...(stationCost[id] ?? {}), [tier]: c }
    }
    say(costLine(tier, r))
  }
  // the public gate names the phone, and the phone runs the calm tier
  const phone = await measure(browser, 'calm', VIEWPORTS.mobile)
  tiers['calm-phone'] = phone
  walkProblems.push(...phone.problems.map((p) => `calm-phone: ${p}`))
  missedStations.push(...phone.missed.map((m) => `calm-phone: ${m}`))
  for (const [id, c] of Object.entries(phone.stations)) {
    stationCost[id] = { ...(stationCost[id] ?? {}), 'calm-phone': c }
  }
  say(costLine('calm-phone', phone))
  backend = { backend: phone.backend, adapter: phone.adapter, ok: !/swiftshader|lavapipe|llvmpipe|software/i.test(phone.adapter) }
  coneReport = await cones(browser, stationIds)
  leakReport = await leak(browser)
  await browser.close()
} catch (err) {
  walkProblems.push(`RIG REFUSED: ${err.message}`)
} finally {
  server.kill()
}

gate('backend', backend.ok === true, `${backend.backend ?? 'none'} on ${backend.adapter ?? 'none'}`)
const overBudget = []
for (const [name, r] of Object.entries(tiers)) {
  const b = r.cost.budget
  if (r.cost.draws > b.draws) overBudget.push(`${name}: ${r.cost.draws} draws over ${b.draws}`)
  if (r.cost.triangles > b.triangles) overBudget.push(`${name}: ${r.cost.triangles} tris over ${b.triangles}`)
  if (r.cost.textureMB > b.textureMB) overBudget.push(`${name}: ${r.cost.textureMB} MB of texture over ${b.textureMB}`)
  if (r.cost.frameMB > b.frameMB) overBudget.push(`${name}: ${r.cost.frameMB} MB of frame over ${b.frameMB}`)
}
gate('tier budgets', overBudget.length === 0 && Object.keys(tiers).length === 4, overBudget.join('; ') || `${Object.keys(tiers).length} readings`)

// ------------------------------------------------------- what only a wing has
let motion = null
let wingChecks = null
if (WING) {
  /* THE PROOF THE WALK RAN ON. The rail only walks a certified path, so a
     proof that did not resolve turns every leg into a jump with nothing on
     screen to say why. The wing says which proof carried it, once, and the
     line carries that sentence. */
  const proofs = [...new Set(Object.values(tiers).map((r) => r.railProof).filter(Boolean))]
  gate(
    'the rail\'s proof',
    proofs.length === 1 && !proofs[0].includes('none'),
    proofs.join(' | ') || 'the wing said nothing about which proof ran'
  )
  gate(
    'every station stood at',
    stationIds.length > 0 && missedStations.length === 0,
    missedStations.length ? missedStations.join('; ') : `${stationIds.length} station(s), every one reached by id at 4 readings`
  )
  const perStation = []
  for (const [id, byTier] of Object.entries(stationCost)) {
    for (const [tier, c] of Object.entries(byTier)) {
      const b = c.budget
      if (c.draws > b.draws) perStation.push(`${id} at ${tier}: ${c.draws} draws over ${b.draws}`)
      if (c.triangles > b.triangles) perStation.push(`${id} at ${tier}: ${c.triangles} tris over ${b.triangles}`)
      if (c.textureMB > b.textureMB) perStation.push(`${id} at ${tier}: ${c.textureMB} MB of texture over ${b.textureMB}`)
      if (c.frameMB > b.frameMB) perStation.push(`${id} at ${tier}: ${c.frameMB} MB of frame over ${b.frameMB}`)
    }
  }
  const readings = Object.values(stationCost).reduce((n, byTier) => n + Object.keys(byTier).length, 0)
  gate(
    'station budgets',
    perStation.length === 0 && readings === stationIds.length * 4,
    perStation.join('; ') || `${readings} readings over ${stationIds.length} station(s) at 4 tiers`
  )
}

gate('walk clean', walkProblems.length === 0, walkProblems.join('; ') || 'no console or page error over the walk')
gate(
  'key light leak',
  Boolean(leakReport) &&
    !leakReport.unavailable &&
    leakReport.settled.rigs === leakReport.before.rigs &&
    leakReport.settled.sceneObjects === leakReport.before.sceneObjects &&
    leakReport.errors.length === 0,
  !leakReport
    ? 'the leak counter never ran'
    : leakReport.unavailable
      ? 'this app has no lights() or relight() hook: the line is not instrumented here'
      : leakReport.errors.length
        ? leakReport.errors.slice(0, 2).join('; ')
        : `${leakReport.before.rigs} rig(s) and ${leakReport.before.sceneObjects} objects, unchanged over ${leakReport.jumps} rebuilds` +
          (leakReport.settled.rigs === leakReport.before.rigs ? '' : ` -> ${leakReport.settled.rigs} rig(s), ${leakReport.settled.sceneObjects} objects`)
)
gate(
  'cone corners',
  coneReport.shot === coneReport.expected && coneReport.missing.length === 0,
  coneReport.missing.length
    ? coneReport.missing.join('; ')
    : `${coneReport.shot} of ${coneReport.expected} shot into ${coneReport.dir}` +
      (SPEC_CONES ? ' (the count the sealed spec names)' : '') +
      (coneReport.packet?.spelled
        ? `; the judge packet holds ${coneReport.packet.spelled} frame(s) spelled -cone-ul/ur/dl/dr, which is a second set of corners beside its own`
        : '')
)

if (WING) {
  const runs = [
    { name: 'desktop/hero', out: 'gates-motion', env: {} },
    { name: 'phone/calm', out: 'gates-motion-calm', env: { MOTION_VP: 'mobile', MOTION_TIER: 'calm' } },
  ]
  motion = { readings: {} }
  for (const r of runs) {
    // each reading brings its own preview server, so the port has to have
    // gone quiet again before the next one asks for it
    if (!(await freePort())) {
      motion.readings[r.name] = { ok: false, error: `port ${PORT} never freed, the motion eye was not run` }
      continue
    }
    say(`  the motion eye at ${r.name}, on its own server`)
    const scan = await json('node', ['forge/motion-scan.mjs', SLUG, r.out, '--json'], { FORGE_PORT: String(PORT), ...r.env })
    motion.readings[r.name] = scan.parsed ?? { ok: false, error: 'the motion eye did not answer JSON', raw: scan.raw }
  }
  const readings = Object.entries(motion.readings)
  const said = (r, k) => (typeof r[k] === 'number' ? r[k] : null)
  const intrusions = readings.reduce((n, [, r]) => n + (said(r, 'intrusions') ?? 1), 0)
  const clusters = readings.reduce((n, [, r]) => n + (said(r, 'clusters') ?? 0), 0)
  const walked = readings.reduce((n, [, r]) => n + (said(r, 'walkFrames') ?? 0), 0)
  const broke = readings.filter(([, r]) => r.ok !== true && !(r.intrusions > 0))
  motion.intrusions = intrusions
  motion.clusters = clusters
  motion.walkFrames = walked
  /* THE GATE IS "NO CAMERA INSIDE A WALL", so it is measured on what the
     frames can show: a picture that stopped being a place. An oscillation
     of the image is not that (a camera travelling past a near occluder
     makes the same signal), and it is a warning below. */
  gate(
    'camera intrusion',
    intrusions === 0 && broke.length === 0,
    broke.length
      ? broke.map(([n, r]) => `${n}: ${(r.flags ?? [r.error]).join('; ')}`).join(' | ')
      : `${intrusions} over ${walked} frames of the walk at ${readings.length} reading(s), closest ` +
        readings.map(([n, r]) => `${n} ${r.closest?.margin ?? '?'}x`).join(', ')
  )
  /* THE WING'S OWN CHECKERS ARE PART OF THE GATE. A wing proves things no
     rig can see from outside (its own provenance, its own geometry, its own
     rail) with programs it ships beside its code. They were run by hand
     after a merge, which means they were run when someone remembered. Every
     `*-check.mjs` in the wing's folder is run here, and its exit code is a
     gate line. */
  const wingDir = join('src', 'wings', SLUG)
  // a wing that carries a story layer owes the story law its check as well
  const checkers = existsSync(join(APP_ROOT, wingDir))
    ? [
        ...readdirSync(join(APP_ROOT, wingDir)).filter((f) => f.endsWith('-check.mjs')).sort(),
        'tiles-check.mjs',
        'lines-check.mjs',
        ...(existsSync(join(APP_ROOT, wingDir, 'story.ts')) ? ['story-check.mjs'] : []),
      ]
    : []
  const ran = {}
  for (const f of checkers) {
    say(`  the wing's own ${f}, offline`)
    // A check whose subject is cut in the forge lives in the forge, and is
    // a line of this gate all the same.
    ran[f] = await json('node', [join(existsSync(join(APP_ROOT, wingDir, f)) ? wingDir : 'forge', f)], {}, CHECKER_MS)
  }
  if (checkers.length) {
    const broke = checkers.filter((f) => ran[f].code !== 0)
    wingChecks = { exits: Object.fromEntries(checkers.map((f) => [f, ran[f].code])) }
    gate(
      'the wing\'s own checkers',
      broke.length === 0,
      broke.length
        ? broke.map((f) => `${f} exited ${ran[f].code}: ${whyChecker(ran[f])}`).join(' | ')
        : `${checkers.length} offline checker(s), every one exit 0: ${checkers.join(', ')}`
    )
  }
  /* the geometric half of "no camera inside a wall": whether the camera ever
     STOOD inside a wall is a question about triangles, not about pixels, and
     the wing's own geometry checker answers it over the whole rail */
  if (ran['geometry-check.mjs']) {
    const run = ran['geometry-check.mjs']
    const g = run.parsed
    const rail = g?.rail ?? {}
    const clears =
      run.code === 0 &&
      (g?.errors?.length ?? 1) === 0 &&
      rail.intersectingSampleChords === 0 &&
      rail.shellClearanceLowerBoundM >= rail.shellThresholdM &&
      rail.minimumGradeClearanceM >= rail.terrainThresholdM
    // the checker's own report carries every pose and path it sampled; the
    // gates keep the numbers, not the 15,000 samples behind them
    const { poses, paths, ...railNumbers } = rail
    wingChecks.clearance = g ? { errors: g.errors, rail: railNumbers, notes: g.notes } : { error: run.raw }
    gate(
      'camera clearance',
      clears,
      !g ? 'the wing\'s checker did not answer JSON'
        : (g.errors?.length ?? 0) ? g.errors.map((e) => e.code).join('; ')
        : `${rail.totalCameraSamples} camera samples, ${rail.intersectingSampleChords} chord(s) through the shell, ` +
          `clear of it by ${rail.shellClearanceLowerBoundM} m and of the ground by ${(rail.minimumGradeClearanceM ?? 0).toFixed(2)} m`
    )
  }
  warn(
    'motion A-B-A',
    clusters === 0,
    readings
      .map(([n, r]) => `${n}: ${said(r, 'frames') ?? 0} frames, ${said(r, 'flagged') ?? 0} flagged, ${said(r, 'clusters') ?? '?'} cluster(s)`)
      .join(' | ') + (clusters ? '. Read them by eye: this line never fails a run' : '')
  )
}

/* THE FLICKER GATE. Its own instrument, on its own preview server, so it
   runs like the motion eye does: after this one is down and the port has
   gone quiet. On a wing it reads the stations the sealed spec names corners
   for, and its own first, middle and last when no round stands above the
   app; on the lobby, the two states a visitor stands and looks around in. */
let flicker = null
{
  const stations = SPEC_CONES ? Object.keys(SPEC_CONES) : []
  if (!(await freePort())) {
    flicker = { ok: false, error: `port ${PORT} never freed, the flicker gate was not run` }
  } else {
    say('  the flicker gate, on its own server')
    const run = await json(
      'node',
      ['forge/flicker.mjs', String(PORT), SURFACE, ...(SLUG ? [SLUG] : []), ...(stations.length ? ['--stations', stations.join(',')] : [])],
      { FORGE_PORT: String(PORT) }
    )
    flicker = run.parsed ?? { ok: false, error: 'the flicker gate did not answer JSON', raw: run.raw }
  }
}
{
  const read = flicker?.stations ?? []
  const said = read
    .map((r) =>
      r.error
        ? `${r.station}: ${r.error}`
        : `${r.station} ${r.state} ${(r.static.filmOff.unstableShare * 100).toFixed(3)} percent, ` +
          `longest ${r.static.filmOff.longestRegionPx} px, ${r.drag.popEvents} pop(s), ` +
          `shimmer ${(r.drag.shimmerShare * 100).toFixed(3)} percent`
    )
    .join(' | ')
  const detail = flicker?.error ? flicker.error : said || 'no station was read'
  /* A STATION DECLARED ALIVE WARNS, IT DOES NOT FAIL (forge/FLICKER-BASE.json
     carries the names and the reasons). Everything else is a hard gate. */
  if (flicker?.state === 'WARN') warn('flicker', false, detail)
  else gate('flicker', flicker?.state === 'PASS', detail)
}

/* AND THE SAME STATIONS AT THE RATIO THE VISITOR HAS. Every instrument
   above shoots the desktop at a device ratio of one, where the backend
   keeps four samples of the scene pass; a retina screen has ratio two,
   where it keeps one, and the same edge then steps several times as far.
   This line reads the step in levels at that ratio and prints it beside
   the ratio-one reading. It is measured and never decides a run. */
let retina = null
if (SURFACE === 'wing' && SLUG) {
  if (!(await freePort())) {
    retina = { error: `port ${PORT} never freed, the retina reading was not taken` }
  } else {
    say("  the stability ratchet, at the visitor's device ratio")
    const run = await json(
      'node',
      ['forge/stability-audit.mjs', String(PORT), SLUG, '--json', '--dpr', '2', '--no-maps', '--rotate', '4', '--verify'],
      {},
      RETINA_MS
    )
    retina = run.parsed ?? { error: 'the stability audit did not answer JSON', raw: run.raw }
  }
}
{
  const poses = retina?.poses ?? []
  const said = poses
    .map((p) => `${p.name.replace(/^station /, '')} step ${p.edgeJump} levels, class 1/2/3 ${p.perMpx['1']}/${p.perMpx['2']}/${p.perMpx['3']} per million`)
    .join(' | ')
  const stage = retina?.samples
    ? `ratio ${retina.samples.pixelRatio}, ${retina.samples.allocated} sample(s) allocated of ${retina.samples.asked} asked`
    : 'the stage was not read'
  const r = retina?.ratchet
  const verdict = r
    ? r.ok
      ? `RATCHET ok against ${String(r.base).slice(0, 7)}`
      : `RATCHET RED: ${[...r.newClass1Pairs.map((n) => `new class 1 pair ${n}`), ...r.newClass2Bodies.map((n) => `new class 2 body ${n}`), ...r.risenSteps.map((n) => `step risen at ${n}`)].join('; ')}`
    : 'the ratchet did not run'
  /* A GATE, NOT A WARNING. The counts are read and never compared; what
     decides the run is the SET of bodies the classes name and the step in
     levels at a boundary, both of which repeat. A seat that improves a
     station writes the baseline again in the same commit, by its own flag. */
  gate('retina flicker', Boolean(poses.length && !retina?.error && r?.ok),
    retina?.error ? retina.error : `${verdict} | ${stage} | ${said || 'no pose was read'}`)
}

/* THE HONESTY WALK, THE STATIONS ONLY. Opening every close look reads ten
   times the labels and takes about forty minutes, which no gate run can
   carry, so `--looks` is the card walk's own run and is not asked for here. */
say('  the honesty walk, station by station')
const honestyArgs = ['forge/honesty-check.mjs', String(PORT), SURFACE, ...(SLUG ? [SLUG] : []), '--json']
const honesty = await json('node', honestyArgs, {}, HONESTY_MS, true)
const h = honesty.parsed ?? { stations: [], failures: ['the honesty check did not answer JSON'], labels: 0 }
gate(
  'honesty',
  honesty.code === 0 && (h.failures?.length ?? 1) === 0,
  `${h.labels ?? 0} labels over ${h.stations?.length ?? 0} reading(s), ${h.walked ?? 'stations only'}, ${h.failures?.length ?? '?'} failure(s)`
)

// what the honesty walk measured, said as the bar says it
const allLabels = (h.stations ?? []).flatMap((s) => s.labels)
const targets = allLabels.filter((l) => l.targetPx !== null).map((l) => l.targetPx)
const perStation = (h.stations ?? []).map((s) => ({
  station: s.station,
  labels: s.labels.length,
  claims: s.labels.filter((l) => l.certainty).length,
  brand: s.labels.filter((l) => l.brand).length,
  persistent: s.labels.filter((l) => l.persistent).length,
  smallestTargetPx: s.labels.filter((l) => l.targetPx !== null).length
    ? Math.min(...s.labels.filter((l) => l.targetPx !== null).map((l) => l.targetPx))
    : null,
}))
const labels = {
  stations: perStation,
  smallestTargetPx: targets.length ? Math.min(...targets) : null,
  brandLinesMax: perStation.length ? Math.max(...perStation.map((s) => s.brand)) : 0,
  persistentMax: perStation.length ? Math.max(...perStation.map((s) => s.persistent)) : 0,
}
gate('44 px targets', labels.smallestTargetPx === null || labels.smallestTargetPx >= 44, `smallest ${labels.smallestTargetPx ?? 'none'} px`)
gate('one brand line', labels.brandLinesMax <= 1, `max ${labels.brandLinesMax} per frame`)
gate('three persistent marks', labels.persistentMax <= 3, `max ${labels.persistentMax} per frame`)
if (WING) {
  // a wing is walked at both viewports, so every station owes two rows
  const want = stationIds.length * Object.keys(VIEWPORTS).length
  const unread = stationIds.filter((id) => !perStation.some((s) => s.station.endsWith(`/${id}`)))
  gate(
    'labels read at every station',
    unread.length === 0 && perStation.length === want,
    unread.length ? `no label reading at: ${unread.join(', ')}` : `${perStation.length} station readings over ${stationIds.length} station(s), both viewports`
  )
}

const drift = (h.failures ?? []).filter((f) => f.includes('disclosure'))
gate('disclosures verbatim', drift.length === 0, drift.join('; ') || 'every layer matches the canon file')

/* THE REGISTER GATE. Its own instrument on its own dev server, so the port
   the honesty walk just released has to answer nothing first. */
let register = null
if (!(await freePort())) {
  register = { ok: false, errors: [`port ${PORT} never freed, the register gate was not run`], offences: [] }
} else {
  say('  the register gate, on its own server')
  const run = await json('node', ['forge/register-check.mjs', String(PORT), SURFACE, ...(SLUG ? [SLUG] : []), '--json'], {}, REGISTER_MS, true)
  register = run.parsed ?? { ok: false, errors: ['the register check did not answer JSON'], offences: [], raw: run.raw }
}
gate(
  'register',
  register.ok === true,
  register.errors?.length
    ? register.errors.join('; ')
    : `${register.offences?.length ?? '?'} string(s) refused of ${(register.read?.label ?? 0) + (register.read?.drawer ?? 0)} read` +
      // the check's own WARN, carried here because a checker's stderr is
      // swallowed: a count under the floor is a string that stopped rendering
      (register.count && register.count.ok === false
        ? `; WARN count under the floor (${register.count.read} read, floor ${register.count.floor})` +
          (register.count.short?.length ? `, short at ${register.count.short.slice(0, 4).map((x) => x.id).join(', ')}` : '')
        : '')
)

const failed = lines.filter((l) => l.gate !== false && !l.ok).map((l) => l.name)
const warned = lines.filter((l) => l.gate === false && !l.ok).map((l) => l.name)
const report = {
  surface: WING ? `wing/${SLUG}` : SURFACE,
  head: headHere(),
  backend,
  tiers,
  ...(WING ? { stations: { ids: stationIds, cost: stationCost, missed: missedStations }, motion, wingChecks } : {}),
  labels,
  disclosures: { drift },
  dependencies: deps,
  manifest: manifest.parsed ?? { error: manifest.raw },
  honesty: { ok: (h.failures?.length ?? 1) === 0, labels: h.labels ?? 0, failures: h.failures ?? [] },
  register,
  cones: coneReport,
  leak: leakReport,
  flicker,
  retina,
  gates: lines,
  ok: failed.length === 0,
  failed,
  warned,
}
writeFileSync(join(APP_ROOT, 'forge', 'gates.json'), JSON.stringify(report, null, 2) + '\n')
process.stdout.write(JSON.stringify(report, null, 2) + '\n')
process.exitCode = failed.length ? 1 : 0
