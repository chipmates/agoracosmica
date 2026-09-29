// A wall step in the film plays as the wing's arrows play it: asked quick,
// so the rail runs a step between two works at its stop-to-stop pace. The
// live seconds are read the way the arrows walk it (the rail's own `along`,
// quick, stepped on the film's clock); the graph's seconds and frames must
// match them within a frame, and nothing but a wall step is asked quick.
//
//   node --test forge/film/wall-steps.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three/webgpu'
import { FILM_PACE, FPS, FRAMINGS, buildGraph } from './graph.mjs'
import { openReplay } from './replay.mjs'

const replay = await openReplay()
const graph = buildGraph(replay.wing)
const WALL = 'picture-room-main'
const STEPS = [[5, 6], [7, 8], [8, 9]]
const vec = (a) => new THREE.Vector3(a[0], a[1], a[2])
const poseOf = (node, framing) => ({ eye: vec(node.pose[framing].eye), at: vec(node.pose[framing].at), fov: node.pose[framing].fov })
const viewAt = (vertex) => graph.nodes.find((n) => n.kind === 'view' && n.wall === WALL && n.vertex === vertex)

/** the seconds a step plays in live: from the frame the leg begins to the frame it arrives, inclusive */
function liveSeconds(from, to, framing) {
  const f = viewAt(from), t = viewAt(to), { width, height, phone } = FRAMINGS[framing]
  let frame = 0
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.25, 4000)
  const rail = replay.createRail(camera, () => frame / FPS, replay.authority)
  rail.set(f.station, poseOf(f, framing), true, phone, from)
  rail.update()
  assert.ok(rail.along(to, f.station, poseOf(t, framing), t.exhibit, phone, true), `${from}>${to} ${framing}: the rail took the step`)
  let began = -1, pace = 1
  while (frame < 3000) {
    frame++
    rail.update()
    if (began < 0 && rail.navigation.active) { began = frame; pace = rail.navigation.legPace }
    if (began >= 0 && !rail.navigation.active) return { seconds: (frame - began + 1) / FPS, pace }
  }
  throw new Error(`${from}>${to} ${framing}: never arrived`)
}

test('the picture wall\'s steps play in the film as the arrows play them live, both framings, within a frame', () => {
  for (const framing of Object.keys(FRAMINGS)) for (const [a, b] of STEPS) for (const [from, to] of [[a, b], [b, a]]) {
    const edge = graph.edges.find((e) => e.from === viewAt(from).id && e.to === viewAt(to).id)
    assert.ok(edge?.kinds.includes('STEP'), `${from}>${to} is a STEP`)
    assert.equal(edge.motion.quick, true, `${from}>${to} is asked quick`)
    const live = liveSeconds(from, to, framing)
    assert.ok(live.pace > 1, `${from}>${to} ${framing}: live runs it at the stop-to-stop pace (${live.pace})`)
    const film = edge.framings[framing]
    assert.ok(Math.abs(film.seconds[FILM_PACE] - live.seconds) <= 1 / FPS + 1e-9, `${from}>${to} ${framing}: graph ${film.seconds[FILM_PACE].toFixed(3)} s, live ${live.seconds.toFixed(3)} s`)
    assert.ok(Math.abs(film.frames / FPS - live.seconds) <= 1 / FPS + 1e-9, `${from}>${to} ${framing}: ${film.frames} frames, live ${live.seconds.toFixed(3)} s`)
  }
})

test('only wall steps are asked quick; a step from a wall\'s end station keeps the walk\'s pace', () => {
  for (const e of graph.edges) assert.equal(e.motion.quick === true, e.kinds.includes('STEP') && e.motion.rail === 'wall', e.id)
  const endStep = graph.edges.find((e) => e.kinds.includes('STEP') && e.motion.wall === WALL && e.motion.from === 0)
  assert.ok(endStep, 'a step leaves the wall\'s end station')
  const { width, height, phone } = FRAMINGS.wide
  const from = graph.nodes.find((n) => n.id === endStep.from), to = graph.nodes.find((n) => n.id === endStep.to)
  let frame = 0
  const rail = replay.createRail(new THREE.PerspectiveCamera(50, width / height, 0.25, 4000), () => frame / FPS, replay.authority)
  rail.set(from.railId ?? from.station, poseOf(from, 'wide'), true, phone, 0)
  rail.update()
  assert.ok(rail.along(endStep.motion.to, from.station, poseOf(to, 'wide'), to.exhibit, phone, true))
  while (frame < 40 && !rail.navigation.active) { frame++; rail.update() }
  assert.equal(rail.navigation.legPace, 1, 'the end station keeps the walk\'s pace')
})
