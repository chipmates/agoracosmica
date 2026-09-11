/* THE PARTS KIT — what a wing calls instead of extruding a rectangle.

   The material library answers what a surface is made of. The model library
   answers what a thing IS, for the eighty things the CC0 commons happens to
   hold. This kit answers for the things it does not hold, and after a sweep
   of the whole open commons that list is most of a building:

     no window, no shutter, no dormer, no chimney, no ridge tile, no roof
     element of any kind, no stone step, no threshold, no fence section, no
     cart wheel, no gear, no rope as a coil, and no tree at all.

   Every one of those was named in a blind verdict as the thing that failed.
   So each of them is a builder here, parametric, in metres, with the library
   on its surfaces and the empty-plane helper on every plane.

     const parts = createParts(stack)
     scene.add(parts.window({ width: 1.55, height: 2.35, mullion: 0.14,
                              transom: 1.25, shutters: 'open' }))

   Three rules the whole kit keeps.

   · METRES, ALWAYS. Every option is a real dimension. The Clos Luce's own
     schedule reads 1.55 by 2.35 for a ground-floor light and 1.15 by 1.75
     for an attic one; those numbers go in unchanged.
   · A SEED, ALWAYS. Every wobble comes from a seeded hand, so a part shot
     twice is the same part and a frame can be compared with a frame.
   · A TIER, ALWAYS. Every builder takes the tier's own count of detail
     scales and lays fewer, larger units at the cheaper ones. A calm roof is
     the same roof from further away, never a flat one. */

import type { Stack } from '../index'
import { Bench, catenary, type Part } from './common'
import {
  cutInto as cutIntoWall,
  doorPart,
  headCurve,
  wallPart,
  windowPart,
  type DoorOptions,
  type HeadKind,
  type Wall,
  type WallOpening,
  type WallOptions,
  type WindowOptions,
} from './openings'
import {
  chimneyPart,
  dormerPart,
  roofCost,
  roofPart,
  slopeHeight,
  valleyPart,
  type ChimneyOptions,
  type DormerOptions,
  type RoofOptions,
  type ValleyOptions,
} from './roofing'
import {
  fencePart,
  gatePart,
  stepsPart,
  type FenceOptions,
  type GateOptions,
  type StepsOptions,
} from './ground'
import {
  beamPart,
  gearPart,
  hangRope,
  ropePart,
  wheelPart,
  type BeamOptions,
  type GearOptions,
  type RopeOptions,
  type WheelOptions,
} from './mechanism'
import {
  grassPart,
  shrubPart,
  treePart,
  type GrassOptions,
  type Season,
  type Species,
  type TreeOptions,
} from './planting'
import type { Vector3 } from 'three/webgpu'

export type { Part } from './common'
export type { HeadKind, Wall, WallOpening, WallOptions, WindowOptions, DoorOptions } from './openings'
export type { RoofOptions, DormerOptions, ChimneyOptions, ValleyOptions } from './roofing'
export type { StepsOptions, FenceOptions, GateOptions } from './ground'
export type { WheelOptions, GearOptions, RopeOptions, BeamOptions } from './mechanism'
export type { TreeOptions, GrassOptions, Species, Season } from './planting'
export { catenary, headCurve, roofCost, slopeHeight }

export interface PartsKit {
  /** a masonry opening: reveal, sill with a drip, head, bars, glazing,
      shutters. The origin is the middle of the sill's top. */
  window: (o: WindowOptions) => Part
  /** the same opening with a boarded leaf on straps and a worn threshold */
  door: (o: DoorOptions) => Part
  /** a wall built as the panels a mason leaves around its openings, with
      every panel reading its courses off one plane through the wall's face */
  wall: (o: WallOptions) => Wall
  /** put another opening in a wall that already stands. There is no boolean
      library offline, so the wall re-cuts its own panels and swaps itself in
      its parent; the new wall is returned. */
  cutInto: (wall: Wall, opening: WallOpening) => Wall
  /** courses of slate, a ridge, an eaves, a gable, hips */
  roof: (o: RoofOptions) => Part
  /** a small building standing on a slope, with its own cheeks and slates */
  dormer: (o: DormerOptions) => Part
  /** a stack with oversailing courses, a weathered cap and a pot per flue */
  chimney: (o: ChimneyOptions) => Part
  /** the lead where two slopes run into each other */
  valley: (o: ValleyOptions) => Part
  /** stone steps with a hollow rubbed into every tread */
  steps: (o: StepsOptions) => Part
  /** woven hazel, cleft paling or post and rail */
  fence: (o: FenceOptions) => Part
  /** a five-bar field gate or a boarded yard gate, on its own hanging post */
  gate: (o: GateOptions) => Part
  /** a turned nave, dished spokes, felloes and a shrunk-on iron tyre */
  wheel: (o: WheelOptions) => Part
  /** involute teeth from a module and a tooth count, a worm, a lantern */
  gear: (o: GearOptions) => Part
  /** a twisted profile swept along a curve */
  rope: (path: Vector3[], o?: RopeOptions) => Part
  /** the same rope hung between two points under its own weight */
  hang: (a: [number, number, number], b: [number, number, number], slack?: number, o?: RopeOptions) => Part
  /** squared oak with its arrises taken off */
  beam: (o: BeamOptions) => Part
  /** a tree grown by space colonisation, with the pipe model on its limbs */
  tree: (o: TreeOptions) => Part
  shrub: (o: TreeOptions) => Part
  /** instanced blades over a patch, one draw */
  grass: (o: GrassOptions) => Part
  /** the shop's own material bench, for a wing that builds its own piece and
      wants the same surfaces the kit's parts stand on */
  bench: Bench
}

/**
 * Build the kit against a stack. The stack is what gives it the library, the
 * empty-plane helper and the tier; nothing here reaches past those three.
 */
export function createParts(stack: Stack): PartsKit {
  const bench = new Bench(stack)
  return {
    window: (o) => windowPart(bench, o),
    door: (o) => doorPart(bench, o),
    wall: (o) => wallPart(bench, o),
    cutInto: (wall, opening) => cutIntoWall(bench, wall, opening),
    roof: (o) => roofPart(bench, o),
    dormer: (o) => dormerPart(bench, o),
    chimney: (o) => chimneyPart(bench, o),
    valley: (o) => valleyPart(bench, o),
    steps: (o) => stepsPart(bench, o),
    fence: (o) => fencePart(bench, o),
    gate: (o) => gatePart(bench, o),
    wheel: (o) => wheelPart(bench, o),
    gear: (o) => gearPart(bench, o),
    rope: (path, o) => ropePart(bench, path, o),
    hang: (a, b, slack, o) => hangRope(bench, a, b, slack, o),
    beam: (o) => beamPart(bench, o),
    tree: (o) => treePart(bench, o),
    shrub: (o) => shrubPart(bench, o),
    grass: (o) => grassPart(bench, o),
    bench,
  }
}
