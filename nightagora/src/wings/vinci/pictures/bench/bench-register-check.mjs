#!/usr/bin/env node
/** Window 3 register contract, executed against the production TypeScript.
 * This is a DOM behaviour check, not rendered evidence. No browser, server,
 * network, fixture copy, or modification of the locked collection is used.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../../../../', import.meta.url))
const sourceHashes = {}, tests = [], refusals = []
const sha = value => createHash('sha256').update(value).digest('hex')
function read(name) {
  const path = resolve(root, name)
  assert(!relative(root, path).startsWith('..'), `Outside workspace: ${name}`)
  const source = readFileSync(path, 'utf8')
  sourceHashes[relative(root, path)] = sha(source)
  return source
}
const rawRegister = read('src/wings/vinci/pictures/data/paintings.json')
const works = JSON.parse(rawRegister).works
// The bench's signature segment presents a printed document; the store's one
// such print hangs only without the capture chosen over it, so that choice is
// set aside here.
const chosen = JSON.parse(read('public/na-manifest.json')).assets.filter(entry => entry.chosen_over?.length)
const rawManifest = JSON.parse(read('public/na-manifest.json')).assets
  .filter(entry => !chosen.some(choice => choice.work_id === entry.work_id && choice.plate_id === entry.plate_id))
const manifest = { all: rawManifest, byId: new Map(rawManifest.map(entry => [entry.id, entry])) }
const immutableBefore = JSON.stringify({ works, rawManifest })
function test(name, check) {
  try { check(); tests.push({ name, ok: true }) }
  catch (error) { tests.push({ name, ok: false, error: error.message }) }
}

const document = { activeElement: null }
class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.className = ''; this.childNodes = []
    this.dataset = {}; this.attributes = new Map(); this.parentElement = null
    this.ownerDocument = document; this.hidden = false; this.open = false
    const values = new Map()
    this.style = { setProperty: (key, value) => values.set(key, String(value)),
      getPropertyValue: key => values.get(key) ?? '' }
    this.classList = { add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' ') },
      contains: name => this.className.split(/\s+/).includes(name) }
  }
  get children() { return this.childNodes.filter(node => node instanceof Element) }
  get textContent() { return this.childNodes.map(node => node instanceof Element ? node.textContent : String(node)).join('') }
  set textContent(value) { this.replaceChildren(String(value ?? '')) }
  set innerHTML(_value) { throw new Error('Visitor copy must be literal text nodes') }
  get id() { return this.getAttribute('id') ?? '' }
  set id(value) { this.setAttribute('id', value) }
  append(...nodes) { for (const node of nodes) { if (node instanceof Element) { node.remove(); node.parentElement = this } this.childNodes.push(node) } }
  prepend(...nodes) { for (const node of [...nodes].reverse()) { if (node instanceof Element) { node.remove(); node.parentElement = this } this.childNodes.unshift(node) } }
  insertBefore(node, reference) {
    assert(node instanceof Element, 'insertBefore requires a DOM node')
    assert(reference === null || this.childNodes.includes(reference), 'Reference node is not a child of this parent')
    for (let parent = this; parent; parent = parent.parentElement) assert.notEqual(parent, node, 'Cannot insert an ancestor into its descendant')
    if (node === reference) return node
    node.remove(); node.parentElement = this
    this.childNodes.splice(reference === null ? this.childNodes.length : this.childNodes.indexOf(reference), 0, node)
    return node
  }
  replaceChildren(...nodes) { for (const node of this.children) node.parentElement = null; this.childNodes = []; this.append(...nodes) }
  remove() { if (this.parentElement) { const at = this.parentElement.childNodes.indexOf(this); if (at >= 0) this.parentElement.childNodes.splice(at, 1); this.parentElement = null } }
  setAttribute(name, value) {
    this.attributes.set(name, String(value))
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value)
  }
  getAttribute(name) {
    if (name.startsWith('data-')) return this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] ?? null
    return this.attributes.get(name) ?? null
  }
  hasAttribute(name) { return this.getAttribute(name) !== null }
  addEventListener(type, listener) { this[`on${type}`] = listener }
  removeEventListener(type, listener) { if (this[`on${type}`] === listener) delete this[`on${type}`] }
  click() {
    let prevented = false
    this.onclick?.({ target: this, preventDefault() { prevented = true } })
    if (!prevented && this.tagName === 'SUMMARY' && this.parentElement?.tagName === 'DETAILS'
      && this.parentElement.children.find(child => child.tagName === 'SUMMARY') === this) {
      this.parentElement.open = !this.parentElement.open
      this.parentElement.ontoggle?.({ target: this.parentElement })
    }
  }
  focus() { document.activeElement = this }
}
document.createElement = tag => new Element(tag)
document.createTextNode = value => String(value)
const descendants = node => [node, ...node.children.flatMap(descendants)]
const byClass = (node, name) => descendants(node).filter(item => item.classList.contains(name))
const element = (tag, name = '', text = '') => { const node = document.createElement(tag); node.className = name; node.textContent = text; return node }
const transpile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText
const modules = new Map()
function load(name) {
  const file = resolve(root, name), key = relative(root, file)
  if (modules.has(key)) return modules.get(key)
  const exports = {}; modules.set(key, exports)
  vm.runInNewContext(transpile(read(key)), { exports, document, URL, console,
    fetch() { throw new Error('The register check must not fetch') },
    require(specifier) {
      if (specifier.endsWith('paintings.json?raw')) return { default: rawRegister }
      assert(specifier.startsWith('.'), `Unexpected runtime dependency: ${specifier}`)
      const dependency = resolve(dirname(file), specifier)
      return load(extname(dependency) ? dependency : `${dependency}.ts`)
    },
  }, { filename: key, timeout: 2000 })
  return exports
}
const policy = load('src/wings/vinci/pictures/policy.ts')
const labels = load('src/wings/vinci/pictures/policy-label.ts')
const registration = load('src/wings/vinci/pictures/registration.ts')
const signature = load('src/wings/vinci/pictures/signature-label.ts')

/** The seven documented gate categories, plus displayed punctuation. German
 * thousands separators remain valid; decimal precision is language-specific.
 */
function prohibited(text, language = 'en') {
  const rules = [
    ['file path', /(?:\b(?:brief|src|refs|assets)\/[^\s]+|\b[^\s]+\.(?:md|json|csv|tsx?|mjs|png|jpe?g)\b)/i],
    ['section code', /§|\bS\d+\b/],
    ['question id', /\bQ\d{3,}\b/],
    ['error bar', /±/],
    ['measured range', /\d+(?:[.,]\d+)?\s*[-–—−]\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|km|m)\b/i],
    ['over two decimals', language === 'de' ? /\b\d+,\d{3,}\b/ : /\b\d+\.\d{3,}\b/],
    ['machine word', /\b(?:procedural|prozedural\w*|exhibition proposal|Ausstellungsvorschlag\w*|scenario range|Szenariobereich\w*|nominal\w*|Nennmaß\w*|Nennmass\w*|dossier\w*)\b/i],
    ['displayed punctuation', /[–—;]/],
  ]
  return rules.flatMap(([rule, pattern]) => { const match = text.match(pattern); return match ? [{ rule, match: match[0] }] : [] })
}
function visitorStrings(node, inherited = 'label', language = 'en') {
  const register = node.dataset.register ?? inherited
  const lang = node.lang || language
  const own = node.childNodes.filter(child => !(child instanceof Element)).join('').trim()
  return [...(own && register !== 'record' ? [{ register, language: lang, text: own }] : []),
    ...node.children.flatMap(child => visitorStrings(child, register, lang))]
}
function auditVisitor(node, work, place) {
  const found = visitorStrings(node).flatMap(string => prohibited(string.text, string.language).map(reason => ({ work, place, ...string, ...reason })))
  refusals.push(...found)
  assert.equal(found.length, 0, found.map(item => `${item.language} ${item.rule}: ${JSON.stringify(item.match)} in ${JSON.stringify(item.text)}`).join('\n'))
}

test('Negative controls exercise every machine-string rule and forbidden punctuation', () => {
  const bad = [
    ['en', 'brief/CONCEPT.md', 'file path'], ['en', 'src/wings/frame.ts', 'file path'],
    ['de', 'refs/quelle.json', 'file path'], ['en', 'see §12', 'section code'],
    ['de', 'siehe S11', 'section code'], ['en', 'Q001', 'question id'],
    ['de', '±2 cm', 'error bar'], ['en', '48.1-49.9 cm', 'measured range'],
    ['de', '48,1−49,9 cm', 'measured range'], ['en', '47.4103 N', 'over two decimals'],
    ['de', '47,4103 N', 'over two decimals'], ['en', 'procedural grain', 'machine word'],
    ['de', 'prozedurale Maserung', 'machine word'], ['en', 'scenario range', 'machine word'],
    ['de', 'Ausstellungsvorschlag', 'machine word'], ['en', '2011–2012', 'displayed punctuation'],
    ['de', 'Bild—Quelle', 'displayed punctuation'], ['en', 'panel; photograph', 'displayed punctuation'],
  ]
  for (const [lang, text, rule] of bad) assert(prohibited(text, lang).some(found => found.rule === rule), `${rule}: ${text}`)
  for (const [lang, text] of [['en', 'A public domain photograph.'], ['en', 'from 1516 to 1519'], ['en', '79.4 × 53.4 cm'],
    ['de', '79,4 × 53,4 cm'], ['de', '1.234 m'], ['en', '1,234 drawings'], ['en', 'ODbL 1.0']]) assert.equal(prohibited(text, lang).length, 0, text)
})
test('The DOM double inserts, reparents and moves nodes without losing siblings', () => {
  const parent = element('div'), other = element('div'), a = element('span'), b = element('span'), c = element('span')
  parent.append(a, b); other.append(c)
  assert.equal(parent.insertBefore(c, b), c); assert.deepEqual(parent.children, [a, c, b]); assert.equal(other.children.length, 0)
  parent.insertBefore(b, a); assert.deepEqual(parent.children, [b, a, c])
  parent.insertBefore(b, null); assert.deepEqual(parent.children, [a, c, b])
  parent.insertBefore(c, c); assert.deepEqual(parent.children, [a, c, b])
  assert.throws(() => parent.insertBefore(a, other)); assert.deepEqual(parent.children, [a, c, b])
  assert.throws(() => a.insertBefore(parent, null))
})
test('Only the declared record subtree is exempt, including records inside drawer paragraphs', () => {
  const drawer = element('p', '', 'The painting is documented. '); labels.setRegister(drawer, 'drawer')
  const record = element('span', '', 'brief/source.json §12 Q001 ±0.003 cm; procedural'); labels.setRegister(record, 'record')
  drawer.append(record, ' The source is a museum photograph.')
  assert.equal(visitorStrings(drawer).flatMap(row => prohibited(row.text, row.language)).length, 0)
  const override = element('span', '', 'Q999'); labels.setRegister(override, 'label'); record.append(override)
  assert.equal(visitorStrings(drawer).flatMap(row => prohibited(row.text, row.language)).length, 1)
  override.remove()
  labels.setRegister(record, 'drawer')
  assert(visitorStrings(drawer).flatMap(row => prohibited(row.text, row.language)).length >= 5)
})
test('All thirty locked works resolve against the current public merged manifest', () => {
  assert.equal(works.length, 30); assert(rawManifest.length > 78)
  for (const work of works) policy.resolvePicturePolicy(work, manifest)
})

// Run the actual production label() closure with scene-only dependencies
// replaced by inert values. Its DOM creation and event handlers are unchanged.
const benchSource = read('src/wings/vinci/pictures/bench/index.ts')
const benchTree = ts.createSourceFile('src/wings/vinci/pictures/bench/index.ts', benchSource, ts.ScriptTarget.ES2022, true)
let labelDeclaration, absentDeclaration, pairDistanceAssignment
function findLabel(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'label') { assert(!labelDeclaration, 'Ambiguous bench label function'); labelDeclaration = node }
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'absentOnWall') { assert(!absentDeclaration, 'Ambiguous wall-absence predicate'); absentDeclaration = node }
  if (ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression)
    && node.expression.left.getText(benchTree) === 'pairDistance.textContent') { assert(!pairDistanceAssignment); pairDistanceAssignment = node }
  ts.forEachChild(node, findLabel)
}
findLabel(benchTree)
assert(labelDeclaration, 'Production bench label() declaration is missing')
assert(absentDeclaration, 'Production wall-absence predicate is missing')
assert(pairDistanceAssignment, 'Production material-distance text assignment is missing')
const benchLabelJS = transpile([labelDeclaration, absentDeclaration]
  .map(node => ts.createPrinter().printNode(ts.EmitHint.Unspecified, node, benchTree)).join('\n'))
const pairDistanceJS = transpile(ts.createPrinter().printNode(ts.EmitHint.Unspecified, pairDistanceAssignment, benchTree))
test('Bench declares its drawer and keeps createWorkLabel bound to the production policy label', () => {
  assert.match(benchSource, /setRegister\(detail,\s*'drawer'\)/)
  assert.match(read('src/wings/vinci/pictures/index.ts'), /export const createWorkLabel\s*=\s*createPolicyWorkLabel/)
})
function mountBenchLabel(work, entries, recordView = false, options = {}) {
  const dock = element('div', 'picture-dock'), detail = element('div', 'picture-drawer-content')
  labels.setRegister(detail, 'drawer')
  const selected = { work, cards: entries.map(entry => ({ entry })) }
  void 0
  const calls = [], pairDistance = element('p', 'picture-record')
  const context = { ...load('src/wings/vinci/pictures/visitor-copy.ts'), ...signature, document, element, materialPair: null, materialKind: undefined,
    dock, detail, selected, segmentId: 'complete-hang', labelLanguage: 'en', recordOpen: recordView, view: undefined, pairDistance,
    // The card's overflow notice is seated by the host, not by label(); the
    // register is the words label() puts in the dock.
    dockContent: (...nodes) => dock.replaceChildren(...nodes),
    signaturePrint: options.segmentId === 'signature' && options.view === 'print', publishView() {},
    hang: { frames: [selected], documentOnlyIds: new Set(options.documentOnlyIds ?? []) }, count: element('span'), manifest,
    createWorkLabel: labels.createPolicyWorkLabel,
    createPictureRecord: labels.createPictureRecord,
    createPictureCertaintyKey: labels.createPictureCertaintyKey,
    setRegister: labels.setRegister,
    pictureDisplayWindow: registration.pictureDisplayWindow,
    pictureDisplayUV: registration.pictureDisplayUV,
    showCatalogue() {}, ASSET_BASE: '/na-assets/',
    // The card reads in two levels on the narrow stage, so label() asks the
    // viewport; the register is the same words at either width.
    innerWidth: 1512, fitReadingLevels() {},
    sourcesOpen: value => calls.push({ action: 'sourcesOpen', value }), compose: () => calls.push({ action: 'compose' }),
    ...options,
  }
  if (context.materialKind) vm.runInNewContext(pairDistanceJS, { pairDistance, centreDistance: Math.hypot(4, .7) }, { timeout: 2000 })
  vm.runInNewContext(`${benchLabelJS}\nlabel()`, context, { filename: 'production bench label() declaration', timeout: 2000 })
  return { dock, detail, context, calls }
}

function assertFullRecord(record, work, entries) {
  assert.equal(record.dataset.register, 'record')
  for (const language of ['en', 'de']) assert.equal(byClass(record, `picture-register-first-${language}`)[0]?.textContent, work[`label_first_line_${language}`])
  const machine = descendants(record).filter(node => node.tagName === 'PRE').map(node => {
    try { return JSON.parse(node.textContent) } catch { return null }
  }).find(value => value?.collection?.id === work.id)
  assert(machine, 'Full JSON collection and source record missing')
  assert.equal(JSON.stringify(machine.collection), JSON.stringify(work))
  assert.equal(machine.sources.length, entries.length)
  for (const source of entries) {
    const held = machine.sources.find(item => item.plate?.id === source.plate.id)
    assert.equal(JSON.stringify(held?.plate), JSON.stringify(source.plate), source.plate.id)
    assert.equal(JSON.stringify(held?.preview), JSON.stringify(source.preview), source.preview.id)
    assert.equal(byClass(record, 'picture-licence').find(node => node.dataset.manifestId === source.plate.id)?.textContent, source.plate.licence)
    for (const language of ['en', 'de']) if (source.plate[`honesty_${language}`]) assert(byClass(record, 'picture-honesty').some(node => node.dataset.manifestId === source.plate.id && node.textContent === source.plate[`honesty_${language}`]), `${source.plate.id}: exact ${language} honesty line missing`)
  }
}

function assertPlainKey(detail) {
  const keyDetails = byClass(detail, 'picture-source-key')
  assert.equal(keyDetails.length, 1)
  const disclosure = keyDetails[0], key = byClass(disclosure, 'picture-certainty-key')[0]
  assert.equal(disclosure.tagName, 'DETAILS'); assert.equal(disclosure.open, false)
  assert.equal(disclosure.parentElement, detail, 'The plain key must remain in the drawer outside the machine record')
  assert.equal(disclosure.children[0].tagName, 'SUMMARY')
  assert.equal(disclosure.children[0].textContent, 'What the dots mean / Was die Punkte bedeuten')
  // Four certainty colours, then one open mark for a documented workshop
  // picture or copy. The open mark carries no colour of its own.
  assert.equal(key.children.length, 5)
  for (const [index, expected] of labels.PICTURE_CERTAINTY_KEY.entries()) {
    assert.equal(key.children[index].textContent, `${expected.en} · ${expected.de}`)
    assert.equal(key.children[index].style.getPropertyValue('--certainty'), expected.colour)
  }
  const hand = key.children[4]
  assert.ok(hand.className.includes('picture-key-hand'))
  assert.equal(hand.textContent, 'Workshop or copy · Werkstatt oder Kopie')
  assert.equal(hand.style.getPropertyValue('--certainty'), labels.PICTURE_CERTAINTY_KEY[0].colour)
  auditVisitor(disclosure, 'certainty-key', 'plain drawer key')
  disclosure.children[0].click(); assert.equal(disclosure.open, true)
  disclosure.children[0].click(); assert.equal(disclosure.open, false)
  return disclosure
}

for (const work of works) {
  const selection = policy.resolvePicturePolicy(work, manifest)
  test(`${work.id}: bilingual first line agrees with its certainty and dot`, () => {
    const text = labels.policyLabelText(work, selection.mainPlates)
    const certainty = labels.policyCertainty(work, selection.mainPlates.length > 0, selection.mainPlates)
    const expectedColour = !selection.mainPlates.length ? '#777e7b'
      : work.id === 'mona-lisa' && selection.mainPlates.some(entry => /print|druk|imprim/i.test(entry.plate.honesty_en ?? '')) ? '#b18b47'
      : work.attribution_certainty === 'disputed' ? '#b56152'
        : work.attribution_certainty === 'qualified' ? '#b18b47' : '#52735a'
    assert.equal(text.colour, expectedColour)
    assert.equal(certainty.colour, expectedColour)
    const node = labels.createPolicyWorkLabel(work, selection.mainPlates)
    assert.equal(node.style.getPropertyValue('--certainty'), expectedColour)
    for (const language of ['en', 'de']) {
      assert(text.firstLine[language].startsWith(`${certainty.word[language]}.`), `${language}: expected ${certainty.word[language]}. Got ${text.firstLine[language]}`)
      assert.equal(byClass(node, language === 'en' ? 'picture-first' : 'picture-first-de')[0]?.textContent, text.firstLine[language])
      assert.equal(byClass(node, language === 'en' ? 'picture-label-en' : 'picture-label-de')[0]?.lang, language)
    }
  })
  test(`${work.id}: the normal label contains only visitor prose`, () => {
    auditVisitor(labels.createPolicyWorkLabel(work, selection.mainPlates), work.id, 'label')
  })
  test(`${work.id}: the full record preserves every original string and raw source`, () => {
    const record = labels.createPictureRecord(work, selection.all)
    assert.equal(record.dataset.register, 'record'); assert.equal(record.hidden, true)
    assert(record.id, 'The record needs an addressable id')
    for (const language of ['en', 'de']) assert.equal(byClass(record, `picture-register-first-${language}`)[0]?.textContent, work[`label_first_line_${language}`])
    const machine = descendants(record).filter(node => node.tagName === 'PRE').map(node => {
      try { return JSON.parse(node.textContent) } catch { return null }
    }).find(value => value?.collection?.id === work.id)
    assert(machine, 'Full JSON collection and source record missing')
    assert.equal(JSON.stringify(machine.collection), JSON.stringify(work))
    assert.equal(machine.sources.length, selection.all.length)
    for (const source of selection.all) {
      const held = machine.sources.find(item => item.plate?.id === source.plate.id)
      assert.equal(JSON.stringify(held?.plate), JSON.stringify(source.plate), source.plate.id)
      assert.equal(JSON.stringify(held?.preview), JSON.stringify(source.preview), source.preview.id)
      const licence = byClass(record, 'picture-licence').find(node => node.dataset.manifestId === source.plate.id)
      assert.equal(licence?.textContent, source.plate.licence, source.plate.id)
      for (const language of ['en', 'de']) if (source.plate[`honesty_${language}`]) {
        assert(byClass(record, 'picture-honesty').some(node => node.dataset.manifestId === source.plate.id && node.textContent === source.plate[`honesty_${language}`]), `${source.plate.id}: exact ${language} honesty line missing`)
      }
    }
  })
  test(`${work.id}: actual bench label and drawer contain only visitor prose`, () => {
    const { dock, detail } = mountBenchLabel(work, selection.mainPlates)
    auditVisitor(dock, work.id, 'bench label'); auditVisitor(detail, work.id, 'bench drawer')
    assertPlainKey(detail)
  })
  test(`${work.id}: actual bench deliberately opens and closes its addressed record`, () => {
    const { detail } = mountBenchLabel(work, selection.mainPlates)
    const record = descendants(detail).find(node => node.dataset.register === 'record')
    assert(record, 'No declared record in actual bench drawer')
    const controls = descendants(detail).filter(node => node.getAttribute('aria-controls') === record.id)
    assert.equal(controls.length, 1, 'Exactly one control must address this record')
    const button = controls[0]
    assert.equal(button.tagName, 'BUTTON'); assert.equal(record.hidden, true)
    assert.equal(button.getAttribute('aria-expanded'), 'false')
    button.click(); assert.equal(record.hidden, false); assert.equal(button.getAttribute('aria-expanded'), 'true')
    button.click(); assert.equal(record.hidden, true); assert.equal(button.getAttribute('aria-expanded'), 'false')
    const opened = mountBenchLabel(work, selection.mainPlates, true)
    const selectedRecord = descendants(opened.detail).find(node => node.dataset.register === 'record')
    assert.equal(selectedRecord?.hidden, false, 'Explicit record rig view must start open')
    assert.equal(descendants(opened.detail).find(node => node.getAttribute('aria-controls') === selectedRecord.id)?.getAttribute('aria-expanded'), 'true')
  })
}
const mona = works.find(work => work.id === 'mona-lisa')
const monaSources = policy.resolvePicturePolicy(mona, manifest)
function assertSignatureTruth(node, absent) {
  const label = byClass(node, 'picture-policy-label')[0]
  assert(label, 'Signature policy label missing')
  assert.equal(label.dataset.workId, mona.id)
  assert.equal(label.style.getPropertyValue('--certainty'), absent ? '#777e7b' : '#b18b47')
  const expected = absent ? { en: 'Absent. Mona Lisa.', de: 'Nicht gezeigt. Mona Lisa.' }
    : { en: `Historical print, date uncertain. ${mona.title_en}.`, de: `Historischer Druck, Datum ungewiss. ${mona.title_de}.` }
  for (const language of ['en', 'de']) {
    const first = byClass(label, language === 'en' ? 'picture-first' : 'picture-first-de')[0]
    assert.equal(first?.textContent, expected[language])
    assert.equal(first.dataset.register, 'label')
    assert.equal(byClass(label, `picture-label-${language}`)[0].lang, language)
    if (absent) assert.equal(byClass(label, language === 'en' ? 'picture-reason' : 'picture-reason-de')[0]?.textContent, signature.SIGNATURE_NOTE[language])
  }
  assert(!/Documented\.|Belegt\./.test(label.textContent), 'Print date uncertainty must not become a documented reproduction claim')
  if (absent) assert(!/public domain|gemeinfrei|C2RMF|not been cleared|nicht freigegeben/i.test(label.textContent), 'The absent field must not carry a conflicting image licence or clearance claim')
  auditVisitor(label, mona.id, absent ? 'signature absence label' : 'signature print label')
  return label
}
test('Signature absence is plain and grey while the available historical print retains its uncertain date', () => {
  assert(monaSources.mainPlates.length > 0, 'The signature absence must be a presentation choice with an admitted print available')
  assert(monaSources.mainPlates.some(entry => /print/i.test(entry.plate.honesty_en ?? '')))
  const absent = signature.createSignatureLabel()
  assertSignatureTruth(absent, true)
  const printed = labels.createPolicyWorkLabel(mona, monaSources.mainPlates)
  assertSignatureTruth(printed, false)
  const notes = byClass(printed, 'picture-reason')[0].textContent
  assert.match(notes, /publication date is uncertain/)
  assert.match(notes, /cannot establish the painting’s colour/)
  const notesDe = byClass(printed, 'picture-reason-de')[0].textContent
  assert.match(notesDe, /Erscheinungsdatum ist ungewiss/)
  // The plate is a colour print: it shows colours, it cannot vouch for the painting's.
  assert.match(notesDe, /Farb\p{L}* des Gemäldes (?:kann sie )?nicht belegen/u)
})
test('Actual signature Sources offers the historical print and preserves its deliberately opened full record', () => {
  const state = mountBenchLabel(mona, monaSources.mainPlates, false, { segmentId: 'signature', documentOnlyIds: ['mona-lisa'] })
  assertSignatureTruth(state.dock, true)
  auditVisitor(state.detail, mona.id, 'signature Sources drawer')
  assertPlainKey(state.detail)
  const record = byClass(state.detail, 'picture-full-record')[0]
  assert.equal(record.hidden, true); assertFullRecord(record, mona, monaSources.mainPlates)
  const openRecord = byClass(state.detail, 'picture-open-record')[0]
  assert.equal(openRecord.getAttribute('aria-controls'), record.id)
  openRecord.click(); assert.equal(record.hidden, false); assert.equal(openRecord.getAttribute('aria-expanded'), 'true')
  openRecord.click(); assert.equal(record.hidden, true)
  const printButtons = byClass(state.detail, 'picture-open-print')
  const print = printButtons.find(button => button.parentElement === state.detail)
  assert(print, 'Historical-print control must be directly available in Sources')
  assert.equal(print.textContent, 'View the historical print / Historischen Druck ansehen')
  assert(state.detail.children.indexOf(print) < state.detail.children.indexOf(openRecord))
  const study = printButtons.find(button => button.parentElement === record)
  assert.equal(study?.textContent, 'Study the moulding / Rahmenprofil ansehen')
  print.click()
  assert.equal(state.context.view, 'print')
  assert.deepEqual(state.calls, [{ action: 'sourcesOpen', value: false }, { action: 'compose' }])
  assertSignatureTruth(state.dock, false)
  auditVisitor(state.detail, mona.id, 'signature print Sources drawer')
  assertPlainKey(state.detail)
  const printRecord = byClass(state.detail, 'picture-full-record')[0]
  assert.equal(printRecord.hidden, true); assertFullRecord(printRecord, mona, monaSources.mainPlates)
  const explicitlyOpened = mountBenchLabel(mona, monaSources.mainPlates, true, { segmentId: 'signature', view: 'print', documentOnlyIds: ['mona-lisa'] })
  assert.equal(byClass(explicitlyOpened.detail, 'picture-full-record')[0].hidden, false)
  assertSignatureTruth(explicitlyOpened.dock, false)
})
test('Signature truth checks reject mismatched certainty colours and unsupported documented-print language', () => {
  const absent = signature.createSignatureLabel()
  absent.style.setProperty('--certainty', '#52735a')
  assert.throws(() => assertSignatureTruth(absent, true))
  const printed = labels.createPolicyWorkLabel(mona, monaSources.mainPlates)
  byClass(printed, 'picture-first')[0].textContent = 'Documented. Mona Lisa.'
  assert.throws(() => assertSignatureTruth(printed, false))
})

// The material branch only consumes its pair's declared source set. Derive
// that mapping from the actual production module without loading GPU code.
const materialSource = read('src/wings/vinci/pictures/bench/material-pairs.ts')
const materialTree = ts.createSourceFile('src/wings/vinci/pictures/bench/material-pairs.ts', materialSource, ts.ScriptTarget.ES2022, true)
const materialSetsDeclaration = materialTree.statements.filter(node => ts.isVariableStatement(node)
  && node.declarationList.declarations.some(declaration => declaration.name.getText(materialTree) === 'SETS'))
assert.equal(materialSetsDeclaration.length, 1)
const materialSets = vm.runInNewContext(`${transpile(ts.createPrinter().printNode(ts.EmitHint.Unspecified, materialSetsDeclaration[0], materialTree))}\nSETS`, {}, { timeout: 2000 })
const materialKinds = Object.keys(materialSets)
assert.deepEqual(materialKinds, ['gold', 'plaster', 'oak', 'limestone'])
for (const kind of materialKinds) {
  const sourceSet = `library/${materialSets[kind]}`
  const mountMaterial = () => mountBenchLabel(mona, [], false, { segmentId: 'materials', materialKind: kind, materialKinds,
    materialPair: { group: { userData: { materialPair: { sourceSet } } } } })
  test(`${kind}: actual material label and drawer keep machine strings and punctuation in the record`, () => {
    const state = mountMaterial()
    const errors = []
    for (const [node, place] of [[state.dock, 'material label'], [state.detail, 'material drawer']]) {
      try { auditVisitor(node, kind, place) } catch (error) { errors.push(error.message) }
    }
    assert.equal(errors.length, 0, errors.join('\n'))
  })
  test(`${kind}: material licence chain is complete and opens only through its plain details summary`, () => {
    const state = mountMaterial(), details = byClass(state.detail, 'picture-material-record')[0]
    assert(details, 'Actual material record missing')
    assert.equal(details.tagName, 'DETAILS'); assert.equal(details.open, false)
    const summary = details.children[0], chain = byClass(details, 'picture-material-chain')[0]
    assert.equal(summary.tagName, 'SUMMARY'); assert.equal(summary.textContent, 'Read the full material record / Materialnachweis lesen')
    assert.equal(chain.dataset.register, 'record')
    for (const id of [sourceSet, 'vinci/pictures/material-pairs', 'vinci/pictures/bench-room', 'vinci/pictures/frame-gilding']) {
      const entry = manifest.byId.get(id)
      assert(entry, `Required current material source missing: ${id}`)
      assert(byClass(chain, 'picture-licence').some(node => node.textContent === `${entry.id} · ${entry.class}\n${entry.licence}`), `${id}: exact licence missing`)
      if (entry.sha256) assert(byClass(chain, 'picture-source-hash').some(node => node.textContent === `SHA-256 ${entry.sha256}`), `${id}: exact hash missing`)
    }
    summary.click(); assert.equal(details.open, true)
    summary.click(); assert.equal(details.open, false)
    auditVisitor(summary, kind, 'material record summary')
  })
}
test('The production label and drawer leave the locked register and public manifest unchanged', () => {
  assert.equal(JSON.stringify({ works, rawManifest }), immutableBefore)
})
const report = { kind: 'window-3-register-check', browser: false, network: false,
  manifestSource: 'public/na-manifest.json', workCount: works.length,
  limitations: ['Executes production label construction and event handlers in a minimal DOM. Details summary default activation is simulated. No browser layout, CSS, GPU or EYES claim.',
    'Material pair metadata uses the production source-set mapping with a declared geometric centre-distance input. The actual distance text assignment is executed, but material geometry and camera equivalence are outside this check.',
    'Sources closing and scene composition callbacks are recorded doubles. The print click executes the real view change and rebuilt label/record DOM.'],
  sourceHashes, ok: tests.every(result => result.ok),
  passed: tests.filter(result => result.ok).length, total: tests.length,
  refusalCount: refusals.length, refusals, results: tests }
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
