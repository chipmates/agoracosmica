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
import { applyCourtLight, COURT_ENGINE_TERMS, SUN } from './court-light'
import { windWanted } from '../wind'
import {
  BED, BENCH, BRICK, CERTIFIED_LINES, COURT_TREE_FORM, COURT_TREES, FILTER, GRAVE_COURT_LEVEL, GRAVE_COURT_ORIGIN,
  GRAVE_MOUNT_RISE, LEAF, PLINTH_COURSE, STRING_COURSE, toLocal, WALK_KEEP, WALKWAY,
} from './court-plan'

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  Fn, abs, cameraViewMatrix, float, floor, fract, min, mix, mx_noise_float, normalWorldGeometry, positionWorld, smoothstep, uv: uvNode, vec2, vec3,
} = TSL as unknown as Record<string, N>

/** The walk's boards in plan, as the oak's shader reads them: where the walk
 * starts, its unit direction, its half width and length, and the boards'
 * pitch and the first board's offset, as `buildWalkway` lays them. */
function walkFrame(): { from: [number, number]; u: [number, number]; half: number; length: number; start: number; pitch: number; board: number } {
  const [ax, an] = WALKWAY.from, [bx, bn] = WALKWAY.to
  const length = Math.hypot(bx - ax, bn - an)
  const pitch = WALKWAY.board.width + WALKWAY.board.gap
  const count = Math.floor(length / pitch)
  return { from: [ax, an], u: [(bx - ax) / length, (bn - an) / length], half: WALKWAY.width / 2, length,
    start: (length - count * pitch + WALKWAY.board.gap) / 2, pitch, board: WALKWAY.board.width }
}

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
/** how far a thing standing on the flags is set into them: past their top
 * and short of the mortar bed 4.5 mm under it */
const SET_IN = .007

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
  if (COURT_ENGINE_TERMS) m.receivedShadowNode = Fn(([shadow]: N[]) => mix(shadow, ...filterBandLight(P)))
  m.name = `vinci/grave-court/${open ? 'brick-open' : 'brick'}`
  m.userData = { ...graveCourtProvenance }
  return m
}

/** THE FILTER BAND'S LIGHT ON THE NORTH WALL, as the sun of the hour gives
 * it: each slot is a tunnel the depth of the brick, so only the part of it
 * the sun sees straight through passes light, and the sun is a disc half a
 * degree across, so a patch ten metres from its slot is a soft image of the
 * sun, not a lit brick. The live engine's sun is a point and its map holds a
 * slot to a texel or two; this hands the wall the patch the film's sun draws,
 * dimmed where a maple's crown stands in the way. Returns the soft light and
 * where it replaces the map. */
function filterBandLight(P: N): [N, N] {
  const S = SUN, sx = S.e, sy = S.u, sz = -S.n
  const face = GRAVE_COURT_ORIGIN.east + LEAF.backFace, depth = LEAF.depth
  const base = GRAVE_COURT_LEVEL + GRAVE_MOUNT_RISE + FILTER.bottom
  const course = (FILTER.top - FILTER.bottom) / Math.round((FILTER.top - FILTER.bottom) / BRICK.course)
  const period = FILTER.solidCourses + FILTER.openCourses, runH = FILTER.openCourses * course
  const pitch = BRICK.length + FILTER.slot, pierIn = FILTER.halfWidth - FILTER.pier
  // the ray to the sun, at the middle of the band's depth
  const t = float(face - depth / 2).sub(P.x).div(sx)
  const qy = P.y.add(t.mul(sy)), qn = P.z.add(t.mul(sz)).negate().sub(GRAVE_COURT_ORIGIN.north)
  // the open run nearest the ray, and its slot nearest the ray
  const run = floor(qy.sub(base + FILTER.solidCourses * course + runH / 2).div(period * course).add(.5)).clamp(0, 3)
  const dh = qy.sub(run.mul(period * course).add(base + FILTER.solidCourses * course + runH / 2))
  const shift = fract(run.mul(.5)).mul(pitch)
  const first = -pierIn - pitch + BRICK.length + FILTER.slot / 2
  const slot = floor(qn.sub(shift).sub(first).div(pitch).add(.5))
  const centre = slot.mul(pitch).add(shift).add(first)
  const dn = qn.sub(centre)
  // what the tunnel lets through, and the sun's disc at this distance
  const drift = (a: number): number => depth * Math.abs(a) / Math.abs(sx)
  const an = (FILTER.slot - drift(sz)) / 2, ah = (runH - drift(sy)) / 2
  const w = t.mul(.00465).max(.004)
  const pass = (d: N, a: number): N => float(a).add(w).sub(abs(d)).div(w.mul(2)).clamp(0, 1).min(float(a).div(w).min(1))
  const inPier = smoothstep(pierIn - .02, pierIn - .06, abs(centre))
  let light: N = pass(dn, an).mul(pass(dh, ah)).mul(inPier)
  // a crown in the way thins the patch to the light its leaves let pass
  for (const tree of COURT_TREES) {
    const c = [tree.east, GRAVE_COURT_LEVEL + tree.height * .62, -tree.north] as const, r = tree.height * .4
    const k = vec3(c[0], c[1], c[2]).sub(P)
    const along = k.x.mul(sx).add(k.y.mul(sy)).add(k.z.mul(sz)).max(0)
    const miss = vec3(P.x.add(along.mul(sx)), P.y.add(along.mul(sy)), P.z.add(along.mul(sz))).sub(vec3(c[0], c[1], c[2]))
    const inside = smoothstep(r, r * .7, miss.length())
    const leaves = smoothstep(.35, .65, mx_noise_float(miss.mul(3.1).add(tree.seed % 97)).mul(.5).add(.5))
    light = light.mul(float(1).sub(inside.mul(float(.9).sub(leaves.mul(.7)))))
  }
  const onNorth = smoothstep(.8, .95, TSL.normalWorldGeometry.z).mul(smoothstep(.08, .03, abs(P.z.add(GRAVE_COURT_ORIGIN.north + LEAF.returnFace))))
  const band = smoothstep(base - .02, base + .01, qy).mul(smoothstep(base + FILTER.top - FILTER.bottom + .01, base + FILTER.top - FILTER.bottom - .02, qy))
  return [light, onNorth.mul(band)]
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
  // THE WALK'S OWN BOARDS: each its own piece of oak, weathered its own way,
  // screwed down to the two bearers, and walked pale down the middle
  const w = walkFrame()
  const te = P.x.sub(w.from[0]), tn = P.z.negate().sub(w.from[1])
  const t = te.mul(w.u[0]).add(tn.mul(w.u[1])), side = tn.mul(w.u[0]).sub(te.mul(w.u[1]))
  const onWalk = smoothstep(w.half + .02, w.half, abs(side)).mul(smoothstep(-.03, 0, t)).mul(smoothstep(w.length + .03, w.length, t))
    .mul(smoothstep(GRAVE_COURT_LEVEL + .2, GRAVE_COURT_LEVEL + .15, P.y))
  const slot = t.sub(w.start).div(w.pitch), k = floor(slot), inBoard = fract(slot).mul(w.pitch)
  const hk = (salt: number): N => fract(k.mul(12.9898).add(salt).sin().mul(43758.5453))
  const boardTone = float(1).add(hk(1.3).sub(.5).mul(.2).mul(onWalk))
  const walked = smoothstep(.42, .12, abs(side)).mul(onWalk).mul(mx_noise_float(vec3(t.mul(1.7), side.mul(4), 3.1)).mul(.35).add(.65))
  const silvered = top.mul(float(.5).add(hk(7.7).sub(.5).mul(.36).mul(onWalk)).add(walked.mul(.28))).clamp(0, 1)
  // a knot in one board of three, drawn out along its grain
  const knotAt = hk(4.1).sub(.5).mul(w.half * 1.6)
  const knotShape = vec2(side.sub(knotAt).mul(.45), inBoard.sub(w.board * (.3 + .4 * .5))).length()
  const knot = smoothstep(.016, .004, knotShape).mul(hk(9.2).lessThan(.34).select(float(1), float(0))).mul(onWalk).mul(resolved(.02, d.pixel))
  // the screw heads, two to a board over each bearer, and the dark stain the
  // iron leaves in the oak round each
  const bearer = abs(abs(side).sub(w.half - .16))
  const screw = min(vec2(bearer, inBoard.sub(w.board * .26)).length(), vec2(bearer, inBoard.sub(w.board * .74)).length())
  const head = smoothstep(.0048, .0036, screw).mul(onWalk).mul(resolved(.008, d.pixel))
  const stain = smoothstep(.02, .004, screw).mul(onWalk).mul(resolved(.03, d.pixel))
  const worn = streak.mul(float(.14).sub(walked.mul(.07)))
  const tone = d.tone.mul(float(1).add(worn).add(wave.mul(.1))).mul(boardTone).mul(float(1).add(walked.mul(.06)))
  const oak = mix(vec3(...base), vec3(...silver), silvered).mul(tone)
    .mul(float(1).sub(stain.mul(.22))).mul(float(1).sub(knot.mul(.45)))
  const c = mix(oak, vec3(.05, .045, .04), head.mul(.85))
  m.colorNode = c
  // a board's edge in its gap sees the gap, not the sunlit wall
  applyCourtLight(m, c, { floorOnly: true })
  m.roughnessNode = specularAA(float(.6).add(top.mul(.16)).add(d.rough).add(streak.abs().mul(.05))
    .sub(walked.mul(.08)).sub(head.mul(.25)), d.lost)
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
  // the leaf stands a bed into the core's kerb, never on its top face
  const foot = LEAF.foot - BED_M
  // the stone courses stop a little short of the leaf's rear, inside the core
  const courseRear = backRear + .01
  span(build, -reach, foot, courseRear, reach, PLINTH_COURSE.top, PLINTH_COURSE.backFace, s.stone)
  span(build, -reach, PLINTH_COURSE.top - BED_M, backRear, reach, STRING_COURSE.bottom + BED_M, back, s.brick)
  span(build, -reach, STRING_COURSE.bottom, courseRear, reach, STRING_COURSE.top, STRING_COURSE.backFace, s.stone)
  span(build, -reach, STRING_COURSE.top - BED_M, backRear, reach, FILTER.bottom + BED_M, back, s.brick)
  // THE RETURNS, each laid from inside the back wall's leaf to its own end,
  // with an end cap over the core's end and a coping over both; the leaf's
  // head and its end stop inside the coping and the cap, and the coping and
  // the cap lie a bed past the core's own top and end
  const start = backRear + .012, capFrom = LEAF.returnEnd - .03, head = LEAF.returnTop - 2 * BED_M
  for (const side of [-1, 1]) {
    const x = (v: number): number => side * v
    span(build, x(PLINTH_COURSE.returnFace), foot, start, x(rear - .01), PLINTH_COURSE.top, capFrom + BED_M, s.stone)
    span(build, x(face), PLINTH_COURSE.top - BED_M, start, x(rear), head, capFrom + BED_M, s.brick)
    span(build, x(face), foot, capFrom, x(9.17), head, LEAF.returnEnd + .04, s.brick)
    const over = LEAF.coping.over
    span(build, x(face - over), LEAF.returnTop - 3 * BED_M, back - BED_M, x(9.15 + over), LEAF.returnTop + LEAF.coping.height,
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
    // from a little into the flags to a bed into the boards
    const low = FLOOR_Y - SET_IN, high = bearerTop + BED_M
    turnedBox(build, (ax + bx) / 2 + across[0] * offset, (low + high) / 2, (az + bz) / 2 + across[1] * offset,
      length - .06, high - low, .075, [ux, uz], s.steel)
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
  turnedBox(build, ax + ux * (start - .012 + BED_M), top - .012, az + uz * (start - .012 + BED_M), WALKWAY.width + .02, .024, .024, across, s.bronze)
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
      span(build, x - .02, FLOOR_Y - SET_IN, z - .02, x + .02, seatTop - .085 + BED_M, z + .02, s.bronze)
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
    span(build, cx - h + t - BED_M, FLOOR_Y - SET_IN, cz - h + t - BED_M, cx + h - t + BED_M, top, cz + h - t + BED_M, s.earth)
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
    // a spray's card reaches a hand or two past the point it grows from
    for (const [a, b] of CERTIFIED_LINES) if (segmentDistance(e, n, a!, b!) < WALK_KEEP.metres + .3) return true
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
  const bark = new Body(), fine = new Body(), leaves = new Body()
  const casts = tier !== 'calm'
  const shadows = casts ? new Body() : null
  const bedTop = GRAVE_COURT_LEVEL + .02 + BED.rise
  const refuse = courtTreeRefusal()
  let count = 0
  const results: TreeResult[] = []
  for (const tree of COURT_TREES) {
    const result = growTree({
      id: tree.id, species: 'maple', east: tree.east, north: tree.north, height: tree.height, seed: tree.seed,
      // a mid tree seen close: every twig drawn, the crown in sprays, which is
      // how the site's own trees near a stop are drawn and what the wing's
      // triangle budget holds at the stops that see the court from afar
      detail: 'mid', close: true, lean: tree.lean, spread: COURT_TREE_FORM.spread, crownBase: COURT_TREE_FORM.crownBase,
      bole: COURT_TREE_FORM.bole, leafCap: COURT_TREE_FORM.leafCap,
    // the twigs weld into the limbs: the shadow body folds their casting, and
    // a body less is a draw less in every pass that sees the court
    }, tier, () => bedTop, refuse, bark, casts ? fine : bark, leaves, shadows)
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
    // the planting is its own record, outside the one shadow body: it casts
    // for itself and only where it can be seen (`update`)
    mesh.userData = { ...graveCourtProvenance, manifestId: GRAVE_COURT_PLANTING, certainty: 'conjectural', labelOccluder: false }
    mesh.raycast = () => {}
    meshes.push(mesh)
  }
  add(vegetationMesh(bark, mats.bark, 'vinci/grave-court/maple trunks and limbs', casts))
  // the twigs cast nothing: under a texel of the sun's map, and every stop's
  // two cascades would draw them in the one shadow body
  if (casts) add(vegetationMesh(fine, mats.bark, 'vinci/grave-court/maple branches and twigs', false))
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
  /** where the eye stands: the planting is drawn and casts only near enough
   * to be seen (see PLANTING_REACH) */
  update(eye: { x: number; z: number }): void
  dispose(): void
}

export const GRAVE_COURT_PLANTING = 'vinci/grave-court-planting'
/** HOW FAR THE PLANTING IS DRAWN, from the court's middle, in metres. The
 * house stands between the court and every stop beyond the first reach, so
 * the trees come and go where no eye can see them; their shadows and their
 * twigs, which no eye resolves past the second, go first. The wing's far
 * stops keep their triangle budget. */
export const PLANTING_REACH = { trees: 58, detail: 32, hold: 2 } as const
const COURT_MIDDLE = { east: -54.5, north: -25 } as const

export function createGraveCourt(tier: TreeTier, surfaces = graveCourtSurfaces(), options: { trees?: boolean } = {}): GraveCourt {
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
  // an offline checker of the architecture alone may leave the planting out
  const world = options.trees === false ? new Group() : growGraveCourtTrees(tier).group
  const twigs = world.getObjectByName('vinci/grave-court/maple branches and twigs')
  const casters: Mesh[] = []
  world.traverse(o => { if ((o as Mesh).isMesh && (o as Mesh).castShadow) casters.push(o as Mesh) })
  let shown = true, detailed = true
  return {
    local, world,
    update(eye) {
      const d = Math.hypot(eye.x - COURT_MIDDLE.east, -eye.z - COURT_MIDDLE.north), hold = PLANTING_REACH.hold
      if (shown ? d > PLANTING_REACH.trees + hold : d < PLANTING_REACH.trees - hold) shown = !shown
      if (detailed ? d > PLANTING_REACH.detail + hold : d < PLANTING_REACH.detail - hold) detailed = !detailed
      world.visible = shown
      if (twigs) twigs.visible = detailed
      for (const mesh of casters) mesh.castShadow = detailed
    },
    dispose() {
      for (const group of [local, world]) group.traverse(o => { if ((o as Mesh).isMesh) (o as Mesh).geometry.dispose() })
      local.removeFromParent(); world.removeFromParent()
      for (const m of Object.values(surfaces)) (m as Material).dispose()
    },
  }
}
