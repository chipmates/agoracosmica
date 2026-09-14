#!/usr/bin/env node
/** THE REGISTER LINE. The bar's three registers of text, measured.
 * Run: node src/wings/vinci/register-check.mjs
 * Writes JSON to stdout only; exit 1 means a register refused a line.
 *
 * The label speaks and the drawer explains, so neither may carry an equation,
 * a bracket citation, a number with more than two decimals, or the hour's
 * symbols. The record behind "Read the evidence" carries all of them and is
 * never refused. This runs the machine bench's own copy selection, so it
 * reads the exact strings the fourteen stations display, in both languages.
 * No browser, renderer, layout or occlusion is exercised here.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const errors = []

/** Compile one local TypeScript module in memory, with its imports stubbed
 * out except the ones this check needs. Nothing is written to disk. */
function loadModule(relative, stubs = new Map()) {
  const file = path.resolve(root, relative)
  if (!file.startsWith(root + path.sep)) throw new Error(`read leaves app: ${relative}`)
  const source = fs.readFileSync(file, 'utf8')
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

const registers = loadModule('src/wings/vinci/machines/bench/registers.ts')
const doors = fs.readFileSync(path.join(root, 'src/wings/vinci/data/doors.json'), 'utf8')
const content = loadModule('src/wings/vinci/content.ts', new Map([
  ['./data/doors.json?raw', { default: doors }],
]))
const hour = loadModule('src/wings/vinci/machines/bench/hour.ts', new Map([
  ['../../content', content],
  ['./registers', registers],
]))

const records = JSON.parse(fs.readFileSync(path.join(root, 'src/wings/vinci/machines/data/records.json'), 'utf8'))
const slugs = Object.keys(records.complete)
const languages = ['en', 'de']
const stations = []

for (const slug of slugs) {
  const record = records.complete[slug]
  for (const language of languages) {
    const drawer = record.sections[language][1]?.body ?? ''
    const lines = [
      { register: 'label', text: record.title[language] },
      { register: 'label', text: record.label[language] },
      ...hour.benchHourLabelLines(language).map((text) => ({ register: 'label', text })),
      ...(registers.BENCH_ABSENCE[slug] ? [{ register: 'label', text: registers.BENCH_ABSENCE[slug][language] }] : []),
      { register: 'drawer', text: registers.withoutCitations(drawer) },
      { register: 'record', text: drawer },
      ...hour.benchHourRecord(language).lines.map((line) => ({ register: 'record', text: line.text })),
    ]
    const findings = registers.auditRegisters(`${slug}/${language}`, language, lines)
    for (const finding of findings)
      errors.push({ code: `register-${finding.code}`, id: finding.station, says: finding.says, line: finding.line.slice(0, 120) })
    const spokenHour = hour.benchHourLabelLines(language)[0] ?? ''
    if (!registers.hourIsSpoken(spokenHour, language))
      errors.push({ code: 'register-hour-not-spoken', id: `${slug}/${language}`, says: 'the hour on the label must read as a person says it', line: spokenHour })
    stations.push({
      station: slug,
      language,
      label: lines.filter((l) => l.register === 'label').length,
      drawer: lines.filter((l) => l.register === 'drawer').length,
      record: lines.filter((l) => l.register === 'record').length,
      refusals: findings.length,
      citationsMovedToTheRecord: /\[\s*\d+/.test(drawer),
    })
  }
}

const report = {
  checker: 'vinci-bench-registers',
  register: errors.length
    ? `${errors.length} refusal(s) over ${stations.length} station readings`
    : `refuses nothing on ${stations.length} station readings (${slugs.length} stations, ${languages.length} languages)`,
  replacesEyes: false,
  limitations: [
    'Source strings only: no browser, no layout, no rendered occlusion.',
    'The record register is never refused; it is the register the arithmetic belongs to.',
  ],
  stations,
  errors,
  ok: errors.length === 0,
}
console.log(JSON.stringify(report, null, 2))
process.exitCode = errors.length ? 1 : 0
