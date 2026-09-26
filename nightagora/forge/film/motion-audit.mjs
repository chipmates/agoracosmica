// THE MOTION AUDIT: every clip of the film's graph, both framings, measured
// from its camera track alone (the replay's, so the numbers are the film's),
// against the drawn geometry mounted in node. Nothing is rendered.
//
//   node forge/film/motion-audit.mjs --out=<dir> [--only=<edge id>,...] [--framings=wide,upright] [--every=2]
//
// Writes <dir>/legs.tsv (one row a clip and framing) and <dir>/legs.json (the
// same, with each clip's per-frame readings).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FPS, FRAMINGS, buildGraph } from './graph.mjs'
import { MOTION_CAPS, motionVerdict } from './motion.mjs'
import { UNDER, VIEW_UNDER, measureClip } from './motion-gate.mjs'
import { NEAR_LIMIT_M, gridOf, mountVisible, reachOf } from './near.mjs'
import { openReplay, replayEdge } from './replay.mjs'

export { UNDER, VIEW_UNDER }
/** THE AUDIT'S THIRD FLAG, not a gate line: a walk between two stations (a
    LEG) whose eye walks backward for this share of the leg or more (the LEGs'
    shares part here: none between 0.62 and 0.79), or for this long at once. */
export const REVERSE_SHARE = 0.75, REVERSE_SECONDS = 10
/** the unflagged clips a sheet is drawn for, beside every flagged one */
export const SAMPLE = 15
const round = (n, p = 3) => (n === null || n === undefined || !Number.isFinite(n) ? n : Math.round(n * 10 ** p) / 10 ** p)

const COLUMNS = [
  'clip', 'framing', 'kinds', 'motion', 'gaze', 'seconds', 'metres',
  'near_min_m', 'near_min_at_s', 'near_what', 'rest_first_m', 'rest_last_m', ...UNDER.flatMap((d) => [`s_under_${d}m`, `longest_under_${d}m_s`]),
  'view_min_m', 'view_min_at_s', 'view_min_what', ...VIEW_UNDER.map((d) => `view_share_max_${d}m`), 'view_near_longest_s', 'stare_share',
  'yaw_reversals', 'yaw_rate_max_dps', 'yaw_total_deg', 'yaw_net_deg', 'yaw_excess_deg',
  'pitch_reversals', 'pitch_rate_max_dps', 'pitch_total_deg', 'pitch_net_deg', 'pitch_excess_deg',
  'walk_reversals_in_view', 'walk_in_view_total_deg', 'walk_in_view_net_deg', 'course_reversals', 'course_excess_deg',
  'backward_s', 'backward_longest_s', 'sideways_s', 'facing_worst_deg', 'top_speed_mps', 'accel_max_mps2', 'surges',
  'gate_near', 'gate_heading', 'flag_reverse',
]
/** a LEG walked backward for most of its time */
export const reverseOf = (r) => r.kinds.includes('LEG') && (r.heading.facing.backwardLongestSeconds >= REVERSE_SHARE * r.heading.seconds || r.heading.facing.backwardLongestSeconds >= REVERSE_SECONDS)
/** a seeded draw, so the sample is the same on every run of the same table */
function sampleOf(list, n, seed = 20260926) {
  let a = seed >>> 0
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const pool = [...list], out = []
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(next() * pool.length), 1)[0])
  return out
}

export function rowOf(r) {
  const h = r.heading, n = r.near, v = r.view
  const cells = [r.clip, r.framing, r.kinds.join('+'), r.motion, r.gaze ?? '', round(h.seconds, 2), round(h.metres, 2),
    round(n.minM, 3), round(n.minAt, 2), n.minWhat ?? '', round(n.restFirstM, 3), round(n.restLastM, 3), ...UNDER.flatMap((d) => [round(n.under[d].seconds, 2), round(n.under[d].longestSeconds, 2)]),
    round(v.minM, 3), round(v.minAt, 2), v.minWhat ?? '', ...VIEW_UNDER.map((d) => round(v.nearShareMax[d], 3)), round(v.near.longestSeconds, 2), round(v.stareShare, 3),
    h.yaw.reversals, round(h.yaw.rateDegPerSecond, 2), round(h.yaw.totalDeg, 1), round(h.yaw.netDeg, 1), round(h.yaw.excessDeg, 1),
    h.pitch.reversals, round(h.pitch.rateDegPerSecond, 2), round(h.pitch.totalDeg, 1), round(h.pitch.netDeg, 1), round(h.pitch.excessDeg, 1),
    h.way.inView.reversals, round(h.way.inView.totalDeg, 1), round(h.way.inView.netDeg, 1), h.way.course.reversals, round(h.way.course.excessDeg, 1),
    round(h.facing.backwardSeconds, 2), round(h.facing.backwardLongestSeconds, 2), round(h.facing.sidewaysSeconds, 2), round(h.facing.worstDeg, 1),
    round(h.pace.topMetresPerSecond, 2), round(h.pace.accelMetresPerSecond2, 2), h.pace.surges,
    r.verdict.near ? 'RED' : 'green', r.verdict.heading ? 'RED' : 'green', reverseOf(r) ? 'FLAG' : '']
  return cells.map((c) => String(c ?? '')).join('\t')
}

/** THE TRACKS OF THE GRAPH, and the drawn world mounted where they can reach */
export async function openAudit({ only = null, framings = Object.keys(FRAMINGS), log = () => {}, cache = null, rev = '', overlay = {} } = {}) {
  const t0 = Date.now()
  const replay = await openReplay({ rev, overlay })
  const graph = buildGraph(replay.wing)
  const edges = only ? graph.edges.filter((e) => only.includes(e.id)) : graph.edges
  const tracks = []
  // the rail's own word on each leg: how its gaze was planned (the share of the way it follows, or a pan)
  let leg = null
  const probe = { ...replay, createRail: (camera, clock, authority) => {
    const rail = replay.createRail(camera, clock, authority)
    const update = rail.update
    rail.update = () => { update(); const n = rail.navigation; if (n.active && !leg) leg = { gaze: n.legGaze, seconds: n.legSeconds, metres: n.legMetres } }
    return rail
  } }
  for (const edge of edges) for (const framing of framings) {
    leg = null
    const track = replayEdge(probe, graph, edge, framing)
    // the clip is the track from the departure still to the arrival: the tail after it is the next still
    tracks.push({ edge, framing, track, samples: track.samples.slice(0, track.arrivedAt + 1), gaze: leg?.gaze ?? null })
  }
  log(`${tracks.length} tracks replayed in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  const t1 = Date.now()
  // a cache is this script's own iteration aid: the mount of whatever tree wrote it, which nothing checks
  let world
  if (cache && existsSync(cache)) {
    const held = JSON.parse(readFileSync(cache, 'utf8'))
    world = { values: Float64Array.from(held.values), label: Uint32Array.from(held.label), clear: Uint8Array.from(held.clear), labels: held.labels, count: held.label.length, parts: held.parts }
  } else {
    const reach = reachOf(tracks.flatMap((t) => t.samples), NEAR_LIMIT_M + 1)
    world = await mountVisible({ rev, overlay, keep: reach.keep })
    if (cache) writeFileSync(cache, JSON.stringify({ values: Array.from(world.values), label: Array.from(world.label), clear: Array.from(world.clear), labels: world.labels, parts: world.parts }))
  }
  log(`the drawn world: ${world.count} triangles near the tracks in ${((Date.now() - t1) / 1000).toFixed(1)} s`)
  const grid = gridOf(world)
  return { replay, graph, tracks, world, grid }
}

/** every clip's readings and verdict */
export function auditAll({ tracks, grid }, { every = 2, caps = MOTION_CAPS, log = () => {} } = {}) {
  const t0 = Date.now()
  const records = []
  for (const [k, { edge, framing, samples, gaze }] of tracks.entries()) {
    const r = measureClip(grid, samples, framing, { every, caps })
    const verdict = motionVerdict({ heading: r.heading, view: r.view }, caps)
    records.push({ clip: edge.id, framing, kinds: edge.kinds, motion: edge.motion.rail, gaze, frames: samples.length, ...r, verdict })
    if ((k + 1) % 100 === 0) log(`${k + 1}/${tracks.length} measured, ${((Date.now() - t0) / 1000).toFixed(0)} s`)
  }
  return records
}

async function main() {
  const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const k = a.indexOf('='); return k < 0 ? [a.slice(2), true] : [a.slice(2, k), a.slice(k + 1)] }))
  const out = resolve(String(flags.get('out') ?? 'forge/shots/motion-audit'))
  mkdirSync(out, { recursive: true })
  const log = (s) => console.error(`[${new Date().toTimeString().slice(0, 8)}] ${s}`)
  const only = flags.has('only') ? String(flags.get('only')).split(',').map((s) => s.trim()) : null
  const framings = String(flags.get('framings') ?? 'wide,upright').split(',')
  const audit = await openAudit({ only, framings, log, cache: flags.has('cache') ? resolve(String(flags.get('cache'))) : null })
  const t0 = Date.now()
  const records = auditAll(audit, { every: Number(flags.get('every') ?? 2), log })
  writeFileSync(join(out, 'legs.tsv'), `${COLUMNS.join('\t')}\n${records.map(rowOf).join('\n')}\n`)
  const slim = records.map(({ mid, labels, ...r }) => r)
  writeFileSync(join(out, 'legs.json'), JSON.stringify({ format: 'vinci-motion-audit-v1', fps: FPS, caps: MOTION_CAPS, under: UNDER, viewUnder: VIEW_UNDER, parts: audit.world.parts, records: slim }))
  const red = records.filter((r) => r.verdict.near || r.verdict.heading)
  // THE SHEETS TO DRAW: every flagged clip, and a seeded sample of the rest
  const flagged = records.filter((r) => r.verdict.near || r.verdict.heading || reverseOf(r))
  const pick = (r) => ({ clip: r.clip, framing: r.framing, flags: [r.verdict.near && 'near', r.verdict.heading && 'heading', reverseOf(r) && 'reverse'].filter(Boolean) })
  writeFileSync(join(out, 'sheets-list.json'), JSON.stringify([...flagged.map(pick), ...sampleOf(records.filter((r) => !flagged.includes(r)), SAMPLE).map((r) => ({ ...pick(r), sample: true }))], null, 1))
  log(`${records.length} clips measured in ${((Date.now() - t0) / 1000).toFixed(0)} s; near red ${records.filter((r) => r.verdict.near).length}, heading red ${records.filter((r) => r.verdict.heading).length}, either ${red.length}; reverse ${records.filter(reverseOf).length}; flagged ${flagged.length}; written to ${out}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
