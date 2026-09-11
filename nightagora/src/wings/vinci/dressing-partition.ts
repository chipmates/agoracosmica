import { BufferAttribute, BufferGeometry, Mesh } from 'three/webgpu'

/** Partition only submission units. Every original triangle and attribute is
 * copied exactly once; no level of detail, density, visibility or shadow rule
 * changes. Native per-pass frustum culling can then reject distant clusters.
 */
export function partitionDressing(source: Mesh, depth = 4, extraLeaves = 0): Mesh[] {
  if (!Number.isInteger(depth) || depth < 0 || depth > 4) throw new Error('Dressing partition depth must be 0–4')
  if (!Number.isInteger(extraLeaves) || extraLeaves < 0 || extraLeaves > 8) throw new Error('Dressing extra leaves must be 0–8')
  const geometry = source.geometry, position = geometry.getAttribute('position')
  if (geometry.index || position.count % 3 !== 0 || geometry.groups.length || geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity || Object.values(geometry.morphAttributes).some(a => a?.length)) throw new Error('Dressing needs complete non-indexed triangles without groups or morphs')
  if (position.count === 0 || depth === 0) return [source]
  const count = position.count / 3
  const centres = new Float64Array(count * 2)
  for (let i = 0; i < count; i++) {
    centres[i * 2] = (position.getX(i * 3) + position.getX(i * 3 + 1) + position.getX(i * 3 + 2)) / 3
    centres[i * 2 + 1] = (position.getZ(i * 3) + position.getZ(i * 3 + 1) + position.getZ(i * 3 + 2)) / 3
  }

  function split(ids: number[], depth: number): number[][] {
    if (depth === 0 || ids.length < 2) return [ids]
    let bestCost = Infinity, bestAxis = 0, bestAt = Math.floor(ids.length / 2)
    for (let axis = 0; axis < 2; axis++) {
      ids.sort((a, b) => centres[a * 2 + axis]! - centres[b * 2 + axis]! || a - b)
      const boxes: number[][] = [], lower = [Infinity, Infinity, Infinity], upper = [-Infinity, -Infinity, -Infinity]
      for (let i = ids.length - 1; i >= 0; i--) {
        const id = ids[i]!
        for (let v = 0; v < 3; v++) for (let a = 0; a < 3; a++) {
          const value = position.array[id * 9 + v * 3 + a]!
          lower[a] = Math.min(lower[a]!, value); upper[a] = Math.max(upper[a]!, value)
        }
        boxes[i] = [...lower, ...upper]
      }
      lower.fill(Infinity); upper.fill(-Infinity)
      const minSide = Math.max(1, Math.floor(ids.length * .1))
      for (let i = 0; i < ids.length - 1; i++) {
        const id = ids[i]!
        for (let v = 0; v < 3; v++) for (let a = 0; a < 3; a++) {
          const value = position.array[id * 9 + v * 3 + a]!
          lower[a] = Math.min(lower[a]!, value); upper[a] = Math.max(upper[a]!, value)
        }
        const n = i + 1
        if (n < minSide || ids.length - n < minSide) continue
        const next = boxes[n]!, size0 = upper.map((u, a) => u - lower[a]!), size1 = next.slice(3).map((u, a) => u - next[a]!)
        const measure = (s: number[]) => s[0]! * s[0]! + s[1]! * s[1]! + s[2]! * s[2]!
        const cost = n * measure(size0) + (ids.length - n) * measure(size1)
        if (cost < bestCost) { bestCost = cost; bestAxis = axis; bestAt = n }
      }
    }
    ids.sort((a, b) => centres[a * 2 + bestAxis]! - centres[b * 2 + bestAxis]! || a - b)
    return [...split(ids.slice(0, bestAt), depth - 1), ...split(ids.slice(bestAt), depth - 1)]
  }
  const partitions = split(Array.from({ length: count }, (_, i) => i), depth)
  const meshes = partitions.map((ids, leaf) => {
    const part = new BufferGeometry()
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      if (!(attribute instanceof BufferAttribute) || !(attribute.array instanceof Float32Array)) throw new Error(`Unexpected dressing attribute: ${name}`)
      const stride = attribute.itemSize * 3, values = new Float32Array(ids.length * stride)
      ids.forEach((triangle, index) => values.set(attribute.array.subarray(triangle * stride, (triangle + 1) * stride), index * stride))
      const copy = new BufferAttribute(values, attribute.itemSize, attribute.normalized)
      copy.name = attribute.name; copy.setUsage(attribute.usage); copy.gpuType = attribute.gpuType
      part.setAttribute(name, copy)
    }
    part.name = geometry.name
    part.computeBoundingSphere()
    const mesh = new Mesh(part, source.material).copy(source, false)
    mesh.geometry = part
    mesh.name = `${source.name} cluster ${String(leaf + 1).padStart(2, '0')}`
    mesh.userData = { ...source.userData, spatialPartition: { leaf, leaves: partitions.length, triangles: ids.length } }
    return mesh
  })
  // Spend the fixed extra submission budget on the broadest dense cluster.
  // This depends only on actual world geometry, never on the current camera.
  for (let extra = 0; extra < extraLeaves; extra++) {
    let selected = 0, largest = -Infinity
    meshes.forEach((mesh, i) => {
      const sphere = mesh.geometry.boundingSphere!
      const score = sphere.radius * sphere.radius * mesh.geometry.getAttribute('position').count
      if (score > largest) { largest = score; selected = i }
    })
    const sourcePart = meshes[selected]!
    meshes.splice(selected, 1)
    meshes.push(...partitionDressing(sourcePart, 1))
  }
  meshes.forEach((mesh, leaf) => {
    mesh.name = `${source.name} cluster ${String(leaf + 1).padStart(2, '0')}`
    mesh.userData = { ...source.userData, spatialPartition: { leaf, leaves: meshes.length, triangles: mesh.geometry.getAttribute('position').count / 3 } }
  })
  geometry.dispose()
  return meshes
}

/** Preserve the existing ground factory API. */
export const partitionGroundDressing = partitionDressing
