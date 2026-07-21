/* Beat 9 · PLANETFALL — Marcus's world: a fortified camp on a small
   dark planet, ember dusk on the Danube. The ground's curved rim gives
   the tiny-planet read; the river carries the last of the light; the
   tents are ink silhouettes that remember the fire on their flanks.
   No Bodies: Marcus is present as the hearth and the voice. One trace
   (Meditations 5.20) is carved at the tent post, marked by a small
   gold star. */

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three/webgpu'
import {
  clamp,
  dot,
  float,
  fract,
  length,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  normalWorld,
  normalize,
  oneMinus,
  pow,
  abs,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  positionWorld,
} from 'three/tsl'
import { mulberry32, FOUNDING_SEED } from '../core/seed'

const GOLD = new Color('#e0b96a')

export interface CampState {
  reveal: number
  elapsed: number
  /** 0..1: how much the world yields the letterpress band (a sitting
      is open); the trace post and its star step back while text holds
      the frame. */
  yield?: number
}

export function createCamp(scene: Scene) {
  const rand = mulberry32(FOUNDING_SEED + 91)
  const root = new Group()
  root.visible = false
  scene.add(root)

  const GROUND_Y = -0.9
  // composed for the postcard too: everything must hold at 390px wide
  const FIRE = { x: -0.75, z: -5.2 }

  const uT = uniform(0)
  const uR = uniform(0)
  const starMats: PointsMaterial[] = []

  const hash = fract(sin(dot(uv().mul(vec2(511.7, 337.3)), vec2(12.9898, 78.233))).mul(43758.5453))
  const dither = hash.sub(0.5).mul(0.016)

  // ------------------------------------------------------------------
  // 1 · THE DUSK — the last ember light low in the sky, night above
  // ------------------------------------------------------------------
  const skyMat = new MeshBasicNodeMaterial()
  {
    // ember dusk, not sunset: the night owns the sky, the smolder owns
    // only the lowest band above the water
    const h = positionWorld.y
    const nightTop = vec3(0.0016, 0.0028, 0.0075)
    const nightMid = vec3(0.0034, 0.005, 0.013)
    const emberLow = vec3(0.045, 0.017, 0.005)
    const emberCore = vec3(0.14, 0.05, 0.011)
    const band = smoothstep(5.0, 0.4, h)
    const core = smoothstep(1.6, -2.0, h)
    // slow drifting smoke strata carved from the glow, never banding
    const strata = mx_noise_float(vec3(positionWorld.x.mul(0.05), h.mul(0.35), uT.mul(0.015)))
      .mul(0.35)
      .add(0.8)
    const col = mix(mix(nightTop, nightMid, band), mix(nightMid, mix(emberLow, emberCore, core), band), band)
    skyMat.colorNode = col.mul(strata).add(dither.mul(0.02)).mul(uR)
  }
  const sky = new Mesh(new PlaneGeometry(170, 70), skyMat)
  sky.position.set(0, 12, -48)
  root.add(sky)

  // sparse high stars over the dusk
  {
    const pos: number[] = []
    for (let i = 0; i < 70; i++) {
      pos.push((rand() - 0.5) * 120, 9 + rand() * 26, -46.5)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    const mat = new PointsMaterial({
      color: new Color('#c9d4f2'),
      size: 0.12,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const pts = new Points(geo, mat)
    root.add(pts)
    starMats.push(mat)
  }

  // ------------------------------------------------------------------
  // 2 · THE RIVER — dark water carrying the dusk on its far edge
  // ------------------------------------------------------------------
  const riverMat = new MeshBasicNodeMaterial()
  {
    // dark water; the dusk survives only as a thin trembling line at
    // the far shore
    const base = vec3(0.003, 0.005, 0.011)
    const far = smoothstep(-22.0, -25.8, positionWorld.z)
    const emberMirror = vec3(0.05, 0.019, 0.005)
    const flow = mx_noise_float(
      vec3(positionWorld.x.mul(0.6).add(uT.mul(0.12)), positionWorld.z.mul(2.2), uT.mul(0.05))
    )
      .mul(0.5)
      .add(0.75)
    const sheen = mx_noise_float(vec3(positionWorld.x.mul(0.18), positionWorld.z.mul(0.5), uT.mul(0.03)))
      .mul(0.3)
      .add(0.85)
    riverMat.colorNode = base
      .mul(sheen)
      .add(emberMirror.mul(far).mul(flow))
      .add(dither.mul(0.03))
      .mul(uR)
  }
  const river = new Mesh(new PlaneGeometry(170, 10), riverMat)
  river.rotation.x = -Math.PI / 2
  river.position.set(0, GROUND_Y - 0.02, -21)
  root.add(river)

  // ------------------------------------------------------------------
  // 3 · THE GROUND — a small dark planet's worth of earth; its curved
  //     rim against the river is the planetfall read
  // ------------------------------------------------------------------
  const groundMat = new MeshBasicNodeMaterial()
  {
    const dxz = length(positionWorld.xz.sub(vec2(FIRE.x, FIRE.z)))
    const fireFall = float(2.6).div(dxz.mul(dxz).add(1.1))
    const warm = vec3(0.5, 0.27, 0.09)
    const mottle = mx_noise_float(vec3(positionWorld.x.mul(0.8), positionWorld.z.mul(0.8), 3.7))
      .mul(0.3)
      .add(0.85)
    const flick = sin(uT.mul(6.7)).mul(0.07).add(0.93)
    const base = vec3(0.006, 0.005, 0.0042).mul(mottle)
    groundMat.colorNode = base
      .add(warm.mul(fireFall).mul(flick).mul(0.05))
      .add(dither.mul(0.03))
      .mul(uR)
  }
  const ground = new Mesh(new CircleGeometry(14, 96), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, GROUND_Y, -2)
  root.add(ground)

  // ------------------------------------------------------------------
  // 4 · THE CAMP — tents, palisade, standard: ink that remembers fire
  // ------------------------------------------------------------------
  function inkMaterial(rim: number): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial()
    const toFire = normalize(vec3(FIRE.x, -0.5, FIRE.z).sub(positionWorld))
    const ndl = clamp(dot(normalWorld, toFire), 0, 1).pow(2.6)
    const dist = length(positionWorld.sub(vec3(FIRE.x, -0.5, FIRE.z)))
    const fall = float(3.4).div(dist.mul(dist).add(1.6))
    const flick = sin(uT.mul(6.7).add(positionWorld.x.mul(1.7))).mul(0.09).add(0.91)
    const glow = ndl.mul(fall).mul(flick).mul(rim)
    mat.colorNode = vec3(0.004, 0.0045, 0.008)
      .add(vec3(GOLD.r, GOLD.g, GOLD.b).mul(glow))
      .add(dither.mul(0.02))
      .mul(uR)
    return mat
  }
  const tentMat = inkMaterial(0.48)
  const TENTS: Array<[number, number, number, number]> = [
    [1.25, -6.1, 0.62, 0.72],
    [2.1, -7.3, 0.56, 0.6],
    [0.55, -7.9, 0.5, 0.55],
  ]
  for (const [x, z, radius, height] of TENTS) {
    const tent = new Mesh(new ConeGeometry(radius, height, 4, 1), tentMat)
    tent.rotation.y = Math.PI / 4
    tent.position.set(x, GROUND_Y + height / 2, z)
    root.add(tent)
  }
  // the palisade: a quiet row of posts holding the dark together
  const postMat = inkMaterial(0.16)
  const postGeo = new CylinderGeometry(0.035, 0.045, 0.95, 6)
  for (let i = 0; i < 11; i++) {
    const x = -3.6 + i * 0.72 + (rand() - 0.5) * 0.14
    const h = 0.9 + rand() * 0.12
    const post = new Mesh(postGeo, postMat)
    post.scale.y = h
    post.position.set(x, GROUND_Y + 0.45 * h, -9.6 + (rand() - 0.5) * 0.3)
    root.add(post)
  }
  // the standard: one pole, one dark banner, no glory at night
  const standardMat = inkMaterial(0.22)
  const pole = new Mesh(new CylinderGeometry(0.022, 0.028, 1.7, 6), standardMat)
  pole.position.set(1.72, GROUND_Y + 0.85, -5.9)
  root.add(pole)
  const banner = new Mesh(new BoxGeometry(0.26, 0.34, 0.012), standardMat)
  banner.position.set(1.86, GROUND_Y + 1.45, -5.9)
  root.add(banner)

  // the trace post stands beside the hearth ("I carved it into the
  // post there"), close enough to hold the postcard frame
  const uYield = uniform(0)
  const tracePostMat = inkMaterial(0.42)
  tracePostMat.colorNode = tracePostMat.colorNode!.mul(oneMinus(uYield.mul(0.92)))
  const tracePost = new Mesh(new CylinderGeometry(0.05, 0.06, 0.74, 6), tracePostMat)
  tracePost.position.set(0.42, GROUND_Y + 0.37, -4.55)
  root.add(tracePost)
  const tracePos = new Vector3(0.42, GROUND_Y + 0.8, -4.55)

  // ------------------------------------------------------------------
  // 5 · THE HEARTH — a small fire, the warmest thing on the planet
  // ------------------------------------------------------------------
  const uFlame = uniform(0)
  function hearthFlame(): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial({
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const p = uv()
    const y = clamp(p.y, 0.0, 1.0)
    const x = p.x.sub(0.5)
    const swayA = mx_noise_float(vec3(y.mul(2.2).sub(uT.mul(1.3)), uT.mul(0.3), 3.1))
    const xx = x.add(swayA.mul(y.mul(0.16)))
    const radius = mix(float(0.34), float(0.05), pow(y, float(0.7)))
    const d = abs(xx).div(radius)
    const turb = mx_fractal_noise_float(
      vec3(xx.mul(6.2).add(1.0), y.mul(3.0).sub(uT.mul(2.1)), uT.mul(0.14).add(5.3)),
      3,
      2.0,
      0.55,
      1.0
    )
    const field = float(1.0).sub(d.mul(d)).add(turb.mul(0.5)).sub(y.mul(0.78))
    const alpha = smoothstep(0.18, 0.5, field)
      .mul(smoothstep(0.0, 0.07, y))
      .mul(oneMinus(smoothstep(0.78, 0.97, y)))
      .mul(uFlame)
    const heat = smoothstep(0.55, 1.25, field.add(oneMinus(y).mul(0.5)).sub(abs(xx).mul(1.6)))
    const body = mix(vec3(0.55, 0.11, 0.014), vec3(1.0, 0.6, 0.18), smoothstep(0.0, 0.85, field))
    mat.colorNode = mix(body, vec3(1.02, 0.93, 0.78), heat)
    mat.opacityNode = alpha
    return mat
  }
  const FLAME_W = 0.54
  const FLAME_H = 0.78
  const flame = new Mesh(new PlaneGeometry(1, 1), hearthFlame())
  flame.scale.set(FLAME_W, FLAME_H, 1)
  flame.position.set(FIRE.x, GROUND_Y + 0.1 + FLAME_H / 2, FIRE.z)
  flame.renderOrder = 6
  root.add(flame)

  // the stones that hold it
  const stoneMat = inkMaterial(0.5)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3
    const stone = new Mesh(new BoxGeometry(0.11, 0.07, 0.09), stoneMat)
    stone.rotation.y = rand() * Math.PI
    stone.position.set(FIRE.x + Math.cos(a) * 0.3, GROUND_Y + 0.035, FIRE.z + Math.sin(a) * 0.26)
    root.add(stone)
  }

  function glowTexture(stops: Array<[number, string]>): CanvasTexture {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    for (const [at, color] of stops) g.addColorStop(at, color)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    const img = ctx.getImageData(0, 0, size, size)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (rand() - 0.5) * 5
      d[i] = Math.max(0, Math.min(255, (d[i] ?? 0) + n))
      d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] ?? 0) + n))
      d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] ?? 0) + n))
    }
    ctx.putImageData(img, 0, 0)
    return new CanvasTexture(canvas)
  }

  const poolMat = new SpriteMaterial({
    map: glowTexture([
      [0, 'rgba(226, 170, 92, 0.34)'],
      [0.45, 'rgba(170, 116, 48, 0.1)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ]),
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  })
  const pool = new Sprite(poolMat)
  pool.position.set(FIRE.x, GROUND_Y + 0.06, FIRE.z + 0.2)
  pool.scale.set(2.3, 0.9, 1)
  pool.renderOrder = 5
  root.add(pool)

  // the trace mark: a small gold star, the same verb as the sky's
  const markMat = new SpriteMaterial({
    map: glowTexture([
      [0, 'rgba(255, 240, 200, 1)'],
      [0.25, 'rgba(224, 185, 106, 0.6)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ]),
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  })
  const mark = new Sprite(markMat)
  mark.position.copy(tracePos)
  mark.scale.set(0.14, 0.14, 1)
  mark.renderOrder = 7
  root.add(mark)

  // a few sparks over the hearth
  const SPARKS = 12
  const sparkSeeds: Array<{ speed: number; phase: number; ox: number }> = []
  for (let i = 0; i < SPARKS; i++) {
    sparkSeeds.push({ speed: 0.55 + rand() * 0.5, phase: rand() * 2, ox: (rand() - 0.5) * 0.2 })
  }
  const sparkGeo = new BufferGeometry()
  sparkGeo.setAttribute('position', new BufferAttribute(new Float32Array(SPARKS * 3), 3))
  const sparkMat = new PointsMaterial({
    color: new Color(1.5, 1.32, 1.0),
    size: 0.026,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const sparks = new Points(sparkGeo, sparkMat)
  sparks.renderOrder = 7
  root.add(sparks)

  function update(s: CampState): void {
    root.visible = s.reveal > 0.01
    if (!root.visible) return
    const r = s.reveal
    const t = s.elapsed
    uT.value = t
    uR.value = r

    const fl = 0.78 + 0.12 * Math.sin(t * 6.9) + 0.06 * Math.sin(t * 11.3 + 1.1)
    uFlame.value = r * (0.8 + 0.2 * fl)
    uYield.value = s.yield ?? 0
    // an opaque post cannot fade against lit ground: it steps out
    tracePost.visible = (s.yield ?? 0) < 0.55
    const breathe = 1 + 0.05 * Math.sin(t * 2.3)
    flame.scale.set(FLAME_W, FLAME_H * breathe, 1)
    flame.position.y = GROUND_Y + 0.1 + (FLAME_H * breathe) / 2

    poolMat.opacity = r * (0.3 + 0.12 * fl)
    for (const m of starMats) m.opacity = 0.55 * r
    markMat.opacity = r * (0.55 + 0.25 * Math.sin(t * 1.9)) * (1 - (s.yield ?? 0))

    const pos = sparkGeo.getAttribute('position')
    for (let i = 0; i < SPARKS; i++) {
      const e = sparkSeeds[i]
      if (!e) continue
      const k = (((t * e.speed + e.phase) % 1.4) + 1.4) % 1.4 / 1.4
      pos.setXYZ(
        i,
        FIRE.x + e.ox * (0.4 + k * 1.6),
        GROUND_Y + 0.16 + k * 1.15,
        FIRE.z + Math.sin(t * 2 + i) * 0.05 * k
      )
    }
    pos.needsUpdate = true
    sparkMat.opacity = r * (0.5 - 0.3 * Math.abs(Math.sin(t * 2.6)))
  }

  return { update, tracePos }
}
