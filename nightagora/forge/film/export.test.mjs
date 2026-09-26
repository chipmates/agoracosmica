// THE ENCODER'S CAP READS THE CLIP'S OWN BYTE LINE: the grass's legs are
// exempt and go uncapped, every other clip is capped under the rung's line.
// No browser: the caps as computed, and a tiny encode whose stream names the
// rate x264 was given, or names none.
//
//   node --test forge/film/export.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RUNGS, X264, openEncoder, vbvOf } from './export.mjs'
import { BYTE_EXEMPT, BYTE_LINES, lineOf } from './film-check.mjs'
import { FPS } from './graph.mjs'

/** the garden legs' graph seconds and the frames their export predicted */
const G = 18.083329887855317
const FRAMES = 544
const PLAIN = 'stop:study>stop:chamber'
/** the most a clip can spend under its buffer, in kbit */
const most = (v) => X264.vbv.init * v.bufsize + v.maxrate * (FRAMES + X264.vbv.spareFrames) / FPS

test("the grass's legs are not capped, every other clip is capped under the line", () => {
  assert.equal(BYTE_EXEMPT.cap, false)
  assert.equal(BYTE_EXEMPT.clips.length, 2)
  for (const rung of Object.keys(BYTE_LINES)) {
    for (const clip of BYTE_EXEMPT.clips) {
      assert.equal(lineOf(rung, clip), undefined, `${clip} ${rung}: no line`)
      assert.equal(vbvOf(rung, FRAMES, G, clip), null, `${clip} ${rung}: no cap`)
    }
    const plain = vbvOf(rung, FRAMES, G, PLAIN)
    assert.equal(lineOf(rung, PLAIN), BYTE_LINES[rung])
    assert.equal(plain.bufsize, Math.round(BYTE_LINES[rung] * X264.vbv.bufferSeconds), `${rung}: the plain clip's buffer at the line`)
    assert.ok(most(plain) <= BYTE_LINES[rung] * G, `${rung}: the plain clip under the line`)
    // no clip named keeps the rung's own line
    assert.deepEqual(vbvOf(rung, FRAMES, G), plain)
  }
  assert.deepEqual(vbvOf('1920x1080', FRAMES, G, PLAIN), { maxrate: 6094, bufsize: 6606, init: 0.9 }, 'the committed cap of the plain line, unchanged')
})

/** x264 writes its options into the stream: the rate and the buffer it was given, if any */
const vbvInStream = (file) => {
  const text = readFileSync(file).toString('latin1')
  assert.match(text, /x264 - core/, 'the stream carries its options')
  const hit = /vbv_maxrate=(\d+) vbv_bufsize=(\d+)/.exec(text)
  return hit ? { maxrate: Number(hit[1]), bufsize: Number(hit[2]) } : null
}

async function encodeTiny(clip, frames, graphSeconds) {
  const dir = mkdtempSync(join(tmpdir(), 'fix-grass-enc-'))
  const stage = { width: 64, height: 36 }
  const enc = openEncoder('wide', frames, dir, 'tiny', stage, graphSeconds, clip)
  const frame = Buffer.alloc(stage.width * stage.height * 3, 90)
  for (let i = 0; i < frames; i++) await enc.write(frame)
  await enc.close()
  const out = enc.rungs.map((r) => ({ rung: r.rung, vbv: r.vbv, stream: vbvInStream(r.file) }))
  rmSync(dir, { recursive: true, force: true })
  return out
}

test('the encoder caps a plain clip on every rung and leaves an exempt one uncapped, the one-frame clip too', async () => {
  const [garden] = BYTE_EXEMPT.clips
  for (const [clip, frames, seconds] of [[garden, 1, 0], [PLAIN, 1, 0], [garden, 12, 0.4], [PLAIN, 12, 0.4]]) {
    const rungs = await encodeTiny(clip, frames, seconds)
    assert.deepEqual(rungs.map((r) => r.rung), RUNGS.wide.map(([w, h]) => `${w}x${h}`))
    for (const r of rungs) {
      if (clip === garden) {
        assert.equal(r.vbv, null, `${clip} ${frames} frames ${r.rung}: no cap`)
        assert.equal(r.stream, null, `${clip} ${frames} frames ${r.rung}: the stream names no cap`)
        continue
      }
      const line = lineOf(r.rung, clip)
      const want = frames === 1 ? { maxrate: line, bufsize: line } : { maxrate: vbvOf(r.rung, frames, seconds, clip).maxrate, bufsize: line }
      assert.deepEqual({ maxrate: r.vbv.maxrate, bufsize: r.vbv.bufsize }, want, `${clip} ${frames} frames ${r.rung}: the cap`)
      assert.deepEqual(r.stream, want, `${clip} ${frames} frames ${r.rung}: the stream names the cap`)
    }
  }
})
