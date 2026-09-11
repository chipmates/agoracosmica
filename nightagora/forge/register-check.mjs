// THE REGISTER CHECK (bar §B14, measured, never scored from pixels).
// Whether a line reads like a museum wrote it is a judgement. Whether it
// carries a file path, a section sign, a question id, an error bar, a
// centimetre range or a four decimal azimuth is not, so a machine reads it
// and the judge quotes the number instead of hunting for it in a frame.
//
//   node forge/register-check.mjs <port> lobby
//   node forge/register-check.mjs <port> wing <slug>
//   node forge/register-check.mjs <port> wing vinci --json
//   node forge/register-check.mjs --selftest          (the rules, no browser)
//   node forge/register-check.mjs <port> wing vinci --dump   (every string read)
//
// THE THREE REGISTERS. Every visitor facing string belongs to one:
//   LABEL   one line in the museum's voice, the certainty word, nothing a
//           visitor would not say aloud. This is the DEFAULT: a string with
//           no marked ancestor is read as a label, so a wing that forgets to
//           mark is gated hardest, never softest.
//   DRAWER  a plain paragraph per element, the source named as a person
//           names it, the one number that matters. Marked by
//           `data-register="drawer"` on the drawer's root.
//   RECORD  the full machine chain (arithmetic, ranges, licence lines, file
//           keys, brief citations), opened on purpose, complete. Marked by
//           `data-register="record"` on its root, and EXEMPT from every rule
//           below. The register is resolved from the nearest marked
//           ancestor, so a record block inside a drawer is a record.
//
// The walk stands at every station of the surface, in both languages and at
// both viewports, and reads the strings TWICE: once with the drawers shut
// (the labels and the frame's own chrome are what a visitor sees) and once
// with them open (the drawer's paragraphs). A drawer is opened the way a
// visitor opens it, through the control that names it with `aria-controls`,
// so a drawer no control can open is reported instead of silently unread.
//
// GERMAN IS THE WORST CASE. The decimal separator flips with the page's
// language, so the same number is read as a decimal in one pass and as a
// thousands group in the other, and the German strings are their own text
// with their own offences.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import {
  APP_ROOT,
  assertAdapter,
  assertBackend,
  assertServer,
  browserArgs,
  VIEWPORTS,
  waitForServer,
} from './rig.mjs'

const argv = process.argv.slice(2)
const flags = argv.filter((a) => a.startsWith('--'))
const words = argv.filter((a) => !a.startsWith('--'))
const flag = (name, fallback) => {
  const hit = flags.find((f) => f === `--${name}` || f.startsWith(`--${name}=`))
  if (hit === undefined) return fallback
  const value = hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : ''
  return value === '' ? true : value
}
const port = Number(words[0] ?? process.env['FORGE_PORT'] ?? 5199)
const surface = words[1] ?? 'lobby'
const slug = surface === 'wing' ? (words[2] ?? 'vinci') : ''
const JSON_OUT = flags.includes('--json')
const SELFTEST = flags.includes('--selftest')
/** every string the walk read, not only the refused ones: what the seat
    that rewrites the text works from */
const DUMP = flags.includes('--dump')
const LANGS = String(flag('lang', 'en,de')).split(',').filter(Boolean)
const VPS = String(flag('viewport', 'desktop,mobile')).split(',').filter(Boolean)
const BASE = `http://localhost:${port}`
/** nothing under four pixels a side is text a visitor reads: it is the
    screen reader mirror, clipped to one pixel by its own stylesheet */
const MIN_PX = 4
/** the DOM settles synchronously, so this is the paint, not the GPU */
const SETTLE_MS = 260

const say = (line) => {
  if (!JSON_OUT) console.log(line)
}

/* --------------------------------------------------------------- the rules

   One entry per line of §B14. Each returns the substrings it refused, so a
   report names the offending words and not only the offending paragraph. */

const found = (text, re) => [...new Set([...text.matchAll(re)].map((m) => m[0].trim()))]

/** more than two decimals, in the separator the page's language uses. The
    other separator can still be a decimal point in a licence version or an
    untranslated number, so it is only forgiven where it really groups
    thousands: 1.234 is a number in German, 1,234 is a number in English,
    ODbL 1.0 is a licence in both, and 231.9005 is an azimuth nobody reads
    aloud in either. */
function overTwoDecimals(text, lang) {
  const decimal = lang === 'de' ? ',' : '.'
  const out = []
  for (const m of text.matchAll(/(\d+)([.,])(\d+)/g)) {
    const whole = m[1] ?? ''
    const sep = m[2]
    const digits = m[3] ?? ''
    const thousands = sep !== decimal && digits.length === 3 && whole.length <= 3 && whole !== '0'
    if (!thousands && digits.length > 2) out.push(m[0])
  }
  return [...new Set(out)]
}

export const RULES = [
  {
    id: 'file path',
    why: 'a visitor never reads a file name',
    find: (t) => found(t, /\b(?:brief|src|refs)\/[^\s,;)]*|\S*\.(?:md|json|csv)\b/gi),
  },
  {
    id: 'section code',
    why: 'a section sign or an S number is a citation, not a caption',
    find: (t) => found(t, /§\s?[\w.]*|\bS\d{1,3}\b/g),
  },
  {
    id: 'question id',
    why: 'a question id is the record’s own key',
    find: (t) => found(t, /\bQ\d{3}\b/g),
  },
  {
    id: 'error bar',
    why: 'a plus minus is arithmetic, and arithmetic lives in the record',
    find: (t) => found(t, /±\s?[\w.,]*/g),
  },
  {
    id: 'measured range',
    why: 'a range in metres or centimetres is a measurement, not a sentence',
    find: (t) => found(t, /\d+(?:[.,]\d+)?\s*[-–—]\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|km|m)\b/g),
  },
  {
    id: 'over two decimals',
    why: 'nobody says a four decimal number aloud',
    find: overTwoDecimals,
  },
  {
    /* the German forms stand beside the English words on purpose: the same
       word is as unreadable in the language the owner walks the wing in, and
       a rewrite that clears only the English leaves the worse half standing.
       The compounds are spelled out rather than stemmed, so `nennen` and
       `Nennung` stay ordinary German. */
    id: 'machine word',
    why: 'the machine’s vocabulary, not the museum’s',
    find: (t) =>
      found(
        t,
        /\b(?:procedural|prozedural\w*|exhibition proposal|ausstellungsvorschlag|scenario range|szenariobereich\w*|nominal|nenn(?:breite|höhe|maß|weite|wert)\w*|dossiers?)\b/gi
      ),
  },
]

/** every rule this string breaks, with what it broke them on */
export function judge(text, lang) {
  const hits = []
  for (const rule of RULES) {
    const on = rule.find(text, lang)
    if (on.length) hits.push({ rule: rule.id, why: rule.why, on })
  }
  return hits
}

/* ------------------------------------------------------------- the reading

   Runs in the page. It reads the DOM and not the source, for the reason the
   label graph does: a string that is only in the code is not a string on the
   frame, and a paragraph clipped to one pixel is not text a visitor reads. */
function readPage(minPx) {
  const BLOCK =
    'p,h1,h2,h3,h4,h5,h6,li,dt,dd,pre,blockquote,figcaption,caption,td,th,summary,label,button,a,option,legend,small'
  const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim()

  /** the nearest ancestor that scrolls. Text below a drawer's fold and a
      station name off the end of the rail are text a visitor scrolls to, so
      what has to be on screen is the container, not the line. */
  function scrollHost(el) {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (/auto|scroll/.test(`${cs.overflowY} ${cs.overflowX}`)) return n
    }
    return null
  }
  const boxOf = (el) => {
    const host = scrollHost(el)
    return host ? boxOf(host) : el
  }
  const inView = (el) => {
    const r = el.getBoundingClientRect()
    return !(r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth)
  }

  function onFrame(el) {
    const r = el.getBoundingClientRect()
    if (r.width < minPx || r.height < minPx) return false
    if (!inView(boxOf(el))) return false
    for (let n = el; n; n = n.parentElement) {
      if (n instanceof HTMLElement && n.hidden) return false
      const cs = getComputedStyle(n)
      if (cs.display === 'none' || cs.visibility === 'hidden') return false
      if (Number(cs.opacity) <= 0.02) return false
      // the visually hidden idiom: a clipping box too small to read in
      if (cs.overflow !== 'visible' || cs.clipPath !== 'none') {
        const rr = n.getBoundingClientRect()
        if (rr.width < minPx || rr.height < minPx) return false
      }
    }
    return true
  }

  const registerOf = (el) => {
    const holder = el.closest('[data-register]')
    return holder ? holder.getAttribute('data-register') || 'label' : 'label'
  }

  const strings = []
  const unknown = new Set()
  let record = 0
  const take = (el, text, kind) => {
    const value = norm(text)
    if (!value) return
    const register = registerOf(el)
    if (register === 'record') {
      record++
      return
    }
    if (register !== 'label' && register !== 'drawer') unknown.add(register)
    strings.push({ text: value, register, kind })
  }

  /** a block's words with any record subtree lifted out of them, so a
      record nested inside a drawer's paragraph keeps its exemption */
  const words = (el) => {
    if (!el.querySelector('[data-register="record"]')) return el.textContent
    const copy = el.cloneNode(true)
    for (const inner of copy.querySelectorAll('[data-register="record"]')) {
      record++
      inner.remove()
    }
    return copy.textContent
  }

  // the outermost text blocks only: an inner block's words are already in
  // its parent's reading, and one offence reported twice is noise
  for (const el of document.querySelectorAll(BLOCK)) {
    if (el.parentElement?.closest(BLOCK)) continue
    if (!onFrame(el)) continue
    take(el, words(el), 'text')
  }
  // text hung directly on something that is not a block at all
  for (const el of document.querySelectorAll('body *')) {
    if (el.matches(BLOCK) || el.closest(BLOCK)) continue
    if (!onFrame(el)) continue
    const direct = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue)
      .join(' ')
    take(el, direct, 'text')
  }
  // what a screen reader says instead of what the eye reads
  for (const el of document.querySelectorAll('[aria-label],[alt],[title],[placeholder]')) {
    if (!onFrame(el)) continue
    for (const attr of ['aria-label', 'alt', 'title', 'placeholder']) {
      const value = el.getAttribute(attr)
      if (value) take(el, value, attr)
    }
  }
  return { strings, record, unknown: [...unknown] }
}

/** every drawer on the page and whether it stands open */
function readDrawers() {
  const open = (root) => {
    if (root.hidden) return false
    const r = root.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) return false
    const cs = getComputedStyle(root)
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.02
  }
  return [...document.querySelectorAll('[data-register="drawer"]')].map((root) => ({
    id: root.id || '',
    open: open(root),
    hasControl: Boolean(root.id && document.querySelector(`[aria-controls="${CSS.escape(root.id)}"]`)),
  }))
}

/** open or shut every drawer the way a visitor does, through the control
    that names it. A drawer no control names is reported, never forced. */
function setDrawers(want) {
  const out = []
  for (const root of document.querySelectorAll('[data-register="drawer"]')) {
    const id = root.id
    const shown = !root.hidden && root.getBoundingClientRect().width >= 4
    if (shown === want) continue
    const control = id ? document.querySelector(`[aria-controls="${CSS.escape(id)}"]`) : null
    if (!control) {
      out.push(id || '(a drawer with no id)')
      continue
    }
    control.click()
  }
  return out
}

/* ---------------------------------------------------------------- the walk */

/** the lobby's own stations, in the order a visitor meets them */
const LOBBY = [
  ['agora', 'agora', {}],
  ['keeper', 'agora', { keeper: 1 }],
  ['wheel', 'wheel', { chapter: 0 }],
  ['pane', 'pane', { slug: 'vinci' }],
]

async function waitFor(page, state, ms = 8000) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (await page.evaluate((s) => document.body.dataset.forge === s, state)) return true
    await page.waitForTimeout(80)
  }
  return false
}

const errors = []
/** one entry per unique string, with every station that showed it */
const offences = new Map()
const everything = new Map()
const inventory = []
let seen = { label: 0, drawer: 0, record: 0 }

function collect(where, lang, read) {
  const counts = { label: 0, drawer: 0, record: read.record }
  seen.record += read.record
  for (const s of read.strings) {
    counts[s.register] = (counts[s.register] ?? 0) + 1
    seen[s.register] = (seen[s.register] ?? 0) + 1
    if (DUMP) {
      const k = `${s.register} ${lang} ${s.text}`
      const had = everything.get(k)
      if (had) {
        if (!had.stations.includes(where)) had.stations.push(where)
      } else {
        everything.set(k, { register: s.register, lang, kind: s.kind, text: s.text, stations: [where] })
      }
    }
    const hits = judge(s.text, lang)
    if (!hits.length) continue
    const key = `${s.register} ${lang} ${s.text}`
    const held = offences.get(key)
    if (held) {
      if (!held.stations.includes(where)) held.stations.push(where)
      if (!held.kinds.includes(s.kind)) held.kinds.push(s.kind)
      continue
    }
    offences.set(key, {
      register: s.register,
      lang,
      kind: s.kind,
      kinds: [s.kind],
      text: s.text,
      broke: hits,
      stations: [where],
    })
  }
  for (const r of read.unknown)
    errors.push(`${where}: data-register="${r}" is not one of label, drawer, record`)
  inventory.push({ station: where, lang, ...counts })
}

async function readHere(page, where, lang) {
  // shut first: the labels and the frame's chrome are what a visitor sees
  const orphaned = await page.evaluate(setDrawers, false)
  for (const id of orphaned) errors.push(`${where}: ${id} is a drawer no control opens`)
  await page.waitForTimeout(SETTLE_MS)
  collect(`${where} (shut)`, lang, await page.evaluate(readPage, MIN_PX))

  const drawers = await page.evaluate(readDrawers)
  if (!drawers.length) return
  await page.evaluate(setDrawers, true)
  await page.waitForTimeout(SETTLE_MS)
  const after = await page.evaluate(readDrawers)
  for (const d of after)
    if (!d.open)
      errors.push(
        `${where}: the drawer ${d.id || '(no id)'} never opened, its text was not read` +
          (d.hasControl ? '' : ' (no control names it with aria-controls)')
      )
  collect(`${where} (open)`, lang, await page.evaluate(readPage, MIN_PX))
}

async function walk() {
  const server = spawn('pnpm', ['exec', 'vite', '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
    cwd: APP_ROOT,
  })
  try {
    await waitForServer(BASE)
    const said = await assertServer(BASE)
    say(`server ${said.head.slice(0, 7)} at ${said.root}`)
    const browser = await chromium.launch({ args: browserArgs() })
    for (const lang of LANGS) {
      for (const name of VPS) {
        const vp = VIEWPORTS[name]
        if (!vp) {
          errors.push(`no such viewport: ${name}`)
          continue
        }
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
        await page.goto(`${BASE}/?lang=${lang}&tier=${tier}`)
        await page.waitForFunction(() => Boolean(window.__forge))
        await page.waitForTimeout(1500)
        await assertBackend(page)
        assertAdapter(firstLine, process.env['FORGE_BACKEND'] ?? 'webgpu')

        if (surface === 'wing') {
          await page.evaluate((s) => window.__forge.jump('wing', { slug: s }), slug)
          await waitFor(page, 'wing')
          const ids = await page.evaluate(() => window.__forge.state().stationIds ?? [])
          if (!ids.length) errors.push(`the ${slug} wing reports no station id: it cannot be addressed`)
          for (const id of ids) {
            const took = await page.evaluate((s) => window.__forge.station(s), id)
            if (!took) {
              errors.push(`${lang}/${vp.tag}/${id}: the frame refused to stand at this station`)
              continue
            }
            await page.waitForTimeout(SETTLE_MS)
            await readHere(page, `${lang}/${vp.tag}/${id}`, lang)
            say(`  ${lang}/${vp.tag}/${id}`)
          }
        } else {
          for (const [name_, state, opts] of LOBBY) {
            await page.evaluate(([p, o]) => {
              window.__forge.freeze(12.4)
              window.__forge.jump(p, o)
            }, [state, opts])
            await waitFor(page, name_ === 'keeper' ? 'agora' : state)
            await page.waitForTimeout(SETTLE_MS)
            await readHere(page, `${lang}/${vp.tag}/${name_}`, lang)
            say(`  ${lang}/${vp.tag}/${name_}`)
          }
        }
        await page.close()
      }
    }
    await browser.close()
  } catch (err) {
    errors.push(`RIG REFUSED: ${err.message}`)
  } finally {
    server.kill()
  }
}

/* ------------------------------------------------------------ the selftest

   The rules are the gate, so they are checked without a browser: a rule that
   refuses a museum sentence is worse than no rule at all. */
const FIXTURES = {
  refuse: [
    ['brief/CONCEPT-OPUS.md §3 S1', 'en'],
    ['brief/BUILDING-DOSSIER.md §Period labels', 'en'],
    ['Q119, Q128, Q178', 'en'],
    ['Basis: BUILDING-DOSSIER, Q001/Q124/Q127.', 'en'],
    ['Approximately ±2 minutes for solar events', 'en'],
    ['Proposed tree heights: 9.3–22 m', 'en'],
    ['brick 0.22–0.27 × 0.035–0.055 m', 'en'],
    ['Vorgeschlagene Baumhöhen: 9,3–22 m', 'de'],
    ['A = 231.9005° · h = 17.3882°', 'en'],
    ['47.4103 N, 0.9921 E', 'en'],
    ['ungefähr 24,8123 Prozent beleuchtet', 'de'],
    ['47,4103 N, 0,9921 O', 'de'],
    ['Baumhöhen 0.126 m', 'de'],
    ['These are procedural ranges for the exhibition', 'en'],
    ['Dies sind prozedurale Größenbereiche', 'de'],
    ['within the dossier’s T = 2–4 range', 'en'],
    ['Bereich des Dossiers', 'de'],
    ['the nominal eaves height', 'en'],
    ['Szenariobereich: −0,50–2,50 m', 'de'],
    ['Angenommene Nennbreite: 5 m', 'de'],
    ['Die vorgeschlagene Nennhöhe lässt 0,55 m frei', 'de'],
    ['see light-rig.json', 'en'],
  ],
  keep: [
    ['15:19 by the sun, 10 October 1517', 'en'],
    ['15:19 nach der Sonne, 10. Oktober 1517', 'de'],
    ['reconstructed · Arrival', 'en'],
    ['The house was rebuilt from the 1957 photographs and the cadastre.', 'en'],
    ['Das Haus wurde nach den Fotografien von 1957 und dem Kataster gebaut.', 'de'],
    ['OpenStreetMap contributors', 'en'],
    ['The wall stands 0.6 m thick.', 'en'],
    ['Die Mauer ist 0,6 m dick.', 'de'],
    ['Der Weg ist 1.234 m lang.', 'de'],
    ['The library holds 1,234 drawings.', 'en'],
    ['Ask them about this', 'en'],
    ['The day is 10 hours 40 minutes long.', 'en'],
    ['Clos Luce, Amboise, 10 October 1517', 'en'],
    ['Sunset at about 17:01, the sun 32.4 degrees high at noon.', 'en'],
    ['Rebuilt from the 1957 Monuments Historiques photographs.', 'en'],
    ['Nach den Fotografien der Monuments Historiques von 1957.', 'de'],
    ['He lived here from 1516 to 1519.', 'en'],
    ['Marcus Aurelius · Keeper of Tonight’s Fire', 'en'],
    ['Constellation I · Philosophers · five voices, after Cassiopeia', 'en'],
    ['Skip the overture · begin at the fire', 'en'],
    ['The moon is a waning crescent, about a quarter lit.', 'en'],
    ['Sources · L', 'en'],
    ['Quellen und Rekonstruktion', 'de'],
    ['© OpenStreetMap contributors · ODbL 1.0', 'en'],
    ['This wing is being researched and built.', 'en'],
    ['30 wings open · 1 in preparation', 'en'],
    ['Sie nennen ihn den Erfinder.', 'de'],
    ['Die Nennung im Kataster ist von 1517.', 'de'],
    ['ODbL 1.0. IGN · Licence Ouverte 2.0', 'de'],
    ['CC0 1.0 · ambientCG · stone-tuffeau', 'de'],
    ['Der Weg ist 1.234 m lang.', 'de'],
    ['ungefähr 24.8 Prozent beleuchtet', 'de'],
  ],
}

function selftest() {
  const bad = []
  for (const [text, lang] of FIXTURES.refuse)
    if (!judge(text, lang).length) bad.push(`MISSED  ${lang}  ${text}`)
  for (const [text, lang] of FIXTURES.keep) {
    const hits = judge(text, lang)
    if (hits.length) bad.push(`REFUSED ${lang}  ${text}  ->  ${hits.map((h) => h.rule).join(', ')}`)
  }
  const total = FIXTURES.refuse.length + FIXTURES.keep.length
  if (JSON_OUT) console.log(JSON.stringify({ selftest: true, cases: total, wrong: bad }, null, 2))
  else {
    for (const line of bad) console.log(` · ${line}`)
    console.log(bad.length ? `SELFTEST FAILED: ${bad.length} of ${total}` : `selftest: ${total} cases, all as written`)
  }
  process.exitCode = bad.length ? 1 : 0
}

/* ----------------------------------------------------------------- the run */

if (SELFTEST) {
  selftest()
} else {
  await walk()
  const list = [...offences.values()].sort(
    (a, b) => a.register.localeCompare(b.register) || a.lang.localeCompare(b.lang) || a.text.localeCompare(b.text)
  )
  const report = {
    surface: surface === 'wing' ? `wing/${slug}` : surface,
    langs: LANGS,
    viewports: VPS,
    read: seen,
    stations: inventory.length,
    inventory,
    offences: list,
    errors: [...new Set(errors)],
    ok: list.length === 0 && errors.length === 0,
    ...(DUMP ? { all: [...everything.values()] } : {}),
  }
  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    say('')
    say(
      `${seen.label} label string(s), ${seen.drawer} drawer string(s) read; ` +
        `${seen.record} exempt as record`
    )
    if (report.errors.length) {
      say('THE WALK COULD NOT READ EVERYTHING:')
      for (const e of report.errors) say(` · ${e}`)
    }
    if (DUMP) {
      for (const e of [...everything.values()].sort((a, b) => a.register.localeCompare(b.register) || a.text.localeCompare(b.text)))
        say(` [${e.register}] ${e.lang}  ${e.text}`)
      say('')
    }
    if (list.length) {
      say(`REGISTER CHECK FAILED: ${list.length} string(s) that do not belong on a label or in a drawer`)
      for (const o of list) {
        say('')
        say(` [${o.register}] ${o.lang}  ${o.kinds.join(', ')}`)
        say(`   ${o.text}`)
        for (const b of o.broke) say(`   ${b.rule}: ${b.on.join(' | ')}  (${b.why})`)
        say(`   at: ${o.stations.slice(0, 6).join(', ')}${o.stations.length > 6 ? ` and ${o.stations.length - 6} more` : ''}`)
      }
    } else if (!report.errors.length) {
      say('every label and every drawer string reads like a museum wrote it')
    }
  }
  process.exitCode = report.ok ? 0 : 1
}
