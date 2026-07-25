/* THE SIGN — a figure's Wisdom Map as a constellation. First organ
   extraction by the rule of two: His Sky (the living concept page) and
   the camp's duskrise both raise it. N seed stars seated in the
   figure's zodiac pattern, each bloom level 0..4 a visibly richer form
   of light (ember, kindled, risen, radiant, bloomed), hairlines
   binding neighbours as they waken.
   Organ law (Bible Law 25): the sign receives its frame, its seeded
   hand, and its palette from the world; it never owns the light. The
   world scales every glow through update()'s master. */

import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three/webgpu'
import type { SignPattern } from '../content/signs'

export interface SignOptions {
  pattern: SignPattern
  /** the frame the sign must fill, world units (aspect preserved) */
  width: number
  height: number
  /** the world's seeded hand (determinism law) */
  rand(): number
  /** the world's palette; canon gold by default */
  gold?: Color
  ember?: Color
  starlight?: Color
}

export interface Sign {
  group: Group
  /** per-seed anchors, for letterpress labels and buttons to project */
  stars: Group[]
  /** displayed (eased) bloom levels 0..4 */
  shown: number[]
  /** ease the stars toward levels; master scales every light (0..1) */
  update(dt: number, elapsed: number, levels: number[], master?: number): void
  /** land on levels instantly (reduced motion, the rig's frozen eye) */
  snap(levels: number[]): void
}

/* fit ANY sign into a generous frame: normalize the pattern's own
   bounds, keep its aspect, give every star breathing room and a
   whisper of depth. This is the rule all thirty signs share. */
function fitPattern(
  pattern: SignPattern,
  w: number,
  h: number,
  rand: () => number
): Array<[number, number, number]> {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of pattern) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const sx = w / Math.max(1e-6, maxX - minX)
  const sy = h / Math.max(1e-6, maxY - minY)
  const k = Math.min(sx, sy)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return pattern.map(([x, y]) => [(x - cx) * k, (cy - y) * k, (rand() - 0.5) * 3.4])
}

// ---- the bloom language's textures, drawn once and shared ----
function radial(stops: Array<[number, string]>): CanvasTexture {
  const s = 128
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d unavailable')
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  for (const [at, cc] of stops) g.addColorStop(at, cc)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  return new CanvasTexture(canvas)
}
function rays(count: number, lenFrac: number): CanvasTexture {
  const s = 256
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d unavailable')
  ctx.translate(s / 2, s / 2)
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const grad = ctx.createLinearGradient(0, 0, Math.cos(a) * s * lenFrac, Math.sin(a) * s * lenFrac)
    grad.addColorStop(0, 'rgba(246, 223, 174, 0.8)')
    grad.addColorStop(1, 'rgba(224, 185, 106, 0)')
    ctx.strokeStyle = grad
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * s * lenFrac, Math.sin(a) * s * lenFrac)
    ctx.stroke()
  }
  return new CanvasTexture(canvas)
}
interface SignMaps {
  core: CanvasTexture
  halo: CanvasTexture
  ring: CanvasTexture
  ray: CanvasTexture
}
let maps: SignMaps | null = null
function signMaps(): SignMaps {
  if (maps) return maps
  const core = radial([
    [0, 'rgba(255, 252, 240, 1)'],
    [0.2, 'rgba(255, 250, 232, 0.95)'],
    [0.4, 'rgba(246, 223, 174, 0.3)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ])
  const halo = radial([
    [0, 'rgba(246, 223, 174, 0.55)'],
    [0.4, 'rgba(224, 185, 106, 0.16)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ])
  const ray = rays(8, 0.48)
  const ring = (() => {
    const s = 128
    const canvas = document.createElement('canvas')
    canvas.width = s
    canvas.height = s
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d unavailable')
    ctx.strokeStyle = 'rgba(224, 185, 106, 0.9)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(s / 2, s / 2, s * 0.34, 0, Math.PI * 2)
    ctx.stroke()
    return new CanvasTexture(canvas)
  })()
  maps = { core, halo, ring, ray }
  return maps
}

interface SeedStar {
  group: Group
  coreMat: SpriteMaterial
  core: Sprite
  haloMat: SpriteMaterial
  halo: Sprite
  ringMat: SpriteMaterial
  ring: Sprite
  rayMat: SpriteMaterial
  ray: Sprite
  level: number
  shown: number
  base: Vector3
  phase: number
}

interface Bind {
  line: Line
  mat: LineBasicMaterial
  a: number
  b: number
}

export function createSign(opts: SignOptions): Sign {
  const GOLD = opts.gold ?? new Color('#e0b96a')
  const EMBER = opts.ember ?? new Color('#8a6a3a')
  const STARLIGHT = opts.starlight ?? new Color('#f3efe2')
  const tex = signMaps()
  const group = new Group()
  const seats = fitPattern(opts.pattern, opts.width, opts.height, opts.rand)

  const seeds: SeedStar[] = []
  for (let i = 0; i < opts.pattern.length; i++) {
    const g = new Group()
    const seat = seats[i] ?? [0, 0, 0]
    const base = new Vector3(seat[0], seat[1], seat[2] ?? 0)
    g.position.copy(base)
    group.add(g)
    const coreMat = new SpriteMaterial({
      map: tex.core,
      color: EMBER,
      transparent: true,
      opacity: 0.35,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const core = new Sprite(coreMat)
    core.scale.setScalar(0.5)
    g.add(core)
    const haloMat = new SpriteMaterial({
      map: tex.halo,
      color: GOLD,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const halo = new Sprite(haloMat)
    halo.scale.setScalar(2.6)
    g.add(halo)
    const ringMat = new SpriteMaterial({
      map: tex.ring,
      color: GOLD,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const ring = new Sprite(ringMat)
    ring.scale.setScalar(1.5)
    g.add(ring)
    const rayMat = new SpriteMaterial({
      map: tex.ray,
      color: STARLIGHT,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const ray = new Sprite(rayMat)
    ray.scale.setScalar(2.4)
    g.add(ray)
    seeds.push({
      group: g,
      coreMat, core,
      haloMat, halo,
      ringMat, ring,
      rayMat, ray,
      level: 0,
      shown: 0,
      base,
      phase: opts.rand() * Math.PI * 2,
    })
  }

  // the binding: one hairline chain draws the whole figure in one stroke
  const binds: Bind[] = []
  for (let i = 0; i < seeds.length - 1; i++) {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3))
    const mat = new LineBasicMaterial({
      color: GOLD,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const line = new Line(geo, mat)
    line.frustumCulled = false
    group.add(line)
    binds.push({ line, mat, a: i, b: i + 1 })
  }

  const shown: number[] = new Array(seeds.length).fill(0)
  const scratch = new Color()

  function update(dt: number, elapsed: number, levels: number[], master = 1): void {
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]
      if (!s) continue
      s.level = levels[i] ?? 0
      s.shown += (s.level - s.shown) * Math.min(1, dt * 2.4)
      shown[i] = s.shown
      const L = s.shown
      const breathe = 1 + 0.05 * Math.sin(elapsed * (0.8 + s.phase * 0.1) + s.phase) * Math.min(1, L)
      // the language of the five stages, continuous. Even the ember
      // stage must be RECOGNIZABLE as a seed against the firmament
      // (the founder, first-night law): warmer, a breath stronger, and
      // ringed by a barely-lit mark from night one.
      s.core.scale.setScalar((0.36 + 0.1 * L) * breathe)
      s.coreMat.color.copy(scratch.copy(EMBER).lerp(STARLIGHT, Math.min(1, L / 2.2)))
      s.coreMat.opacity = (0.42 + 0.14 * L) * master
      s.haloMat.opacity = Math.max(0, (L - 1.6) / 2.4) * 0.5 * master
      s.halo.scale.setScalar((1.3 + 0.28 * L) * breathe)
      s.ringMat.opacity = Math.max(0.12, Math.min(1, L - 0.7)) * 0.6 * master
      s.ring.scale.setScalar(0.95 + 0.1 * L)
      s.rayMat.opacity = Math.max(0, (L - 2.7) / 1.3) * 0.62 * master
      s.ray.scale.setScalar(1.45 + 0.3 * (L - 2.5))
      s.rayMat.rotation = elapsed * 0.05 + s.phase
      // a waking star drifts a breath upward as it comes alive
      s.group.position.y = s.base.y + Math.min(1, L / 4) * 0.22
    }
    for (const b of binds) {
      const la = seeds[b.a]?.shown ?? 0
      const lb = seeds[b.b]?.shown ?? 0
      const on = Math.max(0, Math.min(la, lb) - 1.2) / 2.8
      // a whisper of the whole figure is always drawn: the sign must
      // read as a SIGN on the first night, its light still unearned
      b.mat.opacity = Math.max(0.06, on * 0.3) * master
      const pa = seeds[b.a]?.group.position
      const pb = seeds[b.b]?.group.position
      if (pa && pb) {
        const arr = b.line.geometry.getAttribute('position')
        arr.setXYZ(0, pa.x, pa.y, pa.z)
        arr.setXYZ(1, pb.x, pb.y, pb.z)
        arr.needsUpdate = true
      }
    }
  }

  function snap(levels: number[]): void {
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i]
      if (!s) continue
      s.level = s.shown = levels[i] ?? 0
      shown[i] = s.shown
    }
  }

  return {
    group,
    stars: seeds.map((s) => s.group),
    shown,
    update,
    snap,
  }
}
