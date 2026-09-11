// One element's own eye. Every polish pass runs its own dev server on its
// own port, so several hands can look at their own part of the night at
// the same time without fighting over one build.
//
// Usage:
//   node forge/shot-agent.mjs <port> <outDir> '<states>'
//
// States are JSON, or the shorthand the briefs are written in:
//   '[transit, held, descent, agora, wheel, pane vinci, breath, wing vinci]'
// JSON takes { name, phase, opts, settle, tiers }, the same arguments
// window.__forge.jump() takes plus the tiers this state is worth shooting at.
//
// Environment:
//   FORGE_BACKEND=webgpu|webgl2  what the app must report (default webgpu)
//   FORGE_TIER=hero|standard|calm shoot one tier instead of each state's own
//   FORGE_VP=desktop|mobile      shoot one viewport instead of both
//   FORGE_CONE=all|<state,state>  also shoot the four look-cone corners of
//                                 those states, as <viewport>-<tier>-<state>-c1..c4
//
// A state may carry its own cone in JSON: { "cone": { "yaw": [-40, 40],
// "pitch": [-20, 15] } } in degrees, the drag envelope of that station. The
// default when a spec gives none is yaw plus or minus 35, pitch minus 15 to
// plus 10.
//
// Shots land in forge/shots/<outDir>/<viewport>-<tier>-<name>.png. Every
// console error and page error is reported at the end. Read the frames.

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import {
  assertAdapter,
  assertBackend,
  assertServer,
  browserArgs,
  coneCorners,
  coneFor,
  parseStates,
  shotName,
  VIEWPORTS,
  waitForServer,
} from './rig.mjs'

const port = Number(process.argv[2] ?? 5300)
const outDir = process.argv[3] ?? 'agent'
const states = parseStates(process.argv[4])
if (!states.length) {
  console.error('no states given')
  process.exit(1)
}

const BASE = `http://localhost:${port}`
const OUT = new URL(`./shots/${outDir}/`, import.meta.url).pathname
const WANT_BACKEND = process.env['FORGE_BACKEND'] ?? 'webgpu'
// long enough that no frame is caught mid-transition: the night's slowest
// letterpress fade is 1.6 s and the Keeper reveals his line word by word
const SETTLE = Number(process.env['FORGE_SETTLE'] ?? 1700)
const ONE_TIER = process.env['FORGE_TIER']
const tiersOf = (s) => (ONE_TIER ? [ONE_TIER] : (s.tiers ?? ['hero']))
const allTiers = [...new Set(states.flatMap(tiersOf))]

/** poll for the marker the app writes back. A page-side predicate is used
    rather than waitForFunction: the poller runs in its own world and never
    sees this attribute change. */
async function landed(page, state, ms = 6000) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (await page.evaluate((s) => document.body.dataset.forge === s, state)) return true
    await page.waitForTimeout(80)
  }
  return false
}

/** the address a state is shot at, and the window property that drives it */
const pathOf = (s) => s.path ?? '/'
const hookOf = (s) => s.hook ?? '__forge'

/** a route may carry its own query, so the tier joins it rather than opening
    a second one */
const address = (path, tier) => `${BASE}${path}${path.includes('?') ? '&' : '?'}tier=${tier}`

/** land on a route and wait for its own forge hook to exist */
async function arrive(page, url, hook) {
  await page.goto(url)
  await page.waitForFunction((h) => Boolean(window[h]), hook)
  await page.waitForTimeout(1800)
  await dressed(page, hook)
}

/**
 * Wait until every library set the page asked for is on the GPU. A stone
 * whose photograph has not landed draws as it was authored, which is a
 * DIFFERENT frame: the same state shot on a cold cache and a warm one
 * measured six levels apart on the court beside the fire. The rig waits on
 * the app's own count rather than on a guessed delay.
 */
async function dressed(page, hook, ms = 20000) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    const left = await page.evaluate((h) => window[h]?.state?.().texturesPending ?? 0, hook)
    if (!left) return true
    await page.waitForTimeout(120)
  }
  problems.push('the library never finished loading; frames are not comparable')
  return false
}

/** the headless GL context can die mid-run on the heavier stages: a lost
    context looks exactly like a bad frame, so the rig proves the state
    took and reloads once if it did not. The app writes back the state it
    was ASKED for (data-forge), which is what a wing needs: its module
    arrives a frame later, and the phase alone cannot tell a pane from
    the wheel it is held open on. */
async function jump(page, state, url, settle) {
  const hook = hookOf(state)
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.evaluate(([p, o, h]) => {
      window[h].freeze(12.4)
      window[h].jump(p, o ?? {})
    }, [state.phase, state.opts, hook])
    const took = await landed(page, state.phase)
    await page.waitForTimeout(settle)
    if (took) return true
    await page.reload()
    await page.waitForFunction((h) => Boolean(window[h]), hook)
    await page.waitForTimeout(1500)
  }
  return false
}

mkdirSync(OUT, { recursive: true })
let corners = 0
const problems = []
const server = spawn('pnpm', ['exec', 'vite', '--port', String(port), '--strictPort'], {
  stdio: 'ignore',
})
try {
  await waitForServer(BASE)
  const said = await assertServer(BASE)
  console.log(`server ${said.head.slice(0, 7)} at ${said.root}`)

  const browser = await chromium.launch({ args: browserArgs() })
  const ONE_VP = process.env['FORGE_VP']
  for (const vp of Object.values(VIEWPORTS)) {
    if (ONE_VP && vp.tag !== ONE_VP) continue
    for (const tier of allTiers) {
      const wanted = states.filter((s) => tiersOf(s).includes(tier))
      if (!wanted.length) continue
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
      })
      let firstLine = ''
      page.on('pageerror', (e) => problems.push(`[${vp.tag}/${tier}] pageerror: ${e.message}`))
      page.on('console', (m) => {
        const text = m.text()
        if (text.startsWith('backend=')) firstLine = text
        if (m.type() === 'error') problems.push(`[${vp.tag}/${tier}] console: ${text}`)
      })
      // THE RIG MUST NOT LIE. Vite's HMR client reloads the page whenever any
      // hand saves a file, the forge jump is lost, and the shot lands on the
      // intro card with no error raised. Several seats lost rounds to this.
      await page.route('**/@vite/client', (route) =>
        route.fulfill({ status: 200, contentType: 'application/javascript', body: 'export {}' })
      )
      let here = pathOf(wanted[0])
      await arrive(page, address(here, tier), hookOf(wanted[0]))

      const stamp = await assertBackend(page, WANT_BACKEND)
      assertAdapter(firstLine, WANT_BACKEND)
      if (stamp.tier !== tier) throw new Error(`asked for tier=${tier}, the app stamped ${stamp.tier}`)
      if (vp.tag === 'desktop' && tier === allTiers[0]) console.log(firstLine)

      for (const s of wanted) {
        // a state on another address is a reload, not a jump: two routes are
        // two apps and the rig may never shoot one believing it is the other
        if (pathOf(s) !== here) {
          here = pathOf(s)
          await arrive(page, address(here, tier), hookOf(s))
          await assertBackend(page, WANT_BACKEND)
        }
        const took = await jump(page, s, BASE, s.settle ?? SETTLE)
        if (!took) problems.push(`[${vp.tag}/${tier}] ${s.name}: the stage never took`)
        await dressed(page, hookOf(s))
        await page.screenshot({ path: `${OUT}${shotName(vp.tag, tier, s.name)}` })
        const cone = coneFor(s)
        if (!cone) continue
        // an undressed wall hides in the corner of the envelope, never in
        // the frame the seat composed: the corners are shot, not sampled
        for (const c of coneCorners(cone)) {
          await page.evaluate(([y, p]) => window.__forge.look(y, p), [c.yaw, c.pitch])
          await page.waitForTimeout(420)
          await page.screenshot({ path: `${OUT}${shotName(vp.tag, tier, `${s.name}-c${c.n}`)}` })
          corners++
        }
        await page.evaluate(() => window.__forge.look(0, 0))
      }
      await page.close()
    }
  }
  await browser.close()
  console.log(`shots written to forge/shots/${outDir}/`)
  if (corners) console.log(`cone corners: ${corners}`)
  if (problems.length) {
    console.log('PROBLEMS:')
    for (const p of [...new Set(problems)]) console.log(' ·', p)
    process.exitCode = 1
  } else {
    console.log('clean: no console errors')
  }
} catch (err) {
  console.error(`RIG REFUSED: ${err.message}`)
  process.exitCode = 1
} finally {
  server.kill()
}
