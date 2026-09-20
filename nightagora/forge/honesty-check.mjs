// THE HONESTY CHECK (bar axis 9 and 11, measured, never scored from pixels).
// Whether a green label sits on a generated object is a property of the
// manifest and the label graph, so a machine reads it and the judge quotes
// the number instead of guessing it from a frame.
//
//   node forge/honesty-check.mjs <port> lobby
//   node forge/honesty-check.mjs <port> wing <slug>
//   node forge/honesty-check.mjs <port> wing <slug> --looks
//   node forge/honesty-check.mjs <port> lobby --json
//
// It walks every station of the surface through a real server on the real
// GPU, reads window.__forge.labels() at each, opens the close looks when it
// is asked to, and fails when:
//   · a `documented` label anchors a GENERATED, CC0, CC-BY or CC-BY-SA
//     object (only what was captured, what is old enough to be nobody's,
//     and procedural architecture built from plans may carry green)
//   · any interactive target is under 44 px on either frame
//   · a station shows more than one brand line, or more than three
//     persistent marks
//   · a disclosure on the frame differs from src/content/disclosures.ts by
//     a single character
//
// NO STEP OF THE WALK STANDS FOREVER. A call into the page carries no
// deadline of its own, so a frame that stops answering leaves the run at zero
// percent CPU with nothing written and no address. Every station and every
// close look is named on stderr as it is entered and is raced against a
// clock; one that loses is given up by name, and the whole walk has a clock
// under those. A walk that gives up says so and ends non-zero.
//
// THE CLOSE LOOK IS A WALK OF ITS OWN (--looks). A station's own labels are
// what a visitor sees standing in the room; the card words of a machine, a
// painting or a leaf stand behind one press, so a walk that never presses one
// leaves every card unread. Opening all of them reads about ten times the
// labels and takes about forty minutes, which no gate run can carry, so it is
// asked for. Each openable exhibit of the standing station is then opened
// through the app's own hook, read under the same rules, and shut again
// before the walk moves on, because a jump out of an open window lands behind
// it. Station readings and exhibit readings are reported apart: a station is
// read once per viewport either way.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { arrive } from './settle.mjs'
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
/** the card walk, off unless it is asked for: the head of this file says why */
const LOOKS = process.argv.includes('--looks')
const BASE = `http://localhost:${port}`
const REACH = 44
/** How long a station is given to paint its row of close looks, how long the
    wing is given to dress before the walk reads it at all, and how long one
    close look has to open and to shut. */
const ROW_MS = 4000
const DRESSED_MS = 240000
const OPEN_MS = 30000
const SHUT_MS = 12000
/** the hang guard's own clocks: one station beat, one close look, and the
    whole walk under them. A station beat holds the leg the walker has to
    complete, a close look holds an open, a read and a shut. */
const STATION_MS = 150000
const LOOK_MS = 90000
const WALK_MS = LOOKS ? 5400000 : 1500000
/** two stations in a row that never answer are a wedged frame, not a station:
    the walk ends there rather than spending a deadline on each of the rest */
const STALLS_ALLOWED = 2
/** the classes a green label may stand on: the truth itself, a photograph
    of a work nobody owns, and architecture drawn from published plans */
const MAY_TESTIFY = new Set(['CAPTURED', 'PD-ART', 'procedural'])

/** the lobby's own stations, in the order a visitor meets them */
const LOBBY = [
  ['agora', 'agora', {}],
  ['wheel', 'wheel', { chapter: 0 }],
  ['pane', 'pane', { slug: 'vinci' }],
]

const say = (line) => {
  if (!JSON_OUT) console.log(line)
}

const stations = []
const exhibits = []
const failures = []

/** what the walk is standing in right now, so a guard that fires has an
    address to name, and the same line on stderr in both modes: a run that
    says nothing until it ends cannot say where it stopped */
let standing = 'the rig'
let server = null
let browser = null
let over = false
const entering = (what) => {
  standing = what
  process.stderr.write(`  at ${what}\n`)
}

class Stalled extends Error {}
/** a step raced against a clock, so a call into the page that never answers
    is named instead of held */
function within(what, ms, work) {
  let bell
  return Promise.race([
    work(),
    new Promise((_, no) => {
      bell = setTimeout(() => no(new Stalled(`${what} did not answer in ${Math.round(ms / 1000)} s`)), ms)
    }),
  ]).finally(() => clearTimeout(bell))
}

/* THE WALK'S OWN CLOCK, the backstop under the step deadlines: a run still
   walking when it runs out names where it stood and ends. */
const guard = setTimeout(() => {
  failures.push(`the walk gave up after ${Math.round(WALK_MS / 60000)} min, standing at ${standing}`)
  finish()
}, WALK_MS)
guard.unref()

/** WHAT A READING OWES, wherever it was taken: a green label only on a class
    that may carry it, a target a hand can hit, one brand line, three
    persistent marks, and every disclosure word for word. */
function judge(labels, where, canon, langOf) {
  const brands = labels.filter((l) => l.brand)
  const persistent = labels.filter((l) => l.persistent)
  const targets = labels.filter((l) => l.targetPx !== null)
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
  return {
    claims: labels.filter((l) => l.certainty).length,
    brands: brands.length,
    persistent: persistent.length,
    smallest: targets.length ? Math.min(...targets.map((l) => l.targetPx)) : null,
  }
}

/** The close looks the standing station carries, off the row the wing paints:
    every cell names its exhibit and a shut cell is one the room cannot open
    here. The walk asks the page, so a row that grows is walked without a
    list of its own in this file. */
async function openableHere(page) {
  /* The room reads its own exhibits when the collection's sets have landed,
     which is after the walk has already stood at the station, so the row is
     waited for and its absence is taken as a station that carries none. */
  await page
    .waitForFunction(() => document.querySelectorAll('button[data-exhibit]').length > 0, null, { timeout: ROW_MS, polling: 250 })
    .catch(() => {})
  return page.evaluate(() =>
    [...document.querySelectorAll('button[data-exhibit]')]
      .filter((cell) => !cell.disabled)
      .map((cell) => cell.dataset.exhibit)
      .filter((id, at, all) => Boolean(id) && all.indexOf(id) === at))
}

/** THE VISITOR'S OWN WAY IN FIRST: the cell of the row the station paints,
    pressed. The eyes' named route is the fallback, for a station whose row
    does not draw the exhibit. A date opens the wing's life window instead of
    the vitrine, which is a close look all the same and is read as one. */
async function openLook(page, slug, station, id) {
  /* THE CARD MAY NAME A LEAF OF THE CELL. A wall of sheets offers one cell per
     sheet and the card that opens names the leaf inside it (`<id>/leaf`), so a
     reading that asks for the cell's own id word for word calls an open card
     a card that never opened. */
  const stands = () => page
    .waitForFunction((want) => {
      const at = document.querySelector('.vitrine-card')?.dataset.exhibit
      return at === want || Boolean(at && at.startsWith(`${want}/`)) || Boolean(document.querySelector('dialog.wing-life[open]'))
    }, id, { timeout: OPEN_MS, polling: 200 })
    .then(() => true)
    .catch(() => false)
  const pressed = await page.evaluate((want) => {
    const cell = document.querySelector(`button[data-exhibit="${want}"]`)
    if (!(cell instanceof HTMLButtonElement) || cell.disabled) return false
    cell.click()
    return true
  }, id)
  if (pressed && (await stands())) return true
  await page.evaluate(([s, st, view]) => window.__forge.jump('wing', { slug: s, station: st, view }), [slug, station, `open:${id}`])
  return stands()
}

/** Shut, and proved shut: the window takes itself out of the page. */
async function shutLook(page) {
  await page.keyboard.press('Escape')
  return page
    .waitForFunction(() => !document.querySelector('.vitrine-card') && !document.querySelector('dialog.wing-life[open]'), null, { timeout: SHUT_MS, polling: 150 })
    .then(() => true)
    .catch(() => false)
}

server = spawn('pnpm', ['exec', 'vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
try {
  await waitForServer(BASE)
  const said = await assertServer(BASE)
  say(`server ${said.head.slice(0, 7)} at ${said.root}`)

  browser = await chromium.launch({ args: browserArgs() })
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
    const readLooks = new Set()
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
      /* A ROOM IS READ ONCE IT IS DRESSED. A wing builds a room the first time
         the walk stands in it and reads its own exhibits a minute later, when
         that room's sets have landed, so a walk that reads as it goes reads
         the frame's chrome at the first rooms and calls it a museum. One lap
         is walked first for the building alone, and the reading lap begins
         when the first row of close looks stands. */
      entering(`${vp.tag}, the wing dressing`)
      for (const id of ids) {
        await page.evaluate((at) => window.__forge.station(at), id)
        await page.waitForTimeout(400)
      }
      await page
        .waitForFunction(() => document.querySelectorAll('button[data-exhibit]').length > 0, null, { timeout: DRESSED_MS, polling: 500 })
        .catch(() => failures.push(`${vp.tag}: the ${slug} wing painted no row of close looks in ${DRESSED_MS / 1000} s, so it was read as it stood`))
    } else {
      walk.push(...LOBBY)
    }

    let stalls = 0
    for (const beat of walk) {
      const name = beat[0]
      const where = `${vp.tag}/${name}`
      entering(where)
      let labels = null
      try {
        labels = await within(where, STATION_MS, async () => {
          if (surface === 'wing') {
            const took = await page.evaluate((id) => window.__forge.station(id), beat[1])
            if (!took) {
              failures.push(`${where}: the frame refused to stand at this station`)
              return null
            }
            const at = await page.evaluate(() => window.__forge.state().stationId)
            if (at !== beat[1]) failures.push(`${where}: asked for ${beat[1]}, standing at ${at}`)
            /* A STATION IS READ WHERE THE WALKER STANDS. Asking the frame for
               a station walks the rail there and the room dresses on the way,
               so a reading taken on the asking read the frame's chrome over a
               room that was not built yet: no marks, no row, no card to open. */
            if (!(await arrive(page, beat[1], 60000)))
              failures.push(`${where}: the walker never completed the leg to this station`)
          } else {
            await page.evaluate(([p, o]) => {
              window.__forge.freeze(12.4)
              window.__forge.jump(p, o)
            }, [beat[1], beat[2]])
            await waitFor(page, beat[0])
          }
          await page.waitForTimeout(1700)
          return page.evaluate(() => window.__forge.labels())
        })
      } catch (err) {
        failures.push(err instanceof Stalled ? err.message : `${where}: ${err.message}`)
        if (++stalls >= STALLS_ALLOWED) {
          failures.push(`${vp.tag}: ${stalls} stations in a row never answered, so the walk ended here`)
          break
        }
        continue
      }
      stalls = 0
      if (labels === null) continue
      stations.push({ station: where, labels })
      const read = judge(labels, where, canon, langOf)

      say(
        `${where.padEnd(22)}${String(labels.length).padStart(3)} labels  ` +
          `${String(read.claims).padStart(2)} claims  ` +
          `${String(read.brands)} brand  ${String(read.persistent)} persistent  ` +
          `smallest target ${read.smallest === null ? 'none' : `${read.smallest} px`}`
      )

      if (surface !== 'wing' || !LOOKS) continue
      for (const id of await openableHere(page)) {
        /* ONE CARD, ONE READING PER VIEWPORT. A machine's row stands at both
           stations of its hall and a card is the same card wherever it was
           pressed, so an exhibit already read is not opened again: the walk
           reads every card once instead of the same fourteen four times. */
        if (readLooks.has(id)) continue
        readLooks.add(id)
        const inside = `${where}/${id}`
        entering(inside)
        try {
          await within(inside, LOOK_MS, async () => {
            if (!(await openLook(page, slug, beat[1], id))) {
              failures.push(`${inside}: the close look never opened`)
              await shutLook(page)
              return
            }
            await page.waitForTimeout(1400)
            const shown = await page.evaluate(() => window.__forge.labels())
            exhibits.push({ station: inside, labels: shown })
            const card = judge(shown, inside, canon, langOf)
            say(
              `  ${inside.padEnd(44)}${String(shown.length).padStart(3)} labels  ` +
                `${String(card.claims).padStart(2)} claims  ` +
                `smallest target ${card.smallest === null ? 'none' : `${card.smallest} px`}`
            )
            if (!(await shutLook(page))) failures.push(`${inside}: the close look never shut, so the walk went on with a window open`)
          })
        } catch (err) {
          failures.push(err instanceof Stalled ? err.message : `${inside}: ${err.message}`)
          await shutLook(page).catch(() => false)
        }
      }
    }
    entering(`${vp.tag} done, shutting the page`)
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

finish()

/** THE REPORT, THEN DOWN. The guard calls this from inside a walk that is
    still standing, so the server is stopped here too and the exit waits for
    the last write to leave: a report cut in half is a run that said nothing.
    The browser is this process's own and goes with it. */
function finish() {
  if (over) return
  over = true
  clearTimeout(guard)
  try {
    server?.kill()
  } catch {
    /* already down */
  }
  const atStations = stations.reduce((n, s) => n + s.labels.length, 0)
  const inLooks = exhibits.reduce((n, s) => n + s.labels.length, 0)
  const total = atStations + inLooks
  const out = []
  if (JSON_OUT) {
    out.push(JSON.stringify({
      surface: surface === 'wing' ? `wing/${slug}` : surface,
      stations, exhibits,
      labels: total, stationLabels: atStations, exhibitLabels: inLooks, looks: exhibits.length,
      walked: LOOKS ? 'stations and close looks' : 'stations only',
      failures, ok: failures.length === 0,
    }, null, 2))
  } else {
    out.push('')
    if (!total) out.push(`0 labels: ${surface === 'wing' ? `the ${slug} wing` : 'this surface'} carries no marks yet`)
    if (failures.length) {
      out.push('HONESTY CHECK FAILED:')
      for (const f of [...new Set(failures)]) out.push(` · ${f}`)
    } else {
      out.push(
        `honest: ${total} label(s) read (${atStations} at ${stations.length} station reading(s)` +
          `${LOOKS ? `, ${inLooks} in ${exhibits.length} close look(s)` : ', the close looks not walked'}), ` +
          'every claim on a class that may carry it'
      )
    }
  }
  process.stdout.write(`${out.join('\n')}\n`, () => process.exit(failures.length ? 1 : 0))
}
