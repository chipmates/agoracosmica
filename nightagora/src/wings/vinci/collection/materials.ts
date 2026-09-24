/** The rooms' own surfaces, and the light that reaches them.
 *
 * A room inside this insertion sees no sun: the afternoon key stands at 232
 * degrees and every opening of the collection faces north or east, which is
 * why the picture room can hang pictures at all. So the daylight in here is
 * modelled the only honest way a single-key stack allows, as the share of
 * the sky each surface can still see through its OWN opening, applied to the
 * indirect term alone. The measured sun and its shadows are untouched.
 */
import { BackSide, Color, DoubleSide, MeshStandardNodeMaterial } from 'three/webgpu'
import * as TSL from 'three/tsl'
import type { Stack } from '../../../stack'
import type { GrainRecipe, MaterialClass, MaterialSet } from '../../../stack/materials'
import {
  anisotropicFootprint, applyDetail, axisFootprint, fitScales, lineCoverage, reliefNormal, resolved,
  specularAA, surfaceDetail,
} from '../../../stack/detail'
import { COLLECTION_PAVING_ORIGIN, COURT, FACE, FLOOR, GRAVE_ORIGIN, LINE_SLAB } from './layout'
import { distanceToBoxes, flagFace } from '../court-flags'
import { bodyWallPlateLight, onBodyWall } from './body-wall-light'
import { hangTone, PICTURE_LOOKS } from './picture-light'

/** floor stone, wall plaster, dark stone, steel, ceiling, outdoor paving */
export type CollectionRole = 0 | 1 | 2 | 3 | 4 | 5

/** THE LADDER EACH ROLE'S OWN PART CAN CARRY, macro to micro, in metres.
 * One room-sized drift served every surface here, so a 0.16 m base band and
 * a 0.10 m plinth slab sampled a single value of it and read as paint. Each
 * ladder below is fitted to the smallest extent of the part that wears it. */
const PART_LADDER: Record<CollectionRole, [number, number, number]> = {
  0: fitScales([.42, .045, .002], 1.6),   // a 1.60 by 1.65 m floor stone
  1: fitScales([.55, .06, .0025], 1.2),   // a 1.2 by 2.4 m lining board
  2: fitScales([.08, .02, .0022], .16),   // the base band, the plinth's top slab
  3: fitScales([.09, .02, .0015], .26),   // a picture rail, a plinth shaft, a fitting
  4: fitScales([.7, .09, .0025], 3.7),    // the plaster between two coffer ribs
  5: fitScales([.5, .06, .0025], 1.6),    // the court's own paving stone
}

/** THE FOUR TERMS, for a surface that is not one of the six welded room
 * families. The rooms compose these inline off a role attribute; a plain
 * material asks for them here, so the grave's paving, the pavilion's soffit
 * and a lining board are read by one piece of code and not by three.
 *
 * `lapM` is a band laid across whichever world axis this pixel is still thin
 * in, which is the only mid scale a plane running away from the eye can hold;
 * `driftM` a metres-wide run along the face, which survives any pixel;
 * `cellM` the block or board a joint bounds, read on both its own axes.
 */
export interface SurfaceTermsOptions {
  scales: [number, number, number]
  extent?: number
  figure?: [number, number, number]
  relief?: number
  lapM: number
  driftM: number
  /** [along the run, up the face] in metres, or none */
  cellM?: [number, number] | null
  at?: TSLNode
  normal?: TSLNode
}

export interface SurfaceTerms {
  /** around one: the three-rung ladder, already fitted to the part */
  tone: TSLNode
  /** add to the roughness */
  rough: TSLNode
  /** the ladder's relief in metres */
  heightM: TSLNode
  /** each around zero, for the caller to weight */
  lap: TSLNode
  drift: TSLNode
  cell: TSLNode
  /** the slope the gates took away, for `specularAA` */
  lost: TSLNode
  /** the pixel, and the run this face is read along */
  pixel: TSLNode
  along: TSLNode
  alongPixel: TSLNode
}

export function surfaceTerms(o: SurfaceTermsOptions): SurfaceTerms {
  const { float, floor, fract, mix, normalWorldGeometry, positionWorld, smoothstep } = TSL as unknown as Record<string, TSLNode>
  const P = o.at ?? positionWorld, n = o.normal ?? normalWorldGeometry
  const detail = surfaceDetail({
    scales: fitScales(o.scales, o.extent), figure: o.figure ?? [.16, .105, .075],
    relief: o.relief ?? .0035, count: 3, at: P, normal: n,
  })
  const { east, up, north } = axisFootprint(P)
  const hashOf = (index: TSLNode, salt: number): TSLNode => fract(index.mul(salt).sin().mul(4371.13)).sub(.5)
  const bands = (coordinate: TSLNode, salt: number): TSLNode => {
    const i = floor(coordinate), f = fract(coordinate)
    return mix(hashOf(i, salt), hashOf(i.add(1), salt), f.mul(f).mul(float(3).sub(f.mul(2))))
  }
  const acrossFace = n.x.abs().greaterThan(n.z.abs())
  const along = acrossFace.select(P.z, P.x), alongPixel = acrossFace.select(north, east)
  const upright = n.y.abs().lessThan(.5)
  /** WHICH AXIS IS THE THIN ONE IS NOT A DECISION. Taken as a comparison of
   * two screen derivatives it draws a hard line across every floor where the
   * two are equal, and that line moves with the eye: either side of it the
   * band and the block are cut from a different coordinate, so a walking
   * visitor sees a whole region change tone and gloss between two frames.
   * The two are laid instead and crossed on how thin the pixel actually is,
   * so no fragment ever jumps from one to the other. */
  const thinX = upright.select(P.y, P.x), thinZ = upright.select(P.y, P.z)
  const thinPixel = upright.select(up, east.min(north))
  const towardX = upright.select(float(1), smoothstep(-.35, .35, north.sub(east).div(north.add(east).max(1e-6))))
  // Two octaves, because a float lays laps inside laps and because one octave
  // over the few cells a frame holds does not average to zero.
  const laid = (coordinate: TSLNode): TSLNode => {
    const t = coordinate.div(o.lapM)
    // the second lap is laid inside the first and is 2.37 times finer, so it
    // is gated on ITS period: one gate on the coarse one left it standing
    return bands(t, 23.7).mul(.62).mul(resolved(o.lapM, thinPixel))
      .add(bands(t.mul(2.37).add(1.7), 9.41).mul(.38).mul(resolved(o.lapM / 2.37, thinPixel)))
  }
  const lap = mix(laid(thinZ), laid(thinX), towardX).toVar()
  const drift = bands(along.div(o.driftM), 5.13).mul(resolved(o.driftM, alongPixel)).toVar()
  const block = (coordinate: TSLNode): TSLNode =>
    hashOf(floor(along.div(o.cellM![0])).add(floor(coordinate.div(o.cellM![1])).mul(5.73)), 17.31)
  const cell = o.cellM
    ? mix(block(thinZ), block(thinX), towardX)
      .mul(resolved(o.cellM[0], alongPixel)).mul(resolved(o.cellM[1], thinPixel)).toVar()
    : float(0)
  return {
    tone: detail.tone, rough: detail.rough, heightM: detail.heightM,
    lap, drift, cell, lost: detail.lost, pixel: detail.pixel, along, alongPixel,
  }
}

export const collectionRoomsProvenance = {
  manifestId: 'vinci/collection-rooms',
  assetClass: 'GENERATED',
  certainty: 'reconstructed',
  recipe:
    'Original welded room construction inside the existing pavilion envelope: floor finish on a 1.60 by 1.65 m stone grid with 8 mm joints, lined walls with a dark stone base, coffered soffits with a light cove, dressed door reveals, an outdoor court terrace with its parapet and a freestanding display wall. Three filtered procedural scales per surface, no texture asset and no reference image sampled. Interior indirect light is a per-opening sky-visibility term on the ambient channel only; no second light source, no emissive surface, no baked shadow.',
  date: '2026-09-11',
} as const

const PALETTE = {
  floor: '#9d9a8e', plaster: '#b7b2a4', dark: '#3c423d', steel: '#333b3c',
  ceiling: '#b0ab9e', paving: '#a6a393',
}

/** The mechanism hall's own stones: a warmer, deeper floor and lining than
 * the rooms beside it, so its machines stand in their own light. */
const HALL = {
  floor: '#625a4f', plaster: '#9a9386', ceiling: '#958f83', bay: '#56514a',
  floorRough: .44, slabStep: .2, wash: .55,
}

/** One on the hall's own faces and zero on every other room's, with no ramp
 * between: a room beside the hall keeps every value it had. */
function hallInterior(P: TSLNode): TSLNode {
  const { float } = TSL as unknown as Record<string, TSLNode>
  return P.x.greaterThan(-61.8).and(P.x.lessThan(-38.9)).and(P.z.greaterThan(41.92)).and(P.z.lessThan(63.8))
    .select(float(1), float(0))
}

/** The sky each interior surface can still see, opening by opening. */
function interiorDaylight(P: TSLNode, n: TSLNode): TSLNode {
  const { exp, float, smoothstep } = TSL
  const facing = (value: TSLNode, floorShare: number) => value.max(0).mul(1 - floorShare).add(floorShare)
  // The north window wall, 40 m of it, is the picture room's whole light.
  const northDepth = P.z.sub(34.07).max(0)
  const northGate = smoothstep(42.7, 41.8, P.z)
  const north = exp(northDepth.div(-9)).mul(facing(n.z.negate(), .3)).mul(northGate)
  // The east elevation lights the long gallery from its end.
  const eastDepth = float(-22.07).sub(P.x).max(0)
  const eastGate = smoothstep(-39.2, -38.5, P.x).mul(smoothstep(41.8, 42.7, P.z))
  const east = exp(eastDepth.div(-7.5)).mul(facing(n.x, .3)).mul(eastGate).mul(.9)
  // The hall's clerestory stands above the low roofs and looks north.
  const hallDepth = P.z.sub(42.5).max(0)
  const hallGate = smoothstep(-38.5, -39.2, P.x).mul(smoothstep(41.8, 42.6, P.z))
  const hallFace = facing(n.z.negate().mul(.7).add(n.y.mul(.45)), .22)
  const hall = exp(hallDepth.div(-13)).mul(hallFace).mul(hallGate).mul(1.05)
  // Every room's floor is pale and takes the whole of its opening, so the
  // lower half of every wall stands in the floor's own bounce.
  const bounce = n.y.mul(.5).add(.5).oneMinus().mul(.085)
  return north.add(east).add(hall).add(bounce)
}

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TSLNode = any

/** What the rooms' own luminaires put on the surfaces they are aimed at. */
function fittingWash(P: TSLNode, n: TSLNode): TSLNode {
  const { float, smoothstep } = TSL
  const facing = (value: TSLNode) => value.max(0)
  const near = (value: TSLNode, full: number, gone: number) => smoothstep(gone, full, value.abs())
  // The picture room's cove, throwing the hanging wall from 0.3 m below the
  // soffit down over three metres, and the soffit above it.
  const pictureGate = smoothstep(42.8, 41.9, P.z).mul(smoothstep(33.6, 34.4, P.z))
  const coveWall = smoothstep(-5.55, -2.35, P.y).mul(near(P.z.sub(41.79), .18, .85)).mul(facing(n.z.negate())).mul(pictureGate)
  const coveSoffit = smoothstep(-2.55, -1.95, P.y).mul(smoothstep(4.2, 1.1, P.z.sub(41.79).abs())).mul(facing(n.y.negate())).mul(pictureGate)
  const coveFloor = smoothstep(-6.6, -6.2, P.y).mul(smoothstep(4.6, 1.4, P.z.sub(41.79).abs())).mul(facing(n.y)).mul(pictureGate)
  // The hall's beams carry uplights; the gallery's coffers carry a line.
  const hallGate = smoothstep(-38.5, -39.2, P.x).mul(smoothstep(41.9, 42.7, P.z))
  const hallUp = smoothstep(-2.4, .4, P.y).mul(facing(n.y.negate()).mul(.7).add(facing(n.y).mul(.15))).mul(hallGate)
  const hallFloor = smoothstep(-6.6, -6.2, P.y).mul(facing(n.y)).mul(hallGate).mul(.5)
  const galleryGate = smoothstep(-39.2, -38.5, P.x).mul(smoothstep(41.9, 42.7, P.z)).mul(smoothstep(64, 63, P.z))
  const gallery = smoothstep(-4.2, -1.95, P.y).mul(facing(n.y.negate()).mul(.55).add(float(.25))).mul(galleryGate)
  // The gallery's west wall is the one room surface no opening reaches: the
  // sheets hang on it, so the coffer line is turned on to it.
  const bodyWall = smoothstep(-6.1, -3.4, P.y).mul(smoothstep(-4.6, -3.4, P.y.negate().negate()).oneMinus().add(.55).clamp(0, 1))
    .mul(near(P.x.add(38.75), .3, 1.4)).mul(facing(n.x)).mul(galleryGate)
  const galleryFloor = smoothstep(-6.6, -6.2, P.y).mul(facing(n.y)).mul(galleryGate).mul(.55)
  // The reading room carries no wash here: its own lamp is a light
  // (`reading-room.ts`), and its pool lies on its own oak.
  return coveWall.mul(.46).add(coveSoffit.mul(.30)).add(coveFloor.mul(.20))
    .add(hallUp.mul(.34)).add(hallFloor.mul(.16))
    .add(gallery.mul(.30)).add(galleryFloor.mul(.18)).add(bodyWall.mul(.40))
    .clamp(0, .62)
}

/** Reproductions share the surrounding room's sky visibility and fitting
 * wash. The north apron is open to the sky; it carries no bench aperture.
 * This is the room's declared light on a source, not a change to its pixels.
 * The hang's own works are lit by their heads instead (`picture-light.ts`),
 * read off the vertices their planes carry. */
export function collectionPlateTone(kind: 'room' | 'hang' = 'room'): TSLNode {
  if (kind === 'hang') return hangTone(PICTURE_LOOKS)
  const { float, normalWorldGeometry, positionWorld, vec3 } = TSL as unknown as Record<string, TSLNode>
  const P = positionWorld, n = normalWorldGeometry
  const room = interiorDaylight(P, n).mul(1.55).add(.10).clamp(.10, 1)
    .add(fittingWash(P, n)).clamp(.10, 1)
  // the body wall's sheets take the cabinet's own light and no daylight
  const inRoom = onBodyWall(P, n).select(bodyWallPlateLight(P, n), vec3(room, room, room))
  return P.z.lessThan(-FACE.glazingNorth).select(vec3(1, 1, 1), inRoom)
}

/** WHERE THE ROOMS ARE WALKED, and where a hand rests. Wear is not a noise
 * field: a floor is polished where feet actually cross it, which on this
 * ground is the four doors the rail walks through and the one line each room
 * is walked along. Both terms are 0 to 1 read in plan, so the caller decides
 * which faces may carry them. */
function trafficLine(P: TSLNode): { feet: TSLNode; doors: TSLNode } {
  const { smoothstep, vec2 } = TSL
  // The wing counts north where the world counts negative z.
  const pool = (east: number, north: number, radius: number): TSLNode =>
    smoothstep(radius, 0, vec2(P.x.sub(east), P.z.add(north)).length())
  const band = (value: TSLNode, at: number, half: number): TSLNode =>
    smoothstep(half, 0, value.sub(at).abs())
  const between = (value: TSLNode, from: number, to: number): TSLNode =>
    smoothstep(from - .7, from + .7, value).mul(smoothstep(to + .7, to - .7, value))
  const doors = pool(-61.08, -41.8, 2.1).max(pool(-23.09, -41.8, 2.1))
    .max(pool(-38.9, -43.12, 2.1)).max(pool(-38.9, -62.93, 2.1)).toVar()
  // The hang is read walking the room's length, the sheets walking beside
  // the line let into the gallery's floor, the machines down one aisle, and
  // the court is crossed between its own two exhibits.
  const picture = band(P.z, 38.6, 2).mul(between(P.x, -61.66, -22.07)).mul(between(P.z, 34.07, 41.8))
  const gallery = band(P.x, -36.9, 1.6).mul(between(P.z, 42.04, 63.66))
  const inHall = between(P.x, -61.66, -39.02).mul(between(P.z, 42.04, 63.66)).toVar()
  const aisle = band(P.z, 46.3, 2.6).max(band(P.x, -41.3, 1.8).mul(between(P.z, 46.3, 62.93))).mul(inHall)
  const court = band(P.z, 27.6, 2.2).mul(between(P.x, -59.5, -30.5))
  return { feet: doors.max(picture).max(gallery).max(aisle).max(court).toVar(), doors }
}

/** One material for every welded room surface. The role attribute decides
 * which stone it is; the three scales and the daylight are shared. */
export function collectionInteriorMaterial(): MeshStandardNodeMaterial {
  const {
    attribute, cameraViewMatrix, float, floor, fract, mix, mx_noise_float,
    normalWorldGeometry, positionWorld, smoothstep, vec3,
  } = TSL as unknown as Record<string, TSLNode>
  const m = new MeshStandardNodeMaterial({ roughness: .84, side: DoubleSide, shadowSide: BackSide })
  const P = positionWorld, n = normalWorldGeometry
  const role = attribute('collectionRoomRole', 'float')
  const isFloor = role.lessThan(.5), isPlaster = role.greaterThan(.5).and(role.lessThan(1.5))
  const isDark = role.greaterThan(1.5).and(role.lessThan(2.5))
  const isSteel = role.greaterThan(2.5).and(role.lessThan(3.5))
  const isCeiling = role.greaterThan(3.5).and(role.lessThan(4.5))
  const isOutdoor = role.greaterThan(4.5)
  /** the same quantity read off whichever part this fragment belongs to:
      six welded families on one mesh, one ladder of taps between them */
  const byRole = (v: [number, number, number, number, number, number]): TSLNode =>
    isFloor.select(float(v[0]), isPlaster.select(float(v[1]), isDark.select(float(v[2]),
      isSteel.select(float(v[3]), isCeiling.select(float(v[4]), float(v[5]))))))
  const rung = (i: 0 | 1 | 2): TSLNode => byRole([
    PART_LADDER[0][i], PART_LADDER[1][i], PART_LADDER[2][i],
    PART_LADDER[3][i], PART_LADDER[4][i], PART_LADDER[5][i]])
  // A LADDER THE EYE CAN FIND. At six to twenty metres the micro rung is
  // under the pixel and the mid rung is a few pixels across, so a figure
  // weighted for a hand's distance leaves the plane reading as paint at a
  // room's. Each rung is weighted for the distance it is actually seen at.
  const detail = surfaceDetail({
    scales: [rung(0), rung(1), rung(2)],
    figure: [.16, .105, .075], relief: .0035, count: 3, at: P, normal: n,
  })
  const pixel = detail.pixel
  const held = (metres: number | TSLNode): TSLNode => resolved(metres, pixel)
  // ONE PIXEL PER AXIS. A joint at a fixed east is a line in P.x and a joint
  // at a fixed north a line in P.z, and a floor running away from the eye has
  // a pixel that is centimetres across those lines and metres along them. The
  // isotropic footprint above is the across figure, so the along axis kept a
  // line far thinner than its own pixel and it broke into dashes from about
  // eight metres. Each coordinate is now filtered on its own derivative.
  const { east: pixelEast, up: pixelUp, north: pixelNorth } = axisFootprint(P)
  // A joint is a groove, and a groove has to survive the pixel it lands in.
  // Widening its edges by the pixel keeps FULL contrast at its centre, so a
  // 8 mm joint under a 40 mm pixel drew an 80 mm black band that swam with
  // the eye. What the pixel sees of it is the share of itself it covers.
  const line = (coordinate: TSLNode, spacing: number, offset: number, width: number, axis: TSLNode) => {
    const f = fract(coordinate.sub(offset).div(spacing)), edge = f.min(float(1).sub(f)).mul(spacing)
    return lineCoverage(edge, width, spacing, axis)
  }
  const hashOf = (index: TSLNode, salt: number): TSLNode => fract(index.mul(salt).sin().mul(4371.13)).sub(.5)
  /** value noise in ONE axis, so a feature can be laid across the axis a
      grazing pixel is still thin in */
  const bands = (coordinate: TSLNode, salt: number): TSLNode => {
    const i = floor(coordinate), f = fract(coordinate)
    return mix(hashOf(i, salt), hashOf(i.add(1), salt), f.mul(f).mul(float(3).sub(f.mul(2))))
  }
  // Existing rooms keep their established paving grid. The date field has
  // its own half-metre offset to fit twelve courses; moving that exhibit
  // must not move the joints or stone tones in every room.
  const slabEast = line(P.x, LINE_SLAB.pitchEast, COLLECTION_PAVING_ORIGIN.east, .008, pixelEast)
  const slabNorth = line(P.z, LINE_SLAB.pitchNorth, -COLLECTION_PAVING_ORIGIN.north, .008, pixelNorth)
  const slabJoint = slabEast.max(slabNorth).mul(n.y.abs())
  const slabIndex = floor(P.x.sub(COLLECTION_PAVING_ORIGIN.east).div(LINE_SLAB.pitchEast)).add(floor(P.z.add(COLLECTION_PAVING_ORIGIN.north).div(LINE_SLAB.pitchNorth)).mul(7.31))
  const slabCell = hashOf(slabIndex, 13.17).mul(held(1.6)).toVar()
  // THE FACE'S OWN RUN. A wall read along its length has a pixel that is
  // centimetres high and metres long, and a noise blob smaller than that long
  // axis cannot be point sampled: only the short axis resolves it. So what
  // carries a receding plane is a LINE and a cell that a line bounds, each
  // filtered on the axis it varies in. This is the scale the walls, the base
  // band and the soffit were missing, and no amount of figure supplies it.
  const acrossFace = n.x.abs().greaterThan(n.z.abs())
  const along = acrossFace.select(P.z, P.x)
  const alongPixel = acrossFace.select(pixelNorth, pixelEast)
  // Walls: a 1.2 by 2.4 m board rhythm on the lining, its shadow joints 6 mm.
  const boardV = line(P.y, 1.2, 0, .006, pixelUp)
  const boardH = line(along, 2.4, 0, .006, alongPixel)
  // THE LIFT OF A BOARD-FORMED POUR. A cast wall is not a cloud: it is
  // horizontal boards, each lift leaving a fine line and a change of tone,
  // and a line in P.y is read on the one axis a receding wall keeps thin.
  // This is the fine scale the lining was missing, in place of more drift.
  const formLift = line(P.y, .6, .07, .004, pixelUp)
  const formBoard = line(P.y, .15, .01, .0008, pixelUp)
  const boardJoint = boardV.max(boardH)
  const boardCell = hashOf(floor(P.y.div(1.2)).add(floor(along.div(2.4)).mul(5.73)), 17.31)
    .mul(resolved(2.4, alongPixel)).mul(resolved(1.2, pixelUp)).toVar()
  // The dark stone is laid, not cast: a head joint every 0.92 m and a face
  // tone per stone, which is the only reading a 0.16 m band can hold at all.
  const stoneJoint = line(along, .92, 0, .004, alongPixel)
  const stoneCell = hashOf(floor(along.div(.92)).add(floor(P.y.div(.17)).mul(3.17)), 11.73)
    .mul(resolved(.92, alongPixel)).toVar()
  // The ceiling is coffered on the structure's own four-metre bay, and each
  // bay was floated on its own day: the panel between two ribs is the unit a
  // plasterer worked, so it is the unit that varies.
  const bayNorth = line(P.z, 4, 0, .02, pixelNorth), bayEast = line(P.x, 4, 2, .02, pixelEast)
  const bayCell = hashOf(floor(P.x.sub(2).div(4)).add(floor(P.z.div(4)).mul(9.13)), 7.19)
    .mul(resolved(4, pixelEast.max(pixelNorth))).toVar()
  // ONE DIRECTIONAL READ FOR THE WHOLE MESH. A float sweep, a saw mark, a
  // brush and a rain wash are the same anisotropic field turned and sized by
  // the part, so they cost one tap between them instead of one each.
  const strokeAxis = isSteel.select(vec3(160, 12, 160),
    isFloor.select(vec3(34, 34, 3.8),
      isOutdoor.select(vec3(52, 2.9, 52), vec3(5.4, 3.1, 5.4))))
  // THE LAP, WHICH IS THE ONE MID SCALE A RECEDING PLANE CAN HOLD. A pixel
  // out in the room is thin in one world axis and metres long in the other,
  // so a blob under that long axis is never sampled, only averaged; a band
  // laid across the THIN axis is. Plaster really is banded by the float's
  // laps and a sawn floor by its saw run, so the band is what these surfaces
  // carry between the board and the grain.
  const upright = n.y.abs().lessThan(.5)
  const flatThinEast = pixelEast.lessThan(pixelNorth)
  const thin = upright.select(P.y, flatThinEast.select(P.x, P.z))
  const thinPixel = upright.select(pixelUp, pixelEast.min(pixelNorth))
  // The stroke is anisotropic by construction, so it is filtered on the same
  // thin axis: gated on the round figure it died at the dark end of a room
  // and took the floor's saw run with it.
  const stroke = mx_noise_float(P.mul(strokeAxis))
    .mul(resolved(byRole([.03, .2, .2, .02, .2, .05]), thinPixel)).toVar()
  // Two octaves of it, because a float lays laps inside laps, and because one
  // octave over the eighteen cells a phone frame holds does not average to
  // zero: its own mean is what moves that frame's exposure.
  const lapM = byRole([.11, .115, .034, .05, .19, .12])
  const lapT = thin.div(lapM)
  const lap = bands(lapT, 23.7).mul(.62).mul(resolved(lapM, thinPixel))
    .add(bands(lapT.mul(2.37).add(1.7), 9.41).mul(.38).mul(resolved(lapM.div(2.37), thinPixel))).toVar()
  // And the room-scale drift above the part: damp, handling and years of
  // light do not stop at a board's edge. Metres wide, so it survives any
  // pixel a station stands at, which the part's own macro cannot. Its weight
  // is held down because four cells of it across a wall that fills a phone
  // frame do not average to zero, and that frame's exposure is what moves.
  const driftM = byRole([3.2, 3, 1.9, 1.2, 3.6, 3.4])
  const drift = bands(along.div(driftM), 5.13).mul(resolved(driftM, alongPixel)).toVar()
  const colourOf = (key: keyof typeof PALETTE) => { const c = new Color(PALETTE[key]); return vec3(c.r, c.g, c.b) }
  const base = isFloor.select(colourOf('floor'),
    isPlaster.select(colourOf('plaster'),
      isDark.select(colourOf('dark'),
        isSteel.select(colourOf('steel'),
          isCeiling.select(colourOf('ceiling'), colourOf('paving'))))))
  const hall = hallInterior(P).toVar()
  const hallColour = (hex: string) => { const c = new Color(hex); return vec3(c.r, c.g, c.b) }
  // The camera obscura's bay is lined dark: its walls are there to keep light out.
  const inBay = P.x.greaterThan(-47.55).and(P.x.lessThan(-43.65)).and(P.z.greaterThan(51.35)).and(P.z.lessThan(54.45))
  const hallPlaster = inBay.select(hallColour(HALL.bay), hallColour(HALL.plaster))
  const tone = mix(base, isFloor.select(hallColour(HALL.floor), isPlaster.select(hallPlaster,
    isCeiling.select(hallColour(HALL.ceiling), base))), hall)
  // A DENSITY GRADIENT, NOT A UNIFORM FIELD. How mottled a surface is varies
  // stone by stone, which is the one gradient a laid floor really carries.
  const cell = isFloor.select(slabCell, isPlaster.select(boardCell, isDark.select(stoneCell,
    isSteel.select(float(0), isCeiling.select(bayCell, slabCell))))).toVar()
  // WEAR WHERE FEET AND HANDS GO. A floor is polished on its walk and left
  // alone under the wall, so the grain goes first, the joint silts up and the
  // mottle quietens; the stone's own cell breaks the line so no edge of it is
  // ever a clean gradient. A jamb takes the same at the height of a hand.
  const traffic = trafficLine(P)
  const walked = traffic.feet.mul(n.y.max(0)).mul(byRole([1, 0, 0, 0, 0, 1]))
    .mul(float(.7).add(cell.mul(.9))).clamp(0, 1).toVar()
  // The walk itself is swept and polished; the grime collects at its edges,
  // which is why the two terms together move the exposure by nothing.
  const grime = walked.mul(walked.oneMinus()).mul(4).clamp(0, 1).toVar()
  const handled = traffic.doors.mul(smoothstep(.44, 0, P.y.sub(FLOOR + 1.02).abs()))
    .mul(n.y.abs().oneMinus().max(0)).mul(byRole([0, .55, 1, .8, 0, 0])).toVar()
  const density = float(1).add(cell.mul(.5)).sub(walked.mul(.4)).clamp(.3, 1.6)
  const figure = detail.tone.sub(1).mul(byRole([1, 1, 1.5, .45, .98, 1.15])).mul(density)
    .add(cell.mul(byRole([.34, .055, .13, 0, .06, .34])))
    .add(lap.mul(byRole([.24, .26, .19, .05, .21, .23])).mul(density))
    .add(drift.mul(byRole([.075, .03, .07, .02, .03, .085])))
    .add(stroke.mul(byRole([.075, .09, .26, .06, .09, .1])))
    // The hall's darker stone shows its slabs apart: a deeper floor holds the
    // same mottle at less contrast, so its stone-to-stone step is widened.
    .add(cell.mul(hall.mul(isFloor.select(float(HALL.slabStep), float(0)))))
  const silted = walked.mul(.34).oneMinus()
  const cut = isFloor.select(slabJoint.mul(.34).mul(silted),
    isPlaster.select(boardJoint.mul(.16).max(formLift.mul(.06)).max(formBoard.mul(.045)),
      isCeiling.select(bayNorth.max(bayEast).mul(.16).max(formLift.mul(.04)).max(formBoard.mul(.03)),
        isDark.select(stoneJoint.mul(.2), isOutdoor.select(slabJoint.mul(.24).mul(silted), float(0))))))
  // ONE ALBEDO FOR BOTH CHANNELS. The fittings' wash was re-emitting the flat
  // palette colour beside the figured albedo, so on every surface a fitting
  // reaches, a share of the pixel carried no material at all and the figure
  // read at a fraction of the contrast it was authored at. The wash itself is
  // untouched: what a lamp puts on a stone is still the stone.
  const albedo = tone.mul(figure.add(1)).mul(float(1).sub(cut))
    .mul(float(1).add(walked.mul(.08)).sub(grime.mul(.13)).sub(handled.mul(.035))).toVar()
  // THE COURT'S FLAGS ARE STONES OF THEIR OWN: a tone, a grain and wear per
  // slab on the paving's top face, outdoors only
  const courtTop = isOutdoor.select(smoothstep(.9, .97, n.y).mul(float(1).sub(smoothstep(.006, .016, P.y.sub(COURT.level).abs()))), float(0))
  const flags = flagFace({ east: COLLECTION_PAVING_ORIGIN.east, north: COLLECTION_PAVING_ORIGIN.north, pitchEast: LINE_SLAB.pitchEast, pitchNorth: LINE_SLAB.pitchNorth, bond: 0 },
    walked, float(.3))
  m.colorNode = mix(albedo, albedo.mul(flags.tone), courtTop)
  // A RELIEF FILTERED AWAY LEAVES A SMOOTHER PLANE THAN WAS AUTHORED, and a
  // smoother plane is a shinier one: the slope the gates took goes into the
  // distribution instead, or the stone sparkles where its tone has gone calm.
  m.roughnessNode = specularAA(isSteel.select(float(.42).add(stroke.mul(.09)).sub(handled.mul(.06)),
    // STONE TO STONE IN THE SHEEN, not only in the tone. These rooms are lit
    // almost wholly by an indirect term, where a change of albedo is worth two
    // or three levels and a change of gloss is worth the whole grazing
    // highlight: which slab catches the north light is what reads as stone.
    isFloor.select(mix(float(.62), float(HALL.floorRough), hall).add(detail.rough).add(cell.mul(.16)).add(lap.mul(.06))
      .add(slabJoint.mul(.15)).sub(walked.mul(.22)).add(grime.mul(.07)),
      isOutdoor.select(float(.88).add(detail.rough).add(cell.mul(.14)).add(lap.mul(.05)).sub(walked.mul(.18)).add(flags.rough.mul(courtTop)),
        float(.88).add(detail.rough).add(cell.mul(.1)).add(lap.mul(.07)).add(formBoard.mul(.05)).sub(handled.mul(.09))))).clamp(.30, .97), detail.lost)
  m.metalnessNode = isSteel.select(float(.72), float(.02))
  // A sawn slab keeps a shallow relief of its own; at the room's drift it had
  // none, so nothing on it ever caught a raking light.
  const relief = detail.heightM.mul(byRole([.45, .4, 2.1, .25, .38, .7])).toVar()
  const worn = walked.mul(.5).oneMinus()
  const height = isFloor.select(relief.mul(worn).add(slabJoint.mul(-.0022)),
    isPlaster.select(relief.add(stroke.mul(.0006)).add(lap.mul(.0011)).add(formLift.mul(-.0007)).add(boardJoint.mul(-.0012)),
      isCeiling.select(relief.add(stroke.mul(.0005)).add(lap.mul(.0009)).add(bayNorth.max(bayEast).mul(-.004)),
        isDark.select(relief.add(stroke.mul(.0022)).add(stoneJoint.mul(-.0018)),
          isOutdoor.select(relief.mul(worn).add(slabJoint.mul(-.0024)), relief))))).toVar()
  m.normalNode = reliefNormal(n.transformDirection(cameraViewMatrix), height, .2)
  const daylight = interiorDaylight(P, n)
  m.aoNode = isOutdoor.select(float(1), daylight.mul(1.55).add(.10).clamp(.10, 1))
  // THE ROOMS ARE LIT BY THEIR OWN FITTINGS. No room here sees the sun, and
  // a gallery lit by nothing but the share of sky its window lets in reads
  // as a cellar at this exposure, which is not what a modern museum looks
  // like at four in the afternoon. The cove over the hanging wall, the
  // uplights on the hall's beams and the line of light in the gallery's
  // coffers are modelled as the irradiance they put on the surfaces they
  // face. They add no second shadow-casting light, and they never touch the
  // measured sun.
  const wash = fittingWash(P, n).mul(isOutdoor.select(float(0), float(1))).mul(mix(float(1), float(HALL.wash), hall))
  m.emissiveNode = albedo.mul(wash)
  m.name = 'vinci/collection-rooms/surfaces'
  m.userData = {
    manifestId: collectionRoomsProvenance.manifestId, assetClass: 'GENERATED',
    certainty: 'reconstructed', recipe: collectionRoomsProvenance.recipe,
    filtering: 'Pixel-filtered three-scale detail sized by each part rather than by the room, from a 0.42 m floor stone down to a 0.08 m base band, with a directional read per family, 8 mm floor joints on a 1.60 by 1.65 m grid, 6 mm lining joints and 20 mm soffit bay lines; all relief from bounded world and view derivatives, no normal map.',
  }
  return m
}

/** The heads of the new partitions are glazed, so a room that has no outside
 * wall still borrows the daylight of the one next door. */
export function collectionBorrowedLightMaterial(): MeshStandardNodeMaterial {
  const { float, mx_noise_float, positionWorld, smoothstep } = TSL as unknown as Record<string, TSLNode>
  const m = new MeshStandardNodeMaterial({ color: '#a8b2ad', roughness: .16, metalness: .1, transparent: true, opacity: .22, depthWrite: false, side: DoubleSide })
  m.envMapIntensity = 2.2
  m.forceSinglePass = true
  const P = positionWorld, pixel = anisotropicFootprint(P)
  const wave = mx_noise_float(P.mul(3.2)).mul(smoothstep(2, 4, float(.3).div(pixel)))
  m.roughnessNode = float(.16).add(wave.mul(.012))
  m.name = 'vinci/collection-rooms/borrowed-light'
  m.userData = { manifestId: collectionRoomsProvenance.manifestId, assetClass: 'GENERATED', certainty: 'reconstructed' }
  return m
}


/** The five surfaces the line, the corrections and the grave are built from.
 * They are the host's to supply, and here they are the rooms' own stones, so
 * an exhibit and the floor it stands on are cut from one quarry. Procedural
 * throughout: the library's budget for this page is already spent. */
export function collectionExhibitMaterials(): {
  stone: MeshStandardNodeMaterial; plaster: MeshStandardNodeMaterial
  bronze: MeshStandardNodeMaterial; ink: MeshStandardNodeMaterial; dark: MeshStandardNodeMaterial
} {
  const { cameraViewMatrix, float, normalWorldGeometry, positionWorld, vec3 } = TSL as unknown as Record<string, TSLNode>
  interface Part {
    /** the three feature sizes and the part's own smallest extent, metres */
    scales: [number, number, number]; extent: number
    /** the band across the thin axis, the run along the face, the block */
    lapM: number; driftM: number; cellM?: [number, number]
    /** how far each term swings the tone */
    figure: number; lap: number; drift: number; cell: number
    relief: number
  }
  const make = (colour: string, roughness: number, metalness: number, part: Part) => {
    const m = new MeshStandardNodeMaterial({ color: colour, roughness, metalness })
    const P = positionWorld, n = normalWorldGeometry
    const t = surfaceTerms({
      scales: part.scales, extent: part.extent, relief: part.relief,
      lapM: part.lapM, driftM: part.driftM, cellM: part.cellM ?? null,
    })
    const c = new Color(colour)
    // A DENSITY GRADIENT THE BLOCK ITSELF CARRIES: how mottled a stone is
    // varies stone to stone, which is the one gradient a laid floor has.
    const density = float(1).add(t.cell.mul(.5)).clamp(.3, 1.6)
    const figure = t.tone.sub(1).mul(part.figure).mul(density)
      .add(t.lap.mul(part.lap).mul(density)).add(t.drift.mul(part.drift)).add(t.cell.mul(part.cell))
    m.colorNode = vec3(c.r, c.g, c.b).mul(figure.add(1))
    // Gloss carries further than tone where the light is nearly all indirect.
    m.roughnessNode = specularAA(
      float(roughness).add(t.rough).add(t.cell.mul(.13)).add(t.lap.mul(.06)).clamp(.08, .98), t.lost)
    m.normalNode = reliefNormal(n.transformDirection(cameraViewMatrix),
      t.heightM.add(t.lap.mul(part.relief * .5)), .18)
    m.userData = { manifestId: collectionRoomsProvenance.manifestId, assetClass: 'GENERATED', certainty: 'reconstructed' }
    return m
  }
  // The grave's floor is 1.8 by 1.4 m slabs and the gallery behind it 0.58 m
  // cast boards, both cut from this one stone, so its ladder is fitted to the
  // board and its block to the slab.
  const stone = make(PALETTE.floor, .66, .02, {
    scales: [.31, .05, .002], extent: .62, lapM: .1, driftM: 2.6, cellM: [1.8, 1.4],
    figure: 1.2, lap: .24, drift: .1, cell: .34, relief: .0028 })
  {
    // THE GRAVE'S FLOOR IS FLAGS IN A SHADED COURT, 1.8 by 1.4 m in running
    // bond as the grave lays them: each its own stone, worn round the tomb,
    // green-black at the joints under the gallery's walls. Only the floor's
    // top face, two centimetres over the court's paving.
    const { smoothstep: step, mix: blend } = TSL as unknown as Record<string, TSLNode>
    const P = positionWorld, n = normalWorldGeometry
    const top = step(.9, .97, n.y).mul(float(1).sub(step(.004, .012, P.y.sub(COURT.level + .02).abs())))
    const tomb = [{ west: GRAVE_ORIGIN.east + .65 - 1.87, east: GRAVE_ORIGIN.east + .65 + 1.87, south: GRAVE_ORIGIN.north - .95 - 1.08, north: GRAVE_ORIGIN.north - .95 + 1.08 }]
    const walls = [{ west: -61.4, east: -60.49, south: COURT.south, north: -15.8 }, { west: -61.4, east: -40.85, south: -16.48, north: -15.8 }]
    const walked = float(1).sub(step(.3, 2.4, distanceToBoxes(tomb))).mul(.8)
    const damp = float(.45).add(float(1).sub(step(.4, 3.5, distanceToBoxes(walls))).mul(.55))
    const face = flagFace({ east: GRAVE_ORIGIN.east - 4, north: GRAVE_ORIGIN.north, pitchEast: 1.4, pitchNorth: 1.8, bond: .9 }, walked, damp)
    stone.colorNode = (stone.colorNode as TSLNode).mul(blend(float(1), face.tone, top))
    stone.roughnessNode = (stone.roughnessNode as TSLNode).add(face.rough.mul(top))
  }
  const plaster = make(PALETTE.plaster, .9, .01, {
    scales: [.3, .05, .0025], extent: .6, lapM: .15, driftM: 2.4,
    figure: 1, lap: .13, drift: .06, cell: 0, relief: .0022 })
  const bronze = make('#6d6350', .43, .72, {
    scales: [.09, .02, .0015], extent: .2, lapM: .028, driftM: .6,
    figure: .5, lap: .06, drift: .03, cell: 0, relief: .0009 })
  const ink = make('#2b2f2c', .93, .02, {
    scales: [.06, .015, .001], extent: .12, lapM: .02, driftM: .4,
    figure: .45, lap: .05, drift: .03, cell: 0, relief: .0005 })
  // The gallery's backing stands in the court's own shade behind the grave:
  // the last plane of the walk, and the one with least light to read it by.
  const dark = make(PALETTE.dark, .82, .04, {
    scales: [.26, .045, .002], extent: .52, lapM: .095, driftM: 2.2, cellM: [1.2, .6],
    figure: 1.8, lap: .32, drift: .14, cell: .22, relief: .0024 })
  for (const [name, material] of Object.entries({ stone, plaster, bronze, ink, dark })) material.name = `vinci/collection-rooms/${name}`
  return { stone, plaster, bronze, ink, dark }
}

/* THE COURT'S EXHIBIT IS DRESSED FROM THIS MODULE'S OWN RECIPE.
 *
 * The page already holds the whole of its standard texture budget when this
 * ground is built, and the machine standing outside in the court asks the
 * shared library for four more photographed sets, which carries the page
 * past it. So that one exhibit is built against a stack whose library
 * answers out of a recipe instead of out of bytes: the same three filtered
 * scales and grain field the line, the corrections, the grave and every
 * surface in these rooms stand on. Its geometry, its welding and the
 * bench's own tints are untouched, and this module asks the library for
 * nothing at any tier.
 */
interface CourtRecipe {
  albedo: string; variation: string; roughness: number; metalness: number
  cls: MaterialClass; scales: [number, number, number]; normalStrength: number
  falloff: number; macroContrast: number; micro: number; grain: GrainRecipe | null
}

const COURT_STONE: CourtRecipe = {
  albedo: PALETTE.floor, variation: '#6f6c63', roughness: .72, metalness: 0, cls: 'stone',
  scales: [2.4, .42, .035], normalStrength: .45, falloff: 1, macroContrast: .3, micro: .5, grain: null,
}

const COURT_RECIPES: Record<string, CourtRecipe> = {
  // Sealed flax over the ribs. The bench tints the cloth itself, so what
  // this recipe carries is the drape, the tooth and how dull the flax is.
  // THE CLOTH IS DULL BECAUSE THE FRAME SAYS SO. This canopy is the one
  // surface on this ground that stands against the open sky, and the whole
  // walk sees it. A cloth roughness low enough to hold a lobe put a clipped
  // white ridge down it, which no resolve can anti-alias: an edge between a
  // saturated pixel and a dark one has no gradient left to sample.
  linen: {
    albedo: '#c4b89c', variation: '#9e9076', roughness: .93, metalness: 0, cls: 'cloth',
    scales: [1.5, 0, .008], normalStrength: .6, falloff: .7, macroContrast: .45, micro: .5,
    grain: { kind: 'ridges', pitch: .2, angle: 0, relief: .6, shade: .55, sheen: .06, fold: .46, tooth: .012 },
  },
  // The four ribs and the uprights under them.
  'oak-beams': {
    albedo: '#8a7a5e', variation: '#5e5138', roughness: .74, metalness: 0, cls: 'wood',
    scales: [1, 0, .02], normalStrength: .8, falloff: 1, macroContrast: .5, micro: .5,
    grain: { kind: 'wave', pitch: .26, angle: 0, relief: .34, shade: .4, sheen: .08, fold: .6, tooth: .016 },
  },
  // The suspension cords, whose twist is in the geometry and not in a map.
  rope: {
    albedo: '#b2a07c', variation: '#87764f', roughness: .86, metalness: 0, cls: 'fibre',
    scales: [.4, .09, .007], normalStrength: .9, falloff: .7, macroContrast: .4, micro: .6, grain: null,
  },
  // The harness.
  'leather-worn': {
    albedo: '#6b5844', variation: '#463829', roughness: .72, metalness: 0, cls: 'cloth',
    scales: [1, 0, .01], normalStrength: .5, falloff: .8, macroContrast: .95, micro: 1,
    grain: { kind: 'creases', pitch: .22, angle: 0, relief: .34, shade: .45, sheen: .34, fold: .52, tooth: .014 },
  },
}

/** A set the library never has to fetch: the recipe above, and maps that
 * read as the identity, so the helper's own scales are the whole surface. */
function courtSet(name: string): MaterialSet {
  const { float, positionWorld, uniform, vec3 } = TSL as unknown as Record<string, TSLNode>
  const r = COURT_RECIPES[name] ?? COURT_STONE
  const albedo = new Color(r.albedo), variation = new Color(r.variation)
  const flat = {
    albedo: vec3(1, 1, 1), colour: vec3(albedo.r, albedo.g, albedo.b),
    normal: vec3(0, 0, 1), roughness: float(r.roughness), occlusion: float(1),
  }
  const set: MaterialSet = {
    name, albedo, variation, roughness: r.roughness, metalness: r.metalness,
    scales: r.scales, normalStrength: r.normalStrength, falloff: r.falloff,
    metres: [1, 1], scale: [1, 1], cls: r.cls, grain: r.grain, detile: 0, maps: null,
    detail: { macro: r.scales[0], macroContrast: r.macroContrast, mid: r.scales[1], micro: r.micro },
    entry: {
      id: collectionRoomsProvenance.manifestId, path: 'procedural/collection-rooms/',
      class: 'GENERATED', wing: 'vinci', display: true, date: collectionRoomsProvenance.date,
      licence: 'Original procedural construction; source code under the museum repository licence.',
      model: 'Deterministic TypeScript and TSL procedural geometry',
      prompt: `Procedural surface standing in for the library set "${name}" on the court's own exhibit: three filtered scales and a grain field, at the metre sizes declared here. No texture asset, no reference image sampled.`,
    },
    // Nothing is in flight, so the set is displayable from the first frame.
    ready: uniform(1),
    place: (at = {}) => at.uv ?? (at.world ?? positionWorld).xz,
    sample: () => flat,
    material: () => {
      const m = new MeshStandardNodeMaterial({ color: albedo, roughness: r.roughness, metalness: r.metalness })
      applyDetail(m, set)
      m.name = `vinci/collection-rooms/court-${name}`
      return m
    },
  }
  return set
}

/** The stack the court's exhibit is built against. */
export function collectionProceduralStack(stack: Stack): Stack {
  const made = new Map<string, MaterialSet>()
  const of = (name: string): MaterialSet => {
    let set = made.get(name)
    if (!set) { set = courtSet(name); made.set(name, set) }
    return set
  }
  return {
    ...stack,
    materials: {
      ...stack.materials,
      load: (name: string) => Promise.resolve(of(name)),
      sync: of,
      // Nothing is ever in flight here, and the tier the rest of the page is
      // drawn at is never touched on this exhibit's behalf.
      pending: () => 0,
      setTier: () => undefined,
      dispose: () => undefined,
    },
  }
}
