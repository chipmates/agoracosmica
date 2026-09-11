/* VOLUMETRICS — the API exists, the cost is documented, and no scene of the
   lobby earns it yet.

   What earns volumetrics is a visible beam: dust in a shaft of sun through a
   high window, mist over a marsh at the documented hour, smoke standing in a
   doorway. What does NOT earn them is "the room could use some atmosphere",
   which is how every night scene ends up in fog.

   The measured cost of the compute path, so a wing can decide before it
   builds: a 160 x 90 x 128 froxel grid re-scattered every frame is about
   1.8 M invocations, which on the owner's Mac is roughly 2.2 ms at the hero
   tier and does not fit the standard tier's frame at all. That is why this
   is a stub and not a feature: the first wing that needs a beam implements
   it against a scene that will pay for it, and the tier flag
   (`Tier.volumetrics`) already gates it. */

import type { Tier } from './tier'

export interface VolumetricOptions {
  /** the box the medium fills, in world metres */
  bounds: { min: [number, number, number]; max: [number, number, number] }
  density: number
  anisotropy: number
  /** how many froxels deep the march goes */
  steps: number
}

export interface Volumetrics {
  available: boolean
  reason: string
  /** the estimated cost of this configuration, in milliseconds per frame */
  estimateMs: number
}

const INVOCATIONS_PER_MS = 820_000

export function planVolumetrics(tier: Tier, opts: VolumetricOptions): Volumetrics {
  const invocations = 160 * 90 * opts.steps
  const estimateMs = Math.round((invocations / INVOCATIONS_PER_MS) * 100) / 100
  if (!tier.volumetrics) {
    return { available: false, reason: `the ${tier.name} tier has no compute budget`, estimateMs }
  }
  return { available: false, reason: 'no scene on the path earns a beam yet', estimateMs }
}
