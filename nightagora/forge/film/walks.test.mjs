// The clips a press may walk, on the wing's own graph: the wall of sheets is
// entered at its first sheet and read sheet to sheet, never run along.
//
//   node --test forge/film/walks.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { route } from './router.mjs'
import { walkedClip } from './walks.mjs'
import { buildGraph, openWing } from './graph.mjs'

const wing = await openWing()
const graph = buildGraph(wing)
const walked = walkedClip(graph.nodes)
const walkable = { ...graph, edges: graph.edges.filter(walked) }
const edges = new Map(graph.edges.map((e) => [e.id, e]))
const sheetView = (id) => graph.nodes.find((n) => n.id === id && n.kind === 'view' && n.exhibit?.startsWith('sheet/'))
/** a clip that runs past sheets rather than stepping between two */
const runsAlong = (id) => {
  const e = edges.get(id)
  return e.kinds.includes('RUN') && !e.kinds.includes('STEP') && Boolean(sheetView(e.from) || sheetView(e.to))
}
const body = graph.nodes.filter((n) => n.kind === 'view' && n.station === 'body' && n.exhibit.startsWith('sheet/'))
const wall = body.filter((n) => n.wall)

test('the release graph holds runs past the sheets, which the rule leaves unwalked', () => {
  assert.ok(graph.edges.some((e) => runsAlong(e.id)))
  assert.ok(!walkable.edges.some((e) => runsAlong(e.id)))
  // the wall's own steps all stay
  assert.equal(walkable.edges.filter((e) => e.kinds.includes('STEP')).length, graph.edges.filter((e) => e.kinds.includes('STEP')).length)
})

test('the wall is entered at its first sheet by one straight step', () => {
  const first = wall[0]
  for (const framing of ['wide', 'upright']) {
    const plan = route(walkable, 'stop:body', first.id, { framing })
    assert.equal(plan.type, 'walk')
    assert.equal(plan.clips.length, 1)
    assert.ok(edges.get(plan.clips[0]).kinds.includes('STEP'), plan.clips[0])
  }
})

test('the wall is read sheet to sheet: each neighbour one step, both ways', () => {
  for (let i = 1; i < wall.length; i++) {
    for (const [a, b] of [[wall[i - 1], wall[i]], [wall[i], wall[i - 1]]]) {
      if (a.wall !== b.wall) continue
      for (const framing of ['wide', 'upright']) {
        const plan = route(walkable, a.id, b.id, { framing })
        assert.deepEqual([plan.type, plan.clips?.length], ['walk', 1], `${a.id} to ${b.id} ${framing}`)
        assert.ok(edges.get(plan.clips[0]).kinds.includes('STEP'), `${a.id} to ${b.id} ${framing}`)
      }
    }
  }
})

test('no press to or from a sheet runs along the wall', () => {
  const ends = ['stop:body', 'stop:body-valve', 'stop:reading-table', ...body.map((n) => n.id)]
  let dips = 0
  for (const framing of ['wide', 'upright']) for (const a of ends) for (const b of ends) {
    if (a === b || !(sheetView(a) || sheetView(b))) continue
    const plan = route(walkable, a, b, { framing })
    if (plan.type === 'dip') { dips++; continue }
    for (const clip of plan.clips ?? []) assert.ok(!runsAlong(clip), `${a} to ${b} ${framing} runs ${clip}`)
  }
  // the far sheets are reached by the dark, never by a winding run
  assert.ok(dips > 0)
})

test('before the rule, the wall mark\'s old target was reached by a run along the wall', () => {
  const plan = route(graph, 'stop:body', 'view:sheet/rcin-919010', { framing: 'wide' })
  assert.ok(plan.clips.some(runsAlong))
})
