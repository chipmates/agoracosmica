#!/usr/bin/env node
/** Independent transport checks and one real-room benchmark. No browser,
 * network, asset textures, generated data files, or renderer modifications.
 * Run: node src/wings/vinci/pictures/bench/diffuse-gi-check.mjs
 */
import assert from 'node:assert/strict'
import * as Three from 'three/webgpu'
import { loadLocalTS, createRoomTransport, verifyRoomBake } from './bake-diffuse-gi.mjs'

const core = loadLocalTS('src/wings/vinci/pictures/bench/diffuse-gi-bake.ts', '\nexport const __check={prepare,buildBVH,cast,hemisphere,directIrradiance};')
const { prepare, buildBVH, cast, hemisphere, directIrradiance } = core.__check
const { bakeWallDiffuseGI, DIFFUSE_GI_RECIPE: recipe } = core
const results = []
function test(name, run) { run(); results.push({ name, pass: true }) }
const triangle = (a, b, c, reflectance = [0, 0, 0], emission = [0, 0, 0], label = 'test') => ({ a, b, c, reflectance, emission, label })
const quad = (a, b, c, d, rho, emitted, label) => [triangle(a, b, c, rho, emitted, label), triangle(a, c, d, rho, emitted, label)]
const zeroStats = () => ({ boundsTests: 0, triangleTests: 0, emitterConnectionRays: 0, visibleEmitterConnections: 0 })
const bounds = { minX: -.8, maxX: .8, minY: .6, maxY: 1.4 }
function fixture(scale = 1, reflectance = [.8, .2, .1]) {
  const floor = quad([-4, 0, 0], [-4, 0, 5], [4, 0, 5], [4, 0, 0], reflectance, [0, 0, 0], 'floor')
  const emitter = quad([-2, 2, .3], [2, 2, .3], [2, 2, 3.8], [-2, 2, 3.8], [0, 0, 0], [scale, scale, scale], 'emitter')
  return [...floor, ...emitter]
}
const bake = (triangles, other = {}) => bakeWallDiffuseGI({ triangles, bounds, width: 12, height: 8, ...other })

test('Cosine PDF has unit directions and no extra cosine factor', () => {
  const directions = hemisphere(64)
  for (const d of directions) { assert.ok(d[2] > 0); assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-12) }
  assert.ok(Math.abs(directions.reduce((n, d) => n + d[2] ** 2, 0) / 64 - .5) < 1e-12)
})

test('Area-emitter irradiance agrees with an analytic disk integral', () => {
  const radius = 1, height = 1, emission = [1, 1, 1], triangles = []
  for (let i = 0; i < 256; i++) {
    const a = i * 2 * Math.PI / 256, b = (i + 1) * 2 * Math.PI / 256
    // Clockwise from receiver -> inward emitter normal -Z.
    triangles.push(prepare(triangle([0, 0, height], [radius * Math.cos(b), radius * Math.sin(b), height],
      [radius * Math.cos(a), radius * Math.sin(a), height], [0, 0, 0], emission)))
  }
  const area = triangles.reduce((n, t) => n + t.area, 0)
  const actual = directIrradiance([0, 0, 0], [0, 0, 1], triangles, area, buildBVH([...triangles]), 8192, 7, zeroStats())
  const h = height - recipe.rayEpsilonM
  const expected = Math.PI * radius ** 2 / (radius ** 2 + h ** 2)
  for (const channel of actual) assert.ok(Math.abs(channel / expected - 1) < .01, `${channel} expected ${expected}`)
})

test('Nearest-hit BVH agrees with independent Three.Ray intersections', () => {
  const source = fixture(), prepared = source.map(prepare), root = buildBVH([...prepared])
  const target = new Three.Vector3()
  for (const x of [-1.5, -.3, .8]) for (const y of [.1, 1, 2.5]) for (const d of hemisphere(64)) {
    const origin = [x, y, recipe.rayEpsilonM]
    const ray = new Three.Ray(new Three.Vector3(...origin), new Three.Vector3(...d))
    let expected = Infinity
    for (const t of source) {
      const hit = ray.intersectTriangle(new Three.Vector3(...t.a), new Three.Vector3(...t.b), new Three.Vector3(...t.c), false, target)
      if (hit) {
        const distance = hit.distanceTo(ray.origin)
        if (distance > recipe.rayEpsilonM * .1) expected = Math.min(expected, distance)
      }
    }
    const actual = { distance: Infinity, triangle: null }
    cast(root, origin, d, d.map(v => 1 / v), actual, zeroStats())
    assert.ok(expected === actual.distance || Math.abs(expected - actual.distance) < 1e-9)
  }
})

let coloured
test('One reflected bounce inherits floor colour and scales linearly with emission', () => {
  coloured = bake(fixture())
  const twice = bake(fixture(2))
  assert.ok(coloured.stats.diffuseHits > 0 && coloured.stats.visibleEmitterConnections > 0)
  assert.ok(coloured.stats.meanIrradiance[0] > .01)
  for (let i = 0; i < coloured.irradiance.length; i += 3) {
    const [r, g, b] = coloured.irradiance.slice(i, i + 3)
    assert.ok(Math.abs(r - g * 4) < 1e-10 && Math.abs(g - b * 2) < 1e-10)
    for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(twice.irradiance[i + channel] - coloured.irradiance[i + channel] * 2) < 1e-10)
  }
})

test('No emitter or zero diffuse reflectance gives zero indirect energy', () => {
  const black = bake(fixture(1, [0, 0, 0])), noLight = bake(fixture(0))
  assert.ok(black.irradiance.every(v => v === 0)); assert.ok(noLight.irradiance.every(v => v === 0))
})

test('A real occluder between emitter and bounce surface removes transport', () => {
  const blocker = quad([-20, 1.9, -20], [20, 1.9, -20], [20, 1.9, 20], [-20, 1.9, 20], [0, 0, 0], [0, 0, 0], 'occluder')
  const blocked = bake([...fixture(), ...blocker])
  assert.ok(blocked.irradiance.every(v => v === 0))
  assert.ok(blocked.stats.emitterConnectionRays > 0)
  assert.equal(blocked.stats.visibleEmitterConnections, 0)
})

test('Bake is deterministic and rejects nonphysical or unbounded inputs', () => {
  assert.deepEqual(bake(fixture()).irradiance, coloured.irradiance)
  assert.throws(() => bake(fixture(), { width: 257 }), /configuration/)
  assert.throws(() => bake(fixture(1, [1.1, 0, 0])), /reflectance/)
  assert.throws(() => bake([triangle([0, 0, 0], [0, 0, 0], [1, 0, 0])]), /Degenerate/)
})

let benchmark, evidence, actualData
test('Actual 14 m room geometry extracts exactly with bounded transport work', () => {
  const scene = createRoomTransport({ segment: 'check', extent: 14, height: 4.4, depth: 12 })
  assert.ok(scene.triangles.length > 6000)
  assert.equal(scene.triangles.filter(t => t.emission.some(v => v > 0)).length, 2)
  for (const key of ['geometrySha256', 'lightSha256', 'materialSha256', 'recipeSha256', 'roomSourceSha256'])
    assert.match(scene.provenance[key], /^[a-f0-9]{64}$/)
  const result = bakeWallDiffuseGI(scene)
  assert.equal(result.width, 128); assert.equal(result.height, 64)
  assert.equal(result.stats.hemisphereRays, 128 * 64 * 64)
  // Wall time is recorded below, not a correctness predicate: this offline
  // forge step can share a machine with the live EYES renderer. Bound the
  // actual transport work independently of that machine's current load.
  assert.ok(Number.isFinite(result.stats.bakeMs) && result.stats.bakeMs >= 0)
  assert.ok(result.stats.emitterConnectionRays > 0)
  assert.ok(result.stats.emitterConnectionRays <= result.stats.hemisphereRays * 4)
  assert.ok(result.stats.meanIrradiance.every(v => v > 0))
  assert.ok(result.stats.meanIrradiance[0] > result.stats.meanIrradiance[2], 'Honey oak bounce warms the cool window source')
  benchmark = result.stats
  actualData = { schema: 'vinci-wall-diffuse-gi-v1', segment: 'check', ...result, provenance: scene.provenance }
  evidence = { geometrySha256: scene.provenance.geometrySha256, lightSha256: scene.provenance.lightSha256,
    materialSha256: scene.provenance.materialSha256, recipeSha256: scene.provenance.recipeSha256,
    roomSourceSha256: scene.provenance.roomSourceSha256 }
})

test('Verification rejects a changed room or light instead of trusting file metadata', () => {
  const config = { segment: 'check', extent: 14, height: 4.4, depth: 12 }
  verifyRoomBake(config, actualData)
  assert.throws(() => verifyRoomBake({ ...config, extent: 13 }, actualData), /Stale|mismatch/)
  assert.throws(() => verifyRoomBake(config, { ...actualData,
    provenance: { ...actualData.provenance, lightSha256: '0'.repeat(64) } }), /lightSha256 mismatch/)
})

console.log(JSON.stringify({ passed: results.length, results, benchmark, evidence }, null, 2))
