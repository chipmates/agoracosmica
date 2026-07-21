/* THE FIRMAMENT — the night's standard stars, second organ by the rule
   of two (eclipse night + camp dusk + His Sky all raise it). Ported
   from concept 01's star shader, then taught to be a SKY rather than a
   texture (2026-07-21, live with Michel):

   - THE RIVER OF ALL THOUGHT: a Milky Way band crossing the dome — a
     dense faint river of dust with a soft nebular haze, the one
     structure the whole field composes around.
   - CLUSTERS AND VOIDS: real stars clump and leave pools of dark;
     uniform random is what makes a sky feel generated.
   - THE TWINKLE LAW: only small stars scintillate (atmospheric
     physics); the bokeh discs burn steady.
   - HEROES: a handful of brighter anchors with a four-ray glint, two
     or three of them the rare earned gold.
   - HORIZON EXTINCTION: stars dim and warm toward the horizon, light
     through more air.
   - SHOOTING STARS: a brief beaded streak every minute or so,
     deterministically scheduled from the scene clock (the rig sees
     the same night twice); still under reduced motion.
   - ENERGY CONSERVATION: a defocused star spreads the same light over
     a bigger disc — size buys transparency, never snowfall.

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
  mix,
  normalize,
  positionView,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl'

// star tints ported from concept 01 (three cool blues + rare gold)
const STAR_WARM = new Color('#e6bc5c')
const STAR_COOL = new Color('#b4c8ff')
const STAR_ICE = new Color('#d2ebff')
const STAR_PALE = new Color('#b4d2ff')

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

/** a tiny deterministic hash for the meteor almanac (never Math.random) */
function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function createFirmament(opts: FirmamentOptions): Firmament {
  const { count, rand } = opts
  const heroCount = Math.min(opts.heroes ?? 10, 14)
  // the populations split the one budget: the river is ~a third of
  // the sky, the haze a whisper, the heroes a handful
  const hazeCount = Math.max(24, Math.round(count * 0.04))
  const bandCount = Math.round(count * 0.34)
  const fieldCount = Math.max(0, count - heroCount - hazeCount - bandCount)

  const sampleY = (): number =>
    opts.bias === 'seated'
      ? rand() < 1 / 3
        ? 0.03 + rand() * 0.33
        : -0.35 + rand() * 1.35
      : -0.2 + rand() * 1.2

  // THE RIVER: one great circle, tilted so it crosses the sky on the
  // diagonal. Its plane normal leans 20..35 degrees off the horizon.
  const bandAz = rand() * Math.PI * 2
  const bandEl = 0.35 + rand() * 0.26
  const bandN = dirFrom(Math.sin(bandEl), bandAz)

  // CLUSTERS: a dozen loose gatherings seeded from the same bias
  const clusters: Array<{ y: number; th: number }> = []
  for (let i = 0; i < 12; i++) clusters.push({ y: sampleY(), th: rand() * Math.PI * 2 })

  // VOIDS: five pools of deliberate dark (about ten degrees wide)
  const voids: Vec3Tuple[] = []
  for (let i = 0; i < 5; i++) voids.push(dirFrom(sampleY(), rand() * Math.PI * 2))
  const inVoid = (d: Vec3Tuple): boolean => {
    for (const v of voids) if (dot3(d, v) > 0.985) return true
    return false
  }

  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const tw = new Float32Array(count * 2)
  const hero = new Float32Array(count)
  {
    const TINTS = [STAR_COOL, STAR_ICE, STAR_PALE, STAR_WARM]
    let i = 0
    const put = (
      d: Vec3Tuple,
      r: number,
      tint: Color,
      dim: number,
      aSize: number,
      isHero: number
    ): void => {
      pos[i * 3] = d[0] * r
      pos[i * 3 + 1] = d[1] * r
      pos[i * 3 + 2] = d[2] * r
      col[i * 3] = tint.r * dim
      col[i * 3 + 1] = tint.g * dim
      col[i * 3 + 2] = tint.b * dim
      size[i] = aSize
      tw[i * 2] = 0.4 + rand() * 1.2
      tw[i * 2 + 1] = rand() * Math.PI * 2
      hero[i] = isHero
      i++
    }

    // 1 · THE FIELD — clustered, void-respecting, near shell for bokeh
    for (let k = 0; k < fieldCount; k++) {
      let d = dirFrom(sampleY(), rand() * Math.PI * 2)
      // roughly half the field gathers at the clusters
      if (rand() < 0.45) {
        const c = clusters[Math.floor(rand() * clusters.length)]
        if (c) d = dirFrom(c.y + (rand() - 0.5) * 0.16, c.th + (rand() - 0.5) * 0.32)
      }
      for (let t = 0; t < 3 && inVoid(d); t++) d = dirFrom(sampleY(), rand() * Math.PI * 2)
      const isNear = k % 7 === 0
      const r = isNear
        ? opts.near[0] + rand() * (opts.near[1] - opts.near[0])
        : opts.far[0] + rand() * (opts.far[1] - opts.far[0])
      const goldRoll = rand()
      const tint =
        TINTS[!isNear && goldRoll < 0.085 ? 3 : Math.floor(rand() * 3)] ?? STAR_COOL
      put(d, r, tint, 0.6 + rand() * 0.4, 0.8 + rand() * 1.5, 0)
    }

    // 2 · THE RIVER — dense faint dust hugging the band plane
    for (let k = 0; k < bandCount; k++) {
      let d = dirFrom(-0.3 + rand() * 1.3, rand() * Math.PI * 2)
      for (let t = 0; t < 8 && Math.abs(dot3(d, bandN)) > 0.16; t++)
        d = dirFrom(-0.3 + rand() * 1.3, rand() * Math.PI * 2)
      if (inVoid(d)) continue // the dark pools win; the budget forgives
      const r = opts.far[0] + rand() * (opts.far[1] - opts.far[0])
      const tint = (rand() < 0.5 ? STAR_COOL : STAR_PALE) ?? STAR_COOL
      put(d, r, tint, 0.3 + rand() * 0.28, 0.35 + rand() * 0.4, 0)
    }

    // 3 · THE HAZE — a soft nebular wash breathing along the river
    for (let k = 0; k < hazeCount; k++) {
      let d = dirFrom(-0.2 + rand() * 1.2, rand() * Math.PI * 2)
      for (let t = 0; t < 8 && Math.abs(dot3(d, bandN)) > 0.09; t++)
        d = dirFrom(-0.2 + rand() * 1.2, rand() * Math.PI * 2)
      const r = opts.far[0] + rand() * (opts.far[1] - opts.far[0]) * 0.7
      // aSize chosen so the wash holds 8..14 logical px at its distance
      const aSize = ((8 + rand() * 6) * r) / 450
      const tint = (rand() < 0.6 ? STAR_PALE : STAR_ICE) ?? STAR_PALE
      put(d, r, tint, 0.12 + rand() * 0.08, aSize, 0)
    }

    // 4 · THE HEROES — anchors of the composition, glint-crowned;
    // roughly a quarter carry the rare earned gold
    for (let k = 0; k < heroCount; k++) {
      let d = dirFrom(sampleY(), rand() * Math.PI * 2)
      for (let t = 0; t < 3 && inVoid(d); t++) d = dirFrom(sampleY(), rand() * Math.PI * 2)
      const r = opts.far[0] + rand() * (opts.far[1] - opts.far[0]) * 0.5
      // locked screen presence: 9..12 logical px whatever the distance
      const aSize = ((9 + rand() * 3) * r) / 450
      const tint = (rand() < 0.26 ? STAR_WARM : STAR_ICE) ?? STAR_ICE
      put(d, r, tint, 1, aSize, 1)
    }

    // the band's void-skips leave silent tail slots: park them at the
    // origin with zero size (invisible, deterministic, budget-honest)
    while (i < count) put([0, 0, 0], 0.0001, STAR_COOL, 0, 0, 0)
  }
  const aPos = new InstancedBufferAttribute(pos, 3)
  const aCol = new InstancedBufferAttribute(col, 3)
  const aSize = new InstancedBufferAttribute(size, 1)
  const aTw = new InstancedBufferAttribute(tw, 2)
  const aHero = new InstancedBufferAttribute(hero, 1)

  const uT = uniform(0)
  const uMaster = uniform(0)
  const uStreak = uniform(0)
  const mat = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  const posN = instancedBufferAttribute(aPos)
  mat.positionNode = posN
  mat.sizeAttenuation = false
  // the TSL runtime swizzles attribute nodes fine; the generated typings
  // do not follow — the same boundary escape the mandala's fbm uses
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aSizeN = instancedBufferAttribute(aSize) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const twN = instancedBufferAttribute(aTw) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heroN = instancedBufferAttribute(aHero) as any
  // sizeNode is in logical pixels; the sprite path multiplies by the
  // device ratio itself (screenDPR), so no manual dpr here
  const starSize = clamp(
    aSizeN
      .mul(uStreak.mul(2.6).add(1))
      .mul(float(450))
      .div(positionView.z.negate().max(1)),
    0.5,
    16
  )
  mat.sizeNode = starSize
  // THE TWINKLE LAW: scintillation belongs to the small; discs and
  // heroes burn steady with only a 4 percent breath
  const scint = smoothstep(float(6), float(2), starSize).mul(
    float(1).sub(heroN)
  )
  const shimmer = sin(uT.mul(twN.x).add(twN.y)).mul(0.5).add(0.5)
  const twinkle = float(1).sub(shimmer.mul(scint.mul(0.26).add(0.04)))
  // HORIZON EXTINCTION: light through more air, dimmer and warmer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const starDir = normalize(posN as any)
  const airMass = smoothstep(0.28, -0.06, starDir.y)
  const ext = mix(float(1), float(0.42), airMass)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colN = instancedBufferAttribute(aCol) as any
  mat.colorNode = colN.mul(mix(vec3(1, 1, 1), vec3(1.06, 0.9, 0.72), airMass.mul(0.7)))
  // squeeze x and the round star becomes the travel's vertical streak
  // (sprite quad UVs stand in for the old pointUV)
  const d = uv().sub(vec2(0.5, 0.5))
  const kernel = smoothstep(
    0.5,
    0.08,
    length(vec2(d.x.mul(uStreak.mul(7).add(1)), d.y))
  )
  // THE GLINT: a four-ray cross for the heroes alone
  const ax = abs(d.x)
  const ay = abs(d.y)
  const spikeH = smoothstep(0.5, 0.02, ax).mul(smoothstep(0.05, 0.0, ay))
  const spikeV = smoothstep(0.5, 0.02, ay).mul(smoothstep(0.05, 0.0, ax))
  const glint = spikeH.add(spikeV).mul(0.5).mul(heroN)
  // ENERGY CONSERVATION: size buys transparency (heroes are exempt —
  // an anchor must anchor)
  const energy = mix(clamp(float(7).div(starSize), 0.16, 1), float(1), heroN)
  // 0.76, not 0.95: the field serves the composition (Michel, live:
  // "dim them 20 percent more" — the sky is choir, never soloist)
  mat.opacityNode = kernel
    .add(glint)
    .mul(twinkle)
    .mul(0.76)
    .mul(energy)
    .mul(ext)
    .mul(uMaster)

  const field = new Sprite(mat)
  field.count = count
  field.frustumCulled = false

  // ---- THE SHOOTING STAR: a beaded streak on a deterministic almanac ----
  const TRAIL = 8
  const wantMeteors = (opts.meteors ?? true) && !reducedMotion
  const mPos = new Float32Array(TRAIL * 3)
  const mFade = new Float32Array(TRAIL)
  for (let k = 0; k < TRAIL; k++) mFade[k] = 1 - k / TRAIL
  const mPosAttr = new InstancedBufferAttribute(mPos, 3)
  const mFadeAttr = new InstancedBufferAttribute(mFade, 1)
  const uMeteor = uniform(0)
  const mMat = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  mMat.positionNode = instancedBufferAttribute(mPosAttr)
  mMat.sizeAttenuation = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fadeN = instancedBufferAttribute(mFadeAttr) as any
  mMat.sizeNode = fadeN.mul(3.4).add(1.2)
  mMat.colorNode = vec3(0.95, 0.93, 0.85)
  const md = uv().sub(vec2(0.5, 0.5))
  mMat.opacityNode = smoothstep(0.5, 0.06, length(md))
    .mul(fadeN)
    .mul(uMeteor)
  const meteor = new Sprite(mMat)
  meteor.count = TRAIL
  meteor.frustumCulled = false
  meteor.visible = false

  const METEOR_PERIOD = 52 // one falls roughly every minute
  const METEOR_FLIGHT = 0.85
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
    const p = (tIn - tStart) / METEOR_FLIGHT
    if (p <= 0 || p >= 1) {
      meteor.visible = false
      uMeteor.value = 0
      return
    }
    // the almanac: start high, fall shallowly across ~25 degrees
    const y0 = 0.45 + hash1(cycle + 0.31) * 0.4
    const th0 = hash1(cycle + 0.57) * Math.PI * 2
    const dy = -(0.16 + hash1(cycle + 0.73) * 0.14)
    const dth = (hash1(cycle + 0.91) - 0.5) * 0.9
    for (let k = 0; k < TRAIL; k++) {
      const pk = Math.max(0, p - k * 0.022)
      const dir = dirFrom(y0 + dy * pk, th0 + dth * pk)
      mPos[k * 3] = dir[0] * meteorR
      mPos[k * 3 + 1] = dir[1] * meteorR
      mPos[k * 3 + 2] = dir[2] * meteorR
    }
    mPosAttr.needsUpdate = true
    meteor.visible = true
    uMeteor.value = Math.sin(p * Math.PI) * master
  }

  function update(elapsed: number, master: number, streak = 0): void {
    uT.value = elapsed
    uMaster.value = master
    uStreak.value = streak
    field.visible = master > 0.004
    // the heavens turn at a pace felt only across a whole sitting:
    // faster read as FLOATING on the near bokeh discs (Michel, live)
    points.rotation.y = elapsed * 0.001
    updateMeteor(elapsed, master)
  }

  return { points, update }
}
