import {
  BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Matrix4, Mesh,
  MeshBasicNodeMaterial, Vector3, type Object3D,
} from 'three/webgpu'
import { SHADOW_ONLY_LAYER } from '../../stack/light'

/** THE PLACE CASTS AS ONE BODY.
 *
 * The key light is two cascades and the near one is refitted as the visitor
 * walks, so on a refocus frame every caster in the scene is drawn once per
 * cascade. The wing's fixed bodies below are copied, triangle for triangle,
 * into a single shadow-only mesh and stop casting for themselves: a refocus
 * frame costs one draw per cascade instead of one per body. No triangle is
 * dropped, no silhouette changes, and the exhibits are not in here: they
 * move, and a moving caster belongs to itself.
 */
const STATIC_BODIES: ReadonlySet<string> = new Set([
  'vinci/shell-shadow', 'vinci/terrain', 'vinci/terrain-mesh', 'vinci/vegetation', 'vinci/fallen-leaves',
  'vinci/gate-passage', 'vinci/entry-passage', 'vinci/inner-court',
  'vinci/road-dressing', 'vinci/ground-dressing',
  'vinci/collection', 'vinci/collection-rooms', 'vinci/collection-access',
])

export const shadowBodyProvenance = {
  manifestId: 'vinci/shadow-body',
  assetClass: 'GENERATED',
  certainty: 'reconstructed',
} as const

interface Source { mesh: Mesh; triangles: number }

export interface WingShadowBody {
  group: Group
  /** Re-weld when a source appears, hides or moves. Cheap when nothing did. */
  update(): void
  state(): { bodies: number; triangles: number; welds: number; skipped: string[] }
  dispose(): void
}

/** A caster three may not fold into a fixed buffer: its silhouette is not the
 * geometry the depth pass would draw, or it is drawn many times from one
 * geometry. Such a caster keeps casting for itself. */
function foldable(mesh: Mesh): boolean {
  const kind = mesh as Mesh & { isSkinnedMesh?: boolean; isInstancedMesh?: boolean; isBatchedMesh?: boolean }
  if (kind.isSkinnedMesh || kind.isInstancedMesh || kind.isBatchedMesh) return false
  if (mesh.morphTargetInfluences?.length) return false
  const position = mesh.geometry.getAttribute('position')
  if (!position) return false
  const count = mesh.geometry.getIndex()?.count ?? position.count
  if (count % 3 !== 0) return false
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    const node = material as unknown as Record<string, unknown>
    if (material.transparent || material.opacity !== 1 || material.alphaTest !== 0) return false
    if (material.alphaHash || material.alphaToCoverage) return false
    for (const key of ['positionNode', 'vertexNode', 'castShadowPositionNode', 'castShadowNode', 'alphaTestNode', 'opacityNode', 'alphaMap'])
      if (node[key] != null) return false
  }
  return true
}

export function createWingShadowBody(scene: Object3D): WingShadowBody {
  const folded = new Set<Mesh>()
  const skipped = new Set<string>()
  let signature = '', welds = 0, triangles = 0
  const material = new MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide })
  material.shadowSide = DoubleSide
  const mesh = new Mesh(new BufferGeometry(), material)
  mesh.name = 'vinci/shadow-body/static'
  mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.renderOrder = -1
  mesh.layers.set(SHADOW_ONLY_LAYER)
  mesh.userData = { manifestId: shadowBodyProvenance.manifestId, asset: shadowBodyProvenance.manifestId,
    assetClass: 'GENERATED', certainty: 'reconstructed', labelOccluder: false, naLabelOccluder: false }
  mesh.raycast = () => {}
  const group = new Group()
  group.name = 'vinci/shadow-body'
  group.userData = { manifestId: shadowBodyProvenance.manifestId, labelOccluder: false, naLabelOccluder: false }
  group.add(mesh)

  const vertex = new Vector3()

  function collect(): { sources: Source[]; signature: string } {
    const sources: Source[] = []
    const parts: string[] = []
    scene.updateMatrixWorld(true)
    scene.traverse(object => {
      if (object === mesh || !(object instanceof Mesh)) return
      const id = object.userData['manifestId']
      if (typeof id !== 'string' || !STATIC_BODIES.has(id)) return
      if (!(object.castShadow || folded.has(object))) return
      let visible = object.visible
      for (let parent = object.parent; parent && visible; parent = parent.parent) visible = parent.visible
      if (!visible) return
      if (!foldable(object)) { skipped.add(object.name || id); return }
      const position = object.geometry.getAttribute('position')
      const index = object.geometry.getIndex()
      const count = index?.count ?? position.count
      sources.push({ mesh: object, triangles: count / 3 })
      const m = object.matrixWorld.elements
      parts.push(`${object.name}|${count}|${position.version}|${index?.version ?? -1}|${m.map(value => value.toFixed(4)).join(',')}`)
    })
    return { sources, signature: parts.join(';') }
  }

  function weld(sources: Source[]): void {
    const positions: number[] = []
    const inverse = new Matrix4().copy(group.matrixWorld).invert()
    const transform = new Matrix4()
    for (const source of sources) {
      transform.multiplyMatrices(inverse, source.mesh.matrixWorld)
      const position = source.mesh.geometry.getAttribute('position')
      const index = source.mesh.geometry.getIndex()
      const count = index?.count ?? position.count
      for (let i = 0; i < count; i++) {
        vertex.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(transform)
        positions.push(vertex.x, vertex.y, vertex.z)
      }
      source.mesh.castShadow = false
      folded.add(source.mesh)
    }
    // A re-weld is a NEW buffer, never a longer one in the same geometry: the
    // backend binds the buffer it uploaded and the draw would run off its end.
    const next = new BufferGeometry()
    next.setAttribute('position', new Float32BufferAttribute(positions, 3))
    next.computeVertexNormals()
    next.computeBoundingBox(); next.computeBoundingSphere()
    const previous = mesh.geometry
    mesh.geometry = next
    previous.dispose()
    triangles = positions.length / 9
    welds++
    mesh.visible = triangles > 0
  }

  function update(): void {
    const { sources, signature: next } = collect()
    if (next === signature && welds > 0) return
    signature = next
    weld(sources)
  }

  update()
  return {
    group, update,
    state: () => ({ bodies: signature ? signature.split(';').length : 0, triangles, welds, skipped: [...skipped] }),
    dispose() { mesh.geometry.dispose(); material.dispose(); folded.clear() },
  }
}
