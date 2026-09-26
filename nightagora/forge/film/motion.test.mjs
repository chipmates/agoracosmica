// THE FILM GATE'S TWO MOTION LINES, tested: the readings on made walks and a
// made room, then the lines on today's tracks (the two legs first seen as
// wrong come out red, a calm leg green), then the film check's wiring.
//
//   node --test forge/film/motion.test.mjs
//
// The real-track tests mount the drawn world near a handful of tracks (under
// a minute); nothing is rendered.
import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { MOTION_CAPS, headingReadings, middleOf, motionVerdict, swings, viewReadings } from './motion.mjs'
import { measureClip, motionOfTree } from './motion-gate.mjs'
import { reverseOf, openAudit } from './motion-audit.mjs'
import { SEE_THROUGH, castRay, gridOf, nearestAtEye, viewNear } from './near.mjs'

const FPS = 30
const yawQ = (h) => [0, Math.sin(h / 2), 0, Math.cos(h / 2)]
/** a made track: position and heading (radians, 0 north, positive west) a frame, the eye at 1.6 m */
function walk(seconds, at) {
  const out = []
  for (let i = 0; i <= Math.round(seconds * FPS); i++) {
    const { x, z, h } = at(i / FPS)
    out.push([x, 1.6, z, ...yawQ(h), 60])
  }
  return out
}
/** eased 0..1 over a walk: at rest at both ends, as a leg leaves and reaches its stops */
const ease = (t, T) => { const u = Math.min(1, Math.max(0, t / T)); return u * u * (3 - 2 * u) }

test('swings count the turning points a series gives back past the threshold', () => {
  assert.equal(swings([0, 1, 2, 3, 4, 5, 6], 1).reversals, 0, 'a steady turn has none')
  assert.equal(swings([0, 10, 0, 10, 0], 5).reversals, 3, 'three turns back')
  assert.equal(swings([0, 3, 0, 3, 0, 20], 5).reversals, 0, 'a jitter under the threshold is none')
})

test('a straight walk looking ahead, and a single smooth turn, are calm', () => {
  const straight = headingReadings(walk(10, (t) => ({ x: 0, z: -10 * ease(t, 10), h: 0 })), FPS)
  assert.equal(straight.yaw.reversals, 0)
  assert.equal(straight.way.inView.reversals, 0)
  assert.ok(straight.facing.backwardSeconds === 0)
  assert.equal(motionVerdict({ heading: straight, view: null }).heading, null)
  // a quarter circle of 6 m radius, the view turning with the way
  const arc = headingReadings(walk(12, (t) => { const a = (Math.PI / 2) * ease(t, 12); return { x: -6 + 6 * Math.cos(a), z: -6 * Math.sin(a), h: a } }), FPS)
  assert.equal(arc.yaw.reversals, 0)
  assert.ok(Math.abs(arc.yaw.netDeg - 90) < 1 && arc.yaw.excessDeg < 1, `the turn travels its net: ${arc.yaw.totalDeg} for ${arc.yaw.netDeg}`)
  assert.equal(motionVerdict({ heading: arc, view: null }).heading, null)
})

test('a weave under a steady view is red on the heading line, as in the gallery', () => {
  // the view held north while the eye swings east and west of its line every 2.5 s
  const weave = headingReadings(walk(12, (t) => ({ x: 0.8 * Math.sin((2 * Math.PI * t) / 2.5) * ease(t, 1) * (1 - ease(t - 11, 1)), z: -12 * ease(t, 12), h: 0 })), FPS)
  assert.equal(weave.yaw.reversals, 0, 'the view itself never swings')
  assert.ok(weave.way.inView.reversals > MOTION_CAPS.walkReversals, `the way walked swings ${weave.way.inView.reversals} times in the view`)
  assert.match(motionVerdict({ heading: weave, view: null }).heading, /the way the eye walks swings/)
})

test('a view swinging from side to side is red on the heading line', () => {
  const swing = headingReadings(walk(12, (t) => ({ x: 0, z: -12 * ease(t, 12), h: 0.35 * Math.sin((2 * Math.PI * t) / 3) })), FPS)
  assert.ok(swing.yaw.reversals > MOTION_CAPS.yawReversals, `${swing.yaw.reversals} reversals`)
  assert.ok(swing.yaw.excessDeg > MOTION_CAPS.yawExcessDeg, `${swing.yaw.excessDeg} degrees beyond the net`)
  assert.match(motionVerdict({ heading: swing, view: null }).heading, /view heading reversals/)
})

test('a walk looking back where it came from reads as backward, and the audit flags the leg', () => {
  const back = headingReadings(walk(12, (t) => ({ x: 0, z: -12 * ease(t, 12), h: Math.PI })), FPS)
  assert.ok(back.facing.backwardLongestSeconds > 9, `${back.facing.backwardLongestSeconds} s backward`)
  assert.equal(reverseOf({ kinds: ['LEG'], heading: back }), true)
  assert.equal(reverseOf({ kinds: ['VIEW'], heading: back }), false, 'only a walk between two stations')
})

test('the near line is red on a sustained near stretch in the walk, never at its ends or on a flick', () => {
  const n = 301, every = 2
  const mid = new Uint8Array(n).fill(1)
  for (let i = 0; i < 30; i++) { mid[i] = 0; mid[n - 1 - i] = 0 }
  const view = (near) => Array.from({ length: Math.ceil(n / every) }, (_, k) => {
    const i = k * every, s = near(i)
    return { i, min: s ? 0.5 : 1.5, share: { [MOTION_CAPS.nearM]: s } }
  })
  const verdict = (near) => motionVerdict({ heading: null, view: viewReadings(view(near), mid, FPS, { every }) }).near
  assert.match(verdict((i) => (i >= 100 && i < 130 ? 0.2 : 0)), /1\.00 s with 5% or more/, 'a second at a fifth of the frame')
  assert.equal(verdict((i) => (i < 30 || i > 270 ? 0.5 : 0)), null, 'the rest poses are the stops\' own')
  assert.equal(verdict((i) => (i >= 100 && i < 104 ? 0.5 : 0)), null, 'a flick of 0.13 s')
  assert.equal(verdict((i) => (i >= 100 && i < 160 ? 0.03 : 0)), null, 'an edge under the share')
})

test("the walk's middle leaves a metre of path at each end to the rest poses", () => {
  const track = walk(10, (t) => ({ x: 0, z: -10 * ease(t, 10), h: 0 }))
  const mid = middleOf(track, FPS, 1)
  const first = mid.indexOf(1), last = mid.lastIndexOf(1)
  assert.ok(Math.abs(track[first][2]) > 1 && Math.abs(track[first - 1][2]) <= 1)
  assert.ok(Math.abs(track[last][2] + 10) > 1 && Math.abs(track[last + 1][2] + 10) <= 1)
})

/* ---- a made room: a wall 2 m north, a pane 1 m north, a floor ---- */
function room() {
  const values = [], label = [], labels = ['wall', 'glass pane', 'floor']
  const quad = (a, b, c, d, l) => { values.push(...a, ...b, ...c, ...a, ...c, ...d); label.push(l, l) }
  quad([-5, 0, -2], [5, 0, -2], [5, 3, -2], [-5, 3, -2], 0)
  quad([-5, 0, -1], [5, 0, -1], [5, 3, -1], [-5, 3, -1], 1)
  quad([-5, 0, 5], [5, 0, 5], [5, 0, -5], [-5, 0, -5], 2)
  const clear = Uint8Array.from(label, (l) => (SEE_THROUGH.test(labels[l]) ? 1 : 0))
  return { values: Float64Array.from(values), label: Uint32Array.from(label), clear, labels, count: label.length }
}

test('the nearest surface at eye height: exact, the band leaves the floor out, glass is seen through', () => {
  const world = room()
  const grid = gridOf(world)
  const hit = nearestAtEye(grid, [0, 1.6, 0])
  assert.ok(Math.abs(hit.distance - 2) < 1e-9, `${hit.distance}`)
  assert.equal(hit.label, 'wall')
  const opaque = gridOf({ ...world, clear: new Uint8Array(world.count) })
  assert.ok(Math.abs(nearestAtEye(opaque, [0, 1.6, 0]).distance - 1) < 1e-9, 'an opaque pane stands at 1 m')
  // a low eye reaches the floor inside its band
  assert.ok(Math.abs(nearestAtEye(grid, [0, 0.5, 3]).distance - 0.5) < 1e-9)
})

test('a ray stops at the first drawn surface it meets, through glass', () => {
  const grid = gridOf(room())
  assert.ok(Math.abs(castRay(grid, [0, 1.6, 0], [0, 0, -1], 3).t - 2) < 1e-9)
  assert.ok(Math.abs(castRay(grid, [0, 1.6, 0], [0, -1, 0], 3).t - 1.6) < 1e-9)
  const up = castRay(grid, [0, 1.6, 0], [0, 1, 0], 3)
  assert.equal(up.triangle, -1)
  assert.equal(up.t, 3)
})

test('what the frame holds near the lens: a wall filling it, then open space', () => {
  const grid = gridOf(room())
  const facing = viewNear(grid, [0, 1.6, -1.4, ...yawQ(0), 60], 16 / 9, { cols: 24, rows: 12, limit: 1.5, under: [0.5, 0.75, 1] })
  assert.ok(Math.abs(facing.min - 0.6) < 1e-6 && Math.abs(facing.centre - 0.6) < 1e-6, `${facing.min} ${facing.centre}`)
  assert.equal(facing.share[0.75], 1)
  assert.equal(facing.share[0.5], 0)
  const away = viewNear(grid, [0, 1.6, -1.4, ...yawQ(Math.PI), 60], 16 / 9, { cols: 24, rows: 12, limit: 1.5, under: [0.75] })
  assert.equal(away.share[0.75], 0)
  assert.ok(Math.abs(away.min - 1.5) < 1e-9, 'nothing within the depth read')
})

/* ---- today's tracks (main as measured) ---- */
const GALLERY = 'stop:picture-room>stop:picture-room-lisa'
const PAVILION = 'stop:line-early>stop:garden'
const CALM = 'stop:chamber>stop:study'
let audit, measured

before(async () => {
  audit = await openAudit({ only: [GALLERY, PAVILION, CALM], log: (s) => console.log(`# ${s}`) })
  measured = new Map(audit.tracks.map((t) => {
    const r = measureClip(audit.grid, t.samples, t.framing)
    return [`${t.edge.id} ${t.framing}`, { ...r, verdict: motionVerdict({ heading: r.heading, view: r.view }) }]
  }))
})

test("the gallery leg seen as wrong is red on the heading line, both framings", () => {
  for (const framing of ['wide', 'upright']) {
    const r = measured.get(`${GALLERY} ${framing}`)
    assert.ok(r.verdict.heading, `${framing} is red`)
    assert.match(r.verdict.heading, /the way the eye walks swings/)
    console.log(`# ${GALLERY} ${framing}: ${r.verdict.heading}`)
  }
})

test('the pavilion leg seen as wrong is red on the near line (wide)', () => {
  const r = measured.get(`${PAVILION} wide`)
  assert.ok(r.verdict.near, 'wide is red')
  assert.ok(r.view.minM < 0.6, `the jamb at ${r.view.minM} m`)
  console.log(`# ${PAVILION} wide: ${r.verdict.near}`)
  // the phone's frame is narrow: the entrance beam stands at the cap's edge there (flagged.md)
  const up = measured.get(`${PAVILION} upright`)
  console.log(`# ${PAVILION} upright: nearest in view ${up.view.minM.toFixed(3)} m, near ${up.verdict.near ?? 'green'}`)
})

test('a calm leg is green on both lines, both framings', () => {
  const ats = [...measured.keys()].filter((k) => k.startsWith(`${CALM} `))
  assert.equal(ats.length, 2)
  for (const at of ats) assert.deepEqual(measured.get(at).verdict, { near: null, heading: null }, at)
})

test("the film check's reading of a tree agrees with the audit's, clip for clip", async () => {
  // a tree's clips carry the whole replay (the next still after the arrival): the gate cuts it at the arrival
  const tree = { clips: new Map(audit.tracks.map((t) => [`${t.edge.id} ${t.framing}`, { clip: t.edge.id, framing: t.framing, frames: t.track.arrivedAt, samples: t.track.samples }])) }
  const motion = await motionOfTree(tree, { grid: audit.grid })
  assert.equal(motion.readings.size, measured.size)
  for (const [at, m] of motion.readings) assert.deepEqual(motionVerdict(m, motion.caps), measured.get(at).verdict, at)
})
