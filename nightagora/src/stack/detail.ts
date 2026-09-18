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
  cos,
  float,
  floor,
  fract,
  length,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  normalMap,
  normalize,
  normalWorldGeometry,
  positionView,
  positionWorld,
  sin,
  smoothstep,
  uv,
  vec2,
  vec3,
} = TSL as unknown as Record<string, N>

/* ── THE PIXEL ──────────────────────────────────────────────────────────────
   Every scale below is gated on what the pixel covering this fragment can
   still resolve, and that is not a distance. A wall seen along its own length
   has a pixel that is centimetres across the courses and metres along them,
   so the eye's distance says nothing about whether a 4 mm tooth is a tooth or
   a lattice: the screen derivative of the world position does.

   Two figures, because a surface carries two kinds of feature. A NOISE FIELD
   varies in every direction at once, so it takes the anisotropic figure, the
   short axis of the pixel held up from the long one the way a sampler caps
   anisotropy: adding both derivatives filters a grazing surface away to flat
   colour, which is the defect it was meant to prevent. A LINE varies in one
   axis and in nothing else, so a joint at a fixed east takes the pixel's own
   x extent and a joint at a fixed north its z, and one figure for both is
   what breaks a floor's joints into dashes from eight metres. */

/** the world metres one pixel covers, with anisotropy capped as a sampler
    caps it; the figure a noise field is gated on */
export function anisotropicFootprint(P: N, maximumRatio = 8): N {
  const dx = length(P.dFdx()),
    dy = length(P.dFdy())
  return dx.min(dy).max(dx.max(dy).div(maximumRatio)).max(0.00001)
}

/** the same pixel along each world axis on its own; the figure a LINE is
    gated on, one per axis */
export function axisFootprint(P: N): { east: N; up: N; north: N } {
  const dx = P.dFdx().toVar(),
    dy = P.dFdy().toVar()
  const axis = (a: N, b: N): N => vec2(a, b).length().max(0.00002)
  return { east: axis(dx.x, dy.x), up: axis(dx.y, dy.y), north: axis(dx.z, dy.z) }
}

/** 1 where a feature of this size is resolved by this pixel, 0 where it is
    under it. Two to four samples per feature is where a sampler stops
    resolving and starts averaging, and a feature that is being averaged has
    to be gone rather than half there: half a feature per pixel is a lattice. */
export function resolved(metres: number | N, footprint: N): N {
  return smoothstep(2, 4, (typeof metres === 'number' ? float(metres) : metres).div(footprint))
}

/* ── THE COURSES ────────────────────────────────────────────────────────────
   A laid surface is the one case where the mid scale is not noise but a
   construction: a hand-set wall keeps its bed joints level and lets
   everything else wander, and a sawn floor is the same field with the wander
   taken out. The whole of it is colour and relief, no geometry and no bitmap,
   and every joint is filtered on ITS OWN axis, which is what keeps a run of
   them from breaking into dashes where the surface leaves the eye.

   The recipe is the caller's, in metres. The mechanism is the stack's, so a
   room's floor, a plinth and a court's paving are one piece of code and not
   three. */

export interface CourseRecipe {
  /** mean bed-joint spacing, metres */
  courseM: number
  /** the metres over which course height swings, and by how much */
  courseWaveM: number
  courseSwing: number
  /** mean block length and the fraction it varies by, per course */
  blockM: number
  blockSwing: number
  /** joint width and how far a joint line wanders off straight, metres */
  jointM: number
  wanderM: number
  /** how far a course's own face tone departs from the wall's */
  faceSwing: number
  /** and how far ONE BLOCK's departs from its course's. A sawn floor wants
      stone to stone variation with no course drift under it, a coursed wall
      wants both; the wall's own figure is the default. */
  blockFaceSwing?: number
  seed: number
}

export interface CourseNodes {
  /** multiply into the albedo: the face tone with the arris under it */
  tone: N
  /** 1 inside a joint, 0 on the face */
  joint: N
  /** how deep that joint is cut, in metres */
  depthM: N
  /** one number per stone, so a face can be dressed as its own stone */
  cell: N
  /** whether the courses are resolved at this pixel at all */
  held: N
}

const hash = (a: N, b: N, salt: number): N =>
  fract(a.mul(31.17).add(b.mul(13.713)).add(salt).sin().mul(4317.1))

/**
 * Face tone, joint coverage and the joint's own depth, in metres, read in a
 * surface coordinate `U` that is measured in METRES of the face itself.
 * `pixel` overrides both axis footprints with one figure, which is what a
 * caller with its own measured footprint hands in.
 */
export function courses(
  U: N,
  recipe: CourseRecipe,
  opts: { pixel?: N } = {}
): CourseNodes {
  const r = recipe
  const wave = float((Math.PI * 2) / r.courseWaveM)
  // A monotone phase whose slope carries the course-height swing; dividing
  // by that slope returns the distance to a bed joint in real metres.
  const phase = U.y.div(r.courseM).add(sin(U.y.mul(wave)).mul(r.courseSwing))
  const slope = float(1 / r.courseM).add(cos(U.y.mul(wave)).mul(r.courseSwing).mul(wave)).max(0.2)
  const row = floor(phase)
  const bedM = fract(phase).sub(0.5).abs().sub(0.5).abs().div(slope)
  const length_ = float(r.blockM).mul(hash(row, float(0), r.seed).sub(0.5).mul(r.blockSwing).add(1))
  const head = U.x.div(length_).add(hash(row, float(1), r.seed + 5.1))
  const headM = fract(head).sub(0.5).abs().sub(0.5).abs().mul(length_)
  // A bed joint is a line in U.y and a head joint a line in U.x, so each is
  // filtered on its own axis. One shared pixel is what made the courses break
  // into a stipple where the wall runs away from the eye.
  const dx = U.dFdx(),
    dy = U.dFdy()
  const acrossCourses = opts.pixel ?? vec2(dx.y, dy.y).length().max(0.00002)
  const alongCourses = opts.pixel ?? vec2(dx.x, dy.x).length().max(0.00002)
  // The joint's own wander is noise: it may only be added where its own
  // wavelength is resolved, or it jitters the line by a pixel per pixel.
  const wanderHeld = smoothstep(2, 5, float(0.137).div(alongCourses.max(acrossCourses)))
  const wander = mx_noise_float(vec2(U.x.mul(7.3), U.y.mul(11.7))).mul(r.wanderM).mul(wanderHeld)
  const bedHeld = smoothstep(1.3, 2.8, float(r.courseM).div(acrossCourses))
  const headHeld = smoothstep(1.3, 2.8, length_.div(alongCourses))
  // A joint narrower than the pixel fades back into the wall, never into a
  // half-covered grey across the whole face.
  const line = (distance: N, pixel: N, held: N): N =>
    float(1)
      .sub(
        smoothstep(
          float(r.jointM * 0.5).sub(pixel).max(0),
          float(r.jointM * 0.5).add(pixel),
          distance
        )
      )
      .mul(held)
  const joint = line(bedM.add(wander).max(0), acrossCourses, bedHeld).max(
    line(headM.add(wander).max(0), alongCourses, headHeld)
  )
  const column = floor(head)
  // Where the heads compress under a pixel the block tone would alias, so the
  // surface keeps the coarser thing a raking eye actually sees: course to
  // course drift rather than stone to stone.
  const blockTone = hash(row, column, r.seed + 11.3)
    .sub(0.5)
    .mul(2 * (r.blockFaceSwing ?? r.faceSwing))
  const courseTone = hash(row, float(2), r.seed + 3.9)
    .sub(0.5)
    .mul(1.2 * r.faceSwing)
  const face = mix(courseTone.mul(bedHeld), blockTone, headHeld)
  // The arris of a hand-dressed block is never quite sharp.
  const arris = smoothstep(r.jointM * 0.5, r.jointM * 2.6, bedM.min(headM).add(wander).max(0))
  return {
    tone: float(1).add(face).sub(mix(float(0.035), float(0), arris).mul(bedHeld.max(headHeld))),
    joint,
    depthM: joint.mul(-r.jointM * 0.22),
    cell: hash(row, column, r.seed + 7.7),
    held: bedHeld.max(headHeld),
  }
}

/**
 * A height field in metres, laid onto a surface as a normal. The gradient is
 * taken in view space, which is the one frame a hand-written material always
 * has, and bounded: relief invented at one scale may tilt a surface, never
 * turn it over.
 */
export function reliefNormal(base: N, heightM: N, maxSlope = 0.2): N {
  const height = heightM.toVar()
  const sx = positionView.dFdx(),
    sy = positionView.dFdy()
  const rx = sy.cross(base),
    ry = base.cross(sx),
    det = sx.dot(rx)
  const gradient = rx
    .mul(height.dFdx())
    .add(ry.mul(height.dFdy()))
    .mul(det.sign())
    .div(det.abs().max(1e-10))
    .toVar()
  return base.sub(gradient.div(length(gradient).div(maxSlope).max(1))).normalize()
}

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
  /** what thins each scale. `distance` thins the whole helper between the two
      `fade` metres, which is what every caller in the museum reads today.
      `footprint` gates each scale on the pixel that covers it and leaves the
      distance term as the hand-off to the air alone. */
  filter?: 'distance' | 'footprint'
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
  const P = opts.at ?? positionWorld
  const footprint = opts.filter === 'footprint' ? anisotropicFootprint(P).toVar() : null
  /* WHERE THE PIXEL DECIDES, THE DISTANCE HAS ONE JOB LEFT: to give the
     surface to the air at the far end. So it begins where the museum's own
     fade ends (46 m of the set's own falloff) and runs to 140, and every
     scale between here and there is thinned by what the pixel can hold
     instead of by how far away it is. */
  const fade =
    opts.fade ??
    (footprint ? [46 * set.falloff, 140 * set.falloff] : [12 * set.falloff, 46 * set.falloff])

  /* THE MID BAND'S OWN LAW. A mid feature coarser than the photograph it
     stands on does not sit under the material, it replaces it: a 10 cm cloud
     over a 3 mm weave IS the surface. So the band is only laid where the
     set's own tile is at least twice the mid feature, and where it is not,
     both halves of it go (the procedural relief and the second read of the
     map at a fifth of the size). */
  const weave = Math.min(set.scale[0], set.scale[1])
  const midBand = count >= 2 && s[1] > 0 && s[1] <= weave * 0.5
  const midAmt = midBand ? (opts.mid ?? 1) : 0

  const d = length(P.sub(cameraPosition))
  const density = clamp(float(1).sub(smoothstep(fade[0], fade[1], d)), 0, 1)
  /** what survives at this pixel of a feature this size, under the air */
  const held = (metres: number): N =>
    footprint ? density.mul(resolved(metres, footprint)) : density
  const heldMacro = held(s[0]).toVar()
  const heldMid = held(midBand ? s[1] : 1).toVar()
  const heldMicro = held(s[2]).toVar()

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
  const value = float(1).add(macro.sub(0.5).mul(2).mul(heldMacro).mul(macroAmt * 0.22))
  let albedo: N = mix(vec3(1, 1, 1), hue, macro.mul(heldMacro).mul(macroAmt * 0.3)).mul(value)

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
  const relief = midBand ? heldMid.mul(midAmt * set.normalStrength * scatter) : float(0)
  let normal: N = normalize(vec3(dx.mul(relief), dz.mul(relief), float(1)))

  // 3 · micro: not visible as shape, only as the way the light sits
  const micro =
    count >= 3
      ? mx_noise_float(P.div(s[2])).mul(0.5).add(0.5).sub(0.5).mul(heldMicro).mul(microAmt * 0.22)
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
    const g = grainNodes(set.grain, set.place(where), held(set.grain.pitch), count)
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
