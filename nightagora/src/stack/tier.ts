/* THE THREE TIERS — one museum, three budgets.

   A tier is not a quality slider with things missing at the bottom: the calm
   tier is COMPLETE (every station reachable, every label readable), only
   cheaper. What a tier changes is how much the frame is allowed to cost, and
   the budgets below are the numbers the cost meter measures against. */

export type TierName = 'hero' | 'standard' | 'calm'

export interface Tier {
  name: TierName
  /** what the cost meter holds this tier to */
  budget: { draws: number; triangles: number; fps: number; textureMB: number }
  pixelRatio: number
  /** MSAA samples on the scene pass. Mutually exclusive with anything that
      samples the pass's depth (ao, dof, taa): see `samplesFor()` in post.ts */
  samples: number
  shadow: { on: boolean; mapSize: number; cascades: number; maxFar: number }
  ao: { on: boolean; scale: number }
  /** 'mip' is the five-level bloom; 'soft' is one threshold and one blur,
      which is nine draw calls cheaper and, on a phone, indistinguishable */
  bloom: 'mip' | 'soft' | 'off'
  dof: boolean
  aa: 'taa' | 'smaa' | 'fxaa' | 'none'
  reflection: { on: boolean; scale: number }
  grain: boolean
  /** how many scales of detail the empty-plane helper lays down */
  detail: 1 | 2 | 3
  volumetrics: boolean
}

export const TIERS: Record<TierName, Tier> = {
  hero: {
    name: 'hero',
    budget: { draws: 300, triangles: 3_000_000, fps: 60, textureMB: 512 },
    pixelRatio: 2,
    /* THE FRAME'S EDGES ARE MSAA'S JOB AND NOTHING ELSE'S. Four samples on
       the scene pass is what a stone room with a thousand cut arrises needs,
       and it is the one anti-aliasing that grades an edge without touching
       the surface inside it. It costs the three lines below it: occlusion,
       the lens and the temporal resolve all read the pass's depth, and a
       multisampled depth cannot be sampled. */
    samples: 4,
    shadow: { on: true, mapSize: 2048, cascades: 3, maxFar: 60 },
    /* GTAO OFF, AND IT IS THE FRAME THAT DECIDED IT. Without a temporal
       resolve its sample rotation stands in the picture as a fine diagonal
       crosshatch on every surface, which a visitor reads as a dirty screen.
       Denoised it is softer and still there, and it costs the frame its
       MSAA. Contact in this museum is carried by the key light's shadow and
       by the art's own analytic terms, which are exact and never dither.
       The node stays built and a wing with a normal buffer may switch it
       back on: `ao.on` forces `samples` to zero when it does. */
    ao: { on: false, scale: 1 },
    bloom: 'mip',
    /* the lens reads the pass's depth too, and no grade of this lobby asks
       for it (measured in stage 0.2: it bloats a dome of stars and softens
       cut stone). A wing with a real room at a real depth turns it on and
       gives up MSAA for it, or renders its own depth. */
    dof: false,
    /* MEASURED, not assumed. TAA is in the chain and a wing may pick it, but
       not this museum: every organ of the night moves inside its own shader
       and most materials write their own clip position, so three's velocity
       buffer reports a still pixel for a moving one. The temporal resolve
       then blends unrelated history and turns into a low-pass filter: on the
       lobby's own frame TAA cost 45 percent of the image's edge energy.
       What runs instead is MSAA on the pass with FXAA on the print behind
       it, for the aliasing a coverage resolve cannot see: a specular
       glitter, an alpha cut, a line drawn inside a shader. */
    aa: 'smaa',
    reflection: { on: true, scale: 0.75 },
    grain: true,
    detail: 3,
    volumetrics: true,
  },
  standard: {
    name: 'standard',
    budget: { draws: 150, triangles: 1_200_000, fps: 60, textureMB: 256 },
    pixelRatio: 2,
    samples: 4,
    shadow: { on: true, mapSize: 1024, cascades: 2, maxFar: 44 },
    ao: { on: false, scale: 0.5 },
    bloom: 'mip',
    dof: false,
    aa: 'smaa',
    reflection: { on: true, scale: 0.5 },
    grain: true,
    detail: 2,
    volumetrics: false,
  },
  calm: {
    name: 'calm',
    budget: { draws: 60, triangles: 400_000, fps: 60, textureMB: 96 },
    pixelRatio: 1.5,
    /* a phone resolves MSAA inside the tile, so four samples cost bandwidth
       the tiler never spends; the calm tier is cheaper in draws, not in
       edges */
    samples: 4,
    shadow: { on: false, mapSize: 512, cascades: 1, maxFar: 30 },
    ao: { on: false, scale: 0.5 },
    // the fire without its halo is a different room, not a cheaper one, so
    // the halo stays and only the way it is made gets cheaper
    bloom: 'soft',
    dof: false,
    /* the calm tier resolves in the pass and nowhere else: MSAA is the one
       anti-aliasing that costs no draw call, and the three the print-side
       resolve would cost are a twentieth of this tier's whole budget */
    aa: 'none',
    reflection: { on: false, scale: 0.5 },
    grain: true,
    detail: 1,
    volumetrics: false,
  },
}

export function isTierName(v: string | null | undefined): v is TierName {
  return v === 'hero' || v === 'standard' || v === 'calm'
}

export interface AdapterReading {
  backend: 'webgpu' | 'webgl2'
  /** the adapter's own word for the hardware it stands on */
  architecture: string
  maxTextureDimension2D: number
  maxBufferSize: number
}

/* The WebGPU types are not a dependency of this app, and one type package is
   not worth a canon entry: what the tier reads off the adapter is four fields. */
interface AdapterLike {
  info?: { architecture?: string; vendor?: string }
  limits: { maxTextureDimension2D: number; maxBufferSize: number }
}
interface GpuLike {
  requestAdapter: () => Promise<AdapterLike | null>
}

/** What the machine says about itself, read once at start. */
export async function readAdapter(): Promise<AdapterReading | null> {
  const gpu = (navigator as Navigator & { gpu?: GpuLike }).gpu
  if (!gpu) return null
  try {
    const adapter = await gpu.requestAdapter()
    if (!adapter) return null
    return {
      backend: 'webgpu',
      architecture: adapter.info?.architecture ?? '',
      maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
      maxBufferSize: Number(adapter.limits.maxBufferSize),
    }
  } catch {
    return null
  }
}

/**
 * The tier the machine gets before anyone overrides it.
 *
 * Reduced motion forces calm and nothing outranks it: a visitor who asked the
 * system for less movement is not asking for a better frame rate.
 */
export function pickTier(adapter: AdapterReading | null): TierName {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'calm'

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (memory !== undefined && memory <= 4) return 'calm'

  // a software adapter answers every limit generously and renders none of it
  if (adapter && /swiftshader|lavapipe|llvmpipe|software/i.test(adapter.architecture)) return 'calm'

  // no WebGPU means the WebGL2 path, which has no compute and a narrower
  // binding budget: it may be beautiful, it is never the hero tier
  if (!adapter) return 'standard'
  if (adapter.maxTextureDimension2D < 16384) return 'standard'
  if (adapter.maxBufferSize < 2 ** 31) return 'standard'
  if (memory !== undefined && memory < 8) return 'standard'

  // the phone axis: a narrow stage is a phone held in a hand, and the phone
  // is where the launch is measured, so it gets the standard tier by default
  const short = Math.min(window.innerWidth, window.innerHeight)
  if (short < 520) return 'standard'

  return 'hero'
}

/** `?tier=hero|standard|calm` is the rig's and the owner's own override. */
export function tierFromQuery(): TierName | null {
  const asked = new URLSearchParams(location.search).get('tier')
  return isTierName(asked) ? asked : null
}
