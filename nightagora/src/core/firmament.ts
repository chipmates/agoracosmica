/* THE FIRMAMENT — the night's standard stars, second organ by the rule
   of two (eclipse night + camp dusk + His Sky all raise it). Ported
   from concept 01's star shader, then taught to be a SKY rather than a
   texture (2026-07-21, live with the founder):

   - THE RIVER OF ALL THOUGHT: a Milky Way band crossing the dome — a
     dense faint river of dust with a soft nebular haze, the one
     structure the whole field composes around. It carries the two
     things that make a river read as DEPTH instead of a smear: star
     clouds where the dust piles up, and a great rift of dark cutting
     through them.
   - CLUSTERS AND VOIDS: real stars clump and leave pools of dark;
     uniform random is what makes a sky feel generated. The pools have
     a falloff, because a hole with an edge reads as a hole.
   - THE MAGNITUDE LAW: brightness follows a power law. Most stars are
     faint, a few are not, and that ratio is most of what separates an
     observed sky from a generated one.
   - THE PROFILE OF A POINT OF LIGHT: a star is a tight core inside a
     soft skirt, never a flat pellet. A star too small to hold a sharp
     core gets a softer one, because a one-pixel core misses the
     fragment centres and the whole sky crawls as it turns.
   - THE TWINKLE LAW: scintillation is AIR. Only the small sharp stars
     carry it, it dies toward the zenith where the light passes through
     least air, and it runs on two rates that never line up so it never
     reads as a metronome.
   - HEROES: a handful of brighter anchors with a four-ray glint, two
     or three of them the rare earned gold. Their quad is oversized so
     the rays have somewhere to go, and the fragment divides the same
     factor back out of the core.
   - HORIZON EXTINCTION: stars dim and warm toward the horizon, light
     through more air.
   - SHOOTING STARS: a brief beaded streak every minute or so,
     deterministically scheduled from the scene clock (the rig sees
     the same night twice); still under reduced motion.
   - ENERGY CONSERVATION: a defocused star spreads the same light over
     a bigger disc — size buys transparency, never snowfall. The near
     shell pays twice: a bright blur is a smudge on the lens.
   - THE GLASS: sizeNode is logical pixels, so the same star covers
     four times the frame on a phone. The field scales with the glass
     or the bokeh shell turns the phone sky into weather.

   Rendered as ONE instanced Sprite: sized Points do not render in
   this pipeline (three's own law: WebGPU point primitives are 1px and
   sizeNode is ignored on Points).

   Organ law (Bible Law 25): the world hands the firmament its shells,
   its seeded hand, and its master every frame; the organ never owns
   the light. Time is a uniform, never a wall clock. */

import {
  AdditiveBlending,
  Color,
  Group,
  InstancedBufferAttribute,
  PointsNodeMaterial,
  Sprite,
} from 'three/webgpu'
import {
  abs,
  clamp,
  float,
  instancedBufferAttribute,
  length,
  min,
  mix,
  normalize,
  oneMinus,
  positionView,
  pow,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl'

/* the TSL runtime swizzles and chains attribute nodes fine; the generated
   typings do not follow — the same boundary escape the mandala's fbm uses */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

/* THE TEMPERATURE RAMP — a continuous run from blue-white through the
   sun's trace of warmth to an amber giant, plus the rare earned gold.
   Colour at this scale is a whisper: every one of these is within a
   breath of white on purpose, and the ramp is weighted so most of the
   sky sits at the cool end where the night's navy lives. */
const STAR_HOT = new Color('#c2d6ff')
const STAR_PALE = new Color('#dce7ff')
const STAR_SUN = new Color('#fff2dc')
const STAR_EMBER = new Color('#ffcda0')
const STAR_GOLD = new Color('#e6bc5c')

const TAU = Math.PI * 2

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export interface FirmamentOptions {
  /** total stars across all populations (field, band, haze, heroes) */
  count: number
  /** far shell radii [min, max] — the body of the field */
  far: [number, number]
  /** near shell radii [min, max] — the bokeh discs */
  near: [number, number]
  /** 'seated' gathers a third of the field low, where the seated eye
      lives between the columns; 'zenith' spreads the upper sky only */
  bias: 'seated' | 'zenith'
  /** the world's seeded hand (determinism law) */
  rand(): number
  /** hero anchors with the four-ray glint (default 10) */
  heroes?: number
  /** shooting stars (default true; always off under reduced motion) */
  meteors?: boolean
  /** the lowest elevation a star may be seeded at, as sin(altitude).
      A world with GROUND under the eye needs this: the camp's planet
      curves away faster than the sky does, so a star seeded a few degrees
      below the horizon ends up hanging over the far tents instead of
      being occluded by them. Default -0.2, the open sky. */
  floor?: number
}

export interface Firmament {
  /** the whole sky: the instanced field + the meteor trail */
  points: Group
  /** master scales every star (the world's light, 0..1); streak is the
      travel squeeze (0 round stars, 1 full engraving hatch) */
  update(elapsed: number, master: number, streak?: number): void
}

type Vec3Tuple = [number, number, number]

function dirFrom(y: number, th: number): Vec3Tuple {
  const clamped = Math.max(-1, Math.min(1, y))
  const ph = Math.acos(clamped)
  return [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]
}

function dot3(a: Vec3Tuple, b: Vec3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross3(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function norm3(v: Vec3Tuple): Vec3Tuple {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

/** a point on the river: the band's own two axes, tilted off its plane */
function onBand(e1: Vec3Tuple, e2: Vec3Tuple, n: Vec3Tuple, phi: number, off: number): Vec3Tuple {
  const c = Math.cos(phi)
  const s = Math.sin(phi)
  return norm3([
    e1[0] * c + e2[0] * s + n[0] * off,
    e1[1] * c + e2[1] * s + n[1] * off,
    e1[2] * c + e2[2] * s + n[2] * off,
  ])
}

/** the short way round the circle, for the band's clouds and its rift */
function angGap(a: number, b: number): number {
  return Math.abs((((a - b) % TAU) + TAU + Math.PI) % TAU - Math.PI)
}

/** a tiny deterministic hash for the meteor almanac (never Math.random) */
function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** the ramp, sampled: most of the sky at the cool end, amber giants rare */
function temperature(u: number): Color {
  if (u < 0.58) return STAR_HOT.clone().lerp(STAR_PALE, u / 0.58)
  if (u < 0.88) return STAR_PALE.clone().lerp(STAR_SUN, (u - 0.58) / 0.3)
  return STAR_SUN.clone().lerp(STAR_EMBER, (u - 0.88) / 0.12)
}

/** THE SCOTOPIC LAW — the eye reads faint light without colour, because
    the rods carry no hue. A star keeps its tint only as far as it is
    bright enough to wake the cones. Without this the river of dust is
    coloured confetti instead of silver. */
function scotopic(c: Color, keep: number): Color {
  const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722
  const k = Math.min(1, Math.max(0, keep))
  return new Color(c.r * k + l * (1 - k), c.g * k + l * (1 - k), c.b * k + l * (1 - k))
}

/** the glass the sky is seen through: a phone frame is a third of a
    desktop's width, and sizeNode is logical pixels, so the same star owns
    four times the frame there. The square root keeps the shrink honest
    rather than erasing the near shell entirely. */
function glassScale(): number {
  if (typeof window === 'undefined') return 1
  const w = window.innerWidth || 900
  return Math.max(0.68, Math.min(1, Math.sqrt(w / 900)))
}

export function createFirmament(opts: FirmamentOptions): Firmament {
  const { count, rand } = opts
  const heroCount = Math.min(opts.heroes ?? 10, 14)
  // the populations split the one budget: two fifths of the sky belongs
  // to the river, because a band has to be DENSER than the field around
  // it or it is not a band. The haze is a whisper, the heroes a handful.
  const hazeCount = Math.max(28, Math.round(count * 0.06))
  const bandCount = Math.round(count * 0.4)
  const fieldCount = Math.max(0, count - heroCount - hazeCount - bandCount)

  const floor = opts.floor ?? -0.2
  const sampleY = (): number =>
    Math.max(
      floor,
      opts.bias === 'seated'
        ? rand() < 1 / 3
          ? 0.03 + rand() * 0.33
          : -0.35 + rand() * 1.35
        : -0.2 + rand() * 1.2
    )

  // THE RIVER: one great circle, tilted so it crosses the sky on the
  // diagonal. Its plane normal leans 20..35 degrees off the horizon, and
  // two axes in that plane let a star be placed ALONG the river and
  // nudged off it, which is what gives the band a soft edge.
  const bandAz = rand() * TAU
  const bandEl = 0.35 + rand() * 0.26
  const bandN = dirFrom(Math.sin(bandEl), bandAz)
  const bandE1 = norm3(cross3(bandN, [0, 1, 0]))
  const bandE2 = norm3(cross3(bandN, bandE1))

  // THE STAR CLOUDS: three places along the river where the dust piles
  // up. Density, not brightness, is what makes a cloud read.
  const clouds = [0, 1, 2].map(() => ({
    at: rand() * TAU,
    w: 0.42 + rand() * 0.4,
    gain: 0.9 + rand() * 1.1,
  }))
  const cloudPeak = clouds.reduce((s, c) => s + c.gain, 1)
  const cloudAt = (phi: number): number => {
    let k = 1
    for (const c of clouds) {
      const g = angGap(phi, c.at) / c.w
      k += c.gain * Math.exp(-g * g * 0.5)
    }
    return k
  }

  // THE GREAT RIFT: a lane of cold dust in front of the river, blocking
  // the light behind it. A Milky Way without one is a smear; the dark is
  // what turns the band into something with a near side and a far side.
  const riftAt = rand() * TAU
  const riftSpan = 1.7 + rand() * 1.3
  const riftPh = rand() * TAU
  const riftDeep = 0.05 + rand() * 0.03
  const riftAxis = (phi: number): number => 0.05 * Math.sin(phi * 1.7 + riftPh) - 0.012
  const riftHalf = (phi: number): number => {
    const t = 1 - Math.min(1, angGap(phi, riftAt) / riftSpan)
    if (t <= 0) return 0
    return riftDeep * t * t * (0.62 + 0.38 * Math.sin(phi * 3.1 + riftPh))
  }

  // CLUSTERS: a dozen loose gatherings seeded from the same bias
  const clusters: Array<{ y: number; th: number }> = []
  for (let i = 0; i < 12; i++) clusters.push({ y: sampleY(), th: rand() * TAU })

  // VOIDS: five pools of deliberate dark. They thin toward their middle
  // instead of ending on an edge, because a hole with a rim reads as a
  // hole and not as depth.
  const voids: Vec3Tuple[] = []
  for (let i = 0; i < 5; i++) voids.push(dirFrom(sampleY(), rand() * TAU))
  const voidLight = (d: Vec3Tuple): number => {
    let k = 1
    for (const v of voids) {
      const c = dot3(d, v)
      if (c > 0.962) k = Math.min(k, Math.max(0, (0.99 - c) / 0.028))
    }
    return k
  }
  const survives = (d: Vec3Tuple): boolean => rand() < voidLight(d)

  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const tw = new Float32Array(count * 2)
  const hero = new Float32Array(count)
  // 0 a point of light, 1 a defocused disc (the near shell), 2 the river's
  // own wash, which is allowed to be far bigger and has to be far fainter
  const shape = new Float32Array(count)
  {
    let i = 0
    const put = (
      d: Vec3Tuple,
      r: number,
      tint: Color,
      dim: number,
      aSize: number,
      isHero: number,
      isDisc = 0
    ): void => {
      if (i >= count) return
      pos[i * 3] = d[0] * r
      pos[i * 3 + 1] = d[1] * r
      pos[i * 3 + 2] = d[2] * r
      col[i * 3] = tint.r * dim
      col[i * 3 + 1] = tint.g * dim
      col[i * 3 + 2] = tint.b * dim
      size[i] = aSize
      tw[i * 2] = 0.5 + rand() * 1.3
      tw[i * 2 + 1] = rand() * TAU
      hero[i] = isHero
      shape[i] = isDisc
      i++
    }

    // 1 · THE FIELD — clustered, void-respecting, with one star in
    // fourteen hung on the near shell as the sky's bokeh
    let k = 0
    while (k < fieldCount) {
      let d = dirFrom(sampleY(), rand() * TAU)
      // roughly half the field gathers at the clusters
      if (rand() < 0.45) {
        const c = clusters[Math.floor(rand() * clusters.length)]
        if (c) d = dirFrom(c.y + (rand() - 0.5) * 0.16, c.th + (rand() - 0.5) * 0.32)
      }
      for (let t = 0; t < 3 && !survives(d); t++) d = dirFrom(sampleY(), rand() * TAU)
      const isNear = k % 14 === 0
      // THE MAGNITUDE LAW: a power law, so the sky has a few real stars
      // in it and a great many faint ones, which is the ratio the eye
      // reads as "observed" rather than "generated"
      const mag = Math.pow(rand(), 2.3)
      if (isNear) {
        // the near shell: the depth cue, and nothing more than that. Cool,
        // small for a disc, and never gold — a gold blur is a lens smudge.
        // It is the faintest population in the sky on purpose: spread light
        // that reads as bright reads as a dirty lens.
        const r = opts.near[0] + rand() * (opts.near[1] - opts.near[0])
        const tint = scotopic(temperature(rand() * 0.25), 0.9)
        put(d, r, tint, 0.085 + mag * 0.09, 0.46 + rand() * 0.8, 0, 1)
        k += 1
        continue
      }
      const r = opts.far[0] + rand() * (opts.far[1] - opts.far[0])
      const gold = rand() < 0.055 && mag > 0.3
      const tint = gold ? STAR_GOLD : scotopic(temperature(rand()), 0.35 + mag * 0.65)
      put(d, r, tint, 0.42 + mag * 0.85, 0.7 + mag * 2.0, 0)
      k += 1
      // A VISUAL DOUBLE: a companion a few pixels off, the cooler of the
      // pair against the warmer. Nobody sees it from across the room, and
      // that is the point — the sky has to reward being looked at.
      if (rand() < 0.045 && k < fieldCount) {
        const e = norm3(cross3(d, [0, 1, 0]))
        const f = cross3(d, e)
        const sep = 0.003 + rand() * 0.004
        const ang = rand() * TAU
        const c1 = Math.cos(ang) * sep
        const c2 = Math.sin(ang) * sep
        const dd = norm3([
          d[0] + e[0] * c1 + f[0] * c2,
          d[1] + e[1] * c1 + f[1] * c2,
          d[2] + e[2] * c1 + f[2] * c2,
        ])
        const mate = gold ? scotopic(STAR_HOT, 0.6) : scotopic(temperature(0.94), 0.7)
        put(dd, r, mate, 0.22 + mag * 0.4, 0.5 + mag * 1.1, 0)
        k += 1
      }
    }

    // 2 · THE RIVER — dust along the band, piled at the clouds, eaten by
    // the rift, thinning off the plane instead of stopping at an edge
    for (let b = 0; b < bandCount; b++) {
      let d: Vec3Tuple | null = null
      let dens = 1
      for (let t = 0; t < 10; t++) {
        const phi = rand() * TAU
        dens = cloudAt(phi)
        if (rand() > dens / cloudPeak) continue
        // the spine holds most of the dust, with a soft tail out to the banks
        const off = Math.pow(rand(), 1.9) * 0.3 * (rand() < 0.5 ? -1 : 1)
        if (Math.abs(off - riftAxis(phi)) < riftHalf(phi)) continue
        const cand = onBand(bandE1, bandE2, bandN, phi, off)
        if (cand[1] < -0.14) continue
        if (!survives(cand)) continue
        d = cand
        break
      }
      if (!d) continue // the budget forgives; the tail slots stay silent
      const r = opts.far[0] + rand() * (opts.far[1] - opts.far[0])
      const mag = Math.pow(rand(), 2.7)
      // river dust is unresolved light: it keeps almost no colour at all
      const tint = scotopic(temperature(rand() * 0.8), 0.12 + mag * 0.3)
      const lift = (dens - 1) / cloudPeak
      put(d, r, tint, 0.26 + mag * 0.5 + lift * 0.16, 0.45 + mag * 1.05, 0)
    }

    // 3 · THE HAZE — the river's own light. This is the population that
    // makes a Milky Way VISIBLE: not the dust grains, which are too small
    // to read one at a time, but the unresolved glow they add up to. It
    // runs the whole spine, thickens at the clouds, and every disc is wide
    // enough that its neighbours melt into it.
    for (let h = 0; h < hazeCount; h++) {
      let phi = rand() * TAU
      for (let t = 0; t < 6; t++) {
        const cand = rand() * TAU
        if (rand() < cloudAt(cand) / cloudPeak) {
          phi = cand
          break
        }
      }
      const off = Math.pow(rand(), 1.4) * 0.2 * (rand() < 0.5 ? -1 : 1)
      if (Math.abs(off - riftAxis(phi)) < riftHalf(phi) * 0.8) continue
      const d = onBand(bandE1, bandE2, bandN, phi, off)
      if (d[1] < -0.08) continue
      const r = opts.far[0] + rand() * (opts.far[1] - opts.far[0]) * 0.7
      // 38..84 logical px, and faint enough that ONE of them is at the
      // edge of being seen. The wash is what a dozen of them make together,
      // never what one of them is (round 2 shipped grey cotton balls).
      const aSize = ((38 + rand() * 46) * r) / 450
      const tint = scotopic(temperature(rand() * 0.6), 0.2)
      put(d, r, tint, 0.09 + rand() * 0.1 + (cloudAt(phi) - 1) * 0.07, aSize, 0, 2)
    }

    // 4 · THE HEROES — anchors of the composition, glint-crowned;
    // roughly a quarter carry the rare earned gold
    for (let h = 0; h < heroCount; h++) {
      let d = dirFrom(sampleY(), rand() * TAU)
      for (let t = 0; t < 3 && !survives(d); t++) d = dirFrom(sampleY(), rand() * TAU)
      const r = opts.far[0] + rand() * (opts.far[1] - opts.far[0]) * 0.5
      // locked screen presence: a 5..7 px core, and the shader hands it a
      // quad two and a half times that so the four rays have room to run
      const aSize = ((5.2 + rand() * 1.9) * r) / 450
      const tint = rand() < 0.26 ? STAR_GOLD : scotopic(temperature(rand() * 0.4), 0.9)
      put(d, r, tint, 1, aSize, 1)
    }

    // the band's rift and the voids leave silent tail slots: park them
    // straight down at zero colour and zero size. A parked star at the
    // origin is a normalize(0) waiting to become a NaN.
    while (i < count) put([0, -1, 0], opts.far[0], STAR_HOT, 0, 0, 0)
  }
  const aPos = new InstancedBufferAttribute(pos, 3)
  const aCol = new InstancedBufferAttribute(col, 3)
  const aSize = new InstancedBufferAttribute(size, 1)
  const aTw = new InstancedBufferAttribute(tw, 2)
  const aHero = new InstancedBufferAttribute(hero, 1)
  const aShape = new InstancedBufferAttribute(shape, 1)

  const uT = uniform(0)
  const uMaster = uniform(0)
  const uStreak = uniform(0)
  const uGlass = uniform(glassScale())
  const mat = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  const posN = instancedBufferAttribute(aPos)
  mat.positionNode = posN
  mat.sizeAttenuation = false
  const aSizeN = instancedBufferAttribute(aSize) as N
  const twN = instancedBufferAttribute(aTw) as N
  const heroN = instancedBufferAttribute(aHero) as N
  const shapeN = instancedBufferAttribute(aShape) as N
  const colN = instancedBufferAttribute(aCol) as N

  // the two flags the shape attribute carries: everything defocused, and
  // the river's wash alone
  const discF = min(shapeN, float(1))
  const hazeF = shapeN.sub(1).max(0)

  // A STAR'S OWN SIZE: what this point of light measures on the glass.
  // sizeNode is in logical pixels; the sprite path multiplies by the
  // device ratio itself (screenDPR), so no manual dpr here. The floor is
  // above one pixel on purpose: a half-pixel quad lands between the
  // fragment centres and the whole sky crawls as it turns. The ceiling
  // opens up for the wash, which has to be wide enough that its
  // neighbours melt into it.
  const appSize = clamp(
    aSizeN.mul(uGlass).mul(float(450)).div(positionView.z.negate().max(1)),
    1.4,
    mix(float(26), float(86), hazeF)
  )
  // the hero's quad is oversized so its rays have somewhere to go; the
  // fragment divides the same factor back out of the core
  const quadK = float(1).add(heroN.mul(1.6))
  mat.sizeNode = appSize.mul(quadK).mul(uStreak.mul(2.6).add(1))

  // squeeze x and the round star becomes the travel's vertical streak
  // (sprite quad UVs stand in for the old pointUV)
  const d = uv().sub(vec2(0.5, 0.5))
  const q = vec2(d.x.mul(uStreak.mul(7).add(1)), d.y)
  // 0 at the centre, 1 at the star's OWN edge, whatever its quad
  const rr = min(length(q).mul(2).mul(quadK), float(1))
  const fall = oneMinus(rr)

  // THE PROFILE: a tight core inside a soft skirt. A star too small to
  // hold a sharp core gets a softer one, so the field does not sparkle
  // itself to pieces at the sub-pixel end (pre-filtering, by hand).
  const sharp = smoothstep(float(1.7), float(4.2), appSize)
  const soft = pow(fall, 2.1)
  const tight = pow(fall, 2.7).mul(0.42).add(pow(fall, 9).mul(0.82))
  const point = mix(soft, tight, sharp)
  // A DEFOCUSED STAR HAS NO EDGE. Round 1 gave it one, and eleven flat
  // grey pucks sat on the agora sky like stickers. What a spread point of
  // light actually leaves is a soft ball with the faintest suggestion of
  // a body in the middle, and nothing the eye can find a rim on.
  const disc = pow(fall, 1.25).mul(0.52).add(smoothstep(float(1.0), float(0.55), rr).mul(0.1))
  // and the river's wash has no body at all: only a falling off
  const wash = pow(fall, 2.2)
  const kernel = mix(point, mix(disc, wash, hazeF), discF)

  // THE GLINT: four rays for the heroes alone, tapering to a point, with
  // the small aureole that air scatters around anything truly bright
  const ax = abs(q.x)
  const ay = abs(q.y)
  const ray = (along: N, across: N): N => {
    const reach = pow(smoothstep(float(0.5), float(0.0), along), 1.8)
    const wide = float(0.05).mul(oneMinus(along.mul(1.35))).max(0.005)
    return reach.mul(smoothstep(wide, float(0), across))
  }
  const glint = ray(ax, ay).add(ray(ay, ax)).mul(0.46).mul(heroN)
  const halo = pow(oneMinus(min(length(q).mul(2), float(1))), 2.6).mul(0.14).mul(heroN)

  const starDir = normalize(posN as N)
  // HORIZON EXTINCTION: light through more air, dimmer and warmer
  const airMass = smoothstep(0.3, -0.05, starDir.y)
  const ext = mix(float(1), float(0.34), airMass)

  // SCINTILLATION IS AIR: the small sharp stars carry it, the defocused
  // shell and the anchors burn steady, and it fades toward the zenith
  // where the light has the least air to cross. Two rates that never
  // line up keep it from reading as a pulse.
  const calm = reducedMotion ? 0 : 1
  const air = smoothstep(0.55, -0.02, starDir.y)
  const steady = oneMinus(discF).mul(oneMinus(heroN.mul(0.78)))
  const flutter = sin(uT.mul(twN.x).add(twN.y))
    .mul(0.64)
    .add(sin(uT.mul(twN.x.mul(2.37)).add(twN.y.mul(1.7))).mul(0.36))
  const amp = steady.mul(float(0.05).add(air.mul(0.21))).mul(calm)
  const twinkle = oneMinus(flutter.mul(0.5).add(0.5).mul(amp))

  // the air is a prism as well as a veil: a low star swings a hair warm
  // as it flutters, which is the part that reads as atmosphere
  const sway: N = flutter.mul(amp).mul(0.6)
  mat.colorNode = colN
    .mul(mix(vec3(1, 1, 1), vec3(1.07, 0.9, 0.71), airMass.mul(0.75)))
    .mul(vec3(float(1).add(sway), float(1), float(1).sub(sway)))

  // ENERGY CONSERVATION: size buys transparency, and the defocused shell
  // pays twice, because a bright blur is a smudge on the lens and never
  // a star. Heroes are exempt — an anchor must anchor.
  const energy = mix(
    clamp(float(6.5).div(appSize), 0.13, 1)
      .mul(mix(float(1), float(0.62), discF))
      .mul(mix(float(1), float(0.55), hazeF)),
    float(1),
    heroN
  )
  // 0.76, not 0.95: the field serves the composition (the founder, live:
  // "dim them 20 percent more" — the sky is choir, never soloist)
  mat.opacityNode = kernel
    .add(glint)
    .add(halo)
    .mul(twinkle)
    .mul(0.76)
    .mul(energy)
    .mul(ext)
    .mul(uMaster)

  const field = new Sprite(mat)
  field.count = count
  field.frustumCulled = false

  // ---- THE SHOOTING STAR: a beaded streak on a deterministic almanac ----
  const TRAIL = 26
  const wantMeteors = (opts.meteors ?? true) && !reducedMotion
  const mPos = new Float32Array(TRAIL * 3)
  const mFade = new Float32Array(TRAIL)
  for (let k = 0; k < TRAIL; k++) mFade[k] = 1 - k / TRAIL
  const mPosAttr = new InstancedBufferAttribute(mPos, 3)
  const mFadeAttr = new InstancedBufferAttribute(mFade, 1)
  const uMeteor = uniform(0)
  const uFire = uniform(1)
  const mMat = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  mMat.positionNode = instancedBufferAttribute(mPosAttr)
  mMat.sizeAttenuation = false
  const fadeN = instancedBufferAttribute(mFadeAttr) as N
  // the tail never thins below a pixel and a half: a bead that small
  // leaves gaps, and a shooting star with gaps in it is a dotted rule
  mMat.sizeNode = pow(fadeN, 1.4).mul(float(5.2).mul(uFire)).add(1.5).mul(uGlass)
  // the head burns white with the day's warmth still in it, the train
  // behind it cools to the same ice the field is made of
  mMat.colorNode = mix(vec3(0.62, 0.7, 0.9), vec3(1, 0.96, 0.86), pow(fadeN, 1.7))
  const md = uv().sub(vec2(0.5, 0.5))
  const mr = min(length(md).mul(2), float(1))
  mMat.opacityNode = pow(oneMinus(mr), 2.2)
    .mul(0.5)
    .add(pow(oneMinus(mr), 8).mul(0.7))
    .mul(pow(fadeN, 1.5))
    .mul(uMeteor)
  const meteor = new Sprite(mMat)
  meteor.count = TRAIL
  meteor.frustumCulled = false
  meteor.visible = false

  const METEOR_PERIOD = 52 // one falls roughly every minute
  const meteorR = (opts.far[0] + opts.far[1]) / 2

  const points = new Group()
  points.add(field)
  points.add(meteor)

  function updateMeteor(elapsed: number, master: number): void {
    if (!wantMeteors || master < 0.5) {
      meteor.visible = false
      uMeteor.value = 0
      return
    }
    const cycle = Math.floor(elapsed / METEOR_PERIOD)
    const tIn = elapsed - cycle * METEOR_PERIOD
    const tStart = 4 + hash1(cycle) * (METEOR_PERIOD - 12)
    // once in a while the almanac hands over a fireball: slower, longer,
    // and bright enough to be the thing you tell someone about
    const fire = hash1(cycle + 0.13) < 0.17
    const flight = fire ? 1.3 : 0.85
    const p = (tIn - tStart) / flight
    if (p <= 0 || p >= 1) {
      meteor.visible = false
      uMeteor.value = 0
      return
    }
    // the almanac. Every camera in this night sits low: the agora looks
    // out level, the camp looks DOWN off its vista, so a sky of thirty
    // degrees is all any of them can see. A meteor written above that
    // band falls where nobody is standing (round 4 shot it four times
    // before the arithmetic gave it up). So it starts at twelve to
    // thirty degrees and falls into the murk from there.
    const y0 = 0.21 + hash1(cycle + 0.31) * 0.29
    const th0 = hash1(cycle + 0.57) * TAU
    const dy = -(0.13 + hash1(cycle + 0.73) * 0.3)
    const dth = (hash1(cycle + 0.91) - 0.5) * 0.9
    // the beads have to overlap into one line: spaced out, they read as a
    // dotted rule and not as something falling
    const gap = fire ? 0.0046 : 0.0042
    for (let k = 0; k < TRAIL; k++) {
      const pk = Math.max(0, p - k * gap)
      const dir = dirFrom(y0 + dy * pk, th0 + dth * pk)
      mPos[k * 3] = dir[0] * meteorR
      mPos[k * 3 + 1] = dir[1] * meteorR
      mPos[k * 3 + 2] = dir[2] * meteorR
    }
    mPosAttr.needsUpdate = true
    meteor.visible = true
    // struck fast, dying slow, and the air takes the last of it before it
    // ever reaches the ground
    const rise = Math.min(1, p / 0.09)
    const decay = Math.pow(1 - p, 1.25)
    const murk = Math.min(1, Math.max(0, (y0 + dy * p + 0.02) / 0.14))
    uFire.value = fire ? 1.45 : 1
    uMeteor.value = rise * rise * (3 - 2 * rise) * decay * murk * master * (fire ? 1.7 : 1)
  }

  let glassTick = 0
  function update(elapsed: number, master: number, streak = 0): void {
    uT.value = elapsed
    uMaster.value = master
    uStreak.value = streak
    // the glass can change under the sky (a rotated phone, a dragged
    // window); reading it every twentieth frame is enough
    if (glassTick++ % 20 === 0) uGlass.value = glassScale()
    field.visible = master > 0.004
    // the heavens turn at a pace felt only across a whole sitting:
    // faster read as FLOATING on the near bokeh discs (the founder, live)
    points.rotation.y = elapsed * 0.001
    updateMeteor(elapsed, master)
  }

  return { points, update }
}
