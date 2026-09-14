#!/usr/bin/env node
/** Production catalogue, policy and register; literal DOM and store-origin
 * fixtures. No browser, image bytes, remote access or rendered evidence. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../../../../', import.meta.url)), sourceHashes = {}
const read = relative => {
  const file = path.resolve(root, relative)
  assert(file.startsWith(root))
  const source = fs.readFileSync(file, 'utf8')
  sourceHashes[relative] = createHash('sha256').update(source).digest('hex')
  return source
}
const registerRaw = read('src/wings/vinci/pictures/data/paintings.json')
const raw = JSON.parse(read('public/na-manifest.json')).assets
const index = records => ({ all: records, byId: new Map(records.map(entry => [entry.id, entry])) })
const manifest = index(raw), modules = new Map()
function load(relative) {
  if (modules.has(relative)) return modules.get(relative)
  const exports = {}; modules.set(relative, exports)
  const js = ts.transpileModule(read(relative), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(js, { exports, URL, require(specifier) {
    if (specifier.endsWith('paintings.json?raw')) return { default: registerRaw }
    if (specifier === '../../../../stack/materials') return { ASSET_BASE: '/catalogue-assets/' }
    assert(specifier.startsWith('.'), `Unexpected runtime dependency: ${specifier}`)
    return load(path.normalize(path.join(path.dirname(relative), `${specifier}.ts`)))
  } }, { filename: relative, timeout: 2000 })
  return exports
}
const catalogue = load('src/wings/vinci/pictures/bench/source-catalogue.ts')
const policy = load('src/wings/vinci/pictures/policy.ts')
const registered = load('src/wings/vinci/pictures/register.ts')
const immutableBefore = JSON.stringify(registered.REGISTER)
const descendants = node => [node, ...node.children.flatMap(descendants)]
const byClass = (root, cls) => descendants(root).filter(node => node.className.split(/\s+/).includes(cls))
function dom() {
  const nodes = [], requests = []
  const document = { activeElement: null }
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.className = ''; this.childNodes = []; this.attributes = new Map(); this.dataset = {}; this.hidden = false; this.disabled = false; this.naturalWidth = this.naturalHeight = 0; nodes.push(this) }
    get children() { return this.childNodes.filter(node => typeof node !== 'string') }
    get options() { return this.children.filter(node => node.tagName === 'OPTION') }
    get textContent() { return this.childNodes.map(node => typeof node === 'string' ? node : node.textContent).join('') }
    set textContent(value) { this.childNodes = [String(value ?? '')] }
    set innerHTML(_value) { throw new Error('Source evidence must remain literal text') }
    append(...nodes) { this.childNodes.push(...nodes) }
    replaceChildren(...nodes) { this.childNodes = [...nodes] }
    setAttribute(name, value) { this.attributes.set(name, String(value)) }
    removeAttribute(name) { this.attributes.delete(name); if (name === 'src') this._src = undefined }
    set src(value) { this._src = value; requests.push(value) }
    get src() { return this._src }
    focus() { document.activeElement = this }
    click() { if (!this.disabled) this.onclick?.() }
  }
  document.createElement = tag => new Element(tag)
  return { document, nodes, requests,
    complete(panel) { for (const image of descendants(panel.root).filter(node => node.tagName === 'IMG')) { image.naturalWidth = image.width; image.naturalHeight = image.height; image.onload?.() } },
  }
}
const results = []
function test(name, run) { try { run(); results.push({ name, ok: true }) } catch (error) { results.push({ name, ok: false, error: error.stack }) } }

test('All 34 surviving identities resolve once, including two supplements and three distinct Salvator images', () => {
  const records = catalogue.sourceCatalogueRecords(manifest)
  assert.equal(records.length, 34); assert.equal(new Set(records.map(record => record.identity)).size, 34)
  const full = raw.filter(entry => entry.role === 'painting-plate')
  const replaced = new Set(full.flatMap(entry => entry.supersedes ?? []))
  assert.equal(replaced.size, 5); assert(records.every(record => !replaced.has(record.source.plate.id)))
  assert.deepEqual([...records].filter(record => !record.inPictureRegister).map(record => record.identity).sort(), ['turin-self-portrait', 'vitruvian-man'])
  assert.equal(records.find(record => record.identity === 'turin-self-portrait').title.en, 'Presumed self-portrait')
  assert.equal(records.find(record => record.identity === 'vitruvian-man').title.de, 'Vitruvianischer Mensch')
  const salvator = [...records].filter(record => record.source.workId === 'salvator-mundi')
  assert.deepEqual(salvator.map(record => record.source.relationship), ['primary', 'historical-photograph', 'independent-print'])
  assert.equal(salvator[2].relationship.en, 'Independent print, 1844')
  for (const record of records) for (const key of ['width_cm', 'height_cm', 'date', 'registration']) assert.equal(key in record, false)
})

test('Every source renders supplied bilingual honesty and licence literally, with complete manifested images and pixel extents', () => {
  const h = dom(), panel = catalogue.createSourceCatalogue(manifest, { document: h.document })
  const allowed = new Set(panel.records.flatMap(record => [record.source.preview, record.source.plate]).map(entry => `/catalogue-assets/${entry.wing}/${entry.path}`))
  assert.equal(descendants(panel.root).filter(node => node.tagName === 'OPTION').length, 34)
  for (const record of panel.records) {
    assert(panel.select(record.identity)); assert.equal(panel.selected(), record.identity)
    const languageNodes = byClass(panel.root, 'picture-source-catalogue-language')
    for (const language of ['en', 'de']) {
      const column = languageNodes.find(node => node.lang === language)
      const supplied = record.source.plate[`honesty_${language}`]
      const honesty = byClass(column, 'picture-source-catalogue-honesty')
      if (supplied) assert.equal(honesty[0]?.textContent, supplied)
      else assert.equal(honesty.length, 0, 'A legacy source acquired invented policy copy')
    }
    assert.equal(byClass(panel.root, 'picture-source-catalogue-licence')[0].textContent, record.source.plate.licence)
    const image = byClass(panel.root, 'picture-source-catalogue-main-image')[0]
    const preview = policy.validatePaintingRecord(record.source.preview)
    assert.equal(image.src, `/catalogue-assets/${preview.path}`)
    assert.equal(image.width, preview.pixels.width); assert.equal(image.height, preview.pixels.height)
    assert.equal(image.dataset.sourceSha256, record.source.preview.sha256)
    h.complete(panel); assert.equal(panel.measure().imagesPending, 0); assert.equal(panel.measure().errors.length, 0)
    const decoded = new Map(panel.measure().images.map(image => [image.id, image.naturalWidth * image.naturalHeight * 4]))
    assert.equal(panel.measure().decodedRGBABytes, [...decoded.values()].reduce((sum, bytes) => sum + bytes, 0))
    assert.equal(panel.measure().decodedImageCount, decoded.size)
    const original = byClass(panel.root, 'picture-source-catalogue-original')[0]
    assert.equal(original.href, `/catalogue-assets/${record.source.plate.wing}/${record.source.plate.path}`)
    assert.equal(original.target, '_blank')
  }
  assert(h.requests.every(url => allowed.has(url)), 'A source page or held filename supplied image bytes')
  assert.equal(JSON.stringify(registered.REGISTER), immutableBefore)
  panel.dispose()
})

test('A full source retains its independent pixel dimensions and provenance; unknown identities cannot change selection', () => {
  const h = dom(), panel = catalogue.createSourceCatalogue(manifest, { document: h.document, selectedId: 'salvator-mundi:print-1844' })
  const selected = panel.records.find(record => record.identity === panel.selected())
  byClass(panel.root, 'picture-source-catalogue-resolution')[0].click()
  const image = byClass(panel.root, 'picture-source-catalogue-main-image')[0]
  assert.equal(image.src, `/catalogue-assets/${selected.source.plate.wing}/${selected.source.plate.path}`)
  assert.equal(image.width, selected.source.pixels.width); assert.equal(image.height, selected.source.pixels.height)
  assert.equal(image.dataset.sourceSha256, selected.source.plate.sha256)
  assert.equal(panel.measure().fullImage, true)
  assert.equal(h.document.activeElement, byClass(panel.root, 'picture-source-catalogue-resolution')[0])
  assert.equal(panel.select('not-a-source'), false); assert.equal(panel.selected(), 'salvator-mundi:print-1844')
  assert.equal(panel.select('turin-self-portrait'), true); assert.equal(panel.measure().fullImage, false)
  assert(byClass(panel.root, 'picture-source-catalogue-copy')[0].textContent.includes('No physical measurement is supplied'))
  panel.dispose()
})

test('Pagination retains every source and thumbnail selection keeps keyboard focus within the catalogue', () => {
  const h = dom(), notifications = [], panel = catalogue.createSourceCatalogue(manifest, { document: h.document, pageSize: 4, onSelect: id => notifications.push(id) })
  const seen = new Set()
  const later = descendants(panel.root).find(node => node.tagName === 'BUTTON' && node.textContent === 'Later / Nächste')
  for (;;) {
    for (const button of byClass(panel.root, 'picture-source-catalogue-thumb')) seen.add(button.dataset.sourceIdentity)
    if (later.disabled) break
    later.click()
  }
  assert.equal(seen.size, 34)
  const button = byClass(panel.root, 'picture-source-catalogue-thumb')[0]
  button.click(); assert.equal(panel.selected(), button.dataset.sourceIdentity)
  assert.equal(h.document.activeElement.tagName, 'SELECT'); assert.equal(notifications.at(-1), panel.selected())
  assert.match(catalogue.sourceCatalogueCSS, /min-height:44px/)
  assert.match(catalogue.sourceCatalogueCSS, /object-fit:contain/)
  panel.dispose()
})

test('Phone language selection preserves loaded images, literal German copy and focus; desktop retains both columns', () => {
  const h = dom(), panel = catalogue.createSourceCatalogue(manifest, { document: h.document, selectedId: 'vitruvian-man' })
  h.complete(panel)
  const requests = h.requests.length, bytes = panel.measure().decodedRGBABytes
  const german = byClass(panel.root, 'picture-source-catalogue-language-switch')[0].children.find(button => button.lang === 'de')
  german.focus(); german.click()
  assert.equal(panel.root.dataset.language, 'de'); assert.equal(panel.measure().phoneLanguage, 'de')
  assert.equal(german.attributes.get('aria-pressed'), 'true'); assert.equal(h.document.activeElement, german)
  assert.equal(h.requests.length, requests); assert.equal(panel.measure().decodedRGBABytes, bytes)
  assert.equal(panel.measure().imagesPending, 0)
  const source = panel.records.find(record => record.identity === 'vitruvian-man').source.plate
  const column = byClass(panel.root, 'picture-source-catalogue-language').find(column => column.lang === 'de')
  assert.equal(byClass(column, 'picture-source-catalogue-honesty')[0].textContent, source.honesty_de)
  assert(descendants(panel.root).some(node => node.tagName === 'OPTION' && node.textContent.includes('Vitruvianischer Mensch')))
  assert(panel.select('turin-self-portrait')); assert.equal(panel.measure().phoneLanguage, 'de')
  assert.equal(byClass(panel.root, 'picture-source-catalogue-language-switch')[0].children.find(button => button.lang === 'de').attributes.get('aria-pressed'), 'true')
  const [desktop, phone] = catalogue.sourceCatalogueCSS.split('@media(max-width:699px)')
  assert.doesNotMatch(desktop, /\[lang=(?:en|de)\]/)
  assert.match(phone, /max-height:30vh/)
  assert.match(phone, /grid-row:1;grid-column:1\/-1/)
  assert.match(phone, /source-controls button \{ grid-row:2/)
  panel.dispose()
})

test('Missing, excluded, malformed or ambiguous source metadata fails before any DOM image request', () => {
  const original = raw.find(entry => entry.role === 'painting-plate' && entry.work_id === 'vitruvian-man')
  for (const patch of [{ display: false }, { class: 'REFERENCE-ONLY' }, { sha256: 'bad' }, { pixels: 1 }, { honesty_de: '' }, { source_url: 'javascript:alert(1)' }]) {
    const h = dom(), altered = raw.map(entry => entry === original ? { ...entry, ...patch } : entry)
    assert.throws(() => catalogue.createSourceCatalogue(index(altered), { document: h.document }))
    assert.equal(h.nodes.length, 0); assert.equal(h.requests.length, 0)
  }
  for (const altered of [raw.filter(entry => !(entry.work_id === original.work_id && entry.role === 'painting-preview')), [...raw, original]]) {
    const h = dom(); assert.throws(() => catalogue.createSourceCatalogue(index(altered), { document: h.document }))
    assert.equal(h.nodes.length, 0); assert.equal(h.requests.length, 0)
  }
  const h = dom()
  assert.throws(() => catalogue.createSourceCatalogue(manifest, { document: h.document, selectedId: 'missing' }))
  assert.throws(() => catalogue.createSourceCatalogue(manifest, { document: h.document, pageSize: 0 }))
  assert.equal(h.nodes.length, 0)
})

test('Legacy RC metadata remains excluded and unregistered legacy files cannot become supplements', () => {
  const legacy = raw.filter(entry => !entry.tier)
  const records = catalogue.sourceCatalogueRecords(index(legacy))
  assert.equal(records.length, 12)
  assert(records.every(record => record.inPictureRegister && registered.getWork(record.source.workId).rights_class === 'DG'))
  const fabricated = legacy.filter(entry => entry.work_id === 'madonna-litta').map(entry => ({ ...entry,
    work_id: 'unregistered-study', id: entry.id.replace('madonna-litta', 'unregistered-study'), path: entry.path.replaceAll('madonna-litta', 'unregistered-study') }))
  assert.equal(catalogue.sourceCatalogueRecords(index([...legacy, ...fabricated])).length, 12)
})

test('Image dimension mismatch and load failure stay observable, and disposal removes all image requests and callbacks', () => {
  const h = dom(), panel = catalogue.createSourceCatalogue(manifest, { document: h.document, selectedId: 'vitruvian-man' })
  const oldResolution = byClass(panel.root, 'picture-source-catalogue-resolution')[0]
  h.complete(panel)
  const image = byClass(panel.root, 'picture-source-catalogue-main-image')[0]
  image.naturalWidth--; image.onload()
  assert.equal(image.hidden, true); assert.match(panel.measure().errors[0], /dimensions disagree/)
  assert(panel.select('turin-self-portrait'))
  const next = byClass(panel.root, 'picture-source-catalogue-main-image')[0]
  next.onerror(); assert.equal(next.hidden, true); assert(panel.measure().errors.some(error => /unavailable/.test(error)))
  const retained = descendants(panel.root).filter(node => node.tagName === 'IMG')
  panel.dispose(); panel.dispose()
  assert(retained.every(image => image.src === undefined && image.onload === null && image.onerror === null))
  assert.equal(panel.measure().imagesPending, 0); assert.equal(panel.measure().images.length, 0)
  assert.equal(panel.measure().decodedRGBABytes, 0)
  const requestCount = h.requests.length
  oldResolution.click()
  assert.equal(h.requests.length, requestCount, 'A queued event on detached controls resurrected image URLs')
  assert(h.nodes.filter(node => node.tagName === 'IMG').every(image => image.src === undefined && image.onload === null && image.onerror === null), 'A previous page retained an image URI after disposal')
  assert.equal(panel.select('vitruvian-man'), false)
})

const report = { kind: 'source-catalogue-source-check', browser: false, network: false, ok: results.every(result => result.ok),
  passed: results.filter(result => result.ok).length, total: results.length, sourceHashes, results,
  limitations: ['No image bytes are fetched or hashed; metadata and decoded-size event handling are exercised with controlled DOM fixtures.',
    'No rendered pixels, layout, accessibility tree, browser cache residency or GPU texture allocation are measured.',
    'The gallery uses complete source images in a reading view. It makes no physical-size or registration assertion.'] }
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
