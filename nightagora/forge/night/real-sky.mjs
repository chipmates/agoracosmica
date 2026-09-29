// THE REAL SKY OVER THE GRAVE: every star of the Yale Bright Star Catalogue
// (5th revised edition, Hoffleit and Warren 1991, CDS V/50) where it stood over
// Clos Lucé at 21:00 local apparent time on 10 October 1517 (Julian), written
// as the evening's star module `src/wings/vinci/farewell-night-stars.ts`, with
// the one matrix that takes an engine direction to galactic coordinates at
// that moment. It stands outside every film key; the wing fetches nothing.
//
//   node forge/night/real-sky.mjs [<BSC5 catalog file>] [--out=<module>] [--print]
//
// Without a file the catalogue is fetched once from the CDS archive; either
// way the decompressed text must carry the pinned sha256.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const MODULE_FILE = 'src/wings/vinci/farewell-night-stars.ts'
export const CATALOG_SHA256 = '69797549cc1605aad7ff94e9325e29a1661f2a253917faaa056d9bf20b809afd'
export const CATALOG_URL = 'https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz'
export const CATALOG_PAGE = 'https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50'

const RAD = Math.PI / 180
const ARCSEC = RAD / 3600

/** Clos Lucé: the dossier's latitude as `farewell.ts` carries it, the longitude as `content.ts` states it. */
export const SITE = Object.freeze({ latitude: 47.4103059, longitude: 0.9921 })
/** The wing's own hour arithmetic (`content.ts`): LAT = UT + 00:18:52 on the day, delta-T 180.5 s. */
export const LAT_MINUS_UT_SECONDS = 18 * 60 + 52
export const DELTA_T_SECONDS = 180.5
/** The moment the stars are held at, in local apparent hours. */
export const NIGHT_LAT_HOUR = 21
/** The lowest altitude kept: a star just under the horizon still stands behind the walls. */
export const KEEP_ABOVE_DEGREES = -1

/** Meeus 7.1 for a date of the Julian calendar, 0 h UT. */
export function julianDayJulianCalendar(year, month, day) {
  let y = year, m = month
  if (m <= 2) { y -= 1; m += 12 }
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day - 1524.5
}
/** 10 October 1517, Julian calendar, 0 h UT */
export const DAY_JD = julianDayJulianCalendar(1517, 10, 10)

const wrap360 = (deg) => ((deg % 360) + 360) % 360

/** Mean sidereal time at Greenwich (Meeus 12.4), degrees. */
export function greenwichSiderealDegrees(jdUT) {
  const d = jdUT - 2451545.0, T = d / 36525
  return wrap360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - (T * T * T) / 38710000)
}

/** A local apparent hour of the day as a moment: UT, the two Julian dates and the local mean sidereal time. */
export function momentAt(latHour) {
  const utHour = latHour - LAT_MINUS_UT_SECONDS / 3600
  const jdUT = DAY_JD + utHour / 24
  const jdTT = jdUT + DELTA_T_SECONDS / 86400
  return { latHour, utHour, jdUT, jdTT, lstDegrees: wrap360(greenwichSiderealDegrees(jdUT) + SITE.longitude) }
}
/** A UT hour of the day as a moment. */
export const momentAtUT = (utHour) => momentAt(utHour + LAT_MINUS_UT_SECONDS / 3600)

/* ---- 3x3 matrices, row-major arrays of rows ---- */
export const apply = (M, v) => [0, 1, 2].map((i) => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2])
export const multiply = (A, B) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]))
export const transpose = (M) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => M[j][i]))
const rotZ = (a) => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]]
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l] }

/** IAU 1976 precession from J2000.0 to the mean equinox of date (Meeus 21.3, rigorous). */
export function precessionMatrix(jdTT) {
  const t = (jdTT - 2451545.0) / 36525
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) * ARCSEC
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) * ARCSEC
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) * ARCSEC
  const [cz, sz, ct, st, cx, sx] = [Math.cos(z), Math.sin(z), Math.cos(theta), Math.sin(theta), Math.cos(zeta), Math.sin(zeta)]
  return [
    [cz * ct * cx - sz * sx, -cz * ct * sx - sz * cx, -cz * st],
    [sz * ct * cx + cz * sx, -sz * ct * sx + cz * cx, -sz * st],
    [st * cx, -st * sx, ct],
  ]
}

/** Equatorial (J2000) to galactic: the Hipparcos matrix (ESA 1997, vol. 1, section 1.5.3). */
export const GALACTIC_FROM_J2000 = Object.freeze([
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.4448296300, 0.7469822445],
  [-0.8676661490, -0.1980763734, 0.4559837762],
])

/** A star's J2000 direction carried by its proper motion to `years` after
    J2000.0, along the tangent plane (the catalogue's pmRA is mu-alpha times
    cos delta, arcseconds a year, as its Polaris row shows). */
export function starDirection(star, years) {
  const a = star.ra * RAD, d = star.dec * RAD
  const r = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]
  const east = [-Math.sin(a), Math.cos(a), 0]
  const north = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)]
  const ma = star.pmRA * ARCSEC * years, md = star.pmDE * ARCSEC * years
  return unit([r[0] + ma * east[0] + md * north[0], r[1] + ma * east[1] + md * north[1], r[2] + ma * east[2] + md * north[2]])
}

/** A direction of date to altitude and azimuth (clockwise from north) at the site, degrees. */
export function horizonOf(vDate, lstDegrees) {
  const ra = Math.atan2(vDate[1], vDate[0]), dec = Math.asin(Math.max(-1, Math.min(1, vDate[2])))
  const H = lstDegrees * RAD - ra, phi = SITE.latitude * RAD
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD
  const azimuth = wrap360(Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / RAD + 180)
  return { altitude, azimuth }
}

/** The engine's direction for a heading and a pitch: x east, y up, z south (`along()` in farewell.ts). */
export function engineOf({ azimuth, altitude }) {
  const h = azimuth * RAD, p = altitude * RAD
  return [Math.sin(h) * Math.cos(p), Math.sin(p), -Math.cos(h) * Math.cos(p)]
}

/** The engine's direction to galactic coordinates at a moment: engine to the
    hour-angle frame, to the equator of date by the sidereal time, back to
    J2000 by precession, to the galaxy. Row-major; unit galactic vector
    (x toward l 0, y toward l 90, z the north galactic pole). */
export function galacticMatrix(moment) {
  const phi = SITE.latitude * RAD
  // rows: the equator's point on the meridian, east, the celestial pole, each in engine coordinates
  const hourFromEngine = [[0, Math.cos(phi), Math.sin(phi)], [1, 0, 0], [0, Math.sin(phi), -Math.cos(phi)]]
  const dateFromHour = rotZ(moment.lstDegrees * RAD)
  const j2000FromDate = transpose(precessionMatrix(moment.jdTT))
  return multiply(GALACTIC_FROM_J2000, multiply(j2000FromDate, multiply(dateFromHour, hourFromEngine)))
}
/** Galactic longitude and latitude of a galactic unit vector, degrees. */
export const galacticOf = (g) => ({ l: wrap360(Math.atan2(g[1], g[0]) / RAD), b: Math.asin(Math.max(-1, Math.min(1, g[2]))) / RAD })

/** The Sun's direction of date (Meeus 25, low accuracy, mean equinox of date, no aberration). */
export function sunDirection(jdTT) {
  const T = (jdTT - 2451545.0) / 36525
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * RAD
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M)
  const lon = (L0 + C) * RAD
  const eps = (23 + 26 / 60 + 21.448 / 3600 - (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600) * RAD
  return [Math.cos(lon), Math.cos(eps) * Math.sin(lon), Math.sin(eps) * Math.sin(lon)]
}
/** The Sun's altitude and azimuth at a moment. */
export const sunAt = (moment) => horizonOf(sunDirection(moment.jdTT), moment.lstDegrees)

/* ---- the catalogue (ReadMe: bytes 76-90 J2000 position, 103-107 V, 110-114 B-V, 149-160 proper motion) ---- */
const field = (line, from, to) => line.slice(from - 1, to).trim()
export function readCatalog(text) {
  const stars = []
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '').padEnd(197)
    const hr = Number(field(line, 1, 4))
    if (!hr || !field(line, 76, 77) || !field(line, 103, 107)) continue
    const ra = (Number(field(line, 76, 77)) + Number(field(line, 78, 79)) / 60 + Number(field(line, 80, 83)) / 3600) * 15
    const dec = (line[83] === '-' ? -1 : 1) * (Number(field(line, 85, 86)) + Number(field(line, 87, 88)) / 60 + Number(field(line, 89, 90)) / 3600)
    const bv = field(line, 110, 114)
    stars.push({
      hr, name: field(line, 5, 14), ra, dec, V: Number(field(line, 103, 107)), BV: bv === '' ? null : Number(bv),
      pmRA: Number(field(line, 149, 154) || 0), pmDE: Number(field(line, 155, 160) || 0),
      glon: Number(field(line, 91, 96)), glat: Number(field(line, 97, 102)),
    })
  }
  return stars
}

/** Every star at a moment: altitude, azimuth and its engine direction. */
export function skyAt(stars, moment) {
  const years = (moment.jdTT - 2451545.0) / 365.25
  const P = precessionMatrix(moment.jdTT)
  return stars.map((s) => {
    const { altitude, azimuth } = horizonOf(apply(P, starDirection(s, years)), moment.lstDegrees)
    return { ...s, altitude, azimuth }
  })
}

export function catalogText(buffer) {
  const sha = createHash('sha256').update(buffer).digest('hex')
  if (sha !== CATALOG_SHA256) throw new Error(`the catalogue's sha256 is ${sha}, not the pinned ${CATALOG_SHA256}`)
  return buffer.toString('latin1')
}
async function fetchCatalog() {
  const res = await fetch(CATALOG_URL)
  if (!res.ok) throw new Error(`${CATALOG_URL}: HTTP ${res.status}`)
  return gunzipSync(Buffer.from(await res.arrayBuffer()))
}

const hms = (hours) => {
  const s = Math.round(hours * 3600)
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':')
}
const num = (x, places) => { const v = Math.round(x * 10 ** places) / 10 ** places; return String(Object.is(v, -0) ? 0 : v) }

/** The data module's text. */
export function starModule(stars, moment) {
  const sky = skyAt(stars, moment).filter((s) => s.altitude > KEEP_ABOVE_DEGREES).sort((a, b) => a.hr - b.hr)
  const M = galacticMatrix(moment)
  const rows = sky.map((s) => [num(s.azimuth, 2), num(s.altitude, 2), num(s.V, 2), s.BV === null ? 'NaN' : num(s.BV, 2), String(s.hr)].join(','))
  const lines = []
  for (let i = 0; i < rows.length; i += 8) lines.push(`  ${rows.slice(i, i + 8).join(', ')},`)
  return `/* THE SKY OVER CLOS LUCÉ AT 21:00 LOCAL APPARENT TIME, 10 OCTOBER 1517 (JULIAN).
 * Written by forge/night/real-sky.mjs; regenerate, never edit by hand.
 *
 * Source: the Yale Bright Star Catalogue, 5th revised edition (Hoffleit and
 * Warren 1991), from the CDS, Strasbourg, catalogue V/50 (${CATALOG_PAGE}),
 * file \`catalog\`, sha256 ${CATALOG_SHA256}.
 * Method: each star's J2000 position carried back by its proper motion to the
 * moment (${num((moment.jdTT - 2451545.0) / 365.25, 2)} Julian years), IAU 1976 precession to the mean
 * equinox of date (Meeus, Astronomical Algorithms, ch. 21), mean sidereal
 * time (Meeus 12.4), then altitude and azimuth at ${SITE.latitude} N,
 * ${SITE.longitude} E. No nutation, aberration or refraction.
 * Moment: 21:00 LAT = ${hms(moment.utHour)} UT (the wing's LAT - UT of 00:18:52,
 * delta-T ${DELTA_T_SECONDS} s), JD(UT) ${moment.jdUT.toFixed(6)}, local sidereal time ${num(moment.lstDegrees, 4)} deg.
 * Kept: every star above ${KEEP_ABOVE_DEGREES} deg, ${sky.length} of ${stars.length}.
 */

/** The moment the stars are held at. */
export const NIGHT_SKY_MOMENT = { latHour: ${NIGHT_LAT_HOUR}, ut: '${hms(moment.utHour)}', jdUT: ${moment.jdUT.toFixed(6)}, lstDegrees: ${num(moment.lstDegrees, 6)} } as const

/** An engine direction (x east, y up, z south) to galactic coordinates at the
 * moment: rows of the matrix, the result a unit vector (x toward l 0, y
 * toward l 90, z the north galactic pole). */
export const NIGHT_GALACTIC: readonly (readonly [number, number, number])[] = [
${M.map((r) => `  [${r.map((x) => x.toFixed(10)).join(', ')}],`).join('\n')}
]

/** Five numbers a star: azimuth (deg, clockwise from north), altitude (deg),
 * V, B-V (NaN where the catalogue has none), the catalogue's HR number. */
export const NIGHT_STARS_STRIDE = 5
export const NIGHT_STARS: readonly number[] = [
${lines.join('\n')}
]
`
}

async function main() {
  const args = process.argv.slice(2)
  const file = args.find((a) => !a.startsWith('--'))
  const outFlag = args.find((a) => a.startsWith('--out='))
  const out = resolve(APP_ROOT, outFlag ? outFlag.slice(6) : MODULE_FILE)
  const text = catalogText(file ? readFileSync(file) : await fetchCatalog())
  const stars = readCatalog(text)
  const moment = momentAt(NIGHT_LAT_HOUR)
  if (args.includes('--print')) {
    const at = new Map(skyAt(stars, moment).map((s) => [s.hr, s]))
    for (const [hr, name] of [[7001, 'Vega'], [7924, 'Deneb'], [424, 'Polaris'], [6705, 'Eltanin'], [7796, 'Sadr'], [7417, 'Albireo'], [5563, 'Kochab']]) {
      const s = at.get(hr)
      console.log(`${name.padEnd(8)} HR ${String(hr).padStart(4)} V ${s.V.toFixed(2).padStart(5)} alt ${s.altitude.toFixed(3).padStart(8)} az ${s.azimuth.toFixed(3).padStart(8)}`)
    }
  }
  const body = starModule(stars, moment)
  writeFileSync(out, body)
  console.log(`${relative(APP_ROOT, out)}: ${(body.length / 1024).toFixed(1)} KB, ${hms(moment.utHour)} UT, LST ${moment.lstDegrees.toFixed(4)} deg`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
