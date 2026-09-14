#!/usr/bin/env node
/** Isolated behavioural checks of the real picture stream and hang scheduler.
 * Run: node src/wings/vinci/pictures/bench/stream-check.mjs
 * No browser, network, GPU, generated source files, or production mutations.
 * TypeScript is transpiled in memory. The I/O, renderer resources, furniture,
 * and small DOM surface are doubles; stream/hang, register and policy are real.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import * as Three from 'three/webgpu'

const sourcePaths = ['stream', 'index', 'policy', 'register', 'policy-label', 'scale', 'registration', 'arch-mask', 'visitor-copy', 'aperture', 'sheet-record']
  .map(name => `../${name}.ts`)
const sources = sourcePaths.map(path => {
  const file = fileURLToPath(new URL(path, import.meta.url))
  const text = readFileSync(file, 'utf8')
  const js = ts.transpileModule(text, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }, fileName: file }).outputText
  return { file, text, js, sha256: createHash('sha256').update(text).digest('hex') }
})
const lockedSource = readFileSync(new URL('../data/paintings.json', import.meta.url), 'utf8')
const manifestSnapshotSource = readFileSync(new URL('../data/store-audit.json', import.meta.url), 'utf8')
const manifestSnapshot = JSON.parse(manifestSnapshotSource)
assert.equal(createHash('sha256').update(JSON.stringify(manifestSnapshot.records)).digest('hex'), manifestSnapshot.recordSha256,
  'The controlled real-work fixture requires the exact store snapshot')
const makeIndex = records => ({ all: records, byId: new Map(records.map(entry => [entry.id, entry])) })
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function node(fields = {}) {
  const result = new Proxy(fields, { get(target, key) {
    if (key in target) return target[key]
    if (['rgb', 'r', 'g', 'b', 'xy', 'xyz', 'x', 'y', 'z'].includes(key)) return result
    return () => result
  } })
  return result
}

function fixture(id, tier = null, previewSize = [1024, 512], fullSize = [4096, 2048]) {
  const entry = (role, width, height) => ({
    id: `vinci/${role}/${id}${tier ? `__${width}x${height}` : ''}`, role, work_id: id, wing: 'wing-vinci',
    path: `paintings/${id}/${id}__${width}x${height}.jpg`,
    class: 'PD-ART', display: true, sha256: 'a'.repeat(64),
    licence: 'Public-domain test reproduction', pixels: width * height,
    ...(tier ? { tier, plate_id: id, width, height,
      source_url: `https://example.invalid/source/${id}`,
      honesty_en: 'Policy fixture reproduction.', honesty_de: 'Reproduktion der Prüfdaten.' } : {}),
  })
  const preview = entry('painting-preview', ...previewSize)
  const plate = entry('painting-plate', ...fullSize)
  return {
    id, title_en: id, title_de: id, holder: 'Test collection',
    width_cm: 40, height_cm: 40, rights_class: 'DG', attribution_certainty: 'documented',
    hang: { eye_height_cm: 155 },
    licence_line: plate.licence, label_first_line_en: id, label_first_line_de: id,
    reproduction_note_en: 'Controlled reproduction fixture.', reproduction_note_de: 'Reproduktion der Prüfdaten.',
    entries: [{ id, workId: id, pixels: { width: 1024, height: 512 }, face: 'front', preview, plate }],
  }
}

function harness({ previewMaxEdge = 1024 } = {}) {
  let now = 0, nextTimer = 0, peakHighTextures = 0, peakHighBitmaps = 0
  const textures = [], bitmaps = [], bitmapCalls = [], materials = [], requests = [], timers = new Map(), plans = new Map()
  // Fixed allocations exclude this hang's images, matching its Stack facade.
  const cost = { textureMB: 0, budget: { textureMB: 256 } }
  const isHigh = image => image && Math.max(image.width, image.height) > 1024
  const countHigh = () => textures.filter(t => !t.disposals && isHigh(t.image)).length
  class Texture {
    constructor(image) {
      this.image = image; this.userData = {}; this.disposals = 0; textures.push(this)
      peakHighTextures = Math.max(peakHighTextures, countHigh())
    }
    dispose() { this.disposals++ }
  }
  class DataTexture extends Texture {
    constructor(data, width, height) { super({ data, width, height }) }
  }
  class Material {
    constructor() { this.userData = {}; this.disposals = 0; this.colorNode = node(); this.roughnessNode = node(); materials.push(this) }
    dispose() { this.disposals++ }
  }
  class Element {
    constructor(tagName) {
      this.tagName = tagName; this.dataset = {}; this.children = []; this.hidden = false
      this.style = { setProperty() {} }; this.attributes = {}; this.removed = false
    }
    append(...children) { this.children.push(...children) }
    prepend(...children) { this.children.unshift(...children) }
    replaceChildren(...children) { this.children = [...children] }
    setAttribute(name, value) { this.attributes[name] = value }
    remove() { this.removed = true }
  }
  const gpu = { ...Three, Texture, DataTexture, MeshBasicNodeMaterial: Material, MeshStandardNodeMaterial: Material }
  const tsl = {
    texture: value => node({ value }), uniform: value => node({ value }),
    mix: (a, b, blend) => node({ a, b, blend }),
    vec2: () => node(), vec3: () => node(), uv: () => node(), positionWorld: node(),
    positionGeometry: node(), abs: () => node(), attribute: () => node(), float: () => node(),
    floor: () => node(), min: () => node(), max: () => node(), sin: () => node(),
    smoothstep: () => node(), clamp: () => node(), mx_noise_float: () => node(),
    dot: () => node(), pow: () => node(), normalGeometry: node(),
    length: () => node(), cameraPosition: node(),
  }
  async function fetch(url, { signal }) {
    assert.ok(url.startsWith('/mock-assets/wing-vinci/paintings/'), `Unexpected I/O: ${url}`)
    const plan = plans.get(url) ?? {}
    const request = { url, signal, plan }; requests.push(request)
    signal.throwIfAborted()
    if (plan.fetchGate) {
      await Promise.race([plan.fetchGate.promise, new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })])
      signal.throwIfAborted()
    }
    const match = /__(\d+)x(\d+)\.jpg$/.exec(url)
    assert.ok(match, 'The source requested a non-display filename')
    return { ok: !plan.status, status: plan.status ?? 200, blob: async () => ({
      url, plan, width: Number(match[1]), height: Number(match[2]),
    }) }
  }
  async function createImageBitmap(input, options) {
    const resizing = typeof input.close === 'function'
    const kind = resizing ? 'resize' : 'decode'
    const plan = input.plan
    bitmapCalls.push({ kind, input, options: { ...options } })
    assert.equal(options.imageOrientation, resizing ? 'none' : 'flipY')
    assert.equal(options.colorSpaceConversion, 'none')
    assert.equal(options.premultiplyAlpha, 'none')
    if (resizing) {
      assert.equal(options.resizeQuality, 'high')
      assert.ok(Number.isInteger(options.resizeWidth) && Number.isInteger(options.resizeHeight))
      assert.equal(input.closes, 0, 'The original bitmap was closed before resizing')
      if (plan.resizeGate) await plan.resizeGate.promise
      if (plan.resizeFailure) throw new Error('Controlled preview resize failure')
    } else {
      assert.ok(!('resizeWidth' in options) && !('resizeHeight' in options), 'Declared source dimensions must be decoded before upload resizing')
      if (plan.decodeGate) await plan.decodeGate.promise
    }
    const bitmap = {
      width: resizing ? plan.resizeWidth ?? options.resizeWidth : plan.width ?? input.width,
      height: resizing ? plan.resizeHeight ?? options.resizeHeight : plan.height ?? input.height,
      kind, plan, closes: 0, close() { this.closes++ },
    }
    bitmaps.push(bitmap)
    peakHighBitmaps = Math.max(peakHighBitmaps, bitmaps.filter(b => !b.closes && isHigh(b)).length)
    return bitmap
  }
  const globals = {
    AbortController, Uint8Array, fetch, createImageBitmap,
    performance: { now: () => now }, innerWidth: 1344, innerHeight: 840,
    document: { createElement: tag => new Element(tag) },
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, due: now + delay }); return id },
    clearTimeout: id => timers.delete(id),
  }
  function evaluate(source, dependencies) {
    const exports = {}
    vm.runInNewContext(source.js, { ...globals, exports, require(name) {
      if (name === 'three/webgpu') return gpu
      if (name === 'three') return Three
      if (name === 'three/tsl') return tsl
      if (name in dependencies) return dependencies[name]
      throw new Error(`Unmocked dependency ${name}`)
    } }, { filename: source.file, timeout: 2000 })
    return exports
  }
  const policy = evaluate(sources[2], {})
  const register = evaluate(sources[3], { './policy': policy,
    './data/paintings.json?raw': { default: lockedSource } })
  const registration = evaluate(sources[6], {})
  const archMask = evaluate(sources[7], {})
  const visitorCopy = evaluate(sources[8], {})
  const policyLabel = evaluate(sources[4], { './registration': registration, './visitor-copy': visitorCopy })
  const scale = evaluate(sources[5], {})
  const aperture = evaluate(sources[9], {})
  const sheetRecord = evaluate(sources[10], {})
  const stream = evaluate(sources[0], { '../../../stack/materials': { ASSET_BASE: '/mock-assets/' },
    './policy': policy, './sheet-record': sheetRecord })
  const hang = evaluate(sources[1], {
    // Keep each scheduler fixture's upload policy explicit while executing
    // the actual stream and scheduler, including their allocation contract.
    './stream': { createPlateStream: (preview, full, options) => stream.createPlateStream(preview, full, { ...options, previewMaxEdge }) },
    './register': register,
    './policy': policy,
    './policy-label': policyLabel,
    './registration': registration,
    './arch-mask': archMask,
    './scale': scale,
    './aperture': aperture,
    './frame': { FRAME_MOULDING_WIDTH_M: .052, buildFrameBatch() { return { group: new Three.Group(), setVisible() {}, dispose() {} } } },
    './directional-contact': { buildBakedFrameContact() { return { group: new Three.Group(), setVisible() {}, dispose() {}, stats: {} } } },
  })
  return {
    textures, bitmaps, bitmapCalls, materials, requests, timers, plans, cost,
    create(work, options) { return stream.createPlateStream(work.entries[0].preview, work.entries[0].plate, options) },
    build(works, records = works.flatMap(work => work.entries.flatMap(entry => [entry.preview, entry.plate]))) {
      return hang.buildHang({ tierName: () => 'standard', cost: () => cost, detail() {}, materials: {
      sync: () => ({ albedo: { r: 1, g: 1, b: 1 }, material: () => new Material() }),
    } }, works, makeIndex(records)) },
    url(work, full = true) { return `/mock-assets/wing-vinci/${work.entries[0][full ? 'plate' : 'preview'].path}` },
    async advance(ms = 800) {
      now += ms
      for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.callback() }
      await flush()
    },
    highCount: countHigh,
    peaks: () => ({ textures: peakHighTextures, bitmaps: peakHighBitmaps }),
    released() {
      assert.ok(textures.every(t => t.disposals === 1), 'Each texture must be disposed exactly once')
      assert.ok(bitmaps.every(b => b.closes === 1), 'Each decoded bitmap must be closed exactly once')
      assert.ok(materials.every(m => m.disposals === 1), 'Each material must be disposed exactly once')
      assert.equal(timers.size, 0, 'A fade timer survived disposal')
    },
  }
}

const tests = []
const test = (name, run) => tests.push({ name, run })
test('Unsupported preview caps fail before any image request or owned allocation', () => {
  for (const cap of [0, 1, 128, 256, 513, 2048, -512, NaN, Infinity, '512', null]) {
    const h = harness(), w = fixture('invalid-preview-cap')
    assert.throws(() => h.create(w, { previewMaxEdge: cap }), undefined, `Accepted preview cap ${String(cap)}`)
    assert.equal(h.requests.length, 0); assert.equal(h.bitmapCalls.length, 0)
    assert.equal(h.textures.length, 0); assert.equal(h.materials.length, 0)
    h.released()
  }
  for (const options of [null, [], 512, '512', { resizeWidth: 512 }, { previewMaxEdge: 512, extra: true }]) {
    const h = harness(), w = fixture('invalid-preview-options')
    assert.throws(() => h.create(w, options), /Invalid picture preview upload/)
    assert.equal(h.requests.length, 0); assert.equal(h.bitmapCalls.length, 0)
    assert.equal(h.textures.length, 0); assert.equal(h.materials.length, 0)
    h.released()
  }
})
test('The 512 preview validates the original first, rounds its aspect and publishes actual upload allocation', async () => {
  const h = harness(), w = fixture('rounded-preview', 'TIER2', [671, 1024], [2684, 4096])
  const s = h.create(w, { previewMaxEdge: 512 })
  try {
    assert.equal(s.residency().previewUpload, null)
    assert.equal(s.residency().fullUpload, null)
    assert.equal(s.allocation().previewWidth, 336); assert.equal(s.allocation().previewHeight, 512)
    assert.equal(s.allocation().fullWidth, 2684); assert.equal(s.allocation().fullHeight, 4096)
    // The rounded 336×512 mip pyramid contains 229,363 RGBA8 texels.
    assert.equal(s.allocation().previewMB, 229363 * 4 / 1024 ** 2)
    await s.ready; await h.advance(300)
    assert.deepEqual(h.bitmapCalls.map(call => call.kind), ['decode', 'resize'])
    assert.equal(h.bitmapCalls[1].input, h.bitmaps[0])
    assert.deepEqual(h.bitmapCalls[1].options, {
      resizeWidth: 336, resizeHeight: 512, resizeQuality: 'high',
      imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none',
    })
    assert.equal(h.bitmaps[0].width, 671); assert.equal(h.bitmaps[0].height, 1024)
    assert.equal(h.bitmaps[0].closes, 1, 'Original preview bitmap retained after resizing')
    assert.equal(h.bitmaps[1].closes, 0)
    assert.deepEqual({ ...s.residency().previewUpload }, {
      sourceWidth: 671, sourceHeight: 1024, width: 336, height: 512, maxEdge: 512, downsampled: true,
    })
    const uploaded = h.textures.find(texture => texture.image === h.bitmaps[1])
    assert.equal(uploaded.userData.manifestId, w.entries[0].preview.id)
    assert.equal(uploaded.userData.sourceSha256, w.entries[0].preview.sha256)
    assert.equal(uploaded.colorSpace, Three.SRGBColorSpace); assert.equal(uploaded.flipY, false)
    assert.deepEqual({ ...uploaded.userData.upload }, { ...s.residency().previewUpload })
    s.residency().previewUpload.width = 1
    assert.equal(s.residency().previewUpload.width, 336, 'Residency metadata exposed mutable internal upload dimensions')
    assert.equal(s.textureMB(), s.allocation().previewMB + 4 / 1024 ** 2)
    assert.equal(s.pending(), 0); assert.equal(s.error(), null)
    const high = s.high(true); await flush(); await h.advance(); await high
    assert.deepEqual(h.bitmapCalls.map(call => call.kind), ['decode', 'resize', 'decode'], 'A full plate was resized')
    const full = s.residency().fullUpload
    assert.equal(full.sourceWidth, 2684); assert.equal(full.sourceHeight, 4096)
    assert.equal(full.width, 2684); assert.equal(full.height, 4096); assert.equal(full.downsampled, false); assert.equal(full.maxEdge, 4096)
    const fullTexture = h.textures.find(texture => texture.image === h.bitmaps[2])
    assert.equal(fullTexture.userData.manifestId, w.entries[0].plate.id)
    assert.equal(fullTexture.userData.sourceSha256, w.entries[0].plate.sha256)
    assert.equal(h.bitmaps[2].closes, 0)
    assert.equal(s.textureMB(), s.allocation().previewMB + s.allocation().fullMB + 4 / 1024 ** 2)
  } finally { s.dispose(); h.released() }
  assert.equal(s.residency().previewUpload, null); assert.equal(s.residency().fullUpload, null)
})
test('Default and explicit 1024 uploads preserve the source and a smaller 512 source is never enlarged', async () => {
  for (const [dimensions, options] of [ [[1024, 512], undefined], [[1024, 512], { previewMaxEdge: 1024 }], [[160, 320], { previewMaxEdge: 512 }] ]) {
    const h = harness(), w = fixture('unchanged-preview', null, dimensions, dimensions.map(side => side * 4))
    const s = h.create(w, options)
    try {
      await s.ready; await h.advance(300)
      assert.deepEqual(h.bitmapCalls.map(call => call.kind), ['decode'])
      assert.equal(s.allocation().previewWidth, dimensions[0]); assert.equal(s.allocation().previewHeight, dimensions[1])
      assert.deepEqual({ ...s.residency().previewUpload }, {
        sourceWidth: dimensions[0], sourceHeight: dimensions[1], width: dimensions[0], height: dimensions[1],
        maxEdge: options?.previewMaxEdge ?? 1024, downsampled: false,
      })
      assert.equal(h.bitmaps[0].closes, 0)
    } finally { s.dispose(); h.released() }
  }
})
test('Wrong original preview dimensions are rejected before resize can conceal the mismatch', async () => {
  const h = harness(), w = fixture('wrong-source-dimensions')
  h.plans.set(h.url(w, false), { width: 1023 })
  const s = h.create(w, { previewMaxEdge: 512 })
  try {
    await s.ready
    assert.deepEqual(h.bitmapCalls.map(call => call.kind), ['decode'])
    assert.equal(h.bitmaps[0].closes, 1)
    assert.equal(s.available(), false); assert.equal(s.pending(), 0)
    assert.match(s.error(), /dimensions disagree/i)
    assert.equal(s.residency().previewUpload, null)
  } finally { s.dispose(); h.released() }
})
test('Wrong resized output dimensions close both bitmaps and never publish a texture', async () => {
  const h = harness(), w = fixture('wrong-resized-dimensions')
  h.plans.set(h.url(w, false), { resizeWidth: 511 })
  const s = h.create(w, { previewMaxEdge: 512 })
  try {
    await s.ready
    assert.deepEqual(h.bitmapCalls.map(call => call.kind), ['decode', 'resize'])
    assert.equal(h.bitmaps.length, 2); assert.ok(h.bitmaps.every(bitmap => bitmap.closes === 1))
    assert.equal(h.textures.length, 1, 'A wrong-size preview received a GPU texture')
    assert.equal(s.available(), false); assert.equal(s.pending(), 0)
    assert.match(s.error(), /dimensions disagree/i)
    assert.equal(s.residency().previewUpload, null)
  } finally { s.dispose(); h.released() }
})
test('Disposal during a non-cancellable preview resize closes the original and late resized bitmap once', async () => {
  const h = harness(), w = fixture('aborted-preview-resize'), gate = deferred()
  h.plans.set(h.url(w, false), { resizeGate: gate })
  const s = h.create(w, { previewMaxEdge: 512 })
  await flush()
  assert.deepEqual(h.bitmapCalls.map(call => call.kind), ['decode', 'resize'])
  assert.equal(h.bitmaps.length, 1); assert.equal(h.bitmaps[0].closes, 0)
  s.dispose(); s.dispose()
  assert.equal(h.requests[0].signal.aborted, true)
  gate.resolve(); await s.ready
  assert.equal(h.bitmaps.length, 2); assert.ok(h.bitmaps.every(bitmap => bitmap.closes === 1))
  assert.equal(h.textures.length, 1, 'The late resize resurrected a GPU resource')
  assert.equal(s.pending(), 0); assert.equal(s.textureMB(), 0); assert.equal(s.available(), false)
  assert.equal(s.residency().previewUpload, null)
  h.released()
})
test('A failed preview resize closes its decoded input and settles with an observable error', async () => {
  const h = harness(), w = fixture('failed-preview-resize')
  h.plans.set(h.url(w, false), { resizeFailure: true })
  const s = h.create(w, { previewMaxEdge: 512 })
  try {
    await s.ready
    assert.deepEqual(h.bitmapCalls.map(call => call.kind), ['decode', 'resize'])
    assert.equal(h.bitmaps.length, 1); assert.equal(h.bitmaps[0].closes, 1)
    assert.equal(s.available(), false); assert.equal(s.pending(), 0)
    assert.match(s.error(), /Controlled preview resize failure/)
    assert.equal(s.residency().previewUpload, null)
    await s.high(true); assert.equal(h.requests.length, 1, 'Full plate bypassed the failed preview')
  } finally { s.dispose(); h.released() }
})
test('Invalid display metadata is rejected before requests or texture allocation', () => {
  const mutations = [
    { class: 'REFERENCE-ONLY' }, { class: 'RC' }, { class: 'GENERATED' },
    { display: false }, { sha256: 'bad' }, { licence: '' }, { wing: 'lobby' },
    { work_id: 'other-work' }, { path: '../held-drawer/uncleared' + '.' + ['j', 'p', 'g'].join('') },
    { role: 'painting-plate' }, { pixels: 1 },
  ]
  for (const mutation of mutations) {
    const h = harness(), w = fixture('invalid-metadata')
    w.entries[0].preview = { ...w.entries[0].preview, ...mutation }
    assert.throws(() => h.create(w), /Inadmissible|dimensions disagree/, JSON.stringify(mutation))
    assert.equal(h.requests.length, 0, 'Rejected metadata started a request')
    assert.equal(h.textures.length, 0, 'Rejected metadata allocated a texture')
    assert.equal(h.materials.length, 0, 'Rejected metadata allocated a material')
    h.released()
  }
})
test('Incomplete policy metadata and different source identities cannot start a stream', () => {
  const mutations = [
    { tier: 'TIER3' }, { honesty_en: '' }, { honesty_de: '' }, { source_url: '' },
    { plate_id: 'another-work' }, { width: 17 },
  ]
  for (const mutation of mutations) {
    const h = harness(), w = fixture('invalid-policy', 'TIER2')
    w.entries[0].preview = { ...w.entries[0].preview, ...mutation }
    assert.throws(() => h.create(w), /policy|dimensions disagree/, JSON.stringify(mutation))
    assert.equal(h.requests.length, 0); assert.equal(h.textures.length, 0)
    h.released()
  }
  const h = harness(), w = fixture('source-identity', 'TIER1')
  w.entries[0].plate = fixture('different-source', 'TIER1').entries[0].plate
  assert.throws(() => h.create(w), /different works/)
  assert.equal(h.requests.length, 0); assert.equal(h.textures.length, 0)
  h.released()
})
test('A later rejected policy record prevents the complete hang from allocating or fetching', () => {
  const h = harness(), works = [fixture('valid-first'), fixture('invalid-later', 'TIER2')]
  works[1].entries[0].plate.display = false
  assert.throws(() => h.build(works), /Inadmissible/)
  assert.equal(h.requests.length, 0); assert.equal(h.textures.length, 0); assert.equal(h.materials.length, 0)
  h.released()
})
test('A legacy RC record and unmanifested held scan metadata stay absent without requests', () => {
  const h = harness(), w = fixture('legacy-excluded')
  w.rights_class = 'RC'
  w.held_scan_files = ['uncleared-modern-photo' + '.' + ['j', 'p', 'g'].join('')]
  w.plate_file = 'uncleared-modern-photo' + '.' + ['j', 'p', 'g'].join('')
  const hang = h.build([w])
  assert.equal(hang.frames[0].cards.length, 0)
  assert.equal(h.requests.length, 0); assert.equal(h.textures.length, 0)
  hang.dispose(); h.released()
})
for (const tier of ['TIER1', 'TIER2']) test(`${tier} admits a source for a historical RC work and fetches only the manifested derivatives`, async () => {
  const h = harness(), w = fixture(`policy-${tier.toLowerCase()}`, tier)
  w.rights_class = 'RC'
  w.held_scan_files = ['uncleared-modern-photo' + '.' + ['j', 'p', 'g'].join('')]
  const hang = h.build([w]), card = hang.frames[0].cards[0]
  assert.equal(hang.frames[0].cards.length, 1)
  assert.equal(card.entry.policyTier, tier)
  await card.stream.ready; await h.advance(300)
  const high = card.stream.high(true); await flush(); await h.advance(); await high
  assert.deepEqual(h.requests.map(request => request.url), [h.url(w, false), h.url(w)])
  assert.equal(card.stream.error(), null); assert.equal(card.stream.pending(), 0)
  hang.dispose(); h.released()
})
test('preview readiness, exact non-square mip accounting and continuous upgrade', async () => {
  const h = harness(), w = fixture('readiness'), s = h.create(w)
  assert.equal(s.pending(), 1)
  await s.ready
  assert.equal(s.pending(), 1, 'First arrival remains pending after decode')
  await h.advance(300)
  assert.equal(s.pending(), 0); assert.equal(s.error(), null)
  // 1024×512 down to 2×1 and 1×1: 699051 RGBA texels + one placeholder.
  assert.equal(s.textureMB(), (699051 * 4 + 4) / 1024 ** 2)
  const high = s.high(true); await flush()
  assert.equal(h.highCount(), 1); assert.equal(s.pending(), 1)
  await h.advance(350); s.update(.35)
  const blend = s.material.colorNode.blend.value
  assert.ok(blend > 0 && blend < 1, 'Resolution changed without an intermediate blend')
  await h.advance(400); await high
  assert.equal(s.pending(), 0)
  s.dispose(); s.dispose(); h.released()
})
test('resize/selection during an upgrade keeps the ready preview visible', async () => {
  const h = harness(), w = fixture('pending-visible'), hang = h.build([w])
  const card = hang.frames[0].cards[0]
  await card.stream.ready; await flush()
  assert.equal(card.mesh.visible, true)
  const high = card.stream.high(true); await flush()
  assert.ok(card.stream.pending() > 0)
  hang.setVisible([w.id])
  assert.equal(card.mesh.visible, true, 'A nonfatal pending upgrade hid the ready reproduction')
  await h.advance(); await high
  hang.dispose(); h.released()
})
test('failed full image preserves the healthy preview and remains observable', async () => {
  const h = harness(), w = fixture('full-failure')
  h.plans.set(h.url(w), { status: 503 })
  const hang = h.build([w]), card = hang.frames[0].cards[0]
  await card.stream.ready; await card.stream.high(true)
  await h.advance(300)
  assert.equal(card.stream.pending(), 0)
  hang.setVisible([w.id])
  assert.equal(card.mesh.visible, true, 'Optional full-image failure hid a healthy preview')
  assert.ok(hang.errors().some(error => /503/.test(error)), 'Upgrade failure disappeared from diagnostics')
  assert.equal(h.highCount(), 0)
  hang.dispose(); h.released()
})
test('failed preview settles, exposes its error and never displays the placeholder', async () => {
  const h = harness(), w = fixture('preview-failure')
  h.plans.set(h.url(w, false), { status: 404 })
  const hang = h.build([w]), card = hang.frames[0].cards[0]
  await card.stream.ready; await flush(); hang.setVisible([w.id])
  assert.equal(card.mesh.visible, false); assert.equal(card.stream.pending(), 0)
  assert.match(card.stream.error(), /404/)
  await card.stream.high(true); assert.equal(h.requests.length, 1)
  hang.dispose(); h.released()
})
test('leaving aborts an in-flight preview fetch', async () => {
  const h = harness(), w = fixture('abort-preview'), gate = deferred()
  h.plans.set(h.url(w, false), { fetchGate: gate })
  const s = h.create(w); await flush(); s.dispose(); await s.ready
  assert.equal(h.requests[0].signal.aborted, true)
  assert.equal(s.pending(), 0); assert.equal(s.textureMB(), 0)
  h.released()
})
test('leaving during non-cancellable 4K decode closes the late bitmap', async () => {
  const h = harness(), w = fixture('late-decode'), gate = deferred()
  h.plans.set(h.url(w), { decodeGate: gate })
  const s = h.create(w); await s.ready
  const high = s.high(true); await flush(); s.dispose(); gate.resolve(); await high
  assert.equal(h.bitmaps.length, 2)
  assert.equal(h.highCount(), 0); assert.equal(s.pending(), 0); assert.equal(s.textureMB(), 0)
  h.released()
})
test('nearest handoff waits for release, calm clears 4K and no two plates reside', async () => {
  const h = harness(), works = [fixture('nearest-a'), fixture('nearest-b')], hang = h.build(works)
  const [a, b] = hang.frames.map(f => f.cards[0])
  await Promise.all([a.stream.ready, b.stream.ready]); await flush()
  const camera = new Three.PerspectiveCamera(40, 1344 / 840, .03, 100)
  const visit = card => {
    camera.position.set(card.mesh.position.x, 1.55, 1.2)
    hang.update(camera, .016); hang.stream('standard')
  }
  visit(a); await flush(); await h.advance()
  assert.equal(h.highCount(), 1)
  visit(b); await flush()
  assert.equal(h.requests.filter(r => r.url === h.url(works[1])).length, 0, 'Next plate started before prior fade released its slot')
  await h.advance(); await h.advance()
  assert.equal(h.highCount(), 1)
  assert.equal(h.requests.filter(r => r.url === h.url(works[1])).length, 1)
  hang.stream('calm'); await flush(); await h.advance()
  assert.equal(h.highCount(), 0)
  assert.ok(h.peaks().textures <= 1 && h.peaks().bitmaps <= 1, 'More than one full image resided during handoff')
  hang.dispose(); h.released()
})
test('budget reserves pending previews, refuses 4K fetch, then grants the unchanged nearest work at the exact limit', async () => {
  const h = harness(), works = [fixture('budget-near'), fixture('budget-pending')], gate = deferred()
  h.plans.set(h.url(works[1], false), { fetchGate: gate })
  const hang = h.build(works), [a, b] = hang.frames.map(f => f.cards[0])
  await a.stream.ready; await flush()
  assert.equal(b.stream.pending(), 1, 'The second preview must still be in flight')
  assert.equal(a.stream.allocation().previewMB, 699051 * 4 / 1024 ** 2)
  assert.equal(a.stream.allocation().fullMB, 11184811 * 4 / 1024 ** 2)
  const reservedPreviews = [a, b].reduce((sum, card) => sum + card.stream.allocation().previewMB + 4 / 1024 ** 2, 0)
  const required = reservedPreviews + a.stream.allocation().fullMB
  const oneByteMB = 1 / 1024 ** 2
  h.cost.textureMB = h.cost.budget.textureMB - required + oneByteMB
  const camera = new Three.PerspectiveCamera(40, 1.6, .03, 100)
  camera.position.set(a.mesh.position.x, 1.55, 1.2)
  hang.update(camera, .016); await flush(); await h.advance()
  assert.equal(h.requests.filter(r => r.url === h.url(works[0])).length, 0, 'A full image was fetched one byte beyond the budget')
  assert.equal(a.stream.residency().full, false)
  assert.equal(a.mesh.visible, true, 'Budget refusal hid the preview')
  // Neither camera nor nearest identity changes: budget availability alone
  // must re-evaluate the admission decision and grant the formerly refused slot.
  h.cost.textureMB -= oneByteMB
  hang.stream('standard'); await flush(); await h.advance()
  assert.equal(h.requests.filter(r => r.url === h.url(works[0])).length, 1)
  assert.equal(a.stream.residency().full, true)
  assert.equal(a.stream.residency().blending, false)
  assert.equal(h.cost.textureMB + required, h.cost.budget.textureMB)
  assert.equal(b.stream.residency().preview, false, 'The reservation test accidentally loaded its pending preview')
  // A later fixed-allocation increase revokes admission and releases the full
  // image after the fade, while the original preview remains usable.
  h.cost.textureMB += oneByteMB
  hang.stream('standard'); await flush(); await h.advance()
  assert.equal(a.stream.residency().full, false)
  assert.equal(a.mesh.visible, true)
  assert.equal(h.highCount(), 0)
  gate.resolve(); await b.stream.ready
  hang.dispose(); h.released()
})
test('The one-full scheduler reserves actual 512 preview mip allocations even while a resize is pending', async () => {
  const h = harness({ previewMaxEdge: 512 }), works = [fixture('capped-budget-near'), fixture('capped-budget-pending')]
  const gate = deferred()
  h.plans.set(h.url(works[1], false), { resizeGate: gate })
  const hang = h.build(works), [a, b] = hang.frames.map(frame => frame.cards[0])
  try {
    await a.stream.ready; await flush(); await h.advance(300)
    assert.equal(b.stream.residency().preview, false); assert.equal(b.stream.pending(), 1)
    assert.equal(h.bitmapCalls.filter(call => call.kind === 'resize').length, 2)
    // 512×256 to 2×1 and 1×1 contains 174,763 RGBA8 texels.
    assert.equal(a.stream.allocation().previewMB, 174763 * 4 / 1024 ** 2)
    assert.equal(a.stream.allocation().fullMB, 11184811 * 4 / 1024 ** 2)
    const previews = [a, b].reduce((sum, card) => sum + card.stream.allocation().previewMB + 4 / 1024 ** 2, 0)
    const required = previews + a.stream.allocation().fullMB, oneByte = 1 / 1024 ** 2
    h.cost.textureMB = h.cost.budget.textureMB - required + oneByte
    const camera = new Three.PerspectiveCamera(40, 1.6, .03, 100)
    camera.position.set(a.mesh.position.x, 1.55, 1.2)
    hang.update(camera, .016); hang.stream('standard'); await flush(); await h.advance()
    assert.equal(h.requests.filter(request => request.url === h.url(works[0])).length, 0)
    h.cost.textureMB -= oneByte
    hang.stream('standard'); await flush(); await h.advance()
    assert.equal(h.requests.filter(request => request.url === h.url(works[0])).length, 1,
      'The scheduler charged 1024 pixels for a 512 upload and refused the affordable full plate')
    assert.equal(h.cost.textureMB + required, h.cost.budget.textureMB)
    assert.equal(a.stream.residency().full, true); assert.equal(h.highCount(), 1)
    assert.equal(b.stream.residency().preview, false, 'The pending resize reservation test settled too early')
    gate.resolve(); await b.stream.ready; await h.advance(300)
    camera.position.set(b.mesh.position.x, 1.55, 1.2)
    hang.update(camera, .016); await flush()
    assert.equal(h.requests.filter(request => request.url === h.url(works[1])).length, 0, 'Handoff started before release')
    await h.advance(); await h.advance()
    assert.equal(h.requests.filter(request => request.url === h.url(works[1])).length, 1)
    assert.equal(h.highCount(), 1)
    assert.ok(h.peaks().textures <= 1 && h.peaks().bitmaps <= 1, 'Capped previews allowed two full plates to reside')
    hang.stream('calm'); await flush(); await h.advance()
    assert.equal(h.highCount(), 0)
    assert.equal(a.stream.residency().preview, true); assert.equal(b.stream.residency().preview, true)
  } finally { gate.resolve(); await flush(); hang.dispose(); await flush(); h.released() }
})
test('Ginevra reverse, unmeasured Sala and the Benois arch keep distinct image resources through visibility and cleanup', async () => {
  const ids = ['ginevra-de-benci', 'sala-delle-asse', 'benois-madonna']
  const locked = JSON.parse(lockedSource).works
  const works = ids.map(id => { const work = locked.find(work => work.id === id); assert.ok(work, id); return work })
  const h = harness({ previewMaxEdge: 512 }), hang = h.build(works, manifestSnapshot.records)
  try {
    const [ginevra, sala, benois] = hang.frames
    await Promise.all(hang.frames.flatMap(frame => frame.cards.map(card => card.stream.ready)))
    await h.advance(300)
    assert.equal(ginevra.cards.length, 2)
    assert.deepEqual(Array.from(ginevra.cards, card => card.entry.face), ['front', 'reverse'])
    assert.equal(new Set(ginevra.cards.map(card => card.entry.plate.id)).size, 2)
    assert.ok(ginevra.furniture.getObjectByName('measured-reverse-aperture/ginevra-de-benci'), 'The second image lost its reverse mount')
    assert.equal(sala.aperture, null, 'Document carrier invented a measured painting aperture')
    const document = sala.furniture.getObjectByName('unmeasured-document-mount/sala-delle-asse')
    assert.ok(document); assert.equal(document.userData.physicalPaintingExtent, null)
    assert.equal(sala.cards.length, 1)
    assert.ok(benois.furniture.getObjectByName(`source-shoulder-mat/${benois.cards[0].entry.id}`), 'The current Benois source lost its traced shoulder mat')
    assert.equal(h.requests.length, 4, 'A mount fetched extra source images or lost an admitted preview')
    hang.setVisible(['ginevra-de-benci'])
    assert.ok(ginevra.cards.every(card => card.mesh.visible), 'Selecting the object hid its reverse stream')
    assert.equal(sala.cards[0].mesh.visible, false); assert.equal(benois.cards[0].mesh.visible, false)
    assert.ok(hang.frames.flatMap(frame => frame.cards).every(card => card.stream.residency().preview),
      'Visibility released a preview required for returning to the work')
    hang.setVisible(['sala-delle-asse'])
    assert.equal(sala.cards[0].mesh.visible, true); assert.ok(ginevra.cards.every(card => !card.mesh.visible))
    assert.equal(hang.pending(), 0); assert.equal(hang.errors().length, 0)
  } finally { hang.dispose(); hang.dispose(); h.released() }
})
test('rapid nearest reversals cancel obsolete requests without leaking decoded images', async () => {
  const h = harness(), works = [fixture('rapid-a'), fixture('rapid-b')], hang = h.build(works)
  const [a, b] = hang.frames.map(f => f.cards[0]), gate = deferred()
  h.plans.set(h.url(works[0]), { decodeGate: gate })
  await Promise.all([a.stream.ready, b.stream.ready]); await flush()
  const camera = new Three.PerspectiveCamera(40, 1.6, .03, 100)
  const visit = card => { camera.position.set(card.mesh.position.x, 1.55, 1.2); hang.update(camera, .016) }
  visit(a); await flush(); visit(b); await flush(); visit(a); await flush()
  gate.resolve(); await flush(); await h.advance(); await h.advance()
  assert.ok(h.peaks().textures <= 1 && h.peaks().bitmaps <= 1)
  assert.equal(h.requests.filter(r => r.url === h.url(works[1])).length, 0, 'Obsolete nearest selection still fetched its full image')
  hang.dispose(); await flush(); h.released()
})

const results = []
for (const { name, run } of tests) {
  try { await run(); results.push({ name, ok: true }) }
  catch (error) { results.push({ name, ok: false, error: error.stack ?? String(error) }) }
}
const report = {
  kind: 'isolated-source-stream-check', browser: false, network: false,
  sources: sources.map(({ file, sha256 }) => ({ file, sha256 })),
  registerSha256: createHash('sha256').update(lockedSource).digest('hex'),
  manifestSnapshotSha256: createHash('sha256').update(manifestSnapshotSource).digest('hex'),
  ok: results.every(result => result.ok), passed: results.filter(result => result.ok).length,
  total: results.length, results,
}
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
