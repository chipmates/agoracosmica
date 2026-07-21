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
import { length, mix, positionLocal, pow, sin, smoothstep, uniform, vec3 } from 'three/tsl'
import { mulberry32, shellPoint, FOUNDING_SEED } from '../core/seed'

const GOLD = new Color('#e0b96a')
const GOLD_DEEP = new Color('#b8863b')
const STARLIGHT = new Color('#f3efe2')
const ABYSS = new Color('#04060d')
const LAPIS = new Color('#0a1128')
const HORIZON = new Color('#182350')

/** Soft radial glow texture, drawn in code. No asset ships for light. */
function glowTexture(inner: string, outer: string): CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, inner)
  g.addColorStop(0.28, outer)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

export interface EclipseState {
  /** 0..1 the moon's remaining travel to totality (loader-as-transit) */
  transit: number
  /** 0..1 scroll progress into the dark door */
  door: number
  /** 0..1 star reveal after totality */
  skyBirth: number
  /** seconds since diamond-ring flash, negative before it fires */
  sinceFlash: number
  elapsed: number
}

export function createEclipse(scene: Scene) {
  const rand = mulberry32(FOUNDING_SEED)

  // ---- night gradient dome (vertex colors, zero shaders) ----
  const domeGeo = new SphereGeometry(90, 32, 24)
  const pos = domeGeo.getAttribute('position')
  const colors: number[] = []
  const c = new Color()
  for (let i = 0; i < pos.count; i++) {
    const y = (pos.getY(i) / 90 + 1) / 2
    if (y < 0.35) c.copy(HORIZON).lerp(LAPIS, y / 0.35)
    else c.copy(LAPIS).lerp(ABYSS, (y - 0.35) / 0.65)
    colors.push(c.r, c.g, c.b)
  }
  domeGeo.setAttribute('color', new Float32BufferAttribute(colors, 3))
  const dome = new Mesh(domeGeo, new MeshBasicMaterial({ vertexColors: true, side: BackSide }))
  scene.add(dome)

  // ---- the eclipse group ----
  const eclipse = new Group()
  eclipse.position.set(0, 1.1, -10)
  scene.add(eclipse)

  // outer glow (the corona's breath)
  const glowMat = new SpriteMaterial({
    map: glowTexture('rgba(255, 244, 214, 0.9)', 'rgba(224, 185, 106, 0.32)'),
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
  const glow = new Sprite(glowMat)
  glow.scale.setScalar(9)
  eclipse.add(glow)

  // shimmer ring (TSL: live light, never a static image)
  const uTime = uniform(0)
  const uIntensity = uniform(0)
  const ringMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  })
  const r = length(positionLocal.xy)
  const falloff = pow(smoothstep(1.9, 1.04, r), 1.7)
  const flickA = sin(positionLocal.x.mul(7.3).add(uTime.mul(1.6)))
  const flickB = sin(positionLocal.y.mul(6.1).sub(uTime.mul(1.2)))
  const flicker = flickA.mul(flickB).mul(0.22).add(0.78)
  ringMat.colorNode = mix(
    vec3(GOLD_DEEP.r, GOLD_DEEP.g, GOLD_DEEP.b),
    vec3(STARLIGHT.r, STARLIGHT.g, STARLIGHT.b),
    pow(falloff, 3)
  )
  ringMat.opacityNode = falloff.mul(flicker).mul(uIntensity)
  const ring = new Mesh(new RingGeometry(1.02, 1.9, 128), ringMat)
  eclipse.add(ring)

  // the moon: a black disc sliding to totality
  const disc = new Mesh(new CircleGeometry(1.06, 96), new MeshBasicMaterial({ color: ABYSS }))
  disc.position.z = 0.15
  eclipse.add(disc)

  // diamond ring flash, waiting at the rim
  const flashMat = new SpriteMaterial({
    map: glowTexture('rgba(255, 252, 240, 1)', 'rgba(224, 185, 106, 0.5)'),
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  })
  const flash = new Sprite(flashMat)
  const rimAngle = Math.PI * 0.22
  flash.position.set(Math.cos(rimAngle) * 1.05, Math.sin(rimAngle) * 1.05, 0.2)
  flash.scale.setScalar(1.6)
  eclipse.add(flash)

  // ---- the firmament: fixed stars, and thirty that wander ----
  const starGeo = new BufferGeometry()
  const starPos: number[] = []
  for (let i = 0; i < 1500; i++) starPos.push(...shellPoint(rand, 42, 70))
  starGeo.setAttribute('position', new Float32BufferAttribute(starPos, 3))
  const starMat = new PointsMaterial({
    color: STARLIGHT,
    size: 0.22,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const stars = new Points(starGeo, starMat)
  scene.add(stars)

  const wandererGeo = new BufferGeometry()
  const wandererPos: number[] = []
  for (let i = 0; i < 30; i++) wandererPos.push(...shellPoint(rand, 40, 52))
  wandererGeo.setAttribute('position', new Float32BufferAttribute(wandererPos, 3))
  const wandererMat = new PointsMaterial({
    color: GOLD,
    size: 0.55,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const wanderers = new Points(wandererGeo, wandererMat)
  scene.add(wanderers)

  function update(s: EclipseState): void {
    uTime.value = s.elapsed

    // transit: the moon slides from offset to concentric; corona earns its light
    const cover = 1 - s.transit
    disc.position.x = -0.62 * cover
    uIntensity.value = 0.15 + 0.85 * Math.pow(s.transit, 2)
    glowMat.opacity = 0.5 + 0.5 * s.transit

    // diamond ring: one bead of last sunlight, decaying
    if (s.sinceFlash >= 0) {
      flashMat.opacity = Math.max(0, 1 - s.sinceFlash / 0.9) * (0.4 + 0.6 * Math.exp(-s.sinceFlash * 4))
    }

    // totality births the sky
    starMat.opacity = 0.9 * s.skyBirth
    wandererMat.opacity = s.skyBirth
    stars.rotation.y = s.elapsed * 0.004
    wanderers.rotation.y = s.elapsed * 0.011
    wanderers.rotation.x = Math.sin(s.elapsed * 0.05) * 0.01

    // the dark door: the disc grows until darkness is the frame
    const door = s.door
    const scale = 1 + Math.pow(door, 1.6) * 26
    eclipse.scale.setScalar(scale)
    glowMat.opacity *= 1 - Math.pow(door, 2.2)
    uIntensity.value *= 1 - Math.pow(door, 1.4) * 0.92

    // corona breathes, slowly, like a held note
    const breath = 1 + Math.sin(s.elapsed * 0.6) * 0.012
    ring.scale.setScalar(breath)
  }

  return { update }
}
