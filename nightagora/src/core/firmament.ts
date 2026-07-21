/* THE FIRMAMENT — the night's standard stars, second organ by the rule
   of two (eclipse night + camp dusk + His Sky all raise it). Ported
   from concept 01's star shader and kept mechanically faithful: one
   field, four brand tints (three cool blues, the rare gold), every
   star its own size and twinkle, distance alone deciding apparent
   size, and a soft shader falloff that renders far stars as sharp
   points and near stars as big bokeh discs. One star in six is seeded
   NEAR on purpose: the depth signature the far shells can never give.
   The travel squeeze (uStreak) turns the same stars into the descent's
   engraving hatching.
   Organ law (Bible Law 25): the world hands the firmament its shells,
   its seeded hand, and its master every frame; the organ never owns
   the light. Time is a uniform, never a wall clock (the rig's frozen
   eye must see the same night twice). */

import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Points,
  PointsNodeMaterial,
} from 'three/webgpu'
import {
  attribute,
  clamp,
  float,
  length,
  pointUV,
  positionView,
  sin,
  smoothstep,
  uniform,
  vec2,
} from 'three/tsl'

// star tints ported from concept 01 (three cool blues + rare gold)
const STAR_WARM = new Color('#e6bc5c')
const STAR_COOL = new Color('#b4c8ff')
const STAR_ICE = new Color('#d2ebff')
const STAR_PALE = new Color('#b4d2ff')

export interface FirmamentOptions {
  count: number
  /** far shell radii [min, max] — the body of the field */
  far: [number, number]
  /** near shell radii [min, max] — every sixth star, the bokeh discs */
  near: [number, number]
  /** 'seated' gathers a third of the field low, where the seated eye
      lives between the columns; 'zenith' spreads the upper sky only */
  bias: 'seated' | 'zenith'
  /** the world's seeded hand (determinism law) */
  rand(): number
}

export interface Firmament {
  points: Points
  /** master scales every star (the world's light, 0..1); streak is the
      travel squeeze (0 round stars, 1 full engraving hatch) */
  update(elapsed: number, master: number, streak?: number): void
}

export function createFirmament(opts: FirmamentOptions): Firmament {
  const { count, rand } = opts
  const geo = new BufferGeometry()
  {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const tw = new Float32Array(count * 2)
    const TINTS = [STAR_COOL, STAR_ICE, STAR_PALE, STAR_WARM]
    for (let i = 0; i < count; i++) {
      const r =
        i % 6 === 0
          ? opts.near[0] + rand() * (opts.near[1] - opts.near[0])
          : opts.far[0] + rand() * (opts.far[1] - opts.far[0])
      const th = rand() * Math.PI * 2
      const y =
        opts.bias === 'seated'
          ? i % 3 === 0
            ? 0.03 + rand() * 0.33
            : -0.35 + rand() * 1.35
          : -0.2 + rand() * 1.2
      const ph = Math.acos(Math.max(-1, Math.min(1, y)))
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * r
      pos[i * 3 + 1] = Math.cos(ph) * r
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r
      const tint = TINTS[rand() < 0.085 ? 3 : Math.floor(rand() * 3)] ?? STAR_COOL
      const dim = 0.55 + rand() * 0.45
      col[i * 3] = tint.r * dim
      col[i * 3 + 1] = tint.g * dim
      col[i * 3 + 2] = tint.b * dim
      size[i] = 0.7 + rand() * 1.4
      tw[i * 2] = 0.4 + rand() * 1.2
      tw[i * 2 + 1] = rand() * Math.PI * 2
    }
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    geo.setAttribute('aColor', new Float32BufferAttribute(col, 3))
    geo.setAttribute('aSize', new Float32BufferAttribute(size, 1))
    geo.setAttribute('aTw', new Float32BufferAttribute(tw, 2))
  }

  const uT = uniform(0)
  const uMaster = uniform(0)
  const uStreak = uniform(0)
  const uPx = uniform(Math.min(devicePixelRatio, 2))
  const mat = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  mat.sizeAttenuation = false
  // the TSL runtime swizzles attribute nodes fine; the generated typings
  // do not follow — the same boundary escape the mandala's fbm uses
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aSizeN = attribute('aSize', 'float') as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const twN = attribute('aTw', 'vec2') as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pUV = pointUV as any
  mat.sizeNode = clamp(
    aSizeN
      .mul(uStreak.mul(2.6).add(1))
      .mul(float(900))
      .div(positionView.z.negate().max(1)),
    0.6,
    26
  ).mul(uPx)
  const twinkle = sin(uT.mul(twN.x).add(twN.y)).mul(0.28).add(0.72)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mat.colorNode = attribute('aColor', 'vec3') as any
  // squeeze x and the round star becomes the travel's vertical streak
  const d = pUV.sub(vec2(0.5, 0.5))
  const kernel = smoothstep(
    0.5,
    0.08,
    length(vec2(d.x.mul(uStreak.mul(7).add(1)), d.y))
  )
  mat.opacityNode = kernel.mul(twinkle).mul(0.95).mul(uMaster)

  const points = new Points(geo, mat)
  points.frustumCulled = false

  function update(elapsed: number, master: number, streak = 0): void {
    uT.value = elapsed
    uMaster.value = master
    uStreak.value = streak
    points.visible = master > 0.004
    // the heavens turn, slowly, as the concept's did
    points.rotation.y = elapsed * 0.003
  }

  return { points, update }
}
