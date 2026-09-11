/* THE WHEEL OF THE NIGHT — the sky phase as one dome carrying six houses.

   Six rigid asterisms hang on a single dome around the visitor; scrolling
   wheels the night until the focused house arrives at the gaze. Shapes are
   modeled on real asterisms (the shape IS the identity), so the dome may
   turn and breathe but a constellation never deforms.

   THE LAWS OF THIS SKY
   1 · GOLD IS A NAME. The thirty are the only gold lights up here. Every
       anonymous star is cool, so a name is findable at a glance and gold
       stays a thing that emits rather than a fill.
   2 · THE THIRTY STAND AS EQUALS. One magnitude, one disc, one gold for
       every named star, and a scatter of unnamed companions around them,
       so a house is a REGION of sky and not one flare with five witnesses.
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
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  Matrix4,
  Mesh,
  MeshBasicNodeMaterial,
  PointsNodeMaterial,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  Vector4,
} from 'three/webgpu'
import {
  abs,
  attribute,
  clamp,
  dot,
  float,
  fract,
  instancedBufferAttribute,
  length,
  max,
  mix,
  normalize,
  positionLocal,
  pow,
  screenCoordinate,
  screenUV,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl'
import * as TSL from 'three/tsl'
import { CONSTELLATIONS, type Constellation } from '../content/constellations'
import { FOUNDING_SEED, mulberry32 } from '../core/seed'

/** a TSL node. The graph here is hand-composed out of helpers, and the
    generated overloads cannot follow that — the same boundary escape the
    firmament and the camp take, kept to this one alias. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
/* the MaterialX noises are not in the generated overload set; the eclipse
   and the camp reach them the same way */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mxNoise: (v: N) => N = (TSL as any).mx_noise_float
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mxFractal: (v: N, o: number, l: number, d: number, a: number) => N = (TSL as any)
  .mx_fractal_noise_float

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

/** how much light the river is allowed to add to a sky that already has
    one. The lobby's own dome stays the sky; this is the star cloud on it. */
const RIVER_GAIN = 0.6

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

/** where a seated name sits on the glass, in CSS pixels: the centre of its
    own box and its half width */
export interface LabelBounds {
  x: number
  y: number
  half: number
}

// -------------------------------------------------- the lettering reserve
/* THE NAMES RESERVE THEIR OWN PAPER. Every drawn line in this sky — the
   hairlines between the stars and everything the burin cuts — is multiplied
   by this mask, so ink never crosses a written name. The rectangles arrive
   from the DOM solver AFTER it has seated every label, which means the mask
   follows the letterpress and never the other way around: nothing here
   moves a name, a target or a star. */
interface Reserve {
  node: N
  update(labels: LabelBounds[], width: number, height: number): void
}

/** the tallest house carries six names */
const RESERVE_SLOTS = 6

function createLetteringReserve(): Reserve {
  const extent: N = uniform(new Vector2(1, 1))
  const rects: N[] = Array.from({ length: RESERVE_SLOTS }, () =>
    uniform(new Vector4(-1e4, -1e4, 0, 0))
  )
  // screenUV runs top-down on both backends, which is the letterpress's own
  // coordinate system, so a DOM rectangle needs no flip
  const px = screenUV.mul(extent)
  let node: N = float(1)
  for (const rect of rects) {
    const d = abs(px.sub(rect.xy)).sub(rect.zw)
    node = node.mul(smoothstep(0, 10, max(d.x, d.y)))
  }
  return {
    node,
    update(labels, width, height) {
      extent.value.set(width, height)
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i]
        if (!rect) continue
        const l = labels[i]
        // the chip is a 44px target with its line of type through the
        // middle: the reserve claims the TYPE, not the touch area
        if (l) rect.value.set(l.x, l.y + 22, Math.max(6, l.half - 4), 9)
        else rect.value.set(-1e4, -1e4, 0, 0)
      }
    },
  }
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
  /** hand the sky the seated names, so the ink stays off them */
  reserveLabels(labels: LabelBounds[], width: number, height: number): void
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
/* A star is a tight core with a long faint skirt, not a blob. One profile
   for all thirty: the glint that used to mark an anchor is what let a name
   beside a bright star read as a second name for it. */
function starTexture(): CanvasTexture {
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

/** THE THIRTY STAND AT ONE MAGNITUDE. A named star is a name, and no name
    in this museum outranks another, so every figure star of every house is
    the same magnitude, which means the same disc and the same gold. The
    choir and the per-house companions keep all their variety: that is where
    a sky earns its range. */
const FIGURE_MAG = 0.82

function magnitudes(c: Constellation): number[] {
  return c.stars.map(() => FIGURE_MAG)
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
  const gild: number[] = []
  const kind: number[] = []
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
      gild.push(0, 0)
      kind.push(0, 0)
      if (k < SPANS) {
        const a = base + k * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
  })

  /* AND THE BURIN, in the same buffer. Two registers, one draw: the phone's
     calm tier is a 60-draw stage, and a second mesh per house spends six of
     them on a shader difference the fragment can carry itself. */
  const pen = burinFor(c)
  pen.strokes.forEach((st, si) => {
    const last = st.points.length - 1
    st.points.forEach(([x, y], i) => {
      const a = st.points[Math.max(0, i - 1)]
      const b = st.points[Math.min(last, i + 1)]
      if (!a || !b) return
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const len = Math.hypot(dx, dy) || 1
      const taper = 0.58 + 0.42 * Math.sin((Math.PI * i) / Math.max(1, last))
      const half = CUT_HALF * taper
      const base = pos.length / 3
      pos.push(x - (dy / len) * half, y + (dx / len) * half, -0.045)
      pos.push(x + (dy / len) * half, y - (dx / len) * half, -0.045)
      cross.push(-1, 1)
      along.push(0.5, 0.5)
      const walk = 0.1 + (0.82 * (si + i / Math.max(1, st.points.length))) / pen.strokes.length
      ink.push(walk, walk)
      weight.push(st.weight, st.weight)
      gild.push(st.gild, st.gild)
      kind.push(1, 1)
      if (i < last) idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
    })
  })

  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('aCross', new Float32BufferAttribute(cross, 1))
  geo.setAttribute('aAlong', new Float32BufferAttribute(along, 1))
  geo.setAttribute('aInk', new Float32BufferAttribute(ink, 1))
  geo.setAttribute('aWeight', new Float32BufferAttribute(weight, 1))
  geo.setAttribute('aGild', new Float32BufferAttribute(gild, 1))
  geo.setAttribute('aKind', new Float32BufferAttribute(kind, 1))
  geo.setIndex(idx)
  return geo
}

function figureMaterial(
  uLine: N,
  uDraw: N,
  uCut: N,
  reserve: Reserve
): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false
  mat.blending = AdditiveBlending
  mat.side = DoubleSide
  mat.forceSinglePass = true
  const across: N = abs(attribute('aCross', 'float') as N)
  const alongN: N = attribute('aAlong', 'float') as N
  const inkN: N = attribute('aInk', 'float') as N
  const wN: N = attribute('aWeight', 'float') as N
  const gildN: N = attribute('aGild', 'float') as N
  const kindN: N = attribute('aKind', 'float') as N

  // THE HAIRLINE: the stroke, and the breath of ink that always sits around
  // a stroke. Its ends give up their INK instead of their width, so a line
  // arrives at a star as a fading suggestion and never as a point.
  const core = smoothstep(0.42, 0.04, across)
  const halo = smoothstep(1.0, 0.1, across).mul(0.18)
  const ends = smoothstep(0, 0.14, alongN).mul(smoothstep(1, 0.86, alongN))
  const gate = smoothstep(inkN, inkN.add(0.16), uDraw.mul(1.16))
  const hairOpacity = core.add(halo).mul(wN).mul(ends).mul(gate).mul(uLine)
  const hairColour = vec3(LINE_GOLD.r, LINE_GOLD.g, LINE_GOLD.b).mul(
    float(0.8).add(core.mul(0.45))
  )

  // THE CUT: a burin stroke is the whole ribbon, and it carries the glancing
  // gilt an engraver leaves on one edge of a plate.
  const cutCore = smoothstep(1, 0.05, across)
  const cutGate = smoothstep(inkN, inkN.add(0.12), uDraw)
  const cutOpacity = cutCore.mul(wN).mul(cutGate).mul(uCut).mul(float(0.75))
  const cutColour = mix(vec3(PAPER.r, PAPER.g, PAPER.b), vec3(GOLD.r, GOLD.g, GOLD.b), gildN)

  mat.colorNode = mix(hairColour, cutColour, kindN)
  mat.opacityNode = mix(hairOpacity, cutOpacity, kindN).mul(reserve.node)
  return mat
}

// ------------------------------------------------------------- the burin
/* SIX BURIN DRAWINGS — the house as a figure, not as four dots and a
   caption. The pen cuts into the patch's own coordinate plane, so these are
   line geometries and never imported pictures or solid bodies. Broad forms
   are left OPEN; short unequal cuts describe their material, which is how
   an engraver builds a tone without ever laying down a fill.

   Every drawing is authored around THIS sky's stars: the named lights are
   the bones of the figure and the ink rests between them. */

type Point = [number, number]
interface Stroke {
  points: Point[]
  weight: number
  /** 0 paper, 1 gold: the glancing gilt an engraver puts on one edge */
  gild: number
}

const TAU = Math.PI * 2

/** a cubic at t, and the direction it is travelling there */
function bez(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const u = 1 - t
  return [
    u ** 3 * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t ** 3 * d[0],
    u ** 3 * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t ** 3 * d[1],
  ]
}

function bezNormal(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const p0 = bez(a, b, c, d, Math.max(0, t - 0.002))
  const p1 = bez(a, b, c, d, Math.min(1, t + 0.002))
  const dx = p1[0] - p0[0]
  const dy = p1[1] - p0[1]
  const len = Math.hypot(dx, dy) || 1
  return [-dy / len, dx / len]
}

/** a Catmull-Rom through a run of points: the way a hand carries a long
    curve through fixed stations without a corner at each one */
function throughPoints(pts: Point[], seg: number): Point[] {
  const out: Point[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    if (!p0 || !p1 || !p2 || !p3) continue
    for (let j = 0; j < seg; j++) {
      const t = j / seg
      const t2 = t * t
      const t3 = t2 * t
      out.push([
        0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  const last = pts[pts.length - 1]
  if (last) out.push(last)
  return out
}

class Burin {
  strokes: Stroke[] = []

  line(points: Point[], weight = 0.6, gild = 0): void {
    this.strokes.push({ points, weight, gild })
  }

  curve(a: Point, b: Point, c: Point, d: Point, weight = 0.6, gild = 0): void {
    const points: Point[] = []
    for (let i = 0; i <= 30; i++) points.push(bez(a, b, c, d, i / 30))
    this.line(points, weight, gild)
  }

  arc(
    x: number,
    y: number,
    rx: number,
    ry: number,
    from: number,
    to: number,
    weight = 0.5,
    gild = 0
  ): void {
    const n = Math.max(8, Math.ceil(Math.abs(to - from) * 24))
    const points: Point[] = []
    for (let i = 0; i <= n; i++) {
      const a = from + ((to - from) * i) / n
      points.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry])
    }
    this.line(points, weight, gild)
  }

  /** THE TONE. Short cuts laid across a straight run, unequal on purpose:
      an even comb is a hatch pattern, an uneven one is a hand. */
  hatchLine(
    a: Point,
    b: Point,
    n: number,
    off: number,
    len: number,
    weight = 0.38,
    from = 0.12,
    to = 0.9
  ): void {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const l = Math.hypot(dx, dy) || 1
    const nx = -dy / l
    const ny = dx / l
    for (let i = 0; i < n; i++) {
      const t = from + ((to - from) * i) / Math.max(1, n - 1)
      const x = a[0] + dx * t
      const y = a[1] + dy * t
      const k = len * (0.72 + 0.28 * Math.sin(i * 2.1))
      this.line(
        [
          [x + nx * off, y + ny * off],
          [x + nx * (off + k) + dx * 0.02, y + ny * (off + k) + dy * 0.02],
        ],
        weight
      )
    }
  }

  /** the same tone laid across a cubic */
  hatchCurve(
    a: Point,
    b: Point,
    c: Point,
    d: Point,
    n: number,
    off: number,
    len: number,
    weight = 0.36,
    from = 0.1,
    to = 0.92
  ): void {
    for (let i = 0; i < n; i++) {
      const t = from + ((to - from) * i) / Math.max(1, n - 1)
      const [x, y] = bez(a, b, c, d, t)
      const [nx, ny] = bezNormal(a, b, c, d, t)
      const k = len * (0.7 + 0.3 * Math.sin(i * 1.7 + 0.6))
      this.line(
        [
          [x + nx * off, y + ny * off],
          [x + nx * (off + k), y + ny * (off + k)],
        ],
        weight
      )
    }
  }
}

// ----------------------------------------------------------- the six houses

/* I · PHILOSOPHERS, after Cassiopeia. The W is cut as folded scrollwork:
   each limb of the letter becomes a banded ribbon, and the five lamps stay
   free of all ink. */
function cassiopeia(p: Burin, c: Constellation): void {
  for (const [ia, ib] of c.lines) {
    const a = c.stars[ia]
    const b = c.stars[ib]
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    for (const sign of [-1, 1]) {
      p.curve(
        [a.x + dx * 0.1 + nx * 0.1 * sign, a.y + dy * 0.1 + ny * 0.1 * sign],
        [a.x + dx * 0.36 + nx * 0.14 * sign, a.y + dy * 0.36 + ny * 0.14 * sign],
        [a.x + dx * 0.7 + nx * 0.14 * sign, a.y + dy * 0.7 + ny * 0.14 * sign],
        [b.x - dx * 0.09 + nx * 0.08 * sign, b.y - dy * 0.09 + ny * 0.08 * sign],
        0.72,
        0.25
      )
    }
    p.hatchLine([a.x, a.y], [b.x, b.y], 17, 0.045, 0.082, 0.37, 0.14, 0.86)
  }
  for (const s of [-1, 1]) {
    // the volutes the ribbon rolls into past the outer lamps
    p.curve([s * 1.87, 0.29], [s * 2.35, 0.63], [s * 2.42, -0.18], [s * 2.12, -0.09], 0.7)
    p.curve([s * 2.12, -0.09], [s * 1.98, -0.02], [s * 2.17, 0.18], [s * 2.18, 0.05], 0.48)
    // the small curl over the centre lamp
    p.curve([s * 0.13, 0.58], [s * 0.5, 0.83], [s * 0.71, 0.65], [s * 0.47, 0.49], 0.5)
    // and the sweep that closes the fold underneath
    p.curve([s * 1.75, -0.18], [s * 1.32, -0.7], [s * 0.58, -0.7], [s * 0.16, -0.39], 0.42)
  }
}

/* II · TEACHERS, after Corona Borealis. A DIADEM. The band follows the arc
   the six lamps themselves make, a constant drop below them, and on it
   stands one lily per lamp, all of a height. Open work: no medallion, no
   fill, and the lamps are never touched by the ink. */
const CROWN_DROP = 0.62

function crown(p: Burin, c: Constellation): void {
  const rail = c.stars.map((s): Point => [s.x, s.y - CROWN_DROP])
  const a0 = rail[0]
  const a1 = rail[1]
  const z0 = rail[rail.length - 1]
  const z1 = rail[rail.length - 2]
  if (!a0 || !a1 || !z0 || !z1) return
  const band = throughPoints(
    [
      [a0[0] + (a0[0] - a1[0]) * 0.34, a0[1] + (a0[1] - a1[1]) * 0.34],
      ...rail,
      [z0[0] + (z0[0] - z1[0]) * 0.34, z0[1] + (z0[1] - z1[1]) * 0.34],
    ],
    14
  )
  // four rules make a band: the first is the edge, the rest are its face
  for (let k = 0; k < 4; k++) {
    p.line(
      band.map(([x, y]): Point => [x, y - k * 0.05]),
      k === 0 ? 0.85 : 0.42,
      k === 0 ? 0.2 : 0
    )
  }
  // the face of the band carries a tone, so it is metal and not a wire
  for (let i = 2; i < band.length - 2; i += 3) {
    const pt = band[i]
    if (!pt) continue
    p.line([[pt[0] - 0.012, pt[1] - 0.02], [pt[0] + 0.008, pt[1] - 0.128]], 0.24)
  }
  // and the two ends roll into a return, so the band stops rather than ends
  for (const [end, dir] of [[band[0], -1], [band[band.length - 1], 1]] as Array<[Point, number]>) {
    if (!end) continue
    p.curve(
      [end[0], end[1]],
      [end[0] + dir * 0.19, end[1] + 0.04],
      [end[0] + dir * 0.15, end[1] - 0.2],
      [end[0] - dir * 0.01, end[1] - 0.19],
      0.55
    )
  }
  for (const star of c.stars) {
    const x = star.x
    const base = star.y - CROWN_DROP
    const tip = star.y - 0.12
    const h = tip - base
    const mid = base + h * 0.42
    // the lance
    p.curve([x, base], [x - 0.03, mid], [x + 0.02, tip - h * 0.2], [x, tip], 0.8)
    p.hatchLine([x, base + h * 0.42], [x, tip - h * 0.08], 5, -0.033, 0.026, 0.26)
    // two petals furling out and up, each doubled by a lighter cut
    for (const s of [-1, 1]) {
      p.curve(
        [x + s * 0.03, base + h * 0.1],
        [x + s * 0.27, base + h * 0.16],
        [x + s * 0.21, mid + h * 0.22],
        [x + s * 0.075, tip - h * 0.09],
        0.7
      )
      p.curve(
        [x + s * 0.03, base + h * 0.1],
        [x + s * 0.18, base + h * 0.25],
        [x + s * 0.15, mid + h * 0.18],
        [x + s * 0.065, tip - h * 0.15],
        0.34
      )
    }
    // the waist that binds the three, and the foot set into the band
    p.line([[x - 0.105, base + h * 0.3], [x + 0.105, base + h * 0.3]], 0.6)
    p.line([[x - 0.098, base + h * 0.365], [x + 0.098, base + h * 0.365]], 0.34)
    p.arc(x, base + 0.012, 0.05, 0.026, 0, TAU, 0.5, 0.4)
  }
}

/* III · ACTIVISTS AND LEADERS, after the Southern Cross. Four directional
   arms, each a shaft with its own hatched face, standing in a graduated
   ring. The arms are unequal, the way the asterism is. */
function cross(p: Burin): void {
  const centre: Point = [0.057, 0.1]
  const ends: Point[] = [
    [0, 1.05],
    [0.12, -1],
    [-0.85, -0.05],
    [0.78, 0.22],
  ]
  for (const end of ends) {
    const dx = end[0] - centre[0]
    const dy = end[1] - centre[1]
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    for (const s of [-1, 1]) {
      p.line(
        [
          [centre[0] + nx * 0.085 * s, centre[1] + ny * 0.085 * s],
          [end[0] - dx * 0.2 + nx * 0.065 * s, end[1] - dy * 0.2 + ny * 0.065 * s],
          [end[0] - dx * 0.15 + nx * 0.13 * s, end[1] - dy * 0.15 + ny * 0.13 * s],
        ],
        0.75,
        0.4
      )
    }
    for (let j = 0; j < 15; j++) {
      const t = 0.16 + j * 0.036
      p.line(
        [
          [centre[0] + dx * t + nx * 0.033, centre[1] + dy * t + ny * 0.033],
          [centre[0] + dx * (t + 0.037) + nx * 0.079, centre[1] + dy * (t + 0.037) + ny * 0.079],
        ],
        0.4
      )
    }
  }
  p.arc(centre[0], centre[1], 0.28, 0.28, 0, TAU, 0.52)
  p.arc(centre[0], centre[1], 0.31, 0.31, 0, TAU, 0.3)
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * TAU
    if (Math.abs(Math.sin(a * 2)) < 0.2) continue
    p.line(
      [
        [centre[0] + Math.cos(a) * 0.34, centre[1] + Math.sin(a) * 0.34],
        [
          centre[0] + Math.cos(a) * (k % 4 === 0 ? 0.42 : 0.375),
          centre[1] + Math.sin(a) * (k % 4 === 0 ? 0.42 : 0.375),
        ],
      ],
      0.37
    )
  }
}

/* IV · ARTISTS, after Lyra. Two horns rising out of a soundbox to their
   volutes, the yoke across them, seven strings down to the bridge. The
   frame is drawn around this sky's own four names: the left volute stands
   on the first, the middle string runs through the second, the bridge
   rests on the last two. */
function lyre(p: Burin): void {
  const arms: Array<{ a: Point; b: Point; c: Point; d: Point; scroll: Point; s: number }> = [
    {
      a: [-0.32, -0.74],
      b: [-0.88, -0.3],
      c: [-1.06, 0.46],
      d: [-0.86, 0.83],
      scroll: [-0.85, 0.95],
      s: -1,
    },
    {
      a: [0.72, -0.27],
      b: [1.02, 0.02],
      c: [1.0, 0.46],
      d: [0.83, 0.63],
      scroll: [0.82, 0.73],
      s: 1,
    },
  ]
  for (const arm of arms) {
    for (let k = 0; k < 3; k++) {
      const o = k * 0.032 * arm.s
      p.curve(
        [arm.a[0] + o, arm.a[1]],
        [arm.b[0] + o, arm.b[1]],
        [arm.c[0] + o, arm.c[1]],
        [arm.d[0] + o, arm.d[1]],
        k === 0 ? 0.88 : 0.4,
        k === 0 ? 0.25 : 0
      )
    }
    // a light tone on the shaded inner face only
    p.hatchCurve(arm.a, arm.b, arm.c, arm.d, 13, arm.s * 0.098, arm.s * 0.05, 0.26, 0.18, 0.84)
    // the volute: a carved scroll, small enough to read as carving
    p.arc(arm.scroll[0], arm.scroll[1], 0.105, 0.098, -0.7, Math.PI * 1.55, 0.72)
    p.arc(arm.scroll[0], arm.scroll[1], 0.055, 0.05, 0.1, Math.PI * 1.35, 0.4)
  }
  // the yoke: a rule and its shadow, and a peg for every string
  p.curve([-0.78, 0.88], [-0.36, 0.81], [0.3, 0.73], [0.76, 0.66], 0.85, 0.5)
  p.curve([-0.78, 0.83], [-0.36, 0.76], [0.3, 0.68], [0.76, 0.61], 0.42)
  // the bridge, laid through the two lower names
  p.line([[-0.32, -0.738], [0.72, -0.266]], 0.78)
  p.line([[-0.32, -0.788], [0.72, -0.316]], 0.4)
  for (let j = 0; j < 7; j++) {
    const u = j / 6
    const x0 = -0.71 + u * 1.4
    const y0 = 0.85 - u * 0.21
    const x1 = -0.28 + u * 0.96
    const y1 = -0.72 + u * 0.435
    p.line([[x0, y0], [x1, y1]], j === 3 ? 0.54 : 0.32)
    p.arc(x0, y0 + 0.032, 0.019, 0.022, 0, TAU, 0.35)
  }
  // the soundbox: the shallow bowl the bridge stands on, hung between the
  // same two joints the horns rise from
  p.curve([-0.32, -0.74], [-0.2, -1.05], [0.48, -0.95], [0.72, -0.27], 0.72)
  p.curve([-0.26, -0.76], [-0.15, -0.98], [0.43, -0.89], [0.66, -0.3], 0.36)
  p.hatchCurve([-0.32, -0.74], [-0.2, -1.05], [0.48, -0.95], [0.72, -0.27], 17, -0.024, -0.05, 0.3)
  // the rose, an open ring cut into the belly, never a solid disc
  p.arc(0.18, -0.66, 0.085, 0.055, 0, TAU, 0.42)
  p.arc(0.18, -0.66, 0.05, 0.032, 0, TAU, 0.28)
}

/* V · WRITERS, after Cygnus. THE SWAN. Raised wings, the long neck, the
   open fan of the tail: every feather is its own cut, and the six names are
   the bird's own bones — head, breast, wing, wing, far wingtip, tail. */
function swan(p: Burin): void {
  // the neck, an S in two lines, and the head above the first name
  p.curve([-0.11, 0.18], [-0.36, 0.6], [0.3, 0.82], [0.02, 1.04], 0.8)
  p.curve([0.12, 0.19], [-0.1, 0.58], [0.55, 0.95], [0.1, 1.12], 0.66)
  p.curve([0.1, 1.12], [0.0, 1.29], [-0.27, 1.2], [-0.17, 1.0], 0.7)
  p.line([[-0.17, 1.06], [-0.37, 1.03], [-0.18, 0.98]], 0.55)
  for (const s of [-1, 1]) {
    // the leading edge out to the wingtip, and the trailing edge under it
    p.curve([s * 0.13, 0.24], [s * 0.7, 0.36], [s * 1.14, 0.74], [s * 1.75, 0.72], 0.85)
    p.curve([s * 0.12, -0.42], [s * 0.66, -0.3], [s * 1.42, 0.1], [s * 1.75, 0.72], 0.6)
    // the primaries: each one its own cut, longer and heavier outward
    for (let j = 0; j < 23; j++) {
      const t = j / 22
      const x = 0.22 + t * 1.48
      const y = 0.3 + 0.42 * t
      const endX = 0.28 + t * 1.42
      const endY = -0.36 + 1.08 * t ** 1.62
      p.curve(
        [s * x, y],
        [s * (x + 0.14), y - 0.2],
        [s * (endX + 0.08), endY + 0.08],
        [s * endX, endY],
        0.28 + t * 0.25
      )
      if (j % 2 === 0)
        p.curve(
          [s * (x + 0.025), y - 0.012],
          [s * (x + 0.16), y - 0.21],
          [s * (endX + 0.09), endY + 0.08],
          [s * (endX + 0.018), endY + 0.01],
          0.24
        )
    }
    // the breast, and the five tail feathers the fan opens into
    p.curve([s * 0.14, 0.08], [s * 0.35, -0.27], [s * 0.32, -0.52], [s * 0.13, -0.75], 0.72)
    for (let j = 0; j < 5; j++)
      p.curve(
        [s * 0.09, -0.48],
        [s * (0.2 + j * 0.04), -0.76],
        [s * (0.12 + j * 0.06), -0.98],
        [s * (0.12 + j * 0.07), -1.24],
        0.38
      )
  }
}

/* VI · SCIENTISTS AND THINKERS, after Auriga. The five names ARE the plate:
   the figure is the instrument they describe, a graduated limb inside a
   triple rule. The centre is left an open question, never a medallion. */
function pentagon(p: Burin, c: Constellation): void {
  const pts = c.stars.map((s): Point => [s.x, s.y])
  const first = pts[0]
  if (!first) return
  for (const scale of [0.83, 0.87, 1.12]) {
    p.line(
      [...pts, first].map(([x, y]): Point => [x * scale, y * scale]),
      scale === 0.83 ? 0.65 : 0.4,
      0.15
    )
  }
  for (const [ia, ib] of c.lines) {
    const a = pts[ia]
    const b = pts[ib]
    if (!a || !b) continue
    for (let j = 0; j < 18; j++) {
      const t = 0.1 + j * 0.047
      const x = a[0] + (b[0] - a[0]) * t
      const y = a[1] + (b[1] - a[1]) * t
      p.line(
        [
          [x * 0.87, y * 0.87],
          [x * 0.92 + (b[0] - a[0]) * 0.018, y * 0.92 + (b[1] - a[1]) * 0.018],
        ],
        0.4
      )
    }
  }
  p.arc(0, 0, 0.66, 0.66, 0, TAU, 0.5)
  p.arc(0, 0, 0.62, 0.62, 0, TAU, 0.32)
  for (let j = 0; j < 60; j++) {
    const a = (j / 60) * TAU
    p.line(
      [
        [Math.cos(a) * 0.66, Math.sin(a) * 0.66],
        [Math.cos(a) * (j % 5 === 0 ? 0.725 : 0.687), Math.sin(a) * (j % 5 === 0 ? 0.725 : 0.687)],
      ],
      0.43
    )
  }
  for (let j = 0; j < pts.length; j++) {
    const pt = pts[j]
    if (!pt) continue
    p.line([[pt[0] * 0.34, pt[1] * 0.34], [pt[0] * 0.57, pt[1] * 0.57]], 0.28)
  }
}

// ------------------------------------------------------- the engraved mesh
/* One ribbon per stroke, the nib pressing a little harder through the
   middle of a cut. The ribbons are appended to the house's own hairline
   buffer, so figure and engraving are one draw and are drawn by one hand:
   the ink walk they share is the same clock. */
const CUT_HALF = 0.01

const PAPER = new Color('#f3efe2')

function burinFor(c: Constellation): Burin {
  const pen = new Burin()
  switch (c.key) {
    case 'philosophers':
      cassiopeia(pen, c)
      break
    case 'teachers':
      crown(pen, c)
      break
    case 'activists':
      cross(pen)
      break
    case 'artists':
      lyre(pen)
      break
    case 'writers':
      swan(pen)
      break
    case 'scientists':
      pentagon(pen, c)
      break
  }
  return pen
}

// -------------------------------------------------------------- the plate
/* THE SKY IS A PLATE. Three registers hang on the same shell as the houses,
   so a chapter change sweeps all of them past you (law 3):

   THE RIVER — the Milky Way, on the same great circle the choir's dust
   already follows. It is drawn as light that is ADDED to the night, never
   as a wash laid over it: the lobby owns its own sky and its own horizon,
   and this shell may only put stars into it. Its grain runs WITH the
   circle, because isotropic noise across a band is weather, not star
   clouds; its two banks are unequal; and the dark rift is simply the lane
   where no light is added, which is what dust actually does.

   THE GRATICULE — declination parallels and their meridians, plus the
   degree circle in the north. Hairlines: the instrument register.

   THE ECLIPTIC — one real great circle at the earth's 23.44° obliquity,
   graduated every degree, gilded because it is a measuring edge. */

const SHELL = 150
const BAND_AZ = 2.35
const BAND_EL = 0.24
const DEG = Math.PI / 180

const LAPIS = new Color('#182350')
const ASH = new Color('#8d93ad')

/** a ribbon laid on the shell. The cross coordinate lets the fragment
    soften a hairline inside geometry wide enough to sample reliably. */
class ShellInk {
  private pos: number[] = []
  private across: number[] = []
  private strength: number[] = []
  private tint: number[] = []
  private idx: number[] = []

  path(
    sample: (t: number) => Vector3,
    segments: number,
    weight: number,
    ink: Color,
    gain: number,
    halfWidth = 0.0012
  ): void {
    const base = this.pos.length / 3
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const d = sample(t).normalize()
      const before = sample(Math.max(0, t - 0.0001))
      const after = sample(Math.min(1, t + 0.0001))
      const tangent = after.sub(before).normalize()
      const side = new Vector3().crossVectors(d, tangent).normalize()
      for (const sign of [-1, 1]) {
        const q = d
          .clone()
          .addScaledVector(side, halfWidth * sign)
          .normalize()
          .multiplyScalar(SHELL - 2)
        this.pos.push(q.x, q.y, q.z)
        this.across.push(sign)
        this.strength.push(weight * gain)
        this.tint.push(ink.r, ink.g, ink.b)
      }
      if (i < segments) {
        const v = base + i * 2
        this.idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
      }
    }
  }

  geometry(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('aCross', new Float32BufferAttribute(this.across, 1))
    g.setAttribute('aStrength', new Float32BufferAttribute(this.strength, 1))
    g.setAttribute('aTint', new Float32BufferAttribute(this.tint, 3))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    return g
  }
}

function onShell(azimuth: number, elevation: number): Vector3 {
  return new Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    -Math.cos(azimuth) * Math.cos(elevation)
  )
}

function inkMaterial(uReveal: N, reserve: Reserve): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  })
  mat.forceSinglePass = true
  const a: N = abs(attribute('aCross', 'float') as N)
  const core = smoothstep(0.7, 0.04, a)
  const skirt = smoothstep(1, 0.14, a).mul(0.16)
  mat.colorNode = attribute('aTint', 'vec3') as N
  mat.opacityNode = core
    .add(skirt)
    .mul(attribute('aStrength', 'float') as N)
    .mul(uReveal)
    .mul(reserve.node)
  return mat
}

interface Plate {
  group: Group
  update(reveal: number): void
}

function createPlate(reserve: Reserve): Plate {
  const group = new Group()
  const uReveal: N = uniform(0)

  // ------------------------------------------------------------ the river
  const riverMat = new MeshBasicNodeMaterial({
    side: BackSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  {
    const d: N = normalize(positionLocal)
    const bn = new Vector3(
      Math.cos(BAND_AZ) * Math.cos(BAND_EL),
      Math.sin(BAND_EL),
      Math.sin(BAND_AZ) * Math.cos(BAND_EL)
    )
    const bu = new Vector3().crossVectors(bn, new Vector3(0, 1, 0)).normalize()
    const bv = new Vector3().crossVectors(bn, bu).normalize()
    const plane = dot(d, vec3(bn.x, bn.y, bn.z))
    const alongU = dot(d, vec3(bu.x, bu.y, bu.z))
    const alongV = dot(d, vec3(bv.x, bv.y, bv.z))

    const fold = mxNoise(vec3(alongU.mul(3.2), alongV.mul(3.2), plane.mul(7)).add(3.7))
    const offset = plane.add(fold.mul(0.032))
    const envelope = pow(clamp(float(1).sub(abs(offset).div(0.25)), 0, 1), 1.5)

    // the grain runs WITH the circle: compressing the cross-river axis is
    // what turns low-frequency noise into torn filaments instead of weather
    const flow = vec3(alongU.mul(12), alongV.mul(12), offset.mul(62))
    const cloud = clamp(mxFractal(flow, 3, 2, 0.54, 1).mul(0.82).add(0.48), 0, 1)
    const threads = clamp(
      mxNoise(
        vec3(alongU.mul(37).add(cloud.mul(1.3)), alongV.mul(37), offset.mul(204).add(cloud.mul(1.8)))
      )
        .mul(0.5)
        .add(0.5),
      0,
      1
    )
    const detail = smoothstep(0.3, 0.72, threads)
    const cloudLight = pow(cloud, 1.2).mul(0.88).add(detail.mul(0.35)).add(0.12)

    // unequal banks keep the dark lane off the optical middle
    const wideBank = pow(clamp(float(1).sub(abs(offset.add(0.053)).div(0.132)), 0, 1), 1.3)
    const thinBank = pow(clamp(float(1).sub(abs(offset.sub(0.052)).div(0.083)), 0, 1), 1.5)
    const banks = wideBank.mul(0.83).add(thinBank.mul(0.58))
    const light = banks.mul(cloudLight).mul(0.89).add(envelope.mul(0.085))
    const ragged = offset.add(0.009).add(fold.mul(0.013)).add(cloud.sub(0.5).mul(0.012))
    const rift = smoothstep(0.039, 0.004, abs(ragged)).mul(envelope).mul(cloud.mul(0.24).add(0.69))

    // the river dies into the horizon: the lobby's own colonnade and its
    // warm band own the bottom of this frame, and nothing here may lift it
    const air = smoothstep(-0.04, 0.34, d.y)
    let col: N = vec3(LAPIS.r, LAPIS.g, LAPIS.b).mul(light).mul(RIVER_GAIN)
    col = col.add(vec3(ASH.r, ASH.g, ASH.b).mul(light).mul(detail.mul(0.6).add(0.4)).mul(0.016))
    col = col.mul(float(1).sub(rift))
    // stable screen grain dithers the deep-blue ramp where sRGB's steps are
    // widest, and stays still under reduced motion
    const grain = fract(
      sin(dot(screenCoordinate.xy.add(0.5), vec2(12.9898, 78.233))).mul(43758.5453)
    )
      .sub(0.5)
      .mul(0.0011)
    riverMat.colorNode = clamp(col.mul(air).add(grain.mul(air)), 0, 1)
    riverMat.opacityNode = uReveal
  }
  const river = new Mesh(new SphereGeometry(SHELL, narrow ? 36 : 48, narrow ? 24 : 32), riverMat)
  river.renderOrder = -9
  river.frustumCulled = false
  group.add(river)

  // ------------------------------- the graticule and the gilt ecliptic
  /* Two registers, one buffer: the phone's calm stage is a 60-draw frame,
     and a hairline's tint is a per-vertex fact, not a second material. */
  const ink = new ShellInk()
  const GRID_GAIN = 0.0095
  for (let lat = -30; lat <= 75; lat += 15) {
    ink.path(
      (t) => onShell(t * TAU, lat * DEG),
      160,
      lat === 0 ? 0.76 : lat % 30 === 0 ? 0.63 : 0.38,
      PAPER,
      GRID_GAIN
    )
  }
  for (let lon = 0; lon < 360; lon += 30) {
    ink.path(
      (t) => onShell(lon * DEG, (-34 + 116 * t) * DEG),
      96,
      lon % 90 === 0 ? 0.62 : 0.4,
      PAPER,
      GRID_GAIN
    )
  }
  // the northern degree circle: every tenth division takes the longer cut,
  // the way a plate is graduated
  for (let deg = 0; deg < 360; deg += 2) {
    const major = deg % 10 === 0
    ink.path(
      (t) => onShell(deg * DEG, (60 + (t - 0.5) * (major ? 1.15 : 0.5)) * DEG),
      1,
      major ? 0.76 : 0.44,
      PAPER,
      GRID_GAIN,
      0.001
    )
  }
  // and one real great circle at the earth's 23.44 degree obliquity,
  // graduated every degree. It is gilded because it is a measuring edge.
  const ECL_GAIN = 0.022
  const obliquity = 23.44 * DEG
  const onEcliptic = (azimuth: number, off = 0): Vector3 =>
    onShell(azimuth, off).applyAxisAngle(new Vector3(0, 0, 1), obliquity)
  ink.path((t) => onEcliptic(t * TAU), 256, 0.72, GOLD, ECL_GAIN, 0.0014)
  for (let deg = 0; deg < 360; deg++) {
    const major = deg % 10 === 0
    const medium = deg % 5 === 0
    const height = (major ? 1.5 : medium ? 0.9 : 0.36) * DEG
    ink.path(
      (t) => onEcliptic(deg * DEG, (t - 0.5) * height),
      1,
      major ? 0.88 : medium ? 0.66 : 0.4,
      GOLD,
      ECL_GAIN,
      0.001
    )
  }
  const plate = new Mesh(ink.geometry(), inkMaterial(uReveal, reserve))
  plate.renderOrder = -7
  plate.frustumCulled = false
  group.add(plate)

  return {
    group,
    update(reveal) {
      uReveal.value = Math.max(0, Math.min(1, reveal))
      group.visible = reveal > 0.001
    },
  }
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
   than in a vacuum. They are SEEDED in patch coordinates, which is what
   keeps them on the shape at any stage width, and then seated once on the
   dome: six sprite fields were six draw calls, and the calm stage is a
   sixty-draw frame. The seating is redone only when the patches change
   scale, which is a resize and nothing else. */
interface Companion {
  x: number
  y: number
  size: number
  dim: number
  rate: number
  phase: number
  house: number
}

function seedCompanions(
  c: Constellation,
  rand: () => number,
  count: number,
  house: number
): Companion[] {
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
  const out: Companion[] = []
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
    out.push({
      x,
      y,
      size: 1.15 + rand() * 1.2,
      dim: 0.22 + rand() * 0.54,
      rate: 0.6 + rand() * 1.4,
      phase: rand() * Math.PI * 2,
      house,
    })
  }
  return out
}

interface CompanionField {
  sprite: Sprite
  uT: N
  /** seat every grain from its house's own patch transform */
  seat(matrices: Matrix4[]): void
  /** the per-house presence, written straight into the instance buffer */
  present(presence: number[]): void
}

function buildCompanionField(seeds: Companion[]): CompanionField {
  const n = Math.max(1, seeds.length)
  const pos = new Float32Array(n * 3)
  const size = new Float32Array(n)
  const dim = new Float32Array(n)
  const tw = new Float32Array(n * 2)
  seeds.forEach((cp, k) => {
    size[k] = cp.size
    dim[k] = cp.dim
    tw[k * 2] = cp.rate
    tw[k * 2 + 1] = cp.phase
  })
  const aPos = new InstancedBufferAttribute(pos, 3)
  aPos.setUsage(DynamicDrawUsage)
  const aSize = new InstancedBufferAttribute(size, 1)
  const aDim = new InstancedBufferAttribute(dim, 1)
  aDim.setUsage(DynamicDrawUsage)
  const aTw = new InstancedBufferAttribute(tw, 2)

  const uT: N = uniform(0)
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
  mat.opacityNode = kernel.mul(dimN).mul(float(1).sub(shimmer.mul(0.34)))

  const sprite = new Sprite(mat)
  sprite.count = n
  sprite.frustumCulled = false

  const seatTmp = new Vector3()
  return {
    sprite,
    uT,
    seat(matrices) {
      seeds.forEach((cp, k) => {
        const m = matrices[cp.house]
        if (!m) return
        seatTmp.set(cp.x, cp.y, -0.02).applyMatrix4(m)
        pos[k * 3] = seatTmp.x
        pos[k * 3 + 1] = seatTmp.y
        pos[k * 3 + 2] = seatTmp.z
      })
      aPos.needsUpdate = true
    },
    present(presence) {
      seeds.forEach((cp, k) => {
        dim[k] = cp.dim * (presence[cp.house] ?? 0)
      })
      aDim.needsUpdate = true
    },
  }
}

// ------------------------------------------------------------- the atlas
export function createAtlas(scene: Scene): AtlasHandles {
  const dome = new Group()
  dome.visible = false
  scene.add(dome)
  const rand = mulberry32(FOUNDING_SEED)
  const reserve = createLetteringReserve()
  const plate = createPlate(reserve)
  dome.add(plate.group)

  const starMap = starTexture()

  // a phone sees a much narrower slice of the dome than a desk, so an
  // equal budget is a much emptier frame: the narrow tier keeps almost the
  // whole count and spends it on a smaller sky (round 2)
  const choir = buildChoir(rand, narrow ? 1450 : 1750)
  dome.add(choir.sprite)

  /* THE TWO WANDERERS — the sky has a mechanism. Two lights that never
     twinkle and never belong to a house, drifting against the dome across
     a whole sitting. They are cool on purpose: gold is a name (law 1).
     One instanced field for the pair, because two sprites are two draws
     and the calm stage counts every one of them. */
  const wanderers = new Group()
  dome.add(wanderers)
  const WANDER: Array<[number, number, number, number]> = [
    [0.42, 0.98, 9.2, 1.15],
    [3.02, 0.44, 7.2, 0.95],
  ]
  const wanderDir = new Vector3()
  const wPos = new Float32Array(WANDER.length * 3)
  const wSize = new Float32Array(WANDER.length)
  const wCol = new Float32Array(WANDER.length * 3)
  WANDER.forEach(([az, el, px, dim], i) => {
    wanderDir.set(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      -Math.cos(az) * Math.cos(el)
    )
    wanderDir.multiplyScalar(120)
    wPos[i * 3] = wanderDir.x
    wPos[i * 3 + 1] = wanderDir.y
    wPos[i * 3 + 2] = wanderDir.z
    wSize[i] = px
    wCol[i * 3] = CHOIR_ICE.r * dim
    wCol[i * 3 + 1] = CHOIR_ICE.g * dim
    wCol[i * 3 + 2] = CHOIR_ICE.b * dim
  })
  const uWander: N = uniform(0)
  const wanderMat = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  {
    wanderMat.positionNode = instancedBufferAttribute(new InstancedBufferAttribute(wPos, 3))
    wanderMat.sizeAttenuation = false
    wanderMat.sizeNode = instancedBufferAttribute(new InstancedBufferAttribute(wSize, 1))
    const colN: N = instancedBufferAttribute(new InstancedBufferAttribute(wCol, 3))
    const d = uv().sub(vec2(0.5, 0.5))
    const dd = length(d)
    // a planet is a disc, not a scintillating point: a tight core and one
    // soft skirt, and no twinkle term anywhere
    const kernel = smoothstep(0.22, 0.0, dd).add(smoothstep(0.5, 0.06, dd).mul(0.34))
    wanderMat.colorNode = colN
    wanderMat.opacityNode = kernel.mul(uWander)
  }
  const wanderField = new Sprite(wanderMat)
  wanderField.count = WANDER.length
  wanderField.frustumCulled = false
  wanderers.add(wanderField)

  interface Star {
    sprite: Sprite
    mat: SpriteMaterial
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
    /** how present the burin is: the drawing belongs to the focused house */
    cutU: N
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
  const companionSeeds: Companion[] = []
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
    // one disc for every name (the ruling above), so a house reads as a
    // register of equals and not as one flare with five witnesses
    const sizes = mag.map((m) => 0.21 + 0.33 * m * m)

    // the companions are seeded here and seated on the dome below, so all
    // six houses share one field
    companionSeeds.push(...seedCompanions(c, rand, narrow ? 18 : 26, ci))

    const lineU: N = uniform(0)
    const drawU: N = uniform(1)
    const cutU: N = uniform(0)
    const house = new Mesh(figureGeometry(c, mag, sizes), figureMaterial(lineU, drawU, cutU, reserve))
    house.frustumCulled = false
    patch.add(house)

    const list: Star[] = []
    c.stars.forEach((s, si) => {
      const m = mag[si] ?? 0.6
      const mat = new SpriteMaterial({
        map: starMap,
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
      cutU,
      azimuth: c.azimuth,
      fit,
      focus: ci === 0 ? 1 : 0,
    })
  }

  /* one field for every house's lesser stars, seated below the named ones
     so a name always draws over its own gathering */
  const companions = buildCompanionField(companionSeeds)
  companions.sprite.renderOrder = -1
  dome.add(companions.sprite)
  /** the scale the companions were last seated at */
  let seatedScale = -1
  const housePresence = new Array<number>(CONSTELLATIONS.length).fill(0)

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
    plate.update(reveal)
    uWander.value = reveal * 0.62

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
        s.mat.opacity = pres * s.bright * (1 - s.scint * sh)
        s.sprite.scale.setScalar(s.size * shrink)
      }
      // a neighbour keeps the ghost of its own figure at the frame edge:
      // enough to say the sky goes on around you, far too little to read
      p.lineU.value = near * (0.045 + 0.955 * p.focus) * reveal * 0.78
      p.drawU.value = draw
      // the engraving belongs to the house you are looking at: a neighbour
      // keeps a whisper of it, so the sky reads as one drawn plate
      p.cutU.value = pres * (0.025 + p.focus * 0.42)
      housePresence[i] = near * (0.12 + 0.88 * p.focus) * reveal * 0.8
    }
    // the grains are re-seated only when the stage changes width
    if (Math.abs(scale - seatedScale) > 1e-4) {
      seatedScale = scale
      companions.seat(
        patches.map((q) => {
          q.group.updateMatrix()
          return q.group.matrix
        })
      )
    }
    companions.present(housePresence)
    companions.uT.value = reducedMotion ? 0 : elapsed
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
    reserveLabels: reserve.update,
    visible(v: boolean) {
      dome.visible = v
    },
  }
}
