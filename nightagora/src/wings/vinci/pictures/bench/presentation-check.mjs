#!/usr/bin/env node
/** Offline behavioural audit of the real buildHang, register and scale modules.
 * Run: node src/wings/vinci/pictures/bench/presentation-check.mjs
 * No browser, GPU, network, asset decoding, generated modules or source edits.
 * Only material/TSL, frame/contact batches, plate I/O and DOM are doubles.
 * Three geometry, transforms, camera projection and production policy are real.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import * as Three from 'three'

const root = fileURLToPath(new URL('../../../../../', import.meta.url))
const sourceHashes = {}
function read(relative) {
  const file = path.resolve(root, relative)
  assert.ok(file.startsWith(root), `Read leaves this app: ${relative}`)
  const text = readFileSync(file, 'utf8')
  sourceHashes[relative] = createHash('sha256').update(text).digest('hex')
  return text
}
const rawRegister = read('src/wings/vinci/pictures/data/paintings.json')
const storeSnapshot = JSON.parse(read('src/wings/vinci/pictures/data/store-audit.json'))
assert.equal(createHash('sha256').update(JSON.stringify(storeSnapshot.records)).digest('hex'), storeSnapshot.recordSha256,
  'The app-plugin manifest snapshot must retain its recorded hash')
const makeIndex = records => ({ all: records, byId: new Map(records.map(entry => [entry.id, entry])) })
const manifest = makeIndex(storeSnapshot.records)
const benchTree = ts.createSourceFile('bench/index.ts', read('src/wings/vinci/pictures/bench/index.ts'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
const configuredGaps = []
function inspectBenchGap(node) {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'buildHang') {
    const options = node.arguments[3]
    assert.ok(options && ts.isConditionalExpression(options) && ts.isIdentifier(options.condition)
      && options.condition.text === 'completeHang' && ts.isObjectLiteralExpression(options.whenTrue),
    'Identify the production complete-hang options, not a separate fixture spacing')
    const gap = options.whenTrue.properties.find(property => ts.isPropertyAssignment(property)
      && ts.isIdentifier(property.name) && property.name.text === 'gapM')
    assert.ok(gap && ts.isNumericLiteral(gap.initializer), 'Production complete-hang gap must have an explicit numeric value')
    configuredGaps.push(Number(gap.initializer.text))
  }
  ts.forEachChild(node, inspectBenchGap)
}
inspectBenchGap(benchTree)
assert.equal(configuredGaps.length, 1, 'Identify exactly one production complete-hang construction')
const completeHangGapM = configuredGaps[0]
const texts = Object.fromEntries(['register', 'scale', 'index', 'policy', 'policy-label', 'registration', 'arch-mask', 'visitor-copy', 'aperture'].map(name => [name, read(`src/wings/vinci/pictures/${name}.ts`)]))
function compile(name, text, dependencies, globals = {}) {
  const exports = {}
  const js = ts.transpileModule(text, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }, fileName: `${name}.ts` }).outputText
  vm.runInNewContext(js, { ...globals, exports, require(specifier) {
    assert.ok(Object.hasOwn(dependencies, specifier), `Unexpected dependency: ${specifier}`)
    return dependencies[specifier]
  } }, { filename: `${name}.ts`, timeout: 2000 })
  return exports
}
const policy = compile('policy', texts.policy, {})
const registration = compile('registration', texts.registration, {})
const visitorCopy = compile('visitor-copy', texts['visitor-copy'], {})
const register = compile('register', texts.register, { './policy': policy,
  './data/paintings.json?raw': { default: rawRegister },
})
const scale = compile('scale', texts.scale, { three: Three })
const expectedPlates = works => works.flatMap(work => policy.resolvePicturePolicy(work, manifest).mainPlates)
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }
const near = (actual, expected, reason, tolerance = 1e-6) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
  `${reason}: expected ${expected}, received ${actual}`,
)
const descendants = el => [el, ...el.children.flatMap(descendants)]

function shaderNode(fields = {}) {
  const proxy = new Proxy(fields, { get(target, key) {
    if (key in target) return target[key]
    if (['x', 'y', 'z', 'r', 'g', 'b', 'rgb', 'xy', 'xyz'].includes(key)) return proxy
    return () => proxy
  } })
  return proxy
}
function harness(indexSource = texts.index, viewport = { width: 1512, height: 950 }) {
  const geometries = [], materials = [], batches = [], streams = [], dom = [], contactSources = []
  class BufferGeometry extends Three.BufferGeometry {
    constructor(...args) { super(...args); this.disposals = 0; geometries.push(this) }
    dispose() { this.disposals++; super.dispose() }
  }
  class PlaneGeometry extends Three.PlaneGeometry {
    constructor(...args) { super(...args); this.disposals = 0; geometries.push(this) }
    dispose() { this.disposals++; super.dispose() }
  }
  class BoxGeometry extends Three.BoxGeometry {
    constructor(...args) { super(...args); this.disposals = 0; geometries.push(this) }
    dispose() { this.disposals++; super.dispose() }
  }
  class Material extends Three.MeshStandardMaterial {
    constructor(parameters) { super(parameters); this.colorNode = shaderNode(); this.roughnessNode = shaderNode(); this.disposals = 0; materials.push(this) }
    dispose() { this.disposals++; super.dispose() }
  }
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.dataset = {}; this.attributes = {}; this.childNodes = []
      this.hidden = false; this.removals = 0; this.style = { setProperty() {} }; dom.push(this)
    }
    get children() { return this.childNodes.filter(child => child instanceof Element) }
    get textContent() { return this.childNodes.map(child => typeof child === 'string' ? child : child.textContent).join('') }
    set textContent(value) { this.childNodes = [String(value ?? '')] }
    set innerHTML(_value) { throw new Error('Literal DOM fixture refuses HTML injection') }
    append(...children) { this.childNodes.push(...children) }
    prepend(...children) { this.childNodes.unshift(...children) }
    replaceChildren(...children) { this.childNodes = [...children] }
    setAttribute(name, value) { this.attributes[name] = String(value) }
    remove() { this.removals++ }
  }
  function batch(kind, placements) {
    const result = { kind, placements: [...placements], group: new Three.Group(),
      selections: [], disposals: 0, stats: {},
      setVisible(ids) { this.selections.push(ids === undefined ? undefined : [...ids]) },
      dispose() { this.disposals++ },
    }
    batches.push(result)
    return result
  }
  function createPlateStream(preview, plate) {
    // The real register resolver must supply the live allowlisted pair. The
    // fake stream has no URL, network or decoder and cannot admit a new file.
    assert.equal(manifest.byId.get(preview.id), preview)
    assert.equal(manifest.byId.get(plate.id), plate)
    assert.equal(preview.role, 'painting-preview'); assert.equal(plate.role, 'painting-plate')
    policy.validatePaintingRecord(preview, 'painting-preview')
    policy.validatePaintingRecord(plate, 'painting-plate')
    const record = { preview, plate, material: new Material(), disposals: 0,
      ready: Promise.resolve(), available: () => true, pending: () => 0, error: () => null,
      textureMB: () => 0, allocation: () => ({ previewMB: 0, fullMB: 0 }),
      high: async () => {}, update() {},
      dispose() { this.disposals++; this.material.dispose() },
    }
    streams.push(record)
    return record
  }
  const gpu = { ...Three, BufferGeometry, PlaneGeometry, BoxGeometry, MeshStandardNodeMaterial: Material }
  const tsl = { uv: () => shaderNode(), vec2: () => shaderNode(), vec3: () => shaderNode(),
    positionWorld: shaderNode(), positionGeometry: shaderNode(),
    abs: () => shaderNode(), attribute: () => shaderNode(), float: () => shaderNode(),
    floor: () => shaderNode(), min: () => shaderNode(), max: () => shaderNode(),
    sin: () => shaderNode(), smoothstep: () => shaderNode(), clamp: () => shaderNode(),
    mx_noise_float: () => shaderNode(),
    // the window's own terms: a dot, a power and the geometry normal
    dot: () => shaderNode(), pow: () => shaderNode(), mix: () => shaderNode(),
    // the board's own tooth arrives with the camera, so the mount asks how
    // far the eye is standing
    length: () => shaderNode(), cameraPosition: shaderNode(),
    normalGeometry: shaderNode() }
  const globals = { document: { createElement: tag => new Element(tag) }, innerWidth: viewport.width, innerHeight: viewport.height }
  const policyLabel = compile('policy-label', texts['policy-label'], { './registration': registration, './visitor-copy': visitorCopy }, globals)
  const archMask = compile('arch-mask', texts['arch-mask'], { 'three/webgpu': gpu })
  const aperture = compile('aperture', texts.aperture, { 'three/tsl': tsl })
  const module = compile('index', indexSource, {
    'three/webgpu': gpu, 'three/tsl': tsl, './register': register, './scale': scale,
    './policy': policy,
    './policy-label': policyLabel,
    './registration': registration,
    './arch-mask': archMask,
    './aperture': aperture,
    // The stub answers for the moulding's declared width as well as its
    // builder: the hang records how far a frame stands outside its field.
    './frame': { FRAME_MOULDING_WIDTH_M: .052, buildFrameBatch: (_stack, placements) => batch('mouldings', placements) },
    './directional-contact': { buildBakedFrameContact: (group, placements) => {
      contactSources.push(group)
      return batch('contact', placements)
    } },
    './stream': { createPlateStream },
  }, globals)
  const stack = {
    tierName: () => 'standard', detail() {},
    cost: () => ({ textureMB: 0, budget: { textureMB: 256 } }),
    materials: { sync: () => ({ albedo: new Three.Color('#ffffff'), roughness: .8, metalness: 0 }) },
  }
  return {
    streams, batches, geometries, materials, dom, policyLabel, contactSources,
    /** the hang module the harness actually executed */
    module,
    build(works, options, sourceManifest = manifest) { return module.buildHang(stack, works, sourceManifest, options) },
    released() {
      assert.ok(geometries.length > 0, 'Disposal check created no geometry')
      for (const geometry of geometries) assert.equal(geometry.disposals, 1, 'A geometry leaked or was disposed twice')
      for (const material of materials) assert.equal(material.disposals, 1, 'A material leaked or was disposed twice')
      for (const stream of streams) assert.equal(stream.disposals, 1, 'A plate stream leaked or was disposed twice')
      for (const resource of batches) assert.equal(resource.disposals, 1, 'A frame/contact batch leaked or was disposed twice')
    },
  }
}
function geometryBounds(mesh) {
  mesh.updateWorldMatrix(true, false)
  mesh.geometry.computeBoundingBox()
  return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)
}
function cameraFor(frame) {
  const camera = new Three.PerspectiveCamera(40, 1512 / 950, .03, 100)
  camera.position.set(frame.x, frame.y, Math.max(3, frame.height * 2))
  camera.updateMatrixWorld(true)
  return camera
}
function measurement(frame) {
  assert.ok(frame.aperture, `${frame.work.id}: expected an actual aperture`)
  frame.aperture.updateWorldMatrix(true, false)
  return scale.measureProjectedWork(frame.work, cameraFor(frame), frame.aperture.geometry,
    frame.aperture.matrixWorld, { width: 1512, height: 950 })
}
function assertCatalogue(h, hang) {
  const frame = hang.frames.find(f => f.work.id === 'leda-wilton')
  assert.ok(frame)
  assert.equal(frame.aperture, null, 'Wilton catalogue-only mode created a measured aperture')
  assert.equal(frame.cards.length, 0, 'Wilton acquired a painting card')
  assert.ok(h.batches.every(b => !b.placements.some(p => p.id === frame.work.id)), 'Wilton was sent to gilded moulding/contact builders')
  assert.equal(frame.furniture.children.length, 1, 'Wilton needs exactly one catalogue card')
  const card = frame.furniture.getObjectByName('unillustrated-catalogue-card/leda-wilton')
  assert.ok(card?.isMesh, 'Wilton catalogue card is absent')
  const size = geometryBounds(card).getSize(new Three.Vector3())
  near(size.x, 1.5, 'Wilton furniture width'); near(size.y, 1.8, 'Wilton furniture height')
  near(geometryBounds(card).min.y, .8, 'Wilton furniture bottom')
  assert.equal(card.userData.physicalPaintingExtent, null, 'The catalogue furniture became a measured painting extent')
  near(card.userData.modernCarrierM.width, size.x, 'Declared modern carrier width')
  near(card.userData.modernCarrierM.height, size.y, 'Declared modern carrier height')
  const current = h.policyLabel.policyLabelText(frame.work, [])
  const languages = descendants(frame.caption).filter(el => el.className === 'picture-catalogue-language')
  assert.deepEqual(languages.map(el => el.lang), ['en', 'de'], 'Wilton requires two explicitly identified languages')
  for (const language of languages) {
    assert.ok(language.textContent.includes(current.firstLine[language.lang]), `Wilton lost its current ${language.lang} policy first line`)
    assert.ok(language.textContent.includes(frame.work[`reproduction_note_${language.lang}`]), `Wilton lost its ${language.lang} reproduction note`)
  }
  assert.doesNotMatch(frame.caption.textContent, /Absent\.|Abwesend\.|\bREF\b/, 'The catalogue sheet retained obsolete absence wording or an unexplained historic rights code')
  assert.ok(frame.caption.textContent.includes('96.52 × 73.66 cm'), 'Wilton lost its historical measured dimensions')
  assert.ok(frame.caption.textContent.includes('Catalogue / Katalog:'), 'Historical dimensions need a catalogue context')
  assert.ok(descendants(frame.caption).every(el => !['IMG', 'CANVAS'].includes(el.tagName)), 'Wilton acquired an image inside the sheet')
}
function assertSalaExtent(h, hang) {
  const frame = hang.frames.find(f => f.work.id === 'sala-delle-asse')
  assert.ok(frame)
  assert.equal(scale.trueScale(frame.work), null, 'Room footprint was used as a painting extent')
  assert.equal(frame.aperture, null, 'Unknown painted dimensions must not produce an outline')
  assert.ok(h.batches.every(b => !b.placements.some(p => p.id === frame.work.id)), 'Sala acquired a physical-painting mount identity')
  return frame
}
function assertSalaAbsence(h, hang) {
  const frame = assertSalaExtent(h, hang)
  assert.equal(frame.cards.length, 0, 'Sala without an admitted source acquired a painting image')
  assert.equal(frame.furniture.children.length, 3, 'Sala needs one dimension card plus exactly two empty wells')
  assert.ok(frame.furniture.getObjectByName('dimension-card/sala-delle-asse')?.isMesh)
  const wells = frame.furniture.children.filter(child => child.name.startsWith('empty-image-well/'))
  assert.deepEqual(wells.map(w => w.name).sort(), ['empty-image-well/sala-delle-asse/0', 'empty-image-well/sala-delle-asse/1'])
  assert.equal(frame.wellLabels.length, 2)
  for (const well of frame.wellLabels) {
    assert.ok(wells.includes(well.mesh), 'Well caption does not refer to a real well mesh')
    assert.match(well.label.textContent, /^Absent\n(?:Monochrome|Vault) · RC$/)
  }
  assert.ok(frame.caption.textContent.includes(frame.work.measurement.extent), 'Sala must explain that 15 × 15 m is only a room footprint')
  for (const mesh of frame.furniture.children) {
    assert.equal(mesh.userData.manifestId, 'vinci/pictures/mats')
    assert.equal(mesh.material.map, null, 'An empty well acquired a painting texture')
  }
  near(frame.width, 1.15, 'Sala furniture assembly width'); near(frame.height, 1.1, 'Sala furniture assembly height')
  near(frame.y - frame.height / 2, .8, 'Sala furniture assembly bottom')
}
function assertMountedShadowSource(h, hang) {
  assert.equal(h.contactSources.length, 1, 'Capture exactly one actual contact-source group')
  const source = h.contactSources[0]
  source.traverse(object => {
    assert.ok(!object.name.startsWith('unillustrated-catalogue-card/'),
      'Unframed catalogue furniture entered the physical contact source')
    assert.notEqual(object.name, 'catalogue-furniture/leda-wilton',
      'Wilton has no contact-cache owner and must not cast a neighbor-owned footprint')
  })
  // Determine real mounts from the production backing meshes, independently
  // of the placementWorkIds predicate used by the runtime filtering loop.
  const mountedFrames = hang.frames.filter(frame => frame.furniture.children.some(child =>
    child.name.startsWith('physical-backing/') || child.name.startsWith('unmeasured-document-mount/')))
  assert.deepEqual(source.children.slice(1).map(child => child.name),
    Array.from(mountedFrames, frame => frame.furniture.name),
    'Contact source must contain every real mount furniture group, and no unmounted sheets')
  assert.equal(source.children.length, mountedFrames.length + 1,
    'Keep the moulding batch plus exactly the physical furniture groups')
  for (const frame of mountedFrames) {
    const clone = source.getObjectByName(frame.furniture.name)
    assert.ok(clone && clone !== frame.furniture, `${frame.work.id}: contact geometry must be a separate group clone`)
    assert.equal(clone.children.length, frame.furniture.children.length,
      `${frame.work.id}: the contact clone lost physical furniture`)
    for (const mesh of frame.furniture.children) {
      const copied = clone.getObjectByName(mesh.name)
      assert.ok(copied?.isMesh, `${mesh.name}: physical contact mesh missing`)
      assert.notEqual(copied, mesh, `${mesh.name}: contact source reused the live object`)
      assert.equal(copied.geometry, mesh.geometry, `${mesh.name}: clone changed actual backing geometry`)
      assert.deepEqual(copied.position.toArray(), mesh.position.toArray(), `${mesh.name}: clone moved the backing`)
      assert.equal(copied.castShadow, mesh.castShadow, `${mesh.name}: clone changed its shadow role`)
    }
  }
}

const tests = [], summaries = [], sourceInventory = new Map()
const test = (name, run) => tests.push({ name, run })
test('Contact source excludes the unmounted Wilton sheet while retaining real backings, reverse and Sala document; the old loop fails', async () => {
  const works = [...register.segmentWorks('murals'), register.getWork('ginevra-de-benci')]
  const h = harness(), hang = h.build(works)
  assertMountedShadowSource(h, hang)
  const source = h.contactSources[0]
  for (const name of ['physical-backing/tavola-doria', 'physical-backing/ginevra-de-benci',
    'physical-backing/ginevra-de-benci/reverse', 'unmeasured-document-mount/sala-delle-asse']) {
    assert.ok(source.getObjectByName(name)?.isMesh, `${name}: the regression fixture must include this real mount`)
  }
  hang.dispose(); hang.dispose(); h.released()

  const guardedLoop = 'for (const frame of frames) if (mountedWorkIds.has(frame.work.id)) shadowSource.add(frame.furniture.clone())'
  assert.equal(texts.index.split(guardedLoop).length, 2, 'The old-loop mutant must target exactly the current production filter')
  const oldLoop = 'for (const frame of frames) shadowSource.add(frame.furniture.clone())'
  const broken = harness(texts.index.replace(guardedLoop, oldLoop)), ghost = broken.build(works)
  assert.throws(() => assertMountedShadowSource(broken, ghost),
    /Wilton has no contact-cache owner|Unframed catalogue furniture entered/,
    'Restoring the unconditional clone loop must reproduce the unmounted shadow-source failure')
  ghost.dispose(); ghost.dispose(); broken.released()
})
test('Wilton remains an unillustrated catalogue card despite known historical dimensions', async () => {
  const h = harness(), hang = h.build([register.getWork('leda-wilton')])
  assertCatalogue(h, hang); assert.equal(h.streams.length, 0)
  const historical = scale.trueScale(hang.frames[0].work)
  near(historical.widthM, .7366, 'Wilton historical width'); near(historical.heightM, .9652, 'Wilton historical height')
  assert.equal(historical.datumM, null)
  hang.dispose(); hang.dispose(); h.released()
})
test('Wilton bilingual caption has the projected paper bounds at desktop and phone common scales', async () => {
  for (const viewport of [{ width: 1512, height: 950, pxPerCm: 1.29 }, { width: 390, height: 844, pxPerCm: 1.08 }]) {
    const h = harness(texts.index, viewport), hang = h.build([register.getWork('leda-wilton')])
    const frame = hang.frames[0], camera = new Three.PerspectiveCamera(40, viewport.width / viewport.height, .03, 100)
    const distance = viewport.height / (2 * Math.tan(20 * Math.PI / 180) * viewport.pxPerCm * 100)
    camera.position.set(frame.x, frame.y, .021 + distance)
    hang.update(camera, .016, frame.work.id)
    assertCatalogue(h, hang)
    assert.equal(frame.caption.hidden, false)
    const width = parseFloat(frame.caption.style.width), height = parseFloat(frame.caption.style.height)
    near(width, frame.width * 100 * viewport.pxPerCm, 'Caption projected paper width')
    near(height, frame.height * 100 * viewport.pxPerCm, 'Caption projected paper height')
    near(parseFloat(frame.caption.style.left), viewport.width / 2, 'Caption centre x')
    near(parseFloat(frame.caption.style.top), viewport.height / 2, 'Caption centre y')
    assert.ok(parseFloat(frame.caption.style.padding) >= 9, 'The paper has insufficient text inset')
    assert.ok(parseFloat(frame.caption.style.fontSize) >= 11, 'The sheet shrank below its minimum type size')
    hang.dispose(); hang.dispose(); h.released()
  }
  // This checks physical/projected bounds and complete DOM copy. Actual text
  // wrapping and containment still require the desktop and phone EYES images.
})
test('Sala without an admitted source retains its dimension card and two empty image wells without an outline or stream', async () => {
  const h = harness(), withoutSala = makeIndex(manifest.all.filter(entry => entry.work_id !== 'sala-delle-asse'))
  const hang = h.build([register.getWork('sala-delle-asse')], {}, withoutSala)
  assertSalaAbsence(h, hang); assert.equal(h.streams.length, 0)
  hang.dispose(); hang.dispose(); h.released()
})
test('The available Sala monochrome source keeps unknown dimensions without a contradictory visible absence label', async () => {
  const h = harness(), work = register.getWork('sala-delle-asse'), hang = h.build([work])
  try {
    const frame = assertSalaExtent(h, hang)
    assert.equal(frame.cards.length, 1, 'The current monochrome source must be presented')
    assert.equal(frame.cards[0].entry.plate.id, 'vinci/painting-plate/sala-delle-asse')
    const image = frame.cards[0].mesh, pixels = frame.cards[0].entry.pixels
    const size = geometryBounds(image).getSize(new Three.Vector3())
    near(size.x / size.y, pixels.width / pixels.height, 'Sala complete document aspect', 1e-6)
    assert.ok(size.x <= 1.15 && size.y <= .72 + 1e-6, 'Sala document exceeds its declared modern carrier')
    const backing = frame.furniture.getObjectByName('unmeasured-document-mount/sala-delle-asse')
    assert.ok(backing?.isMesh, 'Sala document has no physical backing')
    assert.equal(backing.userData.physicalPaintingExtent, null, 'Document furniture invented a measured painting extent')
    const backSize = geometryBounds(backing).getSize(new Three.Vector3())
    // Modern document furniture is mounted to its own sheet, on the same
    // board rule the paintings take.
    const sheet = 2 * h.module.pictureMatBorderM(size.x, size.y)
    near(backSize.x, size.x + sheet, 'Sala carrier border width')
    near(backSize.y, size.y + sheet, 'Sala carrier border height')
    near(backSize.z, .016, 'Sala carrier backing depth')
    assert.ok(backing.castShadow && backing.receiveShadow, 'Sala document backing must participate in the same light')
    for (const batch of h.batches) {
      assert.equal(batch.placements.length, 1, 'Sala has exactly one document mount')
      assert.equal(batch.placements[0].id, 'sala-delle-asse:document')
      near(batch.placements[0].width, backSize.x, 'Sala moulding width follows document furniture')
      near(batch.placements[0].height, backSize.y, 'Sala moulding height follows document furniture')
    }
    const label = h.policyLabel.policyLabelText(work, frame.cards.map(card => card.entry))
    assert.match(label.record.en, /Dimensions not established/)
    assert.match(label.note.en, /dimensions of the painted surface are unknown/)
    assert.match(label.note.de, /Maße der bemalten Fläche sind unbekannt/)
    await flush(); hang.setVisible([work.id]); hang.update(cameraFor(frame), .016, work.id)
    assert.equal(frame.cards[0].mesh.visible, true)
    for (const well of frame.wellLabels) {
      assert.ok(well.label.hidden || !/Absent[\s\S]*Monochrome/.test(well.label.textContent),
        'A visible Monochrome absence label contradicts the admitted monochrome reproduction')
    }
  } finally { hang.dispose(); hang.dispose(); h.released() }
})
test('Last Supper retains its actual 8.8 by 4.6 m aperture above the floor with a null measurement datum', async () => {
  const h = harness(), hang = h.build([register.getWork('last-supper')]), frame = hang.frames[0]
  const bounds = geometryBounds(frame.aperture), dimensions = bounds.getSize(new Three.Vector3())
  near(dimensions.x, 8.8, 'Supper aperture width'); near(dimensions.y, 4.6, 'Supper aperture height')
  near(bounds.min.y, .5, 'Supper aperture lower edge'); near(bounds.getCenter(new Three.Vector3()).y, 2.8, 'Supper aperture centre')
  const measured = measurement(frame)
  assert.equal(measured.datumM, null); assert.equal(measured.datumErrorCm, null); assert.equal(measured.passes, true)
  assert.equal(h.streams.length, 1, 'The current Last Supper source must be mounted')
  assert.equal(frame.cards[0].entry.plate.id, 'vinci/painting-plate/last-supper')
  hang.dispose(); hang.dispose(); h.released()
})
test('Other measured nonmain outlines rest at 0.8 m without inventing historical datum values', async () => {
  const works = ['isabella-deste-cartoon', 'leda-spiridon', 'tavola-doria'].map(register.getWork)
  const h = harness(), hang = h.build(works)
  await flush()
  for (const frame of hang.frames) {
    near(geometryBounds(frame.aperture).min.y, .8, `${frame.work.id}: lower edge`)
    const measured = measurement(frame)
    assert.equal(measured.datumM, null); assert.equal(measured.datumErrorCm, null); assert.equal(measured.passes, true)
  }
  assert.equal(h.streams.length, 3, 'Isabella, Spiridon and Tavola each now have an admitted image')
  assert.deepEqual(h.streams.map(stream => stream.plate.id), Array.from(expectedPlates(works), entry => entry.plate.id))
  hang.dispose(); hang.dispose(); h.released()
})
test('All 24 actual main apertures preserve centimetre extents and the 1.55 m datum', async () => {
  const h = harness(), hang = h.build(register.MAIN_HANG)
  await flush()
  assert.equal(hang.frames.length, 24)
  for (const frame of hang.frames) {
    const measured = measurement(frame)
    assert.equal(measured.datumM, 1.55); near(measured.datumErrorCm, 0, `${frame.work.id}: datum error`)
    assert.equal(measured.passes, true, `${frame.work.id}: actual geometry calibration`)
    near(measured.worldWidthM, frame.work.width_cm / 100, `${frame.work.id}: width`)
    near(measured.worldHeightM, frame.work.height_cm / 100, `${frame.work.id}: height`)
  }
  assert.equal(h.streams.length, 25, 'All 24 main fronts plus Ginevra reverse must be admitted')
  assert.deepEqual(h.streams.map(stream => stream.plate.id), Array.from(expectedPlates(register.MAIN_HANG), entry => entry.plate.id))
  const mounts = h.batches.find(b => b.kind === 'mouldings').placements
  assert.equal(mounts.length, 25, 'Twenty-four originals and the reverse need distinct physical mounts')
  assert.equal(new Set(mounts.map(mount => mount.id)).size, mounts.length, 'Contact/moulding identities must be unique')
  assert.ok(mounts.some(mount => mount.id === 'ginevra-de-benci:reverse'))
  hang.dispose(); hang.dispose(); h.released()
})
test('Reproduction inspection hides all apertures, furniture and well captions, then restores the selected wall', async () => {
  const works = ['ginevra-de-benci', 'sala-delle-asse', 'leda-wilton', 'last-supper'].map(register.getWork)
  const h = harness(), hang = h.build(works)
  await flush()
  hang.setVisible(['ginevra-de-benci'], true)
  const ginevra = hang.frames[0]
  hang.update(cameraFor(ginevra), .016, ginevra.work.id)
  for (const frame of hang.frames) {
    if (frame.aperture) assert.equal(frame.aperture.visible, false)
    assert.equal(frame.furniture.visible, false)
    assert.equal(frame.caption.hidden, true)
    for (const well of frame.wellLabels) assert.equal(well.label.hidden, true)
    for (const card of frame.cards) assert.equal(card.mesh.visible, frame.work.id === 'ginevra-de-benci')
  }
  assert.ok(ginevra.cards.every(card => card.mesh.visible), 'Both faces of Ginevra must survive inspection')
  for (const batch of h.batches) assert.deepEqual(batch.selections.at(-1), [])
  hang.setVisible(['sala-delle-asse'])
  const sala = hang.frames[1]
  hang.update(cameraFor(sala), .016, sala.work.id)
  assert.equal(sala.furniture.visible, true)
  assert.ok(sala.cards.every(card => card.mesh.visible), 'The selected admitted Sala reproduction did not restore')
  for (const batch of h.batches) assert.deepEqual(batch.selections.at(-1), ['sala-delle-asse:document'], 'Sala work selection must name its document mount')
  hang.setVisible(['leda-wilton'])
  const wilton = hang.frames[2]
  hang.update(cameraFor(wilton), .016, wilton.work.id)
  assert.equal(wilton.furniture.visible, true)
  assert.equal(wilton.caption.hidden, false, 'The selected absent work lost its catalogue caption')
  assert.ok(sala.cards.every(card => !card.mesh.visible), 'The unselected Sala reproduction stayed visible')
  assert.ok(ginevra.cards.every(card => !card.mesh.visible))
  hang.setVisible()
  assert.ok(hang.frames.every(frame => frame.furniture.visible && (!frame.aperture || frame.aperture.visible)))
  const scene = new Three.Group(); scene.add(hang.wall)
  hang.dispose(); hang.dispose(); await flush(); h.released()
  assert.equal(hang.wall.parent, null); assert.equal(hang.labels.removals, 1)
  assert.equal(descendants(hang.labels).filter(el => el.className === 'picture-well-caption').length, 0,
    'The current Sala reproduction must not restore obsolete image-absence wells')
})
test('Negative controls detect catalogue-mode removal, obsolete copy, a missing well and one centimetre of main-datum drift', async () => {
  const catalogueClause = "work.display_mode === 'unillustrated_catalogue_card'"
  assert.ok(texts.index.includes(catalogueClause), 'Catalogue mutant must target the current production branch')
  const h1 = harness(texts.index.replace(catalogueClause, 'false'))
  const wrongCatalogue = h1.build([register.getWork('leda-wilton')])
  assert.throws(() => assertCatalogue(h1, wrongCatalogue), /catalogue-only mode created a measured aperture/)
  wrongCatalogue.dispose(); h1.released()
  const policyLine = 'text.firstLine[language]'
  assert.ok(texts.index.includes(policyLine), 'Obsolete-copy mutant must target the current production line')
  const staleHarness = harness(texts.index.replace(policyLine, 'work[`label_first_line_${language}`]'))
  const staleCatalogue = staleHarness.build([register.getWork('leda-wilton')])
  assert.throws(() => assertCatalogue(staleHarness, staleCatalogue), /current en policy first line/)
  staleCatalogue.dispose(); staleHarness.released()
  const wellList = "['Monochrome · RC', 'Vault · RC']"
  assert.ok(texts.index.includes(wellList), 'Well mutant must target the current production list')
  const h2 = harness(texts.index.replace(wellList, "['Monochrome · RC']"))
  const withoutSala = makeIndex(manifest.all.filter(entry => entry.work_id !== 'sala-delle-asse'))
  const missingWell = h2.build([register.getWork('sala-delle-asse')], {}, withoutSala)
  assert.throws(() => assertSalaAbsence(h2, missingWell), /exactly two empty wells/)
  missingWell.dispose(); h2.released()
  const h3 = harness(), drifted = h3.build([register.getWork('mona-lisa')])
  drifted.frames[0].aperture.position.y += .01
  const measured = measurement(drifted.frames[0])
  near(measured.datumErrorCm, 1, 'Negative control actual datum drift')
  assert.equal(measured.passes, false, 'A 1 cm datum error passed')
  drifted.dispose(); h3.released()
})
test('Invalid later joins and duplicate IDs fail before any owned allocation', async () => {
  const good = register.getWork('ginevra-de-benci')
  for (const works of [[good, { ...good, id: 'unmanifested-later-work' }], [good, good]]) {
    const h = harness()
    assert.throws(() => h.build(works))
    await flush()
    assert.equal(h.geometries.length, 0)
    assert.equal(h.materials.length, 0)
    assert.equal(h.streams.length, 0)
    assert.equal(h.batches.length, 0)
    assert.equal(h.dom.length, 0)
  }
})
test('Rejected later policy metadata and mismatched derivative provenance fail before any owned allocation', async () => {
  const good = register.getWork('ginevra-de-benci'), later = register.getWork('mona-lisa')
  const selected = policy.resolvePicturePolicy(later, manifest).primary
  assert.ok(selected)
  const mutations = [
    { id: selected.plate.id, patch: { class: 'REFERENCE-ONLY' } },
    { id: selected.plate.id, patch: { display: false } },
    { id: selected.plate.id, patch: { sha256: 'bad' } },
    { id: selected.plate.id, patch: { honesty_de: '' } },
    { id: selected.preview.id, patch: { source_url: 'https://example.invalid/different-source' } },
    { id: selected.preview.id, remove: true },
  ]
  for (const mutation of mutations) {
    const changed = makeIndex(manifest.all.flatMap(entry => entry.id !== mutation.id ? [entry]
      : mutation.remove ? [] : [{ ...entry, ...mutation.patch }]))
    const h = harness()
    assert.throws(() => h.build([good, later], {}, changed), /Inadmissible|policy|matching preview/)
    await flush()
    assert.equal(h.geometries.length, 0); assert.equal(h.materials.length, 0)
    assert.equal(h.streams.length, 0); assert.equal(h.batches.length, 0); assert.equal(h.dom.length, 0)
  }
})
test('All ten segment source extents and object counts come from the production builder', async () => {
  assert.equal(register.SEGMENTS.length, 10)
  for (const segment of register.SEGMENTS) {
    const h = harness(), hang = h.build(register.segmentWorks(segment.id), segment.id === 'complete-hang' ? { gapM: completeHangGapM } : {})
    await flush(); hang.wall.updateMatrixWorld(true)
    assertMountedShadowSource(h, hang)
    const content = new Three.Box3().setFromObject(hang.wall)
    // Each work is sampled once from actual production geometry. This camera
    // belongs to the CPU fixture, not a live EYES scene or visibility proof.
    for (const frame of hang.frames) {
      if (sourceInventory.has(frame.work.id)) continue
      const camera = cameraFor(frame), viewport = { width: 1512, height: 950 }
      const field = frame.aperture ? scale.measureProjectedWork(frame.work, camera,
        frame.aperture.geometry, frame.aperture.matrixWorld, viewport) : null
      const plates = Array.from(frame.cards, card => {
        const window = registration.pictureDisplayWindow(card.entry.plate)
        const uvWindow = window ? registration.pictureDisplayUV(window) : null
        const size = geometryBounds(card.mesh).getSize(new Three.Vector3())
        const sourceAspect = uvWindow?.contentAspect ?? card.entry.pixels.width / card.entry.pixels.height
        near(size.x / size.y, sourceAspect, card.entry.plate.id + ': actual image geometry preserves the admitted display aspect', 1e-6)
        const envelope = scale.measureProjectedWork(frame.work, camera, card.mesh.geometry,
          card.mesh.matrixWorld, viewport)
        return {
          id: card.entry.plate.id, identity: card.entry.identity ?? card.entry.id, face: card.entry.face,
          sourceSha256: card.entry.plate.sha256, sourcePixels: card.entry.pixels,
          displayWindowApplied: uvWindow !== null, displayAspect: sourceAspect,
          actualGeometryM: { width: size.x, height: size.y },
          measurement: envelope,
          envelopeStatus: envelope === null ? 'unmeasured' : envelope.passes ? 'nominal-envelope-pass' : 'envelope-fail',
          physicalSourceRegistration: 'unestablished',
        }
      })
      sourceInventory.set(frame.work.id, {
        id: frame.work.id, title: frame.work.title_en,
        registerCm: { width: frame.work.width_cm, height: frame.work.height_cm },
        physicalField: field, plates,
        sourceStatus: plates.length ? 'illustrated' : 'unillustrated-catalogue',
        cameraFixture: { viewport, position: camera.position.toArray(), fov: camera.fov },
      })
    }
    const frames = hang.frames.map(frame => ({
      id: frame.work.id, mode: frame.work.display_mode,
      x: frame.x, y: frame.y, width: frame.width, height: frame.height,
      left: frame.left, right: frame.right, aperture: !!frame.aperture,
      imageCount: frame.cards.length, plateIds: frame.cards.map(card => card.entry.plate.id),
      furnitureMeshCount: frame.furniture.children.length,
    }))
    assert.ok(Number.isFinite(hang.extent) && hang.extent > 0)
    const frameCount = h.batches.find(b => b.kind === 'mouldings').placements.length
    if (segment.id === 'complete-hang') {
      assert.equal(frameCount, 26, 'Complete room needs twenty-five originals and one separately mounted reverse')
      assert.equal(h.streams.length, 26, 'Complete room must hold 25 admitted fronts and Ginevra reverse')
      assert.deepEqual(h.streams.map(stream => stream.plate.id), Array.from(expectedPlates(register.segmentWorks(segment.id)), entry => entry.plate.id))
      assert.ok(hang.frames.every(frame => frame.aperture.visible), 'A full-room budget cannot hide physical outlines')
      for (let i = 1; i < frames.length; i++) assert.ok(frames[i].left - frames[i - 1].right >= completeHangGapM - 1e-8, 'Complete assembly spacing')
    }
    summaries.push({
      segment: segment.id, extent: hang.extent, completeHangGapM: segment.id === 'complete-hang' ? completeHangGapM : null, workCount: frames.length, frameCount,
      imageCount: h.streams.length, furnitureMeshCount: frames.reduce((n, f) => n + f.furnitureMeshCount, 0),
      emptyWellCount: hang.frames.reduce((n, f) => n + f.wellLabels.length, 0),
      contentBounds: { min: content.min.toArray(), max: content.max.toArray() }, frames,
    })
    const expectedMountIds = Array.from(hang.frames).flatMap(frame => frame.aperture
      ? [frame.work.id, ...frame.cards.filter(card => card.entry.face === 'reverse').map(() => `${frame.work.id}:reverse`)]
      : frame.work.height_cm === null && frame.cards.length ? [`${frame.work.id}:document`] : [])
    assert.equal(frameCount, expectedMountIds.length)
    assert.deepEqual(h.batches.find(b => b.kind === 'mouldings').placements.map(mount => mount.id), expectedMountIds,
      `${segment.id}: physical frame identities must distinguish painting faces and unmeasured documentary furniture`)
    assert.deepEqual(h.streams.map(stream => stream.plate.id),
      Array.from(expectedPlates(register.segmentWorks(segment.id)), entry => entry.plate.id),
      `${segment.id}: mounted plates differ from the current source policy`)
    hang.dispose(); hang.dispose(); h.released()
  }
  assert.equal(sourceInventory.size, register.REGISTER.length, 'The segment inventory must cover the complete locked register')
})

const results = []
for (const { name, run } of tests) {
  try { await run(); results.push({ name, ok: true }) }
  catch (error) { results.push({ name, ok: false, error: error.stack ?? String(error) }) }
}
const inventoryRows = [...sourceInventory.values()]
const primaryFields = inventoryRows.filter(row => row.physicalField !== null)
const inventoryPlates = inventoryRows.flatMap(row => row.plates)
const measuredPlates = inventoryPlates.filter(plate => plate.measurement !== null)
const inventorySummary = {
  basis: 'Actual production buildHang CPU geometry; per-work fixture camera, not live EYES observations',
  registeredWorks: inventoryRows.length,
  illustratedWorks: inventoryRows.filter(row => row.plates.length > 0).length,
  primaryFields: primaryFields.length,
  primaryFieldsPassing: primaryFields.filter(row => row.physicalField.passes).length,
  mainSourceImages: inventoryPlates.length,
  measuredSourcePlates: measuredPlates.length,
  measuredPrimarySourcePlates: measuredPlates.filter(plate => plate.face !== 'reverse').length,
  reverseSourcePlates: measuredPlates.filter(plate => plate.face === 'reverse').length,
  primaryEnvelopePasses: measuredPlates.filter(plate => plate.face !== 'reverse' && plate.measurement.passes).length,
  reverseEnvelopePasses: measuredPlates.filter(plate => plate.face === 'reverse' && plate.measurement.passes).length,
  totalEnvelopePasses: measuredPlates.filter(plate => plate.measurement.passes).length,
  totalEnvelopeFailures: measuredPlates.filter(plate => !plate.measurement.passes).length,
  unmeasuredSourcePlates: inventoryPlates.filter(plate => plate.measurement === null).length,
  authenticatedSourceRegistrations: 0,
  literalReproductionScaleGate: measuredPlates.length > 0 && measuredPlates.some(plate => !plate.measurement.passes)
    ? 'not-passed: reproduction envelopes exceed the numeric tolerance; source registration remains unestablished'
    : 'unestablished: nominal envelope geometry alone does not authenticate the physical source boundary',
}
const report = {
  kind: 'isolated-source-presentation-check', browser: false, gpu: false, network: false,
  ok: results.every(result => result.ok), passed: results.filter(result => result.ok).length,
  total: results.length, sourceHashes, results, segments: summaries,
  sourceScaleInventory: { summary: inventorySummary, works: inventoryRows },
  limitations: [
    'No rendered pixels, real DOM layout, native input, GPU costs, decoded texture residency or browser lifetime are exercised.',
    'Gilding/contact creation is audited at production placement, cloned furniture shadow-source and visibility calls; procedural moulding/contact geometry and material appearance are not rebuilt here.',
    'Segment extent and per-work placement come directly from production buildHang. contentBounds use actual CPU aperture, furniture and raster-card geometries, excluding mocked mouldings/contact.',
    'Streaming is an admitted-manifest-pair double. Actual fetch, decode, fade and release behavior belongs to stream-check and EYES.',
    'Negative controls mutate source only in memory and alter one constructed aperture transform; no locked register or production file is written.',
  ],
}
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
