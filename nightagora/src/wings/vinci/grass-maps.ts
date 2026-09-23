/* THE MEADOW'S TUFTS AS MAPS, DRAWN FROM THEIR RECIPES.

   One atlas of four by two cells, each a tuft of the late-October sward as a
   hand would pull it: thirty to forty blades from one crown, the young ones
   green to the tip, the old ones gone to straw from the tip down, some bent
   over, some standing as seed stalks with their panicles. The blades carry
   their own colour; a card's vertex colour only tints the whole tuft. The
   coverage mips keep each cell's share of blade above the cut, so a far
   tuft keeps its cover. The recipe is the source, the map is what an export
   carries. A checker in node draws no map. */
import { ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, SRGBColorSpace } from 'three/webgpu'

export const GRASS_COLUMNS = 4
export const GRASS_ROWS = 2
const CELL = 256

/** a cell's corner and size in the atlas's own coordinates */
export function grassCellUV(cell: number): { u0: number; v0: number; du: number; dv: number } {
  return { u0: (cell % GRASS_COLUMNS) / GRASS_COLUMNS, v0: Math.floor(cell / GRASS_COLUMNS) / GRASS_ROWS, du: 1 / GRASS_COLUMNS, dv: 1 / GRASS_ROWS }
}
/** the tuft cells: green sward, mixed, straw with heads, bent and short */
export const GRASS_CELLS = { green: [0, 1], mixed: [2, 3], seeding: [4, 5], bent: [6, 7] } as const

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
const lin = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number): number => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4 }
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)]
}
const srgb = (v: number): number => Math.round((v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(Math.min(1, v), 1 / 2.4) - .055) * 255)
const GREEN = ['#4f5c32', '#5b6939', '#66733e', '#56663a', '#6f7a45'].map(lin)
const STRAW = ['#a39a68', '#b2a676', '#978c5f', '#8a7d56', '#c0b287'].map(lin)
const BROWN = lin('#6e5f45')

const drawn = typeof document !== 'undefined'
let atlas: DataTexture | undefined

/** The tuft atlas: colour with coverage in alpha. */
export function grassAtlas(): DataTexture {
  if (atlas) return atlas
  if (!drawn) { const t = new DataTexture(new Uint8Array([120, 130, 80, 255]), 1, 1, RGBAFormat); t.needsUpdate = true; return (atlas = t) }
  const W = CELL * GRASS_COLUMNS, H = CELL * GRASS_ROWS
  const cover = new Float32Array(W * H), rgb = new Float32Array(W * H * 3)
  const random = mulberry(15171040)
  for (let cell = 0; cell < GRASS_COLUMNS * GRASS_ROWS; cell++) {
    const ox = (cell % GRASS_COLUMNS) * CELL, oy = Math.floor(cell / GRASS_COLUMNS) * CELL
    const kind = cell < 2 ? 'green' : cell < 4 ? 'mixed' : cell < 6 ? 'seeding' : 'bent'
    const blades = kind === 'bent' ? 34 : 40
    const dryShare = kind === 'green' ? .12 : kind === 'mixed' ? .42 : kind === 'seeding' ? .6 : .5
    for (let b = 0; b < blades; b++) {
      // a blade from the crown at the cell's foot, out and up, curving over
      const baseX = CELL * (.5 + (random() - .5) * .32), lean = (random() - .5) * (kind === 'bent' ? 1.9 : 1.1)
      const tall = CELL * (kind === 'bent' ? .35 + random() * .35 : .45 + random() * .5)
      const width = 1.2 + random() * 2.2, droop = kind === 'bent' ? .8 + random() * .9 : random() * random() * .8
      const dry = random() < dryShare, green = GREEN[Math.floor(random() * GREEN.length)]!, straw = STRAW[Math.floor(random() * STRAW.length)]!
      const dead = random() < .1
      const steps = 90
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        // the bend grows along the blade: straight at the crown, over at the tip
        const angle = lean * t + droop * t * t * Math.sign(lean || 1)
        const x = baseX + Math.sin(angle) * tall * t * .9 + lean * tall * .25 * t
        const y = CELL - 2 - Math.cos(angle) * tall * t
        const w = width * (1 - t * .92)
        // the tip goes to straw first on a dry blade; the foot stays green
        const toStraw = dry ? Math.min(1, t * 1.6) : Math.max(0, (t - .75) * 2)
        const c: readonly [number, number, number] = dead ? BROWN : [green[0] + (straw[0] - green[0]) * toStraw, green[1] + (straw[1] - green[1]) * toStraw, green[2] + (straw[2] - green[2]) * toStraw]
        const shade = .72 + .28 * t
        stamp(cover, rgb, W, ox, oy, x, y, w / 2, [c[0] * shade, c[1] * shade, c[2] * shade])
      }
      // a seed stalk carries its panicle: a spray of spikelets at its head
      if ((kind === 'seeding' && random() < .45) || (kind === 'mixed' && random() < .12)) {
        const headX = baseX + Math.sin(lean) * tall * .95, headY = CELL - 2 - Math.cos(lean) * tall * 1.05
        for (let k = 0; k < 26; k++) {
          const a = -Math.PI / 2 + lean + (random() - .5) * 1.1, r = random() * CELL * .09
          stamp(cover, rgb, W, ox, oy, headX + Math.cos(a) * r, headY + Math.sin(a) * r * 1.3, .9 + random() * .9, straw.map(v => v * 1.05) as [number, number, number])
        }
      }
    }
  }
  const data = new Uint8Array(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    const a = Math.min(1, cover[i]!)
    const k = a > 0 ? 1 / Math.max(1e-6, cover[i]!) : 0
    data[i * 4] = srgb(rgb[i * 3]! * k); data[i * 4 + 1] = srgb(rgb[i * 3 + 1]! * k); data[i * 4 + 2] = srgb(rgb[i * 3 + 2]! * k)
    data[i * 4 + 3] = Math.round(a * 255)
  }
  atlas = coverageMips(data, W, H, GRASS_COLUMNS, GRASS_ROWS)
  atlas.colorSpace = SRGBColorSpace
  atlas.name = 'vinci generated meadow tuft atlas'
  return atlas
}

/** one round mark of a blade, anti-aliased, its colour weighted by cover */
function stamp(cover: Float32Array, rgb: Float32Array, W: number, ox: number, oy: number, x: number, y: number, r: number, c: readonly number[]): void {
  const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(CELL - 1, Math.ceil(x + r + 1))
  const y0 = Math.max(0, Math.floor(y - r - 1)), y1 = Math.min(CELL - 1, Math.ceil(y + r + 1))
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
    const d = Math.hypot(px + .5 - x, py + .5 - y)
    const a = Math.max(0, Math.min(1, r + .5 - d))
    if (a <= 0) continue
    const i = (oy + py) * W + ox + px
    const add = a * (1 - Math.min(1, cover[i]!))
    cover[i]! += add
    rgb[i * 3]! += c[0]! * add; rgb[i * 3 + 1]! += c[1]! * add; rgb[i * 3 + 2]! += c[2]! * add
  }
}

/** A box-filtered chain whose alpha keeps each cell's share of cover above
    the cut, so a tuft or a leaf seen small does not thin away. */
export function coverageMips(base: Uint8Array, W: number, H: number, columns: number, rows: number): DataTexture {
  const cut = 128, cells = columns * rows
  const share = (data: Uint8Array, w: number, h: number): number[] => {
    const count = new Array<number>(cells).fill(0), cw = w / columns, ch = h / rows
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]! > cut) count[Math.floor(y / ch) * columns + Math.floor(x / cw)]! += 1
    return count.map(n => n / (cw * ch))
  }
  const target = share(base, W, H)
  const mipmaps: { data: Uint8Array; width: number; height: number }[] = [{ data: base, width: W, height: H }]
  let prev = base, w = W, h = H
  while (w > 1 || h > 1) {
    const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), next = new Uint8Array(nw * nh * 4)
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let r = 0, g = 0, b = 0, a = 0, weight = 0
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const k = (Math.min(h - 1, y * 2 + dy) * w + Math.min(w - 1, x * 2 + dx)) * 4
        const wt = prev[k + 3]! / 255 + .002
        r += prev[k]! * wt; g += prev[k + 1]! * wt; b += prev[k + 2]! * wt; a += prev[k + 3]!; weight += wt
      }
      const k = (y * nw + x) * 4
      next[k] = Math.round(r / weight); next[k + 1] = Math.round(g / weight); next[k + 2] = Math.round(b / weight); next[k + 3] = Math.round(a / 4)
    }
    const cw = nw / columns, ch = nh / rows
    if (cw >= 1 && ch >= 1 && Number.isInteger(cw) && Number.isInteger(ch)) {
      for (let cell = 0; cell < cells; cell++) {
        const want = target[cell]!
        if (want <= 0) continue
        const cx = (cell % columns) * cw, cy = Math.floor(cell / columns) * ch
        const alphas: number[] = []
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) alphas.push(next[((cy + y) * nw + cx + x) * 4 + 3]!)
        alphas.sort((p, q) => q - p)
        const edge = alphas[Math.min(alphas.length - 1, Math.max(1, Math.round(want * cw * ch)) - 1)]!
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
