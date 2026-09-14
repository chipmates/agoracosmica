#!/usr/bin/env node
/** Actual bench/material-pair controllers, register, scale and label functions.
 * CPU Three geometry/cameras are real; room/frame shaders, loading and DOM are
 * controlled. No browser, texture bytes, network or image comparison is used.
 * Run: node src/wings/vinci/pictures/bench/material-study-check.mjs
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

const paths = {
  controller: './index.ts', pair: './material-pairs.ts',
  pictures: '../index.ts', register: '../register.ts',
  scale: '../scale.ts', locked: '../data/paintings.json',
  manifest: '../../../../../public/na-manifest.json', policy: '../policy.ts',
  policyLabel: '../policy-label.ts', giConfig: './gi-config.json',
  visitorCopy: '../visitor-copy.ts', signatureLabel: '../signature-label.ts',
  registration: '../registration.ts',
  archMask: '../arch-mask.ts',
  aperture: '../aperture.ts',
  shadowFilter: './picture-shadow-filter.ts',
  readingRuler: './reading-ruler.ts',
}
const inputs = Object.fromEntries(Object.entries(paths).map(([name, path]) => {
  const file = fileURLToPath(new URL(path, import.meta.url))
  return [name, { file, text: readFileSync(file, 'utf8') }]
}))
const sha = text => createHash('sha256').update(text).digest('hex')
const locked = JSON.parse(inputs.locked.text)
const manifestData = JSON.parse(inputs.manifest.text)
const manifestEntries = Array.isArray(manifestData) ? manifestData : manifestData.assets
const manifest = { all: manifestEntries, byId: new Map(manifestEntries.map(e => [e.id, e])) }
const kinds = ['gold', 'plaster', 'oak', 'limestone']
const sets = { gold: 'gold-leaf', plaster: 'plaster-lime-aged', oak: 'oak-planks-worn', limestone: 'limestone-pale' }
const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve() }
function compile(text, file) {
  return ts.transpileModule(text, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }, fileName: file }).outputText
}
function evaluate(name, modules, globals = {}, text = inputs[name].text) {
  const exports = {}
  vm.runInNewContext(compile(text, inputs[name].file), {
    ...globals, exports,
    require(id) { assert.ok(id in modules, `Uncontrolled ${name} dependency: ${id}`); return modules[id] },
  }, { filename: inputs[name].file, timeout: 3000 })
  return exports
}
const policy = evaluate('policy', {})
const visitorCopy = evaluate('visitorCopy', {})
const registration = evaluate('registration', {})
const archMask = evaluate('archMask', { 'three/webgpu': Three })
const shadowFilter = evaluate('shadowFilter', { 'three/tsl': TSL })
const register = evaluate('register', {
  './policy': policy,
  './data/paintings.json?raw': { default: inputs.locked.text },
})
const scale = evaluate('scale', { three: Three })
assert.equal(register.getSegment('materials').initialWorkId, 'mona-lisa')

function harness({ width = 1512, height = 950, controller = inputs.controller.text } = {}) {
  let url = new URL('http://bench.test/'), tier = 'standard', phase = 'held', scene, camera
  const document = { activeElement: null }, listeners = new Map()
  const pairs = [], hangs = [], rooms = [], fields = [], scopes = [], workLabels = [], keys = []
  class Element {
    constructor(tag, cls = '', text = '') {
      this.tagName = tag; this.className = cls; this.children = []; this.parent = null
      this.dataset = {}; this.attributes = {}; this.hidden = false; this.open = false; this.disabled = false
      this.scrollTop = 0; this.clientHeight = 250; this.scrollHeight = 250
      this.style = { setProperty(name, value) { this[name] = value },
        removeProperty(name) { const was = this[name]; delete this[name]; return was ?? '' } }; this.textContent = text
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
    set textContent(text) { this._text = String(text); for (const child of this.children) child.parent = null; this.children = [] }
    append(...children) { for (const child of children) { child.remove(); child.parent = this; this.children.push(child) } }
    prepend(...children) { for (const child of [...children].reverse()) { child.remove(); child.parent = this; this.children.unshift(child) } }
    replaceChildren(...children) { this.textContent = ''; this.append(...children) }
    insertBefore(child, reference) { assert(reference === null || this.children.includes(reference)); if (child === reference) return child; child.remove(); child.parent = this; this.children.splice(reference === null ? this.children.length : this.children.indexOf(reference), 0, child); return child }
    setAttribute(name, value) { this.attributes[name] = String(value) }
    getAttribute(name) { return this.attributes[name] ?? null }
    hasAttribute(name) { return this.getAttribute(name) !== null }
    querySelector(selector) { for (const child of this.children) { if (child.matches(selector)) return child; const found = child.querySelector(selector); if (found) return found } return null }
    focus() { document.activeElement = this }
    click() { if (!this.disabled) this.onclick?.({ target: this }) }
    showModal() { this.open = true }
    close() { this.open = false }
    matches(selector) { return selector.split(',').some(s => s.startsWith('.') ? this.className.split(' ').includes(s.slice(1)) : this.tagName === s) }
    closest(selector) { for (let at = this; at; at = at.parent) if (at.matches(selector)) return at; return null }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null }
  }
  const element = (tag, cls = '', text = '') => new Element(tag, cls, text)
  document.body = element('body'); document.head = element('head'); document.createElement = tag => element(tag)
  const location = {}
  for (const key of ['pathname', 'search', 'hash']) Object.defineProperty(location, key, { get: () => url[key] })
  const history = Object.fromEntries(['replaceState', 'pushState'].map(method => [method, (_state, _title, value) => { url = new URL(value, url) }]))
  const original = {
    jump(next) { phase = next; document.body.dataset.phase = next; document.body.dataset.forge = next },
    state: () => ({ phase }), tier: value => { tier = value }, station: () => false,
    rail() {}, look() {}, relight() {}, manifest: () => [],
  }
  const window = { __forge: original }
  const globals = { document, window, location, history, URLSearchParams,
    innerWidth: width, innerHeight: height, performance: { now: () => 5000 },
    addEventListener(type, listener) { const list = listeners.get(type) ?? []; list.push(listener); listeners.set(type, list) },
  }
  const materialSets = new Map()
  function materialSet(name) {
    if (!materialSets.has(name)) materialSets.set(name, {
      entry: manifest.byId.get(`library/${name}`), ready: { value: 1 },
      material: () => new Three.MeshStandardNodeMaterial(),
    })
    assert.ok(materialSets.get(name).entry, `Missing real manifested library family ${name}`)
    return materialSets.get(name)
  }
  const stack = {
    render() {}, tierName: () => tier, tierConfig: () => ({ name: tier }),
    setScene(value, lens) { scene = value; camera = lens },
    cost: () => ({ textureMB: 12, frames: 150, draws: 1, triangles: 20, budget: { textureMB: 256 } }),
    materials: { pending: () => 0, sync: materialSet },
    hdri: async () => ({ texture: {}, entry: { id: 'sky-overcast' }, sun: {} }),
    lights: () => keys.filter(key => !key.disposals).length, sceneObjects: () => scene?.children.length ?? 0,
    light() {
      const light = new Three.DirectionalLight()
      light.castShadow = tier !== 'calm'
      const key = { fill: { color: new Three.Color(), groundColor: new Three.Color() }, light,
        disposals: 0, dispose() { this.disposals++; light.dispose() } }
      keys.push(key); return key
    },
  }
  function createBenchMaterialBudget() {
    const scope = { stack: { ...stack }, disposals: 0, prepare: async () => {}, pending: () => 0,
      textureMB: () => 1, errors: () => [], dispose() { this.disposals++ } }
    scopes.push(scope); return scope
  }
  function ownedGroup(group) {
    // Batch ownership follows captured allocations, even when the pair helper
    // replaces the left principal material with its separately owned stock.
    const geometries = new Set(), materials = new Set()
    group.traverse(object => { if (object instanceof Three.Mesh) { geometries.add(object.geometry); materials.add(object.material) } })
    return { group, disposals: 0, dispose() {
      this.disposals++; group.removeFromParent()
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
    } }
  }
  function buildFrameBatch(_stack, placements) {
    const group = new Three.Group()
    for (const p of placements) {
      const material = new Three.MeshStandardNodeMaterial(); material.name = 'vinci/pictures/gold-leaf'
      const mesh = new Three.Mesh(new Three.PlaneGeometry(p.width + .104, p.height + .104), material)
      mesh.position.set(p.x, p.y, .08); group.add(mesh)
    }
    return ownedGroup(group)
  }
  function buildPictureRoom(_stack, extent = 0, options = {}) {
    const group = new Three.Group()
    group.userData.room = { extent, height: options.height ?? 6, depth: options.depth ?? 12 }
    for (const name of ['plaster', 'oak-boards', 'limestone-reveals', 'graphite-plinth']) {
      const mesh = new Three.Mesh(new Three.PlaneGeometry(Math.max(extent, 1), 6), new Three.MeshStandardNodeMaterial())
      mesh.name = `vinci/pictures/room/${name}`; group.add(mesh)
    }
    const room = ownedGroup(group); rooms.push(room); return room
  }
  const pairModule = evaluate('pair', {
    'three/webgpu': Three, 'three/tsl': TSL, '../frame': { buildFrameBatch }, './room': { buildPictureRoom },
  })
  const policyLabel = evaluate('policyLabel', { './registration': registration, './visitor-copy': visitorCopy }, globals)
  const signatureLabel = evaluate('signatureLabel', { './policy-label': policyLabel }, globals)
  // The room and the hang are lit by one opening, so the study evaluates the
  // real aperture module rather than standing a second light in for it.
  const aperture = evaluate('aperture', { 'three/tsl': TSL })
  const pictures = evaluate('pictures', {
    './policy-label': policyLabel,
    './registration': registration,
    './arch-mask': archMask,
    'three/webgpu': Three, 'three/tsl': TSL, './frame': { buildFrameBatch }, './directional-contact': {},
    './register': register, './scale': scale, './stream': {}, './policy': policy, './aperture': aperture,
  }, globals)
  const readingRuler = evaluate('readingRuler', {
    'three/webgpu': Three, '..': { element },
  }, globals)
  function buildHang(_stack, records) {
    const wall = new Three.Group(), labels = element('div', 'picture-anchors')
    const frames = records.map((work, i) => {
      const size = scale.trueScale(work), x = i * 2 + .5, y = size?.datumM ?? 1.55
      const aperture = size ? new Three.Mesh(new Three.PlaneGeometry(size.widthM, size.heightM), new Three.MeshBasicMaterial()) : null
      if (aperture) { aperture.position.set(x, y, .08); wall.add(aperture) }
      const dot = element('button', 'picture-dot'), caption = element('div', 'picture-mat-caption')
      labels.append(dot, caption)
      return { work, x, y, left: x - (size?.widthM ?? .5) / 2, right: x + (size?.widthM ?? .5) / 2,
        width: size?.widthM ?? .5, height: size?.heightM ?? .5, aperture, cards: register.findPlateEntries(work, manifest).map(entry => {
          const fitted = register.reproductionCardSize(work, entry.pixels)
          const mesh = new Three.Mesh(new Three.PlaneGeometry(fitted.widthM, fitted.heightM), new Three.MeshBasicMaterial())
          mesh.position.set(x, y, .023); wall.add(mesh)
          return { entry, mesh, stream: { residency: () => ({ fixture: 'CPU geometry only; no decoded texture' }), allocation: () => ({ previewMB: 0, fullMB: 0 }) } }
        }), dot, caption }
    })
    const hang = { wall, frames, labels, extent: records.length === 1 ? 1 : records.length * 2, disposals: 0,
      stream() {}, update() {}, pending: () => 0, errors: () => [], textureMB: () => 0,
      documentOnlyIds: new Set(),
      setAbsent(ids = [], reveal = []) { this.absentIds = [...ids].filter(id => !reveal.includes(id)); this.revealedIds = [...reveal] },
      setVisible(ids, only) { this.visibility = { ids, only }; for (const f of frames) if (f.aperture) f.aperture.visible = !only && (!ids || ids.includes(f.work.id)) },
      dispose() { this.disposals++; wall.removeFromParent(); labels.remove(); for (const f of frames) { if (f.aperture) { f.aperture.geometry.dispose(); f.aperture.material.dispose() }; for (const card of f.cards) { card.mesh.geometry.dispose(); card.mesh.material.dispose() } } },
    }
    hangs.push(hang); return hang
  }
  const controllerModules = {
    'three/webgpu': Three, '../../../../stack/grade': { IDENTITY: {} }, '../../../../manifest': { loadManifest: async () => manifest },
    '../../../../stack/materials': { ASSET_BASE: '/mock-assets/' }, '../registration': registration,
    '../policy-label': policyLabel,
    '../visitor-copy': visitorCopy,
    '../signature-label': signatureLabel,
    '../../../../core/labels': { readLabels: () => [] }, '../../../../content/disclosures': { DISCLOSURES: [] },
    '..': { ...register, ...scale, ...pictures, buildHang,
      createWorkLabel(...args) { workLabels.push(args[0].id); return pictures.createWorkLabel(...args) } },
    './room': { buildPictureRoom }, './material-budget': { createBenchMaterialBudget },
    './source-catalogue': { createSourceCatalogue() { throw new Error('Unexpected source catalogue in material study fixture') } },
    './reading-ruler': readingRuler,
    './picture-shadow-filter': shadowFilter,
    './probe-budget': { createBenchProbe: sky => ({ probe: sky, textureMB: () => 4, dispose() {} }) },
    './pictures.css?raw': { default: '' },
    './evidence-panel': { hangEvidencePanelCSS: '', createHangEvidencePanel: options => ({ root: element('section', 'picture-evidence'), page: () => options.page ?? 1, update() {}, dispose() {} }) },
    './gi-config.json': { default: JSON.parse(inputs.giConfig.text) },
    './shadow-fit': { fitBenchKeyShadow: () => ({}) },
    './material-pairs': { buildMaterialPair(scoped, kind) {
      const pair = pairModule.buildMaterialPair(scoped, kind), release = pair.dispose
      pair.disposals = 0; pair.dispose = () => { pair.disposals++; release() }
      pairs.push(pair); return pair
    } },
    './gi-index': { getBenchGI(segment, room) {
      const field = { segment, room, debug: { segment }, disposals: 0, applications: [],
        apply(material) { this.applications.push(material) }, textureMB: () => field.disposals ? 0 : .0625,
        dispose() { this.disposals++ } }
      fields.push(field); return field
    } },
  }
  const api = evaluate('controller', controllerModules, globals, controller)
  const host = offlineHost(original, stack, window)
  const installed = api.createPictureBench(stack, host.onLobby).then(module => host.attach(module))
  const all = (cls, at = document.body) => [...(at.matches(`.${cls}`) ? [at] : []), ...at.children.flatMap(child => all(cls, child))]
  const h = { installed, pairs, hangs, fields, scopes, workLabels, stack, document, all,
    find: cls => all(cls)[0], forge: () => window.__forge, camera: () => camera, scene: () => scene,
    viewport: () => ({ width, height }),
    dispatch(type, values = {}) {
      const event = { target: document.body, stopped: false, preventDefault() {}, stopImmediatePropagation() { this.stopped = true }, ...values }
      for (const listener of listeners.get(type) ?? []) { listener(event); if (event.stopped) break }
    },
    async mount(segment = 'materials', options = {}) { await installed; window.__forge.jump('bench', { segment, ...options }); await flush(); stack.render(0); assert.equal(document.body.dataset.forge, 'bench', window.__forge.state().error) },
    leave() { window.__forge.jump('held') },
  }
  return h
}

function assertMaterialOnly(h, kind) {
  const value = h.forge().hang()
  assert.equal(value.segment, 'materials'); assert.equal(value.materialPair.kind, kind)
  assert.equal(h.find('picture-count').textContent, `${kinds.indexOf(kind) + 1} / 4`)
  assert.equal(h.find('picture-dock').children[0].className, 'picture-material-label')
  assert.equal(h.all('picture-label').length, 0, 'A locked painting reading card leaked into the material study')
  assert.equal(h.workLabels.length, 0, 'The material branch called the painting-label builder')
  assert.ok(h.hangs.at(-1).frames.every(f => !f.aperture?.visible && f.dot.hidden && f.caption.hidden))
  assert.equal(h.find('picture-inspect').textContent, 'Next material')
}
function assertProjection(h) {
  const pair = h.pairs.at(-1), nodes = h.all('picture-material-caption'), camera = h.camera()
  const { width, height } = h.viewport(), focal = height / (2 * Math.tan(20 * Math.PI / 180))
  h.scene().updateMatrixWorld(true)
  assert.equal(nodes.length, 2)
  const expected = pair.captions.map(c => {
    const world = pair.group.localToWorld(new Three.Vector3(c.x, c.y, c.z)), depth = camera.position.z - world.z
    return [width / 2 + (world.x - camera.position.x) * focal / depth,
      height / 2 - (world.y - camera.position.y) * focal / depth - height * (width < 700 ? .10 : .08)]
  })
  nodes.forEach((node, i) => {
    assert.equal(node.textContent, pair.captions[i].text)
    assert.ok(Math.abs(parseFloat(node.style.left) - expected[i][0]) < 1e-7, 'Caption X does not follow its specimen world position')
    assert.ok(Math.abs(parseFloat(node.style.top) - expected[i][1]) < 1e-7, 'Caption Y does not follow its specimen world position')
  })
  assert.ok(Math.abs(expected[0][0] + expected[1][0] - width) < 1e-7, 'Camera is not centred on the equal pair')
  const distances = pair.group.userData.materialPair.centres_m.map(p => camera.position.distanceTo(pair.group.localToWorld(new Three.Vector3(...p))))
  assert.ok(Math.abs(distances[0] - distances[1]) < 1e-12)
  h.forge().hang().materialPair.centreDistancesM.forEach((d, i) => assert.ok(Math.abs(d - distances[i]) < 1e-12))
}
function assertCost(h) {
  const value = h.forge().hang(), expected = 12 + 1 + 4 + 4 + .0625
  assert.equal(value.cost.diffuseGIMB, .0625)
  assert.equal(value.cost.textureMB, expected, 'The mounted field must be counted exactly once')
  assert.equal(h.forge().cost().textureMB, expected)
  assert.equal(h.fields.at(-1).segment, 'materials', 'The wider material room must request its own matching bake')
  assert.equal(h.fields.at(-1).applications.length, 1)
}
const tests = [], materialViewRows = [], test = (name, run) => tests.push({ name, run })
test('material route defaults to gold and contains no painting reading card or visible hang', async () => {
  const h = harness(); await h.mount(); assertMaterialOnly(h, 'gold'); assertProjection(h); h.leave()
})
test('previous, next and Next material cycle all four studies and release each previous pair once', async () => {
  const h = harness(); await h.mount()
  for (const kind of ['plaster', 'oak', 'limestone', 'gold']) {
    const old = h.pairs.at(-1); h.all('picture-step')[1].onclick(); await flush(); h.stack.render(0)
    assertMaterialOnly(h, kind); assert.equal(old.disposals, 1); assert.equal(old.group.parent, null)
  }
  h.all('picture-step')[0].onclick(); await flush(); h.stack.render(0); assertMaterialOnly(h, 'limestone')
  h.find('picture-inspect').onclick(); await flush(); h.stack.render(0); assertMaterialOnly(h, 'gold')
  const last = h.pairs.at(-1); h.leave(); h.leave()
  assert.equal(last.disposals, 1); assert.ok(h.pairs.every(p => p.disposals === 1))
  assert.ok(h.fields.every(f => f.disposals === 1)); assert.ok(h.hangs.every(f => f.disposals === 1))
})
test('each material caption follows its world specimen under symmetric desktop and phone cameras', async () => {
  for (const viewport of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) {
    const h = harness(viewport)
    for (const kind of kinds) { await h.mount('materials', { view: `material-${kind}` }); assertProjection(h); assertMaterialOnly(h, kind) }
    h.leave()
  }
})
test('material audit cost includes its matching live GI allocation exactly once', async () => {
  const h = harness(); await h.mount('materials', { view: 'material-oak-audit' })
  assertCost(h); assert.equal(h.find('picture-audit').hidden, false)
  for (let i = 0; i < 120; i++) h.stack.render(0)
  assert.equal(h.forge().hang().auditReady, true); assert.equal(h.forge().hang().texturesPending, 0)
  h.leave(); assert.equal(h.fields[0].textureMB(), 0)
})
test('Sources exposes each real material family and GENERATED provenance without invented hashes', async () => {
  const h = harness()
  for (const kind of kinds) {
    await h.mount('materials', { view: `material-${kind}${kind === 'gold' ? '-sources' : ''}` })
    if (kind !== 'gold') h.find('picture-sources').onclick()
    const drawer = h.find('picture-drawer'), detail = h.find('picture-drawer-content')
    assert.equal(drawer.open, true); assert.equal(h.document.activeElement, h.find('picture-drawer-close'))
    for (const id of [`library/${sets[kind]}`, 'vinci/pictures/material-pairs', 'vinci/pictures/bench-room', 'vinci/pictures/frame-gilding']) {
      const e = manifest.byId.get(id); assert.ok(e, `Missing actual evidence record ${id}`)
      assert.ok(detail.textContent.includes(`${e.id} · ${e.class}\n${e.licence}`), `Missing verbatim manifest credit ${id}`)
      if (e.sha256) assert.ok(detail.textContent.includes(`SHA-256 ${e.sha256}`))
    }
    assert.ok(detail.textContent.includes('The reference preview is not displayed or sampled.'))
    assert.doesNotMatch(detail.textContent, /SHA-256 (?:undefined|null)/, 'A library family without a file hash must not expose a fabricated hash line')
    h.find('picture-drawer-close').onclick(); assert.equal(drawer.open, false)
    assert.equal(h.document.activeElement, h.find('picture-sources'))
  }
  h.leave()
})
test('leaving the study restores plain certainty labels and deliberately opened exact historical records', async () => {
  const h = harness(); await h.mount(); const pair = h.pairs[0]
  await h.mount('complete-hang'); assert.equal(pair.disposals, 1); assert.equal(h.all('picture-material-caption').length, 0)
  for (const work of register.MAIN_HANG) {
    assert.equal(h.forge().work(work.id), true)
    const dock = h.find('picture-dock'), detail = h.find('picture-drawer-content')
    const descendants = node => [node, ...node.children.flatMap(descendants)]
    const find = (host, cls) => descendants(host).find(node => node.className.split(' ').includes(cls))
    const source = locked.works.find(record => record.id === work.id), entries = register.findPlateEntries(work, manifest)
    const words = !entries.length ? ['Not shown', 'Nicht gezeigt']
      : work.id === 'mona-lisa' && entries.some(entry => /print|druk|imprim/i.test(entry.plate.honesty_en ?? '')) ? ['Historical print, date uncertain', 'Historischer Druck, Datum ungewiss']
      : work.attribution_certainty === 'disputed' ? ['Disputed', 'Umstritten']
      : work.attribution_certainty === 'qualified' ? ['Qualified attribution', 'Zuschreibung mit Vorbehalt']
      : work.attribution_certainty === 'workshop' ? ['Workshop', 'Werkstatt']
      : work.attribution_certainty === 'copy' ? ['Later copy', 'Spätere Kopie']
      : work.id === 'baptism-of-christ' ? ['Collaborative work', 'Gemeinschaftswerk'] : ['Documented', 'Belegt']
    for (const [index, language] of ['en', 'de'].entries()) {
      assert.equal(find(dock, language === 'en' ? 'picture-first' : 'picture-first-de').textContent, `${words[index]}. ${source[`title_${language}`]}.`)
      assert.equal(find(dock, `picture-label-${language}`).lang, language)
    }
    assert.equal(find(detail, 'picture-drawer-introduction').parent, detail)
    const record = find(detail, 'picture-full-record'), control = find(detail, 'picture-open-record')
    assert.equal(record.dataset.register, 'record'); assert.equal(record.hidden, true)
    assert.equal(control.getAttribute('aria-controls'), record.id)
    control.onclick(); assert.equal(record.hidden, false); assert.equal(control.getAttribute('aria-expanded'), 'true')
    for (const language of ['en', 'de']) assert.equal(find(record, `picture-register-first-${language}`).textContent, source[`label_first_line_${language}`])
    const machine = JSON.parse(descendants(record).find(node => node.tagName === 'pre').textContent)
    assert.equal(JSON.stringify(machine.collection), JSON.stringify(source), 'Complete locked collection record must survive the material round trip')
    assert.equal(machine.sources.length, entries.length)
    for (const entry of entries) {
      const stored = machine.sources.find(item => item.plate.id === entry.plate.id)
      assert.equal(JSON.stringify(stored.plate), JSON.stringify(entry.plate))
      assert.equal(JSON.stringify(stored.preview), JSON.stringify(entry.preview))
      assert(descendants(record).some(node => node.className === 'picture-licence' && node.dataset.manifestId === entry.plate.id && node.textContent === entry.plate.licence))
    }
    control.onclick(); assert.equal(record.hidden, true); assert.equal(control.getAttribute('aria-expanded'), 'false')
  }
  assert.equal(register.MAIN_HANG.length, 24); h.leave()
})
test('negative control detects a missing material-pair release on cycling', async () => {
  const changed = inputs.controller.text.replace('materialPair?.dispose();', '')
  assert.notEqual(changed, inputs.controller.text)
  const h = harness({ controller: changed }); await h.mount(); const old = h.pairs[0]
  h.find('picture-inspect').onclick(); await flush()
  assert.throws(() => assert.equal(old.disposals, 1), assert.AssertionError)
  h.leave(); for (const pair of h.pairs) if (!pair.disposals) pair.dispose()
})
test('negative controls detect a missing caption world offset and double-counted GI', async () => {
  const caption = inputs.controller.text.replace('new Vector3(caption.x + studyCentreX, caption.y, caption.z)', 'new Vector3(caption.x, caption.y, caption.z)')
  assert.notEqual(caption, inputs.controller.text)
  const h = harness({ controller: caption }); await h.mount()
  assert.throws(() => assertProjection(h), assert.AssertionError); h.leave()
  const doubled = inputs.controller.text.replace('giTextureMB() + hang.textureMB()', 'giTextureMB() * 2 + hang.textureMB()')
  assert.notEqual(doubled, inputs.controller.text)
  const cost = harness({ controller: doubled }); await cost.mount()
  assert.throws(() => assertCost(cost), assert.AssertionError); cost.leave()
})
test('Equal geometry is inert and preserves the material view for every study on desktop and phone', async () => {
  const rows = []
  for (const viewport of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) {
    const h = harness(viewport)
    try {
      for (const kind of kinds) {
        await h.mount('materials', { view: `material-${kind}` })
        const datum = h.find('picture-datum'), before = h.forge().hang()
        assert.equal(datum.textContent, 'Equal geometry · shared light')
        datum.click(); await flush(); h.stack.render(0)
        const after = h.forge().hang()
        rows.push({ action: 'datum click', viewport, selectedKind: kind,
          datumDisabled: datum.disabled, beforeView: before.camera.view, afterView: after.camera.view,
          beforeKind: before.materialPair.kind, afterKind: after.materialPair.kind,
          cameraUnchanged: JSON.stringify(before.camera.position) === JSON.stringify(after.camera.position) })
      }
    } finally { h.leave() }
  }
  materialViewRows.push(...rows)
  assert(rows.every(row => row.datumDisabled && row.beforeView === row.afterView && row.beforeKind === row.afterKind && row.cameraUnchanged),
    `An informational material datum changed the resumable view: ${JSON.stringify(rows.filter(row => !row.datumDisabled || row.beforeView !== row.afterView))}`)
})
test('tier remount preserves selected oak without a datum click on desktop and phone', async () => {
  const rows = []
  for (const viewport of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) {
    const h = harness(viewport)
    try {
      await h.mount('materials', { view: 'material-oak' })
      const before = h.forge().hang(), old = h.pairs.at(-1)
      h.forge().tier('calm'); await flush(); h.stack.render(0)
      const after = h.forge().hang()
      rows.push({ action: 'tier without datum click', viewport, requestedTier: 'calm',
        beforeView: before.camera.view, afterView: after.camera.view,
        beforeKind: before.materialPair.kind, afterKind: after.materialPair.kind,
        previousPairDisposed: old.disposals, newPairAllocated: h.pairs.at(-1) !== old })
    } finally { h.leave() }
  }
  materialViewRows.push(...rows)
  assert(rows.every(row => row.beforeView === 'material-oak' && row.afterView === 'material-oak' && row.afterKind === 'oak'
    && row.previousPairDisposed === 1 && row.newPairAllocated), JSON.stringify(rows))
})
test('clicking Equal geometry cannot reset selected oak to gold on a subsequent tier remount', async () => {
  const rows = []
  for (const viewport of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) {
    const h = harness(viewport)
    try {
      await h.mount('materials', { view: 'material-oak' })
      const before = h.forge().hang(), old = h.pairs.at(-1), datum = h.find('picture-datum')
      datum.click(); await flush(); h.stack.render(0)
      const clicked = h.forge().hang()
      h.forge().tier('calm'); await flush(); h.stack.render(0)
      const after = h.forge().hang()
      rows.push({ action: 'datum click then tier', viewport, requestedTier: 'calm', datumDisabled: datum.disabled,
        beforeView: before.camera.view, clickedView: clicked.camera.view, afterView: after.camera.view,
        beforeKind: before.materialPair.kind, clickedKind: clicked.materialPair.kind, afterKind: after.materialPair.kind,
        previousPairDisposed: old.disposals, newPairAllocated: h.pairs.at(-1) !== old })
    } finally { h.leave() }
  }
  materialViewRows.push(...rows)
  assert(rows.every(row => row.afterKind === 'oak' && row.afterView === 'material-oak'),
    `The datum click changed the selected material during tier remount: ${JSON.stringify(rows)}`)
})

const results = []
for (const { name, run } of tests) {
  try { await run(); results.push({ name, ok: true }) }
  catch (error) { results.push({ name, ok: false, error: error.stack ?? String(error) }) }
}
const report = {
  kind: 'production-controller-material-study-check', browser: false, gpu: false, network: false,
  sources: Object.fromEntries(Object.entries(inputs).map(([name, value]) => [name, { file: value.file, sha256: sha(value.text) }])),
  ok: results.every(r => r.ok), passed: results.filter(r => r.ok).length, total: results.length, results,
  materialViewRows,
  limitations: ['Controller, pair helper, labels, register, scale and CPU camera projection are real; room/frame material plumbing and DOM are doubles.',
    'This does not validate library texture bytes, shader compilation, final material appearance, real input dispatch or live GPU costs.'],
}
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
