/** The rooms a visitor sees through the house's windows, fabric only.
 * Plans, levels, heights, ceilings and finishes are the dossier's own
 * proposals (A-LAYOUT, A-HEIGHT, A-MASONRY); no room here is documented as
 * furnished, and none is furnished. The hall is its own room's work and the
 * entrance passage has its own module, so neither is built here.
 * The engine's indirect light is baked per vertex from the windows each
 * point sees and the sun patches on each floor, once, at the fixed hour.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial } from 'three/webgpu'
import * as TSL from 'three/tsl'
import raw from './data/closluce.json?raw'
import { hourKey } from './site'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { Fn, attribute, clamp, float, floor, fract, mix, mx_noise_float, smoothstep, uv, vec3 } = TSL as unknown as Record<string, N>

type V2 = [number, number]
type V3 = [number, number, number]
interface Q<T> { value: T }
interface DossierOpening { id: string; type: string; from_m: number; width_m: number; base_m: number; height_m: number; render: boolean }
interface DossierFacade { id: string; from: V2; to: V2; length_m: number; render: boolean; openings: DossierOpening[] }
interface DossierWall { facade_id?: string; thickness_m: number; render: boolean }
interface DossierRoom { id: string; polygon: V2[]; height_m: number; floor_material: string; wall_material: string
  ceiling: { type: string; beam_spacing_m: number; beam_section_m: V2 }; openings: { id: string; type: string; facade_opening?: string }[] }
interface DossierFloor { id: string; level_m: number; rooms: DossierRoom[] }
function values(x: unknown): unknown {
  if (!x || typeof x !== 'object') return x
  if ('value' in x) return (x as Q<unknown>).value
  if (Array.isArray(x)) return x.map(values)
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, values(v)]))
}
const spec = values(JSON.parse(raw)) as { facades: DossierFacade[]; walls: DossierWall[]; floors: DossierFloor[]; interior_detail_parameters: Record<string, number | number[]> }
const detail = spec.interior_detail_parameters
const TILE_M = Number(detail['terracotta_tile_m'] ?? .22), TILE_JOINT_M = Number(detail['tile_joint_m'] ?? .008)
const VAULT_SPRING_M = Number(detail['oratory_vault_spring_m'] ?? 2.65), VAULT_APEX_M = Number(detail['oratory_vault_apex_m'] ?? 3.4)
const RIB_M = Number(detail['rib_section_m'] ?? .12)

/** The rooms other modules own: the hall is its own room's work, the
 * entrance and the landing over it are the entry passage's, and the cellars
 * sit on the foundation's own top face and show through a hand's breadth of
 * basement light. */
const NOT_HERE = new Set(['hall', 'entry', 'upper-landing', 'cellar-west-north', 'cellar-west-south', 'cellar-connector', 'cellar-east'])
const GLAZED = new Set(['window', 'traceried-window'])

/** The sun of the hour, pointing to it, east/north/up. */
const az = hourKey.sun_azimuth_deg.value * Math.PI / 180, el = hourKey.sun_elevation_deg.value * Math.PI / 180
const TO_SUN: V3 = [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)]

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2])
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const rand = (a: number, b = 0): number => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123; return n - Math.floor(n) }
function signedArea(p: V2[]): number { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a[0] * b[1] - b[0] * a[1] } return s / 2 }
/** The narrowest width of a convex polygon, over its own edge directions. */
function width(p: V2[]): number {
  let best = Infinity
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!, l = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (l < 1e-9) continue
    let far = 0
    for (const q of p) far = Math.max(far, Math.abs((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) / l)
    best = Math.min(best, far)
  }
  return best
}
function clipConvex(subject: V2[], outline: V2[]): V2[] {
  let out = subject
  for (let i = 0; i < outline.length && out.length; i++) {
    const a = outline[i]!, b = outline[(i + 1) % outline.length]!
    const side = (p: V2): number => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    const input = out; out = []
    for (let k = 0; k < input.length; k++) {
      const p = input[k]!, q = input[(k + 1) % input.length]!, sp = side(p), sq = side(q)
      if (sp >= 0) out.push(p)
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]) }
    }
  }
  return out
}

/** A window of a room: the inner aperture, its inward normal, what it lets in. */
interface Aperture { corners: V3[]; centre: V3; inward: V3; area: number; transmit: number; facade: DossierFacade; opening: DossierOpening; thickness: number }
interface WallEdge { a: V2; b: V2; facade?: DossierFacade; thickness?: number }

const facadeOf = new Map<string, { facade: DossierFacade; opening: DossierOpening }>()
for (const f of spec.facades) for (const o of f.openings) facadeOf.set(o.id, { facade: f, opening: o })
const thicknessOf = (f: DossierFacade): number => spec.walls.find(w => w.facade_id === f.id)?.thickness_m ?? .6
const frame = (f: DossierFacade): { dir: V2; out: V2 } => {
  const dx = (f.to[0] - f.from[0]) / f.length_m, dy = (f.to[1] - f.from[1]) / f.length_m
  return { dir: [dx, dy], out: [dy, -dx] }
}

/** Move each room edge that runs along an exterior wall onto that wall's
 * inner face, so floor, ceiling and lining meet the masonry the shell drew. */
function snapRoom(polygon: V2[]): WallEdge[] {
  const p = signedArea(polygon) < 0 ? [...polygon].reverse() : polygon
  const lines: { point: V2; dir: V2; facade?: DossierFacade; thickness?: number }[] = []
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!, l = Math.hypot(b[0] - a[0], b[1] - a[1])
    const dir: V2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], outward: V2 = [dir[1], -dir[0]], mid: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    let best: { facade: DossierFacade; distance: number } | undefined
    for (const f of spec.facades) {
      const fr = frame(f)
      if (fr.out[0] * outward[0] + fr.out[1] * outward[1] < .985) continue
      const rel: V2 = [mid[0] - f.from[0], mid[1] - f.from[1]]
      const normal = rel[0] * fr.out[0] + rel[1] * fr.out[1], along = rel[0] * fr.dir[0] + rel[1] * fr.dir[1]
      if (normal < -1.4 || normal > .2 || along < -1 || along > f.length_m + 1) continue
      if (!best || Math.abs(normal + thicknessOf(f)) < Math.abs(best.distance + thicknessOf(best.facade))) best = { facade: f, distance: normal }
    }
    if (best) {
      const fr = frame(best.facade), t = thicknessOf(best.facade) + .012
      lines.push({ point: [best.facade.from[0] - fr.out[0] * t, best.facade.from[1] - fr.out[1] * t], dir: fr.dir, facade: best.facade, thickness: thicknessOf(best.facade) })
    } else lines.push({ point: a, dir })
  }
  const meet = (l0: typeof lines[number], l1: typeof lines[number]): V2 => {
    const det = l0.dir[0] * l1.dir[1] - l0.dir[1] * l1.dir[0]
    if (Math.abs(det) < 1e-6) return l1.point
    const t = ((l1.point[0] - l0.point[0]) * l1.dir[1] - (l1.point[1] - l0.point[1]) * l1.dir[0]) / det
    return [l0.point[0] + l0.dir[0] * t, l0.point[1] + l0.dir[1] * t]
  }
  const corners = lines.map((l, i) => meet(lines[(i + lines.length - 1) % lines.length]!, l))
  return lines.map((l, i) => ({ a: corners[i]!, b: corners[(i + 1) % corners.length]!, ...(l.facade ? { facade: l.facade, thickness: l.thickness } : {}) }))
}

/** Surface kinds, read by the material. */
const FLOOR = 0, WALL = 1, INFILL = 2, OAK = 3, VAULT = 4
class Sink {
  positions: number[] = []; normals: number[] = []; uvs: number[] = []; info: number[] = []; sun: number[] = []
  /** positions and normals in east/north/up; converted to three on write */
  pending: { p: V3; n: V3; t: V2; kind: number; seed: number }[] = []
  tri(a: V3, b: V3, c: V3, n: V3, ta: V2, tb: V2, tc: V2, kind: number, seed: number): void {
    const g = cross(sub(b, a), sub(c, a))
    if (len(g) < 1e-9) return
    const flip = dot(g, n) < 0
    for (const [p, t] of (flip ? [[a, ta], [c, tc], [b, tb]] : [[a, ta], [b, tb], [c, tc]]) as [V3, V2][]) this.pending.push({ p, n, t, kind, seed })
  }
  quad(a: V3, b: V3, c: V3, d: V3, n: V3, ta: V2, tb: V2, tc: V2, td: V2, kind: number, seed: number): void {
    this.tri(a, b, c, n, ta, tb, tc, kind, seed); this.tri(a, c, d, n, ta, tc, td, kind, seed)
  }
}

interface RoomBuild { id: string; level: number; edges: WallEdge[]; apertures: Aperture[]; patches: V3[][]; ceilingZ: number; vault: boolean; start: number; end: number }

function apertureOf(edge: WallEdge, opening: DossierOpening, level: number): Aperture | null {
  const f = edge.facade!, fr = frame(f), t = edge.thickness!
  const z0 = Math.max(opening.base_m, level), z1 = opening.base_m + opening.height_m
  if (z1 <= z0 + .05) return null
  const at = (u: number, z: number): V3 => [f.from[0] + fr.dir[0] * u - fr.out[0] * (t + .012), f.from[1] + fr.dir[1] * u - fr.out[1] * (t + .012), z]
  const corners = [at(opening.from_m, z0), at(opening.from_m + opening.width_m, z0), at(opening.from_m + opening.width_m, z1), at(opening.from_m, z1)]
  const centre = scale(corners.reduce(add, [0, 0, 0] as V3), .25)
  // Tracery, mullions and leading take about a third of a light's area.
  const transmit = opening.type === 'traceried-window' ? .42 : .62
  return { corners, centre, inward: [-fr.out[0], -fr.out[1], 0], area: opening.width_m * (z1 - z0), transmit, facade: f, opening, thickness: t }
}

/** Where the hour's sun lands on the floor through one aperture, after the
 * wall's own depth has trimmed the beam: a polygon on the floor plane. */
function sunPatch(ap: Aperture, level: number, room: V2[]): V3[] | null {
  const f = ap.facade, fr = frame(f), outward: V3 = [fr.out[0], fr.out[1], 0], along: V3 = [fr.dir[0], fr.dir[1], 0]
  const facing = dot(TO_SUN, outward)
  if (facing < .05) return null
  const o = ap.opening, t = ap.thickness
  const du = -t * dot(TO_SUN, along) / facing, dz = -t * TO_SUN[2] / facing
  const u0 = Math.max(o.from_m, o.from_m + du), u1 = Math.min(o.from_m + o.width_m, o.from_m + o.width_m + du)
  const z0 = Math.max(o.base_m, o.base_m + dz, level), z1 = Math.min(o.base_m + o.height_m, o.base_m + o.height_m + dz)
  if (u1 - u0 < .05 || z1 - z0 < .05) return null
  const at = (u: number, z: number): V3 => [f.from[0] + fr.dir[0] * u - fr.out[0] * t, f.from[1] + fr.dir[1] * u - fr.out[1] * t, z]
  const onFloor = (p: V3): V2 => { const s = (p[2] - level) / TO_SUN[2]; return [p[0] - TO_SUN[0] * s, p[1] - TO_SUN[1] * s] }
  const patch = clipConvex([at(u0, z0), at(u1, z0), at(u1, z1), at(u0, z1)].map(onFloor), room)
  if (patch.length < 3) return null
  return patch.map(p => [p[0], p[1], level] as V3)
}

/** Form factor from a point with normal n to a planar polygon of emitters. */
function formFactor(p: V3, n: V3, polygon: V3[], normal: V3, steps: number): number {
  // Fan triangles, each subdivided on a steps x steps barycentric grid.
  let f = 0
  const c0 = polygon[0]!
  for (let k = 1; k < polygon.length - 1; k++) {
    const a = c0, b = polygon[k]!, c = polygon[k + 1]!
    const area = len(cross(sub(b, a), sub(c, a))) / 2 / (steps * steps)
    for (let i = 0; i < steps; i++) for (let j = 0; j < steps - i; j++) {
      for (const flip of j < steps - i - 1 ? [0, 1] : [0]) {
        const u = flip ? (i + 2 / 3) / steps : (i + 1 / 3) / steps, v = flip ? (j + 2 / 3) / steps : (j + 1 / 3) / steps
        const s = add(a, add(scale(sub(b, a), u), scale(sub(c, a), v)))
        const d = sub(p, s), r2 = Math.max(dot(d, d), .04), r = Math.sqrt(r2)
        const cosE = dot(normal, d) / r, cosR = -dot(n, d) / r
        if (cosE > 0 && cosR > 0) f += cosE * cosR * area / (Math.PI * r2)
      }
    }
  }
  return f
}

export interface HouseRooms { group: Group; rooms: string[]; openedBacks: Set<string>; triangles: number }

/** Build every room with a glazed window except those named above. `cell`
 * is the grid the light is baked on; a lighter tier asks for a coarser one. */
export function createHouseRooms(cell = CELL): HouseRooms {
  const sink = new Sink(), builds: RoomBuild[] = [], openedBacks = new Set<string>()
  for (const floor of spec.floors) for (const room of floor.rooms) {
    if (NOT_HERE.has(room.id) || room.polygon.length !== 4) continue
    const glazed = room.openings.filter(o => o.facade_opening && GLAZED.has(o.type))
    if (!glazed.length) continue
    const level = floor.level_m, height = room.height_m, vault = /vault/i.test(room.ceiling.type) && room.id === 'oratory'
    const edges = snapRoom(room.polygon)
    const polygon2 = edges.map(e => e.a)
    const apertures: Aperture[] = []
    for (const edge of edges) if (edge.facade) for (const o of edge.facade.openings) {
      if (!GLAZED.has(o.type) || !o.render) continue
      // the aperture must stand on this edge's span and this storey
      const fr = frame(edge.facade), sa = (edge.a[0] - edge.facade.from[0]) * fr.dir[0] + (edge.a[1] - edge.facade.from[1]) * fr.dir[1]
      const sb = (edge.b[0] - edge.facade.from[0]) * fr.dir[0] + (edge.b[1] - edge.facade.from[1]) * fr.dir[1]
      if (o.from_m < sa - .05 || o.from_m + o.width_m > sb + .05) continue
      if (o.base_m + o.height_m < level + .3 || o.base_m > level + height) continue
      const ap = apertureOf(edge, o, level)
      if (ap) { apertures.push(ap); openedBacks.add(o.id) }
    }
    const patches = apertures.map(ap => sunPatch(ap, level, polygon2)).filter((p): p is V3[] => p !== null)
    const start = sink.pending.length
    const ceilingZ = level + height
    buildRoom(sink, room, edges, level, ceilingZ, vault, cell)
    builds.push({ id: room.id, level, edges, apertures, patches, ceilingZ, vault, start, end: sink.pending.length })
  }
  // BAKE, once: what each vertex sees of the windows of its own room, and
  // what the floor's sun patches send it.
  for (const b of builds) {
    // a vertex is shared by up to six triangles: bake each place once
    const baked = new Map<string, [number, number]>()
    for (let i = b.start; i < b.end; i++) {
      const v = sink.pending[i]!
      const key = `${v.p[0].toFixed(3)},${v.p[1].toFixed(3)},${v.p[2].toFixed(3)},${v.n[0].toFixed(2)},${v.n[1].toFixed(2)},${v.n[2].toFixed(2)}`
      let light = baked.get(key)
      if (!light) {
        let sky = 0, ground = 0
        for (const ap of b.apertures) {
          const f = formFactor(v.p, v.n, ap.corners, ap.inward, 2) * ap.transmit
          // Looking down through a window a surface sees the court, not the sky.
          if (ap.centre[2] > v.p[2]) sky += f; else ground += f
        }
        let bounce = 0
        for (const patch of b.patches) bounce += formFactor(v.p, v.n, patch, [0, 0, 1], 3)
        // Terracotta returns about a sixth of the sun that lands on it.
        light = [Math.min(1, .02 + (sky + ground * .55) * 1.7), bounce * .16 * TO_SUN[2]]
        baked.set(key, light)
      }
      sink.info.push(v.kind, light[0], light[1], v.seed)
      // A room whose windows take no beam of the hour takes no sun at all:
      // the map's leaks through unregistered inner walls stay out of it.
      sink.sun.push(b.patches.length ? 1 : 0)
      sink.positions.push(v.p[0], v.p[2], -v.p[1]); sink.normals.push(v.n[0], v.n[2], -v.n[1]); sink.uvs.push(v.t[0], v.t[1])
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(sink.positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(sink.normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(sink.uvs, 2))
  geometry.setAttribute('room', new Float32BufferAttribute(sink.info, 4))
  geometry.setAttribute('roomSun', new Float32BufferAttribute(sink.sun, 1))
  geometry.computeBoundingSphere()
  const mesh = new Mesh(geometry, roomMaterial())
  mesh.name = 'vinci/house-rooms/fabric'
  mesh.castShadow = true; mesh.receiveShadow = true
  mesh.userData['manifestId'] = houseRoomsProvenance.manifestId; mesh.userData['asset'] = houseRoomsProvenance.manifestId
  const group = new Group(); group.name = 'vinci/house-rooms'; group.add(mesh)
  group.userData['manifestId'] = houseRoomsProvenance.manifestId
  const triangles = sink.positions.length / 9
  group.userData['triangles'] = triangles
  group.userData['rooms'] = builds.map(b => ({ id: b.id, apertures: b.apertures.length, sunPatches: b.patches.length }))
  return { group, rooms: builds.map(b => b.id), openedBacks, triangles }
}

const CELL = .45
function buildRoom(sink: Sink, room: DossierRoom, edges: WallEdge[], level: number, ceilingZ: number, vault: boolean, cell: number): void {
  const seed = rand(room.polygon[0]![0], room.polygon[0]![1])
  const poly = edges.map(e => e.a)
  const e0 = edges[0]!, u: V2 = [e0.b[0] - e0.a[0], e0.b[1] - e0.a[1]], ul = Math.hypot(u[0], u[1]), ud: V2 = [u[0] / ul, u[1] / ul], vd: V2 = [-ud[1], ud[0]]
  const local = (p: V2): V2 => [(p[0] - e0.a[0]) * ud[0] + (p[1] - e0.a[1]) * ud[1], (p[0] - e0.a[0]) * vd[0] + (p[1] - e0.a[1]) * vd[1]]
  const worldOf = (s: V2): V2 => [e0.a[0] + ud[0] * s[0] + vd[0] * s[1], e0.a[1] + ud[1] * s[0] + vd[1] * s[1]]
  const loc = poly.map(local)
  // the floor tucks a little under the linings so no seam opens at a wall
  const grow = (pts: V2[], d: number): V2[] => {
    const c: V2 = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
    return pts.map(p => { const x = p[0] - c[0], y = p[1] - c[1], l = Math.hypot(x, y); return [p[0] + x / l * d, p[1] + y / l * d] as V2 })
  }
  const floorOutline = grow(loc, .03)
  const us = floorOutline.map(p => p[0]), vs = floorOutline.map(p => p[1])
  // cells that divide the extent exactly, so no strip is left at the far edge
  const steps = (lo: number, hi: number): number[] => { const n = Math.max(1, Math.ceil((hi - lo) / cell)); return Array.from({ length: n + 1 }, (_, i) => lo + (hi - lo) * i / n) }
  const plane = (z: number, normalUp: boolean, kind: number): void => {
    const xs = steps(Math.min(...us), Math.max(...us)), ys = steps(Math.min(...vs), Math.max(...vs))
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      const x = xs[i]!, y = ys[j]!, x1 = xs[i + 1]!, y1 = ys[j + 1]!
      const cell = clipConvex([[x, y], [x1, y], [x1, y1], [x, y1]], floorOutline)
      // a wedge a slanted edge leaves in a corner cell tucks under the lining
      if (cell.length < 3 || Math.abs(signedArea(cell)) < 4e-4 || width(cell) < .07) continue
      const pts = cell.map(s => { const w = worldOf(s); return [w[0], w[1], z] as V3 })
      for (let k = 1; k < pts.length - 1; k++) sink.tri(pts[0]!, pts[k]!, pts[k + 1]!, [0, 0, normalUp ? 1 : -1], cell[0]!, cell[k]!, cell[k + 1]!, kind, seed)
    }
  }
  plane(level, true, FLOOR)
  const top = vault ? level + VAULT_APEX_M + .05 : ceilingZ + .23
  // THE LININGS: every edge from floor to ceiling, cut where the facade has
  // an aperture. An exterior edge stands on the wall's inner face.
  for (const edge of edges) {
    const dx = edge.b[0] - edge.a[0], dy = edge.b[1] - edge.a[1], l = Math.hypot(dx, dy)
    if (l < .05) continue
    const inward: V3 = [-dy / l, dx / l, 0]
    const holes: [number, number, number, number][] = []
    if (edge.facade) {
      const fr = frame(edge.facade), sa = (edge.a[0] - edge.facade.from[0]) * fr.dir[0] + (edge.a[1] - edge.facade.from[1]) * fr.dir[1]
      // an aperture within a hand of the room's corner or floor takes that
      // hand with it: a lining strip that thin would be a hair at any eye
      const near = (v: number, lo: number, hi: number): number => v - lo < .12 ? lo : hi - v < .12 ? hi : v
      for (const o of edge.facade.openings) if (o.render && o.type !== 'blind-recess')
        holes.push([near(o.from_m - sa, 0, l), near(o.from_m + o.width_m - sa, 0, l), near(o.base_m, level, top), near(o.base_m + o.height_m, level, top)])
    }
    // cell lines fall on every aperture edge, so a cut never leaves a hair
    const breaks = (lo: number, hi: number, cuts: number[]): number[] => {
      const keep = [...new Set([lo, hi, ...cuts.filter(c => c > lo + .02 && c < hi - .02)])].sort((a, b) => a - b)
      const out: number[] = [keep[0]!]
      for (let k = 1; k < keep.length; k++) { const a = keep[k - 1]!, b = keep[k]!, n = Math.max(1, Math.ceil((b - a) / cell)); for (let i = 1; i <= n; i++) out.push(a + (b - a) * i / n) }
      return out
    }
    const ss = breaks(0, l, holes.flatMap(h => [h[0], h[1]])), zs = breaks(level, top, holes.flatMap(h => [h[2], h[3]]))
    for (let si = 0; si < ss.length - 1; si++) for (let zi = 0; zi < zs.length - 1; zi++) {
      const s = ss[si]!, z = zs[zi]!
      let pieces: [number, number, number, number][] = [[s, ss[si + 1]!, z, zs[zi + 1]!]]
      for (const h of holes) pieces = pieces.flatMap(r => {
        if (r[1] <= h[0] || r[0] >= h[1] || r[3] <= h[2] || r[2] >= h[3]) return [r]
        const out: [number, number, number, number][] = []
        if (r[0] < h[0]) out.push([r[0], h[0], r[2], r[3]])
        if (r[1] > h[1]) out.push([h[1], r[1], r[2], r[3]])
        const s0 = Math.max(r[0], h[0]), s1 = Math.min(r[1], h[1])
        if (r[2] < h[2]) out.push([s0, s1, r[2], h[2]])
        if (r[3] > h[3]) out.push([s0, s1, h[3], r[3]])
        return out
      })
      for (const [s0, s1, z0, z1] of pieces) {
        if (s1 - s0 < .03 || z1 - z0 < .03) continue
        const at = (t: number, zz: number): V3 => [edge.a[0] + dx / l * t, edge.a[1] + dy / l * t, zz]
        sink.quad(at(s0, z0), at(s1, z0), at(s1, z1), at(s0, z1), inward, [s0, z0], [s1, z0], [s1, z1], [s0, z1], WALL, seed)
      }
    }
  }
  if (vault) { buildVault(sink, edges, level, seed); return }
  // THE CEILING: limewashed boards between oak joists at the dossier's
  // spacing and section, the joists across the shorter span.
  plane(ceilingZ + .23, false, INFILL)
  const spacing = room.ceiling.beam_spacing_m, [bw, bd] = room.ceiling.beam_section_m
  const ext = (i: number): number => Math.max(...loc.map(p => p[i]!)) - Math.min(...loc.map(p => p[i]!))
  const spanAlongU = ext(0) < ext(1) // joists run parallel to the shorter extent
  const runAxis = spanAlongU ? 0 : 1, stepAxis = 1 - runAxis
  const lo = Math.min(...loc.map(p => p[stepAxis]!)), hi = Math.max(...loc.map(p => p[stepAxis]!))
  const beam = (axis: number, centre: number, width: number, depth: number, bottom: number): void => {
    const a: V2 = axis === 0 ? [-50, centre] : [centre, -50], b: V2 = axis === 0 ? [50, centre] : [centre, 50]
    const seg = clipLine(a, b, loc)
    if (!seg) return
    const across: V2 = axis === 0 ? [0, width / 2] : [width / 2, 0]
    const corner = (p: V2, sgn: number, z: number): V3 => { const w = worldOf([p[0] + across[0] * sgn, p[1] + across[1] * sgn]); return [w[0], w[1], z] }
    const [p, q] = seg
    const bl = Math.hypot(q[0] - p[0], q[1] - p[1])
    const acrossWorld = worldOf([across[0], across[1]]), origin = worldOf([0, 0])
    const side: V3 = [acrossWorld[0] - origin[0], acrossWorld[1] - origin[1], 0], sl = len(side)
    const sideN: V3 = [side[0] / sl, side[1] / sl, 0]
    const bSeed = rand(centre, seed)
    sink.quad(corner(p, -1, bottom), corner(q, -1, bottom), corner(q, 1, bottom), corner(p, 1, bottom), [0, 0, -1], [0, 0], [bl, 0], [bl, width], [0, width], OAK, bSeed)
    for (const sgn of [-1, 1]) sink.quad(corner(p, sgn, bottom), corner(q, sgn, bottom), corner(q, sgn, bottom + depth), corner(p, sgn, bottom + depth), scale(sideN, sgn), [0, 0], [bl, 0], [bl, depth], [0, depth], OAK, bSeed)
  }
  // A span past 5.5 m takes a main beam under the joists, across them.
  const span = runAxis === 0 ? ext(0) : ext(1)
  if (span > 5.5) {
    const rlo = Math.min(...loc.map(p => p[runAxis]!)), rhi = Math.max(...loc.map(p => p[runAxis]!))
    beam(stepAxis, (rlo + rhi) / 2, .30, .36, ceilingZ - .13)
  }
  for (let c = lo + spacing / 2; c < hi - bw / 2; c += spacing) beam(runAxis, c, bw, bd, ceilingZ)
}

function clipLine(p: V2, q: V2, outline: V2[]): [V2, V2] | null {
  let t0 = 0, t1 = 1
  const ccwOutline = signedArea(outline) < 0 ? [...outline].reverse() : outline
  for (let i = 0; i < ccwOutline.length; i++) {
    const a = ccwOutline[i]!, b = ccwOutline[(i + 1) % ccwOutline.length]!
    const side = (s: V2): number => (b[0] - a[0]) * (s[1] - a[1]) - (b[1] - a[1]) * (s[0] - a[0])
    const sp = side(p), sq = side(q)
    if (sp < 0 && sq < 0) return null
    if (sp < 0) t0 = Math.max(t0, sp / (sp - sq)); else if (sq < 0) t1 = Math.min(t1, sp / (sp - sq))
  }
  if (t1 - t0 < 1e-6) return null
  return [[p[0] + (q[0] - p[0]) * t0, p[1] + (q[1] - p[1]) * t0], [p[0] + (q[0] - p[0]) * t1, p[1] + (q[1] - p[1]) * t1]]
}

/** A quadripartite vault over the chapel's four corners: two pointed barrels
 * crossing at a level crown, the groins carrying diagonal ribs. */
function buildVault(sink: Sink, edges: WallEdge[], level: number, seed: number): void {
  const c = edges.map(e => e.a)
  const spring = level + VAULT_SPRING_M, rise = VAULT_APEX_M - VAULT_SPRING_M
  const profile = (x: number): number => Math.sqrt(Math.max(0, 1 - Math.abs(x)))
  const at = (x: number, y: number): V3 => {
    const s = (x + 1) / 2, t = (y + 1) / 2
    const p: V2 = [
      (1 - s) * (1 - t) * c[0]![0] + s * (1 - t) * c[1]![0] + s * t * c[2]![0] + (1 - s) * t * c[3]![0],
      (1 - s) * (1 - t) * c[0]![1] + s * (1 - t) * c[1]![1] + s * t * c[2]![1] + (1 - s) * t * c[3]![1],
    ]
    return [p[0], p[1], spring + rise * Math.max(profile(x), profile(y))]
  }
  const steps = 10
  const normalAt = (x: number, y: number): V3 => {
    const h = .02, dx = sub(at(Math.min(1, x + h), y), at(Math.max(-1, x - h), y)), dy = sub(at(x, Math.min(1, y + h)), at(x, Math.max(-1, y - h)))
    let n = cross(dx, dy); if (n[2] > 0) n = scale(n, -1)
    return scale(n, 1 / len(n))
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < steps; j++) {
    const x0 = -1 + 2 * i / steps, x1 = -1 + 2 * (i + 1) / steps, y0 = -1 + 2 * j / steps, y1 = -1 + 2 * (j + 1) / steps
    const pts: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
    // split each cell along the diagonal the groins follow in its quadrant
    const along = (x0 + x1) * (y0 + y1) > 0
    const tris = along ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]]
    for (const t of tris) {
      const [a, b, d] = t.map(k => pts[k]!) as [[number, number], [number, number], [number, number]]
      const mid: [number, number] = [(a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3]
      sink.tri(at(...a), at(...b), at(...d), normalAt(...mid), [a[0], a[1]], [b[0], b[1]], [d[0], d[1]], VAULT, seed)
    }
  }
  // DIAGONAL RIBS: a 120 mm section under each groin, and a small boss.
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as V2[]) {
    const n = 12
    // the rib's width stays level across its own plan line, even where the
    // rib springs almost vertical from its corner
    const plan = sub(at(0, 0), at(sx, sy))
    const side = cross([plan[0], plan[1], 0], [0, 0, 1]), sl = len(side)
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n
      const p0 = at(sx * (1 - t0), sy * (1 - t0)), p1 = at(sx * (1 - t1), sy * (1 - t1))
      // the rib's depth stands square to its own curve, not plumb
      let down = cross(side, sub(p1, p0)); if (down[2] > 0) down = scale(down, -1)
      const half = scale(side, RIB_M / 2 / sl), drop: V3 = scale(down, RIB_M * .8 / Math.max(len(down), 1e-9))
      const q = (p: V3, s: number, down: boolean): V3 => add(add(p, scale(half, s)), down ? drop : [0, 0, 0])
      sink.quad(q(p0, -1, true), q(p1, -1, true), q(p1, 1, true), q(p0, 1, true), scale(down, 1 / Math.max(len(down), 1e-9)), [0, 0], [1, 0], [1, 1], [0, 1], VAULT, seed + .5)
      for (const s of [-1, 1]) sink.quad(q(p0, s, true), q(p1, s, true), q(p1, s, false), q(p0, s, false), scale(half, s / (RIB_M / 2)), [0, 0], [1, 0], [1, 1], [0, 1], VAULT, seed + .5)
    }
  }
}

/** Terracotta laid square, limewash, oak: colours inside AD-2's albedo range. */
function roomMaterial(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ metalness: 0, roughness: .85 })
  const info = attribute('room', 'vec4'), kind = info.x, ambient = info.y, bounce = info.z, seed = info.w
  const U = uv()
  const is = (k: number): N => float(1).sub(smoothstep(.2, .45, kind.sub(k).abs()))
  // Tiles 220 mm with 8 mm joints, each tile its own firing.
  const cell = floor(U.div(TILE_M)), inTile = fract(U.div(TILE_M)).mul(TILE_M)
  const edge = inTile.x.min(inTile.y).min(float(TILE_M).sub(inTile.x)).min(float(TILE_M).sub(inTile.y))
  const joint = float(1).sub(smoothstep(TILE_JOINT_M * .35, TILE_JOINT_M * .65, edge))
  const firing = fract(cell.x.mul(17.13).add(cell.y.mul(41.71)).add(seed.mul(9.1)).sin().mul(43758.5)).sub(.5)
  const tile = vec3(.300, .115, .062).mul(firing.mul(.34).add(1)).mul(mx_noise_float(vec3(U.mul(1.3), seed)).mul(.10).add(1))
  const terracotta = mix(tile, vec3(.20, .17, .14), joint)
  const mottle = mx_noise_float(vec3(U.mul(1.7), seed.mul(3))).mul(.05).add(mx_noise_float(vec3(U.mul(9), seed)).mul(.025))
  const limewash = vec3(.64, .60, .52).mul(mottle.add(1))
  const grain = mx_noise_float(vec3(U.x.mul(2.5), U.y.mul(40), seed.mul(13))).mul(.10).add(1)
  const oak = vec3(.075, .048, .030).mul(grain)
  const colour = terracotta.mul(is(FLOOR)).add(limewash.mul(is(WALL).add(is(INFILL)).add(is(VAULT)))).add(oak.mul(is(OAK)))
  m.colorNode = colour
  m.roughnessNode = mix(float(.9), float(.74), is(FLOOR).mul(float(1).sub(joint))).sub(is(OAK).mul(.12))
  m.aoNode = clamp(ambient, 0, 1)
  const roomSun = attribute('roomSun', 'float')
  m.receivedShadowNode = Fn(([shadow]: N[]) => shadow.mul(roomSun))
  // THE FLOOR'S SUN, SENT BACK: baked form factors from the hour's patches,
  // times the key's own colour and strength. The film's true bounce replaces
  // it; `engineBounce` marks the term the export turns off.
  // The room returns its own light again and again off warm walls and a red
  // floor: the patch's first bounce times about two, the window's daylight
  // warmed by those surfaces before it reaches the far side.
  m.emissiveNode = colour.mul(vec3(1, .73, .545).mul(bounce.mul(3.2 * 2.2 / Math.PI)).add(vec3(.10, .085, .065).mul(ambient)))
  m.userData['engineBounce'] = true
  m.name = 'vinci/house-rooms/fabric'
  return m
}

export const houseRoomsProvenance = {
  manifestId: 'vinci/house-rooms',
  assetClass: 'GENERATED',
  certainty: 'assumed',
  recipe: 'The dossier\'s proposed rooms (A-LAYOUT) behind every glazed window except the great hall and the entrance passage: their plans, floor levels, clear heights, 220 mm terracotta tiles with 8 mm joints, limewashed walls, oak joists 0.18 by 0.23 m at 0.60 m, a main beam where a span passes 5.5 m, and the oratory\'s quadripartite vault springing at 2.65 m with 120 mm ribs. Fabric only, no furnishing. Exterior edges stand on the shell\'s inner wall faces with the registered apertures cut. Indirect light baked per vertex once: window form factors and the hour\'s sun patches on each floor, on a 0.45 m grid at hero and a 0.9 m grid at standard.',
} as const
