// The whole film's job: its order, its areas, its ledger and its lock, on the
// wing's own graph and on a scratch folder. No browser, no render.
//
//   node --test forge/film/render-all.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildGraph, openWing } from './graph.mjs'
import { route } from './router.mjs'
import {
  PILOT, appendLedger, areaEntries, clipId, countsOf, gateLock, keysOf, machinesOf, onlyEntries, orderEntries, readLedger,
  recordWhole, stillCurrent, stillId, writeAtomic,
} from './render-all.mjs'

const wing = await openWing()
const graph = buildGraph(wing)
const dossier = (slug) => JSON.parse(readFileSync(new URL(`../../src/wings/vinci/machines/data/${slug}.json`, import.meta.url), 'utf8'))
const machines = machinesOf(graph, dossier)
const entries = orderEntries(graph, machines)
const scratch = () => mkdtempSync(join(tmpdir(), 'w7-job-'))

test('every clip, still and cycle of the graph stands in the job once, in both framings', () => {
  const ids = new Set(entries.map((e) => e.id))
  assert.equal(ids.size, entries.length)
  for (const f of ['wide', 'upright']) {
    for (const e of graph.edges) assert.ok(ids.has(clipId(e.id, f)), `${e.id} ${f}`)
    for (const n of graph.nodes) assert.ok(ids.has(stillId(n.id, f)), `${n.id} ${f}`)
  }
  assert.equal(machines.length, 13, 'thirteen machines move; the parachute stands')
  assert.ok(!machines.some((m) => m.slug === 'parachute'))
  assert.equal(entries.filter((e) => e.kind === 'cycle').length, 26)
  assert.equal(entries.length, 2 * (graph.edges.length + graph.nodes.length + machines.length))
  const c = countsOf(entries)
  assert.equal(c['cycle wide'].frames, 298 * 30)
})

test('the spine comes first: a film rendered in part is walkable from the entrance', () => {
  const spine = entries.filter((e) => e.phase === 'spine')
  // every stop of the life and every leg of the life, before anything else
  assert.equal(spine.length, 2 * (graph.story.length + graph.edges.filter((e) => e.kinds.includes('LEG')).length))
  assert.ok(entries.slice(0, spine.length).every((e) => e.phase === 'spine'))
  /* at every cut through the spine the stops rendered so far are joined by their legs: a
     visitor walking from the entrance never meets a leg whose far still is missing */
  const at = new Map(entries.map((e) => [e.id, e.order]))
  for (let i = 1; i < graph.story.length; i++) {
    const a = graph.story[i - 1], b = graph.story[i]
    const leg = graph.edges.find((e) => e.from === a && e.to === b)
    if (!leg) { assert.ok(graph.cuts.some((c) => c.from === a && c.to === b), `${a} to ${b} is a cut`); continue }
    for (const f of ['wide', 'upright']) {
      assert.ok(at.get(clipId(leg.id, f)) > at.get(stillId(b, f)), 'the leg after the still it arrives at')
      assert.ok(at.get(clipId(leg.id, f)) < at.get(stillId(graph.story[Math.min(i + 1, graph.story.length - 1)], f)) || i === graph.story.length - 1, 'and before the next stop')
    }
  }
  // then every view's still, before any other clip
  const firstRoom = entries.findIndex((e) => e.phase === 'rooms')
  assert.ok(entries.slice(spine.length, firstRoom).every((e) => e.kind === 'still'))
  assert.equal(entries.slice(0, firstRoom).filter((e) => e.kind === 'still').length, 2 * graph.nodes.length)
})

test('both framings of one piece stand side by side', () => {
  for (let i = 0; i < entries.length; i += 2) {
    const [a, b] = [entries[i], entries[i + 1]]
    assert.equal(a.id.replace(/ wide$/, ''), b.id.replace(/ upright$/, ''), `${a.id} beside ${b.id}`)
  }
})

test('an area names a stop and its legs, a room, or a machine with its clips and cycle', () => {
  const screw = areaEntries(entries, ['machine/aerial-screw'])
  assert.ok(screw.some((e) => e.kind === 'cycle' && e.slug === 'aerial-screw'))
  assert.ok(screw.some((e) => e.kind === 'still' && e.node === 'view:machine/aerial-screw'))
  assert.ok(!screw.some((e) => e.kind === 'still' && e.node === 'stop:flight'), 'the machine, not its room')
  for (const e of screw) assert.ok(e.kind === 'cycle' || e.id.includes('view:machine/aerial-screw'), e.id)
  const works = areaEntries(entries, ['stop:works'])
  assert.deepEqual(new Set(works.map((e) => e.kind)), new Set(['still', 'clip']))
  for (const e of works) assert.ok(e.id.includes('stop:works'), e.id)
  const room = areaEntries(entries, ['flight'])
  assert.ok(room.some((e) => e.kind === 'cycle' && e.slug === 'aerial-screw'))
  assert.ok(room.some((e) => e.id === clipId('stop:picture-room-west>stop:flight', 'wide')))
  assert.ok(!room.some((e) => e.id === clipId('stop:garden>stop:line-early', 'wide')))
})

test('the pilot: its four legs in both framings, its one cycle, every still', () => {
  const pilot = onlyEntries(entries, 'pilot')
  assert.equal(pilot.filter((e) => e.kind === 'clip').length, 2 * PILOT.clips.length)
  assert.equal(pilot.filter((e) => e.kind === 'cycle').length, 2)
  assert.equal(pilot.filter((e) => e.kind === 'still').length, 2 * graph.nodes.length)
  for (const id of PILOT.clips) assert.ok(graph.edges.find((e) => e.id === id)?.kinds.includes('LEG'), `${id} is a leg of the life`)
  // two legs of different weight: the long leg into the hall and the garden's
  const frames = (id) => graph.edges.find((e) => e.id === id).framings.wide.frames
  assert.notEqual(frames(PILOT.clips[0]), frames(PILOT.clips[2]))
})

test('the ledger: the last line of an entry stands, a torn line is no record, a record is whole only with its files', () => {
  const dir = scratch()
  try {
    appendLedger(dir, { id: 'a', status: 'failed' })
    appendLedger(dir, { id: 'a', status: 'done', written: [] })
    appendLedger(dir, { id: 'b', status: 'done', written: [] })
    writeFileSync(join(dir, 'ledger.jsonl'), `${readFileSync(join(dir, 'ledger.jsonl'), 'utf8')}{"id":"c","status":"do`)
    const r = readLedger(dir)
    assert.equal(r.get('a').status, 'done')
    assert.ok(!r.has('c'))
    mkdirSync(join(dir, 'x'))
    writeFileSync(join(dir, 'x', 'f.mp4'), 'abc')
    const rec = { written: [{ file: 'x/f.mp4', bytes: 3, sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' }] }
    assert.ok(recordWhole(dir, rec, { hash: true }))
    writeFileSync(join(dir, 'x', 'f.mp4'), 'abd')
    assert.ok(!recordWhole(dir, rec, { hash: true }))
    rmSync(join(dir, 'x', 'f.mp4'))
    assert.ok(!recordWhole(dir, rec))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('an atomic write leaves no half file under the name', () => {
  const dir = scratch()
  try {
    writeAtomic(join(dir, 'deep', 'release.json'), '{"a":1}')
    assert.equal(readFileSync(join(dir, 'deep', 'release.json'), 'utf8'), '{"a":1}')
    assert.deepEqual(readdirSync(join(dir, 'deep')), ['release.json'])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a done entry stays done under a later job only while its keys have not moved', () => {
  const job = { source: 'new', keys: { global: 'g', delivery: 'd' } }
  const e = { keys: { motion: 'm', picture: 'p' } }
  assert.ok(stillCurrent({ source: 'new' }, e, job))
  assert.ok(stillCurrent({ source: 'old', keys: keysOf(e, job) }, e, job))
  assert.ok(!stillCurrent({ source: 'old', keys: { ...keysOf(e, job), picture: 'q' } }, e, job))
  assert.ok(!stillCurrent({ source: 'old', keys: { ...keysOf(e, job), global: 'h' } }, e, job))
  assert.ok(!stillCurrent({ source: 'old' }, e, job), 'a record without keys is stale under another source')
})

test('the lock: slot A by mkdir, slot B only on a full battery, and only its own slot let go', async () => {
  const dir = scratch()
  try {
    const a = gateLock({ dir, owner: 'test a', batteryOf: () => 100, pollMs: 20 })
    await a.take()
    assert.ok(existsSync(join(dir, '.gate-lock', 'owner')))
    assert.match(readFileSync(join(dir, '.gate-lock', 'owner'), 'utf8'), /^test a \d\d:\d\d:\d\d/)
    const b = gateLock({ dir, owner: 'test b', batteryOf: () => 100, pollMs: 20 })
    await b.take()
    assert.equal(b.held, join(dir, '.gate-lock-b'), 'slot B on a full battery')
    // on a battery under the line a third waits, and takes slot A the moment it is free
    const c = gateLock({ dir, owner: 'test c', batteryOf: () => 50, pollMs: 20 })
    let got = false
    const waiting = c.take().then(() => { got = true })
    await new Promise((r) => setTimeout(r, 120))
    assert.equal(got, false, 'no slot while both are held')
    b.release()
    await new Promise((r) => setTimeout(r, 120))
    assert.equal(got, false, 'slot B is not taken under ninety percent')
    a.release()
    await waiting
    assert.equal(c.held, join(dir, '.gate-lock'))
    // a slot this lock did not make is never removed by it
    c.release()
    mkdirSync(join(dir, '.gate-lock'))
    writeFileSync(join(dir, '.gate-lock', 'owner'), 'someone else\n')
    c.release()
    a.dispose()
    assert.equal(readFileSync(join(dir, '.gate-lock', 'owner'), 'utf8'), 'someone else\n')
    for (const l of [a, b, c]) l.dispose()
    // mode none takes nothing
    const none = gateLock({ dir, mode: 'none' })
    await none.take()
    assert.equal(none.held, null)
    none.dispose()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('the router over a release that carries every edge walks the whole life', () => {
  // a missing clip stays an edge of the release, answered by its stills: the life never dips but at its two cuts
  const plans = graph.story.slice(1).map((to, i) => route(graph, graph.story[i], to, { framing: 'upright' }))
  assert.equal(plans.filter((p) => p.type === 'dip').length, graph.cuts.length)
  assert.ok(plans.filter((p) => p.type === 'walk').every((p) => p.clips.length === 1))
})
