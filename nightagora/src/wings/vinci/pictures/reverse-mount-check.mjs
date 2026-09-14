#!/usr/bin/env node
/** Execute the actual hang, swept frames and directional-contact geometry.
 * Only the DOM, material-library inputs and asynchronous image transport are
 * doubles. No browser, GPU, network or source-image mutation is involved.
 * Optional --candidate=... checks a reviewable index source before integration.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
import * as Three from 'three/webgpu'
import * as TSL from 'three/tsl'

const pictureDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(pictureDir, '../../../..')
const indexPath = path.join(pictureDir, 'index.ts')
const candidateArg = process.argv.find(arg => arg.startsWith('--candidate='))
const entryPath = candidateArg ? path.resolve(root, candidateArg.slice('--candidate='.length)) : indexPath
assert(entryPath.startsWith(root + path.sep), 'Candidate read must stay inside this app')
const streams = [], modules = new Map(), hashes = {}, results = []
class Element {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {}; this.style = { setProperty() {} }; this.hidden = false; this.parent = null; this.removes = 0 }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node) } }
  prepend(...nodes) { for (const node of nodes) node.parent = this; this.children.unshift(...nodes) }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes) }
  setAttribute(name, value) { this.attributes[name] = value }
  remove() { this.removes++; if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null }
}
const document = { createElement: tag => new Element(tag) }
const transport = { createPlateStream(preview, full, options) {
  const material = new Three.MeshBasicNodeMaterial()
  const stream = { preview, full, options, material, ready: Promise.resolve(), disposals: 0,
    available() { return this.disposals === 0 }, update() {}, high: async () => {}, pending: () => 0,
    textureMB: () => 0, allocation: () => ({ previewMB: 1, fullMB: 1 }),
    residency: () => ({ preview: true, full: false, blending: false }), error: () => null,
    dispose() { if (this.disposals) return; this.disposals++; material.dispose() } }
  streams.push(stream); return stream
} }
function load(filename) {
  const absolute = path.resolve(filename)
  assert(absolute.startsWith(root + path.sep))
  if (absolute === path.join(pictureDir, 'stream.ts')) return transport
  if (modules.has(absolute)) return modules.get(absolute)
  const exports = {}; modules.set(absolute, exports)
  const source = readFileSync(absolute === indexPath ? entryPath : absolute, 'utf8')
  hashes[path.relative(root, absolute)] = createHash('sha256').update(source).digest('hex')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const require = name => {
    if (name === 'three' || name === 'three/webgpu') return Three
    if (name === 'three/tsl') return TSL
    assert(name.startsWith('.'), `Unexpected dependency ${name}`)
    if (name.endsWith('?raw')) return { default: readFileSync(path.resolve(path.dirname(absolute), name.slice(0, -4)), 'utf8') }
    return load(path.resolve(path.dirname(absolute), name + '.ts'))
  }
  vm.runInThisContext(`(function(exports,require,document,innerWidth,innerHeight){${compiled}\n})`, { filename: absolute })(exports, require, document, 1512, 950)
  return exports
}
const pictures = load(indexPath)
const frameApi = load(path.join(pictureDir, 'frame.ts'))
const records = JSON.parse(readFileSync(path.join(root, 'src/wings/vinci/pictures/data/store-audit.json'), 'utf8')).records
const manifest = { all: records, byId: new Map(records.map(record => [record.id, record])) }
const sharedTexture = new Three.Texture()
let sharedTextureDisposals = 0
sharedTexture.addEventListener('dispose', () => sharedTextureDisposals++)
function material() {
  const m = new Three.MeshStandardNodeMaterial()
  m.map = sharedTexture; m.colorNode = TSL.vec3(1); m.roughnessNode = TSL.float(.5)
  return m
}
const materialSet = { albedo: new Three.Color('#b8ac92'), roughness: .7, metalness: 0, material }
const stack = { materials: { sync: () => materialSet }, tierName: () => 'standard',
  detail(m) { m.colorNode ??= TSL.vec3(m.color.r, m.color.g, m.color.b); m.roughnessNode ??= TSL.float(m.roughness) },
  cost: () => ({ textureMB: 0, budget: { textureMB: 256 } }) }
const check = (name, run) => { run(); results.push({ name, pass: true }) }
const close = (a, b, why, epsilon = 1e-6) => assert(Math.abs(a - b) <= epsilon, `${why}: ${a} versus ${b}`)
const visible = object => { for (let at = object; at; at = at.parent) if (!at.visible) return false; return true }
// The mount is cut to the work, so the expected mount is the production
// rule applied to this panel and never one constant for the whole room.
const GINEVRA_BOARD = pictures.pictureMatBorderM(.37, .381)
const ginevra = pictures.getWork('ginevra-de-benci')
const next = pictures.getWork('madonna-of-the-carnation')
const hang = pictures.buildHang(stack, [ginevra, next], manifest)
await Promise.resolve()
const primary = hang.frames[0], neighbour = hang.frames[1]
const reverse = primary.cards.find(card => card.entry.face === 'reverse')
const reverseField = hang.wall.getObjectByName('measured-reverse-aperture/ginevra-de-benci')
const reverseBacking = hang.wall.getObjectByName('physical-backing/ginevra-de-benci/reverse')
const physical = hang.wall.getObjectByName('vinci/pictures/physical-frames')
const contact = hang.wall.getObjectByName('vinci/pictures/directional-frame-contact')
const geometries = new Map(), materials = new Map()
function track() {
  hang.wall.traverse(object => {
    if (!(object instanceof Three.Mesh)) return
    if (!geometries.has(object.geometry)) { const counter = { disposals: 0 }; geometries.set(object.geometry, counter); object.geometry.addEventListener('dispose', () => counter.disposals++) }
    for (const m of Array.isArray(object.material) ? object.material : [object.material]) if (!materials.has(m)) {
      const counter = { disposals: 0 }; materials.set(m, counter); m.addEventListener('dispose', () => counter.disposals++)
    }
  })
}
track()
check('Reverse has a second measured field while the primary geometry is unchanged', () => {
  assert(reverse && reverseField instanceof Three.Mesh && reverseBacking instanceof Three.Mesh)
  close(primary.aperture.geometry.parameters.width, .37, 'primary width')
  close(primary.aperture.geometry.parameters.height, .381, 'primary height')
  close(primary.aperture.position.x, .185, 'primary position')
  close(primary.aperture.position.y, 1.55, 'primary datum')
  close(primary.aperture.position.z, .021, 'primary field depth')
  close(reverseField.geometry.parameters.width, .37, 'reverse field width')
  close(reverseField.geometry.parameters.height, .381, 'reverse field height')
  close(reverseField.position.y, 1.55, 'reverse datum')
  close(reverseField.position.z, .021, 'reverse field depth')
  close(reverse.mesh.position.x, reverseField.position.x, 'reverse image centred on its own field')
  close(reverse.mesh.position.y, 1.55, 'reverse image datum')
  close(reverse.mesh.position.z, .023, 'reverse image seating')
  assert.equal(hang.frames.length, 2, 'Two faces do not create another work record')
  assert.equal(primary.cards.length, 2)
})
check('Reverse source aspect and complete UV range survive unchanged', () => {
  const g = reverse.mesh.geometry
  close(g.parameters.width / g.parameters.height, reverse.entry.pixels.width / reverse.entry.pixels.height, 'unchanged reverse aspect', 1e-12)
  assert(g.parameters.width <= .37 + 1e-12 && g.parameters.height <= .381 + 1e-12)
  const uv = g.getAttribute('uv')
  assert.deepEqual(Array.from(uv.array), [0, 1, 1, 1, 0, 0, 1, 0])
  assert.equal(reverse.mesh.userData.manifestId, reverse.entry.plate.id)
  assert.equal(streams.filter(stream => stream.full.work_id === ginevra.id).length, 2)
  assert(streams.every(stream => stream.options.previewMaxEdge === 512))
})
check('Both sides have forty-millimetre mats, sixteen-millimetre backing and the same profile family', () => {
  const b = reverseBacking.geometry.parameters
  close(b.width, .37 + 2 * GINEVRA_BOARD, 'reverse backing includes both mat borders')
  close(b.height, .381 + 2 * GINEVRA_BOARD, 'reverse backing includes vertical mat borders')
  close(b.depth, .016, 'reverse backing thickness')
  close(reverseBacking.position.z - b.depth / 2, .0048, 'backing back')
  close(reverseBacking.position.z + b.depth / 2, .0208, 'backing front')
  assert(reverseBacking.castShadow && reverseBacking.receiveShadow)
  assert.equal(reverseBacking.material, primary.aperture.material)
  assert.equal(reverseField.material, primary.aperture.material)
  assert.equal(physical.userData.apertures.length, 3)
  const mounts = physical.userData.apertures.filter(mount => mount.id.startsWith(ginevra.id))
  assert.equal(mounts.length, 2)
  assert.equal(new Set(physical.userData.apertures.map(mount => mount.id)).size, 3)
  for (const mount of mounts) { close(mount.width, .37 + 2 * GINEVRA_BOARD, 'frame inside width'); close(mount.height, .381 + 2 * GINEVRA_BOARD, 'frame inside height'); close(mount.y, 1.55, 'frame datum') }
  close(physical.userData.profile.width_m, .052, 'moulding width')
  close(physical.userData.profile.depth_m, .045, 'moulding body depth')
})
check('Actual moulding vertices remain separated and assembly extent includes the reverse mount', () => {
  const mounts = physical.userData.apertures
  const boxes = mounts.map(() => new Three.Box3())
  physical.traverse(object => {
    if (!(object instanceof Three.Mesh)) return
    const position = object.geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      const p = new Three.Vector3().fromBufferAttribute(position, i)
      let nearest = 0
      for (let j = 1; j < mounts.length; j++) if (Math.abs(p.x - mounts[j].x) < Math.abs(p.x - mounts[nearest].x)) nearest = j
      boxes[nearest].expandByPoint(p)
    }
  })
  const frontIndex = mounts.findIndex(mount => mount.id === ginevra.id)
  const reverseIndex = mounts.findIndex(mount => mount.id === `${ginevra.id}:reverse`)
  const nextIndex = mounts.findIndex(mount => mount.id === next.id)
  close(reverseField.position.x - .37 / 2 - (primary.x + .37 / 2), pictures.reverseFieldGapM(GINEVRA_BOARD), 'field-edge gap')
  assert(boxes[reverseIndex].min.x - boxes[frontIndex].max.x >= pictures.PICTURE_REVERSE_CLEAR_M - .006, 'Outer frame mouldings overlap')
  assert(boxes[nextIndex].min.x > boxes[reverseIndex].max.x, 'Neighbour overlaps reverse mount')
  for (const i of [frontIndex, reverseIndex]) { close(boxes[i].min.z, frameApi.FRAME_BACK_M, 'physical back vertices'); close(boxes[i].max.z, frameApi.FRAME_FRONT_M, 'physical front vertices') }
  close(primary.right - primary.left, 2 * .37 + pictures.reverseFieldGapM(GINEVRA_BOARD), 'two complete field slots plus gap')
  close(neighbour.left, primary.right + .56, 'next work starts after complete assembly')
  assert(hang.extent >= neighbour.right)
})
check('Directional contact uses two independent reverse/obverse identities', () => {
  assert.equal(hang.contactStats.frames, 3)
  assert(hang.contactStats.blockedRays > 0)
  assert.deepEqual(new Set(contact.userData.receiverRanges.map(range => range.id)), new Set([ginevra.id, `${ginevra.id}:reverse`, next.id]))
})
check('Work selection and inspection toggle both physical mounts and both receiver patches together', () => {
  hang.setVisible([ginevra.id]); track()
  assert.deepEqual(new Set(physical.userData.visibleIds), new Set([ginevra.id, `${ginevra.id}:reverse`]))
  assert.deepEqual(new Set(contact.userData.receiverRanges.map(range => range.id)), new Set([ginevra.id, `${ginevra.id}:reverse`]))
  assert(visible(primary.aperture) && visible(reverseField) && visible(reverseBacking) && primary.cards.every(card => visible(card.mesh)))
  assert(!visible(neighbour.aperture))
  hang.setVisible([next.id]); track()
  assert.deepEqual(Array.from(physical.userData.visibleIds), [next.id])
  assert(!visible(primary.aperture) && !visible(reverseField) && !visible(reverseBacking) && primary.cards.every(card => !visible(card.mesh)))
  hang.setVisible([ginevra.id], true); track()
  assert.equal(physical.children.length, 0); assert.equal(contact.children.length, 0)
  assert(!visible(primary.aperture) && !visible(reverseField) && !visible(reverseBacking))
  assert(primary.cards.every(card => visible(card.mesh)))
  hang.setVisible(); track()
  assert.equal(physical.userData.visibleFrameCount, 3)
  assert.equal(contact.userData.receiverRanges.length, 3)
  assert(visible(reverseField) && visible(reverseBacking))
})
check('Disposal releases reverse geometry and both streams exactly once without shared texture ownership', () => {
  const owner = new Three.Group(); owner.add(hang.wall)
  const labelOwner = new Element('section'); labelOwner.append(hang.labels)
  hang.dispose(); hang.dispose()
  assert.equal(hang.wall.parent, null)
  assert.equal(hang.labels.parent, null)
  assert.equal(hang.labels.removes, 1)
  for (const [geometry, count] of geometries) assert.equal(count.disposals, 1, `Owned geometry ${geometry.uuid} must dispose once`)
  for (const [m, count] of materials) assert.equal(count.disposals, 1, `Owned material ${m.name} must dispose once`)
  assert(streams.every(stream => stream.disposals === 1))
  assert.equal(sharedTextureDisposals, 0)
  assert.equal(hang.contactStats.cpuBytes, 0)
})
check('Single-face work retains its previous field, position and one-frame contract', () => {
  const solo = pictures.buildHang(stack, [next], manifest)
  const f = solo.frames[0]
  assert.equal(f.cards.length, 1)
  close(f.x, next.width_cm / 200, 'single-face x')
  close(f.y, 1.55, 'single-face datum')
  close(f.aperture.geometry.parameters.width, next.width_cm / 100, 'single-face field width')
  close(f.aperture.geometry.parameters.height, next.height_cm / 100, 'single-face field height')
  assert.equal(solo.wall.getObjectByName('vinci/pictures/physical-frames').userData.frameCount, 1)
  assert.equal(solo.contactStats.frames, 1)
  close(solo.extent, 1, 'single-face minimum layout slot')
  solo.dispose()
})
const report = { kind: 'window-2-reverse-mount-geometry-check', source: path.relative(root, entryPath), ok: true,
  passed: results.length, sourceHashes: hashes, sourceImages: 'Not fetched; manifest identities retained by a transport double', results }
console.log(JSON.stringify(report, null, 2))
