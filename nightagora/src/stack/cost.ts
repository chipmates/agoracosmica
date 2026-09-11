/* THE COST METER — the two numbers a GPU cannot argue with, and the two the
   rig must measure rather than guess.

   Draw calls and triangles come off the renderer and are exact. Frame time is
   a measurement, so it is reported as a distribution and not as an average: a
   scene that runs at 60 fps with one 40 ms hitch every second is not a scene
   that runs at 60 fps, and only the 95th percentile says so. The window is
   120 frames, which is two seconds of a good frame rate and long enough that
   one slow compile does not colour the whole reading. */

import type { WebGPURenderer } from 'three/webgpu'
import type { TierName } from './tier'

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
  /** what the material library is holding, in megabytes */
  textureMB: number
  /** how many frames the percentiles were taken over */
  frames: number
  /** the tier's own budget, so a rig never carries a second copy of it */
  budget: { draws: number; triangles: number; fps: number; textureMB: number }
}

const WINDOW = 120

export interface CostMeter {
  sample: (frameMs: number, cpuMs: number) => void
  read: () => Omit<CostReading, 'tier' | 'backend' | 'textureMB' | 'budget'>
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
