/** The low sun on the house's own dressings: what each quoin, jamb, sill and
 * course throws across the face it stands on. The shell casts its shadow
 * through a structural double that carries none of them, and a four
 * centimetre map texel on a face the sun rakes at five degrees could not
 * hold them anyway: here each face's shadows are traced once in its own
 * frame, where a sill is a box and the sun a direction.
 *
 * A texel stores H, the height off the wall plane below which a point there
 * lies in some dressing's shadow; a surface at `out` metres off its facade
 * is lit where out >= H. The house's own faces read the map; the film's
 * geometry casts these shadows itself.
 */
import { ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter, RedFormat, UnsignedByteType } from 'three/webgpu'
import raw from './data/closluce.json?raw'
import { hourKey } from './site'
import { WEATHER_TEXELS_PER_M, weatherAtlas } from './house-weather'

type V2 = [number, number]
interface Facade { id: string; from: V2; to: V2; length_m: number; render: boolean; gable_segment?: string }
interface Wall { facade_id?: string; base_m: number; height_m: number; render: boolean }
function values(x: unknown): unknown {
  if (!x || typeof x !== 'object') return x
  if ('value' in x) return (x as { value: unknown }).value
  if (Array.isArray(x)) return x.map(values)
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, values(v)]))
}
const spec = values(JSON.parse(raw)) as { facades: Facade[]; walls: Wall[] }

/** A dressing in its facade's frame: along, height, and how far its face
 * stands out of the wall plane. Its body runs back into the wall. */
export interface DressingBox { facade: string; u0: number; u1: number; z0: number; z1: number; front: number }

/** 21 mm texels: about the sun's own penumbra a metre from its caster. */
export const DRESSING_TEXELS_PER_M = 48
const SIZE = 2048, PAD = 2
/** H is stored over this range; the floor means no dressing reaches. */
export const DRESSING_H_MIN = -.06, DRESSING_H_SPAN = .36

const SUN_AZ = hourKey.sun_azimuth_deg.value * Math.PI / 180, SUN_EL = hourKey.sun_elevation_deg.value * Math.PI / 180
const SUN_E = Math.sin(SUN_AZ) * Math.cos(SUN_EL), SUN_N = Math.cos(SUN_AZ) * Math.cos(SUN_EL), SUN_Z = Math.sin(SUN_EL)

interface Rect { facade: string; x0: number; y0: number; width: number; height: number; bottom: number; su: number; sz: number; sn: number }
interface DressingAtlas { texture: DataTexture; rects: Map<string, Rect>; boxes: number; bakeMs: number }
let atlas: DressingAtlas | null = null

/** One rect per facade the sun reaches, shelf-packed; the map starts with
 * no dressing anywhere, and the shell fills it once it has laid them. */
export function dressingAtlas(): DressingAtlas {
  if (atlas) return atlas
  const data = new Uint8Array(SIZE * SIZE)
  const rects = new Map<string, Rect>()
  const faces = spec.facades.filter(f => f.render).flatMap(f => {
    const dx = (f.to[0] - f.from[0]) / f.length_m, dy = (f.to[1] - f.from[1]) / f.length_m
    const sn = SUN_E * dy - SUN_N * dx
    // a face turned from the sun, or taking it within a degree of edge-on,
    // has no dressing shadow worth a texel
    if (sn < .02) return []
    const wall = spec.walls.find(w => w.facade_id === f.id && w.render)
    const base = wall?.base_m ?? 0, top = wall ? wall.base_m + wall.height_m : 7.7
    const lo = base - .3, hi = f.gable_segment ? 14 : top + .4
    return [{ f, lo, su: SUN_E * dx + SUN_N * dy, sn, w: Math.ceil(f.length_m * DRESSING_TEXELS_PER_M) + PAD * 2, h: Math.ceil((hi - lo) * DRESSING_TEXELS_PER_M) + PAD * 2 }]
  })
  let x = 0, y = 0, shelf = 0
  for (const { f, lo, su, sn, w, h } of faces.sort((a, b) => b.h - a.h || b.w - a.w)) {
    if (x + w > SIZE) { x = 0; y += shelf; shelf = 0 }
    if (y + h > SIZE) continue
    rects.set(f.id, { facade: f.id, x0: x + PAD, y0: y + PAD, width: w - PAD * 2, height: h - PAD * 2, bottom: lo, su, sz: SUN_Z, sn })
    x += w; shelf = Math.max(shelf, h)
  }
  const texture = new DataTexture(data, SIZE, SIZE, RedFormat, UnsignedByteType)
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping
  texture.magFilter = LinearFilter; texture.minFilter = LinearMipmapLinearFilter; texture.generateMipmaps = true
  texture.needsUpdate = true
  texture.name = 'vinci/house-sun'
  atlas = { texture, rects, boxes: 0, bakeMs: 0 }
  return atlas
}

/** Atlas coordinates of a place on a facade, or null where no map reaches. */
export function dressingUV(facade: string, along: number, z: number): V2 | null {
  const r = dressingAtlas().rects.get(facade)
  if (!r) return null
  const i = Math.min(r.width, Math.max(0, along * DRESSING_TEXELS_PER_M)), j = Math.min(r.height, Math.max(0, (z - r.bottom) * DRESSING_TEXELS_PER_M))
  return [(r.x0 + i) / SIZE, (r.y0 + j) / SIZE]
}

/** Trace every dressing's shadow into its facade's rect. A point p is shaded
 * by a box when the ray toward the sun, climbing out of the wall at sn per
 * metre, enters the box's outline before it has climbed past the box's
 * face: H = front - climb at entry, the largest over all boxes. */
export function bakeDressingShadows(boxes: readonly DressingBox[]): void {
  const a = dressingAtlas()
  const began = typeof performance !== 'undefined' ? performance.now() : 0
  const data = a.texture.image.data as Uint8Array
  data.fill(0)
  const byFacade = new Map<string, DressingBox[]>()
  for (const b of boxes) { const list = byFacade.get(b.facade); if (list) list.push(b); else byFacade.set(b.facade, [b]) }
  let used = 0
  for (const [id, list] of byFacade) {
    const r = a.rects.get(id); if (!r) continue
    const W = r.width + PAD * 2, Hh = r.height + PAD * 2
    const field = new Float32Array(W * Hh).fill(DRESSING_H_MIN)
    // along the wall per metre climbed out of it
    const du = r.su / r.sn, dz = r.sz / r.sn
    for (const b of list) {
      used++
      const reach = b.front - DRESSING_H_MIN
      const umin = Math.min(b.u0, b.u0 - du * reach), umax = Math.max(b.u1, b.u1 - du * reach)
      const zmin = Math.min(b.z0, b.z0 - dz * reach), zmax = Math.max(b.z1, b.z1 - dz * reach)
      const i0 = Math.max(0, Math.floor(umin * DRESSING_TEXELS_PER_M) + PAD), i1 = Math.min(W - 1, Math.ceil(umax * DRESSING_TEXELS_PER_M) + PAD)
      const j0 = Math.max(0, Math.floor((zmin - r.bottom) * DRESSING_TEXELS_PER_M) + PAD), j1 = Math.min(Hh - 1, Math.ceil((zmax - r.bottom) * DRESSING_TEXELS_PER_M) + PAD)
      for (let j = j0; j <= j1; j++) {
        const z = r.bottom + (Math.min(r.height - 1, Math.max(0, j - PAD)) + .5) / DRESSING_TEXELS_PER_M
        // the climb over which the ray lies within the box's height band
        let zin = 0, zout = Infinity
        if (Math.abs(dz) < 1e-9) { if (z < b.z0 || z > b.z1) continue }
        else { const p = (b.z0 - z) / dz, q = (b.z1 - z) / dz; zin = Math.min(p, q); zout = Math.max(p, q) }
        // only the columns this row's climb band can reach
        const ha = Math.max(0, zin), hb = Math.min(zout, reach)
        if (ha > hb) continue
        const ua = b.u0 - Math.max(du * ha, du * hb), ub = b.u1 - Math.min(du * ha, du * hb)
        const c0 = Math.max(i0, Math.floor(ua * DRESSING_TEXELS_PER_M) + PAD - 1), c1 = Math.min(i1, Math.ceil(ub * DRESSING_TEXELS_PER_M) + PAD + 1)
        for (let i = c0; i <= c1; i++) {
          const u = (Math.min(r.width - 1, Math.max(0, i - PAD)) + .5) / DRESSING_TEXELS_PER_M
          let uin = 0, uout = Infinity
          if (Math.abs(du) < 1e-9) { if (u < b.u0 || u > b.u1) continue }
          else { const p = (b.u0 - u) / du, q = (b.u1 - u) / du; uin = Math.min(p, q); uout = Math.max(p, q) }
          const enter = Math.max(0, zin, uin), leave = Math.min(zout, uout)
          if (enter > leave) continue
          const h = b.front - enter
          const k = j * W + i
          if (h > field[k]!) field[k] = h
        }
      }
    }
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const v = (field[j * W + i]! - DRESSING_H_MIN) / DRESSING_H_SPAN
      data[(r.y0 - PAD + j) * SIZE + (r.x0 - PAD + i)] = Math.round(Math.min(1, Math.max(0, v)) * 255)
    }
  }
  a.boxes = used
  a.bakeMs = typeof performance !== 'undefined' ? Math.round(performance.now() - began) : 0
  a.texture.needsUpdate = true
}

/** THE SKY UNDER A SILL. In the shade a face is lit by the sky, and every
 * dressing standing proud of it takes a share of that sky from the wall
 * beside and below it: a soft band under each sill, course and head, a
 * narrower one beside each jamb and quoin. Kept at twice the weather map's
 * texels in the weather map's own layout, so the weather coordinates read it.
 */
const SKY_SCALE = 2, SKY_SIZE = 1024 * SKY_SCALE, SKY_PAD = 2 * SKY_SCALE
let sky: DataTexture | null = null
export function dressingSky(): DataTexture {
  if (sky) return sky
  const t = new DataTexture(new Uint8Array(SKY_SIZE * SKY_SIZE).fill(255), SKY_SIZE, SKY_SIZE, RedFormat, UnsignedByteType)
  t.wrapS = t.wrapT = ClampToEdgeWrapping
  t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter; t.generateMipmaps = true
  t.needsUpdate = true
  t.name = 'vinci/house-sky'
  return (sky = t)
}

/** A projection d deep, a metres above a point on the wall, hides the upper
 * sky above the elevation atan(a/d): of the sky's upper quarter it takes
 * 1 - a/hypot(a,d). A jamb s metres to one side takes half that of one side.
 * The upper sky carries most of a shaded face's light; the ground the rest. */
export function bakeDressingSky(boxes: readonly DressingBox[]): void {
  const t = dressingSky(), data = t.image.data as Uint8Array
  data.fill(255)
  const rects = weatherAtlas().rects, tpm = WEATHER_TEXELS_PER_M * SKY_SCALE
  const byFacade = new Map<string, DressingBox[]>()
  for (const b of boxes) { const list = byFacade.get(b.facade); if (list) list.push(b); else byFacade.set(b.facade, [b]) }
  for (const [id, list] of byFacade) {
    const r = rects.get(id); if (!r) continue
    const x0 = r.x0 * SKY_SCALE, y0 = r.y0 * SKY_SCALE, width = r.width * SKY_SCALE, height = r.height * SKY_SCALE
    const W = width + SKY_PAD * 2, H = height + SKY_PAD * 2
    const occ = new Float32Array(W * H)
    for (const b of list) {
      const d = b.front
      const reach = 4.5 * d
      const i0 = Math.max(0, Math.floor((b.u0 - reach) * tpm) + SKY_PAD), i1 = Math.min(W - 1, Math.ceil((b.u1 + reach) * tpm) + SKY_PAD)
      const j0 = Math.max(0, Math.floor((b.z0 - reach - r.bottom) * tpm) + SKY_PAD), j1 = Math.min(H - 1, Math.ceil((b.z1 - r.bottom) * tpm) + SKY_PAD)
      for (let j = j0; j <= j1; j++) {
        const z = r.bottom + (Math.min(height - 1, Math.max(0, j - SKY_PAD)) + .5) / tpm
        for (let i = i0; i <= i1; i++) {
          const u = (Math.min(width - 1, Math.max(0, i - SKY_PAD)) + .5) / tpm
          const s = Math.max(0, b.u0 - u, u - b.u1)
          let o = 0
          if (z < b.z0) {
            const a = b.z0 - z, up = 1 - a / Math.hypot(a, d)
            o = .6 * up * Math.max(0, 1 - s / (1.5 * d))
          } else if (s > 0) {
            const side = .5 * (1 - s / Math.hypot(s, d))
            o = .25 * side
          }
          const k = j * W + i
          if (o > occ[k]!) occ[k] = o
        }
      }
    }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++)
      data[(y0 - SKY_PAD + j) * SKY_SIZE + (x0 - SKY_PAD + i)] = Math.round((1 - Math.min(.7, occ[j * W + i]!)) * 255)
  }
  t.needsUpdate = true
}

export const houseSunProvenance = {
  class: 'GENERATED',
  recipe: 'The shadows the house\'s own dressings throw across the faces the sun reaches at the hour (azimuth and elevation from the light rig): every quoin, window jamb and head, rusticated jamb stone, sill, plinth and eaves course, gable step and coping as laid by the shell, each traced in its facade\'s frame as a box standing out of the wall plane, into one 2048 square map at 48 texels a metre. A texel holds the height off the wall below which it lies in shadow, so a face standing proud of the wall (a quoin, a sill\'s front) takes the shadows that reach it and not its own. In the shade, the share of the upper sky each dressing hides from the wall below and beside it, from its depth and distance, in a second map at 32 texels a metre over every facade. Engine terms; the film\'s geometry casts and occludes for itself.',
} as const
