#!/usr/bin/env node
/** THE CLOSE LOOK'S OFFLINE PROOF, on the real modules.
 *
 * Four things this checks, none of which needs a browser: every declared
 * viewing eye is in the clearance certificate on disk under the exact station
 * pose it returns to; the picture module's own one-slot stream raises the full
 * plate of the exhibit that was walked to, and only that one; each frame holds
 * the whole work at both viewports; and the certified path reversed lands on
 * the station eye with no drift.
 *
 * It claims no rendered light, no browser residency and no frame cost.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const raw = JSON.parse(source('public/na-manifest.json'))
const all = Array.isArray(raw) ? raw : raw.assets
const manifest = { all, byId: new Map(all.map(entry => [entry.id, entry])), forPath: () => undefined }
let tier = 'standard'
const memory = new Set(), streams = []
const memoryTotal = () => [...memory].reduce((sum, measure) => sum + measure(), 0)
const fullCount = () => streams.filter(stream => !stream.disposed && stream.full).length
const stack = {
  tierName: () => tier,
  registerTextureMemory(measure) { memory.add(measure); return () => memory.delete(measure) },
  cost: () => ({ textureMB: memoryTotal(), budget: { textureMB: 256 } }),
}
function fakeStream(preview, full) {
  const api = {
    preview, plate: full, full: false, disposed: false,
    material: new THREE.MeshBasicNodeMaterial(), ready: Promise.resolve(),
    available() { return !api.disposed }, update() {},
    allocation: () => ({ previewMB: 1, fullMB: 32 }),
    textureMB: () => api.disposed ? 0 : 1 + (api.full ? 32 : 0),
    error: () => null, pending: () => 0,
    high(enable) { api.full = enable; assert.ok(fullCount() <= 1, 'a second full source was granted'); return Promise.resolve() },
    dispose() { api.disposed = true; api.full = false; api.material.dispose() },
  }
  streams.push(api)
  return api
}

const cache = new Map()
const overrides = new Map([
  ['src/manifest/index.ts', { loadManifest: () => Promise.resolve(manifest) }],
  ['src/wings/vinci/pictures/stream.ts', { createPlateStream: fakeStream }],
  ['src/wings/vinci/collection/materials.ts', {
    collectionInteriorMaterial: () => new THREE.MeshBasicNodeMaterial(),
    collectionPlateTone: () => ({ mul() { return this } }),
  }],
])
function load(relative) {
  if (overrides.has(relative)) return overrides.get(relative)
  if (cache.has(relative)) return cache.get(relative)
  const module = { exports: {} }
  cache.set(relative, module.exports)
  const compiled = ts.transpileModule(source(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const require = specifier => {
    if (specifier === 'three/tsl') return TSL
    if (specifier === 'three' || specifier === 'three/webgpu') return THREE
    if (!specifier.startsWith('.')) throw new Error(`Unexpected import: ${specifier}`)
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier))
    if (resolved.endsWith('?raw')) return { default: source(resolved.slice(0, -4)) }
    const file = fs.existsSync(path.join(root, resolved + '.ts')) ? resolved + '.ts' : resolved + '/index.ts'
    return load(file)
  }
  vm.runInNewContext(compiled, { module, exports: module.exports, require, console,
    matchMedia: () => ({ matches: false }) }, { filename: relative })
  return module.exports
}

const { vinciExhibitRecords, vinciApproachPose, vinciApproachFit, vinciApproachPlateMetres } =
  load('src/wings/vinci/collection/approaches.ts')
const { stationPose } = load('src/wings/vinci/rail.ts')
const { mountCollectionPlates } = load('src/wings/vinci/collection/plates.ts')
const { readVinciExhibits } = load('src/wings/vinci/collection/pick.ts')
const { createCertifiedRailPath } = load('src/wings/vinci/rail-smoothing.ts')
const certificate = JSON.parse(source('src/wings/vinci/data/rail-clearance.json'))

/* ---- 1. every declared viewing eye is certified, at both viewports ---- */

const poseKey = pose => JSON.stringify([pose.eye, pose.at, pose.fov])
const saved = new Map(certificate.approaches.map(entry =>
  [`${entry.viewport}:${entry.station}:${entry.exhibit}`, entry]))
assert.equal(certificate.format, 'vinci-rail-clearance-v2')
const records = vinciExhibitRecords()
assert.equal(records.length, 25, 'the picture room hangs twenty five plates')
assert.equal(certificate.approaches.length, records.length * 2)
const report = { records: records.length, approaches: certificate.approaches.length, worst: {} }
for (const viewport of ['desktop', 'phone']) {
  const narrow = viewport === 'phone'
  for (const record of records) {
    const entry = saved.get(`${viewport}:${record.station}:${record.id}`)
    assert.ok(entry, `no certified approach: ${viewport} ${record.id}`)
    const station = stationPose(record.station, narrow)
    const viewing = vinciApproachPose(record.id, narrow)
    assert.equal(poseKey(entry.fromPose), poseKey({ eye: station.eye.toArray(), at: station.at.toArray(), fov: station.fov }),
      `the certified start is not the station eye: ${viewport} ${record.id}`)
    assert.equal(poseKey(entry.toPose), poseKey({ eye: viewing.eye.toArray(), at: viewing.at.toArray(), fov: viewing.fov }),
      `the certified end is not the viewing eye: ${viewport} ${record.id}`)
    assert.equal(entry.certifiedBalls.length, 0, 'an approach is a straight leg')

    /* ---- 4. the return lands on the exact certified station eye ---- */
    const points = entry.points.map(([east, north, height]) => new THREE.Vector3(east, height, -north))
    const back = createCertifiedRailPath([...points].reverse(), {
      clearanceRadiusM: entry.maxNearRadius, maxTrimM: .5, certificateDepth: 6, certifyBall: () => true,
    })
    const landed = back.pointAtDistance(back.length, new THREE.Vector3())
    const drift = landed.distanceTo(station.eye)
    assert.equal(drift, 0, `the return drifts ${drift} m: ${viewport} ${record.id}`)
    const out = createCertifiedRailPath(points, {
      clearanceRadiusM: entry.maxNearRadius, maxTrimM: .5, certificateDepth: 6, certifyBall: () => true,
    })
    assert.equal(out.pointAtDistance(out.length, new THREE.Vector3()).distanceTo(viewing.eye), 0)
    assert.equal(+out.length.toFixed(9), +back.length.toFixed(9))

    /* ---- 3. the frame holds the whole work ---- */
    const fit = vinciApproachFit(record.id, narrow)
    assert.ok(fit.height <= .98 && fit.width <= .98,
      `the frame cuts the work: ${viewport} ${record.id} height ${fit.height} width ${fit.width}`)
    const metres = vinciApproachPlateMetres(record.id, narrow)
    assert.ok(metres < 2.2, `the viewing eye stands ${metres} m off the plate: ${viewport} ${record.id}`)
    const worst = report.worst[viewport] ?? { fit: 0, metres: 0 }
    report.worst[viewport] = { fit: Math.max(worst.fit, fit.height, fit.width), metres: Math.max(worst.metres, metres) }
  }
}

/* ---- 2. the arrival is what raises the full plate ---- */

const host = new THREE.Group()
const plates = mountCollectionPlates(host, stack)
await plates.ready
const tick = async eye => {
  plates.update(1 / 60, eye)
  for (let turn = 0; turn < 8; turn++) await Promise.resolve()
}
await tick(new THREE.Vector3(0, 0, 0))
assert.equal(plates.errors().length, 0)
assert.equal(fullCount(), 0, 'no full plate stands before anyone walks up to one')
const registry = readVinciExhibits(host)
assert.equal(registry.filter(entry => entry.openable).length, records.length)
assert.equal(registry.filter(entry => entry.kind === 'sheet').length, 29)
assert.equal(registry.filter(entry => entry.kind === 'mural').length, 1)
assert.ok(registry.every(entry => entry.radiusM >= .11), 'every proxy has its own floor')
const raised = []
for (const record of records) {
  const pose = vinciApproachPose(record.id, false)
  await tick(pose.eye)
  assert.equal(fullCount(), 1, `the arrival raised ${fullCount()} full plates: ${record.id}`)
  const mesh = host.getObjectByName('vinci/collection-plates')
    .children.find(child => child.userData.workId === record.workId && child.userData.face === record.face)
  assert.ok(mesh, `no mounted plate for ${record.id}`)
  const stream = streams.find(entry => entry.plate.id === mesh.userData.manifestId)
  assert.ok(stream.full, `the plate at the viewing eye is not at full resolution: ${record.id}`)
  raised.push(record.id)
}
assert.equal(raised.length, records.length)
// The station eye stands 6.6 m off the hang, outside the module's own 2.2 m,
// so standing at the station raises nothing: the arrival is what raises it.
await tick(stationPose('picture-room', false).eye)
assert.equal(fullCount(), 0, 'the station eye holds a full plate')
report.raisedOnArrival = raised.length
report.ok = true
console.log(JSON.stringify(report, null, 2))
