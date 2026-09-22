// THE FILM'S GRAPH, AS DATA: where a visitor stands still (the nodes) and every
// walk between two of those the film holds (the edges, one clip each), for both
// framings, from the life's order and the rail certificate on disk.
//
//   node forge/film/graph.mjs                  the counts table against the design
//   node forge/film/graph.mjs --wall=behind    the wall walked from the stop behind only
//   node forge/film/graph.mjs --out=<file>     the whole graph as JSON
//
// Nothing here moves: every edge is a leg the live rail itself walks, found in
// the certificate or refused, and its seconds are the gait's own at each pace.
// When the certificate changes (a calmer walk, a moved pose) this is re-run and
// the table says what moved.
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { CERTIFICATE_FILE, WING_DIR, createLoader } from './load.mjs'

export const FPS = 30
export const PACES = ['stroll', 'walk', 'brisk']
/** The rendered pace; the others play the same clip at a rate. */
export const FILM_PACE = 'walk'
/** The certificate's two authored families. A master is rendered at these
    aspects and covered onto any glass. */
export const FRAMINGS = {
  wide: { viewport: 'desktop', phone: false, width: 1280, height: 720 },
  upright: { viewport: 'phone', phone: true, width: 390, height: 844 },
}
/** Decision D1: the wall's runs from both story stops that bracket a work, in
    and out ('both'), or in from the stop behind and on to the stop ahead. */
export const WALL_RUNS = ['both', 'behind']
export const KINDS = ['LEG', 'STEP', 'RUN', 'APPROACH', 'RETURN', 'LINK']

/** §2.3 of the design as written on 2026-09-22, the table this reproduces. */
export const DESIGN_TABLE = {
  wide: { LEG: [28, 231.3], STEP: [110, 160.5], RUN: [158, 945.5], APPROACH_RETURN: [42, 123.7], LINK: [20, 44.2], duplicates: [-6, -13.3], total: [352, 1491.9] },
  upright: { LEG: [28, 230.8], STEP: [110, 159.9], RUN: [158, 939.1], APPROACH_RETURN: [42, 123.7], LINK: [20, 44.2], duplicates: [-6, -13.8], total: [352, 1483.9] },
}

const POSE_TOLERANCE = 1e-6
const near = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= POSE_TOLERANCE)
const samePose = (a, b) => near(a.eye, b.eye) && near(a.at, b.at) && Math.abs(a.fov - b.fov) <= POSE_TOLERANCE
const saved = (pose) => ({ eye: pose.eye.toArray(), at: pose.at.toArray(), fov: pose.fov })
const sha256 = (text) => createHash('sha256').update(text).digest('hex')
export const stopId = (walkId) => `stop:${walkId}`
export const viewId = (exhibit) => `view:${exhibit}`
/** A clip's name on disk: the node ids with their separators made safe. */
export const clipStem = (edgeId) => edgeId.replace(/[:/]/g, (c) => (c === ':' ? '-' : '.')).replace('>', '--')

/** The wing's modules, loaded once, and what the graph and the replay read off them. */
export async function openWing({ rev = '', stand = {} } = {}) {
  const loader = await createLoader({ rev, stand })
  const gait = loader.load(`${WING_DIR}/gait.ts`)
  const walls = loader.load(`${WING_DIR}/collection/wall.ts`)
  const approaches = loader.load(`${WING_DIR}/collection/approaches.ts`)
  const rail = loader.load(`${WING_DIR}/rail.ts`)
  const certificateText = loader.text(CERTIFICATE_FILE)
  return {
    loader, gait, walls, approaches, rail, certificate: JSON.parse(certificateText), certificateSha256: sha256(certificateText),
    /* the life's order is read only by the graph: an older revision a route is
       replayed at may predate it */
    get walk() { return loader.load(`${WING_DIR}/walk.ts`) },
  }
}

/** Seconds of one leg at each pace, by the gait's own rule. */
function secondsAtEachPace(gait, metres) {
  const held = gait.gaitPace()
  const out = {}
  for (const pace of PACES) {
    gait.setGaitPace(pace)
    out[pace] = gait.gaitLeg(metres).seconds
  }
  gait.setGaitPace(held)
  return out
}

/** The frame the walk lands on at the film's 30 frames a second: the first
    frame whose leg clock has reached the leg's seconds. */
export const arrivalFrame = (seconds, fps = FPS) => Math.ceil(seconds * fps - 1e-9)

/**
 * Build the graph.
 *   wing   the modules from openWing()
 *   wall   D1, 'both' (the recommended default) or 'behind'
 */
export function buildGraph(wing, { wall: wallRuns = 'both' } = {}) {
  if (!WALL_RUNS.includes(wallRuns)) throw new Error(`D1 is 'both' or 'behind', not ${wallRuns}`)
  const { walk, gait, walls: wallModule, approaches, certificate } = wing
  const life = walk.vinciWalk(true)

  /* ---- the nodes ---- */
  const nodes = []
  const byId = new Map()
  const add = (node) => {
    if (byId.has(node.id)) throw new Error(`two nodes named ${node.id}`)
    nodes.push(node)
    byId.set(node.id, node)
  }
  for (const [order, stop] of life.stops.entries()) {
    const onWall = stop.wall ? wallModule.vinciWallById(stop.wall) : wallModule.vinciWallOfStation(stop.station)
    const vertex = !onWall ? undefined
      : stop.exhibit ? wallModule.vinciWallVertex(onWall, stop.exhibit) : wallModule.vinciWallEndVertex(onWall, stop.station)
    add({
      id: stopId(stop.id), kind: 'stop', order, walkId: stop.id, station: stop.station,
      ...(stop.exhibit ? { exhibit: stop.exhibit } : {}),
      ...(onWall && vertex !== undefined ? { wall: onWall.id, vertex } : {}),
      pose: Object.fromEntries(Object.entries(FRAMINGS).map(([name, f]) => [name, saved(walk.vinciWalkPose(stop, f.phone))])),
    })
  }
  const records = approaches.vinciExhibitRecords()
  for (const record of records) {
    const onWall = wallModule.vinciWallOfExhibit(record.id)
    const vertex = onWall ? wallModule.vinciWallVertex(onWall, record.id) : undefined
    add({
      id: viewId(record.id), kind: 'view', exhibit: record.id, exhibitKind: record.kind, station: record.station,
      ...(onWall ? { wall: onWall.id, vertex } : {}),
      pose: Object.fromEntries(Object.entries(FRAMINGS).map(([name, f]) => {
        const pose = approaches.vinciApproachPose(record.id, f.phone)
        if (!pose) throw new Error(`${record.id}: no viewing pose for the ${name} framing`)
        return [name, saved(pose)]
      })),
    })
  }
  const stops = nodes.filter((n) => n.kind === 'stop')
  const views = nodes.filter((n) => n.kind === 'view')
  /** the station stop a leg off the walls leaves from */
  const stationStop = (station) => {
    const found = stops.find((n) => n.station === station && !n.exhibit)
    if (!found) throw new Error(`no story stop stands at the station ${station}`)
    return found
  }
  /** two nodes at one eye of a wall: the press opens the work where the visitor stands */
  const opens = []
  for (const stop of stops) for (const view of views) {
    if (stop.wall && stop.wall === view.wall && stop.vertex === view.vertex) opens.push([stop.id, view.id])
  }

  /* ---- the edges ---- */
  const edges = new Map()
  const edge = (kind, from, to, motion) => {
    const id = `${from.id}>${to.id}`
    const held = edges.get(id)
    if (held) {
      if (JSON.stringify(held.motion) !== JSON.stringify(motion)) throw new Error(`${id}: two motions for one clip`)
      if (!held.kinds.includes(kind)) held.kinds.push(kind)
      return
    }
    edges.set(id, { id, stem: clipStem(id), from: from.id, to: to.id, kinds: [kind], motion })
  }
  const wallMotion = (a, b) => ({ rail: 'wall', wall: a.wall, from: a.vertex, to: b.vertex })
  const motionBetween = (a, b) => {
    if (a.wall && a.wall === b.wall) return wallMotion(a, b)
    if (a.exhibit || b.exhibit) throw new Error(`${a.id} to ${b.id}: a wall stop is walked from its own wall only`)
    return { rail: 'route', from: a.station, to: b.station }
  }
  // LEG: the life's own walk, both ways, never across a chapter cut
  const cut = (a, b) => life.cuts.some((c) => (c.from === a.walkId && c.to === b.walkId) || (c.from === b.walkId && c.to === a.walkId))
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i]
    if (cut(a, b)) continue
    edge('LEG', a, b, motionBetween(a, b))
    edge('LEG', b, a, motionBetween(b, a))
  }
  // STEP: every span of every wall, both ways; the stop that holds a vertex is
  // its view, and the ends are the wall's own station stops
  for (const declared of wallModule.VINCI_WALLS) {
    const last = wallModule.vinciWallLastVertex(declared)
    const at = (vertex) => (wallModule.vinciWallIsEnd(declared, vertex)
      ? stationStop(declared.ends[vertex === 0 ? 0 : declared.ends.length - 1])
      : views.find((n) => n.wall === declared.id && n.vertex === vertex))
    for (let v = 1; v <= last; v++) {
      const a = at(v - 1), b = at(v)
      if (!a || !b) throw new Error(`${declared.id}: no node at vertex ${!a ? v - 1 : v}`)
      edge('STEP', a, b, wallMotion(a, b))
      edge('STEP', b, a, wallMotion(b, a))
    }
  }
  // RUN: a work on a wall and the story stops that bracket it on that wall
  for (const view of views.filter((n) => n.wall)) {
    const onWall = stops.filter((s) => s.wall === view.wall)
    const behind = onWall.filter((s) => s.vertex < view.vertex).sort((a, b) => b.vertex - a.vertex)[0]
    const ahead = onWall.filter((s) => s.vertex > view.vertex).sort((a, b) => a.vertex - b.vertex)[0]
    const brackets = [behind, ahead].filter(Boolean)
    if (!brackets.length) throw new Error(`${view.id}: no story stop on its wall`)
    // behind and ahead in the life's order, which is not always the wall's
    const [early, late] = brackets.length === 1 ? [brackets[0], brackets[0]] : [...brackets].sort((a, b) => a.order - b.order)
    for (const s of brackets) {
      if (wallRuns === 'both' || s === early) edge('RUN', s, view, wallMotion(s, view))
      if (wallRuns === 'both' || s === late) edge('RUN', view, s, wallMotion(view, s))
    }
  }
  // APPROACH and RETURN: every exhibit off the walls, from its own station
  for (const view of views.filter((n) => !n.wall)) {
    const s = stationStop(view.station)
    edge('APPROACH', s, view, { rail: 'approach', station: view.station, exhibit: view.exhibit })
    edge('RETURN', view, s, { rail: 'return', station: view.station, exhibit: view.exhibit })
  }
  // LINK: two neighbours of one room's row, both ways
  for (const pair of approaches.vinciApproachRunPairs()) {
    const a = byId.get(viewId(pair.from)), b = byId.get(viewId(pair.to))
    edge('LINK', a, b, { rail: 'link', from: pair.from, to: pair.to })
    edge('LINK', b, a, { rail: 'link', from: pair.to, to: pair.from })
  }

  /* ---- each edge in each framing: its certified length, seconds and frames ---- */
  const wallRecord = (framing, id) => certificate.walls.find((w) => w.viewport === framing.viewport && w.id === id)
  function certifiedMetres(e, framingName) {
    const framing = FRAMINGS[framingName]
    const from = byId.get(e.from).pose[framingName], to = byId.get(e.to).pose[framingName]
    const m = e.motion
    if (m.rail === 'route') {
      const r = certificate.routes.find((x) => x.viewport === framing.viewport && samePose(x.fromPose, from) && samePose(x.toPose, to))
      if (!r) throw new Error(`${e.id} ${framingName}: no certified route`)
      return r.roundedLength
    }
    if (m.rail === 'wall') {
      const w = wallRecord(framing, m.wall)
      if (!w) throw new Error(`${e.id}: no certified wall ${m.wall}`)
      // rail-proof's own sub-path length: the chord less what each inside corner takes out
      const low = Math.min(m.from, m.to), high = Math.max(m.from, m.to)
      return (w.chordM[high] - w.chordM[low]) - (w.shortenM[high - 1] - w.shortenM[low])
    }
    if (m.rail === 'approach' || m.rail === 'return') {
      const station = m.rail === 'approach' ? from : to, viewing = m.rail === 'approach' ? to : from
      const a = certificate.approaches.find((x) => x.viewport === framing.viewport && x.exhibit === m.exhibit
        && samePose(x.fromPose, station) && samePose(x.toPose, viewing))
      if (!a) throw new Error(`${e.id} ${framingName}: no certified approach`)
      return a.roundedLength
    }
    if (m.rail === 'link') {
      const l = certificate.links.find((x) => x.viewport === framing.viewport
        && ((x.from === m.from && x.to === m.to && samePose(x.fromPose, from) && samePose(x.toPose, to))
          || (x.from === m.to && x.to === m.from && samePose(x.fromPose, to) && samePose(x.toPose, from))))
      if (!l) throw new Error(`${e.id} ${framingName}: no certified link`)
      return l.roundedLength
    }
    throw new Error(`${e.id}: no motion ${m.rail}`)
  }
  const list = [...edges.values()]
  for (const e of list) {
    e.framings = {}
    for (const name of Object.keys(FRAMINGS)) {
      const metres = certifiedMetres(e, name)
      const seconds = secondsAtEachPace(gait, metres)
      e.framings[name] = { metres, seconds, frames: arrivalFrame(seconds[FILM_PACE]) }
    }
    // the nodes a wall run slides past: the router never walks through its target
    e.passes = e.motion.rail !== 'wall' ? [] : nodes
      .filter((n) => n.wall === e.motion.wall && n.vertex > Math.min(e.motion.from, e.motion.to) && n.vertex < Math.max(e.motion.from, e.motion.to))
      .map((n) => n.id)
  }

  return {
    format: 'vinci-film-graph-v1',
    wing: 'vinci',
    fps: FPS,
    filmPace: FILM_PACE,
    paces: { ...gait.GAIT_PACES },
    wallRuns,
    framings: FRAMINGS,
    certificate: { file: CERTIFICATE_FILE, sha256: wing.certificateSha256, routes: certificate.routes.length, approaches: certificate.approaches.length, walls: certificate.walls.length, links: certificate.links.length },
    story: stops.map((s) => s.id),
    cuts: life.cuts.map((c) => ({ from: stopId(c.from), to: stopId(c.to), title: c.title })),
    opens,
    nodes,
    edges: list,
    sources: wing.loader.sources(),
  }
}

/** The counts table of §2.3, measured: clips and seconds at the film's pace. */
export function countsTable(graph) {
  const table = {}
  for (const name of Object.keys(FRAMINGS)) {
    const row = (filter) => {
      const hit = graph.edges.filter(filter)
      return [hit.length, hit.reduce((sum, e) => sum + e.framings[name].seconds[FILM_PACE], 0)]
    }
    const t = {}
    for (const kind of ['LEG', 'STEP', 'RUN', 'LINK']) t[kind] = row((e) => e.kinds.includes(kind))
    t.APPROACH_RETURN = row((e) => e.kinds.includes('APPROACH') || e.kinds.includes('RETURN'))
    const dup = graph.edges.filter((e) => e.kinds.length > 1)
    const extra = dup.reduce((sum, e) => sum + (e.kinds.length - 1), 0)
    t.duplicates = [-extra, -dup.reduce((sum, e) => sum + (e.kinds.length - 1) * e.framings[name].seconds[FILM_PACE], 0)]
    t.total = row(() => true)
    t.paces = Object.fromEntries(PACES.map((p) => [p, graph.edges.reduce((sum, e) => sum + e.framings[name].seconds[p], 0)]))
    // one pace is rendered; the others play it at the ratio of the two speeds
    t.filmPaces = Object.fromEntries(PACES.map((p) => [p, t.paces[FILM_PACE] * graph.paces[FILM_PACE] / graph.paces[p]]))
    t.frames = graph.edges.reduce((sum, e) => sum + e.framings[name].frames, 0)
    t.longest = graph.edges.reduce((best, e) => (e.framings[name].seconds[FILM_PACE] > best.framings[name].seconds[FILM_PACE] ? e : best))
    table[name] = t
  }
  return table
}

const ROWS = [['LEG', 'LEG'], ['STEP', 'STEP'], ['RUN', 'RUN'], ['APPROACH_RETURN', 'APPROACH / RETURN'], ['LINK', 'LINK'], ['duplicates', 'less duplicates'], ['total', 'total']]

/** The design's cells carry one decimal, some cut rather than rounded, and its
    totals are sums of its own rounded rows: a seconds cell is reproduced within
    a tenth, a total within a tenth for each row it sums. A leg that moves by
    more than that shows in its own row. */
const ROW_TOLERANCE_S = 0.1

/** The table as text, each cell beside the design's, and a line for every cell that moved. */
export function formatTable(graph, table) {
  const f1 = (n) => n.toFixed(1)
  const lines = []
  lines.push(`the film's graph: ${graph.nodes.length} nodes (${graph.story.length} story stops, ${graph.nodes.length - graph.story.length} views), D1 = ${graph.wallRuns}, certificate ${graph.certificate.sha256.slice(0, 12)}`)
  lines.push('')
  lines.push('| kind | clips W | s W | clips U | s U |')
  lines.push('|---|---:|---:|---:|---:|')
  const moved = [], rounding = []
  for (const [key, label] of ROWS) {
    const w = table.wide[key], u = table.upright[key]
    lines.push(`| ${label} | ${w[0]} | ${f1(w[1])} | ${u[0]} | ${f1(u[1])} |`)
    for (const [name, got] of [['wide', w], ['upright', u]]) {
      const want = DESIGN_TABLE[name][key]
      if (graph.wallRuns !== 'both') continue
      if (want[0] !== got[0]) moved.push(`${label} ${name}: ${got[0]} clips, the design says ${want[0]}`)
      const tolerance = key === 'total' ? ROW_TOLERANCE_S * (ROWS.length - 1) : ROW_TOLERANCE_S
      if (Math.abs(want[1] - got[1]) > tolerance + 1e-9) moved.push(`${label} ${name}: ${got[1].toFixed(3)} s, the design says ${want[1]}`)
      else if (f1(got[1]) !== f1(want[1])) rounding.push(`${label} ${name} ${got[1].toFixed(3)} s (the design ${want[1]})`)
    }
  }
  lines.push('')
  for (const name of Object.keys(FRAMINGS)) {
    const t = table[name]
    lines.push(`${name}: ${t.frames} walking frames at ${graph.fps} fps; seconds live at each pace ${PACES.map((p) => `${p} ${f1(t.paces[p])}`).join(', ')}, the film played at a rate ${PACES.map((p) => `${p} ${f1(t.filmPaces[p])}`).join(', ')}; longest ${t.longest.id} ${t.longest.framings[name].seconds[FILM_PACE].toFixed(2)} s`)
  }
  lines.push('')
  if (graph.wallRuns !== 'both') lines.push('D1 is not the design default: the table is not compared.')
  else if (moved.length) lines.push(`WHAT MOVED against §2.3:\n  ${moved.join('\n  ')}`)
  else lines.push(`§2.3 REPRODUCED: every clip count exact, every seconds cell within the design's own tenth.${rounding.length ? `\nAt full precision, where the design's tenth is cut or summed from rounded rows:\n  ${rounding.join('\n  ')}` : ''}`)
  return { text: lines.join('\n'), moved, rounding }
}

async function main() {
  const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const at = a.indexOf('=')
    return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
  }))
  const wing = await openWing({ rev: String(flags.get('rev') ?? '') })
  const graph = buildGraph(wing, { wall: String(flags.get('wall') ?? 'both') })
  const table = countsTable(graph)
  const { text, moved } = formatTable(graph, table)
  console.log(text)
  if (flags.has('out')) {
    writeFileSync(String(flags.get('out')), JSON.stringify(graph, null, 1) + '\n')
    console.log(`\nthe graph written to ${flags.get('out')}`)
  }
  if (flags.has('strict') && moved.length) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
