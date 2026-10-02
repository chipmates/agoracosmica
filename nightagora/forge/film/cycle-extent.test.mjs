// THE MACHINE'S EXTENT AND THE PLAYER'S FIT. The extent is read off the id
// pass (`cycle-extent.mjs`); the player fits it into the glass
// (`src/wings/picture/cycle.ts`, cycleFit): as big as the box allows with an
// even margin, never cut, the frame covering the glass wherever the machine
// can stay inside its box. No browser: the page's own fit, loaded in node.
//
//   node --test forge/film/cycle-extent.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EXTENT_SAMPLES, MACHINE_ROOT, extentRecord, idBox, machineIds, sampleFrames, toCss, unite } from './cycle-extent.mjs'
import { createLoader } from './load.mjs'

const loader = await createLoader({ stand: { 'src/wings/picture/cycle.css?inline.ts': { default: '' } } })
const { cycleFit, CYCLE_MARGIN } = loader.load('src/wings/picture/cycle.ts')

test('the machine is every body under the island\'s table, the floor is not', () => {
  const ids = machineIds([`${MACHINE_ROOT}/vinci/aerial-screw/sail`, 'vitrine/ground', MACHINE_ROOT, 'vitrine/turntable-ish', `${MACHINE_ROOT}/x/y`])
  assert.deepEqual([...ids].sort(), [1, 3, 5])
})

test('an id plane\'s box: the wanted ids only, far edges exclusive', () => {
  const w = 6, h = 4
  const ids = new Uint32Array(w * h)
  ids[1 * w + 2] = 7; ids[2 * w + 4] = 7; ids[3 * w + 0] = 9
  assert.deepEqual(idBox(ids, w, h, new Set([7])), [2, 1, 5, 3])
  assert.deepEqual(idBox(ids, w, h, new Set([7, 9])), [0, 1, 5, 4])
  assert.equal(idBox(ids, w, h, new Set([1])), null)
  assert.deepEqual(unite(null, [1, 2, 3, 4]), [1, 2, 3, 4])
  assert.deepEqual(unite([1, 2, 3, 4], [0, 3, 2, 5]), [0, 2, 3, 5])
})

test('every frame of a run up to the line, an even stride past it that keeps the steps and the last', () => {
  assert.deepEqual(sampleFrames(5, [2]).frames, [0, 1, 2, 3, 4])
  const long = sampleFrames(2160, [7, 1000, 2159])
  assert.equal(long.stride, 3)
  assert.ok(long.frames.length <= EXTENT_SAMPLES + 3)
  for (const f of [0, 7, 1000, 2159]) assert.ok(long.frames.includes(f), `frame ${f} sampled`)
})

test('the record: the union in CSS pixels widened to the half pixel, where each side is reached, the widest frame', () => {
  const boxes = new Map([[0, [10, 20, 30, 40]], [1, [5, 22, 31, 39]], [2, null], [3, [12, 18, 60, 41]]])
  const r = extentRecord(boxes, { size: [100, 100], div: 1, dpr: 2, stride: 1 })
  assert.deepEqual(r.box, [2.5, 9, 30, 20.5])
  assert.deepEqual(r.reach, { left: 1, top: 3, right: 3, bottom: 3 })
  assert.equal(r.widest, 3)
  assert.equal(r.emptyFrames, 1)
  assert.equal(r.frameEdges, undefined)
  const edge = extentRecord(new Map([[0, [0, 3, 100, 9]]]), { size: [100, 100], div: 1, dpr: 1, stride: 1 })
  assert.deepEqual(edge.frameEdges, ['left', 'right'])
  assert.deepEqual(toCss([3, 3, 7, 7], 1, 2), [1.5, 1.5, 3.5, 3.5])
  assert.throws(() => extentRecord(new Map([[0, null]]), { size: [10, 10], div: 1, dpr: 1, stride: 1 }), /no frame/)
})

// the upright frame as the recorder draws it, and the phone's glass with Safari's bar (390x664)
const UPRIGHT = { master: [860, 2500], dpr: 2, fit: [372, 421] }
const GLASS = { left: 9, top: 59, width: 372, height: 340 }
const BOX = { ...GLASS, height: GLASS.height - 104 }
const inside = (fit, extent, box, air) => {
  const [x0, y0, x1, y1] = extent
  const l = fit.left + x0 * fit.scale, t = fit.top + y0 * fit.scale, r = fit.left + x1 * fit.scale, b = fit.top + y1 * fit.scale
  const e = 1e-6
  return l >= box.left + air - e && t >= box.top + air - e && r <= box.left + box.width - air + e && b <= box.top + box.height - air + e
}

test('a wide flat machine fills its box across, centred, with an even margin, and the frame covers the glass', () => {
  const extent = [106.5, 538.5, 377, 722]
  const fit = cycleFit({ ...UPRIGHT, extent: { box: extent } }, BOX, GLASS)
  const air = CYCLE_MARGIN * Math.min(BOX.width, BOX.height)
  assert.ok(inside(fit, extent, BOX, air), 'the machine stands inside the box with its margin')
  const across = (extent[2] - extent[0]) * fit.scale, down = (extent[3] - extent[1]) * fit.scale
  assert.ok(Math.abs(across - (BOX.width - 2 * air)) < 1e-6 || Math.abs(down - (BOX.height - 2 * air)) < 1e-6, 'one side of the box is filled to its margin')
  assert.ok(fit.covers, 'the frame covers the glass')
  assert.ok(fit.scale > 2 * Math.min(BOX.width / 372, BOX.height / 421), 'over twice the size the island\'s fitting box gave it')
})

test('a tall machine on a short glass is never cut: the frame stands narrower than the glass and says so', () => {
  const extent = [80, 410, 350, 840]
  const fit = cycleFit({ ...UPRIGHT, extent: { box: extent } }, BOX, GLASS)
  assert.ok(inside(fit, extent, BOX, CYCLE_MARGIN * Math.min(BOX.width, BOX.height)))
  assert.equal(fit.covers, false)
  assert.ok(fit.width < GLASS.width)
})

test('covering moves the frame, never the machine out of its box', () => {
  // a machine near the frame's left edge: centred it would leave the glass's left uncovered
  const extent = [6, 500, 200, 700]
  const box = { left: 0, top: 0, width: 400, height: 300 }
  const cover = { left: 0, top: 0, width: 400, height: 420 }
  const fit = cycleFit({ ...UPRIGHT, extent: { box: extent } }, box, cover)
  assert.ok(inside(fit, extent, box, CYCLE_MARGIN * 300))
  assert.equal(fit.covers, false, 'the left edge cannot be covered without cutting')
  // with room to move, the frame is moved to cover
  const roomy = cycleFit({ ...UPRIGHT, extent: { box: [120, 560, 300, 700] } }, box, { left: 0, top: -50, width: 400, height: 400 })
  assert.ok(roomy.covers)
  assert.ok(inside(roomy, [120, 560, 300, 700], box, CYCLE_MARGIN * 300))
})

test('a layer with a ground of its own asks no cover: the machine stands centred in its box', () => {
  const extent = [80, 410, 350, 840]
  const fit = cycleFit({ ...UPRIGHT, extent: { box: extent } }, BOX, null)
  const air = CYCLE_MARGIN * Math.min(BOX.width, BOX.height)
  assert.ok(inside(fit, extent, BOX, air))
  assert.ok(fit.covers)
  const mid = (a, b) => (a + b) / 2
  assert.ok(Math.abs(fit.left + mid(extent[0], extent[2]) * fit.scale - (BOX.left + BOX.width / 2)) < 1e-9)
  assert.ok(Math.abs(fit.top + mid(extent[1], extent[3]) * fit.scale - (BOX.top + BOX.height / 2)) < 1e-9)
})

test('a cycle without an extent is fitted as before: the fitting box scaled into the box and centred', () => {
  const fit = cycleFit(UPRIGHT, BOX, GLASS)
  const scale = Math.min(BOX.width / 372, BOX.height / 421)
  assert.ok(Math.abs(fit.scale - scale) < 1e-9)
  assert.ok(Math.abs(fit.left - (BOX.left + (BOX.width - 430 * scale) / 2)) < 1e-9)
  assert.ok(Math.abs(fit.top - (BOX.top + (BOX.height - 1250 * scale) / 2)) < 1e-9)
  assert.equal(fit.covers, false, 'the column the owner saw: narrower than the glass')
})
