#!/usr/bin/env node
/** THE STORY CHECK. The limits of the house's story law, as machine rules, so
 * a wall of text is refused before a visitor meets it.
 * Run: node forge/story-check.mjs [--from <story card markdown>]
 *      node forge/story-check.mjs --selftest   (one broken stop per rule)
 * Exit 1 means a stop was refused. JSON on stdout, nothing else.
 *
 * The rules are `program/STORY-SYSTEM.md` §5 (the three layers and their
 * budgets), §6 (plain English and plain German) and §16 (the per-stop sheet
 * and the canon sheet). Every refusal carries the section it stands on.
 *
 * `--from` re-reads the card's canon sheet and refuses a story file whose
 * canon keys have drifted from it. Without it the check is offline and reads
 * the keys the import carried into the story file.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STORY = 'src/wings/vinci/story.ts'
const EXHIBITS = 'src/wings/vinci/data/lines.json'

/* THE TWO BANDS, named here once and nowhere else. A station's line stands in
   the label band under the picture, two rows of the serif at 30 on 40 over an
   860 px measure. A work's, a machine's or a page's line stands at the close
   look, on a 640 px measure with the kind's instruments beside it. Both
   numbers are measured on the wing's own drawings and hold in either
   language, because German runs longer in characters than English here. */
const STATION_LINE_CHARS = 120
const EXHIBIT_LINE_CHARS = 90

/** the rule, the section it stands on, and what it says in the report */
const RULES = {
  'line-words': ['§5', 'a line runs to at most twenty words'],
  'line-sentence': ['§5', 'no sentence of a line runs over fourteen words'],
  'line-chars-en': ['§5', `a station line holds ${STATION_LINE_CHARS} characters, the English included`],
  'line-chars-de': ['§6', `a station line holds ${STATION_LINE_CHARS} characters, the German included`],
  'exhibit-chars': ['§5', `an exhibit line holds ${EXHIBIT_LINE_CHARS} characters at the close look`],
  'exhibit-debt': ['§5', 'a line inside the band has no place on the re-authoring list'],
  'drawer-words': ['§5', 'a drawer runs 40 to 60 words'],
  'drawer-sentence': ['§5', 'no sentence of a drawer runs over fourteen words'],
  'dash': ['§13', 'the path carries no em dash and no en dash'],
  'semicolon': ['§13', 'the path carries no semicolon'],
  'question': ['§13', 'no question stands on the path, the door apart'],
  'language': ['§16', 'every stop stands in both languages'],
  'pointer': ['§16', 'a sentence without a pointer is a defect the machine refuses'],
  'pointer-key': ['§16', 'a pointer resolves to a key of the canon sheet'],
  'digits': ['§6', 'a number in digits in one language stands in digits in the other'],
  'certainty': ['§5', 'the certainty is one class of the story sheet'],
  'sees': ['§8', 'every line names the object its frame must show'],
}

const LINE_WORDS = 20
const SENTENCE_WORDS = 14
const LINE_CHARS = { en: STATION_LINE_CHARS, de: STATION_LINE_CHARS }
const DRAWER_WORDS = [40, 60]
/** The exhibit lines still waiting for their own re-authoring window. A line
 *  leaves this list when its words are written again from its catalogue fact,
 *  and an id whose line is already inside the band is refused, so the list can
 *  only ever shrink. */
const BAND_DEBT = new Set([])
const CLASSES = new Set(['documented', 'reconstructed', 'conjectural', 'unknown', 'inferred', 'tradition', 'disputed'])
/** a pointer that is not a canon key names its family and its own id */
const FOREIGN_POINTER = /^(?:BD|TL|SRC|XC|REC|KEY|D-[A-Z]+):.+$/

export const words = (text) => text.trim().split(/\s+/).filter(Boolean).length
export const characters = (text) => [...text].length

/** A sentence ends on a stop, a bang or a question followed by a capital.
 *  German writes ordinals with a period, so "2. Mai" and "19. Jahrhundert"
 *  are not two sentences, while a year ending a sentence still is. */
export function sentences(text, language) {
  const split = language === 'de'
    ? /(?<!(?<!\d)\d{1,2})[.!?]+\s+(?=[A-ZÄÖÜ0-9])/
    : /[.!?]+\s+(?=[A-ZÄÖÜ0-9])/
  return text.split(new RegExp(split, 'g')).map((s) => s.trim()).filter(Boolean)
}
const longestSentence = (text, language) => Math.max(0, ...sentences(text, language).map(words))
const digits = (text) => (text.match(/\d+/g) ?? []).map(Number)

/** THE RULES ON ONE STOP. Returned as codes so the self test can name the
 *  rule it expects instead of matching a sentence. */
export function judgeStop(stop, canonKeys) {
  const out = []
  const refuse = (rule, at, measured) => out.push([rule, at, measured])
  const pairs = [['chapter', stop.chapter], ['line', stop.line]]
  if (stop.drawer !== null && stop.drawer !== undefined) pairs.push(['drawer', stop.drawer])
  for (const [field, value] of pairs) {
    for (const language of ['en', 'de']) {
      const said = value?.[language]
      if (typeof said !== 'string' || !said.trim()) { refuse('language', `${field}.${language}`, 'empty'); continue }
      if (/[\u2014\u2013]/.test(said)) refuse('dash', `${field}.${language}`, said)
      if (said.includes(';')) refuse('semicolon', `${field}.${language}`, said)
      if (said.includes('?')) refuse('question', `${field}.${language}`, said)
    }
  }
  for (const language of ['en', 'de']) {
    const line = stop.line?.[language]
    if (typeof line !== 'string' || !line.trim()) continue
    if (words(line) > LINE_WORDS) refuse('line-words', `line.${language}`, `${words(line)} words`)
    if (longestSentence(line, language) > SENTENCE_WORDS)
      refuse('line-sentence', `line.${language}`, `${longestSentence(line, language)} words in one sentence`)
    if (characters(line) > LINE_CHARS[language])
      refuse(`line-chars-${language}`, `line.${language}`, `${characters(line)} characters`)
  }
  if (stop.drawer) {
    for (const language of ['en', 'de']) {
      const drawer = stop.drawer[language]
      if (typeof drawer !== 'string' || !drawer.trim()) continue
      if (words(drawer) < DRAWER_WORDS[0] || words(drawer) > DRAWER_WORDS[1])
        refuse('drawer-words', `drawer.${language}`, `${words(drawer)} words`)
      if (longestSentence(drawer, language) > SENTENCE_WORDS)
        refuse('drawer-sentence', `drawer.${language}`, `${longestSentence(drawer, language)} words in one sentence`)
    }
  }
  /* the pair rule: the two languages are written from one beat sheet, so a
     number stands in digits in both or in words in both */
  for (const [field, value] of pairs) {
    if (field === 'chapter' || typeof value?.en !== 'string' || typeof value?.de !== 'string') continue
    const en = digits(value.en), de = digits(value.de)
    if (en.length !== de.length) refuse('digits', field, `${en.length} in the English, ${de.length} in the German`)
  }
  if (!Array.isArray(stop.pointers) || stop.pointers.length === 0) refuse('pointer', 'pointers', 'none')
  else {
    for (const pointer of stop.pointers) {
      const canon = canonKeys.has(pointer)
      if (!canon && !FOREIGN_POINTER.test(pointer)) refuse('pointer-key', 'pointers', pointer)
    }
  }
  if (!CLASSES.has(stop.certainty)) refuse('certainty', 'certainty', String(stop.certainty))
  if (stop.kind === 'station' && !String(stop.sees ?? '').trim()) refuse('sees', 'sees', 'empty')
  return out
}

/** THE OTHER BAND. A work's, a machine's or a page's line is read at the close
 *  look and stands on its own measure, so it is judged apart from the stops. */
export function judgeExhibit(id, line, debt) {
  const out = []
  let over = false
  for (const language of ['en', 'de']) {
    const said = line?.[language]
    if (typeof said !== 'string' || !said.trim()) { out.push(['language', `${id}.${language}`, 'empty']); continue }
    if (characters(said) <= EXHIBIT_LINE_CHARS) continue
    over = true
    if (!debt.has(id)) out.push(['exhibit-chars', `${id}.${language}`, `${characters(said)} characters`])
  }
  if (debt.has(id) && !over) out.push(['exhibit-debt', id, 'inside the band and still on the list'])
  return out
}

/* ------------------------------------------------------------- the reading */

/** the story file compiled in memory; its one import is a type and is erased,
 *  so nothing else of the wing is loaded to read it */
function loadStory() {
  const source = fs.readFileSync(path.join(ROOT, STORY), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, {
    module, exports: module.exports,
    require: (id) => { throw new Error(`the story file must stand alone, it imports ${id}`) },
  })
  return module.exports
}

/** the canon keys as the card itself prints them, for the run that has the
 *  card at hand. The parse is one heading pattern deep and breaks if part 7
 *  ever renumbers its rows or changes its heading level. */
function canonOfCard(file) {
  const text = fs.readFileSync(file, 'utf8')
  const part = text.split(/^## PART 7 ·/m)[1] ?? ''
  return [...part.matchAll(/^### (C\d{2}) · /gm)].map((m) => m[1])
}

function run() {
  const story = loadStory()
  const errors = []
  const warnings = []
  const canonKeys = new Set((story.vinciStoryCanon ?? []).map((row) => row.id))
  const refuse = (rule, at, measured, id) => {
    const [section, says] = RULES[rule] ?? ['', '']
    errors.push({ rule, section, says, stop: id, at, measured: String(measured).slice(0, 140) })
  }

  const table = []
  const seen = new Set()
  for (const stop of story.vinciStory ?? []) {
    for (const [rule, at, measured] of judgeStop(stop, canonKeys)) refuse(rule, at, measured, stop.id)
    if (seen.has(stop.id)) refuse('language', 'id', 'the same id twice', stop.id)
    seen.add(stop.id)
    if (!stop.pointers?.some((pointer) => canonKeys.has(pointer)))
      warnings.push({ stop: stop.id, section: '§16', says: 'the canon sheet holds no row for this stop, so the card\'s own source ids stand in' })
    const numbers = (field) => {
      const value = stop[field]
      if (!value) return null
      const en = (value.en.match(/\d+/g) ?? []).join(' '), de = (value.de.match(/\d+/g) ?? []).join(' ')
      return en === de ? null : { stop: stop.id, section: '§6', says: `the ${field} reads ${en || 'no digits'} in the English and ${de || 'no digits'} in the German` }
    }
    for (const field of ['line', 'drawer']) { const said = numbers(field); if (said) warnings.push(said) }
    table.push({
      id: stop.id, kind: stop.kind, order: stop.order, certainty: stop.certainty,
      line: {
        wordsEn: words(stop.line.en), wordsDe: words(stop.line.de),
        charsEn: characters(stop.line.en), charsDe: characters(stop.line.de),
        sentenceEn: longestSentence(stop.line.en, 'en'), sentenceDe: longestSentence(stop.line.de, 'de'),
      },
      drawer: stop.drawer ? {
        wordsEn: words(stop.drawer.en), wordsDe: words(stop.drawer.de),
        sentenceEn: longestSentence(stop.drawer.en, 'en'), sentenceDe: longestSentence(stop.drawer.de, 'de'),
      } : null,
      pointers: stop.pointers,
    })
  }

  /* the title wall and the exit are displayed words too, under the same
     punctuation and both-languages rules; their length is their own layer's */
  const walls = [
    ['title wall kicker', story.vinciStoryTitleWall?.kicker],
    ['title wall prose', story.vinciStoryTitleWall?.prose],
    ...(story.vinciStoryTitleWall?.buttons ?? []).map((button, index) => [`title wall button ${index}`, button]),
    ...(story.vinciStoryExit?.things ?? []).map((thing, index) => [`exit thing ${index + 1}`, thing]),
    ...(story.vinciStoryExit?.doors ?? []).map((door, index) => [`exit door ${index + 1}`, door]),
  ]
  for (const [name, value] of walls) {
    for (const language of ['en', 'de']) {
      const said = value?.[language]
      if (typeof said !== 'string' || !said.trim()) { refuse('language', language, 'empty', name); continue }
      if (/[\u2014\u2013]/.test(said)) refuse('dash', language, said, name)
      if (said.includes(';')) refuse('semicolon', language, said, name)
      if (said.includes('?')) refuse('question', language, said, name)
      if (longestSentence(said, language) > SENTENCE_WORDS)
        refuse('line-sentence', language, `${longestSentence(said, language)} words in one sentence`, name)
    }
  }

  /* the exhibit lines, read from the wing's own data file: no surface of the
     story layer carries them, and they stand in the narrower band */
  const exhibits = JSON.parse(fs.readFileSync(path.join(ROOT, EXHIBITS), 'utf8')).lines ?? {}
  let overBand = 0
  for (const [id, line] of Object.entries(exhibits)) {
    const said = judgeExhibit(id, line, BAND_DEBT)
    for (const [rule, at, measured] of said) refuse(rule, at, measured, id)
    if (Math.max(characters(line.en ?? ''), characters(line.de ?? '')) > EXHIBIT_LINE_CHARS) overBand++
  }

  const from = process.argv[process.argv.indexOf('--from') + 1]
  let cardCanon = null
  if (process.argv.includes('--from') && from) {
    cardCanon = canonOfCard(from)
    if (cardCanon.join(',') !== [...canonKeys].join(','))
      refuse('pointer-key', 'canon', `the card reads ${cardCanon.join(' ')}`, 'the canon sheet')
  }

  return {
    checker: 'vinci-story',
    stops: (story.vinciStory ?? []).length,
    stations: (story.vinciStory ?? []).filter((s) => s.kind === 'station').length,
    cuts: (story.vinciStory ?? []).filter((s) => s.kind === 'cut').length,
    built: (story.vinciStory ?? []).filter((s) => s.built).length,
    canon: { rows: canonKeys.size, fromCard: cardCanon ? cardCanon.length : null },
    limits: {
      lineWords: LINE_WORDS, sentenceWords: SENTENCE_WORDS, drawerWords: DRAWER_WORDS,
      stationLineCharacters: STATION_LINE_CHARS, exhibitLineCharacters: EXHIBIT_LINE_CHARS,
    },
    exhibits: { read: Object.keys(exhibits).length, overBand, waiting: BAND_DEBT.size },
    titleWall: story.vinciStoryTitleWall ? { buttons: story.vinciStoryTitleWall.buttons.length } : null,
    exit: story.vinciStoryExit ? { things: story.vinciStoryExit.things.length, doors: story.vinciStoryExit.doors.length } : null,
    table,
    warnings,
    errors,
    ok: errors.length === 0,
  }
}

/* ------------------------------------------------------------ the selftest

   A rule nobody has seen refuse anything is a rule that may not work. Each
   case below breaks exactly one rule, and the real file is read in the same
   run: a checker that passes its own cases and refuses the wing is as broken
   as one that passes the wing and refuses nothing. */

const WHOLE = {
  id: 'case', order: 0, kind: 'station', built: true, quiet: false,
  chapter: { en: 'A room', de: 'Ein Raum' },
  age: null,
  line: { en: 'He drew what he saw. He wrote it down backwards.', de: 'Er zeichnete, was er sah. Er schrieb es rückwärts auf.' },
  drawer: {
    en: 'The page in front of you is a printed copy. He filled book after book with notes like these. Nobody knows why he wrote from right to left. A mirror reads the page back for you. Hold it against the open page and read one word.',
    de: 'Die Seite vor dir ist ein Nachdruck. Er füllte Buch um Buch mit solchen Notizen. Warum er von rechts nach links schrieb, weiß niemand. Ein Spiegel liest die Seite zurück. Halt ihn an die offene Seite und lies ein Wort.',
  },
  certainty: 'documented', sees: 'The open page on the table', pointers: ['C00'],
}
const broken = (change) => ({ ...WHOLE, ...change })
const LONG_EN = 'He drew the water and the birds. He drew the faces and the bones. He drew the walls and the light.'
const CASES = [
  ['a whole stop', WHOLE, []],
  ['a line over twenty words', broken({ line: { en: LONG_EN, de: WHOLE.line.de } }), ['line-words']],
  ['a sentence of a line over fourteen words',
    broken({ line: { en: 'He drew the water and the birds and the faces and the bones by hand.', de: WHOLE.line.de } }), ['line-sentence']],
  ['an English line at the station band',
    broken({ line: { en: 'He drew the waterwheels, the windmills and the riverbanks. He measured the shoulderblades and the collarbones afterward.', de: WHOLE.line.de } }), []],
  ['an English line over its characters',
    broken({ line: { en: 'He drew the waterwheels, the windmills and the riverbanks. He measured the shoulderblades and the collarbones afterwards.', de: WHOLE.line.de } }), ['line-chars-en']],
  ['a German line over its characters',
    broken({ line: { en: WHOLE.line.en, de: 'Er zeichnete die Wasserräder, die Windmühlen und die Flussufer. Danach vermaß er die Schulterblätter und die Schlüsselbeine genau.' } }), ['line-chars-de']],
  ['a drawer under forty words',
    broken({ drawer: { en: 'The page in front of you is a printed copy.', de: 'Die Seite vor dir ist ein Nachdruck.' } }), ['drawer-words', 'drawer-words']],
  ['a sentence of a drawer over fourteen words',
    broken({ drawer: { ...WHOLE.drawer, en: WHOLE.drawer.en.replace('The page in front of you is a printed copy.', 'The page in front of you on the table under the lamp is a printed copy of his own.') } }), ['drawer-sentence']],
  ['a dash on the path', broken({ line: { en: 'He drew what he saw \u2014 and wrote it backwards.', de: WHOLE.line.de } }), ['dash']],
  ['a semicolon on the path', broken({ line: { en: 'He drew what he saw; he wrote it backwards.', de: WHOLE.line.de } }), ['semicolon']],
  ['a question on the path', broken({ line: { en: 'What did he see here?', de: WHOLE.line.de } }), ['question']],
  ['a stop in one language', broken({ line: { en: WHOLE.line.en, de: '  ' } }), ['language']],
  ['a stop with no pointer', broken({ pointers: [] }), ['pointer']],
  ['a pointer off the canon sheet', broken({ pointers: ['C99'] }), ['pointer-key']],
  ['a number in digits in one language only',
    broken({ line: { en: 'He drew what he saw at 51. He wrote it down backwards.', de: WHOLE.line.de } }), ['digits']],
  ['a certainty outside the set', broken({ certainty: 'probable' }), ['certainty']],
  ['a line whose frame names no object', broken({ sees: '' }), ['sees']],
]

/* THE OTHER BAND, one line each way in either language. Each case declares the
   character count its own strings must have, so a typo in a literal cannot
   quietly move a case off the edge it is there to sit on. */
const AT_BAND = {
  en: 'A dealer sawed this panel up to sell the head alone. The pieces were joined again at last.',
  de: 'Ein Händler zerteilte die Tafel, um den Kopf zu verkaufen. Die Teile kamen am Ende zurück.',
}
const OVER = {
  en: 'A dealer sawed this panel up so the head could be sold alone. The pieces were joined again.',
  de: 'Ein Händler zersägte die Tafel, um den Kopf zu verkaufen. Die Teile kehrten am Ende zurück.',
}
const EXHIBIT_CASES = [
  ['an exhibit line at the band', 'picture/case/front', AT_BAND, false, [90, 90], []],
  ['an English exhibit line one character over', 'picture/case/front',
    { en: OVER.en, de: AT_BAND.de }, false, [91, 90], ['exhibit-chars']],
  ['a German exhibit line one character over', 'picture/case/front',
    { en: AT_BAND.en, de: OVER.de }, false, [90, 91], ['exhibit-chars']],
  ['a line still waiting for its window', 'sheet/rcin-919006', OVER, true, [91, 91], []],
  ['a waiting line that is now inside the band', 'sheet/rcin-919006', AT_BAND, true, [90, 90], ['exhibit-debt']],
]

function selftest() {
  const canonKeys = new Set(['C00', 'C01'])
  const bad = []
  for (const [said, stop, want] of CASES) {
    const got = judgeStop(stop, canonKeys).map(([rule]) => rule)
    if (got.join(',') !== want.join(',')) bad.push(`${said}: expected ${want.join(', ') || 'nothing'}, got ${got.join(', ') || 'nothing'}`)
  }
  for (const [said, id, line, waiting, lengths, want] of EXHIBIT_CASES) {
    const measured = [characters(line.en), characters(line.de)]
    if (measured.join(',') !== lengths.join(',')) bad.push(`${said}: the case reads ${measured.join(' and ')} characters, not ${lengths.join(' and ')}`)
    const got = judgeExhibit(id, line, waiting ? new Set([id]) : new Set()).map(([rule]) => rule)
    if (got.join(',') !== want.join(',')) bad.push(`${said}: expected ${want.join(', ') || 'nothing'}, got ${got.join(', ') || 'nothing'}`)
  }
  const wing = run()
  for (const line of bad) console.log(` · ${line}`)
  if (!wing.ok) for (const error of wing.errors) console.log(` · the wing: ${error.stop} ${error.at} ${error.rule} (${error.measured})`)
  const cases = CASES.length + EXHIBIT_CASES.length
  console.log(bad.length || !wing.ok
    ? `SELFTEST FAILED: ${bad.length} of ${cases} cases, the wing ${wing.ok ? 'passes' : 'is refused'}`
    : `selftest: ${cases} cases as written, and the wing's own ${wing.stops} stops and ${wing.exhibits.read} exhibit lines pass`)
  process.exitCode = bad.length || !wing.ok ? 1 : 0
}

if (process.argv.includes('--selftest')) {
  selftest()
} else {
  const report = run()
  console.log(JSON.stringify(report, null, 2))
  process.exitCode = report.errors.length ? 1 : 0
}
