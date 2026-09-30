// THE CARRY: a done entry of the ledger, keyed under an older definition of the
// global key (the one the job's last plan replaced, `keys.before`; `v1` for a
// job that names none), is carried to the job's keys under the definition now,
// but only when nothing the old key could see has changed: its four keys equal
// the tree's own four keys under the old definition. The definition moved the
// global key alone, so the motion, the picture and the delivery a record is
// carried with are the ones it was rendered with. What the definition now reads
// and the old one did not (`addedParts`: from v1, the day dome's evening terms;
// from v2, nothing) must also be as it was in the tree the record was rendered
// from (its head).
//
//   node forge/film/carry.mjs --job=<dir>                 carry, then write the record the gate reads
//   node forge/film/carry.mjs --job=<dir> --dry           count only
//   node forge/film/carry.mjs --job=<dir> --from=<def>    name the old definition
//
// The job must be planned on this tree under the definition now (`render-all
// --plan --replan`). A carry is one more line of the ledger: the record as it
// was, its keys under the definition now, and `carried` naming the old keys,
// the definitions and, for a record carried before, the keys its files were
// rendered with. Nothing already written is changed.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { GLOBAL_DEFINITION, GLOBAL_DEFINITIONS, addedParts, cycleKey, treeKeys } from './keys.mjs'
import { createLoader } from './load.mjs'
import { appendLedger, keysOf, readLedger, writeRecord } from './render-all.mjs'

export const CARRY_FROM = 'v1'
/** The definition a job's records were keyed under before its last plan: named, the job's own, else v1. */
export const carryFrom = (job, named) => (typeof named === 'string' && named ? named : job?.keys?.before?.definition ?? CARRY_FROM)
const KEYS = ['motion', 'picture', 'global', 'delivery']
const same = (a, b) => Boolean(a && b) && KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null))

/** The tree's own keys for a job entry, or null for an entry the tree has not. */
export function treeEntryKeys(e, tree) {
  const k = e.kind === 'clip' ? tree.clips.get(`${e.edge} ${e.framing}`)
    : e.kind === 'still' ? tree.stills.get(`${e.node} ${e.framing}`)
      : e.kind === 'evening' ? tree.evenings?.get(`${e.evening} ${e.framing}`)
        : e.kind === 'cycle' ? { motion: null, picture: tree.cycles.get(e.slug) } : null
  if (!k || k.picture === undefined) return null
  return { motion: k.motion, picture: k.picture, delivery: k.delivery ?? tree.delivery }
}

/**
 * WHICH DONE RECORDS CARRY. Pure: the tree's keys are handed in.
 *   job       the job planned now (`keys.definition` the definition now)
 *   records   readLedger() of the job's folder
 *   tree      { clips, stills, evenings, cycles: Map slug -> key, delivery, global,
 *               globals: definition -> the tree's global under it (globalBefore: under v1),
 *               added: addedParts() from the old definition, addedAt: Map head -> the same at that revision (null when unreadable) }
 *   from      the old definition (`carryFrom`)
 * Throws when the job is not this tree's own plan.
 */
export function carryPlan(job, records, tree, { from = carryFrom(job) } = {}) {
  if ((job.keys?.definition ?? CARRY_FROM) !== GLOBAL_DEFINITION) throw new Error(`the job's keys are taken under ${job.keys?.definition ?? CARRY_FROM}: plan it again (--plan --replan) before a carry`)
  if (job.keys.global !== tree.global) throw new Error(`the job's global key ${job.keys.global} is not the tree's ${tree.global}: plan it again on this tree`)
  if (!(GLOBAL_DEFINITIONS.indexOf(from) >= 0 && GLOBAL_DEFINITIONS.indexOf(from) < GLOBAL_DEFINITIONS.indexOf(GLOBAL_DEFINITION))) throw new Error(`no carry from ${from} to ${GLOBAL_DEFINITION}`)
  const globalThen = tree.globals?.[from] ?? (from === CARRY_FROM ? tree.globalBefore : undefined)
  if (!globalThen) throw new Error(`the tree's global key under ${from} was not taken`)
  // nothing added, nothing to hold against a record's head
  const added = !(tree.added && typeof tree.added === 'object' && !Object.keys(tree.added).length)
  const out = { carried: [], current: [], stale: [], planned: 0, from }
  for (const e of job.entries) {
    const now = keysOf(e, job)
    const own = treeEntryKeys(e, tree)
    if (!now || !own) continue
    if (!same(now, { ...own, global: tree.global })) throw new Error(`${e.id}: the job's keys are not the tree's; plan it again on this tree`)
    out.planned++
    const r = records.get(e.id)
    if (r?.status !== 'done') continue
    if (same(r.keys, now)) { out.current.push(e.id); continue }
    const before = { ...own, global: globalThen }
    const moved = KEYS.filter((k) => (r.keys?.[k] ?? null) !== (before[k] ?? null))
    // what only the definition now reads, as the record's own tree had it
    const then = r.head ? tree.addedAt?.get(r.head) : undefined
    if (added && (then === undefined || then === null || JSON.stringify(then) !== JSON.stringify(tree.added))) moved.push('added parts')
    if (!moved.length) out.carried.push({ e, r, before, now, from })
    else out.stale.push({ id: e.id, moved })
  }
  return out
}

/** The ledger line a carry appends: the record as it was, its keys now, what it
    was carried from and, carried before, the keys its files were rendered with. */
export function carriedRecord({ r, before, now, from = CARRY_FROM }, { job, at = new Date().toISOString() } = {}) {
  const rendered = r.carried ? (r.carried.rendered ?? { keys: r.carried.from, definition: r.carried.fromDefinition }) : null
  return { ...r, keys: now, carried: { from: r.keys, fromDefinition: from, definition: GLOBAL_DEFINITION, globalBefore: before.global, job: job.created, at, by: 'forge/film/carry.mjs', ...(rendered ? { rendered } : {}) } }
}

async function main() {
  const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)] }))
  if (!flags.get('job')) throw new Error('name the job folder: --job=<dir>')
  const dir = resolve(String(flags.get('job')))
  const job = JSON.parse(readFileSync(join(dir, 'job.json'), 'utf8'))
  const records = readLedger(dir)
  const t0 = Date.now()
  const from = carryFrom(job, flags.get('from'))
  const tree = await treeKeys({ log: (s) => console.error(`  keys: ${s}`) })
  const loader = await createLoader({})
  const cycles = new Map([...new Set(job.entries.filter((e) => e.kind === 'cycle').map((e) => e.slug))].map((s) => [s, cycleKey(loader, s).key]))
  const added = addedParts(loader, from)
  const addedAt = new Map()
  if (Object.keys(added).length) for (const head of new Set([...records.values()].filter((r) => r.status === 'done' && r.head).map((r) => r.head))) {
    try { addedAt.set(head, addedParts(await createLoader({ rev: head }), from)) } catch { addedAt.set(head, null) }
  }
  const plan = carryPlan(job, records, { clips: tree.clips, stills: tree.stills, evenings: tree.evenings, cycles, delivery: tree.delivery.key,
    global: tree.global.key, globalBefore: tree.globalBefore.key, globals: Object.fromEntries(Object.entries(tree.globals).map(([d, g]) => [d, g.key])), added, addedAt }, { from })
  const by = (list) => { const n = {}; for (const x of list) { const e = x.e ?? job.entries.find((y) => y.id === (x.id ?? x)); const k = `${e.kind} ${e.framing}`; n[k] = (n[k] ?? 0) + 1 } return Object.entries(n).map(([k, v]) => `${k} ${v}`).join(', ') || 'none' }
  console.log(`the tree keyed in ${((Date.now() - t0) / 1000).toFixed(0)} s; global now ${tree.global.key} (${GLOBAL_DEFINITION}), before ${tree.globals[from].key} (${from}); ${Object.keys(added).length} parts added since ${from}`)
  console.log(`${plan.planned} entries planned; done and current under the keys now: ${plan.current.length}`)
  console.log(`carried ${plan.carried.length}: ${by(plan.carried)}`)
  console.log(`not carried, a key the old definition sees has moved: ${plan.stale.length}${plan.stale.length ? ` (${by(plan.stale)})` : ''}`)
  if (flags.has('dry')) return
  const at = new Date().toISOString()
  for (const c of plan.carried) appendLedger(dir, carriedRecord(c, { job, at }))
  writeRecord(dir, job, readLedger(dir))
  console.log(`${plan.carried.length} carries appended to ${join(dir, 'ledger.jsonl')}; the release rewritten`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { await main() } catch (err) { console.error(`carry: ${err.message}`); process.exitCode = 1 }
}
