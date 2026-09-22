// THE CAMERA TRACK OF A CLIP, REPLAYED IN NODE. The rail's own modules walk the
// leg on a clock this program owns, one update per frame, exactly as the
// capture drives the live wing (`forge/prerender/capture.mjs`), and every frame
// prints the camera as the capture prints it: eye, rotation and lens, to four
// decimals. The hash of that track is the clip's MOTION key: a change that
// moves the camera in any frame of a clip turns its key, and nothing else does.
//
//   node forge/film/replay.mjs --clip='stop:garden>stop:line-early' --framing=wide
//   node forge/film/replay.mjs --route=picture-room:picture-room-west --size=1920x1080
//   node forge/film/replay.mjs --compare=<capture>/frames.json [--rev=<commit>]
//   node forge/film/replay.mjs --all [--out=<keys.json>]
//
// The geometry is not what this proves. The certificate proves it
// (`rail-certify.mjs --verify`); here the rail is told the mounted geometry
// is the certified one, so it walks the certified paths and nothing else.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import * as THREE from 'three/webgpu'
import { FILM_PACE, FPS, FRAMINGS, buildGraph, openWing } from './graph.mjs'
import { WING_DIR } from './load.mjs'

export const TRACK_FORMAT = 'vinci-film-track-v1'
const round = (n, p = 4) => Math.round(n * 10 ** p) / 10 ** p
/** the capture's own print of a camera: eye, rotation and lens */
export function camPrint(camera) {
  return [...camera.position.toArray().map((v) => round(v)), ...camera.rotation.toArray().slice(0, 3).map((v) => round(v)), round(camera.fov)].join(',')
}
/** THE SAME ANGLE, ONE PRINT. A camera looking along the world's own axis sits
    on the seam of its Euler angles, where a last bit decides between -π and π:
    the key reads both as π, so one rest pose has one print however it was reached. */
export function canonicalPrint(print) {
  return print.split(',').map((v, i) => (i >= 3 && i <= 5 && v === '-3.1416' ? '3.1416' : v)).join(',')
}
/** what a track's key covers: the frames from the departure still to the arrival */
export function trackKey({ aspect, fps, pace, prints }) {
  const header = `${TRACK_FORMAT} fps=${fps} pace=${pace} aspect=${aspect}`
  return createHash('sha256').update([header, ...prints.map(canonicalPrint)].join('\n')).digest('hex')
}

/** The rail with its authority, standing on the certificate. */
export async function openReplay({ rev = '', overlay = {} } = {}) {
  let certified = ''
  // The mounted geometry is the certificate's by stipulation: the replay walks
  // the certified paths, the certifier proves they clear the geometry.
  const fingerprint = {
    railGeometryFingerprint: async () => certified,
    railGeometryFingerprintBreakdown: async () => ({ meshes: [], sha256: certified }),
    railGeometrySignature: () => [],
    sameRailGeometrySignature: () => false,
  }
  const wing = await openWing({ rev, overlay, stand: { [`${WING_DIR}/rail-fingerprint.ts`]: fingerprint } })
  certified = wing.certificate.geometrySha256[0]
  const proof = wing.loader.load(`${WING_DIR}/rail-proof.ts`)
  const authority = proof.createRailGeometryAuthority([])
  await authority.ready
  if (authority.status !== 'verified') throw new Error(`the rail refused its certificate: ${authority.failure}`)
  const { createRail, stationPose } = wing.rail
  const { vinciWallById, vinciWallOfStation } = wing.walls
  return { wing, authority, createRail, stationPose, vinciWallById, vinciWallOfStation }
}

const vec = (a) => new THREE.Vector3(a[0], a[1], a[2])
const livePose = (saved) => ({ eye: vec(saved.eye), at: vec(saved.at), fov: saved.fov })

/**
 * Walk one clip and print it.
 *   place(rail)    stands the eye at the departure pose, as the wing places it
 *   request(rail)  asks for the arrival, as the wing's press asks for it
 * Returns the prints of frame 0 (the departure still) to the arrival, the tail
 * after it, and the key.
 */
export function walkClip(replay, { aspect, phone, place, request, fps = FPS, tail = 0, cap = 3000 }) {
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.25, 4000)
  let frame = 0
  const clock = () => frame / fps
  const rail = replay.createRail(camera, clock, replay.authority)
  place(rail)
  rail.update()
  const still = camPrint(camera)
  /* the station the wing counts the eye as standing at: it names the exposure */
  const departed = rail.navigation.completed
  const prints = [still]
  /* the same frames unrounded (eye, quaternion, lens), for rates the four-decimal print cannot carry */
  const sample = () => [...camera.position.toArray(), ...camera.quaternion.toArray(), camera.fov]
  const samples = [sample()]
  if (request(rail) === false) throw new Error('the rail refused the request')
  /* the capture drops a leading frame that still repeats the still, so both
     runners open on the same instant of the leg */
  let began = false, idle = 0, arrivedAt = -1
  const tailPrints = []
  while (frame < cap) {
    frame++
    rail.update()
    const print = camPrint(camera)
    const walking = rail.navigation.active !== undefined
    if (!began) {
      if (print === still) {
        if (++idle > 40) throw new Error('the leg never got under way')
        continue
      }
      began = true
    }
    if (arrivedAt < 0) { prints.push(print); samples.push(sample()) }
    else tailPrints.push(print)
    if (!walking && arrivedAt < 0) arrivedAt = prints.length - 1
    if (arrivedAt >= 0 && tailPrints.length >= tail) break
  }
  if (arrivedAt < 0) throw new Error('the leg never arrived')
  return { prints, samples, departed, completed: rail.navigation.completed, tail: tailPrints, arrivedAt, key: trackKey({ aspect: round(aspect, 6), fps, pace: FILM_PACE, prints }) }
}

/** How the wing stands the eye at a node, and how it asks for one. */
function nodeMoves(replay, framingName, phone) {
  const pose = (node) => livePose(node.pose[framingName])
  const place = (node) => (rail) => {
    if (node.kind === 'stop') {
      // a stop stands at its station, or at its own vertex of the wall (index.ts, crossChapter)
      rail.set(node.station, pose(node), true, phone, node.exhibit ? node.vertex : undefined)
      return
    }
    if (node.wall) {
      const wall = replay.vinciWallOfStation(node.station)
      if (!wall || wall.id !== node.wall) throw new Error(`${node.id}: its station ends no wall of its own`)
      rail.set(node.station, pose(node), true, phone, node.vertex)
      return
    }
    rail.set(node.station, livePose(replay.stationNode(node.station).pose[framingName]), true, phone)
    rail.update()
    if (!rail.approach(node.exhibit, pose(node), phone, true)) throw new Error(`${node.id}: the approach refused an instant placement`)
  }
  const request = (edge, from, to) => (rail) => {
    const m = edge.motion
    if (m.rail === 'route') return rail.set(to.station, pose(to), false, phone)
    if (m.rail === 'wall') {
      if (to.kind === 'stop') return rail.set(to.station, pose(to), false, phone, m.to)
      return rail.along(m.to, from.station, pose(to), to.exhibit, phone)
    }
    if (m.rail === 'approach') return rail.approach(m.exhibit, pose(to), phone, false)
    if (m.rail === 'return') return rail.returnToStation()
    if (m.rail === 'link') return rail.chain(m.to, pose(to), phone)
    throw new Error(`${edge.id}: no motion ${m.rail}`)
  }
  return { place, request }
}

/** One edge of the graph in one framing. */
export function replayEdge(replay, graph, edge, framingName, { tail = 0 } = {}) {
  const framing = FRAMINGS[framingName]
  const byId = replay.byId ??= new Map(graph.nodes.map((n) => [n.id, n]))
  replay.stationNode ??= (station) => graph.nodes.find((n) => n.kind === 'stop' && n.station === station && !n.exhibit)
  const from = byId.get(edge.from), to = byId.get(edge.to)
  const moves = nodeMoves(replay, framingName, framing.phone)
  return walkClip(replay, { aspect: framing.width / framing.height, phone: framing.phone, place: moves.place(from), request: moves.request(edge, from, to), tail })
}

/** A station route of the rooms' own order, at any stage size: the leg the
    pre-render test captured. */
export function replayRoute(replay, fromStation, toStation, { width, height, tail = 0 }) {
  const aspect = width / height
  const phone = aspect <= 0.9
  const from = replay.stationPose(fromStation, phone), to = replay.stationPose(toStation, phone)
  return walkClip(replay, {
    aspect, phone, tail,
    place: (rail) => rail.set(fromStation, from, true, phone),
    request: (rail) => rail.set(toStation, to, false, phone),
  })
}

/** A replayed track against a capture's own prints, frame for frame. */
export function compareTrack(replayed, captured) {
  const ours = [...replayed.prints, ...replayed.tail]
  const n = Math.min(ours.length, captured.length)
  let same = 0, worst = 0, worstAt = -1
  const differ = []
  for (let i = 0; i < n; i++) {
    if (ours[i] === captured[i]) { same++; continue }
    differ.push(i)
    const a = ours[i].split(',').map(Number), b = captured[i].split(',').map(Number)
    for (let k = 0; k < a.length; k++) {
      const d = Math.abs(a[k] - b[k])
      if (d > worst) { worst = d; worstAt = i }
    }
  }
  return { compared: n, ours: ours.length, theirs: captured.length, same, differ, worst, worstAt }
}

async function main() {
  const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const at = a.indexOf('=')
    return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
  }))
  const rev = String(flags.get('rev') ?? '')
  const replay = await openReplay({ rev })
  const t0 = Date.now()
  console.log(`the rail at ${replay.wing.loader.revision}, certificate ${replay.wing.certificateSha256.slice(0, 12)}, proof ${replay.authority.proof}`)

  if (flags.has('compare')) {
    const record = JSON.parse(readFileSync(String(flags.get('compare')), 'utf8'))
    const r = replayRoute(replay, record.from, record.to, { width: record.view.width, height: record.view.height, tail: record.tail })
    const c = compareTrack(r, record.frames.map((f) => f.cam))
    console.log(`the capture: ${record.framing} ${record.view.width}x${record.view.height}, ${record.from} to ${record.to}, arrival at frame ${record.arrivedAt}, ${record.frames.length} frames kept`)
    console.log(`the replay:  arrival at frame ${r.arrivedAt}, ${r.prints.length + r.tail.length} frames with the tail, key ${r.key.slice(0, 16)}`)
    console.log(`identical prints ${c.same} / ${c.compared}${c.ours !== c.theirs ? ` (lengths ${c.ours} and ${c.theirs})` : ''}`)
    if (c.differ.length) console.log(`frames that differ: ${c.differ.length}, first ${c.differ.slice(0, 12).join(', ')}; the largest difference ${round(c.worst, 6)} at frame ${c.worstAt}`)
    if (flags.has('show')) for (const i of [0, 1, 2, r.arrivedAt - 1, r.arrivedAt]) console.log(`  f${i}  replay ${r.prints[i]}  capture ${record.frames[i]?.cam}`)
    if (c.same !== c.compared || c.ours !== c.theirs || r.arrivedAt !== record.arrivedAt) process.exitCode = 1
    return
  }

  if (flags.has('route')) {
    const [from, to] = String(flags.get('route')).split(':')
    const [width, height] = String(flags.get('size') ?? '1280x720').split('x').map(Number)
    const r = replayRoute(replay, from, to, { width, height })
    r.prints.forEach((p, i) => console.log(`f${String(i).padStart(5, '0')} ${p}`))
    console.log(`arrival at frame ${r.arrivedAt}, key ${r.key}`)
    return
  }

  const graph = buildGraph(replay.wing, { wall: String(flags.get('wall') ?? 'both') })
  if (flags.has('clip')) {
    const edge = graph.edges.find((e) => e.id === flags.get('clip'))
    if (!edge) throw new Error(`no clip ${flags.get('clip')}`)
    const framing = String(flags.get('framing') ?? 'wide')
    const r = replayEdge(replay, graph, edge, framing)
    r.prints.forEach((p, i) => console.log(`f${String(i).padStart(5, '0')} ${p}`))
    console.log(`${edge.id} ${framing}: arrival at frame ${r.arrivedAt} (the graph says ${edge.framings[framing].frames}), key ${r.key}`)
    return
  }

  if (flags.has('all')) {
    const keys = []
    let mismatched = 0
    for (const edge of graph.edges) for (const framing of Object.keys(FRAMINGS)) {
      const r = replayEdge(replay, graph, edge, framing)
      const want = edge.framings[framing].frames
      if (r.arrivedAt !== want) { mismatched++; console.log(`FRAMES ${edge.id} ${framing}: replay lands at ${r.arrivedAt}, the graph says ${want}`) }
      keys.push({ clip: edge.id, framing, frames: r.arrivedAt, key: r.key, first: r.prints[0], last: r.prints[r.arrivedAt], ...(flags.has('tracks') ? { prints: r.prints } : {}) })
    }
    console.log(`${keys.length} tracks replayed in ${((Date.now() - t0) / 1000).toFixed(1)} s; arrival frames that disagree with the graph: ${mismatched}`)
    /* A REST POSE HAS ONE PICTURE: every clip that ends at a node ends on the
       print every clip leaving it begins with, whichever way it came */
    const rest = new Map()
    for (const k of keys) {
      const edge = graph.edges.find((e) => e.id === k.clip)
      for (const [node, print] of [[edge.from, k.first], [edge.to, k.last]]) {
        const at = `${node} ${k.framing}`
        if (!rest.has(at)) rest.set(at, new Set())
        rest.get(at).add(canonicalPrint(print))
      }
    }
    const split = [...rest.entries()].filter(([, prints]) => prints.size > 1)
    console.log(`rest poses: ${rest.size}, with more than one print: ${split.length}`)
    for (const [at, prints] of split.slice(0, 8)) console.log(`  ${at}: ${[...prints].join(' | ')}`)
    if (split.length) mismatched++
    /* THE KEYS AGAINST AN EARLIER SET: red where a track moved, new where the
       graph grew a clip, orphaned where it lost one */
    if (flags.has('diff')) {
      const before = new Map(JSON.parse(readFileSync(String(flags.get('diff')), 'utf8')).keys.map((k) => [`${k.clip} ${k.framing}`, k]))
      const now = new Map(keys.map((k) => [`${k.clip} ${k.framing}`, k]))
      const red = [...now.keys()].filter((at) => before.has(at) && before.get(at).key !== now.get(at).key)
      const fresh = [...now.keys()].filter((at) => !before.has(at))
      const orphans = [...before.keys()].filter((at) => !now.has(at))
      console.log(`against ${flags.get('diff')}: ${red.length} red, ${now.size - red.length - fresh.length} unchanged, ${fresh.length} new, ${orphans.length} orphaned`)
      for (const at of red.slice(0, Number(flags.get('list') ?? 12))) console.log(`  red ${at}: frames ${before.get(at).frames} to ${now.get(at).frames}`)
    }
    if (flags.has('out')) {
      writeFileSync(String(flags.get('out')), JSON.stringify({ format: TRACK_FORMAT, revision: replay.wing.loader.revision, certificate: replay.wing.certificateSha256, fps: FPS, pace: FILM_PACE, keys }, null, 1) + '\n')
      console.log(`the keys written to ${flags.get('out')}`)
    }
    if (mismatched) process.exitCode = 1
    return
  }
  console.log('nothing asked: --compare, --route, --clip or --all')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
