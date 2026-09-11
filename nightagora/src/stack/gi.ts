/* BAKED GLOBAL ILLUMINATION — a forge step, not a runtime feature.

   Bounce light in a museum is nearly all static: the walls do not move, the
   hour is fixed and documented, and the only thing that changes is where the
   visitor stands. Solving that every frame is paying for an answer that was
   already known when the wing was built.

   So the shape is: the forge bakes irradiance for a wing offline and ships it
   as a volume or a set of lightmaps beside the wing's other assets, with a
   manifest entry like any other; the runtime samples it. This file is the
   hook that keeps the runtime side honest until the forge step exists, so
   the first wing that bakes does not have to change every material to use it.

   What the forge will need to write per wing:
     · `gi/<wing>/probes.json`  the grid origin, spacing and counts
     · `gi/<wing>/irradiance.*` the SH or the volume texture
     · a manifest entry with class GENERATED and the bake's own settings */

import type { MaterialSet } from './materials'

export interface BakedGI {
  /** true once a wing ships a bake; false everywhere today */
  ready: boolean
  /** the wing this bake belongs to */
  scope: string
  /** what a surface at this world point with this normal receives */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  irradiance: ((worldNode: any, normalNode: any) => any) | null
}

export function loadBakedGI(scope: string): BakedGI {
  return { ready: false, scope, irradiance: null }
}

/** what a set contributes back to the bake; the forge reads this, not the app */
export function bakeAlbedo(set: MaterialSet): [number, number, number] {
  return [set.albedo.r, set.albedo.g, set.albedo.b]
}
