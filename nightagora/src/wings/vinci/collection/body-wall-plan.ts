/** THE CABINET OF DRAWINGS, IN THE WING'S OWN METRES (east, north, height):
 * the deep wall the body wall's sheets are set into, its casework and its
 * light, as pure geometry and numbers. `body-wall-cabinet.ts` dresses and
 * lights it, `body-wall-check.mjs` proves every solid of it clear of the walk.
 *
 * THE SHEETS DO NOT MOVE. Each one's place and size are the certified
 * viewing eyes' own (`body-wall.ts`, `approaches.ts`), so the cabinet is
 * built round them. The carriers and the reading ledge the rooms weld into
 * the certified construction stay where they are, inside the cabinet: the
 * rail's certificate hashes them. A modern museum insertion; no building or
 * furniture of 1517 is claimed.
 */
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three/webgpu'
import { FACE, FLOOR, OPENING } from './layout'
import { bodyMounts, type BodyMount } from './body-wall'
import { GALLERY } from './line-gallery-plan'

export const BODY_WALL_PROVENANCE = {
  manifestId: 'vinci/collection-body-wall',
  assetClass: 'GENERATED',
  certainty: 'reconstructed',
} as const

export type P3 = [east: number, north: number, height: number]
/** [west, south, bottom, east, north, top] */
export type Box = [number, number, number, number, number, number]
export const v3 = (e: number, n: number, h: number): Vector3 => new Vector3(e, h, -n)
const H = (above: number): number => FLOOR + above

/** THE WALL'S OWN PLANES, from the construction outward. */
export const PLANE = {
  /** the gallery's concrete finish on the partition */
  finish: GALLERY.west + GALLERY.proud,
  /** the linen the sheets hang on, a hair over the finish */
  linen: GALLERY.west + GALLERY.proud + .002,
  /** the construction's carriers stand to here, the ledge to here */
  carriers: FACE.hallPartitionEast + .033 + .047,
  ledge: FACE.hallPartitionEast + .033 + .6,
} as const

/** WHERE A SHEET'S FACE STANDS: two millimetres in front of the carriers the
 * construction still holds, so the mat lies over them and the sheet sits a
 * mat's thickness behind its window. The certified field stays `mount.east`. */
export const SHEET_PROUD = .023
export const sheetFace = (mount: { east: number }): number => mount.east + SHEET_PROUD

/** THE MAT AND THE FRAME, from the linen out: a linen-covered board with a
 * bevelled window over the sheet, in an oiled oak frame whose lip stands a
 * finger over the mat. */
export const MOUNT = {
  /** the board's back and face */
  matBack: sheetFace({ east: FACE.hallPartitionEast + .059 }) + .0005,
  matFace: sheetFace({ east: FACE.hallPartitionEast + .059 }) + .0035,
  /** the window's bevel, and how far the window laps the sheet's edge: the
   * lap is the photograph's own margin round the paper, never the drawing */
  bevel: .003,
  lap: .0015,
  /** the frame's sight face, its lip over the mat and its small arrises */
  face: .017,
  lip: .008,
  arris: .003,
} as const
export const FRAME_FRONT = MOUNT.matFace + MOUNT.lip

/** THE STANDARD MOUNTS. A print room mounts its sheets on a few board sizes
 * so frames and boxes can be reused; here three: the folio every portrait
 * sheet takes, the large board of the two great leg sheets, and the
 * landscape board. The frame is the board's outer size. */
export const BOARDS = {
  folio: { width: .34, height: .41 },
  large: { width: .40, height: .486 },
  landscape: { width: .53, height: .41 },
} as const
export type BoardName = keyof typeof BOARDS
export function boardOf(mount: BodyMount): BoardName {
  if (mount.width > mount.height) return 'landscape'
  return mount.height > .33 ? 'large' : 'folio'
}

/** The sheet as the plate stands it: the holder's size, the reproduction
 * contained in it without stretching. */
export function plateOf(mount: BodyMount): { width: number; height: number } {
  const k = Math.min(mount.width / mount.pixels.width, mount.height / mount.pixels.height)
  return { width: mount.pixels.width * k, height: mount.pixels.height * k }
}

export interface MountedSheet {
  mount: BodyMount
  board: BoardName
  /** the frame's outer rectangle and the window, north by height */
  frame: { south: number; north: number; bottom: number; top: number }
  window: { south: number; north: number; bottom: number; top: number }
}
export function mountedSheets(): MountedSheet[] {
  return bodyMounts().map(mount => {
    const board = boardOf(mount), size = BOARDS[board], plate = plateOf(mount)
    const w = plate.width / 2 - MOUNT.lap, h = plate.height / 2 - MOUNT.lap
    return {
      mount, board,
      frame: { south: mount.north - size.width / 2, north: mount.north + size.width / 2,
        bottom: mount.datum - size.height / 2, top: mount.datum + size.height / 2 },
      window: { south: mount.north - w, north: mount.north + w, bottom: mount.datum - h, top: mount.datum + h },
    }
  })
}

/** THE CASEWORK. The plan chest stands before the hang and holds the ledge
 * the construction welds in; its top is the leaning rail. The lining runs
 * from the south door to the chest's north end, and the hang is set into its
 * thickness. */
export const CHEST = {
  south: -55.38, north: -49.82,
  back: PLANE.finish, front: PLANE.finish + .66,
  /** the recessed toe and its set-back */
  toe: .08, toeBack: .06,
  /** the top: a thin board laid on the construction's ledge (its face at
   * FLOOR + .945), so the reading surface stands as low as the ledge allows,
   * and a deep oak band at its front edge that the drawers stop under; the
   * round bronze rail rides the band on small saddles */
  top: H(.952), board: .007, edge: .034, overhang: .025, rail: { radius: .016, over: .011, saddle: .7 },
  /** the shadow gap between the top and the linen inside the opening */
  gap: .03,
  /** four stacks of six drawers between oak stiles */
  stacks: 4, drawers: 6, stile: .035, joint: .006, proud: .004,
} as const
export const LINING = {
  south: OPENING.hallToSouth.north[1] + .08, north: CHEST.north,
  face: PLANE.finish + .18,
  /** run into the slab, so the gallery's head band closes over it and every
   * rib lands on its face */
  top: GALLERY.soffit + .01,
  /** the recessed toe, the panels' shadow joints and their depth */
  toe: H(.08), toeBack: .03, joint: .016, jointDepth: .014,
} as const

/** THE HEADS' LINE: a black track under the soffit's ribs a long stride off
 * the wall, each lamp face a hand under it. */
const TRACK_EAST = PLANE.finish + 1.75, TRACK_DEPTH = .034
const TRACK_FOOT = GALLERY.ribFoot - TRACK_DEPTH
const LAMP = TRACK_FOOT - .21

/** THE HANG'S OPENING in the lining: sized to the frames it holds, a sixth
 * of a metre clear at either side, its sill the chest's top. Its head is
 * splayed: the soffit meets the linen a hand over the top course (`back`)
 * and rises to the face (`head`) steeper than the heads' rays climb to it,
 * so they pass under its edge to the linen and land on the soffit itself. */
export const RECESS = (() => {
  const sheets = mountedSheets().filter(s => s.mount.row !== 'vortex')
  const reach = Math.max(...sheets.map(s => Math.abs(s.frame.north + 52.6)), ...sheets.map(s => Math.abs(s.frame.south + 52.6)))
  const top = Math.max(...sheets.map(s => s.frame.top))
  const splay = 50 * Math.PI / 180, back = top + .09
  return { south: -52.6 - reach - .16, north: -52.6 + reach + .16, sill: CHEST.top,
    back, head: back + (LINING.face - PLANE.linen) * Math.tan(splay), splay }
})()

/** THE TRACK THE HEADS HANG FROM, over the hang's whole width. */
export const TRACK = {
  east: TRACK_EAST,
  south: RECESS.south - .2, north: RECESS.north + .2,
  width: .03, depth: TRACK_DEPTH,
} as const

// ------------------------------------------------------------ the light

export type BodyLightKind = 'spot' | 'area'
/** Which surfaces a light reaches: the hang and the casework, or the sheet
 * that stands apart. */
export type BodyReceivers = 'cabinet' | 'vortex'
export interface BodyLight {
  name: string
  kind: BodyLightKind
  at: P3
  aim: P3
  kelvin: number
  /** the colour the lamp is seen in after the print, as the art direction
   * gives the museum's lamps; the kelvin is the fitting's nominal one */
  colour: string
  /** candela for a spot, luminance for an area */
  intensity: number
  angle: number
  penumbra: number
  /** an area's width and depth */
  width?: number
  height?: number
  /** a fitting on the track, drawn as a head */
  head: boolean
  receivers: BodyReceivers
  /** a map drawn from the cabinet's own casters */
  shadow?: { mapPx: number; soft: number }
  /** the live engine's stand-in for what the heads' optics lay on the wall:
   * a renderer that takes the heads as they are leaves it out */
  standIn?: true
  /** a fitting the export lights and the live engine draws only as a body */
  engine?: false
  /** a wallwasher's optic: `intensity` is then the illuminance its wash
   * lays on the wall plane at the band's middle on the lamp's own line */
  wash?: WashOptic
}

/** A WALLWASHER'S OPTIC, laid out as the wash it throws on the wall plane:
 * a band from its foot to its crown, soft at both, the crown dropping to
 * either side of the lamp's own line (the scallop), a spread along the wall,
 * and a weak tail under the foot. Its candela toward a ray is the wash at the
 * ray's hit on the plane times the cube of that distance over the lamp's
 * reach to the plane, so the plane takes the same light low and high. */
export interface WashOptic {
  /** the wall plane (east) the band is laid out on */
  plane: number
  foot: number; footSoft: number
  tail: number; tailFall: number
  crown: number; crownSoft: number
  /** how far the crown drops per square metre off the lamp's line */
  arc: number
  /** the spread along the wall, one standard deviation */
  spread: number
}
const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
/** The band's share at a height on the plane, `off` metres along the wall
 * from the lamp's own line. `body-wall-light.ts` draws the same formula. */
export function washBand(o: WashOptic, height: number, off: number): number {
  const lateral = Math.exp(-off * off / (2 * o.spread * o.spread))
  const crown = o.crown - o.arc * off * off
  const lit = smooth(o.foot - o.footSoft, o.foot, height)
  const foot = o.tail * Math.exp(Math.min(height - o.foot, 0) / o.tailFall) * (1 - lit) + lit
  return lateral * (1 - smooth(crown - o.crownSoft, crown, height)) * foot
}

/** the small dark-steel heads on the track, a stride apart over the hang */
export const HEAD_NORTHS = [-54.1, -53.5, -52.9, -52.3, -51.7, -51.1] as const
/** THEIR OPTIC: a band from the bottom course's foot to the splayed
 * soffit, its scallops breaking on the soffit, its foot fading over the
 * linen under the bottom course so the counter stays out of the beam. */
export const WASH: WashOptic = {
  plane: PLANE.linen,
  foot: H(1.02), footSoft: .12, tail: .08, tailFall: .3,
  crown: RECESS.back + .12, crownSoft: .1, arc: .55,
  spread: .28,
}

/** THE SHEET THAT STANDS APART is read by one head of its own, hung from the
 * soffit over it. */
const VORTEX_NORTH = -48.55
export const VORTEX_HEAD: P3 = [TRACK.east, VORTEX_NORTH, LAMP]

export const BODY_LIGHTS: readonly BodyLight[] = [
  ...HEAD_NORTHS.map((north, i): BodyLight => ({
    name: `head-${i + 1}`, kind: 'spot', head: true, receivers: 'cabinet',
    at: [TRACK.east, north, LAMP], aim: [PLANE.linen, north, H(1.95)], kelvin: 3100, colour: '#ffe0b8',
    intensity: 1.5, angle: .63, penumbra: .1, wash: WASH, shadow: { mapPx: 1024, soft: 3 },
  })),
  {
    // THE HANG'S BOUNCE: the lit pages and mats throw the wash back up into
    // the splayed head and the jambs; a renderer with true bounce finds it
    // by itself
    name: 'bounce', kind: 'area', head: false, receivers: 'cabinet', standIn: true,
    at: [CHEST.back + .33, -52.6, CHEST.top + .004], aim: [CHEST.back + .33, -52.6, CHEST.top + 1],
    width: RECESS.north - RECESS.south, height: .6,
    kelvin: 3100, colour: '#ffd9ad', intensity: .22, angle: 0, penumbra: 0,
  },
  {
    name: 'vortex', kind: 'spot', head: true, receivers: 'vortex',
    at: VORTEX_HEAD, aim: [PLANE.linen, VORTEX_NORTH, H(2.1845)], kelvin: 3100, colour: '#ffe0b8', intensity: 11, angle: .3, penumbra: .8, shadow: { mapPx: 512, soft: 2 },
  },
]

/** The layer only the cabinet's shadowed light draws its map from. */
export const BODY_SHADOW_LAYER = 6

/** Where the cabinet's bounce is read: before the hang at eye height. */
export const PROBE_AT: P3 = [PLANE.finish + 1.6, -52.6, H(1.6)]

// ------------------------------------------------------------ geometry

export type Grain = 'north' | 'up' | 'east'
export interface Rod { a: P3; b: P3; radius: number; radiusB?: number; sides?: number }
/** A board of the casework: its box, which way its grain runs, where its
 * own read of the photograph starts, and the albedo it is laid at. */
export interface Board { box: Box; grain: Grain; offset: [number, number]; tone: [number, number, number]
  /** how much this board's oiled finish is duller or brighter than its wood's */
  rough?: number }

/** A deterministic hash, so every board keeps its own tone and its own
 * piece of the photograph from build to build. */
export function hash(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return s - Math.floor(s)
}
const toned = (base: [number, number, number], i: number, salt: number, swing = .08): [number, number, number] => {
  const k = 1 + (hash(i, salt) - .5) * 2 * swing, warm = (hash(i, salt + 7) - .5) * .05
  return [base[0] * k * (1 + warm), base[1] * k, base[2] * k * (1 - warm)]
}

/** Faces with UVs in metres (across the grain, along it), a grain axis and a
 * tone per vertex. Quads are wound to face their normal. */
export class Faces {
  private p: number[] = []; private n: number[] = []; private u: number[] = []; private t: number[] = []; private g: number[] = []; private r: number[] = []
  quad(c: Vector3[], normal: Vector3, uvs: [number, number][], tone: readonly [number, number, number], grain: Grain, rough = 0): void {
    const cross = c[1]!.clone().sub(c[0]!).cross(c[2]!.clone().sub(c[0]!))
    const order = cross.dot(normal) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]
    const axis = grain === 'up' ? [0, 1, 0] : grain === 'east' ? [1, 0, 0] : [0, 0, -1]
    for (const i of order) {
      this.p.push(c[i]!.x, c[i]!.y, c[i]!.z); this.n.push(normal.x, normal.y, normal.z)
      this.u.push(uvs[i]![0], uvs[i]![1]); this.t.push(...tone); this.g.push(axis[0]!, axis[1]!, axis[2]!); this.r.push(rough)
    }
  }
  /** a box in the wing's frame, every face but those named left out */
  board(q: Board, skip: readonly ('west' | 'east' | 'south' | 'north' | 'bottom' | 'top')[] = []): void {
    const [w, s, b, e, n, t] = q.box
    if (e - w <= 0 || n - s <= 0 || t - b <= 0) return
    const along = (p: P3): number => q.grain === 'up' ? p[2] : q.grain === 'east' ? p[0] : p[1]
    const faces: { name: 'west' | 'east' | 'south' | 'north' | 'bottom' | 'top'; c: P3[]; normal: P3 }[] = [
      { name: 'east', c: [[e, s, b], [e, n, b], [e, n, t], [e, s, t]], normal: [1, 0, 0] },
      { name: 'west', c: [[w, s, b], [w, n, b], [w, n, t], [w, s, t]], normal: [-1, 0, 0] },
      { name: 'top', c: [[w, s, t], [e, s, t], [e, n, t], [w, n, t]], normal: [0, 0, 1] },
      { name: 'bottom', c: [[w, s, b], [e, s, b], [e, n, b], [w, n, b]], normal: [0, 0, -1] },
      { name: 'north', c: [[w, n, b], [e, n, b], [e, n, t], [w, n, t]], normal: [0, 1, 0] },
      { name: 'south', c: [[w, s, b], [e, s, b], [e, s, t], [w, s, t]], normal: [0, -1, 0] },
    ]
    for (const f of faces) {
      if (skip.includes(f.name)) continue
      // across the grain: whichever in-plane axis the grain is not
      const across = (p: P3): number => {
        const flat = f.normal
        const axes = [{ v: p[0], a: 0 }, { v: p[1], a: 1 }, { v: p[2], a: 2 }]
          .filter(x => flat[x.a] === 0 && x.a !== (q.grain === 'east' ? 0 : q.grain === 'north' ? 1 : 2))
        return axes[0]?.v ?? 0
      }
      const uvs = f.c.map(p => [across(p) + q.offset[0], along(p) + q.offset[1]] as [number, number])
      this.quad(f.c.map(p => v3(...p)), v3(...f.normal).normalize(), uvs, q.tone, q.grain, q.rough ?? 0)
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
    g.setAttribute('grainAxis', new Float32BufferAttribute(this.g, 3))
    g.setAttribute('pieceRough', new Float32BufferAttribute(this.r, 1))
    g.computeBoundingBox(); g.computeBoundingSphere()
    return g
  }
}

/** THE WOODS, linear albedo: the lining's fumed oak, the chest's and the
 * reveals' oiled oak, the frames a shade warmer, the chest's top lighter. */
export const WOOD = {
  fumed: [.075, .052, .036] as [number, number, number],
  oak: [.2, .135, .082] as [number, number, number],
  frame: [.17, .108, .062] as [number, number, number],
  top: [.23, .16, .1] as [number, number, number],
  /** the reading surface, fumed darker than its edge and waxed dull, so the
   * hang keeps the light and the top gives the room no sheen */
  reading: [.1, .07, .048] as [number, number, number],
}

/** Equal panels over a run, with joints between them. */
function panels(from: number, to: number, count: number, joint: number): [number, number][] {
  const width = (to - from - (count - 1) * joint) / count
  return Array.from({ length: count }, (_, i) => [from + i * (width + joint), from + i * (width + joint) + width])
}

/** THE LINING: fumed oak panels on a dark core, shadow joints between them,
 * a recessed toe, the hang's opening cut through it with oiled oak reveals.
 * Returns the panels, the core that shows in the joints, and the reveals. */
export function liningBoards(): { panels: Board[]; core: Board[]; reveals: Board[] } {
  const L = LINING, R = RECESS, out: Board[] = [], core: Board[] = [], reveals: Board[] = []
  const back = PLANE.finish - .004, face = L.face, deep = face - L.jointDepth
  const lowTop = CHEST.top - L.joint / 2, highBottom = CHEST.top + L.joint / 2
  /** the opening's oak lipping, a board's thickness round its three sides */
  const lip = REVEAL_LIP
  let i = 0
  const panel = (s: number, n: number, b: number, t: number): void => {
    out.push({ box: [deep - .002, s, b, face, n, t], grain: 'up',
      offset: [hash(i, 11) * 1.83, hash(i, 12) * 2.9], tone: toned(WOOD.fumed, i, 13, .07), rough: (hash(i, 14) - .5) * .16 })
    i++
  }
  // the long run south of the chest: seven panels, low and high
  for (const [s, n] of panels(L.south, CHEST.south, 7, L.joint)) {
    panel(s, n, L.toe, lowTop)
    panel(s, n, highBottom, L.top)
  }
  // either side of the opening, over the chest, a joint clear of its lipping
  panel(CHEST.south + L.joint, R.south - lip - L.joint, highBottom, L.top)
  panel(R.north + lip + L.joint, L.north, highBottom, L.top)
  // the head over the opening, a joint clear of the head's lipping
  panel(R.south - lip, R.north + lip, R.head + lip + L.joint, L.top)
  // THE CORE the joints open onto, run a bed into the finish and cut round
  // the opening; the toe's own recess stands in front of it
  const dark: [number, number, number] = [.028, .024, .02]
  core.push({ box: [back, L.south, L.toe - .002, deep, R.south - lip, L.top], grain: 'up', offset: [.3, .2], tone: dark })
  core.push({ box: [back, R.north + lip, L.toe - .002, deep, L.north, L.top], grain: 'up', offset: [.5, .1], tone: dark })
  core.push({ box: [back, R.south - lip, R.head + lip, deep, R.north + lip, L.top], grain: 'north', offset: [.2, .6], tone: dark })
  core.push({ box: [back, L.south, FLOOR - .004, face - L.toeBack, CHEST.south, L.toe], grain: 'north', offset: [.1, .7], tone: [.02, .018, .016] })
  // the two ends, lipped in the same fumed oak
  out.push({ box: [back, L.south - .012, L.toe, face, L.south, L.top], grain: 'up', offset: [.6, .4], tone: toned(WOOD.fumed, 40, 13, 0) })
  out.push({ box: [back, L.north, CHEST.top, face, L.north + .012, L.top], grain: 'up', offset: [.8, .3], tone: toned(WOOD.fumed, 41, 13, 0) })
  // THE OPENING'S JAMBS: oiled oak lining the lining's own thickness, a
  // lipping that reads on the face as the opening's frame; the splayed head
  // is `splayFaces`
  reveals.push({ box: [PLANE.linen - .002, R.south - lip, R.sill, face + .002, R.south, R.head + lip], grain: 'up', offset: [.2, .3], tone: toned(WOOD.oak, 1, 17, .04) })
  reveals.push({ box: [PLANE.linen - .002, R.north, R.sill, face + .002, R.north + lip, R.head + lip], grain: 'up', offset: [.9, .1], tone: toned(WOOD.oak, 2, 17, .04) })
  return { panels: out, core, reveals }
}
/** the opening's oak lipping */
export const REVEAL_LIP = .016

/** THE SPLAYED HEAD: one oiled oak board from the linen's head up to the
 * face, and its lipping on the face over the opening. */
export function splayFaces(f: Faces): void {
  const R = RECESS, lip = REVEAL_LIP, rise = Math.tan(R.splay)
  const back = PLANE.linen - .004, front = LINING.face + .002
  const at = (e: number): number => R.back + (e - PLANE.linen) * rise
  const tone = toned(WOOD.oak, 3, 17, .04), run = Math.hypot(front - back, at(front) - at(back))
  const under = [v3(back, R.south, at(back)), v3(front, R.south, at(front)), v3(front, R.north, at(front)), v3(back, R.north, at(back))]
  // across the grain runs up the slope, along it runs north
  f.quad(under, v3(Math.sin(R.splay), 0, -Math.cos(R.splay)).normalize(),
    [[.4, R.south + .8], [.4 + run, R.south + .8], [.4 + run, R.north + .8], [.4, R.north + .8]], tone, 'north')
  const face = [v3(front, R.south, at(front)), v3(front, R.north, at(front)), v3(front, R.north, R.head + lip), v3(front, R.south, R.head + lip)]
  f.quad(face, v3(1, 0, 0), [[.4 + run, R.south + .8], [.4 + run, R.north + .8], [.4 + run + lip, R.north + .8], [.4 + run + lip, R.south + .8]], tone, 'north')
}

/** THE PLAN CHEST: four stacks of six drawers between oak stiles, on a
 * recessed dark toe, under a top whose front edge is the bronze rail. */
export function chestBoards(): { oak: Board[]; toe: Board[]; bronze: Box[]; rail: Rod[] } {
  const C = CHEST, oak: Board[] = [], toe: Board[] = [], bronze: Box[] = [], rail: Rod[] = []
  const bottom = FLOOR + C.toe, underTop = C.top - C.edge, board = C.top - C.board, end = .018
  // the carcass behind the fronts, dark where a joint opens onto it, closed
  // up to the top over the ledge it holds
  oak.push({ box: [C.back - .004, C.south + end, bottom, C.front - C.proud, C.north - end, board], grain: 'up', offset: [.5, .5], tone: toned(WOOD.fumed, 50, 21, 0).map(c => c * .35) as [number, number, number] })
  // its two ends, full boards of the lining's fumed oak from the wall to the front
  oak.push({ box: [C.back - .004, C.south, bottom, C.front - C.proud - .004, C.south + end, board], grain: 'up', offset: [.7, .2], tone: toned(WOOD.fumed, 51, 21, .03) })
  oak.push({ box: [C.back - .004, C.north - end, bottom, C.front - C.proud - .004, C.north, board], grain: 'up', offset: [.1, .6], tone: toned(WOOD.fumed, 52, 21, .03) })
  const run = C.north - C.south, stack = (run - (C.stacks + 1) * C.stile) / C.stacks
  for (let k = 0; k <= C.stacks; k++) {
    const s = C.south + k * (stack + C.stile)
    oak.push({ box: [C.front - C.proud - .004, s, bottom, C.front, s + C.stile, underTop], grain: 'up',
      offset: [hash(k, 22) * 1.83, hash(k, 23) * 2.9], tone: toned(WOOD.fumed, k, 24, .05) })
  }
  const height = (underTop - bottom - (C.drawers + 1) * C.joint) / C.drawers
  let d = 0
  for (let k = 0; k < C.stacks; k++) {
    const s = C.south + C.stile + k * (stack + C.stile)
    for (let j = 0; j < C.drawers; j++) {
      const b = bottom + C.joint + j * (height + C.joint)
      oak.push({ box: [C.front - C.proud - .002, s + C.joint, b, C.front, s + stack - C.joint, b + height], grain: 'north',
        offset: [hash(d, 25) * 1.83, hash(d, 26) * 2.9], tone: toned(WOOD.fumed, d, 27, .08), rough: (hash(d, 28) - .5) * .12 })
      // a pair of small bronze pulls at the drawer's head, a hand's span in
      // from either end of its run
      for (const at of [s + stack * .23, s + stack * .77])
        bronze.push([C.front, at - .045, b + height - .034, C.front + .011, at + .045, b + height - .022])
      d++
    }
  }
  // the top over the ledge, stopped short of the linen inside the opening
  // by a shadow gap, so the hang stands clear of the counter; and the deep
  // oak band at its front edge
  const O = RECESS, gap = C.back + C.gap
  for (const [back, south, north] of [[C.back - .004, C.south - .015, O.south], [gap, O.south, O.north], [C.back - .004, O.north, C.north + .015]] as const)
    oak.push({ box: [back, south, board, C.front + C.overhang, north, C.top], grain: 'north', offset: [.35, .9], tone: WOOD.reading, rough: .32 })
  toe.push({ box: [C.back - .004, O.south, board, gap, O.north, board + .002], grain: 'north', offset: [0, 0], tone: [.02, .018, .016] })
  oak.push({ box: [C.front - .03, C.south - .015, underTop, C.front + C.overhang, C.north + .015, board], grain: 'north',
    offset: [.8, .3], tone: toned(WOOD.top, 61, 21, .02) })
  // THE RAIL: a round bronze bar over the top's front edge, its ends a
  // hand short of the chest's, on a saddle every stride
  const R = C.rail, railEast = C.front + C.overhang - R.radius * .4, railHeight = C.top + R.over
  rail.push({ a: [railEast, C.south + .06, railHeight], b: [railEast, C.north - .06, railHeight], radius: R.radius, sides: 20 })
  const saddles = Math.round((C.north - C.south - .12) / R.saddle)
  for (let k = 0; k <= saddles; k++) {
    const n = C.south + .09 + k * (C.north - C.south - .18) / saddles
    bronze.push([railEast - .012, n - .018, C.top - .001, railEast + .012, n + .018, railHeight - R.radius * .6])
  }
  // the toe, set back from the front and both ends
  toe.push({ box: [C.back - .004, C.south + C.toeBack, FLOOR - .004, C.front - C.toeBack, C.north - C.toeBack, bottom], grain: 'north', offset: [0, 0], tone: [.025, .022, .02] })
  return { oak, toe, bronze, rail }
}

/** THE LINEN the hang stands on: three linen-wrapped boards over the
 * opening's back, of two, three and two columns, their joints in the gaps
 * between the frames, on a dark backer that shows in the joints. Each board
 * is its own dye lot. */
export const LINEN_JOINT = .004
export function linenBoards(): { panels: Board[]; backer: Board } {
  const R = RECESS, sheets = mountedSheets().filter(s => s.mount.row !== 'vortex')
  const edge = (column: number, side: 'north' | 'south'): number => {
    const own = sheets.filter(s => s.mount.column === column).map(s => s.frame[side])
    return side === 'north' ? Math.max(...own) : Math.min(...own)
  }
  const joints = [1, 4].map(c => (edge(c, 'north') + edge(c + 1, 'south')) / 2)
  const bounds = [R.south - .02, ...joints.flatMap(j => [j - LINEN_JOINT / 2, j + LINEN_JOINT / 2]), R.north + .02]
  const bottom = R.sill - .01, top = R.back + .02, back = PLANE.finish + .0008
  const panels: Board[] = []
  for (let i = 0; i < bounds.length; i += 2)
    panels.push({ box: [back, bounds[i]!, bottom, PLANE.linen, bounds[i + 1]!, top], grain: 'up', offset: [hash(i, 41) * 3, hash(i, 42) * 3], tone: toned([1, 1, 1], i, 43, .035) })
  return { panels, backer: { box: [PLANE.finish - .004, R.south - .02, bottom, PLANE.finish + .0004, R.north + .02, top], grain: 'up', offset: [0, 0], tone: [.012, .011, .01] } }
}

/** A FRAME, swept round its rectangle from a profile of (inset from the
 * outer edge, height over the linen): its four members meet on true mitres
 * and each carries its grain along its own length. */
export function frameRing(f: Faces, rect: { south: number; north: number; bottom: number; top: number }, i: number): void {
  const M = MOUNT, depth = FRAME_FRONT - PLANE.linen, lipFoot = M.matFace - PLANE.linen - .004
  const profile: [number, number][] = [
    [0, 0], [0, depth - M.arris], [M.arris, depth], [M.face - .0015, depth], [M.face, depth - .0015], [M.face, lipFoot],
  ]
  const { south: s, north: n, bottom: b, top: t } = rect
  // each side: where its line runs at inset l, and which way its outer edge faces
  const sides: { point: (l: number, u: number) => [number, number]; out: [number, number]; grain: Grain }[] = [
    { point: (l, u) => [s + l + u * (n - s - 2 * l), b + l], out: [0, -1], grain: 'north' },
    { point: (l, u) => [n - l, b + l + u * (t - b - 2 * l)], out: [1, 0], grain: 'up' },
    { point: (l, u) => [n - l - u * (n - s - 2 * l), t - l], out: [0, 1], grain: 'north' },
    { point: (l, u) => [s + l, t - l - u * (t - b - 2 * l)], out: [-1, 0], grain: 'up' },
  ]
  sides.forEach((side, k) => {
    const tone = toned(WOOD.frame, i * 4 + k, 31, .05)
    const offset: [number, number] = [hash(i * 4 + k, 32) * 1.83, hash(i * 4 + k, 33) * 2.9]
    for (let j = 0; j + 1 < profile.length; j++) {
      const [l0, x0] = profile[j]!, [l1, x1] = profile[j + 1]!
      const a0 = side.point(l0, 0), a1 = side.point(l0, 1), b1 = side.point(l1, 1), b0 = side.point(l1, 0)
      const c = [[x0, a0], [x0, a1], [x1, b1], [x1, b0]].map(([x, q]) => v3(PLANE.linen + (x as number), (q as [number, number])[0], (q as [number, number])[1]))
      // the section's own normal: the profile edge turned a quarter, outward
      const dl = l1 - l0, dx = x1 - x0, len = Math.hypot(dl, dx)
      // the outward normal is the profile edge turned left: (-dx, dl) in
      // (inset, height), and the inset runs against the side's own outside
      const normal = v3(dl / len, side.out[0] * dx / len, side.out[1] * dx / len).normalize()
      const along = (p: Vector3): number => side.grain === 'up' ? p.y : -p.z
      const acrossAt = (x: number, l: number): number => x + l
      const uvs: [number, number][] = [
        [acrossAt(x0, l0) + offset[0], along(c[0]!) + offset[1]], [acrossAt(x0, l0) + offset[0], along(c[1]!) + offset[1]],
        [acrossAt(x1, l1) + offset[0], along(c[2]!) + offset[1]], [acrossAt(x1, l1) + offset[0], along(c[3]!) + offset[1]],
      ]
      f.quad(c, normal, uvs, tone, side.grain)
    }
  })
}

/** THE MAT: the board's face from its window's bevel out under the frame's
 * lip, and the four bevels down to the sheet. UVs in metres on the wall;
 * the tone carries 1 on the face and 0 on the bevel's white core. */
export function matFaces(f: Faces, sheet: MountedSheet): void {
  const M = MOUNT, w = sheet.window, r = sheet.frame
  const face = M.matFace, back = M.matBack, x = (e: number, n: number, h: number): Vector3 => v3(e, n, h)
  const o = { south: r.south + M.face - .001, north: r.north - M.face + .001, bottom: r.bottom + M.face - .001, top: r.top - M.face + .001 }
  const i = { south: w.south - M.bevel, north: w.north + M.bevel, bottom: w.bottom - M.bevel, top: w.top + M.bevel }
  const east = v3(1, 0, 0), faceTone: [number, number, number] = [1, 1, 1]
  const uv = (p: Vector3): [number, number] => [-p.z, p.y]
  const ring = (a: typeof o, bnd: typeof i): void => {
    for (const [c0, c1, c2, c3] of [
      [[a.south, a.bottom], [a.north, a.bottom], [a.north, bnd.bottom], [a.south, bnd.bottom]],
      [[a.south, bnd.top], [a.north, bnd.top], [a.north, a.top], [a.south, a.top]],
      [[a.south, bnd.bottom], [bnd.south, bnd.bottom], [bnd.south, bnd.top], [a.south, bnd.top]],
      [[bnd.north, bnd.bottom], [a.north, bnd.bottom], [a.north, bnd.top], [bnd.north, bnd.top]],
    ] as [number, number][][]) {
      const c = [c0!, c1!, c2!, c3!].map(([n, h]) => x(face, n, h))
      f.quad(c, east, c.map(uv), faceTone, 'north')
    }
  }
  ring(o, i)
  // the bevels: from the face's window edge down to the window over the sheet
  const core: [number, number, number] = [0, 0, 0]
  const bevel = (p: [number, number, number][], normal: Vector3): void => {
    const c = p.map(([e, n, h]) => x(e, n, h))
    f.quad(c, normal.normalize(), c.map(uv), core, 'north')
  }
  bevel([[face, i.south, i.bottom], [face, i.north, i.bottom], [back, w.north, w.bottom], [back, w.south, w.bottom]], v3(1, 0, 1))
  bevel([[back, w.south, w.top], [back, w.north, w.top], [face, i.north, i.top], [face, i.south, i.top]], v3(1, 0, -1))
  bevel([[face, i.south, i.bottom], [back, w.south, w.bottom], [back, w.south, w.top], [face, i.south, i.top]], v3(1, 1, 0))
  bevel([[back, w.north, w.bottom], [face, i.north, i.bottom], [face, i.north, i.top], [back, w.north, w.top]], v3(1, -1, 0))
}

/** THE SMALL DARK-STEEL HEADS: an adaptor in the track, a stem, a short can
 * aimed at the wall, and its lens. Every head of the table, the stand-in
 * apart, is one of these. */
export function fittings(): { boxes: Box[]; rods: Rod[]; lenses: Rod[] } {
  const boxes: Box[] = [], rods: Rod[] = [], lenses: Rod[] = []
  const T = TRACK
  boxes.push([T.east - T.width / 2, T.south, TRACK_FOOT, T.east + T.width / 2, T.north, GALLERY.ribFoot])
  for (let n = T.south + .35; n < T.north; n += 1.3) {
    if (GALLERY.ribsNorth.some(r => Math.abs(r - n) < .3)) continue
    rods.push({ a: [T.east, n, GALLERY.soffit], b: [T.east, n, GALLERY.ribFoot], radius: .004, sides: 8 })
  }
  // the head over the sheet apart hangs from its own rod
  rods.push({ a: [VORTEX_HEAD[0], VORTEX_HEAD[1], GALLERY.soffit], b: [VORTEX_HEAD[0], VORTEX_HEAD[1], TRACK_FOOT], radius: .005, sides: 8 })
  boxes.push([VORTEX_HEAD[0] - .03, VORTEX_HEAD[1] - .022, TRACK_FOOT - .012, VORTEX_HEAD[0] + .03, VORTEX_HEAD[1] + .022, TRACK_FOOT])
  for (const light of BODY_LIGHTS) {
    if (!light.head) continue
    const at = v3(...light.at), aim = v3(...light.aim)
    const axis = aim.clone().sub(at).normalize()
    const wing = (p: Vector3): P3 => [p.x, -p.z, p.y]
    const onRod = light.name !== 'vortex'
    if (onRod) boxes.push([light.at[0] - .025, light.at[1] - .02, TRACK_FOOT - .045, light.at[0] + .025, light.at[1] + .02, TRACK_FOOT])
    const pivot = at.clone().addScaledVector(axis, -.07)
    rods.push({ a: [light.at[0], light.at[1], TRACK_FOOT - (onRod ? .045 : .012)], b: wing(pivot.clone().add(new Vector3(0, .05, 0))), radius: .006, sides: 8 })
    const along = (t: number): P3 => wing(at.clone().addScaledVector(axis, t))
    rods.push({ a: along(-.13), b: along(-.005), radius: .034, sides: 20 })
    rods.push({ a: along(-.005), b: along(.035), radius: .035, radiusB: .038, sides: 20 })
    lenses.push({ a: along(-.012), b: along(-.008), radius: .027, sides: 20 })
  }
  return { boxes, rods, lenses }
}

// ------------------------------------------------------------ checks

/** WHAT THE CABINET'S SHADOWED LIGHT SEES: every frame's four members, the
 * opening's head and sides, and the chest, on the cabinet's own layer. */
export function shadowCasters(): Box[] {
  // every box stands a hair inside the faces it doubles, so no lit face is
  // ever inside its own caster
  const out: Box[] = [], e = .0015
  for (const s of mountedSheets()) {
    const r = s.frame, f = MOUNT.face, back = PLANE.linen + e, front = FRAME_FRONT - e
    out.push([back, r.south + e, r.bottom + e, front, r.north - e, r.bottom + f])
    out.push([back, r.south + e, r.top - f, front, r.north - e, r.top - e])
    out.push([back, r.south + e, r.bottom + f, front, r.south + f, r.top - f])
    out.push([back, r.north - f, r.bottom + f, front, r.north - e, r.top - f])
  }
  const R = RECESS, L = LINING, lip = REVEAL_LIP, face = L.face - .01
  out.push([PLANE.finish, R.south - lip - .3, R.head + .002, face, R.north + lip + .3, L.top])
  out.push([PLANE.finish, R.south - lip - .6, R.sill + .01, face, R.south - .002, L.top])
  out.push([PLANE.finish, R.north + .002, R.sill + .01, face, R.north + lip + .6, L.top])
  return out
}

/** Every solid the cabinet raises that stands out of the finish, by name,
 * for the certificate's supplement. */
export function bodyWallSolids(): { name: string; box: Box }[] {
  const out: { name: string; box: Box }[] = []
  const L = LINING
  out.push({ name: 'lining', box: [PLANE.finish, L.south - .012, FLOOR, L.face, L.north, L.top] })
  const chest = chestBoards()
  chest.oak.forEach((q, i) => out.push({ name: `chest-${i}`, box: q.box }))
  chest.bronze.forEach((box, i) => out.push({ name: `bronze-${i}`, box }))
  chest.rail.forEach((rod, i) => out.push({ name: `rail-${i}`, box: rodBox(rod) }))
  mountedSheets().forEach(s => out.push({ name: `frame/${s.mount.id}`, box: [PLANE.linen, s.frame.south, s.frame.bottom, FRAME_FRONT, s.frame.north, s.frame.top] }))
  const f = fittings()
  f.boxes.forEach((box, i) => out.push({ name: `fitting-${i}`, box }))
  for (const [i, rod] of [...f.rods, ...f.lenses].entries()) out.push({ name: `rod-${i}`, box: rodBox(rod) })
  return out
}
function rodBox(rod: Rod): Box {
  const r = Math.max(rod.radius, rod.radiusB ?? 0)
  return [Math.min(rod.a[0], rod.b[0]) - r, Math.min(rod.a[1], rod.b[1]) - r, Math.min(rod.a[2], rod.b[2]) - r,
    Math.max(rod.a[0], rod.b[0]) + r, Math.max(rod.a[1], rod.b[1]) + r, Math.max(rod.a[2], rod.b[2]) + r]
}
