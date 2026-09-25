/** THE HOUR'S SKY AS THE WING'S PROBE. The stack's baked probe is a band of
 * two colours, the same all round, so every face in the shade took the same
 * fill whichever way it looked and a shaded facade read as a card. A clear
 * sky at a low sun is brightest round the sun and along the horizon and
 * deepest a quarter turn from it: here its luminance follows the CIE clear
 * sky (ISO 15469 type 12) from the hour's own sun, its colour runs from the
 * zenith's blue to the horizon's haze and warms toward the sun, and its
 * level is held to the old probe's light on an open horizontal face, so the
 * court's floor and the roofs keep their fill and only its direction moves.
 * The ground below the horizon is the old probe's ground.
 *
 * The layout is `bakeSky`'s (x the azimuth from north, clockwise seen from
 * above), so the wing's quarter turn of the environment still holds.
 */
import { Color, DataTexture, EquirectangularReflectionMapping, FloatType, LinearFilter, LinearSRGBColorSpace, RGBAFormat } from 'three/webgpu'

export interface ClearSkyRecipe {
  zenith: string
  horizon: string
  ground: string
  sun: { azimuth: number; elevation: number; colour: string }
}

const W = 256, H = 128
/** CIE clear sky, standard coefficients (type 12) with the circumsolar
 * gradation held to a third: the peak within a few degrees of the disc
 * travels with the key and its shadow, not with an unshadowed probe. */
const A = -1, B = -.32, C = 10 / 3, D = -3, E = .45

const gradation = (z: number): number => 1 + A * Math.exp(B / Math.max(.02, Math.cos(z)))
const indicatrix = (chi: number): number => 1 + C * (Math.exp(D * chi) - Math.exp(D * Math.PI / 2)) + E * Math.cos(chi) ** 2
const linear = (hex: string): [number, number, number] => { const c = new Color(hex); return [c.r, c.g, c.b] }
const lum = (c: readonly number[]): number => .2126 * c[0]! + .7152 * c[1]! + .0722 * c[2]!
const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/** The old probe's sky, as `bakeSky` paints it: the zenith colour down to
 * about fourteen degrees, then a ramp in sRGB to the horizon colour. */
function bandSky(el: number, zenith: string, horizon: string): [number, number, number] {
  const t = Math.min(1, Math.max(0, 1 - el / (Math.PI * .08)))
  const a = new Color(zenith), b = new Color(horizon)
  const c = a.clone().convertLinearToSRGB().lerp(b.clone().convertLinearToSRGB(), t).convertSRGBToLinear()
  return [c.r, c.g, c.b]
}

export interface ClearSkyProbe { texture: DataTexture; openHorizontal: number; verticalBySunAngle: number[] }

export function bakeClearSkyProbe(r: ClearSkyRecipe): ClearSkyProbe {
  const az = r.sun.azimuth * Math.PI / 180, el = r.sun.elevation * Math.PI / 180
  const sun = [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)] as const
  const zenithC = linear(r.zenith), horizonC = linear(r.horizon), sunC = linear(r.sun.colour), groundC = linear(r.ground)
  const chroma = (c: readonly number[]): number[] => { const l = Math.max(1e-4, lum(c)); return c.map(v => v / l) }
  const zc = chroma(zenithC), hc = chroma(horizonC), sc = chroma(sunC)
  const norm = indicatrix(Math.PI / 2 - el) * gradation(0)
  const data = new Float32Array(W * H * 4)
  const dirs: [number, number, number][] = [], weights: number[] = []
  // luminance and colour, before the level is set
  for (let j = 0; j < H; j++) {
    const e = -Math.PI / 2 + (j + .5) / H * Math.PI
    for (let i = 0; i < W; i++) {
      const a = (i + .5) / W * Math.PI * 2
      const d: [number, number, number] = [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)]
      const k = (j * W + i) * 4
      dirs.push(d); weights.push(Math.cos(e) * (Math.PI / H) * (2 * Math.PI / W))
      if (e <= 0) { data[k] = groundC[0]; data[k + 1] = groundC[1]; data[k + 2] = groundC[2]; data[k + 3] = -1; continue }
      const chi = Math.acos(Math.min(1, Math.max(-1, d[0] * sun[0] + d[1] * sun[1] + d[2] * sun[2])))
      const L = indicatrix(chi) * gradation(Math.PI / 2 - e) / norm
      const toHorizon = Math.exp(-e / .22), toSun = Math.exp(-chi / .55)
      const c = zc.map((z, n) => ((z * (1 - toHorizon) + hc[n]! * toHorizon) * (1 - .55 * toSun) + sc[n]! * .55 * toSun) * L)
      data[k] = c[0]!; data[k + 1] = c[1]!; data[k + 2] = c[2]!; data[k + 3] = 1
    }
  }
  // the level: the old band's light on an open horizontal face
  let oldUp = 0, newUp = 0
  for (let p = 0; p < dirs.length; p++) {
    const d = dirs[p]!; if (d[2] <= 0) continue
    const e = Math.asin(d[2]), w = weights[p]! * d[2]
    oldUp += lum(bandSky(e, r.zenith, r.horizon)) * w
    newUp += lum([data[p * 4]!, data[p * 4 + 1]!, data[p * 4 + 2]!]) * w
  }
  const level = oldUp / Math.max(1e-6, newUp)
  for (let p = 0; p < dirs.length; p++) {
    const k = p * 4
    if (data[k + 3]! > 0) { data[k] = data[k]! * level; data[k + 1] = data[k + 1]! * level; data[k + 2] = data[k + 2]! * level }
    data[k + 3] = 1
  }
  // a vertical face's light by its azimuth off the sun, every 45 degrees
  const verticalBySunAngle = [0, 45, 90, 135, 180].map(off => {
    const fa = az + off * Math.PI / 180, n = [Math.sin(fa), Math.cos(fa), 0]
    let s = 0
    for (let p = 0; p < dirs.length; p++) { const d = dirs[p]!, c = d[0] * n[0]! + d[1] * n[1]!; if (c > 0) s += lum([data[p * 4]!, data[p * 4 + 1]!, data[p * 4 + 2]!]) * c * weights[p]! }
    return s
  })
  const texture = new DataTexture(data, W, H, RGBAFormat, FloatType)
  texture.mapping = EquirectangularReflectionMapping
  texture.colorSpace = LinearSRGBColorSpace
  texture.magFilter = texture.minFilter = LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  texture.name = 'vinci/clear-sky-probe'
  return { texture, openHorizontal: oldUp, verticalBySunAngle }
}

export const clearSkyProbeProvenance = {
  class: 'GENERATED',
  recipe: 'The wing\'s irradiance probe: the CIE clear sky (ISO 15469 type 12: gradation a -1, b -0.32; indicatrix c 10 held to a third, d -3, e 0.45) from the hour\'s sun, coloured from the rig\'s zenith to its horizon and warmed toward the sun, levelled to the stack\'s two-colour band on an open horizontal face; below the horizon the rig\'s ground. 256 by 128, linear. Engine term.',
} as const
