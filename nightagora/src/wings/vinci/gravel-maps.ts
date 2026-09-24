/* THE TERRACE'S GRAVEL, BAKED FROM ITS RECIPE INTO ONE TILE WITH ITS MIPS.

   A stone field drawn per pixel in the shader either sparkles, where one
   pixel spans several stones, or has to be faded to its mean before it can,
   and then the walk reads as poured tan. Baked into a tile, the sampler
   integrates it over each pixel's own footprint: the mips hold every scale's
   mean, the anisotropic taps run along a grazing pixel's length, and the
   relief map carries the slope's second moment beside its mean, so the slope
   a mip averages away returns as roughness (the LEAN rule) instead of
   flashing. River gravel of the period as a type: fine stones of 15 to 28 mm
   packed over sand, a sparse coarse stone of 50 to 90 mm standing proud.
   The recipe is the source; the two maps are what an export carries. */
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, RGBAFormat, SRGBColorSpace } from 'three/webgpu'

/** the tile's side in metres */
export const GRAVEL_TILE_M = 1.2
/** slopes are stored in [-range, range] */
export const GRAVEL_SLOPE_RANGE = 2
/** heights are stored in [0, this] metres */
export const GRAVEL_HEIGHT_M = .012

const SIZE = 1024
const TEXEL_M = GRAVEL_TILE_M / SIZE
const drawn = typeof document !== 'undefined'

export const gravelMapsProvenance = {
  recipe: 'One 1024 square tile over 1.2 m, baked in code: fine river gravel on a jittered grid of 57 cells a tile (stones 15 to 28 mm across, each its own turn, elongation, burial and colour), a coarse stone in about one cell in five of an 18-cell grid (50 to 90 mm), sand with grit in the gaps. Albedo (sRGB) and relief (slope mean and second moment, height) with box-filtered mips. A type of the period, not a survey.',
} as const

function hash(i: number, j: number, s: number): number {
  let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 1440670441)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const wrap = (i: number, n: number): number => ((i % n) + n) % n
/** value noise, periodic over the tile at `f` cells a side */
function noise(u: number, v: number, f: number, s: number): number {
  const x = u * f, y = v * f, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const a = hash(wrap(xi, f), wrap(yi, f), s), b = hash(wrap(xi + 1, f), wrap(yi, f), s)
  const c = hash(wrap(xi, f), wrap(yi + 1, f), s), d = hash(wrap(xi + 1, f), wrap(yi + 1, f), s)
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy
}
const toLinear = (c: number): number => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4
const toSrgb = (c: number): number => c <= .0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - .055
const hex = (h: string): [number, number, number] => [0, 2, 4].map(k => toLinear(parseInt(h.slice(1 + k, 3 + k), 16) / 255)) as [number, number, number]

// river gravel of the Loire: cream and grey limestone, ochre sandstone,
// brown and blue-black flint, a little white quartz; weights by share
const PALETTE: [string, number][] = [
  ['#b8ac94', 28], ['#958d7f', 20], ['#a58c69', 17], ['#aca28c', 13], ['#83715c', 9], ['#64625d', 7], ['#cdc6b4', 6],
]
const PALETTE_LINEAR = PALETTE.map(([h]) => hex(h))
const PALETTE_TOTAL = PALETTE.reduce((a, [, w]) => a + w, 0)
function pick(r: number): [number, number, number] {
  let at = r * PALETTE_TOTAL, i = 0
  while (i < PALETTE.length - 1 && at >= PALETTE[i]![1]) { at -= PALETTE[i]![1]; i++ }
  return PALETTE_LINEAR[i]!
}
const SAND = hex('#7d6f5c')

interface Stone { cu: number; cv: number; ca: number; sa: number; rx: number; ry: number; top: number; bury: number; colour: [number, number, number]; seed: number }
interface Layer { n: number; stones: (Stone | null)[] }

/** one stone a cell where present, its centre, turn, radii and height in
    tile units and metres */
function layer(n: number, seed: number, presence: number, radius: [number, number], height: [number, number], buried: [number, number]): Layer {
  const stones: (Stone | null)[] = []
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (hash(i, j, seed) > presence) { stones.push(null); continue }
    const r = radius[0] + (radius[1] - radius[0]) * hash(i, j, seed + 1)
    const long = .62 + .38 * hash(i, j, seed + 2), turn = hash(i, j, seed + 3) * Math.PI
    const tone = .9 + .2 * hash(i, j, seed + 4), base = pick(hash(i, j, seed + 5))
    const top = height[0] + (height[1] - height[0]) * hash(i, j, seed + 6)
    stones.push({
      cu: (i + .18 + .64 * hash(i, j, seed + 7)) / n, cv: (j + .18 + .64 * hash(i, j, seed + 8)) / n,
      ca: Math.cos(turn), sa: Math.sin(turn), rx: r / GRAVEL_TILE_M, ry: r * long / GRAVEL_TILE_M,
      top, bury: top * (buried[0] + (buried[1] - buried[0]) * hash(i, j, seed + 9)),
      colour: [base[0] * tone, base[1] * tone, base[2] * tone], seed: seed * 7919 + j * n + i,
    })
  }
  return { n, stones }
}

/** the highest stone of a layer standing over (u, v), its height above the
    sand, its dome share (0 at its rim, 1 at its crown) and the stone */
function highest(L: Layer, u: number, v: number): { h: number; dome: number; stone: Stone | null } {
  const ci = Math.floor(u * L.n), cj = Math.floor(v * L.n)
  let best = 0, dome = 0, stone: Stone | null = null
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const s = L.stones[wrap(cj + dj, L.n) * L.n + wrap(ci + di, L.n)]
    if (!s) continue
    // the stone's centre on the unwrapped side of the tile nearest (u, v)
    const du = u - (s.cu - wrap(ci + di, L.n) / L.n + (ci + di) / L.n)
    const dv = v - (s.cv - wrap(cj + dj, L.n) / L.n + (cj + dj) / L.n)
    const x = (du * s.ca + dv * s.sa) / s.rx, y = (dv * s.ca - du * s.sa) / s.ry
    const q = x * x + y * y
    if (q >= 1) continue
    const h = s.top * Math.sqrt(1 - q) - s.bury
    if (h > best) { best = h; dome = h / (s.top - s.bury); stone = s }
  }
  return { h: best, dome, stone }
}

export interface GravelMaps { albedo: DataTexture; relief: DataTexture }
let maps: GravelMaps | null = null

function placeholder(r: number, g: number, b: number, a: number, srgb: boolean): DataTexture {
  const t = new DataTexture(new Uint8Array([r, g, b, a]), 1, 1, RGBAFormat)
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace
  t.needsUpdate = true
  return t
}

/** The tile's two maps: albedo (sRGB, alpha unused) and relief (slope x and
    z about 0.5, the slope's second moment, height). A checker in node draws
    no map. */
export function gravelMaps(): GravelMaps {
  if (maps) return maps
  if (!drawn) return (maps = { albedo: placeholder(138, 126, 108, 255, true), relief: placeholder(128, 128, 0, 80, false) })
  const fine = layer(57, 1301, .94, [.0075, .014], [.0055, .0085], [.3, .55])
  const coarse = layer(18, 2707, .2, [.025, .045], [.016, .022], [.45, .62])
  const height = new Float32Array(SIZE * SIZE)
  const colour = new Float32Array(SIZE * SIZE * 3)
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const u = (x + .5) / SIZE, v = (y + .5) / SIZE, k = y * SIZE + x
    // the sand between: its own grain, a grit speck here and there
    const grain = noise(u, v, 640, 11) * .6 + noise(u, v, 256, 12) * .4
    let h = .0004 * grain
    const speck = hash(x, y, 13)
    let r = SAND[0], g = SAND[1], b = SAND[2]
    const sandTone = .82 + .3 * grain + (speck > .965 ? .35 : 0)
    r *= sandTone; g *= sandTone; b *= sandTone
    const f = highest(fine, u, v), c = highest(coarse, u, v)
    const top = c.h > f.h ? c : f
    if (top.stone && top.h > .0002) {
      const s = top.stone
      h = Math.max(h, top.h)
      // a stone is not one flat colour: a mottle, a fleck, a vein in some,
      // and darker toward its foot where the sand stains it
      const mottle = .93 + .14 * noise(u, v, 420, s.seed & 1023)
      const fleck = hash(x, y, s.seed) > .97 ? .8 : 1
      const foot = .72 + .28 * Math.min(1, top.dome * 2.2)
      const t = mottle * fleck * foot
      // the stone's rim blends a texel into the sand, no hard pixel stair
      const edge = Math.min(1, top.h / .0006)
      r = r + (s.colour[0] * t - r) * edge; g = g + (s.colour[1] * t - g) * edge; b = b + (s.colour[2] * t - b) * edge
    }
    height[k] = h
    colour[k * 3] = r; colour[k * 3 + 1] = g; colour[k * 3 + 2] = b
  }
  const albedo = new Uint8Array(SIZE * SIZE * 4), relief = new Uint8Array(SIZE * SIZE * 4)
  const S = GRAVEL_SLOPE_RANGE
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const k = y * SIZE + x
    const sx = (height[y * SIZE + wrap(x + 1, SIZE)]! - height[y * SIZE + wrap(x - 1, SIZE)]!) / (2 * TEXEL_M)
    const sz = (height[wrap(y + 1, SIZE) * SIZE + x]! - height[wrap(y - 1, SIZE) * SIZE + x]!) / (2 * TEXEL_M)
    const cx = Math.max(-S, Math.min(S, sx)), cz = Math.max(-S, Math.min(S, sz))
    relief[k * 4] = Math.round((cx / S * .5 + .5) * 255)
    relief[k * 4 + 1] = Math.round((cz / S * .5 + .5) * 255)
    relief[k * 4 + 2] = Math.round(Math.min(1, (cx * cx + cz * cz) / (S * S)) * 255)
    relief[k * 4 + 3] = Math.round(Math.min(1, height[k]! / GRAVEL_HEIGHT_M) * 255)
    for (let c = 0; c < 3; c++) albedo[k * 4 + c] = Math.round(Math.min(1, toSrgb(Math.min(1, colour[k * 3 + c]!))) * 255)
    albedo[k * 4 + 3] = 255
  }
  maps = { albedo: withMips(albedo, true), relief: withMips(relief, false) }
  maps.albedo.colorSpace = SRGBColorSpace
  maps.albedo.name = 'vinci generated terrace gravel'
  maps.relief.name = 'vinci generated terrace gravel relief'
  return maps
}

/** a box-filtered mip chain over the periodic tile; albedo averaged in linear
    light, relief channels averaged as they are (moments stay moments) */
function withMips(base: Uint8Array, srgb: boolean): DataTexture {
  const lut = new Float32Array(256)
  for (let i = 0; i < 256; i++) lut[i] = srgb ? toLinear(i / 255) : i / 255
  const mipmaps: { data: Uint8Array; width: number; height: number }[] = [{ data: base, width: SIZE, height: SIZE }]
  let prev = base, w = SIZE
  while (w > 1) {
    const nw = w >> 1, next = new Uint8Array(nw * nw * 4)
    for (let y = 0; y < nw; y++) for (let x = 0; x < nw; x++) for (let c = 0; c < 4; c++) {
      const a = (srgb && c < 3) ? lut : null
      const at = (xx: number, yy: number): number => { const v = prev[(yy * w + xx) * 4 + c]!; return a ? a[v]! : v / 255 }
      const m = (at(2 * x, 2 * y) + at(2 * x + 1, 2 * y) + at(2 * x, 2 * y + 1) + at(2 * x + 1, 2 * y + 1)) / 4
      next[(y * nw + x) * 4 + c] = Math.round((a ? toSrgb(m) : m) * 255)
    }
    mipmaps.push({ data: next, width: nw, height: nw })
    prev = next; w = nw
  }
  const texture = new DataTexture(base, SIZE, SIZE, RGBAFormat)
  texture.mipmaps = mipmaps as unknown as DataTexture['mipmaps']
  texture.generateMipmaps = false
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.anisotropy = 16
  texture.colorSpace = NoColorSpace
  texture.needsUpdate = true
  return texture
}
