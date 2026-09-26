// THE ID PASS, READ BACK AND DRAWN, for the film's export and the stability
// audit alike (`src/stack/audit.ts`, which the export takes them from).
// WebGPU's copy pads every row to 256 bytes, and a dense read of a target
// whose width is not a multiple of 16 texels shears it; the hall's air, a
// volume drawn without a depth test, must never stand in the ids.
// No browser: the page's own functions, loaded in node.
//
//   node --test forge/film/id-readback.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three/webgpu'
import { ID_DIV, STAGES } from './export.mjs'
import { createLoader } from './load.mjs'

const loader = await createLoader()
const audit = loader.load('src/stack/audit.ts')
const exported = loader.load('src/stack/export.ts')
const { idPlanes, drawIdBodies, idSwap, isVolume } = audit

/** a readback as three hands it back: rows padded to 256 bytes, ids in r, depth in g */
function readback(w, h, pad = true) {
  const stride = pad ? Math.ceil((w * 16) / 256) * 16 : w
  const raw = new Float32Array(((h - 1) * stride + w) * 4).fill(-1)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * stride + x) * 4
    raw[p] = 1 + y * w + x
    raw[p + 1] = y + x / 1000
  }
  return raw
}

function readsTrue(w, h, label) {
  for (const pad of [true, false]) {
    const { ids, depth } = idPlanes(readback(w, h, pad), w, h)
    assert.equal(ids.length, w * h)
    for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, h >> 1]]) {
      assert.equal(ids[y * w + x], 1 + y * w + x, `${label} ${pad ? 'padded' : 'dense'} id at ${x},${y}`)
      assert.ok(Math.abs(depth[y * w + x] - (y + x / 1000)) < 1e-4, `${label} ${pad ? 'padded' : 'dense'} depth at ${x},${y}`)
    }
  }
}

test("the film's id targets read every texel where it stands, padded or dense", () => {
  assert.equal(exported.idPlanes, idPlanes, 'the export reads with the audit\'s own function')
  for (const [framing, stage] of Object.entries(STAGES)) readsTrue(Math.round(stage.width / ID_DIV), Math.round(stage.height / ID_DIV), framing)
})

test("the audit's full-canvas targets read true at the widths a phone and a desktop give", () => {
  // 390 CSS px at 2 and 3, the stills' 1170, the stability ratchet's 2268 desktop stage
  for (const [w, h] of [[780, 40], [1170, 30], [2268, 20], [2400, 12], [1920, 12]]) readsTrue(w, h, `${w} wide`)
})

test('the upright id target is the case a dense read shears', () => {
  const w = Math.round(STAGES.upright.width / ID_DIV)
  assert.notEqual((w * 16) % 256, 0, 'the upright id row is padded')
  assert.equal((Math.round(STAGES.wide.width / ID_DIV) * 16) % 256, 0, 'the wide id row is not')
})

test('a buffer that is neither padded nor dense is refused', () => {
  assert.throws(() => idPlanes(new Float32Array(195 * 10 * 4 + 4), 195, 10), /id readback/)
})

test('the id pass keeps the air out and draws no hidden material, and puts everything back', () => {
  const scene = new THREE.Scene()
  const box = new THREE.BoxGeometry(1, 1, 1)
  const wall = new THREE.Mesh(box, new THREE.MeshBasicNodeMaterial())
  const airMaterial = new THREE.MeshBasicNodeMaterial()
  airMaterial.isVolumeNodeMaterial = true
  const air = new THREE.Mesh(box, airMaterial)
  const hiddenMaterial = new THREE.MeshBasicNodeMaterial()
  hiddenMaterial.visible = false
  const card = new THREE.Mesh(box, hiddenMaterial)
  const pair = new THREE.Mesh(box, [new THREE.MeshBasicNodeMaterial(), Object.assign(new THREE.MeshBasicNodeMaterial(), { visible: false })])
  scene.add(wall, air, card, pair)
  assert.equal(isVolume(air), true)
  assert.equal(isVolume(wall), false)
  const swaps = [wall, card, pair].map((mesh, k) => idSwap(mesh, k + 1))
  const was = [wall.material, card.material, pair.material]
  let seen = null
  const target = { id: 'target' }
  let current = null
  const renderer = {
    getRenderTarget: () => current,
    setRenderTarget: (t) => { current = t },
    render: (s) => {
      seen = { target: current, drawn: [] }
      s.traverseVisible((o) => { if (o.isMesh) seen.drawn.push({ mesh: o, materials: Array.isArray(o.material) ? o.material : [o.material] }) })
    },
  }
  drawIdBodies(renderer, scene, new THREE.PerspectiveCamera(), target, swaps)
  assert.equal(seen.target, target, 'drawn into the id target')
  assert.equal(current, null, 'the renderer\'s own target is put back')
  const drawn = new Map(seen.drawn.map((d) => [d.mesh, d.materials]))
  assert.equal(drawn.has(air), false, 'the air is not drawn into the ids')
  assert.equal(drawn.get(wall)[0], swaps[0].now, 'a body draws its id material')
  assert.equal(drawn.get(card)[0].visible, false, 'a hidden material draws no id')
  assert.deepEqual(drawn.get(pair).map((m) => m.visible), [true, false], 'each of a body\'s materials keeps its own visibility')
  assert.deepEqual([wall.material, card.material, pair.material], was, 'every body has its own material back')
  assert.equal(air.visible, true, 'the air stands again')
})
