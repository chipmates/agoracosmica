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
   of shimmering.

   AND THE HELPER IS THE MATERIAL'S, NOT THE STACK'S. The same macro mottle
   that is invisible on quarried stone is the whole surface on a weave: at a
   fixed contrast and a fixed scale it reads as mould on linen, as camouflage
   on iron and as nothing at all on gravel. So the macro's contrast and scale,
   the mid band and the micro amount come from the set (`MaterialSet.detail`,
   written by the manifest), and two laws hold above them:

     · a class that has no macro variation gets none (a metal varies by what
       it reflects, and a noise field on a sheet of gold is camouflage)
     · the mid band never covers a weave finer than itself: where the set's
       whole photographed tile is under twice the mid feature, the band is
       dropped, procedural relief and second map read together

   AND WHERE A PHOTOGRAPH HAS NOTHING TO GIVE AT THE SIZE A WALL IS READ AT,
   THE SET SAYS WHAT IT IS INSTEAD. Measured off the maps: linen's strongest
   feature is 0.7 mm, wool's 1.3, canvas's 5.6, and 99 per cent of each of
   those maps' variation sits under two centimetres. At the two hundred
   pixels per metre a wall is read at, that is a fifth of a pixel. The
   photograph is honest and it averages to its own mean, so the plane goes to
   flat colour and nothing in the stack can find it. What the eye reads on a
   hanging cloth at that distance is the drape, so a soft set carries a
   GRAIN: a fold, a slub run, a knit row, a wear crease, a chain line, a
   grain wave, each with a feature size the plane can hold, with the
   photograph riding under it. */

import * as TSL from 'three/tsl'
import type { GrainRecipe, MaterialSet, SampledMaps } from './materials'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  abs,
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
  sin,
  smoothstep,
  uv,
  vec2,
  vec3,
} = TSL as unknown as Record<string, N>

/* ── THE GRAIN ──────────────────────────────────────────────────────────────
   One field per soft class, each built from three primitives so that the
   whole set of them costs a handful of noise taps and reads at the size it
   declares.

     streaks  anisotropic fractal noise: fast across x, slow along y, which
              on an upright plane is a vertical fold and on a beam is the run
              of the grain. Turned the other way it is a course, a slub run,
              a wear band
     ripple   a plain sine, used once and only once: a laid paper's chain
              lines really are evenly spaced, and nothing else here is
     ridged   1 - |noise|, raised, which is a narrow line: a crease, a check

   Every field returns roughly -1 to 1 and is read in the set's OWN frame
   (already turned by its orientation), so a grain declared along the tile's
   u axis runs where the photograph's own does. */

const N3 = (r: N, sx: number, sy: number): N => vec3(r.x.mul(sx), 0, r.y.mul(sy))
const streaks = (r: N, sx: number, sy: number, oct: number): N =>
  mx_fractal_noise_float(N3(r, sx, sy), oct, 2.0, 0.55, 1.0)
const ripple = (t: N): N => sin(t.mul(Math.PI * 2))
const ridged = (n: N, sharp: number): N =>
  float(1).sub(abs(n)).pow(sharp).mul(2).sub(1)

/* THE DRAPE CARRIES THE FIELD AND THE WEAVE ONLY SIGNS IT. The first build
   of these gave a cloth two sine ridges at a fifth of its pitch and read as
   gingham: a sine is all its energy at one frequency, so on the plane it wins
   whatever amplitude it is given, and a regular grid is the one thing no
   hanging cloth has. Every field below is therefore fold-dominant, with the
   material's own signature at a quarter of the weight and no ruler in it
   anywhere except the one place a ruler is true. */

/** the field's own height at one place, in the set's own frame */
function grainHeight(g: GrainRecipe, r: N): N {
  const p = 1 / g.pitch
  if (g.kind === 'knit') {
    // heavy cloth hangs in soft columns; the courses only band it, and they
    // band it unevenly, because a hand knit's rows are not a ruler either
    return streaks(r, p, p / 4.5, 2)
      .mul(0.86)
      .add(streaks(r, p / 3.4, p / 0.5, 2).mul(0.18))
  }
  if (g.kind === 'creases') {
    // a worn hide does not drape, it creases: narrow lines over a wear path
    return ridged(streaks(r, p, p, 4), 3)
      .mul(-0.24)
      .add(streaks(r, p / 4.5, p / 4.5, 2).mul(0.7))
  }
  if (g.kind === 'laid') {
    // a sheet cockles rather than folds, and the chain lines are its ruler
    return streaks(r, p / 6, p / 4.2, 3)
      .mul(0.88)
      .add(ripple(r.x.mul(p)).mul(0.12))
  }
  if (g.kind === 'wave') {
    // timber: early and late wood as long lines, wandering slowly across
    return ridged(streaks(r, p, p / 7, 4), 2)
      .mul(0.5)
      .add(streaks(r, p / 2.4, p / 0.8, 2).mul(0.34))
  }
  if (g.kind === 'grit') {
    // a quarried stone's grain: no direction in it at all
    return streaks(r, p, p, 3)
  }
  // ridges: a hanging cloth. Folds down the drop, and a slub run across
  // them, uneven, because a slub is a thick thread and not a rule
  return streaks(r, p, p / 6, 2)
    .mul(0.88)
    .add(streaks(r, p / 2.6, p / 0.9, 2).mul(0.2))
}

interface GrainNodes {
  /** the tangent-space slope the field carries, as a vec2 */
  slope: N
  /** what it does to the albedo, as a ratio around one */
  shade: N
  /** and to the roughness, as an offset */
  rough: N
}

/**
 * The grain at one place. Three evaluations of the field for its slope, and
 * one more for the tooth, which reaches the albedo and the roughness but
 * never the normal: a one-centimetre feature is two pixels at wall distance,
 * and a normal that fine is an alias rather than a surface.
 */
function grainNodes(g: GrainRecipe, place: N, density: N, count: number): GrainNodes {
  const ca = Math.cos(g.angle)
  const sa = Math.sin(g.angle)
  const r = g.angle
    ? vec2(place.x.mul(ca).sub(place.y.mul(sa)), place.x.mul(sa).add(place.y.mul(ca)))
    : place

  let h = grainHeight(g, r)
  if (g.fold > 0) {
    const f = 1 / g.fold
    h = h.add(streaks(r, f, f / 2.6, 2).mul(1.15))
  }
  /* one step for the whole field, taken at the mid feature's own size. A
     coarser term genuinely has a gentler slope at that step, which is what a
     fold is; the sines are what the step must not be finer than. */
  const e = g.pitch * 0.3
  const at = (dx: number, dy: number): N => {
    let k = grainHeight(g, r.add(vec2(dx, dy)))
    if (g.fold > 0) {
      const f = 1 / g.fold
      k = k.add(streaks(r.add(vec2(dx, dy)), f, f / 2.6, 2).mul(1.15))
    }
    return k
  }
  const slope = vec2(at(e, 0).sub(h), at(0, e).sub(h))
  // back out of the field's own turn, so the relief is lit where it is seen
  const world = g.angle
    ? vec2(slope.x.mul(ca).add(slope.y.mul(sa)), slope.y.mul(ca).sub(slope.x.mul(sa)))
    : slope

  const tooth =
    count >= 3 && g.tooth > 0 ? streaks(r, 1 / g.tooth, 1 / (g.tooth * 1.8), 2) : float(0)

  return {
    slope: world.mul(density.mul(g.relief * 1.4)),
    shade: h.mul(g.shade * 0.155).add(tooth.mul(g.shade * 0.36)).mul(density),
    rough: h
      .mul(-g.sheen * 0.3)
      .add(tooth.mul(g.sheen * 0.3))
      .add(float(-g.sheen * 0.12))
      .mul(density),
  }
}

export interface DetailScales {
  /** metres of each of the three features; the set's own scales by default */
  scales?: [number, number, number]
  /** how far the macro variation swings, 0..1; the set's own by default */
  macro?: number
  /** how much relief the mid normal carries, where the set has a mid band */
  mid?: number
  /** how rough the micro noise makes the surface; the set's own by default */
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
  const macroAmt = opts.macro ?? set.detail.macroContrast
  const microAmt = opts.micro ?? set.detail.micro
  const mapAmt = opts.maps ?? 1
  const fade = opts.fade ?? [12 * set.falloff, 46 * set.falloff]

  /* THE MID BAND'S OWN LAW. A mid feature coarser than the photograph it
     stands on does not sit under the material, it replaces it: a 10 cm cloud
     over a 3 mm weave IS the surface. So the band is only laid where the
     set's own tile is at least twice the mid feature, and where it is not,
     both halves of it go (the procedural relief and the second read of the
     map at a fifth of the size). */
  const weave = Math.min(set.scale[0], set.scale[1])
  const midBand = count >= 2 && s[1] > 0 && s[1] <= weave * 0.5
  const midAmt = midBand ? (opts.mid ?? 1) : 0

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
  const mid = midBand ? s[1] : 1
  const eps = mid * 0.35
  const h = (o: N): N => mx_noise_float(P.add(o).div(mid))
  const dx = h(vec3(eps, 0, 0)).sub(h(vec3(-eps, 0, 0)))
  const dz = h(vec3(0, 0, eps)).sub(h(vec3(0, 0, -eps)))
  /* AND ONLY A SCATTERING SURFACE CARRIES INVENTED RELIEF. At full amplitude
     this normal tilts by some fourteen degrees. On a rough stone that is a
     shadow; on a mirror it is a different piece of sky, and the plane breaks
     into camouflage, which is what the first reading found on all three
     metals. A metal is a mirror at every roughness, because it has no
     diffuse term for the swing to hide in, so it takes none of this term and
     keeps only the relief its own photograph carries. */
  const scatter =
    (1 - set.metalness) * Math.min(1, Math.max(0, (set.roughness - 0.12) / 0.28))
  const relief = midBand ? density.mul(midAmt * set.normalStrength * scatter) : float(0)
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
  const where = opts.uv
    ? { uv: opts.uv }
    : opts.space === 'uv'
      ? { uv: uv().mul(vec2(set.scale[0], set.scale[1])) }
      : { world: P }

  if (mapAmt > 0) {
    let grand = set.sample(where)
    /* A TILE THAT CAN BE COUNTED IS WALLPAPER. Where a set's tile is far
       smaller than the surface it dresses, the same knot lands in a lattice
       the eye finds at once. The second read is the same photograph turned,
       shifted and laid at another size, so its own repeat is incommensurate
       with the first's, and a mask coarser than either chooses between them.
       Two taps per map, and only for a set that asks. */
    if (set.detile > 0) {
      const alt = set.sample({
        ...where,
        /* a small turn, not a right angle: the second read has to break the
           lattice, not lay a second grain across the first. The tile size
           and the shift are what move the knots. */
        turn: 0.16,
        offset: [0.41, 0.77],
        metres: [set.scale[0] * 1.37, set.scale[1] * 1.37],
      })
      const k = smoothstep(
        0.4,
        0.6,
        mx_noise_float(N3(set.place(where), 1 / set.detile, 1 / set.detile))
          .mul(0.5)
          .add(0.5)
      )
      grand = {
        albedo: mix(grand.albedo, alt.albedo, k),
        colour: mix(grand.colour, alt.colour, k),
        normal: mix(grand.normal, alt.normal, k),
        roughness: mix(grand.roughness, alt.roughness, k),
        occlusion: mix(grand.occlusion, alt.occlusion, k),
      } as SampledMaps
    }
    albedo = albedo.mul(mix(vec3(1, 1, 1), grand.albedo, density.mul(mapAmt)))
    roughness = grand.roughness.add(micro)
    occlusion = mix(float(1), grand.occlusion, density.mul(mapAmt))
    let tangent: N = grand.normal
    if (midBand) {
      const near = set.sample({
        ...where,
        metres: [set.scale[0] / 5, set.scale[1] / 5],
        turn: 0.34,
      })
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

  /* 4 · the grain, last, because it is the band the photograph under it does
     not carry at this size. Its slope adds to the slopes already there and
     the whole is renormalised once. A set that declares none pays nothing. */
  if (set.grain && count >= 2) {
    const g = grainNodes(set.grain, set.place(where), density, count)
    if (set.grain.shade > 0) albedo = albedo.mul(float(1).add(g.shade))
    if (set.grain.sheen > 0) roughness = roughness.add(g.rough)
    normal = normalize(vec3(normal.xy.add(g.slope), normal.z))
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
