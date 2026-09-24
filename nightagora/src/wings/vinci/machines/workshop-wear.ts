/** WEAR ON THE WORKSHOP'S MECHANISMS, a look and not a claim (see wear.ts):
 * the ball bearing's two tracks where the balls roll, the lathe's foot bar
 * where the foot presses and its bearings where the grease runs out, and the
 * flywheel's shaft where it turns in the top of its pillar. */
import type { Vector3 } from 'three/webgpu'
import type { WearRule } from './wear'

type Tint = readonly [number, number, number]
const ONE: Tint = [1, 1, 1]
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const mix = (a: Tint, b: Tint, t: number): Tint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** A rolled track: darker and a little greyer along the circle the balls run
 * on. The plates' boards are sampled on rings round the post, so no cut is
 * needed; each board keeps its own tone. */
const track = (p: Vector3): Tint => mix([.7, .66, .6], ONE, smooth(.004, .03, Math.abs(Math.hypot(p.x, p.z) - .3)))
const board = (p: Vector3): number => p.x > .13 ? .955 : p.x < -.13 ? .92 : 1
const plateTint = (p: Vector3, working: boolean): Tint => {
  const b = board(p), t = working ? track(p) : ONE
  return [t[0] * b, t[1] * b * .995, t[2] * b * .985]
}
const BALL_BEARING: WearRule[] = [
  {
    parts: id => id === 'lower-plate' || id.startsWith('lower-plate-board-'),
    cuts: [],
    tint: (p, n) => plateTint(p, n.y > .5),
  },
  {
    parts: id => id === 'upper-plate' || id.startsWith('upper-plate-board-'),
    cuts: [],
    tint: (p, n) => plateTint(p, n.y < -.5),
  },
]

/** The spindle's axis, where the grease in each poppet's bearing runs out onto its faces. */
const AXIS_Y = .85
const LATHE: WearRule[] = [
  {
    // the middle of the foot bar's top, pressed by a shoe every stroke
    parts: id => id === 'footbar',
    cuts: [
      { normal: [1, 0, 0], at: [-.13, -.09, -.05, -.02, .02, .05, .09, .13], facing: [0, 1, 0] },
      { normal: [0, 0, 1], at: [-.05, -.01, .03, .06], facing: [0, 1, 0] },
    ],
    tint: (p, n) => n.y > .5 ? mix([.74, .7, .64], ONE, smooth(.02, .12, Math.hypot(p.x / 1.1, (p.z - .02) * 1.6))) : ONE,
  },
  {
    parts: id => id === 'headstock' || id === 'tailstock',
    cuts: [
      { normal: [0, 1, 0], at: [AXIS_Y - .07, AXIS_Y - .045, AXIS_Y - .025, AXIS_Y + .025, AXIS_Y + .045], facing: [1, 0, 0] },
      { normal: [0, 1, 0], at: [AXIS_Y - .07, AXIS_Y - .045, AXIS_Y - .025, AXIS_Y + .025, AXIS_Y + .045], facing: [-1, 0, 0] },
      { normal: [0, 0, 1], at: [-.045, -.025, .025, .045], facing: [1, 0, 0] },
      { normal: [0, 0, 1], at: [-.045, -.025, .025, .045], facing: [-1, 0, 0] },
    ],
    // the grease creeps out round the bush and runs down the face below it
    tint: (p, n) => {
      if (Math.abs(n.x) < .5) return ONE
      const d = Math.hypot(p.y - AXIS_Y, p.z) - Math.max(0, AXIS_Y - p.y) * .35
      return mix([.6, .56, .5], ONE, smooth(.026, .066, d))
    },
  },
]

const FLYWHEEL: WearRule[] = [
  {
    // the shaft darkened by grease where it turns in the pillar's mouth
    parts: id => id === 'rotor',
    cuts: [{ normal: [0, 1, 0], at: [.59, .605, .62, .64, .66] }],
    tint: p => mix([.62, .58, .52], ONE, smooth(.605, .665, p.y)),
  },
  {
    parts: id => id === 'support',
    cuts: [],
    tint: (p, n) => n.y > .5 && p.y > .6 ? mix([.66, .62, .56], ONE, smooth(.05, .075, Math.hypot(p.x, p.z))) : ONE,
  },
]

export const WORKSHOP_WEAR: Readonly<Record<string, readonly WearRule[]>> = {
  'ball-bearing': BALL_BEARING,
  'lathe': LATHE,
  'flywheel': FLYWHEEL,
}
