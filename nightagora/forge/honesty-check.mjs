// THE HONESTY CHECK (bar axis 9 and 11, measured, never scored from pixels).
// Whether a green label sits on a generated object is a property of the
// manifest and the label graph, so a machine reads it and the judge quotes
// the number instead of guessing it from a frame.
//
//   node forge/honesty-check.mjs <port> lobby
//   node forge/honesty-check.mjs <port> wing <slug>
//   node forge/honesty-check.mjs <port> lobby --json
//
// It walks every station of the surface through a real server on the real
// GPU, reads window.__forge.labels() at each, and fails when:
//   · a `documented` label anchors a GENERATED, CC0, CC-BY or CC-BY-SA
//     object (only what was captured, what is old enough to be nobody's,
//     and procedural architecture built from plans may carry green)
//   · any interactive target is under 44 px on either frame
//   · a station shows more than one brand line, or more than three
//     persistent marks
//   · a disclosure on the frame differs from src/content/disclosures.ts by
//     a single character
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  APP_ROOT,
  assertAdapter,
  assertBackend,
  assertServer,
  browserArgs,
  VIEWPORTS,
  waitForServer,
} from './rig.mjs'

/* THE CANON, OFF THE DISK. Comparing the page against the canon the same
   bundle serves would be tautological wherever a line reads the canon at
   runtime, so the file itself is the reference and the bundle is checked
   against it too: a stale build fails here rather than in front of a
   visitor. */
function canonFromFile() {
  const text = readFileSync(join(APP_ROOT, 'src', 'content', 'disclosures.ts'), 'utf8')
  const body = text.slice(text.indexOf('DISCLOSURES: Record'))
  const out = {}
  for (const m of body.matchAll(/(\w+):\s*\{\s*en:\s*(['"])((?:\\.|(?!\2).)*)\2,\s*de:\s*(['"])((?:\\.|(?!\4).)*)\4,?\s*\}/g))
    out[m[1]] = { en: unescape_(m[3]), de: unescape_(m[5]) }
  return out
}
const unescape_ = (s) => s.replace(/\\(['"\\])/g, '$1')

const port = Number(process.argv[2] ?? process.env['FORGE_PORT'] ?? 5199)
const surface = process.argv[3] ?? 'lobby'
const slug = surface === 'wing' ? (process.argv[4] ?? 'vinci') : ''
const JSON_OUT = process.argv.includes('--json')
const BASE = `http://localhost:${port}`
const REACH = 44
/** the classes a green label may stand on: the truth itself, a photograph
    of a work nobody owns, and architecture drawn from published plans */
const MAY_TESTIFY = new Set(['CAPTURED', 'PD-ART', 'procedural'])

/** the lobby's own stations, in the order a visitor meets them */
const LOBBY = [
  ['agora', 'agora', {}],
  // the keeper's line is the voice disclosure and it is only on the frame
  // while he is speaking, so the walk stands in front of him on purpose
  ['keeper', 'agora', { keeper: 1 }],
  ['wheel', 'wheel', { chapter: 0 }],
  ['pane', 'pane', { slug: 'vinci' }],
]

const say = (line) => {
  if (!JSON_OUT) console.log(line)
}

const stations = []
const failures = []
const server = spawn('pnpm', ['exec', 'vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
try {
  await waitForServer(BASE)
  const said = await assertServer(BASE)
  say(`server ${said.head.slice(0, 7)} at ${said.root}`)

  const browser = await chromium.launch({ args: browserArgs() })
  for (const vp of Object.values(VIEWPORTS)) {
    const tier = vp.tag === 'mobile' ? 'calm' : 'hero'
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
    })
    let firstLine = ''
    page.on('console', (m) => {
      if (m.text().startsWith('backend=')) firstLine = m.text()
    })
    await page.route('**/@vite/client', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: 'export {}' })
    )
    await page.goto(`${BASE}/?tier=${tier}`)
    await page.waitForFunction(() => Boolean(window.__forge))
    await page.waitForTimeout(1800)
    await assertBackend(page)
    assertAdapter(firstLine, process.env['FORGE_BACKEND'] ?? 'webgpu')

    const served = await page.evaluate(() => window.__forge.disclosures())
    const canon = canonFromFile()
    for (const key of Object.keys(canon))
      for (const l of ['en', 'de'])
        if (served[key]?.[l] !== canon[key][l])
          failures.push(`the bundle's ${key}.${l} disclosure is not the one in the canon file (stale build?)`)
    const langOf = await page.evaluate(() => (document.documentElement.lang.slice(0, 2) === 'de' ? 'de' : 'en'))

    const walk = []
    if (surface === 'wing') {
      await page.evaluate((s) => window.__forge.jump('wing', { slug: s }), slug)
      await waitFor(page, 'wing')
      /* BY ID, THROUGH THE FRAME'S OWN API. An integer handed to the
         normalised rail (0 to 1) lands on the last station for every
         index above zero, so a nineteen-station wing was read nineteen
         times at its last room. */
      const ids = await page.evaluate(() => window.__forge.state().stationIds ?? [])
      if (!ids.length) failures.push(`the ${slug} wing reports no station id: it cannot be addressed`)
      walk.push(...ids.map((id) => [id, id]))
    } else {
      walk.push(...LOBBY)
    }

    for (const beat of walk) {
      let name
      if (surface === 'wing') {
        name = beat[0]
        const took = await page.evaluate((id) => window.__forge.station(id), beat[1])
        if (!took) {
          failures.push(`${vp.tag}/${name}: the frame refused to stand at this station`)
          continue
        }
        const at = await page.evaluate(() => window.__forge.state().stationId)
        if (at !== beat[1]) failures.push(`${vp.tag}/${name}: asked for ${beat[1]}, standing at ${at}`)
      } else {
        name = beat[0]
        await page.evaluate(([p, o]) => {
          window.__forge.freeze(12.4)
          window.__forge.jump(p, o)
        }, [beat[1], beat[2]])
        await waitFor(page, beat[0])
      }
      await page.waitForTimeout(1700)
      const labels = await page.evaluate(() => window.__forge.labels())
      const where = `${vp.tag}/${name}`
      stations.push({ station: where, labels })

      const brands = labels.filter((l) => l.brand)
      const persistent = labels.filter((l) => l.persistent)
      const targets = labels.filter((l) => l.targetPx !== null)
      const smallest = targets.length ? Math.min(...targets.map((l) => l.targetPx)) : null

      for (const l of labels) {
        if (l.certainty === 'documented' && !MAY_TESTIFY.has(l.anchorClass))
          failures.push(`${where}: "${short(l.text)}" is documented and stands on a ${l.anchorClass} object`)
        if (l.targetPx !== null && l.targetPx < REACH)
          failures.push(`${where}: "${short(l.text)}" is a ${l.targetPx} px target, under ${REACH}`)
        if (l.disclosure) {
          const want = canon[l.disclosure]?.[langOf]
          if (want === undefined) failures.push(`${where}: "${short(l.text)}" names disclosure ${l.disclosure}, which the canon does not hold`)
          else if (want !== l.text)
            failures.push(`${where}: the ${l.disclosure} disclosure has drifted from the canon\n      page:  ${l.text}\n      canon: ${want}`)
        }
      }
      if (brands.length > 1) failures.push(`${where}: ${brands.length} brand lines on one frame`)
      if (persistent.length > 3) failures.push(`${where}: ${persistent.length} persistent marks, over three`)

      say(
        `${where.padEnd(22)}${String(labels.length).padStart(3)} labels  ` +
          `${String(labels.filter((l) => l.certainty).length).padStart(2)} claims  ` +
          `${String(brands.length)} brand  ${String(persistent.length)} persistent  ` +
          `smallest target ${smallest === null ? 'none' : `${smallest} px`}`
      )
    }
    await page.close()
  }
  await browser.close()
} catch (err) {
  failures.push(`RIG REFUSED: ${err.message}`)
} finally {
  server.kill()
}

function short(text) {
  return text.length > 48 ? `${text.slice(0, 45)}...` : text
}

async function waitFor(page, state, ms = 8000) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (await page.evaluate((s) => document.body.dataset.forge === s, state)) return true
    await page.waitForTimeout(80)
  }
  return false
}

const total = stations.reduce((n, s) => n + s.labels.length, 0)
if (JSON_OUT) {
  console.log(JSON.stringify({ surface: surface === 'wing' ? `wing/${slug}` : surface, stations, labels: total, failures, ok: failures.length === 0 }, null, 2))
} else {
  say('')
  if (!total) say(`0 labels: ${surface === 'wing' ? `the ${slug} wing` : 'this surface'} carries no marks yet`)
  if (failures.length) {
    say('HONESTY CHECK FAILED:')
    for (const f of [...new Set(failures)]) say(` · ${f}`)
  } else {
    say(`honest: ${total} label(s) read, every claim on a class that may carry it`)
  }
}
process.exitCode = failures.length ? 1 : 0
