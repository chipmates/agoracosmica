import { Mesh, Object3D } from 'three/webgpu'

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

/** Same physical solids as the offline certificate, including actual leaves
 * and dressing. Explicit child IDs win.
 */
export function collectRailSolids(scene: Object3D): Object3D[] {
  const roots: Object3D[] = []
  scene.traverse(object => {
    if (object instanceof Mesh && railCollisionIds.has(String(object.userData['manifestId']))) roots.push(object)
  })
  return roots
}
