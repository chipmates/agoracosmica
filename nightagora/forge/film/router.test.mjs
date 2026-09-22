// The router's tests: a small graph drawn by hand, then the wing's own graph
// built from the certificate on disk.
//
//   node --test forge/film/router.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_WALL_STEPS, WAIT_AT_MIDDLE_S, guidedVisit, route } from './router.mjs'
import { buildGraph, openWing } from './graph.mjs'

/* ---- the hand-drawn graph ----
 *
 *   stop:D ── LEG ── stop:A ═ 1 ═ 2 ═ 3 ═ 4 ═ [stop:B | view:5] ═ 6 ═ stop:C  ╳ cut ╳  stop:E ─ X ─ Y
 *                                                                                       (approach, link)
 *   stop:F ═ f1 ═ f2 ═ f3 ═ f4 ═ f5            a wall with one end
 */
function fixture() {
  const nodes = [], edges = new Map()
  const node = (id, extra = {}) => nodes.push({ id, ...extra })
  const edge = (kind, from, to, seconds, passes = []) => {
    const id = `${from}>${to}`
    const held = edges.get(id)
    if (held) { held.kinds.push(kind); return }
    edges.set(id, { id, from, to, kinds: [kind], passes, framings: { wide: { seconds: { walk: seconds, brisk: seconds / 1.5 } }, upright: { seconds: { walk: seconds + 0.1, brisk: (seconds + 0.1) / 1.5 } } } })
  }
  const story = ['stop:D', 'stop:A', 'stop:B', 'stop:C', 'stop:E']
  story.forEach((id, order) => node(id, { kind: 'stop', order }))
  const wall = { 'stop:A': 0, 'view:1': 1, 'view:2': 2, 'view:3': 3, 'view:4': 4, 'stop:B': 5, 'view:5': 5, 'view:6': 6, 'stop:C': 7 }
  for (const [id, vertex] of Object.entries(wall)) {
    const n = nodes.find((x) => x.id === id)
    if (n) Object.assign(n, { wall: 'W', vertex })
    else node(id, { kind: 'view', wall: 'W', vertex })
  }
  const fwall = ['stop:F', 'f1', 'f2', 'f3', 'f4', 'f5']
  node('stop:F', { kind: 'stop', order: 5, wall: 'F', vertex: 0 })
  fwall.slice(1).forEach((id, i) => node(id, { kind: 'view', wall: 'F', vertex: i + 1 }))
  node('view:X', { kind: 'view' }); node('view:Y', { kind: 'view' })
  const between = (w, a, b) => nodes.filter((n) => n.wall === w && n.vertex > Math.min(a, b) && n.vertex < Math.max(a, b)).map((n) => n.id)
  const run = (w, a, b, kind) => edge(kind, a, b, 1 + 1.2 * Math.abs(nodes.find((n) => n.id === a).vertex - nodes.find((n) => n.id === b).vertex),
    between(w, nodes.find((n) => n.id === a).vertex, nodes.find((n) => n.id === b).vertex))
  const both = (w, a, b, kind) => { run(w, a, b, kind); run(w, b, a, kind) }
  edge('LEG', 'stop:D', 'stop:A', 8); edge('LEG', 'stop:A', 'stop:D', 8)
  both('W', 'stop:A', 'stop:B', 'LEG'); both('W', 'stop:B', 'stop:C', 'LEG')
  const walk = ['stop:A', 'view:1', 'view:2', 'view:3', 'view:4', 'view:5', 'view:6', 'stop:C']
  for (let i = 1; i < walk.length; i++) both('W', walk[i - 1], walk[i], 'STEP')
  for (const v of ['view:1', 'view:2', 'view:3', 'view:4']) { both('W', 'stop:A', v, 'RUN'); both('W', 'stop:B', v, 'RUN') }
  both('W', 'stop:A', 'view:5', 'RUN'); both('W', 'stop:C', 'view:5', 'RUN')
  both('W', 'stop:B', 'view:6', 'RUN'); both('W', 'stop:C', 'view:6', 'RUN')
  for (let i = 1; i < fwall.length; i++) both('F', fwall[i - 1], fwall[i], 'STEP')
  for (const v of fwall.slice(1)) both('F', 'stop:F', v, 'RUN')
  edge('APPROACH', 'stop:E', 'view:X', 2); edge('RETURN', 'view:X', 'stop:E', 2)
  edge('APPROACH', 'stop:E', 'view:Y', 2.5); edge('RETURN', 'view:Y', 'stop:E', 2.5)
  edge('LINK', 'view:X', 'view:Y', 1.5); edge('LINK', 'view:Y', 'view:X', 1.5)
  return {
    filmPace: 'walk', story, nodes, edges: [...edges.values()],
    opens: [['stop:B', 'view:5']],
    cuts: [{ from: 'stop:C', to: 'stop:E', title: { en: 'Amboise', de: 'Amboise' } }],
  }
}

test('standing where the visitor asked is no motion', () => {
  const g = fixture()
  assert.deepEqual(route(g, 'stop:A', 'stop:A'), { type: 'here', from: 'stop:A', to: 'stop:A', steps: [], seconds: 0 })
})

test('a work at the eye the visitor stands at opens without a clip', () => {
  const g = fixture()
  const plan = route(g, 'stop:B', 'view:5')
  assert.equal(plan.type, 'open')
  assert.equal(plan.seconds, 0)
})

test('rule 1: one clip where one exists', () => {
  const g = fixture()
  const plan = route(g, 'stop:A', 'view:3')
  assert.equal(plan.type, 'walk'); assert.equal(plan.rule, 1)
  assert.deepEqual(plan.clips, ['stop:A>view:3'])
  assert.equal(plan.seconds, 1 + 1.2 * 3)
})

test('rule 2: two clips through one rest node, standing a moment between them', () => {
  const g = fixture()
  const plan = route(g, 'view:2', 'view:6')
  assert.equal(plan.rule, 2)
  assert.deepEqual(plan.clips, ['view:2>stop:B', 'stop:B>view:6'])
  assert.deepEqual(plan.steps.map((s) => Object.keys(s)[0]), ['clip', 'wait', 'clip'])
  assert.equal(plan.steps[1].wait, WAIT_AT_MIDDLE_S)
  assert.equal(plan.steps[1].at, 'stop:B')
  assert.ok(Math.abs(plan.seconds - ((1 + 1.2 * 3) + (1 + 1.2 * 1) + WAIT_AT_MIDDLE_S)) < 1e-9)
})

test('rule 2 never walks through its target, nor back over where it began', () => {
  const g = fixture()
  // through stop:B passes view:4; back through stop:A passes view:1 again
  const plan = route(g, 'view:1', 'view:4')
  assert.equal(plan.rule, 3)
  assert.deepEqual(plan.clips, ['view:1>view:2', 'view:2>view:3', 'view:3>view:4'])
  // allowed to double back, the two clips through stop:A win
  const back = route(g, 'view:1', 'view:4', { noDoubleBack: false })
  assert.equal(back.rule, 2)
  assert.deepEqual(back.clips, ['view:1>stop:A', 'stop:A>view:4'])
})

test('rule 2 takes the quickest middle', () => {
  const g = fixture()
  // view:6 to stop:A: through stop:B (a run and the LEG) or view:5 (a step and a run)
  const quick = g.edges.find((e) => e.id === 'view:6>view:5')
  quick.framings.wide.seconds.walk = 0.5
  const plan = route(g, 'view:6', 'stop:A')
  assert.equal(plan.rule, 2)
  assert.deepEqual(plan.clips, ['view:6>view:5', 'view:5>stop:A'])
  const slow = fixture()
  slow.edges.find((e) => e.id === 'view:6>view:5').framings.wide.seconds.walk = 9
  assert.deepEqual(route(slow, 'view:6', 'stop:A').clips, ['view:6>stop:B', 'stop:B>stop:A'])
})

test('rule 3: at most three steps along a wall, then a dip', () => {
  const g = fixture()
  const three = route(g, 'f1', 'f4')
  assert.equal(three.rule, 3)
  assert.equal(three.clips.length, MAX_WALL_STEPS)
  assert.equal(three.steps.filter((s) => s.wait).length, MAX_WALL_STEPS - 1)
  const four = route(g, 'f1', 'f5')
  assert.equal(four.type, 'dip')
})

test('the partner at one eye: a walk to the stop, then the work opens there', () => {
  const g = fixture()
  const plan = route(g, 'view:2', 'view:5')
  assert.equal(plan.type, 'walk')
  assert.deepEqual(plan.clips, ['view:2>stop:B'])
  assert.deepEqual(plan.steps.at(-1), { open: 'view:5', at: 'stop:B' })
})

test('a chapter boundary is a dip with its title, never a walk', () => {
  const g = fixture()
  const plan = route(g, 'stop:C', 'stop:E')
  assert.equal(plan.type, 'dip'); assert.equal(plan.cut, true)
  assert.deepEqual(plan.steps, [{ dip: 'stop:E', title: { en: 'Amboise', de: 'Amboise' } }])
  const far = route(g, 'view:1', 'view:X')
  assert.equal(far.type, 'dip'); assert.equal(far.cut, undefined)
})

test('the seconds are the framing and the pace asked for', () => {
  const g = fixture()
  assert.equal(route(g, 'stop:D', 'stop:A', { framing: 'upright' }).seconds, 8.1)
  assert.ok(Math.abs(route(g, 'stop:D', 'stop:A', { pace: 'brisk' }).seconds - 8 / 1.5) < 1e-9)
})

test('the router writes nothing and answers the same twice', () => {
  const g = fixture()
  const before = JSON.stringify(g)
  const a = route(g, 'view:2', 'view:6'), b = route(g, 'view:2', 'view:6')
  guidedVisit(g)
  assert.deepEqual(a, b)
  assert.equal(JSON.stringify(g), before)
})

test('the guided visit walks the LEGs, reads at every stop and dips at a cut', () => {
  const g = fixture()
  const visit = guidedVisit(g, { readingSeconds: () => 4, titleSeconds: (t) => 2 + t.en.length / 10 })
  assert.deepEqual(visit.steps.map((s) => Object.keys(s)[0]), ['read', 'clip', 'read', 'clip', 'read', 'clip', 'read', 'dip', 'read'])
  assert.ok(Math.abs(visit.seconds - (5 * 4 + 8 + (1 + 6) + (1 + 2.4) + 2.7)) < 1e-9)
})

/* ---- the wing's own graph ---- */

const wing = await openWing()
const graph = buildGraph(wing)

test('the wing: every walked leg of the life is one clip, both ways, and the cuts dip', () => {
  for (let i = 1; i < graph.story.length; i++) {
    const a = graph.story[i - 1], b = graph.story[i]
    const cut = graph.cuts.some((c) => c.from === a && c.to === b)
    for (const [x, y] of [[a, b], [b, a]]) {
      const plan = route(graph, x, y)
      if (cut) assert.equal(plan.type, 'dip', `${x} to ${y}`)
      else assert.deepEqual([plan.rule, plan.clips.length], [1, 1], `${x} to ${y}`)
    }
  }
})

test('the wing: from every work on a wall, the gold way on is one clip and never back first', () => {
  const stops = graph.nodes.filter((n) => n.kind === 'stop')
  for (const view of graph.nodes.filter((n) => n.kind === 'view' && n.wall)) {
    const ahead = stops.filter((s) => s.wall === view.wall && s.vertex > view.vertex).sort((a, b) => a.vertex - b.vertex)[0]
      ?? stops.find((s) => s.wall === view.wall && s.vertex === 0)
    const plan = route(graph, view.id, ahead.id)
    assert.equal(plan.clips.length, 1, `${view.id} to ${ahead.id}`)
  }
})

test('the wing: neighbours on a wall are one step apart', () => {
  for (const e of graph.edges.filter((x) => x.kinds.includes('STEP'))) {
    assert.deepEqual(route(graph, e.from, e.to).clips, [e.id])
  }
})

test('the wing: every plan over every pair of nodes is a walk the graph holds', () => {
  const edges = new Map(graph.edges.map((e) => [e.id, e]))
  let dips = 0, walks = 0
  for (const framing of ['wide', 'upright']) for (const a of graph.nodes) for (const b of graph.nodes) {
    const plan = route(graph, a.id, b.id, { framing })
    if (plan.type === 'dip') { dips++; continue }
    if (plan.type !== 'walk') continue
    walks++
    const clips = plan.clips.map((id) => edges.get(id))
    assert.ok(clips.every(Boolean))
    assert.equal(clips[0].from, a.id)
    for (let i = 1; i < clips.length; i++) assert.equal(clips[i].from, clips[i - 1].to)
    const landed = clips.at(-1).to
    assert.ok(landed === b.id || graph.opens.some(([x, y]) => (x === landed && y === b.id) || (y === landed && x === b.id)))
    assert.ok(clips.every((c) => !c.passes.includes(b.id)), `${a.id} to ${b.id} walks through its target`)
    assert.ok(clips.slice(1).every((c) => !c.passes.includes(a.id)), `${a.id} to ${b.id} walks back over its start`)
    if (clips.length > 2) assert.ok(clips.length <= MAX_WALL_STEPS && clips.every((c) => c.kinds.includes('STEP')))
  }
  assert.ok(walks > 0 && dips > 0)
})

test('the wing: the guided visit is the fourteen LEGs forward and the two cuts', () => {
  const visit = guidedVisit(graph)
  assert.equal(visit.steps.filter((s) => s.clip).length, 14)
  assert.equal(visit.steps.filter((s) => s.dip).length, 2)
  assert.equal(visit.steps.filter((s) => s.read !== undefined).length, 17)
  // the life walked forward at the museum's own pace: ORDERS.md's 115.66 s on the desktop
  assert.ok(Math.abs(visit.seconds - 115.66) < 0.01, `${visit.seconds}`)
})
