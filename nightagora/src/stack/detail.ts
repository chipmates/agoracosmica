/* THE EMPTY-PLANE HELPER — the law that no plane in this museum is ever flat
   colour.

   A plane with one albedo reads as a plane with one albedo at every distance,
   and the eye finds it in a quarter of a second. What a real surface has is
   THREE scales at once: a macro variation you see across the room, a mid
   relief you see from where you stand, and a micro roughness you only see
   because it changes how the light sits. Take any one away and the surface
   goes to cardboard.

   With the library in place the three scales are:

     macro   the set's own maps at the size the source photographed them
     mid     a SECOND read of the same maps at a fifth of that size, turned,
             which is what stops a tiled photograph from reading as a tile
     micro   procedural, because no 2K map holds a tooth this small

   The procedural macro and mid stay under all of it. They are what the night
   was authored on, they cost no memory, and they are still the whole surface
   on a set the manifest does not name or a frame drawn before the bytes
   land. The library MULTIPLIES into them; it never stands in for them.

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
  normalMap,
  normalize,
  positionWorld,
  smoothstep,
  uv,
  vec2,
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
  /** where the maps are read from. `world` projects from the world position
      straight down, which is what a hand-written instanced material needs;
      `uv` reads the geometry's own coordinates, which is what a standard
      material's tangent frame is built from. */
  space?: 'world' | 'uv'
  /** the world position, for a material three cannot infer one for */
  at?: N
  /** the projection to read the maps through, in METRES: a column wants its
      own circumference and height, not the ground plane it stands on */
  uv?: N
  /** how strongly the library's own maps come in, 0..1 */
  maps?: number
}

export interface DetailNodes {
  /** multiply into an albedo: the three scales with their density gradient */
  albedo: N
  /** the mid relief as a tangent-space normal, already faded */
  normal: N
  /** the surface's roughness at this point */
  roughness: N
  /** 1 where nothing occludes, from the library's own occlusion map */
  occlusion: N
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
  const mapAmt = opts.maps ?? 1
  const fade = opts.fade ?? [12 * set.falloff, 46 * set.falloff]

  const P = opts.at ?? positionWorld
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
  let albedo: N = mix(vec3(1, 1, 1), hue, macro.mul(density).mul(macroAmt * 0.3)).mul(value)

  // 2 · mid: the relief you read from where you stand. Two noise reads a
  //     step apart are a gradient, which is a normal, at a cost of two taps
  const eps = s[1] * 0.35
  const h = (o: N): N => mx_noise_float(P.add(o).div(s[1]))
  const dx = h(vec3(eps, 0, 0)).sub(h(vec3(-eps, 0, 0)))
  const dz = h(vec3(0, 0, eps)).sub(h(vec3(0, 0, -eps)))
  const relief = count >= 2 ? density.mul(midAmt * set.normalStrength) : float(0)
  let normal: N = normalize(vec3(dx.mul(relief), dz.mul(relief), float(1)))

  // 3 · micro: not visible as shape, only as the way the light sits
  const micro =
    count >= 3
      ? mx_noise_float(P.div(s[2])).mul(0.5).add(0.5).sub(0.5).mul(density).mul(microAmt * 0.22)
      : float(0)
  let roughness: N = float(set.roughness).add(micro)
  let occlusion: N = float(1)

  /* THE LIBRARY, ON TOP. The map's albedo arrives as a ratio around one and
     is already held at exactly one until its bytes are on the GPU, so this
     line cannot move the exposure of a scene whose library has not landed.
     The mid read is the same photograph a fifth of the size and turned by a
     third of a radian: at that offset the two reads decorrelate and the tile
     stops being findable. */
  if (mapAmt > 0) {
    const where = opts.uv
      ? { uv: opts.uv }
      : opts.space === 'uv'
        ? { uv: uv().mul(set.metres[0]) }
        : { world: P }
    const grand = set.sample(where)
    albedo = albedo.mul(mix(vec3(1, 1, 1), grand.albedo, density.mul(mapAmt)))
    roughness = grand.roughness.add(micro)
    occlusion = mix(float(1), grand.occlusion, density.mul(mapAmt))
    let tangent: N = grand.normal
    if (count >= 2) {
      const near = set.sample({ ...where, metres: set.metres[0] / 5, turn: 0.34 })
      albedo = albedo.mul(mix(vec3(1, 1, 1), near.albedo, density.mul(mapAmt * 0.45)))
      tangent = normalize(vec3(tangent.xy.add(near.normal.xy.mul(0.5)), tangent.z))
      roughness = mix(roughness, near.roughness, 0.3).add(micro)
    }
    // the procedural relief and the map's relief are both slopes, so they
    // add as slopes and are renormalised once
    normal = normalize(
      vec3(
        normal.xy.add(tangent.xy.mul(density.mul(mapAmt * set.normalStrength * 2))),
        normal.z
      )
    )
  }

  return { albedo, normal, roughness: clamp(roughness, 0.02, 1), occlusion, density }
}

/* A NodeMaterial with the usual slots. Only a LIT one gets the normal and the
   roughness: an unlit hand-written material computes its own light and never
   reads those slots, and three's normal map node wants a tangent frame built
   from the geometry's own uv derivatives, which an instanced vertex path has
   no honest answer for. */
interface DetailTarget {
  colorNode?: N
  normalNode?: N
  roughnessNode?: N
  lights?: boolean
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
  const base =
    material.colorNode === undefined || material.colorNode === null
      ? vec3(set.albedo.r, set.albedo.g, set.albedo.b)
      : material.colorNode
  material.colorNode = base.mul(nodes.albedo).mul(nodes.occlusion)
  if (material.lights === true) {
    material.roughnessNode = nodes.roughness
    // three's normal map node expects the PACKED value and unpacks it itself
    material.normalNode = normalMap(nodes.normal.mul(0.5).add(0.5), vec2(1, 1))
  }
  return nodes
}
