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
import { carriedRecord, carryPlan } from './carry.mjs'
import { GLOBAL_DEFINITION } from './keys.mjs'
import { appendLedger, readLedger, stillCurrent, writeRecord } from './render-all.mjs'

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
