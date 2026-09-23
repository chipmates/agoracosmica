/* THE TREES OF 10 OCTOBER 1517, GROWN.

   A tree here is grown from its species' habit, not drawn: a trunk, the
   scaffold limbs it carries, their branches and the twigs at the end of
   those, each one a child of the last, so nothing floats. Every limb grows
   until it meets the crown the species makes, and the leaves stand on the
   twigs in that crown's outer shell, which is where a tree keeps them. Every
   leaf is its own card with its species' outline, lit as a thin body by the
   scene's own light, and throws its shadow through one opaque triangle
   inside that outline.

   The season is the Julian date's own: 10 October 1517 is our 20 October.
   The flora card gives each species its state that week (full or thinning,
   green or turning); everything else here is a type of the period and a
   reading, never a record of a tree that stood at Cloux. */
import { cellUV, LEAF_RECIPES, leafCell, SPRAY_LEAF, sprayCell } from './leaf-maps'

export type Species =
  | 'walnut' | 'elm' | 'oak' | 'maple' | 'cherry' | 'hornbeam'
  | 'alder' | 'willow' | 'poplar' | 'pear'
export type TreeDetail = 'near' | 'mid' | 'far'
export type TreeTier = 'hero' | 'standard' | 'calm'

/** How the outline of one leaf (or one leaflet) runs, base to tip. */
type Outline = 'ovate' | 'elliptic' | 'obovate' | 'lanceolate' | 'lobed' | 'palmate' | 'deltoid' | 'round'

interface Habit {
  /** the trunk runs this share of the height before it splits or thins out */
  trunkShare: number
  /** leaders a split trunk divides into, and how far off vertical they go */
  leaders: [number, number]
  leaderAngle: number
  /** the crown starts at this share of the height */
  crownBase: number
  /** the crown's width against the tree's height */
  spread: number
  /** where along the crown's height it is widest (0 base, 1 top) and how
      blunt its top is (higher is flatter) */
  widest: number
  blunt: number
  /** scaffold limbs per metre of trunk or leader inside the crown */
  scaffoldPerM: number
  /** a scaffold's angle off vertical at the crown base and at the top */
  scaffoldAngle: [number, number]
  /** radians of bend per metre, and the up (+) or down (-) pull per metre */
  curve: number
  tropism: number
  /** second-order branches per metre of scaffold, their angle off the
      parent, their share of the remaining reach and their own pull */
  branchPerM: number
  branchAngle: number
  branchReach: number
  branchTropism: number
  /** twigs per metre of branch, their length, their pull */
  twigPerM: number
  twigLength: number
  twigTropism: number
  /** 0 spreads the leaves along the twig, 1 gathers them at its end */
  leafGather: number
  leaf: { outline: Outline; length: number; width: number; leaflets?: number; droop: number }
  /** the trunk's radius against the height, and the bark */
  girth: number
  bark: { kind: BarkKind; colour: string; lichen: string }
  /** the week's state: share already fallen, and the leaf colours with
      their weights, green first, most turned last */
  fallen: number
  palette: readonly (readonly [string, number])[]
  /** how much the turn follows the light: outer and upper leaves first */
  exposureTurn: number
}

export type BarkKind = 'furrowed' | 'smooth' | 'banded' | 'plated'

/* The species of the flora card (FLORA.md §6), each in its state of about 20
   October. Where the card has no colour (elm) the colour is our reading. */
export const HABITS: Record<Species, Habit> = {
  walnut: {
    trunkShare: .34, leaders: [3, 4], leaderAngle: .62, crownBase: .24, spread: 1.05, widest: .42, blunt: 1.5,
    scaffoldPerM: 1.1, scaffoldAngle: [1.25, .62], curve: .10, tropism: .05,
    branchPerM: 1.25, branchAngle: .72, branchReach: .52, branchTropism: .04,
    twigPerM: 2.4, twigLength: .55, twigTropism: .10,
    leafGather: .55,
    leaf: { outline: 'elliptic', length: .11, width: .42, leaflets: 7, droop: .55 },
    girth: .030, bark: { kind: 'furrowed', colour: '#a29e93', lichen: '#959a82' },
    fallen: .2,
    palette: [['#6f7440', 1], ['#9a9444', 1.4], ['#b39a45', 2.2], ['#a98b3d', 1.6], ['#8a6a38', 1.1], ['#6d5434', .5]],
    exposureTurn: .55,
  },
  elm: {
    trunkShare: .5, leaders: [2, 3], leaderAngle: .32, crownBase: .24, spread: .66, widest: .55, blunt: .9,
    scaffoldPerM: 1.35, scaffoldAngle: [.95, .42], curve: .12, tropism: -.02,
    branchPerM: 1.6, branchAngle: .62, branchReach: .48, branchTropism: -.10,
    twigPerM: 3.2, twigLength: .45, twigTropism: -.04,
    leafGather: .15,
    leaf: { outline: 'ovate', length: .075, width: .58, droop: .35 },
    girth: .024, bark: { kind: 'furrowed', colour: '#6d6457', lichen: '#7f8269' },
    fallen: .1,
    palette: [['#56623a', 1.3], ['#6f7843', 1.6], ['#8e9146', 1.4], ['#a99d48', 1.1], ['#b09550', .6], ['#7d6440', .25]],
    exposureTurn: .6,
  },
  oak: {
    trunkShare: .40, leaders: [2, 4], leaderAngle: .70, crownBase: .26, spread: 1.0, widest: .45, blunt: 1.3,
    scaffoldPerM: 1.2, scaffoldAngle: [1.35, .75], curve: .22, tropism: .0,
    branchPerM: 1.45, branchAngle: .82, branchReach: .5, branchTropism: .0,
    twigPerM: 2.8, twigLength: .38, twigTropism: .12,
    leafGather: .7,
    leaf: { outline: 'lobed', length: .10, width: .55, droop: .25 },
    girth: .032, bark: { kind: 'furrowed', colour: '#6b665c', lichen: '#848a70' },
    fallen: .03,
    palette: [['#4e5a33', 1.4], ['#5f6639', 1.8], ['#6f6b3c', 1.8], ['#80743f', 1.0], ['#8d7440', .5], ['#6e5836', .2]],
    exposureTurn: .45,
  },
  maple: {
    trunkShare: .30, leaders: [2, 4], leaderAngle: .55, crownBase: .20, spread: .95, widest: .45, blunt: 1.0,
    scaffoldPerM: 1.7, scaffoldAngle: [1.05, .55], curve: .14, tropism: .06,
    branchPerM: 2.2, branchAngle: .7, branchReach: .52, branchTropism: .05,
    twigPerM: 3.6, twigLength: .35, twigTropism: .08,
    leafGather: .45,
    leaf: { outline: 'palmate', length: .07, width: 1.0, droop: .3 },
    girth: .028, bark: { kind: 'plated', colour: '#7a6c5a', lichen: '#86896f' },
    fallen: .15,
    palette: [['#7f8143', .5], ['#a8983e', 1.2], ['#c29a37', 2.0], ['#caa23e', 1.6], ['#bf7a35', .9], ['#a9583a', .45]],
    exposureTurn: .5,
  },
  cherry: {
    trunkShare: .78, leaders: [1, 1], leaderAngle: .1, crownBase: .30, spread: .66, widest: .38, blunt: .7,
    scaffoldPerM: 1.5, scaffoldAngle: [1.05, .6], curve: .09, tropism: .08,
    branchPerM: 1.7, branchAngle: .62, branchReach: .5, branchTropism: -.04,
    twigPerM: 2.6, twigLength: .38, twigTropism: .0,
    leafGather: .75,
    leaf: { outline: 'obovate', length: .10, width: .46, droop: .75 },
    girth: .024, bark: { kind: 'banded', colour: '#6a4f45', lichen: '#7e8069' },
    fallen: .3,
    palette: [['#8a8646', .5], ['#b58c3c', 1.2], ['#c0703a', 1.6], ['#b0503a', 1.4], ['#8e3f36', .9], ['#6f4a38', .3]],
    exposureTurn: .6,
  },
  hornbeam: {
    trunkShare: .45, leaders: [2, 3], leaderAngle: .38, crownBase: .22, spread: .78, widest: .45, blunt: .9,
    scaffoldPerM: 1.8, scaffoldAngle: [.95, .45], curve: .12, tropism: .05,
    branchPerM: 2.3, branchAngle: .62, branchReach: .45, branchTropism: .0,
    twigPerM: 3.6, twigLength: .34, twigTropism: .02,
    leafGather: .2,
    leaf: { outline: 'ovate', length: .08, width: .5, droop: .3 },
    girth: .024, bark: { kind: 'smooth', colour: '#7d7c74', lichen: '#8c9178' },
    fallen: .12,
    palette: [['#65703d', 1.2], ['#8a8a42', 1.3], ['#ad9c44', 1.4], ['#b3843e', .9], ['#8f6538', .6]],
    exposureTurn: .55,
  },
  alder: {
    trunkShare: .82, leaders: [1, 1], leaderAngle: .1, crownBase: .22, spread: .52, widest: .35, blunt: .6,
    scaffoldPerM: 1.8, scaffoldAngle: [1.1, .6], curve: .1, tropism: .02,
    branchPerM: 2.0, branchAngle: .6, branchReach: .5, branchTropism: .0,
    twigPerM: 3.0, twigLength: .32, twigTropism: .04,
    leafGather: .35,
    leaf: { outline: 'round', length: .075, width: .85, droop: .3 },
    girth: .022, bark: { kind: 'furrowed', colour: '#56514a', lichen: '#7c8068' },
    fallen: .05,
    palette: [['#3b4a2e', 1.6], ['#45552f', 1.8], ['#556233', 1.0], ['#7c7a3d', .35], ['#6b5a37', .15]],
    exposureTurn: .3,
  },
  willow: {
    trunkShare: .26, leaders: [5, 8], leaderAngle: .38, crownBase: .28, spread: .9, widest: .6, blunt: .8,
    scaffoldPerM: .0, scaffoldAngle: [.5, .3], curve: .06, tropism: .10,
    branchPerM: 1.6, branchAngle: .45, branchReach: .45, branchTropism: .04,
    twigPerM: 3.0, twigLength: .4, twigTropism: .06,
    leafGather: .2,
    leaf: { outline: 'lanceolate', length: .09, width: .2, droop: .5 },
    girth: .05, bark: { kind: 'furrowed', colour: '#77736a', lichen: '#8a8f78' },
    fallen: .1,
    palette: [['#6f7a5c', 1.6], ['#7f8a6a', 1.3], ['#8f9a78', 1.0], ['#a39d56', .6], ['#8b7c48', .25]],
    exposureTurn: .4,
  },
  poplar: {
    trunkShare: .42, leaders: [2, 4], leaderAngle: .42, crownBase: .22, spread: .74, widest: .55, blunt: .9,
    scaffoldPerM: 1.0, scaffoldAngle: [.85, .38], curve: .1, tropism: .06,
    branchPerM: 1.4, branchAngle: .58, branchReach: .5, branchTropism: -.02,
    twigPerM: 2.6, twigLength: .45, twigTropism: .04,
    leafGather: .35,
    leaf: { outline: 'deltoid', length: .085, width: .85, droop: .45 },
    girth: .026, bark: { kind: 'furrowed', colour: '#6a665f', lichen: '#7e836c' },
    fallen: .2,
    palette: [['#7d8340', .7], ['#a9a043', 1.3], ['#c2a63e', 2.0], ['#c9ab47', 1.4], ['#9c7a3a', .5]],
    exposureTurn: .5,
  },
  pear: {
    trunkShare: .42, leaders: [2, 3], leaderAngle: .30, crownBase: .30, spread: .6, widest: .42, blunt: .7,
    scaffoldPerM: 1.8, scaffoldAngle: [.8, .4], curve: .14, tropism: .1,
    branchPerM: 2.2, branchAngle: .6, branchReach: .48, branchTropism: .02,
    twigPerM: 3.2, twigLength: .3, twigTropism: .05,
    leafGather: .5,
    leaf: { outline: 'ovate', length: .065, width: .62, droop: .35 },
    girth: .026, bark: { kind: 'plated', colour: '#5f574e', lichen: '#7f836c' },
    fallen: .18,
    palette: [['#5c6a36', .9], ['#8b8a3e', 1.1], ['#b79a3c', 1.2], ['#b8743a', 1.0], ['#8e4034', .8], ['#6a3a33', .3]],
    exposureTurn: .55,
  },
}

/** One planted tree, in the wing's metres (east, north), with its own seed. */
export interface TreeSpec {
  id: string
  species: Species
  east: number
  north: number
  height: number
  seed: number
  detail: TreeDetail
  /** the crown leans this far (metres at the top) toward (east, north) */
  lean?: readonly [number, number]
  /** the crown's width as a share of the species' own */
  spread?: number
  /** a pollard carries a short knuckled trunk and a head of rods */
  pollard?: boolean
}

/** A point is refused to growth where a wall or a certified walk stands. */
export type Refuse = (x: number, y: number, z: number) => boolean

/* ─── the numbers ──────────────────────────────────────────────────────── */

export function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A growable typed buffer: geometry is written once, never through arrays of
    boxed numbers, so a wood of a hundred thousand leaves builds in a frame's
    time and not a second's. */
export class Floats {
  data: Float32Array
  length = 0
  constructor(capacity = 1024) { this.data = new Float32Array(capacity) }
  reserve(extra: number): void {
    if (this.length + extra <= this.data.length) return
    let size = this.data.length * 2
    while (size < this.length + extra) size *= 2
    const next = new Float32Array(size); next.set(this.data.subarray(0, this.length)); this.data = next
  }
  push3(a: number, b: number, c: number): void {
    this.reserve(3); const d = this.data, i = this.length
    d[i] = a; d[i + 1] = b; d[i + 2] = c; this.length = i + 3
  }
  push2(a: number, b: number): void {
    this.reserve(2); const d = this.data, i = this.length
    d[i] = a; d[i + 1] = b; this.length = i + 2
  }
  push1(a: number): void { this.reserve(1); this.data[this.length++] = a }
  view(): Float32Array { return this.data.slice(0, this.length) }
}
export class Bytes {
  data: Uint8Array
  length = 0
  constructor(capacity = 1024) { this.data = new Uint8Array(capacity) }
  push4(a: number, b: number, c: number, d: number): void {
    if (this.length + 4 > this.data.length) { const next = new Uint8Array(this.data.length * 2); next.set(this.data); this.data = next }
    const x = this.data, i = this.length
    x[i] = a; x[i + 1] = b; x[i + 2] = c; x[i + 3] = d; this.length = i + 4
  }
  view(): Uint8Array { return this.data.slice(0, this.length) }
}
export class Indices {
  data: Uint32Array
  length = 0
  constructor(capacity = 1024) { this.data = new Uint32Array(capacity) }
  push3(a: number, b: number, c: number): void {
    if (this.length + 3 > this.data.length) { const next = new Uint32Array(this.data.length * 2); next.set(this.data); this.data = next }
    const d = this.data, i = this.length
    d[i] = a; d[i + 1] = b; d[i + 2] = c; this.length = i + 3
  }
  view(): Uint32Array { return this.data.slice(0, this.length) }
}

/** One body of geometry: bark or leaves or litter of one cluster. */
export class Body {
  position = new Floats(1 << 14)
  normal = new Floats(1 << 14)
  /** linear colour in four bytes: a leaf is one colour, a gradient never */
  colour = new Bytes(1 << 14)
  uv = new Floats(1 << 13)
  /** branch phase, leaf phase, flutter, flex: the wind's data, 0..255 */
  wind = new Bytes(1 << 12)
  /** how much of the sky a point of the crown still sees, 0..1 */
  ao = new Floats(1 << 12)
  index = new Indices(1 << 14)
  get vertices(): number { return this.position.length / 3 }
  get triangles(): number { return this.index.length / 3 }
}

const clamp01 = (v: number): number => v < 0 ? 0 : v > 1 ? 1 : v
const byte = (v: number): number => Math.round(clamp01(v) * 255)

function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number): number => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4 }
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)]
}

/* ─── the crown ────────────────────────────────────────────────────────── */

/** The crown a species makes, as a body a branch can test itself against:
    its height band, its widest place, a blunt or pointed top, and two slow
    lobes and a lean so no two crowns are one ellipsoid. */
class Crown {
  constructor(
    readonly cx: number, readonly cz: number, readonly y0: number, readonly y1: number,
    readonly radius: number, readonly widest: number, readonly blunt: number,
    readonly leanX: number, readonly leanZ: number,
    private readonly lobes: readonly number[],
  ) {}
  /** where along the crown's height a point stands, 0 at its base */
  heightShare(y: number): number { return (y - this.y0) / (this.y1 - this.y0) }
  /** the crown's own axis at that height, leant as the tree leans */
  axis(y: number): [number, number] {
    const h = clamp01(this.heightShare(y))
    return [this.cx + this.leanX * h, this.cz + this.leanZ * h]
  }
  /** the crown's radius at a height share and a bearing */
  radiusAt(h: number, angle: number): number {
    if (h <= 0 || h >= 1) return 0
    const w = this.widest
    const up = h < w ? Math.sin(Math.PI / 2 * h / w) : Math.cos(Math.PI / 2 * (h - w) / (1 - w))
    const profile = Math.pow(Math.max(0, up), h < w ? .55 : 1 / (1 + this.blunt))
    const l = this.lobes
    const lobed = 1 + l[0]! * Math.cos(angle - l[1]!) + l[2]! * Math.cos(2 * angle - l[3]!) + l[4]! * Math.cos(3 * angle - l[5]! + h * 2.1)
    return this.radius * profile * lobed
  }
  /** 0 on the axis, 1 on the crown's skin, above 1 outside it */
  depth(x: number, y: number, z: number): number {
    const h = this.heightShare(y)
    if (h <= 0 || h >= 1) return 2
    const [ax, az] = this.axis(y)
    const dx = x - ax, dz = z - az
    const r = this.radiusAt(h, Math.atan2(dz, dx))
    if (r <= 1e-6) return 2
    return Math.hypot(dx, dz) / r
  }
  /** the direction out of the crown at a point, horizontal and up */
  outward(x: number, y: number, z: number): [number, number, number] {
    const [ax, az] = this.axis(y)
    let dx = x - ax, dz = z - az
    const h = clamp01(this.heightShare(y))
    const d = Math.hypot(dx, dz) || 1
    dx /= d; dz /= d
    const lift = .25 + .9 * h * h
    const n = Math.hypot(dx, lift, dz)
    return [dx / n, lift / n, dz / n]
  }
}

/* ─── the skeleton ─────────────────────────────────────────────────────── */

interface Stem {
  level: number
  x: number[]; y: number[]; z: number[]; r: number[]; s: number[]
  /** the scaffold this stem belongs to, for the wind and the colour */
  scaffold: number
  /** the wind's flex at the stem's base, and what a metre of it adds */
  flex0: number
  flexPerM: number
}

interface Grown {
  stems: Stem[]
  crown: Crown
  baseY: number
}

type V3 = [number, number, number]
const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
/** rotate v about the unit axis k by angle a (Rodrigues) */
function rotate(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a), d = (k[0] * v[0] + k[1] * v[1] + k[2] * v[2]) * (1 - c)
  const kv = cross(k, v)
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d]
}
/** any unit vector at right angles to d */
function perpendicular(d: V3): V3 {
  const a: V3 = Math.abs(d[1]) < .9 ? [0, 1, 0] : [1, 0, 0]
  return norm(cross(d, a))
}

interface GrowOptions {
  start: V3; dir: V3; length: number; r0: number; r1: number; seg: number
  curve: number; tropism: number; outward: number
  stopAtCrown: boolean; level: number; scaffold: number; flex0: number; flexPerM: number
}

/** One stem, grown a segment at a time: it bends on its own slow axis, is
    pulled up or down, leans out of the crown, and stops at the crown's skin.
    A segment that would stand in a refused place ends the stem there. */
function growStem(o: GrowOptions, crown: Crown, random: () => number, refuse: Refuse): Stem | null {
  const stem: Stem = { level: o.level, x: [o.start[0]], y: [o.start[1]], z: [o.start[2]], r: [o.r0], s: [0], scaffold: o.scaffold, flex0: o.flex0, flexPerM: o.flexPerM }
  let d = norm(o.dir)
  let bendAxis = rotate(perpendicular(d), d, random() * Math.PI * 2)
  const n = Math.max(2, Math.ceil(o.length / o.seg))
  const step = o.length / n
  let x = o.start[0], y = o.start[1], z = o.start[2], travelled = 0
  for (let i = 1; i <= n; i++) {
    // a slow bend that wanders, so a limb is a curve and not a polyline
    bendAxis = norm(rotate(bendAxis, d, (random() - .5) * .9))
    d = rotate(d, bendAxis, o.curve * step * (.4 + random() * 1.2))
    d = norm([d[0], d[1] + o.tropism * step, d[2]])
    if (o.outward) {
      const out = crown.outward(x, y, z)
      d = norm([d[0] + out[0] * o.outward * step, d[1] + out[1] * o.outward * step * .5, d[2] + out[2] * o.outward * step])
    }
    const nx = x + d[0] * step, ny = y + d[1] * step, nz = z + d[2] * step
    if (refuse(nx, ny, nz)) break
    if (o.stopAtCrown && i > 1 && crown.depth(nx, ny, nz) > 1.02) break
    x = nx; y = ny; z = nz; travelled += step
    stem.x.push(x); stem.y.push(y); stem.z.push(z); stem.s.push(travelled); stem.r.push(0)
  }
  if (stem.x.length < 2) return null
  // the stem tapers over the length it actually grew
  const last = stem.x.length - 1
  for (let i = 1; i <= last; i++) stem.r[i] = o.r0 + (o.r1 - o.r0) * Math.pow(i / last, .85)
  return stem
}

/** where along a stem a share of its length falls, and its direction there */
function along(stem: Stem, share: number): { p: V3; d: V3; r: number } {
  const total = stem.s[stem.s.length - 1]!
  const want = total * Math.min(1, Math.max(0, share))
  let i = 1
  while (i < stem.s.length - 1 && stem.s[i]! < want) i++
  const s0 = stem.s[i - 1]!, s1 = stem.s[i]!
  const t = s1 > s0 ? (want - s0) / (s1 - s0) : 0
  const p: V3 = [stem.x[i - 1]! + (stem.x[i]! - stem.x[i - 1]!) * t, stem.y[i - 1]! + (stem.y[i]! - stem.y[i - 1]!) * t, stem.z[i - 1]! + (stem.z[i]! - stem.z[i - 1]!) * t]
  const d = norm([stem.x[i]! - stem.x[i - 1]!, stem.y[i]! - stem.y[i - 1]!, stem.z[i]! - stem.z[i - 1]!])
  const r = stem.r[i - 1]! + (stem.r[i]! - stem.r[i - 1]!) * t
  return { p, d, r }
}

/** How much of the tree a tier grows: the near trees whole at hero, every
    tier and distance a lighter hand on the same skeleton. */
interface Hand {
  /** share of second-order branches and of twigs drawn as wood */
  branches: number
  twigs: number
  /** leaves kept against the crown's own count; each kept leaf is drawn
      larger by the inverse square root so the crown keeps its cover */
  leaves: number
  /** ring sides by level: trunk, scaffold, branch, twig (0 omits) */
  sides: readonly [number, number, number, number]
  /** every how many rings of a limb are drawn */
  stride: number
}
export function handFor(detail: TreeDetail, tier: TreeTier): Hand {
  const table: Record<TreeTier, Record<TreeDetail, Hand>> = {
    hero: {
      near: { branches: 1, twigs: 1, leaves: 1, sides: [12, 7, 4, 3], stride: 1 },
      mid: { branches: 1, twigs: .8, leaves: 1, sides: [8, 5, 3, 0], stride: 2 },
      far: { branches: .7, twigs: 0, leaves: 1, sides: [6, 3, 0, 0], stride: 3 },
    },
    standard: {
      near: { branches: .7, twigs: 0, leaves: .5, sides: [8, 5, 3, 0], stride: 2 },
      mid: { branches: .6, twigs: 0, leaves: .5, sides: [6, 4, 0, 0], stride: 3 },
      far: { branches: .5, twigs: 0, leaves: .45, sides: [5, 0, 0, 0], stride: 4 },
    },
    calm: {
      near: { branches: .5, twigs: 0, leaves: .22, sides: [5, 3, 0, 0], stride: 3 },
      mid: { branches: .4, twigs: 0, leaves: .2, sides: [4, 3, 0, 0], stride: 4 },
      far: { branches: .3, twigs: 0, leaves: .18, sides: [4, 0, 0, 0], stride: 4 },
    },
  }
  return table[tier][detail]
}

/** The leaves a crown carries at hero, capped by how near it is drawn, and
    the share of a real leaf's size each one is drawn at. */
const LEAF_CAP: Record<TreeDetail, number> = { near: 70000, mid: 8000, far: 3500 }
const LEAF_SCALE: Record<TreeDetail, number> = { near: 1.45, mid: 1.3, far: 1.9 }
/** how far a leaf or a spray may grow past its drawn size when a crown's cap
    binds, so a big crown keeps its cover instead of thinning */
const LEAF_GROW: Record<TreeDetail, number> = { near: 1.35, mid: 2, far: 2.2 }
/** the share of a spray card its leaves cover */
const SPRAY_COVER = .38
/** leaves on a crown against its skin's area: a shell a little more than
    covered before the week has taken its share */
const COVER = 1.25

/** The skeleton of one tree. The same seed grows the same limbs at every
    tier: a lighter tier keeps fewer of them, it never grows others. */
function skeleton(spec: TreeSpec, habit: Habit, groundY: number, refuse: Refuse): Grown {
  const random = mulberry(spec.seed)
  const H = spec.height
  const x0 = spec.east, z0 = -spec.north
  const lean = spec.lean ?? [0, 0]
  const spread = (spec.spread ?? 1) * habit.spread
  const lobes = [.05 + random() * .1, random() * 6.283, .04 + random() * .08, random() * 6.283, .02 + random() * .05, random() * 6.283]
  const crown = new Crown(x0 + lean[0] * habit.crownBase, z0 - lean[1] * habit.crownBase,
    groundY + H * habit.crownBase, groundY + H, H * spread / 2, habit.widest, habit.blunt,
    lean[0] * (1 - habit.crownBase), -lean[1] * (1 - habit.crownBase), lobes)
  const stems: Stem[] = []
  const trunkR = H * habit.girth
  const seg = Math.max(.25, H / 40)
  const excurrent = habit.trunkShare > .7
  // THE TRUNK: straight enough to stand, bent enough to have grown
  const trunkDir = norm([lean[0] / H * .6 + (random() - .5) * .06, 1, -lean[1] / H * .6 + (random() - .5) * .06])
  const trunkTopR = trunkR * (excurrent ? .14 : .78)
  const trunk = growStem({ start: [x0, groundY - .05, z0], dir: trunkDir, length: H * habit.trunkShare, r0: trunkR,
    r1: trunkTopR, seg, curve: .035, tropism: 0, outward: 0, stopAtCrown: false,
    level: 0, scaffold: -1, flex0: 0, flexPerM: .1 / Math.max(1, H * habit.trunkShare) }, crown, random, () => false)!
  stems.push(trunk)
  const bearers: Stem[] = [trunk]
  const top = along(trunk, 1)
  if (!excurrent) {
    // THE FORK: leaders out of the trunk's head, sharing its girth
    const count = habit.leaders[0] + Math.floor(random() * (habit.leaders[1] - habit.leaders[0] + 1))
    const turn = random() * Math.PI * 2
    const share = count <= 2 ? .8 : count === 3 ? .7 : count === 4 ? .62 : .5
    for (let k = 0; k < count; k++) {
      const az = turn + k * Math.PI * 2 / count + (random() - .5) * .6
      const tilt = habit.leaderAngle * (.75 + random() * .5)
      const dir = norm([Math.sin(tilt) * Math.cos(az) + top.d[0] * .3, Math.cos(tilt), Math.sin(tilt) * Math.sin(az) + top.d[2] * .3])
      const length = (groundY + H - top.p[1]) * (spec.pollard ? .9 : 1.05) / Math.max(.4, dir[1])
      // each leader starts inside the trunk's head, so the fork is one body
      const start: V3 = [top.p[0] - top.d[0] * top.r * .8, top.p[1] - top.d[1] * top.r * .8, top.p[2] - top.d[2] * top.r * .8]
      const leader = growStem({ start, dir, length, r0: top.r * share, r1: .02,
        seg, curve: habit.curve * .7, tropism: habit.tropism * .5, outward: .08, stopAtCrown: true,
        level: 0, scaffold: -1, flex0: .1, flexPerM: .25 / Math.max(1, length) }, crown, random, refuse)
      if (leader) { stems.push(leader); bearers.push(leader) }
    }
  } else {
    const leader = growStem({ start: top.p, dir: top.d, length: (groundY + H - top.p[1]) * 1.02, r0: top.r, r1: .015,
      seg, curve: habit.curve * .5, tropism: .02, outward: 0, stopAtCrown: true,
      level: 0, scaffold: -1, flex0: .1, flexPerM: .25 / H }, crown, random, refuse)
    if (leader) { stems.push(leader); bearers.push(leader) }
  }
  // THE SCAFFOLD: limbs out of the trunk and the leaders inside the crown.
  // A limb does not run to the crown's skin as one spoke: it grows part of
  // its reach and forks, and its forks fork, each thinner by the pipe rule,
  // so the crown's outer shell is a mesh of wood and not a ring of ends.
  let scaffoldId = 0
  const golden = 2.39996
  let spin = random() * Math.PI * 2
  const forkDepth = H > 9 ? 2 : 1
  const limb = (start: V3, dir: V3, reach: number, r0: number, id: number, flex0: number, depth: number): void => {
    const firstShare = depth > 0 ? .4 + random() * .22 : 1
    const piece = growStem({ start, dir, length: reach * firstShare, r0, r1: depth > 0 ? r0 * .8 : .012, seg: seg * .8,
      curve: habit.curve, tropism: habit.tropism, outward: .22, stopAtCrown: true,
      level: 1, scaffold: id, flex0, flexPerM: .3 / Math.max(1.5, reach) }, crown, random, refuse)
    if (!piece) return
    stems.push(piece)
    const grew = piece.s[piece.s.length - 1]!
    if (depth <= 0 || grew < reach * firstShare * .9) return
    const end = along(piece, 1)
    const forks = random() < .28 ? 3 : 2
    const turn = random() * Math.PI * 2
    for (let f = 0; f < forks; f++) {
      const axis = rotate(perpendicular(end.d), end.d, turn + f * Math.PI * 2 / forks)
      const d = norm(rotate(end.d, norm(cross(end.d, axis)), .3 + random() * .4))
      limb(end.p, d, (reach - grew) * (.95 + random() * .3), end.r * (forks === 2 ? .8 : .7), id,
        flex0 + piece.flexPerM * grew, depth - 1)
    }
  }
  for (const bearer of bearers) {
    const length = bearer.s[bearer.s.length - 1]!
    const count = spec.pollard ? 0 : Math.round(length * habit.scaffoldPerM * (bearer === trunk && !excurrent ? .5 : 1))
    for (let k = 0; k < count; k++) {
      const share = (k + .3 + random() * .5) / count
      const at = along(bearer, share)
      const h = clamp01(crown.heightShare(at.p[1]))
      if (at.p[1] < crown.y0 - H * .06) continue
      spin += golden + (random() - .5) * .5
      const angle = habit.scaffoldAngle[0] + (habit.scaffoldAngle[1] - habit.scaffoldAngle[0]) * h
      const azimuthal = rotate(perpendicular(at.d), at.d, spin)
      const dir = norm(rotate(at.d, norm(cross(at.d, azimuthal)), angle * (.85 + random() * .3)))
      const reach = crown.radius * (1.25 - .35 * h) * (.75 + random() * .45)
      const r0 = Math.min(at.r * .72, trunkR * (.3 + .2 * (1 - h)))
      limb(at.p, dir, reach, r0, scaffoldId++, .12 + .15 * h, forkDepth)
    }
  }
  // THE BRANCHES: second-order limbs along every scaffold and leader
  const firsts = stems.filter(stem => stem.level === 1 || (stem.level === 0 && stem !== trunk))
  for (const parent of firsts) {
    const length = parent.s[parent.s.length - 1]!
    const count = Math.max(1, Math.round(length * habit.branchPerM))
    let side = random() < .5 ? 1 : -1
    for (let k = 0; k < count; k++) {
      const share = .15 + .83 * (k + random() * .7) / count
      const at = along(parent, share)
      side = -side
      const flat = norm(cross(at.d, [0, 1, 0]))
      const plane = rotate(flat, at.d, side * (.35 + random() * .5))
      const dir = norm(rotate(at.d, norm(cross(at.d, plane)), side * habit.branchAngle * (.7 + random() * .6)))
      const remaining = Math.max(.6, (1 - share) * length)
      const reach = Math.min(remaining * habit.branchReach * 1.6, crown.radius * .9) * (.6 + random() * .6)
      const branch = growStem({ start: at.p, dir, length: reach, r0: Math.min(at.r * .6, .06), r1: .006, seg: seg * .6,
        curve: habit.curve * 1.3, tropism: habit.branchTropism, outward: .35, stopAtCrown: true,
        level: 2, scaffold: parent.scaffold < 0 ? Math.floor(random() * 997) : parent.scaffold,
        flex0: parent.flex0 + parent.flexPerM * share * length, flexPerM: .32 / Math.max(.8, reach) }, crown, random, refuse)
      if (branch) stems.push(branch)
    }
  }
  // THE TWIGS the leaves stand on, along the branches and the short limbs
  const seconds = stems.filter(stem => stem.level === 2 || (stem.level === 1 && stem.s[stem.s.length - 1]! < 1.5))
  for (const parent of seconds) {
    const length = parent.s[parent.s.length - 1]!
    const count = Math.max(1, Math.round(length * habit.twigPerM))
    for (let k = 0; k < count; k++) {
      const share = .25 + .75 * (k + random()) / count
      const at = along(parent, share)
      const plane = rotate(perpendicular(at.d), at.d, random() * Math.PI * 2)
      const dir = norm(rotate(at.d, norm(cross(at.d, plane)), .5 + random() * .6))
      const twig = growStem({ start: at.p, dir, length: habit.twigLength * (.6 + random() * .8), r0: Math.min(at.r * .6, .012), r1: .003,
        seg: habit.twigLength / 3, curve: habit.curve * 2, tropism: habit.twigTropism, outward: .5, stopAtCrown: false,
        level: 3, scaffold: parent.scaffold, flex0: parent.flex0 + parent.flexPerM * share * length, flexPerM: .5 / habit.twigLength }, crown, random, refuse)
      if (twig) stems.push(twig)
    }
  }
  return { stems, crown, baseY: groundY }
}

/* ─── the bark ─────────────────────────────────────────────────────────── */

/** A tube along a stem with rings that share their seam, the bark laid in
    metres (u around, v along) so a bark map keeps its scale on every limb.
    The trunk's foot flares into its roots and every toe is sunk into the
    sampled ground. */
function tube(body: Body, stem: Stem, sides: number, stride: number, colour: V3, lichen: V3, crown: Crown, spec: TreeSpec,
  heightAt: (east: number, north: number) => number, random: () => number): void {
  if (sides < 3) return
  const rings: number[] = []
  for (let i = 0; i < stem.x.length; i += stride) rings.push(i)
  if (rings[rings.length - 1] !== stem.x.length - 1) rings.push(stem.x.length - 1)
  const base = body.vertices
  // parallel transport: the ring's reference turns with the stem, never spins
  let d0 = norm([stem.x[1]! - stem.x[0]!, stem.y[1]! - stem.y[0]!, stem.z[1]! - stem.z[0]!])
  let ref = perpendicular(d0)
  const aroundTiles = Math.max(1, Math.round(2 * Math.PI * stem.r[0]! / .42))
  const flare = stem.level === 0 && stem.y[0]! < crown.y0 && stem.r[0]! > .08
  const roots = flare ? [random() * 6.283, random() * 6.283, random() * 6.283, random() * 6.283, random() * 6.283] : []
  const phase = ((stem.scaffold * 0.618034 + spec.seed * 1e-4) % 1 + 1) % 1
  const cosA: number[] = [], sinA: number[] = [], lobes: number[] = []
  for (let j = 0; j <= sides; j++) {
    const a = j / sides * Math.PI * 2
    cosA.push(Math.cos(a)); sinA.push(Math.sin(a))
    let lobe = 0
    for (const root of roots) lobe = Math.max(lobe, Math.pow(Math.max(0, Math.cos(a - root)), 6))
    lobes.push(lobe)
  }
  for (let r = 0; r < rings.length; r++) {
    const i = rings[r]!
    const next = Math.min(stem.x.length - 1, i + 1), prev = Math.max(0, i - 1)
    const d = norm(i < stem.x.length - 1
      ? [stem.x[next]! - stem.x[i]!, stem.y[next]! - stem.y[i]!, stem.z[next]! - stem.z[i]!]
      : [stem.x[i]! - stem.x[prev]!, stem.y[i]! - stem.y[prev]!, stem.z[i]! - stem.z[prev]!])
    // carry the reference over the bend from the last ring to this one
    const k = cross(d0, d), kl = Math.hypot(k[0], k[1], k[2])
    if (kl > 1e-6) ref = rotate(ref, [k[0] / kl, k[1] / kl, k[2] / kl], Math.asin(Math.min(1, kl)))
    ref = norm(ref); d0 = d
    const other = cross(d, ref)
    const h = stem.y[i]! - stem.y[0]!
    // the foot of a trunk swells into its roots over its lowest metre
    const swell = flare ? 1 + .7 * Math.exp(-h / (stem.r[0]! * 1.4)) : 1
    const rootReach = flare ? .5 * Math.exp(-h / (stem.r[0]! * 1.1)) : 0
    const depth = crown.depth(stem.x[i]!, stem.y[i]!, stem.z[i]!)
    // the trunk's foot sees less sky than its top; inside a crown, less still
    const ao = Math.min(1, stem.level === 0 ? .55 + .45 * clamp01(h / (crown.y0 - stem.y[0]! + 1)) : .45 + .5 * clamp01(depth))
    const flex = byte(stem.flex0 + stem.flexPerM * stem.s[i]!)
    for (let j = 0; j <= sides; j++) {
      const ca = cosA[j]!, sa = sinA[j]!
      let rr = stem.r[i]! * swell * (1 + lobes[j]! * rootReach)
      // fluting and furrows on a big trunk, a round limb elsewhere
      if (stem.level === 0) rr *= 1 + .035 * Math.sin(j / sides * 43.98 + i * .7) + .02 * Math.sin(j / sides * 81.68 + i * 1.3)
      const nx = ref[0] * ca + other[0] * sa, ny = ref[1] * ca + other[1] * sa, nz = ref[2] * ca + other[2] * sa
      const px = stem.x[i]! + nx * rr, pz = stem.z[i]! + nz * rr
      let py = stem.y[i]! + ny * rr
      if (flare && i === 0) py = heightAt(px, -pz) - .04
      body.position.push3(px, py, pz)
      body.normal.push3(nx, ny, nz)
      // lichen takes the north and the shaded foot; the grain is the map's
      const north = Math.max(0, -nz) * .45 + (h < 1.2 ? .25 * (1 - h / 1.2) : 0)
      const tone = .9 + .1 * Math.sin(j * 2.1 + i * .37 + stem.scaffold)
      body.colour.push4(byte((colour[0] + (lichen[0] - colour[0]) * north) * tone), byte((colour[1] + (lichen[1] - colour[1]) * north) * tone), byte((colour[2] + (lichen[2] - colour[2]) * north) * tone), 255)
      body.uv.push2(j / sides * aroundTiles, stem.s[i]! / .7)
      body.ao.push1(ao)
      body.wind.push4(byte(phase), 0, 0, flex)
    }
    if (r > 0) {
      const row = base + r * (sides + 1), prevRow = row - (sides + 1)
      for (let j = 0; j < sides; j++) {
        // wound so the face looks out of the limb
        body.index.push3(prevRow + j, prevRow + j + 1, row + j)
        body.index.push3(prevRow + j + 1, row + j + 1, row + j)
      }
    }
  }
}

/* ─── the leaves ───────────────────────────────────────────────────────── */

interface LeafData {
  colour: V3
  ao: number
  phase: number
  leafPhase: number
  flex: number
}

/** One leaf as a card of its species' outline: the stalk's foot at `at`,
    the blade out along `dir`, its face `face`. The card's normals lean with
    the blade's cup and droop, and the card's own shadow is one triangle in
    `shadow`, opaque, inside its outline. */
function card(body: Body, shadow: Body | null, at: V3, dir: V3, face: V3, length: number, species: Species, data: LeafData, spray = false): void {
  const across = norm(cross(face, dir))
  const recipe = LEAF_RECIPES[species]
  // a single leaf's card is cut to its blade's width; a spray's is square
  const hw = spray ? .5 : Math.min(.5, .5 * recipe.width * 1.08 + .02)
  const { u0, v0, du, dv } = cellUV(spray ? sprayCell(species) : leafCell(species))
  const first = body.vertices
  const corner = (u: number, v: number, lean: number, droop: number, flutter: number): void => {
    body.position.push3(at[0] + dir[0] * u * length + across[0] * v * length, at[1] + dir[1] * u * length + across[1] * v * length, at[2] + dir[2] * u * length + across[2] * v * length)
    const nx = face[0] + across[0] * lean - dir[0] * droop, ny = face[1] + across[1] * lean - dir[1] * droop, nz = face[2] + across[2] * lean - dir[2] * droop
    const l = Math.hypot(nx, ny, nz) || 1
    body.normal.push3(nx / l, ny / l, nz / l)
    body.colour.push4(byte(data.colour[0]), byte(data.colour[1]), byte(data.colour[2]), 255)
    body.uv.push2(u0 + (.5 + v) * du, v0 + u * dv)
    body.ao.push1(data.ao)
    body.wind.push4(byte(data.phase), byte(data.leafPhase), byte(flutter), byte(data.flex))
  }
  corner(0, -hw, -.35, -.15, .1)
  corner(0, hw, .35, -.15, .1)
  corner(1, hw, .35, .45, 1)
  corner(1, -hw, -.35, .45, 1)
  body.index.push3(first, first + 2, first + 1)
  body.index.push3(first, first + 3, first + 2)
  if (shadow) {
    const s0 = shadow.vertices
    const w = spray ? .6 : recipe.width * .55
    for (const [u, v] of [[.06, 0], [spray ? .82 : .92, w * .5], [spray ? .82 : .92, -w * .5]] as const) {
      shadow.position.push3(at[0] + dir[0] * u * length + across[0] * v * length, at[1] + dir[1] * u * length + across[1] * v * length, at[2] + dir[2] * u * length + across[2] * v * length)
      shadow.normal.push3(face[0], face[1], face[2])
      shadow.wind.push4(byte(data.phase), byte(data.leafPhase), byte(u), byte(data.flex))
    }
    shadow.index.push3(s0, s0 + 2, s0 + 1)
  }
}

/** a leaf's colour out of the tree's palette by how far it has turned */
function paletteColour(palette: readonly V3[], weights: readonly number[], turn: number, random: () => number): V3 {
  const total = weights.reduce((a, b) => a + b, 0)
  let target = clamp01(turn + (random() - .5) * .3) * total
  let i = 0
  while (i < weights.length - 1 && target > weights[i]!) { target -= weights[i]!; i++ }
  const next = Math.min(palette.length - 1, i + 1)
  const t = clamp01(target / weights[i]!) * .5
  const a = palette[i]!, b = palette[next]!
  // the map's blade is a little under white: the colour carries it back
  const lift = (.92 + random() * .2) / .84
  return [(a[0] + (b[0] - a[0]) * t) * lift, (a[1] + (b[1] - a[1]) * t) * lift, (a[2] + (b[2] - a[2]) * t) * lift]
}

/** the area of an ellipsoid's skin, Thomsen's form */
function skinArea(a: number, b: number, c: number): number {
  const p = 1.6
  return 4 * Math.PI * Math.pow((Math.pow(a * b, p) + Math.pow(a * c, p) + Math.pow(b * c, p)) / 3, 1 / p)
}

export interface TreeResult {
  spec: TreeSpec
  leaves: number
  leafTriangles: number
  barkTriangles: number
  crown: { cx: number; cz: number; radius: number; y0: number; y1: number }
  fallen: number
}

/** Grow one tree into the bark, leaf and leaf-shadow bodies of its cluster. */
export function growTree(spec: TreeSpec, tier: TreeTier, heightAt: (east: number, north: number) => number,
  refuse: Refuse, bark: Body, leaves: Body, shadows: Body | null): TreeResult {
  const habit = HABITS[spec.species]
  const hand = handFor(spec.detail, tier)
  const groundY = heightAt(spec.east, spec.north)
  const grown = skeleton(spec, habit, groundY, refuse)
  const random = mulberry(spec.seed ^ 0x5bd1e995)
  const pick = mulberry(spec.seed ^ 0x27d4eb2f)
  const barkColour = hexToLinear(habit.bark.colour), lichen = hexToLinear(habit.bark.lichen)
  const palette = habit.palette.map(([hex]) => hexToLinear(hex))
  const weights = habit.palette.map(([, w]) => w)
  const barkBefore = bark.triangles, leafBefore = leaves.triangles
  // the wood: every tier walks the same stems and keeps its own share
  const bearing: { stem: Stem; from: number }[] = []
  for (const stem of grown.stems) {
    const keep = pick()
    if (stem.level === 3 || stem.level === 2) bearing.push({ stem, from: stem.level === 3 ? 0 : .55 })
    if (stem.level === 2 && keep > hand.branches) continue
    if (stem.level === 3 && keep > hand.twigs) continue
    const sides = hand.sides[Math.min(3, stem.level)]!
    if (sides) tube(bark, stem, sides, stem.level === 0 ? 1 : hand.stride, barkColour, lichen, grown.crown, spec, heightAt, random)
  }
  // THE LEAVES: a crown's count from its own skin, dealt to the twigs by how
  // much of the crown's outer shell each one stands in
  const c = grown.crown
  // a crown seen from further off, or at a lighter tier, carries sprays: one
  // card holds a shoot and its leaves, so the crown keeps its mass
  const spraying = spec.detail !== 'near' || tier !== 'hero'
  const real = habit.leaf.length * LEAF_SCALE[spec.detail]
  const drawn = spraying ? real / SPRAY_LEAF : real
  const share = spraying ? SPRAY_COVER : Math.PI / 4 * habit.leaf.width
  const skin = skinArea(c.radius, c.radius, (c.y1 - c.y0) / 2)
  const needed = COVER * skin * (1 - habit.fallen * .85)
  const cap = LEAF_CAP[spec.detail]
  const unit = needed / (drawn * drawn * share) > cap
    ? Math.min(drawn * LEAF_GROW[spec.detail], Math.sqrt(needed / (cap * share))) : drawn
  const count = Math.round(Math.min(cap, needed / (unit * unit * share)) * hand.leaves)
  const leafLength = unit / Math.sqrt(hand.leaves)
  interface Slot { stem: Stem; share: number; weight: number }
  const slots: Slot[] = []
  let total = 0
  for (const { stem, from } of bearing) {
    const length = stem.s[stem.s.length - 1]!
    const n = Math.max(1, Math.round(length * (1 - from) / .09))
    for (let k = 0; k < n; k++) {
      const share = from + (1 - from) * (k + .5) / n
      const at = along(stem, share)
      const depth = c.depth(at.p[0], at.p[1], at.p[2])
      // a crown keeps its leaves in its outer shell; its heart is bare wood
      const shell = depth > 1.12 ? 0 : clamp01((depth - .3) / .5) * .92 + .08
      const gather = .4 + .6 * Math.pow(share, 1 + habit.leafGather * 2)
      const weight = shell * gather
      if (weight <= 0) continue
      slots.push({ stem, share, weight }); total += weight
    }
  }
  let placed = 0
  if (slots.length && count > 0) {
    const leaflets = spraying ? 1 : habit.leaf.leaflets ?? 1
    const units = Math.max(1, Math.round(count / leaflets))
    const step = total / units
    let threshold = step * random(), acc = 0
    const turnBias = new Map<number, number>()
    for (const slot of slots) {
      acc += slot.weight
      while (acc > threshold) {
        threshold += step
        const u = random(), v = random(), w = random(), q = random(), jitter = random()
        const at = along(slot.stem, Math.min(1, slot.share + (u - .5) * .08))
        const out = c.outward(at.p[0], at.p[1], at.p[2])
        const depth = c.depth(at.p[0], at.p[1], at.p[2])
        const h = clamp01(c.heightShare(at.p[1]))
        let bias = turnBias.get(slot.stem.scaffold)
        if (bias === undefined) { bias = (pick() - .5) * .45; turnBias.set(slot.stem.scaffold, bias) }
        const exposure = clamp01(.55 * clamp01(depth) + .45 * h)
        const turn = clamp01((1 - habit.exposureTurn) * w + habit.exposureTurn * exposure * (.6 + .6 * w) + bias)
        const colour = paletteColour(palette, weights, turn, random)
        const phase = ((slot.stem.scaffold * .618034 + spec.seed * 1e-4) % 1 + 1) % 1
        const flex = clamp01(slot.stem.flex0 + slot.stem.flexPerM * slot.stem.s[slot.stem.s.length - 1]! * slot.share)
        const data: LeafData = { colour, ao: .36 + .64 * Math.pow(clamp01(depth), 1.3) * (.72 + .28 * h), phase, leafPhase: q, flex }
        // the stalk leaves the twig to one side and the blade turns its face
        // to the light out of the crown
        const around = rotate(perpendicular(at.d), at.d, q * Math.PI * 2)
        let dir = norm(rotate(at.d, norm(cross(at.d, around)), .75 + v * .55))
        dir = norm([dir[0] + out[0] * .25, dir[1] - .2 - habit.leaf.droop * .35, dir[2] + out[2] * .25])
        let face = norm([out[0] * .6 + (w - .5) * .7, 1, out[2] * .6 + (q - .5) * .7])
        face = norm(cross(cross(dir, face), dir))
        if (face[1] < -.1) face = [-face[0], -face[1], -face[2]]
        const offset = .03 + jitter * .08
        const base: V3 = [at.p[0] + around[0] * offset, at.p[1] + around[1] * offset, at.p[2] + around[2] * offset]
        if (leaflets > 1) {
          // a compound leaf: a stalk with pairs of leaflets and one at its end
          const pairs = Math.floor((leaflets - 1) / 2)
          const rachis = leafLength * (pairs + 1) * .62
          const side = norm(cross(face, dir))
          for (let p = 0; p <= pairs; p++) {
            const t = p === pairs ? 1 : .22 + .78 * p / Math.max(1, pairs)
            const size = leafLength * (p === pairs ? 1.1 : .78 + .25 * p / Math.max(1, pairs))
            const px = base[0] + dir[0] * rachis * t, py = base[1] + dir[1] * rachis * t - .06 * t * t * rachis, pz = base[2] + dir[2] * rachis * t
            if (refuse(px, py, pz)) continue
            if (p === pairs) { card(leaves, shadows, [px, py, pz], dir, face, size, spec.species, data); placed++ }
            else for (const s of [-1, 1]) {
              const lateral = norm([dir[0] * .45 + side[0] * s, dir[1] * .45 + side[1] * s - .15, dir[2] * .45 + side[2] * s])
              card(leaves, shadows, [px, py, pz], lateral, face, size, spec.species, data); placed++
            }
          }
        } else {
          const tip: V3 = [base[0] + dir[0] * leafLength, base[1] + dir[1] * leafLength, base[2] + dir[2] * leafLength]
          if (refuse(base[0], base[1], base[2]) || refuse(tip[0], tip[1], tip[2])) continue
          card(leaves, shadows, base, dir, face, leafLength * (.8 + .4 * u), spec.species, data, spraying); placed++
        }
      }
    }
  }
  return {
    spec, leaves: placed,
    leafTriangles: leaves.triangles - leafBefore, barkTriangles: bark.triangles - barkBefore,
    crown: { cx: c.cx, cz: c.cz, radius: c.radius, y0: c.y0, y1: c.y1 },
    fallen: habit.fallen,
  }
}

/* ─── the fallen leaves ────────────────────────────────────────────────── */

/** One fallen leaf lying on its ground as a card, its tip lifted a little as
    a drying leaf curls. */
export function fallenLeaf(body: Body, species: Species, east: number, north: number, groundY: number, angle: number,
  length: number, colour: V3, curl: number): void {
  const dir: V3 = [Math.cos(angle), curl, -Math.sin(angle)]
  const at: V3 = [east - Math.cos(angle) * length * .5, groundY + .012, -north + Math.sin(angle) * length * .5]
  const data: LeafData = { colour, ao: .8, phase: 0, leafPhase: 0, flex: 0 }
  card(body, null, at, norm(dir), [0, 1, 0], length, species, data)
}

export function leafLengthOf(species: Species): number { return HABITS[species].leaf.length }
export function fallenPalette(species: Species): { colours: V3[]; weights: number[] } {
  const habit = HABITS[species]
  const colours = habit.palette.map(([hex]) => hexToLinear(hex))
  // what lies on the ground is what turned: the ramp's far end, and browner
  const start = Math.max(0, colours.length - 4)
  return {
    colours: colours.slice(start).map(c => [c[0] * .92 / .84, c[1] * .84 / .84, c[2] * .78 / .84] as V3),
    weights: habit.palette.slice(start).map(([, w]) => w),
  }
}
