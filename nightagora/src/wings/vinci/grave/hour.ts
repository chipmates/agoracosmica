/** Solar-only port of refs/place/notes/hour.py.
 *
 * Meeus, Astronomical Algorithms (2nd ed.), chapters 25, 28 and 12;
 * Espenak–Meeus (2006), Delta-T polynomial for 1000–1600.
 * The output is a chosen calculation, not a witnessed death hour or weather.
 * Altitude is geometric: no refraction or terrain correction is applied.
 */

const DEG = Math.PI / 180
const LATITUDE = 47.4103059
const LONGITUDE = 0.9920706
const START_UT_SECONDS = 18 * 3600 + 50 * 60

export interface ComputedHour {
  /** Clamped offset into the chosen real minute, in seconds. */
  seconds: number
  /** Degrees clockwise from true north. */
  azimuth: number
  /** Geometric altitude of the solar centre, in degrees. */
  altitude: number
  /** Modelled TT minus UT in seconds, before display rounding. */
  deltaT: number
  /** Julian Day on the UT scale, not the terrestrial-time argument. */
  jd: number
  /** HH:MM:SS, rounded to the nearest second. */
  UTclock: string
  /** Local apparent solar HH:MM:SS, rounded to the nearest second. */
  localApparentTime: string
  equationOfTimeMinutes: number
  longitudeOffsetMinutes: number
  localApparentSeconds: number
}

const wrapDegrees = (angle: number): number => ((angle % 360) + 360) % 360

function julianDayAtMidnight(): number {
  // Julian 2 May 1519, equivalent to proleptic Gregorian 12 May 1519.
  // No Gregorian century correction belongs in this historical date.
  return Math.floor(365.25 * (1519 + 4716)) + Math.floor(30.6001 * (5 + 1)) + 2 - 1524.5
}

function deltaT(): number {
  // The month-midpoint year argument reproduces the held 178.978 s result.
  // This monthly model is constant over the displayed sixty-second span.
  const yearFraction = 1519 + (5 - 0.5) / 12
  const t = (yearFraction - 1000) / 100
  return 1574.2 - 556.01 * t + 71.23472 * t ** 2 + 0.319781 * t ** 3
    - 0.8503463 * t ** 4 - 0.005050998 * t ** 5 + 0.0083572073 * t ** 6
}

function apparentSun(jde: number): { rightAscension: number; declination: number; equationOfTime: number } {
  const t = (jde - 2451545) / 36525
  const meanLongitude = wrapDegrees(280.46646 + 36000.76983 * t + 0.0003032 * t * t)
  const meanAnomaly = wrapDegrees(357.52911 + 35999.05029 * t - 0.0001537 * t * t)
  const eccentricity = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t
  const centre = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(meanAnomaly * DEG)
    + (0.019993 - 0.000101 * t) * Math.sin(2 * meanAnomaly * DEG)
    + 0.000289 * Math.sin(3 * meanAnomaly * DEG)
  const omega = 125.04 - 1934.136 * t
  const longitude = meanLongitude + centre - 0.00569 - 0.00478 * Math.sin(omega * DEG)
  const meanObliquity = 23 + 26 / 60 + 21.448 / 3600
    - (46.8150 * t + 0.00059 * t * t - 0.001813 * t ** 3) / 3600
  const obliquity = meanObliquity + 0.00256 * Math.cos(omega * DEG)
  const rightAscension = wrapDegrees(Math.atan2(
    Math.cos(obliquity * DEG) * Math.sin(longitude * DEG),
    Math.cos(longitude * DEG),
  ) / DEG)
  const declination = Math.asin(Math.sin(obliquity * DEG) * Math.sin(longitude * DEG)) / DEG
  const y = Math.tan(obliquity * DEG / 2) ** 2
  const equation = y * Math.sin(2 * meanLongitude * DEG)
    - 2 * eccentricity * Math.sin(meanAnomaly * DEG)
    + 4 * eccentricity * y * Math.sin(meanAnomaly * DEG) * Math.cos(2 * meanLongitude * DEG)
    - 0.5 * y * y * Math.sin(4 * meanLongitude * DEG)
    - 1.25 * eccentricity * eccentricity * Math.sin(2 * meanAnomaly * DEG)
  return { rightAscension, declination, equationOfTime: equation / DEG * 4 }
}

function siderealDegrees(jd: number): number {
  const t = (jd - 2451545) / 36525
  return wrapDegrees(280.46061837 + 360.98564736629 * (jd - 2451545)
    + 0.000387933 * t * t - t ** 3 / 38710000)
}

function clock(seconds: number): string {
  const rounded = Math.round(seconds)
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor(rounded % 3600 / 60)
  const remainder = rounded % 60
  return [hours, minutes, remainder].map(value => String(value).padStart(2, '0')).join(':')
}

/** The chosen 18:50:00–18:51:00 UT minute on Julian 2 May 1519.
 * Finite input outside the interval holds the corresponding endpoint;
 * non-finite input is rejected so an invalid clock cannot light a scene.
 */
export function computedHour(seconds = 0): ComputedHour {
  if (!Number.isFinite(seconds)) throw new RangeError('Solar minute offset must be finite')
  const offset = Math.min(60, Math.max(0, seconds))
  const utSeconds = START_UT_SECONDS + offset
  const jd = julianDayAtMidnight() + utSeconds / 86400
  const dt = deltaT()
  const sun = apparentSun(jd + dt / 86400)
  const hourAngle = wrapDegrees(siderealDegrees(jd) + LONGITUDE - sun.rightAscension) * DEG
  const latitude = LATITUDE * DEG
  const declination = sun.declination * DEG
  const altitude = Math.asin(Math.sin(latitude) * Math.sin(declination)
    + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle)) / DEG
  const azimuth = wrapDegrees(Math.atan2(Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(latitude) - Math.tan(declination) * Math.cos(latitude)) / DEG + 180)
  const longitudeOffsetMinutes = 4 * LONGITUDE
  const localApparentSeconds = utSeconds + (longitudeOffsetMinutes + sun.equationOfTime) * 60
  return {
    seconds: offset,
    azimuth,
    altitude,
    deltaT: dt,
    jd,
    UTclock: clock(utSeconds),
    localApparentTime: clock(localApparentSeconds),
    equationOfTimeMinutes: sun.equationOfTime,
    longitudeOffsetMinutes,
    localApparentSeconds,
  }
}
