/* THE EMPTY-PLANE HELPER — the law that no plane in this museum is ever flat
   colour.

   A plane with one albedo reads as a plane with one albedo at every distance,
   and the eye finds it in a quarter of a second. What a real surface has is
   THREE scales at once: a macro variation you see across the room, a mid
   relief you see from where you stand, and a micro roughness you only see
   because it changes how the light sits. Take any one away and the surface
   goes to cardboard.

   The fourth term is the density gradient. Detail that keeps its amplitude
   into the distance is detail that aliases, so every scale thins with the
   distance from the eye, and the plane hands itself over to the air instead
   of shimmering. */

import * as TSL from 'three/tsl'
import type { MaterialSet } from './materials'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  cameraPosition,
  clamp,
  float,
  length,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  normalize,
  positionWorld,
  smoothstep,
  vec3,
} = TSL as unknown as Record<string, N>

export interface DetailScales {
  /** metres of each of the three features; the set's own scales by default */
  scales?: [number, number, number]
  /** how far the macro variation swings, 0..1 */
  macro?: number
  /** how much relief the mid normal carries */
  mid?: number
  /** how rough the micro noise makes the surface */
  micro?: number
  /** where the density gradient starts and ends thinning, in metres */
  fade?: [number, number]
  /** how many of the three scales this tier can afford */
  count?: 1 | 2 | 3
}

export interface DetailNodes {
  /** multiply into an albedo: the macro variation with its density gradient */
  albedo: N
  /** add to a normal: the mid relief, already faded */
  normal: N
  /** multiply or add into roughness: the micro tooth */
  roughness: N
  /** 0..1, 1 near the eye and 0 where the plane has given itself to the air */
  density: N
}

/**
 * The three scales and the gradient, as nodes a hand-written material can
 * compose itself. `applyDetail` is the same thing for a standard material.
 */
export function detailNodes(set: MaterialSet, opts: DetailScales = {}): DetailNodes {
  const s = opts.scales ?? set.scales
  const count = opts.count ?? 3
  const macroAmt = opts.macro ?? 1
  const midAmt = opts.mid ?? 1
  const microAmt = opts.micro ?? 1
  const fade = opts.fade ?? [12 * set.falloff, 46 * set.falloff]

  const P = positionWorld
  const d = length(P.sub(cameraPosition))
  const density = clamp(float(1).sub(smoothstep(fade[0], fade[1], d)), 0, 1)

  // 1 · macro: what the room-scale eye sees. Two terms, and they are kept
  //     apart on purpose. VALUE swings around 1, so a plane never gets
  //     brighter on average than it was authored. HUE leans toward the set's
  //     second colour along a ratio normalised to the same luminance, so the
  //     lean is a change of colour and never a change of exposure. (Written
  //     the naive way, variation/albedo, a deep blue stone with a pale vein
  //     multiplies itself by seven and the night turns to daylight.)
  const macro = mx_fractal_noise_float(P.div(s[0]), 3, 2.0, 0.55, 1.0).mul(0.5).add(0.5)
  const lum = (c: { r: number; g: number; b: number }): number =>
    Math.max(1e-4, 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b)
  const la = lum(set.albedo)
  const lv = lum(set.variation)
  const hue = vec3(
    set.variation.r / lv / (set.albedo.r / la),
    set.variation.g / lv / (set.albedo.g / la),
    set.variation.b / lv / (set.albedo.b / la)
  )
  const value = float(1).add(macro.sub(0.5).mul(2).mul(density).mul(macroAmt * 0.22))
  const albedo = mix(vec3(1, 1, 1), hue, macro.mul(density).mul(macroAmt * 0.3)).mul(value)

  // 2 · mid: the relief you read from where you stand. Two noise reads a
  //     step apart are a gradient, which is a normal, at a cost of two taps
  const eps = s[1] * 0.35
  const h = (o: N): N => mx_noise_float(P.add(o).div(s[1]))
  const dx = h(vec3(eps, 0, 0)).sub(h(vec3(-eps, 0, 0)))
  const dz = h(vec3(0, 0, eps)).sub(h(vec3(0, 0, -eps)))
  const relief = count >= 2 ? density.mul(midAmt * set.normalStrength) : float(0)
  const normal = normalize(vec3(dx.mul(relief), float(1), dz.mul(relief)))

  // 3 · micro: not visible as shape, only as the way the light sits
  const micro =
    count >= 3
      ? mx_noise_float(P.div(s[2])).mul(0.5).add(0.5).sub(0.5).mul(density).mul(microAmt * 0.22)
      : float(0)
  const roughness = float(set.roughness).add(micro)

  return { albedo, normal, roughness, density }
}

/* A NodeMaterial with the usual slots; the stack does not care which one. */
interface DetailTarget {
  colorNode?: N
  normalNode?: N
  roughnessNode?: N
}

/**
 * Lay the three scales onto a material. A standard material takes all three
 * slots; a hand-authored unlit material takes the albedo term only, and reads
 * the rest off the returned nodes if it wants them.
 */
export function applyDetail(
  material: DetailTarget,
  set: MaterialSet,
  opts: DetailScales = {}
): DetailNodes {
  const nodes = detailNodes(set, opts)
  material.colorNode =
    material.colorNode === undefined || material.colorNode === null
      ? vec3(set.albedo.r, set.albedo.g, set.albedo.b).mul(nodes.albedo)
      : material.colorNode.mul(nodes.albedo)
  if ('roughnessNode' in material) material.roughnessNode = nodes.roughness
  if ('normalNode' in material) material.normalNode = nodes.normal
  return nodes
}
