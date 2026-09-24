/* THE FACE OF A LAID FLAG, OUTDOORS.

   A slab of limestone laid in a court is its own stone: its own tone from
   the bed it was quarried from, a grain running the way that bed ran, its
   arrises darkened with the dirt that settles along a joint, its face worn
   paler and smoother where feet cross it, and in a court the sun seldom
   reaches, a green-black film of algae creeping in from the joints. The laying
   (the grid, the bond) is the caller's; this is only the face, drawn where a
   pixel can hold each scale and falling to its own mean where it cannot. */
import * as TSL from 'three/tsl'
import { anisotropicFootprint, resolved } from '../../stack/detail'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { float, floor, fract, length, max, min, mix, mx_noise_float, positionWorld, sin, smoothstep, vec2, vec3 } =
  TSL as unknown as Record<string, N>

/** How the flags are laid, in the wing's metres: courses along the east axis
    `pitchEast` apart from `east`, slabs along the north axis `pitchNorth`
    apart from `north`, every other course shifted by `bond` along north. */
export interface FlagGrid { east: number; north: number; pitchEast: number; pitchNorth: number; bond: number }

/** What a flag's face does to the surface drawn on it: a factor on its
    albedo around one (a colour: a bed is warmer or cooler, a joint greens),
    a change of roughness, and a height in metres a caller may relieve. */
export interface FlagFace { tone: N; rough: N; height: N }

/** The face of the flag under this pixel. `walked` is 0 to 1, how much of
    the traffic crosses it; `damp` 0 to 1, how little sun and wind dry it. */
export function flagFace(grid: FlagGrid, walked: N, damp: N): FlagFace {
  const P = positionWorld, pixel = anisotropicFootprint(P)
  const east = P.x.sub(grid.east), north = P.z.negate().sub(grid.north)
  const course = floor(east.div(grid.pitchEast))
  const shift = fract(course.mul(.5)).mul(2).mul(grid.bond)
  const along = north.sub(shift).div(grid.pitchNorth)
  const slab = floor(along)
  const inE = fract(east.div(grid.pitchEast)).mul(grid.pitchEast), inN = fract(along).mul(grid.pitchNorth)
  const hash = (salt: number): N => fract(sin(course.mul(12.9898).add(slab.mul(78.233)).add(salt)).mul(43758.5453))
  // the stone's own bed: one tone per slab, a little warmer or cooler
  const own = hash(0).sub(.5).mul(resolved(grid.pitchEast, pixel))
  // the grain runs the way the bed ran, a different way in every slab
  const turn = hash(3.7).mul(3.1416)
  const bedAt = east.mul(TSL.cos(turn)).add(north.mul(TSL.sin(turn)))
  const grain = mx_noise_float(vec3(bedAt.mul(22), bedAt.mul(1.6).add(hash(5.1).mul(40)), hash(1.3).mul(20)))
    .mul(resolved(.045, pixel))
  const fleck = mx_noise_float(vec3(east, north, hash(2.4).mul(9)).mul(70)).mul(resolved(.014, pixel))
  const cloud = mx_noise_float(vec3(east.mul(2.1), north.mul(2.1), hash(8.2).mul(30))).mul(resolved(.5, pixel))
  const pits = smoothstep(.62, .82, mx_noise_float(vec3(east, north, 4.1).mul(160))).mul(resolved(.006, pixel))
  // the arrises hold the dirt of the joint; worn slabs have them rounded paler
  const toJoint = min(min(inE, float(grid.pitchEast).sub(inE)), min(inN, float(grid.pitchNorth).sub(inN)))
  const arris = float(1).sub(smoothstep(0, .06, toJoint)).mul(resolved(.06, pixel))
  // algae creeps in from the joints where the court stays damp
  const film = smoothstep(.35, .75, mx_noise_float(vec3(east.mul(1.3), north.mul(1.3), 2.9)).add(damp.mul(.6)))
    .mul(float(1).sub(smoothstep(.02, .45, toJoint))).mul(damp).mul(resolved(.2, pixel))
  // CHIPPED ARRISES: a flag's edge is not a line; it has lost a flake here
  // and there, pale where the chip is fresh, the joint's dirt where it is old
  const toE = min(inE, float(grid.pitchEast).sub(inE)), toN = min(inN, float(grid.pitchNorth).sub(inN))
  const edgeAt = toE.lessThan(toN).select(north, east)
  const chipSize = smoothstep(.45, .85, mx_noise_float(vec3(edgeAt.mul(7), hash(9.1).mul(31), 3.3))).mul(.028)
  const chip = float(1).sub(smoothstep(chipSize.mul(.6), chipSize.add(.002), toJoint)).mul(chipSize.greaterThan(.004).select(float(1), float(0)))
    .mul(resolved(.02, pixel))
  const oldChip = hash(4.4).greaterThan(.5).select(float(1), float(0))
  // GRIT AND MOSS IN THE JOINTS: the sand of the joint is dark grit at its
  // edge, and where the court stays damp a cushion of moss sits in it
  const inJoint = float(1).sub(smoothstep(.004, .016, toJoint))
  const grit = smoothstep(.2, .7, mx_noise_float(vec3(east, north, 6.1).mul(90))).mul(inJoint).mul(resolved(.01, pixel))
  const moss = smoothstep(.35, .7, mx_noise_float(vec3(east.mul(4), north.mul(4), 8.8)).add(damp.mul(.5))).mul(inJoint).mul(damp)
    .mul(resolved(.03, pixel))
  // A DISHED FACE ON THE WAY FEET TAKE: each slab worn hollow toward its
  // middle where it is walked, a few millimetres at most
  const bowl = TSL.sin(inE.div(grid.pitchEast).mul(3.1416)).mul(TSL.sin(inN.div(grid.pitchNorth).mul(3.1416)))
  const dish = bowl.mul(walked).mul(.003)
  // the bed's own warmth or coolness, slab by slab
  const hue = mix(vec3(1.035, 1, .95), vec3(.965, .99, 1.035), hash(6.6)).mul(resolved(grid.pitchEast, pixel)).add(vec3(1, 1, 1).mul(float(1).sub(resolved(grid.pitchEast, pixel))))
  const lum = float(1).add(own.mul(.3)).add(grain.mul(.075)).add(fleck.mul(.04)).add(cloud.mul(.06)).sub(pits.mul(.14))
    .sub(arris.mul(float(.18).sub(walked.mul(.1)))).add(walked.mul(.05)).sub(film.mul(.26)).add(dish.mul(15))
    .add(chip.mul(oldChip.select(float(-.2), float(.14)))).sub(grit.mul(.3))
  const tone = mix(hue.mul(max(lum, .5)), vec3(.55, .66, .42), moss.mul(.75))
  const rough = own.mul(.08).add(grain.mul(.03)).sub(walked.mul(.14)).add(film.mul(.04)).add(chip.mul(.05)).sub(dish.mul(20))
  const height = dish.negate().sub(chip.mul(.002)).sub(inJoint.mul(.0008))
  return { tone, rough, height }
}

/** a distance to the nearest of a few boxes on the ground plane, for damp */
export function distanceToBoxes(boxes: readonly { west: number; south: number; east: number; north: number }[]): N {
  const P = positionWorld
  const e = P.x, n = P.z.negate()
  let d: N = float(1e4)
  for (const b of boxes) {
    const dx = max(max(float(b.west).sub(e), e.sub(b.east)), 0), dn = max(max(float(b.south).sub(n), n.sub(b.north)), 0)
    d = min(d, length(vec2(dx, dn)))
  }
  return d
}
