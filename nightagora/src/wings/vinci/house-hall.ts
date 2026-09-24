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
import { AddEquation, AdditiveBlending, BufferGeometry, CustomBlending, DirectionalLight, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, OneFactor, ShadowNode, SrcAlphaFactor, Vector3, ZeroFactor } from 'three/webgpu'
import * as TSL from 'three/tsl'
import raw from './data/closluce.json?raw'
import { hourKey } from './site'
import { SHADOW_ONLY_LAYER } from '../../stack/light'
import type { TierName } from '../../stack/tier'
import type { MaterialLibrary } from '../../stack/materials'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { Fn, abs, acos, attribute, cameraPosition, clamp, exp, float, floor, fract, max, min, mix, mx_noise_float, normalWorld, normalWorldGeometry, positionWorld, smoothstep, uv, vec2, vec3 } = TSL as unknown as Record<string, N>

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
/** a tile and its joint: every tile runs to its joints' centre lines */
const PITCH = TILE_M + JOINT_M
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
/** Linings and door cheeks run this far down past the tiles into the floor's
 * bed, and the bed this far under them: nothing is built beneath the floor, so
 * a slit at a wall's foot would show the day outside the foundations. */
const FOOT = .03, BED_UNDER = .04
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
/** The diagonal field's outline, a border row in from the walls: the joint the
 * border and the field share runs along it. Each edge as a point and its
 * inward normal in the hall's frame. */
const FIELD_EDGES: { a: V2; n: V2 }[] = (() => {
  const f = inset(hallOutline.map(toUV), PITCH)
  return f.map((a, i) => { const b = f[(i + 1) % f.length]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]); return { a, n: [-(b[1] - a[1]) / l, (b[0] - a[0]) / l] as V2 } })
})()
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
export const K = { TILE: 0, JOINT: 1, PLASTER: 2, OAK: 3, STONE: 4, BRICK: 5, IRON: 6, BRASS: 7, GLAZE: 8, ASH: 9, CHAR: 10, WAX: 11, WEATHERED: 12, REVEAL: 13, CLOTH: 14, EARTH: 15 } as const
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
  /** A quad whose corners carry their own normals, for a face that turns
   * smoothly (a rounded arris); wound by the mean of them. */
  quadN(a: V3, b: V3, c: V3, d: V3, na: V3, nb: V3, nc: V3, nd: V3, ta: V2, tb: V2, tc: V2, td: V2, kind: number, seed: number): void {
    const mean = add(add(na, nb), add(nc, nd))
    for (const [p, q, r] of [[[a, na, ta], [b, nb, tb], [c, nc, tc]], [[a, na, ta], [c, nc, tc], [d, nd, td]]] as [V3, V3, V2][][]) {
      const g = cross(sub(q![0], p![0]), sub(r![0], p![0]))
      if (len(g) < 1e-10) continue
      for (const [x, n, t] of dot(g, mean) < 0 ? [p!, r!, q!] : [p!, q!, r!]) this.v.push({ p: x, n, t, kind, seed, wear: this.wear, soot: this.soot, lit: this.lit, cast: this.cast, ...(this.fixed ? { fixed: this.fixed } : {}) })
    }
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
  /** A member of one convex section from a to b. The section is in metres
   * along `side` and `up`; uv runs along the member first, so grain follows
   * it. Edges listed in `hide` (by index from each point to the next) and the
   * caps can be left out where the member meets masonry. */
  extrude(a: V3, b: V3, side: V3, up: V3, section: V2[], kind: number, seed: number, hide: number[] = [], caps: [boolean, boolean] = [true, true]): void {
    const at = (c: V3, q: V2): V3 => add(add(c, scale(side, q[0])), scale(up, q[1]))
    const axis = unit(sub(b, a)), l = len(sub(b, a)), n = section.length
    const cx = section.reduce((t, q) => t + q[0], 0) / n, cy = section.reduce((t, q) => t + q[1], 0) / n
    let run = 0
    for (let i = 0; i < n; i++) {
      const p = section[i]!, q = section[(i + 1) % n]!, w = Math.hypot(q[0] - p[0], q[1] - p[1])
      if (!hide.includes(i)) {
        let e: V2 = [q[1] - p[1], p[0] - q[0]]
        if (e[0] * ((p[0] + q[0]) / 2 - cx) + e[1] * ((p[1] + q[1]) / 2 - cy) < 0) e = [-e[0], -e[1]]
        const normal = unit(add(scale(side, e[0]), scale(up, e[1])))
        this.quad(at(a, p), at(b, p), at(b, q), at(a, q), normal, [0, run], [l, run], [l, run + w], [0, run + w], kind, seed)
      }
      run += w
    }
    for (const [k, c, nrm] of [[0, a, scale(axis, -1)], [1, b, axis]] as [number, V3, V3][])
      if (caps[k]) this.poly(section.map(q => at(c, q)), nrm, p => [dot(sub(p, c), side), dot(sub(p, c), up)], kind, seed)
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
/** THE DAY THROUGH THE GLASS, AS THE PRINT HOLDS IT. The hall is printed more
 * than a stop over the court, so the day behind the glass would print past
 * white: the room's own view of it is taken down to about the court's print,
 * as a photographer holds a window, and only in the glass the room looks
 * through. No light in the room changes: the sun's patches come by the key. */
const WINDOW_PULL = .5, MILK = .35

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
    // the wide eye stands at the passage's face of the partition, so the
    // doorway's reveals take a narrow margin of the frame, not half of it
    const v = (linkDoorV[0] + linkDoorV[1]) / 2, e = fromUV(HALL_W + (narrow ? 1.25 : .92), v), a = fromUV(0, v - .35)
    return { eye: [e[0], e[1], eyeZ], at: [a[0], a[1], FLOOR_Z + (narrow ? 1.15 : 1.3)], fov: narrow ? 74 : 52 }
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
/** the jambs of the passage's other side door, to the workshop */
const WORKSHOP_JAMBS: V2[] = (() => {
  const o = ENTRY_ROOM.openings.find(x => x.connects_to === 'workshop-reference')
  if (!o) return []
  const p = ENTRY_ROOM.polygon as V2[], a = p[1]!, b = p[2]!, l = Math.hypot(b[0] - a[0], b[1] - a[1])
  return [o.from_m, o.from_m + o.width_m].map(t => [a[0] + (b[0] - a[0]) * t / l, a[1] + (b[1] - a[1]) * t / l] as V2)
})()
/** THE ENTRANCE PASSAGE'S LIGHT, baked once: what a point sees of the court
 * through the open door and the window beside it, and of the warm light the
 * great hall sends through the service passage's door. */
/** How far a point stands out past the entrance's outer face, in metres:
 * the reveal's outer lip belongs to the court's light, not the passage's. */
const outPast = (at: V3): number => { const fr = frame(ENTRY_F); return (at[0] - ENTRY_F.from[0]) * fr.out[0] + (at[1] - ENTRY_F.from[1]) * fr.out[1] }
export function passageLight(at: V3, n: V3): [number, number] {
  const lip = Math.min(1, Math.max(0, (outPast(at) + .12) / .17))
  const court = Math.max(lip * .32, formFactor(at, n, COURT_DOOR.corners, COURT_DOOR.inward, 3) + formFactor(at, n, COURT_WINDOW.corners, COURT_WINDOW.inward, 2) * TRANSMIT)
  const hall = formFactor(at, n, PASSAGE_DOOR.corners, PASSAGE_DOOR.inward, 2)
  return [Math.min(1, .03 + court * 2.2), hall * .9 + court * .12]
}

/** The passage's baked light, laid on a material of the entrance passage:
 * ambient occlusion from what each point sees of the court, and the warm
 * light of the hall arriving through the side door. `engineBounce`. */
export function applyPassageLight(m: MeshStandardNodeMaterial, perPixel = true): void {
  const light = perPixel ? passageLightNode() : attribute('passage', 'vec2')
  const corners = perPixel ? passageCorners() : float(1)
  m.aoNode = clamp(light.x, 0, 1).mul(corners)
  const base = m.colorNode ?? vec3(.5, .5, .5)
  m.emissiveNode = base.mul(vec3(1, .74, .52).mul(light.y.mul(.9)).add(vec3(.16, .14, .115).mul(light.x))).mul(corners)
  m.userData['engineBounce'] = true
}
/** THE PASSAGE'S CORNERS: where two of its faces meet, each hides half the
 * other's view of the door, so a corner holds less of the court's light than
 * an open face. Every face is weighed by how square it stands to the point's
 * own. An engine term with the rest of the passage's light. */
function passageCorners(): N {
  const outline = ENTRY_ROOM.polygon as V2[], z0 = FLOOR_Z, z1 = FLOOR_Z + ENTRY_ROOM.height_m
  const cx = outline.reduce((a, q) => a + q[0], 0) / outline.length, cy = outline.reduce((a, q) => a + q[1], 0) / outline.length
  const Pw = positionWorld, Nw = normalWorldGeometry, north = Pw.z.negate()
  const near = (dist: N, weight: N): N => float(1).sub(exp(dist.max(0).div(-.32)).mul(weight).mul(.42))
  let occ: N = near(Pw.y.sub(z0), float(1).sub(Nw.y.abs())).mul(near(float(z1).sub(Pw.y), float(1).sub(Nw.y.abs())))
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!, b = outline[(i + 1) % outline.length]!, l = Math.hypot(b[0] - a[0], b[1] - a[1])
    let n: V2 = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]
    if ((cx - a[0]) * n[0] + (cy - a[1]) * n[1] < 0) n = [-n[0], -n[1]]
    const dist = Pw.x.sub(a[0]).mul(n[0]).add(north.sub(a[1]).mul(n[1]))
    occ = occ.mul(near(dist, float(1).sub(Nw.x.mul(n[0]).sub(Nw.z.mul(n[1])).abs())))
  }
  return occ
}
/** The same light as `passageLight`, per point of the surface. */
function passageLightNode(): N {
  const inside: V3 = (() => { const p = ENTRY_ROOM.polygon as V2[]; return [p.reduce((a, q) => a + q[0], 0) / 4, p.reduce((a, q) => a + q[1], 0) / 4, FLOOR_Z + 1.5] })()
  const fr = frame(ENTRY_F), P = positionWorld
  const outside = P.x.sub(ENTRY_F.from[0]).mul(fr.out[0]).sub(P.z.add(ENTRY_F.from[1]).mul(fr.out[1]))
  const lip = smoothstep(-.12, .05, outside)
  const court = max(lip.mul(.32), formFactorNode(COURT_DOOR.corners, inside).add(formFactorNode(COURT_WINDOW.corners, inside).mul(TRANSMIT)))
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

/** LIMEWASH OVER BRICK, as forty-six years leave it: the finish of the house's
 * brick walls and partitions in three scales. Metres: the coats lie thicker
 * and thinner in patches, and yellow unevenly. Decimetres: the brick's
 * courses read through the wash, each brick its own tone, and where the wash
 * has come away the brick and its joints are bare. Millimetres: the lime's
 * own grain. The wear is densest at the foot (brooms, damp, splashes) and
 * wherever `wear` says hands and shoulders pass. `T` is the surface's uv in
 * metres (along the wall, height), `floorZ` the floor's height; every
 * feature fades out before a pixel can hold less than a sixth of it. */
export function limewashOverBrick(T: N, floorZ: number, base: N, seed: number, wear: N = float(0), o: { thin?: number; contrast?: number; tide?: number; layered?: boolean } = {}): { albedo: N; bare: N } {
  const thinBias = o.thin ?? 0, k = o.contrast ?? 1
  const rho = T.dFdx().length().max(T.dFdy().length()).max(1e-6)
  const fade = (L: number): N => float(1).sub(smoothstep(L / 6, L / 2.5, rho))
  const h = T.y.sub(floorZ)
  // the bond: thin Loire bricks, 0.225 m with 10 mm joints, courses of 66 mm
  const courseH = .066, brickL = .235, jw = .005
  // each course set out by hand: its own offset, its joints not quite plumb
  const row = floor(T.y.div(courseH)), fr = fract(T.y.div(courseH))
  const rowShift = fract(row.mul(.5)).add(fract(row.mul(7.13).sin().mul(311.7)).sub(.5).mul(.3))
  const bx = T.x.div(brickL).add(rowShift).add(mx_noise_float(vec3(T.x.mul(2.1), row.mul(.37), seed + 17)).mul(.06)), col = floor(bx), fc = fract(bx)
  const id = fract(row.mul(12.9898).add(col.mul(78.233)).add(seed).sin().mul(43758.5453))
  const d = min(fr.min(float(1).sub(fr)).mul(courseH), fc.min(float(1).sub(fc)).mul(brickL))
  const joint = float(1).sub(smoothstep(rho.negate().add(jw), rho.add(jw), d)).mul(fade(.04))
  const n = (sx: number, sy: number, k: number): N => mx_noise_float(vec3(T.x.div(sx), T.y.div(sy), seed + k))
  const nL = n(1.3, .9, 0), nP = n(.55, .4, 5).mul(fade(.4)), nM = n(.16, .12, 3).mul(fade(.12)), nS = n(.03, .025, 7).mul(fade(.025)), nF = n(.006, .005, 11).mul(fade(.005))
  // the foot: 1 at the floor, gone by knee height, its upper edge ragged
  const foot = float(1).sub(smoothstep(.1, .8, h.add(nL.mul(.2)).add(nM.mul(.07))))
  const thin = clamp(nL.mul(.45).add(.16 + thinBias).add(nP.mul(.25)).add(foot.mul(.4)).add(wear.mul(.12)), 0, 1)
  // bare: a ragged band along the floor where brooms and damp have taken the
  // wash, and scars where it has come away. A wall fails in zones, not evenly:
  // most of it holds, and where it goes it goes in flakes of every size, whose
  // outlines the grain of the coat tears, so no two read alike
  const band = float(1).sub(smoothstep(.04, .2, h.add(nM.mul(.1)).add(nS.mul(.035)).add(nL.mul(.05))))
  const zone = smoothstep(-.15, .5, n(2.7, 1.9, 23)).mul(.22)
  const warp = vec2(n(.23, .19, 29), n(.21, .23, 31)).mul(.09).mul(fade(.2))
  const torn = mx_noise_float(vec3(T.x.add(warp.x).div(.42), T.y.add(warp.y).div(.31), seed + 5))
  const sheet = smoothstep(.5, .6, n(1.5, 1.1, 37).add(nM.mul(.12))).mul(.3)
  const scar = smoothstep(.62, .68, torn.mul(.7).add(nM.mul(.28)).add(nS.mul(.09)).add(zone).add(sheet).add(foot.mul(.14)).add(wear.mul(.06)))
  let bare: N = max(band, scar).mul(fade(.06))
  // the brick under it, each its own firing, and the mortar between
  const brick = mix(vec3(.40, .17, .10), vec3(.29, .13, .10), smoothstep(.82, .9, id)).mul(id.sub(.5).mul(.34).add(1)).mul(nS.mul(.12).add(1))
  // the wash's residue stays in the brick's pores where the coat has flaked
  const under = mix(mix(brick, vec3(.47, .41, .35), .3), vec3(.50, .45, .38), joint)
  // the coats: tone at three scales, yellowed in patches; a later coat laid
  // over part of the wall, fresher, its lap a ragged edge; the brush's strokes
  // crossing in it
  const lap = smoothstep(.0, .035, n(1.4, 1.0, 41).add(nM.mul(.09)).add(nS.mul(.025))).mul(fade(.1))
  const stroke = (c: number, sn: number, key: number): N => mx_noise_float(vec3(T.x.mul(c).add(T.y.mul(sn)).div(.3), T.y.mul(c).sub(T.x.mul(sn)).div(.014), seed + key))
  const brush = stroke(.8, .6, 43).add(stroke(.8, -.6, 47)).mul(fade(.014))
  const coat = base.mul(nL.mul(.12 * k).add(nP.mul(.07 * k)).add(nM.mul(.04 * k)).add(nS.mul(.035)).add(nF.mul(.045)).add(brush.mul(.022 * k)).add(1))
    .mul(mix(vec3(1, 1, 1), vec3(1.035, 1, .92), smoothstep(-.2, .4, nL))).mul(mix(vec3(1, 1, 1), vec3(1.08, 1.08, 1.085), lap.mul(.8)))
  // through the wash: the brick's warmth where it is thin, each brick's tone,
  // the joints a shade darker where the lime sits in them
  const through = coat.mul(mix(vec3(1, 1, 1), vec3(1.10, .94, .86), thin.mul(.8)))
    .mul(id.sub(.5).mul(thin.mul(.18).add(.02)).mul(fade(.06)).add(1))
    .mul(float(1).sub(joint.mul(thin.mul(.16).add(.03))))
  // a scar's edge: the wash's own thickness, a lighter lip
  let washed: N = mix(through, under, bare.mul(.85))
  if (o.layered) {
    // LOSSES IN LAYERS, as a wall of forty-six years sheds them: the wash
    // flakes first and shows the sandy render under it, and where the render
    // too has let go the brick shows in its courses. The loss field is warped
    // at two scales and summed over four, so no two losses share an outline;
    // it fails in zones and at the foot, and its edges step along the joints
    const X = T.x.add(warp.x).add(n(.31, .27, 61).mul(.07).mul(fade(.2))), Y = T.y.add(warp.y).add(n(.29, .33, 67).mul(.05).mul(fade(.2)))
    const f = (y: N, k: number): N => mx_noise_float(vec3(X.div(.62), y.div(.36), seed + 71)).mul(.5)
      .add(mx_noise_float(vec3(X.div(.23), y.div(.14), seed + 73)).mul(.28).mul(fade(.14)))
      .add(mx_noise_float(vec3(X.div(.085), y.div(.06), seed + 79)).mul(.15).mul(fade(.06)))
      .add(mx_noise_float(vec3(X.div(.028), y.div(.022), seed + 83)).mul(.045).mul(fade(.022))).add(k)
    const where = smoothstep(-.1, .6, n(3.3, 2.1, 89)).mul(.25).add(foot.mul(.16)).add(wear.mul(.1)).add(joint.mul(.035))
    const lossAt = (dy: number): N => f(Y.add(dy), 0).add(where)
    const v = lossAt(0), vUp = lossAt(.012)
    const e = rho.mul(3).max(.004)
    const t1 = float(.5), t2 = float(.585).add(n(.19, .15, 97).mul(.03))
    const finish = smoothstep(t1.sub(e), t1.add(e), v), render = smoothstep(t2.sub(e), t2.add(e), v)
    // the render: lime and coarse sand, trowelled, a shade warmer than the wash
    const sand = mx_noise_float(vec3(T.x.div(.004), T.y.div(.004), seed + 101)).mul(fade(.004))
    const rendered = vec3(.47, .41, .33).mul(sand.mul(.12).add(nM.mul(.08)).add(1))
    // the broken edge of the wash, fresh lime, lighter than its face; the
    // edges above a loss hang over it and shade its top
    const lip = smoothstep(t1.sub(.035), t1, v).mul(float(1).sub(finish)).mul(fade(.03))
    const shadeUnder = (lo: N, up: N, t: N): N => lo.mul(float(1).sub(smoothstep(t.sub(e), t.add(e), up)))
    const layered = mix(mix(through.mul(lip.mul(.13).add(1)), rendered, finish), under, render)
      .mul(float(1).sub(shadeUnder(finish, vUp, t1).mul(.18)).sub(shadeUnder(render, vUp, t2).mul(.34)))
    washed = mix(layered, under, band.mul(fade(.06)).mul(.85))
    bare = max(band.mul(fade(.06)), render)
  }
  // splashes and dirt at the foot; the grey of hands at the jambs
  const grime = foot.mul(nM.mul(.35).add(.65)).mul(.13).add(wear.mul(nS.mul(.3).add(.7)).mul(.16))
  // the damp the wall draws up from the ground: a greyed zone to a wavering
  // height, its salts left as a darker tide line along the top
  const tideH = nL.mul(.12).add(nM.mul(.05)).add(o.tide ?? .34)
  const damp = float(1).sub(smoothstep(tideH.sub(.14), tideH, h))
  const tide = exp(h.sub(tideH).div(.022).pow(2).negate()).mul(fade(.05))
  // knocks and rubs from things carried past, long and low
  const scuff = smoothstep(.5, .78, mx_noise_float(vec3(T.x.div(.42), T.y.div(.035), seed + 13))).mul(fade(.035))
    .mul(smoothstep(.22, .4, h)).mul(float(1).sub(smoothstep(.9, 1.25, h)))
  // a settlement crack, hairline, where the wall has moved: a line of the
  // coat's own field, only here and there along it
  // (the field's slope is about two per metre, so half its value is the
  // distance to the line)
  const crackAt = n(.9, 1.2, 53).abs().mul(.5)
  const crack = float(1).sub(smoothstep(rho.mul(.3), rho.mul(.9).add(.0006), crackAt)).mul(smoothstep(.25, .45, n(2.2, 3.1, 59))).mul(fade(.02))
  const aged = mix(washed, washed.mul(vec3(.78, .76, .74)), grime.min(1).mul(1.8).min(1)).mul(float(1).sub(grime.mul(.35)))
    .mul(mix(vec3(1, 1, 1), vec3(1 - .2 * k, 1 - .19 * k, 1 - .22 * k), damp.mul(float(1).sub(bare)))).mul(float(1).sub(tide.mul(.14 * k)).sub(scuff.mul(.09 * k)).sub(crack.mul(.35)))
  return { albedo: aged, bare }
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

export interface HouseHall { group: Group; triangles: number; patches: number
  /** called every frame: `changed` when what casts may have changed; the
   * hall's own sun shadow is redrawn once the eye (east, north, up) is near */
  refreshSun?: (eye: V3, changed: boolean) => void }

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
  const sun = hero ? hallSun() : null
  const material = hallMaterial(hero, library, sun?.node)
  if (sun) material.addEventListener('dispose', () => sun.dispose())
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
  return { group, triangles, patches: PATCHES.length, ...(sun ? { refreshSun: sun.refresh } : {}) }
}

/* ---- the sun's shadow inside the hall ---- */

/** THE HALL'S OWN SUN SHADOW. The key's near cascade spans forty metres on a
 * 1024 map: a 39 mm texel, whose filter spreads every edge over some 12 cm,
 * so a table leg's shadow at the eye's feet blurs as though the leg stood
 * metres off the floor. The hall's sunlit faces read a second map of the same
 * sun fitted to the room alone (about 5 mm a texel). It is drawn once, and
 * again only when what casts has changed while the eye is near the hall.
 * The light is never added to the scene: no other material samples it. */
interface HallSun { node: N; refresh: (eye: V3, changed: boolean) => void; dispose: () => void }
/** The fine map's own node: the hall reads it inside its received-shadow
 * hook, so it must not pass through that hook a second time. */
class HallSunShadowNode extends ShadowNode {
  override setup(builder: N): N {
    if (builder.renderer.shadowMap.enabled === false) return undefined
    const self = this as unknown as { _currentShadowType: unknown; _node: N; _reset: () => void; setupShadowPosition: (b: N) => void; setupShadow: (b: N) => N }
    return Fn(() => {
      const type = builder.renderer.shadowMap.type
      if (self._currentShadowType !== type) { self._reset(); self._node = null }
      self.setupShadowPosition(builder)
      if (self._node === null) { self._node = self.setupShadow(builder); self._currentShadowType = type }
      return self._node
    })()
  }
}
/** The hall's sunlit faces lie within this box, in the hall's frame. */
const SUN_BOX = { u0: -.6, u1: HALL_W + .6, v0: -.8, v1: HALL_D + .6 }
function hallSun(): HallSun {
  const light = new DirectionalLight(0xffffff, 0)
  const three = (p: V3): Vector3 => new Vector3(p[0], p[2], -p[1])
  const centre = P(HALL_W / 2, HALL_D / 2, FLOOR_Z + 1.6)
  light.position.copy(three(add(centre, scale(TO_SUN, 60))))
  light.target.position.copy(three(centre))
  light.updateMatrixWorld(); light.target.updateMatrixWorld()
  const sh = light.shadow, cam = sh.camera
  cam.layers.enable(SHADOW_ONLY_LAYER)
  sh.mapSize.setScalar(2048)
  sh.bias = -.0001; sh.normalBias = .004
  cam.near = .5; cam.far = 120
  sh.updateMatrices(light)
  // the box the light looks down: every corner of the hall's box, floor to boards
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const u of [SUN_BOX.u0, SUN_BOX.u1]) for (const v of [SUN_BOX.v0, SUN_BOX.v1]) for (const z of [FLOOR_Z - .05, BOARD_Z + .05]) {
    const q = three(P(u, v, z)).applyMatrix4(cam.matrixWorldInverse)
    x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y)
  }
  cam.left = x0; cam.right = x1; cam.bottom = y0; cam.top = y1
  cam.updateProjectionMatrix()
  sh.updateMatrices(light)
  sh.autoUpdate = false; sh.needsUpdate = true
  const node = new HallSunShadowNode(light, sh)
  const reach = Math.hypot(HALL_W, HALL_D) / 2 + 4
  let stale = false
  return {
    node,
    refresh: (eye, changed) => {
      stale ||= changed
      if (stale && Math.hypot(eye[0] - centre[0], eye[1] - centre[1]) < reach) { sh.needsUpdate = true; stale = false }
    },
    dispose: () => { node.dispose(); light.dispose() },
  }
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
  const south = { a: SW, b: SE, holes: [[kitchenDoorU[0], kitchenDoorU[1], FLOOR_Z - FOOT, FLOOR_Z + DOOR_H]] as [number, number, number, number][] }
  const east = { a: SE, b: NE, holes: [[linkDoorV[0], linkDoorV[1], FLOOR_Z - FOOT, FLOOR_Z + DOOR_H]] as [number, number, number, number][] }
  const north = { a: NE, b: NW, holes: WINDOWS.filter(w => !w.west).map(w => hole(NE, NW, BACK, w.o)) }
  const west = { a: NW, b: SW, holes: WINDOWS.filter(w => w.west).map(w => hole(NW, SW, WEST, w.o)) }
  walls.push(south, east, north, west)
  walls.forEach((w, i) => lining(s, w.a, w.b, FLOOR_Z - FOOT, BOARD_Z, w.holes, cell, K.PLASTER, seed + i))
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

/** A floor of square tiles on their lime bed, laid along the room's walls,
 * as the passages are paved. */
function squareFloor(s: Sink, outline: V2[], z: number): void {
  // the edge tiles run a hand under the linings, so no joint opens at a wall
  const room = inset(outline.map(toUV), -.01)
  s.poly(inset(outline.map(toUV), -BED_UNDER).map(q => P(q[0], q[1], z - .006)), [0, 0, 1], p => toUV([p[0], p[1]]), K.JOINT, .6)
  const pitch = PITCH, us = room.map(q => q[0]), vs = room.map(q => q[1])
  const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs)
  for (let i = 0; u0 + i * pitch < u1; i++) for (let j = 0; v0 + j * pitch < v1; j++) {
    const a = u0 + i * pitch, b = v0 + j * pitch
    const c = clipConvex([[a, b], [a + pitch, b], [a + pitch, b + pitch], [a, b + pitch]], room)
    if (c.length >= 3 && Math.abs(signedArea(c)) > pitch * pitch * .12) tile(s, c, z, rand(i, j, 5.9), [a + pitch / 2, b + pitch / 2], [1, 0])
  }
}

/** The tiled floor: a square border row and the diagonal field, each tile a
 * low prism with a worn arris, standing on its lime bed. */
function tiledFloor(s: Sink, outline: V2[], z: number): void {
  const room = outline.map(toUV)
  // the lime bed under everything, a few millimetres down and on under the linings
  s.poly(inset(room, -BED_UNDER).map(q => P(q[0], q[1], z - .006)), [0, 0, 1], p => toUV([p[0], p[1]]), K.JOINT, .5)
  const pitch = PITCH
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
      const quad: V2[] = [[from, 0], [to, 0], [to, pitch], [from, pitch]]
        .map(([x, y]) => [a[0] + d[0] * x! + inward[0] * y!, a[1] + d[1] * x! + inward[1] * y!])
      const clipped = clipConvex(quad, room)
      const mid = (from + to) / 2, centre: V2 = [a[0] + d[0] * mid + inward[0] * pitch / 2, a[1] + d[1] * mid + inward[1] * pitch / 2]
      if (clipped.length >= 3 && Math.abs(signedArea(clipped)) > 1e-4) tile(s, clipped, z, rand(e, key, 7.1), centre, d, [(to - from) / 2, pitch / 2])
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
  const half = pitch / 2
  for (let i = -reach; i <= reach; i++) for (let j = -reach; j <= reach; j++) {
    const c: V2 = [cu + (A[0] * i + B[0] * j) * pitch, cv + (A[1] * i + B[1] * j) * pitch]
    const quad: V2[] = [[-half, -half], [half, -half], [half, half], [-half, half]].map(([x, y]) => [c[0] + A[0] * x! + B[0] * y!, c[1] + A[1] * x! + B[1] * y!])
    const clipped = clipConvex(quad, field)
    if (clipped.length < 3 || Math.abs(signedArea(clipped)) < pitch * pitch * .12) continue
    tile(s, clipped, z, rand(i, j, 3.3), c, A)
  }
}

/** One tile on its lime bed, its face set a hair high or low and tilted a
 * fraction, so no two catch the low sun alike. The face runs to the centre
 * lines of its joints, which the material draws: a gap between tiles is
 * narrower than a pixel from the walk and would break into dashes. Its uv is
 * metres from the whole cell's centre along its own sides, scaled so the
 * joint's centre line lies at half a pitch, and the material finds its
 * arrises and joints there. */
function tile(s: Sink, poly: V2[], z: number, seed: number, centre: V2, side: V2, half: V2 = [PITCH / 2, PITCH / 2]): void {
  const n = poly.length
  const c: V2 = [poly.reduce((a, p) => a + p[0], 0) / n, poly.reduce((a, p) => a + p[1], 0) / n]
  // none is laid under the hearthstone
  const hs = HEARTH.width / 2 + .05 + .16, hd = HEARTH.depth + .42 + .012 + .16
  if (c[0] > HALL_W - hd && c[0] < HALL_W && Math.abs(c[1] - HEARTH.v) < hs) return
  const top = z + (rand(seed, 1) - .6) * .0016
  const tiltU = (rand(seed, 2) - .5) * .006, tiltV = (rand(seed, 3) - .5) * .006
  const h = (q: V2): number => top + (q[0] - c[0]) * tiltU + (q[1] - c[1]) * tiltV
  const P3 = (q: V2, zz: number): V3 => P(q[0], q[1], zz)
  const kx = PITCH / 2 / half[0], ky = PITCH / 2 / half[1]
  const uvOf = (p: V3): V2 => { const q = toUV([p[0], p[1]]), dx = q[0] - centre[0], dy = q[1] - centre[1]; return [(dx * side[0] + dy * side[1]) * kx, (dy * side[0] - dx * side[1]) * ky] }
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
  // each member's two lower arrises taken off and worn round, as the
  // carpenter finished a timber left in view and the years eased it; the
  // rounds face down to the floor's light
  const across: V3 = [U[0], U[1], 0], alongV: V3 = [V[0], V[1], 0]
  for (let i = 0; i <= jn; i++) {
    const u = first + i * JOIST_STEP
    const seed = 3 + rand(i, 4.4)
    const sag = rand(i, 5.5) * .008
    member(s, P(u, 0, CEIL_Z + sag), P(u, HALL_D, CEIL_Z + sag), across, [0, 0, 1], JOIST_W, JOIST_D, .026 + rand(i, 6.6) * .01, K.OAK, seed)
  }
  // the main beam, across the joists near mid-span, set off the chimney: a
  // beam bears on plain wall, never on the hood or into the flue's masonry
  const MB_W = .34, MB_D = .38, vm = mainBeamV()
  member(s, P(0, vm, CEIL_Z - MB_D), P(HALL_W, vm, CEIL_Z - MB_D), alongV, [0, 0, 1], MB_W, MB_D, .045, K.OAK, 7.7)
  // its two corbels: one tuffeau block each, cut in a quarter round below a
  // fillet and tailed into the wall
  const D = .30, H = .44, f = .07, tail = .03
  const section: V2[] = [[-tail, 0], [D, 0], [D, -f]]
  for (let k = 1; k < 7; k++) { const t = k / 7 * Math.PI / 2; section.push([D * Math.cos(t), -f - (H - f) * Math.sin(t)]) }
  section.push([0, -H], [-tail, -H])
  for (const [u, dirU] of [[0, 1], [HALL_W, -1]] as [number, number][]) {
    const w = (MB_W + .06) / 2, side: V3 = [U[0] * dirU, U[1] * dirU, 0]
    s.extrude(P(u, vm - w, CEIL_Z - MB_D), P(u, vm + w, CEIL_Z - MB_D), side, [0, 0, 1], section, K.STONE, 11 + u, [0, section.length - 2, section.length - 1])
  }
}
/** A timber of w by d from a to b, its two lower arrises worn round to r. The
 * round's normals turn smoothly from the side to the soffit, so the light it
 * takes from the floor falls off across it rather than drawing an edge line.
 * The top (under the boards) and the ends (in the walls) are left out. */
function member(s: Sink, a: V3, b: V3, side: V3, up: V3, w: number, d: number, r: number, kind: number, seed: number): void {
  const k = 5, pts: { q: V2; n: V2 }[] = [{ q: [-w / 2, d], n: [-1, 0] }]
  for (let i = 0; i <= k; i++) { const t = Math.PI * (1 + i / k / 2); pts.push({ q: [-w / 2 + r + Math.cos(t) * r, r + Math.sin(t) * r], n: [Math.cos(t), Math.sin(t)] }) }
  for (let i = 0; i <= k; i++) { const t = Math.PI * (1.5 + i / k / 2); pts.push({ q: [w / 2 - r + Math.cos(t) * r, r + Math.sin(t) * r], n: [Math.cos(t), Math.sin(t)] }) }
  pts.push({ q: [w / 2, d], n: [1, 0] })
  const at = (c: V3, q: V2): V3 => add(add(c, scale(side, q[0])), scale(up, q[1]))
  const nrm = (n: V2): V3 => unit(add(scale(side, n[0]), scale(up, n[1])))
  const l = len(sub(b, a))
  let run = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i]!, q = pts[i + 1]!, wl = Math.hypot(q.q[0] - p.q[0], q.q[1] - p.q[1])
    if (wl < 1e-6) continue
    s.quadN(at(a, p.q), at(b, p.q), at(b, q.q), at(a, q.q), nrm(p.n), nrm(p.n), nrm(q.n), nrm(q.n), [0, run], [l, run], [l, run + wl], [0, run + wl], kind, seed)
    run += wl
  }
}
/** Where the main beam crosses: mid-span, unless that lands its corbel within
 * a hand's breadth and more of the chimneypiece's shelf. */
function mainBeamV(): number {
  const shelfEnd = HEARTH.v - HEARTH.width / 2 - .06
  return Math.min(HALL_D / 2, shelfEnd - .45 - (.34 + .06) / 2)
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
  // on the table: two brass candlesticks, their candles never lit, a jug,
  // and a glazed dish set down in the sun at the table's south end
  const top = FLOOR_Z + TABLE.size[2]
  for (const [k, dv] of [[0, -.35], [1, .35]] as [number, number][]) candlestick(s, P(TABLE.u - .08, TABLE.v + dv, top), 93 + k)
  jug(s, P(TABLE.u + .18, TABLE.v - .02, top), 95)
  dish(s, P(TABLE.u + .06, TABLE.v - 1.05, top), 96)
  // on the chest between the windows: a brass basin and its ewer, for the
  // washing of hands at table
  const chestTop = FLOOR_Z + .776, vc = chestV()
  basin(s, P(.34, vc - .3, chestTop), 97)
  ewer(s, P(.3, vc + .18, chestTop), 98)
  // a cushion on the bench, of the kind the box chair's own was
  cushion(s, P(BENCH.u, BENCH.v - .62, FLOOR_Z + BENCH.size[2]), [V[0], V[1], 0], [U[0], U[1], 0], .21, .15, .06, 99)
}
/** A CUSHION, as the period sat on them (V&A 740-1895: the box chair "used
 * with a cushion"; others sat on benches, stools or floor cushions): wool
 * over a stuffed case, its top puffed, its seams at the edge, sitting on z.
 * Centre, its two axes, half sizes and height. */
function cushion(s: Sink, c: V3, X: V3, Y: V3, hx: number, hy: number, h: number, seed: number): void {
  const n = 8, Z: V3 = [0, 0, 1]
  const lift = (x: number, y: number): number => { const f = Math.max(0, (1 - x ** 4) * (1 - y ** 4)); return h * (.35 + .65 * Math.sqrt(f)) }
  const at = (x: number, y: number, z: number): V3 => add(add(add(c, scale(X, x * hx)), scale(Y, y * hy)), scale(Z, z))
  const top = (x: number, y: number): V3 => at(x, y, lift(x, y))
  const nrm = (x: number, y: number): V3 => { const e = .02, dx = sub(top(Math.min(1, x + e), y), top(Math.max(-1, x - e), y)), dy = sub(top(x, Math.min(1, y + e)), top(x, Math.max(-1, y - e))); const g = cross(dx, dy); return unit(g[2] < 0 ? scale(g, -1) : g) }
  const g = (i: number): number => -1 + 2 * i / n
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x0 = g(i), x1 = g(i + 1), y0 = g(j), y1 = g(j + 1)
    s.quadN(top(x0, y0), top(x1, y0), top(x1, y1), top(x0, y1), nrm(x0, y0), nrm(x1, y0), nrm(x1, y1), nrm(x0, y1), [x0 * hx, y0 * hy], [x1 * hx, y0 * hy], [x1 * hx, y1 * hy], [x0 * hx, y1 * hy], K.CLOTH, seed)
  }
  // the welt round the edge, down to what it sits on
  for (const [ax, ay] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as V2[]) for (let i = 0; i < n; i++) {
    const t0 = g(i), t1 = g(i + 1)
    const p0: V2 = ax ? [ax, t0] : [t0, ay], p1: V2 = ax ? [ax, t1] : [t1, ay]
    const out = unit(add(scale(X, ax), scale(Y, ay)))
    s.quad(at(p0[0], p0[1], .004), at(p1[0], p1[1], .004), top(p1[0], p1[1]), top(p0[0], p0[1]), out, [t0, 0], [t1, 0], [t1, h], [t0, h], K.CLOTH, seed)
  }
}
/** A DISH OF THE PERIOD, after V&A 4010-1901 (probably Beauvais, about 1510
 * to 1520): a footed earthenware dish with a broad rim, lead-glazed. */
function dish(s: Sink, base: V3, seed: number): void {
  s.lathe(base, [[0, .006], [.068, .002], [.072, 0], [.078, .006], [.13, .038], [.158, .047], [.162, .053], [.156, .056], [.128, .049], [.08, .016], [0, .013]], 20, K.EARTH, seed)
}
/** A BRASS BASIN OF THE PERIOD, after the Flemish dishes of the V&A (for
 * example M.124-1937): a broad rim and a raised boss at its centre. */
function basin(s: Sink, base: V3, seed: number): void {
  s.lathe(base, [[0, .002], [.11, 0], [.16, .035], [.185, .05], [.205, .056], [.208, .062], [.2, .062], [.18, .054], [.15, .04], [.105, .01], [.035, .009], [.028, .02], [0, .024]], 22, K.BRASS, seed)
}
/** A BRASS EWER OF THE PERIOD, after V&A 539-1869 (Flemish, fifteenth
 * century): a round body on a spreading foot, a tall neck and a strap handle. */
function ewer(s: Sink, base: V3, seed: number): void {
  s.lathe(base, [[0, 0], [.052, 0], [.054, .008], [.034, .02], [.03, .035], [.06, .07], [.068, .1], [.06, .135], [.035, .16], [.024, .19], [.026, .225], [.034, .245], [.03, .25], [0, .25]], 16, K.BRASS, seed)
  const side: V2 = [U[0], U[1]]
  const q = (o: number, z: number): V3 => [base[0] + side[0] * o, base[1] + side[1] * o, base[2] + z]
  const pts: [number, number][] = [[.026, .23], [.07, .235], [.09, .2], [.085, .14], [.062, .105]]
  for (let i = 0; i < pts.length - 1; i++) {
    const a = q(pts[i]![0], pts[i]![1]), b = q(pts[i + 1]![0], pts[i + 1]![1]), w: V3 = [V[0] * .009, V[1] * .009, 0]
    s.quad(sub(a, w), add(a, w), add(b, w), sub(b, w), null, [0, 0], [1, 0], [1, 1], [0, 1], K.BRASS, seed)
    s.quad(add(a, w), sub(a, w), sub(b, w), add(b, w), null, [0, 0], [1, 0], [1, 1], [0, 1], K.BRASS, seed)
  }
  // the spout, a short tapering tube out of the belly's shoulder
  s.lathe(q(-.07, .115), [[.012, 0], [.009, .06], [0, .062]], 8, K.BRASS, seed)
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
  const boards = 3, gap = .0025
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
 * set at the hearth for the one person the room seated. It stands at the
 * chimneypiece's north end, clear of the hearthstone, and faces the room:
 * from the hall's east door it would show only the plain back of its back. */
function boxChair(s: Sink): void {
  const cu = HALL_W - HEARTH.depth - .6, cv = HEARTH.v + HEARTH.width / 2 + .48
  const turn = -.8913, ca = Math.cos(turn), sa = Math.sin(turn)
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
  // its cushion, as the museum's text says the form was used
  {
    const [uc, vc] = at(0, -.03), X: V3 = [U[0] * ca + V[0] * sa, U[1] * ca + V[1] * sa, 0], Y: V3 = [-U[0] * sa + V[0] * ca, -U[1] * sa + V[1] * ca, 0]
    cushion(s, P(uc, vc, FLOOR_Z + seat), X, Y, W / 2 - st - .005, D / 2 - st - .01, .075, 139)
  }
  // arms, and the tall back with its panels and cresting
  for (const x of [-W / 2, W / 2 - st]) cbox(x - .01, x + st + .01, -D / 2 - .02, D / 2, .66, .7, K.WAX, 133)
  cbox(-W / 2 + st, W / 2 - st, D / 2 - .035, D / 2 - .015, seat, back - .06, K.WAX, 134)
  cbox(-W / 2 - .01, W / 2 + .01, D / 2 - st, D / 2, back - .06, back, K.WAX, 135)
  cbox(-W / 2 + st, W / 2 - st, D / 2 - st, D / 2, seat + .22, seat + .27, K.WAX, 136)
}
/** A STOOL OF THE PERIOD, to V&A 968-1897 (oak, Normandy, late fifteenth
 * century, 0.455 m): a board stool, joined. A top with its upper arrises
 * chamfered on two splayed slab ends, each cut with a round arch between its
 * feet, tied under the top by two aprons whose tenons run through the ends
 * and are wedged outside. */
function stool(s: Sink, u: number, v: number, turn: number, seed: number): void {
  const ca = Math.cos(turn), sa = Math.sin(turn)
  const X: V3 = [U[0] * ca + V[0] * sa, U[1] * ca + V[1] * sa, 0], Y: V3 = [-U[0] * sa + V[0] * ca, -U[1] * sa + V[1] * ca, 0], Z: V3 = [0, 0, 1]
  const o = fromUV(u, v)
  const at = (x: number, y: number, z: number): V3 => add(add(add([o[0], o[1], FLOOR_Z], scale(X, x)), scale(Y, y)), scale(Z, z))
  const H = .455, topT = .032, L = .46, W = .28, ch = .01
  // the top
  s.extrude(at(-L / 2, 0, H - topT), at(L / 2, 0, H - topT), Y, Z, [[-W / 2, 0], [W / 2, 0], [W / 2, topT - ch], [W / 2 - ch, topT], [-W / 2 + ch, topT], [-W / 2, topT - ch]], K.WAX, seed)
  // the two ends, leaning out a tenth toward their feet
  const splay = .1, th = .03, endTop = H - topT, inset = .17, halfTop = .105, halfFoot = .128, archR = .07, archH = .105
  const aprons: [number, number] = [endTop - .085, endTop]
  for (const sign of [-1, 1]) {
    const mid = (z: number): number => sign * (inset + (endTop - z) * splay)
    const half = (z: number): number => halfFoot + (halfTop - halfFoot) * z / endTop
    const Pt = (xn: number, z: number, t: number): V3 => at(mid(z) + t * sign, xn * half(z), z)
    const bottom = (xn: number): number => { const r = archR / halfFoot, a = Math.abs(xn) / r; return a < 1 ? archH * Math.sqrt(1 - a * a) : 0 }
    const out = unit(add(scale(X, sign), scale(Z, splay))), inw = scale(out, -1)
    const cols = [-1, -.8, -.6]
    for (let k = 0; k <= 10; k++) cols.push(-archR / halfFoot + 2 * archR / halfFoot * k / 10)
    cols.push(.6, .8, 1)
    for (let i = 0; i < cols.length - 1; i++) {
      const a = cols[i]!, b = cols[i + 1]!, za = bottom(a), zb = bottom(b)
      for (const [t, n] of [[th / 2, out], [-th / 2, inw]] as [number, V3][])
        s.quad(Pt(a, za, t), Pt(b, zb, t), Pt(b, endTop, t), Pt(a, endTop, t), n, [za, a * .12], [zb, b * .12], [endTop, b * .12], [endTop, a * .12], K.WAX, seed + .1)
      // the arch's cut face, where there is one
      if (za > 1e-4 || zb > 1e-4) {
        const e = sub(Pt(b, zb, 0), Pt(a, za, 0)), n = unit(cross(e, out))
        s.quad(Pt(a, za, th / 2), Pt(b, zb, th / 2), Pt(b, zb, -th / 2), Pt(a, za, -th / 2), n[2] < 0 ? n : scale(n, -1), [0, 0], [1, 0], [1, th], [0, th], K.WAX, seed + .2)
      }
    }
    // the ends' edges
    for (const xn of [-1, 1]) {
      const e = sub(Pt(xn, endTop, 0), Pt(xn, 0, 0)), n0 = unit(cross(e, out)), side = dot(n0, Y) * xn > 0 ? n0 : scale(n0, -1)
      s.quad(Pt(xn, 0, th / 2), Pt(xn, endTop, th / 2), Pt(xn, endTop, -th / 2), Pt(xn, 0, -th / 2), side, [0, 0], [endTop, 0], [endTop, th], [0, th], K.WAX, seed + .3)
    }
    // the aprons' tenons come through here, a wedge driven in each
    for (const y of [-1, 1]) {
      const yc = y * (W / 2 - .045), zc = (aprons[0] + aprons[1]) / 2, x0 = mid(zc) + sign * th / 2
      s.box(at(x0 + sign * .012, yc, zc), scale(X, .012), scale(Y, .009), scale(Z, .03), K.WAX, seed + .4)
      s.box(at(x0 + sign * .02, yc, zc), scale(X, .005), scale(Y, .012), scale(Z, .006), K.WAX, seed + .5)
    }
  }
  // the aprons, between the ends, their lower edge eased
  for (const y of [-1, 1]) {
    const yc = y * (W / 2 - .045), xa = inset + (endTop - (aprons[0] + aprons[1]) / 2) * splay
    s.extrude(at(-xa, yc, aprons[0]), at(xa, yc, aprons[0]), Y, Z, [[-.009, .012], [-.005, 0], [.005, 0], [.009, .012], [.009, aprons[1] - aprons[0] - .001], [-.009, aprons[1] - aprons[0] - .001]], K.WAX, seed + .6, [4], [false, false])
  }
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
    // the face toward the fire is the brick cheek's, which lines the jamb
    box(x0, x1, 0, depth, .17, jambTop - .16, K.STONE, 53, side < 0 ? '-z+z+x' : '-z+z-x')
    s.soot = 0
    box(x0 - .02, x1 + .02, 0, depth + .035, jambTop - .16, jambTop - .07, K.STONE, 54, '-z')
    box(x0 - .04, x1 + .04, 0, depth + .06, jambTop - .07, jambTop, K.STONE, 55, '-z')
  }
  // the lintel, its lower front arris taken off in a broad chamfer
  const ch = .07
  s.soot = .55
  // its soffit over the opening is the throat's, drawn below with the firebox
  box(-W2, W2, 0, depth - ch, jambTop, jambTop + ch, K.STONE, 56, '+z+x-x-z')
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
  s.soot = .74
  box(-open, open, 0, back, .028, jambTop, K.BRICK, 61, '-z')
  for (const side of [-1, 1]) {
    const x = side * open
    const p0 = L(x, back, .028), p1 = L(x, depth, .028), p2 = L(x, depth, jambTop), p3 = L(x, back, jambTop)
    s.quad(p0, p1, p2, p3, [X[0] * -side, X[1] * -side, 0], [0, 0], [depth, 0], [depth, jambTop], [0, jambTop], K.BRICK, 62)
  }
  s.soot = .95
  s.quad(L(-open, back, jambTop), L(open, back, jambTop), L(open, depth - ch, jambTop), L(-open, depth - ch, jambTop), [0, 0, -1], [0, 0], [1, 0], [1, 1], [0, 1], K.BRICK, 63)
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
  // the service passage's doorway takes the light the hall sends through it,
  // strongest at the hall's face and falling off into the passage
  const lit = s.lit, cheek = to === 'service-link' ? K.REVEAL : K.PLASTER
  if (to === 'service-link') s.lit = 0
  // cheeks face each other across the opening, limewashed like the walls,
  // their feet in the floor's bed
  const zf = z0 - FOOT
  s.quad(P3(a, zf), P3(far(a), zf), P3(far(a), z1), P3(a, z1), n(dir), [0, zf], [depth, zf], [depth, z1], [0, z1], cheek, seed)
  s.quad(P3(far(b), zf), P3(b, zf), P3(b, z1), P3(far(b), z1), n([-dir[0], -dir[1]]), [0, zf], [depth, zf], [depth, z1], [0, z1], cheek, seed)
  s.lit = lit
  // soffit, under an oak lintel's face, its grain across the opening
  s.quad(P3(a, z1), P3(far(a), z1), P3(far(b), z1), P3(b, z1), [0, 0, -1], [0, 0], [0, depth], [hall.width_m, depth], [hall.width_m, 0], K.OAK, seed)
  // THE THRESHOLD. The service passage's is a worn tuffeau slab in the
  // passage's light: the sun's patch ends at the wall's line. The kitchen's
  // leaf stands shut at the kitchen's face, and the hall's tiles run on
  // through the doorway to it, square-laid, the most trodden of the floor
  if (to === 'kitchen') {
    // the tiles run on under the shut leaf to the kitchen's face, and their bed
    // on under the cheeks and a stride into the kitchen, so the gap under the
    // leaf shows floor
    const [k0, k1] = kitchenDoorU
    s.poly([P(k0 - BED_UNDER, -BED_UNDER, z0 - .006), P(k1 + BED_UNDER, -BED_UNDER, z0 - .006), P(k1 + BED_UNDER, -depth - .3, z0 - .006), P(k0 - BED_UNDER, -depth - .3, z0 - .006)], [0, 0, 1], q => toUV([q[0], q[1]]), K.JOINT, .7)
    const pitch = PITCH, across = Math.round((k1 - k0) / pitch), step = (k1 - k0) / across
    for (let i = 0; i < across; i++) for (let j = 0; j * pitch < depth - .02; j++) {
      const u0 = k0 + i * step, u1 = k0 + (i + 1) * step, v1 = -j * pitch, v0 = Math.max(-depth, v1 - pitch)
      tile(s, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], z0, rand(i, j, 6.7), [(u0 + u1) / 2, v1 - pitch / 2], [1, 0], [step / 2, pitch / 2])
    }
    doorLeaf(s, a, b, dir, [-outward[0], -outward[1]], depth - .045, z0, z1)
    return
  }
  s.lit = 0; s.wear = 1
  s.quad(P3(a, z0 + .004), P3(b, z0 + .004), P3(far(b), z0 + .004), P3(far(a), z0 + .004), [0, 0, 1], [0, 0], [1, 0], [1, depth], [0, depth], K.STONE, seed + .5)
  s.lit = lit; s.wear = 0
}
/** A LEDGED DOOR OF THE PERIOD, shut in its opening: five oak boards on the
 * face the hall sees, the clout nails of the ledges behind them in three
 * rows, a ring on its plate and a latch. From a to b along the wall, its
 * back `back` metres into the reveal, `into` pointing back to the hall. */
function doorLeaf(s: Sink, a: V2, b: V2, dir: V2, into: V2, back: number, z0: number, z1: number): void {
  const w = Math.hypot(b[0] - a[0], b[1] - a[1]), boards = 5, gap = .004, th = .035
  const A: V3 = [dir[0], dir[1], 0], B: V3 = [into[0], into[1], 0], Z: V3 = [0, 0, 1]
  const at = (x: number, y: number, z: number): V3 => [a[0] + dir[0] * x + into[0] * (y - back), a[1] + dir[1] * x + into[1] * (y - back), z]
  const lbox = (x0: number, x1: number, y0: number, y1: number, zb: number, zt: number, kind: number, seed: number, skip = ''): void =>
    s.box(at((x0 + x1) / 2, (y0 + y1) / 2, (zb + zt) / 2), scale(A, (x1 - x0) / 2), scale(B, (y1 - y0) / 2), scale(Z, (zt - zb) / 2), kind, seed, skip)
  const zb = z0 + .005, zt = z1 - .006, bw = (w - .006) / boards
  // y runs from the leaf's back (0) to its face toward the hall (th)
  for (let i = 0; i < boards; i++) {
    const x0 = .003 + i * bw + gap / 2, x1 = .003 + (i + 1) * bw - gap / 2
    lbox(x0, x1, 0, th - (rand(i, 8.1) - .5) * .003, zb, zt, K.OAK, 140 + i, '-y')
  }
  // the joints read dark: a fill set back behind the boards
  lbox(.003, w - .003, .004, th - .01, zb, zt, K.CHAR, 146, '-y')
  // three ledges behind, their nails through every board
  for (const z of [zb + .28, (zb + zt) / 2, zt - .28]) for (let k = 0; k < boards * 2; k++) {
    const x = .003 + bw / 4 + k * bw / 2 + (rand(k, z) - .5) * .02
    lbox(x - .006, x + .006, th, th + .004, z - .006 + (rand(z, k) - .5) * .012, z + .006 + (rand(z, k) - .5) * .012, K.IRON, 147, '-y')
  }
  // the ring on its round plate at the latch side, the latch bar above it
  const rx = w - .16, rz = z0 + 1.02
  lbox(rx - .045, rx + .045, th, th + .003, rz - .045, rz + .045, K.IRON, 148, '-y')
  for (let k = 0; k < 10; k++) {
    const t0 = k / 10 * Math.PI * 2, r = .05
    lbox(rx + Math.cos(t0) * r - .006, rx + Math.cos(t0) * r + .006, th + .003, th + .013, rz - .05 + Math.sin(t0) * r - .006, rz - .05 + Math.sin(t0) * r + .006, K.IRON, 148, '-y')
  }
  lbox(rx - .2, rx + .02, th, th + .012, rz + .14, rz + .165, K.IRON, 149, '-y')
  lbox(rx + .02, rx + .05, th, th + .03, rz + .12, rz + .185, K.IRON, 149, '-y')
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
  // a pixel's width is read off the smooth coordinate the distance is folded
  // from: across the fold itself a difference reads zero, and the came breaks
  // into dots
  const width = (x: N, k: number): N => vec2(x.dFdx(), x.dFdy()).length().mul(k).max(1e-6)
  const line = (d: N, px: N, half: number): N => float(1).sub(smoothstep(float(half).sub(px), float(half).add(px), d))
  const lead = max(max(line(da, width(a, QUARRY_M), CAME_HALF), line(db, width(b, QUARRY_M), CAME_HALF)), line(border, width(E.x, 1), BORDER_HALF))
  // each quarry is its own piece of blown glass: its own clarity and its own
  // share of the milk, so the lattice reads as panes against the bright day
  const qa = floor(a), qb = floor(b)
  const piece = fract(qa.mul(12.9898).add(qb.mul(78.233)).add(L.z.mul(4.1)).sin().mul(43758.5453))
  // old glass holds a little of the day it lets through: a warm milk where
  // the sun stands on it, a cool one on the north lights
  const milk = mix(vec3(.030, .034, .036), vec3(.16, .135, .095), L.z).mul(MILK).mul(piece.mul(.6).add(.7))
  m.colorNode = mix(milk, vec3(.010, .0095, .009), lead)
  m.opacityNode = float(1).sub(lead).mul(mix(float(.86), float(.80), L.z)).mul(WINDOW_PULL).mul(piece.mul(.24).add(.88))
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
  if (hero) squareFloor(s, room, FLOOR_Z)
  else flatFloor(s, room, FLOOR_Z, .9)
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
      holes.push([o.from_m, o.from_m + o.width_m, FLOOR_Z - FOOT, FLOOR_Z + o.height_m])
    }
    lining(s, a, b, FLOOR_Z - FOOT, BOARD_Z, holes, cell, K.PLASTER, .71)
  }
  // THE SIDE DOOR FROM THE ENTRANCE: its opening runs on through the space
  // between the entrance's partition and this passage's own face, so it takes
  // cheeks, a soffit and a threshold of its own, like the hall's doorway
  sideDoorReveal(s)
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

function sideDoorReveal(s: Sink): void {
  const [c0, c1] = [PASSAGE_DOOR.corners[0]!, PASSAGE_DOOR.corners[1]!]
  const out: V2 = [-PASSAGE_DOOR.inward[0], -PASSAGE_DOOR.inward[1]]
  // from the entrance partition's far face to the passage's own lining, the
  // edge of its outline that runs along the door, nearest it
  const wallT = .25
  const faces = LINK_OUTLINE.map((q, i) => [q, LINK_OUTLINE[(i + 1) % LINK_OUTLINE.length]!] as [V2, V2])
    .filter(([q, b]) => Math.abs((b[0] - q[0]) * out[0] + (b[1] - q[1]) * out[1]) < .05 * Math.hypot(b[0] - q[0], b[1] - q[1]))
    .map(([q]) => (q[0] - c0[0]) * out[0] + (q[1] - c0[1]) * out[1]).filter(d => d > 0)
  if (!faces.length) return
  const d0 = wallT + .002, d1 = Math.min(...faces)
  if (d1 - d0 < .02) return
  const at = (c: V3, d: number, z: number): V3 => [c[0] + out[0] * d, c[1] + out[1] * d, z]
  const along: V2 = (() => { const l = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]); return [(c1[0] - c0[0]) / l, (c1[1] - c0[1]) / l] })()
  const z0 = FLOOR_Z, z1 = PASSAGE_DOOR.corners[2]![2]
  const lit = s.lit
  s.lit = 0
  // cheeks, facing each other across the opening
  s.quad(at(c0, d0, z0), at(c0, d1, z0), at(c0, d1, z1), at(c0, d0, z1), [along[0], along[1], 0], [d0, z0], [d1, z0], [d1, z1], [d0, z1], K.REVEAL, 33)
  s.quad(at(c1, d1, z0), at(c1, d0, z0), at(c1, d0, z1), at(c1, d1, z1), [-along[0], -along[1], 0], [d1, z0], [d0, z0], [d0, z1], [d1, z1], K.REVEAL, 33)
  // soffit, an oak lintel's face, its grain across the opening
  const w = Math.hypot(c1[0] - c0[0], c1[1] - c0[1])
  s.quad(at(c0, d0, z1), at(c1, d0, z1), at(c1, d1, z1), at(c0, d1, z1), [0, 0, -1], [0, d0], [w, d0], [w, d1], [0, d1], K.OAK, 33)
  // threshold, a worn tuffeau slab from the entrance's floor to the passage's
  s.wear = 1
  s.quad(at(c0, 0, z0 + .004), at(c1, 0, z0 + .004), at(c1, d1, z0 + .004), at(c0, d1, z0 + .004), [0, 0, 1], [0, 0], [w, 0], [w, d1], [0, d1], K.STONE, 33.5)
  s.lit = lit; s.wear = 0
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
    bounce += ROOM_FILL + roomReturnAt(n)
  } else {
    // the passage sees the hall's sunlit threshold through the hall door
    const f = formFactor(at, n, linkDoorAp, [U[0], U[1], 0], 2), g = formFactor(at, n, PASSAGE_DOOR.corners, [-U[0], -U[1], 0], 2)
    bounce += f * LINK_DOOR_GAIN + g * LINK_SIDE_GAIN + LINK_FILL
    sky += f * .3 + g * .2 + .02
  }
  return [Math.min(1, .02 + sky * 2.4), bounce]
}
/** The room's second bounce, in the patches' own units: what a surface
 * receives from the lit walls and ceiling rather than from the floor. */
const ROOM_FILL = .05
/** THE SERVICE PASSAGE'S LIGHT, in the same units: the hall seen through its
 * door is the room's average, about a sun patch's brightness where the patch
 * is in view and less where it is not; the entrance passage through the side
 * door is a dim court's return; and the passage's own faces send back a
 * little of both, so no face of it stands in the dark. */
const LINK_DOOR_GAIN = 1.1, LINK_SIDE_GAIN = .45, LINK_FILL = .05
/** A cheek of the hall's doorway sees the room only at a graze and only its
 * dim near part, never the sun's patches deep in it: a fraction of what the
 * door sends into the passage. */
const REVEAL_GAIN = .2
/** What one unit of the patches' light is, as the emissive term applies it:
 * the tile's reflectance times the sun's share on the floor. */
const BOUNCE_K = .16 * TO_SUN[2] * 3.2 * 5.2 / Math.PI
/** THE ROOM'S RETURN, BY DIRECTION. The walls, the boards and the tiles send
 * back what the windows and the sun's patches give them, so a face that sees
 * no window still sees the lit room: the east wall faces the west lights, the
 * boards face the floor. One exitance per surface of the room, from the same
 * first bounce the bake reads, gathered at the room's centre for the six ways
 * of its frame (+u, -u, +v, -v, up, down). In the patches' units. */
const ROOM_RETURN: number[] = (() => {
  const [sw, se, ne, nw] = hallOutline as [V2, V2, V2, V2], z0 = FLOOR_Z, z1 = BOARD_Z
  const at = (q: V2, z: number): V3 => [q[0], q[1], z]
  // reflectances as the material draws them: tile, aged oak, aged limewash
  const surfaces: { poly: V3[]; n: V3; albedo: number }[] = [
    { poly: [at(sw, z0), at(se, z0), at(ne, z0), at(nw, z0)], n: [0, 0, 1], albedo: .15 },
    { poly: [at(sw, z1), at(nw, z1), at(ne, z1), at(se, z1)], n: [0, 0, -1], albedo: .105 },
  ]
  const outline = [sw, se, ne, nw]
  for (let i = 0; i < 4; i++) {
    const a = outline[i]!, b = outline[(i + 1) % 4]!, l = Math.hypot(b[0] - a[0], b[1] - a[1])
    surfaces.push({ poly: [at(a, z0), at(b, z0), at(b, z1), at(a, z1)], n: [-(b[1] - a[1]) / l, (b[0] - a[0]) / l, 0], albedo: .5 })
  }
  const first = (p: V3, n: V3): number => {
    let e = ROOM_FILL
    for (const patch of PATCHES) e += formFactor(p, n, patch, [0, 0, 1], 2)
    for (const w of WINDOWS) e += formFactor(p, n, w.ap.corners, w.ap.inward, 2) * TRANSMIT * w.ap.radiance * 2.4 * (w.west ? .1596 : .1286) / (.774 * BOUNCE_K)
    return e
  }
  const exitance = surfaces.map(sf => {
    const [a, b, c, d] = sf.poly as [V3, V3, V3, V3]
    let sum = 0, k = 0
    for (const s of [.15, .5, .85]) for (const t of [.15, .5, .85]) {
      const p = add(add(scale(a, (1 - s) * (1 - t)), scale(b, s * (1 - t))), add(scale(c, s * t), scale(d, (1 - s) * t)))
      sum += first(add(p, scale(sf.n, .05)), sf.n); k++
    }
    return sf.albedo * sum / k
  })
  // the bounces after the second, as the room's mean reflectance carries them
  const area = (q: V3[]): number => len(cross(sub(q[1]!, q[0]!), sub(q[3]!, q[0]!)))
  const areas = surfaces.map(sf => area(sf.poly)), total = areas.reduce((t, x) => t + x, 0)
  const further = 1 / (1 - surfaces.reduce((t, sf, i) => t + sf.albedo * areas[i]!, 0) / total)
  const centre = P(HALL_W / 2, HALL_D / 2, FLOOR_Z + 1.6)
  const ways: V3[] = [[U[0], U[1], 0], [-U[0], -U[1], 0], [V[0], V[1], 0], [-V[0], -V[1], 0], [0, 0, 1], [0, 0, -1]]
  return ways.map(d => surfaces.reduce((e, sf, i) => e + formFactor(centre, d, sf.poly, sf.n, 5) * exitance[i]!, 0) * further)
})()
/** The return a face of normal n receives: the six ways, each by its squared
 * cosine, so the weights of any normal sum to one. */
function roomReturnAt(n: V3): number {
  const u = n[0] * U[0] + n[1] * U[1], v = n[0] * V[0] + n[1] * V[1], [pu, mu, pv, mv, pz, mz] = ROOM_RETURN as [number, number, number, number, number, number]
  return u * u * (u > 0 ? pu : mu) + v * v * (v > 0 ? pv : mv) + n[2] * n[2] * (n[2] > 0 ? pz : mz)
}
function roomReturnNode(Nw: N = normalWorld): N {
  const u = Nw.x.mul(U[0]).sub(Nw.z.mul(U[1])), v = Nw.x.mul(V[0]).sub(Nw.z.mul(V[1])), z = Nw.y
  const [pu, mu, pv, mv, pz, mz] = ROOM_RETURN as [number, number, number, number, number, number]
  const way = (x: N, plus: number, minus: number): N => x.mul(x).mul(x.greaterThan(0).select(float(plus), float(minus)))
  return way(u, pu, mu).add(way(v, pv, mv)).add(way(z, pz, mz))
}

function bake(s: Sink, cast: boolean): BufferGeometry {
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], a: number[] = [], b: number[] = []
  const baked = new Map<string, [number, number]>()
  const inHall = (p: V3): boolean => { const q = toUV([p[0], p[1]]); return q[0] > -.4 && q[0] < HALL_W + .4 && q[1] > -.6 && q[1] < HALL_D + .4 }
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
  let shade: N = float(0), through: N = float(0)
  for (const w of WINDOWS.filter(x => x.west)) {
    const o = w.o, x = o.from_m, wd = o.width_m, zb = o.base_m, h = o.height_m, mid = x + wd / 2, transom = zb + h * TRANSOM_AT
    const inside = smoothstep(x - .02, x + .02, along).mul(float(1).sub(smoothstep(x + wd - .02, x + wd + .02, along)))
    // the sun reaches the hall only through an opening: a point whose ray
    // meets the glass's plane outside every light is in the wall's shadow,
    // however near the occluder stands (a joist's face under the boards)
    through = max(through, inside.mul(smoothstep(zb - .02, zb + .02, z)).mul(float(1).sub(smoothstep(zb + h - .02, zb + h + .02, z))))
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
  return float(1).sub(shade.clamp(0, 1)).mul(through)
}

/* ---- the material ---- */

/** THE WINDOWS SEEN IN A POLISHED FACE. The eye's ray, mirrored about the
 * face, is followed to each window's opening in the lining; where it lands in
 * one, the face returns the day by Fresnel's law, its edges spread by the
 * wax's roughness over the distance travelled. The day's level is what the
 * room's own print shows through the glass. In the renderer's frame. */
const GLOSS_DAY = .3, GLOSS_SPREAD = .09
function windowGloss(): N {
  const Wp = positionWorld, Nw = normalWorld
  const toEye = cameraPosition.sub(Wp).normalize()
  const R = toEye.negate().reflect(Nw)
  const cosV = Nw.dot(toEye).max(0)
  const fresnel = float(1).sub(cosV).pow(5).mul(.96).add(.04)
  let day: N = float(0), cover: N = float(0)
  for (const w of WINDOWS) {
    const [c0, c1, , c3] = w.ap.corners as [V3, V3, V3, V3]
    const o = vec3(c0[0], c0[2], -c0[1]), a = vec3(c1[0] - c0[0], c1[2] - c0[2], -(c1[1] - c0[1])), b = vec3(c3[0] - c0[0], c3[2] - c0[2], -(c3[1] - c0[1]))
    const inward = vec3(w.ap.inward[0], w.ap.inward[2], -w.ap.inward[1])
    const facing = R.dot(inward)
    const t = o.sub(Wp).dot(inward).div(facing.min(-1e-4))
    const hit = Wp.add(R.mul(t)).sub(o)
    const la = len(sub(c1, c0)), lb = len(sub(c3, c0))
    const sa = hit.dot(a).div(la * la), sb = hit.dot(b).div(lb * lb)
    const ea = t.mul(GLOSS_SPREAD / la).add(.02), eb = t.mul(GLOSS_SPREAD / lb).add(.02)
    const inside = smoothstep(ea.negate(), ea, sa).mul(smoothstep(ea.negate(), ea, float(1).sub(sa))).mul(smoothstep(eb.negate(), eb, sb)).mul(smoothstep(eb.negate(), eb, float(1).sub(sb)))
    const seen = inside.mul(facing.lessThan(-1e-3).select(float(1), float(0)))
    day = day.add(seen.mul(w.ap.radiance / 1.35)); cover = cover.add(seen)
  }
  // elsewhere the face mirrors the lit room: the limewash the ray lands on,
  // as the room's return in that direction lights it
  const room = vec3(1, .73, .545).mul(roomReturnNode(R).add(ROOM_FILL).mul(BOUNCE_K * .55))
  return room.mul(float(1).sub(cover.min(1))).add(vec3(1, .93, .82).mul(day.mul(GLOSS_DAY))).mul(fresnel)
}

/** A world point in the hall's own frame (u, v), in the shader. */
function hallUVNode(Wp: N): [N, N] {
  const e = Wp.x.sub(SW[0]), nn = Wp.z.negate().sub(SW[1])
  return [e.mul(U[0]).add(nn.mul(U[1])), e.mul(V[0]).add(nn.mul(V[1]))]
}
/** Where hands and shoulders have rubbed the wash: the jambs of the hall's
 * two doors on both faces of their partitions, and of the service passage's
 * door from the entrance, from knee to above the head. */
export function doorWear(Wp: N): N {
  const jambs: V2[] = [fromUV(kitchenDoorU[0], 0), fromUV(kitchenDoorU[1], 0), fromUV(kitchenDoorU[0], -.55), fromUV(kitchenDoorU[1], -.55),
    fromUV(HALL_W, linkDoorV[0]), fromUV(HALL_W, linkDoorV[1]), fromUV(HALL_W + .75, linkDoorV[0]), fromUV(HALL_W + .75, linkDoorV[1]),
    [PASSAGE_DOOR.corners[0]![0], PASSAGE_DOOR.corners[0]![1]], [PASSAGE_DOOR.corners[1]![0], PASSAGE_DOOR.corners[1]![1]], ...WORKSHOP_JAMBS]
  let w: N = float(0)
  for (const j of jambs) {
    const d = vec2(Wp.x.sub(j[0]), Wp.z.add(j[1])).length()
    w = max(w, float(1).sub(smoothstep(.12, .7, d)))
  }
  const h = Wp.y.sub(FLOOR_Z)
  return w.mul(smoothstep(.4, .9, h)).mul(float(1).sub(smoothstep(1.7, 2.2, h)))
}

function hallMaterial(perPixel: boolean, library?: MaterialLibrary, sunShadow?: N): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ metalness: 0, roughness: .85 })
  const A = attribute('hallA', 'vec4'), B = attribute('hallB', 'vec4')
  const kind = A.x, seed = A.w, wear = B.x, soot = B.y, lit = B.z, inHallShade = B.w
  const is = (k: number): N => float(1).sub(smoothstep(.2, .45, kind.sub(k).abs()))
  let ambient: N = A.y, bounce: N = A.z, westSky: N = A.y.mul(.6)
  if (perPixel) {
    // the same light as the vertex bake, per point: the hall's windows and
    // sun patches, the passage's hall door, the entrance's court
    const centre = P(HALL_W / 2, HALL_D / 2, FLOOR_Z + 1.6)
    let sky: N = float(0), sun: N = roomReturnNode().add(ROOM_FILL)
    for (const w of WINDOWS) {
      const f = formFactorNode(w.ap.corners, centre).mul(TRANSMIT * w.ap.radiance)
      sky = sky.add(f)
      if (w.west) westSky = westSky.add(f)
    }
    for (const patch of PATCHES) sun = sun.add(formFactorNode(patch, add(patch[0]!, [0, 0, 1.5])))
    const linkCentre: V3 = [LINK_OUTLINE.reduce((a, q) => a + q[0], 0) / 4, LINK_OUTLINE.reduce((a, q) => a + q[1], 0) / 4, FLOOR_Z + 1.5]
    const side = formFactorNode(PASSAGE_DOOR.corners, linkCentre)
    const door = formFactorNode(linkDoorAp, linkCentre).mul(mix(float(1), float(REVEAL_GAIN), is(K.REVEAL)))
    const entrance = passageLightNode()
    const isLink = float(1).sub(lit), isEntrance = lit.mul(float(1).sub(inHallShade))
    // THE BAYS BETWEEN THE JOISTS. The windows and the floor's patches all lie
    // below the joists' soffits, so a joist's side sees them only under its
    // neighbour, less the higher up it: its light falls off from the arris to
    // the boards, and the boards see the room through a slot. The analytic
    // terms know no such occluder
    const hb = positionWorld.y.sub(CEIL_Z), sideways = float(1).sub(normalWorld.y.abs())
    const bay = mix(float(1), mix(mix(float(1), float(.82), smoothstep(.02, .2, hb)), exp(hb.max(0).div(-.06)).mul(.6).add(.4), sideways), is(K.OAK).mul(smoothstep(-.004, .004, hb)))
    ambient = min(float(1), sky.mul(2.4).add(.02)).mul(inHallShade).mul(bay).add(door.mul(.3 * 2.4).add(side.mul(.2 * 2.4)).add(.07).mul(isLink)).add(entrance.x.mul(isEntrance))
    westSky = westSky.mul(2.4).mul(inHallShade).mul(bay)
    bounce = sun.mul(inHallShade).mul(bay).add(door.mul(LINK_DOOR_GAIN).add(side.mul(LINK_SIDE_GAIN)).add(LINK_FILL).mul(isLink)).add(entrance.y.mul(3.2).mul(isEntrance))
  }
  const Wp = positionWorld, T = uv()
  // along the passage wall, in metres: what the hearth's courses run along
  const alongWall = Wp.x.mul(V[0]).sub(Wp.z.mul(V[1]))
  // terracotta: each tile its own firing, a mottle within, a sheen where feet
  // have polished it and the wax has been rubbed in
  const fire = fract(seed.mul(43758.5453).sin().mul(17.3)).sub(.5)
  const mottle = mx_noise_float(vec3(Wp.x.mul(7.3), Wp.z.mul(7.3), seed.mul(3.1))).mul(.08).add(mx_noise_float(vec3(Wp.x.mul(31), Wp.z.mul(31), seed)).mul(.035))
  const tileRGB = vec3(.315, .108, .058).mul(fire.mul(.38).add(1)).mul(mottle.add(1))
  // the path feet take has worn the fired skin off, the body under it paler
  // and dusty; off the path the wax and the dirt have built up
  const fired = mix(tileRGB, tileRGB.mul(vec3(.92, 1.05, 1.1)), smoothstep(.2, .5, fire.abs()))
  // worn down to the body, the tiles of a path lose most of their firings'
  // difference and read as one paler band
  const body = vec3(.315, .108, .058).mul(fire.mul(.1).add(1)).mul(mottle.mul(.6).add(1)).mul(vec3(1.42, 1.36, 1.3))
  const trodden = mix(body, vec3(.33, .21, .155), .2)
  let tileColour: N = mix(fired.mul(.9), trodden, smoothstep(.15, .8, wear))
  // THE TILE'S OWN EDGE (its uv runs from its centre along its sides): the
  // arris worn round and holding the joint's dirt, and flakes chipped from it,
  // deepest toward the corners
  // (the lighter tier's floor is one plain sheet, seed -1, with no tile of its own)
  const [hu0, hv0] = hallUVNode(Wp), faced = seed.greaterThanEqual(0).select(float(1), float(0))
  const ax = abs(T.x), ay = abs(T.y), toEdge = float(TILE_M / 2).sub(max(ax, ay)).max(0)
  const onX = ax.greaterThan(ay), along = onX.select(T.y, T.x), side = onX.select(T.x.sign(), T.y.sign().mul(2))
  // a corner is the likeliest to go, but only some corners of some tiles have
  const cornerness = smoothstep(TILE_M * .3, TILE_M * .48, min(ax, ay)).mul(smoothstep(.1, .4, mx_noise_float(vec3(T.x.sign().mul(1.7).add(T.y.sign().mul(.6)), seed.mul(9.1), 4.4))))
  const chipDepth = mx_noise_float(vec3(along.mul(31), side.mul(3.7).add(seed.mul(17.3)), 2.3)).sub(.3).max(0).mul(.045).add(cornerness.mul(.016)).mul(float(1).sub(wear.mul(.4)))
  const chip = float(1).sub(smoothstep(chipDepth.sub(.0025), chipDepth, toEdge)).mul(smoothstep(.002, .004, chipDepth)).mul(faced)
  const arris = float(1).sub(smoothstep(.0015, .011, toEdge)).mul(faced)
  // the room's edges hold the dirt the brooms leave, the hearth its ash
  const wallDist = min(min(hu0, float(HALL_W).sub(hu0)), min(hv0, float(HALL_D).sub(hv0)))
  const edgeDirt = float(1).sub(smoothstep(.04, .5, wallDist))
  tileColour = tileColour.mul(float(1).sub(arris.mul(.2))).mul(float(1).sub(edgeDirt.mul(.22)))
  tileColour = mix(tileColour, vec3(.075, .058, .045).mul(mx_noise_float(Wp.mul(41)).mul(.2).add(1)), chip.mul(.85))
  // one tile in fourteen has cracked under a dropped load, the line dark with the
  // dirt worked into it; one in twenty is a later replacement, brighter, its
  // arrises still sharp
  const lot = fract(seed.mul(91.7).sin().mul(4375.85)).mul(faced).add(float(1).sub(faced).mul(.5)), angle = lot.mul(29.3)
  const crackAt = T.x.mul(angle.cos()).add(T.y.mul(angle.sin())).sub(lot.sub(.5).mul(.12))
    .add(mx_noise_float(vec3(T.x.mul(40), T.y.mul(40), seed)).mul(.006)).abs()
  const crackPx = vec2(crackAt.dFdx(), crackAt.dFdy()).length()
  const cracked = float(1).sub(smoothstep(crackPx.mul(.6), crackPx.mul(1.6).add(.0008), crackAt)).mul(lot.lessThan(.07).select(float(1), float(0)))
  tileColour = mix(tileColour, tileRGB.mul(vec3(1.18, 1.1, 1.02)), lot.greaterThan(.93).select(float(.8), float(0)).mul(float(1).sub(wear.mul(.5))))
    .mul(float(1).sub(cracked.mul(.55)))
  const joint = vec3(.125, .105, .082).mul(mx_noise_float(Wp.mul(9)).mul(.18).add(1)).mul(mx_noise_float(Wp.mul(1.3)).mul(.15).add(1)).mul(float(1).sub(edgeDirt.mul(.3)))
  // THE JOINTS, drawn on the tiles: each tile runs to its joints' centre lines
  // and draws its half of each, box-filtered over the pixel's footprint, so a
  // joint narrower than a pixel stays one continuous, fainter line. The mortar
  // lies a few millimetres down, in its own shade, and the dirt of the path
  // is worked into it
  const band = (d: N, w: N, half: N | number = JOINT_M / 2): N => min(d.add(w.mul(.5)), half).sub(max(d.sub(w.mul(.5)), float(half).negate())).max(0).div(w)
  const footprint = (x: N): N => x.dFdx().abs().add(x.dFdy().abs()).mul(1.15).max(1e-5)
  let fieldEdge: N = float(1e3)
  for (const e of FIELD_EDGES) fieldEdge = min(fieldEdge, hu0.sub(e.a[0]).mul(e.n[0]).add(hv0.sub(e.a[1]).mul(e.n[1])))
  const jx = band(float(PITCH / 2).sub(ax), footprint(T.x)), jy = band(float(PITCH / 2).sub(ay), footprint(T.y)), jf = band(fieldEdge.abs(), footprint(fieldEdge))
  const jointCover = float(1).sub(float(1).sub(jx).mul(float(1).sub(jy)).mul(float(1).sub(jf))).mul(faced)
  tileColour = mix(tileColour, joint.mul(mix(float(.62), float(.5), wear)), jointCover)
  // limewash: a broad wash, a trowel's drag, the brick's courses ghosting
  // through, the smoke of forty-six winters darkening its upper reach
  // the smoke gathers under the boards and climbs over the hearth; hands and
  // shoulders wear the wash at the doors' jambs
  const [hu, hv] = hallUVNode(Wp)
  // the chimneypiece's own frame: along its wall, out into the room, up
  const hx = hv.sub(HEARTH.v), hy = float(HALL_W).sub(hu), hz = Wp.y.sub(FLOOR_Z)
  const overHearth = float(1).sub(smoothstep(.2, 1.2, float(HALL_W).sub(hu).abs())).mul(float(1).sub(smoothstep(HEARTH.width * .4, HEARTH.width * .8, hv.sub(HEARTH.v).abs())))
  const age = smoothstep(FLOOR_Z + 2.1, FLOOR_Z + 3.3, Wp.y).mul(float(.11).add(overHearth.mul(.16)))
  // each of the hall's four linings carries its own seed, so no two walls
  // fail alike; the doorways' cheeks keep their own field
  const plaster = limewashOverBrick(vec2(T.x.add(seed.lessThan(10).select(seed.mul(5.3), float(0))), T.y), FLOOR_Z, vec3(.60, .55, .46), 1.7, doorWear(Wp), { contrast: 1.35, layered: true }).albedo.mul(float(1).sub(age))
  // oak: grain along the member
  const grain = mx_noise_float(vec3(T.x.mul(2.2), T.y.mul(38), seed.mul(13))).mul(.14).add(mx_noise_float(vec3(T.x.mul(9), T.y.mul(120), seed)).mul(.05))
  // the timbers' history along their length: the adze's long waves, grime
  // and dust unevenly laid, and drying checks opening along the grain, one
  // to a member and only along part of it
  const hewn = mx_noise_float(vec3(T.x.mul(1.4), T.y.mul(6), seed.mul(3.3))).mul(.14).add(mx_noise_float(vec3(T.x.mul(6.5), T.y.mul(22), seed.mul(5.1))).mul(.06))
  const checkAt = T.y.sub(fract(seed.mul(13.7)).mul(.45).add(.06)).add(mx_noise_float(vec3(T.x.mul(.9), seed, 3.3)).mul(.012))
  const checkHalf = mx_noise_float(vec3(T.x.mul(1.7), seed.mul(2.9), 8.8)).mul(.0014).add(.0011).max(.0002)
  const check = band(checkAt.abs(), footprint(checkAt), checkHalf).mul(smoothstep(.05, .3, mx_noise_float(vec3(T.x.mul(.55), seed.mul(4.4), 1.9))))
  const oak = vec3(.15, .094, .055).mul(grain.add(1)).mul(fract(seed.mul(7.31)).mul(.18).add(.91)).mul(hewn.add(1)).mul(float(1).sub(check.mul(.6)))
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
  // a threshold (the only stone the sink marks worn): the dirt of every shoe
  // ground into the soft stone, the feet's hollow a little paler than its ends
  const trod = mix(vec3(.19, .165, .13), vec3(.26, .225, .18), mx_noise_float(Wp.mul(4.1)).mul(.5).add(.5)).mul(mx_noise_float(Wp.mul(37)).mul(.12).add(1))
  tuffJ = mix(tuffJ, trod, wear.mul(is(K.STONE)))
  // the shell's own tuffeau set, already loaded for the house: its fine grain
  if (library) {
    const maps = library.sync('stone-tuffeau').sample({ uv: T, metres: .19, turn: .37 })
    tuffJ = tuffJ.mul(mix(float(1), maps.albedo.clamp(.88, 1.12), .22))
  }
  // brick of the fireback: thin Loire bricks in courses
  // along each face's own horizontal metres, so a cheek square to the wall courses as the back does
  // FORTY-SIX YEARS OF FIRES: the courses have moved and no longer run
  // level, the joints are burnt out and deep, bricks have cracked across and
  // spalled their faces, a few were replaced; behind the fire the heat has
  // burnt the soot off to a pale calcined patch, and above it the smoke has
  // laid a tarry black that thickens upward
  const bY = Wp.y.add(mx_noise_float(vec3(T.x.mul(1.3), 2.2, 5.5)).mul(.014))
  const bCourse = floor(bY.div(.066)), bIn = fract(bY.div(.066))
  const bX = T.x.div(.23).add(bCourse.mul(.5)).add(fract(bCourse.mul(5.37).sin().mul(417.3)).mul(.3))
  const bCol = floor(bX), bAlong = fract(bX)
  const bId = fract(bCourse.mul(3.7).add(bCol.mul(9.1)).sin().mul(4375.5)), bId2 = fract(bCourse.mul(7.1).add(bCol.mul(2.3)).sin().mul(9173.3))
  const eroded = mx_noise_float(vec3(T.x.mul(9), Wp.y.mul(9), 6.1)).mul(.05).add(.1)
  const bJoint = max(float(1).sub(smoothstep(eroded, eroded.add(.08), bIn.min(float(1).sub(bIn)))), float(1).sub(smoothstep(.03, .07, bAlong.min(float(1).sub(bAlong)))))
  const brickHue = bId.sub(.5)
  const bCrackAt = fract(bY.div(.066)).sub(.5).mul(.066).add(bAlong.sub(.5).mul(bId2.sub(.5)).mul(.09)).abs()
  const bCrack = band(bCrackAt, footprint(bCrackAt), .0012).mul(bId2.greaterThan(.72).select(float(1), float(0)))
  const spalled = bId2.lessThan(.14).select(float(1), float(0)).mul(smoothstep(.2, .6, mx_noise_float(vec3(T.x.mul(28), Wp.y.mul(28), bId.mul(9)))))
  const replaced = bId.greaterThan(.93).select(float(1), float(0))
  const brickFace = mix(vec3(.17, .066, .040).mul(brickHue.mul(.34).add(1)), vec3(.25, .12, .075), spalled.mul(.7))
  const brick = mix(mix(brickFace, vec3(.20, .085, .05), replaced), vec3(.045, .038, .034), bJoint).mul(float(1).sub(bCrack.mul(.7)))
  const heat = float(1).sub(smoothstep(.18, .55, vec3(hx.mul(.8), hy.sub(.25).mul(1.4), hz.sub(.3).mul(1.2)).length().add(mx_noise_float(Wp.mul(3.1)).mul(.12))))
  const brickSoot = mix(float(.8), float(.98), smoothstep(.15, 1.1, hz)).mul(mx_noise_float(vec3(T.x.mul(2.6), Wp.y.mul(1.4), 4.2)).mul(.2).add(.9))
    .mul(float(1).sub(heat.mul(.7))).mul(float(1).sub(replaced.mul(.1)).sub(spalled.mul(.08)))
  const calcined = mix(vec3(.16, .135, .12), vec3(.24, .21, .19), mx_noise_float(Wp.mul(14)).mul(.5).add(.5))
  const brickHot = mix(brick, calcined.mul(float(1).sub(bJoint.mul(.55))), heat.mul(.85))
  // iron, forged and dark; ash; char
  const iron = vec3(.040, .038, .035).mul(mx_noise_float(Wp.mul(40)).mul(.25).add(1))
  const ashC = vec3(.30, .29, .27).mul(mx_noise_float(Wp.mul(25)).mul(.25).add(1))
  const charC = mix(vec3(.018, .016, .015), vec3(.20, .19, .18), smoothstep(.2, .7, mx_noise_float(Wp.mul(30))).mul(.5))
  // the furniture's oak: darker, waxed, handled
  const wax = vec3(.096, .056, .031).mul(grain.mul(.7).add(1)).mul(fract(seed.mul(3.17)).mul(.16).add(.92))
  const brass = vec3(.50, .36, .16).mul(mx_noise_float(Wp.mul(60)).mul(.08).add(.95))
  const glaze = mix(vec3(.030, .075, .024), vec3(.045, .10, .035), mx_noise_float(Wp.mul(35)).mul(.5).add(.5))
  // lead glaze over a pale slip, honey where it pooled thin, green where the
  // copper ran in it
  const earth = mix(vec3(.40, .29, .09), vec3(.10, .20, .055), smoothstep(-.2, .5, mx_noise_float(Wp.mul(22)))).mul(mx_noise_float(Wp.mul(90)).mul(.06).add(1))
  // wool dyed with madder, faded where the sun and hands have been, its
  // weave a fine rib
  const rib = mx_noise_float(vec3(T.x.mul(420), T.y.mul(40), seed)).mul(.06)
  const cloth = mix(vec3(.26, .055, .04), vec3(.20, .07, .055), smoothstep(-.3, .6, mx_noise_float(vec3(T.x.mul(7), T.y.mul(7), seed)))).mul(rib.add(1))
  // oak the weather has silvered, its grain opened
  const silvered = vec3(.20, .175, .145).mul(grain.mul(2.2).add(1)).mul(mx_noise_float(vec3(Wp.y.mul(.8), seed.mul(5.1), 1.7)).mul(.16).add(1)).mul(fract(seed.mul(9.13)).mul(.22).add(.86))
  // ash raked and trodden out of the opening, over the hearthstone's front
  // and a little onto the tiles
  const spill = smoothstep(HEARTH.depth + .75, HEARTH.depth - .15, hy).mul(float(1).sub(smoothstep(HEARTH.width / 2 - .45, HEARTH.width / 2 - .05, hx.abs())))
    .mul(float(1).sub(smoothstep(.04, .06, hz))).mul(smoothstep(-.2, .45, mx_noise_float(vec3(hx.mul(5), hy.mul(5), 7.7)).add(mx_noise_float(Wp.mul(23)).mul(.3))))
    .mul(is(K.STONE).add(is(K.TILE).mul(.45)))
  tuffJ = mix(tuffJ, ashC, spill.mul(.55))
  tileColour = mix(tileColour, ashC.mul(.8), spill.mul(.4))
  const clean = silvered.mul(is(K.WEATHERED)).add(wax.mul(is(K.WAX))).add(brass.mul(is(K.BRASS))).add(glaze.mul(is(K.GLAZE))).add(earth.mul(is(K.EARTH))).add(cloth.mul(is(K.CLOTH))).add(tileColour.mul(is(K.TILE))).add(joint.mul(is(K.JOINT))).add(plaster.mul(is(K.PLASTER).add(is(K.REVEAL)))).add(oak.mul(is(K.OAK)))
    .add(tuffJ.mul(is(K.STONE))).add(brickHot.mul(is(K.BRICK))).add(iron.mul(is(K.IRON))).add(ashC.mul(is(K.ASH))).add(charC.mul(is(K.CHAR)))
  // soot: carried by the surface, gathered in blotches and rising streaks
  // THE BREAST OVER THE OPENING. A fire that draws badly rolls its smoke out
  // under the lintel, so the stone above the opening carries a plume of it:
  // darkest at the lintel's arris over the fire, spreading and thinning up
  // the lintel, the shelf and the hood's foot, streaked where it climbed
  const above = hz.sub(1.66).max(0)
  const sheet = float(1).sub(smoothstep(.7, 1.3, hx.abs())).mul(exp(above.div(-.32))).mul(.85)
  const tongue = exp(hx.div(above.mul(.35).add(.45)).pow(2).negate()).mul(exp(above.div(-.85))).mul(.7)
  const plume = sheet.add(tongue).mul(smoothstep(1.5, 1.66, hz)).mul(smoothstep(HEARTH.depth - .5, HEARTH.depth - .25, hy))
    .mul(mx_noise_float(vec3(hx.mul(4.5), hz.mul(.8), 5.1)).mul(.35).add(.85)).mul(is(K.STONE))
  const sootField = mix(soot.mul(mx_noise_float(vec3(Wp.x.mul(3), Wp.y.mul(1.2), Wp.z.mul(3))).mul(.35).add(.8)), brickSoot, is(K.BRICK).mul(soot.greaterThan(.8).select(float(0), float(1)))).add(plume).clamp(0, 1)
  // THE HEARTHSTONE, as the fires have used it: three slabs, each its own
  // stone, their front worn pale and hollow where feet stood to tend the fire;
  // a fan of soot out of the opening, scorches where embers rolled, ash
  // drifted and trodden over it with the charcoal's crumbs in it
  const onSlab = is(K.STONE).mul(float(1).sub(smoothstep(.034, .04, hz))).mul(smoothstep(.8, .95, normalWorldGeometry.y))
    .mul(float(1).sub(smoothstep(HEARTH.width / 2 + .04, HEARTH.width / 2 + .08, hx.abs()))).mul(float(1).sub(smoothstep(HEARTH.depth + .40, HEARTH.depth + .45, hy)))
  const open = HEARTH.width / 2 - .34
  const slabAt = hx.add(mx_noise_float(vec3(hy.mul(3), 1.1, 2.2)).mul(.02))
  const slabJoint = max(band(slabAt.sub(.49).abs(), footprint(slabAt), .005), band(slabAt.add(.49).abs(), footprint(slabAt), .005))
  const slabHue = fract(floor(slabAt.add(1.47).div(.98)).mul(7.7).sin().mul(437.5)).sub(.5)
  const slabStone = tuffJ.mul(vec3(.86, .87, .88)).mul(slabHue.mul(.2).add(1)).mul(mx_noise_float(vec3(hx.mul(2.1), hy.mul(2.1), 3.7)).mul(.14).add(mx_noise_float(Wp.mul(19)).mul(.07)).add(1))
  const trodSlab = smoothstep(HEARTH.depth + .1, HEARTH.depth + .38, hy).mul(float(1).sub(smoothstep(.5, 1.2, hx.abs())))
  const inFire = float(1).sub(smoothstep(HEARTH.depth - .08, HEARTH.depth + .02, hy)).mul(float(1).sub(smoothstep(open - .06, open + .02, hx.abs())))
  const fanReach = hx.abs().sub(open.valueOf() * .55).max(0).mul(.55).add(.26).mul(mx_noise_float(vec3(hx.mul(3.5), 7.3, 1.1)).mul(.3).add(.9))
  const fan = exp(hy.sub(HEARTH.depth - .04).max(0).div(fanReach).negate()).mul(float(1).sub(smoothstep(open - .15, open + .35, hx.abs()))).mul(mx_noise_float(vec3(hx.mul(9), hy.mul(2.5), 4.4)).mul(.25).add(.85))
  const scorch = smoothstep(.32, .5, mx_noise_float(vec3(hx.mul(5.5), hy.mul(5.5), 9.3)).add(mx_noise_float(vec3(hx.mul(19), hy.mul(19), 2.7)).mul(.22)))
    .mul(smoothstep(HEARTH.depth - .1, HEARTH.depth + .15, hy)).mul(float(1).sub(smoothstep(HEARTH.depth + .75, HEARTH.depth + 1.1, hy))).mul(float(1).sub(smoothstep(1.1, 1.5, hx.abs())))
  const crumbs = smoothstep(.7, .78, mx_noise_float(Wp.mul(61))).mul(spill.add(fan.mul(.4)).min(1))
  let hearthStone: N = mix(slabStone, slabStone.mul(vec3(.8, .76, .72)), trodSlab.mul(.6)).mul(float(1).sub(slabJoint.mul(.7)))
  hearthStone = mix(hearthStone, vec3(.035, .03, .027), max(inFire.mul(.9), fan.mul(.72)))
  hearthStone = mix(hearthStone, vec3(.075, .05, .035), scorch.mul(.7))
  hearthStone = mix(hearthStone, ashC.mul(mx_noise_float(Wp.mul(47)).mul(.18).add(1.05)), spill.mul(.75))
  hearthStone = mix(hearthStone, vec3(.02, .018, .016), crumbs.mul(.85))
  // the first tiles before the hearth take the scorches and the crumbs too
  const tileHearth = is(K.TILE).mul(smoothstep(HEARTH.depth + .3, HEARTH.depth + .5, hy)).mul(float(1).sub(smoothstep(1.3, 1.5, hx.abs()))).mul(float(1).sub(smoothstep(.04, .06, hz)))
  const colour = mix(mix(mix(clean, hearthStone, onSlab), vec3(.07, .045, .03), scorch.mul(tileHearth).mul(.55)).mul(float(1).sub(crumbs.mul(tileHearth).mul(.7))), vec3(.012, .011, .010), sootField)
  m.colorNode = colour
  m.roughnessNode = float(.9).sub(is(K.TILE).mul(float(.22).add(wear.mul(.28))).mul(float(1).sub(jointCover))).sub(is(K.OAK).mul(.12)).add(is(K.JOINT).mul(.05)).sub(is(K.IRON).mul(.3))
    .sub(is(K.WAX).mul(.38)).sub(is(K.BRASS).mul(.55)).sub(is(K.GLAZE).add(is(K.EARTH)).mul(.72)).add(is(K.CLOTH).mul(.08)).add(is(K.WEATHERED).mul(.05)).sub(is(K.BRICK).mul(brickSoot).mul(.3))
  m.metalnessNode = is(K.IRON).mul(.15).add(is(K.BRASS))
  m.aoNode = clamp(ambient, 0, 1)
  // A surface of the passage takes no direct sun: nothing faces it.
  const shade = windowShade()
  // inside the hall's box the room's own fine map stands for the key's
  const [su, sv] = hallUVNode(Wp)
  const inSunBox = su.greaterThan(SUN_BOX.u0).and(su.lessThan(SUN_BOX.u1)).and(sv.greaterThan(SUN_BOX.v0)).and(sv.lessThan(SUN_BOX.v1)).and(Wp.y.lessThan(BOARD_Z + .05)).select(float(1), float(0))
  m.receivedShadowNode = Fn(([shadow]: N[]) => (sunShadow ? mix(shadow, sunShadow, inSunBox) : shadow).mul(lit).mul(mix(float(1), shade, inHallShade)))
  m.userData['engineWindowShade'] = true
  // THE FLOOR'S SUN, SENT BACK: baked form factors from the hour's patches,
  // times the key's colour and strength. The film's true bounce replaces it;
  // `engineBounce` marks the term the export turns off.
  // the west lights look onto a sunlit terrace and garden, the back ones onto
  // the north sky: their day reaches the walls warm and cool
  const northSky = ambient.sub(westSky).max(0)
  const diffuseReturn = colour.mul(vec3(1, .73, .545).mul(bounce.mul(BOUNCE_K)).add(vec3(.19, .155, .115).mul(westSky)).add(vec3(.12, .13, .14).mul(northSky)))
  // waxed oak and glaze mirror the windows at a graze: the sheen a shaded
  // table top holds where the eye catches the day in it
  // the wax lies unevenly: the grain opens it, and hands have rubbed it up
  const waxed = grain.mul(3).add(1).max(.3).mul(mx_noise_float(Wp.mul(2.3)).mul(.3).add(.8))
  m.emissiveNode = perPixel ? diffuseReturn.add(windowGloss().mul(is(K.WAX).mul(waxed).add(is(K.GLAZE).add(is(K.EARTH)).mul(1.4))).mul(inSunBox)) : diffuseReturn
  m.userData['engineBounce'] = true
  m.name = 'vinci/house-hall/fabric'
  return m
}
