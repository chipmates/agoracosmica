import type { Stack } from '../../../stack'
import type { MachineSlug } from './catalog'
import type { ReadyMachineBuild } from './runtime'
import { build as aerial_screw } from './aerial-screw'
import { build as parachute } from './parachute'
import { build as anemometer } from './anemometer'
import { build as inclinometer } from './inclinometer'
import { build as multi_barrel_gun } from './multi-barrel-gun'
import { build as rolling_mill } from './rolling-mill'
import { build as ball_bearing } from './ball-bearing'
import { build as flywheel } from './flywheel'
import { build as revolving_crane } from './revolving-crane'
import { build as lathe } from './lathe'
import { build as miter_lock_gates } from './miter-lock-gates'
import { build as water_lifting_screw } from './water-lifting-screw'
import { build as proportional_compass } from './proportional-compass'
import { build as camera_obscura } from './camera-obscura'

export * from './catalog'
export type { ReadyMachineBuild } from './runtime'
export type { Dossier, MachineBuild, Certainty } from './types'

export const builders: Record<MachineSlug, (stack: Stack) => ReadyMachineBuild> = {
  'aerial-screw': aerial_screw,
  'parachute': parachute,
  'anemometer': anemometer,
  'inclinometer': inclinometer,
  'multi-barrel-gun': multi_barrel_gun,
  'rolling-mill': rolling_mill,
  'ball-bearing': ball_bearing,
  'flywheel': flywheel,
  'revolving-crane': revolving_crane,
  'lathe': lathe,
  'miter-lock-gates': miter_lock_gates,
  'water-lifting-screw': water_lifting_screw,
  'proportional-compass': proportional_compass,
  'camera-obscura': camera_obscura,
}

export function buildMachine(slug: MachineSlug, stack: Stack): ReadyMachineBuild {
  return builders[slug](stack)
}
