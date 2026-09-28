#!/usr/bin/env node
/** THE OPENING DRAWING'S RIGHTS, checked offline.
 * Run: node src/wings/vinci/pictures/opening-check.mjs [--entry=<record.json>] [--files=<dir>] [--source=<original>]
 * Writes JSON to stdout; exit 1 means a check failed. No browser, no network.
 *
 * It runs the register module itself and holds it to the rights policy: the
 * Tier 2 sentences verbatim, the Italian code line, the holder and inventory,
 * the photographer, the correction named non-creative. It refuses the record
 * edits the card must refuse. The store's own record is admitted when the
 * merged manifest carries it; a candidate record and its bytes may be given
 * before the coordinator writes them to the store.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../../..')
const flags = new Map(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const at = a.indexOf('=')
  return at < 0 ? [a.slice(2), 'true'] : [a.slice(2, at), a.slice(at + 1)]
}))

function load(file) {
  const source = readFileSync(file, 'utf8')
  const exports = {}
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new vm.Script(js, { filename: file }).runInNewContext({ exports, require(dependency) {
    // the register reads its own data file and nothing else
    if (dependency === './data/opening-drawings.json?raw') return { default: readFileSync(resolve(here, 'data/opening-drawings.json'), 'utf8') }
    throw new Error(`The register must stand alone: ${dependency}`)
  } })
  return exports
}
const register = load(resolve(here, 'opening-register.ts'))
const words = JSON.parse(readFileSync(resolve(here, '../data/opening.json'), 'utf8'))
const drawing = register.ARNO_1473
const honesty = register.openingHonesty(drawing)

const results = []
function test(name, check) {
  try { check(); results.push({ name, ok: true }) } catch (error) { results.push({ name, ok: false, error: error.message }) }
}

/** the policy's Tier 2 label, as RIGHTS-POLICY.md writes it, for a drawing */
const POLICY_TIER2 = 'Public domain work. Reproduction from Wikimedia Commons. The museum labels the reproduction, not the drawing. Non-profit cultural use.'
/** displayed text: no dashes a person would not type, no semicolons, no address */
function clean(text, where) {
  assert(!/[—–]/.test(text), `${where} carries an em or en dash`)
  assert(!text.includes(';'), `${where} carries a semicolon`)
  assert(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(text), `${where} carries an email address`)
}

test('the register names the work, the holder, the inventory and the date', () => {
  assert.equal(drawing.title.en, 'Landscape of the Arno valley')
  assert.match(drawing.holder.en, /^Gallerie degli Uffizi, Florence$/)
  assert.equal(drawing.inventory.en, 'inv. 8 P')
  assert.equal(drawing.date, '1473-08-05')
  assert.equal(drawing.date_label.en, '5 August 1473')
  assert.equal(drawing.date_label.de, '5. August 1473')
  assert.equal(drawing.date_certainty, 'documented')
  assert.equal(drawing.holder_type, 'italian-state')
})
test('the reproduction is Tier 2 from the approved Commons file', () => {
  assert.equal(drawing.tier, 'TIER2')
  assert.equal(drawing.class, 'PD-ART')
  const photo = drawing.photograph
  assert.match(photo.file, /^File:Paysage de la vallée de l'Arno, Leonard de Vinci \(Uffizi, inv\. 8 P\)\.jpg$/)
  assert.equal(photo.commons_pageid, 84868721)
  assert.equal(photo.sha1, '63760afb8aa838871707a187832580233092aa28')
  assert.deepEqual([photo.width, photo.height], [2816, 2112])
  assert.equal(photo.licence_template, 'PD-self')
  assert(photo.by.trim(), 'the photographer is not named')
  assert(photo.licence_line.includes(photo.by), 'the licence line does not credit the photographer')
  assert.match(drawing.rights.decision, /2026-09-28/)
})
test('the honesty lines carry the policy, the photographer, the correction and the code', () => {
  assert(honesty.en.includes(POLICY_TIER2), 'EN lacks the Tier 2 sentences')
  assert(honesty.de.includes(register.TIER2_DRAWING_HONESTY.de), 'DE lacks the Tier 2 sentences')
  for (const language of ['en', 'de']) {
    const line = honesty[language]
    assert(line.startsWith(drawing.title[language]), `${language} does not open with the work`)
    assert(line.includes(drawing.photograph.by), `${language} does not credit the photographer`)
    assert(line.includes(drawing.inventory[language]), `${language} lacks the inventory`)
    assert(line.includes(drawing.holder[language]), `${language} lacks the holder`)
    assert(line.endsWith(register.ITALIAN_CODE_LINE[language]), `${language} does not end with the code line`)
    assert(/3-bis/.test(line), `${language} does not name paragraph 3-bis`)
    assert(language === 'en' ? /non-creative correction/.test(line) : /nicht schöpferische Korrektur/.test(line), `${language} does not name the correction`)
    clean(line, `honesty ${language}`)
  }
})
test('the correction is non-creative and names every step', () => {
  assert.equal(drawing.correction.kind, 'non-creative')
  const said = drawing.correction.steps.map(step => step.en).join(' ')
  assert.match(said, /projective transform/)
  assert.match(said, /cropped/)
  assert.match(said, /No retouching/)
  for (const step of drawing.correction.steps) for (const language of ['en', 'de']) clean(step[language], `correction ${language}`)
})
test('the label on the card is the honesty line and the code line, whole', () => {
  for (const language of ['en', 'de']) {
    const parts = register.openingLabel(drawing, language)
    assert.equal(parts.join(' '), honesty[language])
    assert.equal(parts.length, 2)
    assert.equal(parts[1], register.ITALIAN_CODE_LINE[language])
    for (const part of parts) clean(part, `label ${language}`)
  }
})
test('the words stand by key in both languages and keep the facts sheet\'s limits', () => {
  const arno = words.opening?.arno
  assert(arno, 'no opening.arno')
  for (const key of ['line', 'start', 'credit']) for (const language of ['en', 'de']) {
    const said = arno[key]?.[language]
    assert(typeof said === 'string' && said.trim(), `opening.arno.${key} lacks ${language}`)
    clean(said, `opening.arno.${key} ${language}`)
  }
  assert(!/\bfirst drawing\b/i.test(arno.line.en) && !/\berste Zeichnung\b/i.test(arno.line.de), 'the line claims the first drawing')
  assert(/\bdated\b/.test(arno.line.en) && /datiert/.test(arno.line.de), 'the line drops "dated"')
  assert(!/birthplace|born|Geburtsort|geboren/i.test(`${arno.line.en} ${arno.line.de}`), 'the line names a birthplace view')
  for (const language of ['en', 'de']) assert(arno.credit[language].includes(drawing.photograph.by), `the ${language} credit does not name the photographer`)
})

/* A GOOD RECORD, built from the register the way the store writes it; the
   card must admit it and refuse each edit below. */
function goodRecord() {
  return {
    id: drawing.manifest_id, role: drawing.role, wing: 'vinci', class: 'PD-ART', tier: 'TIER2', display: true,
    licence: drawing.photograph.licence_line, honesty_en: honesty.en, honesty_de: honesty.de,
    source_url: drawing.photograph.source_url, source_sha1: drawing.photograph.sha1,
    path: `${drawing.path_stem}__2567x1761.jpg`, width: 2567, height: 1761, bytes: 10, sha256: 'a'.repeat(64),
    previews: [{ path: `${drawing.path_stem}__1280x878.jpg`, width: 1280, height: 878, bytes: 5, sha256: 'b'.repeat(64) }],
  }
}
test('the card admits a record that matches the register, smallest file first', () => {
  const admitted = register.admitOpeningRecord(goodRecord(), drawing)
  assert(admitted.ok, admitted.reason)
  // the register runs in its own realm: compare values, not arrays
  assert.equal(admitted.files.map(f => f.width).join(' '), '1280 2567')
})
test('the card refuses every edit the label no longer matches', () => {
  const edits = {
    'no record': () => undefined,
    'a Tier 1 claim': r => ({ ...r, tier: 'TIER1' }),
    'not for display': r => ({ ...r, display: false }),
    'another class': r => ({ ...r, class: 'CC0' }),
    'an edited honesty line': r => ({ ...r, honesty_en: r.honesty_en.replace('drawing', 'painting') }),
    'another licence line': r => ({ ...r, licence: 'Public domain' }),
    'another source': r => ({ ...r, source_url: r.source_url.replace('Paysage', 'Landscape') }),
    'another source hash': r => ({ ...r, source_sha1: '0'.repeat(40) }),
    'a path that lies about its size': r => ({ ...r, width: 2600 }),
    'a preview of another crop': r => ({ ...r, previews: [{ ...r.previews[0], path: `${drawing.path_stem}__1280x900.jpg`, height: 900 }] }),
    'a preview larger than the plate': r => ({ ...r, previews: [{ ...r.previews[0], path: `${drawing.path_stem}__2567x1761.jpg`, width: 2567, height: 1761 }] }),
    'an unhashed file': r => ({ ...r, sha256: undefined }),
    'a plate larger than its source': r => ({ ...r, path: `${drawing.path_stem}__4096x2810.jpg`, width: 4096, height: 2810 }),
  }
  for (const [name, edit] of Object.entries(edits)) {
    const admitted = register.admitOpeningRecord(edit(goodRecord()), drawing)
    assert(!admitted.ok, `admitted ${name}`)
  }
})

const report = { checker: 'vinci-opening-drawing', manifest_id: drawing.manifest_id, store: null, candidate: null, source: null }
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex')
/** width and height from a baseline or progressive JPEG's frame header */
function jpegSize(file) {
  const b = readFileSync(file)
  assert(b[0] === 0xff && b[1] === 0xd8, `${file} is not a JPEG`)
  for (let i = 2; i < b.length;) {
    if (b[i] !== 0xff) { i++; continue }
    const marker = b[i + 1]
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) }
    i += 2 + b.readUInt16BE(i + 2)
  }
  throw new Error(`${file} has no frame header`)
}
function checkBytes(record, dir, where) {
  const files = [record, ...(record.previews ?? [])]
  for (const file of files) {
    const path = join(dir, file.path)
    assert(existsSync(path), `${where}: no file at ${path}`)
    assert.equal(sha256(path), file.sha256, `${where}: ${file.path} sha256`)
    assert.equal(readFileSync(path).length, file.bytes, `${where}: ${file.path} bytes`)
    assert.deepEqual(jpegSize(path), { width: file.width, height: file.height }, `${where}: ${file.path} pixels`)
  }
  return files.length
}

const merged = resolve(root, 'public/na-manifest.json')
if (existsSync(merged)) {
  const all = JSON.parse(readFileSync(merged, 'utf8')).assets ?? []
  const stored = all.find(entry => entry.id === drawing.manifest_id)
  report.store = stored ? 'recorded' : 'not yet recorded'
  if (stored) test('the store\'s record is admitted', () => {
    const admitted = register.admitOpeningRecord(stored, drawing)
    assert(admitted.ok, admitted.reason)
  })
}
if (flags.has('entry')) {
  const entry = JSON.parse(readFileSync(resolve(flags.get('entry')), 'utf8'))
  report.candidate = entry.id
  test('the candidate record is admitted', () => {
    const admitted = register.admitOpeningRecord(entry, drawing)
    assert(admitted.ok, admitted.reason)
  })
  if (flags.has('files')) test('the candidate bytes match the candidate record', () => {
    report.candidate_files = checkBytes(entry, resolve(flags.get('files')), 'candidate')
  })
}
if (flags.has('source')) test('the original is the file the rights decision approved', () => {
  const bytes = readFileSync(resolve(flags.get('source')))
  report.source = createHash('sha1').update(bytes).digest('hex')
  assert.equal(report.source, drawing.photograph.sha1)
  assert.deepEqual(jpegSize(resolve(flags.get('source'))), { width: drawing.photograph.width, height: drawing.photograph.height })
})

const failed = results.filter(r => !r.ok)
console.log(JSON.stringify({ ...report, tests: results.length, failed: failed.length, results }, null, 2))
process.exitCode = failed.length ? 1 : 0
