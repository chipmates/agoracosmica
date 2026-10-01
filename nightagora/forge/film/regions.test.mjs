// The works a press on the film's picture can reach (`vinciWorkRegions`):
// each the outline of its bounds on the frame, cut to the frame, with its
// distance from the eye. No browser.
//
//   node --test forge/film/regions.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three/webgpu'
import { createLoader } from './load.mjs'

const loader = await createLoader()
const labels = loader.load('src/wings/vinci/labels.ts')
// read in the loader's own realm: plain data for the comparisons
const vinciWorkRegions = (...args) => JSON.parse(JSON.stringify(labels.vinciWorkRegions(...args)))
const W = 1280, H = 720
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100)
camera.position.set(0, 0, 0)
camera.lookAt(0, 0, -1)
camera.updateMatrixWorld(true)
const scene = new THREE.Scene()
scene.add(camera)
/** a flat work, a metre wide, standing facing the eye */
function work(id, x, y, z, w = 1, h = 1) {
  const object = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), new THREE.MeshBasicMaterial())
  object.position.set(x, y, z)
  scene.add(object)
  object.updateMatrixWorld(true)
  return { id, object, anchor: new THREE.Vector3(x, y - h / 2, z) }
}
const inside = (pts, x, y) => {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}
const centreOf = (v) => { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H] }

test('a work in view has an outline round its own middle, on the frame, at its distance', () => {
  const a = work('a', 0.4, 0.1, -5)
  const [r] = vinciWorkRegions([a], camera, [], W, H)
  assert.equal(r.id, 'a')
  assert.ok(r.points.length >= 4)
  assert.ok(inside(r.points, ...centreOf(a.object.position)))
  for (const [x, y] of r.points) assert.ok(x >= 0 && x <= W && y >= 0 && y <= H)
  assert.ok(Math.abs(r.depth - a.object.position.length()) < 0.05, String(r.depth))
  scene.remove(a.object)
})

test('a work half out of the frame keeps the part it shows, cut at the frame\'s edge', () => {
  const b = work('b', 4.2, 0, -5, 1.6, 1)
  const [r] = vinciWorkRegions([b], camera, [], W, H)
  assert.ok(r, 'the half in view is reachable')
  assert.ok(r.points.some(([x]) => Math.abs(x - W) < 0.5), 'one edge lies on the frame\'s right side')
  for (const [x] of r.points) assert.ok(x <= W + 1e-6)
  scene.remove(b.object)
})

test('a work behind the eye, wholly out of the frame, or hidden has no outline', () => {
  const behind = work('behind', 0, 0, 5)
  const out = work('out', 12, 0, -5)
  const hidden = work('hidden', 0, 0, -5)
  hidden.object.visible = false
  assert.deepEqual(vinciWorkRegions([behind, out, hidden], camera, [], W, H), [])
  for (const w of [behind, out, hidden]) scene.remove(w.object)
})

test('a work behind a wall is out of reach; one whose middle shows past the wall stays', () => {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.1), new THREE.MeshBasicMaterial())
  wall.position.set(0, 0, -3)
  scene.add(wall)
  wall.updateMatrixWorld(true)
  const behind = work('behind', 0, 0, -6)
  assert.deepEqual(vinciWorkRegions([behind], camera, [wall], W, H), [])
  // a low ledge that hides only the anchor at the work's foot
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.1), new THREE.MeshBasicMaterial())
  const seen = work('seen', 0, 0, -6)
  scene.remove(wall)
  const foot = seen.anchor.clone().multiplyScalar(0.5)
  ledge.position.copy(foot)
  scene.add(ledge)
  ledge.updateMatrixWorld(true)
  const eye = new THREE.Vector3()
  assert.ok(labels.vinciSightBlocked(eye, seen.anchor, [ledge], new THREE.Raycaster(), []), 'the ledge hides the anchor')
  assert.ok(!labels.vinciSightBlocked(eye, seen.object.position, [ledge], new THREE.Raycaster(), []), 'the middle shows')
  const [r] = vinciWorkRegions([seen], camera, [ledge], W, H)
  assert.equal(r?.id, 'seen')
  for (const o of [behind.object, seen.object, ledge]) scene.remove(o)
})

test('of two overlapping works the nearer is told by its depth', () => {
  const far = work('far', 0, 0, -8, 3, 2)
  const near = work('near', 0.2, 0, -4)
  const regions = vinciWorkRegions([far, near], camera, [], W, H)
  const [x, y] = centreOf(near.object.position)
  const under = regions.filter((r) => inside(r.points, x, y)).sort((a, b) => a.depth - b.depth)
  assert.deepEqual(under.map((r) => r.id), ['near', 'far'])
  for (const w of [far, near]) scene.remove(w.object)
})

const areaOf = (pts) => {
  let a = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1])
  return Math.abs(a) / 2
}

test('a slanted machine part is outlined by its own shape, not the box round it', () => {
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 12), new THREE.MeshBasicMaterial())
  rod.position.set(0, 0, -5)
  rod.rotation.z = Math.PI / 4
  scene.add(rod)
  rod.updateMatrixWorld(true)
  const [r] = vinciWorkRegions([{ id: 'rod', object: rod, anchor: rod.position.clone() }], camera, [], W, H)
  const box = new THREE.Box3().setFromObject(rod)
  const corners = []
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) { const p = new THREE.Vector3(x, y, -5).project(camera); corners.push([(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H]) }
  const boxArea = areaOf([corners[0], corners[1], corners[3], corners[2]])
  assert.ok(areaOf(r.points) < boxArea * 0.2, `${areaOf(r.points)} against ${boxArea}`)
  scene.remove(rod)
})

test('an instanced part is outlined where its copies stand', () => {
  const parts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial(), 2)
  parts.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-1.5, 0, -5))
  parts.setMatrixAt(1, new THREE.Matrix4().makeTranslation(1.5, 0, -5))
  scene.add(parts)
  parts.updateMatrixWorld(true)
  const [r] = vinciWorkRegions([{ id: 'parts', object: parts, anchor: new THREE.Vector3(0, 0, -5) }], camera, [], W, H)
  const [lx] = centreOf(new THREE.Vector3(-1.5, 0, -5)), [rx] = centreOf(new THREE.Vector3(1.5, 0, -5))
  const xs = r.points.map(([x]) => x)
  assert.ok(Math.min(...xs) < lx && Math.max(...xs) > rx, `${Math.min(...xs)}..${Math.max(...xs)} against ${lx}..${rx}`)
  scene.remove(parts)
})
