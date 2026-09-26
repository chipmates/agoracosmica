// THE ID PASS READ AT ITS OWN ROW STRIDE: WebGPU's copy pads every row to 256
// bytes, and a dense read of the upright id target (195 texels) shears it.
// No browser: the page's own unpacking, loaded in node, on built buffers.
//
//   node --test forge/film/id-readback.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ID_DIV, STAGES } from './export.mjs'
import { createLoader } from './load.mjs'

const { idPlanes } = (await createLoader()).load('src/stack/export.ts')

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

test('both framings read every texel where it stands, padded or dense', () => {
  for (const [framing, stage] of Object.entries(STAGES)) {
    const w = Math.round(stage.width / ID_DIV), h = Math.round(stage.height / ID_DIV)
    for (const pad of [true, false]) {
      const { ids, depth } = idPlanes(readback(w, h, pad), w, h)
      assert.equal(ids.length, w * h)
      for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, h >> 1]]) {
        assert.equal(ids[y * w + x], 1 + y * w + x, `${framing} ${pad ? 'padded' : 'dense'} id at ${x},${y}`)
        assert.ok(Math.abs(depth[y * w + x] - (y + x / 1000)) < 1e-4, `${framing} ${pad ? 'padded' : 'dense'} depth at ${x},${y}`)
      }
    }
  }
})

test('the upright id target is the case a dense read shears', () => {
  const w = Math.round(STAGES.upright.width / ID_DIV)
  assert.notEqual((w * 16) % 256, 0, 'the upright id row is padded')
  assert.equal((Math.round(STAGES.wide.width / ID_DIV) * 16) % 256, 0, 'the wide id row is not')
})

test('a buffer that is neither padded nor dense is refused', () => {
  assert.throws(() => idPlanes(new Float32Array(195 * 10 * 4 + 4), 195, 10), /id readback/)
})
