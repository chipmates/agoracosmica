import type { Stack } from '../../../stack'
import { machineCatalog } from './catalog'
import { mix, ONE, smooth, withMadeDressing, type MadeDressing, type Tint } from './made-dressing'
import { makeMachine, type ReadyMachineBuild } from './runtime'

/** The crane stands out in the court: its timbers weathered, damp and grime
 * at its foot, the deck scuffed where the hand stands to the crank, the stone
 * and the iron weathered. A look, not a claim. */
const DAMP: Tint = [0.62, 0.64, 0.56]
const SCUFF: Tint = [0.78, 0.76, 0.72]
const DECK = 0.26
/** Where the hand stands to the crank, on the deck in plan. */
const STAND = { x: -0.62, z: 0.05, rx: 0.24, rz: 0.34 }

const CRANE: MadeDressing = {
  wear: [
    {
      classes: /^oak$/,
      rules: [
        {
          // the timbers' own corners carry the band: no cut is needed
          parts: () => true,
          cuts: [],
          tint: (p) => mix(DAMP, ONE, smooth(-0.05, 0.12, p.y)),
        },
        {
          parts: () => true,
          cuts: [
            { normal: [1, 0, 0], at: [-0.84, -0.73, -0.62, -0.51, -0.4], facing: [0, 1, 0] },
            { normal: [0, 0, 1], at: [-0.27, -0.11, 0.05, 0.21, 0.37], facing: [0, 1, 0] },
          ],
          tint: (p, n) => {
            if (n.y < 0.5 || Math.abs(p.y - DECK) > 0.004) return ONE
            const d = Math.hypot((p.x - STAND.x) / STAND.rx, (p.z - STAND.z) / STAND.rz)
            return mix(SCUFF, ONE, smooth(0.3, 1, d))
          },
        },
      ],
    },
    {
      classes: /oak grip/,
      rules: [{ parts: () => true, cuts: [], tint: (_p, _n, local) => mix([0.72, 0.68, 0.62], ONE, smooth(0.014, 0.036, Math.abs(local.y))) }],
    },
  ],
  retint: [
    // silvered oak keeps a little of its brown in the sun
    { classes: /^oak$/, multiply: [1, 0.95, 0.88] },
    { classes: /^stone$/, multiply: [0.8, 0.84, 0.9] },
    // the pegs and wedges weathered with the timber they hold
    { classes: /oak peg/, multiply: [0.66, 0.63, 0.6] },
    { classes: /iron/, multiply: [1, 0.92, 0.82] },
  ],
}

/** Exact dossier parts and schedule. Construction dimensions remain declared assumptions. */
export function build(stack: Stack): ReadyMachineBuild {
  return withMadeDressing(makeMachine(stack, machineCatalog['revolving-crane']), CRANE)
}
