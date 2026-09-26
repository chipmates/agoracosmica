// A PLATE'S TEXELS ON THE SCREEN, as the export measures them for the
// film's texels line: a card facing the eye has one magnification, known in
// closed form; a card seen at a slant stretches its texels along the slant;
// the texel is the smallest raster the body shows at that frame (a preview
// while it stands in); a plate shows where nothing that writes depth stands
// nearer, and of two plates in one plane the one drawn later. No browser.
//
//   node --test forge/film/plate-texels.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three/webgpu'
import { plateModels, plateTexels } from './export.mjs'

const W = 960, H = 540, DIV = 4
const iw = W / DIV, ih = H / DIV
const sizes = new Map([['plate/a', { width: 800, height: 600 }], ['preview/a', { width: 200, height: 150 }]])
const FULL = { id: 'plate/a', width: 800, height: 600, share: 1 }
const drawn = (...shown) => ({ drawn: true, shown })

function camera(fov = 50, at = [0, 1.6, 0], look = [0, 1.6, -1]) {
  const c = new THREE.PerspectiveCamera(fov, W / H, 0.05, 100)
  c.position.set(...at)
  c.lookAt(...look)
  c.updateMatrixWorld(true)
  c.updateProjectionMatrix()
  return { proj: c.projectionMatrix.toArray(), world: c.matrixWorld.toArray(), fov }
}

/** a card of w by h metres centred at c, spanned by the unit vectors u (its width) and v (up) */
function card(c, w, h, u = [1, 0, 0], v = [0, 1, 0], window = [0, 1, 0, 1]) {
  const at = (s, t) => [0, 1, 2].map((k) => c[k] + s * w * u[k] + t * h * v[k])
  const [u0, u1, v0, v1] = window
  return { positions: [...at(-0.5, -0.5), ...at(0.5, -0.5), ...at(-0.5, 0.5), ...at(0.5, 0.5)], uvs: [u0, v0, u1, v0, u0, v1, u1, v1] }
}
const body = (name, id, quad, extra = {}) => ({ name, id, order: 0, vertices: quad.positions.length / 3, drawn: true, shown: [], ...quad, ...extra })

/** an id frame whose depth is a flat wall at `wall` metres down the view axis (0: nothing drawn) */
function frame(cam, wall = 0) {
  return { ids: new Uint32Array(iw * ih).fill(1), depth: new Float32Array(iw * ih).fill(wall), idSize: [iw, ih], cam, head: { w: W, h: H } }
}

// one delivered pixel spans 2 d tan(fov/2) / H metres on a wall d away; one texel of `plate/a` on a 1.2 m card, 1.2 / 800
const closed = (d, texelM = 1.2 / 800) => texelM / ((2 * d * Math.tan((50 * Math.PI) / 360)) / H)

test('a card facing the eye: delivered pixels per texel is the closed form', () => {
  const d = 3, cam = camera(50)
  const { models, unmeasured } = plateModels([body('a', 'plate/a', card([0, 1.6, -d], 1.2, 0.9))], sizes)
  assert.equal(models.length, 1)
  assert.deepEqual(unmeasured, [])
  const got = plateTexels(frame(cam, d + 0.02), models, [drawn(FULL)], sizes)
  assert.ok(got.pixels > 1000, `${got.pixels} plate pixels`)
  assert.ok(Math.abs(got.ratio - closed(d)) < 1e-6 * closed(d), `${got.ratio} against ${closed(d)}`)
  assert.equal(got.plate, 'a')
  assert.equal(got.raster, 'plate/a 800x600')
  // showing nothing it can name, a body is read at its record's size
  assert.ok(Math.abs(plateTexels(frame(cam), models, [drawn()], sizes).ratio - closed(d)) < 1e-6)
  // nearer, the texels grow in step
  const near = plateModels([body('a', 'plate/a', card([0, 1.6, -d / 2], 1.2, 0.9))], sizes).models
  assert.ok(Math.abs(plateTexels(frame(cam), near, [drawn(FULL)], sizes).ratio - 2 * closed(d)) < 1e-6)
})

test('a window of the raster: the texel is the raster\'s, not the window\'s', () => {
  const d = 3, cam = camera(50)
  const half = plateModels([body('a', 'plate/a', card([0, 1.6, -d], 1.2, 0.9, [1, 0, 0], [0, 1, 0], [0.25, 0.75, 0.25, 0.75]))], sizes).models
  const got = plateTexels(frame(cam), half, [drawn(FULL)], sizes).ratio
  assert.ok(Math.abs(got - 2 * closed(d)) < 1e-6 * got, `${got} against ${2 * closed(d)}`)
})

test('a card at a slant: its texels stretch along the slant, and the most is taken', () => {
  const cam = camera(50), s = Math.SQRT1_2
  const slant = plateModels([body('a', 'plate/a', card([1, 1.6, -3], 1.2, 0.9, [s, 0, -s]))], sizes).models
  const flat = plateModels([body('a', 'plate/a', card([1, 1.6, -3], 1.2, 0.9))], sizes).models
  const a = plateTexels(frame(cam), slant, [drawn(FULL)], sizes).ratio, b = plateTexels(frame(cam), flat, [drawn(FULL)], sizes).ratio
  assert.ok(a > b && b > 0, `the slant's most (${a}) is over the flat card's (${b}): its near edge comes closer`)
})

test('a plate shows only where nothing nearer writes depth, and only while it is drawn', () => {
  const d = 3, cam = camera(50)
  const { models } = plateModels([body('a', 'plate/a', card([0, 1.6, -d], 1.2, 0.9))], sizes)
  assert.ok(plateTexels(frame(cam, d + 0.02), models, [drawn(FULL)], sizes).pixels > 1000, 'the wall it hangs on')
  assert.equal(plateTexels(frame(cam, d - 0.01), models, [drawn(FULL)], sizes).pixels, 0, 'a surface a centimetre nearer')
  assert.equal(plateTexels(frame(cam), models, [{ drawn: false, shown: [FULL] }], sizes).pixels, 0, 'a material hidden')
})

test('what is no plate is not listed, and what cannot be measured is named', () => {
  const quad = card([0, 1.6, -3], 1.2, 0.9)
  const bent = { ...quad, positions: [...quad.positions.slice(0, 9), 0.6, 2.05, -2.9] }
  const { models, unmeasured } = plateModels([
    body('a', 'plate/a', quad),
    body('unknown record', 'plate/none', quad),
    body('shows a preview', null, quad, { shown: [{ id: 'preview/a', width: 200, height: 150, share: 1 }] }),
    { name: 'codex page', id: 'plate/a', order: 0, vertices: 900, drawn: true, shown: [] },
    body('bent', 'plate/a', bent),
  ], sizes)
  assert.deepEqual(models.map((m) => m.name), ['a', 'shows a preview'])
  assert.deepEqual(unmeasured, ['codex page (900 vertices)', 'bent (not flat cards)'])
})

test('the texel is the smallest raster the body shows at that frame, a preview included', () => {
  const d = 3, cam = camera(50)
  const { models } = plateModels([body('a', 'plate/a', card([0, 1.6, -d], 1.2, 0.9))], sizes)
  const PREVIEW = { id: 'preview/a', width: 200, height: 150 }
  const read = (...shown) => plateTexels(frame(cam), models, [drawn(...shown)], sizes)
  const full = read(FULL).ratio
  assert.ok(Math.abs(read({ ...PREVIEW, share: 1 }).ratio - 4 * full) < 1e-6 * full, 'the preview\'s texel is four of the plate\'s')
  assert.equal(read({ ...PREVIEW, share: 1 }).raster, 'preview/a 200x150')
  // faded out, the preview is not on the screen; half way, it is
  assert.ok(Math.abs(read({ ...PREVIEW, share: 0 }, FULL).ratio - full) < 1e-9)
  assert.ok(Math.abs(read({ ...PREVIEW, share: 0.5 }, { ...FULL, share: 0.5 }).ratio - 4 * full) < 1e-6 * full)
  // a texture that names no raster record is no plate's
  assert.equal(read({ id: 'wall/plaster', width: 16, height: 16, share: 1 }).raster, 'plate/a 800x600 (its record)')
})

test('the page reads a plate stream\'s mix: each side by the uniform\'s share', async () => {
  const { createLoader } = await import('./load.mjs')
  const { shownTextures } = (await createLoader()).load('src/stack/export.ts')
  const { texture, uniform, mix } = await import('three/tsl')
  const preview = new THREE.Texture(), full = new THREE.Texture(), tone = uniform(0.8)
  const blend = uniform(0)
  const material = new THREE.MeshBasicNodeMaterial()
  material.colorNode = mix(texture(preview).rgb, texture(full).rgb, blend).mul(tone)
  const at = (b) => { blend.value = b; const out = new Map(); shownTextures(material, out); return [out.get(preview) ?? 0, out.get(full) ?? 0] }
  assert.deepEqual(at(0), [1, 0])
  assert.deepEqual(at(1), [0, 1])
  assert.deepEqual(at(0.25), [0.75, 0.25])
  const plain = new THREE.MeshBasicMaterial({ map: full }), out = new Map()
  shownTextures(plain, out)
  assert.deepEqual([...out.values()], [1])
})

test('the page reads a layered plate faded out as drawing nothing', async () => {
  const { createLoader } = await import('./load.mjs')
  const { drawsNow } = (await createLoader()).load('src/stack/export.ts')
  const { uniform } = await import('three/tsl')
  const arrival = uniform(1), blend = uniform(0)
  const card = new THREE.MeshBasicNodeMaterial({ transparent: true })
  card.opacityNode = arrival.mul(blend)
  assert.equal(drawsNow(card), false, 'its plate faded out over the batch')
  blend.value = 1
  assert.equal(drawsNow(card), true)
  card.visible = false
  assert.equal(drawsNow(card), false)
  assert.equal(drawsNow(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })), false)
  assert.equal(drawsNow(new THREE.MeshBasicMaterial()), true)
})

test('a wall of previews in one body, and a raised plate over one of them', () => {
  const d = 3, cam = camera(50)
  // two cards in one array layer of 800 by 600: the right one half as wide, showing half the layer
  const left = card([-0.5, 1.6, -d], 1.2, 0.9, [1, 0, 0], [0, 1, 0], [0, 1, 0, 1])
  const right = card([1.0, 1.6, -d], 0.6, 0.9, [1, 0, 0], [0, 1, 0], [0, 0.5, 0, 1])
  const LAYER = { id: 'vinci/collection-plates/paintings/0', width: 800, height: 600, share: 1 }
  const batch = { name: 'batch', id: 'vinci/collection-plates', order: -1, vertices: 8, drawn: true, shown: [LAYER], positions: [...left.positions, ...right.positions], uvs: [...left.uvs, ...right.uvs] }
  const raised = body('raised', 'plate/a', card([-0.5, 1.6, -d], 1.2, 0.9))
  const { models, unmeasured } = plateModels([batch, raised], sizes)
  assert.deepEqual(unmeasured, [])
  assert.equal(models[0].cards.length, 2)
  // the batch alone: both cards read one texel of the layer at the closed form
  const alone = plateTexels(frame(cam), [models[0]], [drawn(LAYER)], sizes)
  assert.ok(Math.abs(alone.ratio - closed(d)) < 1e-6 * closed(d), `${alone.ratio} against ${closed(d)}`)
  // the raised plate shows a preview four times coarser: drawn later in the same plane, it is what shows
  const PREVIEW = { id: 'preview/a', width: 200, height: 150, share: 1 }
  const over = plateTexels(frame(cam), models, [drawn(LAYER), drawn(PREVIEW)], sizes)
  assert.ok(Math.abs(over.ratio - 4 * closed(d)) < 1e-6 * closed(d) && over.plate === 'raised', `${over.ratio} on ${over.plate}`)
  // not raised, the batch's preview is what shows
  const lowered = plateTexels(frame(cam), models, [drawn(LAYER), { drawn: false, shown: [PREVIEW] }], sizes)
  assert.ok(Math.abs(lowered.ratio - closed(d)) < 1e-6 * closed(d) && lowered.plate.startsWith('batch card 0 at '), lowered.plate)
  // a batch's texture counts whatever its name; the same body under another name does not
  assert.equal(plateModels([{ ...batch, id: null }], sizes).models.length, 0)
})
