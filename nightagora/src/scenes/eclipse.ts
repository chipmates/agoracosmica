import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshBasicNodeMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three/webgpu'
import { float, length, mix, positionLocal, pow, sin, smoothstep, uniform, vec3 } from 'three/tsl'
import { mulberry32, shellPoint, FOUNDING_SEED } from '../core/seed'

const GOLD = new Color('#e0b96a')
const GOLD_DEEP = new Color('#a97c2f')
const EMBER = new Color('#f6dfae')
const WHITE_HOT = new Color('#fffaf0')
// the welcoming night (2026-07-20): the zenith lifted from void-black
// toward a deep lapis, so the dark reads as a place, not an absence
const ABYSS = new Color('#060b1c')
const LAPIS = new Color('#0c1430')
const HORIZON = new Color('#182350')
const STAR_WARM = new Color('#f3efe2')
const STAR_COOL = new Color('#c9d4f2')
const STAR_ICE = new Color('#dfe9ff')

function glowTexture(stops: Array<[number, string]>): CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [at, color] of stops) g.addColorStop(at, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

export interface EclipseState {
  transit: number
  door: number
  skyBirth: number
  /** 0..1 how present the thirty lanterns are (whispers at the eclipse, full in the sky) */
  lanterns: number
  sinceFlash: number
  elapsed: number
}

export function createEclipse(scene: Scene) {
  const rand = mulberry32(FOUNDING_SEED)

  // ---- night dome: the horizon glow belongs at eye level. The bottom
  // cap stays deep night, so looking straight down during the descent
  // reads as clean darkness around the mandala, never a muddy band ----
  const domeGeo = new SphereGeometry(90, 32, 24)
  const dpos = domeGeo.getAttribute('position')
  const colors: number[] = []
  const c = new Color()
  for (let i = 0; i < dpos.count; i++) {
    const y = (dpos.getY(i) / 90 + 1) / 2
    if (y < 0.42) c.copy(ABYSS).lerp(HORIZON, Math.pow(y / 0.42, 2.2))
    else if (y < 0.56) c.copy(HORIZON).lerp(LAPIS, (y - 0.42) / 0.14)
    else c.copy(LAPIS).lerp(ABYSS, Math.min(1, (y - 0.56) / 0.34))
    colors.push(c.r, c.g, c.b)
  }
  domeGeo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  scene.add(new Mesh(domeGeo, new MeshBasicMaterial({ vertexColors: true, side: BackSide })))

  // ---- the eclipse ----
  const eclipse = new Group()
  eclipse.position.set(0, 1.35, -10)
  scene.add(eclipse)

  const uTime = uniform(0)
  const uIntensity = uniform(0)

  // angular direction without atan: normalized local direction
  const r = length(positionLocal.xy)
  const safeR = r.max(0.0001)
  const dx = positionLocal.x.div(safeR)
  const dy = positionLocal.y.div(safeR)

  // (a) chromosphere: a thin, uneven, white-hot rim
  const rimMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  })
  const rimFall = pow(smoothstep(1.42, 1.01, r), 2.4)
  const rimUneven = sin(dx.mul(9.0).add(dy.mul(4.0)).add(uTime.mul(0.21)))
    .mul(sin(dx.mul(3.0).sub(dy.mul(8.0)).sub(uTime.mul(0.17))))
    .mul(0.18)
    .add(0.82)
  rimMat.colorNode = mix(
    vec3(GOLD.r, GOLD.g, GOLD.b),
    vec3(WHITE_HOT.r, WHITE_HOT.g, WHITE_HOT.b),
    pow(rimFall, 2)
  )
  rimMat.opacityNode = rimFall.mul(rimUneven).mul(uIntensity)
  const rim = new Mesh(new RingGeometry(1.0, 1.5, 256), rimMat)
  rim.renderOrder = 2
  eclipse.add(rim)

  // (b) corona streamers: long irregular petals of pale fire
  const coronaMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  })
  const petalsA = sin(dx.mul(7.3).add(dy.mul(3.1)).add(uTime.mul(0.05)))
  const petalsB = sin(dx.mul(2.7).sub(dy.mul(8.3)).sub(uTime.mul(0.04)))
  const petalsC = sin(dx.mul(5.1).add(dy.mul(5.9)).add(uTime.mul(0.03)))
  const streamer = petalsA.mul(petalsB).mul(petalsC).mul(0.5).add(0.5)
  const streamerMask = pow(streamer, 2.2).mul(0.85).add(0.15)
  const reach = pow(smoothstep(3.9, 1.02, r), 2.1)
  const nearRim = pow(smoothstep(2.2, 1.0, r), 3.0)
  coronaMat.colorNode = mix(
    vec3(GOLD_DEEP.r, GOLD_DEEP.g, GOLD_DEEP.b),
    vec3(EMBER.r, EMBER.g, EMBER.b),
    nearRim
  )
  coronaMat.opacityNode = reach.mul(streamerMask).mul(uIntensity).mul(float(0.62))
  const corona = new Mesh(new RingGeometry(1.0, 3.9, 256), coronaMat)
  corona.renderOrder = 1
  eclipse.add(corona)

  // (c) one quiet outer breath, tight and warm, no lamp
  const breathMat = new SpriteMaterial({
    map: glowTexture([
      [0, 'rgba(246, 223, 174, 0.5)'],
      [0.35, 'rgba(224, 185, 106, 0.16)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ]),
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
  const breath = new Sprite(breathMat)
  breath.scale.setScalar(4.6)
  breath.renderOrder = 1
  eclipse.add(breath)

  // the moon: darker than any sky the night now wears, or the silhouette dies
  const MOON = new Color('#02030a')
  const disc = new Mesh(new CircleGeometry(1.012, 128), new MeshBasicMaterial({ color: MOON }))
  disc.position.z = 0.15
  disc.renderOrder = 4
  eclipse.add(disc)

  // the diamond ring, waiting at the rim
  const flashMat = new SpriteMaterial({
    map: glowTexture([
      [0, 'rgba(255, 255, 250, 1)'],
      [0.12, 'rgba(255, 250, 235, 0.9)'],
      [0.3, 'rgba(246, 223, 174, 0.35)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ]),
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  })
  const flash = new Sprite(flashMat)
  flash.renderOrder = 5
  const rimAngle = Math.PI * 0.24
  flash.position.set(Math.cos(rimAngle) * 1.03, Math.sin(rimAngle) * 1.03, 0.2)
  flash.scale.setScalar(2.1)
  eclipse.add(flash)

  // ---- the firmament: two star populations, and thirty that wander ----
  function starField(count: number, size: number, color: Color, rMin: number, rMax: number) {
    const geo = new BufferGeometry()
    const pos: number[] = []
    for (let i = 0; i < count; i++) pos.push(...shellPoint(rand, rMin, rMax))
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    const mat = new PointsMaterial({
      color,
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const points = new Points(geo, mat)
    scene.add(points)
    return { points, mat }
  }
  // a rich, varied heaven: four populations at different sizes and hues,
  // dense dust to bright gems, cool sparkle among the warm
  const dustStars = starField(3200, 0.18, STAR_COOL, 46, 74)
  const dimStars = starField(2400, 0.26, STAR_COOL, 44, 72)
  const midStars = starField(760, 0.38, STAR_ICE, 43, 68)
  const brightStars = starField(320, 0.5, STAR_WARM, 42, 66)
  const gemStars = starField(110, 0.72, STAR_ICE, 41, 60)

  const wandererBase: Array<[number, number, number]> = []
  const wandererMat = new SpriteMaterial({
    // a distant lantern: hard bright core, quick falloff, faint breath
    map: glowTexture([
      [0, 'rgba(255, 250, 232, 1)'],
      [0.09, 'rgba(246, 223, 174, 0.8)'],
      [0.22, 'rgba(224, 185, 106, 0.22)'],
      [0.55, 'rgba(224, 185, 106, 0.05)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ]),
    color: GOLD,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  })
  const wanderers = new Group()
  for (let i = 0; i < 30; i++) {
    // the wanderers gather in a wide cone around the visitor's gaze:
    // a sky of thirty must greet, not hide. Drift reveals the rest.
    const th = Math.acos(0.42 + 0.58 * rand())
    const ph = rand() * Math.PI * 2
    const rr = 40 + 12 * rand()
    const raw: [number, number, number] = [
      rr * Math.sin(th) * Math.cos(ph),
      rr * Math.sin(th) * Math.sin(ph) * 0.85,
      -rr * Math.cos(th),
    ]
    // tilt the gathering upward: in the sky phase the visitor gazes up
    const tilt = 0.6
    const p: [number, number, number] = [
      raw[0],
      raw[1] * Math.cos(tilt) - raw[2] * Math.sin(tilt),
      raw[1] * Math.sin(tilt) + raw[2] * Math.cos(tilt),
    ]
    wandererBase.push(p)
    const s = new Sprite(wandererMat)
    s.position.set(p[0], p[1], p[2])
    s.scale.setScalar(1.4)
    wanderers.add(s)
  }
  scene.add(wanderers)

  function update(s: EclipseState): void {
    uTime.value = s.elapsed

    const cover = 1 - s.transit
    disc.position.x = -0.62 * cover
    uIntensity.value = 0.12 + 0.88 * Math.pow(s.transit, 2)
    breathMat.opacity = 0.25 + 0.55 * s.transit

    // the diamond ring: the bead ignites while the corona is still faint,
    // then the corona blooms as the bead dies
    if (s.sinceFlash >= 0 && s.sinceFlash < 1.4) {
      const k = s.sinceFlash / 1.4
      flashMat.opacity = (1 - k) * (0.55 + 0.45 * Math.exp(-s.sinceFlash * 3))
      flash.scale.setScalar(1.3 + 0.9 * (1 - k))
      uIntensity.value *= 0.3 + 0.7 * k
    } else {
      flashMat.opacity = 0
    }

    dustStars.mat.opacity = 0.5 * s.skyBirth
    dimStars.mat.opacity = 0.7 * s.skyBirth
    midStars.mat.opacity = (0.68 + 0.1 * Math.sin(s.elapsed * 0.7)) * s.skyBirth
    brightStars.mat.opacity = s.skyBirth
    gemStars.mat.opacity = (0.8 + 0.16 * Math.sin(s.elapsed * 0.9 + 2)) * s.skyBirth
    wandererMat.opacity = s.skyBirth * s.lanterns
    dustStars.points.rotation.y = s.elapsed * 0.0025
    dimStars.points.rotation.y = s.elapsed * 0.003
    midStars.points.rotation.y = s.elapsed * 0.0035
    brightStars.points.rotation.y = s.elapsed * 0.004
    gemStars.points.rotation.y = s.elapsed * 0.0045
    wanderers.rotation.y = s.elapsed * 0.011
    wanderers.rotation.x = Math.sin(s.elapsed * 0.05) * 0.01

    const door = s.door
    const scale = 1 + Math.pow(door, 1.6) * 26
    eclipse.scale.setScalar(scale)
    // once through the door, the eclipse is behind you
    eclipse.visible = door < 0.995
    breathMat.opacity *= 1 - Math.pow(door, 2.2)
    uIntensity.value *= 1 - Math.pow(door, 1.4) * 0.92

    const pulse = 1 + Math.sin(s.elapsed * 0.6) * 0.008
    rim.scale.setScalar(pulse)
    corona.scale.setScalar(2 - pulse)
  }

  return { update, wanderers, wandererBase, wandererOpacity: () => wandererMat.opacity }
}
