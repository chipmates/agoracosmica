#!/usr/bin/env node
/** Controlled-clock checks of the actual production plate stream.
 * Run: node src/wings/vinci/pictures/bench/preview-transition-check.mjs
 * No browser, GPU, pixels, network or source writes. Texture/DOM I/O and TSL
 * plumbing are doubles; policy, request, readiness and transition logic are real.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
import * as Three from 'three/webgpu'

/** the store's address helper as the app has it, so a mocked base still
    forms the address the app forms, query and all */
const mockMaterials = base => ({
  ASSET_BASE: base,
  assetAddress: (record, part) => `${base}${record.wing}/${record.path}${part ?? ''}`
    + (/^[0-9a-f]{12}/.test(record.sha256 ?? record.tree_sha256 ?? '')
      ? `?v=${(record.sha256 ?? record.tree_sha256).slice(0, 12)}` : ''),
})

const file = fileURLToPath(new URL('../stream.ts', import.meta.url))
const source = readFileSync(file, 'utf8')
const policyFile = fileURLToPath(new URL('../policy.ts', import.meta.url))
const policySource = readFileSync(policyFile, 'utf8')
const policy = {}
vm.runInNewContext(ts.transpileModule(policySource, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText, { exports: policy,
  require(name) { throw new Error(`Unexpected policy dependency ${name}`) },
  fetch() { throw new Error('Source resolution must not perform I/O') },
}, { filename: policyFile, timeout: 2000 })
const sheetFile = fileURLToPath(new URL('../sheet-record.ts', import.meta.url))
const sheetRecord = {}
vm.runInNewContext(ts.transpileModule(readFileSync(sheetFile, 'utf8'), { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText, { exports: sheetRecord,
  require(name) { throw new Error(`Unexpected sheet dependency ${name}`) },
  fetch() { throw new Error('Source resolution must not perform I/O') },
}, { filename: sheetFile, timeout: 2000 })
const manifestFile = fileURLToPath(new URL('../data/store-audit.json', import.meta.url))
const manifestSource = readFileSync(manifestFile, 'utf8')
const snapshot = JSON.parse(manifestSource)
assert.equal(createHash('sha256').update(JSON.stringify(snapshot.records)).digest('hex'), snapshot.recordSha256,
  'The app-plugin snapshot record hash must match')
const manifest = { all: snapshot.records, byId: new Map(snapshot.records.map(entry => [entry.id, entry])) }
const selected = policy.resolveManifestWorkPlates('lady-with-an-ermine', manifest).find(entry => entry.relationship === 'primary')
assert.ok(selected, 'The actual policy-selected Ermine pair is required')
const { preview, plate } = selected
assert.equal(plate.tier, 'TIER1', 'Use the new source policy for the transition fixture')
assert.equal(plate.id, 'vinci/painting-plate/lady-with-an-ermine__2936x4000', 'The superseded legacy plate cannot be the transition fixture')
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
function scalar(value) {
  if (typeof value === 'number') return value
  if (value && typeof value.value === 'number') return value.value
  throw new Error('Unsupported opacity expression: extend the symbolic plumbing explicitly')
}
function node(fields) {
  const result = { ...fields }
  Object.defineProperty(result, 'rgb', { get: () => result })
  return result
}

function harness(reducedMotion = false) {
  let now = 1000, nextTimer = 0, fullFailure = false
  const timers = new Map(), textures = [], materials = [], bitmaps = [], requests = []
  const previewGate = deferred()
  class Texture {
    constructor(image) { this.image = image; this.userData = {}; this.disposals = 0; textures.push(this) }
    dispose() { this.disposals++ }
  }
  class DataTexture extends Texture {
    constructor(data, width, height) { super({ data, width, height }) }
  }
  class Material {
    constructor() { this.userData = {}; this.opacity = 1; this.transparent = false; this.disposals = 0; materials.push(this) }
    dispose() { this.disposals++ }
  }
  const address = mockMaterials('/mock-assets/').assetAddress
  async function fetch(url, { signal }) {
    const entry = url === address(preview) ? preview : url === address(plate) ? plate : null
    assert.ok(entry, `Unexpected requested URL: ${url}`)
    assert.equal(url, address(entry))
    requests.push({ entry, signal })
    signal.throwIfAborted()
    if (entry === preview) await previewGate.promise
    signal.throwIfAborted()
    return { ok: entry !== plate || !fullFailure, status: fullFailure && entry === plate ? 503 : 200,
      blob: async () => ({ entry }) }
  }
  async function createImageBitmap({ entry }, options) {
    assert.equal(options.imageOrientation, 'flipY')
    assert.equal(options.premultiplyAlpha, 'none')
    assert.equal(options.colorSpaceConversion, 'none')
    assert.ok(!('resizeWidth' in options) && !('resizeHeight' in options), 'A transition resized the painting pixels')
    const dimensions = /__(\d+)x(\d+)\.jpg$/.exec(entry.path)
    const bitmap = { width: Number(dimensions[1]), height: Number(dimensions[2]), closes: 0,
      close() { this.closes++ } }
    bitmaps.push(bitmap)
    return bitmap
  }
  const exports = {}
  const media = { matches: reducedMotion, media: '(prefers-reduced-motion: reduce)',
    addEventListener() {}, removeEventListener() {} }
  vm.runInNewContext(compiled, {
    exports, AbortController, Uint8Array, fetch, createImageBitmap,
    window: { matchMedia: () => media }, matchMedia: () => media,
    performance: { now: () => now },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, due: now + delay }); return id },
    clearTimeout: id => timers.delete(id),
    require(name) {
      if (name === 'three/webgpu') return { ...Three, Texture, DataTexture, MeshBasicNodeMaterial: Material }
      if (name === 'three/tsl') return {
        texture: value => node({ kind: 'texture', value }), uniform: value => node({ kind: 'uniform', value }),
        mix: (a, b, blend) => node({ kind: 'mix', a, b, blend }),
      }
      if (name === '../../../stack/materials') return mockMaterials('/mock-assets/')
      if (name === './policy') return policy
      if (name === './sheet-record') return sheetRecord
      throw new Error(`Unmocked dependency ${name}`)
    },
  }, { filename: file, timeout: 2000 })
  const stream = exports.createPlateStream(preview, plate)
  return {
    stream, timers, textures, bitmaps, requests,
    async arrive() { previewGate.resolve(); await flush() },
    async advance(ms, render = true) {
      now += ms
      for (let rounds = 0; rounds < 100; rounds++) {
        const due = [...timers].filter(([, timer]) => timer.due <= now)
        if (!due.length) break
        for (const [id, timer] of due) { timers.delete(id); timer.callback() }
      }
      if (render) stream.update(0) // frozen/reduced animation time is deliberate
      await flush()
    },
    coverage() {
      if (!stream.available()) return 0
      const material = stream.material
      if (!material.transparent && !material.alphaHash && !material.alphaToCoverage) return 1
      return material.opacity * (material.opacityNode === undefined || material.opacityNode === null ? 1 : scalar(material.opacityNode))
    },
    resolutionBlend() {
      assert.equal(stream.material.colorNode.kind, 'mix', 'Resolution still requires an explicit preview/full colour blend')
      return scalar(stream.material.colorNode.blend)
    },
    failFull() { fullFailure = true },
    release() {
      stream.dispose(); stream.dispose()
      assert.equal(timers.size, 0, 'A transition timer survived disposal')
      for (const texture of textures) assert.equal(texture.disposals, 1)
      for (const bitmap of bitmaps) assert.equal(bitmap.closes, 1)
      for (const material of materials) assert.equal(material.disposals, 1)
    },
  }
}

const tests = [], samples = []
const test = (name, run) => tests.push({ name, run })
for (const reduced of [false, true]) test(`First decoded preview appears continuously at frozen dt (reduced motion ${reduced})`, async () => {
  const h = harness(reduced)
  try {
    assert.equal(h.stream.available(), false); assert.equal(h.coverage(), 0)
    await h.arrive()
    assert.equal(h.stream.available(), true, 'Decoded preview must be available for its initial reveal')
    const values = [{ ms: 0, coverage: h.coverage(), pending: h.stream.pending() }]
    for (let elapsed = 25; elapsed <= 1000; elapsed += 25) {
      await h.advance(25)
      values.push({ ms: elapsed, coverage: h.coverage(), pending: h.stream.pending() })
    }
    samples.push({ kind: 'first-preview', reducedMotion: reduced, dt: 0, values })
    assert.ok(values[0].coverage < 1, 'First preview switches directly from hidden to fully opaque at decode completion')
    assert.ok(values[0].pending > 0, 'An unfinished initial reveal must remain pending')
    assert.ok(values.some(value => value.coverage > 0 && value.coverage < 1), 'No intermediate first-arrival coverage was observable')
    for (let i = 1; i < values.length; i++) assert.ok(values[i].coverage >= values[i - 1].coverage, 'Initial reveal reversed')
    assert.equal(values.at(-1).coverage, 1, 'Initial arrival did not finish on wall time')
    assert.equal(h.stream.pending(), 0)
  } finally { h.release() }
})
test('First arrival completes by wall-clock fallback without any render update', async () => {
  const h = harness(true)
  try {
    await h.arrive()
    await h.advance(1100, false)
    await h.stream.ready
    assert.equal(h.coverage(), 1)
    assert.equal(h.stream.pending(), 0)
    assert.equal(h.stream.available(), true)
  } finally { h.release() }
})
test('Established reproduction stays fully opaque through upgrade and downgrade while resolution blends', async () => {
  const h = harness(true)
  try {
    await h.arrive(); await h.advance(1100); await h.stream.ready
    assert.equal(h.coverage(), 1)
    const upgrade = h.stream.high(true)
    await flush()
    assert.equal(h.resolutionBlend(), 0)
    assert.equal(h.coverage(), 1)
    await h.advance(350)
    const middle = h.resolutionBlend()
    assert.ok(middle > 0 && middle < 1, 'Full image replaced the preview without an intermediate resolution blend')
    assert.equal(h.coverage(), 1, 'An established reproduction became transparent during upgrade')
    await h.advance(360); await upgrade
    assert.equal(h.resolutionBlend(), 1); assert.equal(h.coverage(), 1)
    const downgrade = h.stream.high(false)
    await h.advance(350)
    assert.ok(h.resolutionBlend() > 0 && h.resolutionBlend() < 1)
    assert.equal(h.coverage(), 1, 'An established reproduction became transparent during downgrade')
    await h.advance(360); await downgrade
    assert.equal(h.resolutionBlend(), 0); assert.equal(h.coverage(), 1)
    assert.equal(h.stream.residency().full, false)
    samples.push({ kind: 'resolution-upgrade', dt: 0, midpointBlend: middle, establishedCoverage: 1 })
  } finally { h.release() }
})
test('Full transitions finish and release their slot even when all render updates stop', async () => {
  const h = harness(true)
  try {
    await h.arrive(); await h.advance(1100, false)
    const upgrade = h.stream.high(true); await flush()
    await h.advance(710, false); await upgrade
    assert.equal(h.resolutionBlend(), 1); assert.equal(h.coverage(), 1)
    const downgrade = h.stream.high(false)
    await h.advance(710, false); await downgrade
    assert.equal(h.stream.residency().full, false)
    assert.equal(h.stream.pending(), 0); assert.equal(h.coverage(), 1)
  } finally { h.release() }
})
test('An optional full-image failure never restarts first arrival or dims an established preview', async () => {
  const h = harness()
  try {
    await h.arrive(); await h.advance(1100)
    h.failFull(); await h.stream.high(true)
    assert.match(h.stream.error(), /503/)
    for (let i = 0; i < 4; i++) {
      await h.advance(250)
      assert.equal(h.coverage(), 1)
      assert.equal(h.stream.available(), true)
      assert.equal(h.stream.pending(), 0)
    }
    assert.equal(h.stream.residency().full, false)
  } finally { h.release() }
})

const results = []
for (const { name, run } of tests) {
  try { await run(); results.push({ name, ok: true }) }
  catch (error) { results.push({ name, ok: false, error: error.stack ?? String(error) }) }
}
const report = {
  kind: 'isolated-source-preview-transition-check', browser: false, gpu: false, network: false,
  source: { file, sha256: createHash('sha256').update(source).digest('hex') },
  policySource: { file: policyFile, sha256: createHash('sha256').update(policySource).digest('hex') },
  manifestFile,
  manifestSha256: createHash('sha256').update(manifestSource).digest('hex'),
  selected: { workId: selected.workId, preview: preview.id, plate: plate.id, tier: selected.policyTier },
  ok: results.every(result => result.ok), passed: results.filter(result => result.ok).length,
  total: results.length, results, samples,
  limitations: [
    'Coverage and resolution coefficients are read from symbolic material nodes; no rendered pixels or GPU presentation timing are measured.',
    'Reduced-motion preference is supplied to matchMedia and every simulated render has dt=0; it does not emulate an entire accessibility or browser environment.',
    'The first-arrival checks require at least one intermediate coverage and completion within one second; they do not prescribe an exact easing curve or duration.',
    'Actual prepared manifest dimensions and decode options are checked, but no painting bytes are read or changed.',
  ],
}
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
