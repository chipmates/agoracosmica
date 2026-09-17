// THE SETTLED COUNT. `renderer.info` holds what the LAST frame drew, so one
// call to the meter reports the frame it happened to land on. On one
// unchanged geometry the same station has read 140, 192, 152, 176 and 174
// across five runs, and a count that moves forty draws between two runs of
// the same scene cannot hold a budget.
//
// So a reading is taken over a window of consecutive frames at a camera that
// has stood still, and the count reported is the one that REPEATS (the mode
// of the window, ties to the lower value). The mode and not the minimum: the
// minimum is whatever frame skipped the most work, which is not what the
// scene costs, while the mode is the frame the scene draws over and over.
// The frames that cost MORE than it are reported on their own line rather
// than folded into the count: a pass that runs every few frames (the shadow
// cascade re-render is the known one) is a fact about the frame's schedule,
// not about the standing cost of the room.
//
// Used by cost.mjs and gates.mjs. It is also the measurement itself:
//   node forge/settle.mjs <port> lobby [--frames=20] [--runs=5]
//   node forge/settle.mjs <port> wing vinci --station=courtyard --tier=standard
//   node forge/settle.mjs <port> wing vinci --station=arrival --cold
//     --cold    read the first station the moment the app answers, with no
//               warm up at all: what the gates used to sample
//     --trace   one line per window instead of the series: the shape of the
//               reading against the clock
//     --sweep   stand at every station in turn and print what each costs
//               once it is steady, with how long it took to get there
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  APP_ROOT,
  assertAdapter,
  assertBackend,
  assertServer,
  browserArgs,
  VIEWPORTS,
  waitForServer,
} from './rig.mjs'

/** twenty frames is a third of a second of a good frame rate: long enough
    that a pass running every second or third frame shows up as its own
    line, short enough that a station reading stays one wait */
export const WINDOW_FRAMES = 20

/** what each of `frames` consecutive frames drew, read in the page's own
    animation callback so the samples are frames and not round trips */
export async function drawSeries(page, frames = WINDOW_FRAMES) {
  return page.evaluate(async (n) => {
    const out = []
    await new Promise((done) => {
      const tick = () => {
        const c = window.__forge.cost()
        const rail = window.__forge.state?.().station
        out.push([c.draws, c.triangles, typeof rail === 'number' ? rail : -1])
        if (out.length >= n) done()
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    return out
  }, frames)
}

const mode = (values) => {
  const tally = new Map()
  for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1)
  let best = -1
  let held = values[0] ?? 0
  for (const [value, n] of [...tally.entries()].sort((a, b) => a[0] - b[0])) {
    if (n > best) {
      best = n
      held = value
    }
  }
  return { value: held, held: best }
}

/** the count that repeats, and everything the window says about it */
export function settleSeries(series) {
  const draws = series.map((s) => s[0])
  const m = mode(draws)
  // the triangles of the frames that drew the settled count, so the two
  // numbers come off the same frames and never off two different ones
  const tris = mode(series.filter((s) => s[0] === m.value).map((s) => s[1]))
  const over = draws.filter((d) => d > m.value)
  const under = draws.filter((d) => d < m.value)
  return {
    draws: m.value,
    triangles: tris.value,
    settled: {
      frames: draws.length,
      held: m.held,
      min: Math.min(...draws),
      max: Math.max(...draws),
      // the periodic pass, on its own line: how many frames of the window
      // paid for it and what the heaviest of them added
      refresh: { frames: over.length, draws: over.length ? Math.max(...over) - m.value : 0 },
      under: under.length,
    },
  }
}

/** the meter's whole reading with the two exact numbers settled. `sampled`
    keeps the single frame the old meter would have reported, so a report can
    print both without running twice. */
export async function settledCost(page, frames = WINDOW_FRAMES) {
  const series = await drawSeries(page, frames)
  const read = await page.evaluate(() => window.__forge.cost())
  const s = settleSeries(series)
  return {
    ...read,
    draws: s.draws,
    triangles: s.triangles,
    sampled: { draws: read.draws, triangles: read.triangles },
    settled: s.settled,
  }
}

/* WHEN THE SCENE HAS ACTUALLY STOPPED CHANGING. One window is not enough:
   a station that has just been stood at goes on shedding and regaining work
   for seconds (measured at the courtyard: 152 draws at 2.5 s, 139 at 6.1 s,
   142 at 9.2 s, 71 from 13.1 s on, and dead steady after that). The old
   fixed wait of 2.2 s landed on the highest point of that curve, which is
   why one geometry reported 140, 152, 154, 174 and 192 on different nights.
   So windows are taken until four in a row agree to the draw AND to the
   triangle, with no library set still in flight. */
export const HOLDS = 3
export const STEADY_MS = 25000

export async function steadyCost(page, { frames = WINDOW_FRAMES, holds = HOLDS, ms = STEADY_MS } = {}) {
  const began = Date.now()
  const pendingNow = () => page.evaluate(() => window.__forge.state?.().texturesPending ?? 0)
  let last = null
  let agreed = 0
  let windows = 0
  let first = null
  let pending = await pendingNow()
  while (Date.now() - began < ms) {
    const now = await settledCost(page, frames)
    pending = await pendingNow()
    windows++
    first ??= now
    if (last && pending === 0 && now.draws === last.draws && now.triangles === last.triangles) agreed++
    else agreed = 0
    last = now
    if (agreed >= holds) break
  }
  const took = Date.now() - began
  return {
    ...last,
    steady: {
      held: agreed >= holds,
      ms: took,
      windows,
      frames: windows * frames,
      pending,
      // what a run that read the scene the moment it arrived would have
      // written down, kept beside what it costs once it stands
      first: { draws: first?.draws ?? 0, triangles: first?.triangles ?? 0 },
    },
  }
}

/* A STATION IS READ WHERE IT STANDS. Asking the frame for a station walks
   the rail there, and a leg takes seconds: four windows taken on the way can
   agree for a second and put a frame of the corridor on the station's line.
   So a reading waits until the rail bar names the station as the one the
   walker completed, with no station still a target. */
export async function arrive(page, id, ms = 60000) {
  return page
    .waitForFunction(
      (want) => {
        const here = document.querySelector('.wing-step[aria-current="true"]')
        return here?.dataset.station === want && !document.querySelector('.wing-step[data-target="true"]')
      },
      id,
      { timeout: ms, polling: 100 }
    )
    .then(() => true)
    .catch(() => false)
}

/* THE COLD FIRST STATION. The first thing a run measures is a scene that has
   just been built: sets still in flight, shaders still compiling. The
   courtyard has read 183 draws and 1.5 M triangles that way. So the first
   station is stood at until the scene is steady before any number is
   believed, and the cold reading is kept beside the warm one. */
export async function warmScene(page, opts = {}) {
  const cold = await settledCost(page, opts.frames ?? WINDOW_FRAMES)
  const warm = await steadyCost(page, opts)
  return {
    warmed: warm.steady.held,
    ms: warm.steady.ms,
    frames: warm.steady.frames,
    pending: warm.steady.pending,
    cold: { draws: cold.draws, triangles: cold.triangles },
    warm,
  }
}

/* ----------------------------------------------------------- the instrument
   Everything below runs only when this file is the one that was called. */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  // a value written with a space reads as a positional word and the run
  // measures something nobody asked for, so a named flag takes its value
  // with an equals sign and a bare one is refused unless it is a switch
  const SWITCHES = new Set(['cold', 'trace', 'sweep'])
  const named = new Map()
  const words = []
  for (const a of argv) {
    if (!a.startsWith('--')) {
      words.push(a)
      continue
    }
    const at = a.indexOf('=')
    const key = at === -1 ? a.slice(2) : a.slice(2, at)
    if (at === -1) {
      if (!SWITCHES.has(key)) {
        console.error(`--${key} takes a value: write --${key}=<value>`)
        process.exit(1)
      }
      named.set(key, true)
    } else named.set(key, a.slice(at + 1))
  }
  const flag = (name, fallback) => named.get(name) ?? fallback
  const port = Number(words[0] ?? process.env['FORGE_PORT'] ?? 5199)
  const surface = words[1] ?? 'lobby'
  const slug = surface === 'wing' ? (words[2] ?? 'vinci') : ''
  const tier = String(flag('tier', 'standard'))
  const station = flag('station', '')
  const frames = Number(flag('frames', WINDOW_FRAMES))
  const runs = Number(flag('runs', 1))
  const COLD = named.has('cold')
  // one line per window instead of the whole series: the shape of a scene
  // that is still shedding work, against the clock
  const TRACE = named.has('trace')
  // every station of the surface, each stood at until it is steady: the
  // table the budget lines are read off
  const SWEEP = named.has('sweep')
  const BASE = `http://localhost:${port}`
  const url = surface === 'wing' ? `${BASE}/w/${slug}?tier=${tier}` : `${BASE}/?tier=${tier}`

  const server = spawn('pnpm', ['preview', '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
    cwd: APP_ROOT,
  })
  try {
    await waitForServer(BASE)
    const said = await assertServer(BASE)
    console.log(`server ${said.head.slice(0, 7)}  ${surface === 'wing' ? `wing/${slug}` : surface}  tier ${tier}`)
    const browser = await chromium.launch({ args: browserArgs() })
    const vp = VIEWPORTS.desktop
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
    })
    let firstLine = ''
    page.on('console', (m) => {
      if (m.text().startsWith('backend=')) firstLine = m.text()
    })
    await page.goto(url)
    await page.waitForFunction(() => Boolean(window.__forge))
    if (!COLD) await page.waitForTimeout(1800)
    const stamp = await assertBackend(page)
    assertAdapter(firstLine, process.env['FORGE_BACKEND'] ?? 'webgpu')
    if (stamp.tier !== tier) throw new Error(`asked for tier=${tier}, the app stamped ${stamp.tier}`)
    if (station) {
      const took = await page.evaluate((s) => window.__forge.station?.(s) ?? false, station)
      if (!took) throw new Error(`the frame would not stand at ${station}`)
      if (!COLD) await page.waitForTimeout(1200)
    }
    if (!COLD) {
      const w = await warmScene(page, { frames })
      console.log(
        `warm up: ${w.warmed ? 'settled' : 'NEVER SETTLED'} after ${w.frames} frames / ${w.ms} ms, ` +
          `${w.pending} set(s) pending, cold ${w.cold.draws} draws / ${w.cold.triangles} tris, ` +
          `warm ${w.warm.draws} / ${w.warm.triangles}`
      )
    } else {
      console.log(`cold: the first reading, no warm up, ${await page.evaluate(() => window.__forge.state?.().texturesPending ?? 0)} set(s) pending`)
    }

    if (SWEEP) {
      const ids = await page.evaluate(() => window.__forge.state?.().stationIds ?? [])
      console.log(`${'station'.padEnd(20)}${'draws'.padStart(7)}${'tris'.padStart(10)}${'cold'.padStart(7)}${'first'.padStart(7)}${'s'.padStart(7)}  steady`)
      for (const id of ids.length ? ids : [station].filter(Boolean)) {
        const took = await page.evaluate((x) => window.__forge.station?.(x) ?? false, id)
        if (!took) {
          console.log(`${id.padEnd(20)}  the frame would not stand here`)
          continue
        }
        const c = await steadyCost(page, { frames })
        console.log(
          `${id.padEnd(20)}${String(c.draws).padStart(7)}${String(c.triangles).padStart(10)}` +
            `${String(c.sampled.draws).padStart(7)}${String(c.steady.first.draws).padStart(7)}` +
            `${(c.steady.ms / 1000).toFixed(1).padStart(7)}  ${c.steady.held ? 'yes' : 'NO'}`
        )
      }
      await page.close()
      await browser.close()
      server.kill()
      process.exit(0)
    }

    const began = Date.now()
    for (let run = 1; run <= runs; run++) {
      const series = await drawSeries(page, frames)
      const s = settleSeries(series)
      if (TRACE) {
        const rails = series.map((x) => x[2])
        console.log(
          `  ${((Date.now() - began) / 1000).toFixed(1).padStart(5)} s  ` +
            `${String(s.draws).padStart(4)} draws  ${String(s.triangles).padStart(8)} tris  ` +
            `min ${s.settled.min} max ${s.settled.max}  held ${s.settled.held}/${s.settled.frames}  ` +
            `rail ${Math.min(...rails).toFixed(4)} to ${Math.max(...rails).toFixed(4)}`
        )
        continue
      }
      console.log(`\nrun ${run}  ${frames} consecutive frames at ${station || surface}`)
      console.log(`  draws  ${series.map((x) => x[0]).join(' ')}`)
      console.log(`  tris   ${[...new Set(series.map((x) => x[1]))].join(' ')}`)
      const one = await page.evaluate(() => window.__forge.cost())
      console.log(
        `  one call reads ${one.draws} draws / ${one.triangles} tris  ` +
          `|  settled ${s.draws} / ${s.triangles} (held ${s.settled.held} of ${s.settled.frames}, ` +
          `min ${s.settled.min}, max ${s.settled.max})  ` +
          `|  refresh ${s.settled.refresh.frames} frame(s) +${s.settled.refresh.draws} draws`
      )
    }
    await page.close()
    await browser.close()
  } catch (err) {
    console.error(`RIG REFUSED: ${err.message}`)
    process.exitCode = 1
  } finally {
    server.kill()
  }
}
