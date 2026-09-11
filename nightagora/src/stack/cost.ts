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
  frameMsP50: number
  frameMsP95: number
  tier: TierName
  backend: 'webgpu' | 'webgl2'
  /** what the material library is holding, in megabytes */
  textureMB: number
  /** how many frames the percentiles were taken over */
  frames: number
}

const WINDOW = 120

export interface CostMeter {
  sample: (frameMs: number) => void
  read: () => Omit<CostReading, 'tier' | 'backend' | 'textureMB'>
  reset: () => void
}

export function createCostMeter(renderer: WebGPURenderer): CostMeter {
  const ring = new Float32Array(WINDOW)
  let n = 0
  let at = 0

  return {
    sample(frameMs) {
      ring[at] = frameMs
      at = (at + 1) % WINDOW
      if (n < WINDOW) n++
    },
    read() {
      const taken = Array.prototype.slice.call(ring, 0, n) as number[]
      taken.sort((a, b) => a - b)
      const pick = (q: number): number =>
        n === 0 ? 0 : Math.round((taken[Math.min(n - 1, Math.floor(q * n))] ?? 0) * 100) / 100
      return {
        draws: renderer.info.render.drawCalls,
        triangles: renderer.info.render.triangles,
        frameMsP50: pick(0.5),
        frameMsP95: pick(0.95),
        frames: n,
      }
    },
    reset() {
      n = 0
      at = 0
    },
  }
}
