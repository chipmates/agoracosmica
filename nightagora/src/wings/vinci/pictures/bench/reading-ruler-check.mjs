#!/usr/bin/env node
/** Real ruler module and exact controller projection call, with real Three
 * cameras/geometry and a literal DOM double. No browser, network or GPU. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import * as Three from 'three/webgpu'

const root = fileURLToPath(new URL('../../../../../', import.meta.url)), sourceHashes = {}, results = [], rows = [], integrations = [], negatives = []
const sha = value => createHash('sha256').update(value).digest('hex')
function read(name) { const path = resolve(root, name); assert(!relative(root, path).startsWith('..')); const value = readFileSync(path, 'utf8'); sourceHashes[relative(root, path)] = sha(value); return value }
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
class Element {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.className = ''; this.childNodes = []; this.style = {}; this.dataset = {}; this.attributes = new Map(); this.hidden = false }
  get children() { return this.childNodes.filter(child => child instanceof Element) }
  set textContent(value) { this.childNodes = [String(value ?? '')] }
  get textContent() { return this.childNodes.map(child => child instanceof Element ? child.textContent : child).join('') }
  append(...children) { this.childNodes.push(...children) }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
}
const document = { createElement: tag => new Element(tag) }
const pictureSource = read('src/wings/vinci/pictures/index.ts')
const pictureTree = ts.createSourceFile('pictures/index.ts', pictureSource, ts.ScriptTarget.ES2022, true)
const elementDeclaration = pictureTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'element')
assert(elementDeclaration)
const printer = ts.createPrinter(), elementModule = {}
vm.runInNewContext(compile(printer.printNode(ts.EmitHint.Unspecified, elementDeclaration, pictureTree)), { exports: elementModule, document })
const rulerModule = {}, scaleModule = {}
vm.runInNewContext(compile(read('src/wings/vinci/pictures/bench/reading-ruler.ts')), { exports: rulerModule, require(name) { if (name === 'three/webgpu') return Three; assert.equal(name, '..'); return elementModule } })
vm.runInNewContext(compile(read('src/wings/vinci/pictures/scale.ts')), { exports: scaleModule, require(name) { assert.equal(name, 'three'); return Three } })
const works = JSON.parse(read('src/wings/vinci/pictures/data/paintings.json')).works.filter(work => work.height_cm !== null && work.display_mode !== 'unillustrated_catalogue_card')
/** The mount is cut to the work, so the ruler's fixture reads the production
 * rule out of the hang module rather than restating it. */
const matBorderSource = read('src/wings/vinci/pictures/index.ts')
const pictureMatBorderM = new Function(`${/export function pictureMatBorderM[\s\S]*?\n\}/.exec(matBorderSource)[0]
  .replace('export function', 'function').replace(/PICTURE_MAT_BORDER_M/g, '.045').replace(/: number/g, '')}
  return pictureMatBorderM`)()
const test = (name, run) => { try { run(); results.push({ name, ok: true }) } catch (error) { results.push({ name, ok: false, error: error.stack }) } }
const close = (actual, expected, message, tolerance = 1e-7) => assert(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: ${actual} versus ${expected}`)
const meshState = mesh => JSON.stringify({ vertices: Array.from(mesh.geometry.getAttribute('position').array), position: mesh.position.toArray(), rotation: mesh.quaternion.toArray(), scale: mesh.scale.toArray(), matrix: mesh.matrixWorld.toArray() })
const fieldPlaneDepths = []
function fieldDepth(node) { if (ts.isCallExpression(node) && node.expression.getText(pictureTree) === 'aperture.position.set') fieldPlaneDepths.push(Number(node.arguments[2].getText(pictureTree))); ts.forEachChild(node, fieldDepth) }
fieldDepth(pictureTree); assert.equal(fieldPlaneDepths.length, 1)
const fieldZ = fieldPlaneDepths[0]
function fixture(work, viewport, distance = 4, face = 'front') {
  const size = scaleModule.trueScale(work), parent = new Three.Group(), x = 2.7, reverseX = x + size.widthM + .34
  parent.position.set(19.4, 0, .17)
  const mesh = new Three.Mesh(new Three.PlaneGeometry(size.widthM, size.heightM), new Three.MeshBasicMaterial())
  mesh.position.set(face === 'reverse' ? reverseX : x, size.datumM ?? 1.55, fieldZ); parent.add(mesh); parent.updateMatrixWorld(true)
  const centre = mesh.getWorldPosition(new Three.Vector3())
  const camera = new Three.PerspectiveCamera(40, viewport.width / viewport.height, .03, 100)
  camera.position.set(centre.x, centre.y, centre.z + distance)
  camera.setViewOffset(viewport.width, viewport.height, 0, viewport.height * .1, viewport.width, viewport.height)
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true)
  const ruler = rulerModule.createReadingRuler()
  return { work, viewport, parent, mesh, centre, camera, ruler, x, reverseX, size }
}
function validate(f, ruler = f.ruler, placementWidth = f.size.widthM) {
  const { camera, mesh, viewport, work, centre } = f
  const cm = f.size.heightM > 1 ? 50 : 10
  const independent = viewport.height / (2 * Math.tan(camera.fov * Math.PI / 360) * (camera.position.z - centre.z) * 100)
  const length = Number.parseFloat(ruler.root.children[0].style.height)
  close(length / cm, independent, 'Ruler optical scale at the measured field plane')
  const measurement = scaleModule.measureProjectedWork(work, camera, mesh.geometry, mesh.matrixWorld, viewport)
  assert(measurement.passes)
  close(length / measurement.heightPx, cm / (measurement.worldHeightM * 100), 'Ruler-to-field physical proportion')
  assert.equal(ruler.root.children[1].textContent, `${cm} cm`)
  assert.equal(ruler.root.dataset.lengthCm, String(cm)); close(Number(ruler.root.dataset.projectedPx), length, 'Exposed ruler measurement')
  const edge = new Three.Vector3(centre.x + placementWidth / 2, centre.y, centre.z).project(camera)
  close(Number.parseFloat(ruler.root.style.left), Math.min(viewport.width - 38, (edge.x + 1) * viewport.width / 2 + 20), 'Ruler sits beside the active face')
  close(Number.parseFloat(ruler.root.style.top) + length / 2, (1 - edge.y) * viewport.height / 2, 'Ruler shares the field vertical centre')
  return { work: work.id, viewport: `${viewport.width}x${viewport.height}`, lengthCm: cm, projectedPx: length, pxPerCm: independent, fieldPxPerCm: measurement.pxPerCmY }
}
const viewports = [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 1512, height: 950 }]
test('Ten and fifty centimetre rulers share the real physical field optical scale for all 28 measured works', () => {
  assert.equal(works.length, 28)
  for (const work of works) for (const viewport of viewports) for (const distance of [2.5, 8]) {
    const f = fixture(work, viewport, distance), before = meshState(f.mesh)
    f.ruler.update(f.camera, { ...f.centre, width: f.size.widthM, height: f.size.heightM }, viewport)
    rows.push({ ...validate(f), distanceM: distance })
    assert.equal(meshState(f.mesh), before, 'Ruler changed artwork geometry or world scale')
    f.mesh.geometry.dispose(); f.mesh.material.dispose()
  }
})
test('The actual controller call uses the active front or reverse face and the measured field plane after resize', () => {
  const source = read('src/wings/vinci/pictures/bench/index.ts'), tree = ts.createSourceFile('bench/index.ts', source, ts.ScriptTarget.ES2022, true)
  let compose
  function find(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === 'compose') compose = node; ts.forEachChild(node, find) }
  find(tree); assert(compose)
  const statements = compose.body.statements.filter(node =>
    ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(tree) === 'faceX')
    || ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression) && node.expression.left.getText(tree) === 'readingRuler.root.hidden'
    || ts.isIfStatement(node) && node.expression.getText(tree) === '!readingRuler.root.hidden')
  assert.equal(statements.filter(node => ts.isIfStatement(node)).length, 1, 'Actual ruler projection call missing')
  const actualCall = compile(statements.map(node => printer.printNode(ts.EmitHint.Unspecified, node, tree)).join('\n'))
  const work = works.find(work => work.id === 'ginevra-de-benci')
  const sharedRuler = rulerModule.createReadingRuler()
  for (const face of ['front', 'reverse', 'front']) for (const viewport of viewports.slice(0, 2)) {
    const f = fixture(work, viewport, 4.4, face), before = meshState(f.mesh)
    const matBorder = pictureMatBorderM(f.size.widthM, f.size.heightM), surround = matBorder + .052
    const selected = { work, aperture: f.mesh, x: f.x, y: f.mesh.position.y, width: f.size.widthM, height: f.size.heightM, matBorder, surround,
      cards: [{ entry: { face: 'front' }, mesh: { position: { x: f.x } } }, { entry: { face: 'reverse' }, mesh: { position: { x: f.reverseX } } }] }
    vm.runInNewContext(actualCall, { camera: f.camera, Vector3: Three.Vector3, face: { reverse: face === 'reverse' }, selected,
      hang: { wall: f.parent }, readingRuler: sharedRuler, reading: true, inspecting: false, mobile: true, segmentId: 'early', view: 'reading', innerWidth: viewport.width, innerHeight: viewport.height })
    assert.equal(sharedRuler.root.hidden, false)
    integrations.push({ ...validate(f, sharedRuler, f.size.widthM + 2 * surround), face })
    assert.equal(meshState(f.mesh), before)
    f.mesh.geometry.dispose(); f.mesh.material.dispose()
  }
})
test('Ruler updates and CSS leave painting world dimensions unchanged', () => {
  const css = read('src/wings/vinci/pictures/bench/pictures.css')
  assert(!/(?:^|[;{])\s*(?:scale|zoom)\s*:|\bscale(?:[XYZ]|3d)?\s*\(/im.test(css), 'The owned picture stylesheet must not scale the artwork or its ruler')
  const styles = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(match => /picture-reading-rul(?:e|er)\b/.test(match[1]))
  assert(styles.length >= 2)
  for (const [, selector, body] of styles) assert(!/\b(?:transform|scale|zoom)\s*:/.test(body), `${selector} rescales the projected ruler`)
  assert(!styles.some(([, selector, body]) => /picture-reading-rule\b/.test(selector) && /(?:^|;)\s*(?:height|min-height|max-height)\s*:/.test(body)), 'CSS must not override the measured ruler length')
  const f = fixture(works.find(work => work.id === 'mona-lisa'), viewports[0]), before = meshState(f.mesh)
  for (let i = 0; i < 20; i++) f.ruler.update(f.camera, { ...f.centre, width: f.size.widthM, height: f.size.heightM }, f.viewport)
  assert.equal(meshState(f.mesh), before)
  assert.equal(f.ruler.root.attributes.get('aria-hidden'), 'true')
  f.mesh.geometry.dispose(); f.mesh.material.dispose()
})
test('Negative controls detect wrong depth, pixel-only rescaling and a ruler anchored to the other face', () => {
  const f = fixture(works.find(work => work.id === 'ginevra-de-benci'), viewports[0], 4.4, 'reverse')
  const field = { ...f.centre, width: f.size.widthM, height: f.size.heightM }
  f.ruler.update(f.camera, { ...field, z: field.z - .002 }, f.viewport)
  assert.throws(() => validate(f)); negatives.push('A ruler two millimetres behind the measured field')
  f.ruler.update(f.camera, field, f.viewport)
  f.ruler.root.children[0].style.height = `${Number.parseFloat(f.ruler.root.children[0].style.height) * 1.1}px`
  assert.throws(() => validate(f)); negatives.push('A ten percent CSS-pixel ruler stretch')
  f.ruler.update(f.camera, { ...field, x: f.x + f.parent.position.x }, f.viewport)
  assert.throws(() => validate(f)); negatives.push('A reverse-face ruler positioned beside the front face')
  f.ruler.update(f.camera, field, f.viewport); validate(f)
  f.mesh.geometry.dispose(); f.mesh.material.dispose()
})
const report = { kind: 'window-3-reading-ruler-check', browser: false, network: false, gpu: false,
  ok: results.every(result => result.ok), passed: results.filter(result => result.ok).length, total: results.length,
  sourceHashes, fieldPlaneZ: fieldZ, measuredWorks: works.length, rows, integrations, negatives, results,
  limitations: ['Real ruler module, actual element constructor and exact controller ruler call execute with real Three geometry/matrices. DOM layout is a double.', 'The controlled camera is parallel to the wall. This does not establish rendered CSS layout, clipping, visual contrast or browser legibility.', 'This isolated ruler check does not run broad controller lifecycle suites or EYES and does not edit runtime.'] }
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
