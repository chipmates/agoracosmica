#!/usr/bin/env node
/** Execute the actual policy and label modules against the app-plugin snapshot.
 * No browser, remote access, or copied implementation. Tests cover the source
 * joins that changed in window 2 and failures that could mislabel an image.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import * as THREE from 'three'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../../..')
const sha = text => createHash('sha256').update(text).digest('hex')
const audit = JSON.parse(readFileSync(resolve(root, 'src/wings/vinci/pictures/data/store-audit.json'), 'utf8'))
const works = JSON.parse(readFileSync(resolve(root, 'src/wings/vinci/pictures/data/paintings.json'), 'utf8')).works
const workHash = sha(JSON.stringify(works))
const makeIndex = records => ({ all: records, byId: new Map(records.map(e => [e.id, e])), forPath: () => undefined })
const manifest = makeIndex(audit.records)

class LabelElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.className = ''; this.childNodes = []
    this.dataset = {}; this.attributes = new Map(); this.style = { setProperty() {} }; this.parentElement = null
  }
  get children() { return this.childNodes.filter(child => child instanceof LabelElement) }
  get textContent() { return this.childNodes.map(child => typeof child === 'string' ? child : child.textContent).join('') }
  set textContent(value) { this.childNodes = [String(value ?? '')] }
  set innerHTML(_value) { throw new Error('Labels must use literal text nodes') }
  append(...nodes) { for (const node of nodes) if (node instanceof LabelElement) node.parentElement = this; this.childNodes.push(...nodes) }
  prepend(...nodes) { for (const node of nodes) if (node instanceof LabelElement) node.parentElement = this; this.childNodes.unshift(...nodes) }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
}
const sourceHashes = {}
function load(name) {
  const file = resolve(here, name)
  const source = readFileSync(file, 'utf8')
  sourceHashes[name] = sha(source)
  const exports = {}
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText
  new vm.Script(js, { filename: file }).runInNewContext({ exports,
    document: { createElement: tag => new LabelElement(tag) },
    require(dependency) {
      if (name === 'scale.ts' && dependency === 'three') return THREE
      if (dependency === './registration') return load('registration.ts')
      if (dependency === './visitor-copy') return load('visitor-copy.ts')
      throw new Error(`Unexpected policy runtime dependency: ${dependency}`)
    },
    fetch() { throw new Error('The policy resolver must not fetch') },
  })
  return exports
}
const policy = load('policy.ts'), labels = load('policy-label.ts')
const scale = load('scale.ts')
// Execute just the actual size declaration. Its pure geometry contract does
// not need the register module's Vite raw import or any manifest I/O.
const registerFile = resolve(here, 'register.ts')
const registerSource = readFileSync(registerFile, 'utf8')
sourceHashes['register.ts'] = sha(registerSource)
const tree = ts.createSourceFile(registerFile, registerSource, ts.ScriptTarget.ES2022, true)
const sizeDeclaration = tree.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'reproductionCardSize')
assert(sizeDeclaration, 'Production reproductionCardSize declaration is missing')
const sizeSource = ts.createPrinter().printNode(ts.EmitHint.Unspecified, sizeDeclaration, tree)
const sizeExports = {}
new vm.Script(ts.transpileModule(sizeSource, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText).runInNewContext({ exports: sizeExports })
const work = id => { const result = works.find(w => w.id === id); assert(result, id); return result }
const selection = id => policy.resolvePicturePolicy(work(id), manifest)
const descendants = element => [element, ...element.children.flatMap(descendants)]
const inheritedLanguage = element => element.lang || (element.parentElement ? inheritedLanguage(element.parentElement) : '')
const cloneRecords = () => structuredClone(audit.records)
const results = []
function test(name, check) {
  try { check(); results.push({ name, ok: true }) }
  catch (error) { results.push({ name, ok: false, error: error.stack ?? String(error) }) }
}

test('App-plugin snapshot preserves all 78 hashed records, including 27 policy plates', () => {
  assert.equal(sha(JSON.stringify(audit.records)), audit.recordSha256)
  assert.equal(audit.records.length, 78)
  assert.equal(audit.records.filter(e => e.role === 'painting-plate' && e.tier).length, 27)
  assert.equal(audit.records.filter(e => e.role === 'painting-plate' && !e.tier).length, 12)
  for (const entry of audit.records) policy.validatePaintingRecord(entry)
})
test('Policy admits all 29 illustrated register works and leaves only Wilton without a plate', () => {
  const absent = works.filter(w => !policy.resolvePicturePolicy(w, manifest).primary).map(w => w.id)
  assert.deepEqual(absent, ['leda-wilton'])
  assert.equal(works.reduce((n, w) => n + policy.resolvePicturePolicy(w, manifest).all.length, 0), 32)
  assert.equal(sha(JSON.stringify(works)), workHash, 'Resolver mutated the locked register')
})
test('All five explicit source replacements win, including Saint Anne’s replacement of legacy CC0', () => {
  const expected = {
    'madonna-of-the-carnation': 'madonna-of-the-carnation__2229x3000',
    'lady-with-an-ermine': 'lady-with-an-ermine__2936x4000',
    'virgin-and-child-with-st-anne': 'virgin-and-child-with-st-anne__3081x4096',
    'yarnwinder-lansdowne': 'yarnwinder-lansdowne__1992x2401',
    'isabella-deste-cartoon': 'isabella-deste-cartoon__1047x1374',
  }
  for (const [id, primary] of Object.entries(expected)) {
    const resolved = selection(id)
    assert.equal(resolved.primary.id, primary)
    assert(!resolved.all.some(e => audit.superseded.includes(e.plate.id)))
  }
})
test('Dimension-suffixed preview and full ids pair by plate_id with their actual independent sizes', () => {
  const e = selection('lady-with-an-ermine').primary
  assert.equal(e.plate.id, 'vinci/painting-plate/lady-with-an-ermine__2936x4000')
  assert.equal(e.preview.id, 'vinci/painting-preview/lady-with-an-ermine__752x1024')
  assert.equal(e.plate.plate_id, e.preview.plate_id)
  assert.equal(e.pixels.width, 2936); assert.equal(e.pixels.height, 4000)
})
test('Ginevra keeps two faces of one panel without selecting the reverse as the primary image', () => {
  const resolved = selection('ginevra-de-benci')
  assert.equal(resolved.primary.face, 'front')
  assert.equal(resolved.mainPlates.length, 2)
  assert.equal(resolved.mainPlates[1].face, 'reverse')
  assert.equal(resolved.mainPlates[1].identity, 'ginevra-de-benci:reverse')
  assert.notEqual(resolved.mainPlates[0].preview.sha256, resolved.mainPlates[1].preview.sha256)
})
test('Salvator separates the restored picture, historical photo and independent 1844 engraving', () => {
  const resolved = selection('salvator-mundi')
  assert.equal(resolved.primary.identity, 'salvator-mundi:restored')
  assert.equal(resolved.mainPlates.length, 1)
  assert.deepEqual(Array.from(resolved.alternatives, e => e.relationship), ['historical-photograph', 'independent-print'])
  assert.match(resolved.alternatives[1].plate.honesty_en, /separate image/)
  assert.match(resolved.alternatives[1].plate.honesty_de, /Eigenständiges Bild/)
  assert(!('height_cm' in resolved.alternatives[1]), 'The print inherited invented physical dimensions')
})
test('Supplemental drawings resolve without pretending their dimensions are in the register', () => {
  for (const id of ['vitruvian-man', 'turin-self-portrait']) {
    assert(!works.some(w => w.id === id))
    const resolved = policy.resolveManifestWorkPlates(id, manifest)
    assert.equal(resolved.length, 1)
    assert.equal(resolved[0].policyTier, 'TIER2')
    assert(!('height_cm' in resolved[0]) && !('width_cm' in resolved[0]))
  }
})
test('Plain drawers carry labelled bilingual readings; explicit records retain every exact source statement and licence', () => {
  for (const w of works) {
    const all = policy.resolvePicturePolicy(w, manifest).all
    const drawer = labels.createPolicyWorkLabel(w, all)
    const drawerNodes = descendants(drawer)
    assert.equal(drawer.dataset.register, 'drawer')
    for (const [language, className] of [['en', 'picture-first'], ['de', 'picture-first-de']]) {
      const first = drawerNodes.filter(n => n.className === className)
      assert.equal(first.length, 1, `${w.id}: one ${language} label`)
      assert.equal(first[0].dataset.register, 'label')
      assert.equal(inheritedLanguage(first[0]), language)
      assert(first[0].textContent.endsWith(`${w[`title_${language}`]}.`), `${w.id}: exact ${language} title`)
    }
    assert.equal(drawerNodes.filter(n => n.className === 'picture-source-reading').length, 2)
    assert(!drawerNodes.some(n => ['picture-licence', 'picture-honesty', 'picture-source-hash', 'picture-label-evidence'].includes(n.className)), `${w.id}: record evidence leaked into drawer`)
    const record = labels.createPictureRecord(w, all)
    assert.equal(record.dataset.register, 'record')
    assert.equal(record.hidden, true, `${w.id}: complete record must require opening`)
    const nodes = descendants(record)
    for (const plate of all) {
      const licences = nodes.filter(n => n.className === 'picture-licence' && n.dataset.manifestId === plate.plate.id)
      assert.equal(licences.length, 1, `${w.id}: duplicate/missing source licence`)
      assert.equal(licences[0].textContent, plate.plate.licence)
      if (plate.policyTier) {
        const honesty = nodes.filter(n => n.className === 'picture-honesty' && n.dataset.manifestId === plate.plate.id)
        assert.equal(honesty.length, 2, `${w.id}: EN/DE source honesty`)
        assert.equal(honesty[0].textContent, plate.plate.honesty_en)
        assert.equal(honesty[1].textContent, plate.plate.honesty_de)
        assert.equal(inheritedLanguage(honesty[0]), 'en')
        assert.equal(inheritedLanguage(honesty[1]), 'de')
      }
      if (plate.plate.source_url) assert(nodes.some(n => n.className === 'picture-source-link' && n.textContent === plate.plate.source_url))
      assert(nodes.some(n => n.className === 'picture-source-hash' && n.textContent === `${plate.plate.id}\nSHA-256 ${plate.plate.sha256}`))
    }
    const raw = JSON.parse(nodes.find(n => n.tagName === 'PRE').textContent)
    assert.equal(JSON.stringify(raw.collection), JSON.stringify(w), `${w.id}: complete locked collection evidence`)
    assert.equal(raw.sources.length, all.length)
    for (const [index, source] of raw.sources.entries()) {
      assert.deepEqual(source.plate, all[index].plate)
      assert.deepEqual(source.preview, all[index].preview)
    }
  }
})
test('Current wall labels contain no old absence verdict, filename, scan instruction, raw production note or hash', () => {
  for (const w of works) {
    const resolved = policy.resolvePicturePolicy(w, manifest)
    const element = labels.createPolicyWorkLabel(w, resolved.mainPlates)
    assert(!/Abwesend|Available file:|Vorhandene Datei:|terms have not been cleared|Nutzungsbedingungen sind.*nicht geklärt|Keep the raster|LANCZOS|SHA-256|refs\/paintings\//.test(element.textContent), w.id)
    assert(!/__[0-9]+x[0-9]+\.jpg/.test(element.textContent), w.id)
    if (resolved.primary) assert(!/^Absent\./.test(labels.policyLabelText(w, resolved.mainPlates).firstLine.en), w.id)
  }
})
test('Every drawer has a German reading and source credit; its explicit record retains German material and date', () => {
  for (const w of works) {
    const entries = policy.resolvePicturePolicy(w, manifest).mainPlates
    const nodes = descendants(labels.createPolicyWorkLabel(w, entries))
    const de = nodes.find(n => n.className.includes('picture-label-de'))
    assert.equal(de.lang, 'de')
    assert(de.children.find(n => n.className === 'picture-reason-de')?.textContent.length > 20, w.id)
    assert(de.children.find(n => n.className === 'picture-source-reading')?.textContent.length > 20, w.id)
    const recordDe = descendants(labels.createPictureRecord(w, entries)).find(n => n.className.includes('picture-label-de'))
    const metadata = recordDe.children.find(n => n.className === 'picture-record')
    assert.equal(inheritedLanguage(metadata), 'de')
    for (const value of [w.date_label_de, w.medium_de, w.support_de].filter(Boolean)) assert(metadata.textContent.includes(value), w.id)
  }
})
test('Replacement labels retain the essential field, support, source and historic-print distinctions', () => {
  const text = id => labels.policyLabelText(work(id), selection(id).mainPlates)
  assert.match(text('virgin-and-child-with-st-anne').note.de, /113.*130/)
  assert.match(text('isabella-deste-cartoon').note.de, /vollständige Blatt/)
  assert(!/beschnitten|12,6/.test(text('isabella-deste-cartoon').note.de))
  assert.match(text('mona-lisa').sources[0].honesty.en, /exact publication date is unverified/)
  assert.match(text('sala-delle-asse').note.en, /dimensions.*unknown/)
  assert.match(text('virgin-of-the-rocks-london').note.de, /Rahmen/)
})
test('Attribution certainty is independent of rights class and source licensing', () => {
  assert.equal(labels.policyCertainty(work('salvator-mundi'), true).colour, '#b56152')
  assert.equal(labels.policyCertainty(work('virgin-of-the-rocks-london'), true).colour, '#b18b47')
  assert.equal(labels.policyCertainty(work('mona-lisa'), true).colour, '#52735a')
  assert.equal(labels.policyCertainty(work('leda-wilton'), false).colour, '#777e7b')
  const changedLicence = { ...work('mona-lisa'), licence_line: 'CC0', rights_class: 'DG' }
  assert.equal(labels.policyCertainty(changedLicence, true).colour, '#52735a')
  assert.equal(labels.PICTURE_CERTAINTY_KEY.length, 4)
})
test('Resolver rejects reference-only, hidden, damaged-hash, oversized and false-identity records', () => {
  const base = audit.records.find(e => e.id === 'vinci/painting-plate/mona-lisa')
  for (const mutation of [{ class: 'REFERENCE-ONLY' }, { display: false }, { sha256: 'bad' },
    { work_id: 'saint-john-the-baptist' }, { path: ['..', 'paintings', ['mona-lisa', 'jpg'].join('.')].join('/') },
    { pixels: 1 }, { width: 5000 }, { honesty_de: '' }, { tier: 'APPROVED' },
    { plate_id: 'mona-lisa:unrelated' }]) {
    assert.throws(() => policy.validatePaintingRecord({ ...base, ...mutation }), undefined, JSON.stringify(mutation))
  }
})
test('A missing or ambiguous matching preview and a changed honesty line fail closed', () => {
  const base = cloneRecords()
  const preview = base.find(e => e.id === 'vinci/painting-preview/mona-lisa')
  assert.throws(() => policy.resolvePicturePolicy(work('mona-lisa'), makeIndex(base.filter(e => e !== preview))), /matching preview/)
  assert.throws(() => policy.resolvePicturePolicy(work('mona-lisa'), makeIndex([...base, { ...preview }])), /Duplicate/)
  preview.honesty_de = 'An unrelated interpretation.'
  assert.throws(() => policy.resolvePicturePolicy(work('mona-lisa'), makeIndex(base)), /changes the source/)
})
test('Supersession cannot silently remove a different work or revive an old excluded source', () => {
  const records = cloneRecords()
  records.find(e => e.id === 'vinci/painting-plate/lady-with-an-ermine__2936x4000').supersedes = ['vinci/painting-plate/mona-lisa']
  assert.throws(() => policy.resolvePicturePolicy(work('lady-with-an-ermine'), makeIndex(records)), /Invalid painting supersession/)
  const fake = { ...work('mona-lisa'), id: 'lady-with-an-ermine', rights_class: 'RC' }
  const legacyOnly = audit.records.filter(e => e.work_id === fake.id && !e.tier)
  assert.equal(policy.resolvePicturePolicy(fake, makeIndex(legacyOnly)).primary, null)
})
test('A per-work choice hangs its plate and keeps the chosen-over plate as evidence, never superseded', () => {
  const records = cloneRecords()
  const print = records.find(e => e.id === 'vinci/painting-plate/mona-lisa')
  const printPreview = records.find(e => e.id === 'vinci/painting-preview/mona-lisa')
  assert.equal(policy.resolvePicturePolicy(work('mona-lisa'), makeIndex(records)).primary.plate.id, print.id)
  // A second face of the same work, named off the print's own record.
  const choice = path => path.replace('/mona-lisa__', '/mona-lisa-choice__')
  const capture = { ...print, id: 'vinci/painting-plate/mona-lisa-choice__3203x4096', path: choice(print.path),
    tier: 'TIER2', plate_id: 'mona-lisa:choice', source_url: `${print.source_url}#choice`, chosen_over: [print.id] }
  const preview = { ...printPreview, id: 'vinci/painting-preview/mona-lisa-choice__801x1024', path: choice(printPreview.path),
    tier: 'TIER2', plate_id: 'mona-lisa:choice', source_url: capture.source_url }
  const chosen = policy.resolvePicturePolicy(work('mona-lisa'), makeIndex([...records, capture, preview]))
  assert.equal(chosen.primary.plate.id, capture.id)
  assert.deepEqual(Array.from(chosen.mainPlates, e => e.plate.id), [capture.id])
  assert.deepEqual(Array.from(chosen.evidence, e => e.plate.id), [print.id])
  assert(chosen.all.some(e => e.plate.id === print.id), 'The chosen-over plate was dropped')
  const record = labels.createPictureRecord(work('mona-lisa'), chosen.mainPlates, chosen.evidence)
  const kept = descendants(record).filter(node => node.dataset.evidence === 'true')
  assert.deepEqual([...new Set(kept.map(node => node.dataset.manifestId))], [print.id])
  const across = { ...capture, chosen_over: ['vinci/painting-plate/lady-with-an-ermine__2936x4000'] }
  assert.throws(() => policy.resolvePicturePolicy(work('mona-lisa'), makeIndex([...records, across, preview])), /Invalid painting choice/)
  const mutual = records.map(e => e.id === print.id ? { ...e, tier: 'TIER1', chosen_over: [capture.id] } : e)
  assert.throws(() => policy.resolvePicturePolicy(work('mona-lisa'), makeIndex([...mutual, capture, preview])), /Invalid painting choice/)
})
test('Explicit records preserve the original bilingual first lines without mutating the register', () => {
  for (const w of works) {
    const element = labels.createPictureRecord(w, policy.resolvePicturePolicy(w, manifest).mainPlates)
    const nodes = descendants(element)
    assert.equal(nodes.find(n => n.className === 'picture-register-first-en').textContent, w.label_first_line_en)
    assert.equal(nodes.find(n => n.className === 'picture-register-first-de').textContent, w.label_first_line_de)
  }
  assert.equal(sha(JSON.stringify(works)), workHash)
})

const extentRows = []
function measure(w, widthM, heightM, centerY = w.hang.eye_height_cm === null ? 3 : 1.55) {
  const viewport = { width: 1512, height: 950 }
  const camera = new THREE.PerspectiveCamera(40, viewport.width / viewport.height, .01, 100)
  camera.position.set(0, centerY, 12)
  camera.lookAt(0, centerY, 0)
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true)
  const geometry = new THREE.PlaneGeometry(widthM, heightM)
  const matrix = new THREE.Matrix4().makeTranslation(0, centerY, 0)
  try { return scale.measureProjectedWork(w, camera, geometry, matrix, viewport) }
  finally { geometry.dispose() }
}
test('Containment preserves raster proportions but cannot masquerade as the original’s two-axis dimensions', () => {
  for (const w of works) {
    const primary = policy.resolvePicturePolicy(w, manifest).primary
    if (!primary || w.height_cm === null) continue
    const image = sizeExports.reproductionCardSize(w, primary.pixels)
    assert(Math.abs(image.widthM / image.heightM - primary.pixels.width / primary.pixels.height) < 1e-12)
    assert(image.widthM <= w.width_cm / 100 + 1e-12 && image.heightM <= w.height_cm / 100 + 1e-12)
    assert(Math.min(Math.abs(image.widthM - w.width_cm / 100), Math.abs(image.heightM - w.height_cm / 100)) < 1e-12)
    const actual = measure(w, image.widthM, image.heightM)
    const frame = measure(w, w.width_cm / 100, w.height_cm / 100)
    assert(frame.passes, `${w.id}: independent measured extent failed`)
    const difference = Math.max(Math.abs(image.widthM * 100 / w.width_cm - 1), Math.abs(image.heightM * 100 / w.height_cm - 1)) * 100
    if (difference > 1) assert.equal(actual.passes, false, `${w.id}: containment falsely passed a true reproduction extent`)
    extentRows.push({ id: w.id, workWidthCm: w.width_cm, workHeightCm: w.height_cm,
      containedWidthCm: image.widthM * 100, containedHeightCm: image.heightM * 100,
      widthErrorPercent: actual.widthErrorPercent, heightErrorPercent: actual.heightErrorPercent,
      measuredExtentPass: frame.passes, sourceAspectPass: true,
      rasterMatchesWorkExtentWithinOnePercent: actual.passes,
      registration: w.measurement.registration })
  }
  assert.equal(extentRows.length, 28)
  assert.equal(extentRows.filter(row => row.rasterMatchesWorkExtentWithinOnePercent).length, 5)
  assert(extentRows.find(row => row.id === 'mona-lisa').heightErrorPercent > 13)
  assert(extentRows.find(row => row.id === 'virgin-of-the-rocks-london').heightErrorPercent > 20)
})
test('Other physical extents, additions, unknown surfaces and arbitrary image furniture cannot pass the chosen work extent', () => {
  assert.equal(measure(work('virgin-and-child-with-st-anne'), 1.30, 1.68).passes, false, 'Enlarged support passed as original field')
  assert.equal(measure(work('ginevra-de-benci'), .37, .427).passes, false, 'Later addition passed as original panel')
  assert.equal(measure(work('anghiari-copy'), .577, .428).passes, false, 'Original sheet passed as enlarged sheet')
  assert.equal(measure(work('annunciation'), 2.22, .90).passes, false, 'Alternative measurement passed as chosen extent')
  assert.equal(measure(work('sala-delle-asse'), 15, 15), null, 'Room footprint invented painted dimensions')
  const invented = { ...work('salvator-mundi'), height_cm: null, width_cm: null }
  assert.equal(measure(invented, .45, .66), null, 'Unmeasured documentary print acquired original-panel dimensions')
})

const report = { kind: 'picture-policy-check', browser: false, network: false,
  manifestSnapshotSha256: audit.recordSha256, sourceHashes,
  ok: results.every(result => result.ok), passed: results.filter(result => result.ok).length,
  total: results.length, results,
  extentAudit: { description: 'Measured frame extent and unchanged raster containment are separate claims. A matching raster ratio does not establish registered painting corners.',
    measuredPrimarySources: extentRows.length,
    sourceRasterFitsWorkWithinOnePercent: extentRows.filter(row => row.rasterMatchesWorkExtentWithinOnePercent).length,
    sourceRegistrationEstablished: extentRows.filter(row => row.registration !== 'not established' && row.registration !== 'no plate').length,
    rows: extentRows } }
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
