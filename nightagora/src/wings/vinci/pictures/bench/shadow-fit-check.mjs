#!/usr/bin/env node
/** Independent Three camera checks for the bench's directional shadow fit.
 * Run: node src/wings/vinci/pictures/bench/shadow-fit-check.mjs
 * Uses no browser, renderer, GPU, network, or generated asset.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
import * as Three from 'three/webgpu'

const source = readFileSync(new URL('./shadow-fit.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText
const exports = {}
vm.runInThisContext(`(function(exports, require) { ${code}\n })`, { filename: 'shadow-fit.ts' })(exports,
  id => {
    if (id === 'three/webgpu') return Three
    throw Error(`Unexpected test import ${id}`)
  })
const { fitBenchKeyShadow } = exports
const results = [], evidence = []
function test(name, run) { run(); results.push({ name, pass: true }) }
const v = (...xyz) => new Three.Vector3(...xyz)
const box = (min, max) => new Three.Box3(v(...min), v(...max))
const tolerance = 2e-8
function close(a, b, message, epsilon = tolerance) {
  assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon,
    `${message}: ${a} versus ${b}`)
}
function vectorClose(a, b, message) {
  for (let i = 0; i < 3; i++) close(a[i], b[i], `${message} axis ${i}`)
}
function fixture() {
  const scene = new Three.Scene(), light = new Three.DirectionalLight(0xdfe9ff, 1.7)
  light.position.set(-8, 10, 5)
  light.target.position.set(.5, 1.55, 0)
  light.castShadow = true
  light.shadow.mapSize.set(1024, 512)
  scene.add(light, light.target)
  scene.updateMatrixWorld(true)
  return { scene, light }
}
const worldPosition = object => object.getWorldPosition(new Three.Vector3())
const direction = light => worldPosition(light).sub(worldPosition(light.target)).normalize()
function corners(bounds) {
  const points = []
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y])
    for (const z of [bounds.min.z, bounds.max.z]) points.push(v(x, y, z))
  return points
}

/** Exercise exactly the matrix update used by Three's shadow renderer, then
 * independently check all eight world corners through its camera and matrix.
 */
function verifyProjection(light, bounds, fitted, coordinateSystem) {
  const camera = light.shadow.camera
  assert.deepEqual(fitted.worldBounds, { min: bounds.min.toArray(), max: bounds.max.toArray() })
  assert.equal(camera.coordinateSystem, coordinateSystem, 'The fit preserves the renderer coordinate system')
  light.updateWorldMatrix(true, false)
  light.target.updateWorldMatrix(true, false)
  light.shadow.updateMatrices(light)
  const minDepth = coordinateSystem === Three.WebGPUCoordinateSystem ? 0 : -1
  const extents = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  for (const point of corners(bounds)) {
    const ndc = point.clone().project(camera)
    assert.ok(ndc.x >= -1 - tolerance && ndc.x <= 1 + tolerance, `Shadow clips X at ${point.toArray()}: ${ndc.x}`)
    assert.ok(ndc.y >= -1 - tolerance && ndc.y <= 1 + tolerance, `Shadow clips Y at ${point.toArray()}: ${ndc.y}`)
    assert.ok(ndc.z >= minDepth - tolerance && ndc.z <= 1 + tolerance, `Shadow clips depth at ${point.toArray()}: ${ndc.z}`)
    const texture = point.clone().applyMatrix4(light.shadow.matrix)
    for (const value of texture.toArray()) assert.ok(value >= -tolerance && value <= 1 + tolerance, `Shadow texture coordinate ${value}`)
    assert.ok(light.shadow.getFrustum().containsPoint(point), `Three culls a supplied corner ${point.toArray()}`)
    const view = point.clone().applyMatrix4(camera.matrixWorldInverse)
    assert.ok(-view.z >= camera.near - tolerance && -view.z <= camera.far + tolerance)
    ndc.toArray().forEach((value, axis) => {
      extents.min[axis] = Math.min(extents.min[axis], value)
      extents.max[axis] = Math.max(extents.max[axis], value)
    })
  }
  for (const field of ['left', 'right', 'top', 'bottom', 'near', 'far']) close(fitted.frustum[field], camera[field], `Reported ${field}`)
  close(fitted.texelWorldM.x, (camera.right - camera.left) / light.shadow.mapSize.x, 'Horizontal metre per texel')
  close(fitted.texelWorldM.y, (camera.top - camera.bottom) / light.shadow.mapSize.y, 'Vertical metre per texel')
  vectorClose(fitted.lightPosition, worldPosition(light).toArray(), 'Reported light position')
  vectorClose(fitted.targetPosition, worldPosition(light.target).toArray(), 'Reported target position')
  vectorClose(fitted.direction, direction(light).toArray(), 'Reported light direction')
  assert.ok(camera.near > 0 && camera.far > camera.near)
  return extents
}

for (const [backend, coordinateSystem] of [['WebGL', Three.WebGLCoordinateSystem], ['WebGPU', Three.WebGPUCoordinateSystem]]) {
  test(`${backend}: all corners of a 35 m non-cubic room survive shadow projection and culling`, () => {
    const { light } = fixture(), bounds = box([-1.2, 0, -.2], [35, 4.4, 12])
    light.shadow.camera.coordinateSystem = coordinateSystem
    const before = direction(light).toArray(), original = bounds.clone()
    const fitted = fitBenchKeyShadow({ light }, bounds)
    assert.ok(bounds.equals(original), 'The supplied world bounds remain unchanged')
    vectorClose(fitted.direction, before, 'Authored light direction')
    evidence.push({ backend, room: '35 m', ...fitted, projected: verifyProjection(light, bounds, fitted, coordinateSystem) })
  })
}

test('A room translated far from the origin retains the same coverage and light direction', () => {
  const a = fixture(), b = fixture(), shift = v(100000, -32000, 75000)
  const original = box([-1.2, 0, -.2], [35, 4.4, 12]), moved = original.clone().translate(shift)
  b.light.position.add(shift); b.light.target.position.add(shift)
  const left = fitBenchKeyShadow(a, original), right = fitBenchKeyShadow(b, moved)
  for (const field of ['left', 'right', 'top', 'bottom', 'near', 'far']) close(left.frustum[field], right.frustum[field], `Translation preserves ${field}`)
  vectorClose(right.lightPosition, left.lightPosition.map((value, i) => value + shift.getComponent(i)), 'Translated light')
  vectorClose(right.targetPosition, left.targetPosition.map((value, i) => value + shift.getComponent(i)), 'Translated target')
  verifyProjection(b.light, moved, right, Three.WebGLCoordinateSystem)
})

test('Independent rotated and scaled parents preserve the world light direction and bound coverage', () => {
  const { scene, light } = fixture(), lightParent = new Three.Group(), targetParent = new Three.Group()
  lightParent.position.set(8, -4, 12); lightParent.rotation.set(.2, -.7, .4); lightParent.scale.set(2, .7, 1.3)
  targetParent.position.set(-11, 6, -5); targetParent.rotation.set(-.4, .3, -.2); targetParent.scale.set(.8, 1.6, 1.1)
  scene.add(lightParent, targetParent)
  lightParent.add(light); targetParent.add(light.target)
  scene.updateMatrixWorld(true)
  const before = direction(light).toArray(), bounds = box([44, -7, 20], [79, -.6, 32])
  const parentMatrices = [lightParent.matrixWorld.toArray(), targetParent.matrixWorld.toArray()]
  const fitted = fitBenchKeyShadow({ light }, bounds)
  vectorClose(fitted.direction, before, 'World direction under parent transforms')
  verifyProjection(light, bounds, fitted, Three.WebGLCoordinateSystem)
  assert.deepEqual([lightParent.matrixWorld.toArray(), targetParent.matrixWorld.toArray()], parentMatrices)
  assert.equal(light.parent, lightParent); assert.equal(light.target.parent, targetParent)
})

test('A nearly vertical key remains finite and covers a thin receiver and its frame casters', () => {
  const { light } = fixture()
  light.position.set(1e-7, 30, -1e-7); light.target.position.set(0, 0, 0)
  const bounds = box([-.42, .99, -.01], [.42, 2.11, .12])
  const before = direction(light).toArray(), fitted = fitBenchKeyShadow({ light }, bounds)
  vectorClose(fitted.direction, before, 'Nearly vertical direction')
  verifyProjection(light, bounds, fitted, Three.WebGLCoordinateSystem)
})

test('Refitting is stable, owns no objects, and retains the supplied light and shadow resources', () => {
  const { scene, light } = fixture(), bounds = box([-1.2, 0, -.2], [14, 4.4, 12])
  const childList = [...scene.children], target = light.target, shadow = light.shadow, camera = shadow.camera
  const mapSize = shadow.mapSize.toArray(), colour = light.color.toArray(), intensity = light.intensity
  const first = fitBenchKeyShadow({ light }, bounds)
  shadow.needsUpdate = false
  const second = fitBenchKeyShadow({ light }, bounds)
  for (const field of ['left', 'right', 'top', 'bottom', 'near', 'far']) close(first.frustum[field], second.frustum[field], `Repeat fit ${field}`)
  vectorClose(first.lightPosition, second.lightPosition, 'Repeat fit light')
  vectorClose(first.targetPosition, second.targetPosition, 'Repeat fit target')
  assert.deepEqual(scene.children, childList)
  assert.equal(light.target, target); assert.equal(light.shadow, shadow); assert.equal(shadow.camera, camera)
  assert.equal(shadow.map, null); assert.equal(shadow.mapPass, null)
  assert.deepEqual(shadow.mapSize.toArray(), mapSize)
  assert.deepEqual(light.color.toArray(), colour); assert.equal(light.intensity, intensity)
  assert.equal(light.castShadow, true); assert.equal(shadow.needsUpdate, true)
  assert.ok(Number.isFinite(shadow.bias) && Number.isFinite(shadow.normalBias))
  verifyProjection(light, bounds, second, Three.WebGLCoordinateSystem)
})

test('Explicit padding leaves real lateral and depth clearance around the supplied bounds', () => {
  const { light } = fixture(), bounds = box([-1, 0, 0], [3, 3, 1])
  const paddingM = .27, depthPaddingM = .42, minNearM = .15
  const fitted = fitBenchKeyShadow({ light }, bounds, { paddingM, depthPaddingM, minNearM })
  verifyProjection(light, bounds, fitted, Three.WebGLCoordinateSystem)
  const camera = light.shadow.camera, viewBounds = new Three.Box3().setFromPoints(corners(bounds).map(point => point.applyMatrix4(camera.matrixWorldInverse)))
  for (const clearance of [viewBounds.min.x - camera.left, camera.right - viewBounds.max.x,
    viewBounds.min.y - camera.bottom, camera.top - viewBounds.max.y]) assert.ok(clearance >= paddingM - tolerance, `Lateral clearance ${clearance}`)
  assert.ok(-viewBounds.max.z - camera.near >= depthPaddingM - tolerance)
  assert.ok(camera.far + viewBounds.min.z >= depthPaddingM - tolerance)
  assert.ok(camera.near >= minNearM - tolerance)
})

test('Fitting calm geometry keeps disabled shadows disabled and allocates no map', () => {
  const { light } = fixture(), bounds = box([-1.2, 0, -.2], [14, 4.4, 12])
  light.castShadow = false; light.shadow.autoUpdate = false; light.shadow.needsUpdate = false
  const fitted = fitBenchKeyShadow({ light }, bounds)
  assert.equal(light.castShadow, false); assert.equal(light.shadow.autoUpdate, false)
  assert.equal(light.shadow.needsUpdate, false); assert.equal(light.shadow.map, null)
  verifyProjection(light, bounds, fitted, Three.WebGLCoordinateSystem)
})

test('Empty, reversed, and non-finite bounds are rejected before changing the light', () => {
  for (const bounds of [new Three.Box3(), box([2, 0, 0], [1, 2, 2]),
    box([NaN, 0, 0], [1, 2, 2]), box([0, 0, 0], [Infinity, 2, 2])]) {
    const { light } = fixture(), position = light.position.toArray(), target = light.target.position.toArray()
    assert.throws(() => fitBenchKeyShadow({ light }, bounds))
    assert.deepEqual(light.position.toArray(), position); assert.deepEqual(light.target.position.toArray(), target)
  }
})

test('Coincident light and target are rejected instead of inventing a light direction', () => {
  const { light } = fixture()
  light.position.copy(light.target.position)
  assert.throws(() => fitBenchKeyShadow({ light }, box([-1, 0, 0], [3, 3, 1])))
})

console.log(JSON.stringify({ sourceSha256: createHash('sha256').update(source).digest('hex'),
  passed: results.length, results, evidence }, null, 2))
