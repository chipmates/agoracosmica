#!/usr/bin/env node
/** Execute the actual bench compose declaration and production scale helpers.
 * This is a geometry/camera regression check, not rendered or EYES evidence.
 * Run: node src/wings/vinci/pictures/bench/scale-regression-check.mjs
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
  const resolved = path.resolve(root, relative)
  assert.ok(resolved.startsWith(root), `Read leaves this app: ${relative}`)
  const source = readFileSync(resolved, 'utf8')
  sourceHashes[relative] = createHash('sha256').update(source).digest('hex')
  return source
}
function compile(source, dependencies) {
  const exports = {}
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText
  vm.runInNewContext(output, { exports, require(specifier) {
    assert.ok(Object.hasOwn(dependencies, specifier), `Unexpected production import: ${specifier}`)
    return dependencies[specifier]
  } }, { timeout: 2000 })
  return exports
}
const rawRegister = read('src/wings/vinci/pictures/data/paintings.json')
const policy = compile(read('src/wings/vinci/pictures/policy.ts'), {})
const register = compile(read('src/wings/vinci/pictures/register.ts'), {
  './policy': policy,
  './data/paintings.json?raw': { default: rawRegister },
})
const scale = compile(read('src/wings/vinci/pictures/scale.ts'), { three: Three })
const hangSource = read('src/wings/vinci/pictures/index.ts')
const hangTree = ts.createSourceFile('pictures/index.ts', hangSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
function productionPlaneZ(variable, firstCoordinate = null) {
  const found = []
  function inspect(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'set'
      && ts.isPropertyAccessExpression(node.expression.expression)
      && node.expression.expression.name.text === 'position'
      && ts.isIdentifier(node.expression.expression.expression)
      && node.expression.expression.expression.text === variable
      && node.arguments.length === 3
      && (firstCoordinate === null || ts.isIdentifier(node.arguments[0]) && node.arguments[0].text === firstCoordinate)) {
      assert.ok(ts.isNumericLiteral(node.arguments[2]), `${variable}: declare the plane depth explicitly`)
      found.push(Number(node.arguments[2].text))
    }
    ts.forEachChild(node, inspect)
  }
  inspect(hangTree)
  assert.equal(found.length, 1, `${variable}: identify exactly one production plane placement`)
  return found[0]
}
const fieldZ = productionPlaneZ('aperture')
const plateZ = productionPlaneZ('mesh', 'cardX')
const benchSource = read('src/wings/vinci/pictures/bench/index.ts')
const tree = ts.createSourceFile('bench/index.ts', benchSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
const declarations = []
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'compose') declarations.push(node)
  ts.forEachChild(node, visit)
}
visit(tree)
assert.equal(declarations.length, 1, 'Production compose must have exactly one declaration')
const exactCompose = ts.createPrinter().printNode(ts.EmitHint.Unspecified, declarations[0], tree)
const composed = ts.transpileModule(exactCompose, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText
const plainElement = () => ({ dataset: {}, textContent: '', setAttribute() {} })
const close = (actual, expected, why, tolerance = 1e-6) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
  `${why}: ${actual} differs from ${expected}`,
)

function frameFor(work, x = 0) {
  const s = scale.trueScale(work)
  assert.ok(s, `${work.id}: fixture requires measured dimensions`)
  const aperture = new Three.Mesh(new Three.PlaneGeometry(s.widthM, s.heightM))
  aperture.position.set(x, s.datumM ?? 1.55, fieldZ)
  // A matching-aspect sample isolates camera calibration from scan boundaries.
  const size = register.reproductionCardSize(work, { width: work.width_cm * 100, height: work.height_cm * 100 })
  const mesh = new Three.Mesh(new Three.PlaneGeometry(size.widthM, size.heightM))
  mesh.position.set(x, s.datumM ?? 1.55, plateZ)
  return { work, x, y: s.datumM ?? 1.55, width: s.widthM, height: s.heightM,
    left: x - s.widthM / 2, right: x + s.widthM / 2,
    aperture, cards: [{ mesh }],
  }
}

function productionCamera(work, viewport, translation = 0, segmentId = 'complete-hang') {
  const frame = frameFor(work, 2.7)
  const wall = new Three.Group()
  wall.position.x = translation
  wall.add(frame.aperture, frame.cards[0].mesh)
  wall.updateMatrixWorld(true)
  const camera = new Three.PerspectiveCamera(40, viewport.width / viewport.height, .03, 100)
  const context = vm.createContext({
    innerWidth: viewport.width, innerHeight: viewport.height, camera,
    selected: frame, hang: { frames: [frame], wall, extent: frame.right + .4, setVisible() {}, setAbsent() {}, documentOnlyIds: new Set() },
    signaturePrint: false, labelLanguage: 'en', element: (tag, className, text) => ({ tag, className, text }),
    segment: { kind: 'hang', workIds: [work.id] }, segmentId, completeHang: segmentId === 'complete-hang',
    special: false, materialPair: null, materialKind: null, view: 'compare', reverseFace: false,
    header: { querySelector: () => plainElement() },
    inspect: plainElement(), datum: plainElement(), host: plainElement(), faceControl: plainElement(), single: false,
    readingRuler: { root: plainElement(), update() {} }, Vector3: Three.Vector3,
  })
  vm.runInContext(`${composed}\ncompose()`, context, { timeout: 2000 })
  return { camera, frame, wall }
}

function reading(work, viewport, translation = 0) {
  const fixture = productionCamera(work, viewport, translation)
  const { camera, frame } = fixture
  const field = scale.measureProjectedWork(work, camera, frame.aperture.geometry, frame.aperture.matrixWorld, viewport)
  const plate = scale.measureProjectedWork(work, camera, frame.cards[0].mesh.geometry, frame.cards[0].mesh.matrixWorld, viewport)
  const depth = camera.position.z - fieldZ
  const independent = viewport.height / (2 * Math.tan(camera.fov * Math.PI / 360) * depth * 100)
  close(field.expectedPxPerCm, independent, `${work.id}: independent pinhole calibration`)
  close(field.pxPerCmX, independent, `${work.id}: field horizontal scale`)
  close(field.pxPerCmY, independent, `${work.id}: field vertical scale`)
  assert.ok(field.passes, `${work.id}: measured field rejected`)
  assert.ok(plate.passes, `${work.id}: matching-aspect plate rejected`)
  assert.ok(Math.abs(plate.pxPerCmY / field.pxPerCmY - 1) < .001,
    `${work.id}: 2 mm plate depth changed the common scale by more than 0.1%`)
  const projected = new Three.Vector3(frame.x + translation, frame.y, fieldZ).project(camera)
  close(projected.x, 0, `${work.id}: selection must centre the parent-translated field`)
  const result = { work: work.id, viewport: `${viewport.width}x${viewport.height}`,
    widthCm: work.width_cm, heightCm: work.height_cm,
    fieldWidthPx: field.widthPx, fieldHeightPx: field.heightPx,
    plateWidthPx: plate.widthPx, plateHeightPx: plate.heightPx,
    fieldPxPerCm: field.pxPerCmY, platePxPerCm: plate.pxPerCmY,
    independentPxPerCm: independent, datumErrorCm: field.datumErrorCm,
  }
  frame.aperture.geometry.dispose(); frame.cards[0].mesh.geometry.dispose()
  return result
}

const checks = [], measurements = [], negatives = []
const test = (name, run) => { run(); checks.push(name) }
function commonScale(records) {
  assert.ok(records.length > 1)
  const reference = records[0].fieldPxPerCm
  for (const row of records) close(row.fieldPxPerCm, reference, `${row.work}: selected work changed camera scale`)
}

test('Every main-hang panel shares the production camera calibration at each viewport', () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1512, height: 950 }, { width: 844, height: 390 }]) {
    const current = register.MAIN_HANG.map(work => reading(work, viewport))
    commonScale(current)
    measurements.push(...current)
  }
})

test('The judged 48.3 cm and 199.5 cm works preserve their physical height ratio', () => {
  const small = register.MAIN_HANG.find(work => work.height_cm === 48.3)
  const tall = register.MAIN_HANG.find(work => work.height_cm === 199.5)
  assert.ok(small && tall, 'The judged physical dimensions must remain in the locked register')
  for (const viewport of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
    const a = reading(small, viewport), b = reading(tall, viewport)
    close(b.plateHeightPx / a.plateHeightPx, tall.height_cm / small.height_cm,
      'A large painting must not be shrunk by selected-work framing')
  }
})

test('Translating the hang parent changes camera centring without changing its scale', () => {
  const work = register.getWork('mona-lisa'), viewport = { width: 390, height: 844 }
  const a = reading(work, viewport, 0), b = reading(work, viewport, 17.3)
  close(a.fieldPxPerCm, b.fieldPxPerCm, 'Parent translation changed scale')
  close(a.plateHeightPx, b.plateHeightPx, 'Parent translation changed plate height')
})

test('Reproduction fitting preserves aspect and never invents a different display size', () => {
  for (const work of register.MAIN_HANG) {
    for (const pixels of [{ width: 1024, height: 1024 }, { width: 1000, height: 1600 }, { width: 1600, height: 900 }]) {
      const size = register.reproductionCardSize(work, pixels)
      const width = work.width_cm / 100, height = work.height_cm / 100
      close(size.widthM / size.heightM, pixels.width / pixels.height, `${work.id}: raster aspect changed`)
      assert.ok(size.widthM <= width + 1e-12 && size.heightM <= height + 1e-12, `${work.id}: plate exceeds its field`)
      close(Math.max(size.widthM / width, size.heightM / height), 1,
        `${work.id}: neither reproduction dimension reaches the physical extent`)
    }
  }
})

test('Negative control rejects a wrong camera despite each individual scale measurement passing', () => {
  const viewport = { width: 390, height: 844 }, work = register.getWork('mona-lisa')
  const a = reading(work, viewport)
  const { camera, frame } = productionCamera(work, viewport)
  camera.position.z = fieldZ + (camera.position.z - fieldZ) / 2
  camera.updateMatrixWorld(true)
  const different = scale.measureProjectedWork(work, camera, frame.aperture.geometry, frame.aperture.matrixWorld, viewport)
  assert.ok(different.passes, 'Individual calibration should pass: geometry has not changed')
  assert.throws(() => commonScale([a, { ...a, work: 'wrong-camera', fieldPxPerCm: different.pxPerCmY }]))
  negatives.push({ fault: 'Camera distance halved for one selected work', individualPass: true, commonScaleRejects: true })
  frame.aperture.geometry.dispose(); frame.cards[0].mesh.geometry.dispose()
})

test('Negative control rejects a shrunken plate while the physical field still passes', () => {
  const viewport = { width: 390, height: 844 }, work = register.getWork('mona-lisa')
  const { camera, frame, wall } = productionCamera(work, viewport)
  frame.cards[0].mesh.scale.set(.60, .60, 1)
  wall.updateMatrixWorld(true)
  const field = scale.measureProjectedWork(work, camera, frame.aperture.geometry, frame.aperture.matrixWorld, viewport)
  const plate = scale.measureProjectedWork(work, camera, frame.cards[0].mesh.geometry, frame.cards[0].mesh.matrixWorld, viewport)
  assert.ok(field.passes)
  assert.equal(plate.passes, false)
  assert.ok(plate.maxErrorPercent > 39)
  negatives.push({ fault: 'Plate parent scale 0.6', fieldPass: true, platePass: false, errorPercent: plate.maxErrorPercent })
  frame.aperture.geometry.dispose(); frame.cards[0].mesh.geometry.dispose()
})

console.log(JSON.stringify({ checker: 'window-2-production-camera-scale', ok: true, checks, sourceHashes,
  measurements, negatives, limitations: [
    'No browser, GPU, DOM layout, image decoding, asset acquisition, or EYES run is performed.',
    'Camera tests execute the exact production compose declaration with real Three geometry and matrices; fixture frame placement and non-camera dependencies are explicit doubles.',
    'The matching-aspect plate fixtures isolate camera scale; real scan registration errors must remain visible in the mounted __forge.hang() table.',
    'Full-size murals and their declared separate architectural camera are outside the panel-to-panel common-scale comparison.',
  ],
}, null, 2))
