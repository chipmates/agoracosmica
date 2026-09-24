/** THE FOUR INSTRUMENTS' SURFACE RULES: the anemometer, the inclinometer, the
 * proportional compass and the camera obscura. Laid through the wear hook, so
 * each is a vertex-colour multiplier of at most one per channel that a bake or
 * an export keeps. A tone is how a board was sawn, wear is where a hand or the
 * weather has been; neither is a claim about the sheet. */
import type { Vector3 } from 'three/webgpu'
import type { WearRule } from './wear'

type Tint = readonly [number, number, number]
const ONE: Tint = [1, 1, 1]
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const mix = (a: Tint, b: Tint, t: number): Tint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

function unit(identity: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < identity.length; i++) h = Math.imul(h ^ identity.charCodeAt(i), 16777619)
  h = Math.imul(h ^ (h >>> 15), 2246822507)
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

/** No two boards of one chest come from one plank: each is a little lighter
 * or darker, warmer or cooler, and a wall reads as boards. */
function boardTone(id: string, spread: number): WearRule {
  const v = 1 - spread * unit(id, 1)
  const w = unit(id, 2)
  const tone: Tint = [v, v * (.975 + .025 * w), v * (.93 + .07 * w)]
  return { parts: part => part === id, cuts: [], tint: () => tone }
}

/** The chamber's boards, as its dossier names them. */
const CHAMBER_BOARDS = [
  'floor', 'floor-board-0', 'floor-board-2', 'floor-board-3',
  'left-wall', 'left-wall-board-0', 'left-wall-board-2',
  'right-wall', 'right-wall-board-0', 'right-wall-board-2',
  'back-wall', 'back-wall-board-0', 'back-wall-board-1', 'back-wall-board-3', 'back-wall-board-4',
  'front-left', 'front-left-board-0', 'front-right', 'front-right-board-0', 'front-bottom', 'front-top',
  'roof', 'roof-board-0', 'roof-board-2', 'roof-board-3',
]

const CAMERA_OBSCURA: WearRule[] = [
  ...CHAMBER_BOARDS.map(id => boardTone(id, .24)),
  // the paper's frame is old dark stock, so the lit paper is the brightest thing inside
  { parts: id => id.startsWith('screen-frame') || id.startsWith('screen-foot'), cuts: [], tint: () => [.5, .47, .43] },
  {
    // round the plate the front is handled: fingers find the hole
    parts: id => id === 'front-left' || id === 'front-right' || id === 'front-top' || id === 'front-bottom',
    cuts: [
      { normal: [1, 0, 0], at: [-.2, -.15, -.1, -.06, .06, .1, .15, .2], facing: [0, 0, -1] },
      { normal: [0, 1, 0], at: [.42, .47, .52, .56, .68, .72, .77, .82], facing: [0, 0, -1] },
    ],
    tint: (p: Vector3, n: Vector3): Tint => {
      if (n.z > -.5) return ONE
      const d = Math.hypot(p.x, p.y - .62)
      return mix([.8, .77, .72], ONE, smooth(.1, .2, d))
    },
  },
]

/** The anemometer's stand: every timber cut from its own length. */
const ANEMOMETER: WearRule[] = [
  'base', 'foot-back', 'sole-right', 'sole-left', 'post', 'post-left', 'arm-right', 'arm-left',
  'brace-right', 'brace-left', 'quadrant-bracket', 'quadrant', 'rail', 'vane', 'vane-roll',
].map(id => boardTone(id, .2))
// the plate stands in the weather it measures, and has gone grey in it
ANEMOMETER.push({ parts: id => id === 'vane' || id === 'vane-roll', cuts: [], tint: () => [.74, .72, .69] })

/** The inclinometer's stand is older, darker oak than new work, so it sits
 * with the deck it carries rather than against it. */
const INCLINOMETER: WearRule[] = [
  ...['support', 'cleat-0', 'cleat-1', 'journal-post--1', 'journal-post-1'].map(id => boardTone(id, .14)),
  { parts: id => id === 'support' || id.startsWith('cleat-') || id.startsWith('journal-post'), cuts: [], tint: () => [.66, .6, .53] },
]

export function instrumentWear(slug: string): readonly WearRule[] {
  return slug === 'camera-obscura' ? CAMERA_OBSCURA : slug === 'anemometer' ? ANEMOMETER
    : slug === 'inclinometer' ? INCLINOMETER : []
}

/** The compass's fittings, burnished by turning against each other: the
 * bolt, its washers and nut, and the steel points. The legs stay forged. */
export const compassFitting = (id: string): boolean =>
  id === 'pivot' || id.startsWith('screw-') || id.startsWith('washer-') || id.includes('-point-')
