import { Mesh, Object3D } from 'three/webgpu'
import { STAND_SOLIDS_NAME } from './collection/stands'

/** WHERE EVERY MACHINE STANDS is part of the rail's collision scope too. The
 * offline certifier reads this table, builds each machine's geometry in the
 * pose its schedule holds at t=0, and proves every route and every station
 * envelope against those triangles. The machines are not mounted meshes at
 * the moment the runtime hashes the scene (they arrive as the visitor walks
 * up to them), so they are not part of the geometry fingerprint: the
 * certificate covers them, and `rail-certify.mjs --verify` is what proves it.
 */
export { STANDS as railExhibitStands, standLevel as railExhibitLevel } from './collection/stands'

/** The physical solids the rail is certified against, by manifest id.
 * Shadow-only doubles and the sky are outside the collision scope; the
 * foundation is welded into the shell. The offline certifier and the runtime
 * authority read this one list, so neither can drift from the other.
 */
export const railCollisionIds: ReadonlySet<string> = new Set([
  'vinci/shell', 'vinci/gate-passage', 'vinci/inner-court', 'vinci/terrain',
  'vinci/collection', 'vinci/collection-access', 'vinci/water', 'vinci/entry-passage',
  'vinci/vegetation', 'vinci/road-dressing', 'vinci/ground-dressing',
])

/** The rooms of the insertion are a separate body, and only their built
 * construction is a wall: the plinths the exhibits stand on carry the same id
 * and are not there when the certificate is written, so they are named out.
 */
export const railCollisionNames: ReadonlySet<string> = new Set([
  'vinci/collection-rooms/construction',
  // The plinths and bases under the exhibits. They carry the rooms' own id
  // and are one fixed body from the first frame, so they are named in.
  STAND_SOLIDS_NAME,
])

/** Same physical solids as the offline certificate, including actual leaves
 * and dressing. Explicit child IDs win.
 */
export function collectRailSolids(scene: Object3D): Object3D[] {
  const roots: Object3D[] = []
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return
    if (railCollisionNames.has(object.name)) { roots.push(object); return }
    if (railCollisionIds.has(String(object.userData['manifestId']))) roots.push(object)
  })
  return roots
}
