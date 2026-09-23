#!/usr/bin/env node
// THE COUNT THE STILLS WAIT ON — does it come to rest at zero at every stop,
// and does it still see a texture that never comes.
//
//   pnpm build && FORGE_PORT=5441 node forge/prerender/pending-check.mjs
//   FORGE_PORT=5441 node forge/prerender/pending-check.mjs --order=life --framing=wide
//   FORGE_PORT=5441 node forge/prerender/pending-check.mjs --serve=off   (a preview already up)
//
// Three runs on the exporter's own stages, address and wait (`pending.mjs`):
//   · every stop of the wing, in each framing: the resting count must be 0
//     and no failure may be named
//   · one library set held on the wire forever: the resting count must stay
//     above 0, at the entry and at a stop
//   · the same set refused: the count must still come to rest at 0 and the
//     set must be named in `textureErrors` (a failure settles, it never hangs)
//
// Exit 1 on any refusal. Needs the GPU, like the exporter.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { APP_ROOT, assertServer, browserArgs, waitForServer, wingStanding } from '../rig.mjs'
import { installVirtualClock } from './clock.mjs'
import { restingPending } from './pending.mjs'

const flags = new Map()
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue
  const at = a.indexOf('=')
  flags.set(at === -1 ? a.slice(2) : a.slice(2, at), at === -1 ? true : a.slice(at + 1))
}
const flag = (n, d) => flags.get(n) ?? d

const PORT = Number(flag('port', process.env['FORGE_PORT'] ?? 5363))
const BASE = `http://127.0.0.1:${PORT}`
const WING = String(flag('wing', 'vinci'))
const ORDER = String(flag('order', 'rooms'))
const TIER = String(flag('tier', 'hero'))
const SAMPLES = String(flag('samples', '4'))
const WANT = String(flag('framing', 'upright,wide')).split(',').map((s) => s.trim()).filter(Boolean)
/** a set the walk asks for at entry and no machine is built from, so the
    planted runs test the library's count and nothing else */
const PLANT = String(flag('plant', 'grass-short'))
const PLANT_STOP = String(flag('plant-stop', 'garden'))
const PLANTED = flag('planted', 'on') !== 'off'

/** the stills exporter's two stages (`stills.mjs`, FRAMINGS) */
const STAGES = {
  upright: { viewport: { width: 780, height: 1688 }, dsf: 1.5 },
  wide: { viewport: { width: 1600, height: 900 }, dsf: 1.5 },
}

const address = (from) =>
  `${BASE}/w/${WING}?probe=1&tier=${TIER}&samples=${SAMPLES}${ORDER === 'life' ? '&order=life' : ''}#s=${from}`

const refusals = []
const refuse = (where, what) => refusals.push({ where, what })
const read = (page) =>
  page.evaluate(() => {
    const st = window.__forge.state()
    return { pending: st.texturesPending, errors: st.textureErrors ?? [] }
  })

/** the exporter's `openStage`, with an optional hand on one set's requests */
async function open(browser, stage, plant) {
  const ctx = await browser.newContext({ viewport: stage.viewport, deviceScaleFactor: stage.dsf })
  await ctx.addInitScript((f) => {
    try {
      sessionStorage.setItem(f, '1')
    } catch {
      /* a refused store already counts as seen */
    }
  }, `${WING}-welcome`)
  await ctx.addInitScript(installVirtualClock)
  const hits = []
  if (plant) {
    await ctx.route(`**/na-assets/library/${PLANT}/**`, (route) => {
      hits.push(route.request().url().replace(BASE, ''))
      /* held: neither answered nor refused, for the life of the page */
      if (plant === 'hold') return
      return route.fulfill({ status: 404, body: 'planted' })
    })
  }
  const page = await ctx.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 160)))
  const began = Date.now()
  await page.goto(address(0), { waitUntil: 'load' })
  if (!(await wingStanding(page))) throw new Error('the wing never stood')
  const entry = await restingPending(page)
  const backend = await page.evaluate(() => document.body.dataset.backend)
  if (backend !== 'webgpu') throw new Error(`backend ${backend}, not webgpu`)
  return { ctx, page, hits, pageErrors, entry, stoodIn: Math.round((Date.now() - began) / 100) / 10 }
}

/** stand at a stop by cutting, as the exporter's warm pass does, and wait */
async function restAt(page, id) {
  await page.evaluate(() => {
    document.body.dataset['forge'] = 'pending'
  })
  await page.evaluate((s) => window.__forge.station(s), id)
  await page.waitForFunction(
    (s) => window.__forge.state().stationId === s && !document.querySelector('[data-walking]'),
    id,
    { timeout: 180000 }
  )
  const began = Date.now()
  const pending = await restingPending(page)
  return { pending, waited: Math.round((Date.now() - began) / 100) / 10, ...(await read(page)) }
}

async function everyStop(browser, name) {
  const { ctx, page, pageErrors, entry, stoodIn } = await open(browser, STAGES[name])
  const stops = await page.evaluate(() => window.__forge.state().stationIds)
  const rows = []
  if (entry !== 0) refuse(`${name}/entry`, `the count rests at ${entry}`)
  for (const id of stops) {
    const at = await restAt(page, id)
    rows.push({ stop: id, pending: at.pending, waited: at.waited, errors: at.errors })
    if (at.pending !== 0) refuse(`${name}/${id}`, `the count rests at ${at.pending}`)
    if (at.errors.length) refuse(`${name}/${id}`, `failures named: ${at.errors.join(' | ')}`)
    console.error(`   ${name} ${id.padEnd(20)} rests at ${at.pending} after ${at.waited} s${at.errors.length ? `, ${at.errors.length} failure(s)` : ''}`)
  }
  for (const e of pageErrors) refuse(`${name}/page`, e)
  await ctx.close()
  return { framing: name, stoodIn, entry, stops: rows }
}

async function planted(browser, how) {
  const name = WANT.includes('wide') ? 'wide' : WANT[0]
  const { ctx, page, hits, entry, stoodIn } = await open(browser, STAGES[name], how)
  const at = await restAt(page, PLANT_STOP)
  const named = at.errors.filter((e) => e.includes(`library/${PLANT}`))
  const out = { plant: `library/${PLANT}`, how, framing: name, stoodIn, requestsHeld: hits.length, entry, stop: PLANT_STOP, atStop: at.pending, named }
  const where = `planted ${how}`
  if (!hits.length) refuse(where, `the walk never asked for library/${PLANT}: the plant proves nothing`)
  if (how === 'hold') {
    if (entry <= 0) refuse(where, `a set held on the wire, and the count rests at ${entry} at the entry`)
    if (at.pending <= 0) refuse(where, `a set held on the wire, and the count rests at ${at.pending} at ${PLANT_STOP}`)
  } else {
    if (at.pending !== 0) refuse(where, `a refused set hangs the count at ${at.pending}`)
    if (!named.length) refuse(where, `a refused set is not named in textureErrors: ${at.errors.join(' | ') || 'none'}`)
  }
  console.error(`   ${where}: ${hits.length} request(s) of ${PLANT}, entry rests at ${entry}, ${PLANT_STOP} at ${at.pending}${named.length ? `, named: ${named[0]}` : ''}`)
  await ctx.close()
  return out
}

const serveOff = flag('serve') === 'off'
const server = serveOff
  ? null
  : spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', cwd: APP_ROOT })
try {
  await waitForServer(`${BASE}/`)
  const said = await assertServer(BASE)
  console.error(`server ${said.head.slice(0, 7)} on ${BASE}`)
  const browser = await chromium.launch({ args: browserArgs() })
  const result = { wing: WING, order: ORDER, tier: TIER, framings: [], planted: [] }
  try {
    for (const name of WANT) {
      if (!STAGES[name]) throw new Error(`no framing ${name}: ${Object.keys(STAGES).join(' or ')}`)
      result.framings.push(await everyStop(browser, name))
    }
    if (PLANTED) {
      result.planted.push(await planted(browser, 'hold'))
      result.planted.push(await planted(browser, 'refuse'))
    }
  } finally {
    await browser.close()
  }
  result.ok = refusals.length === 0
  result.refusals = refusals
  console.log(JSON.stringify(result, null, 1))
  for (const r of refusals) console.error(`REFUSED ${r.where}: ${r.what}`)
  process.exitCode = result.ok ? 0 : 1
} finally {
  server?.kill('SIGTERM')
}
