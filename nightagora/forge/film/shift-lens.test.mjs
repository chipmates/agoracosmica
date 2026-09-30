// THE SHIFT LENS, READ THE SAME EVERYWHERE: the rail's camera slides its
// frustum (`rail-projection.ts`), and every projection made by hand of that
// camera (the approaches' fit, the film's print and its player, the seen
// set's frustum) lands a point where the renderer's own matrix lands it.
// No browser.
//
//   node --test forge/film/shift-lens.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three/webgpu'
import { createLoader, WING_DIR } from './load.mjs'
import { camPrint } from './replay.mjs'

const loader = await createLoader({})
const lens = loader.load(`${WING_DIR}/rail-projection.ts`)
const seam = loader.load('src/wings/picture/seam.ts')
const approaches = loader.load(`${WING_DIR}/collection/approaches.ts`)
const ASPECT = 390 / 844
const MURAL = 'picture/last-supper/front'
const SHIFTED = [...approaches.vinciExhibitRecords().filter(r => r.kind === 'picture' && r.station === 'picture-room').map(r => r.id), MURAL]

function shiftedCamera(shift, fov = 90) {
  const camera = new THREE.PerspectiveCamera(fov, ASPECT, 0.25, 100)
  camera.position.set(1, 1.6, 4)
  camera.lookAt(1, 1.6, 0)
  camera.updateMatrixWorld(true)
  lens.setRailShift(camera, shift)
  camera.updateProjectionMatrix()
  return camera
}

test('the slide is the projection\'s own, and survives every rebuild', () => {
  const camera = shiftedCamera(-0.45)
  const point = new THREE.Vector3(1.3, 1.1, 0)
  const ndc = point.clone().project(camera)
  const t = Math.tan((90 * Math.PI) / 360)
  assert.ok(Math.abs(ndc.y - ((1.1 - 1.6) / 4 / t + 0.45)) < 1e-12)
  // a jitter laid on and taken off inside a draw adds to it and leaves it
  camera.setViewOffset(390, 844, 0.3, -0.2, 390, 844)
  assert.ok(Math.abs(camera.projectionMatrix.elements[9] - (-0.45 - (2 * -0.2) / 844)) < 1e-12)
  camera.clearViewOffset()
  assert.equal(camera.projectionMatrix.elements[9], -0.45)
  const inverse = camera.projectionMatrix.clone().invert()
  assert.ok(camera.projectionMatrixInverse.equals(inverse))
})

test('an unshifted camera is left bit for bit', () => {
  const plain = new THREE.PerspectiveCamera(70, ASPECT, 0.25, 100)
  const held = new THREE.PerspectiveCamera(70, ASPECT, 0.25, 100)
  lens.setRailShift(held, 0)
  held.updateProjectionMatrix()
  assert.deepEqual(held.projectionMatrix.elements, plain.projectionMatrix.elements)
  assert.equal(camPrint(held), camPrint(plain))
  assert.equal(camPrint(plain).split(',').length, 7)
})

test('the projection refuses a slide the leg did not certify', () => {
  const camera = shiftedCamera(-0.3)
  assert.throws(() => lens.assertRailProjection(camera))
  assert.throws(() => lens.assertRailProjection(camera, 0.2))
  lens.assertRailProjection(camera, 0.3)
  assert.throws(() => lens.setRailShift(camera, 0.71))
})

test('the film\'s print and its player project as the renderer does', () => {
  const camera = shiftedCamera(-0.4849, 91.84)
  const print = camPrint(camera)
  assert.equal(print.split(',').length, 8)
  const parsed = seam.parsePrint(print)
  assert.ok(parsed)
  for (const at of [[1, 1.6, 0], [0.2, 0.5, -1], [2.1, 2.9, 1]]) {
    const ndc = new THREE.Vector3(...at).project(camera)
    const hand = seam.projectPrint(parsed, ASPECT, at)
    // the print holds four decimals: its rounding is the only difference
    assert.ok(Math.abs(hand.u - (ndc.x + 1) / 2) < 2e-4, `u at ${at}`)
    assert.ok(Math.abs(hand.v - (1 - ndc.y) / 2) < 2e-4, `v at ${at}`)
  }
  assert.equal(seam.parsePrint('1,2,3,4,5,6,7,8,9'), null)
})

test('every phone close look of a hung work and the mural looks level through the lens, square in its band', () => {
  assert.ok(SHIFTED.length >= 26)
  for (const id of SHIFTED) {
    const pose = approaches.vinciApproachPose(id, true)
    assert.ok(pose.shift < 0 && Math.abs(pose.at.y - pose.eye.y) < 1e-12, `${id} looks level, slid down`)
    assert.equal(approaches.vinciApproachPose(id, false).shift, undefined, `${id}: the desktop is not shifted`)
    const fit = id === MURAL ? null : approaches.vinciApproachFit(id, true)
    // a work at the lens's floor stands smaller than its band, centred in it
    if (fit) assert.ok(fit.height <= 1 + 1e-9 && fit.width <= 1 + 1e-9 && (Math.max(fit.height, fit.width) > 0.999 || approaches.vinciApproachPose(id, true).fov === 34), `${id} fills its band`)
  }
})
