/** THE MECHANISM HALL'S FABRIC, FOR THE FILM: a sealed concrete floor cut into
 * bays, cast concrete walls with their formwork joints and tie holes, the same
 * concrete on the beams, and between them oak slats over a dark backing, which
 * the clerestory's sky runs along. Laid as a finish over the hall's
 * certified construction, which stays exactly where and what it was: nothing
 * here is a rail solid, a caster for the sun, or any other room's surface.
 * The photographs are CC0 library sets; the bays, the joints, the tint and the
 * drift over them are the museum's own. No 1517 claim: a modern room.
 */
import {
  BufferGeometry, ClampToEdgeWrapping, DataTexture, Float32BufferAttribute, FrontSide, Group, LinearFilter,
  LinearMipmapLinearFilter, Mesh, MeshStandardNodeMaterial, NoColorSpace, PhysicalLightingModel, PlaneGeometry,
  RepeatWrapping, RGBAFormat, UnsignedByteType, Vector2, Vector3, type Material,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import type { Stack } from '../../../stack'
import type { MaterialSet } from '../../../stack/materials'
import { axisFootprint, lineCoverage } from '../../../stack/detail'
import { DARK_BAY, FACE, FLOOR, HALL_CEILING_SOUTH, OPENING, ROOMS } from './layout'
import { standBoxes } from './stands'
import {
  bakeFloorTile, bakeHallFloor, hallFloorPlan, HALL_FLOOR_BAY, HALL_FLOOR_MAP, HALL_FLOOR_PROVENANCE, HALL_FLOOR_SHELF, HALL_FLOOR_TILE,
} from './hall-floor'

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

export const HALL_FABRIC_PROVENANCE = {
  manifestId: 'vinci/collection-hall-fabric', assetClass: 'GENERATED', certainty: 'reconstructed',
} as const

/** The hall's roof falls south from its clerestory; its beams follow it. */
const hallSoffit = (north: number): number => 1.05 - .75 * (-42.5 - north) / 22.2
const BEAMS = [-46, -50, -54, -58, -62] as const
/** How far the finish stands in front of the lining, past its ribs and base. */
const PROUD = .045
/** The wall finish stops this far over the floor: a shadow gap, not a skirting. */
const GAP = .055
/** The floor is cut into bays of two museum stones each way. */
const BAY = HALL_FLOOR_BAY
/** The ceiling's slats: wide enough apart that twenty metres off they are
 * still lines and not a moire. */
const SLAT = { width: .09, depth: .055, pitch: .15 } as const

type P3 = [number, number, number]

/** Quads in the wing's frame (east, north, height), wound to face `facing`. */
class Skin {
  private p: number[] = []
  private n: number[] = []
  quad(a: P3, b: P3, c: P3, d: P3, facing: P3): void {
    const w = (q: P3): Vector3 => new Vector3(q[0], q[2], -q[1])
    const v = [w(a), w(b), w(c), w(d)]
    const normal = v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).normalize()
    const want = w(facing).normalize()
    const flip = normal.dot(want) < 0
    if (flip) normal.negate()
    for (const i of flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) {
      this.p.push(v[i]!.x, v[i]!.y, v[i]!.z)
      this.n.push(normal.x, normal.y, normal.z)
    }
  }
  /** a wall face running east to west at one north, from `low` to a top that
      may fall with the roof */
  eastWest(north: number, facing: 1 | -1, west: number, east: number, low: number, top: (e: number) => number): void {
    this.quad([west, north, low], [east, north, low], [east, north, top(east)], [west, north, top(west)], [0, facing, 0])
  }
  northSouth(east: number, facing: 1 | -1, south: number, north: number, low: number, top: (n: number) => number): void {
    this.quad([east, south, low], [east, north, low], [east, north, top(north)], [east, south, top(south)], [facing, 0, 0])
  }
  /** a box's faces, `skin` proud of it; the underside only where asked */
  box(east: number, north: number, height: number, width: number, depth: number, tall: number, skin: number, under: boolean): void {
    const w = east - width / 2 - skin, e = east + width / 2 + skin
    const s = north - depth / 2 - skin, n = north + depth / 2 + skin
    const lo = height - tall / 2 - (under ? skin : 0), hi = height + tall / 2 + skin
    this.quad([w, s, hi], [e, s, hi], [e, n, hi], [w, n, hi], [0, 0, 1])
    if (under) this.quad([w, s, lo], [e, s, lo], [e, n, lo], [w, n, lo], [0, 0, -1])
    this.eastWest(s, -1, w, e, lo, () => hi)
    this.eastWest(n, 1, w, e, lo, () => hi)
    this.northSouth(w, -1, s, n, lo, () => hi)
    this.northSouth(e, 1, s, n, lo, () => hi)
  }
  get empty(): boolean { return this.p.length === 0 }
  geometry(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3))
    g.computeBoundingBox(); g.computeBoundingSphere()
    return g
  }
}

/** Runs of a span with gaps cut out of it. */
function runs(from: number, to: number, gaps: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  let cursor = from
  for (const [a, b] of [...gaps].sort((x, y) => x[0] - y[0])) {
    if (a > cursor) out.push([cursor, a])
    cursor = Math.max(cursor, b)
  }
  if (cursor < to) out.push([cursor, to])
  return out
}

/** THE FOUR WALLS, THE SOFFIT AND THE BEAMS as skins: walls, overhead, floor,
 * the plinths under the hall's machines, and between the beams a ceiling of
 * oak slats over a dark backing. Doors are left open to their reveals and
 * lintels. */
function skins(): { walls: Skin; overhead: Skin; floor: Skin; plinths: Skin; slats: Skin; backing: Skin } {
  const H = ROOMS.hall, walls = new Skin(), overhead = new Skin(), floor = new Skin(), plinths = new Skin()
  const slats = new Skin(), backing = new Skin()
  for (const b of standBoxes()) {
    if (b.east < H.west || b.east > H.east || b.north < H.south || b.north > H.north) continue
    // the top slab stands over a shadow gap, so its underside is seen
    plinths.box(b.east, b.north, b.height, b.width, b.depth, b.tall, .005, b.role === 2)
  }
  const low = FLOOR + GAP
  const lintel = -2.5 + .26
  const roofAt = (north: number): number => hallSoffit(north) - .012
  // THE SHADOW GAP IS DARK. Behind it stands the old lining's base band,
  // 36 mm off the wall, which the hall's own light never reaches and which
  // read as a pale line: the backing stands in front of it, 6 mm back.
  const recess = .006, gapTop = (): number => low + .004
  // the west wall and the south wall run whole, up to the roof
  walls.northSouth(H.west + PROUD, 1, H.south, H.north, low, roofAt)
  backing.northSouth(H.west + PROUD - recess, 1, H.south, H.north, FLOOR, gapTop)
  walls.eastWest(H.south + PROUD, 1, H.west, H.east, low, () => roofAt(H.south))
  backing.eastWest(H.south + PROUD - recess, 1, H.west, H.east, FLOOR, gapTop)
  // the partition to the gallery, open at its two doors up to their lintels
  const east = H.east - PROUD
  const gallery: [number, number] = [OPENING.hallToGallery.north[0], OPENING.hallToGallery.north[1] - .1]
  const south: [number, number] = [OPENING.hallToSouth.north[0] + .1, OPENING.hallToSouth.north[1]]
  for (const [a, b] of runs(H.south, H.north, [gallery, south])) {
    walls.northSouth(east, -1, a, b, low, roofAt)
    backing.northSouth(east + recess, -1, a, b, FLOOR, gapTop)
  }
  for (const [a, b] of [gallery, south]) walls.northSouth(east, -1, a, b, lintel, roofAt)
  // the hanging wall's back, open at the picture room's door, up to the shelf
  const north = H.north - PROUD, door: [number, number] = [OPENING.pictureToHall.east[0], OPENING.pictureToHall.east[1]]
  for (const [a, b] of runs(H.west, H.east, [door])) {
    walls.eastWest(north, -1, a, b, low, () => -1.66)
    backing.eastWest(north + recess, -1, a, b, FLOOR, gapTop)
  }
  walls.eastWest(north, -1, door[0], door[1], lintel, () => -1.66)
  // the soffit between the clerestory and the south wall, a dark backing,
  // and the slats under it in every bay between two beams: 90 mm oak on a
  // 150 mm pitch, running with the beams
  const glazing = -42.53
  backing.quad([H.west, glazing, roofAt(glazing)], [H.east, glazing, roofAt(glazing)],
    [H.east, H.south, roofAt(H.south)], [H.west, H.south, roofAt(H.south)], [0, 0, -1])
  const bays: [number, number][] = []
  let bayNorth = glazing
  for (const beam of BEAMS) { bays.push([beam + .18, bayNorth]); bayNorth = beam - .18 }
  bays.push([H.south, bayNorth])
  for (const [bayS, bayN] of bays) {
    const count = Math.floor((bayN - bayS - .06) / SLAT.pitch)
    const start = (bayN + bayS) / 2 + (count - 1) * SLAT.pitch / 2
    for (let i = 0; i < count; i++) {
      const n = start - i * SLAT.pitch
      slats.box((H.west + H.east) / 2, n, roofAt(n) - .025 - SLAT.depth / 2, H.east - H.west, SLAT.width, SLAT.depth, 0, true)
    }
  }
  // each beam clad on its two faces and its underside, a centimetre proud
  for (const beam of BEAMS) {
    const top = hallSoffit(beam) - .05, foot = hallSoffit(beam) - .64
    const s = beam - .18, n = beam + .18
    overhead.quad([H.west, s, foot], [H.east, s, foot], [H.east, n, foot], [H.west, n, foot], [0, 0, -1])
    overhead.eastWest(s, -1, H.west, H.east, foot, () => top)
    overhead.eastWest(n, 1, H.west, H.east, foot, () => top)
  }
  // the light shelf's underside and its lip
  const shelfNorth = FACE.pictureWallSouth, shelfSouth = FACE.pictureWallSouth - 1.24
  overhead.quad([H.west + .25, shelfNorth, -1.665], [H.east - .25, shelfNorth, -1.665],
    [H.east - .25, shelfSouth - .01, -1.665], [H.west + .25, shelfSouth - .01, -1.665], [0, 0, -1])
  overhead.eastWest(shelfSouth - .055, -1, H.west + .25, H.east - .25, -1.64, () => -1.285)
  // the floor, a few millimetres over the construction's own
  floor.quad([H.west, H.south, FLOOR + .003], [H.east, H.south, FLOOR + .003],
    [H.east, H.north, FLOOR + .003], [H.west, H.north, FLOOR + .003], [0, 0, 1])
  return { walls, overhead, floor, plinths, slats, backing }
}

const { abs, cameraPosition, cameraViewMatrix, cross, dot, float, floor: floorOf, fract, log2, mix,
  mx_noise_float, normalWorldGeometry, positionWorld, pow, screenUV, select, smoothstep, texture, uniform, uniformArray, vec2, vec3 } = TSL as unknown as Record<string, N>

/** the tangent frame a world-aligned face is photographed in: u runs along
    the face, v up it (a floor's v runs north) */
function faceFrame(n: N): { t: N; b: N } {
  const flat = abs(n.y).greaterThan(.5)
  const t = select(flat, vec3(1, 0, 0), cross(vec3(0, 1, 0), n).normalize())
  const b = select(flat, cross(n, vec3(1, 0, 0)), vec3(0, 1, 0))
  return { t, b }
}

const hash = (x: N, y: N, salt: number): N => fract(x.mul(12.9898).add(y.mul(78.233)).add(salt).sin().mul(43758.5453))

interface Look {
  /** metres of one tile of the photograph: stated here, because a set built
      before its manifest lands would otherwise lay it at one metre */
  metres: number
  /** a multiplier on the photograph's own linear colour */
  tint: [number, number, number]
  /** the photograph's roughness is remapped to this range */
  rough: [number, number]
  normal: number
  /** the metre-scale drift over the whole room */
  drift: number
  /** what the light shelf throws up at a face that looks down, at the shelf */
  shelf?: number
  /** the photograph laid a quarter turn round, so a board's grain runs east */
  turn?: boolean
}

function fabricMaterial(set: MaterialSet, look: Look, name: string): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .7, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const frame = faceFrame(n)
  const t = look.turn ? frame.b : frame.t, b = look.turn ? frame.t : frame.b
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, b)), metres: look.metres })
  const drift = mx_noise_float(P.mul(.11)).mul(look.drift).add(mx_noise_float(P.mul(.37)).mul(look.drift * .5))
  const colour = sample.colour.mul(vec3(...look.tint)).mul(float(1).add(drift))
  m.colorNode = colour
  m.roughnessNode = mix(float(look.rough[0]), float(look.rough[1]), sample.roughness).clamp(.05, 1)
  const tangent = sample.normal
  const bent = t.mul(tangent.x.mul(look.normal)).add(b.mul(tangent.y.mul(look.normal))).add(n.mul(tangent.z)).normalize()
  m.normalNode = bent.transformDirection(cameraViewMatrix)
  m.aoNode = sample.occlusion
  // THE CLERESTORY'S SKY, THROWN UP BY ITS SHELF: bright over the shelf,
  // falling away south, on the faces that look down. A gradient, not a pool.
  if (look.shelf) {
    const south = P.z.sub(42.6).max(0)
    const down = n.y.negate().clamp(0, 1).add(n.z.negate().clamp(0, 1).mul(.35))
    m.emissiveNode = colour.mul(vec3(.78, .86, 1)).mul(south.div(-5.5).exp().mul(look.shelf).add(look.shelf * .06)).mul(down)
  }
  m.name = `vinci/collection-hall-fabric/${name}`
  m.userData = { ...HALL_FABRIC_PROVENANCE, set: set.name }
  return m
}

/** A map baked in code, read as data: no colour space, filtered, mipmapped. */
function dataMap(bytes: Uint8Array, side: number, repeat: boolean, name: string): DataTexture {
  const t = new DataTexture(bytes, side, side, RGBAFormat, UnsignedByteType)
  t.colorSpace = NoColorSpace
  t.wrapS = t.wrapT = repeat ? RepeatWrapping : ClampToEdgeWrapping
  t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter; t.generateMipmaps = true
  t.anisotropy = 8
  t.name = name
  t.needsUpdate = true
  return t
}

/** THE CLERESTORY ON THE FLOOR, held back where the light shelf and what
 * stands on the floor hide the window from it. The spots keep their own
 * shadow maps; the room's bounce takes the occlusion map. */
class FloorLighting extends PhysicalLightingModel {
  constructor(private readonly window: N) { super() }
  override directRectArea(input: Parameters<PhysicalLightingModel['directRectArea']>[0], builder: Parameters<PhysicalLightingModel['directRectArea']>[1]): void {
    super.directRectArea({ ...input, lightColor: (input as unknown as { lightColor: N }).lightColor.mul(this.window) } as typeof input, builder)
  }
}
class FloorMaterial extends MeshStandardNodeMaterial {
  windowNode: N = float(1)
  override setupLightingModel(): PhysicalLightingModel { return new FloorLighting(this.windowNode) }
}

/** What the floor's finish is made of, as the fabric reads it. */
export const FLOOR_FINISH = {
  /** the photograph's own tile, and the tint its linear colour is taken by */
  metres: 3, tint: [1.2, 1.18, 1.15] as [number, number, number], normal: .3,
  /** how much of the photograph's own variation (its scratches and stains)
      the floor keeps: the aggregate and the map carry the rest */
  photo: .6,
  /** how far the cut aggregate departs from its paste */
  aggregate: 1,
  /** where the sealer is walked through, by its roughness */
  worn: [.3, .44] as [number, number],
  /** a dust film: a shade paler than the sealed floor, warm, matte */
  dust: [.165, .155, .14] as [number, number, number], dustRough: .84, dustCover: .65,
  /** an open saw cut, and the chips along its arris; how much of the silt
      the cut shows over its dark */
  cutDark: .16, chip: .16, silt: .5,
  /** the reflection the sealer gives back, before dust and the cuts take it */
  reflection: .7,
}

export interface FloorMaps { finish: DataTexture; tile: DataTexture; bakeMs: number }

/** The floor's map and tile, baked once for the hall. */
function floorMaps(side: number): FloorMaps {
  const baked = bakeHallFloor(hallFloorPlan(), side)
  return {
    finish: dataMap(baked.finish, baked.size, false, 'vinci/collection-hall-floor/finish'),
    tile: dataMap(bakeFloorTile(side), side, true, 'vinci/collection-hall-floor/tile'),
    bakeMs: baked.bakeMs,
  }
}

/** The clerestory past its shelf, by metres south of the glazing. */
const SHELF_CURVE = uniformArray([...HALL_FLOOR_SHELF.values], 'float')

/** THE SEALED FLOOR: the photograph for its fine grain, read per bay; the
 * baked map for the pour, the trowel, the wear, the dust and the contact; the
 * tile's aggregate, scuffs and scratches over it; the saw cuts drawn at the
 * pixel they land in. Four maps in all: the hall's lights already hold most
 * of the sixteen a fragment may sample. */
function floorMaterial(set: MaterialSet, maps: FloorMaps): { material: FloorMaterial; held: N } {
  const F = FLOOR_FINISH, M = HALL_FLOOR_MAP
  const m = new FloorMaterial({ roughness: .3, metalness: 0, side: FrontSide })
  const P = positionWorld
  const east = P.x, north = P.z.negate()
  const finish = texture(maps.finish, vec2(east.sub(M.west).div(M.east - M.west), north.sub(M.south).div(M.north - M.south)))
  // each bay its own read of the photograph and of the tile, turned a
  // quarter or more, so neither ever lines up with the next bay's
  const e0 = east.sub(BAY.originEast), n0 = north.sub(BAY.originNorth)
  const cellE = floorOf(e0.div(BAY.east)), cellN = floorOf(n0.div(BAY.north))
  const h1 = hash(cellE, cellN, 3.7), h2 = hash(cellE, cellN, 11.3), h3 = hash(cellE, cellN, 17.9)
  const sample = set.sample({ uv: vec2(east, north).add(vec2(h1, h2).mul(23.7)), metres: F.metres })
  const quarter = floorOf(h3.mul(4))
  const turn = (q: N, v: N): N => select(q.lessThan(1), v, select(q.lessThan(2), vec2(v.y.negate(), v.x), select(q.lessThan(3), v.negate(), vec2(v.y, v.x.negate()))))
  const tile = texture(maps.tile, turn(quarter, vec2(east, north)).add(vec2(h2, h1).mul(7.1)).div(HALL_FLOOR_TILE))
  const grain = tile.r.mul(2)
  // the photograph's own mean, whatever its manifest measured it at
  const mean = sample.colour.div(sample.albedo.max(.05))
  let colour: N = mean.mul(mix(vec3(1), sample.albedo, F.photo))
    .mul(vec3(...F.tint)).mul(finish.r.add(.5)).mul(mix(float(1), grain, F.aggregate))
  // heel scuffs and the haze of fine scratches where the sealer is walked through
  const worn = smoothstep(float(F.worn[0]), float(F.worn[1]), finish.g)
  colour = colour.mul(float(1).sub(tile.b.mul(worn).mul(.5))).mul(tile.a.mul(worn).mul(.12).add(1))
  let rough: N = finish.g.add(tile.g.sub(.5).mul(.6)).add(tile.a.mul(worn).mul(.28))
  // THE SAW CUTS, each on its own axis and filtered to the pixel it lands in
  const { east: pe, north: pn } = axisFootprint(P)
  const along = (c: N, period: number): N => { const f = fract(c.div(period)); return f.min(float(1).sub(f)).mul(period) }
  const dE = along(e0, BAY.east), dN = along(n0, BAY.north)
  const joint = lineCoverage(dE, BAY.cutHalf, BAY.east, pe).max(lineCoverage(dN, BAY.cutHalf, BAY.north, pn))
  // an arris chips where a stone of the aggregate sits in it
  const stone = smoothstep(float(.1), float(.3), grain.sub(1).abs())
  const chip = lineCoverage(dE, BAY.chipHalf, BAY.east, pe).max(lineCoverage(dN, BAY.chipHalf, BAY.north, pn)).mul(stone)
  // the dust film, grained; the cuts' own silt rides on their line in the map
  const dust = finish.b.mul(smoothstep(float(.018), float(.034), dE.min(dN))).mul(grain.sub(1).mul(.8).add(1)).clamp(0, 1).mul(F.dustCover)
  colour = mix(colour, vec3(...F.dust), dust)
  rough = mix(rough, float(F.dustRough), dust)
  colour = colour.mul(float(1).add(chip.mul(F.chip)))
  rough = rough.max(chip.mul(.5))
  colour = mix(colour, mix(colour.mul(F.cutDark), vec3(...F.dust), finish.b.mul(F.silt)), joint)
  rough = mix(rough, float(.86), joint)
  m.colorNode = colour
  m.roughnessNode = rough.clamp(.05, 1)
  const t = vec3(1, 0, 0), b = vec3(0, 0, -1), n = vec3(0, 1, 0)
  const bent = t.mul(sample.normal.x.mul(F.normal)).add(b.mul(sample.normal.y.mul(F.normal))).add(n.mul(sample.normal.z)).normalize()
  m.normalNode = bent.transformDirection(cameraViewMatrix)
  // THE ENGINE'S STAND-INS for the contact a path tracer finds by itself: the
  // room's light held back round what stands on the floor, the window's past
  // its shelf and, near a plinth, much as the room's
  m.aoNode = finish.a
  const south = float(HALL_FLOOR_SHELF.glazing).sub(north).max(0).div(HALL_FLOOR_SHELF.step).min(HALL_FLOOR_SHELF.values.length - 1.001)
  const at = floorOf(south)
  const shelf = mix(SHELF_CURVE.element(at.toInt()), SHELF_CURVE.element(at.add(1).toInt()), south.sub(at))
  m.windowNode = shelf.mul(mix(float(1), finish.a, .75))
  m.name = 'vinci/collection-hall-fabric/floor'
  // a function, so a copy of the material's record never copies the bytes
  m.userData = { ...HALL_FLOOR_PROVENANCE, set: set.name, bakeMs: maps.bakeMs, floorMaps: (): FloorMaps => maps }
  return { material: m, held: dust.max(joint) }
}

/** The planar pass is drawn at this share of the frame. */
const REFLECTION_SCALE = .5
/** The drawing camera's vertical focal factor, 1 / tan(half its field). */
const FOCAL = uniform(1).onRenderUpdate(({ camera }: { camera: { projectionMatrix: { elements: number[] } } }) => camera.projectionMatrix.elements[5])
/** The planar pass's height in texels: a share of the drawing buffer, which
 * the pass itself is sized from. */
const drawn = new Vector2()
const PASS_HEIGHT = uniform(1).onRenderUpdate(({ renderer }: { renderer: { getDrawingBufferSize(v: Vector2): Vector2 } }) =>
  Math.max(1, Math.round(renderer.getDrawingBufferSize(drawn).y * REFLECTION_SCALE)))

/** What the floor meets, as boxes in the scene's frame (x east, y up, z
 * south): the plinths and the dark bay's walls. */
function standing(): { min: [number, number, number]; max: [number, number, number] }[] {
  const H = ROOMS.hall, out: { min: [number, number, number]; max: [number, number, number] }[] = []
  const add = (east: number, north: number, height: number, width: number, depth: number, tall: number): void => {
    out.push({ min: [east - width / 2, height - tall / 2, -(north + depth / 2)], max: [east + width / 2, height + tall / 2, -(north - depth / 2)] })
  }
  for (const b of standBoxes()) {
    if (b.east < H.west || b.east > H.east || b.north < H.south || b.north > H.north) continue
    if (b.height - b.tall / 2 > FLOOR + .05) continue
    add(b.east, b.north, b.height, b.width, b.depth, b.tall)
  }
  const B = DARK_BAY
  for (const [w, s, e, n] of [
    [B.west - B.wall, B.south - B.wall, B.west, B.north],
    [B.east, B.south - B.wall, B.east + B.wall, B.north],
    [B.west - B.wall, B.south - B.wall, B.east + B.wall, B.south],
  ] as const) add((w + e) / 2, (s + n) / 2, FLOOR + B.height / 2, e - w, n - s, B.height)
  return out
}

/** THE FLOOR'S REFLECTION, AS A GLOSSY FLOOR GIVES IT. A rough floor blurs
 * what it reflects by the distance to it: sharp where a wall or a plinth
 * stands on the floor, softer the farther off, and drawn out along the view.
 * One blur for the whole floor pulled the pass's pixels from behind the walls
 * into a pale seam at every wall's foot, and spread the lit screw across the
 * floor as a patch no caster makes. The distance is read off the hall's own
 * box, its plinths and the dark bay; the spread never reaches past the foot
 * of what is reflected. */
function glossyReflection(reflection: N, rough: N): N {
  const H = ROOMS.hall, P = positionWorld
  const view = P.sub(cameraPosition).normalize()
  const r = vec3(view.x, view.y.negate().max(1e-3), view.z)
  const safe = (c: N): N => c.abs().max(1e-4).mul(select(c.lessThan(0), float(-1), float(1)))
  const inv = vec3(1).div(vec3(safe(r.x), r.y, safe(r.z)))
  // leaving the room: its walls and the lowest line of its roof
  const lo = vec3(H.west + PROUD, FLOOR - 1, -(H.north - PROUD)), hi = vec3(H.east - PROUD, HALL_CEILING_SOUTH, -(H.south + PROUD))
  // a select takes one condition, so each axis picks its own wall
  const wall = vec3(select(r.x.greaterThan(0), hi.x, lo.x), hi.y, select(r.z.greaterThan(0), hi.z, lo.z))
  const far = wall.sub(P).mul(inv)
  let d: N = far.x.min(far.y).min(far.z)
  for (const box of standing()) {
    const a = vec3(...box.min).sub(P).mul(inv), b = vec3(...box.max).sub(P).mul(inv)
    const near = a.min(b), out = a.max(b)
    const enter = near.x.max(near.y).max(near.z).max(0), leave = out.x.min(out.y).min(out.z)
    d = select(leave.greaterThan(enter), d.min(enter), d)
  }
  d = d.max(0)
  const foot = P.y.add(r.y.mul(d)).sub(FLOOR).max(0)
  const spread = rough.mul(rough).mul(.45)
  const along = spread.mul(d).min(foot.mul(.85))
  const across = spread.mul(d).mul(r.y)
  // radians per texel of the pass, and metres per texel at the reflected point
  const texel = float(2).div(FOCAL.mul(PASS_HEIGHT))
  const metre = cameraPosition.sub(P).length().add(d).mul(texel)
  const taps = [-2, -1, 0, 1, 2], weights = [1, 4, 6, 4, 1]
  const alongPx = along.div(metre), acrossPx = across.div(metre)
  const level = log2(acrossPx.max(alongPx.div(taps.length - 1)).max(1)).min(6)
  const stride = alongPx.div(2).div(PASS_HEIGHT)
  const uv = screenUV.flipX()
  let sum: N = vec3(0)
  taps.forEach((tap, i) => {
    sum = sum.add(reflection.sample(uv.add(vec2(0, stride.mul(tap)))).level(level).rgb.mul(weights[i]! / 16))
  })
  // the last texels before a foot hold the pass's view behind it, as a
  // stair of pale dashes along the seam: what stands there is the dark
  // reveal, so the reflection goes out over those texels
  sum = sum.mul(smoothstep(float(.75), float(2.5), foot.div(metre)))
  return sum
}

export interface HallFabric {
  group: Group
  /** the photographs are on the GPU */
  ready: Promise<void>
  dispose(): void
}

/** The hall's finish, its materials and the floor's reflection, each surface
 * lit by the hall's own rig through `adopt`. */
export function mountHallFabric(stack: Stack, adopt: (material: Material) => void): HallFabric {
  const { walls, overhead, floor, plinths, slats, backing } = skins()
  const concrete = stack.materials.sync('concrete-wall-formed')
  const ground = stack.materials.sync('concrete-floor-polished')
  const oak = stack.materials.sync('oak-veneer-light')
  // The ceiling between the beams: oiled oak slats, the clerestory's sky
  // thrown along them, over a backing dark enough that the gaps read as gaps.
  const slatLook: Look = { metres: 1.83, tint: [.5, .45, .4], rough: [.45, .75], normal: .7, drift: .08, shelf: .34, turn: true }
  const backingLook: Look = { metres: 2.71, tint: [.1, .095, .09], rough: [.85, 1], normal: .3, drift: .02 }
  const slatMaterial = fabricMaterial(oak, slatLook, 'slats')
  const backingMaterial = fabricMaterial(concrete, backingLook, 'backing')
  // The formwork photograph is a khaki concrete; the hall's is a warm grey,
  // so its blue is lifted back to the photograph's red.
  const wallLook: Look = { metres: 2.71, tint: [.92, .97, 1.25], rough: [.62, .95], normal: 1, drift: .06 }
  const overheadLook: Look = { metres: 2.71, tint: [.84, .88, 1.1], rough: [.7, .98], normal: .8, drift: .05, shelf: .36 }
  const wallMaterial = fabricMaterial(concrete, wallLook, 'walls')
  const overheadMaterial = fabricMaterial(concrete, overheadLook, 'overhead')
  const maps = floorMaps(stack.tierName() === 'calm' ? 1024 : 2048)
  const mapBytes = [maps.finish, maps.tile].reduce((sum, t) => sum + t.image.width * t.image.height * 4 * 4 / 3, 0)
  const releaseMaps = stack.registerTextureMemory(() => mapBytes / 1048576, 'hall floor')
  const { material: floorSurface, held } = floorMaterial(ground, maps)
  // A plinth is a dark honed stone, so the machine on it is the lighter thing.
  const plinthLook: Look = { metres: 1.5, tint: [.36, .35, .34], rough: [.32, .62], normal: .5, drift: .04 }
  const plinthMaterial = fabricMaterial(ground, plinthLook, 'plinths')
  const materials = [wallMaterial, overheadMaterial, floorSurface, plinthMaterial, slatMaterial, backingMaterial]
  for (const material of materials) adopt(material)
  // THE FLOOR IS SEALED, and a sealed floor carries what stands on it: the
  // room drawn once more from under the plane, blurred by the floor's own
  // roughness and weighted by the angle it is seen at.
  const plane = new Mesh(new PlaneGeometry(1, 1))
  plane.rotation.x = -Math.PI / 2
  plane.position.set((ROOMS.hall.west + ROOMS.hall.east) / 2, FLOOR + .003, -(ROOMS.hall.south + ROOMS.hall.north) / 2)
  plane.updateMatrixWorld(true)
  const reflection = stack.reflector(plane, { resolutionScale: REFLECTION_SCALE, generateMipmaps: true })
  {
    const P = positionWorld
    const view = cameraPosition.sub(P).normalize()
    const facing = view.y.clamp(0, 1)
    const fresnel = float(.04).add(float(.96).mul(pow(float(1).sub(facing), 5)))
    // held under the sky's own level, so the clerestory's glass reflects as
    // a soft brightening and not as a white smear across the bays
    const seen = glossyReflection(reflection.node, floorSurface.roughnessNode)
    // dust and an open cut are no mirror
    floorSurface.emissiveNode = seen.min(vec3(1.2, 1.2, 1.2)).mul(fresnel).mul(float(FLOOR_FINISH.reflection).mul(float(1).sub(held)))
  }
  const make = (skin: Skin, material: MeshStandardNodeMaterial, name: string): Mesh => {
    const mesh = new Mesh(skin.geometry(), material)
    mesh.name = `vinci/collection-hall-fabric/${name}`
    mesh.castShadow = false; mesh.receiveShadow = true
    mesh.userData = { ...HALL_FABRIC_PROVENANCE }
    return mesh
  }
  const group = new Group()
  group.name = 'vinci/collection-hall-fabric'
  group.userData = { ...HALL_FABRIC_PROVENANCE }
  group.add(make(walls, wallMaterial, 'walls'), make(overhead, overheadMaterial, 'overhead'), make(floor, floorSurface, 'floor'),
    make(plinths, plinthMaterial, 'plinths'), make(slats, slatMaterial, 'slats'), make(backing, backingMaterial, 'backing'))
  const ready = Promise.all([concrete, ground, oak].map(set => stack.materials.load(set.name))).then(() => undefined)
  return {
    group,
    ready,
    dispose() {
      reflection.dispose()
      releaseMaps()
      for (const t of [maps.finish, maps.tile]) t.dispose()
      plane.geometry.dispose()
      group.traverse(o => { if (o instanceof Mesh) o.geometry.dispose() })
      for (const m of materials) m.dispose()
    },
  }
}
