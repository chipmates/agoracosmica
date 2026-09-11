import {
  BoxGeometry, BufferGeometry, CylinderGeometry, DynamicDrawUsage, ExtrudeGeometry, Float32BufferAttribute,
  LatheGeometry, Matrix4, Path, Shape, SphereGeometry, TorusGeometry, Vector2, Vector3,
} from 'three/webgpu'
import type { TierName } from '../../../stack'
import type { Coordinates, PartSpec } from './types'

const TAU = Math.PI * 2
const at = (p: readonly number[], n: number): number => p[n] ?? 0
const vector = (p: readonly number[]): Vector3 => new Vector3(at(p, 0), at(p, 1), at(p, 2))
const required = (n: number | undefined, field: string): number => {
  if (n === undefined || !Number.isFinite(n)) throw new Error(`Dossier geometry missing ${field}`)
  return n
}
const count = (tier: TierName, hero: number, standard: number, calm: number): number =>
  tier === 'hero' ? hero : tier === 'standard' ? standard : calm

/** A mutable sweep retains every dossier node, its buffers, and its topology.
 * Fixed subdivisions lie on the exact straight spans and never interpolate
 * around a corner. Changing cable payout cannot replace a GPU buffer or index.
 * The three-lobed rope section remains inside the prescribed maximum radius.
 */
export interface MutableSweep {
  geometry: BufferGeometry
  update: (points: Coordinates) => void
}

export function createMutableSweep(
  initial: Coordinates, radius: number, rope = false, tier: TierName = 'standard', innerRadius = 0,
): MutableSweep {
  if (initial.length < 2) throw new Error('A swept part needs two centreline nodes')
  const sourceCount = initial.length
  const total = initial.slice(1).reduce((sum, point, i) => sum + vector(point).distanceTo(vector(initial[i]!)), 0)
  const maxSections = count(tier, 750, 400, 200)
  const step = rope ? Math.max(radius * 2.5, total / maxSections) : Infinity
  const subdivisions = initial.slice(1).map((point, i) =>
    Math.max(1, Math.ceil(vector(point).distanceTo(vector(initial[i]!)) / step)))
  const rings = 1 + subdivisions.reduce((sum, n) => sum + n, 0)
  // Millimetre threads retain all 3,201 dossier nodes. Their circular section
  // is smaller than a pixel at the bench and needs fewer radial samples.
  const sides = rope ? count(tier, 18, 12, 9) : radius <= 0.002 ? count(tier, 12, 8, 6) : count(tier, 24, 16, 12)
  const stride = sides + 1, wallVertices = rings * stride
  const hollow = innerRadius > 0
  const vertices = wallVertices * (hollow ? 2 : 1) + (hollow ? 0 : 2)
  const position = new Float32BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(DynamicDrawUsage)
  const texcoord = new Float32BufferAttribute(new Float32Array(vertices * 2), 2).setUsage(DynamicDrawUsage)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', position)
  geometry.setAttribute('uv', texcoord)
  geometry.setAttribute('normal', new Float32BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(DynamicDrawUsage))
  const indices: number[] = []
  const addWall = (offset: number, inward: boolean): void => {
    for (let i = 0; i < rings - 1; i++) {
      for (let j = 0; j < sides; j++) {
        const a = offset + i * stride + j, c = a + stride
        if (inward) indices.push(a, c, a + 1, a + 1, c, c + 1)
        else indices.push(a, a + 1, c, a + 1, c + 1, c)
      }
    }
  }
  addWall(0, false)
  if (hollow) addWall(wallVertices, true)
  for (const end of [0, rings - 1]) {
    const start = end * stride
    for (let j = 0; j < sides; j++) {
      if (hollow) {
        const a = start + j, b = wallVertices + start + j
        if (end === 0) indices.push(a, b, a + 1, a + 1, b, b + 1)
        else indices.push(a, a + 1, b, a + 1, b + 1, b)
      } else {
        const centre = wallVertices + (end === 0 ? 0 : 1)
        if (end === 0) indices.push(centre, start + j + 1, start + j)
        else indices.push(centre, start + j, start + j + 1)
      }
    }
  }
  geometry.setIndex(indices)
  const nodes = Array.from({length: rings}, () => new Vector3())
  const tangents = Array.from({length: rings}, () => new Vector3())
  const normal = new Vector3(), binormal = new Vector3()
  const cosine = new Float64Array(stride), sine = new Float64Array(stride)
  for (let j = 0; j <= sides; j++) {
    cosine[j] = Math.cos(TAU * j / sides)
    sine[j] = Math.sin(TAU * j / sides)
  }
  const update = (points: Coordinates): void => {
    if (points.length !== sourceCount) throw new Error('A moving sweep must preserve its dossier node count')
    nodes[0]!.fromArray(points[0]!)
    let index = 1
    for (let i = 1; i < sourceCount; i++) {
      const a = points[i - 1]!, b = points[i]!, sections = subdivisions[i - 1]!
      for (let j = 1; j <= sections; j++) {
        const f = j / sections
        nodes[index++]!.set(
          at(a, 0) + (at(b, 0) - at(a, 0)) * f,
          at(a, 1) + (at(b, 1) - at(a, 1)) * f,
          at(a, 2) + (at(b, 2) - at(a, 2)) * f,
        )
      }
    }
    for (let i = 0; i < rings; i++) {
      tangents[i]!.subVectors(nodes[Math.min(rings - 1, i + 1)]!, nodes[Math.max(0, i - 1)]!).normalize()
    }
    normal.set(0, 1, 0)
    if (Math.abs(normal.dot(tangents[0]!)) > 0.9) normal.set(1, 0, 0)
    normal.addScaledVector(tangents[0]!, -normal.dot(tangents[0]!)).normalize()
    let length = 0
    for (let i = 0; i < rings; i++) {
      const p = nodes[i]!, tangent = tangents[i]!
      normal.addScaledVector(tangent, -normal.dot(tangent)).normalize()
      binormal.crossVectors(tangent, normal).normalize()
      if (i > 0) length += p.distanceTo(nodes[i - 1]!)
      for (let j = 0; j <= sides; j++) {
        const angle = TAU * j / sides
        const relief = rope ? 0.84 + 0.16 * Math.cos(3 * (angle - TAU * length / (radius * 14))) : 1
        const dx = normal.x * cosine[j]! + binormal.x * sine[j]!
        const dy = normal.y * cosine[j]! + binormal.y * sine[j]!
        const dz = normal.z * cosine[j]! + binormal.z * sine[j]!
        const v = i * stride + j
        const r = radius * relief
        position.setXYZ(v, p.x + dx * r, p.y + dy * r, p.z + dz * r)
        texcoord.setXY(v, j / sides * TAU * radius, length)
        if (hollow) {
          const r = innerRadius * relief
          position.setXYZ(wallVertices + v, p.x + dx * r, p.y + dy * r, p.z + dz * r)
          texcoord.setXY(wallVertices + v, j / sides * TAU * innerRadius, length)
        }
      }
    }
    if (!hollow) {
      const first = nodes[0]!, last = nodes[rings - 1]!
      position.setXYZ(wallVertices, first.x, first.y, first.z)
      position.setXYZ(wallVertices + 1, last.x, last.y, last.z)
      texcoord.setXY(wallVertices, 0, 0)
      texcoord.setXY(wallVertices + 1, 0, length)
    }
    position.needsUpdate = true
    texcoord.needsUpdate = true
    geometry.computeVertexNormals()
    // Frustum and explicit bounds checks will recompute only when needed.
    geometry.boundingBox = null
    geometry.boundingSphere = null
  }
  update(initial)
  return {geometry, update}
}

/** A static sweep uses the same exact surface construction as a moving one. */
export function sweptProfile(
  points: Coordinates, radius: number, rope = false, tier: TierName = 'standard', innerRadius = 0,
): BufferGeometry {
  return createMutableSweep(points, radius, rope, tier, innerRadius).geometry
}

function polygon(values: Coordinates): Vector2[] {
  const result: Vector2[] = []
  for (const p of values) {
    const v = new Vector2(at(p, 0), at(p, 1))
    // Consecutive duplicate samples in the 60-tooth dossier are intentional
    // zero-length flank starts. Remove only duplicates, retaining every flank.
    if (!result.length || !v.equals(result[result.length - 1]!)) result.push(v)
  }
  return result
}

function extrudeProfile(part: PartSpec, tier: TierName): BufferGeometry {
  const d = part.dimensions_m, s = typeof part.shape === 'string' ? undefined : part.shape
  if (d.profile && d.extrusion_length !== undefined) {
    const geometry = new CylinderGeometry(required(d.radius, 'radius'), required(d.radius, 'radius'), d.extrusion_length, count(tier, 64, 48, 32))
    metricCylinderUV(geometry, d.radius!, d.extrusion_length)
    return geometry.rotateZ(-Math.PI / 2)
  }
  const plane = s?.plane ?? d.plane ?? (d.coordinates_xz ? 'XZ' : 'YZ')
  const outer = s?.vertices_m ?? d.coordinates_xz ?? d.coordinates_yz ?? d.outer_vertices_yz
  if (!outer) throw new Error(`Missing profile ${part.id}`)
  const points = polygon(outer)
  // XY -> XZ uses (x,-z) then rotation -pi/2 around X. The two
  // operations together preserve winding and positive extrusion along Y.
  if (plane === 'XZ') points.forEach(p => { p.y *= -1 })
  const shape = new Shape(points)
  const holes = d.holes_xz ?? d.holes_yz ?? (d.hole_vertices_yz ? [d.hole_vertices_yz] : [])
  for (const hole of holes) {
    const vertices = polygon(hole)
    if (plane === 'XZ') vertices.forEach(p => { p.y *= -1 })
    shape.holes.push(new Path(vertices))
  }
  const depth = s?.extrude_depth_m ?? d.extrusion_depth ?? ((d.extrusion_max ?? 0) - (d.extrusion_min ?? 0))
  if (!(depth > 0)) throw new Error(`Missing extrusion depth ${part.id}`)
  const geometry = new ExtrudeGeometry(shape, {depth, bevelEnabled: false, steps: 1, curveSegments: count(tier, 32, 24, 16)})
  // Compass XY profiles use a centred sheet interpretation, matching their
  // documented part offsets. Every other extrusion gives its min or centre.
  geometry.translate(0, 0, d.extrusion_min ?? -depth / 2)
  if (plane === 'XZ') geometry.rotateX(-Math.PI / 2)
  else if (plane === 'YZ') geometry.applyMatrix4(new Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1))
  metricPlanarUV(geometry, /wood|oak|ash|cane/.test(part.material.class))
  return geometry
}

function exactMesh(part: PartSpec): BufferGeometry {
  const s = typeof part.shape === 'string' ? undefined : part.shape
  const vertices = s?.vertices_m ?? part.dimensions_m.vertices
  const faces = s?.faces ?? part.dimensions_m.faces
  if (!vertices || !faces) throw new Error(`Missing mesh ${part.id}`)
  const positions = vertices.flatMap(p => [at(p, 0), at(p, 1), at(p, 2)])
  const indices = faces.flatMap(f => [at(f, 0), at(f, 1), at(f, 2)])
  if (s?.thickness_m) {
    const direction = vector(s.extrude_direction ?? [0, 0, 1]).multiplyScalar(s.thickness_m)
    const count = vertices.length
    for (const p of vertices) positions.push(at(p, 0) + direction.x, at(p, 1) + direction.y, at(p, 2) + direction.z)
    const boundaries = new Map<string, {a: number; b: number; count: number}>()
    for (const face of faces) {
      const a = at(face, 0), b = at(face, 1), c = at(face, 2)
      indices.push(c + count, b + count, a + count)
      for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        const key = `${Math.min(u!, v!)}:${Math.max(u!, v!)}`
        const edge = boundaries.get(key)
        if (edge) edge.count++
        else boundaries.set(key, {a: u!, b: v!, count: 1})
      }
    }
    for (const {a, b, count: occurrences} of boundaries.values()) {
      if (occurrences === 1) indices.push(a, a + count, b, b, a + count, b + count)
    }
  }
  let geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  // Four individually flat pyramid faces meet at real seams. A helical
  // linen mesh instead retains its smooth indexed normals along each turn.
  if (faces.length <= 10) geometry = geometry.toNonIndexed()
  geometry.computeVertexNormals()
  metricPlanarUV(geometry, /wood|oak|ash|cane/.test(part.material.class))
  return geometry
}

/** UVs are metres so the library's grain cannot swell with the machine. */
function metricPlanarUV(geometry: BufferGeometry, alongMember = false): void {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal')
  geometry.computeBoundingBox()
  const size = geometry.boundingBox!.getSize(new Vector3())
  const sizes = [size.x, size.y, size.z]
  const uv: number[] = []
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n?.getX(i) ?? 0), ny = Math.abs(n?.getY(i) ?? 1), nz = Math.abs(n?.getZ(i) ?? 0)
    let a: number, b: number
    if (nx >= ny && nx >= nz) { a = 2; b = 1 }
    else if (ny >= nz) { a = 0; b = 2 }
    else { a = 0; b = 1 }
    // The oak library's long grain runs along V. Each face gives that run
    // to its longest member axis, so a horizontal rail is not cross-grained.
    if (alongMember && sizes[a]! > sizes[b]!) [a, b] = [b, a]
    const coordinates = [p.getX(i), p.getY(i), p.getZ(i)]
    uv.push(coordinates[a]!, coordinates[b]!)
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
}

function metricCylinderUV(geometry: BufferGeometry, radius: number, height: number): void {
  const uv = geometry.getAttribute('uv'), p = geometry.getAttribute('position'), n = geometry.getAttribute('normal')
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, p.getX(i), p.getZ(i))
    else uv.setXY(i, uv.getX(i) * TAU * radius, uv.getY(i) * height)
  }
}

export function geometryForPart(part: PartSpec, tier: TierName = 'standard'): BufferGeometry {
  const d = part.dimensions_m, s = typeof part.shape === 'string' ? undefined : part.shape
  const kind = s?.type ?? part.shape
  let geometry: BufferGeometry
  switch (kind) {
    case 'box':
      geometry = new BoxGeometry(required(d.x, 'x'), required(d.y, 'y'), required(d.z, 'z'))
      metricPlanarUV(geometry, /wood|oak|ash|cane/.test(part.material.class))
      break
    case 'cylinder': case 'cone': {
      const radius = d.radius ?? required(d.radius_bottom, 'radius_bottom'), height = required(d.height, 'height')
      geometry = new CylinderGeometry(d.radius_top ?? radius, radius, height, count(tier, 64, 48, 32))
      metricCylinderUV(geometry, radius, height)
      break
    }
    case 'sphere': {
      const radius = required(d.radius, 'radius')
      geometry = new SphereGeometry(radius, count(tier, 48, 32, 24), count(tier, 32, 20, 16))
      const uv = geometry.getAttribute('uv')
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * TAU * radius, uv.getY(i) * Math.PI * radius)
      break
    }
    case 'torus':
      geometry = new TorusGeometry(required(d.major_radius, 'major_radius'), required(d.tube_radius, 'tube_radius'), count(tier, 16, 12, 8), count(tier, 64, 48, 32))
      if (d.plane === 'XZ') geometry.rotateX(Math.PI / 2)
      else if (d.plane === 'YZ') geometry.rotateY(Math.PI / 2)
      metricPlanarUV(geometry)
      break
    case 'profile of revolution': {
      if (!d.closed_axial_radial_profile) throw new Error(`Missing revolution ${part.id}`)
      const points = d.closed_axial_radial_profile.map(p => new Vector2(at(p, 1), at(p, 0)))
      points.push(points[0]!.clone())
      geometry = new LatheGeometry(points, d.segments ?? count(tier, 96, 64, 48))
      metricCylinderUV(geometry, Math.max(...points.map(p => p.x)), Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)))
      break
    }
    case 'profile': geometry = extrudeProfile(part, tier); break
    case 'mesh': geometry = exactMesh(part); break
    case 'tube': {
      const points = s?.centreline_m ?? d.centreline
      if (!points) throw new Error(`Missing centreline ${part.id}`)
      const radius = s?.outer_radius_m ?? s?.radius_m ?? d.outer_radius ?? required(d.radius, 'radius')
      geometry = sweptProfile(points, radius, /rope|hemp|thread/.test(part.material.class), tier, s?.inner_radius_m ?? d.inner_radius ?? 0)
      break
    }
    default: throw new Error(`Unsupported numerical dossier shape: ${String(kind)} (${part.id})`)
  }
  geometry.clearGroups()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.name = `${part.id}:dossier-surface`
  return geometry
}
