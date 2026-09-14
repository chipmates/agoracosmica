#!/usr/bin/env node
/** Current hang geometry, explicit comparison camera, and two-face ownership.
 * Execute real buildHang, frame/contact builders, camera compose and scale
 * helpers. Doubles cover DOM, library inputs and asynchronous image transport.
 * No browser, GPU, image bytes or EYES endpoint is involved.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import * as Three from 'three/webgpu'
import * as TSL from 'three/tsl'

const root = fileURLToPath(new URL('../../../../../', import.meta.url))
const pictureDir = resolve(root, 'src/wings/vinci/pictures')
const sourceHashes = {}, modules = new Map(), streams = [], results = [], negatives = [], viewportSetters = []
const rows = [], routes = [], faceRows = [], signatureRows = [], mouldingRows = []
const sha = value => createHash('sha256').update(value).digest('hex')
function read(name) {
  const path = resolve(root, name)
  assert(!relative(root, path).startsWith('..'), `Outside workspace: ${name}`)
  const source = readFileSync(path, 'utf8'); sourceHashes[relative(root, path)] = sha(source)
  return source
}
const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText
class Element {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.childNodes = []; this.dataset = {}; this.attributes = new Map(); this.className = ''; this.style = { setProperty(name, value) { this[name] = String(value) } }; this.hidden = false; this.parent = null }
  get children() { return this.childNodes.filter(node => node instanceof Element) }
  get textContent() { return this.childNodes.map(node => node instanceof Element ? node.textContent : String(node)).join('') }
  set textContent(text) { this.replaceChildren(String(text ?? '')) }
  append(...nodes) { for (const node of nodes) { if (node instanceof Element) { node.remove(); node.parent = this } this.childNodes.push(node) } }
  prepend(...nodes) { for (const node of [...nodes].reverse()) { if (node instanceof Element) { node.remove(); node.parent = this } this.childNodes.unshift(node) } }
  replaceChildren(...nodes) { for (const node of this.children) node.parent = null; this.childNodes = []; this.append(...nodes) }
  remove() { if (this.parent) { this.parent.childNodes = this.parent.childNodes.filter(node => node !== this); this.parent = null } }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  querySelector(selector) { assert(selector.startsWith('.'), `Unsupported DOM selector: ${selector}`); for (const child of this.children) { if (child.className.split(' ').includes(selector.slice(1))) return child; const found = child.querySelector(selector); if (found) return found } return null }
  click() { this.onclick?.({ target: this, preventDefault() {} }) }
}
const document = { createElement: tag => new Element(tag) }
const transport = { createPlateStream(preview, full, options) {
  const material = new Three.MeshBasicNodeMaterial()
  const stream = { preview, full, options, material, ready: Promise.resolve(), disposals: 0,
    available() { return this.disposals === 0 }, update() {}, high: async () => {},
    pending: () => 0, textureMB: () => 0, allocation: () => ({ previewMB: 1, fullMB: 1 }),
    residency: () => ({ preview: true, full: false, blending: false }), error: () => null,
    dispose() { if (!this.disposals) { this.disposals++; material.dispose() } } }
  streams.push(stream); return stream
} }
function load(name) {
  const path = resolve(root, name)
  if (path === resolve(pictureDir, 'stream.ts')) return transport
  if (modules.has(path)) return modules.get(path)
  const exports = {}; modules.set(path, exports)
  const require = specifier => {
    if (specifier === 'three' || specifier === 'three/webgpu') return Three
    if (specifier === 'three/tsl') return TSL
    assert(specifier.startsWith('.'), `Unexpected runtime dependency: ${specifier}`)
    if (specifier.endsWith('?raw')) return { default: read(resolve(dirname(path), specifier.slice(0, -4))) }
    const dependency = resolve(dirname(path), specifier)
    if (dependency === pictureDir) return load(resolve(pictureDir, 'index.ts'))
    return load(extname(dependency) ? dependency : `${dependency}.ts`)
  }
  viewportSetters.push(vm.runInThisContext(`(function(exports, require, document, innerWidth, innerHeight) { ${compile(read(path))}\nreturn (width, height) => { innerWidth = width; innerHeight = height }\n})`, { filename: relative(root, path) })(exports, require, document, 1512, 950))
  return exports
}
const pictures = load(resolve(pictureDir, 'index.ts'))
const registration = load(resolve(pictureDir, 'registration.ts'))
const { createReadingRuler } = load('src/wings/vinci/pictures/bench/reading-ruler.ts')
const rawManifest = JSON.parse(read('public/na-manifest.json')).assets
const manifest = { all: rawManifest, byId: new Map(rawManifest.map(entry => [entry.id, entry])) }
const lockedBefore = JSON.stringify(pictures.REGISTER)
const sharedTexture = new Three.Texture()
let sharedDisposals = 0
sharedTexture.addEventListener('dispose', () => sharedDisposals++)
const material = () => { const m = new Three.MeshStandardNodeMaterial(); m.map = sharedTexture; m.colorNode = TSL.vec3(1); m.roughnessNode = TSL.float(.5); return m }
const set = { albedo: new Three.Color('#b8ac92'), roughness: .7, metalness: 0, material }
const stack = { materials: { sync: () => set }, tierName: () => 'standard',
  detail(m) { m.colorNode ??= TSL.vec3(m.color.r, m.color.g, m.color.b); m.roughnessNode ??= TSL.float(m.roughness) },
  cost: () => ({ textureMB: 0, budget: { textureMB: 256 } }) }
const test = (name, action) => { try { action(); results.push({ name, ok: true }) } catch (error) { results.push({ name, ok: false, error: error.stack ?? error.message }) } }
const close = (actual, expected, why, epsilon = 1e-5) => assert(Number.isFinite(actual) && Math.abs(actual - expected) <= epsilon, `${why}: ${actual} versus ${expected}`)
const visible = object => { for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return false; return true }
const hang = pictures.buildHang(stack, pictures.REGISTER, manifest)
await Promise.resolve()
hang.wall.updateMatrixWorld(true)
const measured = hang.frames.filter(frame => frame.aperture)
const physical = hang.wall.getObjectByName('vinci/pictures/physical-frames')
const contact = hang.wall.getObjectByName('vinci/pictures/directional-frame-contact')

test('Original unit law retains all exact object dimensions and assigned datums', () => {
  assert.equal(pictures.REGISTER.length, 30); assert.equal(measured.length, 28)
  for (const work of pictures.REGISTER) {
    const size = pictures.trueScale(work)
    if (work.height_cm === null) { assert.equal(size, null); continue }
    assert.equal(size.widthM, work.width_cm / 100); assert.equal(size.heightM, work.height_cm / 100)
    assert.equal(size.datumM, work.hang.eye_height_cm === null ? null : work.hang.eye_height_cm / 100)
  }
  for (const [id, width, height] of [['annunciation-predella', .60, .16], ['ginevra-de-benci', .37, .381], ['mona-lisa', .534, .794], ['virgin-and-child-with-st-anne', 1.13, 1.68], ['last-supper', 8.8, 4.6]]) {
    const frame = measured.find(frame => frame.work.id === id)
    close(frame.aperture.geometry.parameters.width, width, `${id}: width`)
    close(frame.aperture.geometry.parameters.height, height, `${id}: height`)
  }
})
test('Actual buildHang fields use metres, with fixed physical backing and moulding widths', () => {
  for (const frame of measured) {
    const { work, aperture } = frame
    aperture.geometry.computeBoundingBox()
    const size = aperture.geometry.boundingBox.getSize(new Three.Vector3())
    close(size.x, work.width_cm / 100, `${work.id}: actual width buffer`)
    close(size.y, work.height_cm / 100, `${work.id}: actual height buffer`)
    assert.deepEqual(aperture.scale.toArray(), [1, 1, 1])
    if (work.hang.eye_height_cm !== null) close(aperture.getWorldPosition(new Three.Vector3()).y, work.hang.eye_height_cm / 100, `${work.id}: datum`)
    const backing = hang.wall.getObjectByName(`physical-backing/${work.id}`)
    close(backing.geometry.parameters.depth, .016, `${work.id}: backing thickness`)
    const mount = physical.userData.apertures.find(item => item.id === work.id)
    // The mount is cut to the work it surrounds, so the expected margin is
    // that work's own board and never one constant for the whole room.
    const board = pictures.pictureMatBorderM(size.x, size.y)
    close(mount.width - size.x, 2 * board, `${work.id}: side mat margins`)
    close(mount.height - size.y, 2 * board, `${work.id}: vertical mat margins`)
  }
  close(physical.userData.profile.width_m, .052, '52 mm world moulding')
  close(physical.userData.profile.depth_m, .045, '45 mm body depth')
})
test('Unknown painted extent and the Wilton catalogue figure never become measured apertures', () => {
  const sala = hang.frames.find(frame => frame.work.id === 'sala-delle-asse')
  const wilton = hang.frames.find(frame => frame.work.id === 'leda-wilton')
  assert.equal(sala.aperture, null); assert.equal(pictures.trueScale(sala.work), null)
  // The 14 September 2026 reclassification supplied the 1907 photogravure, so
  // the catalogue card now carries a reproduction. Its 96.52 by 73.66 cm stays
  // a quoted catalogue figure: no measured aperture is created from it.
  assert.equal(wilton.aperture, null); assert.equal(wilton.cards.length, 1)
  assert(!physical.userData.apertures.some(item => item.id === 'leda-wilton'))
  const documentMount = hang.wall.getObjectByName('unmeasured-document-mount/sala-delle-asse')
  assert.equal(documentMount.userData.physicalPaintingExtent, null)
})

const benchSource = read('src/wings/vinci/pictures/bench/index.ts')
const tree = ts.createSourceFile('src/wings/vinci/pictures/bench/index.ts', benchSource, ts.ScriptTarget.ES2022, true)
let composeDeclaration, faceHandler, printHandler, updateMethod
function inspect(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'compose') { assert(!composeDeclaration); composeDeclaration = node }
  if (ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression)
    && node.expression.left.getText(tree) === 'faceControl.onclick') { assert(!faceHandler); faceHandler = node }
  if (ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression)
    && node.expression.left.getText(tree) === 'print.onclick') { assert(!printHandler); printHandler = node }
  if (ts.isMethodDeclaration(node) && node.name.getText(tree) === 'update'
    && ts.isVariableDeclaration(node.parent.parent) && node.parent.parent.name.getText(tree) === 'api') { assert(!updateMethod); updateMethod = node }
  ts.forEachChild(node, inspect)
}
inspect(tree)
assert(composeDeclaration, 'Actual compose() declaration missing')
assert(faceHandler, 'Actual reverse-face control handler missing')
assert(printHandler, 'Actual historical-print control handler missing')
assert(updateMethod, 'Actual bench update method missing')
const printer = ts.createPrinter()
const composeJS = compile(printer.printNode(ts.EmitHint.Unspecified, composeDeclaration, tree))
const faceJS = compile(printer.printNode(ts.EmitHint.Unspecified, faceHandler, tree))
const printJS = compile(printer.printNode(ts.EmitHint.Unspecified, printHandler, tree))
const updateJS = compile(`const benchUpdate = { ${printer.printNode(ts.EmitHint.Unspecified, updateMethod, tree)} }; function updateBench() { benchUpdate.update(1 / 60) }`)
function compose(frame, viewport, options = {}) {
  for (const setViewport of viewportSetters) setViewport(viewport.width, viewport.height)
  const camera = new Three.PerspectiveCamera(40, viewport.width / viewport.height, .03, 200)
  const segmentId = options.segmentId ?? 'complete-hang'
  const header = new Element('header'), segmentName = new Element('span'), audit = new Element('div')
  segmentName.className = 'picture-segment-name'; header.append(segmentName); audit.hidden = true
  const callbacks = []
  const context = vm.createContext({ innerWidth: viewport.width, innerHeight: viewport.height,
    camera, selected: frame, hang, segment: pictures.getSegment(segmentId), segmentId, Vector3: Three.Vector3,
    completeHang: segmentId === 'complete-hang', special: ['drawer', 'murals', 'complete-hang', 'materials'].includes(segmentId),
    materialPair: null, materialKind: null, view: Object.hasOwn(options, 'view') ? options.view : 'compare', reverseFace: false,
    signaturePrint: segmentId === 'signature' && options.view === 'print', labelLanguage: 'en', publishView() {},
    readingRuler: createReadingRuler(),
    faceControl: new Element('button'), inspect: new Element('button'), datum: new Element('button'), host: new Element('section'), single: false,
    element: pictures.element, header, print: new Element('button'), callbacks,
    label: () => callbacks.push('label'), sourcesOpen: value => callbacks.push(`sourcesOpen:${value}`),
    updates: 0, stack, dock: new Element('aside'), scrollHint: new Element('span'), workshopNote: new Element('aside'), repeatNote: new Element('aside'), audit, auditView: false, mode: 2, performance,
    // The room's own chrome (its painted name, the seat of the viewing
    // controls) is DOM placement, not geometry: stubbed here on purpose.
    seatControls() {}, placeWallTitle() {}, currentLanguageRow: null,
    getComputedStyle: () => ({ bottom: '91px' }),
  })
  vm.runInContext(`${composeJS}\n${faceJS}\n${printJS}\n${updateJS}\ncompose()`, context, { timeout: 2000 })
  hang.wall.updateMatrixWorld(true)
  return context
}
const measure = (frame, camera, viewport, mesh = frame.aperture) => pictures.measureProjectedWork(frame.work, camera, mesh.geometry, mesh.matrixWorld, viewport)
function commonScale(values, property, why) {
  assert(values.length > 1)
  const expected = values[0][property]
  for (const value of values) close(value[property], expected, `${why}: ${value.work}`, 1e-5)
}
const viewports = [{ width: 1512, height: 950 }, { width: 390, height: 844 }, { width: 844, height: 390 }]
test('Explicit comparison camera gives all 28 real module apertures one common px/cm per viewport', () => {
  for (const viewport of viewports) {
    const current = []
    for (const frame of measured) {
      const { camera } = compose(frame, viewport)
      const field = measure(frame, camera, viewport)
      assert(field.passes, `${frame.work.id}: actual physical field failed`)
      const fieldCenter = frame.aperture.getWorldPosition(new Three.Vector3())
      const independent = viewport.height / (2 * Math.tan(camera.fov * Math.PI / 360) * (camera.position.z - fieldCenter.z) * 100)
      close(field.pxPerCmX, independent, `${frame.work.id}: horizontal pinhole proof`)
      close(field.pxPerCmY, independent, `${frame.work.id}: vertical pinhole proof`)
      const sources = frame.cards.map(card => {
        const geometry = card.mesh.geometry, envelope = measure(frame, camera, viewport, card.mesh)
        const window = registration.pictureDisplayWindow(card.entry.plate)
        const uv = window ? registration.pictureDisplayUV(window) : null
        const sourceAspect = uv?.contentAspect ?? card.entry.pixels.width / card.entry.pixels.height
        close(geometry.parameters.width / geometry.parameters.height, sourceAspect, `${card.entry.id}: source proportions`, 1e-10)
        assert(geometry.parameters.width <= frame.width + 1e-10 && geometry.parameters.height <= frame.height + 1e-10)
        close(Math.max(geometry.parameters.width / frame.width, geometry.parameters.height / frame.height), 1, `${card.entry.id}: source meets one field edge`)
        const opticalX = envelope.widthPx / (geometry.parameters.width * 100)
        const opticalY = envelope.heightPx / (geometry.parameters.height * 100)
        close(opticalX, opticalY, `${card.entry.id}: uniform source-plane optical scale`)
        assert(Math.abs(opticalY / independent - 1) < .001, `${card.entry.id}: source seating changes optical scale by over 0.1 percent`)
        if (window) assert.equal(window.physicalRegistration, false)
        return { id: card.entry.plate.id, face: card.entry.face, sourceAspect,
          envelopeWidthCm: geometry.parameters.width * 100, envelopeHeightCm: geometry.parameters.height * 100,
          widthPx: envelope.widthPx, heightPx: envelope.heightPx,
          opticalPxPerOwnWorldCmX: opticalX, opticalPxPerOwnWorldCmY: opticalY,
          envelopeVersusPhysicalFieldErrorPercent: envelope.maxErrorPercent,
          envelopeCoincidesWithFieldWithinOnePercent: envelope.maxErrorPercent < 1,
          authenticatedPhysicalBoundary: false }
      })
      current.push({ work: frame.work.id, viewport: `${viewport.width}x${viewport.height}`,
        widthCm: frame.work.width_cm, heightCm: frame.work.height_cm,
        physicalFieldWidthPx: field.widthPx, physicalFieldHeightPx: field.heightPx,
        fieldPxPerCmX: field.pxPerCmX, fieldPxPerCmY: field.pxPerCmY,
        independentPxPerCm: independent, datumErrorCm: field.datumErrorCm,
        physicalFieldPass: field.passes, entireFieldInViewport: field.visible, sources })
    }
    commonScale(current, 'fieldPxPerCmX', 'Common horizontal field scale')
    commonScale(current, 'fieldPxPerCmY', 'Common vertical field scale')
    commonScale(current.flatMap(row => row.sources.map(source => ({ work: source.id, ...source }))), 'opticalPxPerOwnWorldCmY', 'Common source-plane scale')
    rows.push(...current)
  }
})
test('The judged 48.3 cm and 199.5 cm physical fields preserve their real height ratio', () => {
  for (const viewport of viewports) {
    const match = rows.filter(row => row.viewport === `${viewport.width}x${viewport.height}`)
    const small = match.find(row => row.heightCm === 48.3), large = match.find(row => row.heightCm === 199.5)
    assert(small && large)
    close(large.physicalFieldHeightPx / small.physicalFieldHeightPx, 199.5 / 48.3, '199.5/48.3 physical ratio')
  }
})
test('Actual named routes preserve each field while the mural camera exception is reported separately', () => {
  for (const viewport of viewports.slice(0, 2)) {
    const ordinary = []
    for (const segment of pictures.SEGMENTS.filter(segment => segment.id !== 'materials')) {
      for (const id of segment.workIds) {
        const frame = measured.find(frame => frame.work.id === id)
        if (!frame) continue
        const { camera } = compose(frame, viewport, { segmentId: segment.id })
        const field = measure(frame, camera, viewport)
        assert(field.passes, `${segment.id}/${id}: route changed physical dimensions`)
        const row = { work: id, segment: segment.id, viewport: `${viewport.width}x${viewport.height}`,
          fieldPxPerCm: field.pxPerCmY, fieldPass: field.passes,
          architecturalCamera: segment.kind === 'murals', entireFieldInViewport: field.visible }
        routes.push(row)
        if (!row.architecturalCamera) ordinary.push(row)
      }
    }
    commonScale(ordinary, 'fieldPxPerCm', 'Named non-mural compare routes')
  }
})

const ginevra = hang.frames.find(frame => frame.work.id === 'ginevra-de-benci')
const obverse = ginevra.cards.find(card => card.entry.face === 'front')
const reverse = ginevra.cards.find(card => card.entry.face === 'reverse')
const reverseField = hang.wall.getObjectByName('measured-reverse-aperture/ginevra-de-benci')
const obverseBacking = hang.wall.getObjectByName('physical-backing/ginevra-de-benci')
const reverseBacking = hang.wall.getObjectByName('physical-backing/ginevra-de-benci/reverse')
const retained = [ginevra.aperture, reverseField, obverseBacking, reverseBacking, obverse.mesh, reverse.mesh]
const signature = mesh => ({ object: mesh.uuid, geometry: mesh.geometry.uuid, parent: mesh.parent?.uuid,
  position: mesh.position.toArray(), rotation: mesh.quaternion.toArray(), scale: mesh.scale.toArray(),
  vertices: sha(Buffer.from(mesh.geometry.getAttribute('position').array.buffer)),
  uv: mesh.geometry.getAttribute('uv') ? sha(Buffer.from(mesh.geometry.getAttribute('uv').array.buffer)) : null,
  manifestId: mesh.userData.manifestId })
const retainedBefore = JSON.stringify(retained.map(signature))
function checkFace(isReverse) {
  const expectedId = isReverse ? 'ginevra-de-benci:reverse' : 'ginevra-de-benci'
  assert.deepEqual(Array.from(physical.userData.visibleIds), [expectedId])
  assert.deepEqual(Array.from(contact.userData.receiverRanges, item => item.id), [expectedId])
  assert.equal(visible(ginevra.aperture), !isReverse)
  assert.equal(visible(obverse.mesh), !isReverse); assert.equal(visible(obverseBacking), !isReverse)
  assert.equal(visible(reverse.mesh), isReverse); assert.equal(visible(reverseField), isReverse); assert.equal(visible(reverseBacking), isReverse)
  assert.equal(JSON.stringify(retained.map(signature)), retainedBefore, 'Face selection changed geometry, placement, parent or source ownership')
  assert.equal(hang.frames.filter(frame => frame.work.id === ginevra.work.id).length, 1)
}
function checkAnchor(frame, state, viewport, localX) {
  const edge = new Three.Vector3(localX, frame.y - frame.height / 2 - frame.matBorder - .052, .021)
    .applyMatrix4(hang.wall.matrixWorld).project(state.camera)
  const x = (edge.x + 1) * viewport.width / 2, y = (1 - edge.y) * viewport.height / 2 + 10
  close(Number.parseFloat(frame.dot.style.left), x, `${frame.work.id}: anchor centred beneath active field`)
  close(Number.parseFloat(frame.dot.style.top) + 22, y, `${frame.work.id}: 44 px target centre beneath bottom rail`)
  assert.equal(frame.dot.hidden, false)
  assert.equal(frame.dot.getAttribute('aria-pressed'), 'true')
  const shown = hang.frames.filter(candidate => !candidate.dot.hidden)
  assert.deepEqual(shown.map(candidate => candidate.work.id), [frame.work.id])
  return { x, y, visibleWorkMarks: shown.length, selected: true }
}
test('Actual phone face control switches independent front/reverse mounts without moving or reallocating source geometry', () => {
  const state = compose(ginevra, viewports[1], { segmentId: 'early', view: 'reading' })
  assert.equal(state.faceControl.hidden, false)
  checkFace(false); state.updateBench(); checkAnchor(ginevra, state, viewports[1], ginevra.x)
  for (let i = 0; i < 6; i++) {
    state.faceControl.click()
    const isReverse = i % 2 === 0
    hang.wall.updateMatrixWorld(true); checkFace(isReverse)
    const active = isReverse ? reverseField : ginevra.aperture
    const measuredFace = measure(ginevra, state.camera, viewports[1], active)
    assert(measuredFace.passes)
    state.updateBench()
    const anchor = checkAnchor(ginevra, state, viewports[1], isReverse ? reverse.mesh.position.x : ginevra.x)
    faceRows.push({ click: i + 1, face: isReverse ? 'reverse' : 'front',
      mount: physical.userData.visibleIds[0], contactOwner: contact.userData.receiverRanges[0].id,
      fieldWidthCm: measuredFace.worldWidthM * 100, fieldHeightCm: measuredFace.worldHeightM * 100,
      geometryOwnershipPreserved: true, workCount: 1, anchor })
  }
  const correctLeft = ginevra.dot.style.left
  ginevra.dot.style.left = `${Number.parseFloat(correctLeft) + 10}px`
  assert.throws(() => checkAnchor(ginevra, state, viewports[1], ginevra.x))
  ginevra.dot.style.left = correctLeft
  negatives.push({ fault: 'Work mark displaced ten pixels from the active face centre', correctlyRejected: true })
  hang.setVisible([ginevra.work.id])
  assert.equal(physical.userData.visibleFrameCount, 2)
  assert(visible(obverse.mesh) && visible(reverse.mesh))
  const neighbour = hang.frames.find(frame => frame.work.id === 'madonna-of-the-carnation')
  hang.setVisible([neighbour.work.id])
  assert(!visible(obverse.mesh) && !visible(reverse.mesh))
  assert.deepEqual(Array.from(contact.userData.receiverRanges, item => item.id), [neighbour.work.id])
  hang.setVisible([ginevra.work.id], true, { workId: ginevra.work.id, reverse: true })
  assert.equal(physical.children.length, 0); assert.equal(contact.children.length, 0)
  assert(visible(reverse.mesh) && !visible(obverse.mesh)); assert(!visible(reverseField))
})
test('Signature absence retains its measured field, furniture and frame, then the actual print control restores only the plate', () => {
  const frame = measured.find(frame => frame.work.id === 'mona-lisa')
  const owned = [frame.aperture, ...frame.furniture.children.filter(child => child.geometry), ...frame.cards.map(card => card.mesh)]
  const unchanged = JSON.stringify(owned.map(signature)), initialStreamCount = streams.length
  const checkAbsent = () => {
    assert(visible(frame.aperture), 'Absent field disappeared')
    assert(visible(frame.furniture) && frame.furniture.children.every(visible), 'Absent furniture disappeared')
    assert(frame.cards.every(card => !visible(card.mesh) && card.mesh.userData.selectedVisible === false), 'Absent plate is still displayed or can return on readiness')
    assert.deepEqual(Array.from(physical.userData.visibleIds), [frame.work.id])
    assert.deepEqual(Array.from(contact.userData.receiverRanges, item => item.id), [frame.work.id])
    // The empty field is an exhibit: the state word, the measured size and
    // the holder, on a grey mark that claims nothing.
    assert.equal(frame.caption.hidden, false)
    assert.equal(frame.caption.textContent, `Absent79.4 × 53.4 cm${frame.work.holder}`)
    assert.equal(frame.dot.style['--certainty'], '#777e7b')
    assert.equal(frame.dot.dataset.naAnchorClass, 'GENERATED')
    assert.equal(frame.dot.dataset.naAnchor, 'vinci/pictures/mats')
    assert.match(frame.dot.getAttribute('aria-label'), /^Not shown\. Mona Lisa\./)
    assert.equal(JSON.stringify(owned.map(signature)), unchanged)
  }
  for (const viewport of viewports.slice(0, 2)) {
    const state = compose(frame, viewport, { segmentId: 'signature', view: undefined })
    state.updateBench(); checkAbsent()
    const anchor = checkAnchor(frame, state, viewport, frame.x)
    const absentField = measure(frame, state.camera, viewport)
    assert(absentField.passes)
    state.print.click(); hang.wall.updateMatrixWorld(true); state.updateBench()
    assert.equal(state.view, 'print'); assert.deepEqual(state.callbacks, ['sourcesOpen:false', 'label'])
    assert(frame.cards.every(card => visible(card.mesh) && card.mesh.userData.selectedVisible === true))
    assert(visible(frame.aperture) && visible(frame.furniture))
    assert.deepEqual(Array.from(physical.userData.visibleIds), [frame.work.id])
    assert.equal(frame.caption.hidden, true)
    assert.equal(frame.dot.style['--certainty'], '#b18b47')
    assert.equal(frame.dot.dataset.naAnchor, frame.cards[0].entry.plate.id)
    assert.equal(frame.dot.getAttribute('aria-label'), 'Historical print. Publication date uncertain.')
    assert.equal(JSON.stringify(owned.map(signature)), unchanged)
    const printField = measure(frame, state.camera, viewport)
    close(printField.heightPx, absentField.heightPx, 'Print selection preserves signature camera scale')
    state.view = 'compare'; state.compose(); state.updateBench()
    assert(frame.cards.every(card => visible(card.mesh)), 'Compare must retain an intentionally selected print')
    state.signaturePrint = false; state.view = undefined; state.compose(); state.updateBench(); checkAbsent()
    signatureRows.push({ viewport: `${viewport.width}x${viewport.height}`, absentFieldVisible: true,
      absentFurnitureAndFrameVisible: true, absentPlateVisible: false, absentCaptionVisible: true,
      actualPrintHandlerRestoresPlate: true, compareRetainsSelectedPrint: true, clearPrintSelectionHidesPlate: true,
      fieldHeightPercentOfViewport: absentField.heightPx / viewport.height * 100,
      physicalFieldPass: absentField.passes, sourceAndFieldOwnershipPreserved: true, anchor })
  }
  const source = frame.cards[0]
  source.mesh.visible = true
  assert.throws(checkAbsent)
  source.mesh.visible = false; checkAbsent()
  assert.equal(streams.length, initialStreamCount)
  negatives.push({ fault: 'A signature source remains visible during absence', correctlyRejected: true })
})
test('Actual moulding buffers keep 52 mm world width through comparison, reading and moulding-study camera poses', () => {
  const frame = measured.find(frame => frame.work.id === 'mona-lisa')
  const mount = physical.userData.apertures.find(item => item.id === frame.work.id)
  const frameSignature = JSON.stringify(signature(frame.aperture))
  for (const viewport of viewports.slice(0, 2)) {
    const current = []
    for (const view of ['compare', 'reading', 'moulding']) {
      const state = compose(frame, viewport, { segmentId: 'signature', view })
      const bounds = new Three.Box3().setFromObject(physical), centre = frame.aperture.getWorldPosition(new Three.Vector3())
      const widths = { left: centre.x - mount.width / 2 - bounds.min.x, right: bounds.max.x - centre.x - mount.width / 2,
        bottom: centre.y - mount.height / 2 - bounds.min.y, top: bounds.max.y - centre.y - mount.height / 2 }
      for (const [side, width] of Object.entries(widths)) close(width, .052, `${view}: ${side} physical moulding width`, 1e-5)
      close(bounds.max.z - bounds.min.z, .045, `${view}: actual moulding depth`)
      assert.equal(JSON.stringify(signature(frame.aperture)), frameSignature)
      const field = measure(frame, state.camera, viewport)
      assert(field.passes)
      const row = { viewport: `${viewport.width}x${viewport.height}`, view, widthsM: widths,
        bodyDepthM: bounds.max.z - bounds.min.z, cameraPosition: state.camera.position.toArray(),
        fieldPxPerCm: field.pxPerCmY, physicalFieldPass: field.passes }
      current.push(row); mouldingRows.push(row)
    }
    assert(Math.max(...current.map(row => row.fieldPxPerCm)) / Math.min(...current.map(row => row.fieldPxPerCm)) > 3.5, 'Camera poses do not exercise the commissioned 3.5x scale change')
  }
  physical.scale.x = 1.02; physical.updateMatrixWorld(true)
  const changed = new Three.Box3().setFromObject(physical)
  assert.throws(() => close((changed.max.x - changed.min.x - mount.width) / 2, .052, 'Stretched moulding'))
  physical.scale.x = 1; physical.updateMatrixWorld(true)
  negatives.push({ fault: 'Physical frame batch stretched by two percent', correctlyRejected: true })
})
test('Negative controls reject invalid centimetres, stretched fields, datum drift, oblique views and a private camera scale', () => {
  const frame = measured.find(frame => frame.work.id === 'mona-lisa'), viewport = viewports[1]
  for (const change of [{ width_cm: 0 }, { height_cm: -1 }, { width_cm: Infinity }, { height_cm: NaN }]) assert.throws(() => pictures.trueScale({ ...frame.work, ...change }))
  const { camera } = compose(frame, viewport)
  const original = frame.aperture.matrixWorld.clone()
  for (const [fault, matrix] of [
    ['field stretched 2 percent', original.clone().multiply(new Three.Matrix4().makeScale(1.02, 1, 1))],
    ['field raised 1 cm', new Three.Matrix4().makeTranslation(0, .01, 0).multiply(original)],
    ['field turned off the camera plane', original.clone().multiply(new Three.Matrix4().makeRotationY(.10))],
  ]) {
    const actual = pictures.measureProjectedWork(frame.work, camera, frame.aperture.geometry, matrix, viewport)
    assert.equal(actual.passes, false, fault); negatives.push({ fault, correctlyRejected: true, errorPercent: actual.maxErrorPercent })
  }
  const before = measure(frame, camera, viewport)
  const z = frame.aperture.getWorldPosition(new Three.Vector3()).z
  camera.position.z = z + (camera.position.z - z) / 2; camera.updateMatrixWorld(true)
  const after = measure(frame, camera, viewport)
  assert(after.passes, 'Private camera changes presentation, not physical construction')
  assert.throws(() => commonScale([{ work: frame.work.id, value: before.pxPerCmY }, { work: 'private-camera', value: after.pxPerCmY }], 'value', 'Private camera'))
  negatives.push({ fault: 'One selected work has half the camera distance', physicalFieldStillPasses: true, commonScaleCorrectlyRejects: true })
  const source = frame.cards[0], envelopeBefore = measure(frame, camera, viewport, source.mesh)
  const shrunkMatrix = source.mesh.matrixWorld.clone().multiply(new Three.Matrix4().makeScale(.6, .6, 1))
  const shrunk = pictures.measureProjectedWork(frame.work, camera, source.mesh.geometry, shrunkMatrix, viewport)
  close(shrunk.widthPx / envelopeBefore.widthPx, .6, 'Source-only shrink visibility')
  assert(shrunk.maxErrorPercent > 39)
  negatives.push({ fault: 'Source envelope shrunk to 60 percent while field stays fixed', sourceShrinkDetected: true, fieldStillPasses: measure(frame, camera, viewport).passes })
})
test('Negative ownership control detects assigning the reverse image to the front mount', () => {
  hang.setVisible([ginevra.work.id], false, { workId: ginevra.work.id, reverse: true })
  checkFace(true)
  const original = reverse.mesh.position.clone()
  reverse.mesh.position.copy(obverse.mesh.position)
  assert.throws(() => checkFace(true))
  reverse.mesh.position.copy(original); checkFace(true)
  negatives.push({ fault: 'Reverse source moved into obverse slot', correctlyRejected: true })
})
test('Hang disposal releases both Ginevra streams once and leaves shared library ownership intact', () => {
  hang.dispose(); hang.dispose()
  assert(streams.every(stream => stream.disposals === 1)); assert.equal(sharedDisposals, 0)
  assert.equal(JSON.stringify(pictures.REGISTER), lockedBefore)
})

const report = { kind: 'window-3-actual-hang-geometry', browser: false, network: false, replacesEyes: false,
  ok: results.every(result => result.ok), passed: results.filter(result => result.ok).length, total: results.length,
  sourceHashes, measuredWorks: measured.length, comparisonRows: rows.length, rows, namedRouteRows: routes,
  faceRows, signatureRows, mouldingRows, negatives, results,
  judgment: {
    physicalField: 'Each measured aperture is the centimetre-defined object extent. The actual geometry and its projected pixel scale are independently verified.',
    sourceEnvelope: 'A source image or declared display crop is proportionally contained inside the physical field. Its rectangular envelope can differ from that field without changing the camera scale or stretching the pixels.',
    previousWording: 'The earlier phrase reproductions fail scale conflated the source-envelope/field mismatch with the physical-size law. Envelope mismatch is reported here as a separate registration question, not a failure of the measured field.',
    registration: 'Source windows explicitly say physicalRegistration:false. No source photograph or printed illustration boundary is authenticated as the measured historical object by this check.',
  },
  limitations: [
    'The 28-work comparison assembles all current measured works through the public module contract, then runs the real complete-hang comparison camera. The shipped complete-hang route contains 25 selected records, not this union fixture.',
    'Named-route results are measured separately. The mural route can increase camera distance to fit its architectural extent and is explicitly excluded from the ordinary panel common-scale claim.',
    'A measured field can pass the physical scale law while lying outside the viewport. entireFieldInViewport is reported independently and is not a phone composition pass.',
    'Face selection preserves image/aperture/backing geometry and parent ownership. The production moulding/contact builders may rebuild their visible batches from the same immutable mount records.',
    'The actual bench update method and DOM-coordinate assignments prove model projection and one mark per selected phone face. DOM style/layout, CSS target dimensions and browser event delivery remain outside this check.',
    'The actual print onclick runs with source-drawer and label callbacks recorded as doubles. Geometry, visibility, metadata and camera restoration are exercised through the real compose and setAbsent paths.',
    'Material inputs and image transport are doubles. No texture decoding, sampling, browser layout, lighting, GPU errors, image fidelity, rendered alignment or pointer/touch delivery is verified.',
    'Real current-tree EYES frames and __forge.hang() readings remain required. This test does not waive shared gates or prove the visual quality bar.',
  ],
}
const output = `${JSON.stringify(report, null, 2)}\n`
console.log(output)
if (!report.ok) process.exitCode = 1
