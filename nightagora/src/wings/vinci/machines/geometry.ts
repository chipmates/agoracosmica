import {
  BoxGeometry, BufferGeometry, CylinderGeometry, DynamicDrawUsage, ExtrudeGeometry, Float32BufferAttribute,
  Matrix4, Path, Shape, SphereGeometry, TorusGeometry, Vector2, Vector3,
} from 'three/webgpu'
import type { TierName } from '../../../stack'
import type { Coordinates, PartSpec } from './types'
import { createGlassCoverShell } from './glass-cover'

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
  metricPlanarUV(geometry, /wood|oak|ash|cane/.test(part.material.class), endGrainClass(part.material.class))
  return geometry
}

/** THE SAIL IS A SAMPLED HELICOID, NOT A SET OF PLATES. The dossier gives the
 * linen as a grid of points on one helical surface, ordered along the spiral.
 * Read in cylindrical coordinates with the turn unwrapped along that order,
 * the surface has a parameter pair a cloth really has: out from the mast, and
 * along the spiral. Two things follow, and both of them are the fan of fine
 * lines the frame showed at a grazing angle. The map: a per-vertex projection
 * onto whichever plane a vertex most faces switches plane in the middle of a
 * triangle, and the map's own derivative then beats against the pixel grid.
 * The mesh: between two samples the true surface turns, and the chord does
 * not. A midpoint taken in these coordinates sits exactly on the same
 * helicoid at the same radius and the same pitch, so no dimension moves.
 */
interface Helicoid { points: number[][]; radius: number[]; turn: number[]; faces: number[][] }
function readHelicoid(vertices: Coordinates, faces: Coordinates): Helicoid {
  const points: number[][] = [], radius: number[] = [], turn: number[] = []
  let previous = 0
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]!
    const x = at(v, 0), y = at(v, 1), z = at(v, 2)
    let angle = Math.atan2(x, z)
    while (angle - previous > Math.PI) angle -= TAU
    while (previous - angle > Math.PI) angle += TAU
    previous = angle
    points.push([x, y, z])
    radius.push(Math.hypot(x, z))
    turn.push(angle)
  }
  return {points, radius, turn, faces: faces.map(f => [at(f, 0), at(f, 1), at(f, 2)])}
}
function densifyOnHelicoid(surface: Helicoid, levels: number): Helicoid {
  const {points, radius, turn} = surface
  let triangles = surface.faces
  for (let level = 0; level < levels; level++) {
    const middles = new Map<string, number>()
    const middle = (a: number, b: number): number => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`
      const known = middles.get(key)
      if (known !== undefined) return known
      const r = (radius[a]! + radius[b]!) / 2, angle = (turn[a]! + turn[b]!) / 2
      const index = points.length
      points.push([r * Math.sin(angle), (points[a]![1]! + points[b]![1]!) / 2, r * Math.cos(angle)])
      radius.push(r); turn.push(angle)
      middles.set(key, index)
      return index
    }
    const split: number[][] = []
    for (const [a, b, c] of triangles) {
      const ab = middle(a!, b!), bc = middle(b!, c!), ca = middle(c!, a!)
      split.push([a!, ab, ca], [ab, b!, bc], [ca, bc, c!], [ab, bc, ca])
    }
    triangles = split
  }
  return {points, radius, turn, faces: triangles}
}

function exactMesh(part: PartSpec, helical = false, tier: TierName = 'standard'): BufferGeometry {
  const s = typeof part.shape === 'string' ? undefined : part.shape
  let vertices = s?.vertices_m ?? part.dimensions_m.vertices
  let faces = s?.faces ?? part.dimensions_m.faces
  if (!vertices || !faces) throw new Error(`Missing mesh ${part.id}`)
  let surface: Helicoid | null = null
  if (helical) {
    surface = densifyOnHelicoid(readHelicoid(vertices, faces), count(tier, 2, 1, 0))
    vertices = surface.points
    faces = surface.faces
  }
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
  if (surface) {
    // Out from the mast, and along the spiral: both in metres, both continuous
    // over the whole cloth, so the weave runs the way a cut sail's does.
    const uv: number[] = []
    for (let i = 0; i < surface.points.length; i++) uv.push(surface.radius[i]!, surface.radius[i]! * surface.turn[i]!)
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  }
  else metricPlanarUV(geometry, /wood|oak|ash|cane/.test(part.material.class))
  return geometry
}

/** End grain drinks the light: its vertex colour, against one for side grain.
 * A colour and not a shader branch, so a baked or exported surface keeps it. */
export const END_GRAIN_TONE = .42
/** The classes whose timbers show their end grain. */
const endGrainClass = (material: string): boolean => /planed oak|hewn oak|oak peg/.test(material)
const toneAttribute = (tones: number[]): Float32BufferAttribute =>
  new Float32BufferAttribute(Float32Array.from(tones.flatMap(t => [t, t, t])), 3)

/** UVs are metres so the library's grain cannot swell with the machine. */
export function metricPlanarUV(geometry: BufferGeometry, alongMember = false, markEnds = false): void {
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal')
  geometry.computeBoundingBox()
  const size = geometry.boundingBox!.getSize(new Vector3())
  const sizes = [size.x, size.y, size.z]
  const uv: number[] = [], tones: number[] = []
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
    // a face square to the member's own length is the timber's end
    const along = sizes.indexOf(Math.max(...sizes))
    const end = markEnds && Math.abs([n?.getX(i) ?? 0, n?.getY(i) ?? 1, n?.getZ(i) ?? 0][along]!) > .95
    uv.push(coordinates[a]!, coordinates[b]!)
    tones.push(end ? END_GRAIN_TONE : 1)
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  if (markEnds) geometry.setAttribute('color', toneAttribute(tones))
}

function metricCylinderUV(geometry: BufferGeometry, radius: number, height: number, markEnds = false): void {
  const uv = geometry.getAttribute('uv'), p = geometry.getAttribute('position'), n = geometry.getAttribute('normal')
  // A plate is not a post. Where the wall is shorter than its own radius the
  // library's long grain runs around the circumference; mapped up a four
  // centimetre rim instead it stretches one slice of plank into a comb.
  const plate = height < radius
  const tones: number[] = []
  for (let i = 0; i < uv.count; i++) {
    tones.push(Math.abs(n.getY(i)) > 0.5 ? END_GRAIN_TONE : 1)
    if (Math.abs(n.getY(i)) > 0.5) { uv.setXY(i, p.getX(i), p.getZ(i)); continue }
    const around = uv.getX(i) * TAU * radius, along = uv.getY(i) * height
    if (plate) uv.setXY(i, along, around)
    else uv.setXY(i, around, along)
  }
  if (markEnds) geometry.setAttribute('color', toneAttribute(tones))
}

/** A REVOLVED BODY, BUILT THE WAY IT IS TURNED. three's lathe averages the
 * normal at every profile corner, so a plate's arris shades as a bullnose and
 * both of its rim vertices claim to face upward: the rim then takes the
 * top-down projection meant for a face and one slice of plank combs down it.
 * Each profile segment is revolved as its own ring pair here, creased where
 * the profile turns and smoothed where it curves. A segment that runs up the
 * wall lays the grain AROUND its own circumference in metres; a segment that
 * runs out flat keeps the planar map, because a turned disc is cut from a
 * plank and its face shows the plank.
 */
function revolvedProfile(profile: readonly Vector2[], segments: number): BufferGeometry {
  const nodes = profile.length
  const dirs: Vector2[] = [], normals: Vector2[] = [], wall: boolean[] = []
  for (let k = 0; k < nodes - 1; k++) {
    const a = profile[k]!, b = profile[k + 1]!
    const d = new Vector2(b.x - a.x, b.y - a.y)
    if (d.lengthSq() === 0) d.set(1, 0)
    d.normalize()
    dirs.push(d)
    normals.push(new Vector2(d.y, -d.x))
    wall.push(Math.abs(d.y) >= Math.abs(d.x))
  }
  const runs = dirs.length
  const along = new Float64Array(nodes)
  for (let k = 1; k < nodes; k++) along[k] = along[k - 1]! + profile[k]!.distanceTo(profile[k - 1]!)
  // A profile that returns to its first point is closed, so its last corner
  // is a corner like any other.
  const closed = profile[0]!.distanceTo(profile[nodes - 1]!) < 1e-9
  const smooth = (k: number, j: number): boolean => dirs[k]!.dot(dirs[j]!) > 0.82 && wall[k] === wall[j]
  const rings: {r: number; y: number; n: Vector2; s: number; wall: boolean}[] = []
  for (let k = 0; k < runs; k++) {
    const previous = k === 0 ? (closed ? runs - 1 : -1) : k - 1
    const next = k === runs - 1 ? (closed ? 0 : -1) : k + 1
    const head = previous >= 0 && smooth(k, previous)
      ? new Vector2().addVectors(normals[k]!, normals[previous]!).normalize() : normals[k]!.clone()
    const tail = next >= 0 && smooth(k, next)
      ? new Vector2().addVectors(normals[k]!, normals[next]!).normalize() : normals[k]!.clone()
    rings.push({r: profile[k]!.x, y: profile[k]!.y, n: head, s: along[k]!, wall: wall[k]!})
    rings.push({r: profile[k + 1]!.x, y: profile[k + 1]!.y, n: tail, s: along[k + 1]!, wall: wall[k]!})
  }
  const stride = segments + 1
  const position: number[] = [], normal: number[] = [], texcoord: number[] = [], index: number[] = []
  for (const ring of rings) {
    for (let i = 0; i <= segments; i++) {
      const phi = TAU * i / segments, sin = Math.sin(phi), cos = Math.cos(phi)
      position.push(ring.r * sin, ring.y, ring.r * cos)
      normal.push(ring.n.x * sin, ring.n.y, ring.n.x * cos)
      if (ring.wall) texcoord.push(ring.s, phi * ring.r)
      else texcoord.push(ring.r * sin, ring.r * cos)
    }
  }
  for (let k = 0; k < runs; k++) {
    const lower = 2 * k * stride, upper = (2 * k + 1) * stride
    for (let i = 0; i < segments; i++) {
      const a = lower + i, b = lower + i + 1, c = upper + i, d = upper + i + 1
      index.push(a, b, c, b, d, c)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(texcoord, 2))
  geometry.setIndex(index)
  return geometry
}

export function geometryForPart(part: PartSpec, tier: TierName = 'standard', slug = ''): BufferGeometry {
  const d = part.dimensions_m, s = typeof part.shape === 'string' ? undefined : part.shape
  const kind = s?.type ?? part.shape
  let geometry: BufferGeometry
  switch (kind) {
    case 'box':
      geometry = new BoxGeometry(required(d.x, 'x'), required(d.y, 'y'), required(d.z, 'z'))
      metricPlanarUV(geometry, /wood|oak|ash|cane/.test(part.material.class), endGrainClass(part.material.class))
      break
    case 'cylinder': case 'cone': {
      const radius = d.radius ?? required(d.radius_bottom, 'radius_bottom'), height = required(d.height, 'height')
      geometry = new CylinderGeometry(d.radius_top ?? radius, radius, height, count(tier, 64, 48, 32))
      metricCylinderUV(geometry, radius, height, endGrainClass(part.material.class))
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
      geometry = revolvedProfile(points, d.segments ?? count(tier, 96, 64, 48))
      break
    }
    case 'profile': geometry = extrudeProfile(part, tier); break
    case 'mesh': {
      geometry = exactMesh(part, slug === 'aerial-screw' && part.id === 'sail', tier)
      if (part.id === 'wind-shield' && /glass/.test(part.material.class)) {
        const outer = geometry
        geometry = createGlassCoverShell(outer, required(d.nominal_thickness, 'nominal_thickness'))
        outer.dispose()
      }
      break
    }
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
  // Each oak piece carries its own tone in a vertex colour, white until the
  // part's own phase is laid on it, so every piece of a welded draw has one.
  if ((endGrainClass(part.material.class) || /oak grip/.test(part.material.class)) && !geometry.getAttribute('color')) {
    geometry.setAttribute('color', toneAttribute(new Array<number>(geometry.getAttribute('position').count).fill(1)))
  }
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.name = `${part.id}:dossier-surface`
  return geometry
}
