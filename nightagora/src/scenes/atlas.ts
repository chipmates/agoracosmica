/* THE WHEEL OF THE NIGHT — the sky phase as one dome carrying six houses.

   Six rigid asterisms hang on a single dome around the visitor; scrolling
   wheels the night until the focused house arrives at the gaze. Shapes are
   modeled on real asterisms (the shape IS the identity), so the dome may
   turn and breathe but a constellation never deforms.

   THE LAWS OF THIS SKY
   1 · GOLD IS A NAME. The thirty are the only gold lights up here. Every
       anonymous star is cool, so a name is findable at a glance and gold
       stays a thing that emits rather than a fill.
   2 · A HOUSE HAS A HIERARCHY. One anchor with its four-ray glint, lesser
       members weighted by where they sit in the figure, and a scatter of
       unnamed companions, so a house is a REGION of sky and not five dots.
   3 · THE CHOIR HANGS ON THE SAME DOME. The field, the river and the dust
       turn with the houses, so a chapter change sweeps the WHOLE sky past
       you. A crossfade is not a dome.
   4 · THE FIGURE IS INKED, NOT DRAWN. The hairlines lift while the dome is
       in motion and travel back out from the anchor once it rests, so the
       drawing is something the night does when it settles.
   5 · DARKNESS CARVES. The choir is a choir: it never competes with a
       name, and it steps back inside the house it surrounds. */

import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
  PointsNodeMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three/webgpu'
import {
  abs,
  attribute,
  clamp,
  float,
  instancedBufferAttribute,
  length,
  mix,
  normalize,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl'
import { CONSTELLATIONS, type Constellation } from '../content/constellations'
import { FOUNDING_SEED, mulberry32 } from '../core/seed'

/** a TSL node. The graph here is hand-composed out of helpers, and the
    generated overloads cannot follow that — the same boundary escape the
    firmament and the camp take, kept to this one alias. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

// ------------------------------------------------------------- the palette
/* Gold is a name (law 1). Three golds carry the whole hierarchy: the pale
   hot centre an anchor earns, the body of a named star, and the deeper
   gold of a lesser member. */
const GOLD_HOT = new Color('#f2d9a6')
const GOLD = new Color('#e0b96a')
const GOLD_DEEP = new Color('#c1934c')
const LINE_GOLD = new Color('#caa45d')
/* and the choir, which is never gold: three cool tints inside the navy */
const CHOIR_COOL = new Color('#b4c8ff')
const CHOIR_ICE = new Color('#d2ebff')
const CHOIR_DUST = new Color('#93a8d8')

const RADIUS = 46
/** patch scale on a wide stage; narrow stages compress via aspect */
const WIDE_SCALE = 5.0

/** the dome has mass: a spring with a whisper of overshoot, so a chapter
    ARRIVES instead of cutting. Stiffness and its damping term. */
const WHEEL_K = 26
const WHEEL_DAMP = 2 * 0.72 * Math.sqrt(WHEEL_K)

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** narrow stages carry fewer stars: the phone still gets a full sky, it
    just gets it in fewer grains */
const narrow = typeof window !== 'undefined' && window.innerWidth < 620

export interface AtlasStarRef {
  slug: string
  chapter: number
  sprite: Sprite
}

export interface AtlasHandles {
  /** ease the dome + staging toward the focused chapter */
  update(dt: number, elapsed: number, aspect: number, reveal: number): void
  /** snap the wheel instantly (forge + reduced motion) */
  snap(chapter: number): void
  setChapter(chapter: number): void
  currentElevation(): number
  /** world position of a star (for projection + the crossing flight) */
  starWorld(slug: string, out: Vector3): Vector3 | null
  stars: AtlasStarRef[]
  visible(v: boolean): void
}

// ---------------------------------------------------------------- helpers
/** a stable hand per name: the same star twinkles the same way in every
    build, without spending the scene's seeded sequence */
function slugHash(slug: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

function wrapPi(a: number): number {
  let x = a
  while (x > Math.PI) x -= Math.PI * 2
  while (x < -Math.PI) x += Math.PI * 2
  return x
}

function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

/** the direction a house hangs in, in dome-local coordinates */
function houseDir(c: Constellation, out: Vector3): Vector3 {
  return out.set(
    Math.sin(c.azimuth) * Math.cos(c.elevation),
    Math.sin(c.elevation),
    -Math.cos(c.azimuth) * Math.cos(c.elevation)
  )
}

// --------------------------------------------------------------- the star
/* A star is a tight core with a long faint skirt, not a blob. The anchor of
   a house also carries the four-ray glint an eye adds to a light bright
   enough to hurt a little. */
function starTexture(rays: boolean): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  const c = size / 2
  const g = ctx.createRadialGradient(c, c, 0, c, c, c)
  g.addColorStop(0, 'rgba(255, 253, 246, 1)')
  g.addColorStop(0.03, 'rgba(255, 247, 224, 0.97)')
  g.addColorStop(0.07, 'rgba(248, 226, 180, 0.5)')
  g.addColorStop(0.13, 'rgba(230, 192, 116, 0.15)')
  g.addColorStop(0.28, 'rgba(224, 185, 106, 0.032)')
  g.addColorStop(0.6, 'rgba(224, 185, 106, 0.006)')
  g.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  if (rays) {
    // the glint is built out of feathered one-pixel bands so the ray has a
    // soft edge and a taper, which a plain rectangle never gets
    ctx.globalCompositeOperation = 'lighter'
    for (const vertical of [false, true]) {
      const lg = vertical
        ? ctx.createLinearGradient(0, 0, 0, size)
        : ctx.createLinearGradient(0, 0, size, 0)
      lg.addColorStop(0, 'rgba(246, 223, 174, 0)')
      lg.addColorStop(0.32, 'rgba(246, 223, 174, 0.08)')
      lg.addColorStop(0.5, 'rgba(255, 248, 226, 0.62)')
      lg.addColorStop(0.68, 'rgba(246, 223, 174, 0.08)')
      lg.addColorStop(1, 'rgba(246, 223, 174, 0)')
      ctx.fillStyle = lg
      for (let k = -3; k <= 3; k++) {
        ctx.globalAlpha = Math.pow(1 - Math.abs(k) / 4, 2.4)
        if (vertical) ctx.fillRect(c + k - 0.5, 0, 1, size)
        else ctx.fillRect(0, c + k - 0.5, size, 1)
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
  return new CanvasTexture(canvas)
}

// ------------------------------------------------------------- the figure
/* THE INK PATH: the order the drawing travels. A figure is drawn from its
   anchor outward, the way a hand would, so the ranks come out of a walk
   over the shape rather than out of the order the lines were authored. */
function inkRanks(c: Constellation): number[] {
  const n = c.stars.length
  const adj: number[][] = []
  for (let i = 0; i < n; i++) adj.push([])
  c.lines.forEach(([a, b], si) => {
    adj[a]?.push(si)
    adj[b]?.push(si)
  })
  const alpha = c.stars.findIndex((s) => s.alpha)
  const seenSeg = new Array<boolean>(c.lines.length).fill(false)
  const seenStar = new Array<boolean>(n).fill(false)
  const ranks = new Array<number>(c.lines.length).fill(0)
  const queue: number[] = [alpha < 0 ? 0 : alpha]
  seenStar[queue[0] ?? 0] = true
  let rank = 0
  while (queue.length > 0) {
    const v = queue.shift()
    if (v === undefined) break
    for (const si of adj[v] ?? []) {
      if (seenSeg[si]) continue
      seenSeg[si] = true
      ranks[si] = rank++
      const seg = c.lines[si]
      if (!seg) continue
      const w = seg[0] === v ? seg[1] : seg[0]
      if (!seenStar[w]) {
        seenStar[w] = true
        queue.push(w)
      }
    }
  }
  // a limb the walk cannot reach (the Cross has two) joins after the body
  for (let si = 0; si < c.lines.length; si++) if (!seenSeg[si]) ranks[si] = rank++
  return ranks
}

/** how bright a named star is. The anchor is the anchor; everyone else is
    weighted by how many lines meet at them, so the joints of the figure
    carry the light and the tips fall away. A stable per-name jitter keeps
    any two members from being twins. */
function magnitudes(c: Constellation): number[] {
  const degree = new Array<number>(c.stars.length).fill(0)
  for (const [a, b] of c.lines) {
    if (degree[a] !== undefined) degree[a] += 1
    if (degree[b] !== undefined) degree[b] += 1
  }
  return c.stars.map((s, i) => {
    if (s.alpha) return 1
    const d = degree[i] ?? 0
    const jitter = slugHash(s.slug, 7) * 0.13
    return Math.min(0.88, 0.5 + d * 0.09 + jitter)
  })
}

/* THE HAIRLINES, as a drawn figure: every segment is a ribbon that keeps
   its width and gives up its ink at the ends, so it reads as a stroke
   resting between two stars instead of a blade thrown between them (round
   1 shot the taper into the WIDTH, and every segment came out a comet).
   The quad is built wider than the stroke and the fragment finds the stroke
   inside it, which buys a bright core with a soft halo for free. */
const SPANS = 12
/** how much wider than the visible stroke the geometry runs (the halo) */
const SKIRT = 2.6

function figureGeometry(
  c: Constellation,
  mag: number[],
  starSize: number[]
): BufferGeometry {
  const ranks = inkRanks(c)
  const segCount = Math.max(1, c.lines.length)
  const pos: number[] = []
  const cross: number[] = []
  const along: number[] = []
  const ink: number[] = []
  const weight: number[] = []
  const idx: number[] = []

  c.lines.forEach(([ia, ib], si) => {
    const sa = c.stars[ia]
    const sb = c.stars[ib]
    if (!sa || !sb) return
    const dx = sb.x - sa.x
    const dy = sb.y - sa.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    // a line rests, it never touches: the inset is the star's own size, so
    // a bright anchor pushes its lines further off than a faint member
    const insetA = (starSize[ia] ?? 0.4) * 0.34 + 0.02
    const insetB = (starSize[ib] ?? 0.4) * 0.34 + 0.02
    const ax = sa.x + ux * insetA
    const ay = sa.y + uy * insetA
    const bx = sb.x - ux * insetB
    const by = sb.y - uy * insetB
    // the weaker end sets the weight of the stroke
    const w = 0.62 + 0.38 * Math.min(mag[ia] ?? 0.6, mag[ib] ?? 0.6)
    const half = 0.0072 * SKIRT * w
    const rank = ranks[si] ?? si
    const base = pos.length / 3
    for (let k = 0; k <= SPANS; k++) {
      const t = k / SPANS
      const px = ax + (bx - ax) * t
      const py = ay + (by - ay) * t
      // the nib is nearly steady: a hand presses a little harder through
      // the middle of a stroke and that is the whole of it
      const hw = half * (0.66 + 0.34 * Math.pow(Math.sin(Math.PI * t), 0.7))
      pos.push(px - uy * hw, py + ux * hw, 0)
      pos.push(px + uy * hw, py - ux * hw, 0)
      cross.push(1, -1)
      along.push(t, t)
      const walk = (rank + t) / segCount
      ink.push(walk, walk)
      weight.push(w, w)
      if (k < SPANS) {
        const a = base + k * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
  })

  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('aCross', new Float32BufferAttribute(cross, 1))
  geo.setAttribute('aAlong', new Float32BufferAttribute(along, 1))
  geo.setAttribute('aInk', new Float32BufferAttribute(ink, 1))
  geo.setAttribute('aWeight', new Float32BufferAttribute(weight, 1))
  geo.setIndex(idx)
  return geo
}

function figureMaterial(uLine: N, uDraw: N): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false
  mat.blending = AdditiveBlending
  mat.side = DoubleSide
  const across: N = abs(attribute('aCross', 'float') as N)
  const alongN: N = attribute('aAlong', 'float') as N
  const inkN: N = attribute('aInk', 'float') as N
  const wN: N = attribute('aWeight', 'float') as N
  // the stroke, and the breath of ink that always sits around a stroke
  const core = smoothstep(0.42, 0.04, across)
  const halo = smoothstep(1.0, 0.1, across).mul(0.18)
  // the ends give up their ink instead of their width: a line arrives at a
  // star as a fading suggestion, never as a point
  const ends = smoothstep(0, 0.14, alongN).mul(smoothstep(1, 0.86, alongN))
  // the ink travels: every point of the figure has its place in the walk
  const gate = smoothstep(inkN, inkN.add(0.16), uDraw.mul(1.16))
  mat.colorNode = vec3(LINE_GOLD.r, LINE_GOLD.g, LINE_GOLD.b).mul(
    float(0.8).add(core.mul(0.45))
  )
  mat.opacityNode = core.add(halo).mul(wN).mul(ends).mul(gate).mul(uLine)
  return mat
}

// ------------------------------------------------------------ the choir
/* THE CHOIR — the anonymous sky the six houses hang in. One instanced
   field, one draw call, hung on the same dome as the houses so a turn
   sweeps all of it (law 3). Four populations: the field with its clusters
   and its pools of dark, the river of dust crossing the dome, a whisper of
   nebular haze along the river, and a handful of steady cool anchors that
   give the empty quarters something to hold. */
interface Choir {
  sprite: Sprite
  uT: N
  uMaster: N
  uGaze: N
}

function buildChoir(rand: () => number, count: number): Choir {
  const heroes = narrow ? 26 : 30
  const band = Math.round(count * 0.31)
  const plain = Math.max(0, count - heroes - band)

  const dirFrom = (y: number, th: number): [number, number, number] => {
    const cl = Math.max(-1, Math.min(1, y))
    const ph = Math.acos(cl)
    return [Math.sin(ph) * Math.cos(th), cl, Math.sin(ph) * Math.sin(th)]
  }
  // the visitor's gaze rides at about a third of the way up, so that is
  // where the sky is thickest; the rest still reaches the zenith
  const sampleY = (): number =>
    rand() < 0.62 ? 0.16 + rand() * 0.74 : -0.12 + rand() * 1.12

  // THE RIVER: one great circle, its plane leaning off the vertical so the
  // dust crosses the frame on a diagonal as the dome turns
  const bandN = dirFrom(Math.sin(0.24), 2.35)
  const dot3 = (a: [number, number, number], b: [number, number, number]): number =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

  // clusters gather the field; the voids are pools of deliberate dark
  const clusters: Array<{ y: number; th: number }> = []
  for (let i = 0; i < 11; i++) clusters.push({ y: sampleY(), th: rand() * Math.PI * 2 })
  const voids: Array<[number, number, number]> = []
  for (let i = 0; i < 5; i++) voids.push(dirFrom(sampleY(), rand() * Math.PI * 2))
  const inVoid = (d: [number, number, number]): boolean => {
    for (const v of voids) if (dot3(d, v) > 0.988) return true
    return false
  }

  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const tw = new Float32Array(count * 2)
  let i = 0
  const put = (
    d: [number, number, number],
    r: number,
    tint: Color,
    dim: number,
    px: number
  ): void => {
    if (i >= count) return
    pos[i * 3] = d[0] * r
    pos[i * 3 + 1] = d[1] * r
    pos[i * 3 + 2] = d[2] * r
    col[i * 3] = tint.r * dim
    col[i * 3 + 1] = tint.g * dim
    col[i * 3 + 2] = tint.b * dim
    size[i] = px
    tw[i * 2] = 0.5 + rand() * 1.3
    tw[i * 2 + 1] = rand() * Math.PI * 2
    i++
  }

  // 1 · the field, clustered and void-respecting
  for (let k = 0; k < plain; k++) {
    let d = dirFrom(sampleY(), rand() * Math.PI * 2)
    if (rand() < 0.42) {
      const cl = clusters[Math.floor(rand() * clusters.length)]
      if (cl) d = dirFrom(cl.y + (rand() - 0.5) * 0.15, cl.th + (rand() - 0.5) * 0.3)
    }
    for (let t = 0; t < 3 && inVoid(d); t++) d = dirFrom(sampleY(), rand() * Math.PI * 2)
    const disc = k % 11 === 0
    const r = 104 + rand() * 62
    const tint = rand() < 0.34 ? CHOIR_ICE : CHOIR_COOL
    // a grain thinner than a pixel is not a star, it is moiré: every
    // population keeps a floor wide enough for its own soft edge (round 1)
    if (disc) put(d, r * 0.62, tint, 0.3 + rand() * 0.2, 3.4 + rand() * 1.8)
    else put(d, r, tint, 0.24 + rand() * 0.56, 1.7 + rand() * 1.25)
  }

  // 2 · the river, dense faint dust hugging the band plane
  for (let k = 0; k < band; k++) {
    let d = dirFrom(-0.15 + rand() * 1.15, rand() * Math.PI * 2)
    for (let t = 0; t < 8 && Math.abs(dot3(d, bandN)) > 0.15; t++)
      d = dirFrom(-0.15 + rand() * 1.15, rand() * Math.PI * 2)
    if (inVoid(d)) continue
    put(d, 118 + rand() * 46, rand() < 0.55 ? CHOIR_DUST : CHOIR_COOL, 0.15 + rand() * 0.2, 1.55 + rand() * 0.7)
  }

  /* THERE IS NO HAZE. Two rounds went into a nebular wash and both times
     it came back as soft discs floating in the frame, which reads as dirt
     on a lens and not as air. The river is carried by its dust instead,
     which is the honest way a naked eye sees it anyway. */

  // 3 · the steady ones: no house, no name, but the quarters between the
  // houses need something for an eye to rest on
  for (let k = 0; k < heroes; k++) {
    let d = dirFrom(0.1 + rand() * 0.82, rand() * Math.PI * 2)
    for (let t = 0; t < 3 && inVoid(d); t++) d = dirFrom(0.1 + rand() * 0.82, rand() * Math.PI * 2)
    put(d, 100 + rand() * 40, rand() < 0.42 ? CHOIR_ICE : CHOIR_COOL, 0.88 + rand() * 0.12, 2.9 + rand() * 1.4)
  }
  // the river's void-skips leave silent slots: park them dark and sized to
  // nothing, so the budget stays honest and the seed stays deterministic
  while (i < count) put([0, 0, 0], 0.0001, CHOIR_COOL, 0, 0)

  const aPos = new InstancedBufferAttribute(pos, 3)
  const aCol = new InstancedBufferAttribute(col, 3)
  const aSize = new InstancedBufferAttribute(size, 1)
  const aTw = new InstancedBufferAttribute(tw, 2)

  const uT: N = uniform(0)
  const uMaster: N = uniform(0)
  const uGaze: N = uniform(new Vector3(0, 0.56, -0.83))
  const mat = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  const posN: N = instancedBufferAttribute(aPos)
  mat.positionNode = posN
  mat.sizeAttenuation = false
  const sizeN: N = instancedBufferAttribute(aSize)
  const twN: N = instancedBufferAttribute(aTw)
  const colN: N = instancedBufferAttribute(aCol)
  mat.sizeNode = sizeN

  // THE TWINKLE LAW: scintillation belongs to the small. The steady ones
  // and the haze burn through it, which is what makes them read as near.
  const scint = smoothstep(float(3.4), float(1.2), sizeN)
  const shimmer = sin(uT.mul(twN.x).add(twN.y)).mul(0.5).add(0.5)
  const twinkle = float(1).sub(shimmer.mul(scint.mul(0.3)))
  // HORIZON EXTINCTION: more air, less light, and a touch warmer
  const dirN: N = normalize(posN)
  const airMass = smoothstep(0.3, -0.05, dirN.y)
  const ext = mix(float(1), float(0.34), airMass)
  // THE GAZE LEANS: the sky lifts in a wide halo around the focused house
  // and steps back inside it, so the choir carves the house out instead of
  // crowding it (law 5)
  const toward = dirN.dot(uGaze)
  const halo = smoothstep(0.66, 0.98, toward)
  const inside = smoothstep(0.93, 0.999, toward)
  const lean = float(1).add(halo.mul(0.24)).sub(inside.mul(0.32))
  // a defocused star spreads the same light over a bigger disc
  const energy = clamp(float(3.4).div(sizeN.max(0.2)), 0.25, 1)

  const d = uv().sub(vec2(0.5, 0.5))
  const kernel = smoothstep(0.5, 0.05, length(d))
  mat.colorNode = colN.mul(mix(vec3(1, 1, 1), vec3(1.05, 0.94, 0.82), airMass.mul(0.35)))
  mat.opacityNode = kernel.mul(twinkle).mul(ext).mul(lean).mul(energy).mul(uMaster)

  const sprite = new Sprite(mat)
  sprite.count = count
  sprite.frustumCulled = false
  sprite.renderOrder = -1
  return { sprite, uT, uMaster, uGaze }
}

// -------------------------------------------------------- the companions
/* Every house keeps its own lesser stars: unnamed, cool, faint, scattered
   through the figure's own patch so the shape sits in a gathering rather
   than in a vacuum. They live in patch coordinates, which means they
   compress with the shape on a narrow stage and never drift off it. */
function buildCompanions(
  c: Constellation,
  rand: () => number,
  count: number
): { sprite: Sprite; uT: N; uMaster: N } {
  let x0 = 0
  let x1 = 0
  let y0 = 0
  let y1 = 0
  c.stars.forEach((s, k) => {
    if (k === 0) {
      x0 = x1 = s.x
      y0 = y1 = s.y
      return
    }
    x0 = Math.min(x0, s.x)
    x1 = Math.max(x1, s.x)
    y0 = Math.min(y0, s.y)
    y1 = Math.max(y1, s.y)
  })
  const pad = 0.85
  const pos = new Float32Array(count * 3)
  const size = new Float32Array(count)
  const dim = new Float32Array(count)
  const tw = new Float32Array(count * 2)
  for (let k = 0; k < count; k++) {
    let x = 0
    let y = 0
    for (let t = 0; t < 6; t++) {
      // two thirds of them gather along the figure itself, which is what
      // turns a house into a knot of sky instead of a rectangle of dots;
      // the rest wander the patch and keep the edges from being a wall
      if (k % 3 !== 0 && c.lines.length > 0) {
        const seg = c.lines[Math.floor(rand() * c.lines.length)]
        const sa = seg ? c.stars[seg[0]] : undefined
        const sb = seg ? c.stars[seg[1]] : undefined
        if (sa && sb) {
          const f = rand()
          const spread = 0.22 + rand() * rand() * 0.9
          const ang = rand() * Math.PI * 2
          x = sa.x + (sb.x - sa.x) * f + Math.cos(ang) * spread
          y = sa.y + (sb.y - sa.y) * f + Math.sin(ang) * spread
        }
      } else {
        x = x0 - pad + rand() * (x1 - x0 + pad * 2)
        y = y0 - pad + rand() * (y1 - y0 + pad * 2)
      }
      // never crowd a name: a companion keeps its distance from the thirty
      let clear = true
      for (const s of c.stars) if (Math.hypot(s.x - x, s.y - y) < 0.34) clear = false
      if (clear) break
    }
    pos[k * 3] = x
    pos[k * 3 + 1] = y
    pos[k * 3 + 2] = -0.02
    size[k] = 1.15 + rand() * 1.2
    dim[k] = 0.22 + rand() * 0.54
    tw[k * 2] = 0.6 + rand() * 1.4
    tw[k * 2 + 1] = rand() * Math.PI * 2
  }
  const aPos = new InstancedBufferAttribute(pos, 3)
  const aSize = new InstancedBufferAttribute(size, 1)
  const aDim = new InstancedBufferAttribute(dim, 1)
  const aTw = new InstancedBufferAttribute(tw, 2)

  const uT: N = uniform(0)
  const uMaster: N = uniform(0)
  const mat = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  mat.positionNode = instancedBufferAttribute(aPos)
  mat.sizeAttenuation = false
  const sizeN: N = instancedBufferAttribute(aSize)
  const dimN: N = instancedBufferAttribute(aDim)
  const twN: N = instancedBufferAttribute(aTw)
  mat.sizeNode = sizeN
  const shimmer = sin(uT.mul(twN.x).add(twN.y)).mul(0.5).add(0.5)
  const d = uv().sub(vec2(0.5, 0.5))
  const kernel = smoothstep(0.5, 0.05, length(d))
  mat.colorNode = vec3(CHOIR_COOL.r, CHOIR_COOL.g, CHOIR_COOL.b)
  mat.opacityNode = kernel
    .mul(dimN)
    .mul(float(1).sub(shimmer.mul(0.34)))
    .mul(uMaster)

  const sprite = new Sprite(mat)
  sprite.count = count
  sprite.frustumCulled = false
  return { sprite, uT, uMaster }
}

// ------------------------------------------------------------- the atlas
export function createAtlas(scene: Scene): AtlasHandles {
  const dome = new Group()
  dome.visible = false
  scene.add(dome)
  const rand = mulberry32(FOUNDING_SEED)

  const starMap = starTexture(false)
  const anchorMap = starTexture(true)

  // a phone sees a much narrower slice of the dome than a desk, so an
  // equal budget is a much emptier frame: the narrow tier keeps almost the
  // whole count and spends it on a smaller sky (round 2)
  const choir = buildChoir(rand, narrow ? 1450 : 1750)
  dome.add(choir.sprite)

  /* THE TWO WANDERERS — the sky has a mechanism. Two lights that never
     twinkle and never belong to a house, drifting against the dome across
     a whole sitting. They are cool on purpose: gold is a name (law 1). */
  const wanderers = new Group()
  dome.add(wanderers)
  const WANDER: Array<[number, number, number, number]> = [
    [0.42, 0.98, 2.3, 1.15],
    [3.02, 0.44, 1.8, 0.95],
  ]
  const wanderDir = new Vector3()
  for (const [az, el, sc, dim] of WANDER) {
    const mat = new SpriteMaterial({
      map: starMap,
      color: CHOIR_ICE.clone().multiplyScalar(dim),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const s = new Sprite(mat)
    wanderDir.set(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      -Math.cos(az) * Math.cos(el)
    )
    s.position.copy(wanderDir).multiplyScalar(120)
    s.scale.setScalar(sc)
    wanderers.add(s)
  }
  const wanderMats = wanderers.children.map((o) => (o as Sprite).material as SpriteMaterial)

  interface Star {
    sprite: Sprite
    mat: SpriteMaterial
    /** the anchor of its house: it wears the glint, so it also has to be
        hushed hardest when the house is not the one being looked at */
    anchor: boolean
    /** the disc this star is authored at, before the recession shrinks it */
    size: number
    /** brightness this star is authored at */
    bright: number
    /** how hard it scintillates, and its own hand on the clock */
    scint: number
    rate: number
    phase: number
  }

  interface Patch {
    group: Group
    stars: Star[]
    lineU: N
    drawU: N
    compU: N
    compT: N
    azimuth: number
    /** how much this shape is scaled so every house arrives at a
        comparable presence in the frame (the shape never deforms) */
    fit: number
    focus: number // eased 0..1
  }

  /* THE HOUSES ARE NOT THE SAME SIZE. Cassiopeia spans four units and the
     Cross spans one, so left alone one house fills the frame and the next
     is a thumbprint. Each patch carries a gentle fit toward the mean reach,
     applied as ONE uniform scale, which is the only thing a rigid shape
     will accept. */
  const reach = CONSTELLATIONS.map((c) => {
    let r = 0.6
    for (const s of c.stars) r = Math.max(r, Math.hypot(s.x, s.y))
    return r
  })
  const meanReach = reach.reduce((a, b) => a + b, 0) / Math.max(1, reach.length)

  const patches: Patch[] = []
  const stars: AtlasStarRef[] = []
  const dirTmp = new Vector3()

  for (let ci = 0; ci < CONSTELLATIONS.length; ci++) {
    const c = CONSTELLATIONS[ci]
    if (!c) continue
    const patch = new Group()
    // the patch hangs on the dome in its azimuth/elevation direction and
    // faces the visitor at the center
    patch.position.copy(houseDir(c, dirTmp)).multiplyScalar(RADIUS)
    patch.lookAt(0, 0, 0)
    patch.scale.setScalar(WIDE_SCALE)

    const fit = Math.pow(meanReach / (reach[ci] ?? meanReach), 0.55)
    const mag = magnitudes(c)
    // the anchor's disc is drawn wide enough to carry its four rays; every
    // other star is the tight point its magnitude earns
    const sizes = mag.map((m, k) => (0.21 + 0.33 * m * m) * (c.stars[k]?.alpha ? 1.45 : 1))

    // the companions first, so a named star always draws over them
    const comp = buildCompanions(c, rand, narrow ? 18 : 26)
    patch.add(comp.sprite)

    const lineU: N = uniform(0)
    const drawU: N = uniform(1)
    patch.add(new Mesh(figureGeometry(c, mag, sizes), figureMaterial(lineU, drawU)))

    const list: Star[] = []
    c.stars.forEach((s, si) => {
      const m = mag[si] ?? 0.6
      const mat = new SpriteMaterial({
        map: s.alpha ? anchorMap : starMap,
        color: GOLD_DEEP.clone().lerp(GOLD, Math.min(1, m * 1.35)).lerp(GOLD_HOT, m * m),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      })
      const sprite = new Sprite(mat)
      sprite.position.set(s.x, s.y, 0)
      sprite.scale.setScalar(sizes[si] ?? 0.4)
      patch.add(sprite)
      list.push({
        sprite,
        mat,
        anchor: Boolean(s.alpha),
        size: sizes[si] ?? 0.4,
        bright: 0.5 + 0.5 * Math.pow(m, 1.2),
        // the twinkle law again: only the lesser members scintillate
        scint: Math.max(0, 0.26 * (1 - m) ** 1.1),
        rate: 0.9 + slugHash(s.slug, 3) * 1.9,
        phase: slugHash(s.slug, 11) * Math.PI * 2,
      })
      stars.push({ slug: s.slug, chapter: ci, sprite })
    })

    dome.add(patch)
    patches.push({
      group: patch,
      stars: list,
      lineU,
      drawU,
      compU: comp.uMaster,
      compT: comp.uT,
      azimuth: c.azimuth,
      fit,
      focus: ci === 0 ? 1 : 0,
    })
  }

  let chapter = 0
  let wheel = 0 // eased dome rotation, radians
  let wheelVel = 0
  let draw = 1
  let elevation = CONSTELLATIONS[0]?.elevation ?? 0.6
  const gaze = new Vector3()
  houseDir(CONSTELLATIONS[0] ?? ({ azimuth: 0, elevation: 0.6 } as Constellation), gaze)

  function targetWheel(): number {
    const az = CONSTELLATIONS[chapter]?.azimuth ?? 0
    // rotate the dome so the focused patch faces azimuth 0; take the
    // short way around the ring
    let t = az
    while (t - wheel > Math.PI) t -= Math.PI * 2
    while (t - wheel < -Math.PI) t += Math.PI * 2
    return t
  }

  function update(dt: number, elapsed: number, aspect: number, reveal: number): void {
    if (!dome.visible) return
    // a returning tab hands over a huge dt, and a spring integrated over a
    // huge step is a catapult
    const step = Math.min(dt, 0.05)

    const err = targetWheel() - wheel
    wheelVel += (err * WHEEL_K - wheelVel * WHEEL_DAMP) * step
    wheel += wheelVel * step
    dome.rotation.y = wheel
    // the dome breathes: a slow whole-sky sway, shapes untouched
    dome.rotation.z = reducedMotion ? 0 : Math.sin(elapsed * 0.05) * 0.008
    // the wanderers keep their own time against the dome
    if (!reducedMotion) wanderers.rotation.y = elapsed * 0.0026

    const el = CONSTELLATIONS[chapter]?.elevation ?? 0.6
    elevation += (el - elevation) * Math.min(1, step * 2.6)

    // the ink lifts while the dome is in motion and travels back out from
    // the anchor once it rests (law 4)
    const turning = Math.min(1, Math.abs(wheelVel) / 0.5)
    const wantDraw = reducedMotion ? 1 : 1 - turning
    draw += (wantDraw - draw) * Math.min(1, step * (wantDraw > draw ? 2.1 : 9))

    // the sky leans toward the focused house
    const focused = CONSTELLATIONS[chapter]
    if (focused) {
      houseDir(focused, dirTmp)
      gaze.lerp(dirTmp, Math.min(1, step * 2.4))
      choir.uGaze.value.copy(gaze).normalize()
    }
    choir.uT.value = reducedMotion ? 0 : elapsed
    choir.uMaster.value = reveal * 0.9
    for (const m of wanderMats) m.opacity = reveal * 0.62

    // narrow stages compress every patch so the widest shape still fits
    const scale = WIDE_SCALE * Math.min(1, Math.max(0.72, aspect / 1.35))
    for (let i = 0; i < patches.length; i++) {
      const p = patches[i]
      if (!p) continue
      p.group.scale.setScalar(scale * p.fit)
      const want = i === chapter ? 1 : 0
      p.focus += (want - p.focus) * Math.min(1, step * 2.2)
      // a house far from the gaze is still a real house on the dome, it is
      // simply far: presence falls with the angle it sits at
      const near = smooth01((1.35 - Math.abs(wrapPi(p.azimuth - wheel))) / 1.05)
      const stand = near * (0.18 + 0.82 * p.focus)
      const pres = stand * reveal
      // a receding star gives up its disc as well as its light. Dimming
      // alone left the neighbours as brown smudges, because a wide sprite
      // at eight percent is a cloud and not a star (round 1).
      const shrink = 0.56 + 0.44 * stand
      for (const s of p.stars) {
        const sh = reducedMotion
          ? 0.5
          : Math.sin(elapsed * s.rate + s.phase) * 0.5 + 0.5
        const hush = s.anchor ? 0.45 + 0.55 * p.focus : 1
        s.mat.opacity = pres * s.bright * hush * (1 - s.scint * sh)
        s.sprite.scale.setScalar(s.size * shrink)
      }
      // a neighbour keeps the ghost of its own figure at the frame edge:
      // enough to say the sky goes on around you, far too little to read
      p.lineU.value = near * (0.045 + 0.955 * p.focus) * reveal * 0.92
      p.drawU.value = draw
      p.compU.value = near * (0.12 + 0.88 * p.focus) * reveal * 0.8
      p.compT.value = reducedMotion ? 0 : elapsed
    }
  }

  function snap(c: number): void {
    chapter = ((c % patches.length) + patches.length) % patches.length
    wheel = targetWheel()
    wheelVel = 0
    draw = 1
    dome.rotation.y = wheel
    elevation = CONSTELLATIONS[chapter]?.elevation ?? 0.6
    const focused = CONSTELLATIONS[chapter]
    if (focused) choir.uGaze.value.copy(houseDir(focused, gaze)).normalize()
    for (let i = 0; i < patches.length; i++) {
      const p = patches[i]
      if (!p) continue
      p.focus = i === chapter ? 1 : 0
      p.drawU.value = 1
    }
  }

  const world = new Vector3()
  function starWorld(slug: string, out: Vector3): Vector3 | null {
    for (const s of stars) {
      if (s.slug !== slug) continue
      s.sprite.updateWorldMatrix(true, false)
      return out.copy(world.set(0, 0, 0)).setFromMatrixPosition(s.sprite.matrixWorld)
    }
    return null
  }

  return {
    update,
    snap,
    setChapter(c: number) {
      chapter = ((c % patches.length) + patches.length) % patches.length
    },
    currentElevation: () => elevation,
    starWorld,
    stars,
    visible(v: boolean) {
      dome.visible = v
    },
  }
}
