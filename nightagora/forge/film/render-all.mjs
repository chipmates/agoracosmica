// THE WHOLE FILM AS ONE RESUMABLE JOB (render graph W7): every still, every clip
// and every machine's filmed cycle of the graph, in both framings, in the life's
// order from the entrance, so a film rendered in part is walkable from its start.
//
//   node forge/film/render-all.mjs --job=<dir> --plan         write the job list (job.json); nothing rendered
//   node forge/film/render-all.mjs --job=<dir>                render what the ledger does not hold (start and resume)
//   node forge/film/render-all.mjs --job=<dir> --area=<a,b>   render an area again: a station (`flight`), a node
//                                                             (`stop:works`, `view:picture/bacchus/front`) or a
//                                                             machine (`machine/aerial-screw`, its view, clips and cycle)
//   node forge/film/render-all.mjs --job=<dir> --status       the ledger against the job, the hours left, the joins
//     [--only=pilot|<entry id,...>] [--framings=wide,upright] [--limit=N] [--port=5573] [--origin-port=5572]
//     [--lock=gate|none] [--accept-held] [--walk=job|run]
//
// The job folder is a release the gate reads (`film-check.mjs --release=<dir>`)
// and the pack packs (`pack.mjs --export=<dir>`). Each output is written under
// a temporary name and renamed when whole; a done entry is one line of
// `ledger.jsonl` with the sha256 of every file it wrote, appended only once the
// entry is whole, so a session that ends mid-render loses the entry in progress
// and nothing else. The gate lock is taken per entry and let go between
// entries, so a landing sweep can slip in.
//
// One set of bodies is held per framing for every still and clip (the mount
// rule): each session walks every clip of its framing once in silence before it
// renders, and the names of the set it holds are kept in the job, so a later
// session that would hold another set says so and stops.
import { chromium } from 'playwright'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs'
import { loadavg } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { APP_ROOT, assertServer, browserArgs, FRAME_TIME_FLAGS, headHere, waitForServer } from '../rig.mjs'
import { FPS, FRAMINGS, buildGraph } from './graph.mjs'
import { openReplay, replayEdge } from './replay.mjs'
import { openSink } from './sink.mjs'
import {
  EXPORT_FORMAT, RUNGS, STILL_RUNG, X264, assertBuildFresh, cellNumbers, clipSidecar, exportClip, exportStill,
  inboxOf, openSession, recipeOf, silentWalk, stillSidecar,
} from './export.mjs'

export const JOB_FORMAT = 'vinci-film-job-v1'
export const LEDGER = 'ledger.jsonl'
/** the program's gate lock: slot A, or slot B at this battery share or more (`scratch/locked.sh`'s own rule) */
export const LOCK_DIR = resolve(APP_ROOT, '..', '..', 'internal', 'night-agora', 'program', 'forge')
const LOCK_SLOTS = ['.gate-lock', '.gate-lock-b']
const SLOT_B_BATTERY = 90
const LOCK_POLL_MS = 20000
/** a holder that has run this long without a gap lets go for longer than a waiter's poll */
const YIELD_EVERY_MS = 10 * 60 * 1000
const YIELD_FOR_MS = LOCK_POLL_MS + 2000

/** THE PILOT: two legs of different weight both ways (the leg into the hall to
    flight, and the garden's first), one machine's cycle, and every still */
export const PILOT = {
  clips: ['stop:picture-room-west>stop:flight', 'stop:flight>stop:picture-room-west', 'stop:garden>stop:line-early', 'stop:line-early>stop:garden'],
  cycles: ['aerial-screw'],
  stills: 'all',
}

const sha256 = (data) => createHash('sha256').update(data).digest('hex')
const stamp = () => new Date().toISOString()
const clock = () => new Date().toTimeString().slice(0, 8)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const round = (n, p = 3) => Math.round(n * 10 ** p) / 10 ** p
const stemOf = (node) => node.replace(/[:/]/g, (c) => (c === ':' ? '-' : '.'))

/* ---- the entries ---- */
export const stillId = (node, framing) => `still ${node} ${framing}`
export const clipId = (edge, framing) => `clip ${edge} ${framing}`
export const cycleId = (slug, framing) => `cycle machine/${slug} ${framing}`

/** the moving machines, their periods and their stations: the dossiers and the graph's views */
export function machinesOf(graph, readDossier) {
  const out = []
  for (const n of graph.nodes) {
    if (n.kind !== 'view' || n.exhibitKind !== 'machine') continue
    const slug = n.exhibit.slice('machine/'.length)
    const period = Number(readDossier(slug)?.motion?.period_s ?? 0)
    if (period > 0) out.push({ slug, station: n.station, view: n.id, period })
  }
  return out
}

/**
 * THE JOB'S ORDER, the life's own from the entrance. First the spine: each
 * stop's still and the leg that reaches it, both ways, both framings; then
 * every view's still, room by room, so every press is answered; then room by
 * room in the life's order the walls' runs and steps, the machines' approaches
 * and links, and their cycles. Both framings of one piece stand side by side.
 */
export function orderEntries(graph, machines, { framings = Object.keys(FRAMINGS) } = {}) {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const byPair = new Map(graph.edges.map((e) => [`${e.from}>${e.to}`, e]))
  const cut = (a, b) => graph.cuts.some((c) => (c.from === a && c.to === b) || (c.from === b && c.to === a))
  const entries = []
  const placed = new Set()
  const push = (entry) => { if (placed.has(entry.id)) return; placed.add(entry.id); entries.push(entry) }
  const still = (node, phase) => { for (const f of framings) push({ id: stillId(node, f), kind: 'still', framing: f, node, phase, areas: [nodes.get(node).station, node] }) }
  const clip = (edge, phase) => {
    for (const f of framings) {
      const x = edge.framings[f]
      push({ id: clipId(edge.id, f), kind: 'clip', framing: f, edge: edge.id, from: edge.from, to: edge.to, kinds: edge.kinds, phase,
        frames: x.frames + (x.restLag ?? 0) + 1, seconds: x.seconds.walk,
        areas: [...new Set([nodes.get(edge.from).station, nodes.get(edge.to).station, edge.from, edge.to])] })
    }
  }
  const cycle = (m, phase) => { for (const f of framings) push({ id: cycleId(m.slug, f), kind: 'cycle', framing: f, slug: m.slug, station: m.station, period: m.period, phase, frames: Math.round(m.period * FPS), areas: [m.station, m.view, `machine/${m.slug}`] }) }
  // 1 THE SPINE
  graph.story.forEach((stop, i) => {
    still(stop, 'spine')
    const prev = graph.story[i - 1]
    if (!prev || cut(prev, stop)) return
    for (const [a, b] of [[prev, stop], [stop, prev]]) { const e = byPair.get(`${a}>${b}`); if (e) clip(e, 'spine') }
  })
  // 2 EVERY VIEW'S STILL, room by room in the life's order
  const stations = [...new Set(graph.story.map((s) => nodes.get(s).station))]
  for (const station of stations) for (const n of graph.nodes) if (n.kind === 'view' && n.station === station) still(n.id, 'views')
  for (const n of graph.nodes) still(n.id, 'views')
  // 3 ROOM BY ROOM: every clip that touches the room, walls by their vertices, then the machines' cycles
  const vertexOf = (id) => nodes.get(id).vertex ?? -1
  for (const station of stations) {
    const here = graph.edges.filter((e) => nodes.get(e.from).station === station || nodes.get(e.to).station === station)
      .sort((a, b) => Math.min(vertexOf(a.from), vertexOf(a.to)) - Math.min(vertexOf(b.from), vertexOf(b.to)) || (a.id < b.id ? -1 : 1))
    for (const e of here) clip(e, 'rooms')
    for (const m of machines.filter((x) => x.station === station)) cycle(m, 'rooms')
  }
  for (const e of graph.edges) clip(e, 'rooms')
  for (const m of machines) cycle(m, 'rooms')
  return entries.map((e, order) => ({ ...e, order }))
}

/** the entries an area names: a station, a node, or a machine by `machine/<slug>` */
export function areaEntries(entries, names) {
  // a machine is its view, the clips that reach it, and its cycle
  const want = new Set(names.flatMap((n) => (n.startsWith('machine/') ? [n, `view:${n}`] : [n])))
  return entries.filter((e) => e.areas.some((a) => want.has(a)))
}

/** the pilot's entries, or named ones */
export function onlyEntries(entries, only) {
  if (only === 'pilot') {
    const clips = new Set(PILOT.clips), cycles = new Set(PILOT.cycles)
    return entries.filter((e) => (e.kind === 'still' && PILOT.stills === 'all') || (e.kind === 'clip' && clips.has(e.edge)) || (e.kind === 'cycle' && cycles.has(e.slug)))
  }
  const ids = new Set(String(only).split(',').map((s) => s.trim()).filter(Boolean))
  return entries.filter((e) => ids.has(e.id))
}

/* ---- the ledger ---- */
/** every line of the ledger, the last one of each entry standing */
export function readLedger(dir) {
  const file = join(dir, LEDGER)
  const records = new Map()
  if (!existsSync(file)) return records
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue
    let r
    // a line cut short by a session that ended mid-write is not a record
    try { r = JSON.parse(line) } catch { continue }
    if (r?.id) records.set(r.id, r)
  }
  return records
}
/** one record, appended and flushed to the disk before the next entry begins */
export function appendLedger(dir, record) {
  const fd = openSync(join(dir, LEDGER), 'a')
  try { writeSync(fd, `${JSON.stringify(record)}\n`); fsyncSync(fd) } finally { closeSync(fd) }
}
/** a file written whole or not at all */
export function writeAtomic(file, data) {
  mkdirSync(dirname(file), { recursive: true })
  const part = `${file}.part`
  writeFileSync(part, data)
  renameSync(part, file)
}
/** is a done record's every file on disk at its size (and, asked, its sha256)? */
export function recordWhole(dir, record, { hash = false } = {}) {
  for (const f of record.written ?? []) {
    const at = join(dir, f.file)
    if (!existsSync(at) || statSync(at).size !== f.bytes) return false
    if (hash && sha256(readFileSync(at)) !== f.sha256) return false
  }
  return true
}
const written = (dir, file) => {
  const bytes = readFileSync(file)
  return { file: relative(dir, file).split('\\').join('/'), bytes: bytes.length, sha256: sha256(bytes) }
}

/* ---- the gate lock ---- */
function battery() {
  try { return Number(/(\d+)%/.exec(execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf8' }))?.[1] ?? 0) } catch { return 0 }
}
/**
 * The gate lock by `scratch/locked.sh`'s own protocol: a slot is a folder made
 * by mkdir; slot B only at 90 percent battery or more; the owner and the time
 * written inside. Only a slot this process made is ever removed.
 */
export function gateLock({ dir = LOCK_DIR, owner = 'w7', mode = 'gate', log = () => {}, batteryOf = battery, pollMs = LOCK_POLL_MS } = {}) {
  let held = null, lastGap = Date.now()
  const release = () => {
    if (!held) return
    rmSync(held, { recursive: true, force: true })
    held = null
  }
  const onExit = () => release()
  process.on('exit', onExit)
  return {
    get held() { return held },
    async take() {
      if (mode === 'none' || held) return
      // a holder that ran long without a gap stands back for longer than a waiter's poll
      if (Date.now() - lastGap > YIELD_EVERY_MS) { await sleep(YIELD_FOR_MS); lastGap = Date.now() }
      let waited = 0
      for (;;) {
        for (const name of LOCK_SLOTS) {
          if (name !== LOCK_SLOTS[0] && batteryOf() < SLOT_B_BATTERY) continue
          const slot = join(dir, name)
          try {
            mkdirSync(slot)
          } catch (err) {
            if (err.code === 'EEXIST') continue
            throw err
          }
          writeFileSync(join(slot, 'owner'), `${owner} ${clock()}\n`)
          held = slot
          if (waited) { log(`  lock: ${name} after ${Math.round(waited / 1000)} s`); lastGap = Date.now() }
          return
        }
        await sleep(pollMs)
        waited += pollMs
      }
    },
    release,
    dispose() { release(); process.off('exit', onExit) },
  }
}

/* ---- the job file ---- */
function distDigest() {
  const index = join(APP_ROOT, 'dist', 'index.html')
  return existsSync(index) ? sha256(readFileSync(index)) : null
}
/** the files that turn a scene into frames, beside the build: a commit elsewhere leaves a job running */
const RENDERER = ['forge/film/export.mjs', 'forge/film/cycle.mjs', 'forge/film/sink.mjs', 'forge/film/graph.mjs', 'forge/film/replay.mjs',
  'forge/film/load.mjs', 'forge/rig.mjs', 'forge/prerender/clock.mjs', 'forge/prerender/pending.mjs']
/** WHAT A JOB IS RENDERED FROM: the build (every source of the app is in it) and the renderer's own files */
export function sourceKey() {
  const build = distDigest()
  const renderer = RENDERER.map((f) => `${f} ${sha256(readFileSync(join(APP_ROOT, f)))}`).join('\n')
  return { key: sha256(`${build}\n${renderer}`).slice(0, 32), build }
}
const readDossier = (slug) => {
  const file = join(APP_ROOT, 'src', 'wings', 'vinci', 'machines', 'data', `${slug}.json`)
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
}

async function planJob(dir, log) {
  const replay = await openReplay()
  const graph = buildGraph(replay.wing)
  const machines = machinesOf(graph, readDossier)
  const entries = orderEntries(graph, machines)
  /* THE KEYS the gate holds a release against, taken now: a later tree whose
     keys moved says which entries are stale */
  log('the keys of the tree (the world and every track, a few minutes)')
  const { treeKeys } = await import('./keys.mjs')
  const tree = await treeKeys({ log: (s) => log(`  keys: ${s}`) })
  /* A CYCLE'S KEY is coarse: every file its machine's module and the island
     read (the import closure), and the print; the gate keys no cycle yet */
  const { closure } = await import('./keys.mjs')
  const { createLoader } = await import('./load.mjs')
  const loader = await createLoader({})
  const island = ['src/wings/vinci/film-look.ts', 'src/wings/vinci/print.ts'].flatMap((f) => closure(loader, f, 'src/'))
  for (const e of entries) {
    const k = e.kind === 'clip' ? tree.clips.get(`${e.edge} ${e.framing}`) : e.kind === 'still' ? tree.stills.get(`${e.node} ${e.framing}`) : null
    if (k) e.keys = { motion: k.motion, picture: k.picture }
    if (e.kind === 'cycle') {
      const files = [...new Set([...closure(loader, `src/wings/vinci/machines/${e.slug}.ts`, 'src/'), `src/wings/vinci/machines/data/${e.slug}.json`, ...island])].sort()
      e.keys = { motion: null, picture: sha256(files.map((f) => `${f} ${sha256(loader.text(f))}`).join('\n')).slice(0, 32) }
    }
  }
  const job = {
    format: JOB_FORMAT, created: stamp(), head: headHere(), source: sourceKey().key, build: distDigest(), fps: FPS, pace: 'walk',
    certificate: graph.certificate.sha256, story: graph.story, cuts: graph.cuts,
    keys: { format: tree.format, global: tree.global.key, delivery: tree.delivery.key },
    recipe: recipeOf({ mount: 'held' }), x264: X264, rungs: RUNGS, stillRung: STILL_RUNG,
    machines, counts: countsOf(entries), entries,
  }
  writeAtomic(join(dir, 'job.json'), JSON.stringify(job, null, 1))
  return job
}

export function countsOf(entries) {
  const out = {}
  for (const e of entries) {
    const k = `${e.kind} ${e.framing}`
    out[k] ??= { entries: 0, frames: 0 }
    out[k].entries++
    out[k].frames += e.kind === 'still' ? 1 : e.frames
  }
  return out
}

/* ---- the record the gate and the pack read, rewritten from the ledger ---- */
function writeRecord(dir, job, records) {
  const done = [...records.values()].filter((r) => r.status === 'done')
  const byId = new Map(job.entries.map((e) => [e.id, e]))
  const release = { format: 'vinci-film-release-v1', keysFormat: job.keys.format, wing: 'vinci', revision: job.head, renderer: done.find((r) => r.renderer)?.renderer ?? null, fps: FPS, pace: 'walk', global: job.keys.global, delivery: job.keys.delivery, clips: [], stills: [], sampledJoins: [] }
  const summary = { format: EXPORT_FORMAT, head: job.head, job: JOB_FORMAT, recipe: job.recipe, rungs: RUNGS, x264: X264, stills: [], clips: [] }
  const cycles = {}
  for (const r of done) {
    const e = byId.get(r.id)
    if (!e) continue
    const keys = e.keys ? { motion: e.keys.motion, picture: e.keys.picture, global: job.keys.global, delivery: job.keys.delivery } : null
    if (e.kind === 'still') {
      release.stills.push({ node: e.node, framing: e.framing, keys, files: { [STILL_RUNG[e.framing].join('x')]: r.rung }, sidecar: r.sidecar })
      summary.stills.push({ node: e.node, framing: e.framing, raw: r.raw, master: r.master, rung: r.rung, settledIn: r.settledIn, aSecondLater: r.aSecondLater, pendingAtRest: r.pendingAtRest })
    } else if (e.kind === 'clip') {
      release.clips.push({ clip: e.edge, framing: e.framing, keys, frames: r.frames, seconds: r.frames / FPS, files: r.files, sidecar: r.sidecar })
      summary.clips.push({ clip: e.edge, framing: e.framing, kinds: e.kinds, stem: r.stem, frames: r.frames, files: r.files, joins: r.joins, joinsAgree: r.joinsAgree, mountedSetChanges: r.mountedSetChanges, pendingAtRest: r.pendingAtRest, refused: [] })
    } else if (e.kind === 'cycle') {
      const c = (cycles[`machine/${e.slug}`] ??= { period: r.period, fps: FPS, frames: r.cycleFrames, framings: {} })
      c.framings[e.framing] = r.framing
    }
  }
  writeAtomic(join(dir, 'release.json'), JSON.stringify(release, null, 1))
  writeAtomic(join(dir, 'export.json'), JSON.stringify(summary, null, 1))
  writeAtomic(join(dir, 'cycles.json'), JSON.stringify(cycles, null, 1))
}

/* ---- the status ---- */
export function statusOf(job, records, { now = Date.now() } = {}) {
  const lines = []
  const done = new Map([...records].filter(([, r]) => r.status === 'done'))
  const kinds = {}
  for (const e of job.entries) {
    const k = `${e.kind} ${e.framing}`
    const row = (kinds[k] ??= { entries: 0, done: 0, frames: 0, framesDone: 0, seconds: 0, refused: 0, failed: 0 })
    // a still is counted as one unit, a clip and a cycle by their frames
    const units = e.kind === 'still' ? 1 : e.frames
    row.entries++
    row.frames += units
    const r = records.get(e.id)
    if (r?.status === 'done' && stillCurrent(r, e, job)) { row.done++; row.framesDone += e.kind === 'still' ? 1 : r.frames ?? units; row.seconds += r.seconds ?? 0 }
    else if (r?.status === 'refused') row.refused++
    else if (r?.status === 'failed') row.failed++
  }
  lines.push(`the job at ${job.head.slice(0, 8)}: ${job.entries.length} entries, ${done.size} done`)
  let left = 0, unmeasured = []
  for (const [k, row] of Object.entries(kinds)) {
    const rate = row.framesDone ? row.seconds / row.framesDone : null
    const rest = row.frames - row.framesDone
    if (rate) left += rest * rate
    else if (rest) unmeasured.push(k)
    const unit = k.startsWith('still') ? 'a still' : 'a frame'
    lines.push(`  ${k}: ${row.done}/${row.entries} done, ${row.framesDone}/${row.frames} ${k.startsWith('still') ? 'stills' : 'frames'}${rate ? `, ${rate.toFixed(2)} s ${unit}, ${(rest * rate / 3600).toFixed(1)} h left` : ''}${row.refused ? `, ${row.refused} refused` : ''}${row.failed ? `, ${row.failed} failed` : ''}`)
  }
  lines.push(`  hours left at the measured rates: ${(left / 3600).toFixed(1)}${unmeasured.length ? ` (not yet measured: ${unmeasured.join(', ')})` : ''}`)
  // THE JOINS: every clip's ends against its two stills, by the raw frames' sha256
  const stillRaw = new Map()
  for (const e of job.entries) if (e.kind === 'still' && done.get(e.id)) stillRaw.set(`${e.node} ${e.framing}`, done.get(e.id).raw)
  const joins = []
  for (const e of job.entries) {
    const r = done.get(e.id)
    if (e.kind !== 'clip' || !r) continue
    const a = stillRaw.get(`${e.from} ${e.framing}`), b = stillRaw.get(`${e.to} ${e.framing}`)
    joins.push({ id: e.id, first: a ? r.joins.first === a : null, last: b ? r.joins.last === b : null, frames: r.frames, graph: e.frames, session: r.session, stillSessions: [done.get(stillId(e.from, e.framing))?.session, done.get(stillId(e.to, e.framing))?.session] })
  }
  if (joins.length) {
    lines.push(`  joins by sha256: ${joins.filter((j) => j.first && j.last).length} of ${joins.length} clips identical at both ends`)
    for (const j of joins) lines.push(`    ${j.id}: first ${j.first}, last ${j.last}; ${j.frames} frames (the graph ${j.graph})${j.stillSessions.some((s) => s && s !== j.session) ? '; a still from another session' : ''}`)
  }
  return { text: lines.join('\n'), kinds, joins, hoursLeft: left / 3600 }
}

/* ---- the run ---- */
function flagsOf(argv) {
  const flags = new Map()
  for (const a of argv) {
    if (!a.startsWith('--')) continue
    const at = a.indexOf('=')
    flags.set(at === -1 ? a.slice(2) : a.slice(2, at), at === -1 ? true : a.slice(at + 1))
  }
  return flags
}
const load = () => loadavg().map((v) => round(v, 2))
/** an entry's four keys under the job */
export const keysOf = (e, job) => (e.keys ? { motion: e.keys.motion, picture: e.keys.picture, global: job.keys.global, delivery: job.keys.delivery } : null)
/** A DONE ENTRY STAYS DONE under a later job while its keys have not moved */
export function stillCurrent(record, e, job) {
  if (record.source && record.source === job.source) return true
  const k = keysOf(e, job)
  return Boolean(k && record.keys && ['motion', 'picture', 'global', 'delivery'].every((n) => record.keys[n] === k[n]))
}

/** THE STAGE ORIGIN a cycle is recorded on: the film wing needs a release to stand in, and any stop of the life will do */
function writeStage(dir, job, graph) {
  const nodes = {}
  for (const n of graph.nodes) nodes[n.id] = { kind: n.kind, station: n.station, ...(n.walkId ? { walkId: n.walkId } : {}), ...(n.exhibit ? { exhibit: n.exhibit } : {}), stills: {}, print: {}, marks: {} }
  const film = { format: 'vinci-film-player-v1', wing: 'vinci', fps: FPS, revision: job.head,
    framings: { wide: { master: [1920, 1080], rungs: RUNGS.wide }, upright: { master: [780, 1688], rungs: RUNGS.upright } },
    story: graph.story, cuts: graph.cuts, opens: graph.opens, sets: {}, nodes, edges: [] }
  writeAtomic(join(dir, 'origin', 'stage', 'film.json'), JSON.stringify(film))
}

async function run(flags) {
  const dir = resolve(String(flags.get('job') ?? ''))
  if (!flags.get('job')) throw new Error('name the job folder: --job=<dir>')
  mkdirSync(dir, { recursive: true })
  const logFile = join(dir, 'run.log')
  const log = (s) => { const line = `[${clock()}] ${s}`; console.error(line); writeFileSync(logFile, `${line}\n`, { flag: 'a' }) }
  const jobFile = join(dir, 'job.json')

  if (flags.has('plan') || !existsSync(jobFile)) {
    if (existsSync(jobFile) && !flags.has('replan')) throw new Error(`a job stands at ${jobFile}: --replan writes it again (the ledger stays)`)
    assertBuildFresh()
    const job = await planJob(dir, log)
    log(`the job planned at ${job.head.slice(0, 8)}: ${job.entries.length} entries; ${Object.entries(job.counts).map(([k, c]) => `${k} ${c.entries} (${c.frames} frames)`).join(', ')}`)
    if (flags.has('plan')) return
  }
  const job = JSON.parse(readFileSync(jobFile, 'utf8'))
  const records = readLedger(dir)
  if (flags.has('status')) {
    const s = statusOf(job, records)
    console.log(s.text)
    writeRecord(dir, job, records)
    return
  }

  /* THE SOURCE IS THE JOB'S: another build or another renderer would mix two museums in one release */
  assertBuildFresh()
  const now = sourceKey()
  if (now.key !== job.source) throw new Error(`the build or the renderer is not the one the job was planned on (${now.key.slice(0, 12)} against ${job.source.slice(0, 12)}): build the job's commit (${job.head.slice(0, 8)}), or plan the job again (--plan --replan; the ledger's entries whose keys have not moved stay done)`)

  // WHAT THIS RUN RENDERS
  let chosen = job.entries
  if (flags.has('only')) chosen = onlyEntries(chosen, String(flags.get('only')))
  const again = flags.has('area') ? new Set(areaEntries(chosen, String(flags.get('area')).split(',').map((s) => s.trim())).map((e) => e.id)) : null
  if (again) chosen = chosen.filter((e) => again.has(e.id))
  if (flags.has('framings')) { const f = new Set(String(flags.get('framings')).split(',')); chosen = chosen.filter((e) => f.has(e.framing)) }
  const isDone = (e) => { const r = records.get(e.id); return r?.status === 'done' && recordWhole(dir, r) && stillCurrent(r, e, job) }
  let todo = chosen.filter((e) => again?.has(e.id) || !isDone(e))
  if (flags.has('limit')) todo = todo.slice(0, Number(flags.get('limit')))
  log(`this run: ${todo.length} entries of ${chosen.length} chosen (${chosen.length - todo.length} done in the ledger)${again ? ', the area rendered again' : ''}`)
  if (!todo.length) { writeRecord(dir, job, records); return }

  const PORT = Number(flags.get('port') ?? process.env['FORGE_PORT'] ?? 5573)
  const ORIGIN_PORT = Number(flags.get('origin-port') ?? PORT - 1)
  const BASE = `http://127.0.0.1:${PORT}`
  const lock = gateLock({ mode: String(flags.get('lock') ?? 'gate'), owner: process.env['LOCK_OWNER'] ?? 'w7 film job', log })
  const session = `${stamp()} ${process.pid}`
  const replay = await openReplay()
  const graph = buildGraph(replay.wing)
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const edges = new Map(graph.edges.map((e) => [e.id, e]))
  const frameDir = join(dir, 'frames')
  mkdirSync(frameDir, { recursive: true })

  const children = []
  const stopChildren = () => { for (const c of children) try { c.kill('SIGTERM') } catch { /* gone */ } }
  process.on('exit', stopChildren)
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { log(`${sig}: stopping; the entry in progress is not in the ledger`); lock.dispose(); stopChildren(); process.exit(130) })

  let server = null, origin = null, sink = null, inbox = null
  const sessions = new Map()
  const startServer = async () => {
    if (server) return
    server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', cwd: APP_ROOT })
    children.push(server)
    await waitForServer(`${BASE}/`)
    await assertServer(BASE)
    inbox = inboxOf()
    sink = await openSink((buf) => inbox.take(buf))
    log(`preview ${BASE} (pid ${server.pid}), sink ${sink.url}`)
  }
  const startOrigin = async () => {
    if (origin) return
    writeStage(dir, job, graph)
    origin = spawn('node', ['forge/film/serve.mjs', `--port=${ORIGIN_PORT}`, `--dist=${join(APP_ROOT, 'dist')}`, `--film=${join(dir, 'origin')}`, `--cert=${join(dir, 'cert')}`], { stdio: 'ignore', cwd: APP_ROOT })
    children.push(origin)
    for (let k = 0; k < 120; k++) {
      try { const r = await fetch(`https://127.0.0.1:${ORIGIN_PORT}/film/stage/film.json`); if (r.ok) break } catch { /* not up */ }
      await sleep(500)
    }
    log(`the cycles' origin https://127.0.0.1:${ORIGIN_PORT} (pid ${origin.pid})`)
  }
  /* A FRAMING'S SESSION: the wing stood at every node, every clip of the
     framing walked once in silence, and one set of bodies held for all of it */
  const openFraming = async (framing) => {
    if (sessions.has(framing)) return sessions.get(framing)
    await startServer()
    const t0 = Date.now()
    await lock.take()
    const browser = await chromium.launch({ args: [...browserArgs(), ...FRAME_TIME_FLAGS] })
    // a smoke run stands only at the nodes its own entries touch
    const warm = flags.get('walk') === 'run'
      ? [...new Set(todo.filter((x) => x.framing === framing).flatMap((x) => (x.kind === 'clip' ? [x.from, x.to] : x.kind === 'still' ? [x.node] : [])))].map((id) => nodes.get(id))
      : graph.nodes
    const s = await openSession(browser, framing, { base: BASE, scale: 1, sink, warmNodes: warm, log, view: null })
    lock.release()
    const warmed = Date.now()
    /* THE HELD SET IS THE JOB'S: every clip of the framing walked (`--walk=run`
       walks only this run's clips, for a smoke run in a job of its own) */
    const walkRun = flags.get('walk') === 'run'
    const walks = walkRun ? [...new Set(todo.filter((x) => x.kind === 'clip' && x.framing === framing).map((x) => x.edge))].map((id) => edges.get(id)) : graph.edges
    log(`  ${framing}: the session stood at ${warm.length} nodes in ${Math.round((warmed - t0) / 1000)} s; the silent walks of ${walks.length} clips begin`)
    const steps = []
    let walked = 0
    for (const e of walks) {
      await lock.take()
      const w = await silentWalk(s.page, nodes.get(e.from), nodes.get(e.to), e.motion, e.id)
      steps.push(w.steps)
      walked++
      if (walked % 40 === 0) log(`  ${framing}: ${walked} walked, ${steps.reduce((a, b) => a + b, 0)} steps, ${Math.round((Date.now() - warmed) / 1000)} s`)
      lock.release()
    }
    await lock.take()
    const count = await s.page.evaluate(() => window.__naExport.hold('*'))
    const held = await s.page.evaluate(() => window.__naExport.held())
    lock.release()
    const walkSeconds = (Date.now() - warmed) / 1000
    const heldFile = join(dir, `held-${framing}${walkRun ? '-run' : ''}.json`)
    const heldSha = sha256(held.join('\n'))
    if (!existsSync(heldFile)) writeAtomic(heldFile, JSON.stringify({ framing, count, sha256: heldSha, session, names: held }, null, 1))
    const kept = JSON.parse(readFileSync(heldFile, 'utf8'))
    const same = kept.sha256 === heldSha
    log(`  ${framing}: ${steps.reduce((a, b) => a + b, 0)} silent steps in ${Math.round(walkSeconds)} s; ${count} bodies held; the job's set ${same ? 'the same' : 'DIFFERS'} (${heldSha.slice(0, 12)} against ${kept.sha256.slice(0, 12)})`)
    if (!same) {
      const was = new Set(kept.names), now = new Set(held)
      log(`  held now, not before: ${held.filter((n) => !was.has(n)).slice(0, 8).join(', ')}; before, not now: ${kept.names.filter((n) => !now.has(n)).slice(0, 8).join(', ')}`)
      if (!flags.has('accept-held')) throw new Error(`the ${framing} session would hold another set of bodies than the job's: a release holds one set (--accept-held renders on and the join table judges)`)
    }
    const version = browser.version()
    const entry = { browser, s, version, opened: { warmSeconds: Math.round((warmed - t0) / 1000), walkSeconds: Math.round(walkSeconds), steps: steps.reduce((a, b) => a + b, 0), held: count, heldSha, same } }
    appendLedger(dir, { id: `session ${framing} ${session}`, status: 'session', framing, session, at: stamp(), load: load(), ...entry.opened })
    sessions.set(framing, entry)
    return entry
  }

  const opts = (held) => ({ grain: 0, keep: new Set(), frameDir, force: false, mount: 'held', held })
  let fails = 0
  let n = 0
  for (const e of todo) {
    n++
    const t0 = Date.now()
    const before = load()
    let record
    try {
      if (e.kind === 'cycle') {
        await startOrigin()
        await lock.take()
        record = await renderCycle(e, { dir, originPort: ORIGIN_PORT, log })
        lock.release()
      } else {
        const fs = await openFraming(e.framing)
        await lock.take()
        record = e.kind === 'still'
          ? await renderStill(e, fs, { dir, nodes, inbox, job, opts: opts(fs.opened.held) })
          : await renderClip(e, fs, { dir, nodes, edges, inbox, job, replay, graph, records, opts: opts(fs.opened.held) })
        lock.release()
      }
      fails = 0
    } catch (err) {
      lock.release()
      record = { status: 'failed', error: String(err?.message ?? err).slice(0, 400) }
      fails++
    }
    const seconds = (Date.now() - t0) / 1000
    const full = { id: e.id, kind: e.kind, framing: e.framing, session, at: stamp(), head: headHere(), source: job.source, keys: keysOf(e, job), load: before, loadAfter: load(), seconds: round(seconds, 1), ...record }
    if (full.frames) full.secondsPerFrame = round(seconds / full.frames, 3)
    appendLedger(dir, full)
    records.set(e.id, full)
    log(`${n}/${todo.length} ${e.id}: ${full.status}${full.frames ? `, ${full.frames} frames, ${full.secondsPerFrame} s a frame` : ''}${full.joinsAgree ? `, joins ${full.joinsAgree.first}/${full.joinsAgree.last}` : ''}${full.error ? `: ${full.error}` : ''} (load ${before.join(' ')})`)
    if (fails >= 3) { log('three entries failed in a row: the run stops (a resume starts a fresh session)'); break }
  }
  writeRecord(dir, job, records)
  for (const fs of sessions.values()) { await fs.s.ctx.close().catch(() => {}); await fs.browser.close().catch(() => {}) }
  await sink?.close()
  lock.dispose()
  stopChildren()
  console.log(statusOf(job, records).text)
}

/** A STILL: the node stood at once and settled, its master, its rung, its sidecar */
async function renderStill(e, fs, { dir, nodes, inbox, job, opts }) {
  const node = nodes.get(e.node)
  const s = await exportStill(fs.s, inbox, node, dir, opts)
  const sidecar = `sidecars/${e.framing}/stills/${stemOf(e.node)}.json`
  const keys = e.keys ? { motion: e.keys.motion, picture: e.keys.picture, global: job.keys.global, delivery: job.keys.delivery } : null
  writeAtomic(join(dir, sidecar), JSON.stringify(stillSidecar(s, { renderer: `chromium ${fs.version} webgpu, tier max`, keys }), null, 1))
  const master = written(dir, s.master.file), rung = written(dir, s.rung.file)
  return {
    status: s.pendingAtRest === 0 ? 'done' : 'refused', ...(s.pendingAtRest ? { refused: [`${s.pendingAtRest} textures in flight at rest`] } : {}),
    frames: Math.abs(s.settledIn) + 1, raw: s.raw, master, rung, sidecar, settledIn: s.settledIn, aSecondLater: s.aSecondLater,
    drew: { draws: s.drew.draws, meshes: s.drew.meshes, stood: s.drew.stood }, pendingAtRest: s.pendingAtRest, paintedOverCanvas: s.paintedOverCanvas,
    renderer: `chromium ${fs.version} webgpu, tier max`, written: [master, rung, written(dir, join(dir, sidecar))],
  }
}

/** A CLIP: rest, the leg, rest; its rungs, its seen set, its sidecar, and its ends against the stills */
async function renderClip(e, fs, { dir, nodes, edges, inbox, job, replay, graph, records, opts }) {
  const edge = edges.get(e.edge)
  const track = replayEdge(replay, graph, edge, e.framing, { tail: 2 })
  const r = await exportClip(fs.s, inbox, edge, nodes, track, dir, opts)
  if (!r.files) return { status: 'refused', refused: r.refused }
  const keys = e.keys ? { motion: e.keys.motion, picture: e.keys.picture, global: job.keys.global, delivery: job.keys.delivery } : { motion: r.replay.key, picture: null, global: null, delivery: null }
  // the ID pass's own cells ride beside the gate's frustum key, as the export's release carries them
  let seenCells = null
  try { seenCells = cellNumbers(gunzipSync(readFileSync(r.seen.file))).length } catch { /* kept without */ }
  const sidecarRel = `sidecars/${e.framing}/${r.stem}.json`
  writeAtomic(join(dir, sidecarRel), JSON.stringify(clipSidecar(r, { version: fs.version, recipe: job.recipe, keys, keysNote: null, head: job.head }), null, 1))
  const files = Object.fromEntries(Object.entries(r.files).map(([rung, f]) => [rung, { file: relative(dir, f.file).split('\\').join('/'), bytes: f.bytes, sha256: f.sha256 }]))
  const stillOf = (node) => records.get(stillId(node, e.framing))
  const a = stillOf(e.from), b = stillOf(e.to)
  const joinsAgree = { first: a?.status === 'done' ? r.joins.first === a.raw : null, last: b?.status === 'done' ? r.joins.last === b.raw : null }
  // the ends' frames are kept only where a join parts, for the table to read
  const ends = [join(opts.frameDir, `${r.stem}-${e.framing}-f0000.png`), join(opts.frameDir, `${r.stem}-${e.framing}-last.png`)]
  if (joinsAgree.first !== false && joinsAgree.last !== false) for (const f of ends) rmSync(f, { force: true })
  const seen = written(dir, r.seen.file)
  return {
    status: r.refused?.length ? 'refused' : 'done', ...(r.refused?.length ? { refused: r.refused } : {}),
    stem: r.stem, frames: r.frames, graphFrames: e.frames, files, joins: r.joins, joinsAgree, track: r.track,
    settledIn: r.settledIn, settledLastIn: r.settledLastIn, draws: r.draws, over: r.over, exportSeconds: round(r.seconds, 1),
    requestsAfterClock: r.requestsAfterClock, starvedSteps: r.starvedSteps, pageErrors: r.pageErrors, pendingAtRest: r.pendingAtRest,
    mountedSetChanges: r.mountedSetChanges, floorCeilingMax: r.floorCeilingMax, seenCells, sidecar: sidecarRel,
    renderer: `chromium ${fs.version} webgpu, tier max`,
    kbits: Object.fromEntries(Object.entries(files).map(([rung, f]) => [rung, Math.round((f.bytes * 8) / 1000 / (r.frames / FPS))])),
    written: [...Object.values(files), seen, written(dir, join(dir, sidecarRel))],
  }
}

/** A MACHINE'S CYCLE, one framing: the recorder W6 built, on the stage origin, into the job's own cycles folder */
async function renderCycle(e, { dir, originPort, log }) {
  const args = ['forge/film/cycle.mjs', `--base=https://127.0.0.1:${originPort}`, '--release=stage', `--out=${dir}`, `--slug=${e.slug}`, `--station=${e.station}`, `--framings=${e.framing}`]
  const out = await new Promise((ok, fail) => {
    const child = spawn('node', args, { cwd: APP_ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    let text = ''
    child.stdout.on('data', (d) => { text += d })
    child.stderr.on('data', (d) => { text += d })
    child.on('close', (code) => (code === 0 ? ok(text) : fail(new Error(`cycle.mjs ${code}: ${text.slice(-400)}`))))
  })
  const report = JSON.parse(readFileSync(join(dir, 'cycles', e.slug, 'report.json'), 'utf8'))
  const framing = report.framings?.[e.framing]
  if (!framing) throw new Error(`cycle.mjs wrote no ${e.framing} framing`)
  const run = report.runs?.[e.framing] ?? {}
  if (run.errors?.length) log(`  ${e.id}: page errors ${run.errors.slice(0, 2).join(' | ')}`)
  const files = [...Object.values(framing.files), framing.poster, ...framing.steps.map((s) => s.outline).filter(Boolean)]
  return {
    status: run.missed?.length ? 'refused' : 'done', ...(run.missed?.length ? { refused: [`steps off a key frame: ${run.missed.join(', ')}`] } : {}),
    frames: Math.round(e.period * FPS), cycleFrames: Math.round(e.period * FPS), period: e.period, framing, pageErrors: run.errors?.length ?? 0,
    recorderSeconds: run.seconds, log: out.split('\n').filter((l) => /done in|key frames|step \d/.test(l)).slice(0, 8),
    written: files.map((f) => ({ file: f.file, bytes: f.bytes, sha256: f.sha256 })),
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await run(flagsOf(process.argv.slice(2)))
  } catch (err) {
    console.error(`render-all: ${err.message}`)
    process.exitCode = 1
  }
}
