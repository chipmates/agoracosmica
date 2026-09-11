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
//   cones          the look-cone corners shot, and where they are
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
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
} from './rig.mjs'

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const PORT = Number(args[0] ?? process.env['FORGE_PORT'] ?? 5199)
const SURFACE = args[1] ?? 'lobby'
const SLUG = SURFACE === 'wing' ? (args[2] ?? 'vinci') : ''
const BASE = `http://localhost:${PORT}`
const WALK_MS = 10000
const CONE_DIR = 'gates-cones'
const CONE_STATES = SURFACE === 'wing' ? [['wing', { slug: SLUG }]] : [['agora', {}], ['wheel', { chapter: 0 }]]

const say = (line) => process.stderr.write(`${line}\n`)
const lines = []
const gate = (name, ok, detail) => {
  lines.push({ name, ok, detail })
  say(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${typeof detail === 'string' ? detail : ''}`)
}

function json(cmd, argv) {
  return new Promise((done) => {
    const child = spawn(cmd, argv, { cwd: APP_ROOT })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', () => {})
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

async function measure(browser, tier, vp) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
  })
  let firstLine = ''
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.text().startsWith('backend=')) firstLine = m.text()
    if (m.type() === 'error') problems.push(`console: ${m.text()}`)
  })
  await page.goto(`${BASE}/?tier=${tier}`)
  await page.waitForFunction(() => Boolean(window.__forge))
  await page.waitForTimeout(1800)
  const stamp = await assertBackend(page)
  assertAdapter(firstLine, process.env['FORGE_BACKEND'] ?? 'webgpu')
  if (stamp.tier !== tier) throw new Error(`asked for tier=${tier}, the app stamped ${stamp.tier}`)

  // the walk happens where a hand may turn the gaze, which is the lobby's
  // one place for it; a wing walks its own rail
  if (SURFACE === 'wing') await page.evaluate((s) => window.__forge.jump('wing', { slug: s }), SLUG)
  else await page.evaluate(() => window.__forge.jump('agora', {}))
  await page.waitForTimeout(1600)
  await walk(page, WALK_MS)
  const cost = await page.evaluate(() => window.__forge.cost())
  const adapter = /adapter=(\S+)/.exec(firstLine)?.[1] ?? 'unknown'
  await page.close()
  return { tier, viewport: vp.tag, adapter, backend: stamp.backend, cost, problems }
}

async function cones(browser) {
  const dir = join(APP_ROOT, 'forge', 'shots', CONE_DIR)
  mkdirSync(dir, { recursive: true })
  const page = await browser.newPage({ viewport: { width: 1512, height: 950 } })
  await page.goto(`${BASE}/?tier=hero`)
  await page.waitForFunction(() => Boolean(window.__forge))
  await page.waitForTimeout(1800)
  let shot = 0
  for (const [state, opts] of CONE_STATES) {
    await page.evaluate(([p, o]) => {
      window.__forge.freeze(12.4)
      window.__forge.jump(p, o)
    }, [state, opts])
    await page.waitForTimeout(1700)
    for (const c of coneCorners(DEFAULT_CONE)) {
      await page.evaluate(([y, p]) => window.__forge.look(y, p), [c.yaw, c.pitch])
      await page.waitForTimeout(420)
      await page.screenshot({ path: join(dir, `desktop-hero-${state}-c${c.n}.png`) })
      shot++
    }
    await page.evaluate(() => window.__forge.look(0, 0))
  }
  await page.close()
  return { shot, states: CONE_STATES.map(([s]) => s), cone: DEFAULT_CONE, dir: `forge/shots/${CONE_DIR}` }
}

// ------------------------------------------------------------------- the run
say(`gates: ${SURFACE === 'wing' ? `wing/${SLUG}` : SURFACE} on port ${PORT}`)

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
    : `${mf.assets} assets, ${mf.openRecords.length} open record(s)`
)

let tiers = {}
let coneReport = { shot: 0, states: [], dir: `forge/shots/${CONE_DIR}` }
let backend = { ok: false }
const walkProblems = []
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
    say(`  ${tier.padEnd(9)} ${r.cost.draws} draws  ${r.cost.triangles} tris  ${r.cost.frameMB} MB  p50 ${r.cost.frameMsP50} ms  p95 ${r.cost.frameMsP95} ms`)
  }
  // the public gate names the phone, and the phone runs the calm tier
  const phone = await measure(browser, 'calm', VIEWPORTS.mobile)
  tiers['calm-phone'] = phone
  walkProblems.push(...phone.problems.map((p) => `calm-phone: ${p}`))
  say(`  ${'calm-phone'.padEnd(9)} ${phone.cost.draws} draws  ${phone.cost.triangles} tris  ${phone.cost.frameMB} MB  p50 ${phone.cost.frameMsP50} ms  p95 ${phone.cost.frameMsP95} ms`)
  backend = { backend: phone.backend, adapter: phone.adapter, ok: !/swiftshader|lavapipe|llvmpipe|software/i.test(phone.adapter) }
  coneReport = await cones(browser)
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
gate('walk clean', walkProblems.length === 0, walkProblems.join('; ') || 'no console or page error over the walk')
gate('cone corners', coneReport.shot === CONE_STATES.length * 4, `${coneReport.shot} shot into ${coneReport.dir}`)

const honestyArgs = ['forge/honesty-check.mjs', String(PORT), SURFACE, ...(SLUG ? [SLUG] : []), '--json']
const honesty = await json('node', honestyArgs)
const h = honesty.parsed ?? { stations: [], failures: ['the honesty check did not answer JSON'], labels: 0 }
gate('honesty', honesty.code === 0 && (h.failures?.length ?? 1) === 0, `${h.labels ?? 0} labels, ${h.failures?.length ?? '?'} failure(s)`)

// what the honesty walk measured, said as the bar says it
const allLabels = (h.stations ?? []).flatMap((s) => s.labels)
const targets = allLabels.filter((l) => l.targetPx !== null).map((l) => l.targetPx)
const perStation = (h.stations ?? []).map((s) => ({
  station: s.station,
  labels: s.labels.length,
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

const drift = (h.failures ?? []).filter((f) => f.includes('disclosure'))
gate('disclosures verbatim', drift.length === 0, drift.join('; ') || 'every layer matches the canon file')

const failed = lines.filter((l) => !l.ok).map((l) => l.name)
const report = {
  surface: SURFACE === 'wing' ? `wing/${SLUG}` : SURFACE,
  head: headHere(),
  backend,
  tiers,
  labels,
  disclosures: { drift },
  dependencies: deps,
  manifest: manifest.parsed ?? { error: manifest.raw },
  honesty: { ok: (h.failures?.length ?? 1) === 0, labels: h.labels ?? 0, failures: h.failures ?? [] },
  cones: coneReport,
  gates: lines,
  ok: failed.length === 0,
  failed,
}
writeFileSync(join(APP_ROOT, 'forge', 'gates.json'), JSON.stringify(report, null, 2) + '\n')
process.stdout.write(JSON.stringify(report, null, 2) + '\n')
process.exitCode = failed.length ? 1 : 0
