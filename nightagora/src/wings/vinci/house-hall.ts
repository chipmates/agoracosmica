/** THE GREAT HALL, as the dossier proposes it (A-LAYOUT room `hall`), and the
 * inner service passage that leads to it from the entrance. The fabric is the
 * dossier's: plan, levels, clear height, the four windows and two doors, the
 * 45 degree tile lay read from Q144, oak joists at 0.60 m under a main beam,
 * the tuffeau chimneypiece with a brick fireback where A-FURNITURE puts it.
 * The things in the hall are types of the period, each built from its own
 * recipe and labelled as a type; none is claimed as his.
 * Light: the hour's sun enters through the registered west windows by the
 * key light; what the room returns is baked per vertex once at the fixed hour
 * (window form factors and the floor's sun patches) and marked `engineBounce`
 * so the film's true bounce replaces it.
 */
import { AddEquation, AdditiveBlending, BufferGeometry, CustomBlending, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, OneFactor, SrcAlphaFactor, ZeroFactor } from 'three/webgpu'
import * as TSL from 'three/tsl'
import raw from './data/closluce.json?raw'
import { hourKey } from './site'
import type { TierName } from '../../stack/tier'
import type { MaterialLibrary } from '../../stack/materials'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { Fn, abs, acos, attribute, cameraPosition, clamp, float, floor, fract, max, min, mix, mx_noise_float, normalWorld, positionWorld, smoothstep, uv, vec2, vec3 } = TSL as unknown as Record<string, N>

type V2 = [number, number]
type V3 = [number, number, number]
interface Q<T> { value: T }
interface Opening { id: string; type: string; from_m: number; width_m: number; base_m: number; height_m: number; render: boolean }
interface RoomOpening { id: string; type: string; wall?: string; from_m: number; width_m: number; sill_m?: number; height_m: number; facade_opening?: string; connects_to?: string }
interface Facade { id: string; from: V2; to: V2; length_m: number; render: boolean; openings: Opening[] }
interface Wall { id?: string; facade_id?: string; thickness_m: number; render: boolean }
interface Furnishing { id: string; position: V3; orientation_deg: number; size_m: V3 }
interface Room { id: string; polygon: V2[]; height_m: number; openings: RoomOpening[]; furnishings?: Furnishing[]
  ceiling: { beam_spacing_m: number; beam_section_m: V2 } }
interface Floor { id: string; level_m: number; slab_m: number; rooms: Room[] }
function values(x: unknown): unknown {
  if (!x || typeof x !== 'object') return x
  if ('value' in x) return (x as Q<unknown>).value
  if (Array.isArray(x)) return x.map(values)
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, values(v)]))
}
const spec = values(JSON.parse(raw)) as { facades: Facade[]; walls: Wall[]; floors: Floor[]; interior_detail_parameters: Record<string, number> }
const ground = spec.floors.find(f => f.id === 'ground')!
const HALL = ground.rooms.find(r => r.id === 'hall')!
const LINK = ground.rooms.find(r => r.id === 'service-link')!
const FLOOR_Z = ground.level_m
/** the underside of the joists; the boards between them lie a joist's depth higher */
const CEIL_Z = FLOOR_Z + HALL.height_m
const [JOIST_W, JOIST_D] = HALL.ceiling.beam_section_m
const BOARD_Z = CEIL_Z + JOIST_D
const JOIST_STEP = HALL.ceiling.beam_spacing_m
const TILE_M = spec.interior_detail_parameters['terracotta_tile_m'] ?? .22
const JOINT_M = spec.interior_detail_parameters['tile_joint_m'] ?? .008
const TILE_TURN = (spec.interior_detail_parameters['hall_tile_angle_deg'] ?? 45) * Math.PI / 180
/** the hall's four windows, which leave the shell's dark backs */
export const HALL_WINDOWS = ['west-ground-1', 'west-ground-2', 'back-ground-3', 'back-ground-4'] as const

/** The sun of the hour, pointing to it, east/north/up. */
const az = hourKey.sun_azimuth_deg.value * Math.PI / 180, el = hourKey.sun_elevation_deg.value * Math.PI / 180
const TO_SUN: V3 = [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)]

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2])
const unit = (a: V3): V3 => scale(a, 1 / Math.max(len(a), 1e-12))
/** a stable hash in [0,1) */
const rand = (a: number, b = 0, c = 0): number => { const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453123; return n - Math.floor(n) }
function signedArea(p: V2[]): number { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a[0] * b[1] - b[0] * a[1] } return s / 2 }
/** Sutherland-Hodgman against a convex, counter-clockwise outline. */
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
/** The same outline moved inward by d on every edge. */
function inset(poly: V2[], d: number): V2[] {
  const n = poly.length, lines: { p: V2; dir: V2 }[] = []
  for (let i = 0; i < n; i++) {
    const a = poly[i]!, b = poly[(i + 1) % n]!, l = Math.hypot(b[0] - a[0], b[1] - a[1])
    const dir: V2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], inward: V2 = [-dir[1], dir[0]]
    lines.push({ p: [a[0] + inward[0] * d, a[1] + inward[1] * d], dir })
  }
  return lines.map((l1, i) => meet(lines[(i + n - 1) % n]!, l1))
}
function meet(l0: { p: V2; dir: V2 }, l1: { p: V2; dir: V2 }): V2 {
  const det = l0.dir[0] * l1.dir[1] - l0.dir[1] * l1.dir[0]
  if (Math.abs(det) < 1e-9) return l1.p
  const t = ((l1.p[0] - l0.p[0]) * l1.dir[1] - (l1.p[1] - l0.p[1]) * l1.dir[0]) / det
  return [l0.p[0] + l0.dir[0] * t, l0.p[1] + l0.dir[1] * t]
}

/* ---- the plan ---- */

const facade = (id: string): Facade => spec.facades.find(f => f.id === id)!
const thicknessOf = (f: Facade): number => spec.walls.find(w => w.facade_id === f.id)?.thickness_m ?? .6
const frame = (f: Facade): { dir: V2; out: V2 } => {
  const dx = (f.to[0] - f.from[0]) / f.length_m, dy = (f.to[1] - f.from[1]) / f.length_m
  return { dir: [dx, dy], out: [dy, -dx] }
}
const WEST = facade('F17'), BACK = facade('F16')
/** Linings stand this far in front of the shell's inner wall face. */
const LINING_GAP = .012
function innerLine(f: Facade): { p: V2; dir: V2 } {
  const fr = frame(f), t = thicknessOf(f) + LINING_GAP
  return { p: [f.from[0] - fr.out[0] * t, f.from[1] - fr.out[1] * t], dir: fr.dir }
}
const lineOf = (a: V2, b: V2): { p: V2; dir: V2 } => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return { p: a, dir: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] } }
/** The hall's clear outline, counter-clockwise from its south-west corner: the
 * kitchen partition (wA), the passage partition (wB), and the two exterior
 * walls moved onto the shell's inner faces. */
const [h0, h1, h2] = HALL.polygon as [V2, V2, V2, V2]
const HALL_SOUTH = lineOf(h0, h1), HALL_EAST = lineOf(h1, h2)
const HALL_NORTH = innerLine(BACK), HALL_WESTL = innerLine(WEST)
const SW = meet({ p: HALL_WESTL.p, dir: HALL_WESTL.dir }, HALL_SOUTH)
const SE = meet(HALL_SOUTH, HALL_EAST)
const NE = meet(HALL_EAST, { p: HALL_NORTH.p, dir: HALL_NORTH.dir })
const NW = meet({ p: HALL_NORTH.p, dir: HALL_NORTH.dir }, HALL_WESTL)
export const hallOutline: V2[] = [SW, SE, NE, NW]
/** The hall's own frame: u along the kitchen partition from the west wall,
 * v across the room toward the back wall. */
const U: V2 = (() => { const l = Math.hypot(SE[0] - SW[0], SE[1] - SW[1]); return [(SE[0] - SW[0]) / l, (SE[1] - SW[1]) / l] })()
const V: V2 = [-U[1], U[0]]
const toUV = (p: V2): V2 => [(p[0] - SW[0]) * U[0] + (p[1] - SW[1]) * U[1], (p[0] - SW[0]) * V[0] + (p[1] - SW[1]) * V[1]]
const fromUV = (u: number, v: number): V2 => [SW[0] + U[0] * u + V[0] * v, SW[1] + U[1] * u + V[1] * v]
const P = (u: number, v: number, z: number): V3 => { const q = fromUV(u, v); return [q[0], q[1], z] }
const HALL_W = toUV(SE)[0], HALL_D = toUV(NW)[1]
/** The service passage between the entrance and the hall, dossier outline. */
const LINK_OUTLINE: V2[] = (() => { const p = LINK.polygon as V2[]; return signedArea(p) < 0 ? [...p].reverse() : p })()

/** Where each door of the hall stands on its wall, in metres along the wall. */
const hallDoor = (to: string): RoomOpening => HALL.openings.find(o => o.connects_to === to)!
const KITCHEN_DOOR = hallDoor('kitchen'), LINK_DOOR = hallDoor('service-link')
/** the hall's two doors in its own frame: u or v range on their wall */
const kitchenDoorU: V2 = (() => { const a = toUV([h0[0] + HALL_SOUTH.dir[0] * KITCHEN_DOOR.from_m, h0[1] + HALL_SOUTH.dir[1] * KITCHEN_DOOR.from_m])[0]; return [a, a + KITCHEN_DOOR.width_m] })()
const linkDoorV: V2 = (() => { const a = toUV([h1[0] + HALL_EAST.dir[0] * LINK_DOOR.from_m, h1[1] + HALL_EAST.dir[1] * LINK_DOOR.from_m])[1]; return [a, a + LINK_DOOR.width_m] })()
const DOOR_H = Math.max(KITCHEN_DOOR.height_m, LINK_DOOR.height_m)

/* ---- the sink: one mesh, every surface a kind the material reads ---- */

/** Surface kinds, read by the material. */
export const K = { TILE: 0, JOINT: 1, PLASTER: 2, OAK: 3, STONE: 4, BRICK: 5, IRON: 6, BRASS: 7, GLAZE: 8, ASH: 9, CHAR: 10, WAX: 11, WEATHERED: 12 } as const
interface Vertex { p: V3; n: V3; t: V2; kind: number; seed: number; wear: number; soot: number; lit: number; cast: boolean; fixed?: [number, number] }
class Sink {
  v: Vertex[] = []
  /** per-emission defaults */
  wear = 0; soot = 0; lit = 1
  /** whether what is emitted next casts in the sun */
  cast = false
  /** the light baked once for what is emitted next; null to bake each vertex */
  fixed: [number, number] | null = null
  tri(a: V3, b: V3, c: V3, n: V3 | null, ta: V2, tb: V2, tc: V2, kind: number, seed: number): void {
    const g = cross(sub(b, a), sub(c, a))
    if (len(g) < 1e-10) return
    const normal = n ?? unit(g)
    const flip = dot(g, normal) < 0
    const order: [V3, V2][] = flip ? [[a, ta], [c, tc], [b, tb]] : [[a, ta], [b, tb], [c, tc]]
    for (const [p, t] of order) this.v.push({ p, n: normal, t, kind, seed, wear: this.wear, soot: this.soot, lit: this.lit, cast: this.cast, ...(this.fixed ? { fixed: this.fixed } : {}) })
  }
  quad(a: V3, b: V3, c: V3, d: V3, n: V3 | null, ta: V2, tb: V2, tc: V2, td: V2, kind: number, seed: number): void {
    this.tri(a, b, c, n, ta, tb, tc, kind, seed); this.tri(a, c, d, n, ta, tc, td, kind, seed)
  }
  /** A convex polygon, fanned, with one planar uv. */
  poly(pts: V3[], n: V3, uvOf: (p: V3) => V2, kind: number, seed: number): void {
    for (let k = 1; k < pts.length - 1; k++) this.tri(pts[0]!, pts[k]!, pts[k + 1]!, n, uvOf(pts[0]!), uvOf(pts[k]!), uvOf(pts[k + 1]!), kind, seed)
  }
  /** A turned body: a profile of [radius, height] revolved about an upright
   * axis at c, n facets round. */
  lathe(c: V3, profile: V2[], n: number, kind: number, seed: number): void {
    for (let i = 0; i < profile.length - 1; i++) {
      const [r0, z0] = profile[i]!, [r1, z1] = profile[i + 1]!
      for (let k = 0; k < n; k++) {
        const t0 = k / n * Math.PI * 2, t1 = (k + 1) / n * Math.PI * 2
        const P0 = (r: number, z: number, t: number): V3 => [c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r, c[2] + z]
        const tm = (t0 + t1) / 2, dz = z1 - z0, dr = r1 - r0, l = Math.hypot(dz, dr) || 1
        const nrm: V3 = [Math.cos(tm) * dz / l, Math.sin(tm) * dz / l, -dr / l]
        if (r0 < 1e-5 && r1 < 1e-5) continue
        this.quad(P0(r0, z0, t0), P0(r0, z0, t1), P0(r1, z1, t1), P0(r1, z1, t0), dot(nrm, nrm) > 0 ? nrm : null, [k / n, z0], [(k + 1) / n, z0], [(k + 1) / n, z1], [k / n, z1], kind, seed)
      }
    }
  }
  /** An oriented box: centre, three half axes; uv in metres along the first axis. */
  box(c: V3, ax: V3, ay: V3, az_: V3, kind: number, seed: number, skip: string = ''): void {
    const corner = (i: number, j: number, k: number): V3 => add(add(add(c, scale(ax, i)), scale(ay, j)), scale(az_, k))
    const faces: [string, V3, [number, number, number][]][] = [
      ['+x', ax, [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]], ['-x', scale(ax, -1), [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
      ['+y', ay, [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]], ['-y', scale(ay, -1), [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
      ['+z', az_, [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]], ['-z', scale(az_, -1), [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]]],
    ]
    const lx = len(ax), ly = len(ay), lz = len(az_)
    for (const [name, nrm, cs] of faces) {
      if (skip.includes(name)) continue
      const n = unit(nrm)
      const pts = cs.map(([i, j, k]) => corner(i, j, k))
      // a face standing on the floor is hidden by it
      if (n[2] < -.999 && pts.every(p => Math.abs(p[2] - FLOOR_Z) < .0025)) continue
      // uv: the face's two own axes, in metres, the longer one first, so a
      // grain laid along u runs along the member
      const uvs = cs.map(([i, j, k]): V2 => {
        const [p, q, lp, lq] = name[1] === 'x' ? [j, k, ly, lz] : name[1] === 'y' ? [i, k, lx, lz] : [i, j, lx, ly]
        return lp >= lq ? [p * lp, q * lq] : [q * lq, p * lp]
      })
      this.quad(pts[0]!, pts[1]!, pts[2]!, pts[3]!, n, uvs[0]!, uvs[1]!, uvs[2]!, uvs[3]!, kind, seed)
    }
  }
}

/* ---- the openings the bake sees ---- */

interface Aperture { corners: V3[]; inward: V3; radiance: number; name: string }
function facadeAperture(f: Facade, id: string, radiance: number): { ap: Aperture; o: Opening } {
  const o = f.openings.find(x => x.id === id)!, fr = frame(f), t = thicknessOf(f) + LINING_GAP
  const at = (a: number, z: number): V3 => [f.from[0] + fr.dir[0] * a - fr.out[0] * t, f.from[1] + fr.dir[1] * a - fr.out[1] * t, z]
  const corners = [at(o.from_m, o.base_m), at(o.from_m + o.width_m, o.base_m), at(o.from_m + o.width_m, o.base_m + o.height_m), at(o.from_m, o.base_m + o.height_m)]
  return { ap: { corners, inward: [-fr.out[0], -fr.out[1], 0], radiance, name: id }, o }
}
/** The west windows look over the sunlit terrace and garden; the back ones
 * onto the north sky and a shaded court. Leading, bars and the stone cross
 * take about a third of each light. */
const TRANSMIT = .62
const WINDOWS = HALL_WINDOWS.map(id => {
  const west = id.startsWith('west')
  return { ...facadeAperture(west ? WEST : BACK, id, west ? 1.35 : .85), west, facade: west ? WEST : BACK }
})

/** THE SHELL'S STONE CROSS AND GLASS LINE, as `shell.ts` draws a window: a
 * 0.12 m mullion whose inner face stands 0.21 m behind the wall face, a
 * 0.105 m transom at 0.63 of the height with its inner face at 0.205 m, and
 * the leaded glass 38 mm behind the face. */
const MULLION_M = .12, MULLION_IN = .21, TRANSOM_M = .105, TRANSOM_IN = .205, TRANSOM_AT = .63, GLASS_IN = .038
/** the four lights of a cross window, in facade metres: along and height */
function lightsOf(o: Opening): [number, number, number, number][] {
  const x = o.from_m, w = o.width_m, z = o.base_m, h = o.height_m, transom = z + h * TRANSOM_AT
  const cols: V2[] = [[x, x + w / 2 - MULLION_M / 2], [x + w / 2 + MULLION_M / 2, x + w]]
  const rows: V2[] = [[z + .01, transom - TRANSOM_M / 2], [transom + TRANSOM_M / 2, z + h]]
  return cols.flatMap(c => rows.map(r => [c[0], c[1], r[0], r[1]] as [number, number, number, number]))
}
/** Diamond quarries of 155 mm sides on a 45 degree lattice centred on each
 * light, as the house's glazing lays them; 7 mm cames, 14 mm at the border. */
const QUARRY_M = .155, QUARRY_STEP = QUARRY_M * Math.SQRT2, CAME_HALF = .0035, BORDER_HALF = .007

/** Where the hour's sun lands on the floor through one window, after the
 * wall's own depth has trimmed the beam. */
function sunPatch(f: Facade, o: Opening, room: V2[], level: number): V3[] | null {
  const fr = frame(f), outward: V3 = [fr.out[0], fr.out[1], 0], along: V3 = [fr.dir[0], fr.dir[1], 0]
  const facing = dot(TO_SUN, outward)
  if (facing < .05) return null
  const t = thicknessOf(f)
  const du = -t * dot(TO_SUN, along) / facing, dz = -t * TO_SUN[2] / facing
  const u0 = Math.max(o.from_m, o.from_m + du), u1 = Math.min(o.from_m + o.width_m, o.from_m + o.width_m + du)
  const z0 = Math.max(o.base_m, o.base_m + dz, level), z1 = Math.min(o.base_m + o.height_m, o.base_m + o.height_m + dz)
  if (u1 - u0 < .05 || z1 - z0 < .05) return null
  const at = (u: number, z: number): V3 => [f.from[0] + fr.dir[0] * u - fr.out[0] * t, f.from[1] + fr.dir[1] * u - fr.out[1] * t, z]
  const onFloor = (p: V3): V2 => { const s = (p[2] - level) / TO_SUN[2]; return [p[0] - TO_SUN[0] * s, p[1] - TO_SUN[1] * s] }
  const patch = clipConvex([at(u0, z0), at(u1, z0), at(u1, z1), at(u0, z1)].map(onFloor), room)
  return patch.length < 3 ? null : patch.map(p => [p[0], p[1], level] as V3)
}
const PATCHES = WINDOWS.filter(w => w.west).map(w => sunPatch(w.facade, w.o, hallOutline, FLOOR_Z)).filter((p): p is V3[] => p !== null)

/** Form factor from a point with normal n to a planar polygon, by fanned
 * barycentric sampling. */
function formFactor(p: V3, n: V3, polygon: V3[], normal: V3, steps: number): number {
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

/** THE HALL SEEN THROUGH ITS DOORS: the two compositions the hall station's
 * close looks stand, each eye a stride back from a doorway of the hall, in
 * east, north and height. */
export function hallView(id: 'great-hall' | 'great-hall-door', narrow: boolean): { eye: V3; at: V3; fov: number } {
  const eyeZ = FLOOR_Z + 1.62
  if (id === 'great-hall-door') {
    const v = (linkDoorV[0] + linkDoorV[1]) / 2, e = fromUV(HALL_W + 1.25, v), a = fromUV(0, v - .35)
    return { eye: [e[0], e[1], eyeZ], at: [a[0], a[1], FLOOR_Z + (narrow ? .95 : 1.3)], fov: narrow ? 74 : 52 }
  }
  const u = (kitchenDoorU[0] + kitchenDoorU[1]) / 2, e = fromUV(u, -.26), a = fromUV(u + 1.1, HALL_D * .86)
  return { eye: [e[0], e[1], eyeZ], at: [a[0], a[1], FLOOR_Z + (narrow ? .8 : 1.15)], fov: narrow ? 78 : 58 }
}

/* ---- the entrance, as the landing sees it ---- */

const ENTRY_F = facade('ENTRY')
const ENTRANCE = ENTRY_F.openings.find(o => o.id === 'entrance-door')!
const ENTRANCE_WINDOW = ENTRY_F.openings.find(o => o.id === 'entrance-window')!
const ENTRY_ROOM = ground.rooms.find(r => r.id === 'entry')!
/** A facade opening as an emitter at the wall's outer face, facing in. */
function outerAperture(f: Facade, o: Opening): { corners: V3[]; inward: V3 } {
  const fr = frame(f), at = (a: number, z: number): V3 => [f.from[0] + fr.dir[0] * a, f.from[1] + fr.dir[1] * a, z]
  return { corners: [at(o.from_m, o.base_m), at(o.from_m + o.width_m, o.base_m), at(o.from_m + o.width_m, o.base_m + o.height_m), at(o.from_m, o.base_m + o.height_m)], inward: [-fr.out[0], -fr.out[1], 0] }
}
const COURT_DOOR = outerAperture(ENTRY_F, ENTRANCE), COURT_WINDOW = outerAperture(ENTRY_F, ENTRANCE_WINDOW)
/** the passage's own door to the inner service passage, on its west partition */
const PASSAGE_DOOR: { corners: V3[]; inward: V3 } = (() => {
  const o = ENTRY_ROOM.openings.find(x => x.connects_to === 'service-link')!
  const p = ENTRY_ROOM.polygon as V2[], a = p[3]!, b = p[0]!, l = Math.hypot(b[0] - a[0], b[1] - a[1])
  const d: V2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
  const at = (t: number, z: number): V3 => [a[0] + d[0] * t, a[1] + d[1] * t, z]
  const z0 = FLOOR_Z, z1 = FLOOR_Z + o.height_m
  return { corners: [at(o.from_m, z0), at(o.from_m + o.width_m, z0), at(o.from_m + o.width_m, z1), at(o.from_m, z1)], inward: [-d[1], d[0], 0] }
})()
/** THE ENTRANCE PASSAGE'S LIGHT, baked once: what a point sees of the court
 * through the open door and the window beside it, and of the warm light the
 * great hall sends through the service passage's door. */
export function passageLight(at: V3, n: V3): [number, number] {
  const court = formFactor(at, n, COURT_DOOR.corners, COURT_DOOR.inward, 3) + formFactor(at, n, COURT_WINDOW.corners, COURT_WINDOW.inward, 2) * TRANSMIT
  const hall = formFactor(at, n, PASSAGE_DOOR.corners, PASSAGE_DOOR.inward, 2)
  return [Math.min(1, .03 + court * 2.2), hall * .9 + court * .12]
}

/** The passage's baked light, laid on a material of the entrance passage:
 * ambient occlusion from what each point sees of the court, and the warm
 * light of the hall arriving through the side door. `engineBounce`. */
export function applyPassageLight(m: MeshStandardNodeMaterial, perPixel = true): void {
  const light = perPixel ? passageLightNode() : attribute('passage', 'vec2')
  m.aoNode = clamp(light.x, 0, 1)
  const base = m.colorNode ?? vec3(.5, .5, .5)
  m.emissiveNode = base.mul(vec3(1, .74, .52).mul(light.y.mul(.9)).add(vec3(.16, .14, .115).mul(light.x)))
  m.userData['engineBounce'] = true
}
/** The same light as `passageLight`, per point of the surface. */
function passageLightNode(): N {
  const inside: V3 = (() => { const p = ENTRY_ROOM.polygon as V2[]; return [p.reduce((a, q) => a + q[0], 0) / 4, p.reduce((a, q) => a + q[1], 0) / 4, FLOOR_Z + 1.5] })()
  const court = formFactorNode(COURT_DOOR.corners, inside).add(formFactorNode(COURT_WINDOW.corners, inside).mul(TRANSMIT))
  const hall = formFactorNode(PASSAGE_DOOR.corners, inside)
  return vec2(min(float(1), court.mul(2.2).add(.03)), hall.mul(.9).add(court.mul(.12)))
}

/** THE ENTRANCE'S OWN LEAF, drawn again in the certified leaf's volume: five
 * oak boards weathered silver on the face the court sees, two strap hinges
 * with spear ends, three rows of clout nails over the ledges behind, a ring
 * and a lock plate. A door of the type the entrance photographs show; its
 * ironwork is a type of the period. */
function entranceLeaf(s: Sink): void {
  const f = ENTRY_F, fr = frame(f), o = ENTRANCE, t = thicknessOf(f)
  const x = o.from_m + .02, zc = o.base_m + o.height_m / 2, hh = (o.height_m - .07) / 2, hw = o.width_m * .91 / 2
  const c: V3 = [f.from[0] + fr.dir[0] * x - fr.out[0] * (t + .43), f.from[1] + fr.dir[1] * x - fr.out[1] * (t + .43), zc]
  // leaf frame: a across its thickness (the face the landing sees is +a),
  // b across its width into the passage, z up
  const A: V3 = [fr.dir[0], fr.dir[1], 0], Bv: V3 = [-fr.out[0], -fr.out[1], 0], Z: V3 = [0, 0, 1]
  const at = (a: number, b: number, z: number): V3 => add(add(add(c, scale(A, a)), scale(Bv, b)), scale(Z, z))
  const lbox = (a0: number, a1: number, b0: number, b1: number, z0: number, z1: number, kind: number, seed: number): void =>
    s.box(at((a0 + a1) / 2, (b0 + b1) / 2, (z0 + z1) / 2), scale(A, (a1 - a0) / 2), scale(Bv, (b1 - b0) / 2), scale(Z, (z1 - z0) / 2), kind, seed)
  // the hinge edge stands at the jamb's inner end, clear of its reveal
  const jambEnd = t + .11 - .09 + .005, hinge = -(t + .43) + jambEnd
  const th = .0225, boards = 5, bw = (hw - hinge) / boards, lift = .01
  s.fixed = null
  for (let i = 0; i < boards; i++) {
    const b0 = hinge + i * bw + .0015, b1 = hinge + (i + 1) * bw - .0015
    // the court face weathered, the passage face and edges oak
    lbox(0, th, b0, b1, -hh + lift, hh, K.WEATHERED, 160 + i)
    lbox(-th, 0, b0, b1, -hh + lift, hh, K.WAX, 165 + i)
  }
  // the grooves between boards read dark: a thin fill set back
  lbox(-th + .004, th - .004, hinge, hw, -hh + lift, hh, K.CHAR, 170)
  // strap hinges from the hinge edge, spear-ended, nailed through
  for (const z of [-hh + .32, hh - .32]) {
    lbox(th, th + .005, hinge - .005, hw * .62, z - .024, z + .024, K.IRON, 171)
    lbox(th, th + .005, hw * .62, hw * .76, z - .04, z + .04, K.IRON, 171)
    for (let k = 0; k < 6; k++) lbox(th + .005, th + .009, hinge + .06 + k * .14, hinge + .075 + k * .14, z - .007, z + .007, K.IRON, 172)
  }
  // clout nails over the three ledges
  for (const z of [-hh + .6, 0, hh - .6]) for (let k = 0; k < boards * 2; k++) {
    const b = hinge + bw / 4 + k * bw / 2
    lbox(th, th + .004, b - .007, b + .007, z - .007, z + .007, K.IRON, 173)
  }
  // the ring on its plate and the lock plate below
  lbox(th, th + .004, hw - .26, hw - .15, .02, .13, K.IRON, 174)
  for (let k = 0; k < 10; k++) {
    const t0 = k / 10 * Math.PI * 2, r = .045
    lbox(th + .004, th + .014, hw - .205 + Math.cos(t0) * r - .006, hw - .205 + Math.cos(t0) * r + .006, -.03 + Math.sin(t0) * r - .006, -.03 + Math.sin(t0) * r + .006, K.IRON, 175)
  }
  lbox(th, th + .004, hw - .24, hw - .16, -.26, -.12, K.IRON, 176)
}
/** The entrance's two reveals, faced where the landing sees them: the
 * doorway's jambs are tuffeau in courses, set a hair in front of the shell's
 * own faces, which stay certified. */
function entranceReveals(s: Sink): void {
  const f = ENTRY_F, fr = frame(f), o = ENTRANCE, t = thicknessOf(f)
  const at = (a: number, out: number, z: number): V3 => [f.from[0] + fr.dir[0] * a + fr.out[0] * out, f.from[1] + fr.dir[1] * a + fr.out[1] * out, z]
  const z0 = o.base_m, z1 = o.base_m + o.height_m
  for (const [a, sign] of [[o.from_m + .008, 1], [o.from_m + o.width_m - .008, -1]] as [number, number][]) {
    const n: V3 = [fr.dir[0] * sign, fr.dir[1] * sign, 0]
    // up to the leaf on the hinge side, the full depth on the other
    const deep = sign > 0 ? t + .11 - .09 - .004 : t + .105
    s.quad(at(a, .085, z0), at(a, -deep, z0), at(a, -deep, z1), at(a, .085, z1), n, [.085, z0], [-deep, z0], [-deep, z1], [.085, z1], K.STONE, 180 + sign)
  }
}

/* ---- light per point, in the shader ---- */

/** The analytic form factor of a planar polygon of emitters from a point, by
 * the contour integral (Lambert's vector irradiance). The polygon is wound
 * so that its own normal points away from the side the receivers stand on;
 * a point behind it reads zero. East, north, up. */
function windFront(poly: V3[], front: V3): V3[] {
  const n = cross(sub(poly[1]!, poly[0]!), sub(poly[2]!, poly[0]!))
  return dot(n, sub(front, poly[0]!)) > 0 ? [...poly].reverse() : poly
}
function formFactorNode(poly: V3[], front: V3): N {
  const P = positionWorld, Nw = normalWorld
  const pts = windFront(poly, front).map(p => vec3(p[0], p[2], -p[1]).sub(P).normalize())
  let sum: N = float(0)
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    const g = a.cross(b)
    sum = sum.add(acos(clamp(a.dot(b), -.9999, .9999)).mul(Nw.dot(g.div(g.length().max(1e-6)))))
  }
  return sum.div(2 * Math.PI).max(0)
}

export const houseHallProvenance = {
  manifestId: 'vinci/house-hall',
  assetClass: 'GENERATED',
  certainty: 'assumed',
  source: ['A-LAYOUT', 'A-HEIGHT', 'A-MASONRY', 'A-FURNITURE', 'Q144', 'MADE-THINGS'],
  recipe: 'The dossier\'s great hall (A-LAYOUT room hall) and the inner service passage beside it: fabric, chimneypiece, types of the period, the light of the hour.',
  /** the record behind the hall's drawer paragraph */
  record: {
    en: 'Proposed great hall, A-LAYOUT room hall: 8.65 by 8.05 m clear, floor +0.80 m, clear height 3.20 m (A-HEIGHT). Terracotta tiles of 0.22 m with 8 mm joints laid at 45 degrees (read from Q144) inside a square border row, each tile its own firing and bed. Limewash on the walls, oak joists 0.18 by 0.23 m at 0.60 m (A-MASONRY) resting on a 0.34 by 0.38 m main beam carried by two tuffeau corbels. Chimneypiece in A-FURNITURE\'s 2.80 by 0.65 by 3.00 m envelope at its registered place: moulded jambs, a chamfered lintel and shelf, a coursed tuffeau hood, a brick fireback, a banked fire\'s ash and two charred ends on a pair of andirons of a generic type. Window seats in the embrasures. The inner service passage (A-LAYOUT room service-link) as fabric only. The entrance\'s leaf is drawn again in its certified volume, planked, with strap hinges, clout nails, a ring and a lock plate of the period\'s type. Light at 15:19 on 10 October 1517: the sun through the two west windows by the key light, with the windows\' stone cross, saddle bars and leads read in the sun patches; the room\'s return from the windows and the patches and the shafts of lit dust are engine terms the film replaces.',
    de: 'Vorgeschlagener großer Saal, A-LAYOUT Raum hall: 8,65 mal 8,05 m lichte Weite, Boden +0,80 m, lichte Höhe 3,20 m (A-HEIGHT). Terrakottafliesen von 0,22 m mit 8 mm Fugen, im Winkel von 45 Grad verlegt (nach Q144) innerhalb einer geraden Randreihe, jede Fliese mit eigenem Brand und Bett. Kalktünche an den Wänden, Eichenbalken 0,18 mal 0,23 m im Abstand von 0,60 m (A-MASONRY) auf einem Unterzug von 0,34 mal 0,38 m über zwei Tuffeaukonsolen. Kamin im Umriss von A-FURNITURE, 2,80 mal 0,65 mal 3,00 m, an seiner registrierten Stelle: profilierte Wangen, ein gefaster Sturz mit Sims, ein geschichteter Rauchfang aus Tuffeau, eine Rückwand aus Ziegel, die Asche eines abgedeckten Feuers und zwei verkohlte Scheite auf einem Paar Feuerböcke allgemeiner Art. Fenstersitze in den Laibungen. Der innere Dienstgang (A-LAYOUT Raum service-link) nur als Baukörper. Der Türflügel des Eingangs ist in seinem zertifizierten Volumen neu gezeichnet, aus Bohlen, mit Langbändern, Ziernägeln, einem Ring und einem Schlossblech von der Art der Zeit. Licht um 15:19 am 10. Oktober 1517: die Sonne durch die beiden Westfenster als Hauptlicht, mit dem Steinkreuz, den Windeisen und den Bleiruten der Fenster in den Sonnenflecken; die Rückstrahlung des Raums von Fenstern und Flecken und die Bahnen beleuchteten Staubs sind Terme der Engine, die der Film ersetzt.',
  },
  /** the record behind the drawer paragraph on the things in the hall */
  thingsRecord: {
    en: 'Types of the period, none documented at Cloux (MADE-THINGS, Part A). Table and bench: A-FURNITURE\'s envelopes, 3.40 by 1.00 m at 0.78 m and 2.80 by 0.40 m at 0.48 m, as boards on two trestles and a plank on slab ends. Chest after V&A W.38-1938 (carved oak, French, 1520; 0.776 by 1.355 by 0.605 m), frame and panels with linenfold, lock plate after V&A 1319-1901 (France, about 1500 to 1530). Box chair after V&A 740-1895 (France, about 1515; 1.11 m high). Stools after V&A 968-1897 (oak, Normandy, late fifteenth century; 0.455 m high). Candlesticks after V&A M.435-1926 (brass, Flemish, late fifteenth to early sixteenth century), unlit. Jug after V&A C.185-1909 (Beauvais, dark green glaze). Andirons of a generic type: no French museum object of 1500 to 1520 was found for them. The will of 23 April 1519 leaves the furniture and utensils of the house at Cloux to Battista de Vilanis and names no piece.',
    de: 'Typen der Zeit, keiner in Cloux belegt (MADE-THINGS, Teil A). Tisch und Bank: die Umrisse von A-FURNITURE, 3,40 mal 1,00 m bei 0,78 m und 2,80 mal 0,40 m bei 0,48 m, als Bretter auf zwei Böcken und als Bohle auf Brettwangen. Truhe nach V&A W.38-1938 (geschnitzte Eiche, französisch, 1520; 0,776 mal 1,355 mal 0,605 m), Rahmen und Füllungen mit Faltwerk, Schlossblech nach V&A 1319-1901 (Frankreich, um 1500 bis 1530). Kastenstuhl nach V&A 740-1895 (Frankreich, um 1515; 1,11 m hoch). Hocker nach V&A 968-1897 (Eiche, Normandie, spätes fünfzehntes Jahrhundert; 0,455 m hoch). Leuchter nach V&A M.435-1926 (Messing, flämisch, spätes fünfzehntes bis frühes sechzehntes Jahrhundert), nicht entzündet. Krug nach V&A C.185-1909 (Beauvais, dunkelgrüne Glasur). Feuerböcke allgemeiner Art: für sie fand sich kein französisches Museumsstück von 1500 bis 1520. Das Testament vom 23. April 1519 vermacht Battista de Vilanis die Möbel und Geräte des Hauses in Cloux und nennt kein Stück.',
  },
} as const

export interface HouseHall { group: Group; triangles: number; patches: number }

/** Build the hall. `cell` is the lining grid the light is baked on. */
/** The vertex bake is what the lighter tier reads; the hero tier lights every
 * point in the shader and skips it. */
let bakeVertices = true
export function createHouseHall(tier: TierName, library?: MaterialLibrary): HouseHall {
  const hero = tier === 'hero'
  bakeVertices = !hero
  const s = new Sink()
  buildHallShell(s, hero)
  buildLink(s, hero)
  s.lit = 2
  entranceLeaf(s)
  entranceReveals(s)
  s.lit = 1
  const material = hallMaterial(hero, library)
  const fabric = new Mesh(bake(s, false), material)
  fabric.name = 'vinci/house-hall/fabric'
  fabric.castShadow = false; fabric.receiveShadow = true
  const things = new Mesh(bake(s, true), material)
  things.name = 'vinci/house-hall/things'
  things.castShadow = true; things.receiveShadow = true
  const group = new Group(); group.name = 'vinci/house-hall'
  for (const mesh of [fabric, things]) { mesh.userData['manifestId'] = houseHallProvenance.manifestId; mesh.userData['asset'] = houseHallProvenance.manifestId; group.add(mesh) }
  const glass = innerGlass()
  group.add(glass)
  const dust = hero ? dustBeams() : null
  if (dust) group.add(dust)
  group.userData['manifestId'] = houseHallProvenance.manifestId
  const triangles = s.v.length / 3
  group.userData['triangles'] = triangles
  return { group, triangles, patches: PATCHES.length }
}

/* ---- the hall's fabric ---- */

function buildHallShell(s: Sink, hero: boolean): void {
  const seed = .37
  // THE FLOOR. A border row laid square along the walls, the field on the
  // diagonal inside it (Q144), each tile its own firing, its own bed.
  if (hero) tiledFloor(s, hallOutline, FLOOR_Z)
  else flatFloor(s, hallOutline, FLOOR_Z, .6)
  // THE LININGS: limewash from the tiles to the boards, cut at every opening.
  const cell = hero ? .32 : .7
  const walls: { a: V2; b: V2; holes: [number, number, number, number][] }[] = []
  const alongWall = (a: V2, b: V2, p: V2): number => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l }
  const hole = (a: V2, b: V2, f: Facade, o: Opening): [number, number, number, number] => {
    const fr = frame(f)
    const p0: V2 = [f.from[0] + fr.dir[0] * o.from_m, f.from[1] + fr.dir[1] * o.from_m]
    const p1: V2 = [f.from[0] + fr.dir[0] * (o.from_m + o.width_m), f.from[1] + fr.dir[1] * (o.from_m + o.width_m)]
    const s0 = alongWall(a, b, p0), s1 = alongWall(a, b, p1)
    return [Math.min(s0, s1), Math.max(s0, s1), o.base_m, o.base_m + o.height_m]
  }
  const south = { a: SW, b: SE, holes: [[kitchenDoorU[0], kitchenDoorU[1], FLOOR_Z, FLOOR_Z + DOOR_H]] as [number, number, number, number][] }
  const east = { a: SE, b: NE, holes: [[linkDoorV[0], linkDoorV[1], FLOOR_Z, FLOOR_Z + DOOR_H]] as [number, number, number, number][] }
  const north = { a: NE, b: NW, holes: WINDOWS.filter(w => !w.west).map(w => hole(NE, NW, BACK, w.o)) }
  const west = { a: NW, b: SW, holes: WINDOWS.filter(w => w.west).map(w => hole(NW, SW, WEST, w.o)) }
  walls.push(south, east, north, west)
  for (const w of walls) lining(s, w.a, w.b, FLOOR_Z, BOARD_Z, w.holes, cell, K.PLASTER, seed)
  // THE CEILING: boards between oak joists that run across the shorter span,
  // carried at mid-span by a main beam on two tuffeau corbels. It casts: the
  // rooms above take the sun through their own windows, and their floors
  // cast nothing.
  s.cast = true
  ceiling(s)
  s.cast = false
  // Window embrasures: a tuffeau seat at the sill of every window, and the
  // room's face of each stone cross.
  for (const w of WINDOWS) { windowSeat(s, w.facade, w.o); crossFace(s, w.facade, w.o) }
  // The chimneypiece A-FURNITURE proposes on the passage wall, and the few
  // things of the period that stand in the hall. Both cast in the sun.
  s.cast = true
  hearth(s, hero)
  furnish(s, hero)
  s.cast = false
  // Door reveals through the partitions.
  doorReveal(s, 'kitchen')
  doorReveal(s, 'service-link')
}

/** One wall's lining, from a to b (the room on its left), cut at the holes,
 * on a grid whose lines fall on every hole edge. */
function lining(s: Sink, a: V2, b: V2, z0: number, z1: number, holes: [number, number, number, number][], cell: number, kind: number, seed: number): void {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy)
  const inward: V3 = [-dy / l, dx / l, 0]
  const breaks = (lo: number, hi: number, cuts: number[]): number[] => {
    const keep = [...new Set([lo, hi, ...cuts.filter(c => c > lo + .02 && c < hi - .02)])].sort((x, y) => x - y)
    const out: number[] = [keep[0]!]
    for (let k = 1; k < keep.length; k++) { const p = keep[k - 1]!, q = keep[k]!, n = Math.max(1, Math.ceil((q - p) / cell)); for (let i = 1; i <= n; i++) out.push(p + (q - p) * i / n) }
    return out
  }
  const ss = breaks(0, l, holes.flatMap(h => [h[0], h[1]])), zs = breaks(z0, z1, holes.flatMap(h => [h[2], h[3]]))
  const at = (t: number, z: number): V3 => [a[0] + dx / l * t, a[1] + dy / l * t, z]
  for (let i = 0; i < ss.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const t0 = ss[i]!, t1 = ss[i + 1]!, q0 = zs[j]!, q1 = zs[j + 1]!
    const mt = (t0 + t1) / 2, mz = (q0 + q1) / 2
    if (holes.some(h => mt > h[0] && mt < h[1] && mz > h[2] && mz < h[3])) continue
    s.quad(at(t0, q0), at(t1, q0), at(t1, q1), at(t0, q1), inward, [t0, q0], [t1, q0], [t1, q1], [t0, q1], kind, seed)
  }
}

/** A plain floor on a grid, for the tier that cannot afford the tiles. */
function flatFloor(s: Sink, outline: V2[], z: number, cell: number): void {
  const uvs = outline.map(toUV), us = uvs.map(p => p[0]), vs = uvs.map(p => p[1])
  const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs)
  const nu = Math.ceil((u1 - u0) / cell), nv = Math.ceil((v1 - v0) / cell)
  const room = outline.map(toUV)
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const c = clipConvex([[u0 + (u1 - u0) * i / nu, v0 + (v1 - v0) * j / nv], [u0 + (u1 - u0) * (i + 1) / nu, v0 + (v1 - v0) * j / nv],
      [u0 + (u1 - u0) * (i + 1) / nu, v0 + (v1 - v0) * (j + 1) / nv], [u0 + (u1 - u0) * i / nu, v0 + (v1 - v0) * (j + 1) / nv]], room)
    if (c.length < 3 || Math.abs(signedArea(c)) < 1e-4) continue
    s.poly(c.map(q => P(q[0], q[1], z)), [0, 0, 1], p => toUV([p[0], p[1]]), K.TILE, -1)
  }
}

/** The tiled floor: a square border row and the diagonal field, each tile a
 * low prism with a worn arris, standing on its lime bed. */
function tiledFloor(s: Sink, outline: V2[], z: number): void {
  const room = outline.map(toUV)
  // the lime bed under everything, a few millimetres down
  s.poly(room.map(q => P(q[0], q[1], z - .006)), [0, 0, 1], p => toUV([p[0], p[1]]), K.JOINT, .5)
  const pitch = TILE_M + JOINT_M
  const field = inset(room, pitch)
  // border row: along each wall between the field's corners, square tiles;
  // the four corners take one square each
  for (let e = 0; e < room.length; e++) {
    const a = room[e]!, b = room[(e + 1) % room.length]!, l = Math.hypot(b[0] - a[0], b[1] - a[1])
    const d: V2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], inward: V2 = [-d[1], d[0]]
    const fa = field[e]!, fb = field[(e + 1) % field.length]!
    const s0 = (fa[0] - a[0]) * d[0] + (fa[1] - a[1]) * d[1], s1 = (fb[0] - a[0]) * d[0] + (fb[1] - a[1]) * d[1]
    const n = Math.max(1, Math.round((s1 - s0) / pitch)), step = (s1 - s0) / n
    const strip = (from: number, to: number, key: number): void => {
      const quad: V2[] = [[from + JOINT_M / 2, JOINT_M / 2], [to - JOINT_M / 2, JOINT_M / 2], [to - JOINT_M / 2, pitch - JOINT_M / 2], [from + JOINT_M / 2, pitch - JOINT_M / 2]]
        .map(([x, y]) => [a[0] + d[0] * x! + inward[0] * y!, a[1] + d[1] * x! + inward[1] * y!])
      const clipped = clipConvex(quad, room)
      if (clipped.length >= 3 && Math.abs(signedArea(clipped)) > 1e-4) tile(s, clipped, z, rand(e, key, 7.1))
    }
    for (let i = 0; i < n; i++) strip(s0 + i * step, s0 + (i + 1) * step, i)
    // the corner square at this edge's start
    strip(Math.min(0, s0 - pitch), s0, -1)
  }
  // the field on the diagonal, centred on the room
  const cu = (Math.min(...field.map(p => p[0])) + Math.max(...field.map(p => p[0]))) / 2
  const cv = (Math.min(...field.map(p => p[1])) + Math.max(...field.map(p => p[1]))) / 2
  const A: V2 = [Math.cos(TILE_TURN), Math.sin(TILE_TURN)], B: V2 = [-A[1], A[0]]
  const reach = Math.ceil(Math.hypot(HALL_W, HALL_D) / pitch / 2) + 2
  const half = TILE_M / 2
  for (let i = -reach; i <= reach; i++) for (let j = -reach; j <= reach; j++) {
    const c: V2 = [cu + (A[0] * i + B[0] * j) * pitch, cv + (A[1] * i + B[1] * j) * pitch]
    const quad: V2[] = [[-half, -half], [half, -half], [half, half], [-half, half]].map(([x, y]) => [c[0] + A[0] * x! + B[0] * y!, c[1] + A[1] * x! + B[1] * y!])
    const clipped = clipConvex(quad, field)
    if (clipped.length < 3 || Math.abs(signedArea(clipped)) < TILE_M * TILE_M * .12) continue
    tile(s, clipped, z, rand(i, j, 3.3))
  }
}

/** One tile on its lime bed, its face set a hair high or low and tilted a
 * fraction, so no two catch the low sun alike. */
function tile(s: Sink, poly: V2[], z: number, seed: number): void {
  const n = poly.length
  const c: V2 = [poly.reduce((a, p) => a + p[0], 0) / n, poly.reduce((a, p) => a + p[1], 0) / n]
  // none is laid under the hearthstone
  const hs = HEARTH.width / 2 + .05 + .16, hd = HEARTH.depth + .42 + .012 + .16
  if (c[0] > HALL_W - hd && Math.abs(c[1] - HEARTH.v) < hs) return
  const top = z + (rand(seed, 1) - .6) * .0016
  const tiltU = (rand(seed, 2) - .5) * .006, tiltV = (rand(seed, 3) - .5) * .006
  const h = (q: V2): number => top + (q[0] - c[0]) * tiltU + (q[1] - c[1]) * tiltV
  const P3 = (q: V2, zz: number): V3 => P(q[0], q[1], zz)
  const uvOf = (p: V3): V2 => toUV([p[0], p[1]])
  s.fixed = bakeVertices ? bakePoint(P3(c, z + .01), [0, 0, 1], true) : [0, 0]
  s.wear = floorWear(c)
  // one face per tile: an eased arris would stand under a pixel from the walk
  const facePts = poly.map(q => P3(q, h(q)))
  s.poly(facePts, unit(cross(sub(facePts[1]!, facePts[0]!), sub(facePts[2]!, facePts[0]!))), uvOf, K.TILE, seed)
  s.fixed = null; s.wear = 0
}

/** Joists across the shorter span, the main beam under them at mid-span on
 * two corbels, the boards between. */
function ceiling(s: Sink): void {
  const room = hallOutline.map(toUV)
  // boards: the underside of the floor above, planks along u
  const plank = .26
  for (let v = 0; v < HALL_D; v += plank) {
    const v1 = Math.min(HALL_D + .5, v + plank)
    const strip = clipConvex([[-1, v], [HALL_W + 1, v], [HALL_W + 1, v1], [-1, v1]], room)
    if (strip.length < 3) continue
    const board = rand(v, 9.2)
    s.poly(strip.map(q => P(q[0], q[1], BOARD_Z)), [0, 0, -1], p => { const q = toUV([p[0], p[1]]); return [q[0], q[1]] }, K.OAK, 2 + board)
  }
  // joists: along v, stepped along u, from the kitchen wall to the back wall
  const jn = Math.floor((HALL_W - JOIST_W) / JOIST_STEP)
  const first = (HALL_W - jn * JOIST_STEP) / 2
  for (let i = 0; i <= jn; i++) {
    const u = first + i * JOIST_STEP
    const seed = 3 + rand(i, 4.4)
    const v0 = 0, v1 = HALL_D
    const sag = rand(i, 5.5) * .008
    const cA = P(u, (v0 + v1) / 2, CEIL_Z + JOIST_D / 2 + sag)
    s.box(cA, [U[0] * JOIST_W / 2, U[1] * JOIST_W / 2, 0], [V[0] * (v1 - v0) / 2, V[1] * (v1 - v0) / 2, 0], [0, 0, JOIST_D / 2], K.OAK, seed, '+z+y-y')
  }
  // the main beam, across the joists at mid-span
  const MB_W = .34, MB_D = .38, vm = HALL_D / 2
  s.box(P(HALL_W / 2, vm, CEIL_Z - MB_D / 2), [U[0] * HALL_W / 2, U[1] * HALL_W / 2, 0], [V[0] * MB_W / 2, V[1] * MB_W / 2, 0], [0, 0, MB_D / 2], K.OAK, 7.7, '+z+x-x')
  // its two corbels, stepped tuffeau blocks built into the walls
  for (const [u, dirU] of [[0, 1], [HALL_W, -1]] as [number, number][]) {
    for (const [depth, height, zTop] of [[.34, .22, CEIL_Z - MB_D], [.22, .18, CEIL_Z - MB_D - .22]] as [number, number, number][]) {
      s.box(P(u + dirU * depth / 2, vm, zTop - height / 2), [U[0] * depth / 2, U[1] * depth / 2, 0], [V[0] * (MB_W + .06) / 2, V[1] * (MB_W + .06) / 2, 0], [0, 0, height / 2], K.STONE, 11 + u, dirU > 0 ? '-x' : '+x')
    }
  }
}

/** WHERE FEET HAVE GONE for forty-six years: from each door to the table's
 * sides and on to the hearth, and the ground in front of the fire. */
let paths: [V2, V2][] | null = null
const pathsOf = (): [V2, V2][] => paths ??= (() => {
  const ku = (kitchenDoorU[0] + kitchenDoorU[1]) / 2, lv = (linkDoorV[0] + linkDoorV[1]) / 2
  const hearthFront: V2 = [HALL_W - HEARTH.depth - .6, HEARTH.v]
  const tableEast: V2 = [TABLE.u + .95, TABLE.v]
  return [[[ku, 0], [ku + .2, 1.4]], [[ku + .2, 1.4], tableEast], [tableEast, hearthFront], [[HALL_W, lv], [TABLE.u + 1, lv]], [[TABLE.u + 1, lv], hearthFront]]
})()
function floorWear(q: V2): number {
  let w = 0
  for (const [a, b] of pathsOf()) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2))
    const d = Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dy * t)
    w = Math.max(w, Math.exp(-((d / .5) ** 2)))
  }
  return w
}

/* ---- the things of the period ---- */

/** A-FURNITURE's table and bench, where the dossier places them. */
const placeOf = (id: string, fallback: V2): { u: number; v: number; size: V3 } => {
  const f = HALL.furnishings?.find(x => x.id === id)
  const q = f ? toUV([f.position[0], f.position[1]]) : fallback
  return { u: q[0], v: q[1], size: f?.size_m ?? [1, 1, 1] }
}
const TABLE = placeOf('hall-table', [4.4, 3.9])
const BENCH = placeOf('hall-bench', [2.9, 3.9])

/** Every piece is a type of the period, built to the dimensions of the
 * museum object its label cites; none is documented in this house. */
function furnish(s: Sink, hero: boolean): void {
  trestleTable(s)
  bench(s)
  chest(s, hero)
  boxChair(s)
  stool(s, TABLE.u + .78, TABLE.v - .75, .12, 91)
  stool(s, TABLE.u + .8, TABLE.v + .9, -.2, 92)
  // on the table: two brass candlesticks, their candles never lit, and a jug
  const top = FLOOR_Z + TABLE.size[2]
  for (const [k, dv] of [[0, -.35], [1, .35]] as [number, number][]) candlestick(s, P(TABLE.u - .08, TABLE.v + dv, top), 93 + k)
  jug(s, P(TABLE.u + .18, TABLE.v - .02, top), 95)
}
/** Local boxes in the hall's frame: u, v across and along, z up from the floor. */
function hbox(s: Sink, u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, kind: number, seed: number, skip = ''): void {
  s.box(P((u0 + u1) / 2, (v0 + v1) / 2, FLOOR_Z + (z0 + z1) / 2), [U[0] * (u1 - u0) / 2, U[1] * (u1 - u0) / 2, 0], [V[0] * (v1 - v0) / 2, V[1] * (v1 - v0) / 2, 0], [0, 0, (z1 - z0) / 2], kind, seed, skip)
}
/** A post from a to b (hall frame, heights from the floor), square in section. */
function post(s: Sink, a: V3, b: V3, w: number, kind: number, seed: number): void {
  const A3 = P(a[0], a[1], FLOOR_Z + a[2]), B3 = P(b[0], b[1], FLOOR_Z + b[2])
  const d = sub(B3, A3), l = len(d), axis = unit(d)
  const side = unit(Math.abs(axis[2]) > .9 ? cross(axis, [U[0], U[1], 0]) : cross(axis, [0, 0, 1])), up = cross(side, axis)
  s.box(scale(add(A3, B3), .5), scale(side, w / 2), scale(up, w / 2), scale(axis, l / 2), kind, seed)
}

/** THE TRESTLE TABLE: A-FURNITURE's 3.4 by 1.0 m at 0.78, as boards laid on
 * two trestles, the common form of the period (MADE-THINGS A1). */
function trestleTable(s: Sink): void {
  const { u, v, size } = TABLE, w = size[0], l = size[1], h = size[2]
  const boards = 3, gap = .004
  for (let i = 0; i < boards; i++) {
    const u0 = u - w / 2 + i * w / boards + gap / 2, u1 = u - w / 2 + (i + 1) * w / boards - gap / 2
    const e0 = (rand(i, 1.1) - .5) * .01, e1 = (rand(i, 2.2) - .5) * .01
    hbox(s, u0, u1, v - l / 2 + e0, v + l / 2 + e1, h - .05, h, K.WAX, 100 + i)
  }
  for (const dv of [-l / 2 + .55, l / 2 - .55]) {
    hbox(s, u - w / 2 + .06, u + w / 2 - .06, v + dv - .05, v + dv + .05, h - .14, h - .05, K.WAX, 104)
    for (const su of [-1, 1]) for (const sv of [-1, 1]) {
      const top: V3 = [u + su * (w / 2 - .16), v + dv + sv * .03, h - .1]
      const foot: V3 = [u + su * (w / 2 - .03), v + dv + sv * .17, 0]
      post(s, foot, top, .06, K.WAX, 105)
    }
    // a low stretcher ties each trestle's legs across
    hbox(s, u - w / 2 + .06, u + w / 2 - .06, v + dv - .02, v + dv + .02, .2, .25, K.WAX, 106)
  }
}
/** THE BENCH: A-FURNITURE's plain oak bench, 2.8 m by 0.40 at 0.48: a plank
 * on two slab ends with a notched foot and a stretcher through them. */
function bench(s: Sink): void {
  const { u, v, size } = BENCH, w = Math.min(size[0], .34), l = size[1], h = size[2]
  hbox(s, u - w / 2, u + w / 2, v - l / 2, v + l / 2, h - .05, h, K.WAX, 110)
  for (const dv of [-l / 2 + .28, l / 2 - .28]) {
    hbox(s, u - w / 2 + .03, u - .05, v + dv - .025, v + dv + .025, 0, h - .05, K.WAX, 111)
    hbox(s, u + .05, u + w / 2 - .03, v + dv - .025, v + dv + .025, 0, h - .05, K.WAX, 111)
    hbox(s, u - .05, u + .05, v + dv - .025, v + dv + .025, .12, h - .05, K.WAX, 111)
  }
  hbox(s, u - .025, u + .025, v - l / 2 + .2, v + l / 2 - .2, .16, .22, K.WAX, 112)
}
/** A CHEST OF THE PERIOD, to the dimensions of V&A W.38-1938 (French, 1520):
 * 1.355 by 0.605 by 0.776 m, frame and panels, linenfold on the front, an
 * iron lock plate after V&A 1319-1901. It stands against the west wall
 * between the windows. */
function chest(s: Sink, hero: boolean): void {
  const L = 1.355, D = .605, H = .776, u0 = .03, u1 = u0 + D, vc = chestV()
  const v0 = vc - L / 2, v1 = vc + L / 2, st = .075
  // stiles to the floor, rails, the lid
  for (const [a, b] of [[u0, u0 + st], [u1 - st, u1]] as V2[]) for (const [c, d] of [[v0, v0 + st], [v1 - st, v1]] as V2[]) hbox(s, a, b, c, d, 0, H - .04, K.WAX, 120)
  hbox(s, u1 - .03, u1, v0 + st, v1 - st, .09, .17, K.WAX, 121)
  hbox(s, u1 - .03, u1, v0 + st, v1 - st, H - .15, H - .04, K.WAX, 121)
  hbox(s, u0 + .01, u1 - .005, v0 + .005, v1 - .005, .16, H - .05, K.WAX, 122, '')
  hbox(s, u0 - .005, u1 + .022, v0 - .02, v1 + .02, H - .04, H, K.WAX, 123)
  // four linenfold panels on the front, between muntins
  const panels = 4, pw = (L - 2 * st - (panels - 1) * .06) / panels
  for (let i = 0; i < panels; i++) {
    const a = v0 + st + i * (pw + .06), b = a + pw
    if (i > 0) hbox(s, u1 - .03, u1, a - .06, a, .17, H - .15, K.WAX, 124)
    linenfold(s, u1 - .012, a + .012, b - .012, .19, H - .17, hero ? 5 : 3, 125 + i)
  }
  // the lock plate and its hasp
  s.box(P(u1 + .004, vc, FLOOR_Z + H - .1), [U[0] * .003, U[1] * .003, 0], [V[0] * .06, V[1] * .06, 0], [0, 0, .07], K.IRON, 129)
  s.box(P(u1 + .009, vc, FLOOR_Z + H - .06), [U[0] * .005, U[1] * .005, 0], [V[0] * .018, V[1] * .018, 0], [0, 0, .05], K.IRON, 129)
}
function chestV(): number {
  // the pier between the two west windows
  const [a, b] = WINDOWS.filter(w => w.west).map(w => { const f = w.facade, fr = frame(f), o = w.o
    return [o.from_m, o.from_m + o.width_m].map(t => toUV([f.from[0] + fr.dir[0] * t, f.from[1] + fr.dir[1] * t])[1]) })
  const edges = [...a!, ...b!].sort((x, y) => x - y)
  return (edges[1]! + edges[2]!) / 2
}
/** A linenfold panel: vertical folds as a rippled face, each end cut in the
 * fold's own outline. Front face at u, from v0 to v1, z0 to z1. */
function linenfold(s: Sink, u: number, v0: number, v1: number, z0: number, z1: number, folds: number, seed: number): void {
  const n = folds * 4, depth = .009
  const off = (t: number): number => depth * (.5 + .5 * Math.cos(t * folds * Math.PI * 2))
  const at = (t: number, z: number, e = 0): V3 => P(u + off(t) + e, v0 + (v1 - v0) * t, FLOOR_Z + z)
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n
    // the fold's ends dip in a soft curve, as the carver cut them
    const end = (t: number): number => .03 * (.5 + .5 * Math.cos(t * folds * Math.PI * 2))
    const n0 = unit(add([U[0], U[1], 0], scale([V[0], V[1], 0], -(off(t1) - off(t0)) / ((v1 - v0) / n))))
    s.quad(at(t0, z0 + end(t0)), at(t1, z0 + end(t1)), at(t1, z1 - end(t1)), at(t0, z1 - end(t0)), n0, [t0, z0], [t1, z0], [t1, z1], [t0, z1], K.WAX, seed)
  }
}
/** A BOX CHAIR OF THE PERIOD, the "caquetoire" form, to V&A 740-1895
 * (France, about 1515, 1.11 m high): a panelled box seat and a tall back,
 * set at the hearth for the one person the room seated. */
function boxChair(s: Sink): void {
  const cu = HALL_W - HEARTH.depth - .55, cv = HEARTH.v - HEARTH.width / 2 - .2
  const turn = -2.25, ca = Math.cos(turn), sa = Math.sin(turn)
  // chair frame: x across the seat, y front to back (toward the back rest), z up
  const at = (x: number, y: number): V2 => [cu + x * ca - y * sa, cv + x * sa + y * ca]
  const cbox = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, kind: number, seed: number): void => {
    const [uc, vc] = at((x0 + x1) / 2, (y0 + y1) / 2)
    const X: V2 = [U[0] * ca + V[0] * sa, U[1] * ca + V[1] * sa], Y: V2 = [-U[0] * sa + V[0] * ca, -U[1] * sa + V[1] * ca]
    s.box(P(uc, vc, FLOOR_Z + (z0 + z1) / 2), [X[0] * (x1 - x0) / 2, X[1] * (x1 - x0) / 2, 0], [Y[0] * (y1 - y0) / 2, Y[1] * (y1 - y0) / 2, 0], [0, 0, (z1 - z0) / 2], kind, seed)
  }
  const W = .62, D = .5, seat = .46, back = 1.11, st = .06
  for (const x of [-W / 2, W / 2 - st]) for (const y of [-D / 2, D / 2 - st]) cbox(x, x + st, y, y + st, 0, y > 0 ? back : .68, K.WAX, 130)
  // the box below the seat, panelled on three sides
  cbox(-W / 2 + st, W / 2 - st, -D / 2 + .01, -D / 2 + .03, .06, seat - .03, K.WAX, 131)
  for (const x of [-W / 2 + .01, W / 2 - .03]) cbox(x, x + .02, -D / 2 + st, D / 2 - st, .06, seat - .03, K.WAX, 131)
  cbox(-W / 2, W / 2, -D / 2, D / 2, seat - .035, seat, K.WAX, 132)
  // arms, and the tall back with its panels and cresting
  for (const x of [-W / 2, W / 2 - st]) cbox(x - .01, x + st + .01, -D / 2 - .02, D / 2, .66, .7, K.WAX, 133)
  cbox(-W / 2 + st, W / 2 - st, D / 2 - .035, D / 2 - .015, seat, back - .06, K.WAX, 134)
  cbox(-W / 2 - .01, W / 2 + .01, D / 2 - st, D / 2, back - .06, back, K.WAX, 135)
  cbox(-W / 2 + st, W / 2 - st, D / 2 - st, D / 2, seat + .22, seat + .27, K.WAX, 136)
}
/** A STOOL OF THE PERIOD, to V&A 968-1897 (oak, Normandy, late fifteenth
 * century, 0.455 m): a board on two slab ends with an apron. */
function stool(s: Sink, u: number, v: number, turn: number, seed: number): void {
  const ca = Math.cos(turn), sa = Math.sin(turn)
  const X: V2 = [U[0] * ca + V[0] * sa, U[1] * ca + V[1] * sa], Y: V2 = [-U[0] * sa + V[0] * ca, -U[1] * sa + V[1] * ca]
  const at = (x: number, y: number, z: number): V3 => { const q = fromUV(u, v); return [q[0] + X[0] * x + Y[0] * y, q[1] + X[1] * x + Y[1] * y, FLOOR_Z + z] }
  const b = (x: number, y: number, z: number, hx: number, hy: number, hz: number): void => s.box(at(x, y, z), [X[0] * hx, X[1] * hx, 0], [Y[0] * hy, Y[1] * hy, 0], [0, 0, hz], K.WAX, seed)
  b(0, 0, .435, .21, .14, .02)
  for (const x of [-.15, .15]) { b(x, -.07, .2, .018, .045, .2); b(x, .07, .2, .018, .045, .2); b(x, 0, .3, .018, .12, .09) }
  for (const y of [-.12, .12]) b(0, y, .37, .17, .012, .035)
}
/** A BRASS CANDLESTICK OF THE PERIOD, after V&A M.435-1926 (Flemish, late
 * fifteenth to early sixteenth century): a spreading foot, a stem of five
 * knops and a socket, the candle in it never lit. */
function candlestick(s: Sink, base: V3, seed: number): void {
  const prof: V2[] = [[0, 0], [.068, 0], [.07, .01], [.05, .022], [.02, .035], [.016, .05],
    [.024, .058], [.014, .068], [.022, .083], [.013, .094], [.021, .108], [.013, .119], [.022, .133], [.013, .144], [.02, .156],
    [.014, .166], [.032, .176], [.030, .215], [.022, .217], [0, .217]]
  s.lathe(base, prof, 14, K.BRASS, seed)
  s.lathe([base[0], base[1], base[2] + .205], [[0, 0], [.012, 0], [.012, .11], [.009, .118], [0, .12]], 10, K.WAX, 150)
}
/** A JUG OF THE PERIOD, after the Beauvais jug V&A C.185-1909: a round belly
 * under a narrow neck, a dark green glaze over the clay, a strap handle. */
function jug(s: Sink, base: V3, seed: number): void {
  const prof: V2[] = [[0, 0], [.045, 0], [.05, .01], [.07, .05], [.074, .085], [.066, .12], [.045, .15], [.03, .175], [.028, .2], [.034, .225], [.03, .23], [0, .23]]
  s.lathe(base, prof, 16, K.GLAZE, seed)
  const side: V2 = [-U[0], -U[1]]
  const q = (o: number, z: number): V3 => [base[0] + side[0] * o, base[1] + side[1] * o, base[2] + z]
  const pts: [number, number][] = [[.03, .2], [.07, .205], [.085, .17], [.08, .12], [.065, .09]]
  for (let i = 0; i < pts.length - 1; i++) {
    const a = q(pts[i]![0], pts[i]![1]), b = q(pts[i + 1]![0], pts[i + 1]![1])
    const w: V3 = [V[0] * .011, V[1] * .011, 0]
    s.quad(sub(a, w), add(a, w), add(b, w), sub(b, w), null, [0, 0], [1, 0], [1, 1], [0, 1], K.GLAZE, seed)
    s.quad(add(a, w), sub(a, w), sub(b, w), add(b, w), null, [0, 0], [1, 0], [1, 1], [0, 1], K.GLAZE, seed)
  }
}

/** THE CHIMNEYPIECE. A-FURNITURE's envelope (Q144): 2.8 m along the passage
 * wall, 0.65 m deep, 3.0 m high, where the dossier places it. Built as the
 * Loire type of the years around 1500: two moulded jambs, a lintel with a
 * chamfered edge and a shelf, a tuffeau hood leaning back to the ceiling, a
 * brick fireback. The fire is out and banked: ash, two charred ends on a
 * pair of andirons, soot where the smoke has always gone. */
const HEARTH = (() => {
  const f = HALL.furnishings?.find(x => x.id === 'hall-hearth')
  const c = f ? toUV([f.position[0], f.position[1]]) : [HALL_W, HALL_D * .7] as V2
  const width = f?.size_m[1] ?? 2.8, depth = f?.size_m[0] ?? .65, height = f?.size_m[2] ?? 3
  return { v: c[1], width, depth, height }
})()
function hearth(s: Sink, hero: boolean): void {
  const { v: vc, width, depth } = HEARTH
  // local frame: x along the wall (toward the back wall), y out into the room, z up
  const X: V2 = V, Y: V2 = [-U[0], -U[1]]
  const L = (x: number, y: number, z: number): V3 => { const q = fromUV(HALL_W - .012, vc); return [q[0] + X[0] * x + Y[0] * y, q[1] + X[1] * x + Y[1] * y, FLOOR_Z + z] }
  const ax = (h: number): V3 => [X[0] * h, X[1] * h, 0], ay = (h: number): V3 => [Y[0] * h, Y[1] * h, 0], az_ = (h: number): V3 => [0, 0, h]
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, kind: number, seed: number, skip = ''): void =>
    s.box(L((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), ax((x1 - x0) / 2), ay((y1 - y0) / 2), az_((z1 - z0) / 2), kind, seed, y0 <= 0 ? skip + '-y' : skip)
  const W2 = width / 2, jamb = .34, open = W2 - jamb, jambTop = 1.70, lintelTop = 2.10, shelfTop = 2.20
  const clear = HALL.height_m - .004
  // the hearthstone, a hand proud of the tiles, reaching into the room
  box(-W2 - .05, W2 + .05, 0, depth + .42, -.004, .028, K.STONE, 51, '-z')
  // jambs: plinth, shaft, a stepped capital
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -W2 : open, x1 = side < 0 ? -open : W2
    box(x0 - .025, x1 + .025, 0, depth + .03, .028, .17, K.STONE, 52, '-z')
    s.soot = .18
    box(x0, x1, 0, depth, .17, jambTop - .16, K.STONE, 53, '-z+z')
    s.soot = 0
    box(x0 - .02, x1 + .02, 0, depth + .035, jambTop - .16, jambTop - .07, K.STONE, 54, '-z')
    box(x0 - .04, x1 + .04, 0, depth + .06, jambTop - .07, jambTop, K.STONE, 55, '-z')
  }
  // the lintel, its lower front arris taken off in a broad chamfer
  const ch = .07
  s.soot = .55
  box(-W2, W2, 0, depth - ch, jambTop, jambTop + ch, K.STONE, 56, '+z+x-x')
  s.soot = .2
  box(-W2, W2, 0, depth, jambTop + ch, lintelTop, K.STONE, 56, '-z')
  s.soot = 0
  {
    const a = L(-W2, depth - ch, jambTop), b = L(W2, depth - ch, jambTop), c = L(W2, depth, jambTop + ch), d = L(-W2, depth, jambTop + ch)
    const n = unit(add(scale([Y[0], Y[1], 0], 1), [0, 0, -1]))
    s.soot = .45
    s.quad(a, b, c, d, n, [-W2, 0], [W2, 0], [W2, ch * 1.41], [-W2, ch * 1.41], K.STONE, 56)
    s.soot = 0
  }
  // the shelf over it
  box(-W2 - .06, W2 + .06, 0, depth + .09, lintelTop, shelfTop, K.STONE, 57)
  // the hood, leaning back to the ceiling in coursed tuffeau
  const hb = depth - .04, ht = depth - .24, wb = W2 - .03, wt = W2 - .22
  const z0 = shelfTop, z1 = clear
  const front = [L(-wb, hb, z0), L(wb, hb, z0), L(wt, ht, z1), L(-wt, ht, z1)]
  const fn = unit(cross(sub(front[1]!, front[0]!), sub(front[3]!, front[0]!)))
  const uvF = (p: V3): V2 => { const q = toUV([p[0], p[1]]); return [q[1] - vc, p[2] - FLOOR_Z] }
  s.soot = .12
  s.poly(front, dot(fn, [Y[0], Y[1], 0]) > 0 ? fn : scale(fn, -1), uvF, K.STONE, 58)
  for (const side of [-1, 1]) {
    const sx = side
    const quad = [L(sx * wb, 0, z0), L(sx * wb, hb, z0), L(sx * wt, ht, z1), L(sx * wt, 0, z1)]
    const n: V3 = unit(cross(sub(quad[1]!, quad[0]!), sub(quad[3]!, quad[0]!)))
    const out: V3 = [X[0] * sx, X[1] * sx, 0]
    s.poly(quad, dot(n, out) > 0 ? n : scale(n, -1), p => { const q = toUV([p[0], p[1]]); return [HALL_W - q[0], p[2] - FLOOR_Z] }, K.STONE, 58)
  }
  s.soot = 0
  // the firebox: sooted brick cheeks, fireback and a throat going up dark
  const back = .02
  s.soot = .55
  box(-open, open, 0, back, .028, jambTop, K.BRICK, 61, '-z')
  for (const side of [-1, 1]) {
    const x = side * open
    const p0 = L(x, back, .028), p1 = L(x, depth, .028), p2 = L(x, depth, jambTop), p3 = L(x, back, jambTop)
    s.quad(p0, p1, p2, p3, [X[0] * -side, X[1] * -side, 0], [0, 0], [depth, 0], [depth, jambTop], [0, jambTop], K.BRICK, 62)
  }
  s.soot = .95
  s.quad(L(-open, back, jambTop), L(open, back, jambTop), L(open, depth - .02, jambTop), L(-open, depth - .02, jambTop), [0, 0, -1], [0, 0], [1, 0], [1, 1], [0, 1], K.BRICK, 63)
  s.soot = 0
  // the banked fire: an ash bed, two charred ends on the andirons
  const ash: V2[] = []
  for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI * 2; ash.push([Math.cos(t) * (open - .12), .30 + Math.sin(t) * .21]) }
  const ashTop = (x: number, y: number): number => .028 + .035 * Math.max(0, 1 - Math.hypot(x / (open - .1), (y - .3) / .22))
  const centre = L(0, .3, ashTop(0, .3))
  for (let i = 0; i < ash.length; i++) {
    const a = ash[i]!, b = ash[(i + 1) % ash.length]!
    s.tri(centre, L(a[0], a[1], ashTop(a[0], a[1]) + .002), L(b[0], b[1], ashTop(b[0], b[1]) + .002), null, [0, .3], a, b, K.ASH, 64)
  }
  const andirons = [-open * .55, open * .55]
  for (const [k, x] of andirons.entries()) andiron(s, L, X, Y, x, depth - .06, 70 + k)
  // two charred ends lying across the bars
  if (hero) for (const [k, [x0, x1, y, r]] of ([[-.62, .55, .24, .055], [-.48, .66, .36, .045]] as [number, number, number, number][]).entries())
    log(s, L(x0, y, .2 + r), L(x1, y + .03, .2 + r - .01), r, K.CHAR, 80 + k)
}
/** One andiron, a type: a front upright with a knob on splayed feet, the
 * bar running back into the fire. */
function andiron(s: Sink, L: (x: number, y: number, z: number) => V3, X: V2, Y: V2, x: number, front: number, seed: number): void {
  const ax = (h: number): V3 => [X[0] * h, X[1] * h, 0], ay = (h: number): V3 => [Y[0] * h, Y[1] * h, 0], az_ = (h: number): V3 => [0, 0, h]
  s.box(L(x, front, .028 + .23), ax(.018), ay(.018), az_(.23), K.IRON, seed)
  s.box(L(x, front, .028 + .49), ax(.032), ay(.032), az_(.032), K.IRON, seed)
  s.box(L(x, front - .22, .028 + .14), ax(.014), ay(.23), az_(.016), K.IRON, seed)
  for (const side of [-1, 1]) {
    const foot = L(x + side * .07, front + .05, .028 + .015)
    s.box(foot, [X[0] * .05 + Y[0] * .02 * side, X[1] * .05 + Y[1] * .02 * side, 0], ay(.012), az_(.015), K.IRON, seed, '-z')
  }
}
/** A log as an eight-sided prism from a to b. */
function log(s: Sink, a: V3, b: V3, r: number, kind: number, seed: number): void {
  const d = unit(sub(b, a)), side = unit(cross(d, [0, 0, 1])), up = cross(side, d), l = len(sub(b, a))
  const ring = (c: V3, k: number): V3 => { const t = k / 8 * Math.PI * 2; const rr = r * (1 + .12 * Math.sin(k * 2.3 + seed)); return add(c, add(scale(side, Math.cos(t) * rr), scale(up, Math.sin(t) * rr))) }
  for (let k = 0; k < 8; k++) {
    const n = unit(add(scale(side, Math.cos((k + .5) / 8 * Math.PI * 2)), scale(up, Math.sin((k + .5) / 8 * Math.PI * 2))))
    s.quad(ring(a, k), ring(b, k), ring(b, k + 1), ring(a, k + 1), n, [0, k / 8], [l, k / 8], [l, (k + 1) / 8], [0, (k + 1) / 8], kind, seed)
  }
  for (const [c, n] of [[a, scale(d, -1)], [b, d]] as [V3, V3][]) for (let k = 0; k < 8; k++) s.tri(c, ring(c, k), ring(c, k + 1), n, [0, 0], [0, 0], [0, 0], kind, seed)
}

/** A tuffeau seat in the embrasure, from behind the outer sill to a rounded
 * nose standing a hand proud of the lining. */
function windowSeat(s: Sink, f: Facade, o: Opening): void {
  const fr = frame(f), t = thicknessOf(f)
  const at = (along: number, inward: number, z: number): V3 => [f.from[0] + fr.dir[0] * along - fr.out[0] * inward, f.from[1] + fr.dir[1] * along - fr.out[1] * inward, z]
  const a0 = o.from_m + .002, a1 = o.from_m + o.width_m - .002
  const back = .25, front = t + LINING_GAP + .06, z0 = o.base_m + .012, z1 = o.base_m + .05
  const up: V3 = [0, 0, 1], inwardN: V3 = [-fr.out[0], -fr.out[1], 0]
  s.quad(at(a0, back, z1), at(a1, back, z1), at(a1, front - .02, z1), at(a0, front - .02, z1), up, [a0, back], [a1, back], [a1, front], [a0, front], K.STONE, 21)
  // the nose: one broad chamfer
  {
    const r = .02, n = unit(add(up, inwardN))
    s.quad(at(a0, front - r, z1), at(a1, front - r, z1), at(a1, front, z1 - r), at(a0, front, z1 - r), n, [a0, z1], [a1, z1], [a1, z1 - r], [a0, z1 - r], K.STONE, 21)
  }
  // front face down to the lining's hole bottom
  s.quad(at(a0, front, z0), at(a1, front, z0), at(a1, front, z1 - .02), at(a0, front, z1 - .02), inwardN, [a0, z0], [a1, z0], [a1, z1], [a0, z1], K.STONE, 21)
  // the two ends against the reveal cheeks are hidden
}

/** The inner faces of a window's mullion and transom, as the room lights
 * them: the shell's own stone faces stand a few millimetres behind. */
function crossFace(s: Sink, f: Facade, o: Opening): void {
  const fr = frame(f)
  const at = (along: number, inward: number, z: number): V3 => [f.from[0] + fr.dir[0] * along - fr.out[0] * inward, f.from[1] + fr.dir[1] * along - fr.out[1] * inward, z]
  const n: V3 = [-fr.out[0], -fr.out[1], 0]
  const x = o.from_m, w = o.width_m, z = o.base_m, h = o.height_m, mid = x + w / 2, transom = z + h * TRANSOM_AT
  const m0 = mid - MULLION_M / 2 - .001, m1 = mid + MULLION_M / 2 + .001, mi = MULLION_IN + .0045
  s.quad(at(m0, mi, z), at(m1, mi, z), at(m1, mi, z + h), at(m0, mi, z + h), n, [m0, z], [m1, z], [m1, z + h], [m0, z + h], K.STONE, 41)
  const ti = TRANSOM_IN + .004, t0 = transom - TRANSOM_M / 2 - .001, t1 = transom + TRANSOM_M / 2 + .001
  for (const [a0, a1] of [[x, m0], [m1, x + w]] as V2[])
    s.quad(at(a0, ti, t0), at(a1, ti, t0), at(a1, ti, t1), at(a0, ti, t1), n, [a0, t0], [a1, t0], [a1, t1], [a0, t1], K.STONE, 41)
}

/** The reveal of a door through a partition: two cheeks, a soffit and a
 * threshold, from the hall's lining to the room beyond. */
function doorReveal(s: Sink, to: 'kitchen' | 'service-link'): void {
  const hall = hallDoor(to)
  const wallA = to === 'kitchen' ? h0 : h1, dir = to === 'kitchen' ? HALL_SOUTH.dir : HALL_EAST.dir
  // the room beyond's own face of the partition
  const outward: V2 = [dir[1], -dir[0]]
  const depth = to === 'kitchen' ? .55 : .75
  const a: V2 = [wallA[0] + dir[0] * hall.from_m, wallA[1] + dir[1] * hall.from_m]
  const b: V2 = [a[0] + dir[0] * hall.width_m, a[1] + dir[1] * hall.width_m]
  const far = (p: V2): V2 => [p[0] + outward[0] * depth, p[1] + outward[1] * depth]
  const z0 = FLOOR_Z, z1 = FLOOR_Z + hall.height_m
  const P3 = (p: V2, z: number): V3 => [p[0], p[1], z]
  const n = (x: V2): V3 => [x[0], x[1], 0]
  const seed = 31 + (to === 'kitchen' ? 0 : 1)
  // cheeks face each other across the opening, limewashed like the walls
  s.quad(P3(a, z0), P3(far(a), z0), P3(far(a), z1), P3(a, z1), n(dir), [0, z0], [depth, z0], [depth, z1], [0, z1], K.PLASTER, seed)
  s.quad(P3(far(b), z0), P3(b, z0), P3(b, z1), P3(far(b), z1), n([-dir[0], -dir[1]]), [0, z0], [depth, z0], [depth, z1], [0, z1], K.PLASTER, seed)
  // soffit, under an oak lintel's face
  s.quad(P3(a, z1), P3(far(a), z1), P3(far(b), z1), P3(b, z1), [0, 0, -1], [0, 0], [depth, 0], [depth, 1], [0, 1], K.OAK, seed)
  // threshold, a worn tuffeau slab
  s.quad(P3(a, z0 + .004), P3(b, z0 + .004), P3(far(b), z0 + .004), P3(far(a), z0 + .004), [0, 0, 1], [0, 0], [1, 0], [1, depth], [0, depth], K.STONE, seed + .5)
}

/* ---- the glass, from inside ---- */

/** The leaded lights of the hall's four windows as the room sees them: the
 * house's glazing faces the court and the garden, so from inside only this
 * layer draws the lead and the glass's own faint milk against the day. */
function innerGlass(): Mesh {
  const positions: number[] = [], edge: number[] = [], lat: number[] = []
  for (const w of WINDOWS) {
    const f = w.facade, fr = frame(f)
    const at = (along: number, z: number): V3 => [f.from[0] + fr.dir[0] * along - fr.out[0] * (GLASS_IN + .003), f.from[1] + fr.dir[1] * along - fr.out[1] * (GLASS_IN + .003), z]
    for (const [u0, u1, z0, z1] of lightsOf(w.o)) {
      const cu = (u0 + u1) / 2
      const corners: [number, number][] = [[u0, z0], [u1, z0], [u1, z1], [u0, z1]]
      // facing the room: wound so the front face turns inward
      for (const k of [0, 2, 1, 0, 3, 2]) {
        const [u, z] = corners[k]!, p = at(u, z)
        positions.push(p[0], p[2], -p[1])
        edge.push(u - u0, u1 - u, z - z0, z1 - z)
        lat.push(u - cu, z - z0, w.west ? 1 : 0)
      }
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(positions, 3))
  g.setAttribute('edge', new Float32BufferAttribute(edge, 4))
  g.setAttribute('lattice', new Float32BufferAttribute(lat, 3))
  g.computeVertexNormals(); g.computeBoundingSphere()
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false })
  const E = attribute('edge', 'vec4'), L = attribute('lattice', 'vec3')
  const a = L.x.add(L.y).div(QUARRY_STEP), b = L.y.sub(L.x).div(QUARRY_STEP)
  // distance to the nearest came, in metres, and the border lead's
  const da = abs(fract(a.add(.5)).sub(.5)).mul(QUARRY_M), db = abs(fract(b.add(.5)).sub(.5)).mul(QUARRY_M)
  const border = min(min(E.x, E.y), min(E.z, E.w))
  const line = (d: N, half: number): N => { const px = vec2(d.dFdx(), d.dFdy()).length().max(1e-6); return float(1).sub(smoothstep(float(half).sub(px), float(half).add(px), d)) }
  const lead = max(max(line(da, CAME_HALF), line(db, CAME_HALF)), line(border, BORDER_HALF))
  // old glass holds a little of the day it lets through: a warm milk where
  // the sun stands on it, a cool one on the north lights
  const milk = mix(vec3(.030, .034, .036), vec3(.16, .135, .095), L.z)
  m.colorNode = mix(milk, vec3(.010, .0095, .009), lead)
  m.opacityNode = float(1).sub(lead).mul(mix(float(.86), float(.80), L.z))
  m.blending = CustomBlending; m.blendEquation = AddEquation
  m.blendSrc = OneFactor; m.blendDst = SrcAlphaFactor; m.blendSrcAlpha = ZeroFactor; m.blendDstAlpha = OneFactor
  m.name = 'vinci/house-hall/glass'
  const mesh = new Mesh(g, m)
  mesh.name = 'vinci/house-hall/glass'
  mesh.castShadow = false; mesh.receiveShadow = false
  mesh.userData['manifestId'] = houseHallProvenance.manifestId; mesh.userData['asset'] = houseHallProvenance.manifestId
  return mesh
}

/* ---- the dust in the beams ---- */

/** THE SUN IN THE ROOM'S AIR. Each light of the two west windows sends a
 * shaft of the hour's sun across the wall's depth to the floor, and the
 * dust of a lived-in room shows it. Each shaft is its own sheared prism:
 * corner R, edges along the light (A, B) and the sun's travel (D, to the
 * floor's plane at B's height); the shader follows the eye's ray through it
 * and glows by the length it crosses and the angle to the sun. An engine
 * term: the film's volume scatters for real, so `engineVolume` marks it. */
function dustBeams(): Mesh | null {
  const f = WEST, fr = frame(f), t = thicknessOf(f)
  const out: V3 = [fr.out[0], fr.out[1], 0], along: V3 = [fr.dir[0], fr.dir[1], 0]
  const facing = dot(TO_SUN, out)
  if (facing < .05) return null
  const travel: V3 = scale(TO_SUN, -1)
  const positions: number[] = [], inv0: number[] = [], inv1: number[] = [], inv2: number[] = [], orig: number[] = []
  for (const w of WINDOWS.filter(x => x.west)) for (const [u0, u1, z0, z1] of lightsOf(w.o)) {
    // the part of the light the wall's depth leaves lit at its inner face
    const depth = t - GLASS_IN
    const du = -depth * dot(TO_SUN, along) / facing, dz = -depth * TO_SUN[2] / facing
    const a0 = Math.max(u0, u0 + du), a1 = Math.min(u1, u1 + du), b0 = Math.max(z0, z0 + dz), b1 = Math.min(z1, z1 + dz)
    if (a1 - a0 < .02 || b1 - b0 < .02) continue
    const at = (a: number, z: number): V3 => [f.from[0] + fr.dir[0] * a - fr.out[0] * t, f.from[1] + fr.dir[1] * a - fr.out[1] * t, z]
    const R = at(a0, b0), A = sub(at(a1, b0), R), B = sub(at(a0, b1), R)
    // how far the sun travels from each corner of the face to the floor
    const toFloor = (z: number): number => (z - FLOOR_Z) / TO_SUN[2]
    const D = scale(travel, 1)
    const lo = toFloor(b0), hi = toFloor(b1)
    // in (a, b, s): a, b in [0,1] across the light, s in [0, lo + (hi - lo) b] metres along the sun
    const M = [[A[0], B[0], D[0]], [A[1], B[1], D[1]], [A[2], B[2], D[2]]]
    const det = M[0]![0]! * (M[1]![1]! * M[2]![2]! - M[1]![2]! * M[2]![1]!) - M[0]![1]! * (M[1]![0]! * M[2]![2]! - M[1]![2]! * M[2]![0]!) + M[0]![2]! * (M[1]![0]! * M[2]![1]! - M[1]![1]! * M[2]![0]!)
    const inv = [
      [(M[1]![1]! * M[2]![2]! - M[1]![2]! * M[2]![1]!) / det, (M[0]![2]! * M[2]![1]! - M[0]![1]! * M[2]![2]!) / det, (M[0]![1]! * M[1]![2]! - M[0]![2]! * M[1]![1]!) / det],
      [(M[1]![2]! * M[2]![0]! - M[1]![0]! * M[2]![2]!) / det, (M[0]![0]! * M[2]![2]! - M[0]![2]! * M[2]![0]!) / det, (M[0]![2]! * M[1]![0]! - M[0]![0]! * M[1]![2]!) / det],
      [(M[1]![0]! * M[2]![1]! - M[1]![1]! * M[2]![0]!) / det, (M[0]![1]! * M[2]![0]! - M[0]![0]! * M[2]![1]!) / det, (M[0]![0]! * M[1]![1]! - M[0]![1]! * M[1]![0]!) / det],
    ]
    // the prism's eight corners: the lit face and its footprint on the floor
    const corner = (a: number, b: number, far: boolean): V3 => add(add(add(R, scale(A, a)), scale(B, b)), far ? scale(D, lo + (hi - lo) * b) : [0, 0, 0])
    // the footprint on the floor is only ever left by, so it is not drawn
    const faces: [number, number, boolean][][] = [
      [[0, 0, false], [1, 0, false], [1, 1, false], [0, 1, false]],
      [[0, 0, false], [0, 0, true], [1, 0, true], [1, 0, false]], [[0, 1, false], [1, 1, false], [1, 1, true], [0, 1, true]],
      [[0, 0, false], [0, 1, false], [0, 1, true], [0, 0, true]], [[1, 0, false], [1, 0, true], [1, 1, true], [1, 1, false]],
    ]
    // the shader converts east/north/up to three's frame itself: store rows
    // of the inverse map in the renderer's axes (x=e, y=up, z=-n)
    const row = (r: number[]): number[] => [r[0]!, r[2]!, -r[1]!]
    for (const face of faces) for (const k of [0, 1, 2, 0, 2, 3]) {
      const [a, b, far] = face[k]!, p = corner(a, b, far)
      positions.push(p[0], p[2], -p[1])
      inv0.push(...row(inv[0]!)); inv1.push(...row(inv[1]!)); inv2.push(...row(inv[2]!))
      orig.push(R[0], R[2], -R[1], lo, hi)
    }
  }
  if (!positions.length) return null
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(positions, 3))
  g.setAttribute('beamA', new Float32BufferAttribute(inv0, 3))
  g.setAttribute('beamB', new Float32BufferAttribute(inv1, 3))
  g.setAttribute('beamS', new Float32BufferAttribute(inv2, 3))
  const o5: number[] = [], o2: number[] = []
  for (let i = 0; i < orig.length; i += 5) { o5.push(orig[i]!, orig[i + 1]!, orig[i + 2]!); o2.push(orig[i + 3]!, orig[i + 4]!) }
  g.setAttribute('beamO', new Float32BufferAttribute(o5, 3))
  g.setAttribute('beamL', new Float32BufferAttribute(o2, 2))
  g.computeBoundingSphere()
  // Both sides are drawn: a face the eye's ray enters by carries the length
  // to where the ray leaves; a face it leaves by carries none.
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending })
  const IA = attribute('beamA', 'vec3'), IB = attribute('beamB', 'vec3'), IS = attribute('beamS', 'vec3'), O = attribute('beamO', 'vec3'), Lh = attribute('beamL', 'vec2')
  const eye = cameraPosition, ray = positionWorld.sub(eye), here = ray.length(), dir = ray.div(here.max(1e-6))
  const e0 = vec3(IA.dot(eye.sub(O)), IB.dot(eye.sub(O)), IS.dot(eye.sub(O)))
  const dl = vec3(IA.dot(dir), IB.dot(dir), IS.dot(dir))
  const safe = (d: N): N => d.abs().max(1e-6).mul(d.greaterThanEqual(0).select(float(1), float(-1)))
  // where the ray leaves each bound: 0 <= a <= 1, 0 <= b <= 1, s >= 0, s - (hi - lo) b <= lo
  const leave = (o: N, d: N): N => d.greaterThanEqual(0).select(float(1).sub(o), o.negate()).div(safe(d))
  const slope = Lh.y.sub(Lh.x), top = e0.z.sub(slope.mul(e0.y)), rate = dl.z.sub(slope.mul(dl.y))
  const sOut = dl.z.lessThan(0).select(e0.z.negate().div(safe(dl.z)), float(1e6))
  const topOut = rate.greaterThan(0).select(Lh.x.sub(top).div(safe(rate)), float(1e6))
  const exit = min(min(leave(e0.x, dl.x), leave(e0.y, dl.y)), min(sOut, topOut))
  const length = exit.sub(here).max(0)
  // forward scattering: a thin haze of dust is brightest looking into the sun
  const cosT = dir.dot(vec3(TO_SUN[0], TO_SUN[2], -TO_SUN[1]))
  const g1 = .55, phase = float(1 - g1 * g1).div(float(1 + g1 * g1).sub(cosT.mul(2 * g1)).pow(1.5)).mul(1 / (4 * Math.PI))
  const drift = mx_noise_float(positionWorld.mul(1.3)).mul(.25).add(.9)
  m.colorNode = vec3(1, .80, .58).mul(length.mul(phase).mul(drift).mul(.085))
  m.name = 'vinci/house-hall/dust'
  m.userData['engineVolume'] = true
  const mesh = new Mesh(g, m)
  mesh.name = 'vinci/house-hall/dust'
  mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = 2
  mesh.userData['manifestId'] = houseHallProvenance.manifestId; mesh.userData['asset'] = houseHallProvenance.manifestId
  return mesh
}

/* ---- the service passage ---- */

function buildLink(s: Sink, hero: boolean): void {
  s.lit = 0
  const room = LINK_OUTLINE
  flatFloor(s, room, FLOOR_Z, hero ? .45 : .9)
  const cell = hero ? .4 : .9
  for (let e = 0; e < room.length; e++) {
    const a = room[e]!, b = room[(e + 1) % room.length]!
    const holes: [number, number, number, number][] = []
    for (const o of LINK.openings) {
      if (o.type !== 'door') continue
      // this edge carries the door when the dossier's wall letter matches
      const letter = o.wall?.split(':w')[1]
      const edgeLetter = 'ABCD'[LINK.polygon.findIndex(p => Math.abs(p[0] - a[0]) < 1e-6 && Math.abs(p[1] - a[1]) < 1e-6)]
      if (letter !== edgeLetter) continue
      holes.push([o.from_m, o.from_m + o.width_m, FLOOR_Z, FLOOR_Z + o.height_m])
    }
    lining(s, a, b, FLOOR_Z, BOARD_Z, holes, cell, K.PLASTER, .71)
  }
  // ceiling boards and joists across the passage's short span
  s.cast = true
  const flat = room
  s.poly(flat.map(q => [q[0], q[1], BOARD_Z] as V3), [0, 0, -1], p => [p[0], p[1]], K.OAK, 2.5)
  const a = flat[0]!, b = flat[1]!, d = flat[3]!
  const lu = Math.hypot(b[0] - a[0], b[1] - a[1]), lv = Math.hypot(d[0] - a[0], d[1] - a[1])
  const du: V2 = [(b[0] - a[0]) / lu, (b[1] - a[1]) / lu], dv: V2 = [(d[0] - a[0]) / lv, (d[1] - a[1]) / lv]
  const across = lu < lv ? du : dv, alongL = lu < lv ? lv : lu, alongD = lu < lv ? dv : du, span = lu < lv ? lu : lv
  const n = Math.floor((alongL - JOIST_W) / JOIST_STEP)
  for (let i = 0; i <= n; i++) {
    const t = (alongL - n * JOIST_STEP) / 2 + i * JOIST_STEP
    const c: V3 = [a[0] + alongD[0] * t + across[0] * span / 2, a[1] + alongD[1] * t + across[1] * span / 2, CEIL_Z + JOIST_D / 2]
    s.box(c, [alongD[0] * JOIST_W / 2, alongD[1] * JOIST_W / 2, 0], [across[0] * span / 2, across[1] * span / 2, 0], [0, 0, JOIST_D / 2], K.OAK, 5 + i * .1, '+z+y-y')
  }
  s.cast = false
  s.lit = 1
}

/* ---- the bake ---- */

const linkDoorAp: V3[] = (() => {
  const a0 = fromUV(HALL_W, linkDoorV[0]), a1 = fromUV(HALL_W, linkDoorV[1])
  return [[a0[0], a0[1], FLOOR_Z], [a1[0], a1[1], FLOOR_Z], [a1[0], a1[1], FLOOR_Z + DOOR_H], [a0[0], a0[1], FLOOR_Z + DOOR_H]]
})()
/** The light one point of the hall or the passage receives, baked once:
 * what it sees of the windows, weighted by what lies beyond each, and what
 * it sees of the floor's sun patches. A floor sees the patches only at
 * grazing angles and takes the room's second bounce instead. */
function bakePoint(at: V3, n: V3, hall: boolean): [number, number] {
  let sky = 0, bounce = 0
  if (hall) {
    for (const w of WINDOWS) sky += formFactor(at, n, w.ap.corners, w.ap.inward, 2) * TRANSMIT * w.ap.radiance
    for (const patch of PATCHES) bounce += formFactor(at, n, patch, [0, 0, 1], 3)
    bounce += ROOM_FILL
  } else {
    // the passage sees the hall's sunlit threshold through the hall door
    const f = formFactor(at, n, linkDoorAp, [U[0], U[1], 0], 2)
    bounce += f * 2.2
    sky += f * .3
  }
  return [Math.min(1, .02 + sky * 2.4), bounce]
}
/** The room's second bounce, in the patches' own units: what a surface
 * receives from the lit walls and ceiling rather than from the floor. */
const ROOM_FILL = .05

function bake(s: Sink, cast: boolean): BufferGeometry {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], a: number[] = [], b: number[] = []
  const baked = new Map<string, [number, number]>()
  const inHall = (p: V3): boolean => { const q = toUV([p[0], p[1]]); return q[0] > -.4 && q[0] < HALL_W + .4 && q[1] > -.4 && q[1] < HALL_D + .4 }
  for (const v of s.v) {
    if (v.cast !== cast) continue
    let light = v.fixed
    if (!light) {
      const key = `${v.p[0].toFixed(3)},${v.p[1].toFixed(3)},${v.p[2].toFixed(3)},${v.n[0].toFixed(2)},${v.n[1].toFixed(2)},${v.n[2].toFixed(2)}`
      light = baked.get(key)
      if (!light) { light = !bakeVertices ? [0, 0] : v.lit === 2 ? passageLight(v.p, v.n) : bakePoint(v.p, v.n, inHall(v.p) && v.lit > 0); baked.set(key, light) }
    }
    positions.push(v.p[0], v.p[2], -v.p[1]); normals.push(v.n[0], v.n[2], -v.n[1]); uvs.push(v.t[0], v.t[1])
    a.push(v.kind, light[0], light[1], v.seed)
    // sun gate: the hall and the entrance take the key; the passage does not.
    // hall shade: only the hall's points read the west windows' cross and leads
    b.push(v.wear, v.soot, v.lit >= 1 ? 1 : 0, v.lit === 1 ? 1 : 0)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(positions, 3))
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  g.setAttribute('hallA', new Float32BufferAttribute(a, 4))
  g.setAttribute('hallB', new Float32BufferAttribute(b, 4))
  g.computeBoundingSphere()
  return g
}

/* ---- the west windows' own shade in the sun ---- */

/** WHAT THE SUN DRAWS THROUGH THE WEST WINDOWS. The shadow map lets the sun
 * in through each opening but cannot hold a 120 mm mullion at this distance,
 * let alone a 7 mm came, so every lit point follows its ray back to the glass
 * and reads there the stone cross, the saddle bars and the leads, each
 * softened by the half-degree disc of the sun over the distance travelled.
 * An engine term: the film's cross and cames are geometry and cast their own
 * shadow, so `engineWindowShade` marks it for the export to turn off. */
function windowShade(): N {
  const f = WEST, fr = frame(f)
  const out = vec3(fr.out[0], 0, -fr.out[1]), dirW = vec3(fr.dir[0], 0, -fr.dir[1])
  const origin = vec3(f.from[0] - fr.out[0] * GLASS_IN, 0, -(f.from[1] - fr.out[1] * GLASS_IN))
  const toSun = vec3(TO_SUN[0], TO_SUN[2], -TO_SUN[1])
  const facing = TO_SUN[0] * fr.out[0] + TO_SUN[1] * fr.out[1]
  const Wp = positionWorld
  const t = origin.sub(Wp).dot(out).div(facing)
  const hit = Wp.add(toSun.mul(t))
  const along = hit.sub(origin).dot(dirW), z = hit.y
  const blur = t.mul(.00925).max(.001)
  // a band of half-width hw at distance d, seen through a disc of width blur
  const band = (d: N, hw: number): N => { const eff = blur.mul(.5).max(hw); return float(hw).div(eff).mul(float(1).sub(smoothstep(eff.mul(.5), eff.mul(1.25), d))) }
  let shade: N = float(0)
  for (const w of WINDOWS.filter(x => x.west)) {
    const o = w.o, x = o.from_m, wd = o.width_m, zb = o.base_m, h = o.height_m, mid = x + wd / 2, transom = zb + h * TRANSOM_AT
    const inside = smoothstep(x - .02, x + .02, along).mul(float(1).sub(smoothstep(x + wd - .02, x + wd + .02, along)))
    let m: N = max(band(abs(along.sub(mid)), MULLION_M / 2), band(abs(z.sub(transom)), TRANSOM_M / 2))
    const bars = Math.max(2, Math.round(h / .44))
    for (let i = 1; i < bars; i++) if (Math.abs(zb + i * h / bars - transom) > .08) m = max(m, band(abs(z.sub(zb + i * h / bars)), .0065).mul(.8))
    // the diamond lattice of each light, centred on it, rows from its sill
    const lower = z.lessThan(transom)
    const cu = along.lessThan(mid).select(float((x + mid - MULLION_M / 2) / 2), float((mid + MULLION_M / 2 + x + wd) / 2))
    const z0 = lower.select(float(zb + .01), float(transom + TRANSOM_M / 2))
    const du = along.sub(cu), dv = z.sub(z0)
    const a = du.add(dv).div(QUARRY_STEP), b = dv.sub(du).div(QUARRY_STEP)
    const da = abs(fract(a.add(.5)).sub(.5)).mul(QUARRY_M), db = abs(fract(b.add(.5)).sub(.5)).mul(QUARRY_M)
    m = max(m, max(band(da, CAME_HALF), band(db, CAME_HALF)).mul(.9))
    shade = max(shade, m.mul(inside))
  }
  return float(1).sub(shade.clamp(0, 1))
}

/* ---- the material ---- */

function hallMaterial(perPixel: boolean, library?: MaterialLibrary): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ metalness: 0, roughness: .85 })
  const A = attribute('hallA', 'vec4'), B = attribute('hallB', 'vec4')
  const kind = A.x, seed = A.w, wear = B.x, soot = B.y, lit = B.z, inHallShade = B.w
  let ambient: N = A.y, bounce: N = A.z, westSky: N = A.y.mul(.6)
  if (perPixel) {
    // the same light as the vertex bake, per point: the hall's windows and
    // sun patches, the passage's hall door, the entrance's court
    const centre = P(HALL_W / 2, HALL_D / 2, FLOOR_Z + 1.6)
    let sky: N = float(0), sun: N = float(ROOM_FILL)
    for (const w of WINDOWS) {
      const f = formFactorNode(w.ap.corners, centre).mul(TRANSMIT * w.ap.radiance)
      sky = sky.add(f)
      if (w.west) westSky = westSky.add(f)
    }
    for (const patch of PATCHES) sun = sun.add(formFactorNode(patch, add(patch[0]!, [0, 0, 1.5])))
    const linkCentre: V3 = [LINK_OUTLINE.reduce((a, q) => a + q[0], 0) / 4, LINK_OUTLINE.reduce((a, q) => a + q[1], 0) / 4, FLOOR_Z + 1.5]
    const door = formFactorNode(linkDoorAp, linkCentre)
    const entrance = passageLightNode()
    const isLink = float(1).sub(lit), isEntrance = lit.mul(float(1).sub(inHallShade))
    ambient = min(float(1), sky.mul(2.4).add(.02)).mul(inHallShade).add(door.mul(.3 * 2.4).add(.02).mul(isLink)).add(entrance.x.mul(isEntrance))
    westSky = westSky.mul(2.4).mul(inHallShade)
    bounce = sun.mul(inHallShade).add(door.mul(2.2).mul(isLink)).add(entrance.y.mul(3.2).mul(isEntrance))
  }
  const is = (k: number): N => float(1).sub(smoothstep(.2, .45, kind.sub(k).abs()))
  const Wp = positionWorld, T = uv()
  // along the passage wall, in metres: what the hearth's courses run along
  const alongWall = Wp.x.mul(V[0]).sub(Wp.z.mul(V[1]))
  // terracotta: each tile its own firing, a mottle within, a sheen where feet
  // have polished it and the wax has been rubbed in
  const fire = fract(seed.mul(43758.5453).sin().mul(17.3)).sub(.5)
  const mottle = mx_noise_float(vec3(Wp.x.mul(7.3), Wp.z.mul(7.3), seed.mul(3.1))).mul(.08).add(mx_noise_float(vec3(Wp.x.mul(31), Wp.z.mul(31), seed)).mul(.035))
  const tileRGB = vec3(.315, .108, .058).mul(fire.mul(.38).add(1)).mul(mottle.add(1))
  const tileColour = mix(mix(tileRGB, tileRGB.mul(vec3(.92, 1.05, 1.1)), smoothstep(.2, .5, fire.abs())), tileRGB.mul(vec3(1.12, 1.02, .95)), wear.mul(.35))
  const joint = vec3(.19, .165, .13).mul(mx_noise_float(Wp.mul(9)).mul(.12).add(1))
  // limewash: a broad wash, a trowel's drag, the brick's courses ghosting
  // through, the smoke of forty-six winters darkening its upper reach
  const wash = mx_noise_float(vec3(Wp.x.mul(1.4), Wp.y.mul(1.1), Wp.z.mul(1.4))).mul(.06)
  const trowel = mx_noise_float(vec3(Wp.x.mul(11), Wp.y.mul(4), Wp.z.mul(11))).mul(.025)
  const course = smoothstep(.40, .5, fract(Wp.y.div(.068)).sub(.5).abs()).mul(.018)
  const age = smoothstep(2.6, 4.2, Wp.y).mul(.10).add(float(1).sub(smoothstep(.8, 1.6, Wp.y)).mul(.06))
  const plaster = vec3(.60, .55, .46).mul(wash.add(trowel).sub(course).add(1)).mul(float(1).sub(age))
  // oak: grain along the member
  const grain = mx_noise_float(vec3(T.x.mul(2.2), T.y.mul(38), seed.mul(13))).mul(.14).add(mx_noise_float(vec3(T.x.mul(9), T.y.mul(120), seed)).mul(.05))
  const oak = vec3(.108, .066, .038).mul(grain.add(1)).mul(fract(seed.mul(7.31)).mul(.18).add(.91))
  // tuffeau in ashlar courses of about 0.30 m, each block its own cream
  const courseN = floor(Wp.y.div(.30)), inCourse = fract(Wp.y.div(.30))
  const blockN = floor(alongWall.div(.46).add(courseN.mul(.5)))
  const blockHue = fract(courseN.mul(12.9898).add(blockN.mul(78.233)).sin().mul(43758.5)).sub(.5)
  const bedJoint = float(1).sub(smoothstep(.003, .009, inCourse.min(float(1).sub(inCourse)).mul(.30)))
  const headJoint = float(1).sub(smoothstep(.003, .009, fract(alongWall.div(.46).add(courseN.mul(.5))).min(float(1).sub(fract(alongWall.div(.46).add(courseN.mul(.5))))).mul(.46)))
  const stoneJoint = max(bedJoint, headJoint).mul(is(K.STONE))
  const tuff = vec3(.52, .47, .37).mul(mx_noise_float(Wp.mul(6.5)).mul(.08).add(mx_noise_float(Wp.mul(33)).mul(.045)).add(mx_noise_float(Wp.mul(1.7)).mul(.05)).add(blockHue.mul(.07)).add(1))
    .mul(float(1).sub(float(1).sub(smoothstep(.8, 1.5, Wp.y)).mul(.12)))
  let tuffJ: N = mix(tuff, tuff.mul(vec3(.88, .86, .84)), stoneJoint)
  // the shell's own tuffeau set, already loaded for the house: its fine grain
  if (library) {
    const maps = library.sync('stone-tuffeau').sample({ uv: T, metres: .19, turn: .37 })
    tuffJ = tuffJ.mul(mix(float(1), maps.albedo.clamp(.88, 1.12), .22))
  }
  // brick of the fireback: thin Loire bricks in courses
  // along each face's own horizontal metres, so a cheek square to the wall courses as the back does
  const bCourse = floor(Wp.y.div(.066)), bIn = fract(Wp.y.div(.066)), bAlong = fract(T.x.div(.23).add(bCourse.mul(.5)))
  const bJoint = max(float(1).sub(smoothstep(.08, .16, bIn.min(float(1).sub(bIn)))), float(1).sub(smoothstep(.025, .05, bAlong.min(float(1).sub(bAlong)))))
  const brickHue = fract(bCourse.mul(3.7).add(floor(T.x.div(.23).add(bCourse.mul(.5))).mul(9.1)).sin().mul(4375.5)).sub(.5)
  const brick = mix(vec3(.17, .066, .040).mul(brickHue.mul(.3).add(1)), vec3(.13, .115, .10), bJoint)
  // iron, forged and dark; ash; char
  const iron = vec3(.040, .038, .035).mul(mx_noise_float(Wp.mul(40)).mul(.25).add(1))
  const ashC = vec3(.30, .29, .27).mul(mx_noise_float(Wp.mul(25)).mul(.25).add(1))
  const charC = mix(vec3(.018, .016, .015), vec3(.20, .19, .18), smoothstep(.2, .7, mx_noise_float(Wp.mul(30))).mul(.5))
  // the furniture's oak: darker, waxed, handled
  const wax = vec3(.096, .056, .031).mul(grain.mul(.7).add(1)).mul(fract(seed.mul(3.17)).mul(.16).add(.92))
  const brass = vec3(.50, .36, .16).mul(mx_noise_float(Wp.mul(60)).mul(.08).add(.95))
  const glaze = mix(vec3(.030, .075, .024), vec3(.045, .10, .035), mx_noise_float(Wp.mul(35)).mul(.5).add(.5))
  // oak the weather has silvered, its grain opened
  const silvered = vec3(.20, .175, .145).mul(grain.mul(2.2).add(1)).mul(mx_noise_float(vec3(Wp.y.mul(.8), seed.mul(5.1), 1.7)).mul(.16).add(1)).mul(fract(seed.mul(9.13)).mul(.22).add(.86))
  const clean = silvered.mul(is(K.WEATHERED)).add(wax.mul(is(K.WAX))).add(brass.mul(is(K.BRASS))).add(glaze.mul(is(K.GLAZE))).add(tileColour.mul(is(K.TILE))).add(joint.mul(is(K.JOINT))).add(plaster.mul(is(K.PLASTER))).add(oak.mul(is(K.OAK)))
    .add(tuffJ.mul(is(K.STONE))).add(brick.mul(is(K.BRICK))).add(iron.mul(is(K.IRON))).add(ashC.mul(is(K.ASH))).add(charC.mul(is(K.CHAR)))
  // soot: carried by the surface, gathered in blotches and rising streaks
  const sootField = soot.mul(mx_noise_float(vec3(Wp.x.mul(3), Wp.y.mul(1.2), Wp.z.mul(3))).mul(.35).add(.8)).clamp(0, 1)
  const colour = mix(clean, vec3(.012, .011, .010), sootField)
  m.colorNode = colour
  m.roughnessNode = float(.9).sub(is(K.TILE).mul(float(.22).add(wear.mul(.28)))).sub(is(K.OAK).mul(.12)).add(is(K.JOINT).mul(.05)).sub(is(K.IRON).mul(.3))
    .sub(is(K.WAX).mul(.38)).sub(is(K.BRASS).mul(.55)).sub(is(K.GLAZE).mul(.72)).add(is(K.WEATHERED).mul(.05))
  m.metalnessNode = is(K.IRON).mul(.45).add(is(K.BRASS))
  m.aoNode = clamp(ambient, 0, 1)
  // A surface of the passage takes no direct sun: nothing faces it.
  const shade = windowShade()
  m.receivedShadowNode = Fn(([shadow]: N[]) => shadow.mul(lit).mul(mix(float(1), shade, inHallShade)))
  m.userData['engineWindowShade'] = true
  // THE FLOOR'S SUN, SENT BACK: baked form factors from the hour's patches,
  // times the key's colour and strength. The film's true bounce replaces it;
  // `engineBounce` marks the term the export turns off.
  // the west lights look onto a sunlit terrace and garden, the back ones onto
  // the north sky: their day reaches the walls warm and cool
  const northSky = ambient.sub(westSky).max(0)
  m.emissiveNode = colour.mul(vec3(1, .73, .545).mul(bounce.mul(.16 * TO_SUN[2] * 3.2 * 5.2 / Math.PI)).add(vec3(.19, .155, .115).mul(westSky)).add(vec3(.12, .13, .14).mul(northSky)))
  m.userData['engineBounce'] = true
  m.name = 'vinci/house-hall/fabric'
  return m
}
