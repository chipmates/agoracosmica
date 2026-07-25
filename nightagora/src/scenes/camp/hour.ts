/* THE HOUR — the camp's one shared state, and the laws every surface of
   this ground is carved from.

   Law 25 (organs receive light, they never own it): everything that glows
   in this camp reads its light out of the single block below, and the
   composition in index.ts owns every relationship.

   THE HOUR ITSELF (the founder's note, 2026-07-25): his camp is a DAWN. The floor is
   lifted so every detail reads — a camp lost in black is a camp nobody
   walks. Night is not a place on the walk, it is a place in the GAZE:
   look up and the sky deepens over you, look back down and his morning
   is still there. uNight carries both, and the duskrise simply drives it
   all the way. */

import {
  BufferGeometry,
  Color,
  FrontSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  type Side,
  Vector3,
} from 'three/webgpu'
import {
  abs,
  attribute,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  cos,
  dot,
  float,
  fract,
  length,
  max,
  mix,
  modelWorldMatrix,
  mx_fractal_noise_float,
  mx_noise_float,
  type N,
  normalWorld,
  normalize,
  normalLocal,
  oneMinus,
  positionLocal,
  pow,
  screenCoordinate,
  sin,
  smoothstep,
  sqrt,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from './tsl'

export type { N }

/* craft law 1 — sRGB lies. Every hand-picked constant goes through lin():
   three reads the hex as sRGB and hands back LINEAR working values, which
   is what the shaders want. */
export const lin = (hex: string): Color => new Color(hex)

/** a linear Color as a vec3 node, optionally scaled */
export const c3 = (c: Color, k = 1): N => vec3(c.r * k, c.g * k, c.b * k)
/** the same, from a hex, for the constants that are only written once */
export const hex3 = (h: string, k = 1): N => c3(lin(h), k)

/* THE ONE PIGMENT — Roman red ochre. The legions painted their scuta and
   their vexilla with iron-oxide ochre dug on campaign, so it is the one
   hue documented on this ground and not decoration. It lives on four
   surfaces only and is only ever visible where a fire finds it, so it
   reads as paint LIT BY FIRE, never as paint. */
export const OCHRE = lin('#8E3B22')
export const GOLD = lin('#e0b96a')

// ---------------------------------------------------------------- the map
/* map space: x across, z along the walk (+z is the far shore the visitor
   arrives from, -z is the praetorium), y is height above the LOCAL ground. */
export const MAP = {
  river: { z0: 8.6, z1: 22.4, y: -0.4 },
  bridge: { z0: 6.0, z1: 24.0, halfW: 1.5, y: 0.16 },
  gate: { z: 4.2, halfW: 1.9 },
  wall: { x: 13.0, zFront: 4.2, zBack: -30.5, r: 4.0 },
  praetorium: { x: 0, z: -21.6, w: 7.4, d: 5.6, h: 3.3 },
  desk: { x: 0.8, z: -22.4 },
}

/* THE SMALL DARK PLANET — art-directed curvature, not physics. The near
   quadratic keeps the camp walkable; the far term rolls the ground over so
   it occludes itself at about 42 m at eye height, which is what makes the
   horizon bow at the frame edges under a rectilinear lens. */
export const CURVE = { near: 1040, onset: 58, scale: 26 }

/** JS mirror of the shader's drop — labels, camera and props all have to
    sit on the same curved skin as the pixels */
export function groundDrop(x: number, z: number): number {
  const d = Math.hypot(x, z)
  const far = Math.max(d - CURVE.onset, 0) / CURVE.scale
  return (d * d) / CURVE.near + Math.pow(far, 2.2)
}

/** map position (y = height above local ground) -> real world position */
export function place(x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y - groundDrop(x, z), z)
}

// ------------------------------------------------------------ the uniforms
export const uT = uniform(0)
/** THE SKY'S HOUR: 0 = his lifted dawn, 1 = full night overhead. The gaze
    drives it — look up and the night deepens over you (the founder's law). */
export const uNight = uniform(0)
/** THE GROUND'S HOUR: the camp follows the sky only part of the way, so a
    raised gaze never costs you his morning. It reaches 1 only at the
    duskrise, where night falling IS the point (the Dusk Law). */
export const uDeep = uniform(0)
export const uReveal = uniform(0)
export const uFlick = uniform(1)
export const uGust = uniform(0)
/** the value floor: how much skylight the world gets for free. the founder's
    one note on camp-a was that it went too dark, so this is a real dial
    and not a constant buried in eight shaders. */
export const uFloor = uniform(1)
/** how far inside the praetorium the visitor stands (the interior takes
    over from the exterior read without either one lying) */
export const uInterior = uniform(0)
/** 0..1: a trace holds the frame, so the world's own marks step back */
export const uYield = uniform(0)

/** the bearing of the dying day: ONE azimuth, measured on the ground
    plane. A 3D dot stays high across the whole forward sky, which is what
    smears plum over the flanks. */
export const DUSK_DIR = new Vector3(0.16, 0.3, -0.94).normalize()
export const uDuskDir = uniform(DUSK_DIR)

// -------------------------------------------------------------- the fires
/* Darkness carves (craft law 5): eight glows in the whole night, each one
   meaning something. The praetorium is the warmest by law (the Hearth). */
export interface FireDef {
  id: string
  p: [number, number, number]
  hex: string
  r: number
  ph: number
  amp: number
}

export const FIRES: FireDef[] = [
  { id: 'praetorium', p: [0.0, 1.35, -21.4], hex: '#ffb35e', r: 9.0, ph: 0.0, amp: 0.1 },
  { id: 'brazier', p: [1.75, 1.05, 13.4], hex: '#ffa347', r: 5.2, ph: 1.7, amp: 0.22 },
  { id: 'torchL', p: [-2.35, 2.15, 4.5], hex: '#ff9a3c', r: 2.7, ph: 2.9, amp: 0.3 },
  { id: 'torchR', p: [2.35, 2.15, 4.5], hex: '#ff9a3c', r: 2.7, ph: 0.8, amp: 0.3 },
  // ON its own body: the crossed-log fire stands at (-3.4, -11.2), and a
  // light thrown from the far side of the via is a fire with no fire in it
  { id: 'campfire', p: [-3.4, 0.42, -11.2], hex: '#ff9c42', r: 4.4, ph: 4.1, amp: 0.24 },
  { id: 'watchL', p: [-4.4, 5.5, 4.9], hex: '#ff8f3a', r: 2.1, ph: 5.2, amp: 0.26 },
  { id: 'watchR', p: [4.4, 5.5, 4.9], hex: '#ff8f3a', r: 2.1, ph: 3.3, amp: 0.26 },
  { id: 'lamp', p: [0.72, 0.92, -22.5], hex: '#ffcf86', r: 1.5, ph: 2.2, amp: 0.14 },
]

const fireBase = FIRES.map((f) => lin(f.hex))
/** the fires as nodes: every lit surface reads these same three arrays,
    so one write per frame lights the whole camp */
export const firePosU = FIRES.map((f) => uniform(place(f.p[0], f.p[1], f.p[2])))
export const fireColU = FIRES.map(() => uniform(new Vector3()))
export const fireRadU = FIRES.map((f) => uniform(f.r))

/** ONE heartbeat for the whole camp (donor c's law): flame, coals, canvas,
    water and stone all answer the same signal, so the camp breathes as one
    body instead of as forty independent loops. */
export function beat(t: number, reduced: boolean): void {
  if (reduced) {
    uFlick.value = 0.86
    uGust.value = 0
  } else {
    uFlick.value =
      0.66 +
      0.19 * Math.sin(t * 7.3) +
      0.1 * Math.sin(t * 11.9 + 1.7) +
      0.06 * Math.sin(t * 17.3 + 4.1)
    // the wind walks the camp every ~11s: flames gutter, grass leans,
    // smoke shears. One signal, so it reads as weather, not as noise.
    const g = (t / 11) % 1
    uGust.value = Math.pow(Math.max(0, Math.sin(g * Math.PI)), 3.2)
  }
  const flick = uFlick.value
  for (let i = 0; i < FIRES.length; i++) {
    const f = FIRES[i]
    const base = fireBase[i]
    const col = fireColU[i]
    if (!f || !base || !col) continue
    const local = 1 - f.amp + f.amp * (flick + 0.42 * Math.sin(t * 5.1 + f.ph))
    const gust = 1 + uGust.value * f.amp * 0.6 * Math.sin(t * 9.1 + f.ph)
    const k = Math.max(0.15, local * gust) * uReveal.value
    col.value.set(base.r * k, base.g * k, base.b * k)
  }
  // the lamp and the tent's own glow only reach the world once the visitor
  // is at the doorway; before that they would light the whole via. The
  // boost is small on purpose: inside the tent the eye is a metre from
  // every surface, and inverse-square does the rest (round 1).
  // INSIDE, THE LAMP IS THE LIGHT. The praetorium's own glow is what the
  // camp sees from the via; at his desk it would flood the canvas from a
  // metre away and flatten the whole tent into one warm wall. So it stands
  // down as the visitor steps in, and the little clay lamp takes over.
  const prae = fireRadU[0]
  const lamp = fireRadU[7]
  const inside = uInterior.value
  if (prae) prae.value = 9.0 * (1 - 0.62 * inside)
  if (lamp) lamp.value = 1.5 + 2.8 * inside
}

// ------------------------------------------------------------ the TSL laws
export const sn = (p: N): N => mx_noise_float(p)
export const vn = (p: N): N => mx_noise_float(p).mul(0.5).add(0.5)
export const fbm3 = (p: N): N => mx_fractal_noise_float(p, 3, 2.0, 0.55, 1.0)

/** craft law 2: dither every gradient at creation. The amplitude is passed
    by the surface, because the sRGB step is tiny down in the abyss values. */
export const dither = (amp: number): N =>
  fract(sin(dot(screenCoordinate.xy.add(0.5), vec2(12.9898, 78.233))).mul(43758.5453))
    .sub(0.5)
    .mul(amp)

/** the planet's skin: y drops away with distance from the camp's heart */
export function planetize(p: N): N {
  const d = length(p.xz)
  const far = max(d.sub(CURVE.onset), 0).div(CURVE.scale)
  const drop = d.mul(d).div(CURVE.near).add(pow(far, 2.2))
  return vec3(p.x, p.y.sub(drop), p.z)
}

/** world position -> clip. Every camp material owns its vertex path,
    because every one of them curves. */
export const clipOf = (world: N): N => cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(world, 1))

const yawRot = (v: N, ang: N): N => {
  const c = cos(ang)
  const s = sin(ang)
  return vec3(c.mul(v.x).add(s.mul(v.z)), v.y, s.negate().mul(v.x).add(c.mul(v.z)))
}

/** THE FIRELIGHT RIG — donor a's inverse-square light with a facing power,
    moved per-fragment (few enough fires that the loop beats the seams) */
export function firelight(w: N, n: N, facePow: number, rim: number): N {
  let sum: N = vec3(0, 0, 0)
  for (let i = 0; i < FIRES.length; i++) {
    const posU = firePosU[i]
    const colU = fireColU[i]
    const radU = fireRadU[i]
    if (!posU || !colU || !radU) continue
    const d = posU.sub(w)
    const dd = max(dot(d, d), 0.0001)
    const ndl = pow(max(dot(n, d.div(sqrt(dd))), 0), facePow)
    sum = sum.add(colU.mul(ndl.mul(radU).div(dd.add(1.4))))
  }
  return sum.mul(rim)
}

// ----------------------------------------------------------------- the ink
/* ONE material family for every solid in the camp. Base is the silhouette
   value, albedo is what the firelight finds, rim is how much this surface
   remembers the fire at all. */
export interface InkOptions {
  /** the dawn silhouette value */
  baseD?: string
  /** what it sinks to when night falls over the camp */
  baseN?: string
  baseK?: number
  /** how much of the dome's own light this surface receives */
  ambK?: number
  albedo?: string
  emberK?: number
  rim?: number
  facePow?: number
  /** a lantern: light that came through the cloth from inside */
  inner?: boolean
  innerC?: string
  innerK?: number
  side?: Side
  instanced?: boolean
  /** vertex path only: this surface does not answer the fires (the sky) */
  unlit?: boolean
}

/** the shared vertex path: curve the world, hand the fragment its position,
    its normal and its per-instance tint */
export function inkVertex(instanced: boolean): { world: N; normal: N; tint: N; clip: N } {
  if (!instanced) {
    const world = varying(planetize(modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz))
    return { world, normal: normalWorld, tint: float(1), clip: clipOf(world) }
  }
  // the instanced path carries its own transform: scale, one yaw, offset —
  // and its own normal, because three's normalWorld cannot know about it
  const iPos = attribute('iPos', 'vec3')
  const iScl = attribute('iScl', 'vec3')
  const iRot = attribute('iRot', 'vec2')
  const p = yawRot(positionLocal.mul(iScl), iRot.x).add(iPos)
  const n = normalize(yawRot(normalLocal.div(max(iScl, vec3(0.001, 0.001, 0.001))), iRot.x))
  const world = varying(planetize(modelWorldMatrix.mul(vec4(p, 1)).xyz))
  return { world, normal: varying(n), tint: varying(iRot.y), clip: clipOf(world) }
}

/** the one material every solid in this camp is made of */
export function inkMaterial(o: InkOptions = {}): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial()
  mat.side = o.side ?? FrontSide
  const { world, normal, tint, clip } = inkVertex(o.instanced ?? false)
  mat.vertexNode = clip

  const baseK = o.baseK ?? 0.5
  const ambK = o.ambK ?? 0.088
  const baseD = c3(lin(o.baseD ?? '#1B1D33'), baseK)
  const baseN = c3(lin(o.baseN ?? '#080B20'), baseK)
  // the dome's light is cool but it is not BLUE: a lapis wash strong
  // enough to tint every upward face turns oak into lilac (round 1)
  const ambD = c3(lin('#3B4272'), ambK)
  const ambN = c3(lin('#171D46'), ambK * 0.52)
  const alb = c3(lin(o.albedo ?? '#B9A88E'))
  const ember = c3(lin('#C4611E'), o.emberK ?? 0.11)

  // the silhouette value, and the dome's own light on top of it: the floor
  // that keeps a surface a SURFACE instead of a hole in the frame. The
  // skylight wears the material's own colour — a blue wash on every
  // upward face turns oak into poured concrete (round 4).
  const skyTint = mix(vec3(1, 1, 1), alb.mul(1.35), 0.8)
  let col: N = mix(baseD, baseN, uDeep)
    .mul(tint)
    .add(mix(ambD, ambN, uDeep).mul(skyTint).mul(float(0.34).add(max(normal.y, 0).mul(0.66))).mul(uFloor))
  // the last light of the day, low and beyond the camp
  col = col.add(ember.mul(pow(max(dot(normal, uDuskDir), 0), 1.7)).mul(oneMinus(uDeep.mul(0.88))).mul(alb))
  // and the fires, which are the only thing here that is truly a light
  col = col.add(firelight(world, normal, o.facePow ?? 2.4, o.rim ?? 0.42).mul(alb))

  if (o.inner) {
    // canvas is a lantern: light that came through the cloth from inside,
    // strongest low where the lamp sits, ribbed by the seams. The weave
    // breaks the wash, so it is cloth and not a screen.
    const t = uv()
    // panels sewn every ~0.8 m, a batten at each seam, and the weave
    // breaking the wash so it is cloth and not a screen
    const rib = abs(fract(world.x.mul(1.25).add(world.z.mul(0.18))).sub(0.5))
    const seam = smoothstep(0.04, 0.17, rib)
    const weave = sn(vec3(world.x.mul(9), world.y.mul(9), 1.7)).mul(0.26).add(0.84)
    const lowFall = pow(oneMinus(clamp(t.y, 0, 1)), 2.9)
    const innerC = c3(lin(o.innerC ?? '#F09040'), o.innerK ?? 0.04)
    // and transmission is what you see from the OTHER side of the cloth:
    // standing inside his tent, the canvas is lit by his lamp, not by its
    // own glow, so the wash stands down as the visitor steps in
    col = col.add(
      innerC
        .mul(seam)
        .mul(weave)
        .mul(float(0.05).add(lowFall.mul(0.95)))
        .mul(float(0.74).add(uFlick.mul(0.26)))
        .mul(oneMinus(uInterior.mul(0.8)))
    )
  }

  mat.colorNode = shoulder(col).add(dither(0.0026)).mul(uReveal)
  return mat
}

/** THE SHOULDER — a fire a hand away from a surface is still a fire, not a
    white wall. One soft rolloff on the bright end keeps the darks exactly
    where they were authored and stops the praetorium's interior from
    flattening his desk into a pastel (round 1). */
export function shoulder(c: N): N {
  return c.div(float(1).add(c.mul(0.42)))
}

export interface FieldItem {
  p: [number, number, number]
  s?: [number, number, number]
  r?: number
  tint?: number
}

/** an instanced field of one shape — every repeated thing in this camp is
    one draw call (craft law: a fort is four hundred stakes, not four
    hundred meshes) */
export function field(geo: BufferGeometry, mat: MeshBasicNodeMaterial, items: FieldItem[]): Mesh {
  const n = items.length
  const g = new InstancedBufferGeometry()
  g.index = geo.index
  for (const key of Object.keys(geo.attributes)) {
    const attr = geo.attributes[key]
    if (attr) g.setAttribute(key, attr)
  }
  const iPos = new Float32Array(n * 3)
  const iScl = new Float32Array(n * 3)
  const iRot = new Float32Array(n * 2)
  items.forEach((it, k) => {
    iPos[k * 3] = it.p[0]
    iPos[k * 3 + 1] = it.p[1]
    iPos[k * 3 + 2] = it.p[2]
    const s = it.s ?? [1, 1, 1]
    iScl[k * 3] = s[0]
    iScl[k * 3 + 1] = s[1]
    iScl[k * 3 + 2] = s[2]
    iRot[k * 2] = it.r ?? 0
    iRot[k * 2 + 1] = it.tint ?? 1
  })
  g.setAttribute('iPos', new InstancedBufferAttribute(iPos, 3))
  g.setAttribute('iScl', new InstancedBufferAttribute(iScl, 3))
  g.setAttribute('iRot', new InstancedBufferAttribute(iRot, 2))
  g.instanceCount = n
  const m = new Mesh(g, mat)
  m.frustumCulled = false
  return m
}
