#!/usr/bin/env node
/** THE STORY IMPORT. The wing's story layer is copied, never authored, so it
 * is generated from the story card instead of typed: a new pass of the card
 * is a re-run of this script.
 *
 * Run: node forge/story-import.mjs <path to the story card markdown> [--json]
 *
 * It writes `src/wings/vinci/story.ts` and refreshes the recipe hash of that
 * file's manifest record. Nothing is written when a stop lacks a language, a
 * pointer or a certainty, or when markup survives a displayed string.
 *
 * What it reads out of the card, by part:
 *   2  the stations in their order, with their chapter titles, age clocks,
 *      frames, lines, certainties and pointers, and the two chapter cuts
 *   3  the drawers, keyed by the station's number or by `quiet · <id>`
 *   4  the title wall            5  the exit's three things and its doors
 *   7  the canon sheet's keys, which every pointer resolves against
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = 'src/wings/vinci/story.ts'
const MANIFEST = 'assets/wing-vinci/manifest.json'
/** the one station of the card that the wing does not build today */
const NEW_STATION_ID = 'picture-room-lisa'

const args = process.argv.slice(2)
const JSON_OUT = args.includes("--json") // the report is JSON either way
const cardPath = args.find((a) => !a.startsWith('--'))
if (!cardPath) {
  console.error('story-import: name the story card markdown file')
  process.exit(2)
}

const refusals = []
const notes = []
const refuse = (code, at, says) => refusals.push({ code, at, says })

/* ------------------------------------------------------------ the reading */

const card = fs.readFileSync(cardPath, 'utf8')
const lines = card.split('\n')

/** the card marks every revision in the text it revised; the mark is the
 *  card's own bookkeeping and never a displayed word */
const stripMarks = (text) => text.replace(/\s*\*\*\[v\d+[\s\S]*?\]\*\*/g, '').trim()
const unquote = (text) => text.replace(/^[„“"']/, '').replace(/["”“']$/, '').trim()

function part(number) {
  const start = lines.findIndex((l) => l.startsWith(`## PART ${number} ·`))
  if (start < 0) throw new Error(`the card has no PART ${number}`)
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## PART ')) { end = i; break }
  }
  return lines.slice(start + 1, end)
}

/* ---------------------------------------------------------- part 7, canon */

const canon = []
{
  let current = null
  for (const line of part(7)) {
    const head = line.match(/^### (C\d{2}) · (.+)$/)
    if (head) { current = { id: head[1], title: head[2].trim(), body: '' }; canon.push(current); continue }
    if (current) current.body += `${line}\n`
  }
}
if (canon.length < 2) refuse('canon-sheet', 'part 7', 'the canon sheet parsed to fewer than two rows')

/** every id the card's pointers are written in, so a shared source between a
 *  stop and a canon row can be counted instead of guessed */
function sources(text) {
  const found = new Set()
  for (const m of text.matchAll(/\b([BWMH])(\d{2})\b/g)) found.add(`BD:${m[1]}${m[2]}`)
  for (const m of text.matchAll(/BD §(\d+)/g)) found.add(`BD:§${m[1]}`)
  for (const m of text.matchAll(/\b(life-\d{2})\b/g)) found.add(`TL:${m[1]}`)
  for (const m of text.matchAll(/SRC\/([A-Za-z0-9._-]+\.txt)/g)) found.add(`SRC:${m[1]}`)
  for (const m of text.matchAll(/\b(picture|sheet|machine|codex)\/([a-z0-9-]+(?:\/[a-z]+)?)/g)) found.add(`KEY:${m[1]}/${m[2]}`)
  for (const m of text.matchAll(/REC ([a-z][a-z-]+)/g)) found.add(`REC:${m[1]}`)
  for (const m of text.matchAll(/\bQ(\d{1,2})\b/g)) found.add(`XC:Q${m[1]}`)
  for (const m of text.matchAll(/(D-(?:LIFE|PLACE|PAINT|MS|MACH)) §(\d+(?:\.\d+)?)/g)) found.add(`${m[1]}:${m[2]}`)
  return found
}

const canonSources = canon.map((row) => sources(`${row.title}\n${row.body}`))
const frequency = new Map()
for (const set of canonSources) for (const id of set) frequency.set(id, (frequency.get(id) ?? 0) + 1)

/** A stop points at a canon row when they share a source, weighted by how
 *  many rows carry that source: one witness under five rows resolves
 *  nothing, one source that belongs to a single row resolves it. */
function resolve(stopSources) {
  const hits = []
  for (const [index, set] of canonSources.entries()) {
    let score = 0
    for (const id of stopSources) if (set.has(id)) score += 1 / frequency.get(id)
    if (score >= 0.999) hits.push(canon[index].id)
  }
  return hits
}

/* ------------------------------------------------------- part 2, the stops */

const CLOCK = /^(?:he is |age |about |near )?\d{1,3}$/i
const CLASSES = ['documented', 'reconstructed', 'conjectural', 'inferred', 'tradition', 'disputed']

const blocks = []
{
  let current = null
  for (const line of part(2)) {
    if (line.startsWith('### ')) { current = { heading: line.slice(4).trim(), body: [] }; blocks.push(current); continue }
    if (current && line.trim()) current.body.push(line.trim())
  }
}

const field = (body, name) => {
  const hit = body.find((l) => l.startsWith(`**${name}**`) || l.startsWith(`**${name}.**`))
  return hit ? stripMarks(hit.replace(new RegExp(`^\\*\\*${name}\\.?\\*\\*\\s*`), '')) : ''
}

/** the object in the frame the line is about, as the frame's first clause
 *  names it; a decimal inside a measurement is not a sentence end */
const firstClause = (frame) => {
  const cut = frame.search(/,|\.(?:\s+[A-Z]|$)/)
  return (cut < 0 ? frame : frame.slice(0, cut)).trim()
}

const stops = []
for (const block of blocks) {
  const segments = block.heading.split(' · ').map((s) => s.trim())
  const kind = segments[0] === 'CHAPTER CUT' ? 'cut' : 'station'
  const titles = (kind === 'cut' ? segments.slice(1).join(' · ') : segments[2] ?? '').split(' | ')
  const chapter = { en: stripMarks(titles[0] ?? ''), de: stripMarks(titles[1] ?? '') }
  if (kind === 'cut') {
    stops.push({
      kind, id: '', beat: null, quiet: false, chapter, age: null,
      line: { ...chapter }, drawer: null, certainty: '', sees: '', pointers: [], sourceIds: new Set(),
    })
    continue
  }
  const quiet = segments[0] === 'quiet'
  const idMatch = (segments[1] ?? '').match(/`([a-z-]+)`/)
  if (!idMatch) { refuse('station-id', block.heading, 'the heading carries no station id in backticks'); continue }
  const id = /NEW wall station/.test(segments[1]) ? NEW_STATION_ID : idMatch[1]
  const clock = segments.slice(3).find((s) => CLOCK.test(s)) ?? ''
  if (segments.length > 3 && !clock) notes.push(`${id}: the heading's third segment is not an age clock`)
  const pointer = field(block.body, 'POINTER')
  const certaintyLine = field(block.body, 'CERTAINTY').toLowerCase()
  const certainty = CLASSES.find((c) => certaintyLine.includes(c))
    ?? (/not known|unknown/.test(certaintyLine) ? 'unknown' : '')
  stops.push({
    kind, id, beat: quiet ? null : Number(segments[0]), quiet, chapter,
    age: clock ? { en: clock, de: clock } : null,
    line: { en: field(block.body, 'EN'), de: field(block.body, 'DE') },
    drawer: null,
    certainty,
    sees: firstClause(field(block.body, 'FRAME')),
    pointers: [],
    sourceIds: sources(pointer),
  })
}

/* ----------------------------------------------------- part 3, the drawers */

{
  let current = null
  for (const line of part(3)) {
    const head = line.match(/^\*\*(\d+|quiet) · ([a-z the-]+)\.\*\*/)
    if (head) {
      const key = head[1] === 'quiet' ? head[2].trim() : Number(head[1])
      current = stops.find((s) => (typeof key === 'number' ? s.beat === key : s.id === key))
      if (!current) refuse('drawer-key', line.slice(0, 40), 'no stop of part 2 carries this drawer key')
      continue
    }
    if (!current) continue
    const said = line.match(/^(EN|DE):\s*(.+)$/)
    if (said) {
      current.drawer = current.drawer ?? { en: '', de: '' }
      current.drawer[said[1].toLowerCase()] = unquote(stripMarks(said[2]))
      continue
    }
    const pointers = line.match(/^\*Pointers?:\s*([\s\S]+)\*$/)
    if (pointers) for (const id of sources(pointers[1])) current.sourceIds.add(id)
  }
}

/* -------------------------------------------- parts 4 and 5, wall and exit */

const quoted = (text) => {
  const pair = text.match(/"([^"]+)"\s*\|\s*„([^"]+)"/)
  return pair ? { en: pair[1], de: pair[2] } : null
}

const titleWall = { name: '', kicker: { en: '', de: '' }, prose: { en: '', de: '' }, buttons: [] }
{
  const body = part(4)
  let language = ''
  for (const line of body) {
    if (/^\*\*English\*\*/.test(line)) { language = 'en'; continue }
    if (/^\*\*German\*\*/.test(line)) { language = 'de'; continue }
    const said = line.match(/^>\s*(.+)$/)
    if (said && language) {
      const text = stripMarks(said[1])
      const name = text.match(/^\*\*(.+)\*\*$/)
      if (name) { titleWall.name = name[1]; continue }
      if (!/\p{Ll}/u.test(text)) titleWall.kicker[language] = text
      else titleWall.prose[language] = text
      continue
    }
    if (line.startsWith('Buttons:')) {
      for (const pair of line.replace(/^Buttons:\s*/, '').split(' · ')) {
        const words = pair.replace(/^small:\s*/, '').replace(/\.$/, '').split(' | ')
        if (words.length === 2) titleWall.buttons.push({ en: words[0].trim(), de: words[1].trim() })
      }
    }
  }
}

const exit = { things: [], doors: [] }
{
  const body = part(5)
  let language = ''
  const things = { en: [], de: [] }
  for (const line of body) {
    if (/^\*\*English\*\*/.test(line)) { language = 'en'; continue }
    if (/^\*\*German\*\*/.test(line)) { language = 'de'; continue }
    const numbered = line.match(/^\d+\.\s*(.+)$/)
    if (numbered && language) { things[language].push(stripMarks(numbered[1])); continue }
    if (line.startsWith('**The door.**')) {
      for (const piece of line.split('Then ')) {
        const pair = quoted(piece)
        if (pair) exit.doors.push(pair)
      }
    }
  }
  for (let i = 0; i < Math.max(things.en.length, things.de.length); i++) {
    exit.things.push({ en: things.en[i] ?? '', de: things.de[i] ?? '' })
  }
}

/* ------------------------------------------------- the pointers and the ids */

const wingStationIds = (() => {
  const source = fs.readFileSync(path.join(ROOT, 'src/wings/vinci/content.ts'), 'utf8')
  const union = source.match(/export type VinciStationId =([\s\S]*?);/)
  return new Set(union ? [...union[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]) : [])
})()

for (const [index, stop] of stops.entries()) {
  stop.order = index
  if (stop.kind === 'cut') continue
  const hits = resolve(stop.sourceIds)
  /* §16: nothing off the canon sheet may be written. Where the sheet holds no
     row for a stop, the card's own source ids stand in and the check warns. */
  stop.pointers = hits.length ? hits : [...stop.sourceIds].sort()
  stop.built = wingStationIds.has(stop.id)
  if (!hits.length) notes.push(`${stop.id}: the canon sheet holds no row for this stop`)
}
/* a title card stands on the facts of the station it opens */
for (const [index, stop] of stops.entries()) {
  if (stop.kind !== 'cut') continue
  const next = stops.slice(index + 1).find((s) => s.kind === 'station')
  stop.id = `cut-${stop.chapter.en.split('.')[0].toLowerCase().replace(/^the /, '').replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
  stop.certainty = next?.certainty ?? ''
  stop.pointers = next ? [...next.pointers] : []
  stop.built = false
}

/* ------------------------------------------------------------ the refusals */

for (const stop of stops) {
  const at = stop.id || stop.chapter.en
  for (const [name, text] of [['chapter', stop.chapter], ['line', stop.line]]) {
    for (const language of ['en', 'de']) {
      if (!text?.[language]?.trim()) refuse('language', at, `${name} has no ${language}`)
      else if (/\*\*|`|\[v\d/.test(text[language])) refuse('markup', at, `${name} ${language} still carries markup`)
    }
  }
  if (stop.drawer) {
    for (const language of ['en', 'de']) {
      if (!stop.drawer[language]?.trim()) refuse('language', at, `the drawer has no ${language}`)
      else if (/\*\*|`|\[v\d/.test(stop.drawer[language])) refuse('markup', at, `the drawer ${language} still carries markup`)
    }
  }
  if (!stop.pointers.length) refuse('pointer', at, 'the stop carries no pointer')
  if (!stop.certainty) refuse('certainty', at, 'the stop carries no certainty of the card\'s vocabulary')
  if (stop.kind === 'station' && !stop.sees) refuse('sees', at, 'the frame names no object')
  if (stop.kind === 'station' && stop.drawer === null) notes.push(`${at}: no drawer in part 3`)
}
for (const [name, value] of [['title wall name', titleWall.name], ['title wall kicker', titleWall.kicker.en],
  ['title wall prose', titleWall.prose.en], ['title wall prose de', titleWall.prose.de]]) {
  if (!value?.trim()) refuse('title-wall', name, 'the title wall is incomplete')
}
if (exit.things.length !== 3) refuse('exit', 'things', `the exit holds ${exit.things.length} things, not three`)
if (exit.doors.length !== 2) refuse('exit', 'doors', `the exit holds ${exit.doors.length} doors, not two`)

/* -------------------------------------------------------------- the writing */

const text = (value) => `{ en: ${JSON.stringify(value.en)}, de: ${JSON.stringify(value.de)} }`
const renderStop = (stop) => [
  '  {',
  `    id: ${JSON.stringify(stop.id)},`,
  `    order: ${stop.order},`,
  `    kind: ${JSON.stringify(stop.kind)},`,
  `    built: ${stop.built},`,
  `    quiet: ${stop.quiet},`,
  `    chapter: ${text(stop.chapter)},`,
  `    age: ${stop.age ? text(stop.age) : 'null'},`,
  `    line: ${text(stop.line)},`,
  `    drawer: ${stop.drawer ? text(stop.drawer) : 'null'},`,
  `    certainty: ${JSON.stringify(stop.certainty)},`,
  `    sees: ${JSON.stringify(stop.sees)},`,
  `    pointers: [${stop.pointers.map((p) => JSON.stringify(p)).join(', ')}],`,
  '  },',
].join('\n')

const file = `/* THE STORY LAYER of this wing: one stop per station of the story card, in
 * the card's order, and the card's own chapter cuts between them. Every
 * displayed string here is the card's, copied and not written, so this file
 * is generated by \`forge/story-import.mjs\` and never edited by hand.
 * Nothing shows it yet: \`forge/story-check.mjs\` measures it against the
 * house's text law before a surface reads a word of it. */
import type { VinciCertainty, VinciText } from './content';

/** The card classes a stop in the wing's four words and in three more the
 *  story sheet adds, so the story's vocabulary is the wing's plus those. */
export type VinciStoryCertainty = VinciCertainty | 'tradition' | 'inferred' | 'disputed';

export interface VinciStoryStop {
  id: string;
  order: number;
  kind: 'station' | 'cut';
  /** the wing builds this station today */
  built: boolean;
  quiet: boolean;
  chapter: VinciText;
  age: VinciText | null;
  line: VinciText;
  drawer: VinciText | null;
  certainty: VinciStoryCertainty;
  /** the object the frame must show, as the card's frame names it */
  sees: string;
  /** canon sheet keys, or the card's own source ids where the sheet has no row */
  pointers: readonly string[];
}

export interface VinciStoryCanonRow {
  id: string;
  title: string;
}

export interface VinciStoryTitleWall {
  name: string;
  kicker: VinciText;
  prose: VinciText;
  buttons: readonly VinciText[];
}

export interface VinciStoryExit {
  things: readonly VinciText[];
  doors: readonly VinciText[];
}

export const vinciStory: readonly VinciStoryStop[] = [
${stops.map(renderStop).join('\n')}
];

export const vinciStoryCanon: readonly VinciStoryCanonRow[] = [
${canon.map((row) => `  { id: ${JSON.stringify(row.id)}, title: ${JSON.stringify(row.title)} },`).join('\n')}
];

export const vinciStoryTitleWall: VinciStoryTitleWall = {
  name: ${JSON.stringify(titleWall.name)},
  kicker: ${text(titleWall.kicker)},
  prose: ${text(titleWall.prose)},
  buttons: [${titleWall.buttons.map(text).join(', ')}],
};

export const vinciStoryExit: VinciStoryExit = {
  things: [
${exit.things.map((thing) => `    ${text(thing)},`).join('\n')}
  ],
  doors: [
${exit.doors.map((door) => `    ${text(door)},`).join('\n')}
  ],
};

export function vinciStoryStop(id: string): VinciStoryStop | undefined {
  return vinciStory.find((stop) => stop.id === id);
}
`

const report = {
  checker: 'vinci-story-import',
  card: path.basename(cardPath),
  stops: stops.length,
  stations: stops.filter((s) => s.kind === 'station').length,
  cuts: stops.filter((s) => s.kind === 'cut').length,
  quiet: stops.filter((s) => s.quiet).length,
  canonRows: canon.length,
  drawers: stops.filter((s) => s.drawer).length,
  titleWall: { kicker: titleWall.kicker.en, buttons: titleWall.buttons.length },
  exit: { things: exit.things.length, doors: exit.doors.length },
  notes,
  refusals,
  written: false,
  ok: refusals.length === 0,
}

if (refusals.length) {
  console.log(JSON.stringify(report, null, 2))
  process.exit(1)
}

fs.writeFileSync(path.join(ROOT, OUT), file)
report.written = true
report.sha256 = createHash('sha256').update(fs.readFileSync(path.join(ROOT, OUT))).digest('hex')

/* the sealed file's record carries the hash of its recipe, so the import that
   changes the file is the import that refreshes the record */
const manifestPath = path.join(ROOT, MANIFEST)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const record = manifest.assets.find((entry) => `${entry.recipe_file ?? ''}${entry.note ?? ''}`.includes(OUT))
if (record && record.sha256 !== report.sha256) {
  record.sha256 = report.sha256
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  report.manifest = `${record.id} refreshed`
} else if (record) {
  report.manifest = `${record.id} unchanged`
} else {
  report.manifest = 'no record names this file yet'
}

console.log(JSON.stringify(report, null, 2))
process.exit(0)
