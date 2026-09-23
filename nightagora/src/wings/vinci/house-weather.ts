/** Weather with causes, baked once into one map for every facade of the
 * house. A texel knows its facade and its place on it, so the rain that
 * runs off a sill's two ends, the curtain under a string course, the damp
 * that climbs the foot and the lichen that holds on a north face each land
 * where their cause is. The map is the export; the recipe stays the source.
 */
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, UnsignedByteType, ClampToEdgeWrapping } from 'three/webgpu'
import raw from './data/closluce.json?raw'
import { groundHeight, hourKey } from './site'

type V2 = [number, number]
interface Opening { id: string; type: string; from_m: number; width_m: number; base_m: number; height_m: number; render: boolean }
interface Facade { id: string; from: V2; to: V2; length_m: number; render: boolean; openings: Opening[]; pattern: { field: string } }
interface Wall { facade_id?: string; base_m: number; height_m: number; render: boolean }
function values(x: unknown): unknown {
  if (!x || typeof x !== 'object') return x
  if ('value' in x) return (x as { value: unknown }).value
  if (Array.isArray(x)) return x.map(values)
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, values(v)]))
}
const spec = values(JSON.parse(raw)) as { facades: Facade[]; walls: Wall[] }

/** Texels per metre: the causes are soft at this scale, the shader lays
 * the fine fibre of a streak over them. */
export const WEATHER_TEXELS_PER_M = 16
const SIZE = 1024, PAD = 2

export interface WeatherRect { facade: string; x0: number; y0: number; width: number; height: number; length: number; bottom: number }
const rand = (a: number, b = 0): number => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123; return n - Math.floor(n) }
/** An integer hash to 0..1: the bake calls it millions of times. */
function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
/** Smooth value noise, metres in, 0..1 out. */
function noise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf), k = Math.floor(seed * 1013)
  const a = hash2(xi + k, yi), b = hash2(xi + 1 + k, yi), c = hash2(xi + k, yi + 1), d = hash2(xi + 1 + k, yi + 1)
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy
}
const fbm = (x: number, y: number, seed: number): number => noise(x, y, seed) * .55 + noise(x * 2.1, y * 2.1, seed + 7) * .3 + noise(x * 4.3, y * 4.3, seed + 13) * .15

interface Atlas { texture: DataTexture; rects: Map<string, WeatherRect>; texels: number; bakeMs: number }
let atlas: Atlas | null = null

/** The hour's sun, toward it: east, north, and its rise per metre run. */
const SUN_AZ = hourKey.sun_azimuth_deg.value * Math.PI / 180, SUN_EL = hourKey.sun_elevation_deg.value * Math.PI / 180
const SUN_E = Math.sin(SUN_AZ), SUN_N = Math.cos(SUN_AZ), SUN_RISE = Math.tan(SUN_EL)
/** Every facade as a blind wall for the sun test: its line, and a head that
 * adds half the roof's rise over the eaves, so a ray passing over a range's
 * walls under its ridge still counts as stopped. */
const blockers = spec.facades.filter(f => f.render).map(f => {
  const wall = spec.walls.find(w => w.facade_id === f.id && w.render)
  const top = wall ? wall.base_m + wall.height_m : 7.7
  return { a: f.from, b: f.to, head: (f as Facade & { gable_segment?: string }).gable_segment ? 13.5 : top + (top > 6 ? 2.9 : 1.1) }
})
function sunlit(e: number, n: number, z: number): boolean {
  for (const w of blockers) {
    const ex = w.b[0] - w.a[0], ey = w.b[1] - w.a[1]
    const det = SUN_E * ey - SUN_N * ex
    if (Math.abs(det) < 1e-9) continue
    const t = ((w.a[0] - e) * ey - (w.a[1] - n) * ex) / det, s = ((w.a[0] - e) * SUN_N - (w.a[1] - n) * SUN_E) / det
    if (t > .05 && s >= 0 && s <= 1 && z + t * SUN_RISE < w.head) return false
  }
  return true
}
/** How much sunlit ground a wall point sees: a view factor, summed over a
 * fan of ground patches in front of it. Engine-only: the film bounces. */
function groundSeen(e: number, n: number, z: number, out: V2, along: V2): number {
  let f = 0
  for (const d of [.7, 1.8, 3.4, 5.6, 8.5]) for (const s of [-2.4, 0, 2.4]) {
    const ge = e + out[0] * d + along[0] * s, gn = n + out[1] * d + along[1] * s, gz = groundHeight(ge, gn)
    if (gz > z - .05) continue
    const dx = ge - e, dy = gn - n, dz = gz - z, r2 = dx * dx + dy * dy + dz * dz, r = Math.sqrt(r2)
    const cosWall = (dx * out[0] + dy * out[1]) / r, cosGround = -dz / r
    if (cosWall <= 0 || cosGround <= 0) continue
    const area = (d < 1 ? 1.1 : d < 2.5 ? 1.5 : d < 4.5 ? 2.2 : d < 7 ? 2.8 : 3.4) * 2.4
    if (sunlit(ge, gn, gz + .05)) f += cosWall * cosGround * area / (Math.PI * r2)
  }
  return Math.min(1, f)
}

/** One rect per rendered facade, shelf-packed, and each texel baked. */
export function weatherAtlas(): Atlas {
  if (atlas) return atlas
  const began = typeof performance !== 'undefined' ? performance.now() : 0
  const data = new Uint8Array(SIZE * SIZE * 4)
  const rects = new Map<string, WeatherRect>()
  const facades = spec.facades.filter(f => f.render)
  // each facade's own height range: its wall from foot to head, a gable to its ridge
  const range = (f: Facade): [number, number] => {
    const wall = spec.walls.find(w => w.facade_id === f.id && w.render)
    const base = wall?.base_m ?? 0, top = wall ? wall.base_m + wall.height_m : 7.7
    return [base - .3, (f as Facade & { gable_segment?: string }).gable_segment ? 14 : top + .4]
  }
  const sized = facades.map(f => { const [lo, hi] = range(f); return { f, lo, w: Math.ceil(f.length_m * WEATHER_TEXELS_PER_M) + PAD * 2, h: Math.ceil((hi - lo) * WEATHER_TEXELS_PER_M) + PAD * 2 } })
  let x = 0, y = 0, shelf = 0
  for (const { f, lo, w, h } of sized.sort((a, b) => b.h - a.h || b.w - a.w)) {
    if (x + w > SIZE) { x = 0; y += shelf; shelf = 0 }
    if (y + h > SIZE) continue
    rects.set(f.id, { facade: f.id, x0: x + PAD, y0: y + PAD, width: w - PAD * 2, height: h - PAD * 2, length: f.length_m, bottom: lo })
    x += w; shelf = Math.max(shelf, h)
  }
  let texels = 0
  for (const f of facades) {
    const r = rects.get(f.id); if (!r) continue
    const wall = spec.walls.find(w => w.facade_id === f.id && w.render)
    const base = wall?.base_m ?? 0, top = wall ? wall.base_m + wall.height_m : 7.7
    const dx = (f.to[0] - f.from[0]) / f.length_m, dy = (f.to[1] - f.from[1]) / f.length_m
    // outward normal's compass bearing; a face within 70 degrees of north
    // stays damp enough for lichen
    const bearing = (Math.atan2(dy, -dx) * 180 / Math.PI + 360) % 360
    const northness = Math.max(0, Math.cos((bearing) * Math.PI / 180))
    const tuffeau = f.pattern.field === 'tuffeau'
    const sills = f.openings.filter(o => o.render && o.type !== 'door' && o.type !== 'gate' && o.type !== 'open-arcade' && o.type !== 'blind-recess')
    const seed = rand(f.from[0], f.from[1]) * 100
    // THE SUNLIT GROUND EACH PLACE SEES, on a half-metre grid: it is the
    // warm light a wall in shade takes from the court in front of it.
    const out: V2 = [dy, -dx], alongDir: V2 = [dx, dy], GRID = .5
    const gu = Math.ceil(f.length_m / GRID) + 1, gz = Math.ceil(r.height / WEATHER_TEXELS_PER_M / GRID) + 1
    const bounceGrid = new Float32Array(gu * gz)
    for (let a = 0; a < gu; a++) for (let b = 0; b < gz; b++) {
      const u = Math.min(f.length_m, a * GRID), z = r.bottom + b * GRID
      bounceGrid[b * gu + a] = groundSeen(f.from[0] + dx * u + out[0] * .03, f.from[1] + dy * u + out[1] * .03, z, out, alongDir)
    }
    const bounceAt = (u: number, z: number): number => {
      const x = Math.min(gu - 1.001, Math.max(0, u / GRID)), y = Math.min(gz - 1.001, Math.max(0, (z - r.bottom) / GRID))
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0
      const v = (i: number, j: number): number => bounceGrid[j * gu + i]!
      return (v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx) * (1 - fy) + (v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx) * fy
    }
    // per column: the sills whose water can reach it, its own wander, and
    // the ground its foot actually stands in (a wall's base can lie metres
    // below the court it rises from)
    const columns = Array.from({ length: r.width + PAD * 2 }, (_, c) => {
      const u = Math.min(f.length_m, Math.max(0, (c - PAD + .5) / WEATHER_TEXELS_PER_M))
      const ground = Math.max(base, groundHeight(f.from[0] + dx * u + out[0] * .08, f.from[1] + dy * u + out[1] * .08))
      return {
        u, ground, reach: 1.1 + .5 * noise(u * 3, 1, seed), course: .6 + .4 * noise(u * 6, 2, seed), dampEdge: .35 + .5 * fbm(u * .8, 0, seed),
        sills: sills.filter(o => u > o.from_m - .45 && u < o.from_m + o.width_m + .45).map(o => {
          const x0 = o.from_m - .2, x1 = o.from_m + o.width_m + .2, mid = o.from_m + o.width_m / 2
          const ends = Math.exp(-(((u - x0) / .09) ** 2)) + Math.exp(-(((u - x1) / .09) ** 2))
          // a mullion's foot gathers the water of two lights into one run
          const mullion = o.width_m > 1 ? .8 * Math.exp(-(((u - mid) / .06) ** 2)) : 0
          const curtain = u > x0 && u < x1 ? .42 + .34 * noise(u * 9, 0, seed + o.from_m) : 0
          return { sill: o.base_m - .16, weight: ends * .95 + mullion + curtain }
        }),
      }
    })
    for (let j = -PAD; j < r.height + PAD; j++) for (let i = -PAD; i < r.width + PAD; i++) {
      const col = columns[i + PAD]!, u = col.u
      const z = r.bottom + (Math.min(r.height - 1, Math.max(0, j)) + .5) / WEATHER_TEXELS_PER_M
      // RAIN OFF THE SILLS: the two ends shed most, a thin curtain drips
      // off the front, and both fade over a metre and a half of wall.
      let streak = 0
      for (const s of col.sills) {
        const drop = s.sill - z
        if (drop < 0 || drop > 3.2) continue
        streak += s.weight * Math.exp(-drop / col.reach) * Math.min(1, drop / .04)
      }
      // under the plinth course and the eaves course, a curtain of runs
      for (const course of [.69, top - .12]) {
        const drop = course - .09 - z
        if (drop > 0 && drop < 1.6) streak += (course < 1 ? .34 : .20) * Math.exp(-drop / .55) * col.course * (.55 + .9 * noise(u * 11, 5, seed))
      }
      // the wall head under the eaves stays dry, the drip line below it not
      const eave = top - z
      if (eave > 0 && eave < .5) streak += .18 * (1 - eave / .5)
      // THE FOOT, measured from the ground it stands in: rising damp to a
      // wandering tide line (the channel crosses one half there), splash in
      // the lowest part of it, and grime tailing off above to about 1.6 m.
      const foot = z - col.ground
      const edge = col.dampEdge + .06 * (noise(u * 9, z * 4, seed + 9) - .5)
      const damp = foot <= 0 ? 1 : foot < edge ? 1 - .45 * foot / edge : .17 * (1 - smooth(edge, edge + .05, foot)) + .38 * (1 - smooth(edge, 1.6, foot))
      // LICHEN: patches where a face looks north, most on dressed stone
      // and toward the wall head, never a sheet
      const patch = fbm(u * 1.3, z * 1.3, seed + 3)
      const lichen = northness * (tuffeau ? 1 : .35) * Math.max(0, patch - .52) * 3.2 * (.55 + .45 * Math.min(1, (z - base) / Math.max(1, top - base)))
      const k = ((r.y0 + j) * SIZE + (r.x0 + i)) * 4
      data[k] = Math.round(Math.min(1, streak) * 255)
      data[k + 1] = Math.round(Math.min(1, damp) * 255)
      data[k + 2] = Math.round(Math.min(1, lichen) * 255)
      data[k + 3] = Math.round(Math.min(1, bounceAt(u, z) * 2) * 255)
      texels++
    }
  }
  const texture = new DataTexture(data, SIZE, SIZE, RGBAFormat, UnsignedByteType)
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping
  texture.magFilter = LinearFilter; texture.minFilter = LinearMipmapLinearFilter; texture.generateMipmaps = true
  texture.needsUpdate = true
  texture.name = 'vinci/house-weather'
  atlas = { texture, rects, texels, bakeMs: typeof performance !== 'undefined' ? Math.round(performance.now() - began) : 0 }
  return atlas
}
function smooth(e0: number, e1: number, x: number): number { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }

/** Atlas coordinates of a place on a facade, (0..1, 0..1). */
export function weatherUV(facade: string, along: number, z: number): V2 | null {
  const r = weatherAtlas().rects.get(facade)
  if (!r) return null
  const i = Math.min(r.width, Math.max(0, along * WEATHER_TEXELS_PER_M)), j = Math.min(r.height, Math.max(0, (z - r.bottom) * WEATHER_TEXELS_PER_M))
  return [(r.x0 + i) / SIZE, (r.y0 + j) / SIZE]
}

export const houseWeatherProvenance = {
  class: 'GENERATED',
  recipe: 'One 1024 square map at 16 texels a metre over every rendered facade, baked in code from the registered openings and courses: rain streaks off both ends of every sill and a curtain off its front, fading over 1.1 to 1.6 m; a curtain of runs under the plinth and eaves courses; the foot measured from the ground each wall stands in, rising damp to a wandering tide line 0.35 to 0.85 m up, splash below it and grime tailing off to about 1.6 m; lichen in patches on faces within 70 degrees of north, most on dressed stone and toward the wall head; a broad grime field. Channels: streak, damp, lichen, grime. Assumed weathering of a kept house forty-six years old, not a survey.',
} as const
