/** THE READING ROOM'S PLAN: a studiolo, the small panelled room a scholar
 * read in, built as modern joinery inside the long gallery round the reading
 * table. Its body (a low oak plinth, framed and panelled walls, a doorway
 * with its threshold and casing, a coffered ceiling under a corniced lid) and
 * the chair drawn up to the table, in the wing's own metres. Pure geometry
 * and numbers: the room's mount (`reading-room.ts`) dresses and lights it,
 * and the certificate's supplement (`reading-room-check.mjs`) proves every
 * box of it clear of the walk. The panelling follows types of the period
 * (framed panels, a linenfold dado, pilasters, a coffered ceiling); it copies
 * no room and claims none as his.
 */
import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute,
  Quaternion, Shape, ShapeUtils, Vector2, Vector3,
} from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { FACE, FLOOR, OPENING } from './layout'
import { VINCI_READING_TABLE } from './approaches'

export const READING_ROOM_PROVENANCE = {
  manifestId: 'vinci/collection-reading-room',
  assetClass: 'GENERATED',
  certainty: 'reconstructed',
} as const

export const T = VINCI_READING_TABLE
/** How far a body laid against another body's plane runs into it, so no two
 * faces share a plane and no depth can fight. */
export const BED = .004

/** THE ROOM IN THE WING'S METRES (east, north, height). Its footprint is the
 * niche's: from the gallery lining to the front, which the walk to the hall
 * door passes with a quarter of a metre to spare beyond its certified
 * envelope, and from clear of the body wall's standing sheet to the hall
 * door's jamb. The plinth and the lid run to that footprint; the walls stand
 * back from it. */
export const READING_ROOM = {
  /** the gallery lining's face */
  wall: FACE.hallPartitionEast + .033,
  /** the gallery's concrete finish over the lining: the room stands before it */
  finish: FACE.hallPartitionEast + .045,
  south: -48.30,
  north: OPENING.hallToGallery.north[0] - .02,
  front: -36.35,
  /** the plinth: its top is the room's floor, its foot a dark recessed toe */
  plinth: .09, toe: .03, toeBack: .02,
  floor: FLOOR + .09,
  /** how far the walls stand back from the plinth's and the lid's edge */
  setBack: .05,
  /** a panelled skin's depth from its ground to its frame's face */
  skin: .022,
  /** the side walls and the front wall, face to face */
  sideWall: .05, frontWall: .1,
  /** the doorway on the table's own axis: clear width and height */
  door: { width: 1.3, height: 2.1, casing: .11 },
  /** THE SOUTH WINDOW: the south wall's east bay left open over the dado. The
   * body wall's standing sheet is read from an eye 0.30 m off this wall at
   * standing height, and that eye's certified envelope passes through here,
   * so the wall is open where the envelope is (west edge east, over the
   * room's floor from sill to head, in metres). */
  window: { west: -37.49, sill: 1.19, head: 1.85 },
  /** inside: the coffered ceiling's beams and the coffers' panels over them */
  ceiling: FLOOR + 2.86, coffer: FLOOR + 2.96,
  /** outside: the entablature, and the lid's top */
  architrave: FLOOR + 2.62, frieze: FLOOR + 2.70, cornice: FLOOR + 2.98, top: FLOOR + 3.28,
} as const
const R = READING_ROOM

/** The planes the room's faces stand in, derived once. */
export const PLANES = {
  /** the ground the back wall's panelling is fixed to, a hair before the finish */
  backGround: R.finish + .002,
  back: R.finish + .002 + R.skin,
  southOuter: R.south + R.setBack, southInner: R.south + R.setBack + R.sideWall,
  northOuter: R.north - R.setBack, northInner: R.north - R.setBack - R.sideWall,
  frontOuter: R.front - R.setBack, frontInner: R.front - R.setBack - R.frontWall,
  doorSouth: T.north - R.door.width / 2, doorNorth: T.north + R.door.width / 2,
  doorHead: R.floor + R.door.height,
  /** the south window's east edge: the bay's, a stile short of the front */
  windowEast: R.front - R.setBack - R.frontWall - .06,
} as const
const Pl = PLANES

/** THE DOORWAY AS AN OPENING, for the light it lets out: its middle on the
 * front's plane, its width and height, and the way it faces. */
export const READING_ROOM_DOOR = {
  east: Pl.frontOuter, north: T.north,
  bottom: R.floor, top: Pl.doorHead,
  width: R.door.width, height: R.door.height,
  facing: [1, 0, 0] as [number, number, number],
} as const

/** THE ROOM'S FLOOR PATCH in the gallery: the plinth's footprint, which the
 * gallery's own floor stops at. */
export const READING_ROOM_FOOTPRINT = { west: FACE.hallPartitionEast, east: R.front, south: R.south, north: R.north } as const

/** THE LAMP: its place, its aim and the level it is asked to reach at the
 * page, from which its candela follows. A modern warm reading lamp. */
export const READING_LAMP = {
  east: T.east, north: T.north,
  /** the shade's rim, a little over half a metre above the table top: low
   * enough that the phone's frame holds the whole shade under its top edge */
  rim: T.top + .52,
  /** a 2700 K lamp as the print shows it, balanced like the sun outdoors */
  colour: '#ffd3a0',
  /** at the page, in lux; the stack reads one hundred lux as one */
  lux: 72,
  /** an opal disc under a dome: a cosine lobe, cut at the rim */
  angle: 1.45, penumbra: 1, reach: 4.5,
  mapPx: 2048, soft: 2.5,
} as const

/** THE COVE: a warm line of light laid on the cornice's top, so the coffered
 * ceiling glows and the room is lit by what the ceiling sends back. It faces
 * up and reaches nothing under its own plane. */
export const READING_COVE = {
  height: R.ceiling - .07,
  kelvin: 3500,
  /** its luminance, in the stack's units */
  intensity: 5,
} as const

/** THE BACK WALL'S LIGHT: a small warm head over the doorway, inside,
 * aimed across the room at the panelling above the book, so the wall the
 * page is read against is lit and falls away toward the table. */
export const READING_WASH = {
  at: [R.front - R.setBack - R.frontWall - .07, T.north, R.floor + 2.36] as [number, number, number],
  aim: [FACE.hallPartitionEast + .07, T.north, R.floor + 1.86] as [number, number, number],
  kelvin: 3000, candela: 9, angle: .42, penumbra: .9, reach: 5,
} as const

/** THE THRESHOLD'S DOWNLIGHT: a warm slot let into the doorway's head, so
 * the sill and the floor before it lie in a pool and the gallery sees the
 * room's light at its door. Candela and cone as data; the gallery's own
 * table lights its floor from the same numbers. */
export const READING_THRESHOLD = {
  at: [R.front - R.setBack - .05, T.north, R.floor + R.door.height - .012] as [number, number, number],
  aim: [R.front + .55, T.north, FLOOR] as [number, number, number],
  kelvin: 2900, candela: 5, angle: .62, penumbra: .85, reach: 4.5,
  /** the slot's lens in the head's lining */
  slot: { width: .05, length: R.door.width - .2 },
} as const

/** The layer only this room's lamp casts from: no eye and no sun sees it. */
export const READING_SHADOW_LAYER = 4

/** The shade, in its own metres: radius and height over the rim. */
export const SHADE = { radius: .15, height: .155, fitter: .024 }

export const v3 = (e: number, n: number, h: number): Vector3 => new Vector3(e, h, -n)

/** A deterministic hash, so every board and panel keeps its own tone and its
 * own piece of the photograph from build to build. */
export function hash(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export type Grain = 'up' | 'east' | 'north'
export interface Piece {
  /** the box, west to east, south to north, bottom to top */
  box: [w: number, s: number, b: number, e: number, n: number, t: number]
  grain: Grain
  /** where this piece's own read of the photograph starts, metres */
  offset: [number, number]
  /** mirror the read across the piece, for the book-matched neighbour */
  mirror?: boolean
  /** the linear albedo this piece is the photograph's variation around */
  tone: [number, number, number]
}

/** Faces with UVs in metres along the grain, and a tone per vertex. */
export class Batch {
  private p: number[] = []; private n: number[] = []; private u: number[] = []; private t: number[] = []
  quad(c: Vector3[], normal: Vector3, uvs: [number, number][], tone: [number, number, number]): void {
    this.quadN(c, [normal, normal, normal, normal], uvs, tone)
  }
  /** a quad with a normal per corner, wound to face the normals' side */
  quadN(c: Vector3[], normals: Vector3[], uvs: [number, number][], tone: [number, number, number]): void {
    const cross = c[1]!.clone().sub(c[0]!).cross(c[2]!.clone().sub(c[0]!))
    if (cross.lengthSq() < 1e-16) {
      const other = c[2]!.clone().sub(c[0]!).cross(c[3]!.clone().sub(c[0]!))
      cross.copy(other)
    }
    const mean = normals[0]!.clone().add(normals[1]!).add(normals[2]!).add(normals[3]!)
    const order = cross.dot(mean) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]
    for (const i of order) {
      this.p.push(c[i]!.x, c[i]!.y, c[i]!.z); this.n.push(normals[i]!.x, normals[i]!.y, normals[i]!.z)
      this.u.push(uvs[i]![0], uvs[i]![1]); this.t.push(...tone)
    }
  }
  tri(c: Vector3[], normal: Vector3, uvs: [number, number][], tone: [number, number, number]): void {
    const cross = c[1]!.clone().sub(c[0]!).cross(c[2]!.clone().sub(c[0]!))
    const order = cross.dot(normal) >= 0 ? [0, 1, 2] : [0, 2, 1]
    for (const i of order) {
      this.p.push(c[i]!.x, c[i]!.y, c[i]!.z); this.n.push(normal.x, normal.y, normal.z)
      this.u.push(uvs[i]![0], uvs[i]![1]); this.t.push(...tone)
    }
  }
  piece(q: Piece): void {
    const [w, s, b, e, n, t] = q.box
    // three's frame: x east, y up, z south
    const lo = new Vector3(w, b, -n), hi = new Vector3(e, t, -s)
    const corner = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z)
    const faces: { c: Vector3[]; normal: Vector3 }[] = [
      { c: [corner(hi.x, lo.y, lo.z), corner(hi.x, lo.y, hi.z), corner(hi.x, hi.y, hi.z), corner(hi.x, hi.y, lo.z)], normal: new Vector3(1, 0, 0) },
      { c: [corner(lo.x, lo.y, lo.z), corner(lo.x, lo.y, hi.z), corner(lo.x, hi.y, hi.z), corner(lo.x, hi.y, lo.z)], normal: new Vector3(-1, 0, 0) },
      { c: [corner(lo.x, hi.y, lo.z), corner(hi.x, hi.y, lo.z), corner(hi.x, hi.y, hi.z), corner(lo.x, hi.y, hi.z)], normal: new Vector3(0, 1, 0) },
      { c: [corner(lo.x, lo.y, lo.z), corner(hi.x, lo.y, lo.z), corner(hi.x, lo.y, hi.z), corner(lo.x, lo.y, hi.z)], normal: new Vector3(0, -1, 0) },
      { c: [corner(lo.x, lo.y, hi.z), corner(hi.x, lo.y, hi.z), corner(hi.x, hi.y, hi.z), corner(lo.x, hi.y, hi.z)], normal: new Vector3(0, 0, 1) },
      { c: [corner(lo.x, lo.y, lo.z), corner(hi.x, lo.y, lo.z), corner(hi.x, hi.y, lo.z), corner(lo.x, hi.y, lo.z)], normal: new Vector3(0, 0, -1) },
    ]
    // the read runs along the grain; across it lies the other axis of the face
    const along = (p: Vector3): number => q.grain === 'up' ? p.y : q.grain === 'east' ? p.x : -p.z
    const acrossOf = (p: Vector3, normal: Vector3): number => {
      const axes = [
        { value: p.x, axis: 'east', flat: Math.abs(normal.x) > .5 },
        { value: -p.z, axis: 'north', flat: Math.abs(normal.z) > .5 },
        { value: p.y, axis: 'up', flat: Math.abs(normal.y) > .5 },
      ].filter(a => !a.flat && a.axis !== q.grain)
      return axes[0]?.value ?? 0
    }
    const centre = q.grain === 'north' ? (w + e) / 2 : (s + n) / 2
    for (const face of faces) {
      const uvs = face.c.map(p => {
        let across = acrossOf(p, face.normal)
        if (q.mirror) across = 2 * centre - across
        return [across + q.offset[0], along(p) + q.offset[1]] as [number, number]
      })
      this.quad(face.c, face.normal, uvs, q.tone)
    }
  }
  get empty(): boolean { return this.p.length === 0 }
  get triangles(): number { return this.p.length / 9 }
  geometry(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3))
    g.setAttribute('uv', new Float32BufferAttribute(this.u, 2))
    g.setAttribute('pieceTone', new Float32BufferAttribute(this.t, 3))
    g.computeBoundingBox(); g.computeBoundingSphere()
    return g
  }
}

export const linear = (hex: string): [number, number, number] => { const c = new Color(hex); return [c.r, c.g, c.b] }
/** Oak laid by the cabinet maker: every piece its own tone around the mean. */
export function toned(base: string, i: number, salt: number, swing = .09): [number, number, number] {
  const [r, g, b] = linear(base), k = 1 + (hash(i, salt) - .5) * 2 * swing, warm = (hash(i, salt + 7) - .5) * .06
  return [r * k * (1 + warm), g * k, b * k * (1 - warm)]
}

/** THE OAK, oiled, the museum's own: the room's inside a shade warmer and
 * darker than its outside, the floor darker again, the chair its own. */
export const OAK = { wall: '#88705a', outside: '#7e5e42', floor: '#7a5d42', reveal: '#5c4633', ceiling: '#86653f', coffer: '#c6bca9', chair: '#7a5a3b' }
/** How far the photograph of the oak runs across and along its grain before
 * it repeats, in metres: drawn out along the grain, so a leaf's height holds
 * one figure. */
export const OAK_READ = [1.83, 2.9] as const

// ------------------------------------------------------------------ joinery

/** A panelled face: a ground plane and the axes a joiner sets out on it, x
 * along the face, y up it from the room's floor, z out of it from the ground. */
export interface Face { o: Vector3; r: Vector3; u: Vector3; n: Vector3 }
const EAST = new Vector3(1, 0, 0), WEST = new Vector3(-1, 0, 0), NORTH = new Vector3(0, 0, -1), SOUTH = new Vector3(0, 0, 1), UP = new Vector3(0, 1, 0)
const at = (f: Face, x: number, y: number, z: number): Vector3 =>
  f.o.clone().addScaledVector(f.r, x).addScaledVector(f.u, y).addScaledVector(f.n, z)
const dir = (f: Face, x: number, y: number, z: number): Vector3 =>
  new Vector3().addScaledVector(f.r, x).addScaledVector(f.u, y).addScaledVector(f.n, z).normalize()

/** A moulding's section: [across, out] points, from the edge it springs from
 * over its face and back, in metres. */
export type Section = readonly (readonly [number, number])[]
/** Where a run's end cuts a section point: the run's end plus `a` times the
 * point's across and `u` times its out (a mitre is one of them at plus or
 * minus one; a square end is both zero). */
export interface Cut { a: number; u: number }
const SQUARE: Cut = { a: 0, u: 0 }

/** A cabinet maker's hand: boxes, runs of moulding and panels, all set out
 * on a face, into one batch. */
export class Joiner {
  constructor(readonly batch: Batch) {}
  /** a box on a face; its grain runs along x or up y */
  box(f: Face, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, grain: 'x' | 'y', tone: [number, number, number], offset: [number, number]): void {
    if (x1 - x0 < 1e-5 || y1 - y0 < 1e-5 || z1 - z0 < 1e-5) return
    const c = (x: number, y: number, z: number): Vector3 => at(f, x, y, z)
    const faces: { q: [number, number, number][]; nrm: [number, number, number] }[] = [
      { q: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], nrm: [0, 0, 1] },
      { q: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], nrm: [0, 0, -1] },
      { q: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], nrm: [0, 1, 0] },
      { q: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], nrm: [0, -1, 0] },
      { q: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], nrm: [1, 0, 0] },
      { q: [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], nrm: [-1, 0, 0] },
    ]
    for (const { q, nrm } of faces) {
      const normal = dir(f, ...nrm)
      // the read: along the grain, across it the face's other in-plane axis
      const uvs = q.map(([x, y, z]) => {
        const alongV = grain === 'y' ? y : x
        const acrossV = nrm[2] !== 0 ? (grain === 'y' ? x : y) : nrm[0] !== 0 ? (grain === 'y' ? z : y) : (grain === 'y' ? x : z)
        return [acrossV + offset[0], alongV + offset[1]] as [number, number]
      })
      this.batch.quad(q.map(([x, y, z]) => c(x, y, z)), normal, uvs, tone)
    }
  }
  /** a run of moulding along x (at height `at0`) or up y (at `at0` along x),
   * its section's across axis pointing `sign` along the other axis, standing
   * on the face at `z0`, from `from` to `to`, each end cut as asked */
  run(f: Face, axis: 'x' | 'y', at0: number, sign: 1 | -1, z0: number, section: Section, from: number, to: number,
    start: Cut, end: Cut, tone: [number, number, number], offset: [number, number], caps: [boolean, boolean] = [false, false]): void {
    const pts = section.map(([a, u]) => ({ a, u }))
    const place = (t: number, a: number, u: number): Vector3 => axis === 'x' ? at(f, t, at0 + sign * a, z0 + u) : at(f, at0 + sign * a, t, z0 + u)
    const norm2 = (na: number, nu: number): Vector3 => axis === 'x' ? dir(f, 0, sign * na, nu) : dir(f, sign * na, 0, nu)
    const tStart = (p: { a: number; u: number }): number => from + start.a * p.a + start.u * p.u
    const tEnd = (p: { a: number; u: number }): number => to + end.a * p.a + end.u * p.u
    // each segment's own normal, rotated from its tangent to the side away
    // from the section's inside
    const segs: { na: number; nu: number; len: number }[] = []
    for (let i = 0; i + 1 < pts.length; i++) {
      const da = pts[i + 1]!.a - pts[i]!.a, du = pts[i + 1]!.u - pts[i]!.u, len = Math.hypot(da, du) || 1
      segs.push({ na: -du / len, nu: da / len, len })
    }
    // smooth across a joint that turns less than 40 degrees
    const blend = (i: number, j: number): [number, number] => {
      const a = segs[i]!, b = segs[j]!
      if (a.na * b.na + a.nu * b.nu < Math.cos(40 * Math.PI / 180)) return [a.na, a.nu]
      const na = a.na + b.na, nu = a.nu + b.nu, l = Math.hypot(na, nu) || 1
      return [na / l, nu / l]
    }
    let arc = 0
    for (let i = 0; i < segs.length; i++) {
      const p = pts[i]!, q = pts[i + 1]!, s = segs[i]!
      const nP = i > 0 ? blend(i, i - 1) : [s.na, s.nu] as [number, number]
      const nQ = i + 1 < segs.length ? blend(i, i + 1) : [s.na, s.nu] as [number, number]
      const c = [place(tStart(p), p.a, p.u), place(tEnd(p), p.a, p.u), place(tEnd(q), q.a, q.u), place(tStart(q), q.a, q.u)]
      const nm = [norm2(...nP), norm2(...nP), norm2(...nQ), norm2(...nQ)]
      const uvs: [number, number][] = [
        [arc + offset[0], tStart(p) + offset[1]], [arc + offset[0], tEnd(p) + offset[1]],
        [arc + s.len + offset[0], tEnd(q) + offset[1]], [arc + s.len + offset[0], tStart(q) + offset[1]],
      ]
      if (tEnd(p) - tStart(p) > 1e-5 || tEnd(q) - tStart(q) > 1e-5) this.batch.quadN(c, nm, uvs, tone)
      arc += s.len
    }
    // a square end that shows is closed by its section
    const contour = pts.map(p => new Vector2(p.a, p.u))
    if (contour.length >= 3) {
      const faces = ShapeUtils.triangulateShape(contour, [])
      for (const [k, cap] of [[0, caps[0]], [1, caps[1]]] as const) {
        if (!cap) continue
        const t = k === 0 ? tStart : tEnd
        const along = axis === 'x' ? dir(f, k === 0 ? -1 : 1, 0, 0) : dir(f, 0, k === 0 ? -1 : 1, 0)
        for (const tri of faces) {
          const c = tri.map(i => place(t(pts[i]!), pts[i]!.a, pts[i]!.u))
          this.batch.tri(c, along, tri.map(i => [pts[i]!.a + offset[0], pts[i]!.u + offset[1]] as [number, number]), tone)
        }
      }
    }
  }
  /** a moulding round the inside of an opening, mitred at its four corners,
   * its section springing from the opening's edge in over the panel */
  frame(f: Face, x0: number, x1: number, y0: number, y1: number, z0: number, section: Section, tone: [number, number, number], salt: number): void {
    const inward: Cut = { a: 1, u: 0 }, outward: Cut = { a: -1, u: 0 }
    const off = (k: number): [number, number] => [hash(salt, k) * 1.4, hash(salt, k + 5) * 2.1]
    this.run(f, 'x', y0, 1, z0, section, x0, x1, inward, outward, tone, off(1))
    this.run(f, 'x', y1, -1, z0, section, x0, x1, inward, outward, tone, off(2))
    this.run(f, 'y', x0, 1, z0, section, y0, y1, inward, outward, tone, off(3))
    this.run(f, 'y', x1, -1, z0, section, y0, y1, inward, outward, tone, off(4))
  }
  /** a raised field: a flat middle with four bevels down to the panel's edge */
  field(f: Face, x0: number, x1: number, y0: number, y1: number, z0: number, raise: number, bevel: number, tone: [number, number, number], offset: [number, number]): void {
    const X0 = x0 + bevel, X1 = x1 - bevel, Y0 = y0 + bevel, Y1 = y1 - bevel, Z = z0 + raise
    const uv = (x: number, y: number): [number, number] => [x + offset[0], y + offset[1]]
    this.batch.quad([at(f, X0, Y0, Z), at(f, X1, Y0, Z), at(f, X1, Y1, Z), at(f, X0, Y1, Z)], dir(f, 0, 0, 1), [uv(X0, Y0), uv(X1, Y0), uv(X1, Y1), uv(X0, Y1)], tone)
    const slope = (dx: number, dy: number): Vector3 => dir(f, dx * raise, dy * raise, bevel)
    this.batch.quad([at(f, x0, y0, z0), at(f, x1, y0, z0), at(f, X1, Y0, Z), at(f, X0, Y0, Z)], slope(0, -1), [uv(x0, y0), uv(x1, y0), uv(X1, Y0), uv(X0, Y0)], tone)
    this.batch.quad([at(f, x0, y1, z0), at(f, X0, Y1, Z), at(f, X1, Y1, Z), at(f, x1, y1, z0)], slope(0, 1), [uv(x0, y1), uv(X0, Y1), uv(X1, Y1), uv(x1, y1)], tone)
    this.batch.quad([at(f, x0, y0, z0), at(f, X0, Y0, Z), at(f, X0, Y1, Z), at(f, x0, y1, z0)], slope(-1, 0), [uv(x0, y0), uv(X0, Y0), uv(X0, Y1), uv(x0, y1)], tone)
    this.batch.quad([at(f, x1, y0, z0), at(f, x1, y1, z0), at(f, X1, Y1, Z), at(f, X1, Y0, Z)], slope(1, 0), [uv(x1, y0), uv(x1, y1), uv(X1, Y1), uv(X1, Y0)], tone)
  }
  /** a linenfold panel: the field carved in upright folds, each fold's end
   * stopped short of the frame and sloped back into the flat ground */
  linenfold(f: Face, x0: number, x1: number, y0: number, y1: number, z0: number, depth: number, tone: [number, number, number], offset: [number, number]): void {
    const width = x1 - x0, folds = Math.max(3, Math.round(width / .055)), steps = folds * 6
    const margin = .02, end = Math.min(.07, (y1 - y0) * .18)
    const profile: [number, number][] = []
    for (let k = 0; k <= steps; k++) {
      const s = k / steps, x = x0 + margin + s * (width - 2 * margin)
      // a fold rises from each valley in a round ridge, a narrow crease between
      const phase = (s * folds) % 1, ridge = Math.sin(Math.PI * phase)
      const edge = Math.min(1, s * steps / 3, (1 - s) * steps / 3)
      profile.push([x, depth * Math.pow(ridge, .6) * edge])
    }
    const place = (x: number, y: number, z: number): Vector3 => at(f, x, y, z0 + z)
    // the ground the folds are carved from
    const uvG = (x: number, y: number): [number, number] => [x + offset[0], y + offset[1]]
    this.batch.quad([place(x0, y0, 0), place(x1, y0, 0), place(x1, y1, 0), place(x0, y1, 0)], dir(f, 0, 0, 1), [uvG(x0, y0), uvG(x1, y0), uvG(x1, y1), uvG(x0, y1)], tone)
    for (let k = 0; k < profile.length - 1; k++) {
      const [xa, za] = profile[k]!, [xb, zb] = profile[k + 1]!
      const nA = dir(f, -(profile[Math.min(k + 1, profile.length - 1)]![1] - profile[Math.max(k - 1, 0)]![1]), 0, xb - xa + 1e-4)
      const nB = dir(f, -(profile[Math.min(k + 2, profile.length - 1)]![1] - profile[k]![1]), 0, xb - xa + 1e-4)
      const ya = y0 + margin + end, yb = y1 - margin - end
      // the fold's run, and its two sloped ends into the ground
      this.batch.quadN([place(xa, ya, za + .0005), place(xb, ya, zb + .0005), place(xb, yb, zb + .0005), place(xa, yb, za + .0005)], [nA, nB, nB, nA],
        [uvG(xa, ya), uvG(xb, ya), uvG(xb, yb), uvG(xa, yb)], tone)
      const slopeDown = dir(f, 0, -1, 1.2), slopeUp = dir(f, 0, 1, 1.2)
      this.batch.quadN([place(xa, y0 + margin, .0005), place(xb, y0 + margin, .0005), place(xb, ya, zb + .0005), place(xa, ya, za + .0005)], [slopeDown, slopeDown, nB, nA],
        [uvG(xa, y0), uvG(xb, y0), uvG(xb, ya), uvG(xa, ya)], tone)
      this.batch.quadN([place(xa, yb, za + .0005), place(xb, yb, zb + .0005), place(xb, y1 - margin, .0005), place(xa, y1 - margin, .0005)], [nA, nB, slopeUp, slopeUp],
        [uvG(xa, yb), uvG(xb, yb), uvG(xb, y1), uvG(xa, y1)], tone)
    }
  }
}

/** THE MOULDINGS, as sections [across, out] in metres. */
const quarter = (cx: number, cu: number, r: number, from: number, to: number, n = 5): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => { const t = from + (to - from) * i / n; return [cx + r * Math.cos(t), cu + r * Math.sin(t)] })
/** the panel mould: an ovolo from the frame's face down into the panel */
const PANEL_MOULD: Section = [...quarter(0, 0, .012, Math.PI / 2, 0, 5), [.016, 0]]
/** the dado's cap: a fillet, an ovolo nose and a cove under it */
const DADO_CAP: Section = [[0, 0], [0, .012], ...quarter(.012, .024, .012, -Math.PI / 2, 0, 3), [.03, .03], ...quarter(.06, .03, .03, Math.PI, Math.PI / 2, 4), [.062, .045], [.062, 0]]
/** the cornice inside: a cove sprung from the frieze up to a flat top */
const CORNICE_IN: Section = [[0, 0], [.02, .012], ...quarter(.2, 0, .18, Math.PI, Math.PI / 2, 7).map(([a, u]) => [a, u + .012] as [number, number]), [.2, .205], [.215, .205], [.215, .225], [.23, .225]]
/** the skirting: a plain board with a bead on its top edge */
const SKIRTING: Section = [[0, 0], [0, .008], [.07, .008], ...quarter(.07, .004, .004, -Math.PI / 2, Math.PI / 2, 4), [.078, 0]]
/** the architrave round the doorway: a fascia, a step, and a back band with a bead */
const CASING: Section = [[0, 0], [0, .016], [.055, .016], [.058, .02], ...quarter(.095, .02, .01, Math.PI, Math.PI / 2, 3), [.11, .03], [.11, 0]]
/** the door's hood: a bed mould, a corona and a cavetto top */
const HOOD: Section = [[0, 0], [0, .045], [.012, .045], [.012, .04], [.06, .04], [.06, .028], ...quarter(.1, .028, .04, Math.PI, Math.PI * 1.5, 4).map(([a, u]) => [a, Math.max(.004, u)] as [number, number]), [.1, 0]]

/** THE ROOM'S BODY: the oak inside, the oak outside, the dark of the toe and
 * the cores, the bronze of the threshold, and the ceiling apart, each a batch
 * of its own; and every solid's box for the certificate's supplement. */
export function studioloParts(): { inside: Batch; outside: Batch; ceiling: Batch; dark: Batch; bronze: Batch; solids: Piece['box'][] } {
  const inside = new Batch(), outside = new Batch(), ceiling = new Batch(), dark = new Batch(), bronze = new Batch()
  const I = new Joiner(inside), O = new Joiner(outside), C = new Joiner(ceiling)
  const solids: Piece['box'][] = []
  const tone = (base: string, i: number, swing = .07): [number, number, number] => toned(base, i, 3, swing)
  const off = (i: number, salt: number): [number, number] => [hash(i, salt) * OAK_READ[0], hash(i, salt + 1) * OAK_READ[1]]
  let k = 0
  const Y = R.floor
  const high = R.ceiling - Y

  // THE PLINTH. A dark toe set back under an oak band, its top the room's
  // floor: the room stands on it, lifted off the building's concrete.
  const W0 = R.finish - BED
  dark.piece({ box: [W0, R.south + R.toeBack, FLOOR - BED, R.front - R.toeBack, R.north - R.toeBack, FLOOR + R.toe], grain: 'east', offset: [0, 0], tone: [1, 1, 1] })
  const band = (box: Piece['box'], grain: Grain): void => { outside.piece({ box, grain, offset: off(k, 11), tone: tone(OAK.outside, k++, .04) }); solids.push(box) }
  band([W0, R.south, FLOOR + R.toe, R.front, R.south + R.setBack, Y], 'east')
  band([W0, R.north - R.setBack, FLOOR + R.toe, R.front, R.north, Y], 'east')
  band([R.front - R.setBack, R.south + R.setBack, FLOOR + R.toe, R.front, Pl.doorSouth, Y], 'north')
  band([R.front - R.setBack, Pl.doorNorth, FLOOR + R.toe, R.front, R.north - R.setBack, Y], 'north')
  solids.push([W0, R.south + R.toeBack, FLOOR - BED, R.front - R.toeBack, R.north - R.toeBack, FLOOR + R.toe])

  // THE FLOOR: oak boards laid from the doorway to the back wall, each its
  // own length and tone, their ends staggered.
  {
    const board = .19, from = Pl.southInner, to = Pl.northInner
    const first = T.north - board / 2 - Math.ceil((T.north - board / 2 - from) / board) * board
    for (let n = first, i = 0; n < to; n += board, i++) {
      const s = Math.max(from - BED, n + .0015), e = Math.min(to + BED, n + board - .0015)
      if (e - s < .01) continue
      const split = Pl.back + .5 + hash(i, 81) * 1.2
      for (const [w, east] of [[Pl.back - BED, split], [split + .002, Pl.frontInner + BED]] as const)
        inside.piece({ box: [w, s, Y - .022, east, e, Y], grain: 'east', offset: off(i, 83 + w), tone: tone(OAK.floor, 200 + i * 2 + (w === Pl.back - BED ? 0 : 1), .1) })
    }
    // the gaps between boards read against a dark sub-floor
    dark.piece({ box: [Pl.back - BED, from - BED, Y - .03, Pl.frontInner + BED, to + BED, Y - .021], grain: 'east', offset: [0, 0], tone: [1, 1, 1] })
    solids.push([Pl.back - BED, from - BED, Y - .03, Pl.frontInner + BED, to + BED, Y])
  }
  // THE THRESHOLD: an oak sill through the doorway, a hair over the floor,
  // and a bronze nosing at the plinth's edge.
  {
    const sill: Piece['box'] = [Pl.frontInner - BED, Pl.doorSouth, Y - .02, R.front - .006, Pl.doorNorth, Y + .012]
    inside.piece({ box: sill, grain: 'north', offset: off(1, 91), tone: tone(OAK.floor, 91, 0) })
    const nosing: Piece['box'] = [R.front - .006, Pl.doorSouth, FLOOR + R.toe, R.front, Pl.doorNorth, Y + .012]
    bronze.piece({ box: nosing, grain: 'north', offset: [0, 0], tone: [1, 1, 1] })
    solids.push(sill, nosing)
  }

  // ---------------------------------------------------------------- inside
  // THE FACES the panelling is set out on, x along each from its south or
  // west end, y up from the room's floor, z out into the room.
  const backF: Face = { o: v3(Pl.backGround, Pl.southInner, Y), r: NORTH, u: UP, n: EAST }
  const southF: Face = { o: v3(Pl.back, Pl.southInner - R.skin, Y), r: EAST, u: UP, n: NORTH }
  const northF: Face = { o: v3(Pl.back, Pl.northInner + R.skin, Y), r: EAST, u: UP, n: SOUTH }
  const frontF: Face = { o: v3(Pl.frontInner + R.skin, Pl.southInner, Y), r: NORTH, u: UP, n: WEST }
  const lengthNS = Pl.northInner - Pl.southInner, lengthEW = Pl.frontInner - Pl.back
  const doorX0 = Pl.doorSouth - Pl.southInner, doorX1 = Pl.doorNorth - Pl.southInner
  /** the registers, bottom to top, in metres over the room's floor */
  const REG = { skirt: .08, dadoLow: .16, dadoHigh: .73, cap: .81, mainLow: .87, mainPanel: .95, mainTop: 2.13, friezeLow: 2.21, friezeHigh: 2.43, cornice: high - .06 }
  const frameZ = R.skin, panelZ = R.skin - .009
  /** one wall's panelling: stiles and rails, panels, mouldings, the dado's
   * cap, the skirting, the frieze and the cornice */
  const panelled = (f: Face, length: number, members: [number, number, 'stile' | 'pilaster' | 'door'][], opts: { skirtGaps?: [number, number][]; salt: number; centre?: [number, number]; open?: [number, number] }): void => {
    const ms = [...members].sort((a, b) => a[0] - b[0])
    const gaps: [number, number][] = []
    let cursor = 0
    for (const [a, b] of ms) { if (a > cursor + 1e-4) gaps.push([cursor, a]); cursor = Math.max(cursor, b) }
    if (cursor < length - 1e-4) gaps.push([cursor, length])
    const doors = ms.filter(m => m[2] === 'door')
    const inDoor = (x0: number, x1: number): boolean => doors.some(([a, b]) => x0 < b - 1e-4 && x1 > a + 1e-4)
    const s = opts.salt
    // the ground behind everything, stained dark where a joint opens onto it
    const ground = (x0: number, x1: number, y0: number, y1: number): void => {
      if (x1 - x0 < 1e-4) return
      const c = [at(f, x0, y0, frameZ - .012), at(f, x1, y0, frameZ - .012), at(f, x1, y1, frameZ - .012), at(f, x0, y1, frameZ - .012)]
      dark.quad(c, dir(f, 0, 0, 1), [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], [1, 1, 1])
    }
    for (const [a, b] of gaps) {
      const isOpen = opts.open !== undefined && Math.abs((a + b) / 2 - (opts.open[0] + opts.open[1]) / 2) < .05
      if (!isOpen) { ground(a, b, 0, REG.cornice); continue }
      ground(a, b, 0, R.window.sill); ground(a, b, R.window.head, REG.cornice)
    }
    for (const [a, b, kind] of ms) if (kind !== 'door') ground(a, b, 0, REG.cornice)
      else { ground(a, a + .06, 0, REG.cornice); ground(b - .06, b, 0, REG.cornice) }
    // the stiles and pilasters, floor to frieze (the door's own casing is apart)
    for (const [a, b, kind] of ms) {
      if (kind === 'door') {
        // beside a doorway's casing a stile of its own, floor to frieze
        I.box(f, a, a + .06, REG.skirt, REG.friezeLow, panelZ - .004, frameZ, 'y', tone(OAK.wall, k++), off(k, s + 18))
        I.box(f, b - .06, b, REG.skirt, REG.friezeLow, panelZ - .004, frameZ, 'y', tone(OAK.wall, k++), off(k, s + 19))
        continue
      }
      I.box(f, a, b, REG.skirt, REG.friezeLow, panelZ - .004, frameZ, 'y', tone(OAK.wall, k++), off(k, s))
      if (kind === 'pilaster') {
        // the pilaster stands proud of the frame from the cap to the frieze,
        // on a base block, under a capital
        I.box(f, a, b, REG.mainLow, REG.mainTop, frameZ - .002, frameZ + .014, 'y', tone(OAK.wall, k++, .04), off(k, s + 1))
        I.box(f, a - .012, b + .012, REG.cap + .06, REG.mainLow + .045, frameZ - .002, frameZ + .022, 'x', tone(OAK.wall, k++, .04), off(k, s + 2))
        I.box(f, a - .014, b + .014, REG.mainTop - .03, REG.mainTop + .015, frameZ - .002, frameZ + .026, 'x', tone(OAK.wall, k++, .04), off(k, s + 3))
        I.run(f, 'x', REG.mainTop + .015, 1, frameZ - .002, [[0, 0], [0, .026], ...quarter(.012, .026, .012, Math.PI, Math.PI / 2, 3)], a - .014, b + .014, SQUARE, SQUARE, tone(OAK.wall, k++, .04), off(k, s + 4), [true, true])
      }
    }
    // the rails and panels of each gap, register by register
    for (const [a, b] of gaps) {
      if (inDoor(a, b)) continue
      const width = b - a
      // wide gaps take muntins, so no panel runs wider than about 0.8 m
      const count = Math.max(1, Math.round(width / .7)), muntin = .07
      const pw = (width - (count - 1) * muntin) / count
      const cols: [number, number][] = Array.from({ length: count }, (_, i) => [a + i * (pw + muntin), a + i * (pw + muntin) + pw])
      const central = opts.centre !== undefined && Math.abs((a + b) / 2 - (opts.centre[0] + opts.centre[1]) / 2) < .05
      const open = opts.open !== undefined && Math.abs((a + b) / 2 - (opts.open[0] + opts.open[1]) / 2) < .05
      // no muntin runs up across the leaf behind the book
      for (let i = 1; i < count; i++) I.box(f, cols[i - 1]![1], cols[i]![0], REG.skirt, central || open ? REG.cap : REG.friezeLow, panelZ - .004, frameZ, 'y', tone(OAK.wall, k++), off(k, s + 5))
      const rails: [number, number][] = [[REG.skirt, REG.dadoLow], [REG.dadoHigh, REG.cap], [REG.mainLow, REG.mainPanel], [REG.mainTop, REG.friezeLow]]
      for (const [y0, y1] of rails) I.box(f, a, b, y0, y1, panelZ - .004, frameZ, 'x', tone(OAK.wall, k++), off(k, s + 6))
      for (const [c0, c1] of cols) {
        // the dado's panels are linenfold, the type of the time
        I.linenfold(f, c0, c1, REG.dadoLow, REG.dadoHigh, panelZ, .008, tone(OAK.wall, k++, .05), off(k, s + 7))
        I.frame(f, c0, c1, REG.dadoLow, REG.dadoHigh, frameZ, PANEL_MOULD.map(([x, u]) => [x, u - .0115] as [number, number]), tone(OAK.wall, k++, .03), s * 13 + k)
      }
      // the main register: one quiet leaf behind the book, raised fields
      // elsewhere, each panel its own piece of the flitch
      // THE WINDOW'S BAY: a low panel, a sill rail, the opening, a head rail
      // and a high panel; the opening's reveal is lined apart
      if (open) {
        const y0 = R.window.sill, y1 = R.window.head
        for (const [r0, r1] of [[y0 - .06, y0], [y1, y1 + .06]] as [number, number][]) I.box(f, a, b, r0, r1, panelZ - .004, frameZ, 'x', tone(OAK.wall, k++), off(k, s + 20))
        for (const [p0, p1] of [[REG.mainPanel, y0 - .06], [y1 + .06, REG.mainTop]] as [number, number][]) {
          I.field(f, a, b, p0, p1, panelZ, .005, .035, tone(OAK.wall, k++, .06), off(k, s + 21))
          I.frame(f, a, b, p0, p1, frameZ, PANEL_MOULD.map(([x, u]) => [x, u - .0115] as [number, number]), tone(OAK.wall, k++, .03), s * 31 + k)
        }
        continue
      }
      const mainCols = central ? [[a, b] as [number, number]] : cols
      for (const [c0, c1] of mainCols) {
        if (central) {
          const c = [at(f, c0, REG.mainPanel, panelZ), at(f, c1, REG.mainPanel, panelZ), at(f, c1, REG.mainTop, panelZ), at(f, c0, REG.mainTop, panelZ)]
          const o = off(k, s + 8)
          inside.quad(c, dir(f, 0, 0, 1), [[c0 + o[0], REG.mainPanel + o[1]], [c1 + o[0], REG.mainPanel + o[1]], [c1 + o[0], REG.mainTop + o[1]], [c0 + o[0], REG.mainTop + o[1]]], tone(OAK.wall, k++, .02))
        } else I.field(f, c0, c1, REG.mainPanel, REG.mainTop, panelZ, .006, .045, tone(OAK.wall, k++, .06), off(k, s + 9))
        I.frame(f, c0, c1, REG.mainPanel, REG.mainTop, frameZ, PANEL_MOULD.map(([x, u]) => [x, u - .0115] as [number, number]), tone(OAK.wall, k++, .03), s * 17 + k)
      }
    }
    // THE FRIEZE: a band of small square panels between short muntins, run
    // over the doorway too
    {
      const y0 = REG.friezeLow, y1 = REG.friezeHigh, pitch = .36
      I.box(f, 0, length, y0, y0 + .03, panelZ - .004, frameZ, 'x', tone(OAK.wall, k++), off(k, s + 10))
      I.box(f, 0, length, y1 - .03, y1, panelZ - .004, frameZ, 'x', tone(OAK.wall, k++), off(k, s + 11))
      const n = Math.max(1, Math.round((length - .06) / pitch)), w = (length - .06) / n
      for (let i = 0; i <= n; i++) I.box(f, .03 + i * w - .03, .03 + i * w + .03, y0 + .03, y1 - .03, panelZ - .004, frameZ, 'y', tone(OAK.wall, k++), off(k, s + 12))
      for (let i = 0; i < n; i++) {
        const c0 = .03 + i * w + .03, c1 = .03 + (i + 1) * w - .03
        I.field(f, c0, c1, y0 + .03, y1 - .03, panelZ, .005, .03, tone(OAK.wall, k++, .07), off(k, s + 13))
        I.frame(f, c0, c1, y0 + .03, y1 - .03, frameZ, PANEL_MOULD.map(([x, u]) => [x, u - .0115] as [number, number]), tone(OAK.wall, k++, .03), s * 19 + k)
      }
      // over the frieze the ground runs up to the cornice
      I.box(f, 0, length, y1, REG.cornice, panelZ - .004, frameZ - .004, 'x', tone(OAK.wall, k++), off(k, s + 14))
    }
    // THE DADO'S CAP, THE SKIRTING AND THE CORNICE, mitred at the room's
    // inside corners and stopped square at the doorway
    // an inside corner: a point farther out of the wall starts later and
    // stops sooner, so two runs meet on the corner's diagonal
    const inStart: Cut = { a: 0, u: 1 }, inEnd: Cut = { a: 0, u: -1 }
    const stops: [number, number][] = [[0, length]]
    const cut = (runs: [number, number][], holes: [number, number][]): [number, number][] => {
      let out = runs
      for (const [h0, h1] of holes) out = out.flatMap(([a, b]): [number, number][] => {
        if (b <= h0 || a >= h1) return [[a, b]]
        const parts: [number, number][] = [[a, Math.max(a, h0)], [Math.min(b, h1), b]]
        return parts.filter(([p, q]) => q - p > .01)
      })
      return out
    }
    const doorHoles = doors.map(([a, b]) => [a, b] as [number, number])
    for (const [a, b] of cut(stops, doorHoles)) {
      const sa = a < 1e-3 ? inStart : SQUARE, sb = b > length - 1e-3 ? inEnd : SQUARE
      I.run(f, 'x', REG.cap, 1, frameZ, DADO_CAP.map(([x, u]) => [x, u] as [number, number]), a, b, sa, sb, tone(OAK.wall, k++, .03), off(k, s + 15), [sa === SQUARE, sb === SQUARE])
    }
    for (const [a, b] of cut(stops, [...doorHoles, ...(opts.skirtGaps ?? [])])) {
      const sa = a < 1e-3 ? inStart : SQUARE, sb = b > length - 1e-3 ? inEnd : SQUARE
      I.run(f, 'x', 0, 1, frameZ, SKIRTING, a, b, sa, sb, tone(OAK.wall, k++, .03), off(k, s + 16), [sa === SQUARE, sb === SQUARE])
    }
    I.run(f, 'x', REG.cornice - .23, 1, frameZ - .004, CORNICE_IN.map(([x, u]) => [x, u] as [number, number]), 0, length, inStart, inEnd, tone(OAK.wall, k++, .03), off(k, s + 17))
  }
  const backPil: [number, number, 'pilaster'][] = [[doorX0 - .12, doorX0, 'pilaster'], [doorX1, doorX1 + .12, 'pilaster']]
  panelled(backF, lengthNS, [[0, .06, 'stile'], ...backPil, [lengthNS - .06, lengthNS, 'stile']], { salt: 1, centre: [doorX0, doorX1] })
  const winX0 = R.window.west - Pl.back, winX1 = Pl.windowEast - Pl.back
  panelled(southF, lengthEW, [[0, .06, 'stile'], [winX0 - .06, winX0, 'stile'], [lengthEW - .06, lengthEW, 'stile']], { salt: 2, open: [winX0, winX1] })
  const shelfGap: [number, number] = [BOOKCASE_SPAN[0] - Pl.back - .01, BOOKCASE_SPAN[1] - Pl.back + .01]
  panelled(northF, lengthEW, [[0, .06, 'stile'], [lengthEW - .06, lengthEW, 'stile']], { salt: 3, skirtGaps: [shelfGap] })
  panelled(frontF, lengthNS, [[0, .06, 'stile'], [doorX0 - .08, doorX1 + .08, 'door'], [lengthNS - .06, lengthNS, 'stile']], { salt: 4 })
  // the inside of the room is one solid for the walk's proof: the walls'
  // inner faces as four slabs, the cornice's reach included
  solids.push([Pl.backGround, Pl.southInner, Y, Pl.back + .03, Pl.northInner, R.ceiling])
  {
    const s0 = Pl.southInner - R.skin, s1 = Pl.southInner + .07, w0 = R.window.west, w1 = Pl.windowEast
    solids.push([Pl.back, s0, Y, w0, s1, R.ceiling])
    solids.push([w1, s0, Y, Pl.frontInner + R.skin, s1, R.ceiling])
    solids.push([w0, s0, Y, w1, s1, Y + R.window.sill])
    solids.push([w0, s0, Y + R.window.head, w1, s1, R.ceiling])
  }
  solids.push([Pl.back, Pl.northInner - .07, Y, Pl.frontInner + R.skin, Pl.northInner + R.skin, R.ceiling])

  // THE DOORWAY: its reveals lined in oak, its casing inside and out, and
  // the hood over it outside
  {
    const x0 = doorX0, x1 = doorX1, head = R.door.height
    // the linings: two jambs and the head, the wall's whole thickness
    const lining = (box: Piece['box'], grain: Grain): void => { inside.piece({ box, grain, offset: off(k, 95), tone: tone(OAK.reveal, k++, .03) }); solids.push(box) }
    lining([Pl.frontInner - BED, Pl.doorSouth - .02, Y - .01, Pl.frontOuter + BED, Pl.doorSouth, Pl.doorHead + .02], 'up')
    lining([Pl.frontInner - BED, Pl.doorNorth, Y - .01, Pl.frontOuter + BED, Pl.doorNorth + .02, Pl.doorHead + .02], 'up')
    lining([Pl.frontInner - BED, Pl.doorSouth - .02, Pl.doorHead, Pl.frontOuter + BED, Pl.doorNorth + .02, Pl.doorHead + .02], 'north')
    // inside: a plain casing
    const inCasing: Section = [[0, 0], [0, .012], [.055, .012], ...quarter(.055, 0, .012, Math.PI / 2, 0, 3), [.07, 0]]
    const cIn = tone(OAK.wall, k++, .03)
    I.run(frontF, 'y', x0, -1, frameZ, inCasing, 0, head, SQUARE, { a: 1, u: 0 }, cIn, off(k, 96), [true, false])
    I.run(frontF, 'y', x1, 1, frameZ, inCasing, 0, head, SQUARE, { a: 1, u: 0 }, cIn, off(k, 97), [true, false])
    I.run(frontF, 'x', head, 1, frameZ, inCasing, x0, x1, { a: -1, u: 0 }, { a: 1, u: 0 }, cIn, off(k, 98))
    // over the inner casing the front wall's ground runs to the frieze
    I.box(frontF, x0 - .08, x1 + .08, head + .07, REG.friezeLow, panelZ - .004, frameZ, 'x', tone(OAK.wall, k++), off(k, 99))
  }

  // ---------------------------------------------------------------- outside
  // OUTSIDE, AN ORDER: pilasters at the front's two corners and either side
  // of the doorway, on bases, under capitals, carrying an architrave, a
  // panelled frieze and a cornice; between them framed panels in two
  // registers over a base course, the oak oiled dark so the lit room inside
  // reads through its openings.
  const OY = R.floor
  const frontO: Face = { o: v3(Pl.frontOuter - R.skin, Pl.southOuter, OY), r: NORTH, u: UP, n: EAST }
  const southO: Face = { o: v3(R.finish, Pl.southOuter + R.skin, OY), r: EAST, u: UP, n: SOUTH }
  const northO: Face = { o: v3(R.finish, Pl.northOuter - R.skin, OY), r: EAST, u: UP, n: NORTH }
  const frontLen = Pl.northOuter - Pl.southOuter, sideLen = Pl.frontOuter - R.finish
  const arch = R.architrave - OY
  const OREG = { course: .11, rail: .17, lowTop: .66, mid: .74, top: arch - .08, arch }
  const PIL = { width: .16, proud: .03, base: .16, capital: .12 }
  const ot = (swing = .07): [number, number, number] => tone(OAK.outside, k++, swing)
  const frameTone = (): [number, number, number] => tone(OAK.outside, k++, .05).map(c => c * .82) as [number, number, number]
  const mould = PANEL_MOULD.map(([x, u]) => [x, u - .0115] as [number, number])
  /** one bay between two pilasters: base course, rails, panels, and where a
   * window stands its sill rail, opening and head rail */
  const bay = (f: Face, a: number, b: number, salt: number, win?: { y0: number; y1: number }): void => {
    if (b - a < .02) return
    // the ground behind the frames, dark where a joint opens onto it
    for (const [y0, y1] of (win ? [[0, win.y0], [win.y1, arch]] : [[0, arch]]) as [number, number][])
      dark.quad([at(f, a, y0, frameZ - .012), at(f, b, y0, frameZ - .012), at(f, b, y1, frameZ - .012), at(f, a, y1, frameZ - .012)], dir(f, 0, 0, 1), [[a, y0], [b, y0], [b, y1], [a, y1]], [1, 1, 1])
    const count = Math.max(1, Math.round((b - a) / .72)), muntin = .07, pw = (b - a - (count - 1) * muntin) / count
    const cols: [number, number][] = Array.from({ length: count }, (_, i) => [a + i * (pw + muntin), a + i * (pw + muntin) + pw])
    for (let i = 1; i < count; i++) O.box(f, cols[i - 1]![1], cols[i]![0], OREG.rail, win ? OREG.mid : OREG.top, panelZ - .004, frameZ, 'y', frameTone(), off(k, salt))
    const rails: [number, number][] = [[OREG.course, OREG.rail], [OREG.lowTop, OREG.mid], [OREG.top, OREG.arch]]
    if (win) rails.push([win.y0 - .06, win.y0], [win.y1, win.y1 + .06])
    for (const [y0, y1] of rails) O.box(f, a, b, y0, y1, panelZ - .004, frameZ, 'x', frameTone(), off(k, salt + 1))
    const panel = (c0: number, c1: number, y0: number, y1: number, raised: boolean): void => {
      if (y1 - y0 < .05) return
      if (raised) O.field(f, c0, c1, y0, y1, panelZ - .004, .008, .05, ot(), off(k, salt + 2))
      else {
        const o = off(k, salt + 3)
        outside.quad([at(f, c0, y0, panelZ), at(f, c1, y0, panelZ), at(f, c1, y1, panelZ), at(f, c0, y1, panelZ)], dir(f, 0, 0, 1),
          [[c0 + o[0], y0 + o[1]], [c1 + o[0], y0 + o[1]], [c1 + o[0], y1 + o[1]], [c0 + o[0], y1 + o[1]]], ot())
      }
      O.frame(f, c0, c1, y0, y1, frameZ, mould, ot(.03), salt * 37 + k)
    }
    for (const [c0, c1] of cols) panel(c0, c1, OREG.rail, OREG.lowTop, false)
    if (win) {
      panel(a, b, OREG.mid, win.y0 - .06, true)
      panel(a, b, win.y1 + .06, OREG.top, true)
    } else for (const [c0, c1] of cols) panel(c0, c1, OREG.mid, OREG.top, true)
    // the base course: a board on the plinth with a round on its top edge
    O.run(f, 'x', 0, 1, frameZ, [[0, 0], [0, .018], [.08, .018], ...quarter(.08, .006, .012, Math.PI / 2, -Math.PI / 2, 4).map(([x, u]) => [Math.min(x, .092), u] as [number, number]), [.11, .004], [.11, 0]], a, b, SQUARE, SQUARE, ot(.03), off(k, salt + 4), [true, true])
  }
  /** a pilaster standing on a face at [a, b]: a base, a shaft with a sunk
   * panel, a capital; `wrap` turns it round the face's end into a corner */
  const pilaster = (f: Face, a: number, b: number, salt: number): void => {
    const z0 = frameZ - .004, zF = frameZ + PIL.proud
    O.box(f, a - .012, b + .012, 0, PIL.base, z0, zF + .012, 'x', ot(.04), off(k, salt))
    O.run(f, 'x', PIL.base, 1, zF, [[0, .012], ...quarter(0, 0, .012, Math.PI / 2, 0, 3).map(([x, u]) => [x, u] as [number, number]), [.016, 0]], a - .012, b + .012, SQUARE, SQUARE, ot(.03), off(k, salt + 1), [true, true])
    const sunk = .042
    O.box(f, a, a + sunk, PIL.base, arch - PIL.capital, z0, zF, 'y', ot(.04), off(k, salt + 2))
    O.box(f, b - sunk, b, PIL.base, arch - PIL.capital, z0, zF, 'y', ot(.04), off(k, salt + 3))
    O.box(f, a + sunk, b - sunk, PIL.base, arch - PIL.capital, z0, zF - .009, 'y', ot(.06), off(k, salt + 4))
    O.frame(f, a + sunk, b - sunk, PIL.base + .05, arch - PIL.capital - .05, zF, [[0, .0005], [.004, -.004], [.009, -.009]], ot(.03), salt * 41 + k)
    O.box(f, a + sunk, b - sunk, PIL.base, PIL.base + .05, zF - .009, zF, 'x', ot(.04), off(k, salt + 5))
    O.box(f, a + sunk, b - sunk, arch - PIL.capital - .05, arch - PIL.capital, zF - .009, zF, 'x', ot(.04), off(k, salt + 6))
    // the capital: a neck, a small ovolo and an abacus, which stays within
    // the footprint's edge, as the base does
    const ys = arch - PIL.capital
    O.box(f, a, b, ys, ys + .045, z0, zF + .003, 'x', ot(.04), off(k, salt + 7))
    O.run(f, 'x', ys + .045, 1, zF + .003, [[0, 0], ...quarter(.012, 0, .012, Math.PI, Math.PI / 2, 4)], a - .003, b + .003, SQUARE, SQUARE, ot(.03), off(k, salt + 8), [true, true])
    O.box(f, a - .012, b + .012, ys + .057, arch, z0, zF + .012, 'x', ot(.04), off(k, salt + 9))
    solids.push(boxOf(f, a - .012, b + .012, 0, arch, z0, zF + .012))
  }
  /** a face's box in the wing's [west, south, bottom, east, north, top] */
  function boxOf(f: Face, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Piece['box'] {
    const p = [at(f, x0, y0, z0), at(f, x1, y1, z1)]
    return [Math.min(p[0]!.x, p[1]!.x), Math.min(-p[0]!.z, -p[1]!.z), Math.min(p[0]!.y, p[1]!.y), Math.max(p[0]!.x, p[1]!.x), Math.max(-p[0]!.z, -p[1]!.z), Math.max(p[0]!.y, p[1]!.y)]
  }
  const pw = PIL.width, cas = R.door.casing
  const doorO0 = Pl.doorSouth - Pl.southOuter, doorO1 = Pl.doorNorth - Pl.southOuter
  // THE FRONT: a corner pilaster, a narrow bay, the doorway between its own
  // pilasters, two bays, the other corner pilaster
  pilaster(frontO, -PIL.proud, pw - PIL.proud, 131)
  bay(frontO, pw - PIL.proud, doorO0 - cas - pw, 133)
  pilaster(frontO, doorO0 - cas - pw, doorO0 - cas, 135)
  pilaster(frontO, doorO1 + cas, doorO1 + cas + pw, 137)
  bay(frontO, doorO1 + cas + pw, frontLen - pw + PIL.proud, 139)
  pilaster(frontO, frontLen - pw + PIL.proud, frontLen + PIL.proud, 141)
  // over the doorway the wall's ground runs from the hood to the architrave
  O.box(frontO, doorO0 - cas, doorO1 + cas, R.door.height + cas + .1, arch, panelZ - .004, frameZ, 'x', ot(), off(k, 143))
  // THE SIDES: a pilaster against the gallery's wall, the bays, the corner's
  // own face; the south side's east bay carries the window
  const winO0 = R.window.west - R.finish, winO1 = Pl.windowEast - R.finish
  pilaster(southO, 0, pw, 145)
  bay(southO, pw, winO0 - .06, 147)
  O.box(southO, winO0 - .06, winO0, OREG.rail, OREG.top, panelZ - .004, frameZ, 'y', ot(), off(k, 149))
  bay(southO, winO0, winO1, 151, { y0: R.window.sill, y1: R.window.head })
  pilaster(southO, sideLen - pw + PIL.proud, sideLen + PIL.proud, 153)
  pilaster(northO, 0, pw, 155)
  bay(northO, pw, sideLen - pw + PIL.proud, 157)
  pilaster(northO, sideLen - pw + PIL.proud, sideLen + PIL.proud, 159)
  // THE WINDOW: an oak sill run out over the rail, a slim casing round the
  // opening, the reveal lined through the wall
  {
    const y0 = R.window.sill, y1 = R.window.head, a = winO0, b = winO1
    O.run(southO, 'x', y0, -1, frameZ, [[0, 0], [0, .03], [.012, .03], [.016, .026], [.03, .012], [.032, 0]], a - .03, b, SQUARE, SQUARE, ot(.03), off(k, 161), [true, false])
    const WIN: Section = [[0, 0], [0, .012], [.04, .012], ...quarter(.04, 0, .012, Math.PI / 2, 0, 3), [.055, 0]]
    const cw = ot(.03)
    O.run(southO, 'y', a, -1, frameZ, WIN, y0, y1, SQUARE, { a: 1, u: 0 }, cw, off(k, 163), [true, false])
    O.run(southO, 'x', y1, 1, frameZ, WIN, a, b, { a: -1, u: 0 }, SQUARE, cw, off(k, 165), [false, true])
    const n0 = Pl.southOuter - BED, n1 = Pl.southInner + BED, w0 = R.window.west, w1 = Pl.windowEast
    const Y0 = R.floor + y0, Y1 = R.floor + y1
    const lining = (box: Piece['box'], grain: Grain): void => { inside.piece({ box, grain, offset: off(k, 167), tone: tone(OAK.wall, k++, .03) }) }
    lining([w0 - .02, n0, Y0 - .02, w0, n1, Y1 + .02], 'up')
    lining([w1, n0, Y0 - .02, w1 + .02, n1, Y1 + .02], 'up')
    lining([w0 - .02, n0, Y0 - .02, w1 + .02, n1, Y0], 'east')
    lining([w0 - .02, n0, Y1, w1 + .02, n1, Y1 + .02], 'east')
  }
  // THE DOOR'S CASING AND HOOD, outside
  {
    const cOut = ot(.03), head = R.door.height
    O.run(frontO, 'y', doorO0, -1, frameZ, CASING, 0, head, SQUARE, { a: 1, u: 0 }, cOut, off(k, 51), [true, false])
    O.run(frontO, 'y', doorO1, 1, frameZ, CASING, 0, head, SQUARE, { a: 1, u: 0 }, cOut, off(k, 52), [true, false])
    O.run(frontO, 'x', head, 1, frameZ, CASING, doorO0, doorO1, { a: -1, u: 0 }, { a: 1, u: 0 }, cOut, off(k, 53))
    O.run(frontO, 'x', head + cas + .1, -1, frameZ, HOOD, doorO0 - cas, doorO1 + cas, SQUARE, SQUARE, ot(.03), off(k, 54), [true, true])
    const out = Pl.frontOuter + .032
    solids.push([Pl.frontOuter - BED, Pl.doorSouth - cas, OY, out, Pl.doorSouth, OY + head + cas])
    solids.push([Pl.frontOuter - BED, Pl.doorNorth, OY, out, Pl.doorNorth + cas, OY + head + cas])
    solids.push([Pl.frontOuter - BED, Pl.doorSouth - cas, OY + head, out, Pl.doorNorth + cas, OY + head + cas])
    solids.push([Pl.frontOuter - BED, Pl.doorSouth - cas, OY + head + cas, Pl.frontOuter + .045 + BED, Pl.doorNorth + cas, OY + head + cas + .1])
  }
  // THE ENTABLATURE AND THE LID: an architrave on the pilasters, a frieze of
  // small raised panels, a cornice with a row of dentils under its corona,
  // run round the three open sides and mitred at the two front corners
  {
    const e0 = R.finish - BED, fr = Pl.frontOuter, zS = Pl.southOuter, zN = Pl.northOuter
    const sF: Face = { o: v3(e0, zS + R.skin, 0), r: EAST, u: UP, n: SOUTH }
    const fF: Face = { o: v3(fr - R.skin, zS, 0), r: NORTH, u: UP, n: EAST }
    const nF: Face = { o: v3(e0, zN - R.skin, 0), r: EAST, u: UP, n: NORTH }
    /** runs along the south side (west to the corner), the front, the north side */
    const round3 = (section: Section, h0: number, salt: number): void => {
      const t = ot(.03), ext: Cut = { a: 0, u: 1 }
      O.run(sF, 'x', h0, 1, R.skin, section, 0, fr - e0, SQUARE, ext, t, off(k, salt))
      O.run(fF, 'x', h0, 1, R.skin, section, 0, zN - zS, { a: 0, u: -1 }, ext, t, off(k, salt + 1))
      O.run(nF, 'x', h0, 1, R.skin, section, 0, fr - e0, SQUARE, ext, t, off(k, salt + 2))
    }
    const archH = R.frieze - R.architrave, friezeH = R.cornice - R.frieze
    round3([[0, 0], [0, .03], [archH * .45, .03], [archH * .45, .038], [archH, .038], [archH, 0]], R.architrave, 61)
    round3([[0, 0], [0, .006], [friezeH, .006], [friezeH, 0]], R.frieze, 65)
    // the frieze's panels, each in a moulded frame, between short muntins
    for (const [f, length, from] of [[sF, fr - e0, pw + .02], [fF, zN - zS, .04], [nF, fr - e0, pw + .02]] as [Face, number, number][]) {
      const y0 = R.frieze + .035, y1 = R.cornice - .035, room = length - from - .04
      const n = Math.max(1, Math.round(room / .42)), w = room / n
      for (let i = 0; i < n; i++) {
        const c0 = from + i * w + .03, c1 = from + (i + 1) * w - .03
        O.field(f, c0, c1, y0, y1, R.skin + .006, .01, .04, ot(.08), off(k, 69))
        O.frame(f, c0, c1, y0, y1, R.skin + .006 + .012, [[0, 0], [.004, -.006], [.01, -.012]], ot(.03), 71 + k)
      }
    }
    // the cornice: a bed mould, the dentils' band, the corona and a cyma
    // crown; nothing passes the footprint's edge, fifty millimetres out
    const cH = R.top - R.cornice
    const CORNICE: Section = [
      [0, 0], [0, .006], [.004, .014], [.012, .019], [.022, .0215], [.03, .022],
      [.1, .022], [.1, .046], [.2, .046], [.2, .04], [.22, .041], [.24, .045], [.26, .049], [.28, .05], [cH, .05], [cH, 0],
    ]
    round3(CORNICE, R.cornice, 71)
    // the dentils: small blocks in a row under the corona, round the corners
    const dentil = (box: Piece['box']): void => { outside.piece({ box, grain: 'up', offset: off(k, 75), tone: ot(.05) }) }
    const pitch = .05, dw = .028, lo = R.cornice + .052, hi = R.cornice + .096
    for (let x = e0 + .03; x < fr - .02; x += pitch) {
      dentil([x, zS - .042, lo, x + dw, zS - .018, hi])
      dentil([x, zN + .018, lo, x + dw, zN + .042, hi])
    }
    for (let n = zS + .02; n < zN - .03; n += pitch) dentil([fr + .018, n, lo, fr + .042, n + dw, hi])
    // the lid's top over all of it
    outside.piece({ box: [e0, R.south + .03, R.top - .02, R.front - .03, R.north - .03, R.top], grain: 'east', offset: off(k, 79), tone: ot(0) })
    // the walls' heads, closed under the lid
    dark.piece({ box: [e0, zS, R.coffer + .002, fr, zN, R.top - .02], grain: 'east', offset: [0, 0], tone: [1, 1, 1] })
    solids.push([e0, R.south, R.architrave, R.front, R.north, R.top])
  }
  // the three outer walls as solids for the walk's proof, the window open
  {
    const s0 = R.south + R.setBack - .012, s1 = R.south + R.setBack + R.sideWall, w0 = R.window.west, w1 = Pl.windowEast
    solids.push([R.finish - BED, s0, OY, w0, s1, R.architrave])
    solids.push([w1, s0, OY, Pl.frontOuter + .03, s1, R.architrave])
    solids.push([w0 - .03, Pl.southOuter - .032, OY, w1, s1, OY + R.window.sill])
    solids.push([w0 - .055, s0, OY + R.window.head, w1, s1, R.architrave])
  }
  solids.push([R.finish - BED, R.north - R.setBack - R.sideWall, OY, Pl.frontOuter + .03, R.north - R.setBack + .012, R.architrave])
  solids.push([Pl.frontInner, R.south + R.setBack, OY, Pl.frontOuter + .03, Pl.doorSouth, R.architrave])
  solids.push([Pl.frontInner, Pl.doorNorth, OY, Pl.frontOuter + .03, R.north - R.setBack, R.architrave])

  // ---------------------------------------------------------------- ceiling
  // THE COFFERED CEILING: a rim over the cornice, a grid of oak beams inside
  // it, and in each coffer a raised panel in a moulded frame
  {
    const reach = .245, e0 = Pl.back + reach, e1 = Pl.frontInner - reach, n0 = Pl.southInner + reach, n1 = Pl.northInner - reach
    const rim = (box: Piece['box'], grain: Grain): void => { ceiling.piece({ box, grain, offset: off(k, 101), tone: tone(OAK.ceiling, k++, .04) }) }
    rim([Pl.backGround, Pl.southInner - BED, R.ceiling, Pl.frontInner + BED, n0, R.coffer], 'east')
    rim([Pl.backGround, n1, R.ceiling, Pl.frontInner + BED, Pl.northInner + BED, R.coffer], 'east')
    rim([Pl.backGround, n0, R.ceiling, e0, n1, R.coffer], 'north')
    rim([e1, n0, R.ceiling, Pl.frontInner + BED, n1, R.coffer], 'north')
    const across = e1 - e0, along = n1 - n0, cols = 3, rows = 6, beam = .065
    const cw = (across - (cols - 1) * beam) / cols, rh = (along - (rows - 1) * beam) / rows
    for (let i = 1; i < cols; i++) {
      const x = e0 + i * cw + (i - 1) * beam
      ceiling.piece({ box: [x, n0, R.ceiling, x + beam, n1, R.coffer], grain: 'north', offset: off(k, 103), tone: tone(OAK.ceiling, k++, .05) })
    }
    for (let j = 1; j < rows; j++) {
      const y = n0 + j * rh + (j - 1) * beam
      for (let i = 0; i < cols; i++) {
        const x = e0 + i * (cw + beam)
        ceiling.piece({ box: [x, y, R.ceiling + .002, x + cw, y + beam, R.coffer], grain: 'east', offset: off(k, 105), tone: tone(OAK.ceiling, k++, .05) })
      }
    }
    // each coffer's panel over the beams, seen from under: the face looks down
    const down: Face = { o: v3(e0, n0, R.coffer), r: EAST, u: NORTH, n: new Vector3(0, -1, 0) }
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x0 = i * (cw + beam), x1 = x0 + cw, y0 = j * (rh + beam), y1 = y0 + rh
      C.field(down, x0, x1, y0, y1, 0, .012, .05, tone(OAK.coffer, k++, .06), off(k, 107))
      C.frame(down, x0, x1, y0, y1, 0, [[0, .016], [.004, .012], [.009, .007], [.013, .003], [.016, 0]], tone(OAK.ceiling, k++, .03), 109 + k)
    }
    solids.push([Pl.back, Pl.southInner, R.ceiling, Pl.frontInner, Pl.northInner, R.coffer])
    // the cornice's reach round the room, under the rim
    const low = R.floor + REG.cornice - .23
    solids.push([Pl.back, Pl.southInner, low, Pl.frontInner, n0, R.ceiling])
    solids.push([Pl.back, n1, low, Pl.frontInner, Pl.northInner, R.ceiling])
    solids.push([Pl.back, n0, low, e0, n1, R.ceiling])
    solids.push([e1, n0, low, Pl.frontInner, n1, R.ceiling])
  }
  return { inside, outside, ceiling, dark, bronze, solids }
}

/** THE TABLE'S TOP as the table builds it (2.8 by 2 m, 45 mm thick, centred
 * 25 mm toward the visitor and 27 mm under the table's datum), turned so its
 * depth runs east: [west, south, bottom, east, north, top]. */
export const TABLE_TOP = [T.east - .975, T.north - 1.4, T.top - .0495, T.east + 1.025, T.north + 1.4, T.top - .0045] as const

const CHAIR = {
  width: .46, depth: .42, seat: .44, cushion: .05, rail: { bottom: .69, height: .075, radius: .55, thickness: .022 },
  leg: { foot: .013, top: .018, inset: .025 },
} as const
/** The crest rail is bent with its hollow to the sitter, so its two ends reach
 * this far toward the table past its crown (the bevel included): they are
 * what meets the table's edge when the chair is pushed in. */
const RAIL_ENDS = ((): number => {
  const { radius, thickness } = CHAIR.rail
  const end = Math.asin((CHAIR.width / 2 - CHAIR.leg.inset + .02) / radius)
  return radius - (radius - thickness) * Math.cos(end) + .003
})()

/** THE BOOKCASE against the north wall: a low open case of the wall's oak,
 * its two shelves holding the reference volumes a reading room keeps beside
 * a facsimile. Modern bindings, no titles and no period claim. */
export const BOOKCASE = {
  west: -38.05, east: -36.85,
  /** its back a bed into the north wall's panelling */
  north: Pl.northInner + BED, depth: .3,
  height: .8, board: .025, plinth: .06, shelves: [.08, .43],
} as const
const BOOKCASE_SPAN = [BOOKCASE.west, BOOKCASE.east] as const

/** Cloth and leather bindings, linear, muted under one warm lamp. */
const BINDINGS = ['#5a2a22', '#33402f', '#4b3625', '#7a5c32', '#2a3038', '#6b4a36', '#8f7d5c', '#40302a']

export function bookcasePieces(): { oak: Piece[]; books: Piece[] } {
  const B = BOOKCASE, oak: Piece[] = [], books: Piece[] = []
  const s = B.north - B.depth, floor = R.floor, top = floor + B.height
  const board = (box: Piece['box'], grain: Grain, i: number): void => {
    oak.push({ box, grain, offset: [hash(i, 51) * 1.83, hash(i, 52) * 1.83], tone: toned(OAK.wall, 20 + i, 3, .04) })
  }
  // the carcass: two ends, a top, the shelves, a plinth set back
  board([B.west, s, floor + B.plinth, B.west + B.board, B.north, top - B.board], 'up', 0)
  board([B.east - B.board, s, floor + B.plinth, B.east, B.north, top - B.board], 'up', 1)
  board([B.west, s, top - B.board, B.east, B.north, top], 'east', 2)
  B.shelves.forEach((level, i) => board([B.west + B.board, s, floor + level, B.east - B.board, B.north, floor + level + B.board], 'east', 3 + i))
  board([B.west + .03, s + .04, floor, B.east - .03, B.north, floor + B.plinth], 'east', 5)
  // THE VOLUMES, set a finger back from the shelf's edge, a gap here and there
  B.shelves.forEach((level, shelf) => {
    const base = floor + level + B.board, room = (shelf === 0 ? B.shelves[1]! : B.height - B.board) - level - B.board
    let e = B.west + B.board + .01, i = 0
    while (true) {
      const k = shelf * 97 + i++
      const thick = .018 + hash(k, 61) * .034, tall = Math.min(room - .012, .2 + hash(k, 62) * .12)
      if (e + thick > B.east - B.board - .01) break
      if (hash(k, 63) < .07) { e += .04 + hash(k, 64) * .08; continue }
      const deep = .15 + hash(k, 65) * .07, front = s + .015 + hash(k, 66) * .01
      books.push({ box: [e, front, base, e + thick, front + deep, base + tall], grain: 'up', offset: [hash(k, 67), -base],
        tone: toned(BINDINGS[Math.floor(hash(k, 68) * BINDINGS.length)]!, k, 69, .08) })
      e += thick + .0015
    }
  })
  return { oak, books }
}

/** THE READER'S CHAIR, drawn up to the book: oak, a leather seat, a bent
 * crest rail. It stands as a chair pushed in stands: the rail stops a finger
 * short of the top's edge, which it rises past, and the seat runs on under
 * the top. A modern chair of the museum's own. */
export const READING_CHAIR = {
  north: T.north,
  /** the crest rail's crown, its ends a finger clear of the table's edge */
  back: TABLE_TOP[3] + .012 + RAIL_ENDS,
  ...CHAIR,
} as const

/** The chair's parts, each a geometry already in the wing's place, with the
 * box it stands in. */
export function chairParts(): { oak: BufferGeometry[]; leather: BufferGeometry[]; boxes: [number, number, number, number, number, number][] } {
  const C = READING_CHAIR, floor = R.floor, n0 = C.north
  const oak: BufferGeometry[] = [], leather: BufferGeometry[] = [], boxes: [number, number, number, number, number, number][] = []
  const tone = (g: BufferGeometry, i: number): BufferGeometry => {
    const [r, gg, b] = toned(OAK.chair, i, 31, .04)
    const count = g.getAttribute('position').count, data = new Float32Array(count * 3)
    for (let k = 0; k < count; k++) { data[k * 3] = r; data[k * 3 + 1] = gg; data[k * 3 + 2] = b }
    g.setAttribute('pieceTone', new Float32BufferAttribute(data, 3))
    return g
  }
  // A TURNED LEG between two points, tapering to its foot, its grain along it.
  const leg = (from: Vector3, to: Vector3, rFoot: number, rTop: number, i: number): void => {
    const length = from.distanceTo(to)
    const g = new CylinderGeometry(rTop, rFoot, length, 20, 1)
    const uvs = g.getAttribute('uv')
    for (let k = 0; k < uvs.count; k++) uvs.setXY(k, uvs.getX(k) * Math.PI * (rTop + rFoot) + i * .37, uvs.getY(k) * length + i * .61)
    const axis = to.clone().sub(from).normalize()
    g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis))
    g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2)
    oak.push(tone(g, i))
    const r = Math.max(rFoot, rTop)
    boxes.push([Math.min(from.x, to.x) - r, Math.min(-from.z, -to.z) - r, Math.min(from.y, to.y), Math.max(from.x, to.x) + r, Math.max(-from.z, -to.z) + r, Math.max(from.y, to.y)])
  }
  const half = C.width / 2 - C.leg.inset
  const rearE = C.back - .05, frontE = rearE - (C.depth - .06)
  const railTop = floor + C.rail.bottom + C.rail.height
  let i = 0
  for (const side of [-1, 1]) {
    // the rear leg runs on up as the post the crest rail sits on, its tenon
    // ending inside the rail
    leg(v3(rearE, n0 + side * half, floor), v3(rearE, n0 + side * half, floor + C.rail.bottom + .035), C.leg.foot, C.leg.top * .92, i++)
    leg(v3(frontE, n0 + side * half, floor), v3(frontE, n0 + side * half, floor + C.seat - .04), C.leg.foot, C.leg.top, i++)
    // the side stretcher, low, front leg to rear leg
    leg(v3(frontE, n0 + side * half, floor + .15), v3(rearE, n0 + side * half, floor + .17), .008, .008, i++)
  }
  // the rear stretcher, a hand higher than the side ones
  leg(v3(rearE, n0 - half, floor + .21), v3(rearE, n0 + half, floor + .21), .008, .008, i++)
  // THE SEAT FRAME: four rails under the cushion
  const rail = (w: number, s: number, b: number, e: number, n: number, t: number): void => {
    const g = new BoxGeometry(e - w, t - b, n - s)
    const uvs = g.getAttribute('uv')
    for (let k = 0; k < uvs.count; k++) uvs.setXY(k, uvs.getX(k) * .4 + i * .29, uvs.getY(k) * .4 + i * .53)
    g.translate((w + e) / 2, (b + t) / 2, -(s + n) / 2)
    oak.push(tone(g, i++))
    boxes.push([w, s, b, e, n, t])
  }
  const frameB = floor + C.seat - .045, frameT = floor + C.seat
  rail(frontE - .012, n0 - half - .012, frameB, rearE + .012, n0 - half + .012, frameT)
  rail(frontE - .012, n0 + half - .012, frameB, rearE + .012, n0 + half + .012, frameT)
  rail(frontE - .012, n0 - half, frameB, frontE + .012, n0 + half, frameT)
  rail(rearE - .012, n0 - half, frameB, rearE + .012, n0 + half, frameT)
  // THE CUSHION: leather over a thin pad, dropped in between the posts
  const seatWidth = 2 * (half - C.leg.top) - .004, seatDepth = rearE - frontE - C.leg.top - .004
  const cushion = new RoundedBoxGeometry(seatDepth + .012, C.cushion, seatWidth, 3, .012)
  cushion.translate(frontE + (seatDepth + .012) / 2 - .012, frameT + C.cushion / 2, -n0)
  leather.push(cushion)
  boxes.push([frontE - .02, n0 - C.width / 2, frameT, rearE + .01, n0 + C.width / 2, frameT + C.cushion])
  // THE CREST RAIL, bent in plan, its convex face to the room
  const centreE = C.back - C.rail.radius
  const end = Math.asin((half + .02) / C.rail.radius)
  const shape = new Shape()
  shape.absarc(centreE, n0, C.rail.radius, -end, end, false)
  shape.absarc(centreE, n0, C.rail.radius - C.rail.thickness, end, -end, true)
  shape.closePath()
  const bevel = .004
  const crest = new ExtrudeGeometry(shape, { depth: C.rail.height - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: .003, bevelSegments: 2, curveSegments: 40 })
  crest.rotateX(-Math.PI / 2)
  crest.translate(0, floor + C.rail.bottom + bevel, 0)
  // the photograph's grain runs along the rail: on its faces the read is
  // turned, on its top and bottom the plan's own north already runs along it
  const cuv = crest.getAttribute('uv')
  const sides = crest.groups.find(g => g.materialIndex === 1)
  for (let k = 0; k < cuv.count; k++) {
    const side = sides !== undefined && k >= sides.start && k < sides.start + sides.count
    if (side) cuv.setXY(k, cuv.getY(k) + .41, cuv.getX(k) + .87)
    else cuv.setXY(k, cuv.getX(k) + .41, cuv.getY(k) + .87)
  }
  oak.push(tone(crest, i++))
  boxes.push([centreE + (C.rail.radius - C.rail.thickness) * Math.cos(end) - .005, n0 - C.width / 2 - .01, floor + C.rail.bottom, C.back + .004, n0 + C.width / 2 + .01, railTop + .001])
  return { oak, leather, boxes }
}

/** The rectangle every solid of the room stands in, for the certificate's
 * supplement: [west, south, bottom, east, north, top] per box. */
export function readingRoomSolids(): { name: string; box: [number, number, number, number, number, number] }[] {
  const body = studioloParts(), shelf = bookcasePieces()
  const out = body.solids.map((box, i) => ({ name: `studiolo-${i}`, box }))
  shelf.oak.forEach((q, i) => out.push({ name: `bookcase-${i}`, box: q.box }))
  shelf.books.forEach((q, i) => out.push({ name: `book-${i}`, box: q.box }))
  const r = SHADE.radius + .004
  out.push({ name: 'pendant-shade', box: [READING_LAMP.east - r, READING_LAMP.north - r, READING_LAMP.rim - .004, READING_LAMP.east + r, READING_LAMP.north + r, READING_LAMP.rim + SHADE.height + .05] })
  out.push({ name: 'pendant-cord', box: [READING_LAMP.east - .01, READING_LAMP.north - .01, READING_LAMP.rim + SHADE.height, READING_LAMP.east + .01, READING_LAMP.north + .01, R.ceiling] })
  out.push({ name: 'pendant-cup', box: [READING_LAMP.east - .06, READING_LAMP.north - .06, R.ceiling - .1 - .038, READING_LAMP.east + .06, READING_LAMP.north + .06, R.ceiling] })
  chairParts().boxes.forEach((box, i) => out.push({ name: `chair-${i}`, box }))
  return out
}
