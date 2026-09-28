/** THE FAREWELL AT THE GRAVE: the eye rises over the grave court and looks out
 * over the house while the afternoon runs on to its evening, the sun goes
 * down beside the house, and the eye tilts up into the sky as the first
 * stars come out.
 *
 * The sun keeps the day's own hours: 10 October 1517 at Amboise, from the
 * hour the wing stands in to nautical dusk, its height computed from the
 * site's latitude and the day's own noon, which reproduces the ephemeris rows
 * in `data/light-rig.json` to a few hundredths of a degree. ITS AZIMUTH IS
 * THE MUSEUM'S, NOT THE DAY'S: the day's sunset (255.6 deg) lies behind the
 * eye over the unbuilt land, so during the rise the sun swings to the house's
 * side of the sky (`FAREWELL_SUN_AZIMUTH`). The light, the sky's twilight and
 * the stars are scenic assumptions, as the rig's night rule says of every
 * twilight: a type of an October evening, not a record of that one.
 */
import { Vector3 } from 'three/webgpu'
import { hourKey } from './site'

const RAD = Math.PI / 180
/** Clos Lucé's latitude (the dossier's own) and the sun's declination on the
 * day, taken from the ephemeris' solar noon: 32.36 degrees up at 12:00 LAT. */
const LATITUDE_DEG = 47.4103059
const NOON_ELEVATION_DEG = 32.36
const DECLINATION_DEG = NOON_ELEVATION_DEG - 90 + LATITUDE_DEG
/** The wing's own hour, and the evening the farewell runs to. */
export const FAREWELL_FROM_HOUR = (hourKey as unknown as { lat_hour?: { value: number } }).lat_hour?.value ?? 15 + 19 / 60
export const FAREWELL_TO_HOUR = 18.45

/** The sun at a local apparent hour of the day: azimuth clockwise from north,
 * elevation above the horizon, in degrees. */
export function farewellSun(hour: number): { azimuth: number; elevation: number } {
  const phi = LATITUDE_DEG * RAD, delta = DECLINATION_DEG * RAD, h = (hour - 12) * 15 * RAD
  const sinEl = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(h)
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(delta) * Math.cos(phi)) / RAD + 180
  return { azimuth: (az + 360) % 360, elevation: Math.asin(Math.max(-1, Math.min(1, sinEl))) / RAD }
}

/** The sun's direction in the engine's frame (x east, y up, z south). */
export function farewellSunDirection(sun: { azimuth: number; elevation: number }, out = new Vector3()): Vector3 {
  const az = sun.azimuth * RAD, el = sun.elevation * RAD
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize()
}

const smooth = (u: number): number => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x) }
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
/** A piecewise curve through (x, y) knots, eased between them. */
function curve(knots: readonly (readonly [number, number])[], x: number): number {
  if (x <= knots[0]![0]) return knots[0]![1]
  for (let i = 1; i < knots.length; i++) {
    const [x1, y1] = knots[i]!, [x0, y0] = knots[i - 1]!
    if (x <= x1) return lerp(y0, y1, smooth((x - x0) / Math.max(1e-9, x1 - x0)))
  }
  return knots[knots.length - 1]![1]
}

/** THE FAREWELL'S CLOCK, in shares of its length: the eye rises and turns
 * to the house; it holds there as the sun comes down beside it; it tilts up
 * as the sun reaches the hill, so the land is a dark band under the sky with
 * the house and the trees against it; it watches the disc go; it looks up
 * into the sky as the blue hour deepens and the stars come out. */
export const FAREWELL_SECONDS = 18
export const FAREWELL_BEATS = { risen: .22, held: .34, glow: .56, set: .7 } as const
/** The hour at a share of the farewell: the sun at eight degrees when the eye
 * has risen, five as it starts to look up, three at the golden moment, where
 * it meets the hill's crest, half a degree when it is gone behind it, twelve
 * under at the end. */
export function farewellHour(share: number): number {
  const B = FAREWELL_BEATS
  return curve([[0, FAREWELL_FROM_HOUR], [B.risen, 16.38], [B.held, 16.72], [B.glow, 16.95], [B.set, 17.2], [1, FAREWELL_TO_HOUR]], share)
}
/** Where the museum's sun goes down, clockwise from north: right of the house
 * as the risen eye sees it (the house at 58 deg), where the hill's crest and
 * its trees fall lowest before the open land. */
export const FAREWELL_SUN_AZIMUTH = 84
/** The sun at a share: the day's own at the grave, swung the short way to the
 * museum's azimuth while the eye rises and turns, then held there. */
export function farewellSunAt(share: number): { azimuth: number; elevation: number } {
  const day = farewellSun(farewellHour(share))
  const swing = smooth(share / FAREWELL_BEATS.risen)
  return { azimuth: (day.azimuth + shortestTurn(day.azimuth, FAREWELL_SUN_AZIMUTH) * swing + 360) % 360, elevation: day.elevation }
}

/** How the evening lights the wing at one sun elevation. The direct light
 * falls with the air mass it crosses (Kasten and Young's air mass under a
 * simple transmittance), warms toward the horizon and is gone with the disc;
 * the sky's own light outlasts it and cools; the print opens a little as the
 * light goes, as an eye does, never so far that dusk reads as day. */
export interface FarewellLight {
  /** the key's colour temperature and its level against the rig's own */
  kelvin: number; keyShare: number
  /** the fill's sky and ground colours and level, the environment's level */
  fillSky: [number, number, number]; fillGround: [number, number, number]; fillShare: number; environmentShare: number
  /** the air's three colours: toward the sun, the middle, away from it */
  hazeWarm: [number, number, number]; hazeMid: [number, number, number]; hazeCool: [number, number, number]
  /** the print's exposure against the stop's own */
  exposureGain: number
  /** the twilight sky's share, 0 in the afternoon */
  twilight: number
  /** how strongly the high cloud takes the low sun's colour */
  cloudGlow: number
  /** the far land's haze against the sky's: once the sun is low the land
   * goes dark under a sky that keeps its light */
  land: number
  /** the share of the horizon's haze the sky keeps: a sunset burns down to
   * the land, where the afternoon's haze would lay a flat band over it */
  veil: number
  /** the analytic dome's haze and its scattering: a low sun crosses more of
   * both, which reddens it and the sky round it */
  turbidity: number; rayleigh: number
  /** how tight the dome's bright lobe round the sun is (its mie asymmetry)
   * and how much haze feeds it: tighter and thinner as it sets, so the glow
   * is the sun's and not half the sky's */
  mieFocus: number; mieShare: number
  /** how far the sun stands under the horizon, in degrees (0 while it is up) */
  depression: number
}
const airMass = (el: number): number => 1 / (Math.sin(Math.max(-.5, el) * RAD) + .50572 * Math.pow(Math.max(.01, el + 6.07995), -1.6364))
/** The direct beam's level against the hour's, on a surface square to it:
 * the renderer lays the incidence on, so only the air's transmittance
 * falls here. */
const directShare = (el: number): number => {
  if (el <= -.83) return 0
  const through = (e: number): number => Math.pow(.7, Math.pow(airMass(e), .678))
  // the last of the disc fades over its own diameter at the horizon
  return through(Math.max(.05, el)) / through(hourKey.sun_elevation_deg.value) * smooth((el + .83) / 1.1)
}
const mixRgb = (a: readonly number[], b: readonly number[], t: number): [number, number, number] =>
  [lerp(a[0]!, b[0]!, t), lerp(a[1]!, b[1]!, t), lerp(a[2]!, b[2]!, t)]
const hex = (value: string): [number, number, number] => {
  const n = parseInt(value.slice(1), 16)
  // linear, as the fog colour is read in the shader
  const lin = (c: number): number => { const s = c / 255; return s <= .04045 ? s / 12.92 : Math.pow((s + .055) / 1.055, 2.4) }
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)]
}
/** The air's colours by the sun's elevation, in the rig's own at the hour. */
const HAZE = {
  warm: [[17.4, '#d2c7ae'], [8, '#d9bb92'], [3, '#d49868'], [0, '#b06a52'], [-3, '#6f5058'], [-7, '#302b44'], [-12, '#141828']],
  mid: [[17.4, '#c0bba9'], [8, '#c4b59c'], [3, '#b09486'], [0, '#7f6f7c'], [-3, '#4a4a64'], [-7, '#232a44'], [-12, '#0d1222']],
  cool: [[17.4, '#a8b2b6'], [8, '#a3a8ae'], [3, '#8a8ea2'], [0, '#5e6484'], [-3, '#353d5e'], [-7, '#1a2139'], [-12, '#0a0f1e']],
} as const
function hazeAt(stops: readonly (readonly [number, string])[], el: number): [number, number, number] {
  if (el >= stops[0]![0]) return hex(stops[0]![1])
  for (let i = 1; i < stops.length; i++) {
    const [e1, c1] = stops[i]!, [e0, c0] = stops[i - 1]!
    if (el >= e1) return mixRgb(hex(c0), hex(c1), smooth((e0 - el) / (e0 - e1)))
  }
  return hex(stops[stops.length - 1]![1])
}
export function farewellLight(elevation: number): FarewellLight {
  const el = elevation
  const kelvin = curve([[-1, 1800], [1, 2050], [3, 2450], [6, 2850], [10, 3500], [17.4, 4700]], el)
  const skyLight = curve([[-12, .01], [-6, .035], [-2, .1], [1, .2], [4, .3], [8, .5], [17.4, 1]], el)
  const depression = Math.max(0, -el)
  return {
    // the eye adapts to the evening, so the low sun still reads as sunlight
    kelvin, keyShare: Math.pow(directShare(el), .45),
    // the fill takes the low sun's warm half of the sky before the blue hour
    fillSky: mixRgb(mixRgb(hex('#a5b5bb'), hex('#b8a896'), smooth((12 - el) / 8) * smooth((el + 1) / 3)), hex('#4d5f8f'), smooth((1 - el) / 7)),
    fillGround: mixRgb(hex('#736550'), hex('#2a2630'), smooth((6 - el) / 12)),
    fillShare: skyLight, environmentShare: skyLight,
    hazeWarm: hazeAt(HAZE.warm, el), hazeMid: hazeAt(HAZE.mid, el), hazeCool: hazeAt(HAZE.cool, el),
    exposureGain: curve([[-12, 4.4], [-6, 3.2], [-2, 2.1], [1, 1.6], [4, 1.35], [8, 1.15], [17.4, 1]], el),
    twilight: smooth((3 - el) / 5),
    cloudGlow: smooth((12 - el) / 10) * smooth((el + 9) / 7),
    land: curve([[-8, .3], [-3, .4], [0, .5], [4, .8], [9, 1]], el),
    veil: curve([[-6, .3], [0, .16], [3, .3], [8, .7], [17.4, 1]], el),
    turbidity: curve([[-2, 7], [2, 6.5], [8, 5], [17.4, 4]], el),
    rayleigh: curve([[-2, 3.2], [2, 3], [8, 2], [17.4, 1.4]], el),
    mieFocus: curve([[1, .99], [6, .985], [12, .93], [17.4, .8]], el),
    mieShare: curve([[1, .12], [5, .14], [10, .22], [17.4, 1]], el),
    depression,
  }
}

/** THE AIR THINS WITH THE EYE'S HEIGHT over the ground it stands on: the
 * exhibition fog is set for a walker, and from fifteen metres up it washed the
 * whole view. A share of the fog kept, 1 at walking height. */
export function farewellAir(heightAboveGroundM: number): number {
  return 1 - .7 * smooth((heightAboveGroundM - 2) / 14)
}

/** THE EYE'S WAY, in the wing's metres (east, north, height): the poses it
 * passes through at the clock's beats, from the one it leaves at the grave.
 * Headings run clockwise from north and every turn takes the short way. */
export interface FarewellBeat { eye: readonly [east: number, north: number, height: number]; heading: number; pitch: number; fov: number }
/** Keys inside the rise, at shares of the farewell between the grave and
 * the risen beat: the share of the height climbed, the heading and the
 * pitch, each passed through without overshoot. */
export interface FarewellRise { lift: readonly (readonly [number, number])[]; heading: readonly (readonly [number, number])[]; pitch: readonly (readonly [number, number])[] }
export interface FarewellPath { risen: FarewellBeat; held: FarewellBeat; glow: FarewellBeat; set: FarewellBeat; up: FarewellBeat; rise: FarewellRise }
const RISEN_EYE = [-47.5, -28.5, 15] as const
/** THE RISE LOOKS UP OUT OF THE COURT. Every heading from the grave to the
 * house passes a tree at the court's height (the tall elm west of the back
 * wall, the court's maple, the cherry and the hornbeam over the north wall),
 * and a level eye crossing the walls' coping sees the coping edge on with a
 * crown filling the frame. So the eye turns off the elm while still low,
 * tilts up to the sky as it climbs past the coping, and comes down onto the
 * house by the risen beat. Keys in seconds of the farewell's own clock. */
const sec = (seconds: number): number => seconds / FAREWELL_SECONDS
const RISE_LIFT = [[sec(.7), .04], [sec(1.45), .24], [sec(2.1), .66], [sec(2.7), .91], [sec(3.3), .99]] as const
/** From the golden moment the frame's lower edge stands near the house's
 * foot, so the land is a band of about a fifth of the frame with the house
 * and the crest's trees against the sky over it. */
export const FAREWELL_PATH: { desktop: FarewellPath; phone: FarewellPath } = {
  desktop: {
    // the wide frame's right edge reaches the gallery's block 2.4 m east of
    // the grave, so the heading holds west of it until the eye is over its
    // roof; the elm stands in the sky at the left for that moment
    rise: { lift: RISE_LIFT, heading: [[sec(1), -46], [sec(1.7), -30], [sec(2.3), 0], [sec(3), 38], [sec(3.5), 53]], pitch: [[sec(.35), -2], [sec(1.35), 40], [sec(2), 44], [sec(3), 6]] },
    risen: { eye: RISEN_EYE, heading: 60, pitch: -10, fov: 60 },
    held: { eye: [-47.3, -28.3, 15.3], heading: 62, pitch: -6, fov: 60 },
    glow: { eye: [-47.3, -28.3, 15.5], heading: 64, pitch: 16, fov: 56 },
    set: { eye: [-47.3, -28.3, 15.6], heading: 64, pitch: 24, fov: 58 },
    up: { eye: [-47.3, -28.3, 16], heading: 65, pitch: 40, fov: 72 },
  },
  phone: {
    rise: { lift: RISE_LIFT, heading: [[sec(1), -34], [sec(2), 2], [sec(3), 42]], pitch: [[sec(.2), -4], [sec(1.3), 40], [sec(2), 44], [sec(2.9), 12]] },
    risen: { eye: RISEN_EYE, heading: 60, pitch: -4, fov: 76 },
    held: { eye: [-47.3, -28.3, 15.3], heading: 63, pitch: -1, fov: 76 },
    glow: { eye: [-47.3, -28.3, 15.5], heading: 72, pitch: 26, fov: 88 },
    set: { eye: [-47.3, -28.3, 15.6], heading: 72, pitch: 32, fov: 88 },
    up: { eye: [-47.3, -28.3, 16], heading: 72, pitch: 48, fov: 94 },
  },
}

/** A heading clockwise from north and a pitch, as a direction in the engine. */
function along(heading: number, pitch: number, out: Vector3): Vector3 {
  const h = heading * RAD, p = pitch * RAD
  return out.set(Math.sin(h) * Math.cos(p), Math.sin(p), -Math.cos(h) * Math.cos(p))
}
const headingOf = (d: Vector3): number => Math.atan2(d.x, -d.z) / RAD
const pitchOf = (d: Vector3): number => Math.asin(Math.max(-1, Math.min(1, d.y / Math.max(1e-9, d.length())))) / RAD
/** The shortest way round from one heading to another, in degrees. */
export const shortestTurn = (from: number, to: number): number => ((to - from) % 360 + 540) % 360 - 180

/** A monotone cubic through (x, y) knots (Fritsch and Carlson), level at
 * both ends, so a key is passed through without overshoot or a stop. */
function monotone(knots: readonly (readonly [number, number])[], x: number): number {
  const n = knots.length
  if (x <= knots[0]![0]) return knots[0]![1]
  if (x >= knots[n - 1]![0]) return knots[n - 1]![1]
  const h: number[] = [], d: number[] = [], m: number[] = new Array(n).fill(0)
  for (let i = 0; i < n - 1; i++) { h.push(knots[i + 1]![0] - knots[i]![0]); d.push((knots[i + 1]![1] - knots[i]![1]) / h[i]!) }
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1]! * d[i]! <= 0) continue
    const w1 = 2 * h[i]! + h[i - 1]!, w2 = h[i]! + 2 * h[i - 1]!
    m[i] = (w1 + w2) / (w1 / d[i - 1]! + w2 / d[i]!)
  }
  let i = 0
  while (i < n - 2 && x > knots[i + 1]![0]) i++
  const t = (x - knots[i]![0]) / h[i]!, t2 = t * t, t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * knots[i]![1] + (t3 - 2 * t2 + t) * h[i]! * m[i]! + (-2 * t3 + 3 * t2) * knots[i + 1]![1] + (t3 - t2) * h[i]! * m[i + 1]!
}

/** The eye at a share of the farewell, from the pose it leaves at the grave:
 * each stretch between two beats eased at both ends, the rise through its
 * own keys. */
export function farewellPose(share: number, start: { eye: Vector3; at: Vector3; fov: number }, phone: boolean): { eye: Vector3; at: Vector3; fov: number } {
  const path = FAREWELL_PATH[phone ? 'phone' : 'desktop'], B = FAREWELL_BEATS
  const s = Math.max(0, Math.min(1, share))
  const d0 = start.at.clone().sub(start.eye)
  const first: FarewellBeat = { eye: [start.eye.x, -start.eye.z, start.eye.y], heading: headingOf(d0), pitch: pitchOf(d0), fov: start.fov }
  const beats: [number, FarewellBeat][] = [[0, first], [B.risen, path.risen], [B.held, path.held], [B.glow, path.glow], [B.set, path.set], [1, path.up]]
  if (s < B.risen) return risePose(s, first, path)
  let i = 1
  while (i < beats.length - 1 && s > beats[i]![0]) i++
  const [s0, a] = beats[i - 1]!, [s1, b] = beats[i]!
  const u = smooth((s - s0) / Math.max(1e-9, s1 - s0))
  // the rise leaves the ground slowly and arrives slowly: eased twice
  const lift = i === 1 ? u * u * (3 - 2 * u) : u
  const eye = new Vector3(lerp(a.eye[0], b.eye[0], lift), lerp(a.eye[2], b.eye[2], lift), -lerp(a.eye[1], b.eye[1], lift))
  const heading = a.heading + shortestTurn(a.heading, b.heading) * u
  const dir = along(heading, lerp(a.pitch, b.pitch, u), new Vector3())
  return { eye, at: eye.clone().addScaledVector(dir, 10), fov: lerp(a.fov, b.fov, u) }
}

/** The rise from the grave's own pose to the risen beat, through the keys. */
function risePose(s: number, first: FarewellBeat, path: FarewellPath): { eye: Vector3; at: Vector3; fov: number } {
  const B = FAREWELL_BEATS, b = path.risen, rise = path.rise
  const lift = monotone([[0, 0], ...rise.lift, [B.risen, 1]], s)
  // headings unwrapped key to key, so every step takes the short way round
  const headings: [number, number][] = [[0, first.heading]]
  for (const [at, value] of [...rise.heading, [B.risen, b.heading] as const]) {
    const last = headings[headings.length - 1]![1]
    headings.push([at, last + shortestTurn(last, value)])
  }
  const eye = new Vector3(lerp(first.eye[0], b.eye[0], lift), lerp(first.eye[2], b.eye[2], lift), -lerp(first.eye[1], b.eye[1], lift))
  const dir = along(monotone(headings, s), monotone([[0, first.pitch], ...rise.pitch, [B.risen, b.pitch]], s), new Vector3())
  return { eye, at: eye.clone().addScaledVector(dir, 10), fov: lerp(first.fov, b.fov, smooth(s / B.risen)) }
}

/** The whole state at a share: the hour, the sun and its light. */
export function farewellAt(share: number): { hour: number; sun: { azimuth: number; elevation: number }; light: FarewellLight } {
  const hour = farewellHour(share)
  const sun = farewellSunAt(share)
  return { hour, sun, light: farewellLight(sun.elevation) }
}
