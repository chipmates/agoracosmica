// THE EVENING AT THE GRAVE, ITS CAMERA, REPLAYED IN NODE: the grave's look up
// as the film renders it (`graph.mjs` eveningOf, the node; `export.mjs`
// exportEvening, the frames). The rail stands the eye at the grave as the
// film's still stands it; the live wing's `lookUp()` starts the farewell from
// the eye as it stands, and `holdFarewell()` holds the farewell's pose with the
// rail's fitted lens. The same modules do both here, one print a frame at the
// evening's own rate, so the export's browser track is held against it as a
// clip's is against its replay, and the track's hash is the evening's motion key.
//
//   node forge/film/evening.mjs [--framing=wide|upright] [--out=<file>]
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import * as THREE from 'three/webgpu'
import { FRAMINGS, buildGraph } from './graph.mjs'
import { WING_DIR } from './load.mjs'
import { camPrint, openReplay, trackKey } from './replay.mjs'

/** what the evening's key names as its pace: it plays at its own clock, never at the visitor's */
export const EVENING_PACE = 'the farewell\'s own clock'
const round = (n, p = 6) => Math.round(n * 10 ** p) / 10 ** p
const vec = (a) => new THREE.Vector3(a[0], a[1], a[2])

/**
 * The evening's track in one framing: frame 0 the grave's still, frame i the
 * farewell at i / fps of its run (held at its last pose through the rest).
 *   wing   openReplay().wing, or openWing()'s: the loader, the rail, the authority
 */
export function eveningTrack(wing, graph, framingName) {
  const ev = graph.evening
  if (!ev) throw new Error('the graph carries no evening (a revision before the look up)')
  const framing = FRAMINGS[framingName]
  const aspect = framing.width / framing.height, phone = framing.phone
  const farewell = wing.loader.load(`${WING_DIR}/farewell.ts`)
  const { fittedRailFov } = wing.loader.load(`${WING_DIR}/rail-projection.ts`)
  const node = graph.nodes.find((n) => n.id === ev.from)
  const pose = node.pose[framingName]
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.25, 4000)
  const rail = wing.rail.createRail(camera, () => 0, wing.authority)
  rail.set(node.railId ?? node.station, { eye: vec(pose.eye), at: vec(pose.at), fov: pose.fov }, true, phone)
  rail.update()
  const sample = () => [...camera.position.toArray(), ...camera.quaternion.toArray(), camera.fov]
  const prints = [camPrint(camera)], samples = [sample()]
  // the farewell starts from the eye as it stands, the stop's own lens unfitted (`lookUp()`)
  const ahead = camera.getWorldDirection(new THREE.Vector3())
  const start = { eye: camera.position.clone(), at: camera.position.clone().addScaledVector(ahead, 10), fov: wing.rail.stationPose(node.station, phone).fov }
  for (let i = 1; i < ev.frames; i++) {
    const held = farewell.farewellPose(Math.min(1, i / ev.fps / ev.farewell), start, phone)
    camera.position.copy(held.eye)
    camera.lookAt(held.at)
    camera.fov = fittedRailFov(held.fov, aspect, phone)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    prints.push(camPrint(camera))
    samples.push(sample())
  }
  return { prints, samples, key: trackKey({ aspect: round(aspect), fps: ev.fps, pace: EVENING_PACE, prints }) }
}

async function main() {
  const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const at = a.indexOf('=')
    return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
  }))
  const replay = await openReplay()
  const graph = buildGraph(replay.wing)
  if (!graph.evening) { console.log('no evening in this tree'); return }
  const out = {}
  for (const f of flags.has('framing') ? [String(flags.get('framing'))] : Object.keys(FRAMINGS)) {
    const t = eveningTrack(replay.wing, graph, f)
    out[f] = { key: t.key, prints: t.prints }
    console.log(`${f}: ${t.prints.length} frames at ${graph.evening.fps} fps, key ${t.key.slice(0, 12)}; frame 0 ${t.prints[0]}; the last ${t.prints.at(-1)}`)
  }
  if (flags.has('out')) writeFileSync(String(flags.get('out')), JSON.stringify({ evening: graph.evening, tracks: out }, null, 1))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
