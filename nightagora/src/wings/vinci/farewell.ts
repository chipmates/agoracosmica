/** THE FAREWELL AT THE GRAVE: the eye stays where the visitor stands and looks
 * up into the sky, as the lobby's own look up does, while the afternoon runs
 * on to sunset, the blue hour and the night.
 *
 * The sun keeps the day's own hours and its own place in the sky: 10 October
 * 1517 at Amboise, from the hour the wing stands in to astronomical night, its
 * height computed from the site's latitude and the day's own noon, which
 * reproduces the ephemeris rows in `data/light-rig.json` to a few hundredths
 * of a degree. It sets at 255.6 deg, west-south-west, behind the court's back
 * wall and its trees. The light and the sky's twilight stay scenic
 * assumptions, as the rig's night rule says of every twilight: a type of an
 * October evening, not a record of that one. The stars are the record: the
 * sky over Clos Lucé at 21:00 local apparent time on the day, held fixed
 * while the evening runs (`farewell-night.ts`); the Milky Way is drawn after
 * the real one.
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
/** the sun eighteen degrees under: astronomical night */
export const FAREWELL_TO_HOUR = 19.035

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

/** THE FAREWELL'S CLOCK. The afternoon is spent while the eye looks up; the
 * sky then carries the evening on through one continuous run of the hour, and
 * the night gets the time a blue afternoon had. */
export const FAREWELL_SECONDS = 13
/** The full night held before the lobby takes the visitor home, the last of
 * it a dip of the print so the lobby's own night comes in on a cut. The
 * film's evening is rendered to the same length (`forge/film/evening.mjs`). */
export const FAREWELL_REST = 3.5
export const FAREWELL_DIP = .8
/** The shooting star, the museum's own, in the held night: seconds from the
 * run's start. */
export const FAREWELL_METEOR = 14.3
const sec = (seconds: number): number => seconds / FAREWELL_SECONDS
/** The hour at a share of the farewell, through keys set by the sun's height:
 * the crowns already gold as the tilt lands (8 degrees), the sun at the hill
 * (1), the rose afterglow and the first star (3 under), the blue hour and the
 * bright stars (7.5 under), nautical dusk and the field (12 under),
 * astronomical night and the Milky Way (18 under). The afterglow gets the
 * longest stretch: the eye lingers where the colour is. From inside the court
 * the walls hide the disc and the horizon, so the sunset is the sky's and the
 * clouds' colour. */
const HOUR_KEYS = [[0, FAREWELL_FROM_HOUR], [sec(1.2), 16.41], [sec(3.4), 17.143], [sec(6.8), 17.549], [sec(8.7), 17.999], [sec(10.6), 18.444], [1, FAREWELL_TO_HOUR]] as const
export function farewellHour(share: number): number {
  return monotone(HOUR_KEYS, Math.max(0, Math.min(1, share)))
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

/** THE LOOK UP, in seconds of the farewell's clock: the eye stays where it
 * stands, keeps its heading and its lens, and tilts up from its own pitch.
 * The tilt starts at the press, eases in and out and lands by a second and a
 * half (the first key) at about half the speed a one-second tilt needs, so
 * no frame of it smears; the gaze then keeps rising slowly into the sky while
 * the stars come out, so the grave's board has left the frame before the
 * afterglow's peak, and ends where the Milky Way stands over the elm's crown.
 * From the grave the view stands on the back wall's filter band with the tall
 * elm over it, and the evening's glow on the left: no turn is needed. */
export interface FarewellLook { from: number; pitch: readonly (readonly [number, number])[] }
export const FAREWELL_LOOK: { desktop: FarewellLook; phone: FarewellLook } = {
  desktop: { from: 0, pitch: [[1.5, 21], [FAREWELL_SECONDS, 49]] },
  phone: { from: 0, pitch: [[1.5, 19], [FAREWELL_SECONDS, 53]] },
}

/** A heading clockwise from north and a pitch, as a direction in the engine. */
export function along(heading: number, pitch: number, out: Vector3): Vector3 {
  const h = heading * RAD, p = pitch * RAD
  return out.set(Math.sin(h) * Math.cos(p), Math.sin(p), -Math.cos(h) * Math.cos(p))
}
const headingOf = (d: Vector3): number => Math.atan2(d.x, -d.z) / RAD
const pitchOf = (d: Vector3): number => Math.asin(Math.max(-1, Math.min(1, d.y / Math.max(1e-9, d.length())))) / RAD

/** The eye at a share of the farewell, from the pose it leaves at the grave:
 * the same eye, the same heading and lens, the pitch through the look's keys. */
export function farewellPose(share: number, start: { eye: Vector3; at: Vector3; fov: number }, phone: boolean): { eye: Vector3; at: Vector3; fov: number } {
  const look = FAREWELL_LOOK[phone ? 'phone' : 'desktop']
  const t = Math.max(0, Math.min(1, share)) * FAREWELL_SECONDS
  const d0 = start.at.clone().sub(start.eye), pitch0 = pitchOf(d0)
  // a tilt from the press itself starts level from the spline's own end: a second knot at 0 would divide by zero
  const hold: (readonly [number, number])[] = look.from > 0 ? [[0, pitch0], [look.from, pitch0]] : [[0, pitch0]]
  const dir = along(headingOf(d0), monotone([...hold, ...look.pitch], t), new Vector3())
  const eye = start.eye.clone()
  return { eye, at: eye.clone().addScaledVector(dir, 10), fov: start.fov }
}

/** The whole state at a share: the hour, the sun and its light. */
export function farewellAt(share: number): { hour: number; sun: { azimuth: number; elevation: number }; light: FarewellLight } {
  const hour = farewellHour(share)
  const sun = farewellSun(hour)
  return { hour, sun, light: farewellLight(sun.elevation) }
}
