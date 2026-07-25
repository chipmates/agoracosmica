/* HIS SKY — the Wisdom Map of Marcus Aurelius, as a living concept page.
   The classic map's truth (12 seeds, bloom levels 0..4 earned through
   story / dialogue / prism / quest) becomes his own constellation: a
   STOIC TAURUS of twelve stars over the night, each bloom stage a
   visibly richer form of light, hairlines binding neighbours as they
   waken. The demo timeline shows the whole life of the sign; the real
   build reads the classic storage keys and the dusk falls over his day
   cosmos (COSMOS-CONTRACT §6). The sign itself is the shared organ in
   core/sign.ts (the camp raises the same one).

   THE PASS OF 2026-07-25 — the page was a diagram on fog: three vast
   additive sprites washing the frame pale, a banded vertex-coloured
   dome, a star field whose river ran somewhere off-screen, and twelve
   dots that never said WHY one of them was further along than another.
   Four things fix that, and they are the whole of this file:

   1. THE NIGHT IS A DEPTH, not a backdrop. The dome is a shader now:
      abyss overhead, lapis through the body, a navy lift at the base,
      the river's own nebulosity carved by its rift, one low ember at a
      single bearing, and dither on every gradient.
   2. THE RIVER IS COMPOSED. The firmament organ picks its band from the
      hand it is given, so the hand is SEARCHED until the night it deals
      crosses this frame on the diagonal. The organ is never touched.
   3. THE FIGURE IS DRAWN. An old-atlas bull is engraved into a canvas
      and hung behind the stars, and it is visible only where a wakened
      seed's light falls on it. The chain stops being twelve segments
      and becomes one figure, earned.
   4. THE STAGE IS COUNTABLE. Four petals ride every seed, one for each
      way of knowing it. Three petals lit is three ways walked, and the
      legend below says it in the same light. */

import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointsNodeMaterial,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu'
import {
  abs,
  clamp,
  dot,
  float,
  fract,
  instancedBufferAttribute,
  length,
  min,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  normalize,
  oneMinus,
  positionLocal,
  pow,
  screenCoordinate,
  sin,
  smoothstep,
  texture,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
} from 'three/tsl'
import { mulberry32, FOUNDING_SEED } from './core/seed'
import { createSign } from './core/sign'
import { createFirmament } from './core/firmament'
import { STOIC_TAURUS } from './content/signs'

/* the TSL runtime chains and swizzles fine; its generated typings do not
   follow a graph built out of helpers — the same boundary escape the
   firmament and every camp surface take */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

// ---------------------------------------------------------------- the light
/* craft law: every hand-picked colour is authored as a hex through three's
   Color, which hands back the LINEAR working values the shaders want */
const lin = (hex: string): Color => new Color(hex)
const c3 = (c: Color, k = 1): N => vec3(c.r * k, c.g * k, c.b * k)
const hex3 = (h: string, k = 1): N => c3(lin(h), k)

const GOLD = lin('#e0b96a')
const EMBER = lin('#8a6a3a')
const STARLIGHT = lin('#f3efe2')

/** dither every gradient at creation: the sRGB step is enormous down in
    the abyss values, and a banded night is a printed night */
const dither = (amp: number): N =>
  fract(sin(dot(screenCoordinate.xy.add(0.5), vec2(12.9898, 78.233))).mul(43758.5453))
    .sub(0.5)
    .mul(amp)

/** a soft rolloff on the bright end only, so the darks stay exactly where
    they were authored and a bloomed star never blows to a white hole */
const shoulder = (c: N): N => c.div(float(1).add(c.mul(0.42)))

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1e-6)))
  return t * t * (3 - 2 * t)
}

const TAU = Math.PI * 2
/** the eye is tilted up into his sky and never moves from it */
const PITCH = 0.24

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const stage = document.getElementById('stage')
if (!stage) throw new Error('missing stage')

const scene = new Scene()
const camera = new PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 400)
camera.position.set(0, 0, 0)

const wantWebGPU = location.search.includes('webgpu') && 'gpu' in navigator
const renderer = new WebGPURenderer({ antialias: true, forceWebGL: !wantWebGPU })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
stage.appendChild(renderer.domElement)

/** a phone is a third of a desktop's width and the sky is sized in logical
    pixels, so the same mote owns four times the frame there */
const glassScale = (): number => Math.max(0.68, Math.min(1, Math.sqrt(innerWidth / 900)))
const narrow = (): boolean => innerWidth / innerHeight < 0.9

// the world's seeded hand (determinism law: the rig sees the same night
// twice), and a second hand for the craft this page adds on top, so
// nothing here can shift the sign's own seats
const worldRand = mulberry32(FOUNDING_SEED + 144)
const craftRand = mulberry32(FOUNDING_SEED + 909)

// ------------------------------------------------------------ the geometry
// of looking: everything this page composes is placed by the angle it
// makes with the eye, never by a world coordinate nobody can picture
function skyDir(yaw: number, pitch: number): Vector3 {
  const d = new Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  )
  return d.applyAxisAngle(new Vector3(1, 0, 0), PITCH)
}
const dirFrom = (y: number, th: number): Vector3 => {
  const ph = Math.acos(Math.max(-1, Math.min(1, y)))
  return new Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th))
}

/* THE RIVER MUST CROSS THIS FRAME. The firmament deals its band from the
   hand it is handed (its first two draws are the band's azimuth and its
   tilt), so the hand is searched until the night it deals runs its river
   through a point below the sign, on the diagonal. Composition by
   selection, never by reaching into the organ. */
function riverHand(): { rand: () => number; normal: Vector3 } {
  const tanV = Math.tan(((46 / 2) * Math.PI) / 180)
  const aspect = innerWidth / innerHeight
  const target = skyDir(-Math.atan(0.22 * tanV * aspect), -Math.atan(0.3 * tanV))
  const up = new Vector3(0, 1, 0).applyAxisAngle(new Vector3(1, 0, 0), PITCH)
  const right = new Vector3(1, 0, 0)
  let bestSeed = 0
  let bestScore = -Infinity
  let bestN = new Vector3(0, 1, 0)
  for (let s = 0; s < 512; s++) {
    const r = mulberry32(FOUNDING_SEED + 144 + s * 7919)
    // the organ's own first two draws, in the organ's own order: the
    // band's azimuth, then how far its plane leans off the horizon
    const az = r() * TAU
    const el = 0.35 + r() * 0.26
    const n = dirFrom(Math.sin(el), az)
    const cross = Math.abs(n.dot(target))
    const t = new Vector3().crossVectors(n, target).normalize()
    const ang = Math.atan2(Math.abs(t.dot(up)), Math.abs(t.dot(right)))
    const score = -cross * 12 - Math.abs(ang - 0.95) * 2
    if (score > bestScore) {
      bestScore = score
      bestSeed = s
      bestN = n
    }
  }
  return { rand: mulberry32(FOUNDING_SEED + 144 + bestSeed * 7919), normal: bestN }
}
const river = riverHand()

// ------------------------------------------------------------------ THE SKY
/* Night is a DEPTH: abyss ink overhead, lapis through the body, a navy
   lift where the air thickens at the base, and ONE low ember at a single
   bearing (the last of a day that ended somewhere behind this sky). The
   river's own nebulosity rides the same plane the star band does, so the
   dust and the stars are one structure and not two. */
function skyMaterial(): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial()
  mat.side = BackSide
  mat.depthWrite = false
  const d: N = varying(normalize(positionLocal))
  const h = d.y

  const body = hex3('#0C1430', 0.92)
  const zenith = hex3('#05081A', 0.86)
  const base = hex3('#131C44', 0.66)
  let col: N = mix(body, zenith, smoothstep(0.16, 0.86, h))
  col = mix(col, base, pow(clamp(oneMinus(h.mul(3.4)), 0, 1), 2.1))

  // THE RIVER'S LIGHT: unresolved dust, brightest on the band's own plane,
  // clouded and cut by a rift, and never more than a whisper above the
  // body value. It is the same plane the field's band was seeded on.
  const bn = vec3(river.normal.x, river.normal.y, river.normal.z)
  const off = dot(d, bn)
  const spine = pow(oneMinus(min(abs(off).div(0.34), 1)), 2.2)
  const clouds = mx_fractal_noise_float(d.mul(2.3), 4, 2.0, 0.55, 1.0).mul(0.5).add(0.5)
  const rift = smoothstep(0.06, 0.0, abs(off)).mul(0.55)
  const dust = spine.mul(float(0.35).add(clouds.mul(0.65))).mul(oneMinus(rift))
  col = col.add(hex3('#28345F', 0.30).mul(dust))
  // and the dark lane in front of it: a river without a rift is a smear
  col = col.mul(oneMinus(spine.mul(rift).mul(0.5)))

  // THE ONE EMBER: low, narrow, at a single bearing on the ground plane.
  // A 3D dot would stay high across the whole sky and smear the flanks.
  const dh = normalize(vec2(d.x, d.z).add(vec2(0.00001, 0.00001)))
  const azh = dot(dh, vec2(-0.82, -0.57)).max(0)
  const low = smoothstep(0.12, -0.18, h)
  col = col.add(hex3('#C4611E', 0.05).mul(pow(azh, 12)).mul(low))
  // purple is ATMOSPHERE ONLY: just above the ember, narrow, and only just
  col = col.add(hex3('#3B2E5E', 0.022).mul(pow(azh, 8)).mul(smoothstep(0.16, -0.06, h)))
  // slow strata carved out of the whole dome, never a band
  col = col.mul(float(1).add(mx_noise_float(vec3(d.x.mul(3.1), d.y.mul(6.4), 1.7)).mul(0.05)))
  mat.colorNode = shoulder(col).add(dither(0.004))
  return mat
}
{
  const dome = new Mesh(new SphereGeometry(120, 48, 32), skyMaterial())
  dome.renderOrder = -2
  dome.frustumCulled = false
  scene.add(dome)
}

// ------------------------------------------------------------ THE FIRMAMENT
// the standard organ (core/firmament.ts), dealt the searched hand so its
// river runs through this frame; the field is choir, the sign is soloist
const firmament = createFirmament({
  count: narrow() ? 2100 : 2600,
  far: [60, 180],
  near: [24, 64],
  bias: 'zenith',
  heroes: narrow() ? 9 : 13,
  rand: river.rand,
})
scene.add(firmament.points)

// ------------------------------------------------- the instanced light field
/* Every repeated point of light on this page is ONE draw call. Sized
   particle fields ride instanced quads: three ignores sizeNode on Points,
   a lesson this codebase paid for once already. */
interface GlowField {
  sprite: Sprite
  pos: Float32Array
  col: Float32Array
  siz: Float32Array
  glow: Float32Array
  commit(): void
}

function glowField(count: number, profile: (rr: N) => N, uScale: N): GlowField {
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const siz = new Float32Array(count)
  const glow = new Float32Array(count)
  const aPos = new InstancedBufferAttribute(pos, 3)
  const aCol = new InstancedBufferAttribute(col, 3)
  const aSiz = new InstancedBufferAttribute(siz, 1)
  const aGlow = new InstancedBufferAttribute(glow, 1)
  const mat = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  mat.positionNode = instancedBufferAttribute(aPos)
  mat.sizeAttenuation = false
  mat.sizeNode = (instancedBufferAttribute(aSiz) as N).mul(uScale)
  mat.colorNode = instancedBufferAttribute(aCol) as N
  const rr = min(length(uv().sub(vec2(0.5, 0.5))).mul(2), float(1))
  mat.opacityNode = profile(rr).mul(instancedBufferAttribute(aGlow) as N)
  const sprite = new Sprite(mat)
  sprite.count = count
  sprite.frustumCulled = false
  return {
    sprite,
    pos,
    col,
    siz,
    glow,
    commit() {
      aPos.needsUpdate = true
      aCol.needsUpdate = true
      aSiz.needsUpdate = true
      aGlow.needsUpdate = true
    },
  }
}

/** a point of light: a tight core inside a soft skirt, never a flat pellet */
const moteProfile = (rr: N): N =>
  pow(oneMinus(rr), 2.4).mul(0.46).add(pow(oneMinus(rr), 8).mul(0.72))
/** a ring: light leaving, with no edge on either side of it */
const ringProfile = (rr: N): N => pow(oneMinus(min(abs(rr.sub(0.8)).div(0.19), 1)), 2.2)

const uGlass = uniform(glassScale())
const uWreathK = uniform(1)

// ------------------------------------------------------- THE DISTANT SIGNS
/* His is not the only life in this sky. Four faint asterisms sit out at
   the edges of looking, chained by the same hairline, none of them
   wakened: other figures, other maps, the same night. They are the reason
   the frame's corners stop being empty. */
{
  const SEATS: Array<[number, number, number]> = [
    // yaw and pitch from the eye's own centre, in degrees, and a spread
    [-27, 5, 5.5],
    [26, -9, 4.6],
    [-19, -15, 4.2],
    [6, 17.5, 5.0],
    [-6, -17, 3.8],
  ]
  const D = Math.PI / 180
  const stars: Vector3[] = []
  const links: number[] = []
  for (const [yaw, pitch, spread] of SEATS) {
    const n = 4 + Math.floor(craftRand() * 3)
    const first = stars.length
    // a walk, not a scatter: an asterism is a line the eye can follow
    let ry = yaw
    let rp = pitch
    for (let i = 0; i < n; i++) {
      ry += (craftRand() - 0.42) * spread
      rp += (craftRand() - 0.5) * spread
      stars.push(skyDir(ry * D, rp * D).multiplyScalar(78))
      if (i > 0) links.push(first + i - 1, first + i)
    }
  }
  const far = glowField(stars.length, moteProfile, uGlass)
  const tint = lin('#c9d6f2')
  stars.forEach((p, i) => {
    far.pos[i * 3] = p.x
    far.pos[i * 3 + 1] = p.y
    far.pos[i * 3 + 2] = p.z
    // one ember among the cool, the way a real asterism has its one giant
    const warm = craftRand() < 0.18
    const c = warm ? EMBER.clone().lerp(STARLIGHT, 0.5) : tint
    const dim = 0.3 + craftRand() * 0.42
    far.col[i * 3] = c.r * dim
    far.col[i * 3 + 1] = c.g * dim
    far.col[i * 3 + 2] = c.b * dim
    far.siz[i] = 2.1 + craftRand() * 2.0
    far.glow[i] = 1
  })
  far.commit()

  const lineGeo = new BufferGeometry()
  const lp: number[] = []
  for (const idx of links) {
    const p = stars[idx]
    if (p) lp.push(p.x, p.y, p.z)
  }
  lineGeo.setAttribute('position', new Float32BufferAttribute(lp, 3))
  const chain = new LineSegments(
    lineGeo,
    new LineBasicMaterial({
      color: lin('#5f6f9e'),
      transparent: true,
      opacity: 0.13,
      blending: AdditiveBlending,
      depthWrite: false,
    })
  )
  chain.frustumCulled = false
  const distant = new Group()
  distant.add(far.sprite, chain)
  // they turn with the heavens, at the firmament's own pace
  firmament.points.add(distant)
}

// ------------------------------------------------------------- THE ENGRAVING
/* THE STOIC TAURUS, drawn the way the old atlases drew a sign: the beast
   in fine line over the stars that make it. Every curve below is authored
   in the pattern's own space (0..100, y down, the classic map's frame), so
   the horns pass through the horn stars, the muzzle through the face star,
   the shoulder through the shoulder star, and the tuft through the tail.

   It is ONE canvas, drawn once, and it is never seen whole until the sign
   is: the material below reveals the ink only where a wakened seed's light
   reaches it. Twelve seeds earned is a bull; one seed earned is a horn
   coming out of the dark. */
const INK_WINDOW: [number, number, number, number] = [14, 10, 90, 88]

/** the plate itself, kept so the rig can look at the drawing on its own */
let inkPlate: HTMLCanvasElement | null = null

function engraveTaurus(): HTMLCanvasElement {
  const [x0, y0, x1, y1] = INK_WINDOW
  const W = 1024
  const H = Math.round((W * (y1 - y0)) / (x1 - x0))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const X = (x: number): number => ((x - x0) / (x1 - x0)) * W
  const Y = (y: number): number => ((y - y0) / (y1 - y0)) * H
  const K = W / (x1 - x0) // canvas pixels per pattern unit
  const m = (x: number, y: number): void => ctx.moveTo(X(x), Y(y))
  const l = (x: number, y: number): void => ctx.lineTo(X(x), Y(y))
  const q = (cx: number, cy: number, x: number, y: number): void =>
    ctx.quadraticCurveTo(X(cx), Y(cy), X(x), Y(y))
  const b = (
    ax: number, ay: number, bx: number, by: number, x: number, y: number
  ): void => ctx.bezierCurveTo(X(ax), Y(ay), X(bx), Y(by), X(x), Y(y))
  const ink = (alpha: number, width: number): void => {
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`
    ctx.lineWidth = width * K
    ctx.stroke()
  }

  /* THE POSE — a bull striding to the right, near foreleg planted, far
     foreleg thrown forward, head brought round far enough that both horns
     open across the sky. The pattern's twelve stars ask for exactly this
     and nothing else: two horn tips a whole frame apart, a muzzle star
     out to the right, a throat star under the jaw, then a chain running
     back along the withers, through the flank, down to the hind hoof, and
     forward again along the near foreleg to the raised one. All twelve
     land on him.

     What makes a bull a bull, and the drawings this replaced not one:
     the barrel carries twice the weight of the head, the neck is short
     and crested, the nose bridge is long and straight, and the whole
     animal reads in ONE direction. */
  const body = (): void => {
    ctx.beginPath()
    m(48.4, 33.6) // the poll, between the horn roots
    q(52.8, 34.2, 56.4, 36.0) // the forehead, out to the eye ridge
    q(60.4, 38.4, 63.4, 41.4) // the nose bridge: long, straight, bovine
    b(65.0, 43.0, 64.8, 45.0, 63.8, 46.2) // the muzzle: blunt, square, wide
    q(60.4, 47.0, 56.6, 45.8) // the mouth, back under the cheek
    q(54.2, 45.6, 53.0, 43.4) // the heavy jowl
    b(52.8, 47.2, 51.8, 50.4, 49.8, 53.4) // the throat, down to the chest
    q(51.4, 55.0, 52.0, 57.2) // the brisket, thrown forward
    b(53.0, 61.0, 53.8, 64.6, 54.6, 67.4) // the near foreleg, long and dry
    b(55.2, 68.8, 55.4, 70.0, 55.6, 71.2) // its cannon, down to the hoof
    q(53.6, 72.2, 52.8, 71.0) // the hoof itself
    q(52.6, 67.4, 51.4, 63.4)
    b(50.6, 60.6, 49.8, 58.6, 48.4, 57.8) // back up behind the leg
    b(45.0, 60.6, 40.4, 62.8, 35.4, 63.0) // the belly, run away to the left
    b(34.4, 66.2, 33.8, 68.8, 33.6, 71.6) // the hind leg, down to its hoof
    q(35.2, 72.6, 35.8, 71.2)
    q(35.8, 67.8, 35.4, 63.8) // the gaskin, up the back of the leg
    b(33.4, 61.2, 29.4, 59.0, 28.4, 54.6) // the buttock, heavy and round
    b(27.8, 50.4, 30.4, 47.2, 34.4, 46.4) // over the point of the rump
    b(38.6, 45.2, 41.8, 45.4, 44.6, 45.8) // the back, into the withers
    b(44.6, 41.6, 46.2, 36.8, 48.4, 33.6) // the neck's crest, home
    ctx.closePath()
  }
  // the mass first, barely there: a bull is a weight before it is a line
  body()
  ctx.fillStyle = 'rgba(255,255,255,0.016)'
  ctx.fill()
  body()
  ink(0.5, 0.17)

  /* THE FORELEG THROWN FORWARD — the whole stride is in this one limb,
     and it reaches the star nothing else could. */
  const reach = (): void => {
    ctx.beginPath()
    m(50.6, 55.0)
    b(54.0, 58.4, 57.0, 61.0, 59.4, 61.6) // forward, to the knee
    b(62.0, 60.0, 64.2, 57.0, 65.4, 54.2) // and up again, to the hoof star
    q(66.6, 52.2, 64.2, 51.4)
    b(62.4, 54.4, 60.2, 57.2, 57.6, 58.6)
    b(54.6, 57.8, 51.4, 54.6, 47.6, 50.8)
    ctx.closePath()
  }
  reach()
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  ctx.fill()
  reach()
  ink(0.44, 0.16)

  // THE WEIGHTED LINE — an engraver never draws one thickness. The lines
  // the light does not reach carry the weight: the underside of the
  // belly, the leading edge of the striding leg, the jaw.
  ctx.beginPath()
  m(48.4, 57.8)
  b(45.0, 60.6, 40.4, 62.8, 35.4, 63.0)
  ink(0.42, 0.25)
  ctx.beginPath()
  m(52.0, 57.2)
  b(53.0, 61.0, 53.8, 64.6, 54.6, 67.4)
  b(55.2, 68.8, 55.4, 70.0, 55.6, 71.2)
  ink(0.4, 0.23)
  ctx.beginPath()
  m(63.8, 46.2)
  q(60.4, 47.0, 56.6, 45.8)
  q(54.2, 45.6, 53.0, 43.4)
  ink(0.38, 0.21)

  /* THE HORNS — one runs forward over the brow and one back over the
     crest, the way a pair of horns does on a head brought round toward
     you, and each ends exactly on the star the pattern calls its tip. */
  const horn = (
    rx: number, ry: number,
    a1x: number, a1y: number, a2x: number, a2y: number,
    tx: number, ty: number,
    b1x: number, b1y: number, b2x: number, b2y: number,
    ex: number, ey: number
  ): void => {
    ctx.beginPath()
    m(rx, ry)
    b(a1x, a1y, a2x, a2y, tx, ty)
    b(b1x, b1y, b2x, b2y, ex, ey)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fill()
    ink(0.5, 0.15)
  }
  horn(52.0, 33.0, 57.0, 25.0, 64.6, 24.0, 70.2, 29.4, 66.0, 27.0, 60.0, 29.0, 54.2, 35.2)
  horn(47.8, 33.2, 42.8, 25.0, 35.4, 24.0, 29.8, 29.4, 34.2, 27.0, 40.2, 29.0, 46.2, 35.4)

  // the ear, the eye, the nostril: three marks, and the head is a head
  ctx.beginPath()
  m(47.2, 36.8)
  q(44.0, 36.6, 42.4, 38.6)
  q(44.8, 39.6, 47.0, 38.6)
  ink(0.36, 0.16)
  ctx.beginPath()
  m(55.2, 39.2)
  q(56.6, 38.4, 57.8, 39.6)
  ink(0.48, 0.2)
  ctx.beginPath()
  m(63.0, 43.8)
  q(64.0, 44.4, 63.4, 45.2)
  ink(0.36, 0.17)

  // the dewlap: the fold of throat that says bull and not horse
  ctx.beginPath()
  m(53.2, 44.8)
  b(52.4, 47.8, 51.4, 50.6, 50.0, 53.0)
  ink(0.28, 0.14)

  // the far legs, standing behind their pairs: the whole of depth in this
  // drawing is two limbs that are not quite the same limbs
  ctx.beginPath()
  m(50.4, 59.0)
  b(51.0, 62.8, 51.6, 66.4, 52.2, 70.0)
  ink(0.24, 0.16)
  ctx.beginPath()
  m(37.2, 63.2)
  b(37.0, 66.0, 36.8, 68.6, 36.6, 71.0)
  ink(0.2, 0.15)

  // the tail, hanging off the rump with its tuft
  ctx.beginPath()
  m(29.6, 48.2)
  b(26.6, 52.0, 25.4, 57.0, 26.4, 62.0)
  ink(0.4, 0.16)
  for (const [ax, ay] of [
    [25.4, 64.4],
    [27.6, 64.4],
    [25.8, 61.6],
  ] as Array<[number, number]>) {
    ctx.beginPath()
    m(26.4, 62.0)
    q((26.4 + ax) / 2 - 0.4, (62.0 + ay) / 2, ax, ay)
    ink(0.3, 0.13)
  }

  // the hooves: small weights, because an animal has to stand
  for (const [hx, hy, hw] of [
    [54.2, 71.5, 1.4],
    [34.6, 71.8, 1.4],
    [51.8, 70.3, 1.0],
    [36.8, 71.1, 0.9],
    [65.2, 52.6, 1.2],
  ] as Array<[number, number, number]>) {
    ctx.beginPath()
    ctx.ellipse(X(hx), Y(hy), hw * K * 0.5, hw * K * 0.34, 0, 0, TAU)
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.fill()
  }

  // THE HATCHING — an engraver's shadow. Short strokes ALONG the form,
  // never across it, and every one of them inside the line.
  const hatch = (
    ax: number, ay: number, bx: number, by: number,
    n: number, dx: number, dy: number, alpha: number
  ): void => {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1 || 1)
      const sx = ax + (bx - ax) * t
      const sy = ay + (by - ay) * t
      const k = Math.sin(Math.PI * (0.18 + 0.82 * t))
      ctx.beginPath()
      m(sx, sy)
      l(sx + dx * k, sy + dy * k)
      ink(alpha * (0.55 + 0.45 * k), 0.11)
    }
  }
  hatch(46.8, 38.6, 46.6, 44.2, 4, 2.4, 1.2, 0.2) // the crest of the neck
  hatch(33.8, 50.4, 43.2, 48.2, 6, 0.6, 3.2, 0.16) // the barrel's round
  hatch(36.4, 60.6, 44.6, 58.6, 4, 0.4, -2.6, 0.12) // and its underside
  hatch(30.0, 52.0, 31.6, 58.0, 4, 2.8, 0.8, 0.15) // the haunch
  hatch(45.6, 48.6, 47.4, 53.4, 3, 2.6, 1.0, 0.14) // the shoulder
  hatch(55.0, 43.4, 57.6, 44.8, 3, 1.0, -1.6, 0.13) // the jowl

  inkPlate = canvas
  return canvas
}

// where a seed sits inside the ink, so the engraving knows which star
// lights which part of the bull
function inkUV(i: number): [number, number] {
  const [x0, y0, x1, y1] = INK_WINDOW
  const seat = STOIC_TAURUS[i] ?? [50, 50]
  return [(seat[0] - x0) / (x1 - x0), 1 - (seat[1] - y0) / (y1 - y0)]
}

/* the sign's own fit: the pattern is normalized into a 26 x 19 frame with
   its aspect kept, which is the rule all thirty signs share. The ink has
   to obey the same k, or the drawing and the stars come apart. */
const SIGN_FRAME = { w: 26, h: 19 }
const fitK = (() => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of STOIC_TAURUS) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  return {
    k: Math.min(SIGN_FRAME.w / (maxX - minX), SIGN_FRAME.h / (maxY - minY)),
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  }
})()

const uInk = uniform(0)
const uInkT = uniform(0)
const uSeedLight = STOIC_TAURUS.map((_, i) => {
  const [u, v] = inkUV(i)
  return uniform(new Vector3(u, v, 0))
})

function inkMaterial(map: CanvasTexture, aspect: number): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  const t = uv()
  const mask = (texture(map, t) as N).r
  // the reveal: a seed's light falling on the plate. Aspect-corrected, so
  // the falloff is a circle in the world and not an ellipse on the paper.
  const p = vec2(t.x.mul(aspect), t.y)
  let litN: N = float(0)
  for (const s of uSeedLight) {
    const d = length(p.sub(vec2((s as N).x.mul(aspect), (s as N).y)))
    litN = litN.add(smoothstep(0.27, 0.0, d).mul((s as N).z))
  }
  const lit = clamp(litN, 0, 1)
  // gold only ever reflects: this is starlight caught on an engraved line
  const colour = mix(c3(EMBER, 0.42), c3(GOLD, 0.8), lit).add(
    c3(STARLIGHT, 0.24).mul(smoothstep(0.7, 1.0, lit))
  )
  // the line is not a wire: a slow grain runs along it, the way light
  // moves on anything gilded
  const grain = mx_noise_float(vec3(t.x.mul(7.0), t.y.mul(7.0), uInkT.mul(0.05)))
    .mul(0.16)
    .add(0.9)
  mat.colorNode = colour.mul(grain).add(dither(0.003))
  mat.opacityNode = mask.mul(float(0.055).add(lit.mul(0.945))).mul(uInk)
  return mat
}

// -------------------------------------------------------------- THE SIGN
const wreath = new Group()
wreath.position.set(0, 8.5, -34)
scene.add(wreath)

{
  const [x0, y0, x1, y1] = INK_WINDOW
  const w = (x1 - x0) * fitK.k
  const h = (y1 - y0) * fitK.k
  const map = new CanvasTexture(engraveTaurus())
  const plate = new Mesh(new PlaneGeometry(w, h), inkMaterial(map, w / h))
  plate.position.set(
    ((x0 + x1) / 2 - fitK.cx) * fitK.k,
    (fitK.cy - (y0 + y1) / 2) * fitK.k,
    -3.4
  )
  plate.renderOrder = -1
  plate.frustumCulled = false
  wreath.add(plate)
}

// the shared organ, raised in the concept's generous frame
const sign = createSign({
  pattern: STOIC_TAURUS,
  width: SIGN_FRAME.w,
  height: SIGN_FRAME.h,
  rand: worldRand,
})
wreath.add(sign.group)

// ---------------------------------------------------------- THE FOUR WAYS
/* Four petals ride every seed, one for each way of knowing it: the story,
   the dialogue, the prism, the quest. Petal k lights as the level crosses
   k+1, so a glance counts the stage instead of guessing it, and the four
   of them turn together the way anything in a sky turns. */
const PETALS = 4
const petals = glowField(STOIC_TAURUS.length * PETALS, moteProfile, uWreathK)
wreath.add(petals.sprite)
const petalPhase = STOIC_TAURUS.map(() => craftRand() * TAU)
const petalHue = Array.from({ length: PETALS }, (_, k) =>
  GOLD.clone().lerp(STARLIGHT, k * 0.3)
)

/* one ring leaves a seed the night it comes into full bloom, and never
   again. Nothing here pulses: it happens once, it means something. */
const ripples = glowField(STOIC_TAURUS.length, ringProfile, uGlass)
wreath.add(ripples.sprite)
const rippleAge = STOIC_TAURUS.map(() => -1)
const wasBloomed = STOIC_TAURUS.map(() => false)

/* THE CURRENT — touch a star and its light runs down the chain to the two
   seeds it is bound to. The binding is one drawn figure, and this is the
   moment a visitor can watch it be one. */
const currents = glowField(2, moteProfile, uWreathK)
wreath.add(currents.sprite)
let currentAge = -1

/* THE CROWN — what touching a star looks like. A ring of twelve ticks,
   turning slowly, that sits on the seed the visitor has in hand. */
function crownTexture(): CanvasTexture {
  const s = 256
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  if (!ctx) return new CanvasTexture(canvas)
  ctx.translate(s / 2, s / 2)
  ctx.strokeStyle = 'rgba(224, 185, 106, 0.62)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.34, 0, TAU)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(246, 223, 174, 0.9)'
  ctx.lineWidth = 2.2
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU
    const r0 = s * 0.34
    const r1 = r0 + (i % 3 === 0 ? s * 0.06 : s * 0.032)
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
    ctx.stroke()
  }
  return new CanvasTexture(canvas)
}
const crownMat = new SpriteMaterial({
  map: crownTexture(),
  color: GOLD,
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
})
const crown = new Sprite(crownMat)
crown.scale.setScalar(4.4)
crown.visible = false
wreath.add(crown)

// ---- the demo timeline: an authored life of the sign ----
// order in which the nights waken (a believable learning path)
const WAKE_ORDER = [2, 1, 3, 0, 4, 8, 7, 9, 5, 10, 6, 11]
let demoT = reducedMotion ? 1 : 0 // 0..1 across the whole life
let autoPlay = !reducedMotion
let held: number | null = reducedMotion ? 1 : null

function levelsAt(t: number): number[] {
  // each seed rises 0->4 along its own staggered window
  const lv: number[] = new Array(12).fill(0)
  for (let k = 0; k < WAKE_ORDER.length; k++) {
    const idx = WAKE_ORDER[k] ?? 0
    const start = k * 0.06
    const span = 0.3
    const p = Math.min(1, Math.max(0, (t - start) / span))
    lv[idx] = p * 4
  }
  return lv
}
if (reducedMotion) {
  sign.snap(levelsAt(1))
  // a composed scene, and not twelve rings leaving it at once
  for (let i = 0; i < wasBloomed.length; i++) wasBloomed[i] = true
}

const seedLabel = document.getElementById('seed-label')
const nightLine = document.getElementById('night-line')

// what the visitor has in hand: a star hovered, a star opened
let hover: number | null = null
let selected: number | null = null
let yielded = 0

// the eye's own drift: two degrees of parallax, so the sign has depth and
// the night sits behind it instead of on it
let aimX = 0
let aimY = 0
let panX = 0
let panY = 0
if (!reducedMotion) {
  addEventListener('pointermove', (e) => {
    aimX = (e.clientX / innerWidth - 0.5) * 2
    aimY = (e.clientY / innerHeight - 0.5) * 2
  })
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
  uGlass.value = glassScale()
})

async function boot(): Promise<void> {
  try {
    await renderer.init()
  } catch {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<p style="position:fixed;inset:40% 0;text-align:center;font:12px sans-serif;color:#8d93ad">This concept needs a newer browser.</p>'
    )
    return
  }

  // the real twelve from R2 (title + summary + quote feed the panel)
  interface SeedData {
    title?: string
    summary?: string
    quote?: string
  }
  let seedData: SeedData[] = Array.from({ length: 12 }, (_, i) => ({ title: `Seed ${i + 1}` }))
  try {
    const res = await fetch('https://media.agoracosmica.org/seeds/en/aurelius-seeds.json')
    const data = (await res.json()) as { seeds?: SeedData[] }
    if (data.seeds) seedData = data.seeds.slice(0, 12)
  } catch {
    /* the sign still grows */
  }
  const titles = seedData.map((d, i) => d.title ?? `Seed ${i + 1}`)

  // ---- selectable seeds: every star opens its own letterpress ----
  const seedButtons = document.getElementById('seed-buttons')
  const seedPanel = document.getElementById('seed-panel')
  const btns: HTMLButtonElement[] = []
  function openSeed(i: number): void {
    if (!seedPanel) return
    const d = seedData[i]
    const k = seedPanel.querySelector('.panel-kicker')
    const t = seedPanel.querySelector('.panel-title')
    const sm = seedPanel.querySelector('.panel-summary')
    const q = seedPanel.querySelector('.panel-quote')
    if (k) k.textContent = `Seed ${i + 1} · The Stoic Taurus`
    if (t) t.textContent = d?.title ?? `Seed ${i + 1}`
    if (sm) sm.textContent = d?.summary ?? ''
    if (q) q.textContent = d?.quote ? `“${d.quote}”` : ''
    seedPanel.hidden = false
    selected = i
    // touching a star sends one ring out from it, and its light down the
    // chain to the seeds it is bound to
    rippleAge[i] = 0
    if (!reducedMotion) currentAge = 0
  }
  function closeSeed(): void {
    if (seedPanel) seedPanel.hidden = true
    selected = null
  }
  seedPanel?.querySelector('.panel-close')?.addEventListener('click', closeSeed)
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSeed()
  })
  if (seedButtons) {
    for (let i = 0; i < 12; i++) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'seed-btn'
      b.setAttribute('aria-label', titles[i] ?? `Seed ${i + 1}`)
      b.addEventListener('click', () => openSeed(i))
      b.addEventListener('pointerenter', () => (hover = i))
      b.addEventListener('pointerleave', () => {
        if (hover === i) hover = null
      })
      b.addEventListener('focus', () => (hover = i))
      b.addEventListener('blur', () => {
        if (hover === i) hover = null
      })
      seedButtons.appendChild(b)
      btns.push(b)
    }
  }

  const stages = Array.from(document.querySelectorAll('#stages button'))
  for (const b of stages) {
    b.addEventListener('click', () => {
      for (const o of stages) o.classList.remove('here')
      b.classList.add('here')
      const v = (b as HTMLElement).dataset['stage']
      if (v === 'auto') {
        autoPlay = true
        held = null
      } else {
        autoPlay = false
        held = v === '0' ? 0.04 : v === '1' ? 0.45 : 1
      }
    })
  }

  // the rig's hand
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__hisSky = {
    set(t: number) {
      autoPlay = false
      held = t
    },
    /** the rig's eye on the engraving itself, at full contrast */
    ink: () => inkPlate?.toDataURL(),
  }

  let last = performance.now()
  const proj = new Vector3()
  function project(star: Group): Vector3 {
    star.updateWorldMatrix(true, false)
    return proj.setFromMatrixPosition(star.matrixWorld).project(camera)
  }
  function frame(now: number): void {
    requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const elapsed = now / 1000

    if (autoPlay) demoT = (demoT + dt / 26) % 1.12
    else if (held !== null) demoT += (held - demoT) * Math.min(1, dt * 2.2)
    const t = Math.min(1, demoT)

    // the world yields while a seed is open: the field steps back, the ink
    // dims, and the one star in hand keeps all of its light
    const wantYield = selected !== null ? 1 : 0
    yielded += (wantYield - yielded) * Math.min(1, dt * 3)
    const signMaster = 1 - 0.3 * yielded

    const lv = levelsAt(t)
    sign.update(dt, elapsed, lv, signMaster)
    firmament.update(elapsed, 0.62 * (1 - 0.4 * yielded))
    uInkT.value = elapsed
    uInk.value = 0.44 * (1 - 0.4 * yielded)
    let bloomed = 0
    for (const v of lv) if (v >= 3.9) bloomed++

    // the sign breathes as one, and every stage holds all of it. The frame
    // a phone gives is a third as wide as a desk's, so the sign is fitted
    // to the GLASS and not to a guess about which device this is: it
    // shrinks smoothly as the frame narrows, and rides a little higher
    // where the letterpress above it takes more of the room.
    wreath.rotation.z = Math.sin(elapsed * 0.05) * 0.012
    const k = Math.min(1, Math.max(0.58, camera.aspect * 0.72 + 0.25))
    wreath.scale.setScalar(k)
    wreath.position.y = 8.5 + (1 - k) * 3.3
    uWreathK.value = k * glassScale()

    // the engraving reads the same wakened levels the stars do
    for (let i = 0; i < uSeedLight.length; i++) {
      const u = uSeedLight[i]
      if (u) u.value.z = Math.min(1, (sign.shown[i] ?? 0) / 3.4)
    }

    // the four ways, turning
    for (let i = 0; i < STOIC_TAURUS.length; i++) {
      const star = sign.stars[i]
      const L = sign.shown[i] ?? 0
      const focus = selected === i ? 1 : hover === i ? 0.55 : 0
      const breathe = 1 + 0.06 * Math.sin(elapsed * 0.9 + i)
      for (let p = 0; p < PETALS; p++) {
        const n = i * PETALS + p
        const a = (petalPhase[i] ?? 0) + (p / PETALS) * TAU + elapsed * 0.05
        const rad = (1.72 + 0.14 * focus) * breathe
        petals.pos[n * 3] = (star?.position.x ?? 0) + Math.cos(a) * rad
        petals.pos[n * 3 + 1] = (star?.position.y ?? 0) + Math.sin(a) * rad
        petals.pos[n * 3 + 2] = (star?.position.z ?? 0) + 0.2
        const g = smooth(p + 0.1, p + 0.95, L) * (1 + 0.55 * focus) * signMaster
        const hue = petalHue[p] ?? GOLD
        petals.col[n * 3] = hue.r
        petals.col[n * 3 + 1] = hue.g
        petals.col[n * 3 + 2] = hue.b
        petals.siz[n] = 9.5 + 6.0 * g
        petals.glow[n] = g * 0.82
      }

      // the bloom ring: fired once, when the seed lands
      const isBloom = L >= 3.9
      if (isBloom && !wasBloomed[i]) rippleAge[i] = 0
      wasBloomed[i] = isBloom
      let age = rippleAge[i] ?? -1
      if (age >= 0) {
        age += dt / 2.0
        rippleAge[i] = age > 1 ? -1 : age
      }
      const alive = age >= 0 && age <= 1
      ripples.pos[i * 3] = star?.position.x ?? 0
      ripples.pos[i * 3 + 1] = star?.position.y ?? 0
      ripples.pos[i * 3 + 2] = star?.position.z ?? 0
      ripples.col[i * 3] = GOLD.r
      ripples.col[i * 3 + 1] = GOLD.g
      ripples.col[i * 3 + 2] = GOLD.b
      const ease = alive ? 1 - Math.pow(1 - age, 2.4) : 0
      ripples.siz[i] = (22 + 78 * ease) * k
      ripples.glow[i] = alive ? Math.pow(1 - age, 1.9) * 0.42 : 0
    }
    petals.commit()
    ripples.commit()

    // the current, running from the star in hand to its two neighbours
    if (currentAge >= 0) {
      currentAge += dt / 1.5
      if (currentAge > 1) currentAge = -1
    }
    for (let k = 0; k < 2; k++) {
      const from = selected !== null ? sign.stars[selected] : undefined
      const to = selected !== null ? sign.stars[selected + (k === 0 ? -1 : 1)] : undefined
      const live = currentAge >= 0 && from && to
      const p = currentAge < 0 ? 0 : currentAge * currentAge * (3 - 2 * currentAge)
      currents.pos[k * 3] = live ? from.position.x + (to.position.x - from.position.x) * p : 0
      currents.pos[k * 3 + 1] = live ? from.position.y + (to.position.y - from.position.y) * p : 0
      currents.pos[k * 3 + 2] = live ? from.position.z + (to.position.z - from.position.z) * p : 0
      currents.col[k * 3] = STARLIGHT.r
      currents.col[k * 3 + 1] = STARLIGHT.g
      currents.col[k * 3 + 2] = STARLIGHT.b
      currents.siz[k] = 8.5
      currents.glow[k] = live ? Math.sin(Math.PI * currentAge) * 0.85 : 0
    }
    currents.commit()

    // the crown, on whatever star is in hand
    const held0 = selected ?? hover
    const crowned = held0 !== null ? sign.stars[held0] : undefined
    crown.visible = Boolean(crowned)
    if (crowned) {
      crown.position.copy(crowned.position)
      crown.position.z += 0.3
      crownMat.rotation = elapsed * 0.06
      const want = selected !== null ? 0.95 : 0.6
      crownMat.opacity += (want - crownMat.opacity) * Math.min(1, dt * 6)
      crown.scale.setScalar(4.3 + 0.22 * Math.sin(elapsed * 0.5))
    } else {
      crownMat.opacity = 0
    }

    // letterpress: night count, and the name of whatever star is speaking
    if (nightLine)
      nightLine.textContent = `Night ${Math.max(1, Math.ceil(t * 12))} · ${bloomed} of 12 in bloom`
    let waking = -1
    for (let i = 0; i < sign.shown.length; i++) {
      const L = sign.shown[i] ?? 0
      if (L > 0.4 && L < 3.6) waking = i
    }
    const named = held0 ?? (waking >= 0 ? waking : -1)
    if (seedLabel) {
      const star = named >= 0 ? sign.stars[named] : undefined
      if (star && selected === null) {
        project(star)
        seedLabel.textContent = titles[named] ?? ''
        // a name never leaves the frame: a star at the edge keeps its
        // letterpress inside the glass, where it can still be read
        const half = seedLabel.offsetWidth / 2 + 14
        const at = (proj.x * 0.5 + 0.5) * innerWidth
        seedLabel.style.left = `${Math.min(innerWidth - half, Math.max(half, at))}px`
        seedLabel.style.top = `${(-proj.y * 0.5 + 0.5) * innerHeight + 26}px`
        seedLabel.classList.add('lit')
      } else {
        seedLabel.classList.remove('lit')
      }
    }

    for (let i = 0; i < btns.length; i++) {
      const b = btns[i]
      const star = sign.stars[i]
      if (!b || !star) continue
      project(star)
      b.style.left = `${(proj.x * 0.5 + 0.5) * innerWidth}px`
      b.style.top = `${(-proj.y * 0.5 + 0.5) * innerHeight}px`
    }

    panX += (aimX * 0.035 - panX) * Math.min(1, dt * 1.6)
    panY += (aimY * 0.022 - panY) * Math.min(1, dt * 1.6)
    camera.rotation.set(PITCH - panY, -panX, 0, 'YXZ')
    renderer.render(scene, camera)
  }
  requestAnimationFrame(frame)

  // the legend, drawn in the same light as the stars themselves: the dot
  // for every stage carries the petals that stage has earned
  const legend = document.getElementById('legend')
  if (legend) {
    const STAGES = ['Ember', 'Kindled', 'Risen', 'Radiant', 'Bloomed']
    // a phone gives the legend one line and not a pixel more: the mark
    // holds its ground there, it does not push the row into a second one
    const size = innerWidth < 560 ? '12px' : '18px'
    for (let s = 0; s < STAGES.length; s++) {
      const item = document.createElement('div')
      item.className = 'legend-item'
      const dot = document.createElement('span')
      dot.className = 'legend-dot'
      dot.style.width = size
      dot.style.height = size
      dot.style.background = `center / contain no-repeat url(${stageMark(s)})`
      const label = document.createElement('span')
      label.className = 'legend-name'
      label.textContent = STAGES[s] ?? ''
      item.append(dot, label)
      legend.appendChild(item)
    }
  }
}

/** one stage of bloom, drawn small: the core warms and brightens, and one
    petal joins it for every way of knowing that has been walked */
function stageMark(level: number): string {
  const s = 64
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.translate(s / 2, s / 2)
  const core = EMBER.clone().lerp(STARLIGHT, Math.min(1, level / 2.2))
  const rgb = `${Math.round(core.r * 255)}, ${Math.round(core.g * 255)}, ${Math.round(core.b * 255)}`
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.3)
  g.addColorStop(0, `rgba(${rgb}, ${0.72 + 0.07 * level})`)
  g.addColorStop(0.45, `rgba(${rgb}, ${0.3 + 0.1 * level})`)
  g.addColorStop(1, `rgba(${rgb}, 0)`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.3, 0, TAU)
  ctx.fill()
  for (let p = 0; p < level; p++) {
    const a = (p / 4) * TAU - Math.PI / 4
    const petal = GOLD.clone().lerp(STARLIGHT, p * 0.3)
    ctx.fillStyle = `rgba(${Math.round(petal.r * 255)}, ${Math.round(petal.g * 255)}, ${Math.round(
      petal.b * 255
    )}, 0.95)`
    ctx.beginPath()
    ctx.arc(Math.cos(a) * s * 0.34, Math.sin(a) * s * 0.34, s * 0.085, 0, TAU)
    ctx.fill()
  }
  return canvas.toDataURL()
}

void boot()
