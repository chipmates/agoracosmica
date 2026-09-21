import { Object3D, PerspectiveCamera, Vector3 } from 'three/webgpu'
import { stationPose, type Pose } from './rail'
import { vinciContent } from './content'
import { railGeometryFingerprint, railGeometryFingerprintBreakdown, railGeometrySignature, sameRailGeometrySignature, type RailMeshSignature } from './rail-fingerprint'
import { createCertifiedRailPath } from './rail-smoothing'
import { assertRailProjection } from './rail-projection'
export { assertRailProjection, fittedRailFov } from './rail-projection'
import { vinciApproachPose, vinciApproachRunPairs, vinciExhibitRecords } from './collection/approaches'
import { VINCI_WALLS } from './collection/wall'
import type { VinciStationId } from './content'
import certificateText from './data/rail-clearance.json?raw'

interface SavedPose { eye: number[]; at: number[]; fov: number }
interface SavedRoute {
  viewport: 'desktop' | 'phone'; from: string; to: string
  fromPose: SavedPose; toPose: SavedPose; points: number[][]
  roundedLength: number
  maxNearRadius: number; certifiedBalls: { centre: number[]; radiusM: number }[]
}
/** An approach is reachable from one station and returns to it, so the
 * certificate holds it in a linear table and never in the product of poses. */
interface SavedApproach {
  viewport: 'desktop' | 'phone'; station: string; exhibit: string
  fromPose: SavedPose; toPose: SavedPose; points: number[][]
  roundedLength: number
  maxNearRadius: number; certifiedBalls: { centre: number[]; radiusM: number }[]
}
/** A WALL: one polyline through every stop of a hang, the two end station eyes
 * as its ends. A run between two of its vertices is the sub-path between them,
 * so the table is linear in the stops and never their product. */
interface SavedWall {
  viewport: 'desktop' | 'phone'; id: string; ends: string[]; stops: string[]
  points: number[][]; roundedLength: number
  maxNearRadius: number; certifiedBalls: { centre: number[]; radiusM: number }[]
  /** the cumulative chord to each vertex, and the cumulative length each
      accepted corner takes out of it: a sub-path's own certified length */
  chordM: number[]; shortenM: number[]
}
/** A LEG FROM ONE VIEWING EYE TO THE ONE BESIDE IT, so a visitor walking a
 * row of objects never goes back to the station between two of them. */
interface SavedLink {
  viewport: 'desktop' | 'phone'; station: string; from: string; to: string
  fromPose: SavedPose; toPose: SavedPose; points: number[][]
  roundedLength: number
  maxNearRadius: number; certifiedBalls: { centre: number[]; radiusM: number }[]
}
interface ClearanceData {
  format: 'vinci-rail-clearance-v2'; completeNearClearance: boolean
  geometrySha256: string[]; routes: SavedRoute[]; approaches: SavedApproach[]; walls: SavedWall[]; links: SavedLink[]
  /** the same solids by count and moments, matched within a tolerance: the
      exact hash holds only in the engine that wrote it (see rail-fingerprint) */
  geometrySignatures?: { tier: string; toleranceM: number; meshes: RailMeshSignature[] }[]
}
const data = JSON.parse(certificateText) as ClearanceData
/* A pose is matched within a micron and a millionth of a degree, never by its
   exact digits: a pose that passes through atan or tan differs in its last
   bit from one engine to the next, and the certify program wrote the file in
   one of them. Both tolerances sit far above that noise and far below any
   authored move. */
const POSE_TOLERANCE_M = 1e-6, POSE_TOLERANCE_DEG = 1e-6
const near = (a: readonly number[], b: readonly number[], tolerance: number) =>
  a.length === b.length && a.every((value, i) => Math.abs(value - b[i]!) <= tolerance)
const samePose = (a: SavedPose, b: SavedPose) =>
  near(a.eye, b.eye, POSE_TOLERANCE_M) && near(a.at, b.at, POSE_TOLERANCE_M) && Math.abs(a.fov - b.fov) <= POSE_TOLERANCE_DEG
const toSaved = (pose: Pose): SavedPose => ({ eye: pose.eye.toArray(), at: pose.at.toArray(), fov: pose.fov })
const VIEWPORTS = ['desktop', 'phone'] as const
/** The physical poses the stations stand at, one entry per distinct pose. */
function physicalPoses(viewport: 'desktop' | 'phone'): SavedPose[] {
  const poses: SavedPose[] = []
  for (const station of vinciContent) {
    const pose = toSaved(stationPose(station.id, viewport === 'phone'))
    if (!poses.some(held => samePose(held, pose))) poses.push(pose)
  }
  return poses
}
// Semantic stations may share a physical pose. Require every directed pair
// of the current physical poses, so a newly opened station cannot silently
// rely on the route count of the previous room arrangement. Every saved route
// must answer to one required pair and every required pair to one saved route.
let requiredRoutes = 0, matchedRoutes = 0
const unmatchedRoutes = new Set(data.routes)
for (const viewport of VIEWPORTS) {
  const poses = physicalPoses(viewport)
  for (const from of poses) for (const to of poses) {
    if (from === to) continue
    requiredRoutes++
    const saved = data.routes.find(route => unmatchedRoutes.has(route) && route.viewport === viewport
      && samePose(route.fromPose, from) && samePose(route.toPose, to))
    if (saved) { matchedRoutes++; unmatchedRoutes.delete(saved) }
  }
}
if (data.format !== 'vinci-rail-clearance-v2' || data.completeNearClearance !== true
  || data.routes.length !== requiredRoutes || matchedRoutes !== requiredRoutes
  || unmatchedRoutes.size !== 0) throw new Error('Missing complete Vinci rail certificate')
// EVERY DECLARED VIEWING EYE IS CERTIFIED, at both viewports, on the station
// pose it actually returns to. An exhibit whose pose moved, or a new one that
// was never certified, is refused here and not on the visitor's first press.
let requiredApproaches = 0, matchedApproaches = 0
const unmatchedApproaches = new Set(data.approaches)
for (const viewport of VIEWPORTS) {
  for (const record of vinciExhibitRecords()) {
    const station = toSaved(stationPose(record.station, viewport === 'phone'))
    const viewing = vinciApproachPose(record.id, viewport === 'phone')
    if (!viewing) throw new Error(`Missing Vinci viewing pose: ${record.id}`)
    const eye = toSaved(viewing)
    requiredApproaches++
    const saved = data.approaches.find(approach => unmatchedApproaches.has(approach) && approach.viewport === viewport
      && approach.station === record.station && approach.exhibit === record.id
      && samePose(approach.fromPose, station) && samePose(approach.toPose, eye))
    if (saved) { matchedApproaches++; unmatchedApproaches.delete(saved) }
  }
}
if (data.approaches.length !== requiredApproaches || matchedApproaches !== requiredApproaches
  || unmatchedApproaches.size !== 0) throw new Error('Missing complete Vinci approach certificate')
// EVERY DECLARED WALL, ONCE PER VIEWPORT, WITH EVERY STOP ON IT. The stops
// are each wall's own, in its own order, and each vertex is the eye the
// approach table already certifies, so a run cannot walk to a stop that was
// never proved. A wall that declares one end begins at that station's eye and
// ends at its last stop.
if ((data.walls?.length ?? 0) !== VINCI_WALLS.length * VIEWPORTS.length) throw new Error('Missing complete Vinci wall certificate')
for (const viewport of VIEWPORTS) {
  for (const declared of VINCI_WALLS) {
    const found = data.walls.filter(entry => entry.viewport === viewport && entry.id === declared.id)
    const saved = found[0]
    const wallStops = declared.stops().map(stop => stop.exhibit)
    if (found.length !== 1 || !saved) throw new Error('Missing complete Vinci wall certificate')
    if (saved.stops.length !== wallStops.length || saved.stops.some((stop, i) => stop !== wallStops[i])
      || saved.points.length !== wallStops.length + declared.ends.length || saved.chordM.length !== saved.points.length
      || saved.shortenM.length !== saved.points.length
      || saved.ends.length !== declared.ends.length || saved.ends.some((end, i) => end !== declared.ends[i])) {
      throw new Error('Missing complete Vinci wall certificate')
    }
    for (const [at, end] of saved.ends.entries()) {
      const eye = stationPose(end as VinciStationId, viewport === 'phone').eye
      if (!near(saved.points[at === 0 ? 0 : saved.points.length - 1]!, [eye.x, -eye.z, eye.y], POSE_TOLERANCE_M)) {
        throw new Error('Missing complete Vinci wall certificate')
      }
    }
    for (const [at, stop] of saved.stops.entries()) {
      const pose = vinciApproachPose(stop, viewport === 'phone')
      if (!pose || !near(saved.points[at + 1]!, [pose.eye.x, -pose.eye.z, pose.eye.y], POSE_TOLERANCE_M)) {
        throw new Error('Missing complete Vinci wall certificate')
      }
    }
  }
}
// EVERY DECLARED NEIGHBOUR PAIR IS CERTIFIED, at both viewports, on the two
// viewing eyes it actually joins.
let requiredLinks = 0, matchedLinks = 0
const unmatchedLinks = new Set(data.links ?? [])
for (const viewport of VIEWPORTS) {
  for (const pair of vinciApproachRunPairs()) {
    const from = vinciApproachPose(pair.from, viewport === 'phone'), to = vinciApproachPose(pair.to, viewport === 'phone')
    if (!from || !to) throw new Error(`Missing Vinci viewing pose: ${pair.from} or ${pair.to}`)
    requiredLinks++
    const saved = (data.links ?? []).find(link => unmatchedLinks.has(link) && link.viewport === viewport
      && link.from === pair.from && link.to === pair.to
      && samePose(link.fromPose, toSaved(from)) && samePose(link.toPose, toSaved(to)))
    if (saved) { matchedLinks++; unmatchedLinks.delete(saved) }
  }
}
if ((data.links ?? []).length !== requiredLinks || matchedLinks !== requiredLinks
  || unmatchedLinks.size !== 0) throw new Error('Missing complete Vinci link certificate')

const geometryToleranceM = .000002
export { collectRailSolids, railCollisionIds } from './rail-solids'

/** Which proof carried the mounted geometry: the exact hash, the certified
 * signature within its tolerance, or none, in which case nothing walks. */
export type RailProofKind = 'hash' | 'signature' | 'none'
/* `crypto.subtle` exists in a secure context only (https, or localhost), so a
   page served to a LAN address over plain http can compute no hash at all and
   the walk would fall silently back to placing the camera. There the
   certificate's tolerant signature carries it instead, which is arithmetic
   over the same certified solids. On a secure page the hash is tried first
   and no tolerance moves. */
const canHash = typeof crypto !== 'undefined' && typeof (crypto as { subtle?: SubtleCrypto }).subtle?.digest === 'function'

function sameSavedPose(saved: SavedPose, pose: Pose) {
  return samePose(saved, toSaved(pose))
}

/** Runs one SHA-256 of actual mounted positions/topology/transforms at mount.
 * It never builds a browser collision index. Until it resolves, navigation
 * remains at its previous endpoint. A mismatch requires a fresh offline audit.
 */
export function createRailGeometryAuthority(roots: readonly Object3D[]) {
  let status: 'checking' | 'verified' | 'failed' = 'checking', failure = '', proof: RailProofKind = 'none'
  const ready = (canHash ? railGeometryFingerprint(roots) : Promise.resolve('')).then(async hash => {
    // the exact hash first; failing that, the engine-tolerant identity: the
    // certified solids by name, count, extent and moments within 10 um
    const exact = canHash && data.geometrySha256.includes(hash)
    let deviation = ''
    const tolerant = !exact && (() => {
      const actual = railGeometrySignature(roots)
      const entries = data.geometrySignatures ?? []
      if (entries.some(entry => sameRailGeometrySignature(actual, entry.meshes, entry.toleranceM))) return true
      // name the nearest certified tier and how far the solids sit from it,
      // so a refusal says whether it is engine noise or a moved solid
      deviation = entries.map(entry => {
        let worst = 0, where = ''
        const byName = new Map(entry.meshes.map(mesh => [mesh.name, mesh]))
        for (const mesh of actual) {
          const saved = byName.get(mesh.name)
          if (!saved) { where = `${mesh.name} not certified`; worst = Infinity; break }
          if (saved.vertices !== mesh.vertices) { where = `${mesh.name} ${mesh.vertices} vs ${saved.vertices} vertices`; worst = Infinity; break }
          for (const [a, b] of [[mesh.bbox, saved.bbox], [mesh.centroid, saved.centroid], [mesh.rms, saved.rms]] as const) {
            a.forEach((value, i) => { const delta = Math.abs(value - b[i]!); if (delta > worst) { worst = delta; where = mesh.name } })
          }
        }
        return `${entry.tier}: ${actual.length} of ${entry.meshes.length} meshes, worst ${worst} m at ${where}`
      }).join(' | ') || 'no signatures in the certificate'
      return false
    })()
    if (!exact && !tolerant) {
      // the per mesh breakdown is itself hashed, so a page that cannot hash
      // is refused on the signature alone rather than on a TypeError
      if (!canHash) throw new Error(`Vinci rail geometry has no matching certified signature, and this page cannot hash: ${deviation}`)
      const detail = await railGeometryFingerprintBreakdown(roots)
      const meshes = detail.meshes.map(mesh => [mesh.name, mesh.manifestId, mesh.vertices, mesh.sha256.slice(-16)])
      throw new Error(`Vinci rail geometry has no matching clearance certificate: ${hash}; tolerant signature: ${deviation}; actual mesh records [name, manifestId, vertices, SHA256 suffix]: ${JSON.stringify(meshes)}; repeated geometry hash: ${detail.sha256}`)
    }
    proof = exact ? 'hash' : 'signature'
    status = 'verified'
    // one line, so a walk that cannot be proved is read and not guessed at
    if (exact) console.log('rail proof: the exact geometry hash')
    else if (canHash) console.log('rail proof: the certified signature, inside its tolerance')
    else console.warn('rail proof: the certified signature, inside its tolerance. This page is not secure, so it has no way to hash the geometry (that needs https or localhost). The strict hash on a secure page is unchanged.')
  }).catch(error => {
    status = 'failed'; failure = String(error); proof = 'none'
    console.error(failure)
    console.warn('rail proof: none, so the wing places the camera at each station instead of walking it')
  })
  const paths = new Map<SavedRoute, ReturnType<typeof createCertifiedRailPath>>()
  type Certified = ReturnType<typeof createCertifiedRailPath>
  const approachPaths = new Map<SavedApproach, { out?: Certified; back?: Certified }>()
  const linkPaths = new Map<SavedLink, { out?: Certified; back?: Certified }>()
  /** Rebuild one certified polyline. The balls are the offline proof's own,
   * so a corner is rounded here only where a triangle test certified it. */
  const wallPaths = new Map<SavedWall, Map<string, Certified>>()
  /** A sub-path's certified length is summed from the certificate's own
   * cumulative tables and the rebuilt curve sums the same quantities in
   * another order, so a wall run allows a nanometre where a whole route,
   * whose length is stored as one number, allows nothing. */
  const SUBPATH_TOLERANCE_M = 1e-9
  function rebuild(saved: SavedRoute | SavedApproach | SavedWall | SavedLink, points: Vector3[],
    certifiedLength = saved.roundedLength, tolerance = 0): Certified {
    const balls = saved.certifiedBalls.map(ball => ({ centre: new Vector3().fromArray(ball.centre), radius: ball.radiusM - geometryToleranceM }))
    const path = createCertifiedRailPath(points, {
      clearanceRadiusM: saved.maxNearRadius, maxTrimM: .5, certificateDepth: 6,
      // Real containment in a saved, triangle-tested closed ball. The
      // geometric identity tolerance has already been removed above.
      certifyBall: (centre, radius) => balls.some(ball => ball.centre.distanceTo(centre) + radius <= ball.radius),
    })
    // The arrival plane proof bounds slerp rotation per metre using this
    // certified length. A different, shorter reconstruction would break that
    // bound even if every new curve had valid geometric coverage.
    if (!(certifiedLength > 0 && Number.isFinite(certifiedLength)) || path.length < certifiedLength - tolerance) throw new Error('Rebuilt Vinci rail is shorter than its certified orientation bound')
    // A rejected fillet retains its already certified original polyline.
    // No unproved curve, altered waypoint or unverified geometry fallback.
    return path
  }
  return {
    ready,
    get status() { return status },
    get failure() { return failure },
    get proof() { return proof },
    route(from: Pose, to: Pose, phone: boolean, camera: PerspectiveCamera) {
      if (status !== 'verified') throw new Error(failure || 'Rail clearance identity is still being checked')
      assertRailProjection(camera)
      const saved = data.routes.find(route => route.viewport === (phone ? 'phone' : 'desktop') && sameSavedPose(route.fromPose, from) && sameSavedPose(route.toPose, to))
      if (!saved || camera.position.distanceToSquared(from.eye) > 1e-18) throw new Error('This camera start/target has no certified Vinci route')
      let path = paths.get(saved)
      if (!path) {
        path = rebuild(saved, saved.points.map(([east, north, height]) => new Vector3(east!, height!, -north!)))
        paths.set(saved, path)
      }
      return path
    },
    /** A LEG TO ONE EXHIBIT AND BACK, on the one certified path that exists
     * for it. `back` walks the same points reversed, which is why the return
     * lands on the station eye the certificate holds and not on a rebuilt one.
     */
    approach(station: Pose, viewing: Pose, phone: boolean, camera: PerspectiveCamera, back = false) {
      if (status !== 'verified') throw new Error(failure || 'Rail clearance identity is still being checked')
      assertRailProjection(camera)
      const saved = data.approaches.find(approach => approach.viewport === (phone ? 'phone' : 'desktop')
        && sameSavedPose(approach.fromPose, station) && sameSavedPose(approach.toPose, viewing))
      const from = back ? viewing : station
      if (!saved || camera.position.distanceToSquared(from.eye) > 1e-18) throw new Error('This camera start/target has no certified Vinci approach')
      const held = approachPaths.get(saved) ?? {}
      const direction = back ? 'back' : 'out'
      let path = held[direction]
      if (!path) {
        const points = saved.points.map(([east, north, height]) => new Vector3(east!, height!, -north!))
        path = rebuild(saved, back ? points.reverse() : points)
        approachPaths.set(saved, { ...held, [direction]: path })
      }
      return path
    },
    /** THE LEG BETWEEN TWO NEIGHBOURING VIEWING EYES, on the one certified
     * path that exists for the pair. Walked either way, so the leg back is
     * the same points reversed and lands on the eye the certificate holds. */
    link(from: string, to: string, fromPose: Pose, toPose: Pose, phone: boolean, camera: PerspectiveCamera) {
      if (status !== 'verified') throw new Error(failure || 'Rail clearance identity is still being checked')
      assertRailProjection(camera)
      const forward = data.links.find(entry => entry.viewport === (phone ? 'phone' : 'desktop')
        && entry.from === from && entry.to === to
        && sameSavedPose(entry.fromPose, fromPose) && sameSavedPose(entry.toPose, toPose))
      const saved = forward ?? data.links.find(entry => entry.viewport === (phone ? 'phone' : 'desktop')
        && entry.from === to && entry.to === from
        && sameSavedPose(entry.fromPose, toPose) && sameSavedPose(entry.toPose, fromPose))
      if (!saved || camera.position.distanceToSquared(fromPose.eye) > 1e-18) throw new Error('This camera start/target has no certified Vinci link')
      const held = linkPaths.get(saved) ?? {}
      const direction = forward ? 'out' : 'back'
      let path = held[direction]
      if (!path) {
        const points = saved.points.map(([east, north, height]) => new Vector3(east!, height!, -north!))
        path = rebuild(saved, forward ? points : points.reverse())
        linkPaths.set(saved, { ...held, [direction]: path })
      }
      return path
    },
    /** A RUN ALONG A WALL, on the sub-path of its one certified polyline
     * between two of its vertices. Vertex 0 is the east end station, the last
     * is the west end, and the stops of the hang stand between them in the
     * wall's own order. No new geometry is proved here: the balls, the trims
     * and the spans are the offline proof's, and a sub-path holds a strict
     * subset of them. */
    wall(id: string, from: number, to: number, phone: boolean, camera: PerspectiveCamera) {
      if (status !== 'verified') throw new Error(failure || 'Rail clearance identity is still being checked')
      assertRailProjection(camera)
      const saved = data.walls.find(entry => entry.viewport === (phone ? 'phone' : 'desktop') && entry.id === id)
      if (!saved) throw new Error('This wall has no certificate')
      const last = saved.points.length - 1
      if (!(Number.isInteger(from) && Number.isInteger(to) && from !== to
        && from >= 0 && from <= last && to >= 0 && to <= last)) throw new Error('This wall run is not between two certified stops')
      const start = saved.points[from]!
      if (camera.position.distanceToSquared(new Vector3(start[0]!, start[2]!, -start[1]!)) > 1e-18) throw new Error('This camera start/target has no certified Vinci wall run')
      const held = wallPaths.get(saved) ?? new Map<string, Certified>()
      const key = `${from}:${to}`
      let path = held.get(key)
      if (!path) {
        const low = Math.min(from, to), high = Math.max(from, to)
        // The certified length of exactly this run: the chord between its two
        // vertices, less what each corner INSIDE it takes out of that chord.
        // Its own two ends take no corner, which is why they are excluded.
        const certifiedLength = (saved.chordM[high]! - saved.chordM[low]!) - (saved.shortenM[high - 1]! - saved.shortenM[low]!)
        const slice = saved.points.slice(low, high + 1).map(([east, north, height]) => new Vector3(east!, height!, -north!))
        path = rebuild(saved, from < to ? slice : slice.reverse(), certifiedLength, SUBPATH_TOLERANCE_M)
        held.set(key, path)
        wallPaths.set(saved, held)
      }
      return path
    },
  }
}
export type RailGeometryAuthority = ReturnType<typeof createRailGeometryAuthority>
