#!/usr/bin/env node
/** Exercise the actual bench controller with controlled asynchronous resources.
 * Run: node src/wings/vinci/pictures/bench/lifecycle-check.mjs
 * No browser or network: rendering, materials, register and DOM are doubles.
 * Tests observe routes, resource ownership and public hooks, not source text.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import * as Three from 'three/webgpu'
import * as TSL from 'three/tsl'
import { offlineHost } from './offline-rig.mjs'

const file = fileURLToPath(new URL('./index.ts', import.meta.url))
const source = readFileSync(file, 'utf8')
const js = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
}, fileName: file }).outputText
const registrationFile = fileURLToPath(new URL('../registration.ts', import.meta.url))
const registrationSource = readFileSync(registrationFile, 'utf8')
const policyLabelFile = fileURLToPath(new URL('../policy-label.ts', import.meta.url))
const policyLabelSource = readFileSync(policyLabelFile, 'utf8')
const visitorCopyFile = fileURLToPath(new URL('../visitor-copy.ts', import.meta.url))
const visitorCopySource = readFileSync(visitorCopyFile, 'utf8')
const signatureLabelFile = fileURLToPath(new URL('../signature-label.ts', import.meta.url))
const signatureLabelSource = readFileSync(signatureLabelFile, 'utf8')
const readingRulerFile = fileURLToPath(new URL('./reading-ruler.ts', import.meta.url))
const readingRulerSource = readFileSync(readingRulerFile, 'utf8')
const collectionFile = fileURLToPath(new URL('../data/paintings.json', import.meta.url))
const collectionSource = readFileSync(collectionFile, 'utf8'), collection = JSON.parse(collectionSource).works
const shadowFilterFile = fileURLToPath(new URL('./picture-shadow-filter.ts', import.meta.url))
const shadowFilterSource = readFileSync(shadowFilterFile, 'utf8')
const shadowFilter = {}
vm.runInNewContext(ts.transpileModule(shadowFilterSource, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText, { exports: shadowFilter, require(name) {
  if (name === 'three/tsl') return TSL
  throw new Error(`Unexpected picture shadow dependency: ${name}`)
} }, { filename: shadowFilterFile, timeout: 2000 })
const registration = {}
vm.runInNewContext(ts.transpileModule(registrationSource, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText, { exports: registration, require(name) { throw new Error(`Unexpected registration dependency: ${name}`) } },
{ filename: registrationFile, timeout: 2000 })
const flush = async () => { for (let i = 0; i < 60; i++) await Promise.resolve() }
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const SEGMENTS = [
  { id: 'early', title: 'Early', initialWorkId: 'early-middle', workIds: ['early-first', 'early-middle', 'early-last'] },
  { id: 'late', title: 'Late', initialWorkId: 'late-middle', workIds: ['late-first', 'late-middle', 'late-last'] },
]
const AUDIT_SEGMENTS = [
  { id: 'complete-hang', title: 'Audit fixture', initialWorkId: 'audit-work-2',
    workIds: Array.from({ length: 10 }, (_, index) => index === 7 ? 'lady-with-an-ermine' : `audit-work-${index + 1}`) },
  { id: 'materials', title: 'Material fixture', initialWorkId: 'material-fixture', workIds: ['material-fixture'] },
]

function harness(initial = '/', { segments = SEGMENTS, nearPlate = false, pairedPanel = false, signaturePlate = false, width = 1344, height = 840 } = {}) {
  const getSegment = id => {
    const segment = segments.find(s => s.id === id)
    if (!segment) throw new Error(`Unknown picture segment: ${id}`)
    return segment
  }
  // Controller identities remain symbolic. Complete actual record fields let
  // the current production record constructor run instead of mocking it out.
  const works = id => getSegment(id).workIds.map(id => ({ ...(collection.find(work => work.id === id) ?? collection.find(work => work.id === 'mona-lisa')),
    id, title_en: id, title_de: id, rights_class: 'RC', display_mode: 'absence_outline', hang: { eye_height_cm: 155 } }))
  let currentURL = new URL(initial, 'http://bench.test'), tier = 'standard', phase = 'held', currentScene = null
  const listeners = new Map(), pushes = [], scopes = [], probes = [], hangs = [], rooms = [], keys = [], labels = [], gi = [], catalogues = [], evidencePanels = [], materialPairs = []
  const failures = { room: false }
  const document = { activeElement: null }
  class Element {
    constructor(tag, cls = '', text = '') {
      this.tagName = tag; this.className = cls; this.children = []; this.parent = null; this.textContent = text
      this.dataset = {}; this.attributes = {}
      this.style = { setProperty(name, value) { this[name] = String(value) },
        removeProperty(name) { const was = this[name]; delete this[name]; return was ?? '' } }; this.hidden = false; this.open = false
      this.classList = {
        add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/), ...names])].filter(Boolean).join(' ') },
        remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => name && !names.includes(name)).join(' ') },
        contains: name => this.className.split(/\s+/).includes(name),
        // The room's painted name swaps a class when the phone takes over.
        toggle: (name, force) => { const on = force ?? !this.classList.contains(name)
          if (on) this.classList.add(name); else this.classList.remove(name); return on },
      }
    }
    get textContent() { return this._text + this.children.map(child => child.textContent).join('') }
    set textContent(value) { this._text = String(value ?? ''); for (const child of this.children) child.parent = null; this.children = [] }
    append(...children) { for (const child of children) { child.remove(); child.parent = this; this.children.push(child) } }
    prepend(...children) { for (const child of [...children].reverse()) { child.remove(); child.parent = this; this.children.unshift(child) } }
    replaceChildren(...children) { this.textContent = ''; this.append(...children) }
    insertBefore(child, reference) { assert(reference === null || this.children.includes(reference)); if (child === reference) return child; child.remove(); child.parent = this; this.children.splice(reference === null ? this.children.length : this.children.indexOf(reference), 0, child); return child }
    setAttribute(name, value) { this.attributes[name] = value }
    getAttribute(name) { return this.attributes[name] ?? null }
    hasAttribute(name) { return this.getAttribute(name) !== null }
    querySelector(selector) { return this.children.flatMap(child => [child, ...child.querySelectorAll(selector)]).find(child => child.matches(selector)) ?? null }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]) }
    focus() { document.activeElement = this }
    showModal() { this.open = true }
    close() { this.open = false }
    matches(selector) { return selector.split(',').some(s => s.startsWith('.') ? this.className.split(' ').includes(s.slice(1)) : this.tagName === s) }
    closest(selector) { for (let at = this; at; at = at.parent) if (at.matches(selector)) return at; return null }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null }
  }
  const element = (tag, cls = '', text = '') => new Element(tag, cls, text)
  document.body = element('body'); document.head = element('head'); document.createElement = tag => element(tag)
  const location = {}
  for (const property of ['pathname', 'search', 'hash']) Object.defineProperty(location, property, { get: () => currentURL[property] })
  const history = {
    replaceState(_state, _title, url) { currentURL = new URL(url, currentURL) },
    pushState(_state, _title, url) { pushes.push(currentURL.pathname + currentURL.search + currentURL.hash); currentURL = new URL(url, currentURL) },
  }
  const original = {
    jump(next) { phase = next; document.body.dataset.phase = next; document.body.dataset.forge = next; currentScene = null },
    state: () => ({ phase }), tier: name => { tier = name },
    station: () => false, rail() {}, look() {}, relight() {}, manifest: () => [],
  }
  const window = { __forge: original }
  const stack = {
    render() {}, tierName: () => tier, tierConfig: () => ({ name: tier }),
    setScene(scene) { currentScene = scene },
    cost: () => ({ textureMB: 12, frames: 150, draws: 1, triangles: 20, budget: { textureMB: 256 } }),
    materials: { pending: () => 0 },
    hdri: async () => ({ texture: {}, entry: { id: 'sky-overcast' }, sun: {} }),
    lights: () => keys.filter(key => !key.disposals).length,
    sceneObjects: () => currentScene?.children.length ?? 0,
    light() {
      const light = new Three.DirectionalLight()
      light.castShadow = tier !== 'calm'
      const key = { fill: { color: new Three.Color(), groundColor: new Three.Color() }, light,
        disposals: 0, dispose() { this.disposals++; light.dispose() } }
      keys.push(key); return key
    },
  }
  function createBenchMaterialBudget() {
    const gate = deferred(), ownedTier = tier
    const scope = { tier: ownedTier, gate, disposals: 0, settled: false, stack: { ...stack },
      prepare() { return gate.promise.finally(() => { scope.settled = true }) },
      pending: () => scope.settled ? 0 : 1, textureMB: () => 1, errors: () => [],
      dispose() { scope.disposals++ } }
    scopes.push(scope); return scope
  }
  function createBenchProbe(sky) {
    const probe = { probe: sky, disposals: 0, textureMB: () => 4, dispose() { this.disposals++ } }
    probes.push(probe); return probe
  }
  function buildHang(_stack, register) {
    const frames = register.map((work, i) => ({ work, left: i * 1.5, right: i * 1.5 + .5,
      x: i * 1.5 + .25, y: 1.55, width: .5, height: .5, aperture: null, cards: [], dot: element('button', 'picture-dot'), caption: element('div') }))
    const wall = new Three.Group()
    if (nearPlate) {
      const frame = frames.find(frame => frame.work.id === 'lady-with-an-ermine')
      assert.ok(frame, 'The near-pose fixture must contain the Ermine')
      const mesh = new Three.Mesh(new Three.PlaneGeometry(.366, .54), new Three.MeshBasicMaterial())
      mesh.position.set(frame.x, frame.y, .023)
      wall.add(mesh)
      frame.cards.push({ mesh, entry: {
        // Symbolic transport metadata: this lifecycle fixture never requests
        // an image file; actual source/decoder validation has separate suites.
        plate: { id: 'fixture/ermine/plate', class: 'CAPTURED', path: 'fixture-transport/ermine-plate', licence: 'Fixture only' },
        preview: { id: 'fixture/ermine/preview', wing: 'fixture', path: 'fixture-transport/ermine-preview' },
      }, stream: { residency: () => ({ preview: 'resident' }), allocation: () => ({ previewMB: 0 }) } })
    }
    if (pairedPanel || signaturePlate) {
      const frame = frames.find(frame => frame.work.id === (pairedPanel ? 'ginevra-de-benci' : 'mona-lisa'))
      assert(frame, 'State fixture requires its declared work')
      frame.width = frame.work.width_cm / 100; frame.height = frame.work.height_cm / 100
      for (const [index, face] of (pairedPanel ? ['front', 'reverse'] : ['front']).entries()) {
        const mesh = new Three.Mesh(new Three.PlaneGeometry(frame.width, frame.height), new Three.MeshBasicMaterial())
        mesh.position.set(frame.x + index * (frame.width + .34), frame.y, .023); wall.add(mesh)
        frame.cards.push({ mesh, entry: {
          id: `fixture/${frame.work.id}/${face}`, face,
          pixels: { width: frame.width * 1000, height: frame.height * 1000 },
          plate: { id: `fixture/${frame.work.id}/${face}/plate`, work_id: frame.work.id, class: 'CAPTURED', path: `fixture-transport/${face}-plate`, licence: 'Fixture only',
            ...(signaturePlate ? { honesty_en: 'Historical printed reproduction. Exact publication date is unverified.', honesty_de: 'Historische Druckreproduktion. Erscheinungsdatum ungewiss.' } : {}) },
          preview: { id: `fixture/${frame.work.id}/${face}/preview`, wing: 'fixture', path: `fixture-transport/${face}-preview` },
        }, stream: { residency: () => ({ preview: 'resident' }), allocation: () => ({ previewMB: 0 }) } })
      }
      frame.left = frame.x - frame.width / 2
      frame.right = frame.cards.at(-1).mesh.position.x + frame.width / 2
    }
    const hang = { wall, frames, labels: element('div', 'picture-anchors'), extent: 4,
      disposals: 0, stream() {}, update() {}, setVisible(ids, only, face) { this.visibility = { ids, only, face } },
      documentOnlyIds: new Set(),
      setAbsent(ids = [], reveal = []) { this.absentIds = [...ids].filter(id => !reveal.includes(id)); this.revealedIds = [...reveal] },
      pending: () => 0, errors: () => [], textureMB: () => 0,
      dispose() { this.disposals++; this.wall.removeFromParent(); this.labels.remove()
        for (const frame of frames) for (const card of frame.cards) { card.mesh.geometry.dispose(); card.mesh.material.dispose() } } }
    hangs.push(hang); return hang
  }
  function buildPictureRoom() {
    if (failures.room) throw new Error('Injected room construction failure')
    const room = { group: new Three.Group(), disposals: 0, dispose() { this.disposals++; this.group.removeFromParent() } }
    const wall = new Three.Mesh(new Three.PlaneGeometry(4, 6), new Three.MeshStandardNodeMaterial())
    wall.name = 'vinci/pictures/room/plaster'
    room.group.add(wall)
    rooms.push(room); return room
  }
  function createSourceCatalogue(manifest, options) {
    assert.ok(manifest.byId instanceof Map && Array.isArray(manifest.all), 'Catalogue needs the mounted manifest')
    assert.equal(typeof options.onClose, 'function')
    const catalogue = {
      root: element('section', 'picture-source-catalogue'), options, manifest,
      identity: options.selectedId ?? 'fixture-source', imagesPending: 3, errors: [], disposals: 0,
      selected() { return this.identity },
      measure() { return { kind: 'picture-source-catalogue', selectedSource: this.identity,
        imagesPending: this.imagesPending, errors: [...this.errors] } },
      dispose() { this.disposals++; this.root.replaceChildren() },
    }
    catalogues.push(catalogue)
    return catalogue
  }
  function createHangEvidencePanel(options) {
    let currentPage = options.page ?? 1
    const panel = { root: element('section', 'picture-evidence'), options, updates: [], disposals: 0,
      update(value, requestedPage) { this.updates.push(value); if (requestedPage !== undefined) currentPage = requestedPage },
      page: () => currentPage,
      selectPage(page) { currentPage = page; options.onPageChange?.(page) },
      dispose() { this.disposals++ } }
    evidencePanels.push(panel)
    return panel
  }
  function buildMaterialPair(_stack, kind) {
    assert.ok(segments.some(segment => segment.id === 'materials'), 'Unexpected material pair in lifecycle fixture')
    const group = new Three.Group()
    group.userData.materialPair = { kind, sourceSet: `fixture/material/${kind}` }
    const pair = { group, captions: [], disposals: 0,
      dispose() { this.disposals++; group.removeFromParent() } }
    materialPairs.push(pair)
    return pair
  }
  const visitorCopy = {}, policyLabel = {}, signatureLabel = {}, readingRuler = {}
  vm.runInNewContext(ts.transpileModule(visitorCopySource, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText, { exports: visitorCopy }, { filename: visitorCopyFile, timeout: 2000 })
  vm.runInNewContext(ts.transpileModule(policyLabelSource, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText, { exports: policyLabel, document, require(name) {
    if (name === './registration') return registration
    if (name === './visitor-copy') return visitorCopy
    throw new Error(`Unexpected policy label dependency: ${name}`)
  } }, { filename: policyLabelFile, timeout: 2000 })
  vm.runInNewContext(ts.transpileModule(signatureLabelSource, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText, { exports: signatureLabel, document, require(name) {
    assert.equal(name, './policy-label'); return policyLabel
  } }, { filename: signatureLabelFile, timeout: 2000 })
  vm.runInNewContext(ts.transpileModule(readingRulerSource, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText, { exports: readingRuler, require(name) {
    if (name === 'three/webgpu') return Three
    if (name === '..') return { element }
    throw new Error(`Unexpected reading ruler dependency: ${name}`)
  } }, { filename: readingRulerFile, timeout: 2000 })
  const modules = {
    'three/webgpu': Three, '../../../../stack/grade': { IDENTITY: {} },
    '../../../../stack/materials': { ASSET_BASE: '/mock-assets/',
      assetAddress: (record, part) => `/mock-assets/${record.wing}/${record.path}${part ?? ''}`
        + (record.sha256 ? `?v=${record.sha256.slice(0, 12)}` : '') }, '../registration': registration,
    '../policy-label': policyLabel,
    '../visitor-copy': visitorCopy,
    '../signature-label': signatureLabel,
    '../../../../manifest': { loadManifest: async () => ({ byId: new Map(), all: [] }) },
    '../../../../core/labels': { readLabels: () => [] }, '../../../../content/disclosures': { DISCLOSURES: [] },
    '..': {
      buildHang, element, getSegment, segmentWorks: works, SEGMENTS: segments, measureProjectedWork: () => null,
      createWorkLabel(work, entries) { const label = policyLabel.createPolicyWorkLabel(work, entries); labels.push(label); return label },
    },
    './room': { buildPictureRoom }, './material-budget': { createBenchMaterialBudget },
    './source-catalogue': { createSourceCatalogue },
    './reading-ruler': readingRuler,
    './picture-shadow-filter': shadowFilter,
    './probe-budget': { createBenchProbe }, './pictures.css?raw': { default: '' },
    './evidence-panel': { hangEvidencePanelCSS: '', createHangEvidencePanel },
    './gi-config.json': { default: JSON.parse(readFileSync(new URL('./gi-config.json', import.meta.url), 'utf8')) },
    './shadow-fit': { fitBenchKeyShadow: () => ({}) },
    './material-pairs': { buildMaterialPair },
    './gi-index': { getBenchGI() {
      const field = { debug: {}, disposals: 0, apply() {}, textureMB: () => field.disposals ? 0 : .0625, dispose() { field.disposals++ } }
      gi.push(field); return field
    } },
  }
  const exports = {}
  vm.runInNewContext(js, {
    exports, window, document, location, history, URLSearchParams,
    innerWidth: width, innerHeight: height, performance: { now: () => 5000 },
    addEventListener(type, listener) { const list = listeners.get(type) ?? []; list.push(listener); listeners.set(type, list) },
    require(name) { assert.ok(name in modules, `Unmocked dependency: ${name}`); return modules[name] },
  }, { filename: file, timeout: 2000 })
  const host = offlineHost(original, stack, window)
  const installed = exports.createPictureBench(stack, host.onLobby).then(module => host.attach(module))
  const find = (cls, at = document.body) => at.matches(`.${cls}`) ? at : at.children.map(child => find(cls, child)).find(Boolean)
  return {
    installed, scopes, probes, hangs, rooms, keys, labels, gi, catalogues, evidencePanels, materialPairs, failures, pushes, stack, document,
    forge: () => window.__forge, url: () => currentURL.pathname + currentURL.search + currentURL.hash,
    setURL(url) { currentURL = new URL(url, currentURL) }, find,
    dispatch(type, values = {}) {
      const event = { target: document.body, stopped: false, prevented: false,
        stopImmediatePropagation() { this.stopped = true }, preventDefault() { this.prevented = true }, ...values }
      for (const listener of listeners.get(type) ?? []) { listener(event); if (event.stopped) break }
      return event
    },
    async mount(segment = 'early', options = {}) {
      window.__forge.jump('bench', { segment, ...options }); await flush()
      scopes.at(-1)?.gate.resolve(); await flush()
    },
  }
}

const tests = []
const test = (name, run) => tests.push({ name, run })
function assertOrdinarySources(h) {
  const detail = h.find('picture-drawer-content'), introduction = h.find('picture-drawer-introduction', detail)
  const record = h.find('picture-full-record', detail), control = h.find('picture-open-record', detail)
  assert.equal(introduction?.parent, detail, 'Ordinary Sources must restore its plain introduction')
  assert.equal(record?.dataset.register, 'record'); assert.equal(record.hidden, true)
  assert.equal(control?.getAttribute('aria-controls'), record.id)
  assert.equal(control.getAttribute('aria-expanded'), 'false')
  control.onclick(); assert.equal(record.hidden, false); assert.equal(control.getAttribute('aria-expanded'), 'true')
  control.onclick(); assert.equal(record.hidden, true); assert.equal(control.getAttribute('aria-expanded'), 'false')
}
test('initial route restores its work hash', async () => {
  const h = harness('/bench/vinci/pictures/late#work=late-last')
  await flush(); h.scopes[0].gate.resolve(); await h.installed
  assert.equal(h.forge().hang().selected, 'late-last')
  assert.equal(h.url(), '/bench/vinci/pictures/late#work=late-last')
})
test('Back while preparing cancels ownership and cannot resurrect the bench', async () => {
  const h = harness(); await h.installed
  h.forge().jump('bench', { segment: 'early' }); await flush()
  assert.equal(h.forge().state().phase, 'bench')
  assert.equal(h.dispatch('wheel', { deltaY: 120 }).stopped, true)
  assert.equal(h.dispatch('keydown', { key: 'ArrowDown' }).stopped, true)
  assert.equal(h.dispatch('touchmove', { touches: [] }).stopped, true)
  h.setURL('/'); h.dispatch('popstate')
  h.scopes[0].gate.resolve(); await flush()
  assert.equal(h.forge().state().phase, 'held'); assert.equal(h.hangs.length, 0)
  assert.equal(h.url(), '/'); assert.equal(h.find('picture-bench').hidden, true)
})
test('an obsolete prepare rejection cannot replace a newer successful mount', async () => {
  const h = harness(); await h.installed
  h.forge().jump('bench', { segment: 'early' }); await flush()
  const obsolete = h.scopes[0]
  h.forge().jump('held'); await h.mount('late')
  obsolete.gate.reject(new Error('Obsolete request failed')); await flush()
  assert.equal(h.forge().hang().selected, 'late-middle')
  assert.equal(h.forge().state().error, null)
  assert.equal(h.find('picture-load-error'), undefined)
  assert.equal(h.document.body.dataset.forge, 'bench')
})
test('a partial mount failure disposes the completed hang, light and material scope', async () => {
  const h = harness(); await h.installed; h.failures.room = true; await h.mount()
  assert.equal(h.hangs[0].disposals, 1); assert.equal(h.keys[0].disposals, 1)
  assert.equal(h.scopes[0].disposals, 1)
  assert.match(h.forge().state().error, /Injected room construction failure/)
  assert.equal(h.document.body.dataset.forge, 'bench-error')
  assert.doesNotThrow(() => h.stack.render(.016))
})
test('invalid work membership is a visible error without unhandled rejection', async () => {
  const h = harness(); await h.installed
  h.forge().jump('bench', { segment: 'early', work: 'late-first' }); await flush()
  assert.match(h.forge().state().error, /Work is not in segment/)
  assert.equal(h.scopes.length, 0); assert.equal(h.hangs.length, 0)
  assert.equal(h.find('picture-load-error').hidden, false)
})
test('forward and backward segment boundaries restore the adjacent work', async () => {
  const h = harness(); await h.installed; await h.mount('early', { work: 'early-last' })
  h.dispatch('keydown', { key: 'ArrowRight' }); await flush()
  assert.equal(h.forge().hang().selected, 'late-first')
  h.dispatch('keydown', { key: 'ArrowLeft' }); await flush()
  assert.equal(h.forge().hang().selected, 'early-last')
  assert.equal(h.pushes.length, 2)
})
test('popstate restores segment/work without adding a history entry', async () => {
  const h = harness(); await h.installed; await h.mount()
  h.setURL('/bench/vinci/pictures/late#work=late-last'); h.dispatch('popstate'); await flush()
  assert.equal(h.forge().hang().selected, 'late-last'); assert.equal(h.pushes.length, 0)
})
test('resize preserves drawer content and focus', async () => {
  const h = harness(); await h.installed; await h.mount()
  const content = h.find('picture-drawer-content'), label = content.children[0]
  label.focus(); const count = h.labels.length
  h.dispatch('resize')
  assert.equal(content.children[0], label); assert.equal(h.document.activeElement, label)
  assert.equal(h.labels.length, count)
})
test('leaving releases mount resources, accounts for the retained probe and reuses it on reentry', async () => {
  const h = harness(); await h.installed; await h.mount(); h.forge().jump('held')
  assert.equal(h.scopes[0].disposals, 1); assert.equal(h.hangs[0].disposals, 1)
  assert.equal(h.rooms[0].disposals, 1); assert.equal(h.keys[0].disposals, 1)
  assert.equal(h.gi[0].disposals, 1, 'The mounted wall irradiance upload must be released on departure')
  // The renderer can retain PMREM generator scratch storage after source
  // disposal. This controller intentionally caches one private probe instead.
  assert.equal(h.probes[0].disposals, 0)
  assert.ok(h.forge().cost().textureMB >= h.stack.cost().textureMB + h.probes[0].textureMB(),
    'The retained private probe disappeared from off-bench memory accounting')
  await h.mount()
  assert.equal(h.probes.length, 1, 'Reentry allocated another private probe')
})
test('tier change during preparation replaces the obsolete material scope', async () => {
  const h = harness(); await h.installed
  h.forge().jump('bench', { segment: 'early', work: 'early-last' }); await flush()
  h.forge().tier('calm'); await flush()
  assert.equal(h.scopes.at(-1).tier, 'calm', 'The initial old-tier scope still owns the pending mount')
  assert.equal(h.scopes[0].disposals, 1)
  h.scopes[0].gate.reject(new Error('Disposed standard scope')); h.scopes.at(-1).gate.resolve(); await flush()
  assert.equal(h.forge().hang().selected, 'early-last')
  assert.equal(h.forge().state().error, null)
})
async function remountTier(h, tier) {
  const previousHang = h.hangs.at(-1), previousEvidence = h.evidencePanels.at(-1)
  const previousScope = h.scopes.at(-1)
  h.forge().tier(tier); await flush()
  assert.equal(previousHang.disposals, 1, 'The previous tier still owns its hang')
  assert.equal(previousEvidence.disposals, 1, 'The previous tier still owns its evidence panel')
  assert.equal(previousScope.disposals, 1, 'The previous tier still owns its material scope')
  assert.equal(h.scopes.at(-1).tier, tier)
  h.scopes.at(-1).gate.resolve(); await flush()
  assert.equal(h.forge().state().error, null)
  assert.equal(h.forge().state().phase, 'bench')
}
for (const scenario of [
  { view: 'audit-row-8', page: 8, costOnly: false, selected: 'lady-with-an-ermine' },
  { view: 'audit-cost', page: 1, costOnly: true, work: 'audit-work-10', selected: 'audit-work-10' },
  { view: 'near-audit-cost', page: 1, costOnly: true, work: 'lady-with-an-ermine', selected: 'lady-with-an-ermine', near: true },
]) test(`Tier remount preserves ${scenario.view}, selection, and interactive Sources state`, async () => {
  const h = harness('/', { segments: AUDIT_SEGMENTS, nearPlate: scenario.near === true })
  await h.installed; await h.mount('complete-hang', { view: scenario.view, ...(scenario.work ? { work: scenario.work } : {}) })
  const initialCamera = h.forge().hang().camera
  function assertView(sourcesOpen) {
    const measured = h.forge().hang(), panel = h.evidencePanels.at(-1)
    assert.equal(measured.selected, scenario.selected, 'The tier change lost the selected work')
    assert.equal(panel.options.page, scenario.page, 'The tier change reset the requested audit row')
    assert.equal(panel.options.pageSize, 1)
    assert.equal(panel.options.compact, !scenario.costOnly, 'The tier change lost the compact or cost mode')
    assert.equal(panel.options.download, true)
    assert.equal(panel.root.hidden, false, 'The tier change hid the requested audit')
    assert.equal(panel.root.dataset.costOnly, String(scenario.costOnly))
    assert.equal(h.find('picture-bench').dataset.audit, 'true')
    assert.equal(h.find('picture-drawer').open, sourcesOpen, 'The tier change changed Sources visibility')
    assert.equal(h.find('picture-sources').attributes['aria-expanded'], String(sourcesOpen))
    assert.equal(measured.sourceCatalogue, null, 'Ordinary Sources must not acquire a catalogue')
    assert.equal(measured.materialPair, null)
    assert.deepEqual(Array.from(measured.camera.position), Array.from(initialCamera.position), 'The tier change moved the audit camera')
    assert.equal(measured.camera.fov, initialCamera.fov)
    if (scenario.near) {
      assert.equal(measured.camera.view, 'near')
      assert.ok(Math.abs(measured.camera.selectedPlateDistanceM - .45) < 1e-9, 'The near source left its declared 45 cm pose')
      assert.equal(h.find('picture-datum').textContent, '45 cm · source detail')
    }
    h.stack.render(.016)
    assert.equal(h.find('picture-dock').hidden, true, 'The label dock obscures the audit after remount')
    assert.equal(panel.updates.at(-1).selected, scenario.selected, 'The audit did not receive the selected work')
  }
  try {
    assertView(false)
    await remountTier(h, 'calm'); assertView(false)
    h.find('picture-sources').onclick(); assertView(true)
    await remountTier(h, 'hero'); assertView(true)
    h.find('picture-drawer-close').onclick(); assertView(false)
    await remountTier(h, 'standard'); assertView(false)
    if (!scenario.costOnly) {
      h.evidencePanels.at(-1).selectPage(9)
      assert.equal(h.forge().hang().selected, 'audit-work-9', 'The evidence pager did not select its work')
      await remountTier(h, 'calm')
      const panel = h.evidencePanels.at(-1)
      assert.equal(panel.options.page, 9, 'The tier change restored the initial row instead of the visitor’s current row')
      assert.equal(panel.page(), 9)
      assert.equal(panel.options.compact, true)
      assert.equal(panel.root.hidden, false)
      assert.equal(panel.root.dataset.costOnly, 'false')
      assert.equal(h.forge().hang().selected, 'audit-work-9')
      assert.equal(h.find('picture-drawer').open, false)
    }
  } finally { h.forge().jump('held') }
  assert.ok(h.evidencePanels.every(panel => panel.disposals === 1))
})
test('Interactive ordinary Sources stays open across tier changes and stays closed after dismissal', async () => {
  const h = harness(); await h.installed; await h.mount()
  const selected = h.forge().hang().selected
  try {
    h.find('picture-sources').onclick()
    await remountTier(h, 'calm')
    assert.equal(h.find('picture-drawer').open, true)
    assert.equal(h.forge().hang().selected, selected)
    assert.equal(h.forge().hang().sourceCatalogue, null)
    assert.equal(h.evidencePanels.at(-1).root.hidden, true, 'Sources enabled an unrequested audit')
    assertOrdinarySources(h)
    h.find('picture-drawer-close').onclick()
    await remountTier(h, 'hero')
    assert.equal(h.find('picture-drawer').open, false)
    assert.equal(h.evidencePanels.at(-1).root.hidden, true)
  } finally { h.forge().jump('held') }
})
test('Near Sources keeps the 45 cm camera and its ordinary drawer through a tier remount', async () => {
  const h = harness('/', { segments: AUDIT_SEGMENTS, nearPlate: true })
  await h.installed; await h.mount('complete-hang', { view: 'near', work: 'lady-with-an-ermine' })
  try {
    h.find('picture-sources').onclick()
    await remountTier(h, 'calm')
    const measured = h.forge().hang()
    assert.equal(measured.camera.view, 'near')
    assert.ok(Math.abs(measured.camera.selectedPlateDistanceM - .45) < 1e-9)
    assert.equal(h.find('picture-drawer').open, true)
    assert.equal(measured.sourceCatalogue, null)
    assert.equal(h.evidencePanels.at(-1).root.hidden, true)
  } finally { h.forge().jump('held') }
})
test('Interactive German survives near audit Sources tier round trips and an English switch clears it', async () => {
  const h = harness('/', { segments: AUDIT_SEGMENTS, nearPlate: true })
  await h.installed; await h.mount('complete-hang', { view: 'near-audit-cost', work: 'lady-with-an-ermine' })
  function assertState(language, sourcesOpen) {
    const measured = h.forge().hang(), panel = h.evidencePanels.at(-1)
    const controls = h.find('picture-language-controls').children
    assert.equal(h.find('picture-dock').dataset.language, language, 'The tier change lost the chosen label language')
    assert.equal(controls.find(control => control.lang === language).attributes['aria-pressed'], 'true')
    assert.equal(controls.find(control => control.lang !== language).attributes['aria-pressed'], 'false')
    assert.equal(measured.selected, 'lady-with-an-ermine')
    assert.equal(measured.camera.view, 'near', 'The language prefix changed the camera view')
    assert.ok(Math.abs(measured.camera.selectedPlateDistanceM - .45) < 1e-9)
    assert.equal(panel.root.hidden, false)
    assert.equal(panel.root.dataset.costOnly, 'true', 'The language prefix changed the audit mode')
    assert.equal(panel.options.compact, false)
    assert.equal(h.find('picture-drawer').open, sourcesOpen)
    assert.equal(h.find('picture-sources').attributes['aria-expanded'], String(sourcesOpen))
    assert.equal(measured.sourceCatalogue, null)
  }
  try {
    assertState('en', false)
    const german = h.find('picture-language-controls').children.find(control => control.lang === 'de')
    assert.equal(german.textContent, 'Deutsch')
    german.onclick(); h.find('picture-sources').onclick()
    assertState('de', true)
    await remountTier(h, 'calm'); assertState('de', true)
    h.find('picture-drawer-close').onclick(); assertState('de', false)
    await remountTier(h, 'hero'); assertState('de', false)
    h.find('picture-language-controls').children.find(control => control.lang === 'en').onclick()
    await remountTier(h, 'standard'); assertState('en', false)
  } finally { h.forge().jump('held') }
  assert.ok(h.evidencePanels.every(panel => panel.disposals === 1))
})
test('Material Sources preserves its chosen material, drawer state and resource ownership across tiers', async () => {
  const h = harness('/', { segments: AUDIT_SEGMENTS })
  await h.installed; await h.mount('materials', { view: 'material-oak-sources' })
  try {
    assert.equal(h.find('picture-drawer').open, true)
    h.find('picture-drawer-close').onclick()
    await remountTier(h, 'calm')
    assert.equal(h.find('picture-drawer').open, false)
    assert.equal(h.forge().hang().materialPair.kind, 'oak')
    assert.equal(h.materialPairs[0].disposals, 1)
    h.find('picture-sources').onclick()
    await remountTier(h, 'hero')
    assert.equal(h.find('picture-drawer').open, true)
    assert.equal(h.forge().hang().camera.view, 'material-oak')
    assert.equal(h.forge().hang().materialPair.kind, 'oak')
    assert.equal(h.forge().hang().sourceCatalogue, null)
    assert.equal(h.evidencePanels.at(-1).root.hidden, true)
    assert.ok(h.find('picture-material-label'))
  } finally { h.forge().jump('held') }
  assert.ok(h.materialPairs.every(pair => pair.disposals === 1), 'A tier retained or double-disposed its material specimen')
})
test('A catalogue identity takes precedence over an underlying near audit Sources view during remount', async () => {
  const h = harness('/', { segments: AUDIT_SEGMENTS, nearPlate: true })
  await h.installed; await h.mount('complete-hang', { view: 'near-audit-cost', work: 'lady-with-an-ermine' })
  try {
    h.find('picture-sources').onclick(); h.find('picture-browse-sources').onclick()
    const first = h.catalogues.at(-1)
    first.identity = 'fixture-source:near-audit-cost'
    await remountTier(h, 'calm')
    assert.equal(first.disposals, 1)
    assert.equal(h.catalogues.at(-1).options.selectedId, first.identity, 'View parsing altered the catalogue source identity')
    assert.equal(h.forge().hang().sourceCatalogue.selectedSource, first.identity)
    assert.equal(h.find('picture-drawer').open, true)
    assert.equal(h.find('picture-drawer-content').children[0], h.catalogues.at(-1).root)
    assert.equal(h.evidencePanels.at(-1).root.hidden, true, 'The lower-priority audit overrode the catalogue view')
  } finally { h.forge().jump('held') }
  assert.ok(h.catalogues.every(catalogue => catalogue.disposals === 1))
})
test('Every mounted or relit key receives the actual picture filter while calm keeps shadow maps disabled', async () => {
  const h = harness(); await h.installed; await h.mount()
  const first = h.keys[0]
  assert.equal(first.light.shadow.filterNode, TSL.PCFShadowFilter)
  assert.equal(first.light.shadow.radius, shadowFilter.PICTURE_SHADOW_FILTER_RECIPE.radiusTexels)
  assert.equal(first.light.castShadow, true)
  const relit = h.forge().relight()
  assert.equal(first.disposals, 1)
  assert.equal(h.keys.at(-1).light.shadow.filterNode, TSL.PCFShadowFilter)
  assert.equal(relit.rigs, 1)
  h.forge().tier('calm'); await flush(); h.scopes.at(-1).gate.resolve(); await flush()
  assert.equal(h.keys.at(-1).light.shadow.filterNode, TSL.PCFShadowFilter)
  assert.equal(h.keys.at(-1).light.castShadow, false, 'The private filter enabled a calm-tier shadow map')
  h.forge().jump('held')
  assert.ok(h.keys.every(key => key.disposals === 1))
})
test('Catalogue view selects its requested identity, forwards loading and errors, and Escape restores ordinary Sources', async () => {
  const h = harness(); await h.installed; await h.mount('early', { view: 'catalogue:salvator-mundi:cook-historical' })
  const catalogue = h.catalogues[0], drawer = h.find('picture-drawer')
  assert.equal(h.forge().state().error, null)
  assert.equal(h.catalogues.length, 1)
  assert.equal(catalogue.options.selectedId, 'salvator-mundi:cook-historical')
  assert.equal(h.find('picture-drawer-content').children[0], catalogue.root)
  assert.equal(drawer.open, true); assert.equal(drawer.matches('.picture-catalogue-open'), true)
  assert.equal(h.forge().hang().sourceCatalogue.selectedSource, catalogue.identity)
  assert.equal(h.forge().state().texturesPending, 3); assert.equal(h.forge().hang().texturesPending, 3)
  catalogue.imagesPending = 0; catalogue.errors = ['Controlled catalogue image failure']
  assert.equal(h.forge().state().texturesPending, 0)
  assert.deepEqual(Array.from(h.forge().hang().errors), catalogue.errors)
  const selected = h.forge().hang().selected
  h.dispatch('keydown', { key: 'ArrowRight' })
  assert.equal(h.forge().hang().selected, selected, 'The gallery navigated behind its open catalogue')
  h.dispatch('resize')
  assert.equal(h.find('picture-drawer-content').children[0], catalogue.root)
  assert.equal(catalogue.disposals, 0, 'Resizing discarded the active catalogue')
  h.dispatch('keydown', { key: 'Escape' })
  assert.equal(catalogue.disposals, 1); assert.equal(drawer.open, false)
  assert.equal(drawer.matches('.picture-catalogue-open'), false)
  assert.equal(h.forge().hang().sourceCatalogue, null)
  assert.equal(h.forge().hang().texturesPending, 0); assert.deepEqual(Array.from(h.forge().hang().errors), [])
  assert.equal(h.document.activeElement, h.find('picture-sources'))
  h.find('picture-sources').onclick()
  assert.equal(drawer.open, true); assert.equal(h.catalogues.length, 1, 'Ordinary Sources reopened a disposed catalogue')
  assertOrdinarySources(h)
  h.forge().jump('held'); assert.equal(catalogue.disposals, 1)
})
test('Catalogue close callback and native dialog cancellation each release their owner exactly once', async () => {
  const h = harness(); await h.installed; await h.mount('early', { view: 'catalogue:fixture-source' })
  const first = h.catalogues[0], drawer = h.find('picture-drawer')
  first.options.onClose()
  assert.equal(first.disposals, 1); assert.equal(h.forge().hang().sourceCatalogue, null)
  assert.equal(drawer.open, true, 'Closing the inner catalogue should restore the Sources drawer')
  assert.equal(drawer.matches('.picture-catalogue-open'), false)
  assert.equal(h.document.activeElement, h.find('picture-drawer-close'))
  h.find('picture-drawer-close').onclick()
  assert.equal(first.disposals, 1); assert.equal(drawer.open, false)
  await h.mount('late', { view: 'catalogue:second-source' })
  const second = h.catalogues[1]
  let prevented = false
  h.find('picture-drawer').oncancel({ preventDefault() { prevented = true } })
  assert.equal(prevented, true); assert.equal(second.disposals, 1)
  assert.equal(h.find('picture-drawer').open, false)
  h.forge().jump('held'); assert.equal(first.disposals, 1); assert.equal(second.disposals, 1)
})
test('Tier remount preserves the current catalogue identity and remount or departure releases each owner once', async () => {
  const h = harness(); await h.installed; await h.mount('early', { view: 'catalogue:initial-source' })
  const first = h.catalogues[0]
  first.identity = 'salvator-mundi:print-1844'
  h.forge().tier('calm'); await flush()
  assert.equal(first.disposals, 1, 'Changing tier retained the old catalogue')
  h.scopes.at(-1).gate.resolve(); await flush()
  assert.equal(h.forge().state().error, null)
  assert.equal(h.catalogues.length, 2)
  assert.equal(h.catalogues[1].options.selectedId, first.identity, 'The tier remount lost the current source selection')
  assert.equal(h.find('picture-drawer').open, true)
  await h.mount('late', { view: 'catalogue:replacement-source' })
  assert.equal(h.catalogues[1].disposals, 1)
  assert.equal(h.catalogues[2].options.selectedId, 'replacement-source')
  h.forge().jump('held'); h.forge().jump('held')
  assert.ok(h.catalogues.every(catalogue => catalogue.disposals === 1), 'A catalogue leaked or received duplicate disposal')
})
test('Choosing a work while the catalogue is open cannot leave a detached active catalogue', async () => {
  const h = harness(); await h.installed; await h.mount('early', { view: 'catalogue:fixture-source' })
  const catalogue = h.catalogues[0]
  try {
    assert.equal(h.forge().work('early-last'), true)
    assert.equal(h.forge().hang().selected, 'early-last')
    const stillMounted = h.find('picture-source-catalogue') === catalogue.root
    assert.ok(stillMounted || catalogue.disposals === 1,
      'Choosing a work detached the catalogue DOM without disposing its pending images')
    if (!stillMounted) {
      assert.equal(h.forge().hang().sourceCatalogue, null, 'A detached catalogue remained in the public hook')
      assert.equal(h.forge().state().texturesPending, 0, 'Detached catalogue image requests remained pending')
    }
  } finally { h.forge().jump('held') }
})
test('A tier change after closing catalogue Sources preserves the closed drawer', async () => {
  const h = harness(); await h.installed; await h.mount('early', { view: 'catalogue:fixture-source' })
  const catalogue = h.catalogues[0]
  h.find('picture-drawer-close').onclick()
  assert.equal(catalogue.disposals, 1); assert.equal(h.find('picture-drawer').open, false)
  try {
    h.forge().tier('calm'); await flush(); h.scopes.at(-1).gate.resolve(); await flush()
    assert.equal(h.forge().state().error, null)
    assert.equal(h.find('picture-drawer').open, false, 'Tier remount reopened Sources after the visitor closed it')
    assert.equal(h.catalogues.length, 1, 'Tier remount reopened a closed catalogue')
    assert.equal(catalogue.disposals, 1)
  } finally { h.forge().jump('held') }
})

const FACE_SEGMENTS = [{ id: 'early', title: 'Early fixture', kind: 'hang', initialWorkId: 'ginevra-de-benci', workIds: ['ginevra-de-benci', 'early-last'] }]
const SIGNATURE_SEGMENTS = [{ id: 'signature', title: 'Signature fixture', kind: 'hang', initialWorkId: 'mona-lisa', workIds: ['mona-lisa'] }]
for (const initialReverse of [false, true]) test(`Phone face choice survives tier replacement after ${initialReverse ? 'reverse to front' : 'front to reverse'} selection`, async () => {
  const h = harness('/', { segments: FACE_SEGMENTS, pairedPanel: true, width: 390, height: 844 })
  await h.installed; await h.mount('early', { view: initialReverse ? 'reverse' : 'reading' })
  try {
    assert.equal(h.find('picture-face-control').hidden, false)
    assert.equal(h.forge().hang().camera.face, initialReverse ? 'reverse' : 'front')
    h.find('picture-face-control').onclick()
    const expected = initialReverse ? 'front' : 'reverse', before = h.forge().hang().camera
    assert.equal(before.face, expected)
    assert.equal(h.hangs.at(-1).visibility.face.reverse, !initialReverse)
    h.find('picture-language-controls').children.find(control => control.lang === 'de').onclick()
    h.find('picture-sources').onclick()
    await remountTier(h, 'calm')
    assert.equal(h.forge().hang().camera.face, expected, 'Tier replacement lost the face chosen through the real button')
    assert.deepEqual(Array.from(h.forge().hang().camera.position), Array.from(before.position), 'Tier replacement moved the selected face camera')
    assert.equal(h.find('picture-dock').dataset.language, 'de')
    assert.equal(h.find('picture-drawer').open, true)
  } finally { h.forge().jump('held') }
})
test('Leaving moulding study restores the segment heading and visible reading controls', async () => {
  const h = harness('/', { segments: SIGNATURE_SEGMENTS, signaturePlate: true })
  await h.installed; await h.mount('signature', { view: 'moulding' })
  try {
    h.stack.render(.016)
    assert.equal(h.find('picture-segment-name').textContent, 'Reconstructed exhibition moulding')
    assert.equal(h.find('picture-dock').hidden, true)
    h.find('picture-datum').onclick(); h.stack.render(.016)
    assert.equal(h.forge().hang().camera.view, 'compare')
    assert.equal(h.find('picture-segment-name').textContent, SIGNATURE_SEGMENTS[0].title, 'The moulding heading survived after its view ended')
    assert.equal(h.find('picture-dock').hidden, false)
    assert.equal(h.find('picture-datum').textContent, 'Common scale · Read closer')
  } finally { h.forge().jump('held') }
})
test('Signature datum toggles camera scale while retaining the deliberately selected print and truthful label', async () => {
  const h = harness('/', { segments: SIGNATURE_SEGMENTS, signaturePlate: true })
  await h.installed; await h.mount('signature', { view: 'print' })
  try {
    assert.match(h.find('picture-first').textContent, /^Historical print, date uncertain\./)
    assert.deepEqual(h.hangs.at(-1).absentIds, [])
    h.find('picture-datum').onclick()
    assert.equal(h.forge().hang().camera.view, 'compare')
    assert.deepEqual(h.hangs.at(-1).absentIds, [], 'Changing camera scale must retain a deliberately selected print')
    assert.match(h.find('picture-first').textContent, /^Historical print, date uncertain\./)
    assert.equal(h.find('picture-policy-label').style['--certainty'], '#b18b47', 'The selected print retains its amber uncertainty')
    assert.match(h.url(), /view=print-compare/)
    await remountTier(h, 'calm')
    assert.equal(h.forge().hang().camera.view, 'compare')
    assert.deepEqual(h.hangs.at(-1).absentIds, [])
    assert.match(h.find('picture-first').textContent, /^Historical print, date uncertain\./)
  } finally { h.forge().jump('held') }
})
test('Explicit record dismissal stays dismissed after closing and reopening Sources', async () => {
  const h = harness(); await h.installed; await h.mount('early', { view: 'record' })
  try {
    assert.equal(h.find('picture-drawer').open, true)
    assert.equal(h.find('picture-full-record').hidden, false)
    h.find('picture-open-record').onclick()
    assert.equal(h.find('picture-full-record').hidden, true)
    h.find('picture-drawer-close').onclick()
    h.find('picture-sources').onclick()
    assert.equal(h.find('picture-drawer').open, true)
    assert.equal(h.find('picture-full-record').hidden, true, 'Closing Sources reopened the record the visitor explicitly dismissed')
    assert.equal(h.find('picture-open-record').getAttribute('aria-expanded'), 'false')
  } finally { h.forge().jump('held') }
})
test('An open record survives resize without replacement and all source DOM detaches on departure', async () => {
  const h = harness(); await h.installed; await h.mount()
  h.find('picture-sources').onclick(); h.find('picture-open-record').onclick()
  const record = h.find('picture-full-record'), drawer = h.find('picture-drawer')
  record.focus(); h.dispatch('resize')
  assert.equal(h.find('picture-full-record'), record); assert.equal(record.hidden, false)
  assert.equal(h.document.activeElement, record)
  h.forge().jump('held')
  assert.equal(drawer.open, false)
  assert.equal(h.find('picture-full-record'), undefined)
  assert.equal(h.find('picture-bench').children.length, 0)
  assert.ok(h.hangs.every(hang => hang.disposals === 1))
})
for (const restore of ['reload', 'popstate']) test(`The URL hash restores phone language, reverse face, camera view and open record through ${restore}`, async () => {
  const options = { segments: FACE_SEGMENTS, pairedPanel: true, width: 390, height: 844 }
  const h = harness('/', options)
  await h.installed; await h.mount('early', { view: 'reading' })
  let restored = h
  try {
    h.find('picture-face-control').onclick()
    h.find('picture-language-controls').children.find(control => control.lang === 'de').onclick()
    h.find('picture-sources').onclick(); h.find('picture-open-record').onclick()
    const saved = h.url(), hash = new URLSearchParams(saved.split('#')[1])
    assert.equal(hash.get('work'), 'ginevra-de-benci')
    assert.equal(hash.get('view'), 'german-reverse-reading-record')
    if (restore === 'reload') {
      restored = harness(saved, options)
      await flush(); restored.scopes[0].gate.resolve(); await restored.installed
    } else {
      h.find('picture-drawer-close').onclick(); h.find('picture-face-control').onclick(); h.find('picture-datum').onclick()
      assert.notEqual(h.url(), saved)
      h.setURL(saved); h.dispatch('popstate'); await flush()
    }
    assert.equal(restored.forge().state().error, null)
    assert.equal(restored.forge().hang().camera.face, 'reverse')
    assert.equal(restored.forge().hang().camera.view, 'reading')
    assert.equal(restored.find('picture-dock').dataset.language, 'de')
    assert.equal(restored.find('picture-drawer').open, true)
    assert.equal(restored.find('picture-full-record').hidden, false)
    assert.equal(restored.find('picture-open-record').getAttribute('aria-expanded'), 'true')
    restored.find('picture-open-record').onclick()
    assert.equal(new URLSearchParams(restored.url().split('#')[1]).get('view'), 'german-reverse-reading-sources')
    await remountTier(restored, 'calm')
    assert.equal(restored.find('picture-full-record').hidden, true)
    assert.equal(restored.find('picture-drawer').open, true)
    assert.equal(restored.forge().hang().camera.face, 'reverse')
  } finally { h.forge().jump('held'); if (restored !== h) restored.forge().jump('held') }
})
test('A shared signature URL retains the selected print independently of Compare, language and record', async () => {
  const options = { segments: SIGNATURE_SEGMENTS, signaturePlate: true }
  const h = harness('/', options)
  await h.installed; await h.mount('signature', { view: 'print' })
  let restored
  try {
    h.find('picture-datum').onclick()
    h.find('picture-language-controls').children.find(control => control.lang === 'de').onclick()
    h.find('picture-sources').onclick(); h.find('picture-open-record').onclick()
    const saved = h.url()
    assert.equal(new URLSearchParams(saved.split('#')[1]).get('view'), 'german-print-compare-record')
    restored = harness(saved, options)
    await flush(); restored.scopes[0].gate.resolve(); await restored.installed
    assert.equal(restored.forge().state().error, null)
    assert.equal(restored.forge().hang().camera.view, 'compare')
    assert.deepEqual(restored.hangs.at(-1).absentIds, [])
    assert.equal(restored.find('picture-dock').dataset.language, 'de')
    assert.equal(restored.find('picture-drawer').open, true)
    assert.equal(restored.find('picture-full-record').hidden, false)
    assert.match(restored.find('picture-first').textContent, /^Historical print, date uncertain\./)
  } finally { h.forge().jump('held'); restored?.forge().jump('held') }
})
test('Material record disclosure is preserved by the same URL and tier state as its selected specimen', async () => {
  const h = harness('/', { segments: AUDIT_SEGMENTS })
  await h.installed; await h.mount('materials', { view: 'material-oak-sources' })
  try {
    const record = h.find('picture-material-record')
    assert.equal(record.open, false)
    record.open = true; record.ontoggle()
    assert.equal(new URLSearchParams(h.url().split('#')[1]).get('view'), 'material-oak-record')
    await remountTier(h, 'calm')
    assert.equal(h.find('picture-material-record').open, true)
    assert.equal(h.forge().hang().materialPair.kind, 'oak')
    const restored = h.find('picture-material-record')
    restored.open = false; restored.ontoggle()
    assert.equal(new URLSearchParams(h.url().split('#')[1]).get('view'), 'material-oak-sources')
  } finally { h.forge().jump('held') }
})

const results = []
for (const { name, run } of tests) {
  try { await run(); results.push({ name, ok: true }) }
  catch (error) { results.push({ name, ok: false, error: error.stack ?? String(error) }) }
}
const report = { kind: 'isolated-source-lifecycle-check', browser: false, network: false,
  source: { file, sha256: createHash('sha256').update(source).digest('hex') },
  registrationSource: { file: registrationFile, sha256: createHash('sha256').update(registrationSource).digest('hex') },
  policyLabelSource: { file: policyLabelFile, sha256: createHash('sha256').update(policyLabelSource).digest('hex') },
  visitorCopySource: { file: visitorCopyFile, sha256: createHash('sha256').update(visitorCopySource).digest('hex') },
  signatureLabelSource: { file: signatureLabelFile, sha256: createHash('sha256').update(signatureLabelSource).digest('hex') },
  readingRulerSource: { file: readingRulerFile, sha256: createHash('sha256').update(readingRulerSource).digest('hex') },
  collectionFixture: { file: collectionFile, sha256: createHash('sha256').update(collectionSource).digest('hex'), scope: 'Complete source fields with symbolic controller work ids; original collection bytes unchanged.' },
  shadowFilterSource: { file: shadowFilterFile, sha256: createHash('sha256').update(shadowFilterSource).digest('hex') },
  catalogueFixture: 'Tracked resource double; component source admission, DOM images and source identity behavior are tested separately by source-catalogue-check.',
  auditFixture: 'Tracks actual controller evidence options and updates, with a synthetic ten-work register and a Three mesh for the 45 cm source pose; panel rendering and material appearance are tested separately.',
  viewFixture: 'Exercises actual controller handlers, view serialization, labels and records at desktop/phone dimensions. Optional front/reverse and historical-print transport records are symbolic local controller inputs; actual source admission, plate geometry and rendering are separate checks.',
  ok: results.every(result => result.ok), passed: results.filter(result => result.ok).length, total: results.length, results }
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
