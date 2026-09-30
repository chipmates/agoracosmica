// THE CARRY, on a scratch job: a done record keyed under the definition before
// is carried only when its four keys are the tree's own under that definition;
// the carry is appended, never rewritten; the job then counts it done and the
// record the gate reads names what it was rendered with.
//
//   node --test forge/film/carry.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { carriedRecord, carryFrom, carryPlan } from './carry.mjs'
import { carriedHolds } from './film-check.mjs'
import { GLOBAL_DEFINITION, GLOBAL_DEFINITIONS } from './keys.mjs'
import { appendLedger, beforeOf, readLedger, stillCurrent, writeRecord } from './render-all.mjs'

const G1 = 'a'.repeat(32), G2 = 'b'.repeat(32), D = 'd'.repeat(32)
const clip = { id: 'clip x>y wide', kind: 'clip', framing: 'wide', edge: 'x>y', from: 'x', to: 'y', keys: { motion: 'm1', picture: 'p1', delivery: D } }
const still = { id: 'still x wide', kind: 'still', framing: 'wide', node: 'x', keys: { motion: 'm2', picture: 'p2' } }
const moved = { id: 'still y wide', kind: 'still', framing: 'wide', node: 'y', keys: { motion: 'm3', picture: 'p3' } }
const cycle = { id: 'cycle machine/lathe wide', kind: 'cycle', framing: 'wide', slug: 'lathe', keys: { motion: null, picture: 'c1' } }
const job = { created: 'now', source: 's2', keys: { format: 'vinci-film-keys-v1', definition: GLOBAL_DEFINITION, global: G2, delivery: D }, entries: [clip, still, moved, cycle] }
const tree = {
  clips: new Map([['x>y wide', { motion: 'm1', picture: 'p1', delivery: D }]]),
  stills: new Map([['x wide', { motion: 'm2', picture: 'p2' }], ['y wide', { motion: 'm3', picture: 'p3' }]]),
  evenings: new Map(), cycles: new Map([['lathe', 'c1']]), delivery: D, global: G2, globalBefore: G1,
  added: { 'farewell-sky.ts#twilightRadiance': 't1', 'farewell-sky.ts#sunDiscRadiance': 's1' },
  addedAt: new Map([['h1', { 'farewell-sky.ts#twilightRadiance': 't1', 'farewell-sky.ts#sunDiscRadiance': 's1' }], ['h0', { 'farewell-sky.ts#twilightRadiance': 't0', 'farewell-sky.ts#sunDiscRadiance': 's1' }], ['gone', null]]),
}
const old = (e, over = {}, head = 'h1') => ({ id: e.id, kind: e.kind, framing: e.framing, status: 'done', source: 's1', session: 'one', at: 'then', head, keys: { motion: e.keys.motion, picture: e.keys.picture, global: G1, delivery: e.keys.delivery ?? D, ...over }, written: [] })

test('a record whose old keys are the tree\'s own is carried; one whose picture moved is not', () => {
  const records = new Map([[clip.id, old(clip)], [still.id, old(still)], [moved.id, old(moved, { picture: 'p-old' })], [cycle.id, old(cycle)]])
  const plan = carryPlan(job, records, tree)
  assert.deepEqual(plan.carried.map((c) => c.e.id).sort(), [clip.id, still.id, cycle.id].sort())
  assert.deepEqual(plan.stale, [{ id: moved.id, moved: ['picture'] }])
  for (const c of plan.carried) assert.ok(!stillCurrent(c.r, c.e, job), 'before the carry the entry would render again')
  const rec = carriedRecord(plan.carried[0], { job, at: 'carry-time' })
  assert.ok(stillCurrent(rec, plan.carried[0].e, job), 'after it, it stays done')
  assert.deepEqual(rec.carried.from, plan.carried[0].r.keys)
  assert.equal(rec.session, 'one', 'the session a join is judged by stays the render\'s')
  assert.equal(rec.at, 'then')
})

test('a record already under the keys now is left alone, a failed one is never carried, a global the old definition did not give is stale', () => {
  const records = new Map([[clip.id, { ...old(clip), keys: { ...old(clip).keys, global: G2 } }], [still.id, { ...old(still), status: 'failed' }], [cycle.id, old(cycle, { global: 'f'.repeat(32) })]])
  const plan = carryPlan(job, records, tree)
  assert.deepEqual(plan.current, [clip.id])
  assert.equal(plan.carried.length, 0)
  assert.deepEqual(plan.stale, [{ id: cycle.id, moved: ['global'] }])
})

test('a job not planned on the tree under the definition now is refused', () => {
  assert.throws(() => carryPlan({ ...job, keys: { ...job.keys, definition: undefined } }, new Map(), tree), /plan it again/)
  assert.throws(() => carryPlan({ ...job, keys: { ...job.keys, global: G1 } }, new Map(), tree), /not the tree's/)
  assert.throws(() => carryPlan({ ...job, entries: [{ ...still, keys: { ...still.keys, picture: 'zz' } }] }, new Map(), tree), /not the tree's/)
})

test('carried, the ledger grows by one line an entry and the release names the keys the files were rendered with', () => {
  const dir = mkdtempSync(join(tmpdir(), 'w7-carry-'))
  try {
    const r = { ...old(still), rung: { file: 'stills/wide/1920x1080/x.png', bytes: 1, sha256: 'e' }, raw: 'raw', sidecar: 'sidecars/wide/stills/x.json' }
    appendLedger(dir, r)
    const before = readFileSync(join(dir, 'ledger.jsonl'), 'utf8')
    const plan = carryPlan({ ...job, entries: [still] }, readLedger(dir), tree)
    for (const c of plan.carried) appendLedger(dir, carriedRecord(c, { job }))
    const after = readFileSync(join(dir, 'ledger.jsonl'), 'utf8')
    assert.ok(after.startsWith(before), 'append only')
    assert.equal(after.split('\n').filter(Boolean).length, 2)
    const records = readLedger(dir)
    assert.equal(records.get(still.id).carried.fromDefinition, 'v1')
    writeRecord(dir, { ...job, head: 'h', entries: [still], recipe: {} }, records)
    const release = JSON.parse(readFileSync(join(dir, 'release.json'), 'utf8'))
    assert.equal(release.definition, GLOBAL_DEFINITION)
    assert.deepEqual(release.stills[0].keys, { motion: 'm2', picture: 'p2', global: G2, delivery: D })
    assert.deepEqual(release.stills[0].carried, { keys: r.keys, fromDefinition: 'v1', definition: GLOBAL_DEFINITION })
    // a second carry finds nothing to do
    assert.equal(carryPlan({ ...job, entries: [still] }, records, tree).carried.length, 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test("the day dome's evening terms: a record rendered where they stood otherwise is not carried, though the old key could not see them", () => {
  const records = new Map([[clip.id, old(clip, {}, 'h0')], [still.id, old(still, {}, 'gone')], [cycle.id, old(cycle, {}, 'h1')], [moved.id, { ...old(moved), head: undefined }]])
  const plan = carryPlan(job, records, tree)
  assert.deepEqual(plan.carried.map((c) => c.e.id), [cycle.id])
  assert.deepEqual(plan.stale.map((x) => [x.id, x.moved]).sort(), [[clip.id, ['added parts']], [moved.id, ['added parts']], [still.id, ['added parts']]].sort())
})

/* ---- from the second definition to the third ---- */
const V2 = 'library-placed-v2', G3 = 'c'.repeat(32)
const job3 = { ...job, keys: { ...job.keys, global: G3, before: { definition: V2, global: G2 } } }
const tree3 = { ...tree, global: G3, globals: { v1: G1, [V2]: G2, [GLOBAL_DEFINITION]: G3 }, added: {}, addedAt: new Map() }
/** a line as this afternoon's carry from v1 to v2 wrote it */
const afternoon = (e) => {
  const r = old(e)
  return { ...r, rung: { file: 'stills/wide/1920x1080/x.png', bytes: 1, sha256: 'e' }, keys: { ...r.keys, global: G2 }, carried: { from: r.keys, fromDefinition: 'v1', definition: V2, globalBefore: G1, job: 'afternoon', at: 'noon', by: 'forge/film/carry.mjs' } }
}

test('the third definition is the one now, and every older one stays named', () => {
  assert.equal(GLOBAL_DEFINITION, 'library-placed-v3')
  assert.deepEqual(GLOBAL_DEFINITIONS, ['v1', V2, GLOBAL_DEFINITION])
})

test('a plan names the definition it replaced, and keeps it over a plan under the same one', () => {
  assert.deepEqual(beforeOf(null, GLOBAL_DEFINITION), {})
  assert.deepEqual(beforeOf({ definition: V2, global: G2 }, GLOBAL_DEFINITION), { before: { definition: V2, global: G2 } })
  assert.deepEqual(beforeOf({ global: G1 }, V2), { before: { definition: 'v1', global: G1 } }, 'a job that named none was v1')
  assert.deepEqual(beforeOf({ definition: GLOBAL_DEFINITION, global: G3, before: { definition: V2, global: G2 } }, GLOBAL_DEFINITION), { before: { definition: V2, global: G2 } })
  assert.deepEqual(beforeOf({ definition: GLOBAL_DEFINITION, global: G3 }, GLOBAL_DEFINITION), {})
  assert.equal(carryFrom(job3), V2)
  assert.equal(carryFrom(job), 'v1', 'a job that names none carries from v1, as this afternoon')
  assert.equal(carryFrom(job3, 'v1'), 'v1', 'a named definition wins')
})

test('from v2: a record rendered under v2 carries without its head, one carried this afternoon keeps the keys of its render, a moved one stays', () => {
  const rendered = old(clip, { global: G2 }, 'unreadable')
  const records = new Map([[clip.id, rendered], [still.id, afternoon(still)], [moved.id, { ...afternoon(moved), keys: { ...afternoon(moved).keys, picture: 'p-old' } }], [cycle.id, old(cycle)]])
  const plan = carryPlan(job3, records, tree3)
  assert.equal(plan.from, V2)
  assert.deepEqual(plan.carried.map((c) => c.e.id).sort(), [clip.id, still.id].sort(), 'nothing is added since v2: no head is asked')
  assert.deepEqual(plan.stale.map((x) => [x.id, x.moved]).sort(), [[cycle.id, ['global']], [moved.id, ['picture']]].sort(), 'a v1 key is not a v2 key')
  const byId = new Map(plan.carried.map((c) => [c.e.id, carriedRecord(c, { job: job3, at: 'night' })]))
  const c = byId.get(clip.id), s2 = byId.get(still.id)
  assert.deepEqual(c.carried.from, rendered.keys)
  assert.equal(c.carried.fromDefinition, V2)
  assert.equal(c.carried.definition, GLOBAL_DEFINITION)
  assert.equal(c.carried.rendered, undefined, 'rendered under v2: its files are the keys it carries from')
  assert.deepEqual(s2.carried.rendered, { keys: old(still).keys, definition: 'v1' }, "carried twice: the keys of the render ride along")
  assert.deepEqual(s2.keys, { motion: 'm2', picture: 'p2', global: G3, delivery: D })
  assert.ok(stillCurrent(s2, still, job3) && stillCurrent(c, clip, job3))
  // the release names the keys the files were rendered with, and the gate holds its sidecar against them
  const dir = mkdtempSync(join(tmpdir(), 'w7-carry3-'))
  try {
    for (const r of [rendered, afternoon(still), c, s2]) appendLedger(dir, r)
    writeRecord(dir, { ...job3, head: 'h', entries: [clip, still], recipe: {} }, readLedger(dir))
    const release = JSON.parse(readFileSync(join(dir, 'release.json'), 'utf8'))
    assert.equal(release.definition, GLOBAL_DEFINITION)
    const [rc] = release.clips, [rs] = release.stills
    assert.deepEqual(rc.carried, { keys: rendered.keys, fromDefinition: V2, definition: GLOBAL_DEFINITION })
    assert.deepEqual(rs.carried, { keys: old(still).keys, fromDefinition: 'v1', definition: GLOBAL_DEFINITION })
    assert.ok(carriedHolds({ keys: rendered.keys }, rc), 'the clip rendered under v2 holds')
    assert.ok(carriedHolds({ keys: old(still).keys }, rs), 'the still rendered under v1 holds')
    assert.ok(!carriedHolds({ keys: afternoon(still).keys }, rs), 'a sidecar never holds the keys of a carry')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test("this afternoon's lines from v1 to v2 read as they did", () => {
  const dir = mkdtempSync(join(tmpdir(), 'w7-carry2-'))
  try {
    const line = afternoon(still)
    appendLedger(dir, line)
    writeRecord(dir, { ...job, keys: { ...job.keys, definition: V2 }, head: 'h', entries: [still], recipe: {} }, readLedger(dir))
    const release = JSON.parse(readFileSync(join(dir, 'release.json'), 'utf8'))
    assert.deepEqual(release.stills[0].carried, { keys: line.carried.from, fromDefinition: 'v1', definition: V2 })
    assert.ok(carriedHolds({ keys: line.carried.from }, release.stills[0]))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('a carry names an older definition the tree was keyed under, or is refused', () => {
  assert.throws(() => carryPlan(job3, new Map(), tree3, { from: GLOBAL_DEFINITION }), /no carry from/)
  assert.throws(() => carryPlan(job3, new Map(), tree3, { from: 'v0' }), /no carry from/)
  assert.throws(() => carryPlan(job3, new Map(), { ...tree3, globals: { v1: G1, [GLOBAL_DEFINITION]: G3 } }), /was not taken/)
  assert.equal(carryPlan(job3, new Map(), tree3, { from: 'v1' }).from, 'v1')
})
