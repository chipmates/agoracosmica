import { Object3D, PerspectiveCamera, Vector3 } from 'three/webgpu'
import { stationPose, type Pose } from './rail'
import { vinciContent } from './content'
import { railGeometryFingerprint, railGeometryFingerprintBreakdown, railGeometrySignature, sameRailGeometrySignature, type RailMeshSignature } from './rail-fingerprint'
import { createCertifiedRailPath } from './rail-smoothing'
import { assertRailProjection } from './rail-projection'
export { assertRailProjection, fittedRailFov } from './rail-projection'
import { vinciApproachPose, vinciExhibitRecords } from './collection/approaches'
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
interface ClearanceData {
  format: 'vinci-rail-clearance-v2'; completeNearClearance: boolean
  geometrySha256: string[]; routes: SavedRoute[]; approaches: SavedApproach[]
  /** the same solids by count and moments, matched within a tolerance: the
      exact hash holds only in the engine that wrote it (see rail-fingerprint) */
  geometrySignatures?: { tier: string; toleranceM: number; meshes: RailMeshSignature[] }[]
}
const data = JSON.parse(certificateText) as ClearanceData
const savedPoseKey = (pose: SavedPose) => JSON.stringify([pose.eye, pose.at, pose.fov])
const routeKey = (viewport: string, from: SavedPose, to: SavedPose) => `${viewport}:${savedPoseKey(from)}>${savedPoseKey(to)}`
const approachKey = (viewport: string, station: string, exhibit: string, from: SavedPose, to: SavedPose) =>
  `${viewport}:${station}:${exhibit}:${savedPoseKey(from)}>${savedPoseKey(to)}`
const requiredRoutes = new Set<string>()
for (const viewport of ['desktop', 'phone'] as const) {
  const poses = new Map<string, SavedPose>()
  for (const station of vinciContent) {
    const pose = stationPose(station.id, viewport === 'phone')
    const saved = { eye: pose.eye.toArray(), at: pose.at.toArray(), fov: pose.fov }
    poses.set(savedPoseKey(saved), saved)
  }
  for (const [fromKey, from] of poses) for (const [toKey, to] of poses) {
    if (fromKey !== toKey) requiredRoutes.add(routeKey(viewport, from, to))
  }
}
// Semantic stations may share a physical pose. Require every directed pair
// of the current physical poses, so a newly opened station cannot silently
// rely on the route count of the previous room arrangement.
const savedRoutes = new Set(data.routes.map(route => routeKey(route.viewport, route.fromPose, route.toPose)))
if (data.format !== 'vinci-rail-clearance-v2' || data.completeNearClearance !== true
  || data.routes.length !== requiredRoutes.size || savedRoutes.size !== requiredRoutes.size
  || [...requiredRoutes].some(route => !savedRoutes.has(route))) throw new Error('Missing complete Vinci rail certificate')
// EVERY DECLARED VIEWING EYE IS CERTIFIED, at both viewports, on the station
// pose it actually returns to. An exhibit whose pose moved, or a new one that
// was never certified, is refused here and not on the visitor's first press.
const requiredApproaches = new Set<string>()
for (const viewport of ['desktop', 'phone'] as const) {
  for (const record of vinciExhibitRecords()) {
    const station = stationPose(record.station, viewport === 'phone')
    const viewing = vinciApproachPose(record.id, viewport === 'phone')
    if (!viewing) throw new Error(`Missing Vinci viewing pose: ${record.id}`)
    requiredApproaches.add(approachKey(viewport, record.station, record.id,
      { eye: station.eye.toArray(), at: station.at.toArray(), fov: station.fov },
      { eye: viewing.eye.toArray(), at: viewing.at.toArray(), fov: viewing.fov }))
  }
}
const savedApproaches = new Set(data.approaches.map(approach =>
  approachKey(approach.viewport, approach.station, approach.exhibit, approach.fromPose, approach.toPose)))
if (data.approaches.length !== requiredApproaches.size || savedApproaches.size !== requiredApproaches.size
  || [...requiredApproaches].some(approach => !savedApproaches.has(approach))) throw new Error('Missing complete Vinci approach certificate')
const geometryToleranceM = .000002
export { collectRailSolids, railCollisionIds } from './rail-solids'

function sameSavedPose(saved: SavedPose, pose: Pose) {
  return pose.eye.distanceToSquared(new Vector3().fromArray(saved.eye)) < 1e-18
    && pose.at.distanceToSquared(new Vector3().fromArray(saved.at)) < 1e-18
    && Math.abs(pose.fov - saved.fov) < 1e-9
}

/** Runs one SHA-256 of actual mounted positions/topology/transforms at mount.
 * It never builds a browser collision index. Until it resolves, navigation
 * remains at its previous endpoint. A mismatch requires a fresh offline audit.
 */
export function createRailGeometryAuthority(roots: readonly Object3D[]) {
  let status: 'checking' | 'verified' | 'failed' = 'checking', failure = ''
  const ready = railGeometryFingerprint(roots).then(async hash => {
    // the exact hash first; failing that, the engine-tolerant identity: the
    // certified solids by name, count, extent and moments within 10 um
    const exact = data.geometrySha256.includes(hash)
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
      const detail = await railGeometryFingerprintBreakdown(roots)
      const meshes = detail.meshes.map(mesh => [mesh.name, mesh.manifestId, mesh.vertices, mesh.sha256.slice(-16)])
      throw new Error(`Vinci rail geometry has no matching clearance certificate: ${hash}; tolerant signature: ${deviation}; actual mesh records [name, manifestId, vertices, SHA256 suffix]: ${JSON.stringify(meshes)}; repeated geometry hash: ${detail.sha256}`)
    }
    status = 'verified'
  }).catch(error => { status = 'failed'; failure = String(error); console.error(failure) })
  const paths = new Map<SavedRoute, ReturnType<typeof createCertifiedRailPath>>()
  type Certified = ReturnType<typeof createCertifiedRailPath>
  const approachPaths = new Map<SavedApproach, { out?: Certified; back?: Certified }>()
  /** Rebuild one certified polyline. The balls are the offline proof's own,
   * so a corner is rounded here only where a triangle test certified it. */
  function rebuild(saved: SavedRoute | SavedApproach, points: Vector3[]): Certified {
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
    if (!(saved.roundedLength > 0 && Number.isFinite(saved.roundedLength)) || path.length < saved.roundedLength) throw new Error('Rebuilt Vinci rail is shorter than its certified orientation bound')
    // A rejected fillet retains its already certified original polyline.
    // No unproved curve, altered waypoint or unverified geometry fallback.
    return path
  }
  return {
    ready,
    get status() { return status },
    get failure() { return failure },
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
  }
}
export type RailGeometryAuthority = ReturnType<typeof createRailGeometryAuthority>
