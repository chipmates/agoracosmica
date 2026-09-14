import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three/webgpu'

/** Give the dossier's cylindrical, hemispherical glass bell its nominal wall.
 *
 * The supplied outer positions stay byte-for-byte unchanged. Only the inside
 * is offset, by `thickness` metres along the bell's analytical smooth normal.
 * This is the existing numerical bell, not a different interpretation of it.
 * Its duplicated crown samples are welded in the index, eliminating the
 * zero-area triangles and inconsistent pole normals in the source topology.
 * The open bottom receives an annular rim, with its own downward normals.
 *
 * The caller retains ownership of `outer` and owns the returned geometry.
 * Intended for wind-shield before any part/world transforms are baked in.
 */
export function createGlassCoverShell(outer: BufferGeometry, thickness: number): BufferGeometry {
  const source = outer.getAttribute('position')
  if (!source || source.itemSize !== 3 || source.count < 3) throw new Error('Glass cover needs an outer surface')
  if (!Number.isFinite(thickness) || thickness <= 0) throw new Error('Glass thickness must be positive metres')

  const count = source.count
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity
  for (let i = 0; i < count; i++) {
    const x = source.getX(i), y = source.getY(i), z = source.getZ(i)
    if (![x, y, z].every(Number.isFinite)) throw new Error('Glass cover has a nonfinite position')
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
  }
  const centreX = (minX + maxX) / 2, centreZ = (minZ + maxZ) / 2
  const radius = Math.max(maxX - minX, maxZ - minZ) / 2
  if (!(thickness < radius && maxY - minY > radius)) throw new Error('Glass cover must be an upright bell with an open skirt')
  const shoulderY = maxY - radius
  const tolerance = radius * 1e-6
  const position: number[] = [], normal: number[] = [], uv: number[] = []
  const smooth = new Vector3()

  // Every original vertex is retained, including unused coincident poles.
  // One continuous metric projection avoids the dominant-axis UV boundaries
  // that appeared as vertical lines in the nearly transparent glass.
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < count; i++) {
      const x = source.getX(i), y = source.getY(i), z = source.getZ(i)
      const dx = x - centreX, dz = z - centreZ
      const radial = Math.hypot(dx, dz)
      if (radial < tolerance && Math.abs(y - maxY) < tolerance) smooth.set(0, 1, 0)
      else smooth.set(dx, Math.max(0, y - shoulderY), dz).normalize()
      // The locked cover is a hemisphere over a cylinder. Reject a different
      // profile instead of silently imposing that model on arbitrary glass.
      const measured = y > shoulderY ? Math.hypot(radial, y - shoulderY) : radial
      if (Math.abs(measured - radius) > tolerance) throw new Error('Glass cover differs from the dossier bell profile')
      const offset = layer * thickness, sign = layer === 0 ? 1 : -1
      position.push(x - smooth.x * offset, y - smooth.y * offset, z - smooth.z * offset)
      normal.push(sign * smooth.x, sign * smooth.y, sign * smooth.z)
      uv.push(dx + .371 * dz, y - minY + .233 * dz)
    }
  }

  const representative = new Map<string, number>(), canonical: number[] = []
  const bottom: number[] = []
  for (let i = 0; i < count; i++) {
    const key = [source.getX(i), source.getY(i), source.getZ(i)]
      .map(value => Math.round(value / tolerance)).join(':')
    const first = representative.get(key)
    if (first === undefined) {
      representative.set(key, i)
      canonical.push(i)
      if (Math.abs(source.getY(i) - minY) < tolerance) bottom.push(i)
    } else canonical.push(first)
  }
  if (bottom.length < 3) throw new Error('Glass cover has no open bottom ring')

  const indices: number[] = []
  const sourceIndex = outer.getIndex()
  const indexCount = sourceIndex?.count ?? count
  if (indexCount % 3 !== 0) throw new Error('Glass cover needs triangular faces')
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  const edge = new Vector3(), faceNormal = new Vector3(), outward = new Vector3()
  const surfaceIndex: number[] = []
  for (let i = 0; i < indexCount; i += 3) {
    let ia = canonical[sourceIndex ? sourceIndex.getX(i) : i]!
    let ib = canonical[sourceIndex ? sourceIndex.getX(i + 1) : i + 1]!
    let ic = canonical[sourceIndex ? sourceIndex.getX(i + 2) : i + 2]!
    if (ia === ib || ib === ic || ic === ia) continue
    a.fromBufferAttribute(source, ia); b.fromBufferAttribute(source, ib); c.fromBufferAttribute(source, ic)
    faceNormal.subVectors(b, a).cross(edge.subVectors(c, a))
    if (faceNormal.lengthSq() < tolerance ** 4) continue
    outward.set(normal[ia * 3]! + normal[ib * 3]! + normal[ic * 3]!,
      normal[ia * 3 + 1]! + normal[ib * 3 + 1]! + normal[ic * 3 + 1]!,
      normal[ia * 3 + 2]! + normal[ib * 3 + 2]! + normal[ic * 3 + 2]!)
    if (faceNormal.dot(outward) < 0) [ib, ic] = [ic, ib]
    surfaceIndex.push(ia, ib, ic)
  }
  indices.push(...surfaceIndex)
  for (let i = 0; i < surfaceIndex.length; i += 3) {
    indices.push(surfaceIndex[i]! + count, surfaceIndex[i + 2]! + count, surfaceIndex[i + 1]! + count)
  }

  bottom.sort((i, j) => Math.atan2(source.getZ(i) - centreZ, source.getX(i) - centreX)
    - Math.atan2(source.getZ(j) - centreZ, source.getX(j) - centreX))
  const rimStart = position.length / 3
  for (const index of bottom) {
    for (const vertex of [index, index + count]) {
      const x = position[vertex * 3]!, y = position[vertex * 3 + 1]!, z = position[vertex * 3 + 2]!
      position.push(x, y, z)
      normal.push(0, -1, 0)
      uv.push(x - centreX, z - centreZ)
    }
  }
  for (let i = 0; i < bottom.length; i++) {
    const current = rimStart + i * 2, next = rimStart + ((i + 1) % bottom.length) * 2
    indices.push(current, next, current + 1, next, next + 1, current + 1)
  }

  const shell = new BufferGeometry()
  shell.setAttribute('position', new Float32BufferAttribute(position, 3))
  shell.setAttribute('normal', new Float32BufferAttribute(normal, 3))
  shell.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  shell.setIndex(indices)
  shell.name = `${outer.name}:glass-shell`
  shell.userData = { ...outer.userData, nominalThicknessM: thickness, outerSurfacePreserved: true }
  shell.computeBoundingBox()
  shell.computeBoundingSphere()
  return shell
}
