/** WEAR OF THE LOCK GATES AND THE ORGAN GUN, a look and not a claim, laid the
 * way `wear.ts` lays it: vertex colours at most one per channel, crisp lines
 * cut into the surface. A gate stands in its lock's water all its life: below
 * the low water the oak is dark and green, a line of scum marks that level,
 * the band the water rises and falls through is stained grey, and the head
 * above the high water stays dry. A gun is drawn over roads: its wheels'
 * rims and its trails' feet carry the dirt. */
import { Vector3 } from 'three/webgpu'
import type { WearRule } from './wear'

type Tint = readonly [number, number, number]
const ONE: Tint = [1, 1, 1]
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const mix = (a: Tint, b: Tint, t: number): Tint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** The dossier's assumed depths over the mitre sill (0.31 m): 1 m low, 2 m high. */
const FLOOR = .15, LOW = 1.31, HIGH = 2.31
const LINE = .005

function waterStain(p: Vector3, n: Vector3): Tint {
  const y = p.y
  if (y > HIGH + LINE) return ONE
  if (y > HIGH - LINE) return [.8, .81, .75]
  if (y > LOW + LINE) {
    // the band the water rises and falls through: grey, darker toward the low line
    const band = mix([.64, .66, .57], [.9, .9, .86], smooth(LOW + LINE, HIGH - .15, y))
    return n.y > .5 ? mix(band, [.82, .83, .77], .5) : band
  }
  if (y > LOW - LINE) return [.34, .38, .28]
  // always under water: dark, greener toward the floor, silt settled on what faces up
  const deep = mix([.36, .43, .3], [.5, .55, .43], smooth(FLOOR + .05, LOW - .2, y))
  return n.y > .5 ? mix(deep, [.62, .61, .52], .6) : deep
}
const WATER_CUTS = [{ normal: [0, 1, 0] as const, at: [LOW - LINE, LOW + LINE, HIGH - LINE, HIGH + LINE] }]

const LOCK_GATES: WearRule[] = [
  {
    // the oak of both leaves, the quoin posts and the sill; never their iron
    parts: id => !/-nail-/.test(id) && (/^(leaf-|board-|wicket-(left|right|side-|board-|ledge-)|brace-|mitre-post-|latch-stile-|hinge-stile-|post-|sill)/.test(id)
      || /^crossbeam-(left|right)-\d$/.test(id)),
    cuts: WATER_CUTS,
    tint: (p, n) => waterStain(p, n),
  },
]

/** The carriage's hewn oak: the wheel's rim and the trail's foot carry the
 * road, the rest is clean. Every hewn part takes a rule so the one surface
 * they share is welded with one set of attributes. */
const WHEEL = /^(wheel-|spoke-|felloe-)/
const ROAD: Tint = [.66, .6, .52]
const ORGAN_GUN: WearRule[] = [
  {
    parts: id => WHEEL.test(id),
    cuts: [],
    tint: p => mix(ONE, ROAD, smooth(.37, .465, Math.hypot(p.y - .5, p.z))),
  },
  {
    parts: id => /^trail-(left|right)$/.test(id),
    cuts: [],
    tint: p => mix(ONE, ROAD, (1 - smooth(.03, .32, p.y)) * smooth(-1.4, -1.7, p.z)),
  },
  {
    parts: id => /^(axle|transom|handbar|upright--?1|sole-(left|right)|strut-(left|right)-\d)$/.test(id),
    cuts: [],
    tint: () => ONE,
  },
]

const WEAR: Record<string, readonly WearRule[]> = { 'miter-lock-gates': LOCK_GATES, 'multi-barrel-gun': ORGAN_GUN }

export function waterAndWarWear(slug: string): readonly WearRule[] | null {
  return WEAR[slug] ?? null
}
