// The same place on the way in the other framing, on tracks made here, and on
// a release's own tracks where FILM_RELEASE names its folder.
//
//   node --test forge/film/same-place.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EYE_MOST, samePlace } from './same-place.mjs'

/** a print looking along -z, turned by `yaw` about y, at eye (x, 1.6, z) */
const print = (x, z, yaw = 0) => [x, 1.6, z, 0, yaw, 0, 60]
/** a walk of `frames` frames along z from 0 to `metres`, at the pace `ease` gives a share */
const walk = (frames, metres, ease = (s) => s) => Array.from({ length: frames }, (_, i) => print(0, -metres * ease(i / (frames - 1))))
const eyeGap = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

test('one path at two paces meets at the eye, not at the share', () => {
  const wide = walk(330, 12)
  const upright = walk(517, 12, (s) => s * s)
  for (const at of [40, 82, 165, 231, 300]) {
    const m = samePlace(wide, at, upright)
    assert.ok(m, `a place for frame ${at}`)
    assert.ok(eyeGap(wide[at], upright[m.frame]) < 0.05, `frame ${at} meets within 5 cm`)
    // the share alone would put the eye metres off
    const byShare = upright[Math.round((at / 329) * 516)]
    if (at > 40 && at < 300) assert.ok(eyeGap(wide[at], byShare) > 1, `frame ${at}: the share is no common measure here`)
  }
})

test('where the eye stands still, the look decides', () => {
  // both turn a radian on the spot, the one in 30 frames, the other in 60, then walk
  const turn = (n) => Array.from({ length: n }, (_, i) => print(0, 0, i / (n - 1)))
  const a = [...turn(30), ...walk(60, 4).map((p) => [p[0], p[1], p[2], 0, 1, 0, 60])]
  const b = [...turn(60), ...walk(90, 4).map((p) => [p[0], p[1], p[2], 0, 1, 0, 60])]
  const m = samePlace(a, 15, b)
  assert.ok(m)
  assert.ok(Math.abs(b[m.frame][4] - a[15][4]) < 0.03, 'the same turn of the head')
  assert.ok(m.look < 0.03)
})

test('no frame within a stride is no place', () => {
  const a = walk(100, 10)
  const b = Array.from({ length: 100 }, (_, i) => print(3, -i / 10))
  assert.equal(samePlace(a, 50, b), null)
  assert.equal(samePlace(a, 50, b, { most: 4 })?.frame !== undefined, true)
  assert.equal(samePlace(null, 0, b), null)
  assert.equal(samePlace(a, 0, []), null)
})

test('a frame past either end is read at that end', () => {
  const a = walk(50, 5), b = walk(80, 5)
  assert.equal(samePlace(a, -4, b)?.frame, 0)
  assert.equal(samePlace(a, 999, b)?.frame, 79)
})

const RELEASE = process.env['FILM_RELEASE']
test('a release: every leg meets itself, and both ends meet', { skip: !RELEASE || !existsSync(join(RELEASE ?? '', 'film.json')) }, () => {
  const release = JSON.parse(readFileSync(join(RELEASE, 'film.json'), 'utf8'))
  const track = (file) => JSON.parse(readFileSync(join(RELEASE, file), 'utf8')).map((p) => p.split(',').map(Number))
  let legs = 0
  for (const edge of release.edges) {
    const w = edge.framings.wide?.track, u = edge.framings.upright?.track
    if (!w || !u) continue
    const [a, b] = [track(w), track(u)]
    legs++
    // a track found in itself is its own frame
    for (const at of [0, Math.floor(a.length / 2), a.length - 1]) assert.ok(eyeGap(a[samePlace(a, at, a).frame], a[at]) < 1e-9)
    // the last frames stand at the arrival in both framings
    const end = samePlace(a, a.length - 1, b, { most: Infinity })
    assert.ok(end.eye <= EYE_MOST || eyeGap(a.at(-1), b.at(-1)) > EYE_MOST, `${edge.id}: the arrival is met where both framings arrive at one eye`)
  }
  assert.ok(legs > 0)
})
