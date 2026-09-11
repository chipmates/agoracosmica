// Bench-only receiver experiment. The host selects the accepted/default policy.
import { Group, Mesh, MeshStandardNodeMaterial, type Object3D, type Vector3 } from 'three/webgpu'
import { positionWorld, vec3 } from 'three/tsl'

export type RopeShadowSlug = 'lathe' | 'revolving-crane' | 'parachute'
export type RopeShadowExperiment = 'baseline' | 'no-shadow' | 'flat-normal' | 'offset-2mm'

const targetIds: Record<RopeShadowSlug, readonly string[]> = {
  lathe: ['drive-rope'],
  'revolving-crane': ['hoist-rope', 'drum-wrap'],
  parachute: ['suspension-0', 'suspension-1', 'suspension-2', 'suspension-3'],
}

/** Apply after machine.ready. The caller must restore before another experiment
 * or a key-direction change. This allocates no geometry, maps or materials. */
export function applyRopeShadowExperiment(
  object: Object3D,
  slug: RopeShadowSlug,
  experiment: RopeShadowExperiment,
  towardKey: Vector3,
): { partIds: readonly string[]; meshCount: number; materialCount: number; restore(): void } {
  const expected = targetIds[slug]
  const meshes: Mesh[] = [], targets: Mesh[] = []
  object.traverse(node => {
    if (!(node instanceof Mesh)) return
    meshes.push(node)
    if (expected.includes(String(node.userData['partId']))) targets.push(node)
  })
  const originalIdsMatch = targets.length === expected.length && !expected.some(id =>
    targets.filter(mesh => mesh.userData['partId'] === id).length !== 1,
  )
  // The parachute's four static suspension ropes weld into one rope-only
  // surface. Their empty source groups remain under the dossier root. The
  // exact material name retains the original class and library family, while
  // the frame and leather harness use different materials. Do not select all
  // rigid-surfaces meshes: the frame's welded mesh has the same mesh name.
  if (slug === 'parachute' && targets.length === 0) {
    const roots: Group[] = []
    object.traverse(node => {
      if (node instanceof Group && node.name === slug && node.userData['dossier'] === slug) roots.push(node)
    })
    const root = roots.length === 1 ? roots[0] : undefined
    const groupsMatch = root && expected.every(id => {
      const groups = root.children.filter(node => node instanceof Group && node.name === id)
      return groups.length === 1 && groups[0]!.children.length === 0
    })
    const batches = root?.children.filter((node): node is Mesh =>
      node instanceof Mesh && node.name === 'parachute:rigid-surfaces' &&
      !Array.isArray(node.material) && node.material.name === 'parachute:hemp rope:rope',
    ) ?? []
    if (!groupsMatch || batches.length !== 1) throw new Error('Could not identify the four welded parachute suspensions')
    targets.push(batches[0]!)
  } else if (!originalIdsMatch) {
    // The moving lathe/crane ropes, and every noweld rope, retain exact IDs.
    throw new Error(`Rope experiment could not identify the original ${slug} ropes`)
  }

  const materials = new Set<MeshStandardNodeMaterial>()
  for (const mesh of targets) {
    if (Array.isArray(mesh.material) || !(mesh.material instanceof MeshStandardNodeMaterial) ||
      mesh.material.name.split(':').at(-1) !== 'rope') {
      throw new Error(`Unexpected rope material on ${mesh.name}`)
    }
    materials.add(mesh.material)
  }
  // Ropes share a surface; do not clone it or modify any non-rope user.
  for (const mesh of meshes) {
    if (targets.includes(mesh)) continue
    const used = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (used.some(material => material instanceof MeshStandardNodeMaterial && materials.has(material))) {
      throw new Error(`Rope material is also used by non-rope mesh ${mesh.name}`)
    }
  }
  const originalMeshes = targets.map(mesh => ({ mesh, receiveShadow: mesh.receiveShadow }))
  const originalMaterials = [...materials].map(material => ({
    material,
    normalNode: material.normalNode,
    receivedShadowPositionNode: material.receivedShadowPositionNode,
  }))
  if (experiment === 'offset-2mm' && (!Number.isFinite(towardKey.lengthSq()) || towardKey.lengthSq() === 0)) {
    throw new Error('A finite direction toward the key is required')
  }
  if (experiment === 'no-shadow') for (const mesh of targets) mesh.receiveShadow = false
  if (experiment === 'flat-normal') for (const material of materials) {
    material.normalNode = null
    material.needsUpdate = true
  }
  if (experiment === 'offset-2mm') {
    const direction = towardKey.clone().normalize().multiplyScalar(.002)
    const lookup = positionWorld.add(vec3(direction.x, direction.y, direction.z))
    for (const material of materials) {
      material.receivedShadowPositionNode = lookup
      material.needsUpdate = true
    }
  }
  let restored = false
  return {
    partIds: [...expected],
    meshCount: targets.length,
    materialCount: materials.size,
    restore() {
      if (restored) return
      restored = true
      for (const { mesh, receiveShadow } of originalMeshes) mesh.receiveShadow = receiveShadow
      for (const { material, normalNode, receivedShadowPositionNode } of originalMaterials) {
        if (material.normalNode === normalNode && material.receivedShadowPositionNode === receivedShadowPositionNode) continue
        material.normalNode = normalNode
        material.receivedShadowPositionNode = receivedShadowPositionNode
        material.needsUpdate = true
      }
    },
  }
}
