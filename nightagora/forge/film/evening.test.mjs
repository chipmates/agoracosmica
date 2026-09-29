// The grave's look up in the film: the node the graph carries, its camera
// replayed in node, and its place in the job. No browser, no render.
//
//   node --test forge/film/evening.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as THREE from 'three/webgpu'
import { EVENING_FPS, buildGraph } from './graph.mjs'
import { eveningTrack } from './evening.mjs'
import { WING_DIR } from './load.mjs'
import { openReplay, replayEdge } from './replay.mjs'
import { eveningEntryId, machinesOf, orderEntries, resumeWalks, stillId } from './render-all.mjs'

const replay = await openReplay()
const graph = buildGraph(replay.wing)
const farewell = replay.wing.loader.load(`${WING_DIR}/farewell.ts`)
const dossier = (slug) => JSON.parse(readFileSync(new URL(`../../src/wings/vinci/machines/data/${slug}.json`, import.meta.url), 'utf8'))
const entries = orderEntries(graph, machinesOf(graph, dossier))
/** a point ahead of a sampled camera (position then quaternion), as `lookUp()` aims its start */
const aheadOf = ([x, y, z, qx, qy, qz, qw], m) => {
  const d = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(qx, qy, qz, qw))
  return [x + d.x * m, y + d.y * m, z + d.z * m]
}

test('the graph carries the look up: from the grave, the farewell and the stars, at its own rate', () => {
  const ev = graph.evening
  assert.ok(ev, 'the evening is in the graph')
  assert.equal(ev.from, 'stop:grave')
  assert.equal(ev.fps, EVENING_FPS)
  // its length is the module's own: the farewell's run and the stars' hold before the lobby
  assert.equal(ev.farewell, farewell.FAREWELL_SECONDS)
  assert.equal(ev.seconds, ev.farewell + ev.rest)
  assert.equal(ev.frames, Math.round(ev.seconds * ev.fps))
  // the last frame's shutter closes before the run's end, where the live wing takes the lobby
  assert.ok((ev.frames - 1) / ev.fps + 0.25 / ev.fps < ev.seconds)
  assert.ok(!graph.nodes.some((n) => n.id === ev.id), 'never a node the eye is stood at')
  assert.equal(graph.story.at(-1), ev.from, 'the last stop of the life')
})

test('its first frame is the grave\'s still; every frame after is the farewell module\'s own pose at its instant, held through the stars', () => {
  // nothing of one farewell is pinned here (no rise, no path, no length): the module is asked, as the live wing asks it
  const ev = graph.evening
  const leaving = graph.edges.find((e) => e.from === ev.from)
  const node = graph.nodes.find((n) => n.id === ev.from)
  for (const framing of ['wide', 'upright']) {
    const phone = framing === 'upright'
    const t = eveningTrack(replay.wing, graph, framing)
    assert.equal(t.prints.length, ev.frames)
    assert.equal(t.prints[0], replayEdge(replay, graph, leaving, framing).prints[0], `${framing}: frame 0 is the grave's rest pose`)
    // the start the live look up takes: the eye as it stands, ten metres ahead, the stop's own lens
    const [x, y, z] = t.samples[0]
    const start = { eye: new THREE.Vector3(x, y, z), at: new THREE.Vector3(...aheadOf(t.samples[0], 10)), fov: replay.wing.rail.stationPose(node.station, phone).fov }
    for (const i of [1, Math.floor(ev.frames / 3), Math.floor(ev.frames / 2), ev.frames - 1]) {
      const share = Math.min(1, i / ev.fps / ev.farewell)
      const s0 = t.samples[i]
      const want = farewell.farewellPose(share, start, phone)
      assert.ok(Math.hypot(s0[0] - want.eye.x, s0[1] - want.eye.y, s0[2] - want.eye.z) < 1e-6, `${framing} frame ${i}: the eye is the farewell's`)
    }
    assert.notEqual(t.prints.at(-1), t.prints[0], `${framing}: the evening moves the eye`)
    // through the stars' hold the eye stays where the farewell ended
    const end = Math.ceil(ev.farewell * ev.fps)
    for (let i = end; i < ev.frames; i++) assert.equal(t.prints[i], t.prints[end], `${framing}: frame ${i} holds`)
    assert.match(t.key, /^[0-9a-f]{64}$/)
    assert.notEqual(t.key, eveningTrack(replay.wing, graph, framing === 'wide' ? 'upright' : 'wide').key)
  }
})

test('the job renders it in the spine, beside the grave\'s still, and the start and the descent come first', () => {
  const ev = graph.evening
  const at = new Map(entries.map((e) => [e.id, e.order]))
  for (const f of ['wide', 'upright']) {
    const id = eveningEntryId(ev.id, f)
    const e = entries.find((x) => x.id === id)
    assert.ok(e, `${id} planned`)
    assert.equal(e.kind, 'evening')
    assert.equal(e.phase, 'spine')
    assert.equal(e.frames, ev.frames)
    assert.ok(at.get(id) > at.get(stillId(ev.from, f)), 'after the still it opens on')
  }
  assert.equal(entries.filter((e) => e.kind === 'evening').length, 2)
  if (graph.start) {
    assert.deepEqual(entries.slice(0, 2).map((e) => e.id), [stillId(graph.start, 'wide'), stillId(graph.start, 'upright')])
    const descent = entries.findIndex((e) => e.kind === 'clip' && e.from === graph.start)
    assert.ok(descent > 0 && descent < 8, 'the descent is among the first entries')
  }
  // a resumed session that renders the evening walks a clip that leaves the grave
  const todo = entries.filter((e) => e.kind === 'evening' && e.framing === 'wide')
  assert.ok(resumeWalks(todo, graph, 'wide').some((e) => e.from === ev.from))
})

test('a farewell written anew flows through: its own length, its hold kept in the index, its own poses', async () => {
  const FILE = `${WING_DIR}/farewell.ts`, INDEX = `${WING_DIR}/index.ts`
  const text = readFileSync(new URL(`../../${FILE}`, import.meta.url), 'utf8')
  const index = readFileSync(new URL(`../../${INDEX}`, import.meta.url), 'utf8')
  // a shorter look up whose hold and dip stand in the index, as they once did
  const planted = text.replace(/export const FAREWELL_SECONDS = [0-9.]+/, 'export const FAREWELL_SECONDS = 11')
    .replace(/export const FAREWELL_REST = [0-9.]+\n/, '').replace(/export const FAREWELL_DIP = [0-9.]+\n/, '')
  assert.notEqual(planted, text)
  const other = await openReplay({ overlay: { [FILE]: planted, [INDEX]: index.replace(/^(\s*\/\*\* THE GRAVE'S LOOK UP)/m, '  const FAREWELL_REST=3, FAREWELL_DIP=.5\n$1') } })
  const g = buildGraph(other.wing)
  assert.deepEqual([g.evening.farewell, g.evening.rest, g.evening.dip, g.evening.seconds, g.evening.frames], [11, 3, 0.5, 14, 14 * EVENING_FPS])
  const t = eveningTrack(other.wing, g, 'wide')
  assert.equal(t.prints.length, 14 * EVENING_FPS)
  assert.notEqual(t.key, eveningTrack(replay.wing, graph, 'wide').key, 'another farewell, another motion key')
})
