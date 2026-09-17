// THE COST OF A FRAME — what each stage of the night asks of a GPU, at each
// of the three tiers, in the two numbers that cannot be argued with (draw
// calls and triangles), the memory the frame's own buffers hold (which is
// where MSAA is paid for), and the two that must be read with care (the
// interval between presented frames, and what the CPU spent submitting one).
//
// Usage:  pnpm build && node forge/cost.mjs [--strict] [--tier=hero]
//   --strict  exit non-zero when a tier is over its own budget
//
// WING MODE, the per-object reading:
//   node forge/cost.mjs --wing=vinci [--tier=standard,calm] [--phone]
//        [--stations=picture-room,body] [--rows=14] [--serve=off] [--json=out.json]
// stands at every station of the wing, settles it, and says WHOSE the cost
// is: the draws and triangles by body and by pass (the stack's ledger), and
// the texture line owner by owner. `--phone` reads the calm tier at the
// phone's viewport, which is the gate's calm-phone line.
//
// Every reading is a SETTLED one: forge/settle.mjs stands at the stage until
// the count stops moving and reports the count that repeats, with the frames
// that cost more than it on their own column (`refresh`).
//   FORGE_PORT   which port to run the preview on (default 5199)
//   FORGE_FPS    also fail on the frame interval (off by default: the rig
//                renders offscreen and headless, where nothing is locked to
//                a display, so the interval is a throughput bound and not
//                the owner's frame rate)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { arrive, steadyCost, warmScene } from './settle.mjs'
import {
  APP_ROOT,
  assertAdapter,
  assertBackend,
  assertServer,
  browserArgs,
  FRAME_TIME_FLAGS,
  TIERS,
  VIEWPORTS,
  waitForServer,
} from './rig.mjs'

const PORT = Number(process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://localhost:${PORT}`
const STRICT = process.argv.includes('--strict')
const FPS_STRICT = process.env['FORGE_FPS'] === '1'
/** how long a stage is given to stop moving before its reading is taken
    anyway, and the run says it never settled */
const SETTLE_CAP = 25000
const only = process.argv.find((a) => a.startsWith('--tier='))?.split('=')[1]
const tiers = only ? only.split(',') : TIERS
const named = (flag) => process.argv.find((a) => a.startsWith(`--${flag}=`))?.slice(flag.length + 3)
const WING = named('wing')
const SERVE = named('serve') !== 'off'

if (WING) {
  await wingCost()
  process.exit(process.exitCode ?? 0)
}

/** one wing, station by station, with the cost said owner by owner */
async function wingCost() {
  const PHONE = process.argv.includes('--phone')
  const ROWS = Number(named('rows') ?? 14)
  const onlyStations = named('stations')?.split(',')
  const wingTiers = PHONE ? ['calm'] : only ? only.split(',') : TIERS
  const vp = PHONE ? VIEWPORTS.mobile : VIEWPORTS.desktop
  const server = SERVE
    ? spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', cwd: APP_ROOT })
    : null
  const out = { wing: WING, viewport: vp.tag, tiers: {} }
  try {
    await waitForServer(BASE)
    const said = await assertServer(BASE)
    console.log(`server ${said.head.slice(0, 7)}  wing ${WING}  ${vp.tag}`)
    const browser = await chromium.launch({ args: [...browserArgs(), ...FRAME_TIME_FLAGS] })
    for (const tier of wingTiers) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
      })
      await page.goto(`${BASE}/w/${WING}?probe=1&tier=${tier}`)
      await page.waitForFunction(() => Boolean(window.__forge && window.__naStack), null, { timeout: 90000 })
      const ids = await page
        .waitForFunction(() => {
          const s = window.__forge.state()
          return s.phase === 'wing' && s.stationIds.length ? s.stationIds : null
        }, null, { timeout: 90000 })
        .then((h) => h.jsonValue())
      await page.evaluate((s) => window.__forge.station(s), ids[0])
      await arrive(page, ids[0])
      const warm = await warmScene(page, { ms: SETTLE_CAP })
      const label = PHONE ? 'calm-phone' : tier
      console.log(`\n== ${label} == cold ${warm.cold.draws} / ${warm.cold.triangles}, steady ${warm.warm.draws} / ${warm.warm.triangles}`)
      const rows = {}
      for (const id of ids) {
        if (onlyStations && !onlyStations.includes(id)) continue
        const took = await page.evaluate((s) => window.__forge.station?.(s) ?? false, id)
        if (!took || !(await arrive(page, id))) { console.log(`${id}: the frame would not stand here`); continue }
        const c = await steadyCost(page, { ms: SETTLE_CAP })
        const ledger = await page.evaluate((n) => window.__naStack.ledger.tally(n), 20)
        const textures = await page.evaluate(() => window.__naStack.textures())
        const residency = await page.evaluate(() => window.__naStack.ledger.residency())
        const byPass = {}
        for (const r of ledger) byPass[r.pass] = (byPass[r.pass] ?? 0) + r.draws
        rows[id] = { draws: c.draws, triangles: c.triangles, textureMB: c.textureMB, first: c.steady.first,
          refresh: c.settled.refresh, held: c.steady.held, byPass, ledger, textures, residency }
        console.log(`\n${id}: ${c.draws} draws / ${c.triangles} tris / ${c.textureMB} MB` +
          `  (first ${c.steady.first.draws} / ${c.steady.first.triangles}, refresh ${c.settled.refresh.frames}f+${c.settled.refresh.draws})` +
          `  over ${c.budget.draws} / ${c.budget.triangles} / ${c.budget.textureMB}: ` +
          `${c.draws > c.budget.draws ? 'DRAWS ' : ''}${c.triangles > c.budget.triangles ? 'TRIS ' : ''}${c.textureMB > c.budget.textureMB ? 'TEXTURE' : ''}`)
        console.log(`   passes  ${Object.entries(byPass).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' | ')}`)
        for (const r of ledger.slice(0, ROWS))
          console.log(`   ${r.draws.toFixed(1).padStart(6)} draws ${String(r.triangles).padStart(8)} tris  ${r.pass.padEnd(22)} ${r.owner}`)
        console.log(`   texture ${textures.filter((t) => t.MB >= 1).map((t) => `${t.owner} ${t.MB}`).join(' | ')}`)
        const onDevice = residency.reduce((a, t) => a + t.MB, 0)
        console.log(`   on the device ${onDevice.toFixed(1)} MB in ${residency.length} textures; largest ` +
          residency.slice(0, 8).map((t) => `${t.name} ${t.width}x${t.height} ${t.format} ${t.MB.toFixed(1)}`).join(' | '))
      }
      out.tiers[label] = rows
      await page.close()
    }
    await browser.close()
    const file = named('json')
    if (file) writeFileSync(file, JSON.stringify(out, null, 1))
  } catch (err) {
    console.error(`RIG REFUSED: ${err.message}`)
    process.exitCode = 1
  } finally {
    server?.kill()
  }
}

// the stages of the museum's path, in the order a visitor meets them
const STAGES = [
  ['held', 'held', {}],
  ['descent', 'descent', { desc: 0.5 }],
  ['agora', 'agora', {}],
  ['wheel', 'wheel', { chapter: 0 }],
  ['pane', 'pane', { slug: 'vinci' }],
  ['breath', 'breath', {}],
  ['wing', 'wing', { slug: 'vinci' }],
]

const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const failures = []
try {
  await waitForServer(BASE)
  const said = await assertServer(BASE)
  console.log(`server ${said.head.slice(0, 7)} at ${said.root}\n`)

  const browser = await chromium.launch({ args: browserArgs() })
  for (const tier of tiers) {
    const page = await browser.newPage({ viewport: { width: 1512, height: 950 } })
    let line = ''
    page.on('console', (m) => {
      if (m.text().startsWith('backend=')) line = m.text()
    })
    await page.goto(`${BASE}/?tier=${tier}`)
    await page.waitForFunction(() => Boolean(window.__forge))
    await page.waitForTimeout(1800)
    const stamp = await assertBackend(page)
    assertAdapter(line, process.env['FORGE_BACKEND'] ?? 'webgpu')
    if (stamp.tier !== tier) throw new Error(`asked for tier=${tier}, the app stamped ${stamp.tier}`)

    // no stage is read on a cold scene: the first one is stood at until the
    // count stops moving, and what it cost cold is printed beside it
    const warm = await warmScene(page, { ms: SETTLE_CAP })
    console.log(
      `warm up: ${warm.warmed ? `steady after ${(warm.ms / 1000).toFixed(1)} s` : `NEVER STEADY in ${(warm.ms / 1000).toFixed(1)} s`}` +
        `, cold ${warm.cold.draws} draws / ${warm.cold.triangles} tris, steady ${warm.warm.draws} / ${warm.warm.triangles}`
    )
    const budget = await page.evaluate(() => window.__forge.cost().budget)
    console.log(
      `${tier.toUpperCase()}  budget ${budget.draws} draws / ` +
        `${(budget.triangles / 1e6).toFixed(1)}M tris / ${budget.fps} fps / ` +
        `${budget.frameMB} MB of frame / ${budget.textureMB} MB of texture`
    )
    console.log(
      `${'stage'.padEnd(10)}${'draws'.padStart(7)}${'tris'.padStart(10)}` +
        `${'frameMB'.padStart(9)}${'texMB'.padStart(8)}` +
        `${'frame p50'.padStart(11)}${'p95'.padStart(8)}${'cpu p50'.padStart(9)}${'p95'.padStart(8)}` +
        `${'settled'.padStart(9)}${'refresh'.padStart(10)}`
    )
    for (const [name, phase, opts] of STAGES) {
      await page.evaluate(([p, o]) => window.__forge.jump(p, o), [phase, opts])
      for (let i = 0; i < 60; i++) {
        if (await page.evaluate((p) => document.body.dataset.forge === p, phase)) break
        await page.waitForTimeout(80)
      }
      // the reading is taken when the stage stops moving, not after a fixed
      // wait: a stage sampled while it is still shedding work reports the
      // frame the sample landed on
      await page.waitForTimeout(600)
      await page.evaluate(() => window.__forge.tier(document.body.dataset.tier))
      const c = await steadyCost(page, { ms: SETTLE_CAP })
      console.log(
        `${name.padEnd(10)}${String(c.draws).padStart(7)}${String(c.triangles).padStart(10)}` +
          `${c.frameMB.toFixed(1).padStart(9)}${c.textureMB.toFixed(1).padStart(8)}` +
          `${c.frameMsP50.toFixed(1).padStart(11)}${c.frameMsP95.toFixed(1).padStart(8)}` +
          `${c.cpuMsP50.toFixed(1).padStart(9)}${c.cpuMsP95.toFixed(1).padStart(8)}` +
          `${`${(c.steady.ms / 1000).toFixed(1)}s${c.steady.held ? '' : '!'}`.padStart(9)}` +
          `${`${c.settled.refresh.frames}f+${c.settled.refresh.draws}`.padStart(10)}`
      )
      if (c.draws > budget.draws) failures.push(`${tier}/${name}: ${c.draws} draws over ${budget.draws}`)
      if (c.triangles > budget.triangles)
        failures.push(`${tier}/${name}: ${c.triangles} triangles over ${budget.triangles}`)
      if (c.textureMB > budget.textureMB)
        failures.push(`${tier}/${name}: ${c.textureMB} MB of texture over ${budget.textureMB}`)
      // MSAA is paid for here and nowhere else, so this is the line that has
      // to hold when a tier's sample count moves
      if (c.frameMB > budget.frameMB)
        failures.push(`${tier}/${name}: ${c.frameMB} MB of frame buffers over ${budget.frameMB}`)
      if (FPS_STRICT && c.frameMsP95 > 1000 / budget.fps)
        failures.push(`${tier}/${name}: p95 ${c.frameMsP95} ms over ${(1000 / budget.fps).toFixed(1)}`)
    }
    console.log('')
    await page.close()
  }
  await browser.close()

  if (failures.length) {
    console.log('OVER BUDGET:')
    for (const f of failures) console.log(' ·', f)
    if (STRICT) process.exitCode = 1
  } else {
    console.log('every tier inside its budget')
  }
} catch (err) {
  console.error(`RIG REFUSED: ${err.message}`)
  process.exitCode = 1
} finally {
  server.kill()
}
