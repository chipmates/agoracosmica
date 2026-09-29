// The grave's look up in the film: the node the graph carries, its camera
// replayed in node, and its place in the job. No browser, no render.
//
//   node --test forge/film/evening.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('the graph carries the look up: from the grave, the farewell and the stars, at its own rate', () => {
  const ev = graph.evening
  assert.ok(ev, 'the evening is in the graph')
  assert.equal(ev.from, 'stop:grave')
  assert.equal(ev.fps, EVENING_FPS)
  assert.equal(ev.seconds, farewell.FAREWELL_SECONDS + farewell.FAREWELL_REST)
  assert.equal(ev.frames, Math.round(ev.seconds * ev.fps))
  // the last frame's shutter closes before the run's end, where the live wing takes the lobby
  assert.ok((ev.frames - 1) / ev.fps + 0.25 / ev.fps < ev.seconds)
  assert.ok(!graph.nodes.some((n) => n.id === ev.id), 'never a node the eye is stood at')
  assert.equal(graph.story.at(-1), ev.from, 'the last stop of the life')
})

test('its first frame is the grave\'s still, as every clip at the grave prints it; it rises and holds the stars', () => {
  const ev = graph.evening
  const leaving = graph.edges.find((e) => e.from === ev.from)
  for (const framing of ['wide', 'upright']) {
    const t = eveningTrack(replay.wing, graph, framing)
    assert.equal(t.prints.length, ev.frames)
    assert.equal(t.prints[0], replayEdge(replay, graph, leaving, framing).prints[0], `${framing}: frame 0 is the grave's rest pose`)
    // the first moving frame moves by little: the rise eases out of the still
    const at = (i) => t.prints[i].split(',').map(Number)
    assert.ok(Math.hypot(at(1)[0] - at(0)[0], at(1)[1] - at(0)[1], at(1)[2] - at(0)[2]) < 0.05, `${framing}: the rise eases in`)
    assert.ok(at(ev.frames - 1)[1] - at(0)[1] > 15, `${framing}: the eye rises over the house`)
    // through the rest the eye holds where the farewell ended
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
