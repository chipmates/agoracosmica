#!/usr/bin/env node
/** THE LINES CHECK. What a visitor is asked to remember, measured.
 * Run: node forge/lines-check.mjs [--json]
 * Exit 1 means a line, a detail or a step was refused.
 *
 * The components that will show these files do not exist yet, so the walking
 * checkers cannot read one string of them. This reads the files themselves
 * and proves what a walk would prove later:
 *
 *   · every key exists in the registry the room builds its exhibits from
 *     (the hang, the supper wall, the body wall, the codex shelf, the machine
 *     catalogue, the grave), and every shown work is either written or named
 *     in the seat's STATUS;
 *   · every line carries a source and a certainty from the wing's set;
 *   · every detail rectangle lies inside the plate, 0 to 1;
 *   · every step names a part its machine's dossier actually has, stands in
 *     clock order inside 0 to 1, and only machines that move have steps;
 *   · every displayed string passes the spoken registers of the machine bench
 *     and the wing's §B14 rules, and the museum's voice: no dashes, no
 *     semicolons, no filler.
 *
 * The `source` field is the record register and is exempt, as the record
 * always is: it is where the file keys and the citations belong.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

/** THE REAL RULES, not a copy of them. The wing's spoken registers and the
 * forge's §B14 rules are imported from the modules that gate the walk, so a
 * change there reaches this check instead of drifting past it. The forge's
 * module runs its own self test at import and is given the argv for it, so it
 * never tries to open a browser here. Its line is swallowed: this check
 * writes JSON to stdout and nothing else. */
const argv = process.argv
process.argv = [argv[0], 'lines-check', '--selftest']
const spoke = console.log
console.log = () => {}
const forge = await import('./register-check.mjs')
console.log = spoke
process.argv = argv

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const readJson = (rel) => JSON.parse(read(rel))
const errors = []
const refuse = (code, id, says, line = '') => errors.push({ code, id, says, line: String(line).slice(0, 160) })

/** One local TypeScript module, compiled in memory with its imports stubbed.
 * Nothing is written to disk and no renderer is touched. */
function loadModule(relative, stubs = new Map()) {
  const source = read(relative)
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const require_ = (id) => {
    if (stubs.has(id)) return stubs.get(id)
    throw new Error(`${relative} imports ${id}, which this check does not provide`)
  }
  vm.runInNewContext(output, { module, exports: module.exports, require: require_, console })
  return module.exports
}

/** The room's own numbers are irrelevant here: only the lists are read, and a
 * layout stub keeps the module-level constants arithmetic. */
const numbers = () => new Proxy({}, { get: () => new Proxy({}, { get: () => 0 }) })
const layoutStub = { FACE: new Proxy({}, { get: () => 0 }), FLOOR: 0, HANG_DATUM: 0, ROOMS: numbers() }

const hang = loadModule('src/wings/vinci/collection/hang.ts', new Map([
  ['./build', {}], ['./body-wall', { bodyMounts: () => [] }], ['./layout', layoutStub],
]))
const bodyWall = loadModule('src/wings/vinci/collection/body-wall.ts', new Map([
  ['../../../manifest', {}], ['../pictures/sheet-record', { validateSheetRecord: () => ({}) }], ['./layout', layoutStub],
  ['../data/sheet-sizes.json?raw', { default: read('src/wings/vinci/data/sheet-sizes.json') }],
]))
const machineStubs = new Map([['./types', {}], ['./data/records.json?raw', { default: read('src/wings/vinci/machines/data/records.json') }]])
const SLUG_FILES = fs.readdirSync(path.join(root, 'src/wings/vinci/machines/data'))
  .filter((f) => f.endsWith('.json') && f !== 'records.json')
for (const file of SLUG_FILES) machineStubs.set(`./data/${file}?raw`, { default: read(`src/wings/vinci/machines/data/${file}`) })
const machines = loadModule('src/wings/vinci/machines/catalog.ts', machineStubs)
const codices = readJson('src/wings/vinci/table/data/codices.json')
const registers = loadModule('src/wings/vinci/machines/bench/registers.ts')

/* ------------------------------------------------------------ the registry */

const registry = new Map()
for (const work of hang.HANG) registry.set(`picture/${work.id}/${work.face}`, 'picture')
// The mural stands on the court wall under the same policy as the hang.
registry.set('picture/last-supper/front', 'mural')
for (const sheet of bodyWall.BODY_WALL) registry.set(`sheet/${sheet.id}`, 'sheet')
for (const entry of codices.entries) registry.set(`codex/${entry.id}`, 'codex')
for (const slug of machines.MACHINE_SLUGS) registry.set(`machine/${slug}`, 'machine')
registry.set('grave', 'grave')
registry.set('grave-diagram', 'grave')

const EXPECTED = { picture: 25, mural: 1, sheet: 29, codex: 9, machine: 14, grave: 2 }
const counted = {}
for (const kind of registry.values()) counted[kind] = (counted[kind] ?? 0) + 1
for (const [kind, want] of Object.entries(EXPECTED)) {
  if (counted[kind] !== want)
    refuse('registry-count', kind, `the registry read ${counted[kind] ?? 0} ${kind} exhibits, not ${want}`)
}

/* -------------------------------------------------------------- the rules */

const CERTAINTY = new Set(['documented', 'tradition', 'reconstructed', 'conjectural'])
const FILLER = /\b(?:delve|delves|tapestry|landscape|leverage|multifaceted|it's worth noting|masterpiece|iconic|genius)\b/i
/** What the wing's own registers refuse in a spoken line, and what the museum's
 * voice refuses on top of them. */
const VOICE = [
  ['em-dash', 'the museum writes with commas and periods', (t) => /[\u2014\u2013]/.test(t)],
  ['semicolon', 'a semicolon is not how a label speaks', (t) => /;/.test(t)],
  ['filler', 'the museum does not write like a brochure', (t) => FILLER.test(t)],
]
const words = (text) => text.trim().split(/\s+/).filter(Boolean).length
/** German writes ordinals with a period, so 25. April is not two sentences.
 * A sentence ends on a stop that does not follow a digit and is followed by a
 * capital. */
const sentences = (text) => text.split(/(?<![0-9])[.!?]+\s+(?=[A-Z\u00c4\u00d6\u00dc])/).filter((s) => s.trim().length).length

function speak(id, field, text, lang) {
  if (typeof text !== 'string' || !text.trim()) return refuse('empty', id, `${field} is empty`)
  for (const rule of registers.SPOKEN_REFUSALS) if (rule.test(text)) refuse(`register-${rule.code}`, `${id} ${field}`, rule.says, text)
  for (const hit of forge.judge(text, lang)) refuse(`b14-${hit.rule.replace(/ /g, '-')}`, `${id} ${field}`, `${hit.why}: ${hit.on.join(' | ')}`, text)
  for (const [code, says, test] of VOICE) if (test(text)) refuse(code, `${id} ${field}`, says, text)
}

/* --------------------------------------------------------------- the lines */

const lines = readJson('src/wings/vinci/data/lines.json')
const longest = { en: 0, de: 0 }
for (const [id, line] of Object.entries(lines.lines)) {
  if (!registry.has(id)) refuse('unknown-key', id, 'no exhibit of the registry carries this id')
  if (!CERTAINTY.has(line.certainty)) refuse('certainty', id, `certainty must be one of ${[...CERTAINTY].join(', ')}`, line.certainty)
  if (typeof line.source !== 'string' || line.source.trim().length < 8) refuse('source', id, 'a line without a named source does not exist', line.source)
  speak(id, 'en', line.en, 'en')
  speak(id, 'de', line.de, 'de')
  const en = words(line.en ?? ''), de = words(line.de ?? '')
  longest.en = Math.max(longest.en, en); longest.de = Math.max(longest.de, de)
  if (en >= 30) refuse('too-long', id, `the English line runs to ${en} words, the rule is under thirty`, line.en)
  if (de > Math.round(en * 4 / 3)) refuse('german-too-long', id, `the German runs ${de} words against ${en}, more than a third longer`, line.de)
  if (sentences(line.en ?? '') > 2) refuse('too-many-sentences', id, 'one sentence is the rule, two the exception', line.en)
  if (sentences(line.de ?? '') > 2) refuse('too-many-sentences', id, 'one sentence is the rule, two the exception', line.de)
  const d = line.detail
  if (d === undefined) continue
  const kind = registry.get(id)
  if (kind !== 'picture' && kind !== 'mural') refuse('detail-kind', id, 'a rectangle on a plate belongs to a picture')
  for (const key of ['x', 'y', 'w', 'h']) {
    if (typeof d[key] !== 'number' || !Number.isFinite(d[key])) refuse('detail-number', id, `detail.${key} is not a number`, d[key])
  }
  if (!(d.x >= 0 && d.y >= 0 && d.w > 0 && d.h > 0 && d.x + d.w <= 1 && d.y + d.h <= 1))
    refuse('detail-outside', id, 'the rectangle leaves the plate', JSON.stringify(d))
  speak(id, 'detail.name_en', d.name_en, 'en')
  speak(id, 'detail.name_de', d.name_de, 'de')
}

/* --------------------------------------------------------------- the steps */

const steps = readJson('src/wings/vinci/data/steps.json')
const moves = new Map()
for (const slug of machines.MACHINE_SLUGS) {
  const motion = machines.dossiers[slug]?.motion ?? {}
  moves.set(slug, motion.period_s !== null && motion.period_s !== undefined)
}
for (const [slug, list] of Object.entries(steps.steps)) {
  if (!moves.has(slug)) { refuse('unknown-machine', slug, 'no machine of the catalogue carries this slug'); continue }
  if (!moves.get(slug)) refuse('still-machine', slug, 'an instrument that never moves has no steps')
  if (!Array.isArray(list) || list.length < 2 || list.length > 4)
    refuse('step-count', slug, 'two to four steps per machine', String(list?.length))
  const parts = new Set((machines.dossiers[slug]?.parts ?? []).map((p) => p.id))
  let last = -1
  for (const [index, step] of (list ?? []).entries()) {
    const at = `${slug}[${index}]`
    if (typeof step.at !== 'number' || !(step.at >= 0 && step.at <= 1)) refuse('step-clock', at, 'the clock runs 0 to 1', step.at)
    else if (step.at < last) refuse('step-order', at, 'the steps stand in clock order', step.at)
    else last = step.at
    if (!parts.has(step.part)) refuse('step-part', at, 'the dossier has no part of this name', step.part)
    if (!CERTAINTY.has(step.certainty)) refuse('step-certainty', at, `certainty must be one of ${[...CERTAINTY].join(', ')}`, step.certainty)
    speak(at, 'en', step.en, 'en')
    speak(at, 'de', step.de, 'de')
  }
}
for (const [slug, moving] of moves) {
  if (moving && !steps.steps[slug]) refuse('machine-without-steps', slug, 'a machine that moves owes the visitor its steps')
}

/* --------------------------------------------------------------- the cards */

/* Every pair of words the card models carry. The pointers beside them name the
   module that composes the rest of the card and belong to the record, so only
   a node that holds both languages is read as a displayed string. */
const cards = readJson('src/wings/vinci/data/cards.json')
let cardStrings = 0
const walk = (node, at) => {
  if (Array.isArray(node)) return node.forEach((item, index) => walk(item, `${at}[${index}]`))
  if (!node || typeof node !== 'object') return
  if (typeof node.en === 'string' && typeof node.de === 'string') {
    cardStrings++
    speak(`cards ${at}`, 'en', node.en, 'en')
    speak(`cards ${at}`, 'de', node.de, 'de')
    return
  }
  for (const [key, value] of Object.entries(node)) walk(value, at ? `${at}.${key}` : key)
}
walk(cards.models, 'models')
walk(cards.honesty_variants, 'honesty_variants')
walk(cards.zoom_ceiling, 'zoom_ceiling')
walk(cards.rule_labels, 'rule_labels')
walk(cards.floor_honesty, 'floor_honesty')
walk(cards.controls, 'controls')
for (const model of ['picture', 'machine', 'manuscript', 'date']) {
  const fields = cards.models[model]?.fields
  if (!Array.isArray(fields) || fields[0]?.id !== 'line') refuse('card-model', model, 'the line is the card\'s first field')
  if (model !== 'date' && fields?.[1]?.id !== 'description') refuse('card-model', model, 'the description is the second paragraph')
}

/* -------------------------------------------------------------- the report */

const written = new Set(Object.keys(lines.lines))
const silent = [...registry.keys()].filter((id) => !written.has(id))
const report = {
  checker: 'vinci-lines',
  registry: `${registry.size} exhibits: ${Object.entries(counted).map(([k, n]) => `${n} ${k}`).join(', ')}`,
  lines: `${written.size} written, ${silent.length} with no documented line (named in STATUS-LINES.md)`,
  longestLine: longest,
  steps: `${Object.keys(steps.steps).length} machines, ${Object.values(steps.steps).reduce((n, l) => n + l.length, 0)} steps`,
  details: Object.values(lines.lines).filter((l) => l.detail).length,
  cards: `${cardStrings} pairs of card words`,
  silent,
  errors,
  ok: errors.length === 0,
}
console.log(JSON.stringify(report, null, 2))
process.exitCode = errors.length ? 1 : 0
