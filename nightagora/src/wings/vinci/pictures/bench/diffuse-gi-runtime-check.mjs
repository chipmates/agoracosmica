#!/usr/bin/env node
/** Isolated runtime validation and ownership checks; no browser or network.
 * Run: node src/wings/vinci/pictures/bench/diffuse-gi-runtime-check.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as Three from 'three/webgpu'
import * as TSL from 'three/tsl'

const uploads = []
class TrackedDataTexture extends Three.DataTexture {
  constructor(...args) {
    super(...args)
    this.disposals = 0
    this.addEventListener('dispose', () => this.disposals++)
    uploads.push(this)
  }
}
const source = readFileSync(new URL('./diffuse-gi-runtime.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText
const exports = {}
vm.runInThisContext(`(function(exports, require) { ${code}\n })`, { filename: 'diffuse-gi-runtime.ts' })(exports,
  name => {
    if (name === 'three/webgpu') return { ...Three, DataTexture: TrackedDataTexture }
    if (name === 'three/tsl') return TSL
    throw Error(`Unexpected test import ${name}`)
  })
const { createWallDiffuseGI } = exports
const hashes = Object.fromEntries(['geometrySha256', 'lightSha256', 'materialSha256',
  'recipeSha256', 'roomSourceSha256'].map((key, index) => [key, `${index + 1}`.repeat(64)]))
const fixture = () => ({
  schema: 'vinci-wall-diffuse-gi-v1', segment: 'signature', width: 2, height: 2,
  bounds: { minX: -1.2, maxX: 2.8, minY: 0, maxY: 4.4 },
  channels: 'RGB indirect irradiance',
  irradiance: [1, 2, 3, 4, 5, 6, 7, 8, 9, .25, .5, 65504],
  provenance: { class: 'GENERATED', ...hashes }, stats: { rays: 64 },
})
const results = []
function test(name, run) { run(); results.push({ name, pass: true }) }

test('Malformed sources and stale provenance fail before any upload is allocated', () => {
  const bad = [null, {}, { ...fixture(), schema: 'other' }, { ...fixture(), segment: '../late' },
    { ...fixture(), channels: 'RGB albedo' }, { ...fixture(), width: 257 },
    { ...fixture(), width: 1.5 }, { ...fixture(), height: 129 }, { ...fixture(), height: 0 },
    { ...fixture(), irradiance: [1] }, { ...fixture(), provenance: null }, { ...fixture(), stats: [] },
    { ...fixture(), provenance: {} }, { ...fixture(), provenance: { ...hashes } },
    { ...fixture(), provenance: { class: 'DG', ...hashes } }]
  for (const value of [NaN, Infinity, -1, 65505, '1', undefined]) {
    const data = fixture(); data.irradiance[0] = value; bad.push(data)
  }
  for (const bounds of [null, { minX: 0, maxX: 0, minY: 0, maxY: 1 },
    { minX: 0, maxX: 1, minY: 2, maxY: 1 },
    { minX: -Infinity, maxX: 1, minY: 0, maxY: 1 },
    { minX: -1e308, maxX: 1e308, minY: 0, maxY: 1 },
    { minX: 0, maxX: 1, minY: 0, maxY: 1, z: 0 }]) bad.push({ ...fixture(), bounds })
  const before = uploads.length
  for (const data of bad) assert.throws(() => createWallDiffuseGI(data), /Invalid wall diffuse GI/)
  assert.throws(() => createWallDiffuseGI(fixture(), { segment: 'early' }), /segment mismatch/)
  for (const key of Object.keys(hashes)) {
    assert.throws(() => createWallDiffuseGI(fixture(), { [key]: 'a'.repeat(64) }), /mismatch/)
    assert.throws(() => createWallDiffuseGI(fixture(), { [key]: 'bad' }), /mismatch/)
    const missing = fixture(); delete missing.provenance[key]
    assert.throws(() => createWallDiffuseGI(missing), /Invalid wall diffuse GI/)
    assert.throws(() => createWallDiffuseGI(missing, { [key]: hashes[key] }), /Invalid wall diffuse GI/)
    const malformed = fixture(); malformed.provenance[key] = 'bad'
    assert.throws(() => createWallDiffuseGI(malformed), /Invalid wall diffuse GI/)
  }
  assert.equal(uploads.length, before)
})

test('One linear RGBA16F upload preserves RGB row order and owns exactly 8 bytes per cell', () => {
  const data = fixture(), gi = createWallDiffuseGI(data, { segment: 'signature', ...hashes })
  const uploaded = uploads.at(-1)
  assert.equal(uploaded.colorSpace, Three.LinearSRGBColorSpace)
  assert.equal(uploaded.type, Three.HalfFloatType)
  assert.equal(uploaded.format, Three.RGBAFormat)
  assert.equal(uploaded.flipY, false)
  assert.equal(uploaded.generateMipmaps, false)
  assert.equal(uploaded.minFilter, Three.LinearFilter)
  assert.equal(uploaded.magFilter, Three.LinearFilter)
  assert.equal(uploaded.wrapS, Three.ClampToEdgeWrapping)
  assert.equal(uploaded.wrapT, Three.ClampToEdgeWrapping)
  assert.equal(uploaded.userData.manifestId, 'vinci/pictures/diffuse-gi/signature')
  const decoded = Array.from(uploaded.image.data, Three.DataUtils.fromHalfFloat)
  assert.deepEqual(decoded, [1, 2, 3, 1, 4, 5, 6, 1, 7, 8, 9, 1, .25, .5, 65504, 1])
  assert.equal(gi.textureMB(), 32 / 1048576)
  data.irradiance[0] = 100
  assert.equal(Three.DataUtils.fromHalfFloat(uploaded.image.data[0]), 1)
  gi.dispose(); gi.dispose()
  assert.equal(gi.textureMB(), 0)
  assert.equal(uploaded.disposals, 1)
  assert.equal(uploaded.image.data.length, 0)
})

test('128×64 field allocates 64 KiB without mip overhead', () => {
  const data = { ...fixture(), width: 128, height: 64, irradiance: Array(128 * 64 * 3).fill(.1) }
  const before = uploads.length, gi = createWallDiffuseGI(data)
  assert.equal(uploads.length - before, 1)
  assert.equal(gi.textureMB(), .0625)
  gi.dispose()
})

test('Binding preserves colour and previous emission, and cleanup is idempotent', () => {
  const gi = createWallDiffuseGI(fixture()), material = new Three.MeshStandardNodeMaterial()
  const colour = TSL.vec3(.3, .4, .5), emission = TSL.vec3(.01, .02, .03)
  material.colorNode = colour; material.emissiveNode = emission
  const before = material.version, restore = gi.apply(material)
  const applied = material.emissiveNode
  assert.equal(material.colorNode, colour)
  assert.notEqual(applied, emission)
  assert.equal(material.version, before + 1)
  assert.equal(gi.apply(material), restore)
  assert.equal(material.emissiveNode, applied)
  restore(); restore()
  assert.equal(material.emissiveNode, emission)
  assert.equal(material.colorNode, colour)
  assert.equal(material.version, before + 2)
  gi.dispose()
  assert.equal(material.emissiveNode, emission)
  assert.throws(() => gi.apply(material), /disposed/)
  material.dispose()
})

test('Runtime or material disposal restores each binding; independently replaced nodes survive', () => {
  const gi = createWallDiffuseGI(fixture())
  const first = new Three.MeshStandardNodeMaterial({ emissive: '#334455', emissiveIntensity: .4 })
  const second = new Three.MeshStandardNodeMaterial(), third = new Three.MeshStandardNodeMaterial()
  const secondOriginal = TSL.vec3(.1), changed = TSL.vec3(.2)
  second.emissiveNode = secondOriginal
  gi.apply(first); gi.apply(second); const restoreThird = gi.apply(third)
  assert.notEqual(first.emissiveNode, null)
  assert.equal(first.colorNode, null)
  first.dispose()
  assert.equal(first.emissiveNode, null)
  third.emissiveNode = changed
  restoreThird()
  assert.equal(third.emissiveNode, changed)
  gi.dispose()
  assert.equal(second.emissiveNode, secondOriginal)
  assert.equal(third.emissiveNode, changed)
  second.dispose(); third.dispose()
})

console.log(JSON.stringify({ pass: true, checks: results.length, results }, null, 2))
