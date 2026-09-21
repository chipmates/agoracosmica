#!/usr/bin/env node
/** Offline integration check: real room placement, register, policy, windows
 * and geometry; deterministic streams exercise room-wide handoff and teardown.
 * Real decoding and 240/700 ms fades are covered by the picture stream checks.
 * This check does not claim rendered light, browser residency or frame costs. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import * as THREE from 'three/webgpu'
/* The wing's finishes are written in TSL, which is the same package under its
   own subpath: a module of the room may reach for it as it reaches for three. */
import * as TSL from 'three/tsl'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const raw = JSON.parse(source('public/na-manifest.json'))
const all = Array.isArray(raw) ? raw : raw.assets
const manifest = { all, byId: new Map(all.map(entry => [entry.id, entry])), forPath: () => undefined }
let tier = 'standard', otherMiB = 0, holdRelease = false
const memory = new Set(), streams = [], releases = [], messages = []
const memoryTotal = () => [...memory].reduce((sum, measure) => sum + measure(), 0)
const fullCount = () => streams.filter(stream => !stream.disposed && stream.full).length
const stack = {
  tierName: () => tier,
  registerTextureMemory(measure) { memory.add(measure); return () => memory.delete(measure) },
  cost: () => ({ textureMB: otherMiB + memoryTotal(), budget: { textureMB: 256 } }),
}
function fakeStream(preview, full, options) {
  const state = { preview, plate: full, options, full: false, disposed: false, error: null }
  const api = {
    ...state,
    material: new THREE.MeshBasicNodeMaterial(), ready: Promise.resolve(),
    available() { return !api.disposed }, update() {},
    allocation: () => ({ previewMB: 1, fullMB: 32 }),
    textureMB: () => api.disposed ? 0 : 1 + (api.full ? 32 : 0),
    error: () => api.failure ?? null,
    pending: () => 0,
    high(enable) {
      if (api.disposed) return Promise.resolve()
      if (!enable && api.full && holdRelease) return new Promise(resolve => {
        releases.push(() => { api.full = false; resolve() })
      })
      api.full = enable
      assert.ok(fullCount() <= 1, 'a second full source was granted before release')
      return Promise.resolve()
    },
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
    if (specifier === 'three' || specifier === 'three/webgpu') return THREE
    if (specifier === 'three/tsl') return TSL
    if (!specifier.startsWith('.')) throw new Error(`Unexpected import: ${specifier}`)
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier))
    if (resolved.endsWith('?raw')) return { default: source(resolved.slice(0, -4)) }
    const file = fs.existsSync(path.join(root, resolved + '.ts')) ? resolved + '.ts' : resolved + '/index.ts'
    return load(file)
  }
  vm.runInNewContext(compiled, { module, exports: module.exports, require,
    console: { ...console, error: message => messages.push(message) } }, { filename: relative })
  return module.exports
}
const { HANG, hangPlacements, buildHang, buildBodyWall } = load('src/wings/vinci/collection/hang.ts')
const { BODY_WALL, bodyMounts } = load('src/wings/vinci/collection/body-wall.ts')
const { mountCollectionPlates } = load('src/wings/vinci/collection/plates.ts')
const { getWork } = load('src/wings/vinci/pictures/register.ts')
const { COURT, FACE, FLOOR, HANG_DATUM, SUPPER_WALL } = load('src/wings/vinci/collection/layout.ts')
const host = new THREE.Group()
const hang = mountCollectionPlates(host, stack)
assert.ok(hang.pending() > 0, 'manifest loading must prevent a settled reading')
assert.equal(memory.size, 1)
await hang.ready
const tick = async (eye = new THREE.Vector3(0, 0, 0)) => {
  hang.update(1 / 60, eye)
  for (let turn = 0; turn < 8; turn++) await Promise.resolve()
}
await tick()
assert.equal(hang.errors().length, 0)
const CARDS = 26 + BODY_WALL.length
assert.equal(hang.sources().length, 26, 'every field on the picture wall and the admitted mural mount')
assert.equal(new Set(hang.sources().map(source => source.entry.plate.id)).size, 26)
assert.equal(hang.sheets().length, 29, 'the body wall mounts every sheet its register admits')
assert.equal(new Set(hang.sheets().map(source => source.page.id)).size, 29)
assert.equal(streams.length, CARDS)
assert.ok(streams.every(stream => stream.options.previewMaxEdge === 512))
// No field on either wall is withheld: the store's register is the only
// admission decision, and a work it does not admit leaves the wall entirely.
assert.equal(HANG.filter(work => 'withheld' in work).length, 0)
assert.equal(HANG.length, 25)
for (const source of hang.sources())
  assert.ok(source.entry.plate.sha256, `no hashed plate behind ${source.work.id}`)
for (const field of HANG) {
  const work = getWork(field.id)
  assert.equal(field.width, work.width_cm / 100, `holder width: ${work.id}`)
  assert.equal(field.height, work.height_cm / 100, `holder height: ${work.id}`)
}
const room = hangPlacements()
// These are the original physical slots, before the holder correction. The
// newer Lansdowne extent may change its frame but no neighbour's position.
const originalWidths = [151,217,37,37,48.5,33,75,240,60,122,32,40.3,45,33,104.6,36.9,36.4,63.6,53.4,120,113,45.7,56.3,21,115].map(cm => cm / 100)
const total = originalWidths.reduce((sum, width) => sum + width + .16, 0)
const gap = (-25 - -59.6 - total) / 24
// THE WALL IS LAID FROM ITS EAST END, the end a visitor comes in by, so the
// earliest work hangs at the door. The slot widths and the gap are unchanged,
// which is what keeps every neighbour in the same place relative to the rest.
let east = -25
for (let i = 0; i < originalWidths.length; i++) {
  const centre = east - .08 - originalWidths[i] / 2
  assert.equal(room[i].east, centre)
  assert.equal(room[i].datum, HANG_DATUM)
  assert.equal(room[i].north, FACE.pictureWallNorth + .033 + .0165)
  east = centre - originalWidths[i] / 2 - .08 - gap
}
const lansdowne = HANG.find(work => work.id === 'yarnwinder-lansdowne')
assert.equal(lansdowne.width, .371)
assert.equal(lansdowne.height, .495)
assert.equal(lansdowne.width * 100, getWork(lansdowne.id).width_cm)
// Snapshot re-taken at the rehang: every field now carries its pale board
// and its moulding stands on the 12 mm standoff, so the fourteen that used to
// be empty changed their own boxes. The centre loop above is what proves no
// neighbour moved. Lansdowne's eleven holder-corrected boxes stay outside the
// snapshot, as they were before. Re-taken again when the Adoration's height
// and width were untransposed: its own eleven boxes, and no others, moved.
// Re-taken at the reversal, where the wall is laid from its east end instead
// of its west: every field is mirrored about the span, so every box moved and
// the loop above is what proves the spacing between them did not.
const boxes = [], retainedBoxes = []
buildHang({ box: (...args) => boxes.push(args) })
let offset = 0
for (const field of HANG) {
  if (field.id !== 'yarnwinder-lansdowne') retainedBoxes.push(...boxes.slice(offset, offset + 11))
  offset += 11
}
assert.equal(boxes.length, 275)
assert.equal(retainedBoxes.length, 264)
assert.equal(createHash('sha256').update(JSON.stringify(retainedBoxes)).digest('hex'),
  'f11d88b8dcf1d3dc5601b86777635feaf47a60cf3a8e7ff823d3ce52e244a8dc')
// The body wall builds one carrier per admitted sheet, and nothing else.
const bodyBoxes = []
buildBodyWall({ box: (...args) => bodyBoxes.push(args) })
assert.equal(bodyBoxes.length, BODY_WALL.length * 5 + 4)
// A sheet the holder sizes hangs at that size; one without a size keeps its
// reproduction's proportion. No moulding comes within 8 cm of another, and
// the lowest clears the reading ledge's contact line by a hand's width.
const sizes = JSON.parse(source('src/wings/vinci/data/sheet-sizes.json')).sheets
const mounts = bodyMounts()
for (const mount of mounts) {
  const size = sizes[mount.id]
  assert.ok(size, `no size record: ${mount.id}`)
  assert.ok(mount.width > 0 && mount.height > 0)
  if (size.heightCm === null) {
    assert.equal(mount.measured, undefined)
    assert.ok(Math.abs(mount.width / mount.height - mount.pixels.width / mount.pixels.height) < 1e-9,
      `a carrier must take its sheet's proportion: ${mount.id}`)
  } else {
    assert.ok(Math.abs(mount.width - size.widthCm / 100) < 1e-12 && Math.abs(mount.height - size.heightCm / 100) < 1e-12,
      `a carrier must be the holder's size: ${mount.id}`)
  }
}
const measured = mounts.filter(mount => mount.measured)
assert.equal(measured.length, 26)
const outline = mount => ({ south: mount.north - mount.width / 2 - .028, north: mount.north + mount.width / 2 + .028,
  low: mount.datum - mount.height / 2 - .028, high: mount.datum + mount.height / 2 + .028 })
for (const a of mounts) for (const b of mounts) if (a !== b) {
  const A = outline(a), B = outline(b)
  assert.ok(Math.max(B.south - A.north, A.south - B.north, B.low - A.high, A.low - B.high) >= .08 - 1e-9,
    `carriers crowd each other: ${a.id}, ${b.id}`)
}
assert.ok(Math.min(...mounts.map(mount => outline(mount).low)) >= FLOOR + .945 + .1, 'a sheet is read over the reading ledge')
const group = host.getObjectByName('vinci/collection-plates')
const cards = group.children.filter(mesh => mesh.userData.previewId)
assert.equal(cards.length, CARDS)
assert.equal(cards.filter(card => card.userData.sheetId).length, 29)
for (const card of cards) {
  const field = card.userData.measuredField ?? card.userData.carrier
  card.geometry.computeBoundingBox()
  const size = card.geometry.boundingBox.getSize(new THREE.Vector3())
  assert.ok(size.x <= field.widthM + 1e-6 && size.y <= field.heightM + 1e-6)
  assert.equal(card.userData.physicalRegistration, false)
  assert.equal(card.castShadow, false)
  const normal = new THREE.Vector3().fromBufferAttribute(card.geometry.getAttribute('normal'), 0).applyEuler(card.rotation)
  const acrossTheRoom = card.userData.workId === 'last-supper' || card.userData.sheetId
  const expected = acrossTheRoom ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, -1)
  assert.ok(normal.distanceTo(expected) < 1e-12, 'source must face out of its own room wall')
}
// A sized sheet's card carries the holder's centimetres; the source is
// contained inside its carrier without stretching.
const vortex = cards.find(card => card.userData.sheetId === 'rcin-919082')
assert.equal(vortex.userData.measuredSheet.widthCm, 20.4)
assert.equal(vortex.userData.measuredSheet.heightCm, 28.3)
assert.ok(cards.filter(card => card.userData.sheetId).every(card => (card.userData.measuredSheet === null)
  === (sizes[card.userData.sheetId].heightCm === null)))
const mural = cards.find(card => card.userData.workId === 'last-supper')
assert.equal(mural.rotation.y, Math.PI / 2)
assert.equal(mural.position.x, SUPPER_WALL.east + SUPPER_WALL.thickness / 2 + .0005)
assert.equal(mural.position.y, COURT.level + SUPPER_WALL.field.sill + SUPPER_WALL.field.height / 2)
const near = card => card.position.clone().add(new THREE.Vector3(0, 0, 1).applyEuler(card.rotation))
const first = cards.find(card => card.userData.workId === 'madonna-of-the-carnation')
await tick(near(first))
assert.equal(fullCount(), 1)
assert.ok(streams.find(stream => stream.plate.id === first.userData.manifestId).full)
holdRelease = true
await tick(near(mural))
assert.equal(fullCount(), 1)
assert.ok(!streams.find(stream => stream.plate.id === mural.userData.manifestId).full,
  'mural must wait for the picture room full source to release')
assert.ok(hang.pending() > 0)
assert.equal(memoryTotal(), CARDS + 32, 'the fading old full texture stays counted exactly once')
holdRelease = false
for (const release of releases.splice(0)) release()
await tick(near(mural))
assert.ok(streams.find(stream => stream.plate.id === mural.userData.manifestId).full)
assert.equal(memoryTotal(), CARDS + 32)
// Other page allocations remain in the calculation: the room cannot earn a
// source by forgetting the rest of the wing's textures.
otherMiB = 250
await tick(near(mural))
assert.equal(fullCount(), 0)
otherMiB = 0
await tick(near(first))
assert.equal(fullCount(), 1)
holdRelease = true
await tick(near(mural))
assert.ok(hang.pending() > 0)
tier = 'hero'
await tick()
assert.equal(streams.filter(stream => !stream.disposed).length, CARDS)
assert.ok(streams.filter(stream => !stream.disposed).every(stream => stream.options.previewMaxEdge === 1024))
holdRelease = false
for (const release of releases.splice(0)) release()
await tick()
assert.equal(fullCount(), 0, 'a superseded tier may not grant its delayed full slot')
assert.equal(memoryTotal(), CARDS)
tier = 'calm'
await tick(near(mural))
assert.equal(fullCount(), 0)
assert.ok(streams.filter(stream => !stream.disposed).every(stream => stream.options.previewMaxEdge === 512))
tier = 'standard'
await tick()
assert.equal(memoryTotal(), CARDS)
assert.equal(streams.length, CARDS * 4)
const broken = streams.find(stream => !stream.disposed)
broken.failure = 'simulated optional full source failure'
await tick()
await tick()
assert.deepEqual([...hang.errors()], ['simulated optional full source failure'])
assert.equal(messages.length, 1, 'a stream failure must reach gates once')
hang.dispose()
hang.dispose()
assert.equal(memory.size, 0)
assert.equal(hang.pending(), 0)
assert.equal(hang.textureMB(), 0)
assert.equal(host.children.length, 0)
assert.ok(streams.every(stream => stream.disposed))
// A departure while the manifest is pending may not mount late geometry.
const departing = mountCollectionPlates(host, stack)
departing.dispose()
await departing.ready
assert.equal(host.children.length, 0)
assert.equal(memory.size, 0)
console.log(JSON.stringify({ checker: 'collection-picture-integration', ok: true,
  plates: 25, murals: 1, sheets: 29, withheldFields: 0, retainedFrameCentres: 25,
  tierRemounts: 3, maximumFullSources: 1, memoryRegistration: 'once and disposed',
  limitations: ['Simulated stream lifecycle; no browser, illumination, decoding or rendered cost measurement.'] }, null, 2))
