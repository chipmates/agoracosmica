/** THE NIGHT OVER THE GRAVE: the sky that stood over Clos Lucé at nine that
 * evening, drawn with the lobby's star craft on the lobby's lapis.
 *
 * The stars are the Yale Bright Star Catalogue carried to 21:00 local apparent
 * time on 10 October 1517 (`farewell-night-stars.ts`, written by
 * `forge/night/real-sky.mjs`), held at that moment while the evening darkens:
 * a turning sky would carry them thirty degrees through the clip and read as
 * the camera swimming. No moon and no planet stood above the walls then.
 *
 * Four things hang at the eye, all fog-free, depth-tested and writing no
 * depth, inside the dome and outside every crown and roof, so the court's
 * walls and trees cut them as they cut the day's sky:
 *   the night shell   the lobby's lapis over the dome wherever sky shows, and
 *                     the Milky Way in the same fragment, drawn after the
 *                     real one along its true course
 *   the sky's grain   a faint multiply over dome and shell from the first
 *                     dusk on, coarse enough that the film's encoder keeps it
 *   the stars         one instanced sprite, the lobby's profile, colour,
 *                     twinkle and glints, each star at its catalogue place
 *   a shooting star   the museum's own, on a fixed almanac in the held night
 *
 * The wing's print has no bloom and opens the night eightfold, so every level
 * here is authored at the print (after its exposure, before its lift and toe)
 * and divided by the opening the evening hands in; the glow of a star is its
 * own skirt and halo.
 */
import { AdditiveBlending, BackSide, ClampToEdgeWrapping, Color, DataTexture, Group, InstancedBufferAttribute, LinearFilter, Mesh, MeshBasicNodeMaterial, MultiplyBlending, NormalBlending, PointsNodeMaterial, RedFormat, SphereGeometry, Sprite, UnsignedByteType, Vector3 } from 'three/webgpu'
import { abs, asin, atan, clamp, dot, exp, float, instancedBufferAttribute, length, max, min, mix, mx_noise_float, mx_noise_vec3, normalize, oneMinus, positionLocal, pow, screenDPR, sin, smoothstep, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { FAREWELL_METEOR, along } from './farewell'
import { NIGHT_GALACTIC, NIGHT_STARS, NIGHT_STARS_STRIDE } from './farewell-night-stars'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const TAU = Math.PI * 2
const DEG = 180 / Math.PI
/** the stars, the shooting star and the shell, all inside the dome (1800 m) */
const STAR_RADIUS = 600, METEOR_RADIUS = 590, GRAIN_RADIUS = 650, SHELL_RADIUS = 700

/* THE LOBBY'S TEMPERATURE RAMP AND ITS SCOTOPIC LAW (core/firmament.ts),
   copied so the lobby never enters the evening's key. */
const STAR_HOT = new Color('#c2d6ff'), STAR_PALE = new Color('#dce7ff'), STAR_SUN = new Color('#fff2dc'), STAR_EMBER = new Color('#ffcda0')
function temperature(u: number): Color {
  if (u < 0.58) return STAR_HOT.clone().lerp(STAR_PALE, u / 0.58)
  if (u < 0.88) return STAR_PALE.clone().lerp(STAR_SUN, (u - 0.58) / 0.3)
  return STAR_SUN.clone().lerp(STAR_EMBER, (u - 0.88) / 0.12)
}
function scotopic(c: Color, keep: number): Color {
  const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722, k = Math.min(1, Math.max(0, keep))
  return new Color(c.r * k + l * (1 - k), c.g * k + l * (1 - k), c.b * k + l * (1 - k))
}
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))
const ease = (a: number, b: number, x: number): number => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
/** A star's colour index on the ramp: B-V to a temperature (Ballesteros 2012),
 * then by mired to the ramp's stops (a hot B star at 0, F0 at 0.58, the Sun at
 * 0.88, a K5 giant at 1). A star the catalogue gives no index sits mid-ramp. */
function rampOf(bv: number): number {
  if (!Number.isFinite(bv)) return 0.58
  const x = 0.92 * bv, kelvin = 4600 * (1 / (x + 1.7) + 1 / (x + 0.62)), mired = 1e6 / kelvin
  if (mired < 137) return 0.58 * clamp01((mired - 33) / 104)
  if (mired < 172) return 0.58 + 0.3 * (mired - 137) / 35
  return 0.88 + 0.12 * clamp01((mired - 172) / 78)
}
/** a deterministic hash of a catalogue number, 0..1 */
const hash1 = (n: number): number => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }

/** THE STARS' SCALE IS THE FRAME'S: a star spans the same share of the picture's height at every stage.
 * The film draws its 1920 x 1080 at one device pixel per CSS pixel, the look test the same picture at 1.5,
 * so a size in CSS pixels printed the film's stars at two thirds of the look test's. */
function frameScale(): number {
  if (typeof window === 'undefined') return 1
  return Math.max(0.5, Math.min(3, (window.innerHeight || 720) / 720))
}

/* THE NIGHT'S COLOURS AT THE PRINT, measured on the grave's frames against
   the lobby's own look up. The print lifts its black a cool (9, 10, 13); the
   shell's red and a little green go under zero (the scene's buffer is half
   float) so the zenith prints near the lobby's depth, still blue. */
const HORIZON_P = [-0.001, 0.007, 0.075] as const
const LAPIS_P = [-0.002, 0.003, 0.055] as const
const ABYSS_P = [-0.003, 0.0, 0.043] as const
/** the Milky Way's light at its brightest clump, and its colour: a warm grey pulled to silver */
const RIVER_P = 0.04
const RIVER_TINT = [0.93, 0.97, 1.05] as const

/** mulberry32: a small seeded generator, so the band and its grain are the same in every run */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** a smooth seeded value noise in the plane, -1..1 */
function lattice(seed: number): (x: number, y: number) => number {
  const h = (i: number, j: number): number => {
    let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 1274126177)) | 0
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return (((n ^ (n >>> 16)) >>> 0) / 4294967296) * 2 - 1
  }
  return (x, y) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
    return h(i, j) * (1 - u) * (1 - v) + h(i + 1, j) * u * (1 - v) + h(i, j + 1) * (1 - u) * v + h(i + 1, j + 1) * u * v
  }
}

/* THE MILKY WAY, BAKED ONCE over galactic longitude and latitude (a tenth of a
   degree a texel, about two pixels of the film), so the shell reads one texel
   and the grain can hug the clumps the shell shows. The course and the dark
   clouds are placed from the Dutra and Bica (2002) catalogue of dark clouds;
   the clumps are drawn, star clouds made of seeded cloudlets at three sizes. */
const BAND_L0 = 15, BAND_L1 = 125, BAND_B = 11, BAND_STEP = 0.1
const BAND_W = Math.round((BAND_L1 - BAND_L0) / BAND_STEP) + 1, BAND_H = Math.round((2 * BAND_B) / BAND_STEP) + 1
interface Band { data: Float32Array; at(l: number, b: number): number }
export function bakeBand(): Band {
  const rand = seeded(1452)
  const gauss = (): number => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-9))) * Math.cos(TAU * rand())
  const fold1 = lattice(11), fold2 = lattice(23)
  const fold = (l: number, b: number): number => fold1(l / 9, b / 9) * 0.62 + fold2(l / 4, b / 4) * 0.38
  // the band's course and body: a Gaussian across it, brightest through Cygnus, fading toward Cassiopeia;
  // the ends of the baked range fade out, so the texture's clamp adds nothing
  const centre = (l: number): number => 0.8 - 1.2 * ease(88, 120, l)
  const width = (l: number): number => 4.2 - 1.4 * ease(88, 118, l)
  const along = (l: number): number => (0.4 + 0.6 * ease(122, 86, l)) * (0.8 + 0.2 * ease(40, 58, l)) * ease(BAND_L0, BAND_L0 + 5, l) * ease(BAND_L1, BAND_L1 - 5, l)
  const body = (l: number, b: number, f: number): number => {
    const bank = b - centre(l) + f * 1.1, w = width(l)
    return Math.exp(-(bank * bank) / (2 * w * w)) * along(l)
  }
  // the dark clouds after the Dutra and Bica catalogue: the Great Rift from the Northern Coalsack by Deneb
  // (LDN 906) past Sadr through LDN 841 to the Vulpecula Rift, the Coalsack itself, LDN 1003 and B144
  const pocket = (l: number, b: number, l0: number, b0: number, r: number, depth: number): number => {
    const x = (l - l0) / r, y = (b - b0) / r, q = x * x + y * y
    return q > 16 ? 1 : 1 - depth * Math.exp(-0.5 * q)
  }
  const n = BAND_W * BAND_H
  // the fold moves over four degrees and more: sampled every fifth of a degree and eased between
  const FS = 2, FW = Math.ceil((BAND_W - 1) / FS) + 2, FH = Math.ceil((BAND_H - 1) / FS) + 2
  const coarse = new Float32Array(FW * FH)
  for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) coarse[j * FW + i] = fold(BAND_L0 + i * FS * BAND_STEP, -BAND_B + j * FS * BAND_STEP)
  // THE CLUMPS: cloudlets strewn where the body is bright, at three sizes, each layer brought to a mean of one
  // in the band's core; their product is the mottle of unresolved stars, never a swirl
  const smooth = new Float32Array(n), folds = new Float32Array(n)
  const centreC = new Float32Array(BAND_W), widthC = new Float32Array(BAND_W), alongC = new Float32Array(BAND_W)
  for (let i = 0; i < BAND_W; i++) { const l = BAND_L0 + i * BAND_STEP; centreC[i] = centre(l); widthC[i] = -0.5 / (width(l) ** 2); alongC[i] = along(l) }
  let coreCount = 0
  for (let j = 0; j < BAND_H; j++) {
    const b = -BAND_B + j * BAND_STEP, fj = Math.floor(j / FS), v = (j % FS) / FS
    for (let i = 0; i < BAND_W; i++) {
      const fi = Math.floor(i / FS), u = (i % FS) / FS, c = fj * FW + fi
      const f = (coarse[c]! * (1 - u) + coarse[c + 1]! * u) * (1 - v) + (coarse[c + FW]! * (1 - u) + coarse[c + FW + 1]! * u) * v
      const k = j * BAND_W + i, bank = b - centreC[i]! + f * 1.1
      folds[k] = f
      smooth[k] = Math.exp(bank * bank * widthC[i]!) * alongC[i]!
      if (smooth[k]! > 0.35) coreCount++
    }
  }
  const layer = (sigma: number, count: number): Float32Array => {
    const g = new Float32Array(n), r = Math.ceil((3 * sigma) / BAND_STEP), k = -0.5 / (sigma * sigma)
    const fall = new Float32Array(2 * r + 1)
    for (let placed = 0, tries = 0; placed < count && tries < count * 80; tries++) {
      const l = BAND_L0 + rand() * (BAND_L1 - BAND_L0), b = (rand() * 2 - 1) * BAND_B
      // strewn by the body alone: a denser strewing would lift a cloud once in every layer
      if (rand() > body(l, b, fold(l, b))) continue
      const a = Math.exp(0.3 * gauss())
      const ci = Math.round((l - BAND_L0) / BAND_STEP), cj = Math.round((b + BAND_B) / BAND_STEP)
      // the cloudlet is separable: one row of falloff across, one down
      for (let t = -r; t <= r; t++) { const dl = BAND_L0 + (ci + t) * BAND_STEP - l; fall[t + r] = Math.exp(k * dl * dl) }
      for (let j = Math.max(0, cj - r); j <= Math.min(BAND_H - 1, cj + r); j++) {
        const db = -BAND_B + j * BAND_STEP - b, down = a * Math.exp(k * db * db), row = j * BAND_W
        for (let i = Math.max(0, ci - r); i <= Math.min(BAND_W - 1, ci + r); i++) g[row + i]! += down * fall[i - ci + r]!
      }
      placed++
    }
    let mean = 0
    for (let i = 0; i < n; i++) if (smooth[i]! > 0.35) mean += g[i]!
    mean /= Math.max(1, coreCount)
    for (let i = 0; i < n; i++) g[i] = g[i]! / mean
    return g
  }
  const big = layer(0.9, 600), mid = layer(0.42, 2400), fine = layer(0.19, 8000)
  const cloudL = new Float32Array(BAND_W), riftAt = new Float32Array(BAND_W), riftDepth = new Float32Array(BAND_W), cloudB = new Float32Array(BAND_H)
  for (let i = 0; i < BAND_W; i++) {
    const l = BAND_L0 + i * BAND_STEP, cl = (l - 71.5) / 5.5
    cloudL[i] = Math.exp(-0.5 * cl * cl)
    riftAt[i] = -0.2 + 1.2 * Math.max(ease(71, 84, l), ease(71, 58, l))
    riftDepth[i] = ease(90, 83, l) * (0.55 + 0.45 * ease(48, 60, l)) * 0.92
  }
  for (let j = 0; j < BAND_H; j++) { const cb = (-BAND_B + j * BAND_STEP - 2.6) / 2.1; cloudB[j] = Math.exp(-0.5 * cb * cb) }
  const data = new Float32Array(n)
  let top = 0
  for (let k = 0; k < n; k++) {
    if (smooth[k]! < 1e-3) continue
    const i = k % BAND_W, j = Math.floor(k / BAND_W), l = BAND_L0 + i * BAND_STEP, b = -BAND_B + j * BAND_STEP
    const clumps = (0.35 + 0.65 * big[k]!) * (0.5 + 0.5 * mid[k]!) * (0.7 + 0.3 * fine[k]!)
    // the Cygnus star cloud between Sadr and Albireo; the rift, a flat-bottomed lane with a firm edge, so it
    // reads as dust and never as a thinning of the light; the Northern Coalsack, LDN 1003 and B144
    const rb = (b - riftAt[i]! - folds[k]! * 0.5) / 1.7, r2 = rb * rb
    const carve = (1 + 1.1 * cloudL[i]! * cloudB[j]!) * (1 - Math.exp(-r2 * r2) * riftDepth[i]!)
      * pocket(l, b, 81.31, 0.78, 1.6, 0.85) * pocket(l, b, 91.66, 4.18, 1.2, 0.75) * pocket(l, b, 71.41, 3.2, 1.4, 0.4)
    data[k] = smooth[k]! * carve * clumps
    if (data[k]! > top) top = data[k]!
  }
  // brought to one at the brightest few clumps rather than the single brightest texel
  const lit = Array.from(data.filter((v) => v > 0.05 * top)).sort((x, y) => x - y)
  const norm = lit[Math.floor(0.997 * (lit.length - 1))] ?? top
  for (let k = 0; k < n; k++) data[k] = Math.min(1, data[k]! / norm)
  return {
    data,
    at(l, b) {
      const x = Math.round((l - BAND_L0) / BAND_STEP), y = Math.round((b + BAND_B) / BAND_STEP)
      return x < 0 || y < 0 || x >= BAND_W || y >= BAND_H ? 0 : data[y * BAND_W + x]!
    },
  }
}
/** the band's grain: unresolved light under the catalogue's limit, strewn by the baked band */
const GRAINS = 1500
/** the least a faint star's quad spans in device pixels: its soft core then prints two pixels wide,
    which the film's 4:2:0 encoder keeps where it averaged a one-pixel core away */
const FAINT_QUAD_PX = 6.6
/** the soft skirt round the brighter stars, as a share of the core, and its reach in the star's own radii */
const SKIRT = 0.09, SKIRT_REACH = 1.5
/** the sky's grain in two sizes (frequencies over a unit direction: cells of about 3.5 and 7.5 film pixels).
    The fine one carries the dusk. Once the sky is dark and still rising, the encoder spends so little on it
    that only the coarse one survives its key frames; the night at rest needs less of it. Shares by depression. */
const GRAIN_FINE_FREQ = 300, GRAIN_COARSE_FREQ = 140
const GRAIN_FINE = [0.03, 0.052, 0.02] as const, GRAIN_COARSE = [0.08, 0.05] as const
/** the dark sky's colour grain, added in the shell at the print's scale (about a level each at the print):
    red and green sit on the print's lift there, which a multiply cannot move, and the encoder's colour
    planes otherwise settle the lapis into plateaus with a hue edge */
const GRAIN_COLOUR = [0.0012, 0.0008, 0.0015] as const
/** one over the gradient noise's own spread, so a share is the grain's standard deviation */
const GRAIN_NORM = 1 / 0.3

export interface NightState {
  /** how far the sun stands under the horizon, degrees */
  depression: number
  /** one over the print's opening, without the closing dip */
  exposure: number
  /** the sun's direction in the engine */
  sun: Vector3
}
export interface FarewellNight {
  group: Group
  uDepression: N; uLevel: N; uTime: N
  /** the evening's state, set by the evening alone */
  set(state: NightState): void
  /** the second of the wing's clock the farewell's run starts at: the shooting star falls from it */
  startAt(seconds: number): void
}

export function createFarewellNight(): FarewellNight {
  const uDepression: N = uniform(0), uLevel: N = uniform(0), uTime: N = uniform(0)
  const uExposure: N = uniform(1), uSun: N = uniform(new Vector3(0, 1, 0)), uFrame: N = uniform(frameScale())
  const group = new Group()
  group.name = 'vinci/evening-night'
  group.visible = false
  // the stack's warm walk draws a hidden body marked so, compiling its pipelines at entry in the pass the walk will use
  group.userData['naWarm'] = true

  /* ---- THE STARS, and the band's grain after them ---- */
  const band = bakeBand()
  const catalogue = NIGHT_STARS.length / NIGHT_STARS_STRIDE
  const count = catalogue + GRAINS
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count)
  const tw = new Float32Array(count * 2), hero = new Float32Array(count * 3), seen = new Float32Array(count)
  const dir = new Vector3()
  // the faint end a third brighter than the print alone would want: the film's encoder takes that much off it
  const faintLift = (V: number): number => 1 + 0.3 * ease(4.8, 5.8, V)
  for (let i = 0; i < catalogue; i++) {
    const at = i * NIGHT_STARS_STRIDE
    const azimuth = NIGHT_STARS[at]!, altitude = NIGHT_STARS[at + 1]!, V = NIGHT_STARS[at + 2]!, bv = NIGHT_STARS[at + 3]!, hr = NIGHT_STARS[at + 4]!
    along(azimuth, altitude, dir).multiplyScalar(STAR_RADIUS)
    pos[i * 3] = dir.x; pos[i * 3 + 1] = dir.y; pos[i * 3 + 2] = dir.z
    // THE MAGNITUDE LAW, tuned on the print: a shade steeper than the flux itself, since the
    // print's toe already compresses the faint end, and capped where the core would clip
    const peak = Math.min(1.3, 0.072 * Math.pow(10, 0.43 * (6 - V))) * faintLift(V)
    // the eye reads faint light without colour: the faint are silver, the bright keep their tint
    const tint = scotopic(temperature(rampOf(bv)), 0.35 + 0.65 * ease(5.5, 1, V))
    col[i * 3] = tint.r * peak; col[i * 3 + 1] = tint.g * peak; col[i * 3 + 2] = tint.b * peak
    // the lobby's footprints: a glow grows with the light to the third magnitude, then slowly
    size[i] = Math.max(3, 3.1 + 1.25 * Math.min(3, 6.5 - V) + 0.35 * Math.max(0, 3.5 - V))
    tw[i * 2] = 0.5 + hash1(hr) * 1.3; tw[i * 2 + 1] = hash1(hr + 0.5) * TAU
    // the glints: four rays and a halo for the first magnitude, rays alone to 2.15 (six at most in a frame);
    // a soft skirt for every star brighter than about the fourth magnitude, fading out by the fifth; the faint kept sharp
    hero[i * 3] = V < 1.5 ? 1 : V < 2.15 ? 0.6 : 0; hero[i * 3 + 1] = V < 1.5 ? 1 : 0; hero[i * 3 + 2] = ease(5.3, 3.9, V)
    // each comes out at its own depression of the sun, the brightest in the civil twilight
    seen[i] = 3 + 2.3 * V
  }
  // THE GRAIN: unresolved light under the catalogue's limit, strewn by the baked band's
  // own light, so it gathers in the clumps and stays out of the rift; seeded, the same every run
  const rand = seeded(1517)
  let i = catalogue
  for (let tries = 0; i < count && tries < GRAINS * 60; tries++) {
    const l = 22 + rand() * 116, b = (rand() * 2 - 1) * 12
    if (rand() > Math.pow(band.at(l, b), 0.6)) continue
    const cl = Math.cos(b / DEG)
    const gx = cl * Math.cos(l / DEG), gy = cl * Math.sin(l / DEG), gz = Math.sin(b / DEG)
    const M = NIGHT_GALACTIC
    dir.set(M[0]![0]! * gx + M[1]![0]! * gy + M[2]![0]! * gz, M[0]![1]! * gx + M[1]![1]! * gy + M[2]![1]! * gz, M[0]![2]! * gx + M[1]![2]! * gy + M[2]![2]! * gz)
    if (dir.y < 0.08) continue
    dir.normalize().multiplyScalar(STAR_RADIUS)
    pos[i * 3] = dir.x; pos[i * 3 + 1] = dir.y; pos[i * 3 + 2] = dir.z
    // the grain stays under the catalogue's faintest: it is the band's texture, not a field of its own
    const V = 6.3 + rand() * 0.8
    const peak = 0.072 * Math.pow(10, 0.43 * (6 - V))
    const tint = scotopic(temperature(rand() * 0.8), 0.12)
    col[i * 3] = tint.r * peak; col[i * 3 + 1] = tint.g * peak; col[i * 3 + 2] = tint.b * peak
    size[i] = 3
    tw[i * 2] = 0.5 + rand() * 1.3; tw[i * 2 + 1] = rand() * TAU
    seen[i] = 14.8 + rand() * 1.4
    i++
  }
  // slots the budget left empty are parked below the ground, dark: a star at the origin would normalize to NaN
  for (; i < count; i++) pos[i * 3 + 1] = -STAR_RADIUS
  const starMat = new PointsNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending })
  starMat.fog = false
  const posN: N = instancedBufferAttribute(new InstancedBufferAttribute(pos, 3))
  const colN: N = instancedBufferAttribute(new InstancedBufferAttribute(col, 3))
  const sizeN: N = instancedBufferAttribute(new InstancedBufferAttribute(size, 1))
  const twN: N = instancedBufferAttribute(new InstancedBufferAttribute(tw, 2))
  const heroN: N = instancedBufferAttribute(new InstancedBufferAttribute(hero, 3))
  const seenN: N = instancedBufferAttribute(new InstancedBufferAttribute(seen, 1))
  starMat.positionNode = posN
  starMat.sizeAttenuation = false
  // the star's own size in the frame; the quad never spans fewer device pixels than a faint core needs
  const own = sizeN.mul(uFrame)
  const appSize = max(own, max(float(FAINT_QUAD_PX).div(screenDPR), 1.4))
  // the glint's and the skirt's quads are oversized so their light has room; the core divides it back out
  const quadK = float(1).add(heroN.x.mul(1.6)).add(heroN.z.mul(SKIRT_REACH - 1))
  starMat.sizeNode = appSize.mul(quadK)
  const q = uv().sub(vec2(0.5, 0.5))
  const rs = length(q).mul(2).mul(quadK)
  const rr = min(rs, float(1))
  // THE PROFILE: a tight core in a soft skirt; too small for a sharp core, a pre-filtered soft one.
  // The wing's print has no bloom, so the soft kernel reaches further up than the lobby's. The sharpness
  // follows the star's own size: a quad widened for the film keeps its star soft.
  const sharp = smoothstep(float(2.2), float(6.5), own)
  const soft = exp(rr.mul(rr).mul(-7.5)).mul(smoothstep(1, 0.7, rr))
  const tight = pow(float(1).add(rr.mul(rr).mul(62)), -1.65).mul(1.2).add(exp(rr.mul(rr).mul(-8)).mul(0.11))
  // the brighter stars' glow, the lobby's soft disc: a faint skirt two or three pixels past the core
  const skirt = exp(rs.mul(rs).mul(-2.2)).mul(smoothstep(quadK, quadK.mul(0.8), rs)).mul(heroN.z).mul(SKIRT)
  const point = mix(soft, tight, sharp).add(skirt)
  const ray = (a: N, across: N): N => pow(smoothstep(float(0.5), float(0), a), 1.8).mul(smoothstep(float(0.05).mul(oneMinus(a.mul(1.35))).max(0.005), float(0), across))
  const glint = ray(abs(q.x), abs(q.y)).add(ray(abs(q.y), abs(q.x))).mul(0.46).mul(heroN.x)
  const halo = pow(oneMinus(min(length(q).mul(2), float(1))), 2.6).mul(0.14).mul(heroN.y)
  const starDir = normalize(posN)
  // the air: dimmer and warmer toward the horizon, and the twinkle is its own
  const airMass = smoothstep(0.3, -0.05, starDir.y)
  const extinction = mix(float(1), float(0.34), airMass)
  const air = smoothstep(0.55, -0.02, starDir.y)
  const steady = oneMinus(step(0.01, heroN.x)).mul(oneMinus(smoothstep(3.0, 5.0, own)))
  const flutter = sin(uTime.mul(twN.x).add(twN.y)).mul(0.64).add(sin(uTime.mul(twN.x.mul(2.37)).add(twN.y.mul(1.7))).mul(0.36))
  const amp = steady.mul(float(0.05).add(air.mul(0.21)))
  const twinkle = oneMinus(flutter.mul(0.5).add(0.5).mul(amp))
  const sway: N = flutter.mul(amp).mul(0.6)
  const out = smoothstep(seenN.sub(1.2), seenN.add(1.2), uDepression)
  starMat.colorNode = colN.mul(mix(vec3(1, 1, 1), vec3(1.07, 0.9, 0.71), airMass.mul(0.75))).mul(vec3(float(1).add(sway), float(1), float(1).sub(sway))).mul(uExposure)
  // size buys transparency; the anchors are exempt
  const energy = mix(clamp(float(6.5).div(own), 0.13, 1), float(1), min(heroN.x, float(1)))
  starMat.opacityNode = point.add(glint).add(halo).mul(twinkle).mul(0.76).mul(energy).mul(extinction).mul(out).mul(uLevel)
  const stars = new Sprite(starMat)
  stars.count = count
  stars.frustumCulled = false
  stars.renderOrder = -1
  stars.name = 'vinci/evening-stars'

  /* ---- THE NIGHT SHELL: the lapis and the Milky Way ---- */
  const shellMat = new MeshBasicNodeMaterial({ side: BackSide, transparent: true, depthWrite: false, blending: NormalBlending })
  shellMat.fog = false
  const d: N = normalize(positionLocal)
  const h = d.y
  // the lobby's shape over the heights this frame sees: horizon over the wall tops, lapis in the body, abyss toward the zenith
  let sky: N = mix(vec3(...HORIZON_P), vec3(...LAPIS_P), smoothstep(0.38, 0.8, h))
  sky = mix(sky, vec3(...ABYSS_P), smoothstep(0.8, 0.995, h))
  // slow strata carved out of the wash, never a band
  sky = sky.mul(float(1).add(mx_noise_float(vec3(d.x.mul(2.6), d.y.mul(5.4), d.z.mul(2.6))).mul(0.05)))
  // THE MILKY WAY: galactic coordinates of the view at the moment
  const g: N = vec3(dot(d, vec3(...NIGHT_GALACTIC[0]!)), dot(d, vec3(...NIGHT_GALACTIC[1]!)), dot(d, vec3(...NIGHT_GALACTIC[2]!)))
  const l = atan(g.y, g.x).mul(DEG)
  const b = asin(clamp(g.z, -1, 1)).mul(DEG)
  // the band's baked light at the view's longitude and latitude; the bake's edges are dark, so the clamp adds nothing
  const bandTex = new DataTexture(Uint8Array.from(band.data, (v) => Math.round(Math.min(1, Math.max(0, v)) * 255)), BAND_W, BAND_H, RedFormat, UnsignedByteType)
  bandTex.magFilter = LinearFilter; bandTex.minFilter = LinearFilter; bandTex.generateMipmaps = false
  bandTex.wrapS = ClampToEdgeWrapping; bandTex.wrapT = ClampToEdgeWrapping
  bandTex.needsUpdate = true
  // texel centres: the bake samples the band at the corners of its tenth-degree grid
  const bandUv = vec2(l.sub(BAND_L0).div(BAND_STEP).add(0.5).div(BAND_W), b.add(BAND_B).div(BAND_STEP).add(0.5).div(BAND_H))
  const river = texture(bandTex, bandUv).r
  const riverLevel = smoothstep(12, 18, uDepression).mul(RIVER_P)
  sky = sky.add(vec3(...RIVER_TINT).mul(river).mul(riverLevel))
  // THE NIGHT COMES FROM THE ZENITH: the dome's rose lingers low toward the sun until astronomical night
  const flatRay = normalize(vec3(d.x, 0, d.z).add(vec3(1e-5, 0, 0)))
  const flatSun = normalize(vec3(uSun.x, 0, uSun.z).add(vec3(1e-5, 0, 0)))
  const sunward = pow(dot(flatRay, flatSun).mul(0.5).add(0.5), 3)
  const glow = sunward.mul(oneMinus(smoothstep(0.02, 0.5, h))).mul(oneMinus(smoothstep(6, 18, uDepression)))
  // coarse enough to outlive the colour planes' halved resolution
  sky = sky.add(mx_noise_vec3(d.mul(GRAIN_COARSE_FREQ).add(vec3(3.7, 11.9, 6.2))).mul(vec3(...GRAIN_COLOUR)).mul(GRAIN_NORM).mul(smoothstep(8, 13, uDepression)))
  // the whole fragment, not a colour: a material's own output is clamped at zero, and the shell's red goes
  // under zero on purpose, so the print's lift is taken back where the night is deepest
  shellMat.fragmentNode = vec4(sky.mul(uExposure), smoothstep(4, 13, uDepression).mul(oneMinus(glow)).mul(uLevel))
  const shell = new Mesh(new SphereGeometry(SHELL_RADIUS, 64, 32), shellMat)
  shell.frustumCulled = false
  shell.renderOrder = -2
  shell.name = 'vinci/evening-night-shell'
  // the sky's own id: the scene's default id would count this sphere as a rail solid and as a label occluder
  shell.userData = { manifestId: 'vinci/sky', asset: 'vinci/sky', labelOccluder: false, naLabelOccluder: false }
  shell.raycast = () => {}

  /* ---- THE SKY'S GRAIN: a faint multiply over the dome and the shell, fixed on the sky, from the first dusk
     on. The twilight's smooth ramp and the lapis otherwise reach the film's encoder as plateaus with contours;
     blobs a few pixels across at a few percent survive it, where a pixel dither is averaged away. ---- */
  const grainMat = new MeshBasicNodeMaterial({ side: BackSide, transparent: true, depthWrite: false, blending: MultiplyBlending, premultipliedAlpha: true })
  grainMat.fog = false
  const gd: N = normalize(positionLocal)
  const fine = float(GRAIN_FINE[0]).add(smoothstep(4, 8, uDepression).mul(GRAIN_FINE[1] - GRAIN_FINE[0]))
    .sub(smoothstep(9, 12, uDepression).mul(GRAIN_FINE[1] - GRAIN_FINE[2]))
  const coarse = smoothstep(6, 11, uDepression).mul(GRAIN_COARSE[0]).sub(smoothstep(16, 18, uDepression).mul(GRAIN_COARSE[0] - GRAIN_COARSE[1]))
  const n = mx_noise_float(gd.mul(GRAIN_FINE_FREQ)).mul(fine)
    .add(mx_noise_float(gd.mul(GRAIN_COARSE_FREQ).add(vec3(17.3, 5.1, 9.7))).mul(coarse))
  // a multiply grows with the light: the bright glow low over the horizon takes half
  const share = mix(float(0.5), float(1), smoothstep(0.1, 0.45, gd.y)).mul(smoothstep(1, 3, uDepression)).mul(uLevel)
  grainMat.colorNode = vec3(1, 1, 1).mul(float(1).add(n.mul(GRAIN_NORM).mul(share)))
  const grain = new Mesh(new SphereGeometry(GRAIN_RADIUS, 64, 32), grainMat)
  grain.frustumCulled = false
  // after the shell, before the stars: the grain is the sky's, never a star's
  grain.renderOrder = -1.5
  grain.name = 'vinci/evening-sky-grain'
  grain.userData = { manifestId: 'vinci/sky', asset: 'vinci/sky', labelOccluder: false, naLabelOccluder: false }
  grain.raycast = () => {}

  /* ---- THE SHOOTING STAR: a beaded streak, the museum's own, on a fixed almanac ---- */
  const TRAIL = 26, FLIGHT = 0.8, GAP = 0.0042
  const bead = new Float32Array(TRAIL)
  for (let k = 0; k < TRAIL; k++) bead[k] = k
  const beadN: N = instancedBufferAttribute(new InstancedBufferAttribute(bead, 1))
  const uMeteorFrom: N = uniform(-1e6)
  const from = along(302, 63.5, new Vector3()), to = along(290.5, 53.5, new Vector3())
  const p = uTime.sub(uMeteorFrom).div(FLIGHT)
  const pk = clamp(p.sub(beadN.mul(GAP)), 0, 1)
  const meteorMat = new PointsNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending })
  meteorMat.fog = false
  meteorMat.positionNode = normalize(mix(vec3(from.x, from.y, from.z), vec3(to.x, to.y, to.z), pk)).mul(METEOR_RADIUS)
  meteorMat.sizeAttenuation = false
  const fade = oneMinus(beadN.div(TRAIL))
  meteorMat.sizeNode = pow(fade, 1.4).mul(5.2).add(1.5).mul(uFrame)
  meteorMat.colorNode = mix(vec3(0.62, 0.7, 0.9), vec3(1, 0.96, 0.86), pow(fade, 1.7)).mul(uExposure)
  const mr = min(length(uv().sub(vec2(0.5, 0.5))).mul(2), float(1))
  // struck fast, dying slow
  const flight = step(0, p).mul(step(p, 1)).mul(smoothstep(0, 0.09, p)).mul(pow(clamp(oneMinus(p), 0, 1), 1.25))
  meteorMat.opacityNode = pow(oneMinus(mr), 2.2).mul(0.5).add(pow(oneMinus(mr), 8).mul(0.7)).mul(pow(fade, 1.5)).mul(flight).mul(uLevel)
  const meteor = new Sprite(meteorMat)
  meteor.count = TRAIL
  meteor.frustumCulled = false
  meteor.renderOrder = -1
  meteor.name = 'vinci/evening-shooting-star'

  group.add(shell, grain, stars, meteor)
  return {
    group, uDepression, uLevel, uTime,
    set(state) {
      uDepression.value = state.depression
      uExposure.value = state.exposure
      uSun.value.copy(state.sun)
      uFrame.value = frameScale()
      uLevel.value = 1
    },
    startAt(seconds) { uMeteorFrom.value = seconds + FAREWELL_METEOR },
  }
}
