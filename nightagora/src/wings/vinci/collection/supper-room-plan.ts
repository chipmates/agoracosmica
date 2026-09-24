/** THE SUPPER ROOM, IN THE WING'S OWN METRES (east, north, height): the room
 * the Last Supper's measured field stands at the end of, sized to the field
 * first and to the court second. Pure geometry and numbers: `supper-room.ts`
 * dresses and lights it, `supper-room-check.mjs` proves every triangle of it
 * clear of the walk. The display wall itself is certified construction and is
 * never touched here: the room is built round it and over it. A modern room;
 * nothing here claims the refectory in Milan, whose own dimensions this
 * museum does not have.
 */
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three/webgpu'
import { COURT, SUPPER_WALL } from './layout'

export const SUPPER_ROOM_PROVENANCE = {
  manifestId: 'vinci/collection-supper-room',
  assetClass: 'GENERATED',
  certainty: 'reconstructed',
} as const

export type P3 = [east: number, north: number, height: number]
export const v3 = (e: number, n: number, h: number): Vector3 => new Vector3(e, h, -n)

const S = SUPPER_WALL, L = COURT.level

/** THE FIELD AND ITS REVEAL, read off the display wall: the band stands
 * proud round the field and is what throws the field's own shadow. */
export const FIELD = {
  face: S.east + S.thickness / 2,
  south: S.north - S.field.width / 2,
  north: S.north + S.field.width / 2,
  bottom: L + S.field.sill,
  top: L + S.field.sill + S.field.height,
  /** the band's own width round the field and how far it stands proud */
  band: .22,
  proud: .12,
} as const

/** The reproduction is contained in the field at its own aspect and is not
 * cropped (its record refuses a crop), so bare field shows either side. */
export const IMAGE = { south: -33.641, north: -25.359 } as const

/** Where the grave's backdrop side wall ends, east along the court's south
 * edge (its module mounts it; the checker proves the number). */
export const GRAVE_BACKDROP_END = -40.85

/** THE COLLECTION'S NORTH FACE, which is the room's south side up to its
 * roof: the glazing's outer line, and the roof's overhang, its underside and
 * its top at the overhang's edge. Declared here, proved by the checker. */
export const ENVELOPE_NORTH = { glass: -34.04, face: -33.91, overhang: -33.3, soffit: -1.65, top: -1.45 } as const

/** THE ROOM, in two volumes. THE BAY is the field's own room: as wide as the
 * display wall is long, as deep as the court leaves before the parachute's
 * cloth, and tall, lit from over its south wall by a top light the way in
 * never shows. THE NAVE is the way in: lower, narrower, open on the court to
 * the north, closed to the east but for the walk's own door. The eye stands
 * in the nave and sees the field in its lit bay beyond (MUSEUM-ARCH C1, C2). */
export const ROOM = {
  west: FIELD.face,
  /** the east wall's inner face: clear of the walk that turns along it */
  east: -31.3,
  eastWall: .38,
  /** the room's south wall face over the collection's roof */
  south: -33.95,
  /** the bay's own south wall, down to the floor: before the grave's
   * backdrop, whose side wall runs along the court's south edge into the bay
   * with its bands out to -33.70, and clear of the reproduction's own edge */
  baySouth: -33.69,
  /** the bay's north side: the display wall's own north end */
  north: -24.47,
  /** the nave's north side, clear of the cloth's lowest edge in plan */
  naveNorth: -27.25,
  /** the bay's east face, where the nave meets it */
  step: -41.3,
  /** the wall over the nave that closes the bay above it */
  stepWall: .42,
  floor: L,
  baySoffit: L + 7.4,
  bayTop: L + 7.86,
  naveSoffit: L + 5.3,
  naveTop: L + 5.72,
} as const

/** THE EAST OPENING: the walk turns north and south just inside the east
 * edge of the court, and the balls that certify its turns reach a metre round
 * them, so the east wall is open between them and closed only either side. */
export const DOOR = { south: -32.4, north: -28.55, head: L + 3.05 } as const

/** THE TOP LIGHT: a skylight over the bay's south half, glazed over and
 * closed under by a diffuser a hand under the soffit. From the nave it stands
 * above the step and is never seen: the field is lit from its upper left. */
export const TOP_LIGHT = {
  south: ROOM.baySouth + .02, north: -31.2,
  /** set off the wall, so it washes the field and not the plaster over it */
  west: ROOM.west + 1.2, east: ROOM.step - .16,
  diffuser: ROOM.baySoffit - .06,
} as const

/** THE NORTH SIDE: a wall down to a long low opening, the court's afternoon
 * seen as one band at a standing eye. Its head stands over what every close
 * look from inside frames: the crane's and the weather instruments' from the
 * bay, the parachute's from the nave. */
export const BEAMS = {
  depth: .42,
  bayFoot: L + 3.05,
  naveFoot: L + 3.2,
} as const

/** THE STONE SILL at the field's foot, certified with the display wall. */
export const SILL = { west: FIELD.face, east: FIELD.face + .84, south: FIELD.south, north: FIELD.north, top: L + .44 } as const
/** The wall's base course, also the display wall's. */
export const BASE_COURSE = { east: S.east + (S.thickness + .14) / 2, top: L + .22 } as const

export type SupperLightKind = 'area'
/** Which volume's surfaces a light reaches: the bay's (and the field), the
 * nave's, or both. An area light casts no shadow, so a light is handed only
 * to the surfaces it can actually see. */
export type SupperReceivers = 'bay' | 'nave' | 'both'
export interface SupperLight {
  name: string
  kind: SupperLightKind
  receivers: SupperReceivers
  /** the middle of the opening */
  at: P3
  aim: P3
  kelvin: number
  /** the opening's luminance */
  intensity: number
  width: number
  height: number
}

/** THE ROOM'S LIGHT, AS DATA: the top light's diffuser, the sky over the
 * field's left; and the open north side, the afternoon on the court coming in
 * low and warm from the right. */
export const SUPPER_LIGHTS: readonly SupperLight[] = [
  {
    name: 'top-light', kind: 'area', receivers: 'bay',
    at: [(TOP_LIGHT.west + TOP_LIGHT.east) / 2, (TOP_LIGHT.south + TOP_LIGHT.north) / 2, TOP_LIGHT.diffuser - .01],
    aim: [(TOP_LIGHT.west + TOP_LIGHT.east) / 2, (TOP_LIGHT.south + TOP_LIGHT.north) / 2, L],
    kelvin: 6200, intensity: 16,
    width: TOP_LIGHT.east - TOP_LIGHT.west, height: TOP_LIGHT.north - TOP_LIGHT.south,
  },
  {
    // the bay as the nave sees it: its lit wall and floor through the step
    name: 'bay-portal', kind: 'area', receivers: 'nave',
    at: [ROOM.step + .01, (ROOM.south + ROOM.naveNorth) / 2, (L + ROOM.naveSoffit) / 2],
    aim: [ROOM.east, (ROOM.south + ROOM.naveNorth) / 2, (L + ROOM.naveSoffit) / 2],
    kelvin: 5600, intensity: .6,
    width: ROOM.naveNorth - ROOM.south, height: ROOM.naveSoffit - L,
  },
  {
    name: 'north-opening', kind: 'area', receivers: 'nave',
    at: [(ROOM.step + ROOM.stepWall + ROOM.east) / 2, ROOM.naveNorth, (L + BEAMS.naveFoot) / 2],
    aim: [(ROOM.step + ROOM.stepWall + ROOM.east) / 2, ROOM.south, (L + BEAMS.naveFoot) / 2 - .5],
    kelvin: 4300, intensity: .5,
    width: ROOM.east - ROOM.step - ROOM.stepWall, height: BEAMS.naveFoot - L,
  },
  {
    name: 'bay-opening', kind: 'area', receivers: 'bay',
    at: [(ROOM.west + ROOM.step) / 2, ROOM.north, (L + BEAMS.bayFoot) / 2],
    aim: [(ROOM.west + ROOM.step) / 2, ROOM.south, (L + BEAMS.bayFoot) / 2 - .5],
    kelvin: 4300, intensity: .3,
    width: ROOM.step - ROOM.west, height: BEAMS.bayFoot - L,
  },
]

/** Where the room's bounce is read: the middle of the nave, at a standing eye. */
export const PROBE_AT: P3 = [-43.2, -29.5, L + 2.4]
/** and the nave's, halfway down it */
export const NAVE_PROBE_AT: P3 = [-36.6, -30.6, L + 1.9]

/* ---- geometry ---------------------------------------------------------- */

export interface Rect { west: number; south: number; east: number; north: number }
/** [west, south, bottom, east, north, top] */
export type Box = [number, number, number, number, number, number]

/** A welded body: positions, normals and metre UVs, plus the boxes it was
 * built from for the clearance proof. */
export class Body {
  private p: number[] = []
  private n: number[] = []
  private u: number[] = []
  readonly boxes: Box[] = []
  quad(a: P3, b: P3, c: P3, d: P3, facing: P3): void {
    const w = (q: P3): Vector3 => v3(q[0], q[1], q[2])
    const v = [w(a), w(b), w(c), w(d)]
    const normal = v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).normalize()
    const want = w(facing).normalize()
    const flip = normal.dot(want) < 0
    if (flip) normal.negate()
    const flat = Math.abs(want.y) > .5, alongNorth = Math.abs(want.x) > .5
    const uv = (q: P3): [number, number] => flat ? [q[0], q[1]] : alongNorth ? [q[1], q[2]] : [q[0], q[2]]
    const corners = [a, b, c, d]
    for (const i of flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) {
      this.p.push(v[i]!.x, v[i]!.y, v[i]!.z)
      this.n.push(normal.x, normal.y, normal.z)
      this.u.push(...uv(corners[i]!))
    }
  }
  /** a face at one east, looking east (1) or west (-1) */
  northSouth(east: number, facing: 1 | -1, south: number, north: number, low: number, high: number): void {
    if (north - south < .001 || high - low < .001) return
    this.quad([east, south, low], [east, north, low], [east, north, high], [east, south, high], [facing, 0, 0])
  }
  /** a face at one north, looking north (1) or south (-1) */
  eastWest(north: number, facing: 1 | -1, west: number, east: number, low: number, high: number): void {
    if (east - west < .001 || high - low < .001) return
    this.quad([west, north, low], [east, north, low], [east, north, high], [west, north, high], [0, facing, 0])
  }
  level(r: Rect, height: number, facing: 1 | -1): void {
    if (r.east - r.west < .001 || r.north - r.south < .001) return
    this.quad([r.west, r.south, height], [r.east, r.south, height], [r.east, r.north, height], [r.west, r.north, height], [0, 0, facing])
  }
  /** a closed box; `open` names the faces left off (they lie against another body) */
  box(b: Box, open: readonly ('w' | 'e' | 's' | 'n' | 'b' | 't')[] = []): void {
    const [w, s, lo, e, n, hi] = b
    this.boxes.push(b)
    if (!open.includes('w')) this.northSouth(w, -1, s, n, lo, hi)
    if (!open.includes('e')) this.northSouth(e, 1, s, n, lo, hi)
    if (!open.includes('s')) this.eastWest(s, -1, w, e, lo, hi)
    if (!open.includes('n')) this.eastWest(n, 1, w, e, lo, hi)
    if (!open.includes('b')) this.level({ west: w, south: s, east: e, north: n }, lo, -1)
    if (!open.includes('t')) this.level({ west: w, south: s, east: e, north: n }, hi, 1)
  }
  get triangles(): number { return this.p.length / 9 }
  positions(): readonly number[] { return this.p }
  geometry(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3))
    g.setAttribute('uv', new Float32BufferAttribute(this.u, 2))
    g.computeBoundingBox(); g.computeBoundingSphere()
    return g
  }
}

/** Runs of a span with gaps cut out of it. */
function runs(from: number, to: number, gaps: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = []
  let cursor = from
  for (const [a, b] of [...gaps].sort((x, y) => x[0] - y[0])) {
    if (a > cursor) out.push([cursor, Math.min(a, to)])
    cursor = Math.max(cursor, b)
  }
  if (cursor < to) out.push([cursor, to])
  return out
}

/** How far the room's plaster stands proud of the band's own front, so no
 * face of it shares a plane with the certified wall. */
const SKIN = .006
/** the plaster's face on the end wall */
export const END_FACE = FIELD.face + FIELD.proud + SKIN

/** THE END WALL, IN PLASTER: one plane at the band's front round the field,
 * so the field sits in a reveal cut into a plastered wall, and the reveal's
 * four faces lined back to the field. It runs from the room's south wall to
 * the display wall's north end, from the floor (the sill's top where the sill
 * stands before it) to the bay's soffit. */
export function endWall(): { plaster: Body; reveal: Body } {
  const plaster = new Body(), reveal = new Body(), F = FIELD, x = END_FACE
  const top = ROOM.baySoffit
  plaster.northSouth(x, 1, ROOM.baySouth, F.south, ROOM.floor, top)
  plaster.northSouth(x, 1, F.north, ROOM.north, ROOM.floor, top)
  plaster.northSouth(x, 1, F.south, F.north, SILL.top, F.bottom)
  plaster.northSouth(x, 1, F.south, F.north, F.top, top)
  // THE REVEAL, a hair inside the band's own faces, from the field to the plaster
  const inset = .003, back = F.face + .0012
  reveal.quad([back, F.south + inset, F.bottom], [x, F.south + inset, F.bottom], [x, F.south + inset, F.top], [back, F.south + inset, F.top], [0, 1, 0])
  reveal.quad([back, F.north - inset, F.bottom], [x, F.north - inset, F.bottom], [x, F.north - inset, F.top], [back, F.north - inset, F.top], [0, -1, 0])
  reveal.quad([back, F.south, F.top - inset], [x, F.south, F.top - inset], [x, F.north, F.top - inset], [back, F.north, F.top - inset], [0, 0, -1])
  reveal.quad([back, F.south, F.bottom + inset], [x, F.south, F.bottom + inset], [x, F.north, F.bottom + inset], [back, F.north, F.bottom + inset], [0, 0, 1])
  return { plaster, reveal }
}

/** THE WALL OVER THE DISPLAY WALL'S COPING, up to the bay's roof: a solid,
 * so the room is closed at its end from the court behind it. */
export function upperEndWall(): Body {
  const b = new Body()
  const coping = L + S.height + .16 - .004
  // its east face is the plaster's own plane, which the end wall carries
  b.box([S.east - S.thickness / 2 - .09, ROOM.south, coping, END_FACE - .02, ROOM.north, ROOM.bayTop], ['e'])
  return b
}

/** THE SOUTH WALL, over the collection's own roof: it stands on that roof, a
 * bed into it, and rises to the bay's roof and to the nave's. */
export function southWall(): Body {
  const b = new Body()
  // the bay's: a thin leaf before the glazing up to the collection's roof,
  // the collection's overhang passing through it, then the wall to the roof
  b.box([ROOM.west - .06, ROOM.baySouth - .03, ROOM.floor - .02, GRAVE_BACKDROP_END + .05, ROOM.baySouth, ENVELOPE_NORTH.soffit], ['t'])
  b.box([ROOM.west - .5, ROOM.south - .4, ENVELOPE_NORTH.top - .012, ROOM.step, ROOM.baySouth, ROOM.bayTop])
  b.box([ROOM.step, ROOM.south - .4, ENVELOPE_NORTH.top - .012, ROOM.east + ROOM.eastWall, ROOM.south, ROOM.naveTop], ['w'])
  return b
}

/** THE ROOFS: the bay's, with the top light's slot cut along its south side,
 * its well lined, glass over it, the diffuser under it; the nave's, lower. */
export function roof(): { slab: Body; well: Body; diffuser: Body; glass: Body } {
  const slab = new Body(), well = new Body(), diffuser = new Body(), glass = new Body()
  const T = TOP_LIGHT, lo = ROOM.baySoffit, hi = ROOM.bayTop
  // the bay: round the slot
  slab.box([ROOM.west - .5, T.north, lo, ROOM.step + ROOM.stepWall, ROOM.north, hi])
  slab.box([ROOM.west - .5, ROOM.south, lo, T.west, T.north, hi], ['n', 's'])
  slab.box([T.east, ROOM.south, lo, ROOM.step + ROOM.stepWall, T.north, hi], ['n', 's'])
  // the diffuser's skirt, from the soffit down to its own plane
  well.eastWest(T.north, -1, T.west, T.east, T.diffuser, lo)
  well.eastWest(T.south, 1, T.west, T.east, T.diffuser, lo)
  well.northSouth(T.west, 1, T.south, T.north, T.diffuser, lo)
  well.northSouth(T.east, -1, T.south, T.north, T.diffuser, lo)
  diffuser.level({ west: T.west, south: T.south, east: T.east, north: T.north }, T.diffuser, -1)
  glass.level({ west: T.west - .05, south: T.south, east: T.east + .05, north: T.north + .05 }, hi + .04, 1)
  // THE STEP: the bay's east wall over the nave's roof and across its open
  // north side, down to the nave's soffit
  slab.box([ROOM.step, ROOM.south, ROOM.naveSoffit, ROOM.step + ROOM.stepWall, ROOM.north, lo + .002], ['t'])
  // the nave
  slab.box([ROOM.step + ROOM.stepWall, ROOM.south, ROOM.naveSoffit, ROOM.east + ROOM.eastWall, ROOM.naveNorth, ROOM.naveTop], ['w'])
  return { slab, well, diffuser, glass }
}

/** THE BEAMS UNDER THE OPEN EDGES and the east wall with the walk's door. */
export function frame(): Body {
  const b = new Body(), D = BEAMS.depth
  // the bay's north lintel, from the display wall's end to the step
  b.box([ROOM.west - .5, ROOM.north - D, BEAMS.bayFoot, ROOM.step, ROOM.north, ROOM.baySoffit + .002], ['t'])
  // the nave's north beam, from the step to the east wall
  b.box([ROOM.step + ROOM.stepWall, ROOM.naveNorth, BEAMS.naveFoot, ROOM.east, ROOM.naveNorth + D, ROOM.naveSoffit + .002], ['t'])
  // the east wall, closed but for the door the walk leaves by
  const E = ROOM.east, W = ROOM.eastWall, top = ROOM.naveSoffit + .002
  b.box([E, ROOM.south, ROOM.floor - .02, E + W, DOOR.south, top], ['t'])
  b.box([E, DOOR.north, ROOM.floor - .02, E + W, ROOM.naveNorth + D, top], ['t'])
  b.box([E, DOOR.south, DOOR.head, E + W, DOOR.north, top], ['t'])
  return b
}

/** THE NAVE'S SOUTH SIDE: fins of plaster before the collection's glazing,
 * close enough that the way in reads them as one ribbed wall and the room
 * behind the glass still looks out between them. */
export const FINS = { west: GRAVE_BACKDROP_END + .18, east: ROOM.east - .2, pitch: .3, thick: .07, back: -33.88, front: -33.43, head: ENVELOPE_NORTH.soffit - .04 } as const
export function fins(): Body {
  const b = new Body(), F = FINS
  for (let at = F.west; at <= F.east + 1e-6; at += F.pitch)
    b.box([at - F.thick / 2, F.back, ROOM.floor + FLOOR_RISE - .004, at + F.thick / 2, F.front, F.head])
  return b
}

/** THE FLOOR: the room's own finish over the court's paving, raised a step
 * over the leaves the court holds, round the sill and the display wall's base
 * course. */
export const FLOOR_RISE = .07
export function floorPlan(): Rect[] {
  const b = BASE_COURSE.east + .004
  return [
    { west: SILL.east + .004, south: ROOM.baySouth, east: ROOM.step, north: ROOM.north },
    { west: ROOM.step, south: ROOM.south, east: ROOM.east, north: ROOM.naveNorth },
    // either side of the sill, against the base course
    { west: b, south: ROOM.baySouth, east: SILL.east + .004, north: SILL.south - .004 },
    { west: b, south: SILL.north + .004, east: SILL.east + .004, north: ROOM.north },
  ]
}
export function floor(): Body {
  const b = new Body(), h = ROOM.floor + FLOOR_RISE
  for (const r of floorPlan()) b.level(r, h, 1)
  // the finish's own edge where the room is open, a step of stone
  const lo = ROOM.floor - .004
  b.eastWest(ROOM.north, 1, BASE_COURSE.east + .004, ROOM.step, lo, h)
  b.eastWest(ROOM.naveNorth, 1, ROOM.step, ROOM.east, lo, h)
  b.northSouth(ROOM.step, 1, ROOM.naveNorth, ROOM.north, lo, h)
  b.northSouth(ROOM.east + ROOM.eastWall, 1, DOOR.south, DOOR.north, lo, h)
  b.level({ west: ROOM.east, south: DOOR.south, east: ROOM.east + ROOM.eastWall, north: DOOR.north }, h, 1)
  return b
}

/** THE SILL, dressed: its top and its three open faces in stone, a hair proud. */
export function sillDress(): Body {
  const b = new Body(), e = .004, lo = ROOM.floor + FLOOR_RISE - .002
  b.level({ west: SILL.west + .02, south: SILL.south - e, east: SILL.east + e, north: SILL.north + e }, SILL.top + e, 1)
  b.northSouth(SILL.east + e, 1, SILL.south - e, SILL.north + e, lo, SILL.top + e)
  b.eastWest(SILL.south - e, -1, SILL.west + .02, SILL.east + e, lo, SILL.top + e)
  b.eastWest(SILL.north + e, 1, SILL.west + .02, SILL.east + e, lo, SILL.top + e)
  return b
}

/** Every solid the room stands, for the clearance proof: the checker builds
 * these bodies and holds their own triangles to the walk. */
export function supperRoomBodies(): Record<string, Body> {
  const { plaster, reveal } = endWall()
  const { slab, well, diffuser, glass } = roof()
  return {
    'end-wall': plaster, reveal, 'upper-end-wall': upperEndWall(), 'south-wall': southWall(),
    roof: slab, well, diffuser, glass, frame: frame(), fins: fins(), floor: floor(), sill: sillDress(),
  }
}

export { runs }

/** True where an eye (three's frame) stands in the supper room or at its
 * door: the reach the field's full plate is raised from. */
export function supperRoomHolds(eye: { x: number; z: number }): boolean {
  const e = eye.x, n = -eye.z
  return e > ROOM.west && e < ROOM.east + 1.5 && n > ROOM.south - .1 && n < ROOM.north + .5
}
