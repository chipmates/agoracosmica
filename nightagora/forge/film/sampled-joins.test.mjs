// THE SAMPLED JOINS' STATISTIC: the codec's own edges inside a macroblock
// leave it, a shift of colour or light and a wrong picture move it; the ten
// ends are spread over the clips. No browser.
//
//   node --test forge/film/sampled-joins.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JOIN_TOLERANCE, SAMPLED_JOINS } from './film-check.mjs'
import { BLOCK, blockDelta, pickSampled } from './sampled-joins.mjs'

const W = 64, H = 40
/** a picture of grass-like noise, RGBA */
function picture(seed = 1) {
  const a = new Uint8ClampedArray(W * H * 4)
  let s = seed
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  for (let k = 0; k < a.length; k += 4) { a[k] = 60 + rnd() * 80; a[k + 1] = 90 + rnd() * 100; a[k + 2] = 40 + rnd() * 60; a[k + 3] = 255 }
  return a
}
const copy = (a, change) => { const b = new Uint8ClampedArray(a); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) change(b, (y * W + x) * 4, x, y); return b }

test('the same picture reads zero', () => {
  const a = picture()
  assert.deepEqual(blockDelta(a, a, W, H), { maxDelta: 0, y: 0, cb: 0, cr: 0 })
})

test("the codec's own edges inside a macroblock leave the statistic under the tolerance", () => {
  const a = picture()
  // 4:2:0 moves colour between the two pixels of a chroma pair, and quantization rings on edges:
  // strong per pixel, balanced inside every 2 by 2 cell
  const b = copy(a, (p, k, x, y) => { const s = (x + y) % 2 ? 1 : -1; p[k] = a[k] + 18 * s; p[k + 2] = a[k + 2] - 14 * s; p[k + 1] = a[k + 1] + 6 * s })
  let pixelMax = 0
  for (let k = 0; k < a.length; k += 4) for (let c = 0; c < 3; c++) pixelMax = Math.max(pixelMax, Math.abs(a[k + c] - b[k + c]))
  assert.ok(pixelMax >= 14, `per pixel the two part by ${pixelMax}`)
  assert.ok(blockDelta(a, b, W, H).maxDelta <= JOIN_TOLERANCE, 'the block means agree')
})

test('a shift of light or colour, and a wrong picture, turn it red', () => {
  const a = picture()
  const brighter = copy(a, (p, k) => { p[k] = a[k] + 3; p[k + 1] = a[k + 1] + 3; p[k + 2] = a[k + 2] + 3 })
  assert.ok(blockDelta(a, brighter, W, H).y > JOIN_TOLERANCE, 'three levels brighter')
  const warmer = copy(a, (p, k) => { p[k] = a[k] + 6 })
  const w = blockDelta(a, warmer, W, H)
  assert.ok(w.maxDelta > JOIN_TOLERANCE && w.cr > w.cb, 'warmer: the red difference')
  // a frame out of place: an edge of the picture stands a few pixels over
  const edge = (at) => copy(a, (p, k, x) => { if (x >= at) for (let c = 0; c < 3; c++) p[k + c] = a[k + c] >> 2 })
  assert.ok(blockDelta(edge(BLOCK + 8), edge(BLOCK + 12), W, H).maxDelta > JOIN_TOLERANCE, 'an edge four pixels over')
})

test('the last row and column of blocks count as far as the picture reaches', () => {
  const a = picture()
  // 40 rows: the third row of blocks holds 8 rows only
  const low = copy(a, (p, k, x, y) => { if (y >= 32) p[k + 1] = a[k + 1] + 10 })
  assert.ok(blockDelta(a, low, W, H).maxDelta > JOIN_TOLERANCE)
})

test('ten ends spread over the clips, one end a clip, the ends in turn', () => {
  const clips = Array.from({ length: 40 }, (_, k) => ({ clip: `stop:a${String(k).padStart(2, '0')}>stop:b`, framing: k % 2 ? 'wide' : 'upright' }))
  const picks = pickSampled(clips)
  assert.equal(picks.length, SAMPLED_JOINS)
  assert.equal(new Set(picks.map((p) => `${p.clip} ${p.framing}`)).size, SAMPLED_JOINS)
  assert.deepEqual([...new Set(picks.map((p) => p.end))].sort(), ['first', 'last'])
  assert.deepEqual(pickSampled(clips), picks, 'the same clips give the same ten')
  const few = pickSampled(clips.slice(0, 4))
  assert.equal(few.length, 8, 'four clips give their eight ends')
  const some = pickSampled(clips.slice(0, 7))
  assert.equal(some.length, SAMPLED_JOINS)
  assert.equal(new Set(some.map((p) => `${p.clip} ${p.framing} ${p.end}`)).size, SAMPLED_JOINS)
})
