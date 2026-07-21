/* The Map, not the Territory — the descent's own stage, ported from
   concept 01's world.js marble disc. The stone is a SHADER (fbm marble
   with domain warp, vein highlights, three concentric inscribed rings,
   the fire as a central warmth, an edge vignette), so it is crisp at
   every altitude and can never show texture artifacts. It fades to the
   real agora inside the landing flare. */

import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  RingGeometry,
  Scene,
  Sprite,
  SpriteMaterial,
} from 'three/webgpu'
import {
  abs,
  clamp,
  exp,
  float,
  length,
  mix,
  mx_noise_float,
  oneMinus,
  pow,
  positionLocal,
  smoothstep,
  uniform,
  vec2,
  vec3,
} from 'three/tsl'
import { mulberry32, FOUNDING_SEED } from '../core/seed'

const GOLD = new Color('#e0b96a')

const FLOOR_Y = -0.9
const RADIUS = 14
const RING_R = 10.6

export interface MandalaHandles {
  update(dt: number, elapsed: number, reveal: number, fire: number): void
  visible(v: boolean): void
}

export function createMandala(scene: Scene): MandalaHandles {
  const root = new Group()
  root.visible = false
  scene.add(root)

  const rand = mulberry32(FOUNDING_SEED + 89)

  // ---- the disc, concept-01 marble as TSL ----
  const uReveal = uniform(0)
  const uFire = uniform(0)
  const discMat = new MeshBasicNodeMaterial({ transparent: true })
  {
    // local plane coords, normalized to the disc radius (concept: vP)
    const vP = vec2(positionLocal.x, positionLocal.y).div(RADIUS)
    const r = length(vP)
    const q = vP.mul(7.0)
    // fbm via 4 octaves of mx noise, with the concept's domain warp
    // (TSL node graphs defeat strict typing here; the values are sound)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fbm = (p: any, o1: number, o2: number, o3: number, o4: number) =>
      mx_noise_float(vec2(p.x, p.y).mul(o1))
        .mul(0.5)
        .add(mx_noise_float(vec2(p.x, p.y).mul(o2)).mul(0.25))
        .add(mx_noise_float(vec2(p.x, p.y).mul(o3)).mul(0.125))
        .add(mx_noise_float(vec2(p.x, p.y).mul(o4)).mul(0.0625))
        .add(0.5)
    const warp = clamp(fbm(q.mul(1.7).add(3.7), 1, 2.03, 4.12, 8.36), 0, 1)
    // clamp keeps the fold inside [0,1]: an unclamped fbm feeds pow a
    // negative base and the whole stone whitens with NaN fragments
    const m = clamp(fbm(q.add(warp.mul(1.3)), 1, 2.03, 4.12, 8.36), 0, 1)
    const vein = pow(clamp(oneMinus(abs(m.mul(2.0).sub(1.0))), 0, 1), 9.0)
    const base = mix(vec3(0.059, 0.078, 0.212), vec3(0.029, 0.041, 0.119), smoothstep(0.05, 1.0, r))
    let col = base.mul(fbm(q.mul(0.5), 1, 2.03, 4.12, 8.36).mul(0.16).add(0.9))
    col = col.add(vec3(0.165, 0.2, 0.455).mul(vein).mul(0.17))
    col = col.add(vec3(0.902, 0.737, 0.361).mul(vein).mul(0.045).mul(fbm(q.mul(2.6), 1, 2.03, 4.12, 8.36)))
    // inscribed rings: the walk of the thirty, and two inner memories
    const ringA = exp(pow(r.sub(RING_R / RADIUS).mul(120.0), 2.0).negate())
    const ringB = exp(pow(r.sub(0.5).mul(130.0), 2.0).negate())
    const ringC = exp(pow(r.sub(0.22).mul(130.0), 2.0).negate())
    col = col.add(vec3(0.902, 0.737, 0.361).mul(ringA.mul(0.14).add(ringB.mul(0.05)).add(ringC.mul(0.05))))
    // the fire warms the heart of the stone as the visitor nears it
    col = col.add(vec3(0.85, 0.63, 0.3).mul(exp(r.mul(5.2).negate())).mul(uFire).mul(0.55))
    // the stone dims toward its edge and ends in night
    col = col.mul(oneMinus(smoothstep(0.66, 1.0, r).mul(0.55)))
    // the concept's constants are sRGB; our pipeline treats colorNode as
    // linear, so convert or the whole stone renders two stops too bright
    discMat.colorNode = pow(col, vec3(2.2, 2.2, 2.2))
    discMat.opacityNode = float(1).mul(uReveal)
  }
  const disc = new Mesh(new CircleGeometry(RADIUS, 128), discMat)
  disc.rotation.x = -Math.PI / 2
  disc.position.y = FLOOR_Y
  root.add(disc)

  // ---- ring glow: the walk of the thirty breathes gold ----
  const ringMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  ringMat.colorNode = vec3(GOLD.r, GOLD.g, GOLD.b)
  const uRingOp = uniform(0)
  ringMat.opacityNode = uRingOp
  const ring = new Mesh(new RingGeometry(RING_R - 0.09, RING_R + 0.09, 128), ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = FLOOR_Y + 0.02
  root.add(ring)

  // ---- the thirty lamps, beads on the ring, each with its own flicker ----
  function beadTexture(): CanvasTexture {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255, 250, 232, 1)')
    g.addColorStop(0.2, 'rgba(246, 223, 174, 0.7)')
    g.addColorStop(0.5, 'rgba(224, 185, 106, 0.16)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    return new CanvasTexture(canvas)
  }
  const beadMat = new SpriteMaterial({
    map: beadTexture(),
    color: GOLD,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const beads: Array<{ sprite: Sprite; phase: number }> = []
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2
    const s = new Sprite(beadMat)
    s.position.set(Math.sin(a) * RING_R, FLOOR_Y + 0.16, -Math.cos(a) * RING_R)
    s.scale.setScalar(0.72)
    root.add(s)
    beads.push({ sprite: s, phase: rand() * Math.PI * 2 })
  }

  function update(dt: number, elapsed: number, reveal: number, fire: number): void {
    if (!root.visible) return
    // the spiral: the mandala turns gently beneath the fall
    root.rotation.y = elapsed * 0.016
    uReveal.value = reveal
    uFire.value = fire
    uRingOp.value = 0.13 * reveal
    beadMat.opacity = 0.9 * reveal
    for (const b of beads) {
      const f = 0.6 + 0.22 * Math.sin(elapsed * 2.1 + b.phase) + 0.1 * Math.sin(elapsed * 5.3 + b.phase * 2)
      b.sprite.scale.setScalar(0.72 * f)
    }
  }

  return {
    update,
    visible(v: boolean) {
      root.visible = v
    },
  }
}
