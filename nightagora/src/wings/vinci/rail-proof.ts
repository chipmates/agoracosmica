import { Mesh, Object3D, PerspectiveCamera, Vector3 } from 'three/webgpu'
import type { Pose } from './rail'
import { railGeometryFingerprint, railGeometryFingerprintBreakdown } from './rail-fingerprint'
import { createCertifiedRailPath } from './rail-smoothing'
import { assertRailProjection } from './rail-projection'
export { assertRailProjection, fittedRailFov } from './rail-projection'
import certificateText from './data/rail-clearance.json?raw'

interface SavedPose { eye: number[]; at: number[]; fov: number }
interface SavedRoute {
  viewport: 'desktop' | 'phone'; from: string; to: string
  fromPose: SavedPose; toPose: SavedPose; points: number[][]
  roundedLength: number
  maxNearRadius: number; certifiedBalls: { centre: number[]; radiusM: number }[]
}
interface ClearanceData {
  format: 'vinci-rail-clearance-v1'; completeNearClearance: boolean
  geometrySha256: string[]; routes: SavedRoute[]
}
const data = JSON.parse(certificateText) as ClearanceData
if (data.format !== 'vinci-rail-clearance-v1' || data.completeNearClearance !== true || data.routes.length !== 40) throw new Error('Missing complete Vinci rail certificate')
const geometryToleranceM = .000002
const collisionIds = new Set(['vinci/shell', 'vinci/gate-passage', 'vinci/inner-court', 'vinci/terrain', 'vinci/collection', 'vinci/collection-access', 'vinci/water', 'vinci/entry-passage', 'vinci/vegetation', 'vinci/road-dressing', 'vinci/ground-dressing'])

/** Same physical solids as the offline certificate, including actual leaves
 * and dressing. Shadow-only doubles and sky are outside the collision scope.
 * The current foundation is welded into the shell. Explicit child IDs win.
 */
export function collectRailSolids(scene: Object3D): Object3D[] {
  const roots: Object3D[] = []
  scene.traverse(object => {
    if (object instanceof Mesh && collisionIds.has(String(object.userData['manifestId']))) roots.push(object)
  })
  return roots
}

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
    if (!data.geometrySha256.includes(hash)) {
      const detail = await railGeometryFingerprintBreakdown(roots)
      const meshes = detail.meshes.map(mesh => [mesh.name, mesh.manifestId, mesh.vertices, mesh.sha256.slice(-16)])
      throw new Error(`Vinci rail geometry has no matching clearance certificate: ${hash}; actual mesh records [name, manifestId, vertices, SHA256 suffix]: ${JSON.stringify(meshes)}; repeated geometry hash: ${detail.sha256}`)
    }
    status = 'verified'
  }).catch(error => { status = 'failed'; failure = String(error); console.error(failure) })
  const paths = new Map<SavedRoute, ReturnType<typeof createCertifiedRailPath>>()
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
        const points = saved.points.map(([east, north, height]) => new Vector3(east!, height!, -north!))
        const balls = saved.certifiedBalls.map(ball => ({ centre: new Vector3().fromArray(ball.centre), radius: ball.radiusM - geometryToleranceM }))
        path = createCertifiedRailPath(points, {
          clearanceRadiusM: saved.maxNearRadius, maxTrimM: .5, certificateDepth: 6,
          // Real containment in a saved, triangle-tested closed ball. The
          // geometric identity tolerance has already been removed above.
          certifyBall: (centre, radius) => balls.some(ball => ball.centre.distanceTo(centre) + radius <= ball.radius),
        })
        // The arrival plane proof bounds slerp rotation per metre using this
        // certified length. A different, shorter reconstruction would break
        // that bound even if every new curve had valid geometric coverage.
        if (!(saved.roundedLength > 0 && Number.isFinite(saved.roundedLength)) || path.length < saved.roundedLength) throw new Error('Rebuilt Vinci rail is shorter than its certified orientation bound')
        // A rejected fillet retains its already certified original polyline.
        // No unproved curve, altered waypoint or unverified geometry fallback.
        paths.set(saved, path)
      }
      return path
    },
  }
}
export type RailGeometryAuthority = ReturnType<typeof createRailGeometryAuthority>
