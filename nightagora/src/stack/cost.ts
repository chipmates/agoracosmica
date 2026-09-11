/* THE COST METER — the two numbers a GPU cannot argue with, and the two the
   rig must measure rather than guess.

   Draw calls and triangles come off the renderer and are exact. Frame time is
   a measurement, so it is reported as a distribution and not as an average: a
   scene that runs at 60 fps with one 40 ms hitch every second is not a scene
   that runs at 60 fps, and only the 95th percentile says so. The window is
   120 frames, which is two seconds of a good frame rate and long enough that
   one slow compile does not colour the whole reading. */

import { Vector2, type WebGPURenderer } from 'three/webgpu'
import { samplesFor } from './post'
import type { Tier, TierName } from './tier'

export interface CostReading {
  draws: number
  triangles: number
  /** the interval between presented frames, which is what a visitor feels */
  frameMsP50: number
  frameMsP95: number
  /** what the CPU spent submitting the frame, which is what a rig can fix */
  cpuMsP50: number
  cpuMsP95: number
  tier: TierName
  backend: 'webgpu' | 'webgl2'
  /** what the two libraries are holding, in megabytes */
  textureMB: number
  /** and what the model library alone is holding: how many prototypes, the
      triangles every body of them adds up to, and their share of the
      texture above. A frame's own triangle count is what the renderer drew;
      this is what the library put in the room. */
  models: { loaded: number; tris: number; textureMB: number }
  /** what the frame itself is holding: the scene pass's attachments plus the
      post chain's own targets, in megabytes */
  frameMB: number
  /** how many frames the percentiles were taken over */
  frames: number
  /** the tier's own budget, so a rig never carries a second copy of it */
  budget: { draws: number; triangles: number; fps: number; textureMB: number; frameMB: number }
}

const WINDOW = 120

/* WHAT THE FRAME ITSELF COSTS IN MEMORY.
   Arithmetic over the formats each stage declares, at the renderer's own
   drawing buffer size. The scene pass is exact and it is where MSAA lands:
   a multisampled colour attachment is `samples` copies of a half-float RGBA
   surface plus the single-sample surface it resolves into, and the depth
   attachment multiplies the same way. The post nodes are counted from the
   shapes they declare in three's own sources (five bloom mips over two
   chains plus the bright pass; three full-size half-float targets for SMAA;
   two quarter-size for the cheap glow), which is why this number moves when
   three does and why it is reported next to the tier that produced it. */
const RGBA16F = 8
const DEPTH = 4

export function frameBytes(tier: Tier, width: number, height: number, pixelRatio: number): number {
  const px = width * height
  const s = samplesFor(tier, pixelRatio)
  // colour: the resolve target always, plus the multisampled attachment
  let bytes = px * RGBA16F * (s > 0 ? s + 1 : 1)
  bytes += px * DEPTH * (s > 0 ? s : 1)
  if (tier.ao.on) bytes += px * tier.ao.scale * tier.ao.scale * RGBA16F * 2 // ao + its denoise
  if (tier.bloom === 'mip') bytes += px * RGBA16F * (0.25 + 2 * (0.25 + 0.0625 + 0.015625 + 0.00390625 + 0.0009765625))
  else if (tier.bloom === 'soft') bytes += px * RGBA16F * 0.0625 * 2
  if (tier.dof) bytes += px * RGBA16F * 2
  if (tier.aa === 'smaa') bytes += px * RGBA16F * 3 + 160 * 560 * 4 + 64 * 16 * 4
  else if (tier.aa === 'taa') bytes += px * RGBA16F * 3
  return bytes
}

export interface CostMeter {
  sample: (frameMs: number, cpuMs: number) => void
  read: () => Omit<CostReading, 'tier' | 'backend' | 'textureMB' | 'frameMB' | 'budget' | 'models'>
  reset: () => void
}

export function createCostMeter(renderer: WebGPURenderer): CostMeter {
  const frames = new Float32Array(WINDOW)
  const cpu = new Float32Array(WINDOW)
  let n = 0
  let at = 0

  const percentile = (ring: Float32Array, count: number, q: number): number => {
    if (count === 0) return 0
    const taken = (Array.prototype.slice.call(ring, 0, count) as number[]).sort((a, b) => a - b)
    return Math.round((taken[Math.min(count - 1, Math.floor(q * count))] ?? 0) * 100) / 100
  }

  return {
    sample(frameMs, cpuMs) {
      frames[at] = frameMs
      cpu[at] = cpuMs
      at = (at + 1) % WINDOW
      if (n < WINDOW) n++
    },
    read() {
      return {
        draws: renderer.info.render.drawCalls,
        triangles: renderer.info.render.triangles,
        frameMsP50: percentile(frames, n, 0.5),
        frameMsP95: percentile(frames, n, 0.95),
        cpuMsP50: percentile(cpu, n, 0.5),
        cpuMsP95: percentile(cpu, n, 0.95),
        frames: n,
      }
    },
    reset() {
      n = 0
      at = 0
    },
  }
}
