import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  RingGeometry,
  Points,
  PointsMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
} from 'three/webgpu'
import {
  abs,
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
  positionWorld,
  pow,
  sin,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl'
import { mulberry32, FOUNDING_SEED } from '../core/seed'

// ---- the palette: night stone, earned gold ----
const GOLD = new Color('#e0b96a')
const GOLD_DEEP = new Color('#a9611f')
const WHITE_HOT = new Color('#fff6e0')
const EMBER_GOLD = new Color('#f0b45a')
const STAR_WHITE = new Color('#eef1ff')
const STAR_COOL = new Color('#c9d4f2')
const COLUMN_INK = new Color('#0a0e22')

export interface AgoraState {
  /** 0..1 fade-in of the ground world after the dark door */
  reveal: number
  elapsed: number
  /** 0..1 while the Keeper speaks: the fire listens and leans in */
  speak?: number
  /** 0..1 while the council convenes: hearth scales toward blaze */
  blaze?: number
}

/**
 * The ground hub, material-first: a polished dark-marble disc that answers
 * the fire (lit veins, a grazing sheen, the firmament doubled faintly in the
 * stone), a noise-driven flame over a stone fire-altar, its mirror image
 * lying on the floor where reflection geometry actually puts it, a far
 * colonnade rim-lit by the fire, and embers that whiten into stars as they
 * climb. Camera stays at origin; everything below is staged for the seated
 * eye (pitch -0.12, fov 46).
 */
export function createAgora(scene: Scene) {
  const root = new Group()
  root.visible = false
  scene.add(root)

  const FLOOR_Y = -0.9
  const FIRE = { x: 0, y: -0.45, z: -5.6 } // light anchor sits low in the bowl

  const uT = uniform(0)
  const uR = uniform(0)

  // shared 2d hash for dithering shader gradients (kills banding)
  const hash = fract(sin(dot(uv().mul(vec2(511.7, 337.3)), vec2(12.9898, 78.233))).mul(43758.5453))
  const dither = hash.sub(0.5).mul(0.016)

  // ------------------------------------------------------------------
  // textures (seeded canvas, always dithered: gradients never band)
  // ------------------------------------------------------------------
  function paintNoise(ctx: CanvasRenderingContext2D, size: number, rnd: () => number, amp: number): void {
    const img = ctx.getImageData(0, 0, size, size)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() - 0.5) * 2 * amp
      d[i] = Math.max(0, Math.min(255, (d[i] ?? 0) + n))
      d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] ?? 0) + n))
      d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] ?? 0) + n))
      const a = (rnd() - 0.5) * amp
      d[i + 3] = Math.max(0, Math.min(255, (d[i + 3] ?? 0) + a))
    }
    ctx.putImageData(img, 0, 0)
  }

  function glowTexture(stops: Array<[number, string]>, rnd: () => number): CanvasTexture {
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
    paintNoise(ctx, size, rnd, 5)
    return new CanvasTexture(canvas)
  }

  /** Dark polished marble: ink base, pale veins, tonal clouds, fine grain. */
  function marbleTexture(rnd: () => number): CanvasTexture {
    const size = 1024
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    ctx.fillStyle = '#0a0f1e'
    ctx.fillRect(0, 0, size, size)

    // tonal clouds: the stone is never one value
    for (let i = 0; i < 46; i++) {
      const x = rnd() * size
      const y = rnd() * size
      const r = 60 + rnd() * 220
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      const lift = rnd() > 0.5
      g.addColorStop(0, lift ? 'rgba(26, 34, 60, 0.10)' : 'rgba(3, 5, 10, 0.12)')
      g.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }

    // the agora is BUILT around its fire: paving joints, concentric and
    // radial, centered where the fire stands (fire sits at uv 0.5, 0.3)
    const fx = size * 0.5
    const fy = size * 0.3
    ctx.strokeStyle = 'rgba(2, 4, 9, 0.35)'
    ctx.lineWidth = 1.6
    for (let ring = 1; ring <= 7; ring++) {
      const r = (ring * 1.55 * size) / 28
      ctx.beginPath()
      ctx.arc(fx, fy, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    for (let sp = 0; sp < 14; sp++) {
      const a = (sp / 14) * Math.PI * 2 + 0.11
      ctx.beginPath()
      ctx.moveTo(fx + Math.cos(a) * ((1.1 * size) / 28), fy + Math.sin(a) * ((1.1 * size) / 28))
      ctx.lineTo(fx + Math.cos(a) * ((12 * size) / 28), fy + Math.sin(a) * ((12 * size) / 28))
      ctx.stroke()
    }

    // veins: long wandering hairlines, a few warmer ones
    for (let i = 0; i < 17; i++) {
      const warm = rnd() > 0.78
      let x = rnd() * size
      let y = rnd() * size
      let ang = rnd() * Math.PI * 2
      const steps = 70 + Math.floor(rnd() * 130)
      const alpha = 0.07 + rnd() * 0.08
      ctx.strokeStyle = warm
        ? `rgba(214, 192, 148, ${alpha})`
        : `rgba(182, 194, 224, ${alpha})`
      ctx.lineWidth = 0.8 + rnd() * 1.5
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let s = 0; s < steps; s++) {
        ang += (rnd() - 0.5) * 0.7
        const step = 4 + rnd() * 9
        x += Math.cos(ang) * step
        y += Math.sin(ang) * step
        ctx.lineTo(x, y)
        // occasional faint branch
        if (rnd() > 0.965) {
          const bx = x
          const by = y
          let ba = ang + (rnd() - 0.5) * 1.6
          ctx.moveTo(bx, by)
          for (let b = 0; b < 14; b++) {
            ba += (rnd() - 0.5) * 0.8
            ctx.lineTo(bx + Math.cos(ba) * b * 5, by + Math.sin(ba) * b * 5)
          }
          ctx.moveTo(x, y)
        }
      }
      ctx.stroke()
    }

    paintNoise(ctx, size, rnd, 1.7)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    return tex
  }

  const texRand = mulberry32(FOUNDING_SEED + 21)
  const marble = marbleTexture(texRand)

  // ------------------------------------------------------------------
  // 1 · THE MARBLE — a real material, lit by the fire, polished
  // ------------------------------------------------------------------
  const floorMat = new MeshBasicNodeMaterial()
  {
    const albedo = texture(marble).rgb
    const dxz = length(positionWorld.xz.sub(vec2(FIRE.x, FIRE.z)))
    // firelight lying on the stone, dancing a little
    const fireFall = float(6.4).div(dxz.mul(dxz).add(1.3))
    const shimmer = mx_noise_float(vec3(positionWorld.x.mul(0.5), positionWorld.z.mul(0.5), uT.mul(0.33)))
      .mul(0.08)
      .add(0.96)
    const warm = vec3(0.93, 0.68, 0.34)
    const ambient = vec3(0.55, 0.7, 1.15)
    const light = ambient.add(warm.mul(fireFall).mul(shimmer))
    // the fire's own gleam on the polish: a direct warm sheen, not paint
    const gleam = warm.mul(fireFall).mul(shimmer).mul(0.017)
    // polish: the far stone catches the night at grazing angles
    const grazing = oneMinus(clamp(normalize(positionWorld).y.abs(), 0, 1))
    const sheen = vec3(0.0035, 0.005, 0.009).mul(grazing.pow(7))
    floorMat.colorNode = albedo.mul(light).add(gleam).add(sheen).add(dither.mul(0.05)).mul(uR)
  }
  const floor = new Mesh(new CircleGeometry(14, 96), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = FLOOR_Y
  root.add(floor)

  // ------------------------------------------------------------------
  // 2 · THE FIRMAMENT IN THE STONE — star-dust on the polish
  //     (camera never translates, so dots on the surface read exactly
  //      as the cheated mirrored starfield the doctrine names)
  // ------------------------------------------------------------------
  const dustRand = mulberry32(FOUNDING_SEED + 34)
  function dustField(
    count: number,
    near: boolean,
    gold: boolean,
    rMin = 0,
    rMax = 9.3
  ): { points: Points; mat: PointsMaterial } {
    const pos: number[] = []
    let guard = 0
    while (pos.length / 3 < count && guard < count * 60) {
      guard++
      const r = rMin + (rMax - rMin) * Math.pow(dustRand(), 0.42)
      const a = dustRand() * Math.PI * 2
      const x = Math.sin(a) * r
      const z = -Math.cos(a) * r
      if (z > 0.4) continue // behind the visitor
      const dFire = Math.hypot(x - FIRE.x, z - FIRE.z)
      if (dFire < 1.5) continue // the altar owns its ground
      const dCam = Math.hypot(x, z)
      if (near !== dCam < 3.6) continue
      pos.push(x, FLOOR_Y + 0.015, z)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    const mat = new PointsMaterial({
      color: gold ? GOLD : STAR_COOL,
      size: gold ? 0.03 : near ? 0.012 : 0.021,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const points = new Points(geo, mat)
    points.renderOrder = 2
    root.add(points)
    return { points, mat }
  }
  const dustFar = dustField(360, false, false)
  const dustNear = dustField(120, true, false)
  const dustGold = dustField(9, false, true)
  // the polish does not end in a line: a sparse feather past the main field
  const dustEdge = dustField(85, false, false, 8.9, 11.6)

  // ------------------------------------------------------------------
  // 3 · THE FIRE — one TSL field carved from fractal noise (the
  //     tournament's most alive flame: torn tips, rising turbulence,
  //     a slow whole-body lean), burning over the bronze brazier.
  //     The same node graph, flipped and dimmed, is its twin in the
  //     marble (section 4).
  // ------------------------------------------------------------------
  const uFlame = uniform(0)
  const uLean = uniform(0)

  function flameMaterial(flip: boolean, gain: number, seed: number): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial({
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const p = uv()
    const y = clamp(flip ? oneMinus(p.y) : p.y, 0.0, 1.0)
    const x = p.x.sub(0.5)
    // the tongue sways: two octaves of drifting noise, growing with height,
    // plus one slow whole-body lean. It turns and breathes; it never bounces.
    const swayA = mx_noise_float(vec3(y.mul(1.9).sub(uT.mul(1.15)), uT.mul(0.27), 5.2 + seed))
    const swayB = mx_noise_float(vec3(y.mul(4.6).sub(uT.mul(2.1)), uT.mul(0.4), 9.7 + seed))
    const xx = x
      .add(swayA.mul(y.mul(0.17)))
      .add(swayB.mul(y.mul(0.06)))
      .add(uLean.mul(y))
    // envelope: wide at the coals, a needle at the tip
    const radius = mix(float(0.38), float(0.05), pow(y, float(0.74)))
    const d = abs(xx).div(radius)
    // rising turbulence carves the body into separate tongues
    const turb = mx_fractal_noise_float(
      vec3(xx.mul(5.6).add(2.0), y.mul(2.6).sub(uT.mul(1.9)), uT.mul(0.12).add(7.3 + seed)),
      3,
      2.0,
      0.55,
      1.0
    )
    const field = float(1.02).sub(d.mul(d)).add(turb.mul(0.52)).sub(y.mul(0.72))
    const rooted = smoothstep(0.0, 0.06, y)
    const crown = oneMinus(smoothstep(0.8, 0.97, y))
    let alpha = smoothstep(0.16, 0.46, field).mul(rooted).mul(crown).mul(uFlame).mul(float(gain))
    if (flip) alpha = alpha.mul(oneMinus(smoothstep(0.05, 0.46, y)))
    const heat = smoothstep(0.55, 1.3, field.add(oneMinus(y).mul(0.5)).sub(abs(xx).mul(1.5)))
    const body = mix(vec3(0.58, 0.12, 0.015), vec3(1.0, 0.63, 0.19), smoothstep(0.0, 0.85, field))
    mat.colorNode = mix(body, vec3(1.02, 0.94, 0.8), heat)
    mat.opacityNode = alpha
    return mat
  }

  const RIM_Y = FLOOR_Y + 0.385 // the brazier's lip
  const flameGeo = new PlaneGeometry(1, 1)
  const FLAME_W = 1.2
  const FLAME_H = 1.35
  const TONGUE_W = FLAME_W * 0.62
  const TONGUE_H = FLAME_H * 0.66
  const FLAME_BASE = RIM_Y - 0.12
  const flame = new Mesh(flameGeo, flameMaterial(false, 1, 0))
  flame.scale.set(FLAME_W, FLAME_H, 1)
  flame.position.set(FIRE.x, FLAME_BASE + FLAME_H / 2, FIRE.z)
  flame.renderOrder = 7
  root.add(flame)

  // a second, smaller tongue: fire is never one voice
  const tongue = new Mesh(flameGeo, flameMaterial(false, 0.85, 4.3))
  tongue.scale.set(TONGUE_W, TONGUE_H, 1)
  tongue.position.set(FIRE.x + 0.1, FLAME_BASE + TONGUE_H / 2, FIRE.z + 0.16)
  tongue.renderOrder = 7
  root.add(tongue)

  // the stone altar that holds the fire
  const altarPedMat = new MeshBasicNodeMaterial()
  altarPedMat.colorNode = vec3(0.004, 0.0032, 0.0026)
    .mul(oneMinus(smoothstep(-0.9, -0.5, positionWorld.y)).mul(0.5).add(0.5))
    .mul(uR)
  const pedestal = new Mesh(new CylinderGeometry(0.26, 0.38, 0.22, 20), altarPedMat)
  pedestal.position.set(FIRE.x, FLOOR_Y + 0.11, FIRE.z)
  root.add(pedestal)

  const bowlMat = new MeshBasicNodeMaterial()
  bowlMat.colorNode = mix(vec3(0.002, 0.0016, 0.0012), vec3(0.02, 0.011, 0.005), smoothstep(-0.78, -0.5, positionWorld.y)).mul(uR)
  const bowl = new Mesh(new CylinderGeometry(0.54, 0.24, 0.28, 24), bowlMat)
  bowl.position.set(FIRE.x, FLOOR_Y + 0.24, FIRE.z) // rim at -0.52
  root.add(bowl)

  // molten rim: the bowl's lip catches the flame
  const rimMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  rimMat.colorNode = vec3(GOLD.r, GOLD.g, GOLD.b)
  rimMat.opacityNode = sin(uT.mul(7.9)).mul(0.12).add(0.56).mul(uR)
  const rim = new Mesh(new TorusGeometry(0.53, 0.014, 8, 64), rimMat)
  rim.rotation.x = Math.PI / 2
  rim.position.set(FIRE.x, FLOOR_Y + 0.385, FIRE.z)
  rim.renderOrder = 5
  root.add(rim)

  // coals breathing inside the bowl
  const coalRand = mulberry32(FOUNDING_SEED + 8)
  const coalTex = glowTexture(
    [
      [0, 'rgba(255, 214, 140, 0.9)'],
      [0.25, 'rgba(240, 160, 64, 0.5)'],
      [0.6, 'rgba(150, 74, 20, 0.14)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ],
    coalRand
  )
  const coals: Array<{ s: Sprite; mat: SpriteMaterial; phase: number }> = []
  for (const [ox, oy, sc, ph] of [
    [-0.14, 0.02, 0.42, 0.0],
    [0.12, -0.01, 0.36, 2.1],
    [0.0, 0.05, 0.3, 4.2],
  ] as Array<[number, number, number, number]>) {
    const mat = new SpriteMaterial({
      map: coalTex,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    })
    const s = new Sprite(mat)
    s.position.set(FIRE.x + ox, FLOOR_Y + 0.42 + oy, FIRE.z + 0.05)
    s.scale.set(sc, sc * 0.8, 1)
    s.renderOrder = 6
    root.add(s)
    coals.push({ s, mat, phase: ph })
  }

  // one quiet breath of warm air above the flame (tight; darkness holds the edges)
  const airMat = new SpriteMaterial({
    map: glowTexture(
      [
        [0, 'rgba(224, 169, 84, 0.20)'],
        [0.5, 'rgba(180, 120, 50, 0.06)'],
        [1, 'rgba(0, 0, 0, 0)'],
      ],
      coalRand
    ),
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  })
  const air = new Sprite(airMat)
  air.position.set(FIRE.x, 0.3, FIRE.z)
  air.scale.set(1.8, 1.5, 1)
  air.renderOrder = 8
  root.add(air)

  // ------------------------------------------------------------------
  // 4 · THE ANSWER IN THE STONE — the flame's true twin: the same node
  //     graph flipped, dimmed and fading with height, hung below the
  //     floor plane exactly where reflection geometry puts it
  // ------------------------------------------------------------------
  const REFL_W = FLAME_W * 1.1
  const REFL_H = FLAME_H * 1.18
  const reflMat = flameMaterial(true, 0.2, 0)
  reflMat.depthTest = false
  const refl = new Mesh(flameGeo, reflMat)
  refl.scale.set(REFL_W, REFL_H, 1)
  refl.position.set(FIRE.x, 2 * FLOOR_Y - FLAME_BASE - REFL_H / 2, FIRE.z)
  refl.renderOrder = 4
  root.add(refl)

  // a soft glossy wash around the streak: polish, not paint
  const washMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const cu = uv().sub(vec2(0.5, 0.5))
    const d = length(vec2(cu.x.mul(1.6), cu.y))
    const a = oneMinus(smoothstep(0.06, 0.5, d)).mul(0.075)
    const shim = mx_noise_float(vec3(uv().x.mul(5), uv().y.mul(5), uT.mul(0.4))).mul(0.2).add(0.9)
    washMat.colorNode = vec3(GOLD.r, GOLD.g, GOLD.b)
    washMat.opacityNode = a.mul(shim).mul(uR).add(dither)
  }
  const wash = new Mesh(new PlaneGeometry(3.4, 3.6), washMat)
  wash.rotation.x = -Math.PI / 2
  wash.position.set(FIRE.x, FLOOR_Y + 0.008, -4.3)
  wash.renderOrder = 3
  root.add(wash)

  // ------------------------------------------------------------------
  // 4b · THE ENGRAVED CIRCLES — two rings cut into the stone around the
  //      fire (where the council sits), catching the firelight faintly
  // ------------------------------------------------------------------
  function inlayRing(radius: number, width: number, strength: number): void {
    const mat = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const dxz = length(positionWorld.xz.sub(vec2(FIRE.x, FIRE.z)))
    const fireFall = float(5.2).div(dxz.mul(dxz).add(1.4))
    const flick = sin(uT.mul(5.9).add(dxz.mul(2.1))).mul(0.1).add(0.9)
    mat.colorNode = vec3(GOLD.r, GOLD.g, GOLD.b)
    mat.opacityNode = fireFall.mul(flick).mul(strength).mul(uR).add(dither.mul(0.3))
    const ring = new Mesh(new RingGeometry(radius - width, radius, 128), mat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(FIRE.x, FLOOR_Y + 0.006, FIRE.z)
    ring.renderOrder = 3
    root.add(ring)
  }
  inlayRing(1.9, 0.028, 0.05)
  inlayRing(3.05, 0.018, 0.022)

  // ------------------------------------------------------------------
  // 5 · THE COLONNADE — a far arc of carved shafts, rim-lit by the fire
  // ------------------------------------------------------------------
  const colMat = new MeshBasicNodeMaterial()
  {
    const toFire = normalize(vec3(FIRE.x, FIRE.y, FIRE.z).sub(positionWorld))
    // a narrow rim: only the fire-facing edge catches, the shaft stays ink
    const ndl = clamp(dot(normalWorld, toFire), 0, 1).pow(3.2)
    const dist = length(positionWorld.sub(vec3(FIRE.x, FIRE.y, FIRE.z)))
    const fall = float(5.6).div(dist.mul(dist).add(2.0))
    const vert = oneMinus(smoothstep(-0.8, 2.4, positionWorld.y)).pow(1.3).mul(0.9).add(0.1)
    const flick = sin(uT.mul(6.7).add(positionWorld.x.mul(1.3))).mul(0.08).add(0.92)
    const glow = ndl.mul(fall).mul(vert).mul(flick).mul(0.52)
    // the lapis night rests on the upper shafts: a cool lift toward the
    // capitals so the stone reads round against the sky, not flat
    const skyLift = smoothstep(0.6, 4.4, positionWorld.y).mul(0.14)
    const lapis = vec3(0.1, 0.16, 0.34)
    colMat.colorNode = vec3(COLUMN_INK.r, COLUMN_INK.g, COLUMN_INK.b)
      .mul(0.7)
      .add(lapis.mul(skyLift))
      .add(vec3(GOLD.r, GOLD.g, GOLD.b).mul(glow))
      .add(dither.mul(0.02))
      .mul(uR)
  }
  // plinths sit square to the fire's light and would blaze if they shared
  // the shaft's wrap: give them a quieter stone of their own
  const plinthMat = new MeshBasicNodeMaterial()
  {
    const toFire = normalize(vec3(FIRE.x, FIRE.y, FIRE.z).sub(positionWorld))
    const ndl = clamp(dot(normalWorld, toFire), 0, 1).pow(2.0)
    const dist = length(positionWorld.sub(vec3(FIRE.x, FIRE.y, FIRE.z)))
    const fall = float(5.6).div(dist.mul(dist).add(2.0))
    const flick = sin(uT.mul(6.7).add(positionWorld.x.mul(1.3))).mul(0.08).add(0.92)
    const glow = ndl.mul(fall).mul(flick).mul(0.045)
    plinthMat.colorNode = vec3(COLUMN_INK.r, COLUMN_INK.g, COLUMN_INK.b)
      .mul(0.85)
      .add(vec3(GOLD.r, GOLD.g, GOLD.b).mul(glow))
      .add(dither.mul(0.02))
      .mul(uR)
  }
  const shaftGeo = new CylinderGeometry(0.21, 0.27, 5.4, 18)
  const plinthGeo = new BoxGeometry(0.72, 0.22, 0.72)
  // the capital: a flared echinus under a square abacus, then the
  // architrave chords crown the arc and the posts become architecture
  const echinusGeo = new CylinderGeometry(0.3, 0.22, 0.12, 18)
  const abacusGeo = new BoxGeometry(0.56, 0.1, 0.56)
  const COL_R = 10.6
  const COL_ANGLES = [-62, -44, -30, -19, -9, 9, 19, 30, 44, 62]
  const SHAFT_TOP = FLOOR_Y + 0.22 + 5.4 // plinth crown to shaft crown
  for (const deg of COL_ANGLES) {
    const a = (deg * Math.PI) / 180
    const x = Math.sin(a) * COL_R
    const z = -Math.cos(a) * COL_R
    const shaft = new Mesh(shaftGeo, colMat)
    shaft.position.set(x, FLOOR_Y + 2.92, z)
    root.add(shaft)
    const plinth = new Mesh(plinthGeo, plinthMat)
    plinth.position.set(x, FLOOR_Y + 0.11, z)
    plinth.rotation.y = -a
    root.add(plinth)
    const echinus = new Mesh(echinusGeo, colMat)
    echinus.position.set(x, SHAFT_TOP + 0.06, z)
    root.add(echinus)
    const abacus = new Mesh(abacusGeo, plinthMat)
    abacus.position.set(x, SHAFT_TOP + 0.17, z)
    abacus.rotation.y = -a
    root.add(abacus)
  }
  // architrave: one quiet beam per neighboring pair, spanning the chord.
  // The two nine-degree gaps flanking the fire stay open: the arc breathes
  // where the visitor's gaze passes through it.
  for (let i = 0; i < COL_ANGLES.length - 1; i++) {
    const d0 = COL_ANGLES[i]
    const d1 = COL_ANGLES[i + 1]
    if (d0 === undefined || d1 === undefined) continue
    if (d0 === -9 && d1 === 9) continue // the open lintel behind the fire
    const a0 = (d0 * Math.PI) / 180
    const a1 = (d1 * Math.PI) / 180
    const mid = (a0 + a1) / 2
    const chord = 2 * COL_R * Math.sin(Math.abs(a1 - a0) / 2)
    const beam = new Mesh(new BoxGeometry(chord + 0.3, 0.3, 0.44), plinthMat)
    beam.position.set(Math.sin(mid) * COL_R, SHAFT_TOP + 0.37, -Math.cos(mid) * COL_R)
    beam.rotation.y = -mid
    root.add(beam)
  }

  // ------------------------------------------------------------------
  // 6 · EMBERS BECOME STARS — a deterministic plume, gold cooling to
  //     star-white as it climbs (pure function of elapsed: the rig's
  //     frozen clock and the live loop see the same sky)
  // ------------------------------------------------------------------
  const emberRand = mulberry32(FOUNDING_SEED + 55)

  interface Ascender {
    speed: number
    phase: number
    a0: number
    rad0: number
  }
  const ASC_N = 56
  const ASC_H = 6.6
  const ascenders: Ascender[] = []
  for (let i = 0; i < ASC_N; i++) {
    ascenders.push({
      speed: 0.5 + emberRand() * 0.55,
      phase: emberRand() * ASC_H,
      a0: emberRand() * Math.PI * 2,
      rad0: 0.06 + emberRand() * 0.16,
    })
  }
  const ascGeo = new BufferGeometry()
  ascGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(ASC_N * 3), 3))
  ascGeo.setAttribute('color', new Float32BufferAttribute(new Float32Array(ASC_N * 3), 3))
  const ascMat = new PointsMaterial({
    size: 0.055,
    sizeAttenuation: true,
    vertexColors: true,
    color: new Color(1.55, 1.45, 1.3),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const ascPoints = new Points(ascGeo, ascMat)
  ascPoints.renderOrder = 9
  root.add(ascPoints)

  interface Spark {
    speed: number
    phase: number
    ox: number
    wob: number
  }
  const SPK_N = 26
  const SPK_H = 1.8
  const sparks: Spark[] = []
  for (let i = 0; i < SPK_N; i++) {
    sparks.push({
      speed: 1.5 + emberRand() * 1.1,
      phase: emberRand() * SPK_H,
      ox: (emberRand() - 0.5) * 0.34,
      wob: 4 + emberRand() * 4,
    })
  }
  const spkGeo = new BufferGeometry()
  spkGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(SPK_N * 3), 3))
  const spkMat = new PointsMaterial({
    color: new Color(1.5, 1.36, 1.06),
    size: 0.034,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const spkPoints = new Points(spkGeo, spkMat)
  spkPoints.renderOrder = 9
  root.add(spkPoints)

  // ------------------------------------------------------------------
  // update
  // ------------------------------------------------------------------
  const emberCold = EMBER_GOLD
  const emberWhite = STAR_WHITE
  function update(s: AgoraState): void {
    root.visible = s.reveal > 0.01
    if (!root.visible) return

    const r = s.reveal
    const t = s.elapsed
    uT.value = t
    uR.value = r

    // one fire, many flickers: the source stays steady, the light it throws
    // trembles a little more. All motion is sine-woven and deterministic.
    const sp = s.speak ?? 0
    const bz = s.blaze ?? 0
    const fl =
      0.76 + 0.12 * Math.sin(t * 7.1) + 0.07 * Math.sin(t * 11.7 + 1.3) + 0.05 * Math.sin(t * 19.3 + 4.1)
    uFlame.value = r * (0.82 + 0.18 * fl) * (1 + 0.1 * sp) * (1 + 0.28 * bz)
    uLean.value = 0.03 * Math.sin(t * 0.42) + 0.015 * Math.sin(t * 1.1 + 2)

    // the flame breathes in scale as well as in noise: deeper while its
    // keeper speaks, and it rises hearth-to-blaze when the council sits
    const breath = 1 + (0.035 + 0.02 * sp) * Math.sin(t * 2.1) + 0.02 * Math.sin(t * 3.7 + 1.1)
    const rise = 1 + 0.42 * bz
    const wide = 1 + 0.16 * bz
    flame.scale.set(FLAME_W * wide, FLAME_H * breath * rise, 1)
    flame.position.y = FLAME_BASE + (FLAME_H * breath * rise) / 2
    tongue.scale.set(TONGUE_W * wide, TONGUE_H * breath * rise, 1)
    tongue.position.y = FLAME_BASE + (TONGUE_H * breath * rise) / 2
    refl.scale.set(REFL_W * wide, REFL_H * breath * rise, 1)
    refl.position.y = 2 * FLOOR_Y - FLAME_BASE - (REFL_H * breath * rise) / 2

    dustFar.mat.opacity = 0.75 * r
    dustNear.mat.opacity = 0.3 * r
    dustGold.mat.opacity = 0.42 * r
    dustEdge.mat.opacity = 0.3 * r

    for (const c of coals) {
      c.mat.opacity = r * (0.66 + 0.22 * Math.sin(t * 2.3 + c.phase))
    }
    airMat.opacity = r * (0.24 + 0.06 * Math.sin(t * 1.7))

    // ascenders: helix upward, cool from ember-gold to star-white
    {
      const pos = ascGeo.getAttribute('position')
      const col = ascGeo.getAttribute('color')
      for (let i = 0; i < ASC_N; i++) {
        const e = ascenders[i]
        if (!e) continue
        const k = (((t * e.speed + e.phase) % ASC_H) + ASC_H) % ASC_H / ASC_H
        const y = FLOOR_Y + 0.42 + k * ASC_H
        const ang = e.a0 + t * 0.22 + k * 2.6
        const rad = Math.min(0.6, e.rad0 + Math.pow(k, 1.4) * 0.62)
        pos.setXYZ(i, FIRE.x + Math.cos(ang) * rad, y, FIRE.z + Math.sin(ang) * rad * 0.55)
        const ignite = Math.min(1, k / 0.05)
        const cool = 1 - 0.36 * Math.min(1, k * 1.8)
        const white = k < 0.55 ? 0 : (k - 0.55) / 0.45
        const fade = 1 - Math.max(0, (k - 0.9) / 0.1) * 0.8
        const b = ignite * (cool + white * 0.28) * fade
        col.setXYZ(
          i,
          (emberCold.r + (emberWhite.r - emberCold.r) * white) * b,
          (emberCold.g + (emberWhite.g - emberCold.g) * white) * b,
          (emberCold.b + (emberWhite.b - emberCold.b) * white) * b
        )
      }
      pos.needsUpdate = true
      col.needsUpdate = true
      ascMat.opacity = 0.9 * r * (1 + 0.35 * bz)
    }

    // sparks: quick bright leaps just above the flame
    {
      const pos = spkGeo.getAttribute('position')
      for (let i = 0; i < SPK_N; i++) {
        const e = sparks[i]
        if (!e) continue
        const k = (((t * e.speed + e.phase) % SPK_H) + SPK_H) % SPK_H / SPK_H
        const y = FLOOR_Y + 0.5 + k * SPK_H
        const x = FIRE.x + e.ox * (0.4 + k) + Math.sin(t * e.wob + e.phase * 9) * 0.05 * k
        pos.setXYZ(i, x, y, FIRE.z + Math.cos(t * e.wob * 0.7 + e.phase * 7) * 0.06 * k)
      }
      pos.needsUpdate = true
      spkMat.opacity = (0.75 - 0.35 * (0.5 + 0.5 * Math.sin(t * 5.3))) * r
    }
  }

  return { update }
}
