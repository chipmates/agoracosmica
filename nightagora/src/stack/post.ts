/* THE POST CHAIN — what happens to a frame after the scene has drawn it.

   The order is the order a camera and a lab would put it in: occlusion
   belongs to the geometry, so it goes first; bloom is what a lens does to a
   bright source, so it goes on the picture and not on the grade; depth of
   field is the lens too; the grade is the print; the resolve and the grain
   are the last two things that happen to a print.

     scene ─ AO ─ bloom ─ DOF ─ grade ─ vignette ─ sRGB ─ AA ─ grain ─ screen

   THE RESOLVE SITS AFTER THE PRINT, AND THAT IS NOT A STYLE CHOICE. FXAA
   and SMAA are edge detectors with thresholds written for display-referred
   pixels (FXAA's floor is 0.0312, SMAA's is a flat 0.1 on the raw channel
   delta). Handed the linear HDR frame, a night whose stone sits near 0.02
   to 0.08 linear presents deltas far under both floors, and the detector
   discards the edge instead of grading it. So the chain applies the tone
   map and the sRGB transfer itself, and the resolve reads the print.

   Two rules this chain enforces because the museum's register depends on
   them. Bloom is MASKED, never global: it is allowed on warm sources (fire,
   gold) and denied to everything else, which is how the eclipse keeps its
   ring. And occlusion is DENIED to bright pixels: the joins go deeper, the
   fire never dims.

   One hardware fact governs the top of the chain. Occlusion, depth of field
   and the temporal resolve all SAMPLE the scene pass's depth, and a
   multisampled depth texture cannot be sampled in WGSL. So a pass carries
   MSAA or it carries a depth reader, never both, and `samplesFor()` below
   is the single place that decides.

   Every dial is a uniform, so a scene change re-aims the chain instead of
   rebuilding it. Rebuilding costs a shader compile, and a shader compile in
   the middle of a descent is a stutter the visitor reads as a fault. */

import { PostProcessing, type Camera, type Scene, type WebGPURenderer } from 'three/webgpu'
import * as TSL from 'three/tsl'
import { ao as gtao } from 'three/addons/tsl/display/GTAONode.js'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js'
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js'
import { film } from 'three/addons/tsl/display/FilmNode.js'
import { fxaa } from 'three/addons/tsl/display/FXAANode.js'
import { smaa } from 'three/addons/tsl/display/SMAANode.js'
import { denoise as denoiseNode } from 'three/addons/tsl/display/DenoiseNode.js'
import { traa } from 'three/addons/tsl/display/TRAANode.js'
import { IDENTITY, type Grade } from './grade'
import type { Tier } from './tier'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  clamp,
  float,
  length,
  luminance,
  mix,
  mrt,
  output,
  pass,
  pow,
  renderOutput,
  screenUV,
  smoothstep,
  uniform,
  vec3,
  vec4,
  velocity,
} = TSL as unknown as Record<string, N>

export interface PostChain {
  post: PostProcessing
  /** re-aim the chain at another scene's look; the shader is not rebuilt */
  setGrade: (g: Grade | null | undefined) => void
  /** ease the dials toward the last grade asked for */
  update: (dt: number) => void
  dispose: () => void
}

interface Dials {
  exposure: number
  lift: [number, number, number]
  gamma: [number, number, number]
  gain: [number, number, number]
  saturation: number
  warm: [number, number, number]
  cool: [number, number, number]
  split: number
  vignette: number
  grain: number
  aoIntensity: number
  aoDistance: number
  bloomStrength: number
  bloomRadius: number
  bloomThreshold: number
  bloomWarmth: number
  dofFocus: number
  dofFocal: number
  dofBokeh: number
}

/* A grade may arrive from outside this module (a route, a rig state, a phase
   table), so a missing one is reachable and the chain resolves it to the
   identity print rather than reading dials off nothing. */
function dialsOf(asked: Grade | null | undefined): Dials {
  const g = asked ?? IDENTITY
  return {
    exposure: g.exposure,
    lift: [...g.lift],
    gamma: [...g.gamma],
    gain: [...g.gain],
    saturation: g.saturation,
    warm: [...g.warm],
    cool: [...g.cool],
    split: g.split,
    vignette: g.vignette,
    grain: g.grain,
    aoIntensity: g.ao.intensity,
    aoDistance: g.ao.distance,
    bloomStrength: g.bloom.strength,
    bloomRadius: g.bloom.radius,
    bloomThreshold: g.bloom.threshold,
    bloomWarmth: g.bloom.warmth,
    // no depth of field means a lens focused far with no aperture, which
    // costs the same and shows nothing
    dofFocus: g.dof?.focus ?? 100,
    dofFocal: g.dof?.focal ?? 1000,
    dofBokeh: g.dof?.bokeh ?? 0,
  }
}

/**
 * How many MSAA samples this tier's scene pass may carry, at this pixel ratio.
 *
 * Two rules. Occlusion, depth of field and the temporal resolve all sample
 * the pass's depth texture, and WGSL has no way to sample a multisampled
 * depth: a pass that carries any of the three carries no MSAA, and the tier
 * table is written so the lobby never asks for both.
 *
 * And a tier's sample count is what it asks for at a pixel ratio of one. A
 * retina buffer already holds four device pixels per pixel the visitor sees,
 * so the count halves above ratio one and never falls under two. Without
 * that rule the hero tier on a 2x display holds eight subsamples of a
 * half-float frame per visible pixel, which is a quarter of a gigabyte of
 * buffers for coverage the display cannot show.
 */
export function samplesFor(tier: Tier, pixelRatio = 1): number {
  const readsDepth = tier.ao.on || tier.dof || tier.aa === 'taa'
  if (readsDepth || tier.samples === 0) return 0
  return pixelRatio > 1 ? Math.max(2, Math.round(tier.samples / 2)) : tier.samples
}

export function createPost(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
  tier: Tier,
  asked: Grade | null | undefined
): PostChain {
  const first = asked ?? IDENTITY
  const d = dialsOf(first)
  const target = dialsOf(first)

  const u = {
    exposure: uniform(d.exposure),
    lift: uniform(vec3(...d.lift)),
    gamma: uniform(vec3(...d.gamma)),
    gain: uniform(vec3(...d.gain)),
    saturation: uniform(d.saturation),
    warm: uniform(vec3(...d.warm)),
    cool: uniform(vec3(...d.cool)),
    split: uniform(d.split),
    vignette: uniform(d.vignette),
    grain: uniform(d.grain),
    aoIntensity: uniform(d.aoIntensity),
    bloomWarmth: uniform(d.bloomWarmth),
    bloomStrength: uniform(d.bloomStrength),
    bloomThreshold: uniform(d.bloomThreshold),
    dofFocus: uniform(d.dofFocus),
    dofFocal: uniform(d.dofFocal),
    dofBokeh: uniform(d.dofBokeh),
  }

  const scenePass = pass(scene, camera, { samples: samplesFor(tier, renderer.getPixelRatio()) })
  if (tier.aa === 'taa') scenePass.setMRT(mrt({ output, velocity }))

  const colour: N = scenePass.getTextureNode('output')
  const depth: N = scenePass.getTextureNode('depth')

  let frame: N = colour

  // 1 · the joins go deeper, and nothing bright is allowed to dim
  let aoPass: N = null
  if (tier.ao.on) {
    // GTAO reconstructs its normals from depth when it is handed none, which
    // is the honest source here: most of the night is instanced geometry with
    // a hand-written vertex path, so a normal buffer would be a guess
    aoPass = (gtao as unknown as N)(depth, null, camera)
    aoPass.resolutionScale = tier.ao.scale
    aoPass.distanceExponent.value = 1
    aoPass.distanceFallOff.value = 1
    aoPass.radius.value = first.ao.distance
    aoPass.thickness.value = first.ao.thickness
    aoPass.scale.value = 1
    /* GTAO takes its samples off a per-pixel rotation, and without a
       temporal resolve to average them that rotation IS the image: a fine
       diagonal crosshatch over every surface, which reads as a dirty frame
       rather than as contact. The spatial denoise is what a chain without
       TAA has to pay instead. */
    const denoise = denoiseNode as unknown as N
    const occ = denoise(aoPass.getTextureNode(), depth, null, camera).r
    const bright = smoothstep(0.5, 1.15, luminance(frame.rgb))
    const guarded = mix(occ, float(1), bright)
    frame = frame.mul(mix(float(1), guarded, u.aoIntensity))
  }

  // 2 · bloom, thresholded AND masked: warm sources only. The mask is what
  //     keeps a white corona out of the halo while the fire and the gold
  //     keep theirs, and it is why this is never a global glow.
  const warm = clamp(frame.r.sub(frame.b).mul(3), 0, 1)
  const mask = mix(float(1), warm, u.bloomWarmth)
  let bloomPass: N = null
  if (tier.bloom === 'mip') {
    bloomPass = bloom(frame.mul(mask), first.bloom.strength, first.bloom.radius, first.bloom.threshold)
    frame = frame.add(bloomPass)
  } else if (tier.bloom === 'soft') {
    // one threshold and one quarter-resolution blur: the five-level version
    // costs eleven more draw calls, which on the calm tier is a fifth of the
    // whole budget for a halo nobody can tell apart on a phone
    const lit = frame.rgb.mul(mask)
    const over = smoothstep(u.bloomThreshold, u.bloomThreshold.add(0.25), luminance(lit))
    const glow = gaussianBlur(lit.mul(over), null, 6, { resolutionScale: 0.25 })
    frame = frame.add(glow.mul(u.bloomStrength))
  }

  // 3 · the lens: hero only, and only where a grade asks for it
  if (tier.dof) frame = dof(frame, scenePass.getViewZNode('depth'), u.dofFocus, u.dofFocal, u.dofBokeh)

  /* 4 · the temporal resolve, and only that one, runs here: it reprojects
     the LINEAR frame through the velocity buffer, which is geometry and not
     a threshold, so the print has nothing to tell it. */
  if (tier.aa === 'taa') frame = traa(frame, depth, scenePass.getTextureNode('velocity'), camera)

  // 5 · the print: exposure, lift/gamma/gain, the warm-cool split, saturation
  let c: N = frame.rgb.mul(u.exposure)
  c = c.add(u.lift.mul(clamp(float(1).sub(luminance(c)), 0, 1)))
  c = pow(clamp(c, 0, 8), vec3(1, 1, 1).div(u.gamma)).mul(u.gain)
  const lum = luminance(c)
  const splitTint = mix(u.cool, u.warm, clamp(lum.mul(1.6), 0, 1))
  c = mix(c, c.mul(splitTint), u.split)
  c = mix(vec3(lum, lum, lum), c, u.saturation)

  // 6 · the vignette
  const r = length(screenUV.sub(0.5))
  c = c.mul(float(1).sub(smoothstep(0.34, 0.86, r).mul(u.vignette)))

  /* 7 · the print is made HERE, before the resolve, because an edge
     detector cannot find an edge it cannot see. `outputColorTransform` is
     off for the same reason: three would otherwise do this last, after the
     one node in the chain that needed it done first. */
  let out: N = renderOutput(vec4(c.r, c.g, c.b, 1))

  // 8 · the resolve, on display-referred pixels
  if (tier.aa === 'smaa') out = smaa(out)
  else if (tier.aa === 'fxaa') out = fxaa(out)

  // 9 · the film the print is on
  if (tier.grain) out = film(out, u.grain)

  const post = new PostProcessing(renderer)
  post.outputColorTransform = false
  post.outputNode = out

  function setGrade(asked: Grade | null | undefined): void {
    const g = asked ?? IDENTITY
    Object.assign(target, dialsOf(g))
    if (aoPass) {
      aoPass.radius.value = g.ao.distance
      aoPass.thickness.value = g.ao.thickness
    }
  }

  const ease = (a: number, b: number, k: number): number => a + (b - a) * k
  const ease3 = (
    a: [number, number, number],
    b: [number, number, number],
    k: number
  ): [number, number, number] => [ease(a[0], b[0], k), ease(a[1], b[1], k), ease(a[2], b[2], k)]

  function update(dt: number): void {
    // a grade that snaps between two stages reads as a fault; the night's own
    // blends run at this speed
    const k = Math.min(1, dt * 3.2)
    d.exposure = ease(d.exposure, target.exposure, k)
    d.lift = ease3(d.lift, target.lift, k)
    d.gamma = ease3(d.gamma, target.gamma, k)
    d.gain = ease3(d.gain, target.gain, k)
    d.saturation = ease(d.saturation, target.saturation, k)
    d.warm = ease3(d.warm, target.warm, k)
    d.cool = ease3(d.cool, target.cool, k)
    d.split = ease(d.split, target.split, k)
    d.vignette = ease(d.vignette, target.vignette, k)
    d.grain = ease(d.grain, target.grain, k)
    d.aoIntensity = ease(d.aoIntensity, target.aoIntensity, k)
    d.bloomStrength = ease(d.bloomStrength, target.bloomStrength, k)
    d.bloomRadius = ease(d.bloomRadius, target.bloomRadius, k)
    d.bloomThreshold = ease(d.bloomThreshold, target.bloomThreshold, k)
    d.bloomWarmth = ease(d.bloomWarmth, target.bloomWarmth, k)
    d.dofFocus = ease(d.dofFocus, target.dofFocus, k)
    d.dofFocal = ease(d.dofFocal, target.dofFocal, k)
    d.dofBokeh = ease(d.dofBokeh, target.dofBokeh, k)

    u.exposure.value = d.exposure
    u.lift.value.set(...d.lift)
    u.gamma.value.set(...d.gamma)
    u.gain.value.set(...d.gain)
    u.saturation.value = d.saturation
    u.warm.value.set(...d.warm)
    u.cool.value.set(...d.cool)
    u.split.value = d.split
    u.vignette.value = d.vignette
    u.grain.value = d.grain
    u.aoIntensity.value = d.aoIntensity
    u.bloomWarmth.value = d.bloomWarmth
    u.dofFocus.value = d.dofFocus
    u.dofFocal.value = d.dofFocal
    u.dofBokeh.value = d.dofBokeh
    u.bloomStrength.value = d.bloomStrength
    u.bloomThreshold.value = d.bloomThreshold
    if (bloomPass) {
      bloomPass.strength.value = d.bloomStrength
      bloomPass.radius.value = d.bloomRadius
      bloomPass.threshold.value = d.bloomThreshold
    }
  }

  /** the first frame must already look like the grade it was asked for */
  update(1)

  return {
    post,
    setGrade,
    update,
    dispose() {
      post.dispose()
    },
  }
}
