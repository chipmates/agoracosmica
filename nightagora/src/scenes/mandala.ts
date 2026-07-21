/* The Map, not the Territory — the descent's own stage. From above, the
   agora is a purpose-built mandala (concept 01: "procedural marble disc,
   inscribed rings, ring glow + 30 flickering lamps, fire glow"), never
   the ground set craned over. It fades to the real agora inside the
   landing flare; they share one world position so the swap is seamless. */

import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from 'three/webgpu'
import { mulberry32, FOUNDING_SEED } from '../core/seed'

const GOLD = new Color('#e0b96a')

const FLOOR_Y = -0.9
const RADIUS = 14
const RING_R = 10.6
const FIRE = { x: 0, z: -5.6 }

export interface MandalaHandles {
  update(dt: number, elapsed: number, reveal: number): void
  visible(v: boolean): void
}

export function createMandala(scene: Scene): MandalaHandles {
  const root = new Group()
  root.visible = false
  scene.add(root)

  const rand = mulberry32(FOUNDING_SEED + 89)

  // ---- the disc: fine marble clouds and inscribed rings, no coarse veins ----
  function mapTexture(): CanvasTexture {
    const size = 1024
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    ctx.fillStyle = '#0b1122'
    ctx.fillRect(0, 0, size, size)

    // tonal clouds, small and layered: stone weather seen from far above
    for (let i = 0; i < 240; i++) {
      const x = rand() * size
      const y = rand() * size
      const r = 14 + rand() * 70
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      const lift = rand() > 0.48
      g.addColorStop(0, lift ? 'rgba(30, 40, 72, 0.10)' : 'rgba(4, 6, 12, 0.10)')
      g.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }

    const px = (world: number): number => (world / (RADIUS * 2)) * size

    // inscribed pavement rings + spokes, centered on the agora
    const cx = size / 2
    const cy = size / 2
    ctx.strokeStyle = 'rgba(182, 194, 224, 0.10)'
    ctx.lineWidth = 2
    for (const rr of [2.2, 4.0, 5.4, 7.2, 8.9]) {
      ctx.beginPath()
      ctx.arc(cx, cy, px(rr), 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(182, 194, 224, 0.055)'
    ctx.lineWidth = 1.4
    for (let sp = 0; sp < 16; sp++) {
      const a = (sp / 16) * Math.PI * 2 + 0.11
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * px(1.4), cy + Math.sin(a) * px(1.4))
      ctx.lineTo(cx + Math.cos(a) * px(13.2), cy + Math.sin(a) * px(13.2))
      ctx.stroke()
    }

    // the colonnade ring, firm; the council circles around the fire, faint
    ctx.strokeStyle = 'rgba(224, 185, 106, 0.16)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, cy, px(RING_R), 0, Math.PI * 2)
    ctx.stroke()
    const fx = cx + px(FIRE.x)
    const fy = cy - px(FIRE.z) // canvas y runs south
    ctx.strokeStyle = 'rgba(224, 185, 106, 0.13)'
    ctx.lineWidth = 2
    for (const rr of [1.9, 3.05]) {
      ctx.beginPath()
      ctx.arc(fx, fy, px(rr), 0, Math.PI * 2)
      ctx.stroke()
    }

    // fine grain so nothing bands
    const img = ctx.getImageData(0, 0, size, size)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (rand() - 0.5) * 7
      d[i] = Math.max(0, Math.min(255, (d[i] ?? 0) + n))
      d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] ?? 0) + n))
      d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] ?? 0) + n))
    }
    ctx.putImageData(img, 0, 0)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    return tex
  }

  const discMat = new MeshBasicMaterial({ map: mapTexture(), transparent: true, opacity: 0 })
  const disc = new Mesh(new CircleGeometry(RADIUS, 96), discMat)
  disc.rotation.x = -Math.PI / 2
  disc.position.y = FLOOR_Y
  root.add(disc)

  // ---- ring glow: the colonnade circle breathes gold ----
  const ringMat = new MeshBasicMaterial({
    color: GOLD,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const ring = new Mesh(new RingGeometry(RING_R - 0.1, RING_R + 0.1, 128), ringMat)
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
  const beadMap = beadTexture()
  const beadMat = new SpriteMaterial({
    map: beadMap,
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

  // ---- the fire, from above, is only light ----
  const fireGlowMat = new SpriteMaterial({
    map: beadMap,
    color: new Color('#f0b45a'),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const fireGlow = new Sprite(fireGlowMat)
  fireGlow.position.set(FIRE.x, FLOOR_Y + 0.3, FIRE.z)
  fireGlow.scale.setScalar(4.6)
  root.add(fireGlow)

  function update(dt: number, elapsed: number, reveal: number): void {
    if (!root.visible) return
    // the spiral: the mandala turns gently beneath the fall
    root.rotation.y = elapsed * 0.016
    discMat.opacity = reveal
    ringMat.opacity = 0.15 * reveal
    beadMat.opacity = 0.9 * reveal
    for (const b of beads) {
      const f = 0.6 + 0.22 * Math.sin(elapsed * 2.1 + b.phase) + 0.1 * Math.sin(elapsed * 5.3 + b.phase * 2)
      b.sprite.scale.setScalar(0.72 * f)
    }
    fireGlowMat.opacity = (0.5 + 0.1 * Math.sin(elapsed * 3.1)) * reveal
  }

  return {
    update,
    visible(v: boolean) {
      root.visible = v
    },
  }
}
