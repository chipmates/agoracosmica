/** THE PICTURE ROOM, IN THE WING'S OWN METRES (east, north, height): where
 * its finish lies over the certified construction, where every frame, bench,
 * track and head stands, and every light and opening as data. Pure geometry
 * and numbers: `picture-room.ts` dresses and lights it, `picture-light.ts`
 * lights the reproductions from the same table, and `picture-room-check.mjs`
 * proves every solid of it clear of the walk. A modern room; nothing here
 * claims a building of 1517.
 */
import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three/webgpu'
import { FACE, FLOOR, HANG_DATUM, OPENING, ROOMS } from './layout'
import { hangPlacements } from './hang'
import { numberRelief, numberWidth, type Relief } from './picture-numerals'

export const PICTURE_ROOM_PROVENANCE = {
  manifestId: 'vinci/collection-picture-room',
  assetClass: 'GENERATED',
  certainty: 'reconstructed',
} as const

const R = ROOMS.picture
export type P3 = [east: number, north: number, height: number]
export type Rect = { west: number; south: number; east: number; north: number }
export const v3 = (e: number, n: number, h: number): Vector3 => new Vector3(e, h, -n)

/** The lining's face, which every depth below is measured from. */
export const WALL_FACE = FACE.pictureWallNorth + .033

/** THE ROOM'S OWN LINES, read off the construction it is laid over. */
export const ROOM = {
  west: R.west, east: R.east, south: R.south, north: R.north,
  /** the plaster's face: a millimetre over the hangers the construction
   * carries, so the works hang on fixings no one sees */
  finish: WALL_FACE + .013,
  /** the west wall's plaster, the same distance over its own lining */
  westFinish: FACE.wallWest + .033 + .013,
  /** the shadow gap at the foot of every wall, and its dark back, which
   * stands in front of the construction's base band */
  gap: .055,
  backing: WALL_FACE + .006,
  westBacking: FACE.wallWest + .033 + .006,
  /** THE FRIEZE: the picture rail's front and underside read as the foot of
   * an upper wall that steps forward, so the rail is a line of the building
   * and no bar crosses a door */
  friezeFoot: HANG_DATUM + 1.42 - .042,
  frieze: WALL_FACE + .137 + .005,
  /** the bulkhead that closes the cove over the hanging wall */
  bulkheadFoot: -2.322,
  bulkhead: FACE.pictureWallNorth + .66,
  soffit: -1.95,
  ribFoot: -2.14,
  rib: .28,
  /** the room's floor finish, over the doors' construction thresholds */
  floor: FLOOR + .008,
  /** the dark stone band the construction lays along the glazing */
  band: FACE.glazingNorth - .9,
} as const

/** The structure's bay, which the soffit's ribs stand on. */
const BAY = 4
const ribsAlong = (from: number, to: number): number[] => {
  const out: number[] = []
  for (let at = Math.ceil(from / BAY) * BAY; at < to; at += BAY) out.push(at)
  return out
}
export const RIBS = { east: ribsAlong(R.west, R.east), north: ribsAlong(R.south, R.north) } as const

/** THE TWO DOORS in the hanging wall, as the construction dresses them:
 * a stone reveal each side and a head, the wall's full thickness deep. */
export const DOORS = {
  /** the hall door's east jamb is the one the walk into the machines passes
   * closest to, and no stop sees it: it keeps its stone */
  hall: { reveals: [OPENING.pictureToHall.east[0] + .1, OPENING.pictureToHall.east[1]] as [number, number], dressedJambs: [true, false] as [boolean, boolean] },
  gallery: { reveals: [OPENING.pictureToGallery.east[0], OPENING.pictureToGallery.east[1] - .1] as [number, number], dressedJambs: [true, true] as [boolean, boolean] },
} as const
/** a reveal's half width, its front into the room and its back into the next room */
export const REVEAL = { half: .13, front: FACE.pictureWallNorth + .13, back: FACE.pictureWallSouth - .13, head: -2.5, headTop: -2.24 } as const

// ------------------------------------------------------------------ the hang

/** THE FRAME'S SECTION, swept round the measured panel with real mitres.
 * `r` runs outward from the sight edge, `z` off the lining's face. The
 * construction's own moulding (8 cm wide, 12 to 74 mm off the wall) lies
 * inside it: the section clears it by a bed on every side, so the old box
 * is never seen and never shares a plane with this one. A bronze slip at
 * the sight edge, then dark oiled oak rising in a cove to a flat face and
 * rolling over a bead to its side. */
export interface SectionPoint { r: number; z: number; finish: 'bronze' | 'oak'; smooth?: boolean }
export const CANVAS_Z = .076
export const SLIP_Z = .0872
export const FRAME_FRONT_Z = .097
export const FRAME_OUTER_R = .088
export const FRAME_BACK_Z = .011
/** the bronze slip at the sight edge, the same in every section, so every
 * canvas stands in the same rebate under the same edge */
const SLIP: readonly SectionPoint[] = [
  { r: 0, z: CANVAS_Z, finish: 'bronze' },
  { r: 0, z: .083, finish: 'bronze' },
  { r: .0018, z: .0862, finish: 'bronze', smooth: true },
  { r: .0055, z: SLIP_Z, finish: 'bronze' },
  // a quirk: the oak starts a hair under the slip, which reads as a line
  { r: .0068, z: .0858, finish: 'oak' },
]
const side = (r: number): SectionPoint[] => [{ r, z: FRAME_BACK_Z, finish: 'oak' }]
/** THE COVE: a cove rising to a broad flat face, rolled over a bead. */
export const SECTION: readonly SectionPoint[] = [
  ...SLIP,
  { r: .0105, z: .0876, finish: 'oak', smooth: true },
  { r: .017, z: .0918, finish: 'oak', smooth: true },
  { r: .026, z: .0952, finish: 'oak', smooth: true },
  { r: .036, z: FRAME_FRONT_Z, finish: 'oak' },
  { r: .071, z: FRAME_FRONT_Z, finish: 'oak' },
  { r: .077, z: .0962, finish: 'oak', smooth: true },
  { r: .0825, z: .0937, finish: 'oak', smooth: true },
  { r: .0866, z: .0895, finish: 'oak', smooth: true },
  { r: FRAME_OUTER_R, z: .0845, finish: 'oak' },
  ...side(FRAME_OUTER_R),
]
/** THE CASSETTA, for the altarpieces and the large panels: a broad sunk
 * frieze between a small ovolo at the sight and a heavy moulding at the
 * outer edge, the frame deepest at its outside. */
const CASSETTA: readonly SectionPoint[] = [
  ...SLIP,
  { r: .009, z: .0898, finish: 'oak', smooth: true },
  { r: .013, z: .0942, finish: 'oak', smooth: true },
  { r: .018, z: .096, finish: 'oak', smooth: true },
  { r: .023, z: .0944, finish: 'oak', smooth: true },
  { r: .026, z: .0908, finish: 'oak' },
  { r: .0272, z: .0885, finish: 'oak' },
  { r: .085, z: .0885, finish: 'oak' },
  { r: .087, z: .0925, finish: 'oak', smooth: true },
  { r: .091, z: .0978, finish: 'oak', smooth: true },
  { r: .097, z: .1014, finish: 'oak', smooth: true },
  { r: .104, z: .1025, finish: 'oak', smooth: true },
  { r: .11, z: .1003, finish: 'oak', smooth: true },
  { r: .1148, z: .0958, finish: 'oak', smooth: true },
  { r: .1175, z: .0902, finish: 'oak' },
  { r: .118, z: .0862, finish: 'oak' },
  ...side(.118),
]
/** THE BOLECTION, for the small panels: a lip standing proud at the sight,
 * an ogee falling to a narrow flat, a bead at the outer edge. */
const BOLECTION: readonly SectionPoint[] = [
  ...SLIP,
  { r: .008, z: .0905, finish: 'oak', smooth: true },
  { r: .0105, z: .0955, finish: 'oak', smooth: true },
  { r: .014, z: .0985, finish: 'oak', smooth: true },
  { r: .019, z: .0995, finish: 'oak', smooth: true },
  { r: .024, z: .0976, finish: 'oak', smooth: true },
  { r: .028, z: .0942, finish: 'oak', smooth: true },
  { r: .033, z: .0906, finish: 'oak', smooth: true },
  { r: .039, z: .0884, finish: 'oak', smooth: true },
  { r: .046, z: .0876, finish: 'oak' },
  { r: .069, z: .0876, finish: 'oak' },
  { r: .072, z: .0896, finish: 'oak', smooth: true },
  { r: .0762, z: .092, finish: 'oak', smooth: true },
  { r: .0802, z: .0914, finish: 'oak', smooth: true },
  { r: .0836, z: .0884, finish: 'oak', smooth: true },
  { r: .0848, z: .0852, finish: 'oak' },
  { r: .085, z: .0835, finish: 'oak' },
  ...side(.085),
]
export type FrameStyle = 'cove' | 'cassetta' | 'bolection'
/** A section and where its number is cast: the flat of the bottom member it
 * sits on (its middle, its height off the lining) and the figure's height. */
export interface FrameSection {
  style: FrameStyle
  points: readonly SectionPoint[]
  outer: number
  front: number
  seat: { r: number; z: number; figure: number }
}
const framed = (style: FrameStyle, points: readonly SectionPoint[], seat: FrameSection['seat']): FrameSection =>
  ({ style, points, outer: Math.max(...points.map(p => p.r)), front: Math.max(...points.map(p => p.z)), seat })
export const SECTIONS: Readonly<Record<FrameStyle, FrameSection>> = {
  cove: framed('cove', SECTION, { r: .0535, z: FRAME_FRONT_Z, figure: .027 }),
  cassetta: framed('cassetta', CASSETTA, { r: .0561, z: .0885, figure: .042 }),
  bolection: framed('bolection', BOLECTION, { r: .0575, z: .0876, figure: .019 }),
}
/** the deepest face of any section: the box a frame's shadow is cast from */
export const FRAME_SHADOW_Z = Math.max(...Object.values(SECTIONS).map(s => s.front))
/** WHICH SECTION A WORK TAKES, by its size: the altarpieces and the large
 * panels in the cassetta, the small panels in the bolection, the rest in the
 * cove. The portrait keeps the cove her projector is cut to. */
export function frameStyle(width: number, height: number): FrameStyle {
  if (width > 1 || height > 1.3) return 'cassetta'
  if (width < .42 && height < .52) return 'bolection'
  return 'cove'
}

/** One work on the wall: its panel, where it hangs and the frame round it. */
export interface HangFrame {
  key: string
  id: string
  face: 'front' | 'reverse'
  /** the panel's measured field: centre east, centre height, width, height */
  east: number
  datum: number
  width: number
  height: number
  /** where its reproduction's plane stands (a canvas in its rebate) */
  canvasNorth: number
  /** the frame's outer edge, east and height */
  outer: { west: number; east: number; low: number; high: number }
  /** its section, and its number on the wall: the hang's order from the
   * east door, counted from one */
  section: FrameSection
  number: number
}
export const frameKey = (id: string, face: string): string => `${id}/${face}`

export function hangFrames(): HangFrame[] {
  return hangPlacements().map((work, index) => {
    const west = work.east - work.width / 2, east = work.east + work.width / 2
    const low = work.datum - work.height / 2, high = work.datum + work.height / 2
    const key = frameKey(work.id, work.face)
    const section = SECTIONS[key === PROJECTOR.key ? 'cove' : frameStyle(work.width, work.height)]
    const R = section.outer
    return {
      key, id: work.id, face: work.face,
      east: work.east, datum: work.datum, width: work.width, height: work.height,
      canvasNorth: WALL_FACE + CANVAS_Z,
      outer: { west: west - R, east: east + R, low: low - R, high: high + R },
      section, number: index + 1,
    }
  })
}
/** THE NUMBER OF A WORK ON THE WALL, by its exhibit key (`id/face`). */
export function hangNumber(key: string): number | null {
  return hangFrames().find(frame => frame.key === key)?.number ?? null
}
/** How far a reproduction stands in front of the field the construction
 * prepared for it: the canvas sits in the frame's rebate, a centimetre under
 * the slip, and no longer at the back of a six centimetre box. */
export const CANVAS_FORWARD = CANVAS_Z - .0165

// ------------------------------------------------------------------ the light

/** THE HANG'S TRACK: a black channel under the coffer rib that runs the
 * room's length 1.8 m off the wall, where a head throws its beam onto a
 * work at about thirty degrees off the vertical. */
export const TRACK = { north: -40, west: R.west + .5, east: R.east - .5, width: .034, depth: .036 } as const
const TRACK_FOOT = ROOM.ribFoot - .005 - TRACK.depth
/** A head's lamp face stands this far under its track. */
const DROP = .3

/** THE COLOURS OF LIGHT AS DISPLAYED (AD-2): the lamps and the north daylight
 * are balanced here, because the print carries no white balance of its own. */
export const LAMP_COLOUR = '#ffe0b8'
export const DAYLIGHT_COLOUR = '#dfe8f4'

/** The irradiance a work stands in at its aim, before the room's gain: a
 * canvas of albedo one would read at one. */
export const HANG_IRRADIANCE = Math.PI
/** How much of the geometric falloff down a panel the head's asymmetric beam
 * keeps: the head throws more to the far foot of a tall work, as a framing
 * lens does, so a panel reads as lit and not as burnt at its top. */
export const BEAM_KEEP = .3
/** The margin the cone leaves round a frame: the lens's own pool mask
 * (`picture-light.ts`) shapes the light inside it. */
const POOL_MARGIN = .5
/** The pool's soft edge, in degrees past the frame. */
const POOL_EDGE_DEG = 7

export interface HangLamp {
  name: string
  /** the work this head is aimed at */
  key: string
  at: P3
  aim: P3
  intensity: number
  /** the cone's half angle and the share of it that is soft */
  angle: number
  penumbra: number
  /** the distance the beam is levelled at: the aim's own */
  level: number
  /** a framing projector's cut: the rectangle its beam is shaped to, in the
   * plane of the frame's face (east and height), and its soft edge */
  shutter?: { west: number; east: number; low: number; high: number; soft: number }
}

/** THE PORTRAIT HE KEPT gets a framing projector: its beam is cut to her
 * frame, a step brighter than her neighbours, the wall round her left dark. */
export const PROJECTOR = { key: frameKey('mona-lisa', 'front'), gain: 1.3, margin: .07, soft: .05 } as const

const angleTo = (from: Vector3, axis: Vector3, to: Vector3): number =>
  Math.acos(Math.min(1, Math.max(-1, to.clone().sub(from).normalize().dot(axis))))

/** THE HEADS, as data: one per work, two side by side over a work wider
 * than 1.3 m, each aimed at its own share of the panel and levelled so the
 * work stands at the room's irradiance at its aim. */
export function hangLamps(): HangLamp[] {
  const out: HangLamp[] = []
  for (const f of hangFrames()) {
    const heads = f.width > 1.3 ? [-f.width / 4, f.width / 4] : [0]
    const projector = f.key === PROJECTOR.key
    heads.forEach((offset, i) => {
      const at: P3 = [f.east + offset, TRACK.north, TRACK_FOOT - DROP]
      const aim: P3 = [f.east + offset, f.canvasNorth, f.datum]
      const L = v3(...at), A = v3(...aim), axis = A.clone().sub(L).normalize()
      const corners = [
        [f.outer.west - POOL_MARGIN, f.outer.low - POOL_MARGIN], [f.outer.east + POOL_MARGIN, f.outer.low - POOL_MARGIN],
        [f.outer.west - POOL_MARGIN, f.outer.high + POOL_MARGIN], [f.outer.east + POOL_MARGIN, f.outer.high + POOL_MARGIN],
      ].map(([e, h]) => v3(e!, f.canvasNorth, h!))
      const inner = Math.max(...corners.map(c => angleTo(L, axis, c)))
      const outer = projector ? inner + 2 * Math.PI / 180 : inner + POOL_EDGE_DEG * Math.PI / 180
      const d = A.distanceTo(L), cos = (L.z - A.z) === 0 ? 1 : Math.abs(L.z - A.z) / d
      const gain = projector ? PROJECTOR.gain : 1
      out.push({
        name: `head-${f.id}${f.face === 'reverse' ? '-reverse' : ''}${heads.length > 1 ? `-${i + 1}` : ''}`,
        key: f.key, at, aim,
        intensity: HANG_IRRADIANCE * d * d / cos / heads.length * gain,
        angle: outer, penumbra: 1 - inner / outer, level: d,
        ...(projector ? { shutter: {
          west: f.outer.west - PROJECTOR.margin, east: f.outer.east + PROJECTOR.margin,
          low: f.outer.low - PROJECTOR.margin, high: f.outer.high + PROJECTOR.margin, soft: PROJECTOR.soft,
        } } : {}),
      })
    })
  }
  return out
}

/** The picture rail's box, which casts its own line under the frieze. */
export const RAIL_BOX = { low: ROOM.friezeFoot, depth: ROOM.frieze - WALL_FACE } as const

export type RoomLightKind = 'area' | 'sky' | 'spot'
export interface RoomLight {
  name: string
  kind: RoomLightKind
  at: P3
  aim: P3
  colour: string
  /** an opening's luminance, a parallel source's irradiance, a spot's candela */
  intensity: number
  /** a spot's half angle and the soft share of it */
  angle?: number
  penumbra?: number
  width?: number
  height?: number
  /** which surfaces take it: the whole room, or the floor and what stands on it */
  receivers: 'room' | 'floor'
  shadow?: { mapPx: number; soft: number; span: [number, number] }
}

/** THE NORTH GLAZING, as an opening: glass from the floor to over the soffit
 * the whole length of the room, facing south onto the hang. */
export const WINDOW = {
  north: FACE.glazingNorth - .02, west: R.west, east: FACE.glazingEast,
  bottom: FLOOR + .1, top: ROOM.soffit,
} as const
/** THE NORTH SKY over the floor: the glazing's daylight as one parallel
 * source a little over the horizon, so the benches stand on their shadows. */
const SKY = { elevation: 38, fromEast: 8, on: [-42, -38.6] as [number, number], distance: 40 } as const
const skyFrom = (): P3 => {
  const e = SKY.elevation * Math.PI / 180, a = SKY.fromEast * Math.PI / 180
  const [east, north] = SKY.on
  return [east + Math.cos(e) * Math.sin(a) * SKY.distance, north + Math.cos(e) * Math.cos(a) * SKY.distance, FLOOR + Math.sin(e) * SKY.distance]
}
/** THE TWO DOORWAYS, bright with the next rooms' daylight. */
export const DOORWAYS = [
  { name: 'door-hall', west: DOORS.hall.reveals[0] + REVEAL.half, east: DOORS.hall.reveals[1] - REVEAL.half },
  { name: 'door-gallery', west: DOORS.gallery.reveals[0] + REVEAL.half, east: DOORS.gallery.reveals[1] - REVEAL.half },
] as const

export const ROOM_LIGHTS: readonly RoomLight[] = [
  {
    name: 'window', kind: 'area', receivers: 'room', colour: DAYLIGHT_COLOUR,
    at: [(WINDOW.west + WINDOW.east) / 2, WINDOW.north, (WINDOW.bottom + WINDOW.top) / 2],
    aim: [(WINDOW.west + WINDOW.east) / 2, WINDOW.north - 10, (WINDOW.bottom + WINDOW.top) / 2],
    width: WINDOW.east - WINDOW.west, height: WINDOW.top - WINDOW.bottom, intensity: .7,
  },
  {
    name: 'sky', kind: 'sky', receivers: 'floor', colour: DAYLIGHT_COLOUR,
    at: skyFrom(), aim: [SKY.on[0], SKY.on[1], FLOOR], intensity: .9,
    shadow: { mapPx: 2048, soft: 14, span: [22, 12] },
  },
  // the next room's daylight through each doorway, as one soft source in the
  // opening's head throwing its spill across the boards and up the jambs
  ...DOORWAYS.map((door): RoomLight => ({
    name: door.name, kind: 'spot', receivers: 'room', colour: DAYLIGHT_COLOUR,
    at: [(door.west + door.east) / 2, FACE.pictureWallSouth, ROOM.friezeFoot - .1],
    aim: [(door.west + door.east) / 2, FACE.pictureWallNorth + 2.6, FLOOR],
    intensity: 5.5, angle: 1.2, penumbra: .95,
  })),
]

/** Where the room's bounce is taken: the room's middle at eye height. */
export const PROBE_AT: P3 = [(R.west + R.east) / 2, (R.south + R.north) / 2, FLOOR + 1.6]

/** The layer only the room's shadowed daylight draws its map from. */
export const PICTURE_SHADOW_LAYER = 6

// ---------------------------------------------------------------- geometry

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
export function runs(from: number, to: number, gaps: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = []
  let cursor = from
  for (const [a, b] of [...gaps].sort((x, y) => x[0] - y[0])) {
    if (a > cursor) out.push([cursor, Math.min(a, to)])
    cursor = Math.max(cursor, b)
  }
  if (cursor < to) out.push([cursor, to])
  return out
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
    const uv = g.getAttribute('uv'), normal = g.getAttribute('normal')
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i))
      const width = nx > .5 ? n - s : e - w, height = ny > .5 ? n - s : hi - lo
      uv.setXY(i, uv.getX(i) * width, uv.getY(i) * height)
    }
    g.translate((w + e) / 2, (lo + hi) / 2, -(s + n) / 2)
    const flat = g.toNonIndexed(); g.dispose()
    if (this.grained) {
      const count = flat.getAttribute('position').count
      flat.setAttribute('grain', new Float32BufferAttribute(new Float32Array(count).fill(grainEast ? 1 : 0), 1))
      // the heart of the log the board was sawn from: under it and a little
      // to one side, so its end shows the rings as arcs
      const heart = v3((w + e) / 2, (s + n) / 2 + .09, lo - .26)
      flat.setAttribute('heart', new Float32BufferAttribute(new Float32Array(count * 3).map((_, i) => [heart.x, heart.y, heart.z][i % 3]!), 3))
    }
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
    const flat = g.index ? g.toNonIndexed() : g
    if (this.grained) {
      flat.setAttribute('grain', new Float32BufferAttribute(new Float32Array(flat.getAttribute('position').count), 1))
      flat.setAttribute('heart', new Float32BufferAttribute(new Float32Array(flat.getAttribute('position').count * 3), 3))
    }
    this.parts.push(flat)
    const r = Math.max(radius, radiusB)
    this.bounds.push([Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r,
      Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r])
  }
  get empty(): boolean { return this.parts.length === 0 }
}

/** THE FRAMES, swept: one geometry per finish, UVs in metres with `u` along
 * each member (the grain) and `v` round the section, each member read from
 * its own piece of the photograph. */
/** a section's own normals, flat per segment and averaged at a smooth joint,
 * and the distance run round it to each point */
function sectionFrame(points: readonly SectionPoint[]): { normal: (i: number, seg: number) => [number, number]; arcAt: number[] } {
  const segs = points.length - 1
  const segNormal: [number, number][] = []
  for (let i = 0; i < segs; i++) {
    const a = points[i]!, b = points[i + 1]!
    const dr = b.r - a.r, dz = b.z - a.z, l = Math.hypot(dr, dz) || 1
    segNormal.push([-dz / l, dr / l])
  }
  const normal = (i: number, seg: number): [number, number] => {
    if (!points[i]!.smooth) return segNormal[seg]!
    const a = segNormal[Math.max(0, i - 1)]!, b = segNormal[Math.min(segs - 1, i)]!
    const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1
    return [x / l, y / l]
  }
  let arc = 0
  const arcAt: number[] = [0]
  for (let i = 0; i < segs; i++) { arc += Math.hypot(points[i + 1]!.r - points[i]!.r, points[i + 1]!.z - points[i]!.z); arcAt.push(arc) }
  return { normal, arcAt }
}

/** HOW FAR A NUMBER STANDS PROUD of its rail, and where on the rail it sits:
 * on the bottom member's flat, its right edge under the sight edge's west end
 * (the lower right corner of the work as the room sees it), clear of the mark
 * and the name the page lays under the middle of the work. `east` is the
 * number's middle. */
export const NUMBER_RELIEF = .0011
export function numberSeat(f: HangFrame): { east: number; height: number; z: number; figure: number } {
  const { seat } = f.section
  const width = numberWidth(String(f.number).length, seat.figure)
  return { east: f.east - f.width / 2 + width / 2 + seat.figure * .15, height: f.datum - f.height / 2 - seat.r, z: seat.z, figure: seat.figure }
}

export function frameGeometry(frames: readonly HangFrame[] = hangFrames()): { oak: BufferGeometry; bronze: BufferGeometry; numbers: BufferGeometry; bounds: Box[] } {
  const out = { oak: [] as number[][], bronze: [] as number[][] }
  const numbers: Relief = { position: [], normal: [], uv: [] }
  const bounds: Box[] = []
  const frameOf = new Map<FrameStyle, ReturnType<typeof sectionFrame>>()
  frames.forEach((f, index) => {
    const SECTION = f.section.points, segs = SECTION.length - 1
    const shape = frameOf.get(f.section.style) ?? sectionFrame(SECTION)
    frameOf.set(f.section.style, shape)
    const { normal: pointNormal, arcAt } = shape
    const x0 = f.east - f.width / 2, x1 = f.east + f.width / 2, y0 = f.datum - f.height / 2, y1 = f.datum + f.height / 2
    // the four members: an edge, its outward direction and its run
    const members: { o: [number, number]; from: [number, number]; to: [number, number]; salt: number }[] = [
      { o: [0, -1], from: [x0, y0], to: [x1, y0], salt: 1.7 },
      { o: [1, 0], from: [x1, y0], to: [x1, y1], salt: 5.3 },
      { o: [0, 1], from: [x1, y1], to: [x0, y1], salt: 9.1 },
      { o: [-1, 0], from: [x0, y1], to: [x0, y0], salt: 13.7 },
    ]
    for (const m of members) {
      const run: [number, number] = [m.to[0] - m.from[0], m.to[1] - m.from[1]]
      const length = Math.hypot(run[0], run[1]), along: [number, number] = [run[0] / length, run[1] / length]
      // each member its own piece of the oak: an offset along the grain
      const shift = ((index * 7.31 + m.salt) * 2.137) % 6
      for (let i = 0; i < segs; i++) {
        const a = SECTION[i]!, b = SECTION[i + 1]!
        const na = pointNormal(i, i), nb = pointNormal(i + 1, i)
        // mitred: a point r out runs r further at each end of its member
        const corner = (p: SectionPoint, end: 0 | 1): [number, number, number] => {
          const base = end ? m.to : m.from
          const e = base[0] + m.o[0] * p.r + (end ? along[0] : -along[0]) * p.r
          const h = base[1] + m.o[1] * p.r + (end ? along[1] : -along[1]) * p.r
          return [e, h, p.z]
        }
        const quad = [corner(a, 0), corner(a, 1), corner(b, 1), corner(b, 0)]
        const normals = [na, na, nb, nb]
        const us = [-a.r, length + a.r, length + b.r, -b.r].map(u => u + shift)
        const vs = [arcAt[i]!, arcAt[i]!, arcAt[i + 1]!, arcAt[i + 1]!]
        const target = out[a.finish]
        for (const k of [0, 1, 2, 0, 2, 3]) {
          const [e, h, z] = quad[k]!
          const [nr, nz] = normals[k]!
          // world: east is x, height is y, north is -z; depth z runs north
          target.push([e, h, -(WALL_FACE + z), m.o[0] * nr, m.o[1] * nr, -nz, us[k]!, vs[k]!, along[0], along[1]])
        }
      }
    }
    // THE NUMBER, cast on the bottom member's flat and sunk a hair into it.
    // The room faces the wall looking south, so the figures read westward:
    // the face's `u` runs west, `v` up, `w` out of the frame into the room
    const seat = numberSeat(f)
    const relief = numberRelief(String(f.number), seat.figure, NUMBER_RELIEF)
    for (let i = 0; i < relief.position.length; i += 3) {
      numbers.position.push(seat.east - relief.position[i]!, seat.height + relief.position[i + 1]!, -(WALL_FACE + seat.z + relief.position[i + 2]!))
      numbers.normal.push(-relief.normal[i]!, relief.normal[i + 1]!, -relief.normal[i + 2]!)
    }
    numbers.uv.push(...relief.uv)
    bounds.push([f.outer.west, WALL_FACE + FRAME_BACK_Z, f.outer.low, f.outer.east, WALL_FACE + f.section.front, f.outer.high])
  })
  const build = (rows: number[][]): BufferGeometry => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(rows.flatMap(r => [r[0]!, r[1]!, r[2]!]), 3))
    g.setAttribute('normal', new Float32BufferAttribute(rows.flatMap(r => [r[3]!, r[4]!, r[5]!]), 3))
    g.setAttribute('uv', new Float32BufferAttribute(rows.flatMap(r => [r[6]!, r[7]!]), 2))
    // the member's run, which is the way its grain runs
    g.setAttribute('along', new Float32BufferAttribute(rows.flatMap(r => [r[8]!, r[9]!, 0]), 3))
    g.computeBoundingBox(); g.computeBoundingSphere()
    return g
  }
  const cast = new BufferGeometry()
  cast.setAttribute('position', new Float32BufferAttribute(numbers.position, 3))
  cast.setAttribute('normal', new Float32BufferAttribute(numbers.normal, 3))
  cast.setAttribute('uv', new Float32BufferAttribute(numbers.uv, 2))
  cast.setAttribute('along', new Float32BufferAttribute(new Float32Array(numbers.position.length).map((_, i) => i % 3 === 0 ? 1 : 0), 3))
  cast.computeBoundingBox(); cast.computeBoundingSphere()
  return { oak: build(out.oak), bronze: build(out.bronze), numbers: cast, bounds }
}

/** Is the wall seen at this east and height, or is a frame standing on it? */
function inFrame(frames: readonly HangFrame[], east: number, low: number, high: number): boolean {
  return frames.some(f => east > f.outer.west - .002 && east < f.outer.east + .002 && high > f.outer.low && low < f.outer.high)
}

/** THE WALLS: the hang's deep plaster over the lining, stopped over the floor
 * by a shadow gap with a dark back; the frieze stepping forward at the rail
 * and its soffit; the door surrounds wrapped in the same plaster; the west
 * wall the same. The plaster runs behind every frame: a frame stands on it. */
export function wallSkins(): { plaster: Skin; frieze: Skin; backing: Skin } {
  const plaster = new Skin(), frieze = new Skin(), backing = new Skin(), X = ROOM
  const low = FLOOR + X.gap, gapTop = low + .004
  const doorHall = DOORS.hall.reveals, doorGallery = DOORS.gallery.reveals
  // the hanging wall runs between the two door surrounds
  const wallWest = doorHall[1] + REVEAL.half, wallEast = doorGallery[0] - REVEAL.half
  plaster.eastWest(X.finish, 1, wallWest, wallEast, low, X.friezeFoot + .004)
  backing.eastWest(X.backing, 1, wallWest, wallEast, FLOOR, gapTop)
  // the frieze: its soffit over the rail and its face up into the bulkhead
  frieze.level({ west: X.west, south: X.finish - .004, east: X.east, north: X.frieze }, X.friezeFoot, -1)
  frieze.eastWest(X.frieze, 1, X.west, X.east, X.friezeFoot, X.bulkheadFoot + .004)
  // the west wall, from the hanging wall's door to the glazing
  const westReveal = doorHall[0] - REVEAL.half
  plaster.northSouth(X.westFinish, 1, REVEAL.front, WINDOW.north, low, X.soffit - .001)
  backing.northSouth(X.westBacking, 1, REVEAL.front, WINDOW.north, FLOOR, gapTop)
  // each door surround: its two faces into the room, its jambs through the
  // wall, and the head over the opening, all in the same plaster
  for (const door of [DOORS.hall, DOORS.gallery]) {
    const [west, east] = door.reveals, skin = .005
    const outerWest = Math.max(west - REVEAL.half - skin, X.westFinish), outerEast = east + REVEAL.half + skin
    const front = REVEAL.front + skin
    // a jamb the walk passes within a hair of keeps the construction's own
    // face, and its front stops flush with it: no skin stands in the way
    const [jambWest, jambEast] = door.dressedJambs
    const innerWest = west + REVEAL.half + (jambWest ? skin : 0), innerEast = east - REVEAL.half - (jambEast ? skin : 0)
    // the fronts, from the wall's plaster to the reveal's face
    plaster.eastWest(front, 1, outerWest, innerWest, low, X.friezeFoot + .004)
    plaster.eastWest(front, 1, innerEast, outerEast, low, X.friezeFoot + .004)
    backing.eastWest(front - .006, 1, outerWest, innerWest, FLOOR, gapTop)
    backing.eastWest(front - .006, 1, innerEast, outerEast, FLOOR, gapTop)
    // the returns where the wall meets each surround
    if (west - REVEAL.half - skin > X.westFinish + .01) plaster.northSouth(west - REVEAL.half - skin, -1, X.finish, front, low, X.friezeFoot + .004)
    plaster.northSouth(outerEast, 1, X.finish, front, low, X.friezeFoot + .004)
    // the jambs, the wall's whole thickness, and the head's soffit
    const back = REVEAL.back - skin
    if (jambWest) plaster.northSouth(innerWest, 1, back, front, FLOOR + .004, X.friezeFoot)
    if (jambEast) plaster.northSouth(innerEast, -1, back, front, FLOOR + .004, X.friezeFoot)
    plaster.level({ west: innerWest, south: back, east: innerEast, north: front }, X.friezeFoot, -1)
  }
  return { plaster, frieze, backing }
}

/** THE BULKHEAD over the hanging wall, closing the cove the construction left
 * there, and the soffit and ribs of the room: one concrete. The ribs of one
 * direction stop where they cross the other so no two faces share a plane. */
export function ceilingSkin(): Skin {
  const s = new Skin(), X = ROOM, skin = .005, half = X.rib / 2 + skin
  const foot = X.ribFoot - skin, soffit = X.soffit - skin
  const west = X.westFinish, east = X.east
  // the bulkhead: its soffit and its face, from the frieze to the ceiling
  s.level({ west, south: X.frieze, east, north: X.bulkhead }, X.bulkheadFoot, -1)
  s.eastWest(X.bulkhead, 1, west, east, X.bulkheadFoot, soffit)
  // the soffit between the bulkhead and the glazing, and its ribs
  s.level({ west, south: X.bulkhead, east, north: WINDOW.north }, soffit, -1)
  for (const r of RIBS.north) {
    s.eastWest(r - half, -1, west, east, foot, soffit)
    s.eastWest(r + half, 1, west, east, foot, soffit)
    s.level({ west, south: r - half, east, north: r + half }, foot, -1)
  }
  for (const e of RIBS.east) {
    for (const [a, b] of runs(X.bulkhead, WINDOW.north, RIBS.north.map(r => [r - half, r + half] as const))) {
      s.northSouth(e - half, -1, a, b, foot, soffit)
      s.northSouth(e + half, 1, a, b, foot, soffit)
      s.level({ west: e - half, south: a, east: e + half, north: b }, foot, -1)
    }
  }
  return s
}

/** THE FLOOR: oak boards laid along the room from wall to glazing band, the
 * dark stone band along the glazing, and a threshold through each door. */
export function floorSkins(): { oak: Skin; stone: Skin } {
  const oak = new Skin(), stone = new Skin(), X = ROOM
  oak.level({ west: X.westFinish, south: X.finish, east: X.east, north: X.band }, X.floor, 1)
  stone.level({ west: X.westFinish, south: X.band, east: X.east, north: WINDOW.north }, X.floor + .001, 1)
  for (const { reveals: [west, east], dressedJambs } of [DOORS.hall, DOORS.gallery]) {
    stone.level({ west: west + REVEAL.half + (dressedJambs[0] ? .005 : 0), south: REVEAL.back, east: east - REVEAL.half - (dressedJambs[1] ? .005 : 0), north: X.finish }, X.floor + .002, 1)
  }
  return { oak, stone }
}

/** THE BENCHES: each construction bench wrapped as a built oak bench, a thick
 * top on two slab legs over bronze shoes; the ledge at the east end wrapped
 * as a solid oak bench on a recessed dark base. */
export const BENCH_RUNS: readonly [number, number][] = [[-57.8, -52.2], [-46.4, -40.8], [-35, -29.4]]
const BENCH_NORTH = FACE.pictureWallNorth + 3.3
const LEDGE = { east: R.east - 3.4, north: FACE.pictureWallNorth + 1.5 } as const
export function benches(): { oak: Solid; bronze: Solid } {
  const oak = new Solid(true), bronze = new Solid()
  for (const [west, east] of BENCH_RUNS) {
    // the top encloses the construction's slab (0.35 to 0.45 m) by a bed
    oak.box([west - .025, BENCH_NORTH - .335, FLOOR + .344, east + .025, BENCH_NORTH + .335, FLOOR + .458], true)
    for (const at of [west + .5, east - .5]) {
      oak.box([at - .09, BENCH_NORTH - .27, FLOOR + .026, at + .09, BENCH_NORTH + .27, FLOOR + .344], false)
      bronze.box([at - .082, BENCH_NORTH - .262, ROOM.floor - .001, at + .082, BENCH_NORTH + .262, FLOOR + .026])
    }
  }
  // THE LEDGE, built as a bench: its bar lies in the top; the low edge of
  // its sloped board in an apron framed round under the top; its two legs
  // in slab ends on bronze shoes, tied by a stretcher. Air under the apron,
  // so it reads as joinery and not as a crate.
  const L = LEDGE, apron = FLOOR + .378, shoe = FLOOR + .045
  oak.box([L.east - .975, L.north - .07, FLOOR + .486, L.east + .975, L.north + .43, FLOOR + .56], true)
  oak.box([L.east - .96, L.north - .045, apron, L.east + .96, L.north - .02, FLOOR + .486], true)
  oak.box([L.east - .96, L.north + .38, apron, L.east + .96, L.north + .405, FLOOR + .486], true)
  for (const side of [-1, 1]) {
    oak.box([L.east + side * .96 - (side > 0 ? .025 : 0), L.north - .02, apron, L.east + side * .96 + (side < 0 ? .025 : 0), L.north + .38, FLOOR + .486], false)
    oak.box([L.east + side * .8 - .05, L.north - .02, shoe, L.east + side * .8 + .05, L.north + .38, FLOOR + .486], false)
    bronze.box([L.east + side * .8 - .044, L.north - .024, ROOM.floor - .001, L.east + side * .8 + .044, L.north + .384, shoe])
  }
  oak.box([L.east - .75, L.north + .15, FLOOR + .13, L.east + .75, L.north + .21, FLOOR + .19], true)
  return { oak, bronze }
}

/** A HEAD: the adaptor in its track, a stem, a yoke, a can with a finned
 * back and a hood along the aim, and the lamp face a hand inside the hood. A
 * framing projector is longer, with a lens barrel and four shutter tabs. */
function head(metal: Solid, lens: Solid, at: P3, aim: P3, trackFoot: number, projector: boolean): void {
  const face = v3(...at), target = v3(...aim)
  const axis = target.clone().sub(face).normalize()
  const pivot = face.clone().addScaledVector(axis, projector ? -.16 : -.1)
  const wing = (p: Vector3): P3 => [p.x, -p.z, p.y]
  metal.box([at[0] - .03, at[1] - .025, trackFoot - .06, at[0] + .03, at[1] + .025, trackFoot])
  metal.rod([at[0], at[1], trackFoot - .06], [pivot.x, -pivot.z, pivot.y + .085], .009, 10)
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
  if (projector) {
    metal.rod(along(-.13), along(.07), .066, 24)
    for (let fin = 0; fin < 4; fin++) metal.rod(along(-.12 + fin * .02), along(-.114 + fin * .02), .071, 24)
    metal.rod(along(.07), along(.2), .044, 24)
    metal.rod(along(.2), along(.23), .05, 24, .05, true)
    lens.rod(along(.212), along(.216), .038, 24)
    return
  }
  metal.rod(along(-.095), along(.095), .058, 24)
  metal.rod(along(-.16), along(-.095), .05, 24)
  for (let fin = 0; fin < 3; fin++) metal.rod(along(-.108 - fin * .018), along(-.104 - fin * .018), .056, 24)
  // a short snoot, so the lit lens is seen from the room and not only from the wall
  metal.rod(along(.095), along(.128), .06, 24, .064, true)
  lens.rod(along(.1), along(.106), .053, 24)
}
/** WHERE A HEAD'S LENS IS, and the way it throws: its face and its axis. */
export function lensOf(lamp: HangLamp): { at: Vector3; axis: Vector3 } {
  const face = v3(...lamp.at), axis = v3(...lamp.aim).sub(face).normalize()
  const pivot = face.clone().addScaledVector(axis, lamp.shutter ? -.16 : -.1)
  return { at: pivot.addScaledVector(axis, lamp.shutter ? .216 : .106), axis }
}

/** THE FITTINGS: the hang's track under its rib, every head on it, and the
 * lamp faces apart. */
export function fittings(): { metal: Solid; lenses: Solid } {
  const metal = new Solid(), lenses = new Solid(), T = TRACK
  metal.box([T.west, T.north - T.width / 2, TRACK_FOOT, T.east, T.north + T.width / 2, ROOM.ribFoot - .005])
  for (const lamp of hangLamps()) head(metal, lenses, lamp.at, lamp.aim, TRACK_FOOT, lamp.shutter !== undefined)
  return { metal, lenses }
}

/** WHAT THE ROOM'S DAYLIGHT SEES: the soffit and the bulkhead over the room,
 * the glazing's posts, mullions and rails, the benches and the door surrounds,
 * doubled on the room's own shadow layer. */
export function shadowCasters(): Solid {
  const c = new Solid(), X = ROOM
  c.box([X.west - .5, X.south - .5, X.soffit, X.east + .5, WINDOW.north + .3, X.soffit + .25])
  c.box([X.west, X.finish - .02, X.bulkheadFoot, X.east, X.bulkhead, X.soffit])
  const glazing = FACE.glazingNorth + .07
  for (let east = -62; east <= -22; east += 4) {
    c.box([east - .07, glazing - .07, FLOOR, east + .07, glazing + .07, X.soffit])
    if (east < -22) c.box([east + 2 - .04, glazing - .05, FLOOR, east + 2 + .04, glazing + .03, X.soffit])
  }
  c.box([X.west, glazing - .09, FLOOR, X.east, glazing + .09, FLOOR + .16])
  const { oak, bronze } = benches()
  for (const b of [...oak.bounds, ...bronze.bounds]) c.box(b)
  for (const [west, east] of [DOORS.hall.reveals, DOORS.gallery.reveals] as const)
    for (const at of [west, east]) c.box([at - REVEAL.half, REVEAL.back, FLOOR, at + REVEAL.half, REVEAL.front, X.friezeFoot])
  return c
}

/** Every solid this room raises, by name, for the certificate's supplement. */
export function pictureRoomSolids(): { name: string; box: Box }[] {
  const { metal, lenses } = fittings(), { oak, bronze } = benches(), frames = frameGeometry().bounds
  const X = ROOM
  return [
    ...metal.bounds.map((box, i) => ({ name: `fitting-${i}`, box })),
    ...lenses.bounds.map((box, i) => ({ name: `lamp-${i}`, box })),
    ...oak.bounds.map((box, i) => ({ name: `bench-oak-${i}`, box })),
    ...bronze.bounds.map((box, i) => ({ name: `bench-bronze-${i}`, box })),
    ...frames.map((box, i) => ({ name: `frame-${i}`, box })),
    // the frieze and the bulkhead stand proud of the wall the length of the room
    { name: 'frieze', box: [X.west, X.finish, X.friezeFoot, X.east, X.frieze, X.bulkheadFoot] as Box },
    { name: 'bulkhead', box: [X.west, X.finish, X.bulkheadFoot, X.east, X.bulkhead, X.soffit] as Box },
    // the door surrounds' plaster, a skin over the reveals where it is laid,
    // and the heads now closed down to the frieze's foot
    ...[DOORS.hall, DOORS.gallery].flatMap(({ reveals: [west, east], dressedJambs }, d) => [
      { name: `surround-${d}-0`, box: [west - REVEAL.half - .005, X.finish, FLOOR, west + REVEAL.half + (dressedJambs[0] ? .005 : 0), REVEAL.front + .005, X.friezeFoot] as Box },
      { name: `surround-${d}-1`, box: [east - REVEAL.half - (dressedJambs[1] ? .005 : 0), X.finish, FLOOR, east + REVEAL.half + .005, REVEAL.front + .005, X.friezeFoot] as Box },
      ...(dressedJambs[0] ? [{ name: `jamb-${d}-0`, box: [west + REVEAL.half, REVEAL.back - .005, FLOOR, west + REVEAL.half + .005, REVEAL.front, X.friezeFoot] as Box }] : []),
      ...(dressedJambs[1] ? [{ name: `jamb-${d}-1`, box: [east - REVEAL.half - .005, REVEAL.back - .005, FLOOR, east - REVEAL.half, REVEAL.front, X.friezeFoot] as Box }] : []),
      { name: `door-head-${d}`, box: [west, REVEAL.back - .005, X.friezeFoot, east, REVEAL.front + .005, REVEAL.head] as Box },
    ]),
  ]
}

// ------------------------------------------------------------ per work, per vertex

/** WHAT A REPRODUCTION'S PLANE NEEDS TO BE LIT BY ITS OWN HEADS, as numbers
 * a vertex carries: up to two heads (position and candela; axis and the cosine
 * of the cone; the inner cone and the level), the frame's sight edge, the
 * projector's cut. A work with one head carries a dark second one. */
export interface HangLightData {
  lampA: [number, number, number, number]
  aimA: [number, number, number, number]
  lampB: [number, number, number, number]
  aimB: [number, number, number, number]
  /** inner cosine of each head, then each head's level distance */
  cone: [number, number, number, number]
  /** the sight edge: west, east, low, high (world x and y) */
  sight: [number, number, number, number]
  /** the projector's cut in the frame's face plane; zero size for none */
  shutter: [number, number, number, number]
  /** the frame's outer edge: west, east, low, high */
  outer: [number, number, number, number]
}

export function hangLightData(key: string): HangLightData | undefined {
  const frame = hangFrames().find(f => f.key === key)
  if (!frame) return undefined
  const lamps = hangLamps().filter(l => l.key === key)
  const pack = (lamp: HangLamp | undefined): { lamp: [number, number, number, number]; aim: [number, number, number, number]; inner: number; level: number } => {
    if (!lamp) return { lamp: [0, 0, 0, 0], aim: [0, -1, 0, 2], inner: 3, level: 1 }
    const L = v3(...lamp.at), A = v3(...lamp.aim), axis = A.clone().sub(L).normalize()
    return {
      lamp: [L.x, L.y, L.z, lamp.intensity], aim: [axis.x, axis.y, axis.z, Math.cos(lamp.angle)],
      inner: Math.cos(lamp.angle * (1 - lamp.penumbra)), level: lamp.level,
    }
  }
  const a = pack(lamps[0]), b = pack(lamps[1])
  const shutter = lamps[0]?.shutter
  return {
    lampA: a.lamp, aimA: a.aim, lampB: b.lamp, aimB: b.aim,
    cone: [a.inner, b.inner, a.level, b.level],
    sight: [frame.east - frame.width / 2, frame.east + frame.width / 2, frame.datum - frame.height / 2, frame.datum + frame.height / 2],
    shutter: shutter ? [shutter.west, shutter.east, shutter.low, shutter.high] : [0, 0, 0, 0],
    outer: [frame.outer.west, frame.outer.east, frame.outer.low, frame.outer.high],
  }
}

/** The fields of one work's light, in the order the table holds them. */
export const HANG_LIGHT_FIELDS: readonly (keyof HangLightData)[] = ['lampA', 'aimA', 'lampB', 'aimB', 'cone', 'sight', 'shutter', 'outer']
/** THE HANG'S LIGHT TABLE: every work's eight vectors, one row per work in
 * the wall's own order, read by the slot a plane of that work carries. */
export function hangLightTable(): number[][] {
  const rows: number[][] = []
  for (const frame of hangFrames()) {
    const data = hangLightData(frame.key)!
    for (const field of HANG_LIGHT_FIELDS) rows.push([...data[field]])
  }
  return rows
}
/** The slot of one work in that table. */
export const hangSlot = (key: string): number => hangFrames().findIndex(frame => frame.key === key)
/** Stamp a plane of one work with the slot its light is read from. */
export function stampHangLight(geometry: BufferGeometry, key: string): boolean {
  const slot = hangSlot(key)
  if (slot < 0) return false
  const count = geometry.getAttribute('position').count
  geometry.setAttribute('hangSlot', new Float32BufferAttribute(new Float32Array(count).fill(slot), 1))
  return true
}
