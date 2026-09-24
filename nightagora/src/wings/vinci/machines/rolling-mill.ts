import type { Stack } from '../../../stack'
import { machineCatalog } from './catalog'
import { mix, ONE, smooth, withMadeDressing, type MadeDressing, type Tint } from './made-dressing'
import { makeMachine, type ReadyMachineBuild } from './runtime'

/** Half a Florentine braccio, the sheet's width of tin: outside it the barrel
 * is never polished by the metal and stays dull. */
const RUN = 0.2918 / 2
const DULL: Tint = [0.7, 0.66, 0.58]
const OIL: Tint = [0.6, 0.54, 0.46]
const NECKS = [0.65, 0.802]

const MILL: MadeDressing = {
  wear: [
    {
      classes: /bell bronze/,
      rules: [{
        parts: () => true,
        cuts: [{ normal: [1, 0, 0], at: [-RUN - 0.012, -RUN, RUN, RUN + 0.012] }],
        tint: (p) => {
          const out = Math.abs(p.x)
          const r = Math.hypot(p.y - (p.y > 0.726 ? NECKS[1]! : NECKS[0]!), p.z)
          // the necks run black with grease in their bearings
          if (r < 0.04 && out > 0.18) return OIL
          return mix(ONE, DULL, smooth(RUN - 0.004, RUN + 0.012, out))
        },
      }],
    },
    {
      // grease run out of the bearings, down the blocks' inner faces under them
      classes: /planed oak/,
      rules: [{
        parts: () => true,
        cuts: [-1, 1].flatMap(s => [
          { normal: [0, 0, 1] as const, at: [-0.036, -0.018, 0.018, 0.036], facing: [s, 0, 0] as const },
          { normal: [0, 1, 0] as const, at: [0.36, 0.46], facing: [s, 0, 0] as const },
        ]),
        tint: (p, n) => {
          if (Math.abs(n.x) < 0.7 || n.x * p.x > 0 || Math.abs(Math.abs(p.x) - 0.2) > 0.004 || p.y > 0.531 || p.y < 0.3) return ONE
          const run = 1 - smooth(0.012, 0.036, Math.abs(p.z))
          return mix(ONE, OIL, run * smooth(0.32, 0.52, p.y) * 0.85)
        },
      }],
    },
    {
      // the chocks blackened round the necks they carry
      classes: /bronze, cast/,
      rules: [{
        parts: () => true,
        cuts: [],
        tint: (p, n) => {
          if (Math.abs(n.x) < 0.7) return ONE
          const r = Math.min(...NECKS.map(y => Math.hypot(p.y - y, p.z)))
          return mix(OIL, ONE, smooth(0.034, 0.06, r))
        },
      }],
    },
    {
      // the grip darkened where the hand closes on it
      classes: /oak grip/,
      rules: [{ parts: () => true, cuts: [], tint: (_p, _n, local) => mix([0.72, 0.68, 0.62], ONE, smooth(0.012, 0.03, Math.abs(local.y))) }],
    },
  ],
}

/** Exact dossier parts and schedule. Construction dimensions remain declared assumptions. */
export function build(stack: Stack): ReadyMachineBuild {
  return withMadeDressing(makeMachine(stack, machineCatalog['rolling-mill']), MILL)
}
