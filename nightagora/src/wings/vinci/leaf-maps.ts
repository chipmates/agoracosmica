/* THE LEAF AND THE BARK AS MAPS, DRAWN FROM THEIR RECIPES.

   One atlas of 8 by 4 cells: each species' single leaf (its outline, lobes,
   teeth, tip and stalk as coverage, its veins as relief) and each species'
   spray (a shoot with its leaves as they stand on it, drawn with the same
   leaf), for crowns seen from further off. The colour of a leaf is its own
   vertex colour (the week's turn); the map carries only what every leaf of
   the species shares, neutral in tone. One fissured bark, tileable.

   The recipes are the source and the maps are what an export carries: plain
   RGBA maps with their mip chains, the coverage mips holding the share of
   each cell that stood above the cut at full size, so a far crown keeps its
   cover instead of dissolving. A checker in node draws no map: it reads the
   geometry alone. */
import { ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, RGBAFormat, SRGBColorSpace } from 'three/webgpu'
import type { Species } from './tree-growth'

export const ATLAS_COLUMNS = 8
export const ATLAS_ROWS = 4
const CELL = 128

interface LeafRecipe {
  /** half-width against the share of the blade's length, before lobes */
  profile: (t: number) => number
  /** width of the blade against its length */
  width: number
  lobes?: { count: number; depth: number }
  teeth?: { count: number; depth: number }
  /** one side of the base longer than the other, as an elm's is */
  asym?: number
  /** a notch at the tip, as an alder's is */
  notch?: boolean
  palmate?: boolean
  /** the stalk as a share of the card's length */
  stalk: number
  /** pairs of side veins */
  veins: number
  /** how the species carries its leaves on a shoot: leaves per spray, the
      angle they leave it at, and whether they stand in opposite pairs */
  spray: { leaves: number; angle: number; opposite?: boolean; compound?: boolean }
}

const ovate = (t: number): number => Math.pow(Math.sin(Math.PI * Math.pow(t, .8)), .9) * .5
const elliptic = (t: number): number => Math.pow(Math.sin(Math.PI * t), .8) * .5
const obovate = (t: number): number => Math.pow(Math.sin(Math.PI * Math.pow(t, 1.35)), .8) * .5
const acuminate = (t: number): number => Math.pow(Math.sin(Math.PI * Math.pow(t, .9)), .75) * .5 * (1 - .35 * Math.pow(Math.max(0, t - .7) / .3, 1.5))

export const LEAF_RECIPES: Record<Species, LeafRecipe> = {
  walnut: { profile: acuminate, width: .44, stalk: .04, veins: 11, spray: { leaves: 7, angle: .95, opposite: true, compound: true } },
  elm: { profile: ovate, width: .58, teeth: { count: 26, depth: .045 }, asym: .12, stalk: .05, veins: 13, spray: { leaves: 9, angle: .75 } },
  oak: { profile: obovate, width: .6, lobes: { count: 4.5, depth: .4 }, stalk: .03, veins: 6, spray: { leaves: 6, angle: .6 } },
  maple: { profile: elliptic, width: 1, palmate: true, stalk: .2, veins: 5, spray: { leaves: 6, angle: .9, opposite: true } },
  cherry: { profile: acuminate, width: .46, teeth: { count: 34, depth: .03 }, stalk: .12, veins: 10, spray: { leaves: 6, angle: .55 } },
  hornbeam: { profile: ovate, width: .5, teeth: { count: 30, depth: .045 }, stalk: .05, veins: 12, spray: { leaves: 9, angle: .8 } },
  alder: { profile: obovate, width: .82, teeth: { count: 22, depth: .03 }, notch: true, stalk: .1, veins: 7, spray: { leaves: 7, angle: .8 } },
  willow: { profile: (t: number) => Math.pow(Math.sin(Math.PI * Math.pow(t, .9)), 1.1) * .5, width: .2, teeth: { count: 40, depth: .02 }, stalk: .04, veins: 14, spray: { leaves: 11, angle: .45 } },
  poplar: { profile: (t: number) => (t < .2 ? .5 * Math.sin(Math.PI / 2 * t / .2) : .5 * Math.pow((1 - t) / .8, .85)), width: .9, teeth: { count: 20, depth: .03 }, stalk: .22, veins: 6, spray: { leaves: 6, angle: .85 } },
  pear: { profile: ovate, width: .64, teeth: { count: 30, depth: .015 }, stalk: .2, veins: 8, spray: { leaves: 7, angle: .7 } },
}

const ORDER: readonly Species[] = ['walnut', 'elm', 'oak', 'maple', 'cherry', 'hornbeam', 'alder', 'willow', 'poplar', 'pear']
/** the atlas cell of a species' single leaf, and of its spray */
export const leafCell = (species: Species): number => ORDER.indexOf(species)
export const sprayCell = (species: Species): number => 16 + ORDER.indexOf(species)
/** a cell's corner and size in the atlas's own coordinates */
export function cellUV(cell: number): { u0: number; v0: number; du: number; dv: number } {
  return { u0: (cell % ATLAS_COLUMNS) / ATLAS_COLUMNS, v0: Math.floor(cell / ATLAS_COLUMNS) / ATLAS_ROWS, du: 1 / ATLAS_COLUMNS, dv: 1 / ATLAS_ROWS }
}
/** the share of a spray card a single leaf of it spans */
export const SPRAY_LEAF = .36

/** Half-width of the blade at a share t of its length, lobes and teeth in. */
function bladeWidth(r: LeafRecipe, t: number, side: number): number {
  let w = r.profile(t) * r.width
  if (r.lobes) w *= 1 - r.lobes.depth * Math.pow(Math.abs(Math.sin(Math.PI * r.lobes.count * t)), .7) * Math.min(1, t * 4)
  if (r.teeth) w *= 1 - r.teeth.depth * Math.abs(((t * r.teeth.count) % 1) - .5) * 2
  if (r.asym && t < .3) w *= 1 + side * r.asym * (1 - t / .3)
  if (r.notch && t > .9) w *= 1 - .5 * (t - .9) / .1
  return Math.max(0, w)
}

/** Coverage and relief of one leaf at a point of its card: s across in
    -0.5..0.5, t along in 0..1 from the stalk's foot. */
function leafAt(r: LeafRecipe, s: number, t: number, px: number): { cover: number; vein: number; tone: number } {
  const stalkW = .018
  if (t < 0 || t > 1) return { cover: 0, vein: 0, tone: 1 }
  if (t < r.stalk) {
    const cover = Math.max(0, Math.min(1, (stalkW - Math.abs(s)) / px + .5))
    return { cover, vein: 1, tone: .82 }
  }
  const bt = (t - r.stalk) / (1 - r.stalk)
  if (r.palmate) {
    // five rounded lobes about the palm, three large and two at the base,
    // the stalk entering a notch: a radius by bearing from the tip's line
    const dx = s, dy = bt - .45
    const a = Math.atan2(dx, dy), d = Math.hypot(dx, dy)
    const main = Math.pow(Math.max(0, Math.cos(a * 2.4)), .55)
    const reach = (.3 + .22 * main) * (1 - .38 * Math.pow(Math.abs(a) / Math.PI, 1.6)) * (Math.abs(a) > 2.75 ? .35 : 1)
    const cover = Math.max(0, Math.min(1, (reach - d) / px + .5))
    // five main veins from the palm out to the lobes
    const spoke = Math.min(...[0, 1.31, -1.31, 2.4, -2.4].map(v => Math.abs(a - v))) * d
    const vein = Math.max(0, 1 - spoke / .012) * (d < reach * .92 ? 1 : 0)
    return { cover, vein, tone: .96 + .04 * Math.cos(d * 40) }
  }
  const side = s < 0 ? -1 : 1
  const half = bladeWidth(r, bt, side)
  const cover = Math.max(0, Math.min(1, (half - Math.abs(s)) / px + .5))
  // the midrib and the side veins climbing to the margin
  const mid = Math.max(0, 1 - Math.abs(s) / (.014 * (1 - bt * .6)))
  const phase = (bt - Math.abs(s) * 1.25) * r.veins
  const lateral = Math.max(0, 1 - Math.abs(phase - Math.round(phase)) / .09) * (bt > .04 ? 1 : 0) * Math.max(0, 1 - Math.abs(s) / Math.max(.02, half))
  return { cover, vein: Math.max(mid, lateral * .6), tone: 1 - .07 * (Math.abs(s) / Math.max(.02, half)) }
}

/** A spray: a shoot up the card with its leaves on it, each drawn from the
    species' own leaf; the coverage is the union of the blades and the shoot. */
function sprayAt(r: LeafRecipe, s: number, t: number, px: number): { cover: number; vein: number; tone: number } {
  const shoot = r.spray.compound ? .06 : .9
  let best = { cover: Math.max(0, Math.min(1, (.012 - Math.abs(s)) / px + .5)) * (t > 0 && t < shoot ? 1 : 0), vein: 1, tone: .62 }
  const n = r.spray.leaves
  const size = SPRAY_LEAF * (r.spray.compound ? 1.05 : r.width > .8 ? .95 : 1)
  for (let i = 0; i < n; i++) {
    let at: number, angle: number, scale: number
    if (r.spray.compound) {
      // a compound leaf: the rachis up the card, leaflets in pairs, one at the end
      const pair = Math.floor(i / 2), pairs = Math.floor((n - 1) / 2)
      const last = i === n - 1
      at = last ? .6 : .16 + .44 * pair / Math.max(1, pairs)
      angle = last ? 0 : (i % 2 ? 1 : -1) * r.spray.angle
      scale = last ? 1.08 : .78 + .22 * pair / Math.max(1, pairs)
    } else {
      const last = i === n - 1
      at = last ? .6 : .1 + .52 * (r.spray.opposite ? Math.floor(i / 2) / Math.max(1, Math.floor((n - 1) / 2)) : i / Math.max(1, n - 1))
      angle = last ? 0 : (i % 2 ? 1 : -1) * r.spray.angle * (.85 + .3 * ((i * 7) % 5) / 5)
      scale = last ? 1 : .85 + .2 * ((i * 3) % 4) / 4
    }
    const len = size * scale
    const ca = Math.cos(angle), sa = Math.sin(angle)
    const dx = s, dy = t - at
    const ls = (dx * ca - dy * sa) / len, lt = (dx * sa + dy * ca) / len
    if (lt < 0 || lt > 1 || Math.abs(ls) > .5) continue
    const leaf = leafAt(r, ls, lt, px / len)
    if (leaf.cover > best.cover) best = leaf
  }
  return best
}

function srgb(linear: number): number {
  const v = Math.max(0, Math.min(1, linear))
  return Math.round((v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055) * 255)
}

const drawn = typeof document !== 'undefined'
function placeholder(): DataTexture {
  const map = new DataTexture(new Uint8Array([200, 200, 200, 255]), 1, 1, RGBAFormat)
  map.needsUpdate = true
  return map
}

let atlas: { albedo: DataTexture; normal: DataTexture } | undefined
/** The leaf atlas: albedo with coverage in alpha, and relief. */
export function leafAtlas(): { albedo: DataTexture; normal: DataTexture } {
  if (atlas) return atlas
  if (!drawn) return (atlas = { albedo: placeholder(), normal: placeholder() })
  const W = CELL * ATLAS_COLUMNS, H = CELL * ATLAS_ROWS
  const albedo = new Uint8Array(W * H * 4), normal = new Uint8Array(W * H * 4)
  const heights = new Float32Array(W * H)
  for (const species of ORDER) {
    const recipe = LEAF_RECIPES[species]
    for (const [cell, draw] of [[leafCell(species), leafAt], [sprayCell(species), sprayAt]] as const) {
      const ox = (cell % ATLAS_COLUMNS) * CELL, oy = Math.floor(cell / ATLAS_COLUMNS) * CELL
      for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
        // four samples a texel for a clean outline
        let cover = 0, vein = 0, tone = 0
        for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
          const s = (x + .25 + sx * .5) / CELL - .5, t = (y + .25 + sy * .5) / CELL
          const at = draw(recipe, s, t, 1 / CELL)
          cover += at.cover / 4; vein += at.vein / 4; tone += at.tone / 4
        }
        const i = (oy + y) * W + ox + x
        heights[i] = vein * .6 * cover
        // a neutral blade, the veins a little paler, the margin a little darker
        const lum = (.78 + .12 * vein) * tone
        albedo[i * 4] = srgb(lum); albedo[i * 4 + 1] = srgb(lum); albedo[i * 4 + 2] = srgb(lum * .97)
        albedo[i * 4 + 3] = Math.round(Math.min(1, cover) * 255)
      }
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x
    const hx = heights[y * W + Math.min(W - 1, x + 1)]! - heights[y * W + Math.max(0, x - 1)]!
    const hy = heights[Math.min(H - 1, y + 1) * W + x]! - heights[Math.max(0, y - 1) * W + x]!
    let nx = -hx * 2.2, ny = -hy * 2.2, nz = 1
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l
    normal[i * 4] = Math.round((nx * .5 + .5) * 255); normal[i * 4 + 1] = Math.round((ny * .5 + .5) * 255)
    normal[i * 4 + 2] = Math.round((nz * .5 + .5) * 255); normal[i * 4 + 3] = 255
  }
  atlas = { albedo: withMips(albedo, W, H, true), normal: withMips(normal, W, H, false) }
  atlas.albedo.colorSpace = SRGBColorSpace
  atlas.normal.colorSpace = NoColorSpace
  atlas.albedo.name = 'vinci generated leaf atlas'
  atlas.normal.name = 'vinci generated leaf relief'
  return atlas
}

/** A box-filtered mip chain; for coverage, each level keeps each cell's share
    of texels above the cut, raising its alpha until it does. */
function withMips(base: Uint8Array, W: number, H: number, coverage: boolean): DataTexture {
  const mipmaps: { data: Uint8Array; width: number; height: number }[] = [{ data: base, width: W, height: H }]
  const cut = 128
  const cells = ATLAS_COLUMNS * ATLAS_ROWS
  const shares = (data: Uint8Array, w: number, h: number): number[] => {
    const count = new Array<number>(cells).fill(0), cw = w / ATLAS_COLUMNS, ch = h / ATLAS_ROWS
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]! > cut) count[Math.floor(y / ch) * ATLAS_COLUMNS + Math.floor(x / cw)]! += 1
    return count.map(n => n / (cw * ch))
  }
  const target = coverage ? shares(base, W, H) : []
  let prev = base, w = W, h = H
  while (w > 1 || h > 1) {
    const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), next = new Uint8Array(nw * nh * 4)
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let r = 0, g = 0, b = 0, a = 0, weight = 0, n = 0
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const sx = Math.min(w - 1, x * 2 + dx), sy = Math.min(h - 1, y * 2 + dy)
        const k = (sy * w + sx) * 4
        const wt = coverage ? prev[k + 3]! / 255 + .002 : 1
        r += prev[k]! * wt; g += prev[k + 1]! * wt; b += prev[k + 2]! * wt; a += prev[k + 3]!; weight += wt; n++
      }
      const k = (y * nw + x) * 4
      next[k] = Math.round(r / weight); next[k + 1] = Math.round(g / weight); next[k + 2] = Math.round(b / weight); next[k + 3] = Math.round(a / n)
    }
    const cw = nw / ATLAS_COLUMNS, ch = nh / ATLAS_ROWS
    if (coverage && cw >= 1 && ch >= 1 && Number.isInteger(cw) && Number.isInteger(ch)) {
      for (let cell = 0; cell < cells; cell++) {
        const want = target[cell]!
        if (want <= 0) continue
        const cx = (cell % ATLAS_COLUMNS) * cw, cy = Math.floor(cell / ATLAS_COLUMNS) * ch
        const alphas: number[] = []
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) alphas.push(next[((cy + y) * nw + cx + x) * 4 + 3]!)
        alphas.sort((p, q) => q - p)
        const keep = Math.max(1, Math.round(want * cw * ch))
        const edge = alphas[Math.min(alphas.length - 1, keep - 1)]!
        const scale = edge > 0 ? Math.max(1, (cut + 1) / edge) : 1
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          const k = ((cy + y) * nw + cx + x) * 4 + 3
          next[k] = Math.min(255, Math.round(next[k]! * scale))
        }
      }
    }
    mipmaps.push({ data: next, width: nw, height: nh })
    prev = next; w = nw; h = nh
  }
  const texture = new DataTexture(base, W, H, RGBAFormat)
  texture.mipmaps = mipmaps as unknown as DataTexture['mipmaps']
  texture.generateMipmaps = false
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

/* ─── the bark ─────────────────────────────────────────────────────────── */

function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let bark: { albedo: DataTexture; normal: DataTexture } | undefined
/** A fissured bark, tileable: plates and furrows as detail, their relief as
    a normal map. One tile is 0.42 m around a limb and 0.70 m along it. */
export function barkMaps(): { albedo: DataTexture; normal: DataTexture } {
  if (bark) return bark
  if (!drawn) return (bark = { albedo: placeholder(), normal: placeholder() })
  const W = 256, H = 512
  const random = mulberry(20171010)
  const lattice = (gw: number, gh: number): Float32Array => { const g = new Float32Array(gw * gh); for (let i = 0; i < g.length; i++) g[i] = random(); return g }
  const sample = (g: Float32Array, gw: number, gh: number, u: number, v: number): number => {
    const x = u * gw, y = v * gh, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    const at = (i: number, j: number): number => g[((j % gh + gh) % gh) * gw + ((i % gw + gw) % gw)]!
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy
  }
  const warp = lattice(6, 5), plates = lattice(5, 9), crack = lattice(9, 23), fine = lattice(32, 64), mid = lattice(12, 24)
  const height = new Float32Array(W * H), tone = new Float32Array(W * H)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const u = i / W, v = j / H
    const wu = u + (sample(warp, 6, 5, u, v) - .5) * .22
    const ridge = Math.abs(Math.sin(Math.PI * (wu * 5 + (sample(plates, 5, 9, u, v) - .5) * .9)))
    const breaks = sample(crack, 9, 23, wu, v)
    const cut = breaks < .22 ? breaks / .22 : 1
    height[j * W + i] = Math.pow(ridge, .55) * (.55 + .45 * cut) + (sample(mid, 12, 24, u, v) - .5) * .25 + (sample(fine, 32, 64, u, v) - .5) * .12
    tone[j * W + i] = .78 + .3 * Math.pow(ridge, .8) * cut + (sample(fine, 32, 64, u + .37, v + .11) - .5) * .14
  }
  const albedo = new Uint8Array(W * H * 4), normal = new Uint8Array(W * H * 4)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = (j * W + i) * 4
    const g = srgb(Math.min(1, tone[j * W + i]!))
    albedo[k] = g; albedo[k + 1] = g; albedo[k + 2] = g; albedo[k + 3] = 255
    const hx = height[j * W + (i + 1) % W]! - height[j * W + (i + W - 1) % W]!
    const hy = height[((j + 1) % H) * W + i]! - height[((j + H - 1) % H) * W + i]!
    let nx = -hx * 3.2, ny = -hy * 1.9, nz = 1
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l
    normal[k] = Math.round((nx * .5 + .5) * 255); normal[k + 1] = Math.round((ny * .5 + .5) * 255); normal[k + 2] = Math.round((nz * .5 + .5) * 255); normal[k + 3] = 255
  }
  const make = (data: Uint8Array): DataTexture => {
    const map = new DataTexture(data, W, H, RGBAFormat)
    map.wrapS = map.wrapT = RepeatWrapping
    map.magFilter = LinearFilter; map.minFilter = LinearMipmapLinearFilter
    map.generateMipmaps = true
    map.anisotropy = 8
    map.needsUpdate = true
    return map
  }
  bark = { albedo: make(albedo), normal: make(normal) }
  bark.albedo.colorSpace = SRGBColorSpace
  bark.normal.colorSpace = NoColorSpace
  bark.albedo.name = 'vinci generated fissured bark'
  bark.normal.name = 'vinci generated fissured bark relief'
  return bark
}
