/** THE READING ROOM'S PLAN: where every board, leaf, rod and rail of the
 * room stands, in the wing's own metres, and the chair drawn up to the table.
 * Pure geometry and numbers: the room's mount (`reading-room.ts`) dresses and
 * lights it, and the certificate's supplement (`reading-room-check.mjs`)
 * proves every box of it clear of the walk.
 */
import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute,
  Quaternion, Shape, Vector3,
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

/** THE ROOM IN THE WING'S METRES (east, north, height). The niche's south
 * edge keeps clear of the body wall's sheet that stands apart, its north edge
 * stops at the hall door's jamb, and its front stops short of the date line's
 * field. South of the niche the oak runs on as a dado and the room's floor
 * under that sheet, the dado's top a hand under the sheet's carrier. */
export const READING_ROOM = {
  /** the gallery lining's face, which the panelling is fixed to */
  wall: FACE.hallPartitionEast + .033,
  south: -48.30,
  north: OPENING.hallToGallery.north[0] - .02,
  /** the dado and the floor run this far south */
  dadoSouth: -49.45,
  dadoTop: FLOOR + 1.85,
  /** the east edge of the room's floor, the canopy over it and the return that
   * closes the niche against the hall door: the walk to that door passes it
   * with a quarter of a metre to spare beyond its certified envelope */
  front: -36.35,
  /** the north return's thickness */
  returnWall: .04,
  /** the room's floor finish, the building's sealed concrete over the stone */
  floor: FLOOR + .003,
  /** the canopy's underside */
  ceiling: FLOOR + 2.66,
  /** the panelling: battens, then the veneered board */
  batten: .012, panel: .024,
  /** the shadow gaps: under the panels, over them, and between them */
  baseGap: .03, headGap: .03, joint: .006,
  /** seven panels, one of them centred on the book */
  panels: 7,
} as const
const R = READING_ROOM

/** THE LAMP: its place, its aim and the level it is asked to reach at the
 * page, from which its candela follows. A modern warm reading lamp. */
export const READING_LAMP = {
  east: T.east, north: T.north,
  /** the shade's rim, sixty centimetres over the table top */
  rim: T.top + .61,
  /** a 2700 K lamp as the print shows it, balanced like the sun outdoors */
  colour: '#ffd3a0',
  /** at the page, in lux; the stack reads one hundred lux as one */
  lux: 315,
  /** an opal disc under a dome: a cosine lobe, cut at the rim */
  angle: 1.45, penumbra: 1, reach: 4.5,
  mapPx: 2048, soft: 2.5,
} as const

/** The layer only this room's lamp casts from: no eye and no sun sees it. */
export const READING_SHADOW_LAYER = 4

/** The shade, in its own metres: radius and height over the rim. */
export const SHADE = { radius: .165, height: .17, fitter: .026 }

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
    const cross = c[1]!.clone().sub(c[0]!).cross(c[2]!.clone().sub(c[0]!))
    const order = cross.dot(normal) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]
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

/** THE OAK, oiled, the museum's own (the walls near 0.17): the room is dark
 * by its light, not by its wood, so the walls still hold an eighth of the
 * page's brightness under one lamp. */
export const OAK = { wall: '#8a6846', canopy: '#7f6042', chair: '#7a5a3b' }

export function oakPieces(): { oak: Piece[]; dark: Piece[]; bronze: Piece[]; floor: Piece[] } {
  const oak: Piece[] = [], dark: Piece[] = [], bronze: Piece[] = [], floor: Piece[] = []
  const faceE = R.wall + R.batten + R.panel
  // THE PANELS. Seven book-matched leaves of one flitch; the pitch is set so
  // the leaf behind the book is centred on it, and its joints frame the page.
  const width = (R.north - R.south) / R.panels
  const bottom = R.floor + R.baseGap, top = R.ceiling - R.headGap
  const leaf = (i: number, s: number, n: number, top: number): Piece => {
    // a leaf and its neighbour share their read, mirrored across the joint
    const pair = Math.floor(i / 2), w = n - s + R.joint
    return {
      box: [R.wall + R.batten, s, bottom, faceE, n, top], grain: 'up',
      offset: [hash(pair, 1) * 1.83 - (i % 2 === 1 ? w : 0), hash(pair, 2) * 1.83], mirror: i % 2 === 1,
      tone: toned(OAK.wall, pair, 3, .05),
    }
  }
  for (let i = 0; i < R.panels; i++)
    oak.push(leaf(i, R.south + i * width + R.joint / 2, R.south + (i + 1) * width - R.joint / 2, top))
  // the dado: two more leaves of the flitch, at the dado's own height
  const dadoWidth = (R.south - R.dadoSouth) / 2
  for (let i = 0; i < 2; i++)
    oak.push(leaf(R.panels + 1 + i, R.dadoSouth + i * dadoWidth + R.joint / 2, R.dadoSouth + (i + 1) * dadoWidth - R.joint / 2, R.dadoTop))
  // the backing the joints and the gaps read against, run a bed into the lining
  dark.push({ box: [R.wall - BED, R.south, FLOOR - BED, R.wall + R.batten, R.north, R.ceiling + .01], grain: 'up', offset: [0, 0], tone: [1, 1, 1] })
  dark.push({ box: [R.wall - BED, R.dadoSouth, FLOOR - BED, R.wall + R.batten, R.south, R.dadoTop], grain: 'up', offset: [0, 0], tone: [1, 1, 1] })
  // OAK LIPPINGS close the panelling's open ends, so no end shows its layers
  const lip = .012
  oak.push({ box: [R.wall - BED, R.south - lip, R.floor, faceE, R.south, R.ceiling], grain: 'up', offset: [.3, .2], tone: toned(OAK.wall, 9, 3, 0) })
  oak.push({ box: [R.wall - BED, R.dadoSouth - lip, R.floor, faceE, R.dadoSouth, R.dadoTop], grain: 'up', offset: [.6, .5], tone: toned(OAK.wall, 9, 3, 0) })
  // THE NORTH RETURN closes the niche against the hall door: three leaves of
  // the flitch on its inner face, oak on its outer, its end lipped.
  const retS = R.north - R.returnWall, returnLength = R.front - faceE
  for (let i = 0; i < 3; i++) {
    const w = faceE - BED + i * returnLength / 3 + (i ? R.joint / 2 : 0), e = faceE + (i + 1) * returnLength / 3 - (i < 2 ? R.joint / 2 : 0)
    oak.push({ box: [w, retS, R.floor + R.baseGap, e, retS + R.panel, R.ceiling - R.headGap], grain: 'up',
      offset: [hash(i, 41) * 1.83, hash(i, 42) * 1.83], mirror: i % 2 === 1, tone: toned(OAK.wall, 10 + i, 3, .05) })
  }
  // its dark core shows in the joints and gaps; its outer skin is one board
  dark.push({ box: [faceE - BED, retS + R.panel - BED, R.floor - BED, R.front - lip, R.north - .012 + BED, R.ceiling + BED], grain: 'up', offset: [0, 0], tone: [1, 1, 1] })
  oak.push({ box: [faceE - BED, R.north - .012, R.floor - BED, R.front - lip, R.north, R.ceiling + BED], grain: 'up', offset: [.9, .3], tone: toned(OAK.wall, 14, 3, 0) })
  oak.push({ box: [R.front - lip, retS, R.floor - BED, R.front - .002, R.north, R.ceiling - .06 + BED], grain: 'up', offset: [1.2, .7], tone: toned(OAK.wall, 15, 3, 0) })
  // THE FLOOR is the building's own, the mechanism hall's sealed concrete in
  // its bays, laid a few millimetres over the old stone; the room's oak stands
  // on it. One slab: its bays and saw cuts are the material's.
  floor.push({ box: [R.wall - BED, R.dadoSouth, FLOOR - BED, R.front, R.north, R.floor], grain: 'east', offset: [0, 0], tone: [1, 1, 1] })
  // A bronze edge frames the room's floor on its three open sides, two
  // millimetres proud: the reading room's threshold on the building's floor.
  bronze.push({ box: [R.front, R.dadoSouth - .026, FLOOR - BED, R.front + .026, R.north, R.floor + .002], grain: 'north', offset: [0, 0], tone: [1, 1, 1] })
  bronze.push({ box: [R.wall - BED, R.dadoSouth - .026, FLOOR - BED, R.front, R.dadoSouth, R.floor + .002], grain: 'east', offset: [0, 0], tone: [1, 1, 1] })
  bronze.push({ box: [R.wall - BED, R.north, FLOOR - BED, R.front + .026, R.north + .026, R.floor + .002], grain: 'east', offset: [0, 0], tone: [1, 1, 1] })
  // THE CANOPY. The ceiling the lamp hangs from, veneered underneath in the
  // wall's own flitch; its two open edges carry a downstand fascia, and the
  // north return carries its third.
  const slab = .05, fascia = .11, band = .03
  oak.push({ box: [R.wall - BED, R.south + band, R.ceiling, R.front - band, R.north + BED, R.ceiling + slab], grain: 'east', offset: [.4, .9], tone: toned(OAK.canopy, 0, 21, 0) })
  oak.push({ box: [R.front - band, R.south, R.ceiling + slab - fascia, R.front, R.north + BED, R.ceiling + slab], grain: 'north', offset: [.2, 1.1], tone: toned(OAK.canopy, 1, 21, .03) })
  oak.push({ box: [faceE, R.south, R.ceiling + slab - fascia, R.front - band, R.south + band, R.ceiling + slab], grain: 'east', offset: [1.1, .3], tone: toned(OAK.canopy, 2, 21, .03) })
  // four bronze rods hang the canopy's front from the gallery's own soffit
  const soffit = -1.95
  for (const n of [R.south + .25, R.north - .25]) for (const e of [R.front - .18, (R.wall + R.front) / 2]) {
    bronze.push({ box: [e - .006, n - .006, R.ceiling + slab, e + .006, n + .006, soffit + BED], grain: 'up', offset: [0, 0], tone: [1, 1, 1] })
  }
  return { oak, dark, bronze, floor }
}

/** THE READER'S CHAIR, drawn up to the book: oak, a leather seat, a bent
 * crest rail, pushed in until its back touches the table's edge. A modern
 * chair of the museum's own. */
export const READING_CHAIR = {
  north: T.north,
  /** the crest rail's outer face, a finger clear of the table's edge */
  back: T.east + 1.025 + .023,
  width: .46, depth: .42, seat: .44, cushion: .05, rail: { bottom: .69, height: .075, radius: .55, thickness: .022 },
  leg: { foot: .013, top: .018, inset: .025 },
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
  const { oak, dark, bronze, floor } = oakPieces()
  const out = [...oak, ...dark, ...bronze, ...floor].map((q, i) => ({ name: `piece-${i}`, box: q.box }))
  const r = SHADE.radius + .004
  out.push({ name: 'pendant-shade', box: [READING_LAMP.east - r, READING_LAMP.north - r, READING_LAMP.rim - .004, READING_LAMP.east + r, READING_LAMP.north + r, READING_LAMP.rim + SHADE.height + .05] })
  out.push({ name: 'pendant-cord', box: [READING_LAMP.east - .01, READING_LAMP.north - .01, READING_LAMP.rim + SHADE.height, READING_LAMP.east + .01, READING_LAMP.north + .01, R.ceiling] })
  chairParts().boxes.forEach((box, i) => out.push({ name: `chair-${i}`, box }))
  return out
}
