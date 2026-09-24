/** THE GALLERY OF THE LIFE, IN THE WING'S OWN METRES (east, north, height):
 * where its finish lies over the certified construction, where its benches,
 * tracks and heads stand, and every light and opening as data. Pure geometry
 * and numbers: `line-gallery.ts` dresses and lights it, and
 * `line-gallery-check.mjs` proves every solid of it clear of the walk. A
 * modern room; nothing here claims a building of 1517.
 */
import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three/webgpu'
import { FACE, FLOOR, LINE_FIELD, LINE_ORIGIN, OPENING, ROOMS } from './layout'
import { lineCutStuds } from '../line/studs'
import { READING_ROOM_DOOR, READING_ROOM_FOOTPRINT, READING_THRESHOLD } from './reading-room-plan'

export const LINE_GALLERY_PROVENANCE = {
  manifestId: 'vinci/collection-line-gallery',
  assetClass: 'GENERATED',
  certainty: 'reconstructed',
} as const

const G = ROOMS.gallery
export type P3 = [east: number, north: number, height: number]
export const v3 = (e: number, n: number, h: number): Vector3 => new Vector3(e, h, -n)

/** The structure's bay, which the soffit's ribs stand on. */
const BAY = 4
const ribsAlong = (from: number, to: number): number[] => {
  const out: number[] = []
  for (let at = Math.ceil(from / BAY) * BAY; at < to; at += BAY) out.push(at)
  return out
}

/** THE ROOM'S OWN LINES, read off the construction it is laid over. */
export const GALLERY = {
  west: G.west, east: G.east, south: G.south, north: G.north,
  /** a wall's finish stands this far in front of its structural face: past
   * the lining, its ribs and its base band, as in the mechanism hall */
  proud: .045,
  /** the shadow gap between a wall's finish and the floor */
  gap: .055,
  /** the lining's head, under the dark band recessed up to the soffit */
  head: -2.10,
  headSouth: -2.14,
  /** a door's stone head, over which the finish closes up to the soffit */
  lintel: -2.24,
  soffit: -1.95,
  ribFoot: -2.14,
  rib: .28,
  ribsEast: ribsAlong(G.west, G.east),
  ribsNorth: ribsAlong(G.south, G.north),
  /** the building's floor finish, three millimetres over the stone */
  floor: FLOOR + .003,
  /** the south cross wall and where it stops short of the glass */
  crossNorth: FACE.southStripNorth,
  crossWest: G.west + .1,
  crossEast: -22.8,
} as const

/** THE LINE'S OWN FIELD: the limestone the dates are cut into, and the
 * building's concrete round it. */
export const FIELD = { west: LINE_FIELD.west, east: LINE_FIELD.east, north: LINE_FIELD.north, south: G.south } as const

/** THE READING ROOM'S FLOOR, its plinth, laid by its own module over this
 * patch: the gallery's finish leaves the patch to it once that room stands. */
export const READING_ROOM_FLOOR = { west: G.west, east: READING_ROOM_FOOTPRINT.east, south: READING_ROOM_FOOTPRINT.south, north: READING_ROOM_FOOTPRINT.north } as const

/** THE WINDOW, as an opening: the glazed east wall between the dark sill and
 * the soffit, facing west into the room. */
export const WINDOW = {
  east: FACE.glazingEast + .012,
  south: G.south, north: G.north,
  bottom: FLOOR + .42, top: -1.95,
  /** the room it lights lies to the west */
  facing: [-1, 0, 0] as P3,
} as const

/** THE DATES THE FLOOR CARRIES, where each is cut: the twelve sockets. */
export const DATES = lineCutStuds(LINE_ORIGIN)
/** A date's own middle: the socket, its year beside it and its word. */
export const DATE_MIDDLE_EAST = LINE_ORIGIN.east + .5

/** THE LINE'S TRACK: a black channel under the ribs, a stride east of the
 * dates, hung between the ribs on rods. */
export const TRACK = {
  east: LINE_ORIGIN.east + 1.25,
  south: DATES[0]!.north - .6,
  north: DATES[DATES.length - 1]!.north + .75,
  width: .034, depth: .036,
} as const
/** where the last head hangs, at the track's north end */
const TRACK_END = TRACK.north - .1
/** A head's lamp face stands this far under its track. */
const DROP = .3

/** THE FAR WALL'S WASH: a linear slot let into the soffit a little off the
 * wall, its lens flush with the concrete, the whole run of the wall that
 * the line points at. */
export const WASH_SLOT = { north: G.north - .72, west: -37.9, east: -25.1, width: .09 } as const

/** The layer only the gallery's shadowed lights draw their maps from: no eye
 * sees it, and no other light's map is drawn from it. */
export const GALLERY_SHADOW_LAYER = 5

export type GalleryLightKind = 'spot' | 'area' | 'sky'
/** Which surfaces take a light: the line's own stones, the floor and what
 * stands on it as well, or the whole room. */
export type GalleryReceivers = 'line' | 'floor' | 'room'
export interface GalleryLight {
  name: string
  kind: GalleryLightKind
  /** the lamp face, or the middle of the opening */
  at: P3
  aim: P3
  kelvin: number
  /** candela for a spot, the opening's luminance for an area */
  intensity: number
  angle?: number
  penumbra?: number
  reach?: number
  /** an area's width along the opening and its height */
  width?: number
  height?: number
  /** hung from a track head; an opening has none */
  head: boolean
  receivers: GalleryReceivers
  /** a map drawn from the gallery's own casters: its size, the filter's
   * radius in texels, and for daylight the half-extent it covers (m) */
  shadow?: { mapPx: number; soft: number; span?: [number, number] }
}

/** A head on the line's track, hung over a date. */
const overDate = (north: number): P3 => [TRACK.east, north, GALLERY.ribFoot - TRACK.depth - DROP]

/** THE DAYLIGHT THROUGH THE GLASS: the bright sky and the sunlit house to
 * the east, read as one parallel source low over the garden, so the glazing
 * lays a patch on the floor cut by its posts, its sill and the benches. */
const SKY = { elevation: 48, fromSouth: 24, on: [-24.6, -52.9] as [number, number], distance: 40 } as const
const skyFrom = (): P3 => {
  const e = SKY.elevation * Math.PI / 180, a = SKY.fromSouth * Math.PI / 180
  const [east, north] = SKY.on
  return [east + Math.cos(e) * Math.cos(a) * SKY.distance, north - Math.cos(e) * Math.sin(a) * SKY.distance, FLOOR + Math.sin(e) * SKY.distance]
}

/** THE GALLERY'S LIGHT, AS DATA: one table builds both the fittings and the
 * lights. North daylight through the east glass is the key; each date stands
 * in its own warm pool from a head on the track over the line; a linear slot
 * lays a warm wash down the far wall, the end of the walk. */
export const GALLERY_LIGHTS: readonly GalleryLight[] = [
  {
    name: 'window', kind: 'area', head: false, receivers: 'room',
    at: [WINDOW.east, (WINDOW.south + WINDOW.north) / 2, (WINDOW.bottom + WINDOW.top) / 2],
    aim: [WINDOW.east - 10, (WINDOW.south + WINDOW.north) / 2, (WINDOW.bottom + WINDOW.top) / 2],
    width: WINDOW.north - WINDOW.south, height: WINDOW.top - WINDOW.bottom,
    kelvin: 6800, intensity: 1.3,
  },
  ...DATES.map((date, i): GalleryLight => ({
    name: `date-${String(i + 1).padStart(2, '0')}`, kind: 'spot', head: true, receivers: 'line',
    at: overDate(date.north), aim: [DATE_MIDDLE_EAST, date.north, FLOOR],
    kelvin: 3400, intensity: 22, angle: .2, penumbra: .55, reach: 7,
  })),
  {
    name: 'sky', kind: 'sky', head: false, receivers: 'floor',
    at: skyFrom(), aim: [SKY.on[0], SKY.on[1], FLOOR],
    kelvin: 5600, intensity: 1.5, shadow: { mapPx: 2048, soft: 10, span: [20, 14] },
  },
  {
    // THE LINE'S LAST HEAD TURNS TO THE WALL: the end of the walk is a warm
    // pool over the bench on the line's own axis, lit from the line's track
    name: 'end', kind: 'spot', head: true, receivers: 'room',
    at: overDate(TRACK_END), aim: [LINE_ORIGIN.east, G.north, FLOOR + 1.15],
    kelvin: 3400, intensity: 22, angle: .42, penumbra: .9, reach: 6,
  },
  {
    // THE READING ROOM'S DOORWAY AS AN OPENING: the lit room seen through it
    // lays its warm light on the floor before it, as the glass lays the day's
    name: 'reading-door', kind: 'area', head: false, receivers: 'floor',
    at: [READING_ROOM_DOOR.east + .004, READING_ROOM_DOOR.north, (READING_ROOM_DOOR.bottom + READING_ROOM_DOOR.top) / 2],
    aim: [READING_ROOM_DOOR.east + 10, READING_ROOM_DOOR.north, (READING_ROOM_DOOR.bottom + READING_ROOM_DOOR.top) / 2],
    width: READING_ROOM_DOOR.width, height: READING_ROOM_DOOR.height,
    kelvin: 2900, intensity: .35,
  },
  {
    // THE READING ROOM'S THRESHOLD: the downlight in its doorway's head (the
    // room builds the fitting) pools on the floor before the door
    name: 'reading-threshold', kind: 'spot', head: false, receivers: 'floor',
    at: READING_THRESHOLD.at, aim: READING_THRESHOLD.aim,
    kelvin: READING_THRESHOLD.kelvin, intensity: READING_THRESHOLD.candela,
    angle: READING_THRESHOLD.angle, penumbra: READING_THRESHOLD.penumbra, reach: READING_THRESHOLD.reach,
  },
  {
    name: 'wash', kind: 'area', head: false, receivers: 'room',
    at: [(WASH_SLOT.west + WASH_SLOT.east) / 2, WASH_SLOT.north, GALLERY.soffit - .012],
    aim: [(WASH_SLOT.west + WASH_SLOT.east) / 2, G.north + .3, FLOOR + 1],
    width: WASH_SLOT.east - WASH_SLOT.west, height: WASH_SLOT.width,
    kelvin: 3200, intensity: 46,
  },
]

/** Where the room's bounce is taken: the middle of the gallery at eye height. */
export const PROBE_AT: P3 = [LINE_ORIGIN.east, (G.south + G.north) / 2, FLOOR + 1.6]

/** THE BENCHES: solid oiled oak on a recessed dark base. One in each of
 * three bays of the glass, where a visitor sits to look at the house, and a
 * long one against the far wall where the line ends, to sit and look back
 * down the life. Each is a plan rectangle; its length runs along its axis. */
export const BENCH = { depth: .46, seat: FLOOR + .45, top: .07, base: .05 } as const
export const BENCHES: readonly Rect[] = [
  ...[-58, -54, -50].map(north => ({ west: G.east - .1 - BENCH.depth, east: G.east - .1, south: north - 1.6, north: north + 1.6 })),
  { west: LINE_ORIGIN.east - 2.8, east: LINE_ORIGIN.east + 2.8, south: G.north - .045 - .06 - BENCH.depth, north: G.north - .045 - .06 },
]

// ---------------------------------------------------------------- geometry

export type Rect = { west: number; south: number; east: number; north: number }

/** THE BUILDING'S FLOOR ROUND THE LINE: every rectangle of the gallery's
 * floor outside the line's field, and apart from them the reading room's
 * patch, which that room lays itself once it stands. */
export function floorRects(): { floor: Rect[]; patch: Rect } {
  const F = FIELD, R = READING_ROOM_FLOOR
  return {
    floor: [
      { west: G.west, south: G.south, east: F.west, north: R.south },
      { west: G.west, south: R.north, east: F.west, north: G.north },
      { west: R.east, south: R.south, east: F.west, north: R.north },
      { west: F.east, south: G.south, east: G.east, north: G.north },
      { west: F.west, south: F.north, east: F.east, north: G.north },
    ],
    patch: { west: R.west, south: R.south, east: R.east, north: R.north },
  }
}

/** A skin: quads in the wing's frame with UVs in metres, wound to face out.
 * `u` runs along the face (east, or north on an east-facing face), `v` up it;
 * on a floor or a soffit `u` is east and `v` north. */
export class Skin {
  private p: number[] = []
  private n: number[] = []
  private u: number[] = []
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
  /** a face across the room at one north, from `low` to `high` */
  eastWest(north: number, facing: 1 | -1, west: number, east: number, low: number, high: number): void {
    if (east - west < .001 || high - low < .001) return
    this.quad([west, north, low], [east, north, low], [east, north, high], [west, north, high], [0, facing, 0])
  }
  northSouth(east: number, facing: 1 | -1, south: number, north: number, low: number, high: number): void {
    if (north - south < .001 || high - low < .001) return
    this.quad([east, south, low], [east, north, low], [east, north, high], [east, south, high], [facing, 0, 0])
  }
  /** a level face, looking up or down */
  level(r: Rect, height: number, facing: 1 | -1): void {
    if (r.east - r.west < .001 || r.north - r.south < .001) return
    this.quad([r.west, r.south, height], [r.east, r.south, height], [r.east, r.north, height], [r.west, r.north, height], [0, 0, facing])
  }
  get triangles(): number { return this.p.length / 9 }
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

/** THE WALLS: board-formed concrete over the lining, stopped over the floor
 * by a shadow gap with a dark back, closed over each door up to the soffit. */
export function wallSkins(): { walls: Skin; backing: Skin } {
  const walls = new Skin(), backing = new Skin(), X = GALLERY
  const low = FLOOR + X.gap, recess = .02, gapTop = FLOOR + X.gap + .004
  // the west wall, the hall's partition, between its two doors
  const west = X.west + X.proud
  const hallDoor = OPENING.hallToGallery.north, southDoor = OPENING.hallToSouth.north
  walls.northSouth(west, 1, southDoor[1], hallDoor[0], low, X.head)
  backing.northSouth(west - recess, 1, southDoor[1], hallDoor[0], FLOOR, gapTop)
  walls.northSouth(west, 1, hallDoor[0], hallDoor[1], X.lintel, X.soffit)
  // the far wall, the picture room's partition, open at its door
  const north = X.north - X.proud, door = OPENING.pictureToGallery.east
  for (const [a, b] of runs(X.west, X.east, [[door[0], door[1]]])) {
    walls.eastWest(north, -1, a, b, low, X.head)
    backing.eastWest(north + recess, -1, a, b, FLOOR, gapTop)
  }
  walls.eastWest(north, -1, door[0], X.east, X.lintel, X.soffit)
  // the cross wall at the room's south end
  const south = X.crossNorth + X.proud
  walls.eastWest(south, 1, X.crossWest, X.crossEast, low, X.headSouth)
  backing.eastWest(south - recess, 1, X.crossWest, X.crossEast, FLOOR, gapTop)
  walls.northSouth(X.crossEast + .004, 1, X.crossNorth - .18, south, low, X.headSouth)
  return { walls, backing }
}

/** THE SOFFIT AND ITS RIBS: the same concrete, a skin five millimetres under
 * the plaster and round each rib, the ribs of one direction stopped where
 * they cross the other so no two faces share a plane. */
export function ceilingSkin(): Skin {
  const s = new Skin(), X = GALLERY, skin = .005, half = X.rib / 2 + skin
  const foot = X.ribFoot - skin
  const west = X.west + X.proud, east = X.east
  const south = X.crossNorth + X.proud, north = X.north - X.proud
  s.level({ west, south: X.south, east, north }, X.soffit - skin, -1)
  for (const r of X.ribsNorth) {
    s.eastWest(r - half, -1, west, east, foot, X.soffit - skin)
    s.eastWest(r + half, 1, west, east, foot, X.soffit - skin)
    s.level({ west, south: r - half, east, north: r + half }, foot, -1)
  }
  for (const e of X.ribsEast) {
    s.northSouth(e - half, -1, south, north, foot, X.soffit - skin)
    s.northSouth(e + half, 1, south, north, foot, X.soffit - skin)
    for (const [a, b] of runs(south, north, X.ribsNorth.map(r => [r - half, r + half] as const)))
      s.level({ west: e - half, south: a, east: e + half, north: b }, foot, -1)
  }
  return s
}

/** THE FLOOR: the building's sealed concrete round the line's field, the
 * reading room's patch apart, and a bronze edge where the field begins. */
export function floorSkins(): { floor: Skin; patch: Skin; edge: Solid } {
  const floor = new Skin(), patch = new Skin(), edge = new Solid(), rects = floorRects()
  for (const r of rects.floor) floor.level(r, GALLERY.floor, 1)
  patch.level(rects.patch, GALLERY.floor, 1)
  const F = FIELD, half = .014, low = FLOOR - .002, high = GALLERY.floor + .0015
  edge.box([F.west - half, F.south, low, F.west + half, F.north + half, high])
  edge.box([F.east - half, F.south, low, F.east + half, F.north + half, high])
  edge.box([F.west + half, F.north - half, low, F.east - half, F.north + half, high])
  return { floor, patch, edge }
}

/** Boxes and turned parts in the wing's frame, with UVs in metres. */
export type Box = [west: number, south: number, bottom: number, east: number, north: number, top: number]
export class Solid {
  readonly parts: BufferGeometry[] = []
  /** every part's own extent, for the certificate's supplement */
  readonly bounds: Box[] = []
  /** a timber solid carries which way its grain runs, per vertex: 1 east, 0 north */
  constructor(private readonly grained = false) {}
  box(b: Box, grainEast = false): void {
    const [w, s, lo, e, n, hi] = b
    if (e - w <= 0 || n - s <= 0 || hi - lo <= 0) return
    const g = new BoxGeometry(e - w, hi - lo, n - s)
    // metres on every face: a box's own uv is 0..1 per face
    const uv = g.getAttribute('uv'), normal = g.getAttribute('normal')
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i))
      const width = nx > .5 ? n - s : e - w, height = ny > .5 ? n - s : hi - lo
      uv.setXY(i, uv.getX(i) * width, uv.getY(i) * height)
    }
    g.translate((w + e) / 2, (lo + hi) / 2, -(s + n) / 2)
    const flat = g.toNonIndexed(); g.dispose()
    if (this.grained) flat.setAttribute('grain', new Float32BufferAttribute(new Float32Array(flat.getAttribute('position').count).fill(grainEast ? 1 : 0), 1))
    this.parts.push(flat)
    this.bounds.push(b)
  }
  /** a cylinder of `radius` from `a` to `b` */
  rod(a: P3, b: P3, radius: number, sides = 12, radiusB = radius, open = false): void {
    const A = v3(...a), B = v3(...b), axis = B.clone().sub(A), length = axis.length()
    if (length < 1e-6) return
    const g = new CylinderGeometry(radiusB, radius, length, sides, 1, open)
    const turn = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis.clone().normalize())
    g.applyMatrix4(new Matrix4().compose(A.clone().add(B).multiplyScalar(.5), turn, new Vector3(1, 1, 1)))
    this.parts.push(g.index ? g.toNonIndexed() : g)
    const r = Math.max(radius, radiusB)
    this.bounds.push([Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r,
      Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r])
  }
  get empty(): boolean { return this.parts.length === 0 }
}

/** A HEAD: the adaptor in its track, a stem, a yoke, a can with a finned
 * back and a hood along the aim, and the lamp face a hand inside the hood. */
function head(metal: Solid, lens: Solid, at: P3, aim: P3, trackFoot: number): void {
  const face = v3(...at), target = v3(...aim)
  const axis = target.clone().sub(face).normalize()
  const pivot = face.clone().addScaledVector(axis, -.1)
  const wing = (p: Vector3): P3 => [p.x, -p.z, p.y]
  metal.box([at[0] - .03, at[1] - .025, trackFoot - .06, at[0] + .03, at[1] + .025, trackFoot])
  metal.rod([at[0], at[1], trackFoot - .06], [pivot.x, -pivot.z, pivot.y + .085], .009, 10)
  // the yoke: a crossbar and two cheeks either side of the can
  const across = new Vector3().crossVectors(axis, new Vector3(0, 1, 0))
  if (across.lengthSq() < 1e-6) across.set(1, 0, 0)
  across.normalize()
  const bar = pivot.clone().add(new Vector3(0, .085, 0))
  metal.rod(wing(bar.clone().addScaledVector(across, -.075)), wing(bar.clone().addScaledVector(across, .075)), .006, 8)
  for (const side of [-1, 1]) {
    const cheek = pivot.clone().addScaledVector(across, side * .072)
    metal.rod(wing(cheek.clone().add(new Vector3(0, .085, 0))), wing(cheek), .006, 8)
  }
  const along = (offset: number): P3 => wing(pivot.clone().addScaledVector(axis, offset))
  metal.rod(along(-.095), along(.095), .058, 24)
  metal.rod(along(-.16), along(-.095), .05, 24)
  for (let fin = 0; fin < 3; fin++) metal.rod(along(-.108 - fin * .018), along(-.104 - fin * .018), .056, 24)
  metal.rod(along(.095), along(.155), .06, 24, .066, true)
  lens.rod(along(.096), along(.1), .05, 24)
}

/** THE FITTINGS: the line's track on its rods, every head on it, the far
 * wall's slot, and the lamp faces apart. */
export function fittings(): { metal: Solid; lenses: Solid } {
  const metal = new Solid(), lenses = new Solid(), X = GALLERY
  const trackFoot = X.ribFoot - TRACK.depth
  metal.box([TRACK.east - TRACK.width / 2, TRACK.south, trackFoot, TRACK.east + TRACK.width / 2, TRACK.north, X.ribFoot])
  // rods down from the soffit wherever the track is not under a rib
  for (let n = Math.ceil(TRACK.south); n < TRACK.north; n += 2) {
    if (X.ribsNorth.some(r => Math.abs(r - n) < .5)) continue
    metal.rod([TRACK.east, n, X.soffit], [TRACK.east, n, X.ribFoot], .005, 8)
  }
  // the wash's slot: a dark housing a hand wide, its lens a hair under the soffit
  const W = WASH_SLOT
  metal.box([W.west - .02, W.north - W.width / 2 - .02, X.soffit - .012, W.east + .02, W.north + W.width / 2 + .02, X.soffit + .001])
  lenses.box([W.west, W.north - W.width / 2, X.soffit - .014, W.east, W.north + W.width / 2, X.soffit - .011])
  for (const light of GALLERY_LIGHTS) if (light.head) head(metal, lenses, light.at, light.aim, trackFoot)
  return { metal, lenses }
}

/** THE BENCHES: an oak top over a solid oak body set back under it, on a
 * dark base set back again, so the bench meets the floor in a shadow. */
export function benches(): { oak: Solid; base: Solid } {
  const oak = new Solid(true), base = new Solid(), B = BENCH
  for (const r of BENCHES) {
    const alongNorth = r.north - r.south > r.east - r.west
    // an inset across the bench and one along it
    const inset = (across: number, along: number): [number, number, number, number] => alongNorth
      ? [r.west + across, r.south + along, r.east - across, r.north - along]
      : [r.west + along, r.south + across, r.east - along, r.north - across]
    const [bw, bs, be, bn] = inset(.1, .16)
    base.box([bw, bs, GALLERY.floor - .001, be, bn, FLOOR + B.base])
    const [ow, os, oe, on] = inset(.045, .08)
    oak.box([ow, os, FLOOR + B.base, oe, on, B.seat - B.top], !alongNorth)
    oak.box([r.west, r.south, B.seat - B.top, r.east, r.north, B.seat], !alongNorth)
  }
  return { oak, base }
}

/** THE PANES OF THE GLAZED WALL, as seen from the room: the glass between
 * the posts, from the sill to the soffit, a hair inside the envelope's own. */
export const GLAZING = {
  east: FACE.glazingEast + .006,
  posts: [-60, -56, -52, -48, -44] as readonly number[],
  post: .14,
  south: FACE.southStripNorth, north: G.north,
  bottom: FLOOR + .42, top: -1.95,
} as const
export function glazingPanes(): Rect[] {
  const edges = [GLAZING.south, ...GLAZING.posts.flatMap(n => [n - GLAZING.post / 2, n + GLAZING.post / 2]), GLAZING.north]
  const out: Rect[] = []
  for (let i = 0; i < edges.length; i += 2) out.push({ west: GLAZING.east, south: edges[i]!, east: GLAZING.east, north: edges[i + 1]! })
  return out
}

/** WHAT THE GALLERY'S SHADOWED LIGHTS SEE: the room's soffit and its south
 * cross wall, the glazing's posts and sill and the benches, doubled on the
 * gallery's shadow layer. The drawings wall is its own cabinet's, which
 * casts for its own lamps (`body-wall-plan.ts`). */
export function shadowCasters(): Solid {
  const c = new Solid(), g = GLAZING, h = GLAZING.post / 2, X = GALLERY
  c.box([X.west, X.south, X.soffit, FACE.glazingEast, X.north, X.soffit + .2])
  c.box([X.west, X.crossNorth - .2, FLOOR, X.crossEast, X.crossNorth, X.soffit])
  for (const n of g.posts) c.box([FACE.glazingEast, n - h, FLOOR, FACE.glazingEast + .14, n + h, GALLERY.soffit])
  c.box([FACE.glazingEast, g.south, FLOOR, FACE.glazingEast + .26, g.north, g.bottom])
  const { oak, base } = benches()
  for (const b of [...oak.bounds, ...base.bounds]) c.box(b)
  return c
}

/** Every solid this room raises, by name, for the certificate's supplement. */
export function lineGallerySolids(): { name: string; box: Box }[] {
  const { metal, lenses } = fittings(), { oak, base } = benches()
  return [
    ...metal.bounds.map((box, i) => ({ name: `fitting-${i}`, box })),
    ...lenses.bounds.map((box, i) => ({ name: `lamp-${i}`, box })),
    ...oak.bounds.map((box, i) => ({ name: `bench-oak-${i}`, box })),
    ...base.bounds.map((box, i) => ({ name: `bench-base-${i}`, box })),
  ]
}
