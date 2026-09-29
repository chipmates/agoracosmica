/** THE NIGHT OVER THE GRAVE: the sky that stood over Clos Lucé at nine that
 * evening, drawn with the lobby's star craft on the lobby's lapis.
 *
 * The stars are the Yale Bright Star Catalogue carried to 21:00 local apparent
 * time on 10 October 1517 (`farewell-night-stars.ts`, written by
 * `forge/night/real-sky.mjs`), held at that moment while the evening darkens:
 * a turning sky would carry them thirty degrees through the clip and read as
 * the camera swimming. No moon and no planet stood above the walls then.
 *
 * Three things hang at the eye, all fog-free, depth-tested and writing no
 * depth, inside the dome and outside every crown and roof, so the court's
 * walls and trees cut them as they cut the day's sky:
 *   the night shell   the lobby's lapis over the dome wherever sky shows, and
 *                     the Milky Way in the same fragment, drawn after the
 *                     real one along its true course
 *   the stars         one instanced sprite, the lobby's profile, colour,
 *                     twinkle and glints, each star at its catalogue place
 *   a shooting star   the museum's own, on a fixed almanac in the held night
 *
 * The wing's print has no bloom and opens the night eightfold, so every level
 * here is authored at the print (after its exposure, before its lift and toe)
 * and divided by the opening the evening hands in; the glow of a star is its
 * own skirt and halo.
 */
import { AdditiveBlending, BackSide, Color, Group, InstancedBufferAttribute, Mesh, MeshBasicNodeMaterial, NormalBlending, PointsNodeMaterial, SphereGeometry, Sprite, Vector3 } from 'three/webgpu'
import { abs, asin, atan, clamp, dot, exp, float, fract, instancedBufferAttribute, length, max, min, mix, mx_fractal_noise_float, mx_noise_float, normalize, oneMinus, positionLocal, pow, screenCoordinate, sin, smoothstep, step, uniform, uv, vec2, vec3 } from 'three/tsl'
import { FAREWELL_METEOR, along } from './farewell'
import { NIGHT_GALACTIC, NIGHT_STARS, NIGHT_STARS_STRIDE } from './farewell-night-stars'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const TAU = Math.PI * 2
const DEG = 180 / Math.PI
/** the stars, the shooting star and the shell, all inside the dome (1800 m) */
const STAR_RADIUS = 600, METEOR_RADIUS = 590, SHELL_RADIUS = 700

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

/** the glass the sky is seen through: sizes shrink with the square root of the viewport width */
function glassScale(): number {
  if (typeof window === 'undefined') return 1
  return Math.max(0.68, Math.min(1, Math.sqrt((window.innerWidth || 900) / 900)))
}

/* THE NIGHT'S COLOURS AT THE PRINT, measured on the grave's frames: the
   lobby's horizon, lapis and abyss after the wing's own lift and toe. The
   lift keeps the deepest red a few levels over the lobby's; nothing under
   zero survives the stack to undercut it. */
const HORIZON_P = [0.0002, 0.0107, 0.0966] as const
const LAPIS_P = [0.0, 0.005, 0.069] as const
const ABYSS_P = [0.0, 0.0006, 0.049] as const
/** the Milky Way's light at its brightest, and its colour: a warm grey pulled to silver */
const RIVER_P = 0.0112
const RIVER_TINT = [0.93, 0.97, 1.05] as const

/* THE BAND ON THE CPU, the shell's own numbers without its noise, for placing the grain */
const GRAINS = 1200
const bandCentre = (l: number): number => 0.8 - 1.2 * ease(88, 120, l)
const bandWidth = (l: number): number => 4.2 - 1.4 * ease(88, 118, l)
function bandDensity(l: number, b: number): number {
  const along = (0.4 + 0.6 * ease(122, 86, l)) * (0.8 + 0.2 * ease(40, 58, l))
  const cl = (l - 71.5) / 5.5, cb = (b - 2.6) / 2.1
  const cloud = 1 + 0.9 * Math.exp(-0.5 * (cl * cl + cb * cb))
  const rb = (b - (-0.2 + 1.2 * Math.max(ease(71, 84, l), ease(71, 58, l)))) / 1.7
  const rift = Math.exp(-rb * rb) * ease(90, 83, l) * (0.55 + 0.45 * ease(48, 60, l)) * 0.85
  const pocket = (l0: number, b0: number, r: number, depth: number): number => 1 - depth * Math.exp(-0.5 * (((l - l0) / r) ** 2 + ((b - b0) / r) ** 2))
  return along * cloud / 1.9 * (1 - rift) * pocket(81.31, 0.78, 1.6, 0.8) * pocket(91.66, 4.18, 1.2, 0.7) * pocket(71.41, 3.2, 1.4, 0.35)
}
/** mulberry32: a small seeded generator, so the grain is the same in every run */
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
  const uExposure: N = uniform(1), uSun: N = uniform(new Vector3(0, 1, 0)), uGlass: N = uniform(glassScale())
  const group = new Group()
  group.name = 'vinci/evening-night'
  group.visible = false
  // the stack's warm walk draws a hidden body marked so, compiling its pipelines at entry in the pass the walk will use
  group.userData['naWarm'] = true

  /* ---- THE STARS, and the band's grain after them ---- */
  const catalogue = NIGHT_STARS.length / NIGHT_STARS_STRIDE
  const count = catalogue + GRAINS
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count)
  const tw = new Float32Array(count * 2), hero = new Float32Array(count * 2), seen = new Float32Array(count)
  const dir = new Vector3()
  for (let i = 0; i < catalogue; i++) {
    const at = i * NIGHT_STARS_STRIDE
    const azimuth = NIGHT_STARS[at]!, altitude = NIGHT_STARS[at + 1]!, V = NIGHT_STARS[at + 2]!, bv = NIGHT_STARS[at + 3]!, hr = NIGHT_STARS[at + 4]!
    along(azimuth, altitude, dir).multiplyScalar(STAR_RADIUS)
    pos[i * 3] = dir.x; pos[i * 3 + 1] = dir.y; pos[i * 3 + 2] = dir.z
    // THE MAGNITUDE LAW, tuned on the print: a shade steeper than the flux itself, since the
    // print's toe already compresses the faint end, and capped where the core would clip
    const peak = Math.min(1.3, 0.072 * Math.pow(10, 0.43 * (6 - V)))
    // the eye reads faint light without colour: the faint are silver, the bright keep their tint
    const tint = scotopic(temperature(rampOf(bv)), 0.35 + 0.65 * ease(5.5, 1, V))
    col[i * 3] = tint.r * peak; col[i * 3 + 1] = tint.g * peak; col[i * 3 + 2] = tint.b * peak
    // the lobby's footprints: a glow grows with the light to the third magnitude, then slowly;
    // the faintest keep a core the film's encoder does not quantize away
    size[i] = Math.max(3, 3.1 + 1.25 * Math.min(3, 6.5 - V) + 0.35 * Math.max(0, 3.5 - V))
    tw[i * 2] = 0.5 + hash1(hr) * 1.3; tw[i * 2 + 1] = hash1(hr + 0.5) * TAU
    // the glints: four rays and a halo for the first magnitude, rays alone to 2.15 (six at most in a frame)
    hero[i * 2] = V < 1.5 ? 1 : V < 2.15 ? 0.6 : 0; hero[i * 2 + 1] = V < 1.5 ? 1 : 0
    // each comes out at its own depression of the sun, the brightest in the civil twilight
    seen[i] = 3 + 2.3 * V
  }
  // THE GRAIN: unresolved light under the catalogue's limit, hugging the band where
  // the band is bright, never in the rift; seeded, so every run draws the same grains
  const rand = seeded(1517)
  let i = catalogue
  for (let tries = 0; i < count && tries < GRAINS * 40; tries++) {
    const l = 22 + rand() * 116
    const u = Math.max(rand(), 1e-9), gauss = Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rand())
    const b = bandCentre(l) + gauss * bandWidth(l) * 1.1
    if (rand() > bandDensity(l, b)) continue
    const cl = Math.cos(b / DEG)
    const gx = cl * Math.cos(l / DEG), gy = cl * Math.sin(l / DEG), gz = Math.sin(b / DEG)
    const M = NIGHT_GALACTIC
    dir.set(M[0]![0]! * gx + M[1]![0]! * gy + M[2]![0]! * gz, M[0]![1]! * gx + M[1]![1]! * gy + M[2]![1]! * gz, M[0]![2]! * gx + M[1]![2]! * gy + M[2]![2]! * gz)
    if (dir.y < 0.08) continue
    dir.normalize().multiplyScalar(STAR_RADIUS)
    pos[i * 3] = dir.x; pos[i * 3 + 1] = dir.y; pos[i * 3 + 2] = dir.z
    const peak = 0.072 * Math.pow(10, 0.43 * (6 - (6.1 + rand() * 0.8)))
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
  const heroN: N = instancedBufferAttribute(new InstancedBufferAttribute(hero, 2))
  const seenN: N = instancedBufferAttribute(new InstancedBufferAttribute(seen, 1))
  starMat.positionNode = posN
  starMat.sizeAttenuation = false
  const appSize = max(sizeN.mul(uGlass), 1.4)
  // the glint's quad is oversized so its rays have room; the core divides it back out
  const quadK = float(1).add(heroN.x.mul(1.6))
  starMat.sizeNode = appSize.mul(quadK)
  const q = uv().sub(vec2(0.5, 0.5))
  const rr = min(length(q).mul(2).mul(quadK), float(1))
  // THE PROFILE: a tight core in a soft skirt; too small for a sharp core, a pre-filtered soft one.
  // The wing's print has no bloom, so the soft kernel reaches further up than the lobby's.
  const sharp = smoothstep(float(2.2), float(6.5), appSize)
  const soft = exp(rr.mul(rr).mul(-7.5)).mul(smoothstep(1, 0.7, rr))
  const tight = pow(float(1).add(rr.mul(rr).mul(62)), -1.65).mul(1.2).add(exp(rr.mul(rr).mul(-8)).mul(0.11))
  const point = mix(soft, tight, sharp)
  const ray = (a: N, across: N): N => pow(smoothstep(float(0.5), float(0), a), 1.8).mul(smoothstep(float(0.05).mul(oneMinus(a.mul(1.35))).max(0.005), float(0), across))
  const glint = ray(abs(q.x), abs(q.y)).add(ray(abs(q.y), abs(q.x))).mul(0.46).mul(heroN.x)
  const halo = pow(oneMinus(min(length(q).mul(2), float(1))), 2.6).mul(0.14).mul(heroN.y)
  const starDir = normalize(posN)
  // the air: dimmer and warmer toward the horizon, and the twinkle is its own
  const airMass = smoothstep(0.3, -0.05, starDir.y)
  const extinction = mix(float(1), float(0.34), airMass)
  const air = smoothstep(0.55, -0.02, starDir.y)
  const steady = oneMinus(step(0.01, heroN.x)).mul(oneMinus(smoothstep(3.0, 5.0, appSize)))
  const flutter = sin(uTime.mul(twN.x).add(twN.y)).mul(0.64).add(sin(uTime.mul(twN.x.mul(2.37)).add(twN.y.mul(1.7))).mul(0.36))
  const amp = steady.mul(float(0.05).add(air.mul(0.21)))
  const twinkle = oneMinus(flutter.mul(0.5).add(0.5).mul(amp))
  const sway: N = flutter.mul(amp).mul(0.6)
  const out = smoothstep(seenN.sub(1.2), seenN.add(1.2), uDepression)
  starMat.colorNode = colN.mul(mix(vec3(1, 1, 1), vec3(1.07, 0.9, 0.71), airMass.mul(0.75))).mul(vec3(float(1).add(sway), float(1), float(1).sub(sway))).mul(uExposure)
  // size buys transparency; the anchors are exempt
  const energy = mix(clamp(float(6.5).div(appSize), 0.13, 1), float(1), min(heroN.x, float(1)))
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
  // two octaves of low-frequency noise break the edges
  const fold = mx_noise_float(g.mul(3.2).add(vec3(1.7, 4.1, 2.3))).mul(0.62).add(mx_noise_float(g.mul(7.1).add(vec3(5.3, 0.4, 3.9))).mul(0.38))
  // the atlas's river craft: the grain runs WITH the band, since compressing the
  // cross-band axis turns noise into torn star clouds instead of weather
  const clouds = clamp(mx_fractal_noise_float(vec3(g.x.mul(14), g.y.mul(14), g.z.mul(30)).add(vec3(2.1, 7.7, 0.6)), 3, 2, 0.54, 1).mul(0.82).add(0.48), 0, 1)
  const threads = clamp(mx_noise_float(vec3(g.x.mul(30).add(clouds.mul(1.3)), g.y.mul(30), g.z.mul(75).add(clouds.mul(1.8)))).mul(0.5).add(0.5), 0, 1)
  const cloudLight = pow(clouds, 1.2).mul(0.88).add(smoothstep(0.3, 0.72, threads).mul(0.35)).add(0.12)
  const bank = b.sub(mix(float(0.8), float(-0.4), smoothstep(88, 120, l))).add(fold.mul(1.1))
  const width = mix(float(4.2), float(2.8), smoothstep(88, 118, l))
  const envelope = exp(bank.mul(bank).div(width.mul(width).mul(-2)))
  // brightest through Cygnus, a shade less toward Aquila, fading to Cassiopeia
  const alongBand = mix(float(0.4), float(1), smoothstep(122, 86, l)).mul(mix(float(0.8), float(1), smoothstep(40, 58, l)))
  // the Cygnus star cloud between Sadr and Albireo
  const cl = l.sub(71.5).div(5.5), cb = b.sub(2.6).div(2.1)
  const cloud = float(1).add(exp(cl.mul(cl).add(cb.mul(cb)).mul(-0.5)).mul(0.9))
  // the Great Rift: a lane where no light is added, from the Northern Coalsack by Deneb (LDN 906) past
  // Sadr through LDN 841, on to the Vulpecula Rift; the Coalsack itself; the opaque LDN 1003 in Cepheus
  const riftB = float(-0.2).add(max(smoothstep(71, 84, l), smoothstep(71, 58, l)).mul(1.2)).add(fold.mul(0.5))
  const rb = b.sub(riftB).div(1.7)
  const rift = exp(rb.mul(rb).negate()).mul(smoothstep(90, 83, l)).mul(mix(float(0.55), float(1), smoothstep(48, 60, l))).mul(0.85)
  const pocket = (l0: number, b0: number, r: number, depth: number): N => {
    const x = l.sub(l0).div(r), y = b.sub(b0).div(r)
    return oneMinus(exp(x.mul(x).add(y.mul(y)).mul(-0.5)).mul(depth))
  }
  const dust = pocket(81.31, 0.78, 1.6, 0.8).mul(pocket(91.66, 4.18, 1.2, 0.7)).mul(pocket(71.41, 3.2, 1.4, 0.35))
  const river = envelope.mul(cloud).mul(alongBand).mul(oneMinus(rift)).mul(dust).mul(cloudLight)
  const riverLevel = smoothstep(12, 18, uDepression).mul(RIVER_P)
  sky = sky.add(vec3(...RIVER_TINT).mul(river.max(0)).mul(riverLevel))
  // dithered at creation, so the deep ramp never bands on the print or the film
  const dither = fract(sin(dot(screenCoordinate.xy.add(0.5), vec2(12.9898, 78.233))).mul(43758.5453)).sub(0.5).mul(0.0016)
  shellMat.colorNode = sky.add(dither).max(0).mul(uExposure)
  // THE NIGHT COMES FROM THE ZENITH: the dome's rose lingers low toward the sun until astronomical night
  const flatRay = normalize(vec3(d.x, 0, d.z).add(vec3(1e-5, 0, 0)))
  const flatSun = normalize(vec3(uSun.x, 0, uSun.z).add(vec3(1e-5, 0, 0)))
  const sunward = pow(dot(flatRay, flatSun).mul(0.5).add(0.5), 3)
  const glow = sunward.mul(oneMinus(smoothstep(0.02, 0.5, h))).mul(oneMinus(smoothstep(6, 18, uDepression)))
  shellMat.opacityNode = smoothstep(4, 13, uDepression).mul(oneMinus(glow)).mul(uLevel)
  const shell = new Mesh(new SphereGeometry(SHELL_RADIUS, 64, 32), shellMat)
  shell.frustumCulled = false
  shell.renderOrder = -2
  shell.name = 'vinci/evening-night-shell'
  // the sky's own id: the scene's default id would count this sphere as a rail solid and as a label occluder
  shell.userData = { manifestId: 'vinci/sky', asset: 'vinci/sky', labelOccluder: false, naLabelOccluder: false }
  shell.raycast = () => {}

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
  meteorMat.sizeNode = pow(fade, 1.4).mul(5.2).add(1.5).mul(uGlass)
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

  group.add(shell, stars, meteor)
  return {
    group, uDepression, uLevel, uTime,
    set(state) {
      uDepression.value = state.depression
      uExposure.value = state.exposure
      uSun.value.copy(state.sun)
      uGlass.value = glassScale()
      uLevel.value = 1
    },
    startAt(seconds) { uMeteorFrom.value = seconds + FAREWELL_METEOR },
  }
}
