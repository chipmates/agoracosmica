/** THE GRAVE COURT, MADE: the wing's quiet close.
 *
 * The court's three walls are the gallery the grave brings with it, a cast
 * core of boards. This module lays a leaf of long flat brick in front of that
 * core on the court's side, the way the reference building lays its brick, and
 * raises the back wall over the core as a filter band: brick laid with its head
 * joints left open, so the western light passes the wall in small slots and
 * falls on the north wall under the back wall's shadow. A plinth course and a
 * string course of pale stone take the core's own bands inside them; stone
 * copings close the tops, and the north wall's coping is the last warm line of
 * the day.
 *
 * On the floor: an oak walkway on two bearers from the court's open side to
 * the foot of the slab, an oak bench on bronze feet facing the slab, and three
 * field maples in steel-edged beds of earth. The ground's flags, drifts and
 * moss are the ground's own and stay under and around all of it.
 *
 * Nothing here enters the certified walk: the walkway and the bench stand
 * under the walking eye's envelope, and every crown keeps a clearance round
 * every certified line through the court (`court-check.mjs` proves both). No
 * figure stands in the court: no record names one. A modern design; nothing
 * of 1519 is claimed.
 */
import { BoxGeometry, Color, Group, Mesh, MeshStandardNodeMaterial, type Material } from 'three/webgpu'
import * as TSL from 'three/tsl'
import { reliefNormal, resolved, specularAA, surfaceDetail } from '../../../stack/detail'
import { SHADOW_ONLY_LAYER } from '../../../stack/light'
import { Construction, type ExhibitMaterials } from '../myths/construction'
import { Body, fallenLeaf, fallenPalette, growTree, mulberry, type Refuse, type TreeResult, type TreeTier } from '../tree-growth'
import { vegetationMaterials, vegetationMesh } from '../vegetation'
import { applyCourtLight } from './court-light'
import { windWanted } from '../wind'
import {
  BED, BENCH, BRICK, CERTIFIED_LINES, COURT_TREE_FORM, COURT_TREES, FILTER, GRAVE_COURT_LEVEL, GRAVE_COURT_ORIGIN,
  GRAVE_MOUNT_RISE, LEAF, PLINTH_COURSE, STRING_COURSE, toLocal, WALK_KEEP, WALKWAY,
} from './court-plan'

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  abs, cameraViewMatrix, float, mix, mx_noise_float, normalWorldGeometry, positionWorld, smoothstep, uv: uvNode, vec2, vec3,
} = TSL as unknown as Record<string, N>

export const graveCourtProvenance = {
  manifestId: 'vinci/grave-court',
  assetClass: 'GENERATED',
  certainty: 'reconstructed',
} as const

/** the exhibition floor's top in the grave's own frame */
const FLOOR_Y = -.015
/** where the brick's first course is laid, in world metres */
const COURSE_DATUM = GRAVE_COURT_LEVEL + GRAVE_MOUNT_RISE + PLINTH_COURSE.top
/** a body laid against another runs this far into it, so no plane is shared */
const BED_M = .004

/* ─── the surfaces ─────────────────────────────────────────────────────── */

const linear = (hex: string): [number, number, number] => { const c = new Color(hex); return [c.r, c.g, c.b] }

/** THE BRICK: warm light grey, each brick its own cast, the joints struck
 * flush and a little paler than the face. An open course carries no head
 * joint of its own: its slots are the heads. */
function brickSurface(open: boolean): MeshStandardNodeMaterial {
  const base = linear('#a49f95')
  const m = new MeshStandardNodeMaterial({ roughness: .88, metalness: 0 })
  const P = positionWorld, n = normalWorldGeometry
  const along = abs(n.x).greaterThan(abs(n.z)).select(P.z, P.x)
  const d = surfaceDetail({
    scales: [.6, .07, .004], figure: [.06, .045, .04], relief: .0012,
    uv: vec2(along, P.y.sub(COURSE_DATUM)),
    courses: {
      courseM: BRICK.course, courseWaveM: 2.7, courseSwing: .0012,
      blockM: open ? 60 : BRICK.length + BRICK.joint, blockSwing: .012,
      jointM: BRICK.joint, wanderM: .0005, faceSwing: .04, blockFaceSwing: .09, seed: 17.3,
    },
    jointShade: -.09,
  })
  const warm = smoothstep(.74, .92, d.cell), cool = float(1).sub(smoothstep(.08, .26, d.cell))
  const c = vec3(...base).mul(d.tone)
    .mul(mix(vec3(1, 1, 1), vec3(1.06, 1.0, .92), warm))
    .mul(mix(vec3(1, 1, 1), vec3(.95, .99, 1.04), cool))
  m.colorNode = c
  applyCourtLight(m, c)
  m.roughnessNode = specularAA(float(.87).add(d.rough).add(d.joint.mul(.05)), d.lost)
  m.normalNode = reliefNormal(n.transformDirection(cameraViewMatrix), d.heightM, .25)
  m.name = `vinci/grave-court/${open ? 'brick-open' : 'brick'}`
  m.userData = { ...graveCourtProvenance }
  return m
}

/** Pale limestone for the courses and copings, dressed fine. */
function stoneSurface(): MeshStandardNodeMaterial {
  const base = linear('#c3bcab')
  const m = new MeshStandardNodeMaterial({ roughness: .78, metalness: 0 })
  const n = normalWorldGeometry
  const d = surfaceDetail({ scales: [.45, .05, .003], figure: [.07, .05, .04], relief: .0015 })
  // the top of a coping keeps the weather: a little darker and greener where
  // the rain lies, never on its vertical faces
  const top = smoothstep(.6, .9, n.y)
  const weather = mx_noise_float(positionWorld.mul(1.7)).mul(.5).add(.5).mul(resolved(.6, d.pixel))
  const c = vec3(...base).mul(d.tone).mul(mix(vec3(1, 1, 1), vec3(.9, .92, .86), top.mul(weather).mul(.6)))
  m.colorNode = c
  applyCourtLight(m, c)
  m.roughnessNode = specularAA(float(.78).add(d.rough), d.lost)
  m.normalNode = reliefNormal(n.transformDirection(cameraViewMatrix), d.heightM, .2)
  m.name = 'vinci/grave-court/stone'
  m.userData = { ...graveCourtProvenance }
  return m
}

/** Oiled oak outdoors: the grain runs along `grain` (east, north), the tops
 * a little silvered by the weather. */
function oakSurface(name: string): MeshStandardNodeMaterial {
  const base = linear('#8a7257'), silver = linear('#8e887e')
  const m = new MeshStandardNodeMaterial({ roughness: .62, metalness: 0 })
  const P = positionWorld, n = normalWorldGeometry
  // each board carries its grain's direction, (east, north), as its texture
  // coordinate, so the walk's boards and the bench's slats are one body
  const grain = uvNode(), gx = grain.x, gz = grain.y.negate()
  const along = P.x.mul(gx).add(P.z.mul(gz)), across = P.z.mul(gx).sub(P.x.mul(gz))
  const d = surfaceDetail({ scales: [.4, .05, .003], figure: [.05, .04, .03], relief: .0008 })
  // the figure: long streaks along the grain, a slower wave across it
  const streak = mx_noise_float(vec3(along.mul(.9), across.mul(34), P.y.mul(34))).mul(resolved(.03, d.pixel))
  const wave = mx_noise_float(vec3(along.mul(.25), across.mul(6), P.y.mul(6))).mul(resolved(.15, d.pixel))
  const top = smoothstep(.55, .9, n.y)
  const tone = d.tone.mul(float(1).add(streak.mul(.14)).add(wave.mul(.1)))
  const c = mix(vec3(...base), vec3(...silver), top.mul(.5)).mul(tone)
  m.colorNode = c
  applyCourtLight(m, c)
  m.roughnessNode = specularAA(float(.6).add(top.mul(.16)).add(d.rough).add(streak.abs().mul(.05)), d.lost)
  m.normalNode = reliefNormal(n.transformDirection(cameraViewMatrix), d.heightM.add(streak.mul(.0004)), .2)
  m.name = `vinci/grave-court/${name}`
  m.userData = { ...graveCourtProvenance }
  return m
}

function metalSurface(hex: string, roughness: number, metalness: number, name: string): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness, metalness })
  const d = surfaceDetail({ scales: [.2, .03, .002], figure: [.06, .04, .03], relief: .0004 })
  m.colorNode = vec3(...linear(hex)).mul(d.tone)
  m.roughnessNode = specularAA(float(roughness).add(d.rough), d.lost)
  m.name = `vinci/grave-court/${name}`
  m.userData = { ...graveCourtProvenance }
  return m
}

/** The beds' earth: dark and crumbed, finer where it was raked. */
function earthSurface(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .96, metalness: 0 })
  const P = positionWorld, n = normalWorldGeometry
  const d = surfaceDetail({ scales: [.3, .04, .006], figure: [.12, .1, .09], relief: .004 })
  const crumbs = mx_noise_float(P.mul(55)).mul(.5).add(.5).mul(resolved(.018, d.pixel))
  const c = vec3(...linear('#5c4c3c')).mul(d.tone).mul(float(.88).add(crumbs.mul(.24)))
  m.colorNode = c
  applyCourtLight(m, c)
  m.roughnessNode = float(.96)
  m.normalNode = reliefNormal(n.transformDirection(cameraViewMatrix), d.heightM.add(crumbs.mul(.002)), .3)
  m.name = 'vinci/grave-court/earth'
  m.userData = { ...graveCourtProvenance }
  return m
}

export interface GraveCourtSurfaces {
  brick: Material; open: Material; stone: Material; walkway: Material; bench: Material
  bronze: Material; steel: Material; earth: Material
}
export function graveCourtSurfaces(): GraveCourtSurfaces {
  // one brick for the whole leaf and its band, one oak for walk and bench:
  // a body per material is a draw per material
  const brick = brickSurface(false), oak = oakSurface('oak')
  return {
    brick, open: brick, stone: stoneSurface(),
    walkway: oak, bench: oak,
    bronze: metalSurface('#6b5537', .42, .8, 'bronze'),
    steel: metalSurface('#2d2c2a', .5, .65, 'steel'),
    earth: earthSurface(),
  }
}

/* ─── the walls ────────────────────────────────────────────────────────── */

/** a box between two corners, in the grave's own frame */
function span(build: Construction, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, material: Material): void {
  build.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), material)
}

function buildWalls(build: Construction, s: GraveCourtSurfaces): void {
  const back = LEAF.backFace, backRear = LEAF.backFace - LEAF.depth
  const face = LEAF.returnFace, rear = LEAF.returnFace + LEAF.depth
  // THE BACK WALL between the returns, its leaf run a bed into both of them
  const reach = face + BED_M
  span(build, -reach, LEAF.foot, backRear, reach, PLINTH_COURSE.top, PLINTH_COURSE.backFace, s.stone)
  span(build, -reach, PLINTH_COURSE.top - BED_M, backRear, reach, STRING_COURSE.bottom + BED_M, back, s.brick)
  span(build, -reach, STRING_COURSE.bottom, backRear, reach, STRING_COURSE.top, STRING_COURSE.backFace, s.stone)
  span(build, -reach, STRING_COURSE.top - BED_M, backRear, reach, FILTER.bottom + BED_M, back, s.brick)
  // THE RETURNS, each laid from the back wall's face to its own end, with an
  // end cap over the core's end and a coping over both
  for (const side of [-1, 1]) {
    const x = (v: number): number => side * v
    span(build, x(PLINTH_COURSE.returnFace), LEAF.foot, backRear, x(rear), PLINTH_COURSE.top, LEAF.returnEnd, s.stone)
    span(build, x(face), PLINTH_COURSE.top - BED_M, backRear, x(rear), LEAF.returnTop, LEAF.returnEnd, s.brick)
    // the core's end face, closed in brick; it runs a bed into the core
    span(build, x(face), LEAF.foot, LEAF.returnEnd - BED_M, x(9.17), LEAF.returnTop, LEAF.returnEnd + .04, s.brick)
    const over = LEAF.coping.over
    span(build, x(face - over), LEAF.returnTop - BED_M, back - BED_M, x(9.15 + over), LEAF.returnTop + LEAF.coping.height,
      LEAF.returnEnd + .04 + over, s.stone)
  }
  buildFilterBand(build, s)
}

/** THE FILTER BAND. Runs of solid courses and runs of open ones, staggered
 * run to run by half a brick and its slot, between two solid piers. */
function buildFilterBand(build: Construction, s: GraveCourtSurfaces): void {
  const z0 = LEAF.backFace - LEAF.depth, z1 = LEAF.backFace
  const half = FILTER.halfWidth, pierIn = half - FILTER.pier
  for (const side of [-1, 1]) span(build, side * pierIn, FILTER.bottom - BED_M, z0, side * half, FILTER.top + BED_M, z1, s.brick)
  const courses = Math.round((FILTER.top - FILTER.bottom) / BRICK.course)
  const course = (FILTER.top - FILTER.bottom) / courses
  const period = FILTER.solidCourses + FILTER.openCourses
  const pitch = BRICK.length + FILTER.slot
  let openRun = 0
  for (let c = 0; c < courses;) {
    const open = c % period === FILTER.solidCourses && c + FILTER.openCourses <= courses - FILTER.solidCourses
    const y0 = FILTER.bottom + c * course
    if (!open) {
      // a solid run is one body up to the next open run; the material draws
      // its head joints
      let run = 1
      while (c + run < courses && !((c + run) % period === FILTER.solidCourses && c + run + FILTER.openCourses <= courses - FILTER.solidCourses)) run++
      span(build, -pierIn - BED_M, y0 - BED_M, z0, pierIn + BED_M, y0 + run * course + BED_M, z1, s.brick)
      c += run
      continue
    }
    // an open run: bricks two courses tall with a slot between each pair,
    // the slot's position shifted half a pitch from the run below
    const y1 = y0 + FILTER.openCourses * course
    const shift = (openRun % 2) * pitch / 2
    for (let x = -pierIn - pitch + shift; x < pierIn; x += pitch) {
      const a = Math.max(-pierIn - BED_M, x), b = Math.min(pierIn + BED_M, x + BRICK.length)
      if (b - a > .05) span(build, a, y0, z0, b, y1, z1, s.open)
    }
    openRun++
    c += FILTER.openCourses
  }
  const over = FILTER.coping.over
  span(build, -half - over, FILTER.top, z0 - over, half + over, FILTER.top + FILTER.coping.height, z1 + over, s.stone)
}

/* ─── the floor ────────────────────────────────────────────────────────── */

/** a box turned about the vertical, in the grave's own frame: `along` is its
 * long axis as (x, z) */
function turnedBox(build: Construction, cx: number, cy: number, cz: number, length: number, height: number, width: number,
  along: [number, number], material: Material, grainOf?: [number, number]): void {
  const geometry = new BoxGeometry(length, height, width)
  geometry.rotateY(Math.atan2(-along[1], along[0]))
  geometry.translate(cx, cy, cz)
  if (grainOf) grained(geometry, grainOf)
  build.geometry(geometry, material)
}

/** a board's grain direction in the wing's (east, north), on every vertex */
function grained(geometry: BoxGeometry, grain: [number, number]): BoxGeometry {
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, grain[0], grain[1])
  return geometry
}

function buildWalkway(build: Construction, s: GraveCourtSurfaces): void {
  const [ax, az] = toLocal(...WALKWAY.from), [bx, bz] = toLocal(...WALKWAY.to)
  const length = Math.hypot(bx - ax, bz - az)
  const ux = (bx - ax) / length, uz = (bz - az) / length
  const across: [number, number] = [-uz, ux]
  const top = FLOOR_Y + WALKWAY.height, board = WALKWAY.board
  const bearerTop = top - board.thickness
  // two bearers under the boards, set in from each edge
  for (const offset of [-WALKWAY.width / 2 + .16, WALKWAY.width / 2 - .16]) {
    turnedBox(build, (ax + bx) / 2 + across[0] * offset, (FLOOR_Y + bearerTop) / 2 - BED_M / 2, (az + bz) / 2 + across[1] * offset,
      length - .06, bearerTop - FLOOR_Y + BED_M, .075, [ux, uz], s.steel)
  }
  // the boards across them, each its own length off true by a few mm
  const random = mulberry(90513)
  const pitch = board.width + board.gap
  const count = Math.floor(length / pitch)
  const start = (length - count * pitch + board.gap) / 2
  for (let i = 0; i < count; i++) {
    const t = start + i * pitch + board.width / 2
    const wander = (random() - .5) * .012
    turnedBox(build, ax + ux * t + across[0] * wander, top - board.thickness / 2, az + uz * t + across[1] * wander,
      WALKWAY.width - .004 * random(), board.thickness, board.width, across, s.walkway, [across[1], across[0]])
  }
  // a bronze nosing at the end the visitor steps on from
  turnedBox(build, ax + ux * (start - .012), top - .012, az + uz * (start - .012), WALKWAY.width + .02, .024, .024, across, s.bronze)
}

function buildBench(build: Construction, s: GraveCourtSurfaces): void {
  const [cx, cz] = toLocal(...BENCH.at)
  const seatTop = FLOOR_Y + BENCH.seat
  // three slats along the bench, a gap between each
  const slat = (BENCH.depth - .05) / 3
  for (let i = 0; i < 3; i++) {
    const x = cx - BENCH.depth / 2 + slat / 2 + i * (slat + .025)
    const geometry = grained(new BoxGeometry(slat, .045, BENCH.length), [1, 0])
    geometry.translate(x, seatTop - .0225, cz)
    build.geometry(geometry, s.bench)
  }
  // two bronze frames: a rail under the slats and two legs
  for (const at of [-BENCH.length / 2 + .28, BENCH.length / 2 - .28]) {
    const z = cz + at
    span(build, cx - BENCH.depth / 2 + .02, seatTop - .085, z - .022, cx + BENCH.depth / 2 - .02, seatTop - .045 + BED_M, z + .022, s.bronze)
    for (const x of [cx - BENCH.depth / 2 + .045, cx + BENCH.depth / 2 - .045])
      span(build, x - .02, FLOOR_Y - BED_M, z - .02, x + .02, seatTop - .085 + BED_M, z + .02, s.bronze)
  }
}

function buildBeds(build: Construction, s: GraveCourtSurfaces): void {
  const top = FLOOR_Y + BED.rise
  for (const tree of COURT_TREES) {
    const [cx, cz] = toLocal(tree.east, tree.north)
    const h = BED.half, t = BED.edge
    // the steel edge, set a little into the floor, its corners lapped
    span(build, cx - h, FLOOR_Y - .01, cz - h, cx - h + t, top + .006, cz + h, s.steel)
    span(build, cx + h - t, FLOOR_Y - .01, cz - h, cx + h, top + .006, cz + h, s.steel)
    span(build, cx - h + t - BED_M, FLOOR_Y - .01, cz - h, cx + h - t + BED_M, top + .006, cz - h + t, s.steel)
    span(build, cx - h + t - BED_M, FLOOR_Y - .01, cz + h - t, cx + h - t + BED_M, top + .006, cz + h, s.steel)
    span(build, cx - h + t, FLOOR_Y - BED_M, cz - h + t, cx + h - t, top, cz + h - t, s.earth)
  }
}

/* ─── the trees ────────────────────────────────────────────────────────── */

const segmentDistance = (e: number, n: number, a: readonly [number, number], b: readonly [number, number]): number => {
  const de = b[0] - a[0], dn = b[1] - a[1], l = de * de + dn * dn
  const t = Math.max(0, Math.min(1, ((e - a[0]) * de + (n - a[1]) * dn) / l))
  return Math.hypot(e - (a[0] + de * t), n - (a[1] + dn * t))
}

/** WHERE A COURT TREE MAY NOT GROW, in world metres: through a wall, within
 * the walk's keep of a certified line at any height, into the diagram's frame
 * or the lectern, or low over the court's floor. */
export function courtTreeRefusal(): Refuse {
  const floor = GRAVE_COURT_LEVEL + .02
  const backE = GRAVE_COURT_ORIGIN.east + LEAF.backFace
  const northN = GRAVE_COURT_ORIGIN.north + LEAF.returnFace, southN = GRAVE_COURT_ORIGIN.north - LEAF.returnFace
  const WALL_KEEP = .35
  return (x: number, y: number, z: number): boolean => {
    const e = x, n = -z
    if (e < backE + WALL_KEEP || n > northN - WALL_KEEP || n < southN + WALL_KEEP) return true
    if (y < floor + 2.1) return true
    // a leaf's card reaches a hand past the point it grows from
    for (const [a, b] of CERTIFIED_LINES) if (segmentDistance(e, n, a!, b!) < WALK_KEEP.metres + .12) return true
    // the diagram's frame and its ledge, and the lectern
    if (e > -57.5 && e < -55.9 && n > -26.0 && n < -21.6 && y < floor + 4.6) return true
    if (e > -54.6 && e < -53.5 && n > -24.8 && n < -22.3 && y < floor + 2.4) return true
    return false
  }
}

export interface GraveCourtTrees { group: Group; leaves: number; triangles: number }

/** The three maples, their bark, leaves and leaf shadows, and the week's fall
 * under them, in the wing's own frame. */
export function growGraveCourtTrees(tier: TreeTier): GraveCourtTrees {
  const group = new Group()
  group.name = 'vinci/grave-court/trees'
  group.userData = { ...graveCourtProvenance, certainty: 'conjectural', labelOccluder: false }
  const mats = vegetationMaterials(windWanted())
  const bark = new Body(), leaves = new Body()
  const casts = tier !== 'calm'
  const shadows = casts ? new Body() : null
  const bedTop = GRAVE_COURT_LEVEL + .02 + BED.rise
  const refuse = courtTreeRefusal()
  let count = 0
  const results: TreeResult[] = []
  for (const tree of COURT_TREES) {
    const result = growTree({
      id: tree.id, species: 'maple', east: tree.east, north: tree.north, height: tree.height, seed: tree.seed,
      detail: 'near', lean: tree.lean, spread: COURT_TREE_FORM.spread, crownBase: COURT_TREE_FORM.crownBase,
      bole: COURT_TREE_FORM.bole, leafCap: COURT_TREE_FORM.leafCap,
    // the twigs weld into the limbs: the shadow body folds their casting, and
    // a body less is a draw less in every pass that sees the court
    }, tier, () => bedTop, refuse, bark, bark, leaves, shadows)
    count += result.leaves
    results.push(result)
  }
  // THE WEEK'S FALL under the three: most of it in the beds, the rest carried
  // north-east over the flags by the week's wind, drier the further it went
  const fall = new Body()
  const random = mulberry(20260924)
  const { colours, weights } = fallenPalette('maple')
  const total = weights.reduce((a, b) => a + b, 0)
  const pick = (u: number): [number, number, number] => {
    let at = u * total, i = 0
    while (i < weights.length - 1 && at > weights[i]!) { at -= weights[i]!; i++ }
    return colours[i]!
  }
  const perTree = tier === 'hero' ? 620 : tier === 'standard' ? 150 : 60
  const grow = tier === 'hero' ? 1 : tier === 'standard' ? 1.4 : 1.9
  for (const tree of COURT_TREES) {
    for (let k = 0; k < perTree; k++) {
      const inBed = random() < .42
      let e: number, n: number, ground: number
      if (inBed) {
        e = tree.east + (random() - .5) * 2 * (BED.half - .05)
        n = tree.north + (random() - .5) * 2 * (BED.half - .05)
        ground = bedTop
      } else {
        const r = BED.half + random() * random() * 4.2, a = (random() - .5) * 2.6 + Math.atan2(.62, .79)
        e = tree.east + Math.cos(a) * r
        n = tree.north + Math.sin(a) * r
        ground = GRAVE_COURT_LEVEL + .02
        // nothing lands inside a wall, a bed or the slab
        if (e < -60.5 || n > -16.6 || n < -33.4) continue
        if (e > -56.8 && e < -52.9 && n > -27.1 && n < -24.8) continue
        const inOther = COURT_TREES.some(t => t !== tree && Math.abs(e - t.east) < BED.half + .02 && Math.abs(n - t.north) < BED.half + .02)
        if (inOther) continue
      }
      const length = (.075 + random() * .05) * grow
      fallenLeaf(fall, 'maple', e, n, ground + .002, random() * Math.PI * 2, length, pick(random() * (inBed ? .8 : 1)), .04 + random() * .12)
    }
  }
  const meshes: Mesh[] = []
  const add = (mesh: Mesh | null): void => {
    if (!mesh) return
    mesh.userData = { ...graveCourtProvenance, certainty: 'conjectural', labelOccluder: false }
    mesh.raycast = () => {}
    meshes.push(mesh)
  }
  add(vegetationMesh(bark, mats.bark, 'vinci/grave-court/maple trunks and limbs', casts))
  add(vegetationMesh(leaves, mats.leaves, 'vinci/grave-court/maple leaves', false))
  if (shadows) {
    const s = vegetationMesh(shadows, mats.shade, 'vinci/grave-court/maple leaf shadows', true)
    if (s) { s.receiveShadow = false; s.layers.set(SHADOW_ONLY_LAYER); add(s) }
  }
  add(vegetationMesh(fall, mats.litter, 'vinci/grave-court/maple fall', false))
  group.add(...meshes)
  let triangles = 0
  for (const mesh of meshes) triangles += (mesh.geometry.getIndex()?.count ?? 0) / 3
  group.userData['trees'] = results.map(r => ({ id: r.spec.id, leaves: r.leaves, crown: r.crown }))
  return { group, leaves: count, triangles }
}

/* ─── the whole court ──────────────────────────────────────────────────── */

export interface GraveCourt {
  /** the walls and the furniture, in the grave's own frame */
  local: Group
  /** the trees and their fall, in the wing's frame */
  world: Group
  dispose(): void
}

export function createGraveCourt(tier: TreeTier, surfaces = graveCourtSurfaces()): GraveCourt {
  const placeholder = surfaces.stone
  const materials: ExhibitMaterials = { stone: placeholder, plaster: placeholder, bronze: surfaces.bronze, ink: surfaces.steel, dark: surfaces.steel }
  const walls = new Construction(materials, 'vinci-grave-court-walls', graveCourtProvenance.manifestId)
  buildWalls(walls, surfaces)
  const floor = new Construction(materials, 'vinci-grave-court-floor', graveCourtProvenance.manifestId)
  buildWalkway(floor, surfaces)
  buildBench(floor, surfaces)
  buildBeds(floor, surfaces)
  const local = new Group()
  local.name = 'vinci/grave-court'
  local.userData = { ...graveCourtProvenance }
  const wallGroup = walls.finish(), floorGroup = floor.finish()
  // the furniture is low and never hides a label; the walls may
  floorGroup.traverse(o => { if ((o as Mesh).isMesh) { o.userData['labelOccluder'] = false; (o as Mesh).raycast = () => {} } })
  local.add(wallGroup, floorGroup)
  const trees = growGraveCourtTrees(tier)
  const world = trees.group
  return {
    local, world,
    dispose() {
      for (const group of [local, world]) group.traverse(o => { if ((o as Mesh).isMesh) (o as Mesh).geometry.dispose() })
      local.removeFromParent(); world.removeFromParent()
      for (const m of Object.values(surfaces)) (m as Material).dispose()
    },
  }
}
